import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { AlertTriangle, Bell } from 'lucide-react'
import { getDashboardStats } from '../api/client'

const PAGE_TITLES = {
  '/dashboard': { title: 'Dashboard',       sub: 'Real-time AI agent behavioral monitoring' },
  '/register':  { title: 'Register Agent',  sub: 'Add a new agent to the monitoring registry' },
  '/simulate':  { title: 'Simulate Event',  sub: 'Trigger events to test detection logic' },
}

export default function TopBar() {
  const location = useLocation()
  const [stats, setStats] = useState(null)
  const [time, setTime]   = useState(new Date())

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await getDashboardStats()
        setStats(res)
      } catch {}
    }
    fetchStats()
    const dataInterval = setInterval(fetchStats, 30000)
    const timeInterval = setInterval(() => setTime(new Date()), 1000)
    return () => { clearInterval(dataInterval); clearInterval(timeInterval) }
  }, [])

  const pageInfo = PAGE_TITLES[location.pathname] ||
    { title: 'Agent Detail', sub: 'Behavioral analysis and risk profiling' }

  return (
    <header className="topbar">
      <div>
        <div className="topbar-title">{pageInfo.title}</div>
        <div className="topbar-sub">{pageInfo.sub}</div>
      </div>

      <div className="topbar-actions">
        {stats && stats.critical_agents > 0 && (
          <div className="topbar-badge critical">
            <AlertTriangle size={11} strokeWidth={2.5} />
            {stats.critical_agents} critical
          </div>
        )}
        {stats && stats.high_risk_agents > 0 && (
          <div className="topbar-badge warning">
            <Bell size={11} strokeWidth={2.5} />
            {stats.high_risk_agents} high risk
          </div>
        )}
        {stats && stats.critical_agents === 0 && stats.high_risk_agents === 0 && (
          <div className="topbar-badge success">
            All clear
          </div>
        )}
        <div className="topbar-time">
          {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </div>
      </div>
    </header>
  )
}
