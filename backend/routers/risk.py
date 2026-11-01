import os
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import datetime

from database import get_db
from models import Agent, ActivityLog, RiskEvent
from schemas import RiskAnalysisRequest, RiskAnalysisResponse, RiskEventResponse

router = APIRouter()

# ─────────────────────────────────────────────
# Risk Scoring Engine
# ─────────────────────────────────────────────

SENSITIVE_SERVICES = {"secretsmanager", "iam", "kms", "sts"}
DESTRUCTIVE_ACTIONS = {"DeleteBucket", "DeleteObject", "DeleteItem", "DeleteTable", "TerminateInstances",
                       "DeleteStack", "DeleteFunction", "DeleteRole", "DeletePolicy"}
PRIVILEGE_ACTIONS = {"CreateRole", "AttachRolePolicy", "PutRolePolicy", "CreateUser",
                     "AddUserToGroup", "CreateAccessKey", "PassRole"}

RISK_WEIGHTS = {
    "new_service": 25,
    "sensitive_service": 30,
    "destructive_action": 25,
    "privilege_escalation": 35,
    "production_resource": 15,
    "outside_intended_purpose": 20,
    "unusual_hour": 10,
}


def calculate_risk_score(agent: Agent, action: str, service: str, resource: str) -> dict:
    score = 0.0
    factors = []

    # New service accessed
    if service not in (agent.expected_services or []):
        score += RISK_WEIGHTS["new_service"]
        factors.append(f"New service accessed: '{service}' not in agent's expected services")

    # Sensitive service
    if service in SENSITIVE_SERVICES:
        score += RISK_WEIGHTS["sensitive_service"]
        factors.append(f"Sensitive AWS service accessed: {service}")

    # Destructive action
    if action in DESTRUCTIVE_ACTIONS:
        score += RISK_WEIGHTS["destructive_action"]
        factors.append(f"Destructive action performed: {action}")

    # Privilege escalation
    if action in PRIVILEGE_ACTIONS:
        score += RISK_WEIGHTS["privilege_escalation"]
        factors.append(f"Potential privilege escalation: {action}")

    # Outside intended purpose (not in expected actions)
    if action not in (agent.expected_actions or []):
        score += RISK_WEIGHTS["outside_intended_purpose"]
        factors.append(f"Action '{action}' is outside agent's intended purpose")

    # Production resource
    if "prod" in resource.lower() or "production" in resource.lower():
        score += RISK_WEIGHTS["production_resource"]
        factors.append("Production resource accessed")

    # Unusual hour (outside 8am-6pm)
    current_hour = datetime.datetime.utcnow().hour
    if current_hour < 8 or current_hour > 18:
        score += RISK_WEIGHTS["unusual_hour"]
        factors.append(f"Activity at unusual hour: {current_hour}:00 UTC")

    score = min(score, 100.0)

    if score >= 80:
        level = "CRITICAL"
    elif score >= 55:
        level = "HIGH"
    elif score >= 30:
        level = "MEDIUM"
    else:
        level = "LOW"

    return {"score": score, "level": level, "factors": factors}


# ─────────────────────────────────────────────
# Gemini AI Explainer
# ─────────────────────────────────────────────

def get_gemini_explanation(agent: Agent, action: str, service: str, resource: str,
                            risk_score: float, risk_level: str, factors: list) -> tuple[str, list]:
    """Use Gemini API to generate risk explanation and recommendations."""
    api_key = os.getenv("GEMINI_API_KEY", "")
    if not api_key:
        return _rule_based_explanation(agent, action, service, risk_level, factors)

    try:
        import google.generativeai as genai
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel("gemini-1.5-flash")

        prompt = f"""You are an AWS cloud security expert analyzing suspicious AI agent behavior.

Agent Name: {agent.name}
Agent Purpose: {agent.purpose}
Agent Environment: {agent.environment}

Suspicious Activity:
- Action: {action}
- Service: {service}
- Resource: {resource}
- Risk Score: {risk_score}/100
- Risk Level: {risk_level}
- Risk Factors: {', '.join(factors)}

Provide a concise security analysis in this EXACT JSON format:
{{
  "explanation": "2-3 sentence explanation of why this is risky and what it might indicate",
  "recommendations": [
    "Specific actionable recommendation 1",
    "Specific actionable recommendation 2",
    "Specific actionable recommendation 3"
  ]
}}

Be specific, technical, and actionable. Focus on AWS security best practices."""

        response = model.generate_content(prompt)
        text = response.text.strip()
        # Extract JSON from response
        import json, re
        json_match = re.search(r'\{.*\}', text, re.DOTALL)
        if json_match:
            data = json.loads(json_match.group())
            return data.get("explanation", ""), data.get("recommendations", [])
    except Exception as e:
        print(f"Gemini API error: {e}")

    return _rule_based_explanation(agent, action, service, risk_level, factors)


