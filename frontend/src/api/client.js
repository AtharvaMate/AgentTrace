import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_URL || '/api'

const api = axios.create({
  baseURL: API_BASE,
  timeout: 60000,
  headers: {
    'Content-Type': 'application/json',
  }
})

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    console.error('API Error:', error.response?.data || error.message)
    return Promise.reject(error)
  }
)

// ── Agents ──────────────────────────────────
export const getAgents = () => api.get('/api/agents/')
export const getAgent = (id) => api.get(`/api/agents/${id}`)
export const getDashboardStats = () => api.get('/api/agents/stats')
export const createAgent = (data) => api.post('/api/agents/', data)
export const deleteAgent = (id) => api.delete(`/api/agents/${id}`)
export const updateAgentStatus = (id, status) => api.patch(`/api/agents/${id}/status?status=${status}`)
export const updateAgent = (id, data) => api.patch(`/api/agents/${id}`, data)

// ── Activity ─────────────────────────────────
export const getActivity = (agentId, limit = 50) => api.get(`/api/activity/${agentId}?limit=${limit}`)
export const getRecentActivity = (agentId, hours = 24) => api.get(`/api/activity/${agentId}/recent?hours=${hours}`)
export const getAnomalies = (agentId) => api.get(`/api/activity/${agentId}/anomalies`)
export const getTimeline = (agentId, days = 14) => api.get(`/api/activity/${agentId}/timeline?days=${days}`)
export const simulateEvent = (data) => api.post('/api/activity/simulate', data)
export const syncCloudTrail = () => api.post('/api/activity/sync-cloudtrail')

// ── Risk ─────────────────────────────────────
export const analyzeRisk = (data) => api.post('/api/risk/analyze', data)
export const getRiskEvents = (agentId) => api.get(`/api/risk/${agentId}/events`)
export const getRiskScore = (agentId) => api.get(`/api/risk/${agentId}/score`)
export const resolveRiskEvent = (eventId) => api.patch(`/api/risk/${eventId}/resolve`)
export const getIntentComparison = (agentId) => api.get(`/api/risk/${agentId}/intent-comparison`)
export const getLeastPrivilegePolicy = (agentId) => api.get(`/api/risk/${agentId}/least-privilege-policy`)

// ── Fingerprint ──────────────────────────────
export const getFingerprint = (agentId) => api.get(`/api/fingerprint/${agentId}`)
export const buildFingerprint = (agentId) => api.post(`/api/fingerprint/${agentId}/build`)
export const getDeviation = (agentId, action, service) =>
  api.get(`/api/fingerprint/${agentId}/deviation?action=${action}&service=${service}`)
export const getModelMetrics = (agentId) => api.get(`/api/fingerprint/${agentId}/model-metrics`)

// ── Blast Radius ─────────────────────────────
export const getBlastRadius = (agentId) => api.get(`/api/blast-radius/${agentId}`)

// ── Scenarios ────────────────────────────────
export const getScenarios = () => api.get('/api/scenarios/')
export const runScenario = (scenarioId, agentId) => api.post(`/api/scenarios/${scenarioId}/run/${agentId}`)

// ── Guardrails ───────────────────────────────
export const getGuardrails = (agentId) => api.get(`/api/guardrails/${agentId}`)
export const generateGuardrails = (agentId) => api.post(`/api/guardrails/${agentId}/generate`)
export const createGuardrail = (agentId, data) => api.post(`/api/guardrails/${agentId}`, data)
export const deleteGuardrail = (guardrailId) => api.delete(`/api/guardrails/${guardrailId}`)
export const toggleGuardrail = (guardrailId) => api.patch(`/api/guardrails/${guardrailId}/toggle`)

// ── Notifications ─────────────────────────────
export const getNotificationSettings = (agentId) => api.get(`/api/notifications/${agentId}`)
export const createNotificationSetting = (agentId, data) => api.post(`/api/notifications/${agentId}`, data)
export const updateNotificationSetting = (settingId, data) => api.put(`/api/notifications/${settingId}`, data)
export const deleteNotificationSetting = (settingId) => api.delete(`/api/notifications/${settingId}`)
export const toggleNotificationSetting = (settingId) => api.patch(`/api/notifications/${settingId}/toggle`)
export const sendTestEmail = (agentId, emailAddress) => api.post(`/api/notifications/${agentId}/test`, { email_address: emailAddress })

export default api
