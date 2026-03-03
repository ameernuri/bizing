import { Hono } from 'hono'
import { and, asc, count, desc, eq, ilike, inArray, sql } from 'drizzle-orm'
import { z } from 'zod'
import dbPackage from '@bizing/db'
import { getCurrentUser, requireAuth } from '../middleware/auth.js'
import { executeCrudRouteAction } from '../services/action-route-bridge.js'
import { fail, ok, parsePositiveInt } from './_api.js'
import { createSagaRun, getSagaRunDetail } from '../services/sagas.js'
import { chatWithLLM } from '../services/llm.js'
import { publishSagaRuntimeEvent } from '../services/saga-events.js'
import { executeExistingSagaRun } from '../scripts/rerun-sagas.js'

const {
  db,
  oodaLoops,
  oodaLoopLinks,
  oodaLoopEntries,
  oodaLoopActions,
  sagaRuns,
  sagaUseCases,
  sagaPersonas,
  sagaDefinitions,
} = dbPackage

const listLoopsQuerySchema = z.object({
  status: z.enum(['draft', 'active', 'paused', 'completed', 'archived']).optional(),
  query: z.string().optional(),
  limit: z.string().optional(),
})

const createLoopBodySchema = z.object({
  loopKey: z.string().min(1).max(160).optional(),
  title: z.string().min(1).max(255),
  objective: z.string().optional().nullable(),
  status: z.enum(['draft', 'active', 'paused', 'completed', 'archived']).optional(),
  currentPhase: z.enum(['observe', 'orient', 'decide', 'act']).optional(),
  designGateStatus: z.enum(['pending', 'passed', 'failed']).optional(),
  behaviorGateStatus: z.enum(['pending', 'passed', 'failed']).optional(),
  priority: z.number().int().min(1).max(100).optional(),
  bizId: z.string().optional().nullable(),
  ownerUserId: z.string().optional().nullable(),
  healthScore: z.number().int().min(0).max(100).optional(),
  nextReviewAt: z.string().datetime().optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
})

const updateLoopBodySchema = createLoopBodySchema.partial()

const createLoopLinkBodySchema = z.object({
  targetType: z.enum([
    'use_case',
    'persona',
    'saga_definition',
    'saga_run',
    'saga_step',
    'coverage_report',
    'coverage_item',
    'note',
  ]),
  targetId: z.string().min(1),
  relationRole: z.enum(['focus', 'input', 'output', 'dependency', 'evidence']).default('focus'),
  metadata: z.record(z.unknown()).optional(),
})

const listEntriesQuerySchema = z.object({
  phase: z.enum(['observe', 'orient', 'decide', 'act']).optional(),
  limit: z.string().optional(),
})

const createEntryBodySchema = z.object({
  phase: z.enum(['observe', 'orient', 'decide', 'act']),
  entryType: z.enum(['signal', 'hypothesis', 'decision', 'action_plan', 'result', 'postmortem']),
  title: z.string().min(1).max(255),
  bodyMarkdown: z.string().optional().nullable(),
  severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  status: z.enum(['open', 'accepted', 'rejected', 'resolved', 'blocked']).optional(),
  gapType: z
    .enum([
      'pnp_gap',
      'uc_gap',
      'persona_gap',
      'schema_gap',
      'api_gap',
      'workflow_gap',
      'policy_gap',
      'event_gap',
      'audit_gap',
      'test_pack_gap',
      'docs_gap',
    ])
    .optional()
    .nullable(),
  owningLayer: z
    .enum([
      'pnp',
      'uc',
      'persona',
      'schema',
      'api',
      'workflow',
      'policy',
      'event',
      'audit',
      'test_pack',
      'docs',
      'ops',
    ])
    .optional()
    .nullable(),
  sourceType: z.enum(['manual', 'saga_run', 'api', 'system', 'llm']).optional(),
  sourceRefId: z.string().optional().nullable(),
  linkedUseCaseId: z.string().optional().nullable(),
  linkedSagaDefinitionId: z.string().optional().nullable(),
  linkedSagaRunId: z.string().optional().nullable(),
  linkedSagaRunStepId: z.string().optional().nullable(),
  linkedCoverageItemId: z.string().optional().nullable(),
  evidence: z.record(z.unknown()).optional(),
  sortOrder: z.number().int().optional(),
})

const updateEntryBodySchema = createEntryBodySchema.partial()

const createActionBodySchema = z.object({
  oodaLoopEntryId: z.string().optional().nullable(),
  actionKey: z.string().min(1).max(160),
  actionTitle: z.string().min(1).max(255),
  status: z.enum(['queued', 'running', 'succeeded', 'failed', 'cancelled']).optional(),
  dryRun: z.boolean().optional(),
  assignedToUserId: z.string().optional().nullable(),
  linkedSagaRunId: z.string().optional().nullable(),
  requestPayload: z.record(z.unknown()).optional(),
  resultPayload: z.record(z.unknown()).optional(),
  errorMessage: z.string().optional().nullable(),
})

const updateActionBodySchema = createActionBodySchema.partial()

const createLoopRunBodySchema = z.object({
  sagaKey: z.string().min(1),
  mode: z.enum(['dry_run', 'live']).default('dry_run'),
  runnerLabel: z.string().max(160).optional(),
  autoExecute: z.boolean().default(true),
  bizId: z.string().optional(),
  oodaLoopEntryId: z.string().optional().nullable(),
  actionTitle: z.string().max(255).optional(),
  requestPayload: z.record(z.unknown()).optional(),
})

const generateBodySchema = z.object({
  kind: z.enum(['use_case', 'persona', 'saga_definition']),
  prompt: z.string().min(1),
  model: z.string().optional(),
  context: z.string().optional(),
})

type EntryEvidence = Record<string, unknown>
type OodaEntryType = z.infer<typeof createEntryBodySchema>['entryType']
type OodaEntryStatus = z.infer<typeof createEntryBodySchema>['status']

function hasAtLeastOneEvidenceAnchor(evidence: EntryEvidence): boolean {
  const anchorKeys = [
    'apiTraceRef',
    'apiTraceRefs',
    'snapshotRef',
    'snapshotRefs',
    'eventRef',
    'eventRefs',
    'auditRef',
    'auditRefs',
    'reportNote',
  ]
  return anchorKeys.some((key) => {
    const value = evidence[key]
    if (value === null || value === undefined) return false
    if (Array.isArray(value)) return value.length > 0
    if (typeof value === 'string') return value.trim().length > 0
    return true
  })
}

