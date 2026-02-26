import { z } from 'zod'

/**
 * Canonical "pseudo screenshot" schema.
 *
 * ELI5:
 * A snapshot is a low-fi, structured version of "what the user saw".
 * Instead of storing random JSON blobs, we store typed UI blocks
 * (alerts, forms, tables, calendars, lists...) so the admin UI can render
 * something that feels like a screenshot while still being machine-readable.
 */

const scalarSchema = z.union([z.string(), z.number(), z.boolean(), z.null()])

const pseudoShotToneSchema = z.enum(['default', 'success', 'warning', 'error', 'info'])

const pseudoShotAlertBlockSchema = z.object({
  type: z.literal('alert'),
  title: z.string().min(1),
  message: z.string().optional(),
  tone: pseudoShotToneSchema.default('info'),
})

const pseudoShotStatsBlockSchema = z.object({
  type: z.literal('stats'),
  title: z.string().optional(),
  items: z
    .array(
      z.object({
        label: z.string().min(1),
        value: z.string().min(1),
        hint: z.string().optional(),
      }),
    )
    .min(1),
})

const pseudoShotKeyValueBlockSchema = z.object({
  type: z.literal('key_value'),
  title: z.string().optional(),
  items: z
    .array(
      z.object({
        label: z.string().min(1),
        value: z.string().min(1),
      }),
    )
    .min(1),
})

const pseudoShotTableBlockSchema = z.object({
  type: z.literal('table'),
  title: z.string().optional(),
  columns: z.array(z.string().min(1)).min(1),
  rows: z.array(z.array(scalarSchema)).default([]),
  emptyMessage: z.string().optional(),
})

const pseudoShotListBlockSchema = z.object({
  type: z.literal('list'),
  title: z.string().optional(),
  emptyMessage: z.string().optional(),
  items: z
    .array(
      z.object({
        primary: z.string().min(1),
        secondary: z.string().optional(),
        detail: z.string().optional(),
        badges: z.array(z.string().min(1)).default([]),
      }),
    )
    .default([]),
})

const pseudoShotActionsBlockSchema = z.object({
  type: z.literal('actions'),
  title: z.string().optional(),
  items: z
    .array(
      z.object({
        label: z.string().min(1),
        kind: z.enum(['primary', 'secondary', 'danger']).default('secondary'),
        enabled: z.boolean().default(true),
      }),
    )
    .min(1),
})

const pseudoShotFormBlockSchema = z.object({
  type: z.literal('form'),
  title: z.string().optional(),
  fields: z
    .array(
      z.object({
        label: z.string().min(1),
        value: z.string().optional(),
        state: z.enum(['default', 'success', 'warning', 'error']).default('default'),
        hint: z.string().optional(),
      }),
    )
    .min(1),
  submitLabel: z.string().optional(),
})

const pseudoShotCalendarBlockSchema = z.object({
  type: z.literal('calendar'),
  title: z.string().optional(),
  timezone: z.string().optional(),
  rangeLabel: z.string().optional(),
  events: z
    .array(
      z.object({
        timeRange: z.string().min(1),
        title: z.string().min(1),
        status: z.enum(['available', 'booked', 'blocked', 'hold', 'unavailable', 'unknown']),
        detail: z.string().optional(),
      }),
    )
    .default([]),
})

const pseudoShotRawJsonBlockSchema = z.object({
  type: z.literal('raw_json'),
  title: z.string().optional(),
  data: z.record(z.unknown()),
})

export const pseudoShotBlockSchema = z.discriminatedUnion('type', [
  pseudoShotAlertBlockSchema,
  pseudoShotStatsBlockSchema,
  pseudoShotKeyValueBlockSchema,
  pseudoShotTableBlockSchema,
  pseudoShotListBlockSchema,
  pseudoShotActionsBlockSchema,
  pseudoShotFormBlockSchema,
  pseudoShotCalendarBlockSchema,
  pseudoShotRawJsonBlockSchema,
])

export const pseudoShotViewSchema = z.object({
  route: z.string().optional(),
  title: z.string().optional(),
  subtitle: z.string().optional(),
  blocks: z.array(pseudoShotBlockSchema).min(1),
})

export const pseudoShotDocumentSchema = z.object({
  schemaVersion: z.literal('snapshot.v1'),
  screenKey: z.string().min(1),
  title: z.string().min(1),
  generatedAt: z.string().datetime(),
  stepKey: z.string().optional(),
  actorKey: z.string().optional(),
  status: z.enum(['pending', 'in_progress', 'passed', 'failed', 'blocked', 'skipped']).optional(),
  view: pseudoShotViewSchema,
  /**
   * Optional deep-inspection payload.
   *
   * ELI5:
   * `view` tells us what the user likely saw.
   * `rawData` keeps the underlying request/response-style payloads so a reviewer
   * can switch to exact JSON and audit details without losing visual context.
   */
  rawData: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).default({}),
})

/**
 * Input accepted by the API route.
 *
 * `view` is the preferred new shape.
 * `data` is kept for legacy agents; we normalize it into v1 blocks.
 */
