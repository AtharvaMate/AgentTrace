import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { 
  Activity, Brain, Shield, Network, AlertOctagon, RefreshCw, Bot, 
  Check, X, Copy, AlertTriangle, Lock, Database, Clock, TrendingUp, 
  Cpu, CheckCircle, XCircle, Info, Eye, BarChart2, Minus, Mail
} from 'lucide-react'
import { 
  LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, 
  CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, 
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend 
} from 'recharts'
import ActivityFeed from '../components/ActivityFeed'
import RiskBadge from '../components/RiskBadge'
import RiskRing from '../components/RiskRing'
import BlastRadiusGraph from '../components/BlastRadiusGraph'
import DeviationTimeline from '../components/DeviationTimeline'
import GuardrailsPanel from '../components/GuardrailsPanel'
import FingerprintPanel from '../components/FingerprintPanel'
import EmailNotificationsPanel from '../components/EmailNotificationsPanel'
import { 
  getAgent, getActivity, getRiskEvents, getFingerprint, buildFingerprint, 
  getBlastRadius, getModelMetrics, getIntentComparison, getLeastPrivilegePolicy, 
  resolveRiskEvent, syncCloudTrail, getAnomalies
} from '../api/client'

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

function riskColor(level) {
  return {
    CRITICAL: 'var(--risk-critical)',
    HIGH: 'var(--risk-high)',
    MEDIUM: 'var(--risk-medium)',
    LOW: 'var(--risk-low)'
  }[level] || 'var(--text-muted)'
}

