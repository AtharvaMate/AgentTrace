import { useState } from 'react'
import { Shield, Save, X, Plus, Trash2 } from 'lucide-react'
import { updateAgent } from '../api/client'

const AWS_SERVICES = [
  's3', 'dynamodb', 'lambda', 'sqs', 'sns', 'kinesis', 'rds', 
  'ec2', 'ecs', 'eks', 'cloudformation', 'iam', 'kms', 
  'secretsmanager', 'ssm', 'cloudwatch', 'logs', 'glue',
  'athena', 'redshift', 'bedrock', 'textract', 'comprehend'
]

const COMMON_ACTIONS = [
  'GetObject', 'PutObject', 'ListObjects', 'DeleteObject',
  'GetItem', 'PutItem', 'UpdateItem', 'Query', 'Scan',
  'InvokeFunction', 'CreateFunction', 'UpdateFunctionCode',
  'SendMessage', 'ReceiveMessage', 'DeleteMessage',
  'Publish', 'Subscribe', 'CreateTopic',
  'CreateRole', 'AttachRolePolicy', 'ListRoles', 'GetRole',
  'GetSecretValue', 'PutSecretValue', 'ListSecrets',
  'DescribeInstances', 'StartInstances', 'StopInstances',
  'InvokeModel', 'ListModels', 'GetModelInvocationLoggingConfiguration'
]

