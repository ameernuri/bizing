/**
 * Projection checkpoint routes.
 *
 * ELI5:
 * A projection checkpoint is the platform's bookmark for a read model.
 * It answers:
 * - what projection are we talking about?
 * - what scope does it belong to?
 * - how healthy is it?
 * - how far behind is it?
 * - what event cursor did it last apply?
 *
 * These routes expose that control-plane directly so sagas and operators can
 * prove replay/recovery behavior through the API instead of inferring it from
 * hidden worker state.
 */

import { Hono } from 'hono'
import { and, asc, eq } from 'drizzle-orm'
import { z } from 'zod'
import dbPackage from '@bizing/db'
import { requireAclPermission, requireAuth, requireBizAccess } from '../middleware/auth.js'
import { executeCrudRouteAction } from '../services/action-route-bridge.js'
import { fail, ok } from './_api.js'

const { db, projectionCheckpoints } = dbPackage

const upsertCheckpointBodySchema = z.object({
  projectionKey: z.string().min(1).max(140),
  scopeType: z.enum(['biz', 'location', 'resource', 'sellable', 'custom_subject']).default('biz'),
  locationId: z.string().optional(),
  resourceId: z.string().optional(),
  sellableId: z.string().optional(),
  subjectType: z.string().optional(),
  subjectId: z.string().optional(),
  status: z.enum(['healthy', 'lagging', 'degraded', 'failed']).default('healthy'),
  revision: z.number().int().min(0).default(0),
  lastLifecycleEventId: z.string().optional(),
  lastEventOccurredAt: z.string().datetime().optional(),
  lastAppliedAt: z.string().datetime().optional(),
  lagSeconds: z.number().int().min(0).default(0),
  errorSummary: z.string().max(2000).optional(),
  metadata: z.record(z.unknown()).optional(),
}).superRefine((value, ctx) => {
  if (value.scopeType === 'location' && !value.locationId) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'locationId is required.' })
  if (value.scopeType === 'resource' && !value.resourceId) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'resourceId is required.' })
  if (value.scopeType === 'sellable' && !value.sellableId) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'sellableId is required.' })
  if (value.scopeType === 'custom_subject' && (!value.subjectType || !value.subjectId)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'subjectType and subjectId are required.' })
})

const replayCheckpointBodySchema = z.object({
  toStatus: z.enum(['healthy', 'lagging', 'degraded', 'failed']).default('healthy'),
  lastLifecycleEventId: z.string().optional(),
  lastEventOccurredAt: z.string().datetime().optional(),
  lastAppliedAt: z.string().datetime().optional(),
  lagSeconds: z.number().int().min(0).default(0),
  errorSummary: z.string().max(2000).optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
})

function scopeWhere(bizId: string, body: z.infer<typeof upsertCheckpointBodySchema>) {
  return and(
    eq(projectionCheckpoints.bizId, bizId),
    eq(projectionCheckpoints.projectionKey, body.projectionKey),
    eq(projectionCheckpoints.scopeType, body.scopeType),
    body.scopeType === 'location' ? eq(projectionCheckpoints.locationId, body.locationId!) : undefined,
    body.scopeType === 'resource' ? eq(projectionCheckpoints.resourceId, body.resourceId!) : undefined,
    body.scopeType === 'sellable' ? eq(projectionCheckpoints.sellableId, body.sellableId!) : undefined,
    body.scopeType === 'custom_subject' ? eq(projectionCheckpoints.subjectType, body.subjectType!) : undefined,
    body.scopeType === 'custom_subject' ? eq(projectionCheckpoints.subjectId, body.subjectId!) : undefined,
  )
}

export const reportingRoutes = new Hono()

async function createReportingRow<T extends Record<string, unknown>>(input: {
  c: Parameters<typeof fail>[0]
  bizId: string
  tableKey: string
  subjectType: string
  data: Record<string, unknown>
  displayName?: string
}) {
  const delegated = await executeCrudRouteAction({
    c: input.c,
    bizId: input.bizId,
    tableKey: input.tableKey,
    operation: 'create',
    subjectType: input.subjectType,
    displayName: input.displayName,
    data: input.data,
    metadata: { routeFamily: 'reporting' },
  })
  if (!delegated.ok) return fail(input.c, delegated.code, delegated.message, delegated.httpStatus, delegated.details)
  return delegated.row as T
}

async function updateReportingRow<T extends Record<string, unknown>>(input: {
  c: Parameters<typeof fail>[0]
  bizId: string
  tableKey: string
  subjectType: string
  id: string
  patch: Record<string, unknown>
  notFoundMessage: string
}) {
  const delegated = await executeCrudRouteAction({
    c: input.c,
    bizId: input.bizId,
    tableKey: input.tableKey,
    operation: 'update',
    id: input.id,
    subjectType: input.subjectType,
    subjectId: input.id,
    patch: input.patch,
    metadata: { routeFamily: 'reporting' },
  })
  if (!delegated.ok) {
    if (delegated.code === 'CRUD_TARGET_NOT_FOUND') return fail(input.c, 'NOT_FOUND', input.notFoundMessage, 404)
    return fail(input.c, delegated.code, delegated.message, delegated.httpStatus, delegated.details)
  }
  if (!delegated.row) return fail(input.c, 'NOT_FOUND', input.notFoundMessage, 404)
  return delegated.row as T
}

