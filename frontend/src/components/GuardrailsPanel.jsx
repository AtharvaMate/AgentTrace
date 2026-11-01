import { useState, useEffect } from 'react'
import { Shield, Lock, Clock, Zap, AlertTriangle, CheckCircle, XCircle, RefreshCw, Sparkles, Ban, UserCheck, Play } from 'lucide-react'
import { getGuardrails, generateGuardrails, toggleGuardrail, deleteGuardrail, createGuardrail, getAgent } from '../api/client'

const RULE_TYPE_ICONS = {
  'allowed_services': Shield,
  'allowed_actions': Lock,
  'block_sensitive_services': AlertTriangle,
  'block_dangerous_actions': XCircle,
  'allowed_time_windows': Clock,
  'rate_limit': Zap,
  'anomaly_detection': Sparkles
}

const RULE_TYPE_COLORS = {
  'allowed_services': '#3b82f6',
  'allowed_actions': '#10b981',
  'block_sensitive_services': '#ef4444',
  'block_dangerous_actions': '#f97316',
  'allowed_time_windows': '#8b5cf6',
  'rate_limit': '#eab308',
  'anomaly_detection': '#ec4899'
}

const SENSITIVE_SERVICES = ['iam', 'secretsmanager', 'kms', 'sts', 'cloudformation', 'organizations']
const APPROVAL_SERVICES = ['rds', 'ec2', 'lambda', 'dynamodb', 'sns', 'sqs']