export default function GuardrailsConfig({ agent, onUpdate }) {
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [formData, setFormData] = useState({
    expected_services: agent.expected_services || [],
    expected_actions: agent.expected_actions || [],
    iam_permissions: agent.iam_permissions || []
  })
  const [newService, setNewService] = useState('')
  const [newAction, setNewAction] = useState('')
  const [newPermission, setNewPermission] = useState('')

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const updated = await updateAgent(agent.id, formData)
      onUpdate(updated)
      setIsEditing(false)
    } catch (error) {
      console.error('Failed to update guardrails:', error)
      alert('Failed to save guardrails. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    setFormData({
      expected_services: agent.expected_services || [],
      expected_actions: agent.expected_actions || [],
      iam_permissions: agent.iam_permissions || []
    })
    setIsEditing(false)
  }

  const addService = () => {
    if (newService && !formData.expected_services.includes(newService)) {
      setFormData(prev => ({
        ...prev,
        expected_services: [...prev.expected_services, newService]
      }))
      setNewService('')
    }
  }

  const removeService = (service) => {
    setFormData(prev => ({
      ...prev,
      expected_services: prev.expected_services.filter(s => s !== service)
    }))
  }

  const addAction = () => {
    if (newAction && !formData.expected_actions.includes(newAction)) {
      setFormData(prev => ({
        ...prev,
        expected_actions: [...prev.expected_actions, newAction]
      }))
      setNewAction('')
    }
  }

  const removeAction = (action) => {
    setFormData(prev => ({
      ...prev,
      expected_actions: prev.expected_actions.filter(a => a !== action)
    }))
  }

  const addPermission = () => {
    if (newPermission && !formData.iam_permissions.includes(newPermission)) {
      setFormData(prev => ({
        ...prev,
        iam_permissions: [...prev.iam_permissions, newPermission]
      }))
      setNewPermission('')
    }
  }

  const removePermission = (permission) => {
    setFormData(prev => ({
      ...prev,
      iam_permissions: prev.iam_permissions.filter(p => p !== permission)
    }))
  }

  return (
    <div>
      {/* Header with edit button */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Shield size={20} color="var(--accent)" />
          <h2 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)' }}>
            Security Guardrails
          </h2>
        </div>
        {!isEditing ? (
          <button className="btn btn-primary" onClick={() => setIsEditing(true)}>
            Edit Guardrails
          </button>
        ) : (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-ghost" onClick={handleCancel} disabled={isSaving}>
              <X size={16} />
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleSave} disabled={isSaving}>
              <Save size={16} />
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        )}
      </div>

      {/* Description */}
      <div className="card" style={{ marginBottom: '20px', background: 'var(--accent-dim)', border: '1px solid var(--accent)' }}>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
          Guardrails define what services and actions this agent is <strong>expected</strong> to use. 
          AgentTrace flags any behavior that deviates from these declarations, even if the agent's IAM 
          policy technically allows it. This is the foundation of intent-based security.
        </p>
      </div>

      <div style={{ display: 'grid', gap: '24px' }}>
        {/* Expected Services */}
        <div className="card">
          <h3 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '12px', color: 'var(--text-primary)' }}>
            Expected AWS Services
          </h3>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>
            Which AWS services should this agent access as part of its normal operation?
          </p>
          
          {isEditing && (
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              <select 
                value={newService}
                onChange={(e) => setNewService(e.target.value)}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-default)',
                  borderRadius: '6px',
                  color: 'var(--text-primary)',
                  fontSize: '13px'
                }}
              >
                <option value="">Select service...</option>
                {AWS_SERVICES.map(service => (
                  <option key={service} value={service}>{service}</option>
                ))}
              </select>
              <button className="btn btn-primary" onClick={addService}>
                <Plus size={16} />
                Add
              </button>
            </div>
          )}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {formData.expected_services.map(service => (
              <div 
                key={service}
                className="badge"
                style={{ 
                  background: 'var(--blue-bg)', 
                  color: 'var(--blue)', 
                  border: '1px solid var(--blue-border)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 10px'
                }}
              >
                {service}
                {isEditing && (
                  <button 
                    onClick={() => removeService(service)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}
                  >
                    <X size={14} color="var(--blue)" />
                  </button>
                )}
              </div>
            ))}
            {formData.expected_services.length === 0 && (
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                No services defined
              </div>
            )}
          </div>
        </div>

        {/* Expected Actions */}
        <div className="card">
          <h3 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '12px', color: 'var(--text-primary)' }}>
            Expected Actions
          </h3>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>
            What specific AWS API actions should this agent perform?
          </p>
          
          {isEditing && (
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              <select 
                value={newAction}
                onChange={(e) => setNewAction(e.target.value)}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-default)',
                  borderRadius: '6px',
                  color: 'var(--text-primary)',
                  fontSize: '13px'
                }}
              >
                <option value="">Select action...</option>
                {COMMON_ACTIONS.map(action => (
                  <option key={action} value={action}>{action}</option>
                ))}
              </select>
              <button className="btn btn-primary" onClick={addAction}>
                <Plus size={16} />
                Add
              </button>
            </div>
          )}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {formData.expected_actions.map(action => (
              <div 
                key={action}
                className="badge"
                style={{ 
                  background: 'var(--accent-dim)', 
                  color: 'var(--accent)', 
                  border: '1px solid var(--accent)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 10px'
                }}
              >
                {action}
                {isEditing && (
                  <button 
                    onClick={() => removeAction(action)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}
                  >
                    <X size={14} color="var(--accent)" />
                  </button>
                )}
              </div>
            ))}
            {formData.expected_actions.length === 0 && (
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                No actions defined
              </div>
            )}
          </div>
        </div>

        {/* IAM Permissions (readonly reference) */}
        <div className="card">
          <h3 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '12px', color: 'var(--text-primary)' }}>
            Current IAM Policy Permissions
          </h3>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>
            These are the permissions actually granted to the agent's IAM role. Guardrails help identify over-permissions.
          </p>
          
          <div style={{ maxHeight: '200px', overflowY: 'auto', background: 'var(--bg-elevated)', padding: '12px', borderRadius: '6px', border: '1px solid var(--border-default)' }}>
            {formData.iam_permissions.map((perm, idx) => (
              <div 
                key={idx}
                style={{ 
                  fontSize: '12px', 
                  fontFamily: 'monospace',
                  color: 'var(--text-secondary)',
                  padding: '4px 0',
                  borderBottom: idx < formData.iam_permissions.length - 1 ? '1px solid var(--border-default)' : 'none'
                }}
              >
                {perm}
              </div>
            ))}
            {formData.iam_permissions.length === 0 && (
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                No IAM permissions defined
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
