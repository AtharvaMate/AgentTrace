import ReactFlow, {
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  MarkerType,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { useEffect } from 'react'

export default function ServiceUsageGraph({ serviceUsage = {}, expectedServices = [] }) {
  const createGraphData = () => {
    const nodes = []
    const edges = []
    
    nodes.push({
      id: 'center',
      data: { label: 'Agent Services' },
      position: { x: 400, y: 300 },
      type: 'input',
      style: {
        background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)',
        border: '3px solid #60a5fa',
        borderRadius: '12px',
        padding: '16px 20px',
        color: '#ffffff',
        fontSize: '14px',
        fontWeight: '700',
        boxShadow: '0 8px 20px rgba(59, 130, 246, 0.4)',
      }
    })
    
    const services = Object.entries(serviceUsage).sort((a, b) => b[1] - a[1])
    const maxCount = services[0]?.[1] || 1
    
    services.forEach(([service, count], i) => {
      const angle = (2 * Math.PI * i) / services.length - Math.PI / 2
      const radius = 280
      const x = 400 + radius * Math.cos(angle)
      const y = 300 + radius * Math.sin(angle)
      
      const isExpected = expectedServices.includes(service)
      const percentage = (count / maxCount) * 100
      
      let color, bgGradient
      if (!isExpected) {
        color = '#dc2626'
        bgGradient = 'linear-gradient(135deg, #7f1d1d 0%, #dc2626 100%)'
      } else if (percentage > 75) {
        color = '#10b981'
        bgGradient = 'linear-gradient(135deg, #065f46 0%, #10b981 100%)'
      } else if (percentage > 40) {
        color = '#3b82f6'
        bgGradient = 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)'
      } else {
        color = '#64748b'
        bgGradient = 'linear-gradient(135deg, #334155 0%, #64748b 100%)'
      }
      
      nodes.push({
        id: service,
        data: { 
          label: `${service}\n${count} calls`,
        },
        position: { x, y },
        type: 'default',
        style: {
          background: bgGradient,
          border: `3px solid ${color}`,
          borderRadius: '10px',
          padding: '12px 16px',
          color: '#ffffff',
          fontSize: '12px',
          fontWeight: '600',
          boxShadow: `0 0 15px ${color}60`,
          textAlign: 'center',
          whiteSpace: 'pre-line',
          minWidth: '120px'
        }
      })
      
      const edgeWidth = Math.max(2, Math.min(8, (count / maxCount) * 8))
      
      edges.push({
        id: `edge-${service}`,
        source: 'center',
        target: service,
        type: 'smoothstep',
        animated: !isExpected,
        style: {
          stroke: color,
          strokeWidth: edgeWidth,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: color,
          width: 20,
          height: 20,
        },
        label: percentage > 50 ? `${Math.round(percentage)}%` : null,
        labelStyle: {
          fill: color,
          fontSize: '11px',
          fontWeight: '600',
        }
      })
    })
    
    return { nodes, edges }
  }

  const { nodes: initialNodes, edges: initialEdges } = createGraphData()
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  useEffect(() => {
    const { nodes: newNodes, edges: newEdges } = createGraphData()
    setNodes(newNodes)
    setEdges(newEdges)
  }, [serviceUsage, expectedServices, setNodes, setEdges])

  if (Object.keys(serviceUsage).length === 0) {
    return (
      <div style={{ 
        height: '300px', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        color: 'var(--text-muted)',
        fontSize: '14px'
      }}>
        No service usage data available
      </div>
    )
  }

  return (
    <div style={{ 
      height: '500px', 
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
  )
}
