import os
import datetime
import random
from database import SessionLocal, engine, Base
from models import Agent, ActivityLog, RiskEvent, BehavioralFingerprint

# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
# Demo Agent Definitions
# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

DEMO_AGENTS = [
    {
        "id": "agent-001",
        "name": "Sales Report Agent",
        "purpose": "Automatically reads sales data from S3 and DynamoDB, then invokes a Lambda function to generate weekly sales reports and email them to stakeholders.",
        "iam_role": "arn:aws:iam::123456789:role/SalesReportAgentRole",
        "expected_services": ["s3", "dynamodb", "lambda"],
        "expected_actions": ["GetObject", "ListBucket", "GetItem", "Query", "InvokeFunction"],
        "iam_permissions": ["s3:GetObject", "s3:ListBucket", "dynamodb:GetItem", "dynamodb:Query",
                            "lambda:InvokeFunction", "secretsmanager:GetSecretValue", "s3:DeleteBucket",
                            "iam:GetRole"],
        "owner": "analytics-team",
        "environment": "production",
        "status": "active",
    },
    {
        "id": "agent-002",
        "name": "Data Pipeline Agent",
        "purpose": "Orchestrates ETL pipelines by reading raw data from S3, processing it through AWS Glue jobs, and writing transformed results to RDS PostgreSQL database.",
        "iam_role": "arn:aws:iam::123456789:role/DataPipelineAgentRole",
        "expected_services": ["s3", "glue", "rds"],
        "expected_actions": ["GetObject", "PutObject", "StartJobRun", "GetJobRun", "ExecuteStatement"],
        "iam_permissions": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject", "glue:StartJobRun",
                            "glue:GetJobRun", "rds-data:ExecuteStatement", "s3:DeleteBucket",
                            "secretsmanager:GetSecretValue"],
        "owner": "data-engineering",
        "environment": "production",
        "status": "active",
    },
    {
        "id": "agent-003",
        "name": "Customer Support Bot",
        "purpose": "Handles customer support queries by retrieving customer information from DynamoDB, using Bedrock LLMs to generate responses, and logging tickets to SQS.",
        "iam_role": "arn:aws:iam::123456789:role/CustomerSupportBotRole",
        "expected_services": ["dynamodb", "bedrock", "sqs"],
        "expected_actions": ["GetItem", "Query", "InvokeModel", "SendMessage"],
        "iam_permissions": ["dynamodb:GetItem", "dynamodb:Query", "dynamodb:PutItem",
                            "bedrock:InvokeModel", "sqs:SendMessage", "sqs:ReceiveMessage",
                            "iam:CreateRole", "iam:AttachRolePolicy"],
        "owner": "customer-success",
        "environment": "production",
        "status": "active",
    },
    {
        "id": "agent-004",
        "name": "DevOps Automation Agent",
        "purpose": "Automates CI/CD pipelines by managing Lambda deployments, updating CloudFormation stacks, and monitoring EC2 instance health.",
        "iam_role": "arn:aws:iam::123456789:role/DevOpsAutomationAgentRole",
        "expected_services": ["lambda", "cloudformation", "ec2"],
        "expected_actions": ["UpdateFunctionCode", "CreateStack", "UpdateStack", "DescribeInstances"],
        "iam_permissions": ["lambda:UpdateFunctionCode", "lambda:CreateFunction", "cloudformation:CreateStack",
                            "cloudformation:UpdateStack", "ec2:DescribeInstances", "ec2:StartInstances",
                            "s3:GetObject", "s3:PutObject", "secretsmanager:GetSecretValue"],
        "owner": "devops-team",
        "environment": "staging",
        "status": "active",
    },
    {
        "id": "agent-005",
        "name": "Backup Automation Agent",
        "purpose": "Performs automated backups by creating EBS snapshots, copying RDS snapshots to S3, and archiving logs to Glacier storage.",
        "iam_role": "arn:aws:iam::123456789:role/BackupAutomationAgentRole",
        "expected_services": ["ec2", "rds", "s3", "glacier"],
        "expected_actions": ["CreateSnapshot", "DescribeSnapshots", "CopyDBSnapshot", "PutObject", "UploadArchive"],
        "iam_permissions": ["ec2:CreateSnapshot", "ec2:DescribeSnapshots", "ec2:DeleteSnapshot",
                            "rds:CopyDBSnapshot", "rds:DescribeDBSnapshots", "s3:PutObject",
                            "glacier:UploadArchive", "glacier:InitiateJob"],
        "owner": "infrastructure-team",
        "environment": "production",
        "status": "active",
    },
    {
        "id": "agent-006",
        "name": "Security Audit Agent",
        "purpose": "Monitors security compliance by scanning CloudTrail logs, checking IAM policies, and analyzing VPC flow logs for suspicious activity.",
        "iam_role": "arn:aws:iam::123456789:role/SecurityAuditAgentRole",
        "expected_services": ["cloudtrail", "iam", "ec2", "guardduty"],
        "expected_actions": ["LookupEvents", "GetPolicy", "DescribeFlowLogs", "ListFindings"],
        "iam_permissions": ["cloudtrail:LookupEvents", "cloudtrail:GetTrail", "iam:GetPolicy",
                            "iam:GetPolicyVersion", "iam:ListPolicies", "ec2:DescribeFlowLogs",
                            "guardduty:ListFindings", "guardduty:GetFindings", "sns:Publish"],
        "owner": "security-team",
        "environment": "production",
        "status": "active",
    },
]

# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
# Mock CloudTrail Event Templates
# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

NORMAL_EVENTS = {
    "agent-001": [
        ("GetObject", "s3", "arn:aws:s3:::sales-data-bucket/2024/Q3/report.csv", "sales-data-bucket/2024/Q3/report.csv"),
        ("ListBucket", "s3", "arn:aws:s3:::sales-data-bucket", "sales-data-bucket"),
        ("GetItem", "dynamodb", "arn:aws:dynamodb:us-east-1:123456789:table/SalesTable", "SalesTable"),
        ("Query", "dynamodb", "arn:aws:dynamodb:us-east-1:123456789:table/SalesTable", "SalesTable"),
        ("InvokeFunction", "lambda", "arn:aws:lambda:us-east-1:123456789:function:GenerateReport", "GenerateReport"),
        ("GetObject", "s3", "arn:aws:s3:::sales-data-bucket/2024/Q3/monthly.csv", "sales-data-bucket/monthly.csv"),
    ],
    "agent-002": [
        ("GetObject", "s3", "arn:aws:s3:::raw-data-lake/ingestion/batch-001.parquet", "raw-data-lake"),
        ("PutObject", "s3", "arn:aws:s3:::processed-data/output/result.parquet", "processed-data"),
        ("StartJobRun", "glue", "arn:aws:glue:us-east-1:123456789:job/ETLPipeline", "ETLPipeline"),
        ("GetJobRun", "glue", "arn:aws:glue:us-east-1:123456789:job/ETLPipeline", "ETLPipeline"),
        ("ExecuteStatement", "rds", "arn:aws:rds:us-east-1:123456789:db/analytics-db", "analytics-db"),
    ],
    "agent-003": [
        ("GetItem", "dynamodb", "arn:aws:dynamodb:us-east-1:123456789:table/CustomerTable", "CustomerTable"),
        ("Query", "dynamodb", "arn:aws:dynamodb:us-east-1:123456789:table/TicketsTable", "TicketsTable"),
        ("InvokeModel", "bedrock", "arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-3", "claude-3"),
        ("SendMessage", "sqs", "arn:aws:sqs:us-east-1:123456789:support-queue", "support-queue"),
        ("PutItem", "dynamodb", "arn:aws:dynamodb:us-east-1:123456789:table/TicketsTable", "TicketsTable"),
    ],
    "agent-004": [
        ("UpdateFunctionCode", "lambda", "arn:aws:lambda:us-east-1:123456789:function:ApiHandler", "ApiHandler"),
        ("CreateStack", "cloudformation", "arn:aws:cloudformation:us-east-1:123456789:stack/AppStack", "AppStack"),
        ("UpdateStack", "cloudformation", "arn:aws:cloudformation:us-east-1:123456789:stack/AppStack", "AppStack"),
        ("DescribeInstances", "ec2", "arn:aws:ec2:us-east-1:123456789:instance/i-0abc1234", "i-0abc1234"),
        ("GetObject", "s3", "arn:aws:s3:::deployment-artifacts/latest.zip", "deployment-artifacts"),
    ],
    "agent-005": [
        ("CreateSnapshot", "ec2", "arn:aws:ec2:us-east-1:123456789:volume/vol-0abc1234", "vol-0abc1234"),
        ("DescribeSnapshots", "ec2", "arn:aws:ec2:us-east-1:123456789:snapshot/snap-0xyz5678", "snap-0xyz5678"),
        ("CopyDBSnapshot", "rds", "arn:aws:rds:us-east-1:123456789:snapshot:db-backup-001", "db-backup-001"),
        ("PutObject", "s3", "arn:aws:s3:::backup-storage/rds-snapshots/backup.tar.gz", "backup-storage"),
        ("UploadArchive", "glacier", "arn:aws:glacier:us-east-1:123456789:vaults/archive-vault", "archive-vault"),
    ],
    "agent-006": [
        ("LookupEvents", "cloudtrail", "arn:aws:cloudtrail:us-east-1:123456789:trail/security-trail", "security-trail"),
        ("GetPolicy", "iam", "arn:aws:iam::123456789:policy/CompliancePolicy", "CompliancePolicy"),
        ("DescribeFlowLogs", "ec2", "arn:aws:ec2:us-east-1:123456789:vpc-flow-log/fl-0abc1234", "fl-0abc1234"),
        ("ListFindings", "guardduty", "arn:aws:guardduty:us-east-1:123456789:detector/abc123", "abc123"),
        ("GetFindings", "guardduty", "arn:aws:guardduty:us-east-1:123456789:detector/abc123", "abc123"),
    ],
}

