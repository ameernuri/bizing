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
import { executeCrudRouteAction } from '../services/action-route-bridge.js'
import { sanitizePlainText, sanitizeUnknown } from '../lib/sanitize.js'
import { fail, ok } from './_api.js'

const {
  db,
  productionBatches,
  productionBatchReservations,
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

const productionBatchBodySchema = z.object({
  locationId: z.string().optional().nullable(),
  sellableId: z.string().min(1),
  batchCode: z.string().min(1).max(120),
  name: z.string().max(220).optional().nullable(),
  status: z.string().max(40).default('planned'),
  statusConfigValueId: z.string().optional().nullable(),
  plannedQuantity: z.number().int().min(0).default(0),
  producedQuantity: z.number().int().min(0).default(0),
  reservedQuantity: z.number().int().min(0).default(0),
  releasedQuantity: z.number().int().min(0).default(0),
  productionStartAt: z.string().datetime().optional().nullable(),
  readyAt: z.string().datetime().optional().nullable(),
  expiresAt: z.string().datetime().optional().nullable(),
  closedAt: z.string().datetime().optional().nullable(),
  policySnapshot: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
})

const productionBatchPatchSchema = productionBatchBodySchema.partial()

const productionBatchReservationBodySchema = z.object({
  status: z.string().max(40).default('waitlisted'),
  statusConfigValueId: z.string().optional().nullable(),
  ownerUserId: z.string().optional().nullable(),
  ownerGroupAccountId: z.string().optional().nullable(),
  guestEmail: z.string().email().optional().nullable(),
  requestedQuantity: z.number().int().positive().default(1),
  allocatedQuantity: z.number().int().min(0).default(0),
  paidAmountMinor: z.number().int().min(0).default(0),
  currency: z.string().regex(/^[A-Z]{3}$/).default('USD'),
  sourceCheckoutSessionId: z.string().optional().nullable(),
  bookingOrderId: z.string().optional().nullable(),
  requestedAt: z.string().datetime().optional(),
  fulfilledAt: z.string().datetime().optional().nullable(),
  cancelledAt: z.string().datetime().optional().nullable(),
  expiresAt: z.string().datetime().optional().nullable(),
  notes: z.string().max(4000).optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
})

const productionBatchReservationPatchSchema = productionBatchReservationBodySchema.partial()

async function createSupplyRow<T extends Record<string, unknown>>(input: {
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
    metadata: { routeFamily: 'supply' },
  })
  if (!delegated.ok) return fail(input.c, delegated.code, delegated.message, delegated.httpStatus, delegated.details)
  return delegated.row as T
}

