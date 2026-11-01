import { useState, useEffect } from 'react'
import { Mail, Plus, Trash2, Bell, BellOff, Send, CheckCircle, AlertTriangle, RefreshCw, X } from 'lucide-react'
import {
  getNotificationSettings,
  createNotificationSetting,
  deleteNotificationSetting,
  toggleNotificationSetting,
  sendTestEmail
} from '../api/client'

const RISK_LEVELS = [
  { key: 'notify_on_critical', label: 'Critical', color: '#dc2626', bg: 'rgba(220,38,38,0.1)' },
  { key: 'notify_on_high',     label: 'High',     color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
  { key: 'notify_on_medium',   label: 'Medium',   color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  { key: 'notify_on_low',      label: 'Low',      color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
]

function AddEmailForm({ agentId, onAdded }) {
  const [email, setEmail] = useState('')
  const [levels, setLevels] = useState({
    notify_on_critical: true,
    notify_on_high: true,
    notify_on_medium: false,
    notify_on_low: false,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!email.trim()) return
    setSaving(true)
    setError(null)
    try {
      await createNotificationSetting(agentId, { email_address: email.trim(), ...levels })
      setEmail('')
      onAdded()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to add email')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="alert@example.com"
          required
          style={{
            flex: 1,
            padding: '10px 14px',
            borderRadius: '8px',
            border: '1px solid var(--border-default)',
            background: 'var(--bg-elevated)',
            color: 'var(--text-primary)',
            fontSize: '13px',
            outline: 'none',
          }}
        />
        <button
          type="submit"
          disabled={saving || !email.trim()}
          className="btn btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
        >
          {saving ? <RefreshCw size={14} className="spin" /> : <Plus size={14} />}
          Add Email
        </button>
      </div>

      {/* Risk level toggles */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
        {RISK_LEVELS.map(({ key, label, color, bg }) => (
          <button
            key={key}
            type="button"
            onClick={() => setLevels(prev => ({ ...prev, [key]: !prev[key] }))}
            style={{
              padding: '4px 12px',
              borderRadius: '20px',
              border: `1px solid ${levels[key] ? color : 'var(--border-default)'}`,
              background: levels[key] ? bg : 'transparent',
              color: levels[key] ? color : 'var(--text-muted)',
              fontSize: '11px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
        Select which risk levels trigger email alerts
      </p>

      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px', color: '#ef4444', fontSize: '12px' }}>
          <X size={12} />
          {error}
        </div>
      )}
    </form>
  )
}

function EmailRow({ setting, onDeleted, onToggled }) {
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [toggling, setToggling] = useState(false)

  async function handleTest() {
    setTesting(true)
    setTestResult(null)
    try {
      await sendTestEmail(setting.agent_id, setting.email_address)
      setTestResult({ success: true, msg: 'Test email sent!' })
    } catch (err) {
      setTestResult({ success: false, msg: err.response?.data?.detail || 'Failed — check SMTP config' })
    } finally {
      setTesting(false)
      setTimeout(() => setTestResult(null), 4000)
    }
  }

  async function handleToggle() {
    setToggling(true)
    try {
      await toggleNotificationSetting(setting.id)
      onToggled()
    } finally {
      setToggling(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      await deleteNotificationSetting(setting.id)
      onDeleted()
    } finally {
      setDeleting(false)
    }
  }

  const activeLevels = RISK_LEVELS.filter(({ key }) => setting[key])

  return (
    <div style={{
      padding: '16px',
      borderRadius: '10px',
      border: `1px solid ${setting.enabled ? 'var(--border-light)' : 'var(--border-default)'}`,
      background: setting.enabled ? 'var(--bg-card)' : 'var(--bg-elevated)',
      opacity: setting.enabled ? 1 : 0.65,
      transition: 'all 0.2s ease',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
        {/* Mail icon */}
        <div style={{
          width: '38px', height: '38px', borderRadius: '8px', flexShrink: 0,
          background: setting.enabled ? 'rgba(59,130,246,0.1)' : 'var(--bg-elevated)',
          border: `1px solid ${setting.enabled ? 'rgba(59,130,246,0.25)' : 'var(--border-default)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Mail size={16} style={{ color: setting.enabled ? '#3b82f6' : 'var(--text-muted)' }} />
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '6px' }}>
            {setting.email_address}
          </div>

          {/* Active levels */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
            {activeLevels.length > 0 ? activeLevels.map(({ key, label, color, bg }) => (
              <span key={key} style={{
                padding: '2px 8px', borderRadius: '20px', fontSize: '10px', fontWeight: '600',
                background: bg, color, border: `1px solid ${color}40`,
              }}>
                {label}
              </span>
            )) : (
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>No levels selected</span>
            )}
          </div>

          {/* Stats row */}
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', gap: '12px' }}>
            <span>Sent: {setting.notification_count}</span>
            {setting.last_notification_sent && (
              <span>Last: {new Date(setting.last_notification_sent).toLocaleDateString()}</span>
            )}
          </div>

          {/* Test result */}
          {testResult && (
            <div style={{
              marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px',
              fontSize: '12px', color: testResult.success ? '#10b981' : '#ef4444',
            }}>
              {testResult.success ? <CheckCircle size={12} /> : <AlertTriangle size={12} />}
              {testResult.msg}
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '6px', flexShrink: 0, alignItems: 'center' }}>
          <button
            onClick={handleTest}
            disabled={testing}
            title="Send test email"
            style={{
              padding: '6px 10px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer',
              border: '1px solid var(--border-default)', background: 'var(--bg-elevated)',
              color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px',
              transition: 'all 0.15s ease',
            }}
          >
            {testing ? <RefreshCw size={12} className="spin" /> : <Send size={12} />}
            Test
          </button>

          <button
            onClick={handleToggle}
            disabled={toggling}
            title={setting.enabled ? 'Disable' : 'Enable'}
            style={{
              padding: '6px 10px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer',
              border: `1px solid ${setting.enabled ? 'rgba(16,185,129,0.4)' : 'var(--border-default)'}`,
              background: setting.enabled ? 'rgba(16,185,129,0.08)' : 'var(--bg-elevated)',
              color: setting.enabled ? '#10b981' : 'var(--text-muted)',
              display: 'flex', alignItems: 'center', gap: '4px',
            }}
          >
            {toggling ? <RefreshCw size={12} className="spin" /> : setting.enabled ? <Bell size={12} /> : <BellOff size={12} />}
            {setting.enabled ? 'On' : 'Off'}
          </button>

          <button
            onClick={handleDelete}
            disabled={deleting}
            title="Remove"
            style={{
              padding: '6px 8px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer',
              border: '1px solid var(--border-default)', background: 'var(--bg-elevated)',
              color: 'var(--danger)', display: 'flex', alignItems: 'center',
            }}
          >
            {deleting ? <RefreshCw size={12} className="spin" /> : <Trash2 size={12} />}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function EmailNotificationsPanel({ agentId }) {
  const [settings, setSettings] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [smtpConfigured, setSmtpConfigured] = useState(null)

  useEffect(() => { loadSettings() }, [agentId])

  async function loadSettings() {
    try {
      const data = await getNotificationSettings(agentId)
      setSettings(data)
      // If no SMTP error, treat as configured (backend logs will show)
      setSmtpConfigured(true)
    } catch (err) {
      if (err.response?.status === 404) setSettings([])
      setSmtpConfigured(false)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <div className="spinner" />
        <p style={{ marginTop: '12px', color: 'var(--text-muted)', fontSize: '13px' }}>Loading notification settings...</p>
      </div>
    )
  }

  const enabledCount = settings.filter(s => s.enabled).length

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
        <div>
          <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '4px' }}>
            Email Alerts
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            {settings.length === 0
              ? 'No recipients configured'
              : `${enabledCount} of ${settings.length} active`}
          </p>
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          className="btn btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <Plus size={14} />
          Add Recipient
        </button>
      </div>

      {/* SMTP Warning Banner */}
      <div style={{
        padding: '14px 16px', borderRadius: '10px', marginBottom: '20px',
        border: '1px solid rgba(245,158,11,0.3)',
        background: 'rgba(245,158,11,0.06)',
        display: 'flex', gap: '12px', alignItems: 'flex-start',
      }}>
        <AlertTriangle size={16} style={{ color: '#f59e0b', flexShrink: 0, marginTop: '1px' }} />
        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
          <span style={{ fontWeight: '600', color: '#f59e0b', display: 'block', marginBottom: '4px' }}>
            SMTP Configuration Required
          </span>
          Set the following environment variables in your <code style={{ background: 'var(--bg-elevated)', padding: '1px 4px', borderRadius: '3px' }}>.env</code> file to enable email delivery:
          <div style={{
            marginTop: '8px', padding: '10px 12px', borderRadius: '6px',
            background: 'var(--bg-elevated)', fontFamily: 'monospace', fontSize: '11px',
            color: 'var(--text-primary)', lineHeight: '1.8',
          }}>
            SMTP_HOST=smtp.gmail.com<br />
            SMTP_PORT=587<br />
            SMTP_USER=your@gmail.com<br />
            SMTP_PASSWORD=your-app-password<br />
            SMTP_FROM=your@gmail.com
          </div>
          <span style={{ marginTop: '6px', display: 'block', color: 'var(--text-muted)' }}>
            For Gmail, use an App Password (not your regular password). 
            Even without SMTP, alert settings are saved and emails are logged to the console.
          </span>
        </div>
      </div>

      {/* Add Email Form */}
      {showForm && (
        <div style={{
          padding: '16px', borderRadius: '10px', marginBottom: '20px',
          border: '1px solid var(--border-light)', background: 'var(--bg-card)',
        }}>
          <div style={{ fontSize: '13px', fontWeight: '600', marginBottom: '12px', color: 'var(--text-primary)' }}>
            Add Alert Recipient
          </div>
          <AddEmailForm
            agentId={agentId}
            onAdded={() => { loadSettings(); setShowForm(false) }}
          />
        </div>
      )}

      {/* How it Works */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '24px',
      }}>
        {[
          { icon: Bell, color: '#3b82f6', title: 'Anomaly Detected', desc: 'Risk engine flags suspicious agent behavior in the live feed' },
          { icon: AlertTriangle, color: '#f59e0b', title: 'Risk Scored', desc: 'Action is scored as Critical, High, Medium, or Low severity' },
          { icon: Mail, color: '#10b981', title: 'Alert Sent', desc: 'Email dispatched to all recipients subscribed to that risk level' },
        ].map(({ icon: Icon, color, title, desc }) => (
          <div key={title} style={{
            padding: '14px', borderRadius: '8px',
            border: '1px solid var(--border-default)',
            background: 'var(--bg-elevated)',
          }}>
            <div style={{
              width: '32px', height: '32px', borderRadius: '6px', marginBottom: '10px',
              background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon size={16} style={{ color }} />
            </div>
            <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '4px' }}>{title}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.5' }}>{desc}</div>
          </div>
        ))}
      </div>

      {/* Recipients List */}
      {settings.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 20px', borderRadius: '10px', border: '1px dashed var(--border-default)' }}>
          <Mail size={40} strokeWidth={1} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
          <p style={{ fontSize: '15px', fontWeight: '600', marginBottom: '6px' }}>No Recipients Yet</p>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>
            Add an email address to receive alerts when this agent behaves anomalously
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="btn btn-primary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Plus size={14} />
            Add First Recipient
          </button>
        </div>
      ) : (
        <div>
          <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '12px' }}>
            Recipients ({settings.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {settings.map(setting => (
              <EmailRow
                key={setting.id}
                setting={setting}
                onDeleted={loadSettings}
                onToggled={loadSettings}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
