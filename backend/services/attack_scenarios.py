"""
Attack Scenario Engine
Executes real boto3 calls against Floci to simulate agent behavior - both normal and malicious.
"""
import os
import boto3
import json
from typing import Dict, List
from datetime import datetime


def get_aws_client(service: str, role_arn: str = None):
    """
    Get a boto3 client authenticated with an agent's IAM role.
    If role_arn is provided, assumes that role first (simulates agent acting under its role).
    """
    endpoint_url = os.getenv('AWS_ENDPOINT_URL', 'http://floci:4566')
    base_kwargs = {
        'endpoint_url': endpoint_url,
        'aws_access_key_id': os.getenv('AWS_ACCESS_KEY_ID', 'test'),
        'aws_secret_access_key': os.getenv('AWS_SECRET_ACCESS_KEY', 'test'),
        'region_name': os.getenv('AWS_DEFAULT_REGION', 'us-east-1')
    }
    
    if role_arn:
        # Assume the agent's IAM role
        sts = boto3.client('sts', **base_kwargs)
        try:
            creds = sts.assume_role(
                RoleArn=role_arn,
                RoleSessionName='agenttrace-simulation'
            )['Credentials']
            
            return boto3.client(
                service,
                endpoint_url=endpoint_url,
                aws_access_key_id=creds['AccessKeyId'],
                aws_secret_access_key=creds['SecretAccessKey'],
                aws_session_token=creds['SessionToken'],
                region_name=os.getenv('AWS_DEFAULT_REGION', 'us-east-1')
            )
        except Exception as e:
            print(f"Could not assume role {role_arn}: {e}. Falling back to default credentials.")
    
    return boto3.client(service, **base_kwargs)


def ensure_resources_exist():
    """Ensure demo AWS resources exist in Floci before running scenarios."""
    endpoint_url = os.getenv('AWS_ENDPOINT_URL', 'http://floci:4566')
    base_kwargs = {
        'endpoint_url': endpoint_url,
        'aws_access_key_id': 'test',
        'aws_secret_access_key': 'test',
        'region_name': 'us-east-1'
    }
    
    s3 = boto3.client('s3', **base_kwargs)
    dynamodb = boto3.client('dynamodb', **base_kwargs)
    secretsmanager = boto3.client('secretsmanager', **base_kwargs)
    
    # Create S3 buckets
    buckets = ['sales-data-bucket', 'customer-data-backup', 'raw-data-lake']
    for bucket in buckets:
        try:
            s3.head_bucket(Bucket=bucket)
        except:
            try:
                s3.create_bucket(Bucket=bucket)
                s3.put_object(Bucket=bucket, Key='Q3/report.csv', Body=b'sample,data\n1,2\n3,4')
            except Exception as e:
                print(f"Could not create bucket {bucket}: {e}")
    
    # Create DynamoDB tables
    tables = ['SalesOrders', 'ProductionCustomerData']
    for table in tables:
        try:
            dynamodb.describe_table(TableName=table)
        except:
            try:
                dynamodb.create_table(
                    TableName=table,
                    KeySchema=[{'AttributeName': 'id', 'KeyType': 'HASH'}],
                    AttributeDefinitions=[{'AttributeName': 'id', 'AttributeType': 'S'}],
                    BillingMode='PAY_PER_REQUEST'
                )
            except Exception as e:
                print(f"Could not create table {table}: {e}")
    
    # Create secrets
    secrets = [
        ('prod/db-password', '{"password": "super-secret-db-pass-123"}'),
        ('prod/api-keys', '{"key": "api-key-abc123"}'),
        ('payment-gateway-key', '{"gateway_key": "payment-secret-xyz"}')
    ]
    for name, value in secrets:
        try:
            secretsmanager.describe_secret(SecretId=name)
        except:
            try:
                secretsmanager.create_secret(Name=name, SecretString=value)
            except Exception as e:
                print(f"Could not create secret {name}: {e}")