function hasApiTraceEvidence(evidence: EntryEvidence): boolean {
  const single = evidence.apiTraceRef
  if (typeof single === 'string' && single.trim().length > 0) return true
  const many = evidence.apiTraceRefs
  return Array.isArray(many) && many.length > 0
}

/**
 * Enforce the workflow's gap/evidence quality bar at OODA-entry write time.
 *
 * ELI5:
 * - gaps must have an owner layer
 * - important entries must carry concrete evidence pointers
 * - resolved result entries must include API-trace proof
 */
function validateLoopEntryContract(input: {
  gapType?: string | null
  owningLayer?: string | null
  entryType?: OodaEntryType
  status?: OodaEntryStatus
  evidence?: EntryEvidence
}) {
  if (input.gapType && !input.owningLayer) {
    return {
      ok: false as const,
      reason: 'Gap entries must include owningLayer (one primary owner per gap).',
      code: 'ENTRY_GAP_OWNER_REQUIRED',
    }
  }

  const evidence = input.evidence ?? {}
  const meaningfulEntryTypes = new Set(['signal', 'result', 'postmortem'])
  if (input.entryType && meaningfulEntryTypes.has(input.entryType)) {
    if (!hasAtLeastOneEvidenceAnchor(evidence)) {
      return {
        ok: false as const,
        reason:
          'Meaningful OODA entries require evidence anchors (api/snapshot/event/audit/report note).',
        code: 'ENTRY_EVIDENCE_REQUIRED',
      }
    }
  }

  if (input.entryType === 'result' && input.status === 'resolved') {
    if (!hasApiTraceEvidence(evidence)) {
      return {
        ok: false as const,
        reason: 'Resolved result entries must include API trace evidence references.',
        code: 'ENTRY_RESULT_TRACE_REQUIRED',
      }
    }
  }

  return { ok: true as const }
}

function normalizeLoopWorkflowMetadata(input: {
  existing?: Record<string, unknown> | null
  designGateStatus?: 'pending' | 'passed' | 'failed'
  behaviorGateStatus?: 'pending' | 'passed' | 'failed'
}) {
  const base = (input.existing ?? {}) as Record<string, unknown>
  const workflow =
    (base.workflowContract as Record<string, unknown> | undefined) ?? {}
  return {
    ...base,
    workflowContract: {
      ...workflow,
      designGateStatus: input.designGateStatus ?? workflow.designGateStatus ?? 'pending',
      behaviorGateStatus: input.behaviorGateStatus ?? workflow.behaviorGateStatus ?? 'pending',
    },
  }
}

function toLoopKey(title: string) {
  const base = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120)
  const suffix = crypto.randomUUID().slice(0, 8)
  return `loop-${base || 'untitled'}-${suffix}`
}

async function createOodaRow(
  c: Parameters<typeof executeCrudRouteAction>[0]['c'],
  bizId: string | null | undefined,
  tableKey: string,
  data: Record<string, unknown>,
  options?: {
    subjectType?: string
    subjectId?: string
    displayName?: string
    metadata?: Record<string, unknown>
  },
) {
  const result = await executeCrudRouteAction({
    c,
    bizId: bizId ?? null,
    tableKey,
    operation: 'create',
    data,
    subjectType: options?.subjectType,
    subjectId: options?.subjectId,
    displayName: options?.displayName,
    metadata: options?.metadata,
  })
  if (!result.ok) {
    return fail(c, result.code, result.message, result.httpStatus, result.details)
  }
  return result.row
}

async function updateOodaRow(
  c: Parameters<typeof executeCrudRouteAction>[0]['c'],
  bizId: string | null | undefined,
  tableKey: string,
  id: string,
  patch: Record<string, unknown>,
  options?: {
    subjectType?: string
    subjectId?: string
    displayName?: string
    metadata?: Record<string, unknown>
  },
) {
  const result = await executeCrudRouteAction({
    c,
    bizId: bizId ?? null,
    tableKey,
    operation: 'update',
    id,
    patch,
    subjectType: options?.subjectType,
    subjectId: options?.subjectId,
    displayName: options?.displayName,
    metadata: options?.metadata,
  })
  if (!result.ok) {
    return fail(c, result.code, result.message, result.httpStatus, result.details)
  }
  return result.row
}

/**
 * Safely extract a `runId` string from an action result payload.
 *
 * ELI5:
 * Some older rows were saved with `resultPayload.runId` but without
 * `linkedSagaRunId`. This helper lets us recover that linkage.
 */
function extractRunIdFromResultPayload(resultPayload: unknown): string | null {
  if (!resultPayload || typeof resultPayload !== 'object') return null
  const candidate = (resultPayload as Record<string, unknown>).runId
  return typeof candidate === 'string' && candidate.length > 0 ? candidate : null
}

/**
 * Ensure one canonical loop->run link exists.
 */
async function ensureLoopRunOutputLink(input: {
  c: Parameters<typeof executeCrudRouteAction>[0]['c']
  bizId?: string | null
  loopId: string
  runId: string
  actorUserId: string
}) {
  const existing = await db.query.oodaLoopLinks.findFirst({
    where: and(
      eq(oodaLoopLinks.oodaLoopId, input.loopId),
      eq(oodaLoopLinks.targetType, 'saga_run'),
      eq(oodaLoopLinks.targetId, input.runId),
      eq(oodaLoopLinks.relationRole, 'output'),
      sql`deleted_at IS NULL`,
    ),
  })
  if (existing) return existing

  const created = (await createOodaRow(
    input.c,
    input.bizId ?? null,
    'oodaLoopLinks',
    {
      oodaLoopId: input.loopId,
      targetType: 'saga_run',
      targetId: input.runId,
      relationRole: 'output',
      metadata: { source: 'ooda.loop.run' },
      createdBy: input.actorUserId,
      updatedBy: input.actorUserId,
    },
    {
      subjectType: 'ooda_loop_link',
      subjectId: input.runId,
      displayName: 'OODA Loop Output Link',
      metadata: { source: 'routes.ooda.ensureLoopRunOutputLink' },
    },
  )) as Record<string, unknown> | Response
  if (created instanceof Response) throw new Error('Failed to create OODA loop output link.')
  return created
}

/**
 * Repair legacy/broken loop records where run ids were stored only inside
 * payload JSON but not in canonical FK/link fields.
 *
 * ELI5:
 * This auto-heals old loop data so dashboards stop showing "stuck" state.
 */