async function updateSupplyRow<T extends Record<string, unknown>>(input: {
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
    metadata: { routeFamily: 'supply' },
  })
  if (!delegated.ok) {
    if (delegated.code === 'CRUD_TARGET_NOT_FOUND') return fail(input.c, 'NOT_FOUND', input.notFoundMessage, 404)
    return fail(input.c, delegated.code, delegated.message, delegated.httpStatus, delegated.details)
  }
  if (!delegated.row) return fail(input.c, 'NOT_FOUND', input.notFoundMessage, 404)
  return delegated.row as T
}

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

    const createdOrResponse = await createSupplyRow<typeof resourceUsageCounters.$inferSelect>({
      c,
      bizId,
      tableKey: 'resourceUsageCounters',
      subjectType: 'resource_usage_counter',
      displayName: `${parsed.data.resourceId}:${parsed.data.counterKey}`,
      data: {
        bizId,
        resourceId: parsed.data.resourceId,
        counterKey: parsed.data.counterKey,
        unit: parsed.data.unit,
        currentValue: parsed.data.currentValue,
        metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
      },
    })
    if (createdOrResponse instanceof Response) return createdOrResponse
    const created = createdOrResponse
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

    const updatedOrResponse = await updateSupplyRow<typeof resourceUsageCounters.$inferSelect>({
      c,
      bizId,
      tableKey: 'resourceUsageCounters',
      subjectType: 'resource_usage_counter',
      id: counterId,
      notFoundMessage: 'Usage counter not found.',
      patch: {
        currentValue: nextValue,
        lastIncrementAt: parsed.data.happenedAt ? new Date(parsed.data.happenedAt) : new Date(),
        metadata: sanitizeUnknown(mergedMetadata),
      },
    })
    if (updatedOrResponse instanceof Response) return updatedOrResponse
    const updated = updatedOrResponse

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

    const createdOrResponse = await createSupplyRow<typeof resourceMaintenancePolicies.$inferSelect>({
      c,
      bizId,
      tableKey: 'resourceMaintenancePolicies',
      subjectType: 'resource_maintenance_policy',
      displayName: parsed.data.name,
      data: {
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
      },
    })
    if (createdOrResponse instanceof Response) return createdOrResponse
    const created = createdOrResponse

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

    const createdOrResponse = await createSupplyRow<typeof resourceMaintenanceWorkOrders.$inferSelect>({
      c,
      bizId,
      tableKey: 'resourceMaintenanceWorkOrders',
      subjectType: 'resource_maintenance_work_order',
      displayName: parsed.data.title,
      data: {
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
      },
    })
    if (createdOrResponse instanceof Response) return createdOrResponse
    const created = createdOrResponse

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

    const updatedOrResponse = await updateSupplyRow<typeof resourceMaintenanceWorkOrders.$inferSelect>({
      c,
      bizId,
      tableKey: 'resourceMaintenanceWorkOrders',
      subjectType: 'resource_maintenance_work_order',
      id: workOrderId,
      notFoundMessage: 'Maintenance work order not found.',
      patch: {
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
      },
    })
    if (updatedOrResponse instanceof Response) return updatedOrResponse
    const updated = updatedOrResponse

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

    const createdOrResponse = await createSupplyRow<typeof resourceConditionReports.$inferSelect>({
      c,
      bizId,
      tableKey: 'resourceConditionReports',
      subjectType: 'resource_condition_report',
      displayName: parsed.data.summary,
      data: {
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
      },
    })
    if (createdOrResponse instanceof Response) return createdOrResponse
    const created = createdOrResponse
    return ok(c, created, 201)
  },
)

supplyRoutes.get(
  '/bizes/:bizId/production-batches',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const sellableId = c.req.query('sellableId')
    const rows = await db.query.productionBatches.findMany({
      where: and(
        eq(productionBatches.bizId, bizId),
        sellableId ? eq(productionBatches.sellableId, sellableId) : undefined,
      ),
      orderBy: [desc(productionBatches.readyAt), asc(productionBatches.batchCode)],
    })
    return ok(c, rows)
  },
)

supplyRoutes.post(
  '/bizes/:bizId/production-batches',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = productionBatchBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid production batch body.', 400, parsed.error.flatten())

    const createdOrResponse = await createSupplyRow<typeof productionBatches.$inferSelect>({
      c,
      bizId,
      tableKey: 'productionBatches',
      subjectType: 'production_batch',
      displayName: parsed.data.batchCode,
      data: {
        bizId,
        locationId: parsed.data.locationId ?? null,
        sellableId: parsed.data.sellableId,
        batchCode: sanitizePlainText(parsed.data.batchCode),
        name: parsed.data.name ? sanitizePlainText(parsed.data.name) : null,
        status: sanitizePlainText(parsed.data.status),
        statusConfigValueId: parsed.data.statusConfigValueId ?? null,
        plannedQuantity: parsed.data.plannedQuantity,
        producedQuantity: parsed.data.producedQuantity,
        reservedQuantity: parsed.data.reservedQuantity,
        releasedQuantity: parsed.data.releasedQuantity,
        productionStartAt: parsed.data.productionStartAt ? new Date(parsed.data.productionStartAt) : null,
        readyAt: parsed.data.readyAt ? new Date(parsed.data.readyAt) : null,
        expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
        closedAt: parsed.data.closedAt ? new Date(parsed.data.closedAt) : null,
        policySnapshot: sanitizeUnknown(parsed.data.policySnapshot ?? {}),
        metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
      },
    })
    if (createdOrResponse instanceof Response) return createdOrResponse
    const created = createdOrResponse

    return ok(c, created, 201)
  },
)

