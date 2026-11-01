import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { AlertTriangle, Clock, Shield } from 'lucide-react'

export default function DeviationTimeline({ anomalies = [] }) {
  const timelineData = anomalies.reduce((acc, log) => {
    const date = new Date(log.event_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    const existing = acc.find(item => item.date === date)
    if (existing) {
      existing.count += 1
      existing.events.push(log)
    } else {
      acc.push({ date, count: 1, events: [log] })
    }
    return acc
  }, [])

  timelineData.sort((a, b) => new Date(a.events[0].event_time) - new Date(b.events[0].event_time))

  const deviationTypes = {
    service: new Set(),
    action: new Set(),
    time: new Set(),
  }

  anomalies.forEach(log => {
    if (log.anomaly_reason?.includes('service')) deviationTypes.service.add(log.event_name)
    if (log.anomaly_reason?.includes('action')) deviationTypes.action.add(log.event_name)
    if (log.anomaly_reason?.includes('hour') || log.anomaly_reason?.includes('time')) deviationTypes.time.add(log.event_name)
  })

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div className="card-sm">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Total Deviations</span>
            <AlertTriangle size={16} color="var(--risk-high)" />
          </div>
          <div style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)' }}>{anomalies.length}</div>
        </div>

        <div className="card-sm">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Unauthorized Services</span>
            <Shield size={16} color="var(--risk-critical)" />
          </div>
          <div style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)' }}>{deviationTypes.service.size}</div>
        </div>

        <div className="card-sm">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Unexpected Actions</span>
            <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: 'var(--risk-high)' }} />
          </div>
          <div style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)' }}>{deviationTypes.action.size}</div>
        </div>

        <div className="card-sm">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Off-Hours Activity</span>
            <Clock size={16} color="var(--risk-medium)" />
          </div>
          <div style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)' }}>{deviationTypes.time.size}</div>
        </div>
      </div>

      {timelineData.length > 0 ? (
        <div className="card" style={{ padding: '20px', marginBottom: '24px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '16px', color: 'var(--text-primary)' }}>
            Deviation Frequency Over Time
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={timelineData} margin={{ top: 10, right: 30, bottom: 10, left: 10 }}>
              <defs>
                <linearGradient id="deviationGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#dc2626" stopOpacity={0.9} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#222226" strokeOpacity={0.5} vertical={false} />
              <XAxis 
                dataKey="date" 
                stroke="#64748b"
                style={{ fontSize: 11, fill: '#64748b' }}
                tickLine={false}
                axisLine={{ stroke: '#222226' }}
              />
              <YAxis 
                stroke="#64748b"
                style={{ fontSize: 11, fill: '#64748b' }}
                tickLine={false}
                axisLine={{ stroke: '#222226' }}
                label={{ value: 'Anomalies', angle: -90, position: 'insideLeft', style: { fill: '#64748b', fontSize: 11 } }}
              />
              <Tooltip 
                contentStyle={{ 
                  background: '#17171a', 
                  border: '1px solid #ef4444', 
                  borderRadius: 8, 
                  fontSize: 12,
                  padding: '12px'
                }}
                labelStyle={{ color: '#e2e8f0', fontWeight: '600', marginBottom: '8px' }}
                cursor={{ fill: 'rgba(239, 68, 68, 0.1)' }}
              />
              <Bar 
                dataKey="count" 
                fill="url(#deviationGrad)" 
                radius={[8, 8, 0, 0]}
                maxBarSize={60}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
          <div style={{ fontSize: '48px', marginBottom: '8px' }}>✓</div>
          <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>No deviations detected</div>
        </div>
      )}

      {anomalies.length > 0 && (
        <div className="card" style={{ marginTop: '20px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '16px', color: 'var(--text-primary)' }}>
            Recent Deviation Events
          </h3>
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            {anomalies.slice(0, 20).map((log, idx) => (
              <div 
                key={idx}
                style={{ 
                  padding: '12px', 
                  borderBottom: idx < 19 ? '1px solid var(--border-default)' : 'none',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <AlertTriangle size={14} color="var(--risk-high)" />
                    <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>
                      {log.event_name}
                    </span>
                    <span className="badge badge-sm" style={{ background: 'var(--blue-bg)', color: 'var(--blue)', border: '1px solid var(--blue-border)' }}>
                      {log.service}
                    </span>
                  </div>
                  {log.anomaly_reason && (
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '22px' }}>
                      {log.anomaly_reason}
                    </div>
                  )}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    {new Date(log.event_time).toLocaleString('en-US', { 
                      month: 'short', 
                      day: 'numeric', 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
