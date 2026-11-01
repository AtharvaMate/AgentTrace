import { useState, useEffect } from 'react'
import { Bot, AlertTriangle, Activity, ShieldAlert, Zap, TrendingUp } from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import { getAgents, getDashboardStats, getTimeline, getActivity } from '../api/client'
import AgentCard from '../components/AgentCard'
import ActivityFeed from '../components/ActivityFeed'

export default function Dashboard() {
  const [agents, setAgents]         = useState([])
  const [stats, setStats]           = useState(null)
  const [globalFeed, setGlobalFeed] = useState([])
  const [timeline, setTimeline]     = useState([])
  const [loading, setLoading]       = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    const fetchAll = async () => {
      try {
        setLoading(true)
        const [agentsRes, statsRes] = await Promise.all([getAgents(), getDashboardStats()])
        setAgents(agentsRes)
        setStats(statsRes)

        if (agentsRes.length > 0) {
          const logs = []
          for (const summary of agentsRes) {
            const res = await getActivity(summary.agent.id, 20)
            logs.push(...res)
          }
          logs.sort((a, b) => new Date(b.event_time) - new Date(a.event_time))
          
          const anomalousLogs = logs.filter(log => log.is_anomalous)
          const normalLogs = logs.filter(log => !log.is_anomalous)
          const combinedFeed = [...anomalousLogs.slice(0, 10), ...normalLogs.slice(0, 10)]
          combinedFeed.sort((a, b) => new Date(b.event_time) - new Date(a.event_time))
          setGlobalFeed(combinedFeed.slice(0, 20))

          const tlRes = await getTimeline(agentsRes[0].agent.id)
          setTimeline(tlRes)
        }
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchAll()

    const handleSearch = (e) => setSearchQuery(e.detail.query)
    window.addEventListener('agent-search', handleSearch)
    return () => window.removeEventListener('agent-search', handleSearch)
  }, [])

  const filteredAgents = searchQuery.trim()
    ? agents.filter(a =>
        a.agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.agent.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.latest_risk_level?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : agents

  if (loading) {
    return (
      <div className="loading-spinner">
        <div className="spinner" />
        <span>Loading dashboard…</span>
      </div>
    )
  }

  const criticalAgents = agents.filter(s => s.latest_risk_level === 'CRITICAL')

  return (
    <div>
      <div className="page-header">
        <h1>Overview</h1>
        <p>Monitoring {agents.length} AI agent{agents.length !== 1 ? 's' : ''} across your AWS environment</p>
      </div>

      {/* Stats Row */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon-row">
            <div className="stat-icon orange"><Bot size={16} strokeWidth={2} /></div>
          </div>
          <div className="stat-value">{stats?.total_agents ?? 0}</div>
          <div className="stat-label">Monitored Agents</div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-row">
            <div className="stat-icon red"><ShieldAlert size={16} strokeWidth={2} /></div>
          </div>
          <div className="stat-value" style={{ color: (stats?.critical_agents ?? 0) > 0 ? 'var(--critical)' : undefined }}>
            {stats?.critical_agents ?? 0}
          </div>
          <div className="stat-label">Critical Alerts</div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-row">
            <div className="stat-icon yellow"><AlertTriangle size={16} strokeWidth={2} /></div>
          </div>
          <div className="stat-value" style={{ color: (stats?.high_risk_agents ?? 0) > 0 ? 'var(--warning)' : undefined }}>
            {stats?.high_risk_agents ?? 0}
          </div>
          <div className="stat-label">High Risk Agents</div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-row">
            <div className="stat-icon green"><Activity size={16} strokeWidth={2} /></div>
          </div>
          <div className="stat-value">{stats?.total_events_today ?? 0}</div>
          <div className="stat-label">Events (24h)</div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-row">
            <div className="stat-icon red"><Zap size={16} strokeWidth={2} /></div>
          </div>
          <div className="stat-value" style={{ color: (stats?.total_anomalies ?? 0) > 0 ? 'var(--danger)' : 'var(--success)' }}>
            {stats?.total_anomalies ?? 0}
          </div>
          <div className="stat-label">Total Anomalies</div>
        </div>
      </div>

      {/* Critical Alert Banner */}
      {criticalAgents.length > 0 && (
        <div className="section">
          <div className="alert alert-danger">
            <AlertTriangle size={15} strokeWidth={2.5} style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <strong>Critical risk detected</strong> — {criticalAgents.length} agent{criticalAgents.length > 1 ? 's' : ''} showing
              critical behavioral anomalies: <strong>{criticalAgents.map(s => s.agent.name).join(', ')}</strong>.
              Immediate investigation required.
            </div>
          </div>
        </div>
      )}

      {/* Activity Timeline */}
      {timeline.length > 0 && (
        <div className="section">
          <div className="card">
            <div className="card-header">
              <div className="card-title">
                <TrendingUp size={15} strokeWidth={2} style={{ color: 'var(--accent)' }} />
                Activity Timeline
              </div>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>14-day window · normal vs anomalous</span>
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={timeline} margin={{ top: 10, right: 30, bottom: 10, left: 0 }}>
                <defs>
                  <linearGradient id="normalGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="anomGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#ef4444" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#222226" vertical={false} strokeOpacity={0.5} />
                <XAxis 
                  dataKey="date" 
                  stroke="#64748b" 
                  tick={{ fontSize: 11, fill: '#64748b' }} 
                  tickLine={false} 
                  axisLine={{ stroke: '#222226' }}
                />
                <YAxis 
                  stroke="#64748b" 
                  tick={{ fontSize: 11, fill: '#64748b' }} 
                  tickLine={false} 
                  axisLine={{ stroke: '#222226' }}
                />
                <Tooltip
                  contentStyle={{
                    background: '#17171a',
                    border: '1px solid #3b82f6',
                    borderRadius: '8px',
                    fontSize: '13px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                    padding: '12px'
                  }}
                  labelStyle={{ color: '#e2e8f0', fontWeight: '600', marginBottom: '8px' }}
                  itemStyle={{ color: '#f0f0f2', padding: '4px 0' }}
                />
                <Legend 
                  wrapperStyle={{ 
                    fontSize: '12px', 
                    color: '#8b8b96', 
                    paddingTop: '12px',
                    fontWeight: '500'
                  }} 
                  iconType="circle"
                />
                <Area 
                  type="monotone" 
                  dataKey="normal" 
                  stroke="#3b82f6" 
                  fill="url(#normalGrad)" 
                  strokeWidth={2.5} 
                  name="Normal Events"
                  dot={{ fill: '#3b82f6', r: 3 }}
                  activeDot={{ r: 5, fill: '#3b82f6', stroke: '#fff', strokeWidth: 2 }}
                />
                <Area 
                  type="monotone" 
                  dataKey="anomalous" 
                  stroke="#ef4444" 
                  fill="url(#anomGrad)" 
                  strokeWidth={2.5} 
                  name="Anomalous Events"
                  dot={{ fill: '#ef4444', r: 3 }}
                  activeDot={{ r: 5, fill: '#ef4444', stroke: '#fff', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Agent Grid + Feed */}
      <div className="grid-2" style={{ alignItems: 'start' }}>
        <div>
          <div className="section-title">
            Agent Registry
            {searchQuery && (
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
                {filteredAgents.length} of {agents.length}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {filteredAgents.length > 0
              ? filteredAgents.map(summary => (
                  <AgentCard key={summary.agent.id} summary={summary} />
                ))
              : (
                <div className="empty-state" style={{ padding: '40px' }}>
                  <p>No agents match "{searchQuery}"</p>
                </div>
              )
            }
          </div>
        </div>

        <div>
          <div className="section-title">Live Activity Feed</div>
          <div className="card" style={{ padding: '8px 12px' }}>
            <ActivityFeed logs={globalFeed} maxItems={20} />
          </div>
        </div>
      </div>
    </div>
  )
}
