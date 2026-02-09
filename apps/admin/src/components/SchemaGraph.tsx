'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  ReactFlow,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  Node,
  Edge,
  NodeTypes,
  MarkerType,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { EntityNode } from './EntityNode'

interface SchemaGraphData {
  entities: Array<{
    name: string
    tableName: string
    columns: Array<{
      name: string
      type: string
      nullable: boolean
      primaryKey: boolean
    }>
    relationships: Array<{
      type: '1:N' | '1:1' | 'N:1'
      to: string
      field: string
      description: string
    }>
  }>
  nodes: Array<{
    id: string
    type: string
    position: { x: number; y: number }
    data: Record<string, unknown>
  }>
  edges: Array<{
    id: string
    source: string
    target: string
    label: string
    type: string
    animated: boolean
  }>
}

const nodeTypes: NodeTypes = {
  entityNode: EntityNode,
}

export default function SchemaGraph() {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [selectedEntity, setSelectedEntity] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [graphData, setGraphData] = useState<SchemaGraphData | null>(null)

  useEffect(() => {
    async function fetchGraph() {
      try {
        const res = await fetch('http://localhost:6129/api/v1/schema/graph')
        const data = await res.json() as SchemaGraphData
        setGraphData(data)
        
        // Convert to React Flow format
        const flowNodes: Node[] = data.nodes.map((n) => ({
          id: n.id,
          type: n.type,
          position: n.position,
          data: n.data,
        }))
        
        const flowEdges: Edge[] = data.edges.map((e) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          label: e.label,
          type: e.type,
          animated: e.animated,
          style: { stroke: '#6366f1', strokeWidth: 2 },
          labelStyle: { fill: '#6366f1', fontWeight: 600 },
          markerEnd: { type: MarkerType.ArrowClosed, color: '#6366f1' },
        }))
        
        setNodes(flowNodes)
        setEdges(flowEdges)
      } catch (err) {
        console.error('Failed to fetch schema graph:', err)
      } finally {
        setLoading(false)
      }
    }
    
    fetchGraph()
  }, [setNodes, setEdges])

  const onNodeClick = useCallback((_: unknown, node: Node) => {
    setSelectedEntity(node.id)
  }, [])

  const selectedEntityData = graphData?.entities.find(e => e.name === selectedEntity)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading schema graph...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-96">
      {/* React Flow Canvas */}
      <div className="flex-1 border rounded-lg overflow-hidden">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
          fitView
          attributionPosition="bottom-left"
        >
          <Background color="#e5e7eb" gap={20} />
          <Controls />
        </ReactFlow>
      </div>

      {/* Entity Detail Panel */}
      {selectedEntityData && (
        <div className="w-80 ml-4 bg-card rounded-lg shadow-lg border border-border/30 p-4 overflow-auto">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-foreground">{selectedEntityData.name}</h2>
            <button
              onClick={() => setSelectedEntity(null)}
              className="p-1 hover:bg-muted rounded"
            >
              ✕
            </button>
          </div>

          <p className="text-sm text-muted-foreground mb-4">Table: {selectedEntityData.tableName}</p>

          {/* Columns */}
          <div className="mb-4">
            <h3 className="font-semibold text-sm text-foreground mb-2">Columns</h3>
            <div className="space-y-1">
              {selectedEntityData.columns.map((col) => (
                <div key={col.name} className="flex items-center justify-between text-sm p-1 rounded hover:bg-muted">
                  <div className="flex items-center gap-2">
                    {col.primaryKey && (
                      <span className="text-yellow-500 text-xs">🔑</span>
                    )}
                    <span className={col.primaryKey ? 'font-semibold' : ''}>{col.name}</span>
                  </div>
                  <span className="text-muted-foreground text-xs">{col.type}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Relationships */}
          <div>
            <h3 className="font-semibold text-sm text-foreground mb-2">Relationships</h3>
            <div className="space-y-2">
              {selectedEntityData.relationships.map((rel, idx) => (
                <div key={idx} className="p-2 bg-muted rounded text-sm">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-primary/10 text-primary rounded text-xs font-medium">
                      {rel.type}
                    </span>
                    <span className="font-medium">{rel.to}</span>
                  </div>
                  <p className="text-muted-foreground text-xs mt-1">{rel.description}</p>
                  <p className="text-muted-foreground/70 text-xs">{rel.field}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Related Endpoints */}
          <div className="mt-4">
            <h3 className="font-semibold text-sm text-foreground mb-2">Related Endpoints</h3>
            <div className="space-y-1">
              <button className="w-full px-3 py-2 text-left text-xs border rounded hover:bg-muted">
                GET /api/v1/{selectedEntityData.name.toLowerCase()}s
              </button>
              <button className="w-full px-3 py-2 text-left text-xs border rounded hover:bg-muted">
                POST /api/v1/{selectedEntityData.name.toLowerCase()}s
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
