"""
Scenarios Router — executes real boto3 attack/baseline scenarios against Floci.
"""
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List
import datetime

from database import get_db
from models import Agent, ActivityLog, RiskEvent
from services.attack_scenarios import SCENARIOS, run_scenario
from routers.risk import calculate_risk_score, get_gemini_explanation

router = APIRouter()


@router.get("/", summary="List all available scenarios")
def list_scenarios():
    return {"scenarios": SCENARIOS}


@router.post("/{scenario_id}/run/{agent_id}", summary="Execute a scenario with real AWS calls")
def execute_scenario(scenario_id: str, agent_id: str, db: Session = Depends(get_db)):
    """
    Execute a real boto3 scenario against Floci, log to ActivityLog, and trigger risk analysis.
    """
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    scenario = next((s for s in SCENARIOS if s["id"] == scenario_id), None)
    if not scenario:
        raise HTTPException(status_code=404, detail="Scenario not found")

    # Execute real boto3 calls against Floci
    result = run_scenario(scenario_id, agent_id, agent.iam_role)

    if not result["success"] and not result["events"]:
        raise HTTPException(status_code=500, detail=f"Scenario execution failed: {result.get('errors', [])}")

    # Persist events to ActivityLog
    created_logs = []
    for event in result["events"]:
        is_anomalous = scenario["severity"] != "LOW"
        anomaly_reason = None
        if is_anomalous:
            if event["service"] not in (agent.expected_services or []):
                anomaly_reason = f"Unexpected service '{event['service']}' accessed during scenario: {scenario['name']}"
            elif event["event_name"] not in (agent.expected_actions or []):
                anomaly_reason = f"Unexpected action '{event['event_name']}' — {scenario['description']}"
            else:
                anomaly_reason = f"Scenario execution: {scenario['name']}"

        log = ActivityLog(
            agent_id=agent_id,
            event_time=datetime.datetime.utcnow(),
            event_name=event["event_name"],
            service=event["service"],
            resource_arn=event["resource_arn"],
            resource_name=event["resource_name"],
            region="us-east-1",
            source_ip="10.0.1.99",
            is_anomalous=is_anomalous,
            anomaly_reason=anomaly_reason,
            request_params={"userAgent": "aws-sdk-python/1.34.0", "scenario": scenario_id, "executed_via": "AgentTrace"}
        )
        db.add(log)
        created_logs.append(log)

    db.commit()

    # Run risk analysis on the most significant event
    risk_results = []
    if result["events"]:
        primary_event = result["events"][0]
        if scenario["severity"] in ("CRITICAL", "HIGH", "MEDIUM"):
            risk_result = calculate_risk_score(
                agent, primary_event["event_name"],
                primary_event["service"], primary_event["resource_name"]
            )
            explanation, recommendations = get_gemini_explanation(
                agent, primary_event["event_name"],
                primary_event["service"], primary_event["resource_name"],
                risk_result["score"], risk_result["level"], risk_result["factors"]
            )

            risk_event = RiskEvent(
                agent_id=agent_id,
                risk_score=risk_result["score"],
                risk_level=risk_result["level"],
                risk_factors=risk_result["factors"],
                explanation=explanation,
                recommendations=recommendations,
                triggering_action=primary_event["event_name"],
                triggering_resource=primary_event["resource_name"],
                is_resolved=False,
            )
            db.add(risk_event)
            db.commit()

            risk_results.append({
                "risk_score": risk_result["score"],
                "risk_level": risk_result["level"],
                "risk_factors": risk_result["factors"],
                "explanation": explanation,
                "recommendations": recommendations
            })

    return {
        "scenario": scenario,
        "agent_id": agent_id,
        "events_created": len(created_logs),
        "events": result["events"],
        "errors": result["errors"],
        "risk_analysis": risk_results[0] if risk_results else None,
        "executed_at": result["executed_at"]
    }