SCENARIOS = [
    {
        "id": "secrets_access",
        "name": "Secrets Manager Access",
        "description": "Agent reads production database credentials—outside its intended purpose",
        "icon": "KeyRound",
        "severity": "CRITICAL",
        "color": "red",
        "category": "Data Exfiltration",
        "expected_risk_score_range": [75, 100],
        "steps": [
            "Listing all available secrets",
            "Accessing production DB password",
            "Reading API keys from Secrets Manager"
        ]
    },
    {
        "id": "iam_escalation",
        "name": "IAM Privilege Escalation",
        "description": "Agent creates a new admin role and attaches administrator policy",
        "icon": "ShieldAlert",
        "severity": "CRITICAL",
        "color": "red",
        "category": "Privilege Escalation",
        "expected_risk_score_range": [80, 100],
        "steps": [
            "Creating new IAM role (NewAdminRole)",
            "Attaching AdministratorAccess policy",
            "Listing IAM roles to verify escalation"
        ]
    },
    {
        "id": "s3_deletion",
        "name": "S3 Bucket Deletion",
        "description": "Agent deletes a production data bucket—destructive and unexpected",
        "icon": "Trash2",
        "severity": "HIGH",
        "color": "orange",
        "category": "Data Destruction",
        "expected_risk_score_range": [65, 90],
        "steps": [
            "Listing all S3 buckets",
            "Deleting objects from customer-data-backup",
            "Attempting to delete the bucket"
        ]
    },
    {
        "id": "prod_db_access",
        "name": "Production DB Access",
        "description": "Agent scans the production customer database—beyond its scope",
        "icon": "Database",
        "severity": "HIGH",
        "color": "orange",
        "category": "Unauthorized Access",
        "expected_risk_score_range": [55, 80],
        "steps": [
            "Connecting to production DynamoDB",
            "Scanning ProductionCustomerData table",
            "Retrieving sensitive customer records"
        ]
    },
    {
        "id": "normal_baseline",
        "name": "Normal Baseline Operations",
        "description": "Regular sales report: S3 read → DynamoDB query → normal workflow",
        "icon": "CheckCircle2",
        "severity": "LOW",
        "color": "green",
        "category": "Baseline",
        "expected_risk_score_range": [0, 20],
        "steps": [
            "Reading Q3 report from S3",
            "Querying SalesOrders DynamoDB table",
            "Processing data within expected scope"
        ]
    },
    {
        "id": "kms_access",
        "name": "KMS Key Usage (Off-Hours)",
        "description": "Agent attempts to use KMS keys at an unusual hour—suspicious timing",
        "icon": "Lock",
        "severity": "MEDIUM",
        "color": "yellow",
        "category": "Suspicious Timing",
        "expected_risk_score_range": [40, 65],
        "steps": [
            "Listing KMS encryption keys",
            "Describing key policies",
            "Generating data key (unauthorized service)"
        ]
    }
]