function initials(name) {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

export default function AgentDetail() {
  const { agentId } = useParams()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [syncing, setSyncing] = useState(false)
  const [building, setBuilding] = useState(false)
  
  const [agent, setAgent] = useState(null)
  const [activity, setActivity] = useState([])
  const [anomalies, setAnomalies] = useState([])
  const [riskEvents, setRiskEvents] = useState([])
  const [fingerprint, setFingerprint] = useState(null)
  const [blastRadius, setBlastRadius] = useState(null)
  const [metrics, setMetrics] = useState(null)
  const [intentComparison, setIntentComparison] = useState(null)
  
  const [activeTab, setActiveTab] = useState('overview')
  const [showPolicyModal, setShowPolicyModal] = useState(false)
  const [leastPrivilegePolicy, setLeastPrivilegePolicy] = useState(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    loadData()
  }, [agentId])

  async function loadData() {
    try {
      setLoading(true)
      setError(null)
      const [agentData, activityData, riskData, fpData] = await Promise.all([
        getAgent(agentId),
        getActivity(agentId, 50),
        getRiskEvents(agentId),
        getFingerprint(agentId)
      ])
      setAgent(agentData)
      setActivity(activityData)
      setRiskEvents(riskData)
      setFingerprint(fpData)
      
      // Load anomalies for deviation timeline
      const anomalyData = await getAnomalies(agentId)
      setAnomalies(anomalyData)
    } catch (err) {
      setError(err.message || 'Failed to load agent')
    } finally {
      setLoading(false)
    }
  }

  async function loadBlastRadius() {
    try {
      const data = await getBlastRadius(agentId)
      setBlastRadius(data)
    } catch (err) {
      console.error('Failed to load blast radius:', err)
    }
  }

  async function loadMetrics() {
    try {
      const data = await getModelMetrics(agentId)
      setMetrics(data)
    } catch (err) {
      console.error('Failed to load metrics:', err)
    }
  }

  async function loadIntentComparison() {
    try {
      const data = await getIntentComparison(agentId)
      setIntentComparison(data)
    } catch (err) {
      console.error('Failed to load intent comparison:', err)
    }
  }

  async function handleSync() {
    try {
      setSyncing(true)
      await syncCloudTrail()
      await loadData()
    } catch (err) {
      console.error('Sync failed:', err)
    } finally {
      setSyncing(false)
    }
  }

  async function handleBuildFingerprint() {
    try {
      setBuilding(true)
      const fp = await buildFingerprint(agentId)
      setFingerprint(fp)
      await loadMetrics()
    } catch (err) {
      console.error('Build failed:', err)
    } finally {
      setBuilding(false)
    }
  }

  async function handleResolveRisk(eventId) {
    try {
      await resolveRiskEvent(eventId)
      setRiskEvents(prev => prev.map(e => e.id === eventId ? { ...e, is_resolved: true } : e))
    } catch (err) {
      console.error('Resolve failed:', err)
    }
  }

  async function handleGeneratePolicy() {
    try {
      const policy = await getLeastPrivilegePolicy(agentId)
      setLeastPrivilegePolicy(policy)
      setShowPolicyModal(true)
    } catch (err) {
      console.error('Policy generation failed:', err)
    }
  }

  function handleCopyPolicy() {
    if (leastPrivilegePolicy?.policy) {
      navigator.clipboard.writeText(JSON.stringify(leastPrivilegePolicy.policy, null, 2))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  useEffect(() => {
    if (activeTab === 'blast-radius' && !blastRadius) {
      loadBlastRadius()
    }
    if (activeTab === 'behavioral-ai' && !metrics) {
      loadMetrics()
    }
    if (activeTab === 'intent-vs-actual' && !intentComparison) {
      loadIntentComparison()
    }
    if (activeTab === 'deviations' && anomalies.length === 0) {
      getAnomalies(agentId).then(setAnomalies).catch(console.error)
    }
  }, [activeTab])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 400 }}>
        <div className="spinner-lg"></div>
      </div>
    )
  }

  if (error || !agent) {
    return (
      <div className="alert alert-critical" style={{ marginTop: 24 }}>
        <AlertTriangle size={18} />
        <span>{error || 'Agent not found'}</span>
      </div>
    )
  }

  const unresolvedRisks = riskEvents.filter(e => !e.is_resolved).length
  const serviceUsage = fingerprint?.service_frequency || {}
  const actionFrequency = fingerprint?.action_frequency || {}

  const radarData = Object.entries(serviceUsage).map(([service, count]) => ({
    service,
    actual: count,
    expected: Math.max(10, count * 0.8)
  }))

  const serviceFreqSorted = Object.entries(serviceUsage).sort((a, b) => b[1] - a[1]).slice(0, 8)
  const actionFreqSorted = Object.entries(actionFrequency).sort((a, b) => b[1] - a[1]).slice(0, 8)
  const maxServiceCount = serviceFreqSorted[0]?.[1] || 1
  const maxActionCount = actionFreqSorted[0]?.[1] || 1

  return (
    <div>
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flex: 1 }}>
            <div 
              style={{ 
                width: 48, 
                height: 48, 
                borderRadius: '50%', 
                background: riskColor(agent.latest_risk_level), 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                color: 'white', 
                fontSize: 18, 
                fontWeight: 700,
                flexShrink: 0
              }}
            >
              {initials(agent.agent.name)}
            </div>
            <div style={{ flex: 1 }}>
              <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 6, color: 'var(--text-primary)' }}>
                {agent.agent.name}
              </h1>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 10, lineHeight: 1.5, maxWidth: 600 }}>
                {agent.agent.purpose}
              </p>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <span className="badge badge-blue">{agent.agent.environment}</span>
                <span className={`badge ${agent.agent.status === 'active' ? 'badge-low' : 'badge-neutral'}`}>
                  {agent.agent.status}
                </span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Owner: {agent.agent.owner}
                </span>
                <RiskBadge level={agent.latest_risk_level} />
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary btn-sm" onClick={handleBuildFingerprint} disabled={building}>
              {building ? (
                <>
                  <div className="spinner" style={{ width: 14, height: 14 }}></div>
                  <span>Training...</span>
                </>
              ) : (
                <>
                  <Brain size={14} />
                  <span>Build Fingerprint</span>
                </>
              )}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={handleSync} disabled={syncing}>
              {syncing ? (
                <div className="spinner" style={{ width: 14, height: 14 }}></div>
              ) : (
                <RefreshCw size={14} />
              )}
              <span>Sync</span>
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          <div style={{ background: 'var(--elevated)', padding: '12px 16px', borderRadius: 8, border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Total Events</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>{agent.total_events}</div>
          </div>
          <div style={{ background: 'var(--elevated)', padding: '12px 16px', borderRadius: 8, border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Anomalies</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--risk-high)' }}>{agent.anomalous_events}</div>
          </div>
          <div style={{ background: 'var(--elevated)', padding: '12px 16px', borderRadius: 8, border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Open Risks</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: unresolvedRisks > 0 ? 'var(--risk-critical)' : 'var(--text-primary)' }}>
              {unresolvedRisks}
            </div>
          </div>
          <div style={{ background: 'var(--elevated)', padding: '12px 16px', borderRadius: 8, border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Last Risk Score</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: riskColor(agent.latest_risk_level) }}>
              {agent.latest_risk_score?.toFixed(1) || 0}
            </div>
          </div>
        </div>
      </div>

      <div className="tabs" style={{ marginBottom: 24 }}>
        <button 
          className={`tab ${activeTab === 'overview' ? 'active' : ''}`} 
          onClick={() => setActiveTab('overview')}
        >
          <Activity size={16} />
          <span>Overview</span>
        </button>
        <button 
          className={`tab ${activeTab === 'risk-events' ? 'active' : ''}`} 
          onClick={() => setActiveTab('risk-events')}
        >
          <AlertOctagon size={16} />
          <span>Risk Events</span>
          {unresolvedRisks > 0 && (
            <span className="badge badge-critical" style={{ marginLeft: 6 }}>{unresolvedRisks}</span>
          )}
        </button>
        <button 
          className={`tab ${activeTab === 'intent-vs-actual' ? 'active' : ''}`} 
          onClick={() => setActiveTab('intent-vs-actual')}
        >
          <Shield size={16} />
          <span>Intent vs Actual</span>
        </button>
        <button 
          className={`tab ${activeTab === 'deviations' ? 'active' : ''}`} 
          onClick={() => setActiveTab('deviations')}
        >
          <TrendingUp size={16} />
          <span>Deviations</span>
          {anomalies.length > 0 && (
            <span className="badge badge-warning" style={{ marginLeft: 6 }}>{anomalies.length}</span>
          )}
        </button>
        <button 
          className={`tab ${activeTab === 'blast-radius' ? 'active' : ''}`} 
          onClick={() => setActiveTab('blast-radius')}
        >
          <Network size={16} />
          <span>Blast Radius</span>
        </button>
        <button 
          className={`tab ${activeTab === 'behavioral-ai' ? 'active' : ''}`} 
          onClick={() => setActiveTab('behavioral-ai')}
        >
          <Brain size={16} />
          <span>Behavioral AI</span>
          {metrics?.model_trained && (
            <span className="badge badge-blue" style={{ marginLeft: 6 }}>DL</span>
          )}
        </button>
        <button 
          className={`tab ${activeTab === 'guardrails' ? 'active' : ''}`} 
          onClick={() => setActiveTab('guardrails')}
        >
          <Lock size={16} />
          <span>Guardrails</span>
        </button>
        <button 
          className={`tab ${activeTab === 'notifications' ? 'active' : ''}`} 
          onClick={() => setActiveTab('notifications')}
        >
          <Mail size={16} />
          <span>Notifications</span>
        </button>
      </div>

      {activeTab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24 }}>
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Recent Activity</h2>
            </div>
            <div style={{ maxHeight: 480, overflowY: 'auto' }}>
              {activity.map(log => (
                <div key={log.id} className="feed-item">
                  <div className={log.is_anomalous ? 'feed-icon feed-icon-warn' : 'feed-icon feed-icon-ok'}>
                    {log.is_anomalous ? <AlertTriangle size={16} /> : <Activity size={16} />}
                  </div>
                  <div className="feed-body">
                    <div className="feed-name">
                      {log.event_name}
                      <span className="tag" style={{ marginLeft: 8 }}>{log.service}</span>
                    </div>
                    <div className="feed-resource">{log.resource_name || log.resource_arn}</div>
                    {log.is_anomalous && log.anomaly_reason && (
                      <div className="feed-reason">{log.anomaly_reason}</div>
                    )}
                    <div className="feed-time">{timeAgo(log.event_time)}</div>
                  </div>
                </div>
              ))}
              {activity.length === 0 && (
                <div className="empty" style={{ padding: 40 }}>
                  <Activity size={32} style={{ opacity: 0.3, marginBottom: 12 }} />
                  <div>No activity recorded</div>
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div className="card">
              <div className="card-header">
                <h2 className="card-title">Service Usage</h2>
              </div>
              {radarData.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <RadarChart data={radarData.slice(0, 6)}>
                    <PolarGrid stroke="var(--border-default)" strokeWidth={1} />
                    <PolarAngleAxis 
                      dataKey="service" 
                      style={{ fontSize: 11, fill: 'var(--text-secondary)', fontWeight: '500' }}
                      tick={{ fill: '#94a3b8' }}
                    />
                    <PolarRadiusAxis 
                      style={{ fontSize: 10, fill: 'var(--text-muted)' }}
                      tick={{ fill: '#64748b' }}
                    />
                    <Radar 
                      name="Actual Usage" 
                      dataKey="actual" 
                      stroke="#3b82f6" 
                      fill="#3b82f6" 
                      fillOpacity={0.35}
                      strokeWidth={2.5}
                      dot={{ fill: '#3b82f6', r: 4 }}
                    />
                    <Radar 
                      name="Expected" 
                      dataKey="expected" 
                      stroke="#64748b" 
                      fill="#64748b" 
                      fillOpacity={0.15}
                      strokeWidth={2}
                      strokeDasharray="5 5"
                    />
                    <Legend 
                      wrapperStyle={{ fontSize: 11, paddingTop: 12 }}
                      iconType="circle"
                    />
                    <Tooltip 
                      contentStyle={{
                        background: '#17171a',
                        border: '1px solid #3b82f6',
                        borderRadius: '8px',
                        fontSize: '12px',
                        padding: '8px 12px'
                      }}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              ) : (
                <div className="empty" style={{ padding: 40 }}>
                  <BarChart2 size={28} style={{ opacity: 0.3, marginBottom: 8 }} />
                  <div style={{ fontSize: 12 }}>No usage data</div>
                </div>
              )}
            </div>

            <div className="card">
              <div className="card-header">
                <h2 className="card-title">IAM Permissions</h2>
              </div>
              <div className="tag-list">
                {agent.agent.iam_permissions?.map((perm, i) => {
                  const isSensitive = perm.includes('secretsmanager:') || perm.includes('iam:') || perm.includes('kms:')
                  const isDelete = perm.includes('Delete') || perm.includes('delete')
                  const colorClass = isSensitive ? 'text-critical' : isDelete ? 'text-high' : ''
                  return (
                    <span key={i} className={`tag ${colorClass}`}>{perm}</span>
                  )
                })}
                {(!agent.agent.iam_permissions || agent.agent.iam_permissions.length === 0) && (
                  <span className="text-muted" style={{ fontSize: 12 }}>No permissions defined</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'behavioral-ai' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
            <div className="kpi-card">
              <div className="kpi-icon" style={{ background: 'rgba(91,110,245,0.1)' }}>
                <Cpu size={20} style={{ color: 'var(--accent)' }} />
              </div>
              <div className="kpi-value">{fingerprint?.model_version || 'untrained'}</div>
              <div className="kpi-label">Model Version</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-icon" style={{ background: 'rgba(229,182,17,0.1)' }}>
                <TrendingUp size={20} style={{ color: 'var(--risk-medium)' }} />
              </div>
              <div className="kpi-value">{fingerprint?.anomaly_threshold?.toFixed(3) || '—'}</div>
              <div className="kpi-label">Anomaly Threshold</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-icon" style={{ background: 'rgba(91,110,245,0.1)' }}>
                <Activity size={20} style={{ color: 'var(--accent)' }} />
              </div>
              <div className="kpi-value">{fingerprint?.avg_events_per_hour?.toFixed(1) || '—'}</div>
              <div className="kpi-label">Avg Events/Hour</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-icon" style={{ background: 'rgba(247,107,21,0.1)' }}>
                <AlertTriangle size={20} style={{ color: 'var(--risk-high)' }} />
              </div>
              <div className="kpi-value">{fingerprint?.max_events_per_hour || '—'}</div>
              <div className="kpi-label">Peak Events/Hour</div>
            </div>
          </div>

          <div className="alert alert-info" style={{ marginBottom: 24 }}>
            <Info size={18} />
            <span>
              Rate Anomaly Guardrail: The autoencoder includes events/hour as a training feature. Volume spikes over 100 events/hour are flagged independently of API action type.
            </span>
          </div>

          {metrics?.model_trained && metrics?.timeline?.length > 0 ? (
            <div className="card" style={{ marginBottom: 24 }}>
              <div className="card-header">
                <h2 className="card-title">Reconstruction Error Timeline</h2>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Lower is better · Points above threshold are anomalies
                </span>
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={metrics.timeline} margin={{ top: 10, right: 30, bottom: 10, left: 10 }}>
                  <defs>
                    <linearGradient id="errorGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#222226" strokeOpacity={0.5} />
                  <XAxis 
                    dataKey="time" 
                    stroke="#64748b"
                    style={{ fontSize: 11, fill: '#64748b' }}
                    tickFormatter={(val) => new Date(val).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    tickLine={false}
                    axisLine={{ stroke: '#222226' }}
                  />
                  <YAxis 
                    stroke="#64748b"
                    style={{ fontSize: 11, fill: '#64748b' }}
                    tickLine={false}
                    axisLine={{ stroke: '#222226' }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      background: '#17171a', 
                      border: '1px solid #3b82f6', 
                      borderRadius: 8, 
                      fontSize: 12,
                      padding: '12px'
                    }}
                    labelFormatter={(val) => new Date(val).toLocaleString()}
                    formatter={(value, name) => [
                      typeof value === 'number' ? value.toFixed(4) : value, 
                      name === 'reconstruction_error' ? 'Reconstruction Error' : name
                    ]}
                  />
                  {metrics.anomaly_threshold && (
                    <ReferenceLine 
                      y={metrics.anomaly_threshold} 
                      stroke="#f59e0b" 
                      strokeDasharray="5 5" 
                      strokeWidth={2}
                      label={{ 
                        value: `Threshold: ${metrics.anomaly_threshold.toFixed(4)}`, 
                        fill: '#f59e0b', 
                        fontSize: 11, 
                        position: 'right',
                        fontWeight: '600'
                      }}
                    />
                  )}
                  <Area
                    type="monotone"
                    dataKey="reconstruction_error"
                    stroke="#3b82f6"
                    fill="url(#errorGrad)"
                    strokeWidth={2.5}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="reconstruction_error" 
                    stroke="#3b82f6" 
                    strokeWidth={2.5}
                    dot={(props) => {
                      const { cx, cy, payload } = props
                      const color = payload.above_threshold ? '#ef4444' : '#3b82f6'
                      const r = payload.above_threshold ? 5 : 3
                      return (
                        <circle 
                          cx={cx} 
                          cy={cy} 
                          r={r} 
                          fill={color}
                          stroke="#fff"
                          strokeWidth={payload.above_threshold ? 2 : 1}
                        />
                      )
                    }}
                    activeDot={{ r: 6, fill: '#3b82f6', stroke: '#fff', strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
              
              <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, borderTop: '1px solid var(--border-default)' }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Avg Normal Error</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#10b981' }}>
                    {metrics.avg_normal_error?.toFixed(4) || '—'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Avg Anomalous Error</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#ef4444' }}>
                    {metrics.avg_anomalous_error?.toFixed(4) || '—'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Detection Threshold</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#f59e0b' }}>
                    {metrics.anomaly_threshold?.toFixed(4) || '—'}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="card" style={{ marginBottom: 24 }}>
              <div className="empty" style={{ padding: 60 }}>
                <Brain size={48} style={{ opacity: 0.3, marginBottom: 16 }} />
                <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: 'var(--text-primary)' }}>
                  No model trained
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20, maxWidth: 420, textAlign: 'center' }}>
                  Build Fingerprint to train the LSTM autoencoder on this agent's behavioral history
                </div>
                <button className="btn btn-primary btn-sm" onClick={handleBuildFingerprint} disabled={building}>
                  {building ? (
                    <>
                      <div className="spinner" style={{ width: 14, height: 14 }}></div>
                      <span>Training...</span>
                    </>
                  ) : (
                    <>
                      <Brain size={14} />
                      <span>Build Fingerprint</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
            <div className="card">
              <div className="card-header">
                <h2 className="card-title">Service Frequency</h2>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {serviceFreqSorted.map(([service, count]) => (
                  <div key={service}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12 }}>
                      <span className="mono" style={{ color: 'var(--text-primary)' }}>{service}</span>
                      <span style={{ color: 'var(--text-muted)' }}>{count}</span>
                    </div>
                    <div className="progress-track">
                      <div 
                        className="progress-fill" 
                        style={{ 
                          width: `${(count / maxServiceCount) * 100}%`,
                          '--fill-color': 'var(--accent)'
                        }}
                      ></div>
                    </div>
                  </div>
                ))}
                {serviceFreqSorted.length === 0 && (
                  <div className="empty" style={{ padding: 40 }}>
                    <Database size={28} style={{ opacity: 0.3, marginBottom: 8 }} />
                    <div style={{ fontSize: 12 }}>No data</div>
                  </div>
                )}
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <h2 className="card-title">Action Frequency</h2>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {actionFreqSorted.map(([action, count]) => (
                  <div key={action}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12 }}>
                      <span className="mono" style={{ color: 'var(--text-primary)' }}>{action}</span>
                      <span style={{ color: 'var(--text-muted)' }}>{count}</span>
                    </div>
                    <div className="progress-track">
                      <div 
                        className="progress-fill" 
                        style={{ 
                          width: `${(count / maxActionCount) * 100}%`,
                          '--fill-color': 'var(--accent)'
                        }}
                      ></div>
                    </div>
                  </div>
                ))}
                {actionFreqSorted.length === 0 && (
                  <div className="empty" style={{ padding: 40 }}>
                    <Activity size={28} style={{ opacity: 0.3, marginBottom: 8 }} />
                    <div style={{ fontSize: 12 }}>No data</div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Typical Activity Hours (UTC)</h2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(24, 1fr)', gap: 6 }}>
              {Array.from({ length: 24 }, (_, i) => {
                const isTypical = fingerprint?.typical_hours?.includes(i)
                return (
                  <div
                    key={i}
                    style={{
                      width: 32,
                      height: 32,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 5,
                      fontSize: 11,
                      fontWeight: 600,
                      background: isTypical ? 'var(--accent)' : 'var(--elevated)',
                      color: isTypical ? 'white' : 'var(--text-muted)',
                      border: isTypical ? '1px solid var(--accent)' : '1px solid var(--border)'
                    }}
                  >
                    {i}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'intent-vs-actual' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <button className="btn btn-ghost btn-sm" onClick={handleGeneratePolicy}>
              <Lock size={14} />
              <span>Generate Least-Privilege Policy</span>
            </button>
          </div>

          <div className="card">
            <div className="card-header" style={{ marginBottom: '20px' }}>
              <h2 className="card-title">Intent vs Actual Comparison</h2>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Comparing declared intent with observed behavior
              </span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
                <thead>
                  <tr style={{ background: 'var(--bg-elevated)', borderBottom: '2px solid var(--border-default)' }}>
                    <th style={{ padding: '16px 20px', textAlign: 'left', fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', borderRight: '1px solid var(--border-default)' }}>
                      Action
                    </th>
                    <th style={{ padding: '16px 20px', textAlign: 'left', fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', borderRight: '1px solid var(--border-default)' }}>
                      Service
                    </th>
                    <th style={{ padding: '16px 20px', textAlign: 'center', fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', borderRight: '1px solid var(--border-default)', minWidth: '130px' }}>
                      IAM Allowed
                    </th>
                    <th style={{ padding: '16px 20px', textAlign: 'center', fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', borderRight: '1px solid var(--border-default)', minWidth: '130px' }}>
                      Intended
                    </th>
                    <th style={{ padding: '16px 20px', textAlign: 'center', fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', borderRight: '1px solid var(--border-default)', minWidth: '130px' }}>
                      Performed
                    </th>
                    <th style={{ padding: '16px 20px', textAlign: 'center', fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', minWidth: '130px' }}>
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {intentComparison?.comparison?.map((row, i) => (
                    <tr 
                      key={i} 
                      style={{ 
                        background: row.is_concerning ? 'rgba(239, 68, 68, 0.06)' : 'transparent',
                        borderBottom: '1px solid var(--border-default)',
                        transition: 'background 0.15s ease'
                      }}
                      className="table-row-hover"
                    >
                      <td style={{ padding: '16px 20px', fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', borderRight: '1px solid var(--border-default)' }}>
                        <span className="mono">{row.action}</span>
                      </td>
                      <td style={{ padding: '16px 20px', borderRight: '1px solid var(--border-default)' }}>
                        <span className="badge badge-sm" style={{ fontSize: '11px', padding: '4px 10px' }}>{row.service}</span>
                      </td>
                      <td style={{ padding: '16px 20px', textAlign: 'center', borderRight: '1px solid var(--border-default)' }}>
                        {row.in_iam ? (
                          <Check size={20} style={{ color: '#10b981', margin: '0 auto', display: 'inline-block' }} strokeWidth={2.5} />
                        ) : (
                          <X size={20} style={{ color: '#64748b', margin: '0 auto', display: 'inline-block', opacity: 0.4 }} strokeWidth={2} />
                        )}
                      </td>
                      <td style={{ padding: '16px 20px', textAlign: 'center', borderRight: '1px solid var(--border-default)' }}>
                        {row.in_intended ? (
                          <Check size={20} style={{ color: '#3b82f6', margin: '0 auto', display: 'inline-block' }} strokeWidth={2.5} />
                        ) : (
                          <X size={20} style={{ color: '#64748b', margin: '0 auto', display: 'inline-block', opacity: 0.4 }} strokeWidth={2} />
                        )}
                      </td>
                      <td style={{ padding: '16px 20px', textAlign: 'center', borderRight: '1px solid var(--border-default)' }}>
                        {row.performed ? (
                          <Check size={20} style={{ color: '#10b981', margin: '0 auto', display: 'inline-block' }} strokeWidth={2.5} />
                        ) : (
                          <X size={20} style={{ color: '#64748b', margin: '0 auto', display: 'inline-block', opacity: 0.4 }} strokeWidth={2} />
                        )}
                      </td>
                      <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                        {row.is_concerning ? (
                          <span className="badge badge-critical" style={{ fontSize: '11px', padding: '5px 12px', fontWeight: '600' }}>
                            ⚠ Concerning
                          </span>
                        ) : row.in_iam && row.in_intended && row.performed ? (
                          <span className="badge badge-low" style={{ fontSize: '11px', padding: '5px 12px', fontWeight: '600' }}>
                            ✓ Compliant
                          </span>
                        ) : !row.performed ? (
                          <span className="badge badge-neutral" style={{ fontSize: '11px', padding: '5px 12px', fontWeight: '600', opacity: 0.7 }}>
                            Unused
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'blast-radius' && (
        <div>
          {blastRadius && (
            <>
              <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                <div style={{ padding: '8px 14px', background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}>
                  <span style={{ color: 'var(--text-muted)', marginRight: 6 }}>Estimated Impact:</span>
                  <span className={`badge badge-${blastRadius.impact_summary?.estimated_impact_level?.toLowerCase() || 'neutral'}`}>
                    {blastRadius.impact_summary?.estimated_impact_level || 'UNKNOWN'}
                  </span>
                </div>
                <div style={{ padding: '8px 14px', background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}>
                  <span style={{ color: 'var(--text-muted)', marginRight: 6 }}>Total Services:</span>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                    {blastRadius.impact_summary?.total_services || 0}
                  </span>
                </div>
                <div style={{ padding: '8px 14px', background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}>
                  <span style={{ color: 'var(--text-muted)', marginRight: 6 }}>Total Resources:</span>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                    {blastRadius.impact_summary?.total_resources || 0}
                  </span>
                </div>
                {blastRadius.impact_summary?.sensitive_resources_count > 0 && (
                  <div style={{ padding: '8px 14px', background: 'rgba(229,72,77,0.1)', border: '1px solid var(--risk-critical)', borderRadius: 8, fontSize: 12 }}>
                    <span style={{ color: 'var(--text-muted)', marginRight: 6 }}>Sensitive Resources:</span>
                    <span style={{ fontWeight: 600, color: 'var(--risk-critical)' }}>
                      {blastRadius.impact_summary.sensitive_resources_count}
                    </span>
                  </div>
                )}
                {blastRadius.impact_summary?.highest_risk_service && (
                  <div style={{ padding: '8px 14px', background: 'rgba(247,107,21,0.1)', border: '1px solid var(--risk-high)', borderRadius: 8, fontSize: 12 }}>
                    <span style={{ color: 'var(--text-muted)', marginRight: 6 }}>Highest Risk Service:</span>
                    <span className="mono" style={{ fontWeight: 600, color: 'var(--risk-high)' }}>
                      {blastRadius.impact_summary.highest_risk_service}
                    </span>
                  </div>
                )}
              </div>

              {blastRadius.impact_summary?.anomalous_services?.length > 0 && (
                <div className="alert alert-critical" style={{ marginBottom: 16 }}>
                  <AlertTriangle size={18} />
                  <span>
                    Anomalous services detected: {blastRadius.impact_summary.anomalous_services.join(', ')}
                  </span>
                </div>
              )}
            </>
          )}

          <div style={{ height: 540, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)' }}>
            <BlastRadiusGraph 
              nodes={blastRadius?.nodes || []} 
              edges={blastRadius?.edges || []}
              impactSummary={blastRadius?.impact_summary || {}}
            />
          </div>
        </div>
      )}

      {activeTab === 'deviations' && (
        <DeviationTimeline anomalies={anomalies} />
      )}

      {activeTab === 'guardrails' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', alignItems: 'start' }}>
          <div>
            <FingerprintPanel 
              agentId={agentId} 
              fingerprint={fingerprint} 
              onUpdate={(newFp) => setFingerprint(newFp)} 
            />
          </div>
          <div>
            <GuardrailsPanel agentId={agentId} />
          </div>
        </div>
      )}

      {activeTab === 'notifications' && (
        <div className="card" style={{ padding: '24px' }}>
          <EmailNotificationsPanel agentId={agentId} />
        </div>
      )}

      {activeTab === 'risk-events' && (
        <div>
          {riskEvents.length === 0 ? (
            <div className="card">
              <div className="empty" style={{ padding: 80 }}>
                <Shield size={56} style={{ opacity: 0.3, marginBottom: 16 }} />
                <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8, color: 'var(--text-primary)' }}>
                  No risk events detected
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  This agent is operating within expected behavioral boundaries
                </div>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {riskEvents.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).map(event => (
                <div 
                  key={event.id} 
                  className="card" 
                  style={{ 
                    borderLeft: `3px solid ${riskColor(event.risk_level)}`,
                    opacity: event.is_resolved ? 0.5 : 1
                  }}
                >
                  <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', marginBottom: 16 }}>
                    <RiskRing score={event.risk_score} level={event.risk_level} size={72} strokeWidth={6} />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
                        <RiskBadge level={event.risk_level} />
                        {event.triggering_action && (
                          <span className="tag mono">{event.triggering_action}</span>
                        )}
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{timeAgo(event.timestamp)}</span>
                        {event.is_resolved ? (
                          <span className="badge badge-low">Resolved</span>
                        ) : (
                          <button 
                            className="btn btn-ghost btn-sm" 
                            onClick={() => handleResolveRisk(event.id)}
                            style={{ marginLeft: 'auto' }}
                          >
                            <Check size={14} />
                            <span>Resolve</span>
                          </button>
                        )}
                      </div>
                      {event.explanation && (
                        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 14 }}>
                          {event.explanation}
                        </p>
                      )}
                    </div>
                  </div>

                  {event.risk_factors?.length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8, letterSpacing: 0.5 }}>
                        Risk Factors
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {event.risk_factors.map((factor, i) => (
                          <span key={i} className="badge badge-neutral">{factor}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {event.recommendations?.length > 0 && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 10, letterSpacing: 0.5 }}>
                        Recommendations
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {event.recommendations.map((rec, i) => (
                          <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                            <div 
                              style={{ 
                                width: 20, 
                                height: 20, 
                                borderRadius: '50%', 
                                background: 'var(--elevated)', 
                                border: '1px solid var(--border)', 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center',
                                fontSize: 11,
                                fontWeight: 600,
                                color: 'var(--text-muted)',
                                flexShrink: 0
                              }}
                            >
                              {i + 1}
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, paddingTop: 2 }}>
                              {rec}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showPolicyModal && leastPrivilegePolicy && (
        <div className="overlay" onClick={() => setShowPolicyModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 700 }}>
            <div className="modal-head">
              <h2 className="modal-title">Least-Privilege IAM Policy</h2>
              <button className="btn btn-icon" onClick={() => setShowPolicyModal(false)}>
                <X size={18} />
              </button>
            </div>

            <div style={{ marginBottom: 20, padding: '12px 16px', background: 'var(--elevated)', borderRadius: 8, fontSize: 12 }}>
              <span style={{ fontWeight: 600, color: 'var(--risk-low)' }}>
                {leastPrivilegePolicy.reduction_percent}% reduction
              </span>
              <span style={{ color: 'var(--text-muted)', margin: '0 8px' }}>·</span>
              <span style={{ color: 'var(--text-secondary)' }}>
                {leastPrivilegePolicy.removed_permissions?.length || 0} permissions removed
              </span>
            </div>

            {leastPrivilegePolicy.services_used?.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8 }}>
                  Services Used
                </div>
                <div className="tag-list">
                  {leastPrivilegePolicy.services_used.map((svc, i) => (
                    <span key={i} className="tag">{svc}</span>
                  ))}
                </div>
              </div>
            )}

            {leastPrivilegePolicy.removed_permissions?.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8 }}>
                  Permissions to Remove
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {leastPrivilegePolicy.removed_permissions.map((perm, i) => (
                    <span key={i} className="badge badge-critical" style={{ fontSize: 11 }}>{perm}</span>
                  ))}
                </div>
              </div>
            )}

            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                  Policy JSON
                </div>
                <button className="btn btn-ghost btn-sm" onClick={handleCopyPolicy}>
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <pre 
                className="mono" 
                style={{ 
                  background: 'var(--bg)', 
                  border: '1px solid var(--border)', 
                  borderRadius: 8, 
                  padding: 16, 
                  fontSize: 11, 
                  overflowX: 'auto',
                  maxHeight: 300,
                  overflowY: 'auto',
                  lineHeight: 1.6
                }}
              >
                {JSON.stringify(leastPrivilegePolicy.policy, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
