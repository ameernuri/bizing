/**
 * SLA and service-recovery routes.
 *
 * ELI5:
 * SLA rows define the promise.
 * Breach rows say when the promise was missed.
 * Compensation rows say what the business did about it.
 *
 * This route exists so operators, reporting, and saga coverage all read the
 * same first-class SLA contract instead of burying service-recovery logic in
 * random booking metadata.
 */

import { Hono } from 'hono'
import { and, asc, desc, eq } from 'drizzle-orm'
import { z } from 'zod'
import dbPackage from '@bizing/db'
import { requireAclPermission, requireAuth, requireBizAccess } from '../middleware/auth.js'
import { executeCrudRouteAction } from '../services/action-route-bridge.js'
import { sanitizePlainText, sanitizeUnknown } from '../lib/sanitize.js'
import { fail, ok } from './_api.js'

const {
  db,
  slaBreachEvents,
  slaCompensationEvents,
  slaPolicies,
} = dbPackage

const policyBodySchema = z.object({
  name: z.string().min(1).max(220),
  slug: z.string().min(1).max(140).regex(/^[a-z0-9-]+$/),
  status: z.enum(['draft', 'active', 'inactive', 'archived']).default('active'),
  metricKind: z.enum(['response_time', 'start_time', 'completion_time', 'custom']),
  scopeType: z.enum(['biz', 'location', 'resource', 'offer_version', 'service_product', 'queue', 'custom_subject']).default('biz'),
  locationId: z.string().optional(),
  resourceId: z.string().optional(),
  offerVersionId: z.string().optional(),
  serviceProductId: z.string().optional(),
  queueId: z.string().optional(),
  scopeRefType: z.string().max(80).optional(),
  scopeRefId: z.string().max(140).optional(),
  targetDurationMin: z.number().int().positive(),
  graceDurationMin: z.number().int().min(0).default(0),
  severityLevel: z.number().int().min(1).max(5).default(2),
  businessHoursOnly: z.boolean().default(false),
  evaluationPolicy: z.record(z.unknown()).optional(),
  compensationPolicy: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
})

const breachBodySchema = z.object({
  slaPolicyId: z.string().optional(),
  targetType: z.enum(['booking_order', 'fulfillment_unit', 'queue_entry', 'work_run', 'resource', 'custom_subject']),
  bookingOrderId: z.string().optional(),
  fulfillmentUnitId: z.string().optional(),
  queueEntryId: z.string().optional(),
  workRunId: z.string().optional(),
  resourceId: z.string().optional(),
  targetRefType: z.string().max(80).optional(),
  targetRefId: z.string().max(140).optional(),
  status: z.enum(['open', 'acknowledged', 'compensated', 'waived', 'closed']).default('open'),
  startedAt: z.string().datetime(),
  breachedAt: z.string().datetime(),
  resolvedAt: z.string().datetime().optional(),
  targetDurationMin: z.number().int().positive(),
  graceDurationMin: z.number().int().min(0).default(0),
  measuredDurationMin: z.number().int().min(0),
  severityLevel: z.number().int().min(1).max(5).default(2),
  isAutoDetected: z.boolean().default(true),
  details: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
})

const compensationBodySchema = z.object({
  type: z.enum(['credit', 'refund', 'gift_value', 'internal_adjustment', 'custom']),
  status: z.enum(['pending', 'applied', 'reversed', 'failed']).default('pending'),
  amountMinor: z.number().int().positive(),
  currency: z.string().regex(/^[A-Z]{3}$/).default('USD'),
  bookingOrderId: z.string().optional(),
  arInvoiceId: z.string().optional(),
  appliedAt: z.string().datetime().optional(),
  reversedAt: z.string().datetime().optional(),
  note: z.string().max(1000).optional(),
  metadata: z.record(z.unknown()).optional(),
})

const breachPatchBodySchema = z.object({
  status: z.enum(['open', 'acknowledged', 'compensated', 'waived', 'closed']).optional(),
  resolvedAt: z.string().datetime().optional().nullable(),
  severityLevel: z.number().int().min(1).max(5).optional(),
  measuredDurationMin: z.number().int().min(0).optional(),
  details: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
})

export const slaRoutes = new Hono()