ANOMALOUS_EVENTS = {
    "agent-001": [
        ("GetSecretValue", "secretsmanager", "arn:aws:secretsmanager:us-east-1:123456789:secret:prod/db-password", "prod/db-password", "Accessed production DB credentials — outside intended purpose"),
        ("DeleteBucket", "s3", "arn:aws:s3:::customer-data-backup", "customer-data-backup", "Deleted S3 bucket outside expected scope"),
        ("GetItem", "dynamodb", "arn:aws:dynamodb:us-east-1:123456789:table/ProductionCustomerData", "ProductionCustomerData", "Accessed production customer database"),
    ],
    "agent-002": [
        ("DeleteBucket", "s3", "arn:aws:s3:::raw-data-lake", "raw-data-lake", "Attempted to delete primary data lake bucket"),
        ("GetSecretValue", "secretsmanager", "arn:aws:secretsmanager:us-east-1:123456789:secret:rds-master-password", "rds-master-password", "Accessed master DB credentials unexpectedly"),
        ("DeleteObject", "s3", "arn:aws:s3:::raw-data-lake/ingestion/", "raw-data-lake/ingestion/", "Bulk deletion of data lake objects detected"),
    ],
    "agent-003": [
        ("CreateRole", "iam", "arn:aws:iam::123456789:role/NewAdminRole", "NewAdminRole", "IAM role creation — privilege escalation attempt"),
        ("AttachRolePolicy", "iam", "arn:aws:iam::123456789:policy/AdministratorAccess", "AdministratorAccess", "Attached Administrator policy to new role"),
        ("GetSecretValue", "secretsmanager", "arn:aws:secretsmanager:us-east-1:123456789:secret:payment-gateway-key", "payment-gateway-key", "Accessed payment gateway API keys"),
    ],
    "agent-004": [
        ("GetObject", "s3", "arn:aws:s3:::customer-pii-data/export.csv", "customer-pii-data/export.csv", "Accessed PII customer data outside intended scope"),
        ("GetSecretValue", "secretsmanager", "arn:aws:secretsmanager:us-east-1:123456789:secret:prod/api-keys", "prod/api-keys", "Accessed production API keys from staging agent"),
        ("DescribeInstances", "ec2", "arn:aws:ec2:us-east-1:123456789:instance/i-prod-database", "i-prod-database", "Accessed production database EC2 instance"),
    ],
    "agent-005": [
        ("DeleteSnapshot", "ec2", "arn:aws:ec2:us-east-1:123456789:snapshot/snap-prod-critical", "snap-prod-critical", "Deleted critical production snapshot"),
        ("GetObject", "s3", "arn:aws:s3:::compliance-audit-logs/sensitive.log", "compliance-audit-logs", "Accessed compliance audit logs outside scope"),
        ("InitiateJob", "glacier", "arn:aws:glacier:us-east-1:123456789:vaults/prod-archive", "prod-archive", "Initiated retrieval of production archives"),
    ],
    "agent-006": [
        ("DeleteTrail", "cloudtrail", "arn:aws:cloudtrail:us-east-1:123456789:trail/security-trail", "security-trail", "Attempted to delete CloudTrail audit trail"),
        ("PutUserPolicy", "iam", "arn:aws:iam::123456789:user/admin", "admin", "Modified IAM user policy outside intended scope"),
        ("Publish", "sns", "arn:aws:sns:us-east-1:123456789:alert-topic", "alert-topic", "Published to SNS topic outside normal pattern"),
    ],
}


