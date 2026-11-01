import ReactFlow, {
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  Panel,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { useEffect } from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

export default function TimelineFlow({ data = [], metric = 'count', threshold = null }) {
  const createTimelineData = () => {
    const nodes = []
    const edges = []
    
    if (data.length === 0) return { nodes, edges }
    
    const values = data.map(d => d[metric] || d.count || 0)
    const maxValue = Math.max(...values, 1)
    const minValue = Math.min(...values, 0)
    const range = maxValue - minValue || 1
    
    const nodeSpacing = Math.min(150, 1200 / data.length)
    const baseY = 300
    const maxHeight = 200
    
    data.forEach((point, i) => {
      const value = point[metric] || point.count || 0
      const normalizedHeight = ((value - minValue) / range) * maxHeight
      const y = baseY - normalizedHeight
      const x = 100 + i * nodeSpacing
      
      let color, bgGradient
      const isAnomalous = point.is_anomalous || point.anomalous > 0 || (threshold && value > threshold)
      
      if (isAnomalous) {
        color = '#ef4444'
        bgGradient = 'linear-gradient(135deg, #7f1d1d 0%, #ef4444 100%)'
      } else if (value > maxValue * 0.7) {
        color = '#10b981'
        bgGradient = 'linear-gradient(135deg, #065f46 0%, #10b981 100%)'
      } else if (value > maxValue * 0.4) {
        color = '#3b82f6'
        bgGradient = 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)'
      } else {
        color = '#64748b'
        bgGradient = 'linear-gradient(135deg, #334155 0%, #64748b 100%)'
      }
      
      const label = point.date || point.time || `T${i}`
      const displayValue = typeof value === 'number' ? value.toFixed(2) : value
      
      nodes.push({
        id: `node-${i}`,
        data: { 
          label: `${displayValue}\n${label}`,
        },
        position: { x, y },
        type: i === 0 ? 'input' : (i === data.length - 1 ? 'output' : 'default'),
        style: {
          background: bgGradient,
          border: `3px solid ${color}`,
          borderRadius: '10px',
          padding: '10px 14px',
          color: '#ffffff',
          fontSize: '11px',
          fontWeight: '600',
          boxShadow: `0 0 12px ${color}60`,
          textAlign: 'center',
          whiteSpace: 'pre-line',
          minWidth: '80px'
        }
      })
      
      if (i > 0) {
        const prevValue = data[i - 1][metric] || data[i - 1].count || 0
        const trend = value > prevValue ? 'up' : (value < prevValue ? 'down' : 'flat')
        
        edges.push({
          id: `edge-${i}`,
          source: `node-${i - 1}`,
          target: `node-${i}`,
          type: 'smoothstep',
          animated: isAnomalous,
          style: {
            stroke: color,
            strokeWidth: 2,
          },
          label: trend === 'up' ? '↗' : (trend === 'down' ? '↘' : '→'),
          labelStyle: {
            fill: color,
            fontSize: '14px',
            fontWeight: '700',
          }
        })
      }
    })
    
    if (threshold && data.length > 0) {
      const y = baseY - ((threshold - minValue) / range) * maxHeight
      
      nodes.push({
        id: 'threshold-start',
        data: { label: `Threshold: ${threshold}` },
        position: { x: 50, y },
        type: 'default',
        style: {
          background: 'rgba(245, 158, 11, 0.2)',
          border: '2px dashed #f59e0b',
          borderRadius: '8px',
          padding: '6px 10px',
          color: '#f59e0b',
          fontSize: '10px',
          fontWeight: '600',
        }
      })
      
      nodes.push({
        id: 'threshold-end',
        data: { label: '' },
        position: { x: 100 + (data.length - 1) * nodeSpacing + 100, y },
        type: 'default',
        style: {
          background: 'transparent',
          border: 'none',
          padding: '0',
          width: '1px',
          height: '1px',
        }
      })
      
      edges.push({
        id: 'threshold-line',
        source: 'threshold-start',
        target: 'threshold-end',
        type: 'straight',
        style: {
          stroke: '#f59e0b',
          strokeWidth: 2,
          strokeDasharray: '5,5',
        }
      })
    }
    
    return { nodes, edges }
  }

  const { nodes: initialNodes, edges: initialEdges } = createTimelineData()
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  useEffect(() => {
    const { nodes: newNodes, edges: newEdges } = createTimelineData()
    setNodes(newNodes)
    setEdges(newEdges)
  }, [data, metric, threshold, setNodes, setEdges])

  if (data.length === 0) {
    return (
      <div style={{ 
        height: '300px', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        color: 'var(--text-muted)',
        fontSize: '14px'
      }}>
        No timeline data available
      </div>
    )
  }

  const values = data.map(d => d[metric] || d.count || 0)
  const avgValue = values.reduce((a, b) => a + b, 0) / values.length
  const maxValue = Math.max(...values)
  const minValue = Math.min(...values)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <StatPill label="Average" value={avgValue.toFixed(2)} icon={<Minus size={14} />} color="#3b82f6" />
        <StatPill label="Maximum" value={maxValue.toFixed(2)} icon={<TrendingUp size={14} />} color="#10b981" />
        <StatPill label="Minimum" value={minValue.toFixed(2)} icon={<TrendingDown size={14} />} color="#64748b" />
      </div>
      
      <div style={{ 
        height: '400px', 
        border: '2px solid var(--border-default)', 
        borderRadius: '12px',
        background: 'radial-gradient(circle at 50% 50%, #0f1419 0%, #0a0a0b 100%)',
        overflow: 'hidden'
      }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          fitView
          fitViewOptions={{ padding: 0.15 }}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
        >
          <Background 
            color="#1e2d4a" 
            gap={20} 
            size={1.5}
            style={{ opacity: 0.3 }}
          />
          <Controls
            showInteractive={false}
            style={{ 
              background: 'var(--bg-card)', 
              border: '1px solid var(--border-default)',
              borderRadius: '8px'
            }}
          />
        </ReactFlow>
      </div>
    </div>
  )
}

function StatPill({ label, value, icon, color }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '8px 14px',
      background: `${color}15`,
      border: `2px solid ${color}40`,
      borderRadius: '8px',
    }}>
      <div style={{ color }}>{icon}</div>
      <div>
        <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          {label}
        </div>
        <div style={{ fontSize: '16px', fontWeight: '700', color }}>
          {value}
        </div>
      </div>
    </div>
  )
}
