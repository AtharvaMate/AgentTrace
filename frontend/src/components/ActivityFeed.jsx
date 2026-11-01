import { AlertTriangle, Activity } from 'lucide-react'

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1)  return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export default function ActivityFeed({ logs = [], maxItems = 15 }) {
  if (!logs.length) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">
          <Activity size={36} strokeWidth={1.5} />
        </div>
        <p>No activity logs yet</p>
      </div>
    )
  }

  return (
    <div className="activity-feed">
      {logs.slice(0, maxItems).map((log) => (
        <div key={log.id} className="activity-item">
          <div className={`activity-icon ${log.is_anomalous ? 'anomalous' : 'normal'}`}>
            {log.is_anomalous
              ? <AlertTriangle size={13} strokeWidth={2.5} />
              : <Activity size={13} strokeWidth={1.8} />
            }
          </div>
          <div className="activity-main">
            <div className="activity-event">
              {log.event_name}
              <span className="service-tag">{log.service}</span>
            </div>
            <div className="activity-resource">
              {log.resource_name || log.resource_arn || 'Unknown resource'}
            </div>
            {log.is_anomalous && log.anomaly_reason && (
              <div className="activity-reason">{log.anomaly_reason}</div>
            )}
          </div>
          <div className="activity-time">{timeAgo(log.event_time)}</div>
        </div>
      ))}
    </div>
  )
}
