import { useNavigate } from 'react-router-dom'
import RiskBadge from './RiskBadge'
import { AlertTriangle, Bot, Cpu, Settings, RefreshCw } from 'lucide-react'

const AGENT_ICONS = {
  'agent-001': Bot,
  'agent-002': RefreshCw,
  'agent-003': Cpu,
  'agent-004': Settings,
}

export default function AgentCard({ summary }) {
  const navigate = useNavigate()
  const {
    agent,
    latest_risk_score,
    latest_risk_level,
    total_events,
    anomalous_events,
    unresolved_risk_events,
  } = summary

  const riskClass = latest_risk_level === 'CRITICAL' ? 'risk-critical'
    : latest_risk_level === 'HIGH' ? 'risk-high' : ''

  const AgentIcon = AGENT_ICONS[agent.id] || Bot

  return (
    <div
      id={`agent-card-${agent.id}`}
      className={`agent-card ${riskClass}`}
      onClick={() => navigate(`/agents/${agent.id}`)}
    >
      <div className="agent-card-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div className="agent-icon">
            <AgentIcon size={16} strokeWidth={1.8} />
          </div>
          <div>
            <div className="agent-name">{agent.name}</div>
            <div className="agent-owner">
              <span className={`env-badge ${agent.environment}`}>{agent.environment}</span>
              &nbsp;· {agent.owner}
            </div>
          </div>
        </div>
        <RiskBadge level={latest_risk_level} score={latest_risk_score} />
      </div>

      <div className="agent-purpose">{agent.purpose}</div>

      {anomalous_events > 0 && (
        <div className="alert alert-danger" style={{ padding: '8px 12px', marginBottom: '14px', fontSize: '13px' }}>
          <AlertTriangle size={13} strokeWidth={2.5} />
          <span>
            {anomalous_events} anomalous event{anomalous_events > 1 ? 's' : ''} detected
            {unresolved_risk_events > 0 && ` · ${unresolved_risk_events} unresolved`}
          </span>
        </div>
      )}

      <div className="agent-stats">
        <div className="agent-stat">
          <div className="agent-stat-value">{total_events}</div>
          <div className="agent-stat-label">Events</div>
        </div>
        <div className="agent-stat">
          <div className="agent-stat-value" style={{
            color: anomalous_events > 0 ? 'var(--danger)' : 'var(--success)'
          }}>
            {anomalous_events}
          </div>
          <div className="agent-stat-label">Anomalies</div>
        </div>
        <div className="agent-stat">
          <div className="agent-stat-value" style={{
            color: latest_risk_score >= 75 ? 'var(--critical)'
              : latest_risk_score >= 50 ? 'var(--danger)'
              : latest_risk_score >= 25 ? 'var(--warning)'
              : 'var(--success)'
          }}>
            {Math.round(latest_risk_score)}
          </div>
          <div className="agent-stat-label">Risk Score</div>
        </div>
      </div>

      {(agent.expected_services || []).length > 0 && (
        <div style={{ display: 'flex', gap: '5px', marginTop: '12px', flexWrap: 'wrap' }}>
          {(agent.expected_services || []).map(svc => (
            <span key={svc} className="tag tag-blue">{svc}</span>
          ))}
        </div>
      )}
    </div>
  )
}