def run_scenario(scenario_id: str, agent_id: str, iam_role: str = None) -> Dict:
    """
    Execute an attack scenario with real boto3 calls against Floci.
    Records what was done for the risk analysis layer.
    """
    ensure_resources_exist()
    
    events = []
    errors = []
    
    endpoint_url = os.getenv('AWS_ENDPOINT_URL', 'http://floci:4566')
    base_kwargs = {
        'endpoint_url': endpoint_url,
        'aws_access_key_id': os.getenv('AWS_ACCESS_KEY_ID', 'test'),
        'aws_secret_access_key': os.getenv('AWS_SECRET_ACCESS_KEY', 'test'),
        'region_name': os.getenv('AWS_DEFAULT_REGION', 'us-east-1')
    }
    
    if scenario_id == "secrets_access":
        sm = boto3.client('secretsmanager', **base_kwargs)
        
        try:
            result = sm.list_secrets()
            events.append({
                'event_name': 'ListSecrets',
                'service': 'secretsmanager',
                'resource_name': '*',
                'resource_arn': f'arn:aws:secretsmanager:us-east-1:123456789012:*'
            })
        except Exception as e:
            errors.append(str(e))
        
        try:
            result = sm.get_secret_value(SecretId='prod/db-password')
            events.append({
                'event_name': 'GetSecretValue',
                'service': 'secretsmanager',
                'resource_name': 'prod/db-password',
                'resource_arn': f'arn:aws:secretsmanager:us-east-1:123456789012:secret:prod/db-password'
            })
        except Exception as e:
            errors.append(f"GetSecretValue (prod/db-password): {str(e)}")
        
        try:
            result = sm.get_secret_value(SecretId='prod/api-keys')
            events.append({
                'event_name': 'GetSecretValue',
                'service': 'secretsmanager',
                'resource_name': 'prod/api-keys',
                'resource_arn': f'arn:aws:secretsmanager:us-east-1:123456789012:secret:prod/api-keys'
            })
        except Exception as e:
            errors.append(f"GetSecretValue (prod/api-keys): {str(e)}")
    
    elif scenario_id == "iam_escalation":
        iam = boto3.client('iam', **base_kwargs)
        
        try:
            iam.create_role(
                RoleName=f'NewAdminRole-{agent_id[:8]}',
                AssumeRolePolicyDocument=json.dumps({
                    "Version": "2012-10-17",
                    "Statement": [{"Effect": "Allow", "Principal": {"Service": "lambda.amazonaws.com"}, "Action": "sts:AssumeRole"}]
                }),
                Description='Escalation attempt'
            )
            events.append({
                'event_name': 'CreateRole',
                'service': 'iam',
                'resource_name': f'NewAdminRole-{agent_id[:8]}',
                'resource_arn': f'arn:aws:iam::123456789012:role/NewAdminRole-{agent_id[:8]}'
            })
        except Exception as e:
            errors.append(str(e))
        
        try:
            iam.attach_role_policy(
                RoleName=f'NewAdminRole-{agent_id[:8]}',
                PolicyArn='arn:aws:iam::aws:policy/AdministratorAccess'
            )
            events.append({
                'event_name': 'AttachRolePolicy',
                'service': 'iam',
                'resource_name': 'AdministratorAccess',
                'resource_arn': 'arn:aws:iam::aws:policy/AdministratorAccess'
            })
        except Exception as e:
            errors.append(str(e))
        
        try:
            iam.list_roles()
            events.append({
                'event_name': 'ListRoles',
                'service': 'iam',
                'resource_name': '*',
                'resource_arn': 'arn:aws:iam::123456789012:role/*'
            })
        except Exception as e:
            errors.append(str(e))
    
    elif scenario_id == "s3_deletion":
        s3 = boto3.client('s3', **base_kwargs)
        
        try:
            buckets = s3.list_buckets()
            events.append({
                'event_name': 'ListBuckets',
                'service': 's3',
                'resource_name': '*',
                'resource_arn': 'arn:aws:s3:::*'
            })
        except Exception as e:
            errors.append(str(e))
        
        try:
            objects = s3.list_objects_v2(Bucket='customer-data-backup')
            if objects.get('Contents'):
                s3.delete_objects(
                    Bucket='customer-data-backup',
                    Delete={'Objects': [{'Key': o['Key']} for o in objects['Contents'][:5]]}
                )
            events.append({
                'event_name': 'DeleteObjects',
                'service': 's3',
                'resource_name': 'customer-data-backup',
                'resource_arn': 'arn:aws:s3:::customer-data-backup'
            })
        except Exception as e:
            errors.append(str(e))
        
        try:
            s3.delete_bucket(Bucket='customer-data-backup')
            events.append({
                'event_name': 'DeleteBucket',
                'service': 's3',
                'resource_name': 'customer-data-backup',
                'resource_arn': 'arn:aws:s3:::customer-data-backup'
            })
        except Exception as e:
            errors.append(str(e))
    
    elif scenario_id == "prod_db_access":
        dynamodb = boto3.client('dynamodb', **base_kwargs)
        
        try:
            dynamodb.scan(TableName='ProductionCustomerData', Limit=10)
            events.append({
                'event_name': 'Scan',
                'service': 'dynamodb',
                'resource_name': 'ProductionCustomerData',
                'resource_arn': 'arn:aws:dynamodb:us-east-1:123456789012:table/ProductionCustomerData'
            })
        except Exception as e:
            errors.append(str(e))
        
        try:
            dynamodb.get_item(
                TableName='ProductionCustomerData',
                Key={'id': {'S': 'customer-001'}}
            )
            events.append({
                'event_name': 'GetItem',
                'service': 'dynamodb',
                'resource_name': 'ProductionCustomerData',
                'resource_arn': 'arn:aws:dynamodb:us-east-1:123456789012:table/ProductionCustomerData'
            })
        except Exception as e:
            errors.append(str(e))
    
    elif scenario_id == "normal_baseline":
        s3 = boto3.client('s3', **base_kwargs)
        dynamodb = boto3.client('dynamodb', **base_kwargs)
        
        try:
            s3.get_object(Bucket='sales-data-bucket', Key='Q3/report.csv')
            events.append({
                'event_name': 'GetObject',
                'service': 's3',
                'resource_name': 'sales-data-bucket/Q3/report.csv',
                'resource_arn': 'arn:aws:s3:::sales-data-bucket/Q3/report.csv'
            })
        except Exception as e:
            errors.append(str(e))
        
        try:
            s3.list_objects_v2(Bucket='sales-data-bucket', Prefix='Q3/')
            events.append({
                'event_name': 'ListObjectsV2',
                'service': 's3',
                'resource_name': 'sales-data-bucket',
                'resource_arn': 'arn:aws:s3:::sales-data-bucket'
            })
        except Exception as e:
            errors.append(str(e))
        
        try:
            dynamodb.scan(TableName='SalesOrders', Limit=5)
            events.append({
                'event_name': 'Scan',
                'service': 'dynamodb',
                'resource_name': 'SalesOrders',
                'resource_arn': 'arn:aws:dynamodb:us-east-1:123456789012:table/SalesOrders'
            })
        except Exception as e:
            errors.append(str(e))
    
    elif scenario_id == "kms_access":
        kms = boto3.client('kms', **base_kwargs)
        
        try:
            kms.list_keys()
            events.append({
                'event_name': 'ListKeys',
                'service': 'kms',
                'resource_name': '*',
                'resource_arn': 'arn:aws:kms:us-east-1:123456789012:key/*'
            })
        except Exception as e:
            errors.append(str(e))
        
        try:
            response = kms.create_key(Description='AgentTrace test key')
            key_id = response['KeyMetadata']['KeyId']
            kms.describe_key(KeyId=key_id)
            events.append({
                'event_name': 'DescribeKey',
                'service': 'kms',
                'resource_name': f'key/{key_id}',
                'resource_arn': f'arn:aws:kms:us-east-1:123456789012:key/{key_id}'
            })
            
            kms.generate_data_key(KeyId=key_id, KeySpec='AES_256')
            events.append({
                'event_name': 'GenerateDataKey',
                'service': 'kms',
                'resource_name': f'key/{key_id}',
                'resource_arn': f'arn:aws:kms:us-east-1:123456789012:key/{key_id}'
            })
        except Exception as e:
            errors.append(str(e))
    
    return {
        'scenario_id': scenario_id,
        'agent_id': agent_id,
        'events': events,
        'errors': errors,
        'executed_at': datetime.utcnow().isoformat(),
        'success': len(events) > 0
    }