async function createSlaRow<T extends Record<string, unknown>>(input: {
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
    metadata: { routeFamily: 'sla' },
  })
  if (!delegated.ok) return fail(input.c, delegated.code, delegated.message, delegated.httpStatus, delegated.details)
  return delegated.row as T
}

async function updateSlaRow<T extends Record<string, unknown>>(input: {
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
    metadata: { routeFamily: 'sla' },
  })
  if (!delegated.ok) {
    if (delegated.code === 'CRUD_TARGET_NOT_FOUND') return fail(input.c, 'NOT_FOUND', input.notFoundMessage, 404)
    return fail(input.c, delegated.code, delegated.message, delegated.httpStatus, delegated.details)
  }
  if (!delegated.row) return fail(input.c, 'NOT_FOUND', input.notFoundMessage, 404)
  return delegated.row as T
}

slaRoutes.get(
  '/bizes/:bizId/sla-policies',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const rows = await db.query.slaPolicies.findMany({
      where: eq(slaPolicies.bizId, bizId),
      orderBy: [asc(slaPolicies.name)],
    })
    return ok(c, rows)
  },
)

slaRoutes.post(
  '/bizes/:bizId/sla-policies',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = policyBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())

    const created = await createSlaRow<typeof slaPolicies.$inferSelect>({
      c,
      bizId,
      tableKey: 'slaPolicies',
      subjectType: 'sla_policy',
      displayName: parsed.data.name,
      data: {
      bizId,
      name: sanitizePlainText(parsed.data.name),
      slug: parsed.data.slug,
      status: parsed.data.status,
      metricKind: parsed.data.metricKind,
      scopeType: parsed.data.scopeType,
      locationId: parsed.data.locationId ?? null,
      resourceId: parsed.data.resourceId ?? null,
      offerVersionId: parsed.data.offerVersionId ?? null,
      serviceProductId: parsed.data.serviceProductId ?? null,
      queueId: parsed.data.queueId ?? null,
      scopeRefType: parsed.data.scopeRefType ?? null,
      scopeRefId: parsed.data.scopeRefId ?? null,
      targetDurationMin: parsed.data.targetDurationMin,
      graceDurationMin: parsed.data.graceDurationMin,
      severityLevel: parsed.data.severityLevel,
      businessHoursOnly: parsed.data.businessHoursOnly,
      evaluationPolicy: sanitizeUnknown(parsed.data.evaluationPolicy ?? {}),
      compensationPolicy: sanitizeUnknown(parsed.data.compensationPolicy ?? {}),
      metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
      },
    })
    if (created instanceof Response) return created

    return ok(c, created, 201)
  },
)

slaRoutes.get(
  '/bizes/:bizId/sla-breach-events',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const rows = await db.query.slaBreachEvents.findMany({
      where: eq(slaBreachEvents.bizId, bizId),
      orderBy: [desc(slaBreachEvents.breachedAt)],
    })
    return ok(c, rows)
  },
)

slaRoutes.post(
  '/bizes/:bizId/sla-breach-events',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = breachBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())

    const created = await createSlaRow<typeof slaBreachEvents.$inferSelect>({
      c,
      bizId,
      tableKey: 'slaBreachEvents',
      subjectType: 'sla_breach_event',
      displayName: parsed.data.targetType,
      data: {
      bizId,
      slaPolicyId: parsed.data.slaPolicyId ?? null,
      targetType: parsed.data.targetType,
      bookingOrderId: parsed.data.bookingOrderId ?? null,
      fulfillmentUnitId: parsed.data.fulfillmentUnitId ?? null,
      queueEntryId: parsed.data.queueEntryId ?? null,
      workRunId: parsed.data.workRunId ?? null,
      resourceId: parsed.data.resourceId ?? null,
      targetRefType: parsed.data.targetRefType ?? null,
      targetRefId: parsed.data.targetRefId ?? null,
      status: parsed.data.status,
      startedAt: new Date(parsed.data.startedAt),
      breachedAt: new Date(parsed.data.breachedAt),
      resolvedAt: parsed.data.resolvedAt ? new Date(parsed.data.resolvedAt) : null,
      targetDurationMin: parsed.data.targetDurationMin,
      graceDurationMin: parsed.data.graceDurationMin,
      measuredDurationMin: parsed.data.measuredDurationMin,
      severityLevel: parsed.data.severityLevel,
      isAutoDetected: parsed.data.isAutoDetected,
      details: sanitizeUnknown(parsed.data.details ?? {}),
      metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
      },
    })
    if (created instanceof Response) return created

    return ok(c, created, 201)
  },
)

