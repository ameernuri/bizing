/**
 * Operations read-model routes.
 *
 * ELI5:
 * Core tables store precise facts. Operators also need one summary payload that
 * says "how are my locations doing right now?" This route gives that overview
 * without forcing every client to manually join half the schema.
 */

import { Hono } from 'hono'
import { and, asc, desc, eq, inArray } from 'drizzle-orm'
import { z } from 'zod'
import dbPackage from '@bizing/db'
import {
  requireAclPermission,
  requireAuth,
  requireBizAccess,
} from '../middleware/auth.js'
import { executeCrudRouteAction } from '../services/action-route-bridge.js'
import { fail, ok } from './_api.js'

const {
  db,
  locations,
  resources,
  bookingOrders,
  demandPricingPolicies,
  queues,
  operationalDemands,
  operationalAssignments,
  staffingDemands,
  staffingAssignments,
  fulfillmentUnits,
  fulfillmentAssignments,
} = dbPackage

async function createOperationsRow<TTableKey extends 'operationalDemands' | 'operationalAssignments'>(
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

const operationalDemandSourceTypeSchema = z.enum([
  'fulfillment_unit',
  'staffing_demand',
  'custom_subject',
])

const operationalLifecycleStatusSchema = z.enum([
  'draft',
  'active',
  'inactive',
  'suspended',
  'archived',
])

const createOperationalDemandBodySchema = z.object({
  sourceType: operationalDemandSourceTypeSchema,
  fulfillmentUnitId: z.string().optional(),
  staffingDemandId: z.string().optional(),
  customSubjectType: z.string().min(1).max(80).optional(),
  customSubjectId: z.string().min(1).max(140).optional(),
  status: operationalLifecycleStatusSchema.default('active'),
  sourceStatus: z.string().min(1).max(80),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  priority: z.number().int().min(0).default(100),
  metadata: z.record(z.unknown()).optional(),
}).superRefine((value, ctx) => {
  if (value.sourceType === 'fulfillment_unit' && !value.fulfillmentUnitId) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'fulfillmentUnitId is required.' })
  if (value.sourceType === 'staffing_demand' && !value.staffingDemandId) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'staffingDemandId is required.' })
  if (value.sourceType === 'custom_subject' && (!value.customSubjectType || !value.customSubjectId)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'customSubjectType and customSubjectId are required.' })
})

const createOperationalAssignmentBodySchema = z.object({
  operationalDemandId: z.string().min(1),
  resourceId: z.string().min(1),
  sourceType: z.enum(['fulfillment_assignment', 'staffing_assignment', 'custom_subject']),
  fulfillmentAssignmentId: z.string().optional(),
  staffingAssignmentId: z.string().optional(),
  customSubjectType: z.string().min(1).max(80).optional(),
  customSubjectId: z.string().min(1).max(140).optional(),
  status: operationalLifecycleStatusSchema.default('active'),
  sourceStatus: z.string().min(1).max(80),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime().optional(),
  metadata: z.record(z.unknown()).optional(),
}).superRefine((value, ctx) => {
  if (value.sourceType === 'fulfillment_assignment' && !value.fulfillmentAssignmentId) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'fulfillmentAssignmentId is required.' })
  if (value.sourceType === 'staffing_assignment' && !value.staffingAssignmentId) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'staffingAssignmentId is required.' })
  if (value.sourceType === 'custom_subject' && (!value.customSubjectType || !value.customSubjectId)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'customSubjectType and customSubjectId are required.' })
})

const listOperationalDemandsQuerySchema = z.object({
  status: operationalLifecycleStatusSchema.optional(),
  sourceType: operationalDemandSourceTypeSchema.optional(),
})

function locationIdFromMetadata(metadata: unknown) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null
  const value = (metadata as Record<string, unknown>).locationId
  return typeof value === 'string' && value.length > 0 ? value : null
}

function secondaryLocationIdsFromMetadata(metadata: unknown) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return []
  const value = (metadata as Record<string, unknown>).secondaryLocationIds
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0) : []
}

function serviceProductIdFromMetadata(metadata: unknown) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null
  const value = (metadata as Record<string, unknown>).serviceProductId
  return typeof value === 'string' && value.length > 0 ? value : null
}

