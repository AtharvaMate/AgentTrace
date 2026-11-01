"""
CloudTrail S3 Log Poller Service
Polls Floci S3 bucket for new CloudTrail logs, parses them, and ingests into ActivityLog table.
"""
import os
import gzip
import json
import boto3
from datetime import datetime
from typing import List, Dict
import time
import threading
from sqlalchemy.orm import Session
from models import ActivityLog, Agent
from database import SessionLocal


class CloudTrailPoller:
    """Background service that polls CloudTrail logs from S3."""
    
    def __init__(self, bucket_name: str, poll_interval: int = 60):
        self.bucket_name = bucket_name
        self.poll_interval = poll_interval
        self.s3_client = None
        self.processed_keys = set()
        self.running = False
        self.thread = None
        
    def initialize_s3_client(self):
        """Initialize boto3 S3 client with Floci endpoint."""
        endpoint_url = os.getenv('AWS_ENDPOINT_URL', 'http://floci:4566')
        self.s3_client = boto3.client(
            's3',
            endpoint_url=endpoint_url,
            aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID', 'test'),
            aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY', 'test'),
            region_name=os.getenv('AWS_DEFAULT_REGION', 'us-east-1')
        )
        
    def parse_cloudtrail_record(self, record: Dict) -> Dict:
        """Extract relevant fields from CloudTrail record."""
        try:
            return {
                'event_time': datetime.strptime(record['eventTime'], '%Y-%m-%dT%H:%M:%SZ'),
                'event_name': record['eventName'],
                'service': record['eventSource'].split('.')[0],  # e.g., s3.amazonaws.com -> s3
                'resource_arn': record.get('resources', [{}])[0].get('ARN', ''),
                'resource_name': record.get('resources', [{}])[0].get('accountId', '') or 
                                 record.get('requestParameters', {}).get('bucketName', '') or
                                 record.get('requestParameters', {}).get('tableName', ''),
                'region': record.get('awsRegion', 'us-east-1'),
                'source_ip': record.get('sourceIPAddress', ''),
                'request_params': record.get('requestParameters', {}),
                'user_identity': record.get('userIdentity', {}),
                'error_code': record.get('errorCode'),
                'error_message': record.get('errorMessage')
            }
        except Exception as e:
            print(f"Error parsing CloudTrail record: {e}")
            return None
    
    def match_agent_by_role(self, user_identity: Dict, db: Session) -> str:
        """Match CloudTrail event to agent by IAM role ARN."""
        try:
            # Extract role name from ARN like arn:aws:iam::123456789:role/sales-report-agent
            if user_identity.get('type') == 'AssumedRole':
                role_arn = user_identity.get('sessionContext', {}).get('sessionIssuer', {}).get('arn', '')
                role_name = role_arn.split('/')[-1] if '/' in role_arn else ''
                
                # Find agent with matching IAM role
                agent = db.query(Agent).filter(Agent.iam_role.contains(role_name)).first()
                if agent:
                    return agent.id
        except Exception as e:
            print(f"Error matching agent: {e}")
        
        return None
    
    def is_anomalous_event(self, parsed: Dict, agent: Agent) -> tuple[bool, str]:
        """Determine if event is anomalous based on agent's expected behavior."""
        if not agent:
            return False, None
        
        reasons = []
        
        # Check service
        if parsed['service'] not in (agent.expected_services or []):
            reasons.append(f"Unexpected service: {parsed['service']}")
        
        # Check action
        if parsed['event_name'] not in (agent.expected_actions or []):
            reasons.append(f"Unexpected action: {parsed['event_name']}")
        
        # Check for errors (denied actions)
        if parsed.get('error_code'):
            reasons.append(f"Access denied: {parsed['error_code']} - {parsed.get('error_message', '')}")
        
        is_anomalous = len(reasons) > 0
        anomaly_reason = '; '.join(reasons) if reasons else None
        
        return is_anomalous, anomaly_reason
    
    def ingest_cloudtrail_file(self, key: str, db: Session) -> int:
        """Download, parse, and ingest a single CloudTrail log file."""
        try:
            # Download and decompress
            response = self.s3_client.get_object(Bucket=self.bucket_name, Key=key)
            content = gzip.decompress(response['Body'].read())
            data = json.loads(content)
            
            ingested_count = 0
            
            for record in data.get('Records', []):
                parsed = self.parse_cloudtrail_record(record)
                if not parsed:
                    continue
                
                # Match to agent
                agent_id = self.match_agent_by_role(parsed['user_identity'], db)
                if not agent_id:
                    continue  # Skip events not from our agents
                
                agent = db.query(Agent).filter(Agent.id == agent_id).first()
                
                # Check if already exists (deduplication)
                existing = db.query(ActivityLog).filter(
                    ActivityLog.agent_id == agent_id,
                    ActivityLog.event_time == parsed['event_time'],
                    ActivityLog.event_name == parsed['event_name']
                ).first()
                
                if existing:
                    continue
                
                # Determine anomaly
                is_anomalous, anomaly_reason = self.is_anomalous_event(parsed, agent)
                
                # Create ActivityLog entry
                log = ActivityLog(
                    agent_id=agent_id,
                    event_time=parsed['event_time'],
                    event_name=parsed['event_name'],
                    service=parsed['service'],
                    resource_arn=parsed['resource_arn'],
                    resource_name=parsed['resource_name'],
                    region=parsed['region'],
                    source_ip=parsed['source_ip'],
                    is_anomalous=is_anomalous,
                    anomaly_reason=anomaly_reason,
                    request_params=parsed['request_params']
                )
                db.add(log)
                ingested_count += 1
            
            db.commit()
            return ingested_count
            
        except Exception as e:
            print(f"Error ingesting CloudTrail file {key}: {e}")
            db.rollback()
            return 0
    
    def poll_once(self):
        """Poll S3 once for new CloudTrail logs."""
        if not self.s3_client:
            self.initialize_s3_client()
        
        db = SessionLocal()
        try:
            # List objects in CloudTrail bucket
            response = self.s3_client.list_objects_v2(Bucket=self.bucket_name)
            
            if 'Contents' not in response:
                return
            
            # Process new .json.gz files
            for obj in response['Contents']:
                key = obj['Key']
                
                # Only process CloudTrail log files
                if not key.endswith('.json.gz'):
                    continue
                
                # Skip if already processed
                if key in self.processed_keys:
                    continue
                
                print(f"Processing CloudTrail log: {key}")
                count = self.ingest_cloudtrail_file(key, db)
                print(f"Ingested {count} events from {key}")
                
                self.processed_keys.add(key)
        
        except Exception as e:
            print(f"Error polling CloudTrail: {e}")
        finally:
            db.close()
    
    def poll_loop(self):
        """Background polling loop."""
        print(f"CloudTrail poller started. Polling every {self.poll_interval}s")
        while self.running:
            try:
                self.poll_once()
            except Exception as e:
                print(f"Error in poll loop: {e}")
            
            time.sleep(self.poll_interval)
    
    def start(self):
        """Start the background polling thread."""
        if self.running:
            return
        
        self.running = True
        self.thread = threading.Thread(target=self.poll_loop, daemon=True)
        self.thread.start()
    
    def stop(self):
        """Stop the polling thread."""
        self.running = False
        if self.thread:
            self.thread.join(timeout=5)


# Global instance
poller_instance = None


def get_cloudtrail_poller() -> CloudTrailPoller:
    """Get or create the global CloudTrail poller instance."""
    global poller_instance
    if poller_instance is None:
        bucket_name = os.getenv('CLOUDTRAIL_BUCKET', 'agenttrace-cloudtrail-logs')
        poll_interval = int(os.getenv('CLOUDTRAIL_POLL_INTERVAL', '60'))
        poller_instance = CloudTrailPoller(bucket_name, poll_interval)
    return poller_instance
