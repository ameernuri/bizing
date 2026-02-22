'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ReactFlow,
  Controls,
  Background,
  Node,
  Edge,
  NodeTypes,
  MarkerType,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { EntityNode } from './EntityNode'
import { apiUrl } from '@/lib/api'

interface SchemaGraphSummary {
  totalEntities: number
  totalColumns: number
  totalRelationships: number
  totalPrimaryKeys: number
}

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
    sourceHandle: string
    targetHandle: string
    label: string
    type: string
    animated: boolean
  }>
  summary?: SchemaGraphSummary
}

interface SchemaGraphProps {
  onLoaded?: (summary: SchemaGraphSummary) => void
}

interface SchemaEntity {
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
}

interface TableEdge {
  id: string
  source: string
  target: string
  sourceHandle: string
  targetHandle: string
  label: string
  type: string
  animated: boolean
}

function summarizeGraph(data: SchemaGraphData): SchemaGraphSummary {
  return {
    totalEntities: data.entities.length,
    totalColumns: data.entities.reduce((sum, entity) => sum + entity.columns.length, 0),
    totalRelationships: data.edges.length,
    totalPrimaryKeys: data.entities.reduce(
      (sum, entity) => sum + entity.columns.filter((column) => column.primaryKey).length,
      0,
    ),
  }
}

const nodeTypes: NodeTypes = {
  entityNode: EntityNode,
}

function inferDomain(tableName: string): string {
  const prefix = tableName.split('_')[0] ?? tableName
  if (!prefix) return 'other'
  return prefix
}

function shortestPath(edges: TableEdge[], source: string, target: string): string[] {
  if (source === target) return [source]

  const graph = new Map<string, Set<string>>()
  for (const edge of edges) {
    graph.set(edge.source, new Set([...(graph.get(edge.source) ?? []), edge.target]))
    graph.set(edge.target, new Set([...(graph.get(edge.target) ?? []), edge.source]))
  }

  const queue: string[] = [source]
  const visited = new Set<string>([source])
  const parent = new Map<string, string>()

  while (queue.length > 0) {
    const current = queue.shift()!
    const neighbors = graph.get(current) ?? new Set<string>()
    for (const neighbor of neighbors) {
      if (visited.has(neighbor)) continue
      visited.add(neighbor)
      parent.set(neighbor, current)
      if (neighbor === target) {
        const path = [target]
        let step: string | undefined = target
        while (step && step !== source) {
          step = parent.get(step)
          if (step) path.push(step)
        }
        return path.reverse()
      }
      queue.push(neighbor)
    }
  }

  return []
}

