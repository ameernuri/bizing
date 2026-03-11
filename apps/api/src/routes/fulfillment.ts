/**
 * Fulfillment routes
 *
 * Why this module exists:
 * - one booking can require multiple real assignments (lead + assistant),
 * - schedulers need a canonical way to ask "is this slot feasible if all of
 *   these resources must be free at the same time?",
 * - saga validation needs first-class APIs for multi-person execution rather
 *   than burying assignment intent in JSON metadata.
 */

import { Hono } from 'hono'
import { and, eq, inArray } from 'drizzle-orm'
import { z } from 'zod'
import dbPackage from '@bizing/db'
import {
  getCurrentUser,
  requireAclPermission,
  requireAuth,
  requireBizAccess,
} from '../middleware/auth.js'
import { executeCrudRouteAction } from '../services/action-route-bridge.js'
import { fail, ok } from './_api.js'

const {
  db,
  fulfillmentUnits,
  fulfillmentAssignments,
  compensationAssignmentRoles,
  resources,
  bookingOrders,
  bookingOrderLines,
} = dbPackage

async function createFulfillmentRow<
  TTableKey extends 'fulfillmentUnits' | 'fulfillmentAssignments' | 'compensationAssignmentRoles',
>(
  c: Parameters<typeof executeCrudRouteAction>[0]['c'],
  bizId: string,
  tableKey: TTableKey,
  data: Parameters<typeof executeCrudRouteAction>[0]['data'],
  meta: { subjectType: string; subjectId: string; displayName: string; source: string },
) {
  const result = await executeCrudRouteAction({
    c,
    bizId,
    tableKey,
    operation: 'create',
    data,
    subjectType: meta.subjectType,
    subjectId: meta.subjectId,
    displayName: meta.displayName,
    metadata: { source: meta.source },
  })
  if (!result.ok) throw new Error(result.message ?? `Failed to create ${tableKey}`)
  if (!result.row) throw new Error(`Missing row for ${tableKey} create`)
  return result.row
}

async function updateFulfillmentAssignmentRow(
  c: Parameters<typeof executeCrudRouteAction>[0]['c'],
  bizId: string,
  fulfillmentAssignmentId: string,
  patch: Parameters<typeof executeCrudRouteAction>[0]['patch'],
) {
  const result = await executeCrudRouteAction({
    c,
    bizId,
    tableKey: 'fulfillmentAssignments',
    operation: 'update',
    id: fulfillmentAssignmentId,
    patch,
    subjectType: 'fulfillment_assignment',
    subjectId: fulfillmentAssignmentId,
    displayName: 'update fulfillment assignment',
    metadata: { source: 'routes.fulfillment.updateAssignment' },
  })
  if (!result.ok) throw new Error(result.message ?? 'Failed to update fulfillment assignment')
  if (!result.row) throw new Error('Missing row for fulfillment assignment update')
  return result.row
}

const activeAssignmentStatuses = new Set(['reserved', 'confirmed', 'in_progress'])

const createFulfillmentUnitBodySchema = z.object({
  bookingOrderId: z.string(),
  bookingOrderLineId: z.string().optional(),
  kind: z.enum(['service_task', 'rental_segment', 'transport_leg', 'queue_service', 'async_review']).default('service_task'),
  status: z.enum(['planned', 'ready', 'held', 'in_progress', 'completed', 'cancelled', 'blocked']).default('planned'),
  code: z.string().max(140).optional(),
  plannedStartAt: z.string().datetime(),
  plannedEndAt: z.string().datetime(),
  locationId: z.string().optional(),
  calendarBindingId: z.string().optional(),
  assignmentPolicy: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
})

const createFulfillmentAssignmentBodySchema = z.object({
  resourceId: z.string(),
  status: z.enum(['proposed', 'reserved', 'confirmed', 'in_progress', 'completed', 'cancelled', 'failed']).default('confirmed'),
  conflictPolicy: z.enum(['enforce_no_overlap', 'allow_overlap']).default('enforce_no_overlap'),
  roleLabel: z.string().max(120).optional(),
  roleTemplateId: z.string().optional(),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  isPrimary: z.boolean().default(false),
  compensationSplitBps: z.number().int().min(0).max(10000).optional(),
  metadata: z.record(z.unknown()).optional(),
})

const updateFulfillmentAssignmentBodySchema = createFulfillmentAssignmentBodySchema.partial()

const slotFeasibilityBodySchema = z.object({
  plannedStartAt: z.string().datetime(),
  plannedEndAt: z.string().datetime(),
  resourceIds: z.array(z.string()).min(1),
})

type ActiveAssignmentRow = typeof fulfillmentAssignments.$inferSelect

function overlaps(startA: Date, endA: Date, startB: Date | null, endB: Date | null) {
  if (!startB || !endB) return false
  return startA.getTime() < endB.getTime() && endA.getTime() > startB.getTime()
}