def generate_mock_logs(agent_id: str, db) -> None:
    """Generate 40 normal + 3 anomalous events per agent over the last 30 days."""
    now = datetime.datetime.utcnow()
    ips = ["10.0.1.15", "10.0.1.42", "172.16.0.8", "10.0.2.100"]

    normal_events = NORMAL_EVENTS.get(agent_id, [])
    anomalous_events = ANOMALOUS_EVENTS.get(agent_id, [])

    # Generate 40 normal events spread over 30 days
    for i in range(40):
        event = random.choice(normal_events)
        days_ago = random.randint(0, 29)
        hours_ago = random.randint(8, 18)  # business hours
        event_time = now - datetime.timedelta(days=days_ago, hours=hours_ago, minutes=random.randint(0, 59))

        log = ActivityLog(
            agent_id=agent_id,
            event_time=event_time,
            event_name=event[0],
            service=event[1],
            resource_arn=event[2],
            resource_name=event[3],
            region="us-east-1",
            source_ip=random.choice(ips),
            is_anomalous=False,
            request_params={"userAgent": "aws-sdk-python/1.34.0"},
        )
        db.add(log)

    # Generate 3 anomalous events in last 14 days (spread them out)
    anomaly_days_ago = [1, 5, 10]  # Days 1, 5, and 10 days ago
    for i, (event, days_ago) in enumerate(zip(anomalous_events, anomaly_days_ago)):
        hours_ago = random.randint(8, 18)  # business hours
        event_time = now - datetime.timedelta(days=days_ago, hours=hours_ago, minutes=random.randint(0, 59))
        log = ActivityLog(
            agent_id=agent_id,
            event_time=event_time,
            event_name=event[0],
            service=event[1],
            resource_arn=event[2],
            resource_name=event[3],
            region="us-east-1",
            source_ip=random.choice(ips),
            is_anomalous=True,
            anomaly_reason=event[4],
            request_params={"userAgent": "aws-sdk-python/1.34.0"},
        )
        db.add(log)

    db.commit()


def build_fingerprint(agent_id: str, agent_data: dict, db) -> None:
    """Build behavioral fingerprint from the agent's expected behavior."""
    fp = BehavioralFingerprint(
        agent_id=agent_id,
        normal_services=agent_data["expected_services"],
        normal_actions=agent_data["expected_actions"],
        action_frequency={a: random.randint(5, 20) for a in agent_data["expected_actions"]},
        service_frequency={s: random.randint(10, 40) for s in agent_data["expected_services"]},
        typical_hours=list(range(8, 19)),
        avg_daily_events=float(random.randint(12, 25)),
        last_updated=datetime.datetime.utcnow(),
    )
    db.add(fp)
    db.commit()


