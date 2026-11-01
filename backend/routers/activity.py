from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import datetime
import random

from database import get_db
from models import ActivityLog, Agent
from schemas import ActivityLogResponse, SimulateEventRequest

router = APIRouter()


@router.get("/{agent_id}", response_model=List[ActivityLogResponse])
def get_agent_activity(agent_id: str, limit: int = 50, db: Session = Depends(get_db)):
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    logs = (
        db.query(ActivityLog)
        .filter(ActivityLog.agent_id == agent_id)
        .order_by(ActivityLog.event_time.desc())
        .limit(limit)
        .all()
    )
    return [ActivityLogResponse.model_validate(log) for log in logs]


@router.get("/{agent_id}/recent", response_model=List[ActivityLogResponse])
def get_recent_activity(agent_id: str, hours: int = 24, db: Session = Depends(get_db)):
    since = datetime.datetime.utcnow() - datetime.timedelta(hours=hours)
    logs = (
        db.query(ActivityLog)
        .filter(ActivityLog.agent_id == agent_id, ActivityLog.event_time >= since)
        .order_by(ActivityLog.event_time.desc())
        .all()
    )
    return [ActivityLogResponse.model_validate(log) for log in logs]


@router.get("/{agent_id}/anomalies", response_model=List[ActivityLogResponse])
def get_anomalies(agent_id: str, db: Session = Depends(get_db)):
    logs = (
        db.query(ActivityLog)
        .filter(ActivityLog.agent_id == agent_id, ActivityLog.is_anomalous == True)
        .order_by(ActivityLog.event_time.desc())
        .all()
    )
    return [ActivityLogResponse.model_validate(log) for log in logs]


@router.post("/simulate", response_model=ActivityLogResponse, status_code=201)
def simulate_event(req: SimulateEventRequest, db: Session = Depends(get_db)):
    agent = db.query(Agent).filter(Agent.id == req.agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    # Determine anomaly reason
    anomaly_reason = None
    if req.is_anomalous:
        if req.service not in agent.expected_services:
            anomaly_reason = f"Service '{req.service}' is not in agent's expected services {agent.expected_services}"
        elif req.event_name not in agent.expected_actions:
            anomaly_reason = f"Action '{req.event_name}' is not in agent's expected actions"
        else:
            anomaly_reason = "Action detected as anomalous by user simulation"

    log = ActivityLog(
        agent_id=req.agent_id,
        event_time=datetime.datetime.utcnow(),
        event_name=req.event_name,
        service=req.service,
        resource_arn=f"arn:aws:{req.service}:us-east-1:123456789:{req.resource_name}",
        resource_name=req.resource_name,
        region="us-east-1",
        source_ip="10.0.1.99",
        is_anomalous=req.is_anomalous,
        anomaly_reason=anomaly_reason,
        request_params={"userAgent": "aws-sdk-python/1.34.0", "simulated": True},
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return ActivityLogResponse.model_validate(log)


@router.get("/{agent_id}/timeline")
def get_activity_timeline(agent_id: str, days: int = 14, db: Session = Depends(get_db)):
    """Return daily event counts for timeline chart."""
    since = datetime.datetime.utcnow() - datetime.timedelta(days=days)
    logs = (
        db.query(ActivityLog)
        .filter(ActivityLog.agent_id == agent_id, ActivityLog.event_time >= since)
        .all()
    )

    # Group by day
    timeline = {}
    for log in logs:
        day = log.event_time.strftime("%Y-%m-%d")
        if day not in timeline:
            timeline[day] = {"date": day, "normal": 0, "anomalous": 0}
        if log.is_anomalous:
            timeline[day]["anomalous"] += 1
        else:
            timeline[day]["normal"] += 1

    return sorted(timeline.values(), key=lambda x: x["date"])


@router.post("/sync-cloudtrail")
def sync_cloudtrail(db: Session = Depends(get_db)):
    """Manually trigger a CloudTrail S3 poll."""
    try:
        from services.cloudtrail_poller import get_cloudtrail_poller
        poller = get_cloudtrail_poller()
        poller.poll_once()
        return {"message": "CloudTrail sync triggered successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"CloudTrail sync failed: {str(e)}")
