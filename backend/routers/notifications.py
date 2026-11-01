from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel, EmailStr
import datetime

from database import get_db
from models import EmailNotificationSetting, Agent, ActivityLog
from services.email_notifier import email_notifier


router = APIRouter()


# Schemas
class EmailNotificationSettingCreate(BaseModel):
    email_address: EmailStr
    enabled: bool = True
    notify_on_critical: bool = True
    notify_on_high: bool = True
    notify_on_medium: bool = False
    notify_on_low: bool = False


class EmailNotificationSettingResponse(BaseModel):
    id: str
    agent_id: str
    email_address: str
    enabled: bool
    notify_on_critical: bool
    notify_on_high: bool
    notify_on_medium: bool
    notify_on_low: bool
    created_at: datetime.datetime
    last_notification_sent: datetime.datetime | None
    notification_count: int

    class Config:
        from_attributes = True


class TestEmailRequest(BaseModel):
    email_address: EmailStr


# Endpoints
@router.get("/{agent_id}", response_model=List[EmailNotificationSettingResponse])
def get_email_settings(agent_id: str, db: Session = Depends(get_db)):
    """Get email notification settings for an agent."""
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    settings = db.query(EmailNotificationSetting).filter(
        EmailNotificationSetting.agent_id == agent_id
    ).all()
    
    return settings


@router.post("/{agent_id}", response_model=EmailNotificationSettingResponse)
def create_email_setting(
    agent_id: str,
    setting: EmailNotificationSettingCreate,
    db: Session = Depends(get_db)
):
    """Create email notification setting for an agent."""
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    # Check if email already exists for this agent
    existing = db.query(EmailNotificationSetting).filter(
        EmailNotificationSetting.agent_id == agent_id,
        EmailNotificationSetting.email_address == setting.email_address
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered for this agent")
    
    new_setting = EmailNotificationSetting(
        agent_id=agent_id,
        email_address=setting.email_address,
        enabled=setting.enabled,
        notify_on_critical=setting.notify_on_critical,
        notify_on_high=setting.notify_on_high,
        notify_on_medium=setting.notify_on_medium,
        notify_on_low=setting.notify_on_low
    )
    
    db.add(new_setting)
    db.commit()
    db.refresh(new_setting)
    
    return new_setting


@router.put("/{setting_id}", response_model=EmailNotificationSettingResponse)
def update_email_setting(
    setting_id: str,
    setting: EmailNotificationSettingCreate,
    db: Session = Depends(get_db)
):
    """Update email notification setting."""
    db_setting = db.query(EmailNotificationSetting).filter(
        EmailNotificationSetting.id == setting_id
    ).first()
    
    if not db_setting:
        raise HTTPException(status_code=404, detail="Email setting not found")
    
    db_setting.email_address = setting.email_address
    db_setting.enabled = setting.enabled
    db_setting.notify_on_critical = setting.notify_on_critical
    db_setting.notify_on_high = setting.notify_on_high
    db_setting.notify_on_medium = setting.notify_on_medium
    db_setting.notify_on_low = setting.notify_on_low
    
    db.commit()
    db.refresh(db_setting)
    
    return db_setting


@router.delete("/{setting_id}")
def delete_email_setting(setting_id: str, db: Session = Depends(get_db)):
    """Delete email notification setting."""
    db_setting = db.query(EmailNotificationSetting).filter(
        EmailNotificationSetting.id == setting_id
    ).first()
    
    if not db_setting:
        raise HTTPException(status_code=404, detail="Email setting not found")
    
    db.delete(db_setting)
    db.commit()
    
    return {"message": "Email notification setting deleted"}


@router.patch("/{setting_id}/toggle")
def toggle_email_setting(setting_id: str, db: Session = Depends(get_db)):
    """Toggle email notification setting on/off."""
    db_setting = db.query(EmailNotificationSetting).filter(
        EmailNotificationSetting.id == setting_id
    ).first()
    
    if not db_setting:
        raise HTTPException(status_code=404, detail="Email setting not found")
    
    db_setting.enabled = not db_setting.enabled
    db.commit()
    db.refresh(db_setting)
    
    return db_setting


@router.post("/{agent_id}/test")
def send_test_email(
    agent_id: str,
    request: TestEmailRequest,
    db: Session = Depends(get_db)
):
    """Send a test email notification."""
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    success = email_notifier.send_anomaly_alert(
        to_email=request.email_address,
        agent_name=agent.name,
        agent_id=agent.id,
        event_name="TestEvent",
        service="test-service",
        resource_arn="arn:aws:test:::test-resource",
        anomaly_reason="This is a test email notification from AgentTrace. If you received this, your email notifications are configured correctly!",
        risk_level="HIGH",
        event_time=datetime.datetime.utcnow()
    )
    
    if not success:
        raise HTTPException(
            status_code=500, 
            detail="Failed to send test email. Please check your SMTP configuration."
        )
    
    return {"message": "Test email sent successfully", "email": request.email_address}


def send_anomaly_notification(activity_log: ActivityLog, agent: Agent, risk_level: str, db: Session):
    """
    Send email notifications for anomalous behavior.
    Called when an anomaly is detected.
    """
    # Get all email settings for this agent
    settings = db.query(EmailNotificationSetting).filter(
        EmailNotificationSetting.agent_id == agent.id,
        EmailNotificationSetting.enabled == True
    ).all()
    
    if not settings:
        return
    
    # Determine which settings should receive notification based on risk level
    risk_level_upper = risk_level.upper()
    
    for setting in settings:
        should_notify = False
        
        if risk_level_upper == "CRITICAL" and setting.notify_on_critical:
            should_notify = True
        elif risk_level_upper == "HIGH" and setting.notify_on_high:
            should_notify = True
        elif risk_level_upper == "MEDIUM" and setting.notify_on_medium:
            should_notify = True
        elif risk_level_upper == "LOW" and setting.notify_on_low:
            should_notify = True
        
        if should_notify:
            success = email_notifier.send_anomaly_alert(
                to_email=setting.email_address,
                agent_name=agent.name,
                agent_id=agent.id,
                event_name=activity_log.event_name,
                service=activity_log.service,
                resource_arn=activity_log.resource_arn or "N/A",
                anomaly_reason=activity_log.anomaly_reason or "Anomalous behavior detected",
                risk_level=risk_level_upper,
                event_time=activity_log.event_time
            )
            
            if success:
                # Update notification statistics
                setting.last_notification_sent = datetime.datetime.utcnow()
                setting.notification_count += 1
                db.commit()
