/**
 * Supply operations routes.
 *
 * ELI5:
 * Resources like vehicles, rooms, chairs, scanners, and machines need their
 * own operational facts:
 * - usage counters,
 * - maintenance rules,
 * - work orders,
 * - condition/failure reports.
 *
 * These routes expose those facts directly so sagas can prove equipment-heavy
 * use cases through the API.
 */

import { Hono } from 'hono'
import { and, asc, desc, eq } from 'drizzle-orm'
import { z } from 'zod'
import dbPackage from '@bizing/db'
import { getCurrentUser, requireAclPermission, requireAuth, requireBizAccess } from '../middleware/auth.js'
import { sanitizePlainText, sanitizeUnknown } from '../lib/sanitize.js'
import { fail, ok } from './_api.js'

const {
  db,
  resourceConditionReports,
  resourceMaintenancePolicies,
  resourceMaintenanceWorkOrders,
  resourceUsageCounters,
} = dbPackage

const usageCounterBodySchema = z.object({
  resourceId: z.string().min(1),
  counterKey: z.string().min(1).max(120),
  unit: z.string().min(1).max(40),
  currentValue: z.number().int().min(0).default(0),
  metadata: z.record(z.unknown()).optional(),
})

const usageIncrementBodySchema = z.object({
  amount: z.number().int().positive(),
  happenedAt: z.string().datetime().optional(),
  metadata: z.record(z.unknown()).optional(),
})

const maintenancePolicyBodySchema = z.object({
  resourceId: z.string().optional(),
  capabilityTemplateId: z.string().optional(),
  scopeResourceType: z.enum(['host', 'company_host', 'asset', 'venue']).optional(),
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(140).regex(/^[a-z0-9-]+$/),
  triggerType: z.enum(['usage_hours', 'usage_count', 'elapsed_days', 'calendar_date', 'manual']),
  thresholdValue: z.number().int().positive().optional(),
  triggerExpression: z.string().max(300).optional(),
  actionType: z.enum(['create_work_order', 'block_resource', 'warn_only', 'notify_only']),
  autoCreateWorkOrder: z.boolean().default(true),
  blockUntilCompleted: z.boolean().default(false),
  isActive: z.boolean().default(true),
  notes: z.string().max(4000).optional(),
  metadata: z.record(z.unknown()).optional(),
}).superRefine((value, ctx) => {
  const hasScope = Boolean(value.resourceId || value.capabilityTemplateId || value.scopeResourceType)
  if (!hasScope) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'At least one scope selector is required.' })
  }
})

const maintenanceWorkOrderBodySchema = z.object({
  resourceId: z.string().min(1),
  policyId: z.string().optional(),
  calendarId: z.string().optional(),
  calendarTimelineEventId: z.string().optional(),
  title: z.string().min(1).max(220),
  description: z.string().max(4000).optional(),
  status: z.enum(['open', 'scheduled', 'in_progress', 'completed', 'cancelled', 'deferred']).default('open'),
  priority: z.number().int().min(0).default(100),
  scheduledStartAt: z.string().datetime().optional(),
  scheduledEndAt: z.string().datetime().optional(),
  startedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
  cancelledAt: z.string().datetime().optional(),
  blocksAvailability: z.boolean().default(true),
  resolutionNotes: z.string().max(4000).optional(),
  metadata: z.record(z.unknown()).optional(),
})

const maintenanceWorkOrderPatchSchema = maintenanceWorkOrderBodySchema.partial()

const conditionReportBodySchema = z.object({
  resourceId: z.string().min(1),
  reportType: z.enum(['pre_use', 'post_use', 'inspection', 'incident', 'return_check']),
  reporterUserId: z.string().optional(),
  reportedAt: z.string().datetime().optional(),
  severity: z.number().int().min(1).max(5).default(1),
  summary: z.string().min(1).max(280),
  notes: z.string().max(4000).optional(),
  checklist: z.record(z.unknown()).optional(),
  mediaEvidence: z.array(z.unknown()).optional(),
  resolvedAt: z.string().datetime().optional(),
  metadata: z.record(z.unknown()).optional(),
})

export const supplyRoutes = new Hono()

supplyRoutes.get(
  '/bizes/:bizId/resource-usage-counters',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('resources.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const resourceId = c.req.query('resourceId')
    const rows = await db.query.resourceUsageCounters.findMany({
      where: and(
        eq(resourceUsageCounters.bizId, bizId),
        resourceId ? eq(resourceUsageCounters.resourceId, resourceId) : undefined,
      ),
      orderBy: [asc(resourceUsageCounters.resourceId), asc(resourceUsageCounters.counterKey)],
    })
    return ok(c, rows)
  },
)

