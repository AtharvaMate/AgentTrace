import ReactFlow, {
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  MarkerType,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { useEffect } from 'react'

const RISK_COLORS = {
  CRITICAL: { color: '#dc2626', gradient: 'linear-gradient(135deg, #7f1d1d 0%, #dc2626 100%)' },
  HIGH: { color: '#ef4444', gradient: 'linear-gradient(135deg, #991b1b 0%, #ef4444 100%)' },
  MEDIUM: { color: '#f59e0b', gradient: 'linear-gradient(135deg, #92400e 0%, #f59e0b 100%)' },
  LOW: { color: '#10b981', gradient: 'linear-gradient(135deg, #065f46 0%, #10b981 100%)' }
}

export default function RiskDistribution({ agents = [] }) {
  const distribution = agents.reduce((acc, agent) => {
    const level = agent.latest_risk_level || 'LOW'
    acc[level] = (acc[level] || 0) + 1
    return acc
  }, {})

  const data = Object.entries(distribution).map(([level, count]) => ({
    name: level,
    value: count,
    ...RISK_COLORS[level]
  }))

  const total = agents.length

  const createRiskGraph = () => {
    const nodes = []
    const edges = []
    
    if (data.length === 0) return { nodes, edges }
    
    nodes.push({
      id: 'center',
      data: { label: `${total}\nTotal Agents` },
      position: { x: 400, y: 250 },
      type: 'input',
      style: {
        background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)',
        border: '4px solid #60a5fa',
        borderRadius: '50%',
        width: '120px',
        height: '120px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#ffffff',
        fontSize: '14px',
        fontWeight: '700',
        boxShadow: '0 8px 24px rgba(59, 130, 246, 0.5)',
        textAlign: 'center',
        whiteSpace: 'pre-line',
        padding: '0'
      }
    })
    
    data.forEach((item, i) => {
      const angle = (2 * Math.PI * i) / data.length - Math.PI / 2
      const radius = 220
      const x = 400 + radius * Math.cos(angle)
      const y = 250 + radius * Math.sin(angle)
      
      const percentage = Math.round((item.value / total) * 100)
      const size = 60 + (percentage * 0.8)
      
      nodes.push({
        id: item.name,
        data: { 
          label: `${item.name}\n${item.value} (${percentage}%)`,
        },
        position: { x, y },
        type: 'output',
        style: {
          background: item.gradient,
          border: `4px solid ${item.color}`,
          borderRadius: '50%',
          width: `${size}px`,
          height: `${size}px`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#ffffff',
          fontSize: '12px',
          fontWeight: '600',
          boxShadow: `0 0 20px ${item.color}80`,
          textAlign: 'center',
          whiteSpace: 'pre-line',
          padding: '0'
        }
      })
      
      const edgeWidth = Math.max(3, Math.min(10, (item.value / total) * 15))
      
      edges.push({
        id: `edge-${item.name}`,
        source: 'center',
        target: item.name,
        type: 'smoothstep',
        animated: item.name === 'CRITICAL',
        style: {
          stroke: item.color,
          strokeWidth: edgeWidth,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: item.color,
          width: 25,
          height: 25,
        }
      })
    })
    
    return { nodes, edges }
  }

  const { nodes: initialNodes, edges: initialEdges } = createRiskGraph()
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  useEffect(() => {
    const { nodes: newNodes, edges: newEdges } = createRiskGraph()
    setNodes(newNodes)
    setEdges(newEdges)
  }, [agents, setNodes, setEdges])

  return (
    <div className="card">
      <h3 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '20px', color: 'var(--text-primary)' }}>
        Risk Distribution
      </h3>
      
      {total > 0 ? (
        <div style={{ 
          height: '500px',
          border: '1px solid var(--border-default)',
          borderRadius: '10px',
          background: 'radial-gradient(circle at 50% 50%, #0f1419 0%, #0a0a0b 100%)',
          overflow: 'hidden'
        }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            fitView
            fitViewOptions={{ padding: 0.2 }}
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
      ) : (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
          No agents to display
        </div>
      )}
    </div>
  )
}