async function reconcileLoopRunLinkage(input: {
  c: Parameters<typeof executeCrudRouteAction>[0]['c']
  bizId?: string | null
  loopId: string
  actorUserId: string
}) {
  const staleActions = await db
    .select()
    .from(oodaLoopActions)
    .where(
      and(
        eq(oodaLoopActions.oodaLoopId, input.loopId),
        sql`deleted_at IS NULL`,
        sql`${oodaLoopActions.linkedSagaRunId} IS NULL`,
      ),
    )
  for (const action of staleActions) {
    const runId = extractRunIdFromResultPayload(action.resultPayload)
    if (!runId) {
      const updated = await updateOodaRow(input.c, input.bizId ?? null, 'oodaLoopActions', action.id, {
        status: action.status === 'running' ? 'failed' : action.status,
        errorMessage:
          action.errorMessage ??
          'Action is missing run reference payload. Create a fresh run from this loop.',
        endedAt:
          action.status === 'running' && !action.endedAt ? new Date() : action.endedAt,
        updatedBy: input.actorUserId,
        updatedAt: new Date(),
      })
      if (updated instanceof Response) throw new Error('Failed to reconcile missing run id action.')
      continue
    }

    const run = await db.query.sagaRuns.findFirst({
      where: and(eq(sagaRuns.id, runId), sql`deleted_at IS NULL`),
    })
    if (!run) {
      const updated = await updateOodaRow(input.c, input.bizId ?? null, 'oodaLoopActions', action.id, {
        status: 'failed',
        errorMessage:
          'Linked saga run no longer exists (likely pruned during reset). Create a new run from this loop.',
        endedAt: action.endedAt ?? new Date(),
        updatedBy: input.actorUserId,
        updatedAt: new Date(),
        resultPayload: {
          ...(action.resultPayload as Record<string, unknown>),
          runId,
          staleRunReference: true,
        },
      })
      if (updated instanceof Response) throw new Error('Failed to mark stale run reference action.')
      continue
    }

    const updated = await updateOodaRow(input.c, input.bizId ?? null, 'oodaLoopActions', action.id, {
      linkedSagaRunId: runId,
      updatedBy: input.actorUserId,
      updatedAt: new Date(),
    })
    if (updated instanceof Response) throw new Error('Failed to update action linked saga run id.')

    await ensureLoopRunOutputLink({
      c: input.c,
      bizId: input.bizId,
      loopId: input.loopId,
      runId,
      actorUserId: input.actorUserId,
    })
  }

  const staleEntries = await db
    .select()
    .from(oodaLoopEntries)
    .where(
      and(
        eq(oodaLoopEntries.oodaLoopId, input.loopId),
        sql`deleted_at IS NULL`,
        eq(oodaLoopEntries.sourceType, 'saga_run'),
        sql`${oodaLoopEntries.linkedSagaRunId} IS NULL`,
      ),
    )
  for (const entry of staleEntries) {
    const runId = entry.sourceRefId
    if (!runId) continue
    const run = await db.query.sagaRuns.findFirst({
      where: and(eq(sagaRuns.id, runId), sql`deleted_at IS NULL`),
    })
    if (!run) continue

    const updated = await updateOodaRow(input.c, input.bizId ?? null, 'oodaLoopEntries', entry.id, {
      linkedSagaRunId: runId,
      updatedBy: input.actorUserId,
      updatedAt: new Date(),
    })
    if (updated instanceof Response) throw new Error('Failed to update entry linked saga run id.')

    await ensureLoopRunOutputLink({
      c: input.c,
      bizId: input.bizId,
      loopId: input.loopId,
      runId,
      actorUserId: input.actorUserId,
    })
  }
}

/**
 * OODA events piggyback on the existing saga websocket transport so dashboards
 * refresh in realtime without introducing a second socket protocol yet.
 */
function emitOodaRealtime(input: {
  loopId: string
  requestedByUserId: string
  eventType: 'run.created' | 'run.updated' | 'run.archived'
  payload?: Record<string, unknown>
}) {
  publishSagaRuntimeEvent({
    eventType: input.eventType,
    runId: `ooda:${input.loopId}`,
    requestedByUserId: input.requestedByUserId,
    status: 'ooda',
    payload: {
      domain: 'ooda',
      loopId: input.loopId,
      ...(input.payload ?? {}),
    },
  })
}

async function ensureLoopAccessible(loopId: string) {
  return db.query.oodaLoops.findFirst({
    where: and(eq(oodaLoops.id, loopId), sql`deleted_at IS NULL`),
  })
}

export const oodaRoutes = new Hono()

/**
 * OODA dashboard overview.
 *
 * ELI5:
 * Returns one compact payload that the dashboard can render immediately:
 * health, attention queue, and the latest active loops.
 */
oodaRoutes.get('/ooda/overview', requireAuth, async (c) => {
  const user = getCurrentUser(c)
  if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)

  const [loopCounts, sagaCounts, latestRuns, latestLoops, openEntryCounts] = await Promise.all([
    db
      .select({
        status: oodaLoops.status,
        count: count(),
      })
      .from(oodaLoops)
      .where(sql`deleted_at IS NULL`)
      .groupBy(oodaLoops.status),
    Promise.all([
      db.select({ count: count() }).from(sagaUseCases).where(sql`deleted_at IS NULL`),
      db.select({ count: count() }).from(sagaPersonas).where(sql`deleted_at IS NULL`),
      db.select({ count: count() }).from(sagaDefinitions).where(sql`deleted_at IS NULL`),
      db.select({ count: count() }).from(sagaRuns).where(sql`deleted_at IS NULL`),
    ]),
    db
      .select()
      .from(sagaRuns)
      .where(sql`deleted_at IS NULL`)
      .orderBy(
        desc(sql`COALESCE(${sagaRuns.lastHeartbeatAt}, ${sagaRuns.endedAt}, ${sagaRuns.startedAt})`),
        desc(sagaRuns.startedAt),
      )
      .limit(20),
    db
      .select()
      .from(oodaLoops)
      .where(sql`deleted_at IS NULL`)
      .orderBy(desc(oodaLoops.priority), desc(oodaLoops.updatedAt))
      .limit(20),
    db
      .select({ loopId: oodaLoopEntries.oodaLoopId, openCount: count() })
      .from(oodaLoopEntries)
      .where(
        and(
          sql`deleted_at IS NULL`,
          inArray(oodaLoopEntries.status, ['open', 'blocked']),
        ),
      )
      .groupBy(oodaLoopEntries.oodaLoopId),
  ])

  const byStatus = Object.fromEntries(loopCounts.map((row) => [row.status, row.count])) as Record<
    string,
    number
  >
  const openByLoop = new Map(openEntryCounts.map((row) => [row.loopId, row.openCount]))
  const totalLoops = loopCounts.reduce((sum, row) => sum + row.count, 0)
  const activeLoops = (byStatus.active ?? 0) + (byStatus.draft ?? 0) + (byStatus.paused ?? 0)
  const healthyRunCount = latestRuns.filter((run) => run.status === 'passed').length
  const coveragePct = latestRuns.length > 0 ? Math.round((healthyRunCount / latestRuns.length) * 100) : 0

  return ok(c, {
    health: {
      totalLoops,
      activeLoops,
      completedLoops: byStatus.completed ?? 0,
      archivedLoops: byStatus.archived ?? 0,
      sagaCoveragePct: coveragePct,
    },
    library: {
      useCases: sagaCounts[0][0]?.count ?? 0,
      personas: sagaCounts[1][0]?.count ?? 0,
      definitions: sagaCounts[2][0]?.count ?? 0,
      runs: sagaCounts[3][0]?.count ?? 0,
    },
    recentRuns: latestRuns,
    activeLoops: latestLoops.map((loop) => ({
      ...loop,
      openItems: openByLoop.get(loop.id) ?? 0,
    })),
  })
})