def generate_risk_events(agent_id: str, db) -> None:
    """Generate pre-existing risk events for demo agents."""
    anomalous_events = ANOMALOUS_EVENTS.get(agent_id, [])
    risk_levels = {
        "agent-001": [("HIGH", 72.0), ("CRITICAL", 91.0), ("HIGH", 68.0)],
        "agent-002": [("CRITICAL", 88.0), ("HIGH", 75.0), ("MEDIUM", 45.0)],
        "agent-003": [("CRITICAL", 95.0), ("CRITICAL", 93.0), ("HIGH", 78.0)],
        "agent-004": [("HIGH", 65.0), ("HIGH", 71.0), ("MEDIUM", 52.0)],
    }
    levels = risk_levels.get(agent_id, [])
    now = datetime.datetime.utcnow()

    recommendation_map = {
        "secretsmanager": [
            "Revoke secretsmanager:GetSecretValue permission from this agent immediately",
            "Review all secrets accessed and rotate compromised credentials",
            "Require human approval for any secrets access by AI agents",
        ],
        "iam": [
            "Block all IAM write permissions for this agent â€” likely privilege escalation attempt",
            "Review all IAM roles created or modified in the last 24 hours",
            "Enable AWS Organizations SCPs to prevent IAM changes by agents",
        ],
        "s3": [
            "Enable S3 bucket versioning and MFA delete on critical buckets",
            "Add deny policy for s3:DeleteBucket on production buckets",
            "Review and restore any deleted objects immediately",
        ],
        "default": [
            "Immediately suspend this agent and conduct a security review",
            "Enable CloudTrail alerts for this agent's IAM role",
            "Apply least-privilege IAM policies â€” remove unused permissions",
        ],
    }

    for i, (event, (level, score)) in enumerate(zip(anomalous_events, levels)):
        service = event[1]
        recs = recommendation_map.get(service, recommendation_map["default"])
        risk_event = RiskEvent(
            agent_id=agent_id,
            timestamp=now - datetime.timedelta(hours=random.randint(1, 36)),
            risk_score=score,
            risk_level=level,
            risk_factors=[
                f"New service accessed: {service}" if service not in NORMAL_EVENTS.get(agent_id, []) else f"Sensitive action: {event[0]}",
                "Sensitive resource accessed" if service in ["secretsmanager", "iam"] else "Production resource accessed",
                "Action outside intended purpose",
            ],
            explanation=f"The agent performed '{event[0]}' on '{event[3]}' which is outside its defined purpose. "
                        f"This agent is designed for {DEMO_AGENTS[int(agent_id[-1])-1]['purpose'][:80]}... "
                        f"Accessing {service} resources indicates potential compromise or prompt injection.",
            recommendations=recs,
            triggering_action=event[0],
            triggering_resource=event[3],
            is_resolved=False,
        )
        db.add(risk_event)

    db.commit()


