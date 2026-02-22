'use client'

import { Handle, Position, NodeProps } from '@xyflow/react'

interface EntityColumn {
  name: string
  type: string
  nullable: boolean
  primaryKey: boolean
}

interface EntityRelationship {
  type: string
  to: string
  field: string
  description: string
}

export function EntityNode(props: NodeProps) {
  const entity = props.data?.entity as { 
    name: string
    tableName: string
    columns: EntityColumn[]
    relationships: EntityRelationship[]
  } | undefined

  if (!entity) {
    return (
      <div className="min-w-64 bg-card rounded-lg shadow-md border border-border/30 p-4">
        <span className="text-muted-foreground text-sm">Loading...</span>
      </div>
    )
  }

  return (
    <div className="min-w-64 bg-card rounded-lg shadow-md border border-border/30 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary to-purple-600 px-4 py-2">
        <h3 className="font-bold text-primary-foreground text-sm">{entity.name}</h3>
        <p className="text-primary-foreground/70 text-xs">{entity.tableName}</p>
      </div>

      {/* Columns */}
      <div className="p-2">
        {entity.columns.slice(0, 6).map((col: EntityColumn) => (
          <div key={col.name} className="flex items-center justify-between py-1 text-xs">
            <div className="flex items-center gap-1">
              {col.primaryKey && (
                <span className="text-yellow-500">🔑</span>
              )}
              <span className={col.primaryKey ? 'font-semibold text-foreground' : 'text-muted-foreground'}>
                {col.name}
              </span>
            </div>
            <span className="text-muted-foreground/70 text-xs">{col.type.split('(')[0]}</span>
          </div>
        ))}
        {entity.columns.length > 6 && (
          <p className="text-muted-foreground/70 text-xs text-center py-1">
            +{entity.columns.length - 6} more
          </p>
        )}
      </div>

      {/* Handles */}
      <Handle
        id="source-1"
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-primary"
        style={{ top: '40%' }}
      />
      <Handle
        id="source-2"
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-primary"
        style={{ top: '60%' }}
      />
      <Handle
        id="target-1"
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-purple-500"
        style={{ top: '30%' }}
      />
      <Handle
        id="target-2"
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-purple-500"
        style={{ top: '70%' }}
      />
    </div>
  )
}