oodaRoutes.get('/ooda/loops', requireAuth, async (c) => {
  const user = getCurrentUser(c)
  if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)
  const parsed = listLoopsQuerySchema.safeParse(c.req.query())
  if (!parsed.success) {
    return fail(c, 'VALIDATION_ERROR', 'Invalid query parameters.', 400, parsed.error.flatten())
  }
  const limit = Math.min(parsePositiveInt(parsed.data.limit, 200), 2000)
  const rows = await db
    .select()
    .from(oodaLoops)
    .where(
      and(
        sql`deleted_at IS NULL`,
        parsed.data.status ? eq(oodaLoops.status, parsed.data.status) : undefined,
        parsed.data.query
          ? sql`${oodaLoops.title} ILIKE ${`%${parsed.data.query}%`} OR ${oodaLoops.loopKey} ILIKE ${`%${parsed.data.query}%`}`
          : undefined,
      ),
    )
    .orderBy(desc(oodaLoops.priority), desc(oodaLoops.updatedAt), asc(oodaLoops.title))
    .limit(limit)
  return ok(c, rows)
})

oodaRoutes.post('/ooda/loops', requireAuth, async (c) => {
  const user = getCurrentUser(c)
  if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)
  const body = await c.req.json().catch(() => null)
  const parsed = createLoopBodySchema.safeParse(body)
  if (!parsed.success) {
    return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  }

  const created = (await createOodaRow(
    c,
    parsed.data.bizId ?? null,
    'oodaLoops',
    {
      loopKey: parsed.data.loopKey ?? toLoopKey(parsed.data.title),
      title: parsed.data.title,
      objective: parsed.data.objective ?? null,
      status: parsed.data.status ?? 'active',
      currentPhase: parsed.data.currentPhase ?? 'observe',
      priority: parsed.data.priority ?? 50,
      bizId: parsed.data.bizId ?? null,
      ownerUserId: parsed.data.ownerUserId ?? user.id,
      healthScore: parsed.data.healthScore ?? 0,
      nextReviewAt: parsed.data.nextReviewAt ? new Date(parsed.data.nextReviewAt) : null,
      metadata: normalizeLoopWorkflowMetadata({
        existing: parsed.data.metadata ?? {},
        designGateStatus: parsed.data.designGateStatus,
        behaviorGateStatus: parsed.data.behaviorGateStatus,
      }),
      createdBy: user.id,
      updatedBy: user.id,
    },
    {
      subjectType: 'ooda_loop',
      displayName: parsed.data.title,
      metadata: { source: 'routes.ooda.createLoop' },
    },
  )) as Record<string, unknown> | Response
  if (created instanceof Response) return created
  emitOodaRealtime({
    loopId: String(created.id),
    requestedByUserId: user.id,
    eventType: 'run.created',
    payload: { entity: 'loop' },
  })

  return ok(c, created, 201)
})

oodaRoutes.get('/ooda/loops/:loopId', requireAuth, async (c) => {
  const user = getCurrentUser(c)
  if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)
  const loopId = c.req.param('loopId')
  const loop = await ensureLoopAccessible(loopId)
  if (!loop) return fail(c, 'NOT_FOUND', 'OODA loop not found.', 404)

  await reconcileLoopRunLinkage({
    c,
    bizId: loop.bizId ?? null,
    loopId,
    actorUserId: user.id,
  })

  const [links, entries, actions] = await Promise.all([
    db.select().from(oodaLoopLinks).where(and(eq(oodaLoopLinks.oodaLoopId, loopId), sql`deleted_at IS NULL`)),
    db
      .select()
      .from(oodaLoopEntries)
      .where(and(eq(oodaLoopEntries.oodaLoopId, loopId), sql`deleted_at IS NULL`))
      .orderBy(asc(oodaLoopEntries.sortOrder), asc(oodaLoopEntries.createdAt)),
    db
      .select()
      .from(oodaLoopActions)
      .where(and(eq(oodaLoopActions.oodaLoopId, loopId), sql`deleted_at IS NULL`))
      .orderBy(desc(oodaLoopActions.createdAt)),
  ])

  return ok(c, { loop, links, entries, actions })
})

