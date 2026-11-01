import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional
import datetime


class EmailNotifier:
    """Email notification service for anomalous agent behavior."""
    
    def __init__(self):
        self.smtp_host = os.getenv('SMTP_HOST', 'smtp.gmail.com')
        self.smtp_port = int(os.getenv('SMTP_PORT', '587'))
        self.smtp_user = os.getenv('SMTP_USER', '')
        self.smtp_password = os.getenv('SMTP_PASSWORD', '')
        self.from_email = os.getenv('SMTP_FROM', self.smtp_user)
        self.enabled = bool(self.smtp_user and self.smtp_password)
    
    def send_anomaly_alert(
        self,
        to_email: str,
        agent_name: str,
        agent_id: str,
        event_name: str,
        service: str,
        resource_arn: str,
        anomaly_reason: str,
        risk_level: str,
        event_time: datetime.datetime
    ) -> bool:
        """Send email alert for anomalous behavior."""
        
        if not self.enabled:
            print(f"⚠️  Email not configured. Skipping notification to {to_email}")
            return False
        
        subject = f"🚨 [{risk_level}] Anomalous Behavior Detected - {agent_name}"
        
        # HTML email body
        html_body = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background: #dc2626; color: white; padding: 20px; border-radius: 8px 8px 0 0; }}
                .content {{ background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }}
                .footer {{ background: #1f2937; color: #9ca3af; padding: 15px; text-align: center; border-radius: 0 0 8px 8px; font-size: 12px; }}
                .badge {{ display: inline-block; padding: 4px 12px; border-radius: 4px; font-weight: 600; font-size: 12px; }}
                .badge-critical {{ background: #dc2626; color: white; }}
                .badge-high {{ background: #ef4444; color: white; }}
                .badge-medium {{ background: #f59e0b; color: white; }}
                .badge-low {{ background: #10b981; color: white; }}
                .detail-box {{ background: white; padding: 15px; margin: 15px 0; border-left: 4px solid #dc2626; border-radius: 4px; }}
                .label {{ font-weight: 600; color: #6b7280; margin-bottom: 5px; }}
                .value {{ color: #111827; font-family: monospace; font-size: 13px; }}
                .action-btn {{ display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 0; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h2 style="margin: 0;">🚨 Anomalous Agent Behavior Detected</h2>
                    <p style="margin: 5px 0 0 0; opacity: 0.9;">AgentTrace Security Alert</p>
                </div>
                
                <div class="content">
                    <p><strong>An AI agent has performed an action outside its normal behavioral baseline.</strong></p>
                    
                    <div class="detail-box">
                        <div class="label">Agent</div>
                        <div class="value" style="font-size: 16px; font-weight: 600; color: #111827; font-family: Arial;">{agent_name}</div>
                        <div style="font-size: 11px; color: #6b7280; margin-top: 3px;">{agent_id}</div>
                    </div>
                    
                    <div class="detail-box">
                        <div class="label">Risk Level</div>
                        <span class="badge badge-{risk_level.lower()}">{risk_level}</span>
                    </div>
                    
                    <div class="detail-box">
                        <div class="label">Anomalous Action</div>
                        <div class="value">{event_name}</div>
                    </div>
                    
                    <div class="detail-box">
                        <div class="label">AWS Service</div>
                        <div class="value">{service}</div>
                    </div>
                    
                    <div class="detail-box">
                        <div class="label">Resource ARN</div>
                        <div class="value" style="word-break: break-all;">{resource_arn}</div>
                    </div>
                    
                    <div class="detail-box">
                        <div class="label">Why This is Anomalous</div>
                        <div style="color: #111827; margin-top: 8px;">{anomaly_reason}</div>
                    </div>
                    
                    <div class="detail-box">
                        <div class="label">Timestamp</div>
                        <div class="value">{event_time.strftime('%Y-%m-%d %H:%M:%S UTC')}</div>
                    </div>
                    
                    <div style="text-align: center; margin: 25px 0;">
                        <a href="http://localhost:5173/agents/{agent_id}" class="action-btn">
                            View Agent Details →
                        </a>
                    </div>
                    
                    <div style="background: #fef3c7; border: 1px solid #fbbf24; padding: 12px; border-radius: 6px; margin-top: 20px;">
                        <strong style="color: #92400e;">⚠️ Recommended Actions:</strong>
                        <ul style="margin: 8px 0 0 0; padding-left: 20px; color: #92400e;">
                            <li>Review the agent's recent activity in the dashboard</li>
                            <li>Check if this action was authorized</li>
                            <li>Consider suspending the agent if behavior is malicious</li>
                            <li>Update guardrails to prevent similar actions</li>
                        </ul>
                    </div>
                </div>
                
                <div class="footer">
                    <p style="margin: 0;">AgentTrace - AI Agent Behavioral Monitoring Platform</p>
                    <p style="margin: 5px 0 0 0;">This is an automated alert. Do not reply to this email.</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        # Plain text fallback
        text_body = f"""
ANOMALOUS AGENT BEHAVIOR DETECTED

Agent: {agent_name} ({agent_id})
Risk Level: {risk_level}

Anomalous Action: {event_name}
Service: {service}
Resource: {resource_arn}

Why This is Anomalous:
{anomaly_reason}

Timestamp: {event_time.strftime('%Y-%m-%d %H:%M:%S UTC')}

View Details: http://localhost:5173/agents/{agent_id}

---
This is an automated alert from AgentTrace.
        """
        
        try:
            # Create message
            msg = MIMEMultipart('alternative')
            msg['Subject'] = subject
            msg['From'] = self.from_email
            msg['To'] = to_email
            
            # Attach both plain text and HTML versions
            part1 = MIMEText(text_body, 'plain')
            part2 = MIMEText(html_body, 'html')
            msg.attach(part1)
            msg.attach(part2)
            
            # Send email
            with smtplib.SMTP(self.smtp_host, self.smtp_port) as server:
                server.starttls()
                server.login(self.smtp_user, self.smtp_password)
                server.send_message(msg)
            
            print(f"✅ Email alert sent to {to_email} for agent {agent_name}")
            return True
            
        except Exception as e:
            print(f"❌ Failed to send email to {to_email}: {e}")
            return False


# Singleton instance
email_notifier = EmailNotifier()