async function loadResourceConflicts(
  bizId: string,
  resourceIds: string[],
  plannedStartAt: Date,
  plannedEndAt: Date,
) {
  if (resourceIds.length === 0) return []
  const rows = await db.query.fulfillmentAssignments.findMany({
    where: and(eq(fulfillmentAssignments.bizId, bizId), inArray(fulfillmentAssignments.resourceId, resourceIds)),
  })
  return rows.filter(
    (row) =>
      activeAssignmentStatuses.has(row.status) &&
      row.conflictPolicy === 'enforce_no_overlap' &&
      overlaps(plannedStartAt, plannedEndAt, row.startsAt, row.endsAt),
  )
}

export const fulfillmentRoutes = new Hono()

fulfillmentRoutes.post(
  '/bizes/:bizId/fulfillment-units',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('booking_orders.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = createFulfillmentUnitBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())

    const booking = await db.query.bookingOrders.findFirst({
      where: and(eq(bookingOrders.bizId, bizId), eq(bookingOrders.id, parsed.data.bookingOrderId)),
    })
    if (!booking) return fail(c, 'NOT_FOUND', 'Booking order not found.', 404)

    if (parsed.data.bookingOrderLineId) {
      const line = await db.query.bookingOrderLines.findFirst({
        where: and(
          eq(bookingOrderLines.bizId, bizId),
          eq(bookingOrderLines.bookingOrderId, parsed.data.bookingOrderId),
          eq(bookingOrderLines.id, parsed.data.bookingOrderLineId),
        ),
      })
      if (!line) {
        return fail(c, 'VALIDATION_ERROR', 'bookingOrderLineId must belong to the provided bookingOrderId.', 400)
      }
    }

    const unit = await createFulfillmentRow(
      c,
      bizId,
      'fulfillmentUnits',
      {
        bizId,
        bookingOrderId: parsed.data.bookingOrderId,
        bookingOrderLineId: parsed.data.bookingOrderLineId ?? null,
        kind: parsed.data.kind,
        status: parsed.data.status,
        code: parsed.data.code,
        plannedStartAt: new Date(parsed.data.plannedStartAt),
        plannedEndAt: new Date(parsed.data.plannedEndAt),
        locationId: parsed.data.locationId,
        calendarBindingId: parsed.data.calendarBindingId,
        assignmentPolicy: parsed.data.assignmentPolicy ?? {},
        metadata: parsed.data.metadata ?? {},
      },
      {
        subjectType: 'fulfillment_unit',
        subjectId: parsed.data.bookingOrderId,
        displayName: parsed.data.kind,
        source: 'routes.fulfillment.createUnit',
      },
    )

    return ok(c, unit, 201)
  },
)

fulfillmentRoutes.get(
  '/bizes/:bizId/fulfillment-units/:fulfillmentUnitId/assignments',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('booking_orders.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, fulfillmentUnitId } = c.req.param()
    const rows = await db.query.fulfillmentAssignments.findMany({
      where: and(eq(fulfillmentAssignments.bizId, bizId), eq(fulfillmentAssignments.fulfillmentUnitId, fulfillmentUnitId)),
    })
    return ok(c, rows)
  },
)

fulfillmentRoutes.post(
  '/bizes/:bizId/fulfillment-units/:fulfillmentUnitId/assignments',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('resources.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, fulfillmentUnitId } = c.req.param()
    const user = getCurrentUser(c)
    const parsed = createFulfillmentAssignmentBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())

    const unit = await db.query.fulfillmentUnits.findFirst({
      where: and(eq(fulfillmentUnits.bizId, bizId), eq(fulfillmentUnits.id, fulfillmentUnitId)),
    })
    if (!unit) return fail(c, 'NOT_FOUND', 'Fulfillment unit not found.', 404)

    const resource = await db.query.resources.findFirst({
      where: and(eq(resources.bizId, bizId), eq(resources.id, parsed.data.resourceId)),
    })
    if (!resource) return fail(c, 'NOT_FOUND', 'Resource not found.', 404)

    const assignmentStartAt = parsed.data.startsAt ? new Date(parsed.data.startsAt) : unit.plannedStartAt
    const assignmentEndAt = parsed.data.endsAt ? new Date(parsed.data.endsAt) : unit.plannedEndAt
    if (!assignmentStartAt || !assignmentEndAt) {
      return fail(c, 'VALIDATION_ERROR', 'Assignment start/end must be present either on the unit or body.', 400)
    }

    if (parsed.data.conflictPolicy === 'enforce_no_overlap') {
      const conflicts = await loadResourceConflicts(bizId, [parsed.data.resourceId], assignmentStartAt, assignmentEndAt)
      if (conflicts.length > 0) {
        return fail(c, 'RESOURCE_CONFLICT', 'Resource already has an overlapping active assignment.', 409, {
          conflictingAssignmentIds: conflicts.map((row) => row.id),
        })
      }
    }

    const assignment = await createFulfillmentRow(
      c,
      bizId,
      'fulfillmentAssignments',
      {
        bizId,
        fulfillmentUnitId,
        resourceId: parsed.data.resourceId,
        status: parsed.data.status,
        conflictPolicy: parsed.data.conflictPolicy,
        roleLabel: parsed.data.roleLabel,
        startsAt: assignmentStartAt,
        endsAt: assignmentEndAt,
        isPrimary: parsed.data.isPrimary,
        compensationSplitBps: parsed.data.compensationSplitBps ?? null,
        assignedByUserId: user?.id ?? null,
        assignedAt: new Date(),
        metadata: parsed.data.metadata ?? {},
      },
      {
        subjectType: 'fulfillment_assignment',
        subjectId: fulfillmentUnitId,
        displayName: parsed.data.resourceId,
        source: 'routes.fulfillment.createAssignment',
      },
    )

    if (parsed.data.roleTemplateId) {
      await createFulfillmentRow(
        c,
        bizId,
        'compensationAssignmentRoles',
        {
          bizId,
          fulfillmentAssignmentId: assignment.id,
          roleTemplateId: parsed.data.roleTemplateId,
          source: 'manual',
          assignedByUserId: user?.id ?? null,
          metadata: {
            sourceRoute: 'fulfillment.assignments.create',
          },
        },
        {
          subjectType: 'compensation_assignment_role',
          subjectId: String(assignment.id),
          displayName: parsed.data.roleTemplateId,
          source: 'routes.fulfillment.createAssignmentRole',
        },
      )
    }

    return ok(c, assignment, 201)
  },
)