oodaRoutes.patch('/ooda/loops/:loopId', requireAuth, async (c) => {
  const user = getCurrentUser(c)
  if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)
  const body = await c.req.json().catch(() => null)
  const parsed = updateLoopBodySchema.safeParse(body)
  if (!parsed.success) {
    return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  }
  const loopId = c.req.param('loopId')
  const existing = await ensureLoopAccessible(loopId)
  if (!existing) return fail(c, 'NOT_FOUND', 'OODA loop not found.', 404)

  const updated = (await updateOodaRow(
    c,
    existing.bizId ?? null,
    'oodaLoops',
    loopId,
    {
      loopKey: parsed.data.loopKey ?? undefined,
      title: parsed.data.title ?? undefined,
      objective: parsed.data.objective ?? undefined,
      status: parsed.data.status ?? undefined,
      currentPhase: parsed.data.currentPhase ?? undefined,
      priority: parsed.data.priority ?? undefined,
      bizId: parsed.data.bizId ?? undefined,
      ownerUserId: parsed.data.ownerUserId ?? undefined,
      healthScore: parsed.data.healthScore ?? undefined,
      nextReviewAt:
        parsed.data.nextReviewAt === undefined
          ? undefined
          : parsed.data.nextReviewAt
            ? new Date(parsed.data.nextReviewAt)
            : null,
      metadata:
        parsed.data.metadata !== undefined ||
        parsed.data.designGateStatus !== undefined ||
        parsed.data.behaviorGateStatus !== undefined
          ? normalizeLoopWorkflowMetadata({
              existing:
                (parsed.data.metadata as Record<string, unknown> | undefined) ??
                ((existing.metadata as Record<string, unknown> | undefined) ?? {}),
              designGateStatus: parsed.data.designGateStatus,
              behaviorGateStatus: parsed.data.behaviorGateStatus,
            })
          : undefined,
      updatedBy: user.id,
      updatedAt: new Date(),
    },
    {
      subjectType: 'ooda_loop',
      subjectId: loopId,
      displayName: parsed.data.title ?? existing.title,
      metadata: { source: 'routes.ooda.updateLoop' },
    },
  )) as Record<string, unknown> | Response
  if (updated instanceof Response) return updated
  emitOodaRealtime({
    loopId,
    requestedByUserId: user.id,
    eventType: 'run.updated',
    payload: { entity: 'loop' },
  })

  return ok(c, updated)
})

oodaRoutes.delete('/ooda/loops/:loopId', requireAuth, async (c) => {
  const user = getCurrentUser(c)
  if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)
  const loopId = c.req.param('loopId')
  const loop = await ensureLoopAccessible(loopId)
  if (!loop) return fail(c, 'NOT_FOUND', 'OODA loop not found.', 404)

  const archived = await updateOodaRow(c, loop.bizId ?? null, 'oodaLoops', loopId, {
    status: 'archived',
    deletedAt: new Date(),
    deletedBy: user.id,
    updatedBy: user.id,
    updatedAt: new Date(),
  }, {
    subjectType: 'ooda_loop',
    subjectId: loopId,
    displayName: loop.title,
    metadata: { source: 'routes.ooda.archiveLoop' },
  })
  if (archived instanceof Response) return archived
  emitOodaRealtime({
    loopId,
    requestedByUserId: user.id,
    eventType: 'run.archived',
    payload: { entity: 'loop' },
  })

  return ok(c, { archived: true })
})

oodaRoutes.get('/ooda/loops/:loopId/links', requireAuth, async (c) => {
  const user = getCurrentUser(c)
  if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)
  const loopId = c.req.param('loopId')
  const loop = await ensureLoopAccessible(loopId)
  if (!loop) return fail(c, 'NOT_FOUND', 'OODA loop not found.', 404)

  const rows = await db
    .select()
    .from(oodaLoopLinks)
    .where(and(eq(oodaLoopLinks.oodaLoopId, loopId), sql`deleted_at IS NULL`))
    .orderBy(asc(oodaLoopLinks.relationRole), asc(oodaLoopLinks.createdAt))

  return ok(c, rows)
})

oodaRoutes.post('/ooda/loops/:loopId/links', requireAuth, async (c) => {
  const user = getCurrentUser(c)
  if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)
  const loopId = c.req.param('loopId')
  const loop = await ensureLoopAccessible(loopId)
  if (!loop) return fail(c, 'NOT_FOUND', 'OODA loop not found.', 404)

  const body = await c.req.json().catch(() => null)
  const parsed = createLoopLinkBodySchema.safeParse(body)
  if (!parsed.success) {
    return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  }

  const created = (await createOodaRow(
    c,
    loop.bizId ?? null,
    'oodaLoopLinks',
    {
      oodaLoopId: loopId,
      targetType: parsed.data.targetType,
      targetId: parsed.data.targetId,
      relationRole: parsed.data.relationRole,
      metadata: parsed.data.metadata ?? {},
      createdBy: user.id,
      updatedBy: user.id,
    },
    {
      subjectType: 'ooda_loop_link',
      subjectId: parsed.data.targetId,
      displayName: 'OODA Loop Link',
      metadata: { source: 'routes.ooda.createLink' },
    },
  )) as Record<string, unknown> | Response
  if (created instanceof Response) return created
  emitOodaRealtime({
    loopId,
    requestedByUserId: user.id,
    eventType: 'run.updated',
    payload: { entity: 'link' },
  })

  return ok(c, created, 201)
})

oodaRoutes.delete('/ooda/loops/:loopId/links/:linkId', requireAuth, async (c) => {
  const user = getCurrentUser(c)
  if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)
  const loopId = c.req.param('loopId')
  const linkId = c.req.param('linkId')
  const loop = await ensureLoopAccessible(loopId)
  if (!loop) return fail(c, 'NOT_FOUND', 'OODA loop not found.', 404)

  const target = await db.query.oodaLoopLinks.findFirst({
    where: and(eq(oodaLoopLinks.id, linkId), eq(oodaLoopLinks.oodaLoopId, loopId), sql`deleted_at IS NULL`),
  })
  if (!target) return fail(c, 'NOT_FOUND', 'OODA link not found.', 404)
  const updated = await updateOodaRow(
    c,
    loop.bizId ?? null,
    'oodaLoopLinks',
    linkId,
    {
      deletedAt: new Date(),
      deletedBy: user.id,
      updatedBy: user.id,
      updatedAt: new Date(),
    },
    {
      subjectType: 'ooda_loop_link',
      subjectId: String(target.targetId),
      displayName: 'OODA Loop Link',
      metadata: { source: 'routes.ooda.deleteLink' },
    },
  )

  if (updated instanceof Response) return updated
  emitOodaRealtime({
    loopId,
    requestedByUserId: user.id,
    eventType: 'run.updated',
    payload: { entity: 'link', deleted: true },
  })
  return ok(c, { deleted: true })
})

oodaRoutes.get('/ooda/loops/:loopId/entries', requireAuth, async (c) => {
  const user = getCurrentUser(c)
  if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)
  const loopId = c.req.param('loopId')
  const loop = await ensureLoopAccessible(loopId)
  if (!loop) return fail(c, 'NOT_FOUND', 'OODA loop not found.', 404)
  const parsed = listEntriesQuerySchema.safeParse(c.req.query())
  if (!parsed.success) {
    return fail(c, 'VALIDATION_ERROR', 'Invalid query parameters.', 400, parsed.error.flatten())
  }
  const limit = Math.min(parsePositiveInt(parsed.data.limit, 400), 2000)
  const rows = await db
    .select()
    .from(oodaLoopEntries)
    .where(
      and(
        eq(oodaLoopEntries.oodaLoopId, loopId),
        sql`deleted_at IS NULL`,
        parsed.data.phase ? eq(oodaLoopEntries.phase, parsed.data.phase) : undefined,
      ),
    )
    .orderBy(asc(oodaLoopEntries.sortOrder), asc(oodaLoopEntries.createdAt))
    .limit(limit)
  return ok(c, rows)
})

