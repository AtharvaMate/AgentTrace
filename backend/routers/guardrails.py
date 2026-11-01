from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import datetime

from database import get_db
from models import Agent, Guardrail, BehavioralFingerprint
from schemas import GuardrailResponse, GuardrailCreate

router = APIRouter()

SENSITIVE_SERVICES = {"iam", "secretsmanager", "kms", "sts"}
HIGH_IMPACT_ACTIONS = {
    "DeleteBucket", "DeleteObject", "DeleteTable", "DeleteRole", 
    "PutRolePolicy", "AttachRolePolicy", "CreateRole", "CreateUser",
    "DeleteUser", "PutUserPolicy", "AttachUserPolicy"
}


@router.get("/{agent_id}", response_model=List[GuardrailResponse])
def get_guardrails(agent_id: str, db: Session = Depends(get_db)):
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    guardrails = db.query(Guardrail).filter(Guardrail.agent_id == agent_id).all()
    return [GuardrailResponse.model_validate(g) for g in guardrails]


@router.post("/{agent_id}/generate")
def generate_guardrails(agent_id: str, db: Session = Depends(get_db)):
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    fp = db.query(BehavioralFingerprint).filter(BehavioralFingerprint.agent_id == agent_id).first()
    if not fp:
        raise HTTPException(status_code=400, detail="Fingerprint not found. Build fingerprint first.")
    
    existing = db.query(Guardrail).filter(
        Guardrail.agent_id == agent_id,
        Guardrail.auto_generated == True
    ).all()
    for g in existing:
        db.delete(g)
    db.commit()
    
    guardrails_created = []
    
    if fp.normal_services:
        guardrail = Guardrail(
            agent_id=agent_id,
            rule_type="allowed_services",
            rule_config={"services": fp.normal_services},
            is_active=True,
            auto_generated=True,
            description=f"Only allow access to services seen during normal operation: {', '.join(fp.normal_services[:5])}{'...' if len(fp.normal_services) > 5 else ''}"
        )
        db.add(guardrail)
        guardrails_created.append("allowed_services")
    
    if fp.normal_actions:
        guardrail = Guardrail(
            agent_id=agent_id,
            rule_type="allowed_actions",
            rule_config={"actions": fp.normal_actions},
            is_active=True,
            auto_generated=True,
            description=f"Only allow actions seen during normal operation: {', '.join(fp.normal_actions[:5])}{'...' if len(fp.normal_actions) > 5 else ''}"
        )
        db.add(guardrail)
        guardrails_created.append("allowed_actions")
    
    sensitive_in_normal = [s for s in fp.normal_services if s in SENSITIVE_SERVICES]
    if not sensitive_in_normal:
        guardrail = Guardrail(
            agent_id=agent_id,
            rule_type="block_sensitive_services",
            rule_config={"services": list(SENSITIVE_SERVICES)},
            is_active=True,
            auto_generated=True,
            description=f"Block access to sensitive services never used in normal operation: {', '.join(SENSITIVE_SERVICES)}"
        )
        db.add(guardrail)
        guardrails_created.append("block_sensitive_services")
    
    dangerous_actions = [a for a in HIGH_IMPACT_ACTIONS if a not in fp.normal_actions]
    if dangerous_actions:
        guardrail = Guardrail(
            agent_id=agent_id,
            rule_type="block_dangerous_actions",
            rule_config={"actions": dangerous_actions},
            is_active=True,
            auto_generated=True,
            description=f"Block destructive actions never performed in normal operation: {', '.join(dangerous_actions[:5])}{'...' if len(dangerous_actions) > 5 else ''}"
        )
        db.add(guardrail)
        guardrails_created.append("block_dangerous_actions")
    
    if fp.typical_hours and len(fp.typical_hours) > 0:
        guardrail = Guardrail(
            agent_id=agent_id,
            rule_type="allowed_time_windows",
            rule_config={
                "hours": fp.typical_hours,
                "timezone": "UTC"
            },
            is_active=True,
            auto_generated=True,
            description=f"Only allow activity during typical hours: {min(fp.typical_hours)}:00 - {max(fp.typical_hours)}:00 UTC"
        )
        db.add(guardrail)
        guardrails_created.append("allowed_time_windows")
    
    if fp.max_events_per_hour and fp.max_events_per_hour > 0:
        rate_limit = int(fp.max_events_per_hour * 1.5)
        guardrail = Guardrail(
            agent_id=agent_id,
            rule_type="rate_limit",
            rule_config={
                "max_events_per_hour": rate_limit,
                "baseline": fp.max_events_per_hour
            },
            is_active=True,
            auto_generated=True,
            description=f"Rate limit: max {rate_limit} events/hour (150% of observed baseline: {int(fp.max_events_per_hour)})"
        )
        db.add(guardrail)
        guardrails_created.append("rate_limit")
    
    if fp.anomaly_threshold and fp.model_path:
        guardrail = Guardrail(
            agent_id=agent_id,
            rule_type="anomaly_detection",
            rule_config={
                "threshold": fp.anomaly_threshold,
                "model_version": fp.model_version
            },
            is_active=True,
            auto_generated=True,
            description=f"ML-based anomaly detection with threshold {fp.anomaly_threshold:.4f}"
        )
        db.add(guardrail)
        guardrails_created.append("anomaly_detection")
    
    db.commit()
    
    all_guardrails = db.query(Guardrail).filter(Guardrail.agent_id == agent_id).all()
    return {
        "message": f"Generated {len(guardrails_created)} guardrails",
        "guardrails_created": guardrails_created,
        "total_guardrails": len(all_guardrails),
        "guardrails": [GuardrailResponse.model_validate(g) for g in all_guardrails]
    }


@router.post("/{agent_id}")
def create_guardrail(agent_id: str, data: GuardrailCreate, db: Session = Depends(get_db)):
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    guardrail = Guardrail(
        agent_id=agent_id,
        rule_type=data.rule_type,
        rule_config=data.rule_config,
        is_active=data.is_active,
        auto_generated=False,
        description=data.description
    )
    db.add(guardrail)
    db.commit()
    db.refresh(guardrail)
    return GuardrailResponse.model_validate(guardrail)


@router.delete("/{guardrail_id}")
def delete_guardrail(guardrail_id: str, db: Session = Depends(get_db)):
    guardrail = db.query(Guardrail).filter(Guardrail.id == guardrail_id).first()
    if not guardrail:
        raise HTTPException(status_code=404, detail="Guardrail not found")
    
    db.delete(guardrail)
    db.commit()
    return {"message": "Guardrail deleted"}


@router.patch("/{guardrail_id}/toggle")
def toggle_guardrail(guardrail_id: str, db: Session = Depends(get_db)):
    guardrail = db.query(Guardrail).filter(Guardrail.id == guardrail_id).first()
    if not guardrail:
        raise HTTPException(status_code=404, detail="Guardrail not found")
    
    guardrail.is_active = not guardrail.is_active
    db.commit()
    db.refresh(guardrail)
    return GuardrailResponse.model_validate(guardrail)