function sourceFromMetadata(metadata: unknown) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return 'unknown'
  const value = (metadata as Record<string, unknown>).acquisitionSource
  return typeof value === 'string' && value.length > 0 ? value : 'unknown'
}

function providerUserIdFromMetadata(metadata: unknown) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null
  const value = (metadata as Record<string, unknown>).providerUserId
  return typeof value === 'string' && value.length > 0 ? value : null
}

type BookingAnalyticsRow = {
  locationId: string | null
  serviceProductId: string | null
  providerUserId: string | null
  acquisitionSource: string | null
  attendanceOutcome: string | null
  leadTimeMinutes: number | null
  metadata: unknown
}

function bookingLocationId(row: BookingAnalyticsRow) {
  return row.locationId ?? locationIdFromMetadata(row.metadata)
}

function bookingServiceProductId(row: BookingAnalyticsRow) {
  return row.serviceProductId ?? serviceProductIdFromMetadata(row.metadata)
}

function bookingProviderUserId(row: BookingAnalyticsRow) {
  return row.providerUserId ?? providerUserIdFromMetadata(row.metadata)
}

function bookingAcquisitionSource(row: BookingAnalyticsRow) {
  return row.acquisitionSource ?? sourceFromMetadata(row.metadata)
}

function bookingAttendanceOutcome(row: BookingAnalyticsRow) {
  if (typeof row.attendanceOutcome === 'string' && row.attendanceOutcome.length > 0) {
    return row.attendanceOutcome
  }
  const metadata = row.metadata as Record<string, unknown> | null
  return metadata && metadata.attendanceOutcome === 'no_show' ? 'no_show' : null
}

function bookingLeadTimeMinutes(row: BookingAnalyticsRow) {
  if (typeof row.leadTimeMinutes === 'number' && Number.isFinite(row.leadTimeMinutes) && row.leadTimeMinutes >= 0) {
    return row.leadTimeMinutes
  }
  const hintedLeadTime = Number((row.metadata as Record<string, unknown> | null)?.leadTimeMinutes ?? NaN)
  return Number.isFinite(hintedLeadTime) && hintedLeadTime >= 0 ? hintedLeadTime : null
}

export const operationsRoutes = new Hono()

operationsRoutes.get(
  '/bizes/:bizId/operational-demands',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = listOperationalDemandsQuerySchema.safeParse(c.req.query())
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid query parameters.', 400, parsed.error.flatten())
    }

    const rows = await db.query.operationalDemands.findMany({
      where: and(
        eq(operationalDemands.bizId, bizId),
        parsed.data.status ? eq(operationalDemands.status, parsed.data.status) : undefined,
        parsed.data.sourceType ? eq(operationalDemands.sourceType, parsed.data.sourceType) : undefined,
      ),
      orderBy: [asc(operationalDemands.startsAt), asc(operationalDemands.priority)],
    })
    return ok(c, rows)
  },
)

operationsRoutes.post(
  '/bizes/:bizId/operational-demands',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = createOperationalDemandBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return c.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid request body.', details: parsed.error.flatten() } }, 400)

    const existing = await db.query.operationalDemands.findFirst({
      where: and(
        eq(operationalDemands.bizId, bizId),
        parsed.data.sourceType === 'fulfillment_unit'
          ? eq(operationalDemands.fulfillmentUnitId, parsed.data.fulfillmentUnitId ?? '')
          : undefined,
        parsed.data.sourceType === 'staffing_demand'
          ? eq(operationalDemands.staffingDemandId, parsed.data.staffingDemandId ?? '')
          : undefined,
        parsed.data.sourceType === 'custom_subject'
          ? eq(operationalDemands.customSubjectType, parsed.data.customSubjectType ?? '')
          : undefined,
        parsed.data.sourceType === 'custom_subject'
          ? eq(operationalDemands.customSubjectId, parsed.data.customSubjectId ?? '')
          : undefined,
      ),
    })
    if (existing) return ok(c, existing)

    const row = await createOperationsRow(
      c,
      bizId,
      'operationalDemands',
      {
        bizId,
        sourceType: parsed.data.sourceType,
        fulfillmentUnitId: parsed.data.fulfillmentUnitId ?? null,
        staffingDemandId: parsed.data.staffingDemandId ?? null,
        customSubjectType: parsed.data.customSubjectType ?? null,
        customSubjectId: parsed.data.customSubjectId ?? null,
        status: parsed.data.status,
        sourceStatus: parsed.data.sourceStatus,
        startsAt: parsed.data.startsAt ? new Date(parsed.data.startsAt) : null,
        endsAt: parsed.data.endsAt ? new Date(parsed.data.endsAt) : null,
        priority: parsed.data.priority,
        metadata: parsed.data.metadata ?? {},
      },
      {
        subjectType: 'operational_demand',
        subjectId: parsed.data.customSubjectId ?? parsed.data.fulfillmentUnitId ?? parsed.data.staffingDemandId ?? 'custom',
        displayName: parsed.data.sourceType,
        source: 'routes.operations.createDemand',
      },
    )
    return ok(c, row, 201)
  },
)