reportingRoutes.get(
  '/bizes/:bizId/projection-checkpoints',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const status = c.req.query('status')
    const projectionKey = c.req.query('projectionKey')
    const rows = await db.query.projectionCheckpoints.findMany({
      where: and(
        eq(projectionCheckpoints.bizId, bizId),
        status ? eq(projectionCheckpoints.status, status as never) : undefined,
        projectionKey ? eq(projectionCheckpoints.projectionKey, projectionKey) : undefined,
      ),
      orderBy: [asc(projectionCheckpoints.projectionKey), asc(projectionCheckpoints.lastAppliedAt)],
    })
    return ok(c, rows)
  },
)

reportingRoutes.post(
  '/bizes/:bizId/projection-checkpoints',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = upsertCheckpointBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())

    const existing = await db.query.projectionCheckpoints.findFirst({ where: scopeWhere(bizId, parsed.data) })
    if (existing) {
      const updated = await updateReportingRow<typeof projectionCheckpoints.$inferSelect>({
        c,
        bizId,
        tableKey: 'projectionCheckpoints',
        subjectType: 'projection_checkpoint',
        id: existing.id,
        notFoundMessage: 'Projection checkpoint not found.',
        patch: {
        status: parsed.data.status,
        revision: parsed.data.revision,
        lastLifecycleEventId: parsed.data.lastLifecycleEventId ?? null,
        lastEventOccurredAt: parsed.data.lastEventOccurredAt ? new Date(parsed.data.lastEventOccurredAt) : null,
        lastAppliedAt: parsed.data.lastAppliedAt ? new Date(parsed.data.lastAppliedAt) : new Date(),
        lagSeconds: parsed.data.lagSeconds,
        errorSummary: parsed.data.errorSummary ?? null,
        metadata: parsed.data.metadata ?? {},
        },
      })
      if (updated instanceof Response) return updated
      return ok(c, updated, 200)
    }

    const created = await createReportingRow<typeof projectionCheckpoints.$inferSelect>({
      c,
      bizId,
      tableKey: 'projectionCheckpoints',
      subjectType: 'projection_checkpoint',
      displayName: parsed.data.projectionKey,
      data: {
      bizId,
      projectionKey: parsed.data.projectionKey,
      scopeType: parsed.data.scopeType,
      locationId: parsed.data.locationId ?? null,
      resourceId: parsed.data.resourceId ?? null,
      sellableId: parsed.data.sellableId ?? null,
      subjectType: parsed.data.subjectType ?? null,
      subjectId: parsed.data.subjectId ?? null,
      status: parsed.data.status,
      revision: parsed.data.revision,
      lastLifecycleEventId: parsed.data.lastLifecycleEventId ?? null,
      lastEventOccurredAt: parsed.data.lastEventOccurredAt ? new Date(parsed.data.lastEventOccurredAt) : null,
      lastAppliedAt: parsed.data.lastAppliedAt ? new Date(parsed.data.lastAppliedAt) : new Date(),
      lagSeconds: parsed.data.lagSeconds,
      errorSummary: parsed.data.errorSummary ?? null,
      metadata: parsed.data.metadata ?? {},
      },
    })
    if (created instanceof Response) return created
    return ok(c, created, 201)
  },
)

reportingRoutes.post(
  '/bizes/:bizId/projection-checkpoints/:checkpointId/replay',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, checkpointId } = c.req.param()
    const parsed = replayCheckpointBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())

    const existing = await db.query.projectionCheckpoints.findFirst({
      where: and(eq(projectionCheckpoints.bizId, bizId), eq(projectionCheckpoints.id, checkpointId)),
    })
    if (!existing) return fail(c, 'NOT_FOUND', 'Projection checkpoint not found.', 404)

    const updated = await updateReportingRow<typeof projectionCheckpoints.$inferSelect>({
      c,
      bizId,
      tableKey: 'projectionCheckpoints',
      subjectType: 'projection_checkpoint',
      id: checkpointId,
      notFoundMessage: 'Projection checkpoint not found.',
      patch: {
      status: parsed.data.toStatus,
      revision: existing.revision + 1,
      lastLifecycleEventId: parsed.data.lastLifecycleEventId ?? existing.lastLifecycleEventId,
      lastEventOccurredAt: parsed.data.lastEventOccurredAt ? new Date(parsed.data.lastEventOccurredAt) : existing.lastEventOccurredAt,
      lastAppliedAt: parsed.data.lastAppliedAt ? new Date(parsed.data.lastAppliedAt) : new Date(),
      lagSeconds: parsed.data.lagSeconds,
      errorSummary: parsed.data.errorSummary ?? null,
      metadata: {
        ...(existing.metadata as Record<string, unknown> | null ?? {}),
        ...(parsed.data.metadata ?? {}),
        replayedAt: new Date().toISOString(),
        previousRevision: existing.revision,
      },
      },
    })
    if (updated instanceof Response) return updated

    return ok(c, updated, 200)
  },
)