supplyRoutes.patch(
  '/bizes/:bizId/production-batches/:batchId',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, batchId } = c.req.param()
    const parsed = productionBatchPatchSchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid production batch body.', 400, parsed.error.flatten())

    const existing = await db.query.productionBatches.findFirst({
      where: and(eq(productionBatches.bizId, bizId), eq(productionBatches.id, batchId)),
    })
    if (!existing) return fail(c, 'NOT_FOUND', 'Production batch not found.', 404)

    const updatedOrResponse = await updateSupplyRow<typeof productionBatches.$inferSelect>({
      c,
      bizId,
      tableKey: 'productionBatches',
      subjectType: 'production_batch',
      id: batchId,
      notFoundMessage: 'Production batch not found.',
      patch: {
        locationId: parsed.data.locationId === undefined ? undefined : parsed.data.locationId,
        sellableId: parsed.data.sellableId ?? undefined,
        batchCode: parsed.data.batchCode ? sanitizePlainText(parsed.data.batchCode) : undefined,
        name: parsed.data.name === undefined ? undefined : parsed.data.name ? sanitizePlainText(parsed.data.name) : null,
        status: parsed.data.status ? sanitizePlainText(parsed.data.status) : undefined,
        statusConfigValueId: parsed.data.statusConfigValueId === undefined ? undefined : parsed.data.statusConfigValueId,
        plannedQuantity: parsed.data.plannedQuantity ?? undefined,
        producedQuantity: parsed.data.producedQuantity ?? undefined,
        reservedQuantity: parsed.data.reservedQuantity ?? undefined,
        releasedQuantity: parsed.data.releasedQuantity ?? undefined,
        productionStartAt: parsed.data.productionStartAt === undefined ? undefined : parsed.data.productionStartAt ? new Date(parsed.data.productionStartAt) : null,
        readyAt: parsed.data.readyAt === undefined ? undefined : parsed.data.readyAt ? new Date(parsed.data.readyAt) : null,
        expiresAt: parsed.data.expiresAt === undefined ? undefined : parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
        closedAt: parsed.data.closedAt === undefined ? undefined : parsed.data.closedAt ? new Date(parsed.data.closedAt) : null,
        policySnapshot: parsed.data.policySnapshot ? sanitizeUnknown(parsed.data.policySnapshot) : undefined,
        metadata: parsed.data.metadata ? sanitizeUnknown(parsed.data.metadata) : undefined,
      },
    })
    if (updatedOrResponse instanceof Response) return updatedOrResponse
    const updated = updatedOrResponse

    return ok(c, updated)
  },
)

supplyRoutes.get(
  '/bizes/:bizId/production-batches/:batchId/reservations',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, batchId } = c.req.param()
    const rows = await db.query.productionBatchReservations.findMany({
      where: and(eq(productionBatchReservations.bizId, bizId), eq(productionBatchReservations.productionBatchId, batchId)),
      orderBy: [asc(productionBatchReservations.requestedAt), asc(productionBatchReservations.id)],
    })
    return ok(c, rows)
  },
)

