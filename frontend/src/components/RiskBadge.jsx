export default function RiskBadge({ level, score }) {
  const cls = {
    CRITICAL: 'risk-badge CRITICAL',
    HIGH:     'risk-badge HIGH',
    MEDIUM:   'risk-badge MEDIUM',
    LOW:      'risk-badge LOW',
  }[level] || 'risk-badge LOW'

  return (
    <span className={cls}>
      {score != null ? `${Math.round(score)} ` : ''}{level || 'UNKNOWN'}
    </span>
  )
}