def _rule_based_explanation(agent, action, service, risk_level, factors) -> tuple[str, list]:
    """Fallback rule-based explanation when Gemini is unavailable."""
    explanation = (
        f"The agent '{agent.name}' (designed for: {agent.purpose[:80]}...) performed '{action}' on {service}. "
        f"This is flagged as {risk_level} risk because: {'; '.join(factors[:2])}. "
        f"This behavior deviates from the agent's expected profile and may indicate prompt injection, "
        f"software bug, or unauthorized access."
    )
    recs = [
        f"Immediately review all recent {service} activity for this agent",
        f"Revoke or restrict {service} permissions if not required for agent's core function",
        "Enable CloudTrail alerts for this agent's IAM role",
        "Consider requiring human-in-the-loop approval for sensitive service access",
    ]
    if service in SENSITIVE_SERVICES:
        recs.insert(0, f"Rotate any credentials or secrets that may have been exposed via {service}")

    return explanation, recs[:3]


# ─────────────────────────────────────────────
# Routes
# ─────────────────────────────────────────────

@router.post("/analyze", response_model=RiskAnalysisResponse)
def analyze_risk(req: RiskAnalysisRequest, db: Session = Depends(get_db)):
    agent = db.query(Agent).filter(Agent.id == req.agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    risk_result = calculate_risk_score(agent, req.action, req.service, req.resource)
    explanation, recommendations = get_gemini_explanation(
        agent, req.action, req.service, req.resource,
        risk_result["score"], risk_result["level"], risk_result["factors"]
    )

    # Persist risk event
    risk_event = RiskEvent(
        agent_id=req.agent_id,
        risk_score=risk_result["score"],
        risk_level=risk_result["level"],
        risk_factors=risk_result["factors"],
        explanation=explanation,
        recommendations=recommendations,
        triggering_action=req.action,
        triggering_resource=req.resource,
        is_resolved=False,
    )
    db.add(risk_event)
    db.commit()

    # Send email notifications for anomalous behavior
    try:
        from routers.notifications import send_anomaly_notification
        from models import ActivityLog

        # Build a minimal ActivityLog-like object from the request
        mock_log = ActivityLog(
            agent_id=req.agent_id,
            event_name=req.action,
            service=req.service,
            resource_arn=req.resource,
            anomaly_reason=explanation,
            event_time=datetime.datetime.utcnow(),
            is_anomalous=True,
        )
        send_anomaly_notification(mock_log, agent, risk_result["level"], db)
    except Exception as e:
        print(f"⚠️  Email notification failed (non-critical): {e}")

    return RiskAnalysisResponse(
        risk_score=risk_result["score"],
        risk_level=risk_result["level"],
        risk_factors=risk_result["factors"],
        explanation=explanation,
        recommendations=recommendations,
    )


@router.get("/{agent_id}/events", response_model=List[RiskEventResponse])
def get_risk_events(agent_id: str, db: Session = Depends(get_db)):
    events = (
        db.query(RiskEvent)
        .filter(RiskEvent.agent_id == agent_id)
        .order_by(RiskEvent.timestamp.desc())
        .all()
    )
    return [RiskEventResponse.model_validate(e) for e in events]


@router.get("/{agent_id}/score")
def get_current_risk_score(agent_id: str, db: Session = Depends(get_db)):
    latest = (
        db.query(RiskEvent)
        .filter(RiskEvent.agent_id == agent_id)
        .order_by(RiskEvent.timestamp.desc())
        .first()
    )
    if not latest:
        return {"risk_score": 0, "risk_level": "LOW"}
    return {"risk_score": latest.risk_score, "risk_level": latest.risk_level}


@router.patch("/{event_id}/resolve")
def resolve_risk_event(event_id: str, db: Session = Depends(get_db)):
    event = db.query(RiskEvent).filter(RiskEvent.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Risk event not found")
    event.is_resolved = True
    db.commit()
    return {"message": "Risk event marked as resolved"}


@router.get("/{agent_id}/least-privilege-policy")
def generate_least_privilege_policy(agent_id: str, db: Session = Depends(get_db)):
    """Generate a minimal IAM policy based on the agent's actual usage."""
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    logs = db.query(ActivityLog).filter(
        ActivityLog.agent_id == agent_id,
        ActivityLog.is_anomalous == False
    ).all()

    # Group actual actions by service
    service_actions = {}
    service_resources = {}
    for log in logs:
        svc = log.service
        if svc not in service_actions:
            service_actions[svc] = set()
            service_resources[svc] = set()
        service_actions[svc].add(log.event_name)
        if log.resource_arn:
            service_resources[svc].add(log.resource_arn)

    # Build IAM policy statements
    statements = []
    for svc, actions in service_actions.items():
        resources = list(service_resources.get(svc, {"*"})) or ["*"]
        iam_actions = [f"{svc}:{action}" for action in sorted(actions)]
        statements.append({
            "Sid": f"Allow{svc.capitalize()}Access",
            "Effect": "Allow",
            "Action": iam_actions,
            "Resource": resources if resources else ["*"]
        })

    policy = {
        "Version": "2012-10-17",
        "Statement": statements
    }

    removed_permissions = []
    current_perms = set(agent.iam_permissions or [])
    used_perms = set()
    for svc, actions in service_actions.items():
        for action in actions:
            used_perms.add(f"{svc}:{action}")

    for perm in current_perms:
        if perm not in used_perms:
            removed_permissions.append(perm)

    return {
        "agent_id": agent_id,
        "agent_name": agent.name,
        "policy": policy,
        "services_used": list(service_actions.keys()),
        "actions_used": {svc: list(actions) for svc, actions in service_actions.items()},
        "removed_permissions": removed_permissions,
        "reduction_percent": round(len(removed_permissions) / max(len(current_perms), 1) * 100, 1)
    }

@router.get("/{agent_id}/intent-comparison")
def get_intent_comparison(agent_id: str, db: Session = Depends(get_db)):
    """Compare IAM permissions vs intended actions vs actual behavior."""
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    # Get all actual actions
    logs = db.query(ActivityLog).filter(ActivityLog.agent_id == agent_id).all()
    actual_actions = list(set(log.event_name for log in logs))
    actual_services = list(set(log.service for log in logs))

    iam_perms = agent.iam_permissions or []
    # Parse service from iam perm e.g. "s3:GetObject" -> ("s3", "GetObject")
    iam_parsed = {}
    for perm in iam_perms:
        parts = perm.split(":")
        if len(parts) == 2:
            svc, action = parts
            iam_parsed[action] = svc

    comparison = []
    all_actions = set(list(iam_parsed.keys()) + (agent.expected_actions or []) + actual_actions)

    for action in sorted(all_actions):
        svc = iam_parsed.get(action, "")
        in_iam = action in iam_parsed
        in_intended = action in (agent.expected_actions or [])
        in_actual = action in actual_actions

        # Flag if: allowed by IAM but not intended AND actually performed
        is_concerning = in_iam and not in_intended and in_actual

        comparison.append({
            "action": action,
            "service": svc or next((log.service for log in logs if log.event_name == action), ""),
            "iam_allowed": in_iam,
            "in_intended_purpose": in_intended,
            "actually_performed": in_actual,
            "is_concerning": is_concerning,
        })

    return {
        "agent_id": agent_id,
        "comparison": comparison,
        "actual_services": actual_services,
        "iam_services": list(set(v for v in iam_parsed.values())),
        "intended_services": agent.expected_services or [],
    }
