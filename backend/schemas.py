from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime


class AgentCreate(BaseModel):
    name: str
    purpose: str
    iam_role: str
    expected_services: List[str] = []
    expected_actions: List[str] = []
    iam_permissions: List[str] = []
    owner: str
    environment: str = "development"


class AgentResponse(BaseModel):
    id: str
    name: str
    purpose: str
    iam_role: str
    expected_services: List[str]
    expected_actions: List[str]
    iam_permissions: List[str]
    owner: str
    environment: str
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class ActivityLogResponse(BaseModel):
    id: str
    agent_id: str
    event_time: datetime
    event_name: str
    service: str
    resource_arn: Optional[str]
    resource_name: Optional[str]
    region: str
    source_ip: Optional[str]
    is_anomalous: bool
    anomaly_reason: Optional[str]
    request_params: Optional[Dict[str, Any]]

    class Config:
        from_attributes = True


class SimulateEventRequest(BaseModel):
    agent_id: str
    event_name: str
    service: str
    resource_name: str
    is_anomalous: bool = True


class RiskEventResponse(BaseModel):
    id: str
    agent_id: str
    timestamp: datetime
    risk_score: float
    risk_level: str
    risk_factors: List[str]
    explanation: Optional[str]
    recommendations: List[str]
    triggering_action: Optional[str]
    triggering_resource: Optional[str]
    is_resolved: bool

    class Config:
        from_attributes = True


class FingerprintResponse(BaseModel):
    id: str
    agent_id: str
    normal_services: List[str]
    normal_actions: List[str]
    action_frequency: Dict[str, Any]
    service_frequency: Dict[str, Any]
    typical_hours: List[int]
    avg_daily_events: float
    avg_events_per_hour: Optional[float] = 0.0
    max_events_per_hour: Optional[float] = 0.0
    model_path: Optional[str] = None
    model_version: Optional[str] = "untrained"
    anomaly_threshold: Optional[float] = 0.5
    last_updated: datetime

    class Config:
        from_attributes = True


class BlastRadiusNode(BaseModel):
    id: str
    data: Dict[str, Any]
    position: Dict[str, float]
    type: str = "default"
    style: Optional[Dict[str, Any]] = None


class BlastRadiusEdge(BaseModel):
    id: str
    source: str
    target: str
    animated: bool = False
    style: Optional[Dict[str, Any]] = None


class BlastRadiusResponse(BaseModel):
    nodes: List[BlastRadiusNode]
    edges: List[BlastRadiusEdge]
    impact_summary: Dict[str, Any]


class RiskAnalysisRequest(BaseModel):
    agent_id: str
    action: str
    service: str
    resource: str


class RiskAnalysisResponse(BaseModel):
    risk_score: float
    risk_level: str
    risk_factors: List[str]
    explanation: str
    recommendations: List[str]


class GuardrailResponse(BaseModel):
    id: str
    agent_id: str
    rule_type: str
    rule_config: Dict[str, Any]
    is_active: bool
    auto_generated: bool
    description: Optional[str]
    created_at: datetime
    last_triggered: Optional[datetime]
    trigger_count: int

    class Config:
        from_attributes = True


class GuardrailCreate(BaseModel):
    rule_type: str
    rule_config: Dict[str, Any]
    is_active: bool = True
    description: Optional[str] = None


class AgentSummary(BaseModel):
    agent: AgentResponse
    latest_risk_score: float
    latest_risk_level: str
    total_events: int
    anomalous_events: int
    unresolved_risk_events: int
    fingerprint: Optional[FingerprintResponse]


class DashboardStats(BaseModel):
    total_agents: int
    critical_agents: int
    high_risk_agents: int
    total_events_today: int
    total_anomalies: int