supplyRoutes.post(
  '/bizes/:bizId/resource-usage-counters',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('resources.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = usageCounterBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())

    const existing = await db.query.resourceUsageCounters.findFirst({
      where: and(
        eq(resourceUsageCounters.bizId, bizId),
        eq(resourceUsageCounters.resourceId, parsed.data.resourceId),
        eq(resourceUsageCounters.counterKey, parsed.data.counterKey),
      ),
    })
    if (existing) return ok(c, existing)

    const [created] = await db.insert(resourceUsageCounters).values({
      bizId,
      resourceId: parsed.data.resourceId,
      counterKey: parsed.data.counterKey,
      unit: parsed.data.unit,
      currentValue: parsed.data.currentValue,
      metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
    }).returning()
    return ok(c, created, 201)
  },
)

supplyRoutes.post(
  '/bizes/:bizId/resource-usage-counters/:counterId/increment',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('resources.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, counterId } = c.req.param()
    const parsed = usageIncrementBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())

    const existing = await db.query.resourceUsageCounters.findFirst({
      where: and(eq(resourceUsageCounters.bizId, bizId), eq(resourceUsageCounters.id, counterId)),
    })
    if (!existing) return fail(c, 'NOT_FOUND', 'Usage counter not found.', 404)

    const nextValue = existing.currentValue + parsed.data.amount
    const mergedMetadata = {
      ...(typeof existing.metadata === 'object' && existing.metadata ? existing.metadata : {}),
      lastIncrement: {
        amount: parsed.data.amount,
        metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
      },
    }

    const [updated] = await db.update(resourceUsageCounters).set({
      currentValue: nextValue,
      lastIncrementAt: parsed.data.happenedAt ? new Date(parsed.data.happenedAt) : new Date(),
      metadata: sanitizeUnknown(mergedMetadata),
    }).where(and(eq(resourceUsageCounters.bizId, bizId), eq(resourceUsageCounters.id, counterId))).returning()

    return ok(c, updated)
  },
)

supplyRoutes.get(
  '/bizes/:bizId/resource-maintenance-policies',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('resources.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const rows = await db.query.resourceMaintenancePolicies.findMany({
      where: eq(resourceMaintenancePolicies.bizId, bizId),
      orderBy: [asc(resourceMaintenancePolicies.name)],
    })
    return ok(c, rows)
  },
)

supplyRoutes.post(
  '/bizes/:bizId/resource-maintenance-policies',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('resources.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = maintenancePolicyBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())

    const [created] = await db.insert(resourceMaintenancePolicies).values({
      bizId,
      resourceId: parsed.data.resourceId ?? null,
      capabilityTemplateId: parsed.data.capabilityTemplateId ?? null,
      scopeResourceType: parsed.data.scopeResourceType ?? null,
      name: sanitizePlainText(parsed.data.name),
      slug: parsed.data.slug,
      triggerType: parsed.data.triggerType,
      thresholdValue: parsed.data.thresholdValue ?? null,
      triggerExpression: parsed.data.triggerExpression ?? null,
      actionType: parsed.data.actionType,
      autoCreateWorkOrder: parsed.data.autoCreateWorkOrder,
      blockUntilCompleted: parsed.data.blockUntilCompleted,
      isActive: parsed.data.isActive,
      notes: parsed.data.notes ? sanitizePlainText(parsed.data.notes) : null,
      metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
    }).returning()

    return ok(c, created, 201)
  },
)

supplyRoutes.get(
  '/bizes/:bizId/resource-maintenance-work-orders',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('resources.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const resourceId = c.req.query('resourceId')
    const rows = await db.query.resourceMaintenanceWorkOrders.findMany({
      where: and(
        eq(resourceMaintenanceWorkOrders.bizId, bizId),
        resourceId ? eq(resourceMaintenanceWorkOrders.resourceId, resourceId) : undefined,
      ),
      orderBy: [desc(resourceMaintenanceWorkOrders.openedAt)],
    })
    return ok(c, rows)
  },
)

supplyRoutes.post(
  '/bizes/:bizId/resource-maintenance-work-orders',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('resources.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = maintenanceWorkOrderBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())

    const [created] = await db.insert(resourceMaintenanceWorkOrders).values({
      bizId,
      resourceId: parsed.data.resourceId,
      policyId: parsed.data.policyId ?? null,
      calendarId: parsed.data.calendarId ?? null,
      calendarTimelineEventId: parsed.data.calendarTimelineEventId ?? null,
      title: sanitizePlainText(parsed.data.title),
      description: parsed.data.description ? sanitizePlainText(parsed.data.description) : null,
      status: parsed.data.status,
      priority: parsed.data.priority,
      scheduledStartAt: parsed.data.scheduledStartAt ? new Date(parsed.data.scheduledStartAt) : null,
      scheduledEndAt: parsed.data.scheduledEndAt ? new Date(parsed.data.scheduledEndAt) : null,
      startedAt: parsed.data.startedAt ? new Date(parsed.data.startedAt) : null,
      completedAt: parsed.data.completedAt ? new Date(parsed.data.completedAt) : null,
      cancelledAt: parsed.data.cancelledAt ? new Date(parsed.data.cancelledAt) : null,
      blocksAvailability: parsed.data.blocksAvailability,
      resolutionNotes: parsed.data.resolutionNotes ? sanitizePlainText(parsed.data.resolutionNotes) : null,
      metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
    }).returning()

    return ok(c, created, 201)
  },
)

