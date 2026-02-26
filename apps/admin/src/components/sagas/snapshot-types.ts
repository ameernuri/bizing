'use client'

export type SnapshotTone = 'default' | 'success' | 'warning' | 'error' | 'info'

export type SnapshotBlock =
  | {
      type: 'alert'
      title: string
      message?: string
      tone?: SnapshotTone
    }
  | {
      type: 'stats'
      title?: string
      items: Array<{ label: string; value: string; hint?: string }>
    }
  | {
      type: 'key_value'
      title?: string
      items: Array<{ label: string; value: string }>
    }
  | {
      type: 'table'
      title?: string
      columns: string[]
      rows: Array<Array<string | number | boolean | null>>
      emptyMessage?: string
    }
  | {
      type: 'list'
      title?: string
      emptyMessage?: string
      items: Array<{ primary: string; secondary?: string; detail?: string; badges?: string[] }>
    }
  | {
      type: 'actions'
      title?: string
      items: Array<{ label: string; kind?: 'primary' | 'secondary' | 'danger'; enabled?: boolean }>
    }
  | {
      type: 'form'
      title?: string
      fields: Array<{ label: string; value?: string; state?: 'default' | 'success' | 'warning' | 'error'; hint?: string }>
      submitLabel?: string
    }
  | {
      type: 'calendar'
      title?: string
      timezone?: string
      rangeLabel?: string
      events: Array<{
        timeRange: string
        title: string
        status: 'available' | 'booked' | 'blocked' | 'hold' | 'unavailable' | 'unknown'
        detail?: string
      }>
    }
  | {
      type: 'raw_json'
      title?: string
      data: Record<string, unknown>
    }

export type SnapshotDocument = {
  schemaVersion?: string
  screenKey?: string
  title?: string
  generatedAt?: string
  stepKey?: string
  actorKey?: string
  status?: string
  rawData?: Record<string, unknown>
  view?: {
    route?: string
    title?: string
    subtitle?: string
    blocks?: SnapshotBlock[]
  }
  data?: Record<string, unknown>
  metadata?: Record<string, unknown>
}

export type NormalizedSnapshot = {
  schemaVersion: 'snapshot.v1'
  screenKey: string
  title: string
  generatedAt?: string
  stepKey?: string
  actorKey?: string
  status?: string
  rawData?: Record<string, unknown>
  view: {
    route?: string
    title?: string
    subtitle?: string
    blocks: SnapshotBlock[]
  }
}

function toTitleCase(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (ch) => ch.toUpperCase())
}

function asString(value: unknown): string {
  if (value === null || value === undefined) return 'null'
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function scalarValue(value: unknown): string | number | boolean | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value
  }
  return asString(value)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isLikelyInternalIdKey(key: string): boolean {
  if (/reference/i.test(key)) return false
  return /(^id$|_id$|Id$)/.test(key)
}

function prioritizeColumns(keys: string[]): string[] {
  const scored = keys.map((key) => ({
    key,
    score: isLikelyInternalIdKey(key) ? 2 : 1,
  }))
  scored.sort((a, b) => a.score - b.score)
  return scored.map((entry) => entry.key)
}

function toneFromStatus(status?: string): SnapshotTone {
  if (status === 'passed') return 'success'
  if (status === 'failed' || status === 'blocked') return 'error'
  if (status === 'skipped') return 'warning'
  return 'info'
}

function fromLegacyData(input: SnapshotDocument): NormalizedSnapshot {
  const data = input.data ?? {}
  const status = typeof data.status === 'string' ? data.status : input.status
  const note = typeof data.note === 'string' ? data.note : undefined
  const blocks: SnapshotBlock[] = []

  blocks.push({
    type: 'alert',
    title: status ? `Step status: ${status}` : 'Step result',
    message: note,
    tone: toneFromStatus(status),
  })

  const evidence = isRecord(data.evidence) ? data.evidence : null
  const visibleActions =
    Array.isArray(data.visibleActions)
      ? data.visibleActions
      : evidence && Array.isArray(evidence.visibleActions)
        ? evidence.visibleActions
        : []
  if (evidence) {
    const entries = Object.entries(evidence)
    const metrics = entries.filter(([key]) => /count$|minor$|total$/i.test(key))
    if (metrics.length > 0) {
      blocks.push({
        type: 'stats',
        title: 'Key Metrics',
        items: metrics.slice(0, 8).map(([key, value]) => ({
          label: toTitleCase(key),
          value: asString(value),
        })),
      })
    }

    const scalarItems = entries
      .filter(([key, value]) => {
        if (isLikelyInternalIdKey(key)) return false
        return value === null || typeof value !== 'object'
      })
      .slice(0, 20)
      .map(([key, value]) => ({
        label: toTitleCase(key),
        value: asString(value),
      }))
    if (scalarItems.length > 0) {
      blocks.push({
        type: 'key_value',
        title: 'Details',
        items: scalarItems,
      })
    }

    const tableEntry = entries.find(
      ([, value]) =>
        Array.isArray(value) &&
        value.length > 0 &&
        value.every((row) => row && typeof row === 'object' && !Array.isArray(row)),
    )
    if (tableEntry) {
      const [tableKey, rawRows] = tableEntry
      const rows = rawRows as Array<Record<string, unknown>>
      const allColumns = Array.from(
        rows.reduce((acc, row) => {
          Object.keys(row).forEach((column) => acc.add(column))
          return acc
        }, new Set<string>()),
      )
      const columns = prioritizeColumns(allColumns).slice(0, 8)
      blocks.push({
        type: 'table',
        title: toTitleCase(tableKey),
        columns,
        rows: rows.slice(0, 20).map((row) => columns.map((column) => scalarValue(row[column]))),
      })
    }
  }

  if (visibleActions.length > 0) {
    const actionItems = visibleActions
      .slice(0, 8)
      .map((value) => asString(value))
      .filter((label) => label.length > 0)
      .map((label) => ({
        label,
        kind: 'secondary' as const,
        enabled: true,
      }))

    if (actionItems.length > 0) {
      blocks.push({
        type: 'actions',
        title: 'Visible actions',
        items: actionItems,
      })
    }
  }

  if (blocks.length === 0) {
    blocks.push({
      type: 'raw_json',
      title: 'Raw payload',
      data,
    })
  }

  return {
    schemaVersion: 'snapshot.v1',
    screenKey: input.screenKey || 'screen',
    title: input.title || toTitleCase(input.stepKey || 'Saga Screen'),
    generatedAt: input.generatedAt,
    stepKey: input.stepKey,
    actorKey: input.actorKey,
    status,
    rawData: input.rawData,
    view: {
      title: input.title,
      subtitle: note,
      blocks,
    },
  }
}

export function normalizeSnapshotDocument(input: SnapshotDocument): NormalizedSnapshot {
  const hasV1Blocks = Array.isArray(input.view?.blocks) && input.view.blocks.length > 0
  if (!hasV1Blocks) {
    return fromLegacyData(input)
  }

  return {
    schemaVersion: 'snapshot.v1',
    screenKey: input.screenKey || 'screen',
    title: input.title || input.view?.title || 'Pseudoshot',
    generatedAt: input.generatedAt,
    stepKey: input.stepKey,
    actorKey: input.actorKey,
    status: input.status,
    rawData: input.rawData,
    view: {
      route: input.view?.route,
      title: input.view?.title,
      subtitle: input.view?.subtitle,
      blocks: input.view?.blocks || [],
    },
  }
}
