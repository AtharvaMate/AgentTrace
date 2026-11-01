import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Bot, ArrowLeft } from 'lucide-react'
import { createAgent } from '../api/client'

const AWS_SERVICES = ['s3', 'dynamodb', 'lambda', 'rds', 'secretsmanager', 'iam', 'glue',
  'ec2', 'cloudformation', 'bedrock', 'sqs', 'kms', 'sns', 'ecs', 'ecr']

const COMMON_ACTIONS = ['GetObject', 'PutObject', 'ListBucket', 'DeleteObject', 'GetItem',
  'PutItem', 'Query', 'Scan', 'InvokeFunction', 'GetSecretValue', 'StartJobRun',
  'CreateStack', 'UpdateStack', 'DescribeInstances', 'InvokeModel', 'SendMessage']

const COMMON_PERMS = ['s3:GetObject', 's3:PutObject', 's3:ListBucket', 's3:DeleteObject',
  'dynamodb:GetItem', 'dynamodb:PutItem', 'dynamodb:Query', 'lambda:InvokeFunction',
  'secretsmanager:GetSecretValue', 'iam:GetRole', 'iam:CreateRole',
  'glue:StartJobRun', 'ec2:DescribeInstances', 'bedrock:InvokeModel']

export default function RegisterAgent() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    name: '',
    purpose: '',
    iam_role: '',
    owner: '',
    environment: 'development',
    expected_services: [],
    expected_actions: [],
    iam_permissions: [],
  })

  const toggle = (field, value) => {
    setForm(f => ({
      ...f,
      [field]: f[field].includes(value)
        ? f[field].filter(x => x !== value)
        : [...f[field], value],
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name || !form.purpose || !form.iam_role || !form.owner) {
      setError('Please fill in all required fields.')
      return
    }
    setError('')
    setLoading(true)
    try {
      await createAgent(form)
      setSuccess(true)
      setTimeout(() => navigate('/dashboard'), 2000)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create agent. Make sure the backend is running.')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">✅</div>
        <h2 style={{ color: 'var(--success)', fontSize: '18px', fontWeight: '700' }}>Agent Registered!</h2>
        <p>Redirecting to dashboard...</p>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '720px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/dashboard')}>
          <ArrowLeft size={14} /> Back
        </button>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: '700' }}>Register New Agent</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '2px' }}>
            Add an AI agent to AgentTrace monitoring
          </p>
        </div>
      </div>

      {error && <div className="alert alert-danger" style={{ marginBottom: '20px' }}><span>⚠</span> {error}</div>}

      <form onSubmit={handleSubmit} id="register-agent-form">
        <div className="card" style={{ marginBottom: '20px' }}>
          <div className="card-title" style={{ marginBottom: '16px' }}>🤖 Agent Identity</div>

          <div className="form-group">
            <label className="form-label">Agent Name *</label>
            <input id="agent-name" className="form-input" placeholder="e.g. Sales Report Agent"
              value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>

          <div className="form-group">
            <label className="form-label">Purpose / Description *</label>
            <textarea id="agent-purpose" className="form-input" rows={3}
              placeholder="Describe what this agent is designed to do..."
              value={form.purpose} onChange={e => setForm(f => ({ ...f, purpose: e.target.value }))}
              style={{ resize: 'vertical' }} />
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">IAM Role ARN *</label>
              <input id="agent-iam-role" className="form-input" placeholder="arn:aws:iam::123456789:role/MyRole"
                value={form.iam_role} onChange={e => setForm(f => ({ ...f, iam_role: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Owner / Team *</label>
              <input id="agent-owner" className="form-input" placeholder="e.g. data-engineering"
                value={form.owner} onChange={e => setForm(f => ({ ...f, owner: e.target.value }))} />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Environment</label>
            <select id="agent-environment" className="form-input"
              value={form.environment} onChange={e => setForm(f => ({ ...f, environment: e.target.value }))}>
              <option value="development">Development</option>
              <option value="staging">Staging</option>
              <option value="production">Production</option>
            </select>
          </div>
        </div>

        <div className="card" style={{ marginBottom: '20px' }}>
          <div className="card-title" style={{ marginBottom: '12px' }}>☁️ Expected AWS Services</div>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
            Select the AWS services this agent is designed to use (for behavioral baseline)
          </p>
          <div className="tag-list">
            {AWS_SERVICES.map(svc => (
              <button key={svc} type="button"
                className={`tag ${form.expected_services.includes(svc) ? 'tag-blue' : 'tag-gray'}`}
                style={{ cursor: 'pointer', fontSize: '12px', padding: '5px 12px' }}
                onClick={() => toggle('expected_services', svc)}>
                {form.expected_services.includes(svc) ? '✓ ' : ''}{svc}
              </button>
            ))}
          </div>
        </div>

        <div className="card" style={{ marginBottom: '20px' }}>
          <div className="card-title" style={{ marginBottom: '12px' }}>⚡ Expected Actions</div>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
            Select the AWS API actions this agent is authorized to perform
          </p>
          <div className="tag-list">
            {COMMON_ACTIONS.map(action => (
              <button key={action} type="button"
                className={`tag ${form.expected_actions.includes(action) ? 'tag-green' : 'tag-gray'}`}
                style={{ cursor: 'pointer', fontSize: '12px', padding: '5px 12px' }}
                onClick={() => toggle('expected_actions', action)}>
                {form.expected_actions.includes(action) ? '✓ ' : ''}{action}
              </button>
            ))}
          </div>
        </div>

        <div className="card" style={{ marginBottom: '24px' }}>
          <div className="card-title" style={{ marginBottom: '12px' }}>🔐 IAM Permissions</div>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
            Select all IAM permissions granted to this agent (helps detect over-provisioning)
          </p>
          <div className="tag-list">
            {COMMON_PERMS.map(perm => {
              const isSensitive = perm.includes('secretsmanager') || perm.includes('iam:Create') || perm.includes('Delete')
              return (
                <button key={perm} type="button"
                  className={`tag ${form.iam_permissions.includes(perm) ? (isSensitive ? 'tag-red' : 'tag-yellow') : 'tag-gray'}`}
                  style={{ cursor: 'pointer', fontSize: '11px', padding: '4px 10px' }}
                  onClick={() => toggle('iam_permissions', perm)}>
                  {form.iam_permissions.includes(perm) ? '✓ ' : ''}{perm}
                </button>
              )
            })}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button id="submit-register" type="submit" className="btn btn-primary btn-lg" disabled={loading}>
            <Plus size={16} /> {loading ? 'Registering...' : 'Register Agent'}
          </button>
          <button type="button" className="btn btn-ghost btn-lg" onClick={() => navigate('/dashboard')}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