supplyRoutes.post(
  '/bizes/:bizId/production-batches/:batchId/reservations',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, batchId } = c.req.param()
    const parsed = productionBatchReservationBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid batch reservation body.', 400, parsed.error.flatten())

    const createdOrResponse = await createSupplyRow<typeof productionBatchReservations.$inferSelect>({
      c,
      bizId,
      tableKey: 'productionBatchReservations',
      subjectType: 'production_batch_reservation',
      data: {
        bizId,
        productionBatchId: batchId,
        status: sanitizePlainText(parsed.data.status),
        statusConfigValueId: parsed.data.statusConfigValueId ?? null,
        ownerUserId: parsed.data.ownerUserId ?? null,
        ownerGroupAccountId: parsed.data.ownerGroupAccountId ?? null,
        guestEmail: parsed.data.guestEmail ?? null,
        requestedQuantity: parsed.data.requestedQuantity,
        allocatedQuantity: parsed.data.allocatedQuantity,
        paidAmountMinor: parsed.data.paidAmountMinor,
        currency: parsed.data.currency,
        sourceCheckoutSessionId: parsed.data.sourceCheckoutSessionId ?? null,
        bookingOrderId: parsed.data.bookingOrderId ?? null,
        requestedAt: parsed.data.requestedAt ? new Date(parsed.data.requestedAt) : new Date(),
        fulfilledAt: parsed.data.fulfilledAt ? new Date(parsed.data.fulfilledAt) : null,
        cancelledAt: parsed.data.cancelledAt ? new Date(parsed.data.cancelledAt) : null,
        expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
        notes: parsed.data.notes ? sanitizePlainText(parsed.data.notes) : null,
        metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
      },
    })
    if (createdOrResponse instanceof Response) return createdOrResponse
    const created = createdOrResponse
    return ok(c, created, 201)
  },
)

supplyRoutes.patch(
  '/bizes/:bizId/production-batches/:batchId/reservations/:reservationId',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, batchId, reservationId } = c.req.param()
    const parsed = productionBatchReservationPatchSchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid batch reservation body.', 400, parsed.error.flatten())

    const existing = await db.query.productionBatchReservations.findFirst({
      where: and(
        eq(productionBatchReservations.bizId, bizId),
        eq(productionBatchReservations.productionBatchId, batchId),
        eq(productionBatchReservations.id, reservationId),
      ),
    })
    if (!existing) return fail(c, 'NOT_FOUND', 'Production batch reservation not found.', 404)

    const updatedOrResponse = await updateSupplyRow<typeof productionBatchReservations.$inferSelect>({
      c,
      bizId,
      tableKey: 'productionBatchReservations',
      subjectType: 'production_batch_reservation',
      id: reservationId,
      notFoundMessage: 'Production batch reservation not found.',
      patch: {
        status: parsed.data.status ? sanitizePlainText(parsed.data.status) : undefined,
        statusConfigValueId: parsed.data.statusConfigValueId === undefined ? undefined : parsed.data.statusConfigValueId,
        ownerUserId: parsed.data.ownerUserId === undefined ? undefined : parsed.data.ownerUserId,
        ownerGroupAccountId: parsed.data.ownerGroupAccountId === undefined ? undefined : parsed.data.ownerGroupAccountId,
        guestEmail: parsed.data.guestEmail === undefined ? undefined : parsed.data.guestEmail,
        requestedQuantity: parsed.data.requestedQuantity ?? undefined,
        allocatedQuantity: parsed.data.allocatedQuantity ?? undefined,
        paidAmountMinor: parsed.data.paidAmountMinor ?? undefined,
        currency: parsed.data.currency ?? undefined,
        sourceCheckoutSessionId: parsed.data.sourceCheckoutSessionId === undefined ? undefined : parsed.data.sourceCheckoutSessionId,
        bookingOrderId: parsed.data.bookingOrderId === undefined ? undefined : parsed.data.bookingOrderId,
        requestedAt: parsed.data.requestedAt === undefined ? undefined : new Date(parsed.data.requestedAt),
        fulfilledAt: parsed.data.fulfilledAt === undefined ? undefined : parsed.data.fulfilledAt ? new Date(parsed.data.fulfilledAt) : null,
        cancelledAt: parsed.data.cancelledAt === undefined ? undefined : parsed.data.cancelledAt ? new Date(parsed.data.cancelledAt) : null,
        expiresAt: parsed.data.expiresAt === undefined ? undefined : parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
        notes: parsed.data.notes === undefined ? undefined : parsed.data.notes ? sanitizePlainText(parsed.data.notes) : null,
        metadata: parsed.data.metadata ? sanitizeUnknown(parsed.data.metadata) : undefined,
      },
    })
    if (updatedOrResponse instanceof Response) return updatedOrResponse
    const updated = updatedOrResponse
    return ok(c, updated)
  },
)
