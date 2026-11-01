import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Panel,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { useEffect } from 'react'
import { Shield, AlertTriangle } from 'lucide-react'

const nodeTypes = {}

export default function BlastRadiusGraph({ nodes: initNodes = [], edges: initEdges = [], impactSummary }) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initEdges)

  useEffect(() => {
    setNodes(initNodes)
    setEdges(initEdges)
  }, [initNodes, initEdges, setNodes, setEdges])

  const getImpactColor = (impact) => {
    switch(impact) {
      case 'CRITICAL': return '#dc2626'
      case 'HIGH': return '#ef4444'
      case 'MEDIUM': return '#f59e0b'
      default: return '#10b981'
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {impactSummary && (
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <ImpactPill 
            label="Estimated Impact" 
            value={impactSummary.estimated_impact} 
            color={getImpactColor(impactSummary.estimated_impact)}
            highlight
          />
          <ImpactPill label="Services" value={impactSummary.total_services} color="#3b82f6" />
          <ImpactPill label="Resources" value={impactSummary.total_resources} color="#8b5cf6" />
          <ImpactPill 
            label="Sensitive" 
            value={impactSummary.sensitive_resources} 
            color={impactSummary.sensitive_resources > 0 ? '#ef4444' : '#10b981'} 
          />
          {impactSummary.highest_risk_service && (
            <ImpactPill 
              label="Highest Risk" 
              value={impactSummary.highest_risk_service.toUpperCase()} 
              color="#dc2626"
              icon={<Shield size={14} />}
            />
          )}
        </div>
      )}

      <div 
        className="blast-radius-container" 
        style={{ 
          height: '700px', 
          border: '2px solid var(--border-default)', 
          borderRadius: '16px',
          background: 'radial-gradient(circle at 50% 50%, #0f1419 0%, #0a0a0b 100%)',
          overflow: 'hidden',
          position: 'relative'
        }}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.3, maxZoom: 1 }}
          minZoom={0.3}
          maxZoom={1.5}
          defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
          attributionPosition="bottom-left"
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={true}
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
          <MiniMap
            nodeColor={(node) => {
              if (node.id === 'agent') return '#3b82f6'
              if (node.id.startsWith('svc-')) {
                const border = node.style?.border || ''
                if (border.includes('#dc2626')) return '#dc2626'
                if (border.includes('#ef4444')) return '#ef4444'
                if (border.includes('#f59e0b')) return '#f59e0b'
                return '#3b82f6'
              }
              return '#64748b'
            }}
            style={{ 
              background: 'var(--bg-card)', 
              border: '1px solid var(--border-default)',
              borderRadius: '8px'
            }}
            maskColor="rgba(0, 0, 0, 0.8)"
          />
          
          <Panel position="top-right" style={{ margin: 10 }}>
            <div style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-default)',
              borderRadius: '8px',
              padding: '12px',
              fontSize: '11px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              minWidth: '180px'
            }}>
              <div style={{ fontWeight: '600', marginBottom: '4px', color: 'var(--text-primary)' }}>Legend</div>
              <LegendItem color="#3b82f6" label="Agent Node" />
              <LegendItem color="#dc2626" label="Critical (Sensitive + Anomaly)" />
              <LegendItem color="#ef4444" label="Sensitive Service" />
              <LegendItem color="#f59e0b" label="Anomalous Activity" />
              <LegendItem color="#64748b" label="Normal Service" />
            </div>
          </Panel>
        </ReactFlow>
      </div>

      {impactSummary?.anomalous_services?.length > 0 && (
        <div className="alert alert-danger" style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
          <AlertTriangle size={20} style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <strong style={{ display: 'block', marginBottom: '4px' }}>Anomalous Services Detected</strong>
            <span style={{ fontSize: '13px', opacity: 0.9 }}>
              The following services showed unexpected activity: <strong>{impactSummary.anomalous_services.join(', ')}</strong>
              {impactSummary.sensitive_resources > 0 && 
                '. This includes access to sensitive resources which poses a critical security risk.'}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

function ImpactPill({ label, value, color, highlight, icon }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      padding: highlight ? '12px 18px' : '10px 16px',
      background: `${color}15`,
      border: `2px solid ${color}${highlight ? '80' : '40'}`,
      borderRadius: '10px',
      minWidth: highlight ? '140px' : '110px',
      boxShadow: highlight ? `0 4px 12px ${color}30` : 'none',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
        {icon}
        <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '600' }}>
          {label}
        </span>
      </div>
      <span style={{ 
        fontSize: highlight ? '20px' : '18px', 
        fontWeight: '800', 
        color: color,
        textTransform: typeof value === 'string' ? 'uppercase' : 'none'
      }}>
        {value}
      </span>
    </div>
  )
}

function LegendItem({ color, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div style={{ 
        width: '12px', 
        height: '12px', 
        borderRadius: '3px', 
        background: color,
        border: `1px solid ${color}`,
        boxShadow: `0 0 6px ${color}60`
      }} />
      <span style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>{label}</span>
    </div>
  )
}