operationsRoutes.get(
  '/bizes/:bizId/operational-assignments',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const resourceId = c.req.query('resourceId')
    const rows = await db.query.operationalAssignments.findMany({
      where: and(
        eq(operationalAssignments.bizId, bizId),
        resourceId ? eq(operationalAssignments.resourceId, resourceId) : undefined,
      ),
      orderBy: [asc(operationalAssignments.startsAt), asc(operationalAssignments.id)],
    })
    return ok(c, rows)
  },
)

operationsRoutes.post(
  '/bizes/:bizId/operational-assignments',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = createOperationalAssignmentBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return c.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid request body.', details: parsed.error.flatten() } }, 400)

    const existing = await db.query.operationalAssignments.findFirst({
      where: and(
        eq(operationalAssignments.bizId, bizId),
        parsed.data.sourceType === 'fulfillment_assignment'
          ? eq(operationalAssignments.fulfillmentAssignmentId, parsed.data.fulfillmentAssignmentId ?? '')
          : undefined,
        parsed.data.sourceType === 'staffing_assignment'
          ? eq(operationalAssignments.staffingAssignmentId, parsed.data.staffingAssignmentId ?? '')
          : undefined,
        parsed.data.sourceType === 'custom_subject'
          ? eq(operationalAssignments.customSubjectType, parsed.data.customSubjectType ?? '')
          : undefined,
        parsed.data.sourceType === 'custom_subject'
          ? eq(operationalAssignments.customSubjectId, parsed.data.customSubjectId ?? '')
          : undefined,
      ),
    })
    if (existing) return ok(c, existing)

    const row = await createOperationsRow(
      c,
      bizId,
      'operationalAssignments',
      {
        bizId,
        operationalDemandId: parsed.data.operationalDemandId,
        resourceId: parsed.data.resourceId,
        sourceType: parsed.data.sourceType,
        fulfillmentAssignmentId: parsed.data.fulfillmentAssignmentId ?? null,
        staffingAssignmentId: parsed.data.staffingAssignmentId ?? null,
        customSubjectType: parsed.data.customSubjectType ?? null,
        customSubjectId: parsed.data.customSubjectId ?? null,
        status: parsed.data.status,
        sourceStatus: parsed.data.sourceStatus,
        startsAt: new Date(parsed.data.startsAt),
        endsAt: parsed.data.endsAt ? new Date(parsed.data.endsAt) : null,
        metadata: parsed.data.metadata ?? {},
      },
      {
        subjectType: 'operational_assignment',
        subjectId: parsed.data.resourceId,
        displayName: parsed.data.sourceType,
        source: 'routes.operations.createAssignment',
      },
    )
    return ok(c, row, 201)
  },
)

