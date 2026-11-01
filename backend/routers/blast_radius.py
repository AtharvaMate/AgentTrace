from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from collections import Counter, defaultdict

from database import get_db
from models import Agent, ActivityLog
from schemas import BlastRadiusResponse, BlastRadiusNode, BlastRadiusEdge

router = APIRouter()

SERVICE_COLORS = {
    "s3": {"bg": "#1a3a5c", "border": "#3b82f6", "label": "☁️ S3"},
    "dynamodb": {"bg": "#1a3a2e", "border": "#10b981", "label": "🗄️ DynamoDB"},
    "lambda": {"bg": "#3a2a1a", "border": "#f59e0b", "label": "⚡ Lambda"},
    "secretsmanager": {"bg": "#3a1a1a", "border": "#ef4444", "label": "🔐 Secrets Manager"},
    "iam": {"bg": "#3a1a2e", "border": "#ec4899", "label": "🛡️ IAM"},
    "rds": {"bg": "#1a2a3a", "border": "#6366f1", "label": "🗃️ RDS"},
    "glue": {"bg": "#2a1a3a", "border": "#8b5cf6", "label": "🔄 Glue"},
    "ec2": {"bg": "#1a3a3a", "border": "#06b6d4", "label": "🖥️ EC2"},
    "cloudformation": {"bg": "#2a2a1a", "border": "#d97706", "label": "📦 CloudFormation"},
    "bedrock": {"bg": "#1a1a3a", "border": "#a78bfa", "label": "🤖 Bedrock"},
    "sqs": {"bg": "#1a3a1a", "border": "#34d399", "label": "📨 SQS"},
    "kms": {"bg": "#3a1a1a", "border": "#f87171", "label": "🔑 KMS"},
}

SENSITIVE_SERVICES = {"secretsmanager", "iam", "kms"}
RISK_SERVICES = {"rds", "ec2"}


def get_node_style(service: str, is_anomalous: bool, anomaly_count: int):
    colors = SERVICE_COLORS.get(service, {"bg": "#1a1a2e", "border": "#64748b", "label": f"☁️ {service.upper()}"})
    if service in SENSITIVE_SERVICES or (is_anomalous and anomaly_count > 0):
        border = "#ef4444"
        bg = "#3a1a1a"
    elif service in RISK_SERVICES or anomaly_count > 0:
        border = "#f59e0b"
        bg = "#3a2a1a"
    else:
        border = colors["border"]
        bg = colors["bg"]

    return {
        "background": bg,
        "border": f"2px solid {border}",
        "borderRadius": "8px",
        "padding": "8px 12px",
        "color": "#e2e8f0",
        "fontSize": "12px",
        "boxShadow": f"0 0 12px {border}40",
    }


