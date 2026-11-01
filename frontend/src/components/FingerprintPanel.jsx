import { useState } from 'react'
import { Brain, Activity, Clock, Database, Zap, TrendingUp, RefreshCw, AlertCircle } from 'lucide-react'
import { buildFingerprint } from '../api/client'

export default function FingerprintPanel({ agentId, fingerprint, onUpdate }) {
  const [building, setBuilding] = useState(false)
  const [error, setError] = useState(null)

  async function handleBuild() {
    try {
      setBuilding(true)
      setError(null)
      const result = await buildFingerprint(agentId)
      onUpdate(result)
    } catch (err) {
      setError(err.message || 'Failed to build fingerprint')
    } finally {
      setBuilding(false)
    }
  }

  if (!fingerprint) {
    return (
      <div className="empty-state" style={{ padding: '60px 20px' }}>
        <Brain size={48} strokeWidth={1} style={{ color: 'var(--text-muted)', marginBottom: '16px' }} />
        <h3 style={{ fontSize: '16px', marginBottom: '8px' }}>No Fingerprint</h3>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>
          Build a behavioral fingerprint to establish normal patterns
        </p>
        <button onClick={handleBuild} disabled={building} className="button-primary">
          <Brain size={14} />
          {building ? 'Building...' : 'Build Fingerprint'}
        </button>
      </div>
    )
  }

  const lastUpdated = new Date(fingerprint.last_updated)
  const daysOld = Math.floor((Date.now() - lastUpdated) / (1000 * 60 * 60 * 24))

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '4px' }}>
            Behavioral Fingerprint
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            Last updated {daysOld === 0 ? 'today' : `${daysOld} day${daysOld !== 1 ? 's' : ''} ago`}
          </p>
        </div>
        <button
          onClick={handleBuild}
          disabled={building}
          className="button-secondary"
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <RefreshCw size={14} className={building ? 'spin' : ''} />
          Rebuild
        </button>
      </div>

      {error && (
        <div className="alert alert-danger" style={{ marginBottom: '16px' }}>
          <AlertCircle size={14} />
          {error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '20px' }}>
        <div className="stat-card" style={{ padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <Database size={16} style={{ color: '#3b82f6' }} />
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Services</span>
          </div>
          <div style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)' }}>
            {fingerprint.normal_services?.length || 0}
          </div>
        </div>

        <div className="stat-card" style={{ padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <Activity size={16} style={{ color: '#10b981' }} />
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Actions</span>
          </div>
          <div style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)' }}>
            {fingerprint.normal_actions?.length || 0}
          </div>
        </div>

        <div className="stat-card" style={{ padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <Clock size={16} style={{ color: '#8b5cf6' }} />
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Active Hours</span>
          </div>
          <div style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)' }}>
            {fingerprint.typical_hours?.length || 0}
          </div>
        </div>

        <div className="stat-card" style={{ padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <TrendingUp size={16} style={{ color: '#eab308' }} />
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Daily Events</span>
          </div>
          <div style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)' }}>
            {Math.round(fingerprint.avg_daily_events || 0)}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div className="card" style={{ padding: '16px' }}>
          <h4 style={{ fontSize: '13px', fontWeight: '600', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Database size={14} style={{ color: '#3b82f6' }} />
            Normal Services
          </h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {fingerprint.normal_services?.slice(0, 10).map(service => (
              <span
                key={service}
                style={{
                  fontSize: '11px',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  background: '#3b82f615',
                  border: '1px solid #3b82f640',
                  color: '#3b82f6'
                }}
              >
                {service}
              </span>
            ))}
            {fingerprint.normal_services?.length > 10 && (
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                +{fingerprint.normal_services.length - 10} more
              </span>
            )}
          </div>
        </div>

        <div className="card" style={{ padding: '16px' }}>
          <h4 style={{ fontSize: '13px', fontWeight: '600', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Activity size={14} style={{ color: '#10b981' }} />
            Normal Actions
          </h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {fingerprint.normal_actions?.slice(0, 8).map(action => (
              <span
                key={action}
                style={{
                  fontSize: '11px',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  background: '#10b98115',
                  border: '1px solid #10b98140',
                  color: '#10b981'
                }}
              >
                {action}
              </span>
            ))}
            {fingerprint.normal_actions?.length > 8 && (
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                +{fingerprint.normal_actions.length - 8} more
              </span>
            )}
          </div>
        </div>
      </div>

      {fingerprint.model_path && (
        <div className="card" style={{ padding: '16px', marginTop: '16px', background: 'linear-gradient(135deg, #1e3a8a15 0%, #7c3aed15 100%)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Zap size={20} style={{ color: '#fff' }} />
            </div>
            <div>
              <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '2px' }}>
                ML Model Trained
              </h4>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Version {fingerprint.model_version} · Threshold: {fingerprint.anomaly_threshold?.toFixed(4)}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
