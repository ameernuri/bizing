import { getTableConfig } from 'drizzle-orm/pg-core'
import dbPackage from '@bizing/db'

type SchemaRelationshipType = '1:N' | '1:1' | 'N:1'

export interface SchemaGraphColumn {
  name: string
  type: string
  nullable: boolean
  primaryKey: boolean
}

export interface SchemaGraphRelationship {
  type: SchemaRelationshipType
  to: string
  field: string
  description: string
}

export interface SchemaGraphEntity {
  name: string
  tableName: string
  columns: SchemaGraphColumn[]
  relationships: SchemaGraphRelationship[]
}

export interface SchemaGraphNode {
  id: string
  type: 'entityNode'
  position: { x: number; y: number }
  data: { entity: SchemaGraphEntity }
}

export interface SchemaGraphEdge {
  id: string
  source: string
  target: string
  sourceHandle: string
  targetHandle: string
  label: string
  type: 'smoothstep'
  animated: boolean
}

export interface SchemaGraphSummary {
  totalEntities: number
  totalColumns: number
  totalRelationships: number
  totalPrimaryKeys: number
}

export interface SchemaGraphResponse {
  entities: SchemaGraphEntity[]
  nodes: SchemaGraphNode[]
  edges: SchemaGraphEdge[]
  summary: SchemaGraphSummary
}

let schemaGraphCache: SchemaGraphResponse | null = null

function toEntityName(tableName: string): string {
  return tableName
    .split('_')
    .filter(Boolean)
    .map((segment) => segment[0].toUpperCase() + segment.slice(1))
    .join(' ')
}

function readTableConfig(value: unknown): ReturnType<typeof getTableConfig> | null {
  try {
    return getTableConfig(value as never)
  } catch {
    return null
  }
}

export function getSchemaGraph(): SchemaGraphResponse {
  if (schemaGraphCache) {
    return schemaGraphCache
  }

  const { db } = dbPackage
  const byTableName = new Map<string, ReturnType<typeof getTableConfig>>()
  const fullSchema = (
    (db as unknown as { _: { fullSchema?: Record<string, unknown> } })._?.fullSchema ?? {}
  ) as Record<string, unknown>
  for (const value of Object.values(fullSchema)) {
    const config = readTableConfig(value)
    if (!config || !config.name || byTableName.has(config.name)) {
      continue
    }
    byTableName.set(config.name, config)
  }

  const tableNames = Array.from(byTableName.keys()).sort((a, b) => a.localeCompare(b))
  const outgoing = new Map<string, SchemaGraphRelationship[]>()
  const incoming = new Map<string, SchemaGraphRelationship[]>()
  const edges: SchemaGraphEdge[] = []

  for (const tableName of tableNames) {
    const config = byTableName.get(tableName)
    if (!config) continue

    config.foreignKeys.forEach((foreignKey, fkIndex) => {
      const reference = foreignKey.reference()
      const foreignTable = readTableConfig(reference.foreignTable)
      if (!foreignTable) return

      const localColumnNames = reference.columns.map((column) => column.name)
      const foreignColumnNames = reference.foreignColumns.map((column) => column.name)
      const localFields = localColumnNames.join(', ')
      const foreignFields = foreignColumnNames.join(', ')
      const outgoingRelationship: SchemaGraphRelationship = {
        type: 'N:1',
        to: toEntityName(foreignTable.name),
        field: localFields,
        description: `${tableName}.${localFields} -> ${foreignTable.name}.${foreignFields}`,
      }
      const incomingRelationship: SchemaGraphRelationship = {
        type: '1:N',
        to: toEntityName(tableName),
        field: foreignFields,
        description: `Referenced by ${tableName}.${localFields}`,
      }

      outgoing.set(tableName, [...(outgoing.get(tableName) ?? []), outgoingRelationship])
      incoming.set(foreignTable.name, [...(incoming.get(foreignTable.name) ?? []), incomingRelationship])

      const edgeIdSeed =
        reference.name ?? `${tableName}_${foreignTable.name}_${localColumnNames.join('_')}_${fkIndex}`
      edges.push({
        id: `fk_${edgeIdSeed}`.replace(/[^a-zA-Z0-9_:.-]/g, '_'),
        source: tableName,
        target: foreignTable.name,
        sourceHandle: 'source-1',
        targetHandle: 'target-1',
        label: 'N:1',
        type: 'smoothstep',
        animated: false,
      })
    })
  }

  const entities: SchemaGraphEntity[] = tableNames.map((tableName) => {
    const config = byTableName.get(tableName)!
    const columns: SchemaGraphColumn[] = config.columns.map((column) => ({
      name: column.name,
      type: typeof column.getSQLType === 'function' ? column.getSQLType() : column.columnType,
      nullable: !column.notNull,
      primaryKey: column.primary,
    }))

    return {
      name: toEntityName(tableName),
      tableName,
      columns,
      relationships: [...(outgoing.get(tableName) ?? []), ...(incoming.get(tableName) ?? [])],
    }
  })

  const columnsPerRow = Math.max(1, Math.ceil(Math.sqrt(entities.length)))
  const nodes: SchemaGraphNode[] = entities.map((entity, index) => {
    const row = Math.floor(index / columnsPerRow)
    const col = index % columnsPerRow
    return {
      id: entity.tableName,
      type: 'entityNode',
      position: {
        x: 60 + col * 360,
        y: 60 + row * 240,
      },
      data: { entity },
    }
  })

  const summary: SchemaGraphSummary = {
    totalEntities: entities.length,
    totalColumns: entities.reduce((sum, entity) => sum + entity.columns.length, 0),
    totalRelationships: edges.length,
    totalPrimaryKeys: entities.reduce(
      (sum, entity) => sum + entity.columns.filter((column) => column.primaryKey).length,
      0,
    ),
  }

  schemaGraphCache = {
    entities,
    nodes,
    edges,
    summary,
  }

  const timestamp = new Date().toISOString().split('T')[1].split('.')[0]
  console.log(
    `[${timestamp}] Schema graph cached: ${summary.totalEntities} entities, ${summary.totalColumns} columns, ${summary.totalRelationships} relationships`,
  )
  return schemaGraphCache
}

