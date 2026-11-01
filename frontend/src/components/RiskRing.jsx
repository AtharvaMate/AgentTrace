export default function RiskRing({ score = 0, size = 84, strokeWidth = 7 }) {
  const r = (size - strokeWidth) / 2
  const circ = 2 * Math.PI * r
  const pct = Math.min(Math.max(score, 0), 100)
  const offset = circ - (pct / 100) * circ

  const color = pct >= 80 ? 'var(--red)' : pct >= 55 ? 'var(--orange)' : pct >= 30 ? 'var(--yellow)' : 'var(--green)'
  const level = pct >= 80 ? 'CRITICAL' : pct >= 55 ? 'HIGH' : pct >= 30 ? 'MEDIUM' : 'LOW'

  return (
    <div className="risk-ring-container">
      <svg width={size} height={size} className="risk-ring-svg" style={{ overflow: 'visible' }}>
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke="var(--bg-elevated)" strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4,0,0.2,1), stroke 0.4s ease' }}
        />
        <text
          x="50%" y="47%" dominantBaseline="middle" textAnchor="middle"
          style={{ fill: 'var(--text-primary)', fontSize: size * 0.22, fontWeight: 800, fontFamily: 'Inter, sans-serif' }}
          transform={`rotate(90 ${size / 2} ${size / 2})`}
        >
          {Math.round(pct)}
        </text>
      </svg>
      <span className={`badge badge-${level.toLowerCase()}`} style={{ fontSize: '10px' }}>{level}</span>
    </div>
  )
}