export default function GuardrailsPanel({ agentId }) {
  const [guardrails, setGuardrails] = useState([])
  const [agent, setAgent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState(null)
  const [blockingService, setBlockingService] = useState(null)

  useEffect(() => {
    loadData()
  }, [agentId])

  async function loadData() {
    try {
      setLoading(true)
      setError(null)
      const [guardrailsData, agentData] = await Promise.all([
        getGuardrails(agentId),
        getAgent(agentId)
      ])
      setGuardrails(guardrailsData)
      setAgent(agentData.agent)
    } catch (err) {
      setError(err.message || 'Failed to load guardrails')
    } finally {
      setLoading(false)
    }
  }

  async function handleGenerate() {
    try {
      setGenerating(true)
      setError(null)
      const result = await generateGuardrails(agentId)
      setGuardrails(result.guardrails)
    } catch (err) {
      setError(err.message || 'Failed to generate guardrails')
    } finally {
      setGenerating(false)
    }
  }

  async function handleToggle(guardrailId) {
    try {
      const updated = await toggleGuardrail(guardrailId)
      setGuardrails(prev => prev.map(g => g.id === guardrailId ? updated : g))
    } catch (err) {
      console.error('Failed to toggle guardrail:', err)
    }
  }

  async function handleDelete(guardrailId) {
    if (!confirm('Delete this guardrail?')) return
    try {
      await deleteGuardrail(guardrailId)
      setGuardrails(prev => prev.filter(g => g.id !== guardrailId))
    } catch (err) {
      console.error('Failed to delete guardrail:', err)
    }
  }

  async function handleBlockService(service) {
    try {
      setBlockingService(service)
      const newGuardrail = {
        rule_type: 'block_sensitive_services',
        rule_config: { services: [service] },
        is_active: true,
        auto_generated: false,
        description: `Manually blocked service: ${service}`
      }
      await createGuardrail(agentId, newGuardrail)
      await loadData()
    } catch (err) {
      console.error('Failed to block service:', err)
      setError(`Failed to block ${service}`)
    } finally {
      setBlockingService(null)
    }
  }

  // Get currently allowed and blocked services
  const allowedServicesRule = guardrails.find(g => g.rule_type === 'allowed_services')
  const blockedServicesRule = guardrails.find(g => g.rule_type === 'block_sensitive_services')
  
  const allowedServices = allowedServicesRule?.rule_config?.services || []
  const blockedServices = blockedServicesRule?.rule_config?.services || []
  
  // Determine auto-blocked, approval-needed, and allowed services
  const autoBlockedServices = SENSITIVE_SERVICES.filter(s => !allowedServices.includes(s))
  const approvalServices = APPROVAL_SERVICES.filter(s => 
    !allowedServices.includes(s) && 
    !blockedServices.includes(s) &&
    !autoBlockedServices.includes(s)
  )
  const unblockedSensitive = SENSITIVE_SERVICES.filter(s => 
    allowedServices.includes(s) && !blockedServices.includes(s)
  )

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <div className="spinner" />
        <p style={{ marginTop: '12px', color: 'var(--text-muted)' }}>Loading guardrails...</p>
      </div>
    )
  }

  const activeCount = guardrails.filter(g => g.is_active).length
  const autoCount = guardrails.filter(g => g.auto_generated).length

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '4px' }}>
            Guardrails ({guardrails.length})
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            {activeCount} active · {autoCount} auto-generated
          </p>
        </div>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="btn btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          {generating ? (
            <>
              <RefreshCw size={14} className="spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles size={14} />
              Auto-Generate
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="alert alert-critical" style={{ marginBottom: '16px' }}>
          <AlertTriangle size={14} />
          {error}
        </div>
      )}

      {/* Service Status Cards */}
      <div className="grid-3 gap-4 mb-5">
        {/* Auto-Blocked Services */}
        <div className="card" style={{ borderLeft: '3px solid #ef4444' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <div style={{ 
              width: '32px', 
              height: '32px', 
              borderRadius: '6px', 
              background: 'rgba(239, 68, 68, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Ban size={16} style={{ color: '#ef4444' }} />
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>
                Auto-Blocked
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Sensitive services
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {autoBlockedServices.length > 0 ? (
              autoBlockedServices.map(service => (
                <span key={service} className="badge badge-critical" style={{ fontSize: '11px' }}>
                  {service}
                </span>
              ))
            ) : (
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>None</span>
            )}
          </div>
        </div>

        {/* Human Approval Required */}
        <div className="card" style={{ borderLeft: '3px solid #f59e0b' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <div style={{ 
              width: '32px', 
              height: '32px', 
              borderRadius: '6px', 
              background: 'rgba(245, 158, 11, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <UserCheck size={16} style={{ color: '#f59e0b' }} />
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>
                Needs Approval
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Moderate risk services
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {approvalServices.length > 0 ? (
              approvalServices.map(service => (
                <div key={service} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <span className="badge badge-warning" style={{ fontSize: '11px' }}>
                    {service}
                  </span>
                  <button
                    onClick={() => handleBlockService(service)}
                    disabled={blockingService === service}
                    style={{
                      padding: '2px 6px',
                      borderRadius: '4px',
                      border: 'none',
                      background: '#ef4444',
                      color: '#fff',
                      fontSize: '10px',
                      cursor: blockingService === service ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '2px',
                      opacity: blockingService === service ? 0.5 : 1
                    }}
                    title={`Block ${service}`}
                  >
                    {blockingService === service ? (
                      <RefreshCw size={10} className="spin" />
                    ) : (
                      <Ban size={10} />
                    )}
                  </button>
                </div>
              ))
            ) : (
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>None</span>
            )}
          </div>
        </div>

        {/* Allowed Services */}
        <div className="card" style={{ borderLeft: '3px solid #10b981' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <div style={{ 
              width: '32px', 
              height: '32px', 
              borderRadius: '6px', 
              background: 'rgba(16, 185, 129, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <CheckCircle size={16} style={{ color: '#10b981' }} />
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>
                Allowed
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Normal operation
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {allowedServices.length > 0 ? (
              allowedServices.map(service => (
                <span key={service} className="badge badge-low" style={{ fontSize: '11px' }}>
                  {service}
                </span>
              ))
            ) : (
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>None</span>
            )}
          </div>
        </div>
      </div>

      {/* Warning for sensitive services that should be blocked */}
      {unblockedSensitive.length > 0 && (
        <div className="alert alert-warning" style={{ marginBottom: '20px' }}>
          <AlertTriangle size={16} />
          <div>
            <div style={{ fontWeight: '600', marginBottom: '4px' }}>Security Warning</div>
            <div style={{ fontSize: '13px' }}>
              The following sensitive services are allowed but not actively blocked: {unblockedSensitive.join(', ')}
            </div>
            <div style={{ fontSize: '12px', marginTop: '8px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {unblockedSensitive.map(service => (
                <button
                  key={service}
                  onClick={() => handleBlockService(service)}
                  disabled={blockingService === service}
                  className="btn btn-sm"
                  style={{ 
                    background: '#ef4444', 
                    color: '#fff',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  {blockingService === service ? (
                    <>
                      <RefreshCw size={12} className="spin" />
                      Blocking...
                    </>
                  ) : (
                    <>
                      <Ban size={12} />
                      Block {service}
                    </>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Guardrails List */}
      {guardrails.length === 0 ? (
        <div className="empty-state" style={{ padding: '60px 20px' }}>
          <Shield size={48} strokeWidth={1} style={{ color: 'var(--text-muted)', marginBottom: '16px' }} />
          <h3 style={{ fontSize: '16px', marginBottom: '8px' }}>No Guardrails</h3>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>
            Generate guardrails automatically from this agent's behavioral fingerprint
          </p>
          <button onClick={handleGenerate} disabled={generating} className="btn btn-primary">
            <Sparkles size={14} />
            Generate Guardrails
          </button>
        </div>
      ) : (
        <div>
          <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', color: 'var(--text-primary)' }}>
            Active Guardrails
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {guardrails.map(guardrail => {
              const Icon = RULE_TYPE_ICONS[guardrail.rule_type] || Shield
              const color = RULE_TYPE_COLORS[guardrail.rule_type] || '#64748b'

              return (
                <div
                  key={guardrail.id}
                  className="card"
                  style={{
                    padding: '16px',
                    borderLeft: `3px solid ${guardrail.is_active ? color : 'var(--border-default)'}`,
                    opacity: guardrail.is_active ? 1 : 0.6
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                    <div
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '8px',
                        background: `${color}15`,
                        border: `1px solid ${color}40`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}
                    >
                      <Icon size={18} style={{ color }} />
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <h4 style={{ fontSize: '14px', fontWeight: '600' }}>
                          {guardrail.rule_type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                        </h4>
                        {guardrail.auto_generated && (
                          <span
                            style={{
                              fontSize: '10px',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              background: 'var(--bg-elevated)',
                              border: '1px solid var(--border-default)',
                              color: 'var(--text-muted)',
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px'
                            }}
                          >
                            Auto
                          </span>
                        )}
                      </div>

                      <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                        {guardrail.description}
                      </p>

                      {/* Show services/actions in the rule */}
                      {guardrail.rule_config?.services && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '8px' }}>
                          {guardrail.rule_config.services.map(service => (
                            <span key={service} className="badge badge-sm" style={{ fontSize: '10px' }}>
                              {service}
                            </span>
                          ))}
                        </div>
                      )}

                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        Created {new Date(guardrail.created_at).toLocaleDateString()}
                        {guardrail.trigger_count > 0 && (
                          <span> · Triggered {guardrail.trigger_count} time{guardrail.trigger_count !== 1 ? 's' : ''}</span>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                      <button
                        onClick={() => handleToggle(guardrail.id)}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '6px',
                          border: '1px solid var(--border-default)',
                          background: 'var(--bg-elevated)',
                          color: guardrail.is_active ? '#10b981' : 'var(--text-muted)',
                          fontSize: '12px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        {guardrail.is_active ? <CheckCircle size={12} /> : <XCircle size={12} />}
                        {guardrail.is_active ? 'Active' : 'Inactive'}
                      </button>
                      {!guardrail.auto_generated && (
                        <button
                          onClick={() => handleDelete(guardrail.id)}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '6px',
                            border: '1px solid var(--border-default)',
                            background: 'var(--bg-elevated)',
                            color: 'var(--danger)',
                            fontSize: '12px',
                            cursor: 'pointer'
                          }}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