fulfillmentRoutes.patch(
  '/bizes/:bizId/fulfillment-assignments/:fulfillmentAssignmentId',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('resources.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, fulfillmentAssignmentId } = c.req.param()
    const parsed = updateFulfillmentAssignmentBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())

    const existing = await db.query.fulfillmentAssignments.findFirst({
      where: and(eq(fulfillmentAssignments.bizId, bizId), eq(fulfillmentAssignments.id, fulfillmentAssignmentId)),
    })
    if (!existing) return fail(c, 'NOT_FOUND', 'Fulfillment assignment not found.', 404)

    const startsAt = parsed.data.startsAt ? new Date(parsed.data.startsAt) : existing.startsAt
    const endsAt = parsed.data.endsAt ? new Date(parsed.data.endsAt) : existing.endsAt
    const nextResourceId = parsed.data.resourceId ?? existing.resourceId
    const nextConflictPolicy = parsed.data.conflictPolicy ?? existing.conflictPolicy

    if (nextConflictPolicy === 'enforce_no_overlap' && startsAt && endsAt) {
      const conflicts = (await loadResourceConflicts(bizId, [nextResourceId], startsAt, endsAt)).filter(
        (row) => row.id !== fulfillmentAssignmentId,
      )
      if (conflicts.length > 0) {
        return fail(c, 'RESOURCE_CONFLICT', 'Resource already has an overlapping active assignment.', 409, {
          conflictingAssignmentIds: conflicts.map((row) => row.id),
        })
      }
    }

    const updated = await updateFulfillmentAssignmentRow(c, bizId, fulfillmentAssignmentId, {
      resourceId: parsed.data.resourceId,
      status: parsed.data.status,
      conflictPolicy: parsed.data.conflictPolicy,
      roleLabel: parsed.data.roleLabel,
      startsAt,
      endsAt,
      isPrimary: parsed.data.isPrimary,
      compensationSplitBps: parsed.data.compensationSplitBps,
      metadata: parsed.data.metadata,
    })

    return ok(c, updated)
  },
)

/**
 * Slot feasibility API
 *
 * ELI5:
 * - input = "I need these exact resources at this exact time",
 * - output = "yes, everyone is free" or "no, these people already have work".
 */
fulfillmentRoutes.post(
  '/bizes/:bizId/fulfillment/slot-feasibility',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('booking_orders.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = slotFeasibilityBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())

    const plannedStartAt = new Date(parsed.data.plannedStartAt)
    const plannedEndAt = new Date(parsed.data.plannedEndAt)
    const conflicts = await loadResourceConflicts(bizId, parsed.data.resourceIds, plannedStartAt, plannedEndAt)

    const byResource = new Map<string, ActiveAssignmentRow[]>()
    for (const row of conflicts) {
      const list = byResource.get(row.resourceId) ?? []
      list.push(row)
      byResource.set(row.resourceId, list)
    }

    return ok(c, {
      feasible: conflicts.length === 0,
      checkedResourceIds: parsed.data.resourceIds,
      conflictingResourceIds: Array.from(byResource.keys()),
      conflicts: conflicts.map((row) => ({
        assignmentId: row.id,
        resourceId: row.resourceId,
        status: row.status,
        startsAt: row.startsAt?.toISOString() ?? null,
        endsAt: row.endsAt?.toISOString() ?? null,
      })),
    })
  },
)