operationsRoutes.get(
  '/bizes/:bizId/operations/location-overview',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')

    const [locationRows, resourceRows, bookingRows, pricingRows, queueRows] = await Promise.all([
      db.query.locations.findMany({
        where: and(eq(locations.bizId, bizId), eq(locations.status, 'active')),
        orderBy: [locations.name],
      }),
      db.query.resources.findMany({
        where: eq(resources.bizId, bizId),
        columns: { id: true, locationId: true, type: true, hostUserId: true, name: true, metadata: true },
      }),
      db.query.bookingOrders.findMany({
        where: eq(bookingOrders.bizId, bizId),
        columns: { id: true, status: true, totalMinor: true, locationId: true, metadata: true },
      }),
      db.query.demandPricingPolicies.findMany({
        where: eq(demandPricingPolicies.bizId, bizId),
        columns: { id: true, locationId: true, isEnabled: true, status: true, name: true },
      }),
      db.query.queues.findMany({
        where: eq(queues.bizId, bizId),
        columns: { id: true, locationId: true, status: true, name: true },
      }),
    ])

    const resourceAggByLocation = new Map<
      string,
      { total: number; hosts: number; venues: number; assets: number }
    >()
    const hostLocations = new Map<string, Set<string>>()
    for (const row of resourceRows) {
      if (!row.locationId) continue
      const aggregate = resourceAggByLocation.get(row.locationId) ?? {
        total: 0,
        hosts: 0,
        venues: 0,
        assets: 0,
      }
      aggregate.total += 1
      if (row.type === 'host') aggregate.hosts += 1
      if (row.type === 'venue') aggregate.venues += 1
      if (row.type === 'asset') aggregate.assets += 1
      resourceAggByLocation.set(row.locationId, aggregate)

      if (row.type === 'host' && row.hostUserId) {
        const locationsForHost = hostLocations.get(row.hostUserId) ?? new Set<string>()
        locationsForHost.add(row.locationId)
        for (const secondaryLocationId of secondaryLocationIdsFromMetadata(
          (row as unknown as { metadata?: unknown }).metadata,
        )) {
          locationsForHost.add(secondaryLocationId)
        }
        hostLocations.set(row.hostUserId, locationsForHost)
      }
    }
    const multiLocationHostCountByLocation = new Map<string, number>()
    for (const [, locationSet] of hostLocations) {
      if (locationSet.size <= 1) continue
      for (const locationId of locationSet) {
        multiLocationHostCountByLocation.set(
          locationId,
          (multiLocationHostCountByLocation.get(locationId) ?? 0) + 1,
        )
      }
    }

    const bookingAggByLocation = new Map<string, { total: number; confirmed: number; revenueMinor: number }>()
    for (const row of bookingRows) {
      const locationId = row.locationId ?? locationIdFromMetadata(row.metadata)
      if (!locationId) continue
      const aggregate = bookingAggByLocation.get(locationId) ?? {
        total: 0,
        confirmed: 0,
        revenueMinor: 0,
      }
      aggregate.total += 1
      if (row.status === 'confirmed') aggregate.confirmed += 1
      aggregate.revenueMinor += row.totalMinor
      bookingAggByLocation.set(locationId, aggregate)
    }

    const policyAggByLocation = new Map<string, { activePolicyCount: number; policyNames: string[] }>()
    for (const row of pricingRows) {
      if (!row.locationId || !row.isEnabled) continue
      const aggregate = policyAggByLocation.get(row.locationId) ?? {
        activePolicyCount: 0,
        policyNames: [],
      }
      aggregate.activePolicyCount += 1
      aggregate.policyNames.push(row.name)
      policyAggByLocation.set(row.locationId, aggregate)
    }

    const queueAggByLocation = new Map<string, { activeCount: number; queueNames: string[] }>()
    for (const row of queueRows) {
      if (!row.locationId || row.status === 'archived') continue
      const aggregate = queueAggByLocation.get(row.locationId) ?? {
        activeCount: 0,
        queueNames: [],
      }
      aggregate.activeCount += 1
      aggregate.queueNames.push(row.name)
      queueAggByLocation.set(row.locationId, aggregate)
    }

    const items = locationRows.map((location) => {
      const resourceAggregate = resourceAggByLocation.get(location.id) ?? {
        total: 0,
        hosts: 0,
        venues: 0,
        assets: 0,
      }
      const bookingAggregate = bookingAggByLocation.get(location.id) ?? {
        total: 0,
        confirmed: 0,
        revenueMinor: 0,
      }
      const policyAggregate = policyAggByLocation.get(location.id) ?? {
        activePolicyCount: 0,
        policyNames: [],
      }
      const queueAggregate = queueAggByLocation.get(location.id) ?? {
        activeCount: 0,
        queueNames: [],
      }
      return {
        locationId: location.id,
        name: location.name,
        slug: location.slug,
        timezone: location.timezone,
        operatingHours: location.operatingHours,
        serviceArea: location.serviceArea,
        resources: {
          ...resourceAggregate,
          multiLocationHostCount: multiLocationHostCountByLocation.get(location.id) ?? 0,
        },
        bookings: bookingAggregate,
        demandPricing: policyAggregate,
        queues: queueAggregate,
      }
    })

    return ok(c, {
      bizId,
      locations: items,
      summary: {
        locationCount: items.length,
        bookingCount: bookingRows.length,
        resourceCount: resourceRows.length,
        demandPricingPolicyCount: pricingRows.filter((row) => row.isEnabled).length,
      },
    })
  },
)

