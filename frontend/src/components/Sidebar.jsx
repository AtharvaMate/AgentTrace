import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Plus, Zap, Shield, Activity, GitBranch, ScanSearch } from 'lucide-react'

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/register',  icon: Plus,            label: 'Register Agent' },
  { to: '/simulate',  icon: Zap,             label: 'Simulate Event' },
]

const statusItems = [
  { icon: Shield,    label: 'Risk Engine',  pill: 'on',   pillText: 'on' },
  { icon: Activity,  label: 'CloudTrail',   pill: 'live', pillText: 'live' },
  { icon: GitBranch, label: 'Blast Radius', pill: 'ai',   pillText: 'ai' },
]

export default function Sidebar() {
  return (
    <nav className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">
          <ScanSearch size={16} strokeWidth={2.2} />
        </div>
        <div>
          <div className="sidebar-logo-text">AgentTrace</div>
          <div className="sidebar-logo-sub">Security Monitor</div>
        </div>
      </div>

      <div className="sidebar-nav">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
          >
            <Icon size={15} strokeWidth={2} />
            {label}
          </NavLink>
        ))}

        <div className="sidebar-divider" style={{ margin: '10px 0' }} />

        <div className="sidebar-status-row">
          {statusItems.map(({ icon: Icon, label, pill, pillText }) => (
            <div key={label} className="sidebar-status-item">
              <span className="sidebar-status-item-label">
                <Icon size={14} strokeWidth={1.8} />
                {label}
              </span>
              <span className={`status-pill ${pill}`}>{pillText}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="sidebar-footer">
        <div className="sidebar-footer-text">
          <div className="status-dot live" />
          All systems operational
        </div>
        <div style={{ marginTop: '5px', fontSize: '12px', color: 'var(--text-muted)' }}>
          us-east-1 · mock mode
        </div>
      </div>
    </nav>
  )
}