slaRoutes.patch(
  '/bizes/:bizId/sla-breach-events/:breachId',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, breachId } = c.req.param()
    const parsed = breachPatchBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())

    const existing = await db.query.slaBreachEvents.findFirst({
      where: and(eq(slaBreachEvents.bizId, bizId), eq(slaBreachEvents.id, breachId)),
    })
    if (!existing) return fail(c, 'NOT_FOUND', 'SLA breach event not found.', 404)

    const updated = await updateSlaRow<typeof slaBreachEvents.$inferSelect>({
      c,
      bizId,
      tableKey: 'slaBreachEvents',
      subjectType: 'sla_breach_event',
      id: breachId,
      notFoundMessage: 'SLA breach event not found.',
      patch: {
      status: parsed.data.status ?? undefined,
      resolvedAt:
        parsed.data.resolvedAt === undefined
          ? undefined
          : parsed.data.resolvedAt
            ? new Date(parsed.data.resolvedAt)
            : null,
      severityLevel: parsed.data.severityLevel ?? undefined,
      measuredDurationMin: parsed.data.measuredDurationMin ?? undefined,
      details: parsed.data.details ? sanitizeUnknown(parsed.data.details) : undefined,
      metadata: parsed.data.metadata ? sanitizeUnknown(parsed.data.metadata) : undefined,
      },
    })
    if (updated instanceof Response) return updated

    return ok(c, updated)
  },
)

slaRoutes.post(
  '/bizes/:bizId/sla-breach-events/:breachId/compensations',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, breachId } = c.req.param()
    const parsed = compensationBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())

    const breach = await db.query.slaBreachEvents.findFirst({
      where: and(eq(slaBreachEvents.bizId, bizId), eq(slaBreachEvents.id, breachId)),
      columns: { id: true },
    })
    if (!breach) return fail(c, 'NOT_FOUND', 'SLA breach event not found.', 404)

    const created = await createSlaRow<typeof slaCompensationEvents.$inferSelect>({
      c,
      bizId,
      tableKey: 'slaCompensationEvents',
      subjectType: 'sla_compensation_event',
      displayName: parsed.data.type,
      data: {
      bizId,
      slaBreachEventId: breachId,
      type: parsed.data.type,
      status: parsed.data.status,
      amountMinor: parsed.data.amountMinor,
      currency: parsed.data.currency,
      bookingOrderId: parsed.data.bookingOrderId ?? null,
      arInvoiceId: parsed.data.arInvoiceId ?? null,
      appliedAt: parsed.data.appliedAt ? new Date(parsed.data.appliedAt) : null,
      reversedAt: parsed.data.reversedAt ? new Date(parsed.data.reversedAt) : null,
      note: parsed.data.note ? sanitizePlainText(parsed.data.note) : null,
      metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
      },
    })
    if (created instanceof Response) return created

    return ok(c, created, 201)
  },
)

slaRoutes.get(
  '/bizes/:bizId/sla-overview',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const [breaches, compensations] = await Promise.all([
      db.query.slaBreachEvents.findMany({
        where: eq(slaBreachEvents.bizId, bizId),
        columns: { id: true, status: true, severityLevel: true },
      }),
      db.query.slaCompensationEvents.findMany({
        where: eq(slaCompensationEvents.bizId, bizId),
        columns: { id: true, status: true, amountMinor: true, currency: true },
      }),
    ])

    return ok(c, {
      bizId,
      breaches: {
        total: breaches.length,
        open: breaches.filter((row) => row.status === 'open' || row.status === 'acknowledged').length,
        resolved: breaches.filter((row) => row.status === 'compensated' || row.status === 'waived' || row.status === 'closed').length,
        highSeverity: breaches.filter((row) => row.severityLevel >= 4).length,
      },
      compensation: {
        totalEvents: compensations.length,
        appliedEvents: compensations.filter((row) => row.status === 'applied').length,
        compensationCostMinor: compensations.filter((row) => row.status === 'applied').reduce((sum, row) => sum + row.amountMinor, 0),
      },
    })
  },
)