supplyRoutes.patch(
  '/bizes/:bizId/resource-maintenance-work-orders/:workOrderId',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('resources.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, workOrderId } = c.req.param()
    const parsed = maintenanceWorkOrderPatchSchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())

    const existing = await db.query.resourceMaintenanceWorkOrders.findFirst({
      where: and(eq(resourceMaintenanceWorkOrders.bizId, bizId), eq(resourceMaintenanceWorkOrders.id, workOrderId)),
    })
    if (!existing) return fail(c, 'NOT_FOUND', 'Maintenance work order not found.', 404)

    const [updated] = await db.update(resourceMaintenanceWorkOrders).set({
      resourceId: parsed.data.resourceId ?? undefined,
      policyId: parsed.data.policyId ?? undefined,
      calendarId: parsed.data.calendarId ?? undefined,
      calendarTimelineEventId: parsed.data.calendarTimelineEventId ?? undefined,
      title: parsed.data.title ? sanitizePlainText(parsed.data.title) : undefined,
      description: parsed.data.description ? sanitizePlainText(parsed.data.description) : undefined,
      status: parsed.data.status ?? undefined,
      priority: parsed.data.priority ?? undefined,
      scheduledStartAt: parsed.data.scheduledStartAt === undefined ? undefined : parsed.data.scheduledStartAt ? new Date(parsed.data.scheduledStartAt) : null,
      scheduledEndAt: parsed.data.scheduledEndAt === undefined ? undefined : parsed.data.scheduledEndAt ? new Date(parsed.data.scheduledEndAt) : null,
      startedAt: parsed.data.startedAt === undefined ? undefined : parsed.data.startedAt ? new Date(parsed.data.startedAt) : null,
      completedAt: parsed.data.completedAt === undefined ? undefined : parsed.data.completedAt ? new Date(parsed.data.completedAt) : null,
      cancelledAt: parsed.data.cancelledAt === undefined ? undefined : parsed.data.cancelledAt ? new Date(parsed.data.cancelledAt) : null,
      blocksAvailability: parsed.data.blocksAvailability ?? undefined,
      resolutionNotes: parsed.data.resolutionNotes ? sanitizePlainText(parsed.data.resolutionNotes) : undefined,
      metadata: parsed.data.metadata ? sanitizeUnknown(parsed.data.metadata) : undefined,
    }).where(and(eq(resourceMaintenanceWorkOrders.bizId, bizId), eq(resourceMaintenanceWorkOrders.id, workOrderId))).returning()

    return ok(c, updated)
  },
)

supplyRoutes.get(
  '/bizes/:bizId/resource-condition-reports',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('resources.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const resourceId = c.req.query('resourceId')
    const rows = await db.query.resourceConditionReports.findMany({
      where: and(
        eq(resourceConditionReports.bizId, bizId),
        resourceId ? eq(resourceConditionReports.resourceId, resourceId) : undefined,
      ),
      orderBy: [desc(resourceConditionReports.reportedAt)],
    })
    return ok(c, rows)
  },
)

supplyRoutes.post(
  '/bizes/:bizId/resource-condition-reports',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('resources.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = conditionReportBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())

    const [created] = await db.insert(resourceConditionReports).values({
      bizId,
      resourceId: parsed.data.resourceId,
      reportType: parsed.data.reportType,
      reporterUserId: parsed.data.reporterUserId ?? getCurrentUser(c)?.id ?? null,
      reportedAt: parsed.data.reportedAt ? new Date(parsed.data.reportedAt) : new Date(),
      severity: parsed.data.severity,
      summary: sanitizePlainText(parsed.data.summary),
      notes: parsed.data.notes ? sanitizePlainText(parsed.data.notes) : null,
      checklist: sanitizeUnknown(parsed.data.checklist ?? {}),
      mediaEvidence: sanitizeUnknown(parsed.data.mediaEvidence ?? []),
      resolvedAt: parsed.data.resolvedAt ? new Date(parsed.data.resolvedAt) : null,
      metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
    }).returning()
    return ok(c, created, 201)
  },
)
