import os
import boto3
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import engine, Base
from seed_data import seed_database, setup_floci_resources
from routers import agents, activity, risk, fingerprint, blast_radius, scenarios, guardrails, notifications


def setup_cloudtrail_infrastructure():
    """Create CloudTrail trail and S3 bucket in Floci on startup."""
    endpoint_url = os.getenv('AWS_ENDPOINT_URL')
    if not endpoint_url:
        print("AWS_ENDPOINT_URL not set — skipping Floci CloudTrail setup")
        return

    base_kwargs = {
        'endpoint_url': endpoint_url,
        'aws_access_key_id': os.getenv('AWS_ACCESS_KEY_ID', 'test'),
        'aws_secret_access_key': os.getenv('AWS_SECRET_ACCESS_KEY', 'test'),
        'region_name': os.getenv('AWS_DEFAULT_REGION', 'us-east-1')
    }

    bucket_name = os.getenv('CLOUDTRAIL_BUCKET', 'agenttrace-cloudtrail-logs')

    try:
        s3 = boto3.client('s3', **base_kwargs)
        try:
            s3.head_bucket(Bucket=bucket_name)
        except Exception:
            s3.create_bucket(Bucket=bucket_name)
            print(f"Created CloudTrail S3 bucket: {bucket_name}")

        ct = boto3.client('cloudtrail', **base_kwargs)
        try:
            ct.get_trail(Name='agenttrace-trail')
            print("CloudTrail trail already exists")
        except Exception:
            ct.create_trail(Name='agenttrace-trail', S3BucketName=bucket_name)
            ct.start_logging(Name='agenttrace-trail')
            ct.put_event_selectors(
                TrailName='agenttrace-trail',
                EventSelectors=[{
                    'ReadWriteType': 'All',
                    'IncludeManagementEvents': True,
                    'DataResources': [
                        {'Type': 'AWS::S3::Object', 'Values': ['arn:aws:s3:::']},
                    ]
                }]
            )
            print("Created and started CloudTrail trail: agenttrace-trail")

    except Exception as e:
        print(f"CloudTrail setup warning (non-critical): {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    setup_cloudtrail_infrastructure()
    setup_floci_resources()

    if os.getenv("SEED_ON_STARTUP", "true").lower() == "true":
        seed_database()
    
    # Always auto-build fingerprints for agents that don't have them
    from database import SessionLocal
    db = SessionLocal()
    try:
        from seed_data import auto_build_fingerprints_and_guardrails
        print("🔍 Checking for agents without fingerprints...")
        auto_build_fingerprints_and_guardrails(db)
    except Exception as e:
        print(f"⚠️  Fingerprint auto-build warning: {e}")
    finally:
        db.close()

    from services.cloudtrail_poller import get_cloudtrail_poller
    poller = get_cloudtrail_poller()
    poller.start()
    print("CloudTrail poller started")

    yield

    poller.stop()


app = FastAPI(
    title="AgentTrace API",
    description="AI Agent Behavioral Monitoring and Cloud Security Platform",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(agents.router, prefix="/api/agents", tags=["Agents"])
app.include_router(activity.router, prefix="/api/activity", tags=["Activity"])
app.include_router(risk.router, prefix="/api/risk", tags=["Risk"])
app.include_router(fingerprint.router, prefix="/api/fingerprint", tags=["Fingerprint"])
app.include_router(blast_radius.router, prefix="/api/blast-radius", tags=["Blast Radius"])
app.include_router(scenarios.router, prefix="/api/scenarios", tags=["Scenarios"])
app.include_router(guardrails.router, prefix="/api/guardrails", tags=["Guardrails"])
app.include_router(notifications.router, prefix="/api/notifications", tags=["Notifications"])


@app.get("/")
def root():
    return {"message": "AgentTrace API v2.0", "docs": "/docs"}


@app.get("/health")
def health():
    return {"status": "healthy", "version": "2.0.0"}