operationsRoutes.get(
  '/bizes/:bizId/analytics/overview',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')

    /**
     * ELI5:
     * This endpoint is the "owner sanity check" payload.
     *
     * Instead of forcing every client, agent, or saga to recalculate the same
     * booking totals from many tables, we assemble the most common questions in
     * one response:
     * - how much money came through,
     * - how many bookings exist,
     * - which statuses dominate,
     * - which offers/locations are doing the most work.
     *
     * This is intentionally a read model. The source of truth is still the
     * normalized booking/order tables.
     */
    const [locationRows, bookingRows] = await Promise.all([
      db.query.locations.findMany({
        where: and(eq(locations.bizId, bizId), eq(locations.status, 'active')),
        columns: { id: true, name: true, slug: true, timezone: true },
        orderBy: [locations.name],
      }),
      db.query.bookingOrders.findMany({
        where: eq(bookingOrders.bizId, bizId),
        columns: {
          id: true,
          offerId: true,
          offerVersionId: true,
          locationId: true,
          serviceProductId: true,
          providerUserId: true,
          acquisitionSource: true,
          attendanceOutcome: true,
          leadTimeMinutes: true,
          customerUserId: true,
          status: true,
          currency: true,
          subtotalMinor: true,
          taxMinor: true,
          feeMinor: true,
          discountMinor: true,
          totalMinor: true,
          requestedStartAt: true,
          requestedEndAt: true,
          confirmedStartAt: true,
          confirmedEndAt: true,
          metadata: true,
        },
        orderBy: [desc(bookingOrders.confirmedStartAt), desc(bookingOrders.requestedStartAt), desc(bookingOrders.id)],
      }),
    ])

    const statusCounts = new Map<string, number>()
    const offerCounts = new Map<string, { bookingCount: number; revenueMinor: number }>()
    const locationCounts = new Map<
      string,
      { bookingCount: number; revenueMinor: number; confirmedCount: number; pendingCount: number }
    >()
    const serviceProductCounts = new Map<string, { bookingCount: number; revenueMinor: number }>()
    const sourceCounts = new Map<string, number>()
    const providerCounts = new Map<string, { bookingCount: number; confirmedCount: number; revenueMinor: number }>()
    const customerValue = new Map<string, { bookingCount: number; revenueMinor: number }>()
    const timeSlotCounts = new Map<string, number>()
    const dailyVolume = new Map<string, { bookingCount: number; revenueMinor: number }>()

    let totalRevenueMinor = 0
    let pendingCount = 0
    let confirmedCount = 0
    let cancelledCount = 0
    let noShowCount = 0
    let distinctCustomerCount = 0
    const seenCustomerIds = new Set<string>()
    let earliestBookingAt: string | null = null
    let latestBookingAt: string | null = null
    let leadTimeMinutesTotal = 0
    let leadTimeCount = 0

    for (const row of bookingRows) {
      totalRevenueMinor += row.totalMinor
      statusCounts.set(row.status, (statusCounts.get(row.status) ?? 0) + 1)
      const source = bookingAcquisitionSource(row)
      sourceCounts.set(source, (sourceCounts.get(source) ?? 0) + 1)
      if (bookingAttendanceOutcome(row) === 'no_show') noShowCount += 1

      if (row.customerUserId) seenCustomerIds.add(row.customerUserId)

      if (row.status === 'confirmed') confirmedCount += 1
      if (row.status === 'cancelled') cancelledCount += 1
      if (['draft', 'quoted', 'awaiting_payment', 'pending_confirmation'].includes(row.status)) pendingCount += 1

      const offerAggregate = offerCounts.get(row.offerId) ?? { bookingCount: 0, revenueMinor: 0 }
      offerAggregate.bookingCount += 1
      offerAggregate.revenueMinor += row.totalMinor
      offerCounts.set(row.offerId, offerAggregate)

      const locationId = bookingLocationId(row)
      if (locationId) {
        const locationAggregate = locationCounts.get(locationId) ?? {
          bookingCount: 0,
          revenueMinor: 0,
          confirmedCount: 0,
          pendingCount: 0,
        }
        locationAggregate.bookingCount += 1
        locationAggregate.revenueMinor += row.totalMinor
        if (row.status === 'confirmed') locationAggregate.confirmedCount += 1
        if (['draft', 'quoted', 'awaiting_payment', 'pending_confirmation'].includes(row.status)) {
          locationAggregate.pendingCount += 1
        }
        locationCounts.set(locationId, locationAggregate)
      }

      const serviceProductId = bookingServiceProductId(row)
      if (serviceProductId) {
        const current = serviceProductCounts.get(serviceProductId) ?? { bookingCount: 0, revenueMinor: 0 }
        current.bookingCount += 1
        current.revenueMinor += row.totalMinor
        serviceProductCounts.set(serviceProductId, current)
      }

      const providerUserId = bookingProviderUserId(row)
      if (providerUserId) {
        const current = providerCounts.get(providerUserId) ?? { bookingCount: 0, confirmedCount: 0, revenueMinor: 0 }
        current.bookingCount += 1
        current.revenueMinor += row.totalMinor
        if (row.status === 'confirmed') current.confirmedCount += 1
        providerCounts.set(providerUserId, current)
      }

      if (row.customerUserId) {
        const current = customerValue.get(row.customerUserId) ?? { bookingCount: 0, revenueMinor: 0 }
        current.bookingCount += 1
        current.revenueMinor += row.totalMinor
        customerValue.set(row.customerUserId, current)
      }

      const relevantTime =
        row.confirmedStartAt?.toISOString() ??
        row.requestedStartAt?.toISOString() ??
        row.confirmedEndAt?.toISOString() ??
        row.requestedEndAt?.toISOString() ??
        null
      if (relevantTime) {
        if (!earliestBookingAt || relevantTime < earliestBookingAt) earliestBookingAt = relevantTime
        if (!latestBookingAt || relevantTime > latestBookingAt) latestBookingAt = relevantTime
        const hourKey = relevantTime.slice(11, 13)
        timeSlotCounts.set(hourKey, (timeSlotCounts.get(hourKey) ?? 0) + 1)
        const dayKey = relevantTime.slice(0, 10)
        const dayAggregate = dailyVolume.get(dayKey) ?? { bookingCount: 0, revenueMinor: 0 }
        dayAggregate.bookingCount += 1
        dayAggregate.revenueMinor += row.totalMinor
        dailyVolume.set(dayKey, dayAggregate)
        const hintedLeadTime = bookingLeadTimeMinutes(row)
        if (hintedLeadTime !== null) {
          leadTimeMinutesTotal += hintedLeadTime
          leadTimeCount += 1
        }
      }
    }

    distinctCustomerCount = seenCustomerIds.size

    return ok(c, {
      bizId,
      summary: {
        bookingCount: bookingRows.length,
        confirmedCount,
        pendingCount,
        cancelledCount,
        cancellationRate: bookingRows.length ? cancelledCount / bookingRows.length : 0,
        noShowRate: bookingRows.length ? noShowCount / bookingRows.length : 0,
        totalRevenueMinor,
        distinctCustomerCount,
        averageLeadTimeMinutes: leadTimeCount ? Math.round(leadTimeMinutesTotal / leadTimeCount) : 0,
        currency: bookingRows[0]?.currency ?? 'USD',
        earliestBookingAt,
        latestBookingAt,
      },
      bookingStatusBreakdown: Array.from(statusCounts.entries())
        .map(([status, count]) => ({ status, count }))
        .sort((a, b) => b.count - a.count || a.status.localeCompare(b.status)),
      topOffers: Array.from(offerCounts.entries())
        .map(([offerId, aggregate]) => ({
          offerId,
          bookingCount: aggregate.bookingCount,
          revenueMinor: aggregate.revenueMinor,
        }))
        .sort((a, b) => b.revenueMinor - a.revenueMinor || b.bookingCount - a.bookingCount)
        .slice(0, 10),
      topServiceProducts: Array.from(serviceProductCounts.entries())
        .map(([serviceProductId, aggregate]) => ({
          serviceProductId,
          bookingCount: aggregate.bookingCount,
          revenueMinor: aggregate.revenueMinor,
        }))
        .sort((a, b) => b.revenueMinor - a.revenueMinor || b.bookingCount - a.bookingCount)
        .slice(0, 10),
      topAcquisitionSources: Array.from(sourceCounts.entries())
        .map(([source, bookingCount]) => ({ source, bookingCount }))
        .sort((a, b) => b.bookingCount - a.bookingCount || a.source.localeCompare(b.source))
        .slice(0, 10),
      providerPerformance: Array.from(providerCounts.entries())
        .map(([providerUserId, aggregate]) => ({ providerUserId, ...aggregate }))
        .sort((a, b) => b.revenueMinor - a.revenueMinor || b.bookingCount - a.bookingCount)
        .slice(0, 20),
      popularTimeSlots: Array.from(timeSlotCounts.entries())
        .map(([hourUtc, bookingCount]) => ({ hourUtc, bookingCount }))
        .sort((a, b) => b.bookingCount - a.bookingCount || a.hourUtc.localeCompare(b.hourUtc))
        .slice(0, 24),
      customerLifetimeValue: Array.from(customerValue.entries())
        .map(([customerUserId, aggregate]) => ({ customerUserId, ...aggregate }))
        .sort((a, b) => b.revenueMinor - a.revenueMinor || b.bookingCount - a.bookingCount)
        .slice(0, 20),
      bookingVolumeTrends: Array.from(dailyVolume.entries())
        .map(([date, aggregate]) => ({ date, bookingCount: aggregate.bookingCount, revenueMinor: aggregate.revenueMinor }))
        .sort((a, b) => a.date.localeCompare(b.date)),
      revenueForecast: {
        projectedMonthlyRevenueMinor: dailyVolume.size > 0 ? Math.round(totalRevenueMinor / dailyVolume.size * 30) : totalRevenueMinor,
      },
      locations: locationRows.map((location) => {
        const aggregate = locationCounts.get(location.id) ?? {
          bookingCount: 0,
          revenueMinor: 0,
          confirmedCount: 0,
          pendingCount: 0,
        }
        return {
          locationId: location.id,
          name: location.name,
          slug: location.slug,
          timezone: location.timezone,
          bookingCount: aggregate.bookingCount,
          confirmedCount: aggregate.confirmedCount,
          pendingCount: aggregate.pendingCount,
          revenueMinor: aggregate.revenueMinor,
        }
      }),
    })
  },
)