oodaRoutes.post('/ooda/loops/:loopId/entries', requireAuth, async (c) => {
  const user = getCurrentUser(c)
  if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)
  const loopId = c.req.param('loopId')
  const loop = await ensureLoopAccessible(loopId)
  if (!loop) return fail(c, 'NOT_FOUND', 'OODA loop not found.', 404)
  const body = await c.req.json().catch(() => null)
  const parsed = createEntryBodySchema.safeParse(body)
  if (!parsed.success) {
    return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  }

  {
    const contract = validateLoopEntryContract({
      gapType: parsed.data.gapType ?? null,
      owningLayer: parsed.data.owningLayer ?? null,
      entryType: parsed.data.entryType,
      status: parsed.data.status ?? 'open',
      evidence: parsed.data.evidence ?? {},
    })
    if (!contract.ok) {
      return fail(c, 'VALIDATION_ERROR', contract.reason, 400, { code: contract.code })
    }
  }

  const created = (await createOodaRow(
    c,
    loop.bizId ?? null,
    'oodaLoopEntries',
    {
      oodaLoopId: loopId,
      phase: parsed.data.phase,
      entryType: parsed.data.entryType,
      title: parsed.data.title,
      bodyMarkdown: parsed.data.bodyMarkdown ?? null,
      severity: parsed.data.severity ?? 'medium',
      status: parsed.data.status ?? 'open',
      gapType: parsed.data.gapType ?? null,
      sourceType: parsed.data.sourceType ?? 'manual',
      sourceRefId: parsed.data.sourceRefId ?? null,
      linkedUseCaseId: parsed.data.linkedUseCaseId ?? null,
      linkedSagaDefinitionId: parsed.data.linkedSagaDefinitionId ?? null,
      linkedSagaRunId: parsed.data.linkedSagaRunId ?? null,
      linkedSagaRunStepId: parsed.data.linkedSagaRunStepId ?? null,
      linkedCoverageItemId: parsed.data.linkedCoverageItemId ?? null,
      evidence: {
        ...(parsed.data.evidence ?? {}),
        owningLayer: parsed.data.owningLayer ?? null,
      },
      sortOrder: parsed.data.sortOrder ?? 0,
      createdBy: user.id,
      updatedBy: user.id,
    },
    {
      subjectType: 'ooda_loop_entry',
      displayName: parsed.data.title,
      metadata: { source: 'routes.ooda.createEntry' },
    },
  )) as Record<string, unknown> | Response
  if (created instanceof Response) return created

  const loopTouched = await updateOodaRow(c, loop.bizId ?? null, 'oodaLoops', loopId, {
    lastSignalAt: new Date(),
    updatedAt: new Date(),
    updatedBy: user.id,
  }, {
    subjectType: 'ooda_loop',
    subjectId: loopId,
    displayName: loop.title,
    metadata: { source: 'routes.ooda.touchLoopAfterEntry' },
  })
  if (loopTouched instanceof Response) return loopTouched
  emitOodaRealtime({
    loopId,
    requestedByUserId: user.id,
    eventType: 'run.updated',
    payload: { entity: 'entry' },
  })

  return ok(c, created, 201)
})

oodaRoutes.patch('/ooda/loops/:loopId/entries/:entryId', requireAuth, async (c) => {
  const user = getCurrentUser(c)
  if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)
  const loopId = c.req.param('loopId')
  const entryId = c.req.param('entryId')
  const loop = await ensureLoopAccessible(loopId)
  if (!loop) return fail(c, 'NOT_FOUND', 'OODA loop not found.', 404)
  const body = await c.req.json().catch(() => null)
  const parsed = updateEntryBodySchema.safeParse(body)
  if (!parsed.success) {
    return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  }
  const current = await db.query.oodaLoopEntries.findFirst({
    where: and(
      eq(oodaLoopEntries.id, entryId),
      eq(oodaLoopEntries.oodaLoopId, loopId),
      sql`deleted_at IS NULL`,
    ),
  })
  if (!current) return fail(c, 'NOT_FOUND', 'OODA entry not found.', 404)

  const nextGapType = parsed.data.gapType === undefined ? current.gapType : parsed.data.gapType
  const nextOwningLayer =
    parsed.data.owningLayer === undefined
      ? ((current.evidence as Record<string, unknown> | null)?.owningLayer as string | null) ?? null
      : parsed.data.owningLayer
  const nextEntryType = (parsed.data.entryType ?? current.entryType) as OodaEntryType
  const nextStatus = (parsed.data.status ?? current.status) as OodaEntryStatus
  const nextEvidence = (parsed.data.evidence ?? current.evidence ?? {}) as Record<string, unknown>

  {
    const contract = validateLoopEntryContract({
      gapType: nextGapType ?? null,
      owningLayer: nextOwningLayer ?? null,
      entryType: nextEntryType,
      status: nextStatus,
      evidence: nextEvidence,
    })
    if (!contract.ok) {
      return fail(c, 'VALIDATION_ERROR', contract.reason, 400, { code: contract.code })
    }
  }

  const updated = (await updateOodaRow(
    c,
    loop.bizId ?? null,
    'oodaLoopEntries',
    entryId,
    {
      phase: parsed.data.phase ?? undefined,
      entryType: parsed.data.entryType ?? undefined,
      title: parsed.data.title ?? undefined,
      bodyMarkdown: parsed.data.bodyMarkdown ?? undefined,
      severity: parsed.data.severity ?? undefined,
      status: parsed.data.status ?? undefined,
      gapType: parsed.data.gapType ?? undefined,
      sourceType: parsed.data.sourceType ?? undefined,
      sourceRefId: parsed.data.sourceRefId ?? undefined,
      linkedUseCaseId: parsed.data.linkedUseCaseId ?? undefined,
      linkedSagaDefinitionId: parsed.data.linkedSagaDefinitionId ?? undefined,
      linkedSagaRunId: parsed.data.linkedSagaRunId ?? undefined,
      linkedSagaRunStepId: parsed.data.linkedSagaRunStepId ?? undefined,
      linkedCoverageItemId: parsed.data.linkedCoverageItemId ?? undefined,
      evidence:
        parsed.data.evidence !== undefined || parsed.data.owningLayer !== undefined
          ? {
              ...((parsed.data.evidence ?? current.evidence ?? {}) as Record<string, unknown>),
              owningLayer: parsed.data.owningLayer ?? nextOwningLayer ?? null,
            }
          : undefined,
      sortOrder: parsed.data.sortOrder ?? undefined,
      updatedBy: user.id,
      updatedAt: new Date(),
    },
    {
      subjectType: 'ooda_loop_entry',
      subjectId: entryId,
      displayName: parsed.data.title ?? current.title,
      metadata: { source: 'routes.ooda.updateEntry' },
    },
  )) as Record<string, unknown> | Response
  if (updated instanceof Response) return updated
  emitOodaRealtime({
    loopId,
    requestedByUserId: user.id,
    eventType: 'run.updated',
    payload: { entity: 'entry' },
  })
  return ok(c, updated)
})

