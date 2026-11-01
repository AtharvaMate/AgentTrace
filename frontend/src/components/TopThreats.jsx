import { AlertTriangle, Clock } from 'lucide-react'
import { Link } from 'react-router-dom'

function timeAgo(d) {
  if (!d) return ''
  const s = Math.floor((Date.now() - new Date(d)) / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default function TopThreats({ agents = [] }) {
  // Extract all unresolved risk events from all agents
  const threats = agents
    .filter(a => a.unresolved_risk_events > 0)
    .map(a => ({
      agentId: a.agent.id,
      agentName: a.agent.name,
      riskLevel: a.latest_risk_level,
      riskScore: a.latest_risk_score,
      unresolvedCount: a.unresolved_risk_events,
      anomalies: a.anomalous_events
    }))
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, 5)

  const riskColor = (level) => {
    return {
      CRITICAL: 'var(--risk-critical)',
      HIGH: 'var(--risk-high)',
      MEDIUM: 'var(--risk-medium)',
      LOW: 'var(--risk-low)'
    }[level] || 'var(--text-muted)'
  }

  return (
    <div className="card">
      <h3 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '16px', color: 'var(--text-primary)' }}>
        Top Threats
      </h3>

      {threats.length > 0 ? (
        <div>
          {threats.map((threat, idx) => (
            <Link
              key={threat.agentId}
              to={`/agents/${threat.agentId}`}
              style={{ 
                display: 'block',
                textDecoration: 'none',
                padding: '12px',
                borderBottom: idx < threats.length - 1 ? '1px solid var(--border-default)' : 'none',
                borderRadius: '6px',
                transition: 'background 0.15s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertTriangle size={14} color={riskColor(threat.riskLevel)} />
                  <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>
                    {threat.agentName}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span 
                    className="badge badge-sm"
                    style={{ 
                      background: `${riskColor(threat.riskLevel)}20`,
                      color: riskColor(threat.riskLevel),
                      border: `1px solid ${riskColor(threat.riskLevel)}40`
                    }}
                  >
                    {threat.riskLevel}
                  </span>
                  <span style={{ fontSize: '14px', fontWeight: '700', color: riskColor(threat.riskLevel) }}>
                    {threat.riskScore.toFixed(1)}
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '12px', fontSize: '11px', color: 'var(--text-muted)', marginLeft: '22px' }}>
                <span>{threat.unresolvedCount} unresolved risk{threat.unresolvedCount !== 1 ? 's' : ''}</span>
                <span>•</span>
                <span>{threat.anomalies} anomal{threat.anomalies !== 1 ? 'ies' : 'y'}</span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <div style={{ fontSize: '48px', marginBottom: '8px' }}>✓</div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>All agents operating normally</div>
        </div>
      )}
    </div>
  )
}