def auto_build_fingerprints_and_guardrails(db):
    """Auto-build fingerprints and guardrails for all agents on startup."""
    from models import BehavioralFingerprint, Guardrail
    import datetime
    from collections import Counter
    
    agents = db.query(Agent).all()
    for agent in agents:
        try:
            fp = db.query(BehavioralFingerprint).filter(BehavioralFingerprint.agent_id == agent.id).first()
            if not fp:
                print(f"  🔧 Auto-building fingerprint for {agent.name}...")
                since = datetime.datetime.utcnow() - datetime.timedelta(days=30)
                logs = db.query(ActivityLog).filter(
                    ActivityLog.agent_id == agent.id,
                    ActivityLog.event_time >= since,
                    ActivityLog.is_anomalous == False
                ).order_by(ActivityLog.event_time.asc()).all()
                
                if logs:
                    services = [log.service for log in logs]
                    actions = [log.event_name for log in logs]
                    hours = [log.event_time.hour for log in logs]
                    
                    service_freq = dict(Counter(services))
                    action_freq = dict(Counter(actions))
                    
                    hour_counter = Counter(hours)
                    total = len(hours)
                    typical_hours = [h for h, c in hour_counter.items() if c / total > 0.03]
                    
                    days_with_activity = len(set(log.event_time.date() for log in logs)) or 1
                    avg_daily = len(logs) / days_with_activity
                    
                    fp = BehavioralFingerprint(
                        agent_id=agent.id,
                        normal_services=list(set(services)),
                        normal_actions=list(set(actions)),
                        service_frequency=service_freq,
                        action_frequency=action_freq,
                        typical_hours=sorted(typical_hours),
                        avg_daily_events=avg_daily,
                        last_updated=datetime.datetime.utcnow(),
                    )
                    db.add(fp)
                    db.commit()
                    print(f"    ✓ Built fingerprint: {len(set(services))} services, {len(set(actions))} actions")
            
            guardrails = db.query(Guardrail).filter(Guardrail.agent_id == agent.id).all()
            if not guardrails and fp:
                print(f"  🛡️ Auto-generating guardrails for {agent.name}...")
                
                SENSITIVE_SERVICES = {"iam", "secretsmanager", "kms", "sts"}
                HIGH_IMPACT_ACTIONS = {
                    "DeleteBucket", "DeleteObject", "DeleteTable", "DeleteRole", 
                    "PutRolePolicy", "AttachRolePolicy", "CreateRole", "CreateUser",
                    "DeleteUser", "PutUserPolicy", "AttachUserPolicy"
                }
                
                if fp.normal_services:
                    guardrail = Guardrail(
                        agent_id=agent.id,
                        rule_type="allowed_services",
                        rule_config={"services": fp.normal_services},
                        is_active=True,
                        auto_generated=True,
                        description=f"Only allow access to services seen during normal operation"
                    )
                    db.add(guardrail)
                
                sensitive_in_normal = [s for s in fp.normal_services if s in SENSITIVE_SERVICES]
                if not sensitive_in_normal:
                    guardrail = Guardrail(
                        agent_id=agent.id,
                        rule_type="block_sensitive_services",
                        rule_config={"services": list(SENSITIVE_SERVICES)},
                        is_active=True,
                        auto_generated=True,
                        description=f"Block access to sensitive services never used in normal operation"
                    )
                    db.add(guardrail)
                
                db.commit()
                count = db.query(Guardrail).filter(Guardrail.agent_id == agent.id).count()
                print(f"    ✓ Generated {count} guardrails")
                
        except Exception as e:
            print(f"  ⚠️ Failed to auto-build for {agent.name}: {e}")


def seed_database() -> None:
    """Main seeding function – runs on startup if DB is empty."""
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        # Check if already seeded
        existing = db.query(Agent).first()
        if existing:
            print("✅ Database already seeded, skipping...")
            auto_build_fingerprints_and_guardrails(db)
            return

        print("🌱 Seeding database with demo data...")

        for agent_data in DEMO_AGENTS:
            agent = Agent(
                id=agent_data["id"],
                name=agent_data["name"],
                purpose=agent_data["purpose"],
                iam_role=agent_data["iam_role"],
                expected_services=agent_data["expected_services"],
                expected_actions=agent_data["expected_actions"],
                iam_permissions=agent_data["iam_permissions"],
                owner=agent_data["owner"],
                environment=agent_data["environment"],
                status=agent_data["status"],
                created_at=datetime.datetime.utcnow() - datetime.timedelta(days=30),
            )
            db.add(agent)
            db.commit()

            generate_mock_logs(agent_data["id"], db)
            build_fingerprint(agent_data["id"], agent_data, db)
            generate_risk_events(agent_data["id"], db)
            print(f"  ✅ Seeded agent: {agent_data['name']}")

        auto_build_fingerprints_and_guardrails(db)
        print("✅ Database seeding complete!")
    except Exception as e:
        print(f"❌ Seeding failed: {e}")
        db.rollback()
    finally:
        db.close()


def setup_floci_resources():
    """Setup mock AWS resources in LocalStack/Floci for testing."""
    try:
        print("Setting up Floci/LocalStack resources...")
        # Placeholder - would create S3 buckets, DynamoDB tables, etc.
        print("Floci resources ready")
    except Exception as e:
        print(f"Floci setup warning: {e}")
        pass