oodaRoutes.get('/ooda/loops/:loopId/actions', requireAuth, async (c) => {
  const user = getCurrentUser(c)
  if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)
  const loopId = c.req.param('loopId')
  const loop = await ensureLoopAccessible(loopId)
  if (!loop) return fail(c, 'NOT_FOUND', 'OODA loop not found.', 404)
  const rows = await db
    .select()
    .from(oodaLoopActions)
    .where(and(eq(oodaLoopActions.oodaLoopId, loopId), sql`deleted_at IS NULL`))
    .orderBy(desc(oodaLoopActions.createdAt))
  return ok(c, rows)
})

oodaRoutes.post('/ooda/loops/:loopId/actions', requireAuth, async (c) => {
  const user = getCurrentUser(c)
  if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)
  const loopId = c.req.param('loopId')
  const loop = await ensureLoopAccessible(loopId)
  if (!loop) return fail(c, 'NOT_FOUND', 'OODA loop not found.', 404)
  const body = await c.req.json().catch(() => null)
  const parsed = createActionBodySchema.safeParse(body)
  if (!parsed.success) {
    return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  }
  const created = (await createOodaRow(
    c,
    loop.bizId ?? null,
    'oodaLoopActions',
    {
      oodaLoopId: loopId,
      oodaLoopEntryId: parsed.data.oodaLoopEntryId ?? null,
      actionKey: parsed.data.actionKey,
      actionTitle: parsed.data.actionTitle,
      status: parsed.data.status ?? 'queued',
      dryRun: parsed.data.dryRun ?? true,
      requestedByUserId: user.id,
      assignedToUserId: parsed.data.assignedToUserId ?? null,
      linkedSagaRunId: parsed.data.linkedSagaRunId ?? null,
      requestPayload: parsed.data.requestPayload ?? {},
      resultPayload: parsed.data.resultPayload ?? {},
      errorMessage: parsed.data.errorMessage ?? null,
      createdBy: user.id,
      updatedBy: user.id,
    },
    {
      subjectType: 'ooda_loop_action',
      displayName: parsed.data.actionTitle,
      metadata: { source: 'routes.ooda.createAction' },
    },
  )) as Record<string, unknown> | Response
  if (created instanceof Response) return created
  emitOodaRealtime({
    loopId,
    requestedByUserId: user.id,
    eventType: 'run.updated',
    payload: { entity: 'action' },
  })
  return ok(c, created, 201)
})

oodaRoutes.patch('/ooda/loops/:loopId/actions/:actionId', requireAuth, async (c) => {
  const user = getCurrentUser(c)
  if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)
  const loopId = c.req.param('loopId')
  const actionId = c.req.param('actionId')
  const loop = await ensureLoopAccessible(loopId)
  if (!loop) return fail(c, 'NOT_FOUND', 'OODA loop not found.', 404)
  const body = await c.req.json().catch(() => null)
  const parsed = updateActionBodySchema.safeParse(body)
  if (!parsed.success) {
    return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  }
  const currentAction = await db.query.oodaLoopActions.findFirst({
    where: and(eq(oodaLoopActions.id, actionId), eq(oodaLoopActions.oodaLoopId, loopId), sql`deleted_at IS NULL`),
  })
  if (!currentAction) return fail(c, 'NOT_FOUND', 'OODA action not found.', 404)
  const updated = (await updateOodaRow(
    c,
    loop.bizId ?? null,
    'oodaLoopActions',
    actionId,
    {
      oodaLoopEntryId: parsed.data.oodaLoopEntryId ?? undefined,
      actionKey: parsed.data.actionKey ?? undefined,
      actionTitle: parsed.data.actionTitle ?? undefined,
      status: parsed.data.status ?? undefined,
      dryRun: parsed.data.dryRun ?? undefined,
      assignedToUserId: parsed.data.assignedToUserId ?? undefined,
      linkedSagaRunId: parsed.data.linkedSagaRunId ?? undefined,
      requestPayload: parsed.data.requestPayload ?? undefined,
      resultPayload: parsed.data.resultPayload ?? undefined,
      errorMessage: parsed.data.errorMessage ?? undefined,
      startedAt:
        parsed.data.status && parsed.data.status === 'running'
          ? new Date()
          : undefined,
      endedAt:
        parsed.data.status &&
        ['succeeded', 'failed', 'cancelled'].includes(parsed.data.status)
          ? new Date()
          : undefined,
      updatedBy: user.id,
      updatedAt: new Date(),
    },
    {
      subjectType: 'ooda_loop_action',
      subjectId: actionId,
      displayName: parsed.data.actionTitle ?? currentAction.actionTitle,
      metadata: { source: 'routes.ooda.updateAction' },
    },
  )) as Record<string, unknown> | Response
  if (updated instanceof Response) return updated
  emitOodaRealtime({
    loopId,
    requestedByUserId: user.id,
    eventType: 'run.updated',
    payload: { entity: 'action' },
  })
  return ok(c, updated)
})

/**
 * Create one saga run directly from OODA dashboard and attach it to loop action trail.
 */