@router.get("/{agent_id}", response_model=BlastRadiusResponse)
def get_blast_radius(agent_id: str, db: Session = Depends(get_db)):
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    logs = db.query(ActivityLog).filter(ActivityLog.agent_id == agent_id).all()

    service_map = defaultdict(lambda: {"resources": [], "count": 0, "anomalies": 0})
    
    for log in logs:
        service = log.service
        resource = log.resource_name or log.resource_arn or "unknown"
        service_map[service]["resources"].append(resource)
        service_map[service]["count"] += 1
        if log.is_anomalous:
            service_map[service]["anomalies"] += 1

    nodes = []
    edges = []
    import math

    nodes.append(BlastRadiusNode(
        id="agent",
        data={
            "label": agent.name,
            "type": "agent",
            "icon": "🤖"
        },
        position={"x": 500, "y": 400},
        type="input",
        style={
            "background": "linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)",
            "border": "3px solid #60a5fa",
            "borderRadius": "16px",
            "padding": "20px 24px",
            "color": "#ffffff",
            "fontSize": "16px",
            "fontWeight": "700",
            "boxShadow": "0 8px 24px rgba(59, 130, 246, 0.4)",
            "minWidth": "200px",
            "textAlign": "center"
        }
    ))

    services = list(service_map.keys())
    n = len(services)
    radius = 320
    
    total_resources = 0
    sensitive_resources = 0
    total_anomalies = 0

    for i, service in enumerate(services):
        angle = (2 * math.pi * i) / n - math.pi / 2
        sx = 500 + radius * math.cos(angle)
        sy = 400 + radius * math.sin(angle)

        svc_data = service_map[service]
        anomaly_count = svc_data["anomalies"]
        total_anomalies += anomaly_count
        is_anomalous = anomaly_count > 0
        is_sensitive = service in SENSITIVE_SERVICES
        
        svc_colors = SERVICE_COLORS.get(service, {"bg": "#1a1a2e", "border": "#64748b", "label": f"☁️ {service.upper()}"})
        
        if is_sensitive and is_anomalous:
            border_color = "#dc2626"
            bg_color = "linear-gradient(135deg, #7f1d1d 0%, #dc2626 100%)"
            glow = "0 0 20px rgba(220, 38, 38, 0.6)"
        elif is_sensitive:
            border_color = "#ef4444"
            bg_color = svc_colors["bg"]
            glow = "0 0 15px rgba(239, 68, 68, 0.4)"
        elif is_anomalous:
            border_color = "#f59e0b"
            bg_color = svc_colors["bg"]
            glow = "0 0 15px rgba(245, 158, 11, 0.4)"
        else:
            border_color = svc_colors["border"]
            bg_color = svc_colors["bg"]
            glow = f"0 0 12px {svc_colors['border']}40"

        svc_node_id = f"svc-{service}"
        nodes.append(BlastRadiusNode(
            id=svc_node_id,
            data={
                "label": svc_colors.get("label", service.upper()),
                "count": svc_data["count"],
                "anomalyCount": anomaly_count,
                "type": "service"
            },
            position={"x": sx, "y": sy},
            type="default",
            style={
                "background": bg_color,
                "border": f"3px solid {border_color}",
                "borderRadius": "12px",
                "padding": "14px 18px",
                "color": "#e2e8f0",
                "fontSize": "13px",
                "fontWeight": "600",
                "boxShadow": glow,
                "minWidth": "140px",
                "textAlign": "center"
            }
        ))

        edge_style = {
            "stroke": "#ef4444" if is_anomalous else "#3b82f6",
            "strokeWidth": 3 if is_anomalous else 2,
        }
        
        edges.append(BlastRadiusEdge(
            id=f"e-agent-{service}",
            source="agent",
            target=svc_node_id,
            animated=is_anomalous,
            type="smoothstep",
            style=edge_style,
            label=str(svc_data["count"]) if svc_data["count"] > 10 else None,
            labelStyle={"fontSize": "11px", "fill": "#94a3b8"} if svc_data["count"] > 10 else None
        ))

        unique_resources = list(set(svc_data["resources"]))[:4]
        resource_angle_offset = 0.5 if len(unique_resources) > 1 else 0
        
        for j, resource in enumerate(unique_resources):
            total_resources += 1
            if is_sensitive:
                sensitive_resources += 1

            display_name = resource.split("/")[-1] if "/" in resource else resource
            display_name = (display_name[:20] + "...") if len(display_name) > 20 else display_name

            res_angle = angle + (j - len(unique_resources)/2 + 0.5) * resource_angle_offset
            res_radius = 180
            rx = sx + res_radius * math.cos(res_angle)
            ry = sy + res_radius * math.sin(res_angle)

            res_node_id = f"res-{service}-{j}"
            res_color = "#ef4444" if is_sensitive else "#64748b"
            
            nodes.append(BlastRadiusNode(
                id=res_node_id,
                data={"label": display_name, "type": "resource"},
                position={"x": rx, "y": ry},
                type="output",
                style={
                    "background": "#17171a" if not is_sensitive else "#2a1a1a",
                    "border": f"2px solid {res_color}",
                    "borderRadius": "8px",
                    "padding": "8px 12px",
                    "color": "#94a3b8",
                    "fontSize": "11px",
                    "fontWeight": "500",
                }
            ))
            
            edges.append(BlastRadiusEdge(
                id=f"e-{svc_node_id}-res-{j}",
                source=svc_node_id,
                target=res_node_id,
                animated=False,
                type="smoothstep",
                style={"stroke": res_color, "strokeWidth": 1.5, "opacity": 0.6},
            ))

    max_anomaly_svc = max(service_map.items(), key=lambda x: x[1]["anomalies"])[0] if total_anomalies > 0 else None
    
    impact_summary = {
        "total_services": len(services),
        "total_resources": total_resources,
        "sensitive_resources": sensitive_resources,
        "anomalous_services": [s for s, data in service_map.items() if data["anomalies"] > 0],
        "highest_risk_service": max_anomaly_svc,
        "estimated_impact": "CRITICAL" if sensitive_resources > 0 and total_anomalies > 0 else ("HIGH" if total_anomalies > 5 else ("MEDIUM" if total_anomalies > 0 else "LOW")),
    }

    return BlastRadiusResponse(nodes=nodes, edges=edges, impact_summary=impact_summary)
