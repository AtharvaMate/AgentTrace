from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from datetime import datetime, timedelta
from pydantic import BaseModel

from database import get_db
from models import Agent, ActivityLog, RiskEvent
from schemas import AgentCreate, AgentResponse, AgentSummary, DashboardStats, FingerprintResponse

router = APIRouter()


@router.get("/", response_model=List[AgentSummary])
def list_agents(db: Session = Depends(get_db)):
    agents = db.query(Agent).all()
    summaries = []
    for agent in agents:
        total_events = db.query(ActivityLog).filter(ActivityLog.agent_id == agent.id).count()
        anomalous_events = db.query(ActivityLog).filter(
            ActivityLog.agent_id == agent.id, ActivityLog.is_anomalous == True
        ).count()
        unresolved = db.query(RiskEvent).filter(
            RiskEvent.agent_id == agent.id, RiskEvent.is_resolved == False
        ).count()
        latest_risk = db.query(RiskEvent).filter(
            RiskEvent.agent_id == agent.id
        ).order_by(RiskEvent.timestamp.desc()).first()

        fp = agent.fingerprint
        fp_response = None
        if fp:
            fp_response = FingerprintResponse.model_validate(fp)

        summaries.append(AgentSummary(
            agent=AgentResponse.model_validate(agent),
            latest_risk_score=latest_risk.risk_score if latest_risk else 0.0,
            latest_risk_level=latest_risk.risk_level if latest_risk else "LOW",
            total_events=total_events,
            anomalous_events=anomalous_events,
            unresolved_risk_events=unresolved,
            fingerprint=fp_response,
        ))
    return summaries


@router.get("/stats", response_model=DashboardStats)
def get_dashboard_stats(db: Session = Depends(get_db)):
    total_agents = db.query(Agent).count()
    today = datetime.utcnow() - timedelta(days=1)

    # Agents with critical or high latest risk
    all_agents = db.query(Agent).all()
    critical_count = 0
    high_count = 0
    for agent in all_agents:
        latest = db.query(RiskEvent).filter(
            RiskEvent.agent_id == agent.id
        ).order_by(RiskEvent.timestamp.desc()).first()
        if latest:
            if latest.risk_level == "CRITICAL":
                critical_count += 1
            elif latest.risk_level == "HIGH":
                high_count += 1

    total_events_today = db.query(ActivityLog).filter(
        ActivityLog.event_time >= today
    ).count()
    total_anomalies = db.query(ActivityLog).filter(
        ActivityLog.is_anomalous == True
    ).count()

    return DashboardStats(
        total_agents=total_agents,
        critical_agents=critical_count,
        high_risk_agents=high_count,
        total_events_today=total_events_today,
        total_anomalies=total_anomalies,
    )


@router.get("/{agent_id}", response_model=AgentSummary)
def get_agent(agent_id: str, db: Session = Depends(get_db)):
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    total_events = db.query(ActivityLog).filter(ActivityLog.agent_id == agent.id).count()
    anomalous_events = db.query(ActivityLog).filter(
        ActivityLog.agent_id == agent.id, ActivityLog.is_anomalous == True
    ).count()
    unresolved = db.query(RiskEvent).filter(
        RiskEvent.agent_id == agent.id, RiskEvent.is_resolved == False
    ).count()
    latest_risk = db.query(RiskEvent).filter(
        RiskEvent.agent_id == agent.id
    ).order_by(RiskEvent.timestamp.desc()).first()

    fp = agent.fingerprint
    fp_response = FingerprintResponse.model_validate(fp) if fp else None

    return AgentSummary(
        agent=AgentResponse.model_validate(agent),
        latest_risk_score=latest_risk.risk_score if latest_risk else 0.0,
        latest_risk_level=latest_risk.risk_level if latest_risk else "LOW",
        total_events=total_events,
        anomalous_events=anomalous_events,
        unresolved_risk_events=unresolved,
        fingerprint=fp_response,
    )


@router.post("/", response_model=AgentResponse, status_code=201)
def create_agent(data: AgentCreate, db: Session = Depends(get_db)):
    agent = Agent(**data.model_dump())
    db.add(agent)
    db.commit()
    db.refresh(agent)
    return AgentResponse.model_validate(agent)


@router.delete("/{agent_id}")
def delete_agent(agent_id: str, db: Session = Depends(get_db)):
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    db.delete(agent)
    db.commit()
    return {"message": f"Agent {agent_id} deleted"}


@router.patch("/{agent_id}/status")
def update_status(agent_id: str, status: str, db: Session = Depends(get_db)):
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    agent.status = status
    db.commit()
    return {"message": f"Agent status updated to {status}"}


class AgentUpdate(BaseModel):
    name: Optional[str] = None
    purpose: Optional[str] = None
    expected_services: Optional[List[str]] = None
    expected_actions: Optional[List[str]] = None
    iam_permissions: Optional[List[str]] = None
    owner: Optional[str] = None
    environment: Optional[str] = None


@router.patch("/{agent_id}")
def update_agent(agent_id: str, data: AgentUpdate, db: Session = Depends(get_db)):
    """Update agent fields including guardrails (expected_services, expected_actions)."""
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(agent, field, value)
    
    db.commit()
    db.refresh(agent)
    return AgentResponse.model_validate(agent)
