import uuid
import datetime
from sqlalchemy import Column, String, Integer, Float, Boolean, DateTime, Text, JSON, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from database import Base


def gen_uuid():
    return str(uuid.uuid4())


class Agent(Base):
    __tablename__ = "agents"

    id = Column(String, primary_key=True, default=gen_uuid)
    name = Column(String, nullable=False)
    purpose = Column(Text, nullable=False)
    iam_role = Column(String, nullable=False)
    expected_services = Column(JSON, default=list)
    expected_actions = Column(JSON, default=list)
    iam_permissions = Column(JSON, default=list)
    owner = Column(String, nullable=False)
    environment = Column(String, default="development")
    status = Column(String, default="active")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    activity_logs = relationship("ActivityLog", back_populates="agent", cascade="all, delete-orphan")
    risk_events = relationship("RiskEvent", back_populates="agent", cascade="all, delete-orphan")
    fingerprint = relationship("BehavioralFingerprint", back_populates="agent", uselist=False, cascade="all, delete-orphan")
    guardrails = relationship("Guardrail", back_populates="agent", cascade="all, delete-orphan")


class ActivityLog(Base):
    __tablename__ = "activity_logs"

    id = Column(String, primary_key=True, default=gen_uuid)
    agent_id = Column(String, ForeignKey("agents.id"), nullable=False)
    event_time = Column(DateTime, default=datetime.datetime.utcnow)
    event_name = Column(String, nullable=False)
    service = Column(String, nullable=False)
    resource_arn = Column(String)
    resource_name = Column(String)
    region = Column(String, default="us-east-1")
    source_ip = Column(String)
    is_anomalous = Column(Boolean, default=False)
    anomaly_reason = Column(Text)
    request_params = Column(JSON)

    agent = relationship("Agent", back_populates="activity_logs")


class RiskEvent(Base):
    __tablename__ = "risk_events"

    id = Column(String, primary_key=True, default=gen_uuid)
    agent_id = Column(String, ForeignKey("agents.id"), nullable=False)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    risk_score = Column(Float, nullable=False)
    risk_level = Column(String, nullable=False)
    risk_factors = Column(JSON, default=list)
    explanation = Column(Text)
    recommendations = Column(JSON, default=list)
    triggering_action = Column(String)
    triggering_resource = Column(String)
    is_resolved = Column(Boolean, default=False)

    agent = relationship("Agent", back_populates="risk_events")


class BehavioralFingerprint(Base):
    __tablename__ = "behavioral_fingerprints"

    id = Column(String, primary_key=True, default=gen_uuid)
    agent_id = Column(String, ForeignKey("agents.id"), unique=True, nullable=False)
    normal_services = Column(JSON, default=list)
    normal_actions = Column(JSON, default=list)
    action_frequency = Column(JSON, default=dict)
    service_frequency = Column(JSON, default=dict)
    typical_hours = Column(JSON, default=list)
    avg_daily_events = Column(Float, default=0.0)
    avg_events_per_hour = Column(Float, default=0.0)
    max_events_per_hour = Column(Float, default=0.0)
    model_path = Column(String, nullable=True)
    model_version = Column(String, default="1.0.0")
    anomaly_threshold = Column(Float, default=0.5)
    last_updated = Column(DateTime, default=datetime.datetime.utcnow)

    agent = relationship("Agent", back_populates="fingerprint")


class Guardrail(Base):
    __tablename__ = "guardrails"

    id = Column(String, primary_key=True, default=gen_uuid)
    agent_id = Column(String, ForeignKey("agents.id"), nullable=False)
    rule_type = Column(String, nullable=False)
    rule_config = Column(JSON, default=dict)
    is_active = Column(Boolean, default=True)
    auto_generated = Column(Boolean, default=False)
    description = Column(Text)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    last_triggered = Column(DateTime, nullable=True)
    trigger_count = Column(Integer, default=0)

    agent = relationship("Agent", back_populates="guardrails")


class EmailNotificationSetting(Base):
    __tablename__ = "email_notification_settings"

    id = Column(String, primary_key=True, default=gen_uuid)
    agent_id = Column(String, ForeignKey("agents.id"), nullable=False)
    email_address = Column(String, nullable=False)
    enabled = Column(Boolean, default=True)
    notify_on_critical = Column(Boolean, default=True)
    notify_on_high = Column(Boolean, default=True)
    notify_on_medium = Column(Boolean, default=False)
    notify_on_low = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    last_notification_sent = Column(DateTime, nullable=True)
    notification_count = Column(Integer, default=0)

    __table_args__ = (UniqueConstraint('agent_id', 'email_address', name='_agent_email_uc'),)
