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
import { ok } from './_api.js'

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

const createOperationalDemandBodySchema = z.object({
  sourceType: z.enum(['fulfillment_unit', 'staffing_demand', 'custom_subject']),
  fulfillmentUnitId: z.string().optional(),
  staffingDemandId: z.string().optional(),
  customSubjectType: z.string().min(1).max(80).optional(),
  customSubjectId: z.string().min(1).max(140).optional(),
  status: z.enum(['draft', 'active', 'inactive', 'suspended', 'archived']).default('active'),
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
  status: z.enum(['draft', 'active', 'inactive', 'suspended', 'archived']).default('active'),
  sourceStatus: z.string().min(1).max(80),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime().optional(),
  metadata: z.record(z.unknown()).optional(),
}).superRefine((value, ctx) => {
  if (value.sourceType === 'fulfillment_assignment' && !value.fulfillmentAssignmentId) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'fulfillmentAssignmentId is required.' })
  if (value.sourceType === 'staffing_assignment' && !value.staffingAssignmentId) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'staffingAssignmentId is required.' })
  if (value.sourceType === 'custom_subject' && (!value.customSubjectType || !value.customSubjectId)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'customSubjectType and customSubjectId are required.' })
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

function offerIdFromMetadata(metadata: unknown) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null
  const value = (metadata as Record<string, unknown>).offerId
  return typeof value === 'string' && value.length > 0 ? value : null
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

export const operationsRoutes = new Hono()

operationsRoutes.get(
  '/bizes/:bizId/operational-demands',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const status = c.req.query('status')
    const sourceType = c.req.query('sourceType')
    const rows = await db.query.operationalDemands.findMany({
      where: and(
        eq(operationalDemands.bizId, bizId),
        status ? eq(operationalDemands.status, status as typeof operationalDemands.$inferSelect.status) : undefined,
      sourceType ? eq(operationalDemands.sourceType, sourceType as never) : undefined,
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
    const [row] = await db.insert(operationalDemands).values({
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
    }).returning()
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
    const [row] = await db.insert(operationalAssignments).values({
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
    }).returning()
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
        columns: { id: true, status: true, totalMinor: true, metadata: true },
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

    const items = locationRows.map((location) => {
      const locationBookings = bookingRows.filter((row) => locationIdFromMetadata(row.metadata) === location.id)
      const locationResources = resourceRows.filter((row) => row.locationId === location.id)
      const locationPolicies = pricingRows.filter((row) => row.locationId === location.id && row.isEnabled)
      const locationQueues = queueRows.filter((row) => row.locationId === location.id && row.status !== 'archived')
      const sharedHostUserIds = resourceRows
        .filter((row) => {
          if (row.type !== 'host' || !row.hostUserId) return false
          const secondaryLocationIds = secondaryLocationIdsFromMetadata((row as unknown as { metadata?: unknown }).metadata)
          return row.locationId === location.id || secondaryLocationIds.includes(location.id)
        })
        .map((row) => row.hostUserId as string)
      const multiLocationHostCount = new Set(
        sharedHostUserIds.filter((hostUserId) => resourceRows.filter((row) => row.hostUserId === hostUserId).length > 1),
      ).size

      return {
        locationId: location.id,
        name: location.name,
        slug: location.slug,
        timezone: location.timezone,
        operatingHours: location.operatingHours,
        serviceArea: location.serviceArea,
        resources: {
          total: locationResources.length,
          hosts: locationResources.filter((row) => row.type === 'host').length,
          venues: locationResources.filter((row) => row.type === 'venue').length,
          assets: locationResources.filter((row) => row.type === 'asset').length,
          multiLocationHostCount,
        },
        bookings: {
          total: locationBookings.length,
          confirmed: locationBookings.filter((row) => row.status === 'confirmed').length,
          revenueMinor: locationBookings.reduce((sum, row) => sum + row.totalMinor, 0),
        },
        demandPricing: {
          activePolicyCount: locationPolicies.length,
          policyNames: locationPolicies.map((row) => row.name),
        },
        queues: {
          activeCount: locationQueues.length,
          queueNames: locationQueues.map((row) => row.name),
        },
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
      sourceCounts.set(sourceFromMetadata(row.metadata), (sourceCounts.get(sourceFromMetadata(row.metadata)) ?? 0) + 1)
      if (((row.metadata as Record<string, unknown> | null)?.attendanceOutcome) === 'no_show') noShowCount += 1

      if (row.customerUserId) seenCustomerIds.add(row.customerUserId)

      if (row.status === 'confirmed') confirmedCount += 1
      if (row.status === 'cancelled') cancelledCount += 1
      if (['draft', 'quoted', 'awaiting_payment', 'pending_confirmation'].includes(row.status)) pendingCount += 1

      const offerAggregate = offerCounts.get(row.offerId) ?? { bookingCount: 0, revenueMinor: 0 }
      offerAggregate.bookingCount += 1
      offerAggregate.revenueMinor += row.totalMinor
      offerCounts.set(row.offerId, offerAggregate)

      const locationId = locationIdFromMetadata(row.metadata)
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

      const serviceProductId = serviceProductIdFromMetadata(row.metadata)
      if (serviceProductId) {
        const current = serviceProductCounts.get(serviceProductId) ?? { bookingCount: 0, revenueMinor: 0 }
        current.bookingCount += 1
        current.revenueMinor += row.totalMinor
        serviceProductCounts.set(serviceProductId, current)
      }

      const providerUserId = providerUserIdFromMetadata(row.metadata)
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
        const hintedLeadTime = Number((row.metadata as Record<string, unknown> | null)?.leadTimeMinutes ?? 0)
        if (Number.isFinite(hintedLeadTime) && hintedLeadTime >= 0) {
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