export const pseudoShotInputSchema = z
  .object({
    stepKey: z.string().optional(),
    screenKey: z.string().min(1).optional(),
    title: z.string().min(1).optional(),
    format: z.enum(['json', 'yaml']).default('json'),
    status: z.enum(['pending', 'in_progress', 'passed', 'failed', 'blocked', 'skipped']).optional(),
    actorKey: z.string().optional(),
    route: z.string().optional(),
    view: pseudoShotViewSchema.optional(),
    data: z.record(z.unknown()).optional(),
    rawData: z.record(z.unknown()).optional(),
    metadata: z.record(z.unknown()).optional(),
  })
  .refine((payload) => Boolean(payload.view || payload.data), {
    message: 'Provide `view` (preferred) or legacy `data`.',
    path: ['view'],
  })

export type SnapshotBlock = z.infer<typeof pseudoShotBlockSchema>
export type SnapshotView = z.infer<typeof pseudoShotViewSchema>
export type SnapshotDocument = z.infer<typeof pseudoShotDocumentSchema>
export type SnapshotInput = z.infer<typeof pseudoShotInputSchema>

function toTitleCase(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (ch) => ch.toUpperCase())
}

function stringValue(value: unknown): string {
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
  return stringValue(value)
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

function detectTone(status: unknown): z.infer<typeof pseudoShotToneSchema> {
  if (status === 'passed') return 'success'
  if (status === 'failed' || status === 'blocked') return 'error'
  if (status === 'skipped') return 'warning'
  if (status === 'in_progress') return 'info'
  return 'default'
}

function buildLegacyView(data: Record<string, unknown>, route?: string): SnapshotView {
  const blocks: SnapshotBlock[] = []
  const status = data.status
  const note = typeof data.note === 'string' ? data.note : undefined

  if (typeof status === 'string' || note) {
    blocks.push({
      type: 'alert',
      title: typeof status === 'string' ? `Step status: ${status}` : 'Step result',
      message: note,
      tone: detectTone(status),
    })
  }

  const evidence = isRecord(data.evidence) ? data.evidence : null
  const visibleActions =
    Array.isArray(data.visibleActions)
      ? data.visibleActions
      : evidence && Array.isArray(evidence.visibleActions)
        ? evidence.visibleActions
        : []
  if (evidence) {
    const entries = Object.entries(evidence)
    const stats = entries.filter((entry) => /count$|minor$|total$/i.test(entry[0]))
    if (stats.length > 0) {
      blocks.push({
        type: 'stats',
        title: 'Key Metrics',
        items: stats.slice(0, 8).map(([key, value]) => ({
          label: toTitleCase(key),
          value: stringValue(value),
        })),
      })
    }

    const tableEntry = entries.find(
      ([, value]) =>
        Array.isArray(value) && value.length > 0 && value.every((item) => isRecord(item)),
    )
    if (tableEntry) {
      const [tableKey, rawRows] = tableEntry
      const rows = rawRows as Array<Record<string, unknown>>
      const allColumns = Array.from(
        rows.reduce((acc, row) => {
          Object.keys(row).forEach((key) => acc.add(key))
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

    const scalarItems = entries
      .filter(([key, value]) => {
        if (isLikelyInternalIdKey(key)) return false
        return !Array.isArray(value) && (value === null || typeof value !== 'object')
      })
      .slice(0, 20)
      .map(([key, value]) => ({
        label: toTitleCase(key),
        value: stringValue(value),
      }))
    if (scalarItems.length > 0) {
      blocks.push({
        type: 'key_value',
        title: 'Details',
        items: scalarItems,
      })
    }
  }

  if (visibleActions.length > 0) {
    const actionItems = visibleActions
      .slice(0, 8)
      .map((value) => stringValue(value))
      .filter((label) => label.length > 0)
      .map((label) => ({
        label,
        kind: 'secondary' as const,
        enabled: true,
      }))

    if (actionItems.length > 0) {
      blocks.push({
        type: 'actions',
        title: 'Visible Actions',
        items: actionItems,
      })
    }
  }

  if (blocks.length === 0) {
    blocks.push({
      type: 'raw_json',
      title: 'Raw Payload',
      data,
    })
  }

  return {
    route,
    title: typeof data.page === 'string' ? toTitleCase(data.page) : undefined,
    subtitle: typeof data.note === 'string' ? data.note : undefined,
    blocks,
  }
}

export function normalizeSnapshotInput(input: SnapshotInput): SnapshotDocument {
  const screenKey = input.screenKey || `${input.stepKey || 'screen'}-${Date.now()}`
  const generatedAt = new Date().toISOString()
  const view = input.view ?? buildLegacyView(input.data ?? {}, input.route)

  const title =
    input.title ||
    view.title ||
    (input.stepKey ? `${toTitleCase(input.stepKey)} Screen` : 'Saga Pseudoshot')

  return pseudoShotDocumentSchema.parse({
    schemaVersion: 'snapshot.v1',
    screenKey,
    title,
    generatedAt,
    stepKey: input.stepKey,
    actorKey: input.actorKey,
    status: input.status,
    view,
    rawData: input.rawData ?? (input.data ? { legacyPayload: input.data } : undefined),
    metadata: input.metadata ?? {},
  })
}