export default function SchemaGraph({ onLoaded }: SchemaGraphProps) {
  const [selectedEntity, setSelectedEntity] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [graphData, setGraphData] = useState<SchemaGraphData | null>(null)
  const [search, setSearch] = useState('')
  const [selectedDomain, setSelectedDomain] = useState('all')
  const [hopDepth, setHopDepth] = useState<1 | 2>(1)
  const [pathFrom, setPathFrom] = useState('')
  const [pathTo, setPathTo] = useState('')

  useEffect(() => {
    async function fetchGraph() {
      try {
        const res = await fetch(apiUrl('/api/v1/schema/graph'))
        const data = await res.json() as SchemaGraphData
        setGraphData(data)
        onLoaded?.(data.summary ?? summarizeGraph(data))

        if (data.entities.length > 0) {
          setSelectedEntity(data.entities[0]?.tableName ?? null)
          setPathFrom(data.entities[0]?.tableName ?? '')
          setPathTo(data.entities[1]?.tableName ?? data.entities[0]?.tableName ?? '')
        }
      } catch (err) {
        console.error('Failed to fetch schema graph:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchGraph()
  }, [onLoaded])

  const allEntities = graphData?.entities ?? []
  const allEdges = graphData?.edges ?? []

  const domains = useMemo(() => {
    const domainSet = new Set<string>()
    for (const entity of allEntities) {
      domainSet.add(inferDomain(entity.tableName))
    }
    return ['all', ...Array.from(domainSet).sort((a, b) => a.localeCompare(b))]
  }, [allEntities])

  const filteredEntities = useMemo(() => {
    const query = search.trim().toLowerCase()
    return allEntities
      .filter((entity) => {
        if (selectedDomain !== 'all' && inferDomain(entity.tableName) !== selectedDomain) {
          return false
        }
        if (!query) return true
        return (
          entity.tableName.toLowerCase().includes(query) ||
          entity.name.toLowerCase().includes(query) ||
          entity.columns.some((column) => column.name.toLowerCase().includes(query))
        )
      })
      .sort((a, b) => a.tableName.localeCompare(b.tableName))
  }, [allEntities, search, selectedDomain])

  const adjacency = useMemo(() => {
    const map = new Map<string, Set<string>>()
    for (const edge of allEdges) {
      map.set(edge.source, new Set([...(map.get(edge.source) ?? []), edge.target]))
      map.set(edge.target, new Set([...(map.get(edge.target) ?? []), edge.source]))
    }
    return map
  }, [allEdges])

  const visibleEntityIds = useMemo(() => {
    if (!selectedEntity) return new Set<string>()
    const visible = new Set<string>([selectedEntity])
    const frontier = new Set<string>([selectedEntity])

    for (let depth = 0; depth < hopDepth; depth += 1) {
      const nextFrontier = new Set<string>()
      for (const node of frontier) {
        const neighbors = adjacency.get(node) ?? new Set<string>()
        for (const neighbor of neighbors) {
          if (visible.has(neighbor)) continue
          visible.add(neighbor)
          nextFrontier.add(neighbor)
        }
      }
      frontier.clear()
      for (const node of nextFrontier) frontier.add(node)
    }
    return visible
  }, [selectedEntity, hopDepth, adjacency])

  const visibleEntities = useMemo(
    () => allEntities.filter((entity) => visibleEntityIds.has(entity.tableName)),
    [allEntities, visibleEntityIds],
  )

  const nodes = useMemo<Node[]>(() => {
    if (!selectedEntity) return []
    const centerX = 700
    const centerY = 360
    const ringRadius = hopDepth === 1 ? 300 : 440
    const neighborIds = Array.from(visibleEntityIds).filter((id) => id !== selectedEntity)
    const byId = new Map(allEntities.map((entity) => [entity.tableName, entity] as const))

    const result: Node[] = [
      {
        id: selectedEntity,
        type: 'entityNode',
        position: { x: centerX, y: centerY },
        data: {
          entity: byId.get(selectedEntity),
        },
      },
    ]

    neighborIds.forEach((id, index) => {
      const angle = (2 * Math.PI * index) / Math.max(1, neighborIds.length)
      result.push({
        id,
        type: 'entityNode',
        position: {
          x: centerX + Math.cos(angle) * ringRadius,
          y: centerY + Math.sin(angle) * ringRadius,
        },
        data: {
          entity: byId.get(id),
        },
      })
    })

    return result
  }, [allEntities, selectedEntity, visibleEntityIds, hopDepth])

  const edges = useMemo<Edge[]>(
    () =>
      allEdges
        .filter((edge) => visibleEntityIds.has(edge.source) && visibleEntityIds.has(edge.target))
        .map((edge) => ({
          id: edge.id,
          source: edge.source,
          target: edge.target,
          sourceHandle: edge.sourceHandle,
          targetHandle: edge.targetHandle,
          label: visibleEntityIds.size > 35 ? '' : edge.label,
          type: edge.type,
          animated: false,
          style: { stroke: '#6366f1', strokeWidth: 1.25 },
          labelStyle: { fill: '#6366f1', fontWeight: 600 },
          markerEnd: { type: MarkerType.ArrowClosed, color: '#6366f1' },
        })),
    [allEdges, visibleEntityIds],
  )

  const onNodeClick = useCallback((_: unknown, node: Node) => {
    setSelectedEntity(node.id)
  }, [])

  const selectedEntityData = allEntities.find((entity) => entity.tableName === selectedEntity)
  const pathResult = useMemo(() => {
    if (!pathFrom || !pathTo) return []
    return shortestPath(allEdges, pathFrom, pathTo)
  }, [allEdges, pathFrom, pathTo])

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
    <div className="flex h-[75vh] min-h-[680px] gap-4">
      <div className="w-[320px] shrink-0 rounded-lg border border-border/30 bg-card p-3 overflow-hidden flex flex-col">
        <div className="space-y-3">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full rounded border bg-background px-3 py-2 text-sm"
            placeholder="Search table or column..."
          />
          <select
            className="w-full rounded border bg-background px-3 py-2 text-sm"
            value={selectedDomain}
            onChange={(event) => setSelectedDomain(event.target.value)}
          >
            {domains.map((domain) => (
              <option key={domain} value={domain}>
                {domain === 'all' ? 'All Domains' : domain}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <button
              className={`rounded px-3 py-1 text-sm border ${hopDepth === 1 ? 'bg-primary text-primary-foreground border-primary' : 'bg-background'}`}
              onClick={() => setHopDepth(1)}
            >
              1-hop
            </button>
            <button
              className={`rounded px-3 py-1 text-sm border ${hopDepth === 2 ? 'bg-primary text-primary-foreground border-primary' : 'bg-background'}`}
              onClick={() => setHopDepth(2)}
            >
              2-hop
            </button>
          </div>
        </div>

        <div className="mt-3 text-xs text-muted-foreground">
          {filteredEntities.length} matching tables
        </div>

        <div className="mt-2 overflow-auto border rounded bg-background/50">
          {filteredEntities.map((entity) => (
            <button
              key={entity.tableName}
              className={`w-full px-3 py-2 text-left border-b last:border-b-0 text-sm ${selectedEntity === entity.tableName ? 'bg-primary/10' : 'hover:bg-muted'}`}
              onClick={() => setSelectedEntity(entity.tableName)}
            >
              <div className="font-medium">{entity.tableName}</div>
              <div className="text-xs text-muted-foreground">
                {entity.columns.length} cols · {entity.relationships.length} rels
              </div>
            </button>
          ))}
        </div>

        <div className="mt-3 border rounded p-2 space-y-2">
          <div className="text-xs font-semibold">Path Finder</div>
          <select
            className="w-full rounded border bg-background px-2 py-1 text-xs"
            value={pathFrom}
            onChange={(event) => setPathFrom(event.target.value)}
          >
            {allEntities.map((entity) => (
              <option key={entity.tableName} value={entity.tableName}>
                {entity.tableName}
              </option>
            ))}
          </select>
          <select
            className="w-full rounded border bg-background px-2 py-1 text-xs"
            value={pathTo}
            onChange={(event) => setPathTo(event.target.value)}
          >
            {allEntities.map((entity) => (
              <option key={entity.tableName} value={entity.tableName}>
                {entity.tableName}
              </option>
            ))}
          </select>
          <div className="text-xs text-muted-foreground">
            {pathResult.length > 0 ? pathResult.join(' → ') : 'No path found'}
          </div>
        </div>
      </div>

      {/* React Flow Canvas */}
      <div className="flex-1 border rounded-lg overflow-hidden">
        <ReactFlow
          nodes={nodes}
          edges={edges}
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
          <p className="text-xs text-muted-foreground mb-4">
            Focused view shows {visibleEntities.length} tables and {edges.length} relationships.
          </p>

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