operationsRoutes.get(
  '/bizes/:bizId/operations/daily-facts',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const locationId = c.req.query('locationId')
    const sourceType = c.req.query('sourceType')

    const [opDemandRows, opAssignmentRows, staffingRows, fulfillmentUnitRows, fulfillmentAssignmentRows] = await Promise.all([
      db.query.operationalDemands.findMany({
        where: and(eq(operationalDemands.bizId, bizId), sourceType ? eq(operationalDemands.sourceType, sourceType as typeof operationalDemands.$inferSelect.sourceType) : undefined),
      }),
      db.query.operationalAssignments.findMany({
        where: and(eq(operationalAssignments.bizId, bizId)),
      }),
      db.query.staffingDemands.findMany({ where: eq(staffingDemands.bizId, bizId) }),
      db.query.fulfillmentUnits.findMany({ where: eq(fulfillmentUnits.bizId, bizId) }),
      db.query.fulfillmentAssignments.findMany({ where: eq(fulfillmentAssignments.bizId, bizId) }),
    ])

    const filteredAssignments = locationId
      ? opAssignmentRows.filter((row) => (row.metadata as Record<string, unknown> | null)?.locationId === locationId)
      : opAssignmentRows

    return ok(c, {
      summary: {
        openDemandCount: opDemandRows.filter((row) => ['draft', 'active'].includes(row.status)).length,
        filledDemandCount: staffingRows.filter((row) => row.status === 'filled').length,
        activeAssignmentCount: filteredAssignments.filter((row) => row.status === 'active').length,
        completedAssignmentCount: filteredAssignments.filter((row) => row.sourceStatus === 'completed').length,
        staffingDemandCount: staffingRows.length,
        fulfillmentUnitCount: fulfillmentUnitRows.length,
        fulfillmentAssignmentCount: fulfillmentAssignmentRows.length,
      },
      dimensions: {
        locationId: locationId ?? null,
        sourceType: sourceType ?? null,
      },
      operationalDemands: opDemandRows,
      operationalAssignments: filteredAssignments,
    })
  },
)