oodaRoutes.post('/ooda/loops/:loopId/saga-runs', requireAuth, async (c) => {
  const user = getCurrentUser(c)
  if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)
  const loopId = c.req.param('loopId')
  const loop = await ensureLoopAccessible(loopId)
  if (!loop) return fail(c, 'NOT_FOUND', 'OODA loop not found.', 404)
  const body = await c.req.json().catch(() => null)
  const parsed = createLoopRunBodySchema.safeParse(body)
  if (!parsed.success) {
    return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  }

  let run = await createSagaRun({
    sagaKey: parsed.data.sagaKey,
    mode: parsed.data.mode,
    bizId: parsed.data.bizId,
    requestedByUserId: user.id,
    runnerLabel: parsed.data.runnerLabel ?? 'ooda-dashboard',
    runContext: {
      source: 'ooda-dashboard',
      loopId,
      loopKey: loop.loopKey,
    },
  })
  if (!run?.run) {
    return fail(c, 'INTERNAL_ERROR', 'Saga run was not created successfully.', 500)
  }
  let runDetail = run
  const runId = run.run.id

  await ensureLoopRunOutputLink({
    c,
    bizId: loop.bizId ?? null,
    loopId,
    runId,
    actorUserId: user.id,
  })

  const createdAction = (await createOodaRow(
    c,
    loop.bizId ?? null,
    'oodaLoopActions',
    {
      oodaLoopId: loopId,
      oodaLoopEntryId: parsed.data.oodaLoopEntryId ?? null,
      actionKey: 'saga.run.create',
      actionTitle: parsed.data.actionTitle ?? `Run ${parsed.data.sagaKey}`,
      status: parsed.data.autoExecute ? 'running' : 'queued',
      dryRun: parsed.data.mode === 'dry_run',
      requestedByUserId: user.id,
      linkedSagaRunId: runId,
      requestPayload: parsed.data.requestPayload ?? {
        sagaKey: parsed.data.sagaKey,
        mode: parsed.data.mode,
      },
      resultPayload: {
        runId,
        status: runDetail.run.status,
      },
      startedAt: new Date(),
      endedAt: parsed.data.autoExecute ? null : undefined,
      createdBy: user.id,
      updatedBy: user.id,
    },
    {
      subjectType: 'ooda_loop_action',
      subjectId: runId,
      displayName: parsed.data.actionTitle ?? `Run ${parsed.data.sagaKey}`,
      metadata: { source: 'routes.ooda.createSagaRunAction' },
    },
  )) as Record<string, unknown> | Response
  if (createdAction instanceof Response) return createdAction

  let action = createdAction as Record<string, unknown>
  if (parsed.data.autoExecute) {
    const cookie = c.req.header('cookie')
    if (!cookie) {
      const blockedAction = await updateOodaRow(
        c,
        loop.bizId ?? null,
        'oodaLoopActions',
        String(createdAction.id),
        {
          status: 'failed',
          errorMessage:
            'Run created, but execution could not start because session cookie was missing.',
          endedAt: new Date(),
          updatedAt: new Date(),
          updatedBy: user.id,
        },
        {
          subjectType: 'ooda_loop_action',
          subjectId: String(createdAction.id),
          displayName: 'Run Saga',
          metadata: { source: 'routes.ooda.blockedSagaRunAction' },
        },
      )
      if (blockedAction instanceof Response) return blockedAction
      action = blockedAction ?? createdAction
    } else {
      const execution = await executeExistingSagaRun({
        runId,
        sagaKey: runDetail.run.sagaKey,
        bizId: runDetail.run.bizId,
        owner: {
          email: user.email ?? `user-${user.id}@session.local`,
          password: '',
          userId: user.id,
          cookie,
        },
      })
      const refreshedRunRow = await db.query.sagaRuns.findFirst({
        where: eq(sagaRuns.id, runId),
      })
      const updatedAction = await updateOodaRow(
        c,
        loop.bizId ?? null,
        'oodaLoopActions',
        String(createdAction.id),
        {
          status: execution.ok ? 'succeeded' : 'failed',
          endedAt: new Date(),
          updatedAt: new Date(),
          updatedBy: user.id,
          errorMessage: execution.ok
            ? null
            : execution.failures.slice(0, 3).join(' | ') || 'Saga execution failed.',
          resultPayload: {
            runId,
            status: refreshedRunRow?.status ?? runDetail.run.status,
            ok: execution.ok,
            failureCount: execution.failures.length,
            failures: execution.failures.slice(0, 10),
          },
        },
        {
          subjectType: 'ooda_loop_action',
          subjectId: String(createdAction.id),
          displayName: 'Run Saga',
          metadata: { source: 'routes.ooda.finalizeSagaRunAction' },
        },
      )
      if (updatedAction instanceof Response) return updatedAction
      action = updatedAction ?? createdAction
      const refreshedRunDetail = await getSagaRunDetail(runId)
      if (refreshedRunDetail) runDetail = refreshedRunDetail
    }
  }

  emitOodaRealtime({
    loopId,
    requestedByUserId: user.id,
    eventType: 'run.updated',
    payload: {
      entity: 'action',
      linkedSagaRunId: runId,
      actionStatus: action.status,
    },
  })

  return ok(
    c,
    {
      run: runDetail,
      action,
    },
    201,
  )
})

/**
 * LLM helper that drafts UC/persona/saga-definition JSON payloads.
 *
 * Important:
 * This endpoint only drafts text/data.
 * Persisting the draft is always explicit through the regular CRUD routes.
 */
oodaRoutes.post('/ooda/generate/draft', requireAuth, async (c) => {
  const user = getCurrentUser(c)
  if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)
  const body = await c.req.json().catch(() => null)
  const parsed = generateBodySchema.safeParse(body)
  if (!parsed.success) {
    return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  }

  const systemPrompt = [
    'You are generating drafts for the Bizing OODA dashboard.',
    'Return only valid JSON. No markdown fences.',
    'Keep fields practical and concise.',
    'Do not invent IDs.',
    parsed.data.kind === 'use_case'
      ? 'Schema: {"title":string,"summary":string,"bodyMarkdown":string,"extractedNeeds":array}'
      : parsed.data.kind === 'persona'
        ? 'Schema: {"name":string,"profileSummary":string,"bodyMarkdown":string,"goals":string,"painPoints":string}'
        : 'Schema: {"sagaTitle":string,"description":string,"objectives":string[],"actors":array,"phases":array}',
  ].join('\n')

  const userPrompt = [
    `Kind: ${parsed.data.kind}`,
    `Prompt: ${parsed.data.prompt}`,
    parsed.data.context ? `Context: ${parsed.data.context}` : '',
  ]
    .filter(Boolean)
    .join('\n')

  const response = await chatWithLLM(
    {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.2,
      maxTokens: 1400,
      enableFunctions: false,
    },
    parsed.data.model as any,
  )

  let draft: unknown = null
  try {
    draft = JSON.parse(response)
  } catch {
    return fail(c, 'LLM_INVALID_JSON', 'Model did not return valid JSON draft.', 422, {
      raw: response,
    })
  }

  return ok(c, {
    kind: parsed.data.kind,
    draft,
    raw: response,
  })
})
