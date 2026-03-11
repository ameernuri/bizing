/**
 * Booking order routes (biz-scoped).
 */

import { Hono } from 'hono'
import { and, asc, desc, eq, inArray, or, sql } from 'drizzle-orm'
import { z } from 'zod'
import dbPackage from '@bizing/db'
import {
  getCurrentUser,
  requireAclPermission,
  requireAuth,
  requireBizAccess,
} from '../middleware/auth.js'
import { sanitizeUnknown } from '../lib/sanitize.js'
import { createBookingLifecycleMessage } from '../services/booking-lifecycle-messages.js'
import { executeCrudRouteAction } from '../services/action-route-bridge.js'
import { validateBookingWindow } from '../services/availability-resolver.js'
import { resolveBookingCapacityWindow, syncBookingCapacityClaims } from '../services/booking-capacity-claims.js'
import { requirePublicBizAccess } from './_public-biz-access.js'
import { fail, ok, parsePositiveInt } from './_api.js'
import { groupFulfillmentUnitsByLine } from './bookings-line-execution.js'

const {
  db,
  bookingOrders,
  bookingOrderLines,
  bookingOrderLineSellables,
  fulfillmentUnits,
  offers,
  offerVersions,
  paymentTransactionLineAllocations,
  paymentTransactions,
  users,
} = dbPackage

const bookingStatusSchema = z.enum([
  'draft',
  'quoted',
  'awaiting_payment',
  'confirmed',
  'checked_in',
  'in_progress',
  'completed',
  'cancelled',
  'expired',
  'failed',
])

const listQuerySchema = z.object({
  page: z.string().optional(),
  perPage: z.string().optional(),
  status: bookingStatusSchema.optional(),
  customerUserId: z.string().optional(),
  offerId: z.string().optional(),
  locationId: z.string().optional(),
  sortBy: z.enum(['requestedStartAt', 'confirmedStartAt']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
})

const createBodySchema = z.object({
  offerId: z.string().min(1),
  offerVersionId: z.string().min(1),
  customerUserId: z.string().optional(),
  customerGroupAccountId: z.string().optional(),
  locationId: z.string().optional(),
  resourceId: z.string().optional(),
  serviceProductId: z.string().optional(),
  providerUserId: z.string().optional(),
  acquisitionSource: z.string().min(1).max(120).optional(),
  attendanceOutcome: z.string().min(1).max(40).optional(),
  leadTimeMinutes: z.number().int().min(0).optional(),
  status: bookingStatusSchema.default('draft'),
  currency: z.string().regex(/^[A-Z]{3}$/).default('USD'),
  subtotalMinor: z.number().int().min(0).default(0),
  taxMinor: z.number().int().min(0).default(0),
  feeMinor: z.number().int().min(0).default(0),
  discountMinor: z.number().int().min(0).default(0),
  totalMinor: z.number().int().min(0).optional(),
  requestedStartAt: z.string().datetime().optional(),
  requestedEndAt: z.string().datetime().optional(),
  confirmedStartAt: z.string().datetime().optional(),
  confirmedEndAt: z.string().datetime().optional(),
  pricingSnapshot: z.record(z.unknown()).optional(),
  policySnapshot: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
})

const updateBodySchema = z.object({
  status: bookingStatusSchema.optional(),
  locationId: z.string().optional().nullable(),
  resourceId: z.string().optional().nullable(),
  serviceProductId: z.string().optional().nullable(),
  providerUserId: z.string().optional().nullable(),
  acquisitionSource: z.string().min(1).max(120).optional().nullable(),
  attendanceOutcome: z.string().min(1).max(40).optional().nullable(),
  leadTimeMinutes: z.number().int().min(0).optional().nullable(),
  subtotalMinor: z.number().int().min(0).optional(),
  taxMinor: z.number().int().min(0).optional(),
  feeMinor: z.number().int().min(0).optional(),
  discountMinor: z.number().int().min(0).optional(),
  totalMinor: z.number().int().min(0).optional(),
  requestedStartAt: z.string().datetime().optional().nullable(),
  requestedEndAt: z.string().datetime().optional().nullable(),
  confirmedStartAt: z.string().datetime().optional().nullable(),
  confirmedEndAt: z.string().datetime().optional().nullable(),
  pricingSnapshot: z.record(z.unknown()).optional(),
  policySnapshot: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
})

const updateStatusBodySchema = z.object({
  status: bookingStatusSchema,
})

const lineExecutionQuerySchema = z.object({
  includeTimeline: z.string().optional(),
})

const publicBookingStatusSchema = z.enum(['draft', 'quoted', 'awaiting_payment', 'confirmed'])

const publicCreateBodySchema = z.object({
  offerId: z.string().min(1),
  offerVersionId: z.string().min(1),
  locationId: z.string().optional(),
  resourceId: z.string().optional(),
  serviceProductId: z.string().optional(),
  providerUserId: z.string().optional(),
  acquisitionSource: z.string().min(1).max(120).optional(),
  attendanceOutcome: z.string().min(1).max(40).optional(),
  leadTimeMinutes: z.number().int().min(0).optional(),
  status: publicBookingStatusSchema.default('draft'),
  currency: z.string().regex(/^[A-Z]{3}$/).default('USD'),
  subtotalMinor: z.number().int().min(0).default(0),
  taxMinor: z.number().int().min(0).default(0),
  feeMinor: z.number().int().min(0).default(0),
  discountMinor: z.number().int().min(0).default(0),
  totalMinor: z.number().int().min(0).optional(),
  requestedStartAt: z.string().datetime().optional(),
  requestedEndAt: z.string().datetime().optional(),
  confirmedStartAt: z.string().datetime().optional(),
  confirmedEndAt: z.string().datetime().optional(),
  pricingSnapshot: z.record(z.unknown()).optional(),
  policySnapshot: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
})

function computeTotal(subtotalMinor: number, taxMinor: number, feeMinor: number, discountMinor: number) {
  return subtotalMinor + taxMinor + feeMinor - discountMinor
}

function withBookingScopeMetadata(
  existing: Record<string, unknown> | null | undefined,
  input: {
    locationId?: string | null
    resourceId?: string | null
  },
) {
  const base = sanitizeUnknown(existing ?? {}) as Record<string, unknown>
  if (input.locationId !== undefined) {
    if (input.locationId === null) {
      delete base.locationId
    } else {
      base.locationId = input.locationId
    }
  }
  if (input.resourceId === undefined) return base
  if (input.resourceId === null) {
    delete base.resourceId
    return base
  }
  base.resourceId = input.resourceId
  return base
}

async function syncPersistedBookingCapacityClaims(input: {
  bizId: string
  bookingOrderId: string
  bookingStatus: string | null | undefined
  providerUserId?: string | null
  resourceId?: string | null
  confirmedStartAt?: Date | null
  confirmedEndAt?: Date | null
  requestedStartAt?: Date | null
  requestedEndAt?: Date | null
  durationMinutes?: number | null
  actorUserId?: string | null
}) {
  const window = resolveBookingCapacityWindow({
    startsAt: input.confirmedStartAt ?? input.requestedStartAt ?? null,
    endsAt: input.confirmedEndAt ?? input.requestedEndAt ?? null,
    durationMinutes: input.durationMinutes ?? null,
  })
  await syncBookingCapacityClaims({
    bizId: input.bizId,
    bookingOrderId: input.bookingOrderId,
    bookingStatus: input.bookingStatus,
    startsAt: window.startsAt,
    endsAt: window.endsAt,
    providerUserId: input.providerUserId,
    resourceId: input.resourceId,
    actorUserId: input.actorUserId,
  })
}

function locationMetadataFilter(locationId?: string) {
  if (!locationId) return undefined
  return or(
    eq(bookingOrders.locationId, locationId),
    sql`${bookingOrders.metadata} ->> 'locationId' = ${locationId}`,
  )
}

function metadataString(metadata: unknown, key: string): string | undefined {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return undefined
  const value = (metadata as Record<string, unknown>)[key]
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function metadataNonNegativeInt(metadata: unknown, key: string): number | undefined {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return undefined
  const value = (metadata as Record<string, unknown>)[key]
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined
  const asInt = Math.floor(value)
  return asInt >= 0 ? asInt : undefined
}

function parseBooleanQuery(input: string | undefined): boolean {
  if (!input) return false
  const normalized = input.trim().toLowerCase()
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on'
}

type CommercialStatus =
  | 'non_revenue'
  | 'unpaid'
  | 'partially_paid'
  | 'paid'
  | 'refunded'

type FulfillmentStatus =
  | 'not_applicable'
  | 'not_linked'
  | 'planned'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'blocked'

type ExecutionStatus =
  | 'draft'
  | 'awaiting_payment'
  | 'partially_paid'
  | 'ready_for_execution'
  | 'in_execution'
  | 'completed'
  | 'cancelled'
  | 'refunded'
  | 'failed'

/**
 * Computes one payment-focused status for a booking line using immutable
 * payment transaction allocations.
 *
 * ELI5:
 * - We do not guess from order-level totals.
 * - We read exact transaction-to-line rows, so the status matches real money.
 */
function computeCommercialStatus(input: {
  lineTotalMinor: number
  lineType: string
  chargedMinor: number
  refundedMinor: number
}): CommercialStatus {
  const lineIsNonRevenue = input.lineTotalMinor <= 0 || input.lineType === 'discount' || input.lineType === 'refund_adjustment'
  if (lineIsNonRevenue) return 'non_revenue'

  const netCollectedMinor = Math.max(input.chargedMinor - input.refundedMinor, 0)
  if (input.refundedMinor >= input.lineTotalMinor && input.chargedMinor > 0) return 'refunded'
  if (netCollectedMinor <= 0) return 'unpaid'
  if (netCollectedMinor < input.lineTotalMinor) return 'partially_paid'
  return 'paid'
}

/**
 * Maps linked fulfillment-unit statuses into one line-level operational status.
 */
function computeFulfillmentStatus(input: {
  lineType: string
  linkedUnits: Array<{ status: string }>
}): FulfillmentStatus {
  if (['tax', 'fee', 'tip', 'discount', 'refund_adjustment'].includes(input.lineType)) {
    return 'not_applicable'
  }
  if (input.linkedUnits.length === 0) return 'not_linked'

  const statuses = new Set(input.linkedUnits.map((unit) => unit.status))
  if (statuses.has('blocked')) return 'blocked'
  if (statuses.has('in_progress')) return 'in_progress'
  if (statuses.has('ready') || statuses.has('planned') || statuses.has('held')) return 'planned'
  if (statuses.size === 1 && statuses.has('cancelled')) return 'cancelled'
  if (statuses.size === 1 && statuses.has('completed')) return 'completed'
  if (statuses.has('completed') && !statuses.has('in_progress') && !statuses.has('planned') && !statuses.has('ready')) {
    return 'completed'
  }
  return 'planned'
}

/**
 * Produces one canonical state used by dashboards/sagas for "where is this
 * line in the lifecycle right now".
 */
function computeExecutionStatus(input: {
  orderStatus: string
  commercialStatus: CommercialStatus
  fulfillmentStatus: FulfillmentStatus
}): ExecutionStatus {
  if (input.orderStatus === 'failed') return 'failed'
  if (input.orderStatus === 'cancelled' || input.fulfillmentStatus === 'cancelled') return 'cancelled'
  if (input.commercialStatus === 'refunded') return 'refunded'
  if (input.orderStatus === 'draft' || input.orderStatus === 'quoted') return 'draft'
  if (input.commercialStatus === 'unpaid') return 'awaiting_payment'
  if (input.commercialStatus === 'partially_paid') return 'partially_paid'
  if (input.fulfillmentStatus === 'in_progress') return 'in_execution'
  if (input.fulfillmentStatus === 'completed') return 'completed'
  if (input.commercialStatus === 'paid') return 'ready_for_execution'
  return 'awaiting_payment'
}

export const bookingRoutes = new Hono()

async function createBookingRow(
  c: Parameters<typeof executeCrudRouteAction>[0]['c'],
  bizId: string | null,
  data: Record<string, unknown>,
  displayName: string,
) {
  const result = await executeCrudRouteAction({
    c,
    bizId,
    tableKey: 'bookingOrders',
    operation: 'create',
    data,
    subjectType: 'booking_order',
    displayName,
  })
  if (!result.ok) return fail(c, result.code, result.message, result.httpStatus, result.details)
  return result.row
}

async function updateBookingRow(
  c: Parameters<typeof executeCrudRouteAction>[0]['c'],
  bizId: string | null,
  bookingOrderId: string,
  patch: Record<string, unknown>,
) {
  const result = await executeCrudRouteAction({
    c,
    bizId,
    tableKey: 'bookingOrders',
    operation: 'update',
    id: bookingOrderId,
    patch,
    subjectType: 'booking_order',
    subjectId: bookingOrderId,
    displayName: bookingOrderId,
  })
  if (!result.ok) return fail(c, result.code, result.message, result.httpStatus, result.details)
  return result.row
}

/**
 * Public booking surface for authenticated customers.
 *
 * ELI5:
 * Customers should be able to discover and book published offers without being
 * internal biz members. These routes are scoped to "my customer bookings only".
 */
bookingRoutes.get('/public/bizes/:bizId/booking-orders', requireAuth, async (c) => {
  const user = getCurrentUser(c)
  if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)

  const bizId = c.req.param('bizId')
  const bizAccess = await requirePublicBizAccess(c, bizId)
  if (bizAccess instanceof Response) return bizAccess

  const parsed = listQuerySchema.safeParse(c.req.query())
  if (!parsed.success) {
    return fail(c, 'VALIDATION_ERROR', 'Invalid query parameters.', 400, parsed.error.flatten())
  }

  const pageNum = parsePositiveInt(parsed.data.page, 1)
  const perPageNum = Math.min(parsePositiveInt(parsed.data.perPage, 20), 100)
  const sortColumn =
    parsed.data.sortBy === 'confirmedStartAt' ? bookingOrders.confirmedStartAt : bookingOrders.requestedStartAt
  const orderByExpr = parsed.data.sortOrder === 'asc' ? asc(sortColumn) : desc(sortColumn)

  const where = and(
    eq(bookingOrders.bizId, bizId),
    eq(bookingOrders.customerUserId, user.id),
    parsed.data.status ? eq(bookingOrders.status, parsed.data.status) : undefined,
    parsed.data.offerId ? eq(bookingOrders.offerId, parsed.data.offerId) : undefined,
    locationMetadataFilter(parsed.data.locationId),
  )

  const [rows, countRows] = await Promise.all([
    db.query.bookingOrders.findMany({
      where,
      orderBy: orderByExpr,
      limit: perPageNum,
      offset: (pageNum - 1) * perPageNum,
    }),
    db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(bookingOrders).where(where),
  ])

  const total = countRows[0]?.count ?? 0
  return ok(c, rows, 200, {
    pagination: {
      page: pageNum,
      perPage: perPageNum,
      total,
      hasMore: pageNum * perPageNum < total,
    },
  })
})

bookingRoutes.post('/public/bizes/:bizId/booking-orders', requireAuth, async (c) => {
  const user = getCurrentUser(c)
  if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)

  const bizId = c.req.param('bizId')
  const bizAccess = await requirePublicBizAccess(c, bizId)
  if (bizAccess instanceof Response) return bizAccess

  const body = await c.req.json().catch(() => null)
  const parsed = publicCreateBodySchema.safeParse(body)
  if (!parsed.success) {
    return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  }

  const offer = await db.query.offers.findFirst({
    where: and(eq(offers.id, parsed.data.offerId), eq(offers.bizId, bizId)),
  })
  if (!offer || !offer.isPublished || offer.status !== 'active') {
    return fail(c, 'NOT_BOOKABLE', 'Offer is not publicly bookable.', 409)
  }

  const offerVersion = await db.query.offerVersions.findFirst({
    where: and(
      eq(offerVersions.id, parsed.data.offerVersionId),
      eq(offerVersions.offerId, offer.id),
      eq(offerVersions.bizId, bizId),
    ),
  })
  if (!offerVersion || offerVersion.status !== 'published') {
    return fail(c, 'NOT_BOOKABLE', 'Offer version is not published.', 409)
  }

  const totalMinor =
    parsed.data.totalMinor ??
    computeTotal(
      parsed.data.subtotalMinor,
      parsed.data.taxMinor,
      parsed.data.feeMinor,
      parsed.data.discountMinor,
    )

  const derivedPricingSnapshot =
    parsed.data.pricingSnapshot ?? {
      basePriceMinor: offerVersion.basePriceMinor,
      currency: offerVersion.currency,
      durationMode: offerVersion.durationMode,
      defaultDurationMin: offerVersion.defaultDurationMin,
    }
  const derivedPolicySnapshot = parsed.data.policySnapshot ?? ((offerVersion.policyModel as Record<string, unknown> | null) ?? {})
  const normalizedMetadata = withBookingScopeMetadata(parsed.data.metadata ?? {}, {
    locationId: parsed.data.locationId,
    resourceId: parsed.data.resourceId,
  })
  const resolvedLocationId = parsed.data.locationId ?? metadataString(normalizedMetadata, 'locationId')
  const resolvedResourceId = parsed.data.resourceId ?? metadataString(normalizedMetadata, 'resourceId')
  const resolvedServiceProductId =
    parsed.data.serviceProductId ?? metadataString(normalizedMetadata, 'serviceProductId')
  const resolvedProviderUserId =
    parsed.data.providerUserId ?? metadataString(normalizedMetadata, 'providerUserId')
  const resolvedAcquisitionSource =
    parsed.data.acquisitionSource ?? metadataString(normalizedMetadata, 'acquisitionSource')
  const resolvedAttendanceOutcome =
    parsed.data.attendanceOutcome ?? metadataString(normalizedMetadata, 'attendanceOutcome')
  const resolvedLeadTimeMinutes =
    parsed.data.leadTimeMinutes ?? metadataNonNegativeInt(normalizedMetadata, 'leadTimeMinutes')
  const resolvedServiceId = metadataString(normalizedMetadata, 'serviceId')

  const bookingWindowStartRaw = parsed.data.confirmedStartAt ?? parsed.data.requestedStartAt
  const bookingWindowEndRaw = parsed.data.confirmedEndAt ?? parsed.data.requestedEndAt
  const bookingWindow = resolveBookingCapacityWindow({
    startsAt: bookingWindowStartRaw ? new Date(bookingWindowStartRaw) : null,
    endsAt: bookingWindowEndRaw ? new Date(bookingWindowEndRaw) : null,
    durationMinutes: Number(offerVersion.defaultDurationMin ?? 60),
  })
  if (bookingWindow.startsAt && bookingWindow.endsAt) {

    const availabilityDecision = await validateBookingWindow({
      bizId,
      offerId: parsed.data.offerId,
      offerVersionId: parsed.data.offerVersionId,
      locationId: resolvedLocationId,
      serviceId: resolvedServiceId,
      serviceProductId: resolvedServiceProductId,
      providerUserId: resolvedProviderUserId,
      resourceId: resolvedResourceId,
      slotStartAt: bookingWindow.startsAt,
      slotEndAt: bookingWindow.endsAt,
    })
    if (!availabilityDecision.bookable) {
      return fail(
        c,
        'SLOT_UNAVAILABLE',
        'Selected time is not available under current availability policy.',
        409,
        availabilityDecision,
      )
    }
  }

  const created = await createBookingRow(
    c,
    bizId,
    {
      bizId,
      offerId: parsed.data.offerId,
      offerVersionId: parsed.data.offerVersionId,
      customerUserId: user.id,
      status: parsed.data.status,
      currency: parsed.data.currency,
      subtotalMinor: parsed.data.subtotalMinor,
      taxMinor: parsed.data.taxMinor,
      feeMinor: parsed.data.feeMinor,
      discountMinor: parsed.data.discountMinor,
      totalMinor,
      requestedStartAt: parsed.data.requestedStartAt ? new Date(parsed.data.requestedStartAt) : undefined,
      requestedEndAt: parsed.data.requestedEndAt ? new Date(parsed.data.requestedEndAt) : undefined,
      confirmedStartAt: parsed.data.confirmedStartAt ? new Date(parsed.data.confirmedStartAt) : undefined,
      confirmedEndAt: parsed.data.confirmedEndAt ? new Date(parsed.data.confirmedEndAt) : undefined,
      locationId: resolvedLocationId,
      serviceProductId: resolvedServiceProductId,
      providerUserId: resolvedProviderUserId,
      acquisitionSource: resolvedAcquisitionSource,
      attendanceOutcome: resolvedAttendanceOutcome,
      leadTimeMinutes: resolvedLeadTimeMinutes,
      pricingSnapshot: derivedPricingSnapshot,
      policySnapshot: derivedPolicySnapshot,
      metadata: normalizedMetadata,
    },
    parsed.data.offerId,
  )
  if (created instanceof Response) return created

  await syncPersistedBookingCapacityClaims({
    bizId,
    bookingOrderId: String((created as Record<string, unknown>).id),
    bookingStatus: parsed.data.status,
    providerUserId: resolvedProviderUserId,
    resourceId: resolvedResourceId,
    confirmedStartAt: parsed.data.confirmedStartAt ? new Date(parsed.data.confirmedStartAt) : null,
    confirmedEndAt: parsed.data.confirmedEndAt ? new Date(parsed.data.confirmedEndAt) : null,
    requestedStartAt: parsed.data.requestedStartAt ? new Date(parsed.data.requestedStartAt) : null,
    requestedEndAt: parsed.data.requestedEndAt ? new Date(parsed.data.requestedEndAt) : null,
    durationMinutes: Number(offerVersion.defaultDurationMin ?? 60),
    actorUserId: user.id,
  })

  await createBookingLifecycleMessage({
    bizId,
    recipientUserId: user.id,
    recipientRef: user.email ?? `user-${user.id}@unknown.local`,
    bookingOrderId: String((created as Record<string, unknown>).id),
    subject: 'Booking confirmed',
    body: `Your booking ${String((created as Record<string, unknown>).id)} is confirmed.`,
    templateSlug: 'booking-confirmed',
    eventType: 'booking.confirmed',
  })

  return ok(c, created, 201)
})

bookingRoutes.get(
  '/bizes/:bizId/booking-orders',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('booking_orders.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')

  const parsed = listQuerySchema.safeParse(c.req.query())
  if (!parsed.success) {
    return fail(c, 'VALIDATION_ERROR', 'Invalid query parameters.', 400, parsed.error.flatten())
  }

  const {
    page,
    perPage,
    status,
    customerUserId,
    offerId,
    locationId,
    sortBy = 'requestedStartAt',
    sortOrder = 'desc',
  } = parsed.data

  const pageNum = parsePositiveInt(page, 1)
  const perPageNum = Math.min(parsePositiveInt(perPage, 20), 100)

  const where = and(
    eq(bookingOrders.bizId, bizId),
    status ? eq(bookingOrders.status, status) : undefined,
    customerUserId ? eq(bookingOrders.customerUserId, customerUserId) : undefined,
    offerId ? eq(bookingOrders.offerId, offerId) : undefined,
    locationMetadataFilter(locationId),
  )

  const sortColumn =
    sortBy === 'confirmedStartAt' ? bookingOrders.confirmedStartAt : bookingOrders.requestedStartAt

  const orderByExpr = sortOrder === 'asc' ? asc(sortColumn) : desc(sortColumn)

  const [rows, countRows] = await Promise.all([
    db.query.bookingOrders.findMany({
      where,
      orderBy: orderByExpr,
      limit: perPageNum,
      offset: (pageNum - 1) * perPageNum,
    }),
    db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(bookingOrders).where(where),
  ])

  const total = countRows[0]?.count ?? 0

    return ok(c, rows, 200, {
    pagination: {
      page: pageNum,
      perPage: perPageNum,
      total,
      hasMore: pageNum * perPageNum < total,
    },
  })
  },
)

bookingRoutes.post(
  '/bizes/:bizId/booking-orders',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('booking_orders.create', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const actor = getCurrentUser(c)

    const body = await c.req.json().catch(() => null)
    const parsed = createBodySchema.safeParse(body)
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    }

    const totalMinor =
      parsed.data.totalMinor ??
      computeTotal(
        parsed.data.subtotalMinor,
        parsed.data.taxMinor,
        parsed.data.feeMinor,
        parsed.data.discountMinor,
      )
    const offerVersion = await db.query.offerVersions.findFirst({
      where: and(
        eq(offerVersions.id, parsed.data.offerVersionId),
        eq(offerVersions.offerId, parsed.data.offerId),
        eq(offerVersions.bizId, bizId),
      ),
    })
    if (!offerVersion) {
      return fail(c, 'NOT_FOUND', 'Offer version not found.', 404)
    }
    const derivedPricingSnapshot =
      parsed.data.pricingSnapshot ?? {
        basePriceMinor: offerVersion.basePriceMinor,
        currency: offerVersion.currency,
        durationMode: offerVersion.durationMode,
        defaultDurationMin: offerVersion.defaultDurationMin,
      }
    const derivedPolicySnapshot =
      parsed.data.policySnapshot ?? ((offerVersion.policyModel as Record<string, unknown> | null) ?? {})
    const normalizedMetadata = withBookingScopeMetadata(parsed.data.metadata ?? {}, {
      locationId: parsed.data.locationId,
      resourceId: parsed.data.resourceId,
    })
    const resolvedLocationId = parsed.data.locationId ?? metadataString(normalizedMetadata, 'locationId')
    const resolvedResourceId = parsed.data.resourceId ?? metadataString(normalizedMetadata, 'resourceId')
    const resolvedServiceProductId =
      parsed.data.serviceProductId ?? metadataString(normalizedMetadata, 'serviceProductId')
    const resolvedProviderUserId =
      parsed.data.providerUserId ?? metadataString(normalizedMetadata, 'providerUserId')
    const resolvedAcquisitionSource =
      parsed.data.acquisitionSource ?? metadataString(normalizedMetadata, 'acquisitionSource')
    const resolvedAttendanceOutcome =
      parsed.data.attendanceOutcome ?? metadataString(normalizedMetadata, 'attendanceOutcome')
    const resolvedLeadTimeMinutes =
      parsed.data.leadTimeMinutes ?? metadataNonNegativeInt(normalizedMetadata, 'leadTimeMinutes')
    const resolvedServiceId = metadataString(normalizedMetadata, 'serviceId')

    const bookingWindowStartRaw = parsed.data.confirmedStartAt ?? parsed.data.requestedStartAt
    const bookingWindowEndRaw = parsed.data.confirmedEndAt ?? parsed.data.requestedEndAt
    const bookingWindow = resolveBookingCapacityWindow({
      startsAt: bookingWindowStartRaw ? new Date(bookingWindowStartRaw) : null,
      endsAt: bookingWindowEndRaw ? new Date(bookingWindowEndRaw) : null,
      durationMinutes: Number(offerVersion.defaultDurationMin ?? 60),
    })
    if (bookingWindow.startsAt && bookingWindow.endsAt) {

      const availabilityDecision = await validateBookingWindow({
        bizId,
        offerId: parsed.data.offerId,
        offerVersionId: parsed.data.offerVersionId,
        locationId: resolvedLocationId,
        serviceId: resolvedServiceId,
        serviceProductId: resolvedServiceProductId,
        providerUserId: resolvedProviderUserId,
        resourceId: resolvedResourceId,
        slotStartAt: bookingWindow.startsAt,
        slotEndAt: bookingWindow.endsAt,
      })
      if (!availabilityDecision.bookable) {
        return fail(
          c,
          'SLOT_UNAVAILABLE',
          'Selected time is not available under current availability policy.',
          409,
          availabilityDecision,
        )
      }
    }

    const created = await createBookingRow(
      c,
      bizId,
      {
        bizId,
        offerId: parsed.data.offerId,
        offerVersionId: parsed.data.offerVersionId,
        customerUserId: parsed.data.customerUserId,
        customerGroupAccountId: parsed.data.customerGroupAccountId,
        status: parsed.data.status,
        currency: parsed.data.currency,
        subtotalMinor: parsed.data.subtotalMinor,
        taxMinor: parsed.data.taxMinor,
        feeMinor: parsed.data.feeMinor,
        discountMinor: parsed.data.discountMinor,
        totalMinor,
        requestedStartAt: parsed.data.requestedStartAt
          ? new Date(parsed.data.requestedStartAt)
          : undefined,
        requestedEndAt: parsed.data.requestedEndAt ? new Date(parsed.data.requestedEndAt) : undefined,
        confirmedStartAt: parsed.data.confirmedStartAt
          ? new Date(parsed.data.confirmedStartAt)
          : undefined,
        confirmedEndAt: parsed.data.confirmedEndAt ? new Date(parsed.data.confirmedEndAt) : undefined,
        locationId: resolvedLocationId,
        serviceProductId: resolvedServiceProductId,
        providerUserId: resolvedProviderUserId,
        acquisitionSource: resolvedAcquisitionSource,
        attendanceOutcome: resolvedAttendanceOutcome,
        leadTimeMinutes: resolvedLeadTimeMinutes,
        pricingSnapshot: derivedPricingSnapshot,
        policySnapshot: derivedPolicySnapshot,
        metadata: normalizedMetadata,
      },
      parsed.data.offerId,
    )
    if (created instanceof Response) return created

    await syncPersistedBookingCapacityClaims({
      bizId,
      bookingOrderId: String((created as Record<string, unknown>).id),
      bookingStatus: parsed.data.status,
      providerUserId: resolvedProviderUserId,
      resourceId: resolvedResourceId,
      confirmedStartAt: parsed.data.confirmedStartAt ? new Date(parsed.data.confirmedStartAt) : null,
      confirmedEndAt: parsed.data.confirmedEndAt ? new Date(parsed.data.confirmedEndAt) : null,
      requestedStartAt: parsed.data.requestedStartAt ? new Date(parsed.data.requestedStartAt) : null,
      requestedEndAt: parsed.data.requestedEndAt ? new Date(parsed.data.requestedEndAt) : null,
      durationMinutes: Number(offerVersion.defaultDurationMin ?? 60),
      actorUserId: actor?.id ?? null,
    })

    if (parsed.data.customerUserId) {
      const recipientUser = await db.query.users.findFirst({
        where: eq(users.id, parsed.data.customerUserId),
        columns: {
          id: true,
          email: true,
        },
      })
      if (recipientUser?.email) {
        await createBookingLifecycleMessage({
          bizId,
          recipientUserId: recipientUser.id,
          recipientRef: recipientUser.email,
          bookingOrderId: String((created as Record<string, unknown>).id),
          subject: 'Booking confirmed',
          body: `Your booking ${String((created as Record<string, unknown>).id)} is confirmed.`,
          templateSlug: 'booking-confirmed',
          eventType: 'booking.confirmed',
        })
      }
    }

    return ok(c, created, 201)
  },
)

bookingRoutes.get(
  '/bizes/:bizId/booking-orders/:bookingOrderId',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('booking_orders.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, bookingOrderId } = c.req.param()

    const row = await db.query.bookingOrders.findFirst({
      where: and(eq(bookingOrders.bizId, bizId), eq(bookingOrders.id, bookingOrderId)),
    })

    if (!row) return fail(c, 'NOT_FOUND', 'Booking order not found.', 404)
    return ok(c, row)
  },
)

bookingRoutes.get(
  '/bizes/:bizId/booking-orders/:bookingOrderId/line-execution',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('booking_orders.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, bookingOrderId } = c.req.param()
    const parsedQuery = lineExecutionQuerySchema.safeParse(c.req.query())
    if (!parsedQuery.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid query parameters.', 400, parsedQuery.error.flatten())
    }

    const includeTimeline = parseBooleanQuery(parsedQuery.data.includeTimeline)

    const booking = await db.query.bookingOrders.findFirst({
      where: and(eq(bookingOrders.bizId, bizId), eq(bookingOrders.id, bookingOrderId)),
    })
    if (!booking) return fail(c, 'NOT_FOUND', 'Booking order not found.', 404)

    const lines = await db.query.bookingOrderLines.findMany({
      where: and(eq(bookingOrderLines.bizId, bizId), eq(bookingOrderLines.bookingOrderId, bookingOrderId)),
      orderBy: [asc(bookingOrderLines.id)],
    })

    const lineIds = lines.map((line) => line.id)

    const [allocations, txRows, units] = lineIds.length
      ? await Promise.all([
          db.query.paymentTransactionLineAllocations.findMany({
            where: and(
              eq(paymentTransactionLineAllocations.bizId, bizId),
              eq(paymentTransactionLineAllocations.bookingOrderId, bookingOrderId),
              inArray(paymentTransactionLineAllocations.bookingOrderLineId, lineIds),
            ),
            orderBy: [asc(paymentTransactionLineAllocations.occurredAt)],
          }),
          db.query.paymentTransactions.findMany({
            where: and(
              eq(paymentTransactions.bizId, bizId),
              eq(paymentTransactions.bookingOrderId, bookingOrderId),
            ),
            orderBy: [asc(paymentTransactions.occurredAt)],
          }),
          db.query.fulfillmentUnits.findMany({
            where: and(eq(fulfillmentUnits.bizId, bizId), eq(fulfillmentUnits.bookingOrderId, bookingOrderId)),
            orderBy: [asc(fulfillmentUnits.plannedStartAt)],
          }),
        ])
      : [[], [], []]

    const txById = new Map(txRows.map((row) => [row.id, row]))
    const allocationsByLine = new Map<string, Array<typeof allocations[number]>>()
    for (const row of allocations) {
      const bucket = allocationsByLine.get(row.bookingOrderLineId) ?? []
      bucket.push(row)
      allocationsByLine.set(row.bookingOrderLineId, bucket)
    }

    const {
      unitsByLine,
      directLinkedUnitCount,
      fallbackComponentLinkedUnitCount,
      ambiguousFallbackUnitCount,
      fallbackLinkedLineCount,
    } = groupFulfillmentUnitsByLine(lines, units)

    const resultLines = lines.map((line) => {
      const lineAllocations = allocationsByLine.get(line.id) ?? []
      let chargedMinor = 0
      let refundedMinor = 0

      for (const allocation of lineAllocations) {
        const tx = txById.get(allocation.paymentTransactionId)
        if (!tx || tx.status !== 'succeeded') continue
        if (tx.type === 'charge' || tx.type === 'capture' || tx.type === 'authorization') {
          chargedMinor += allocation.amountMinor
        } else if (tx.type === 'refund' || tx.type === 'void' || tx.type === 'chargeback') {
          refundedMinor += allocation.amountMinor
        }
      }

      const commercialStatus = computeCommercialStatus({
        lineTotalMinor: line.lineTotalMinor,
        lineType: line.lineType,
        chargedMinor,
        refundedMinor,
      })

      const linkedUnits = unitsByLine.get(line.id) ?? []
      const fulfillmentStatus = computeFulfillmentStatus({
        lineType: line.lineType,
        linkedUnits: linkedUnits.map((unit) => ({ status: unit.status })),
      })

      const executionStatus = computeExecutionStatus({
        orderStatus: booking.status,
        commercialStatus,
        fulfillmentStatus,
      })

      const timeline = includeTimeline
        ? [
            {
              eventType: 'line.created',
              at: booking.requestedStartAt ?? booking.confirmedStartAt ?? null,
              data: {
                lineType: line.lineType,
                lineTotalMinor: line.lineTotalMinor,
              },
            },
            ...lineAllocations.map((allocation) => {
              const tx = txById.get(allocation.paymentTransactionId)
              return {
                eventType: 'payment.allocation_applied',
                at: allocation.occurredAt,
                data: {
                  paymentTransactionId: allocation.paymentTransactionId,
                  paymentTransactionType: tx?.type ?? 'unknown',
                  paymentTransactionStatus: tx?.status ?? 'unknown',
                  amountMinor: allocation.amountMinor,
                },
              }
            }),
            ...linkedUnits.map((unit) => ({
              eventType: 'fulfillment.unit_linked',
              at: unit.actualStartAt ?? unit.plannedStartAt ?? null,
              data: {
                fulfillmentUnitId: unit.id,
                fulfillmentStatus: unit.status,
                kind: unit.kind,
                plannedStartAt: unit.plannedStartAt,
                plannedEndAt: unit.plannedEndAt,
                actualStartAt: unit.actualStartAt,
                actualEndAt: unit.actualEndAt,
              },
            })),
          ].sort((a, b) => new Date(a.at ?? 0).getTime() - new Date(b.at ?? 0).getTime())
        : undefined

      return {
        ...line,
        commercial: {
          chargedMinor,
          refundedMinor,
          netCollectedMinor: Math.max(chargedMinor - refundedMinor, 0),
          outstandingMinor: Math.max(line.lineTotalMinor - Math.max(chargedMinor - refundedMinor, 0), 0),
          status: commercialStatus,
        },
        fulfillment: {
          status: fulfillmentStatus,
          linkedFulfillmentUnitCount: linkedUnits.length,
          linkedFulfillmentUnitIds: linkedUnits.map((unit) => unit.id),
        },
        executionStatus,
        timeline,
      }
    })

    const summary = {
      lineCount: resultLines.length,
      paidLineCount: resultLines.filter((line) => line.commercial.status === 'paid').length,
      partiallyPaidLineCount: resultLines.filter((line) => line.commercial.status === 'partially_paid').length,
      unpaidLineCount: resultLines.filter((line) => line.commercial.status === 'unpaid').length,
      refundedLineCount: resultLines.filter((line) => line.commercial.status === 'refunded').length,
      inExecutionCount: resultLines.filter((line) => line.executionStatus === 'in_execution').length,
      completedCount: resultLines.filter((line) => line.executionStatus === 'completed').length,
    }

    return ok(c, {
      bookingOrderId,
      orderStatus: booking.status,
      currency: booking.currency,
      orderTotalMinor: booking.totalMinor,
      componentLinkedLineCount: fallbackLinkedLineCount,
      directLineLinkedUnitCount: directLinkedUnitCount,
      fallbackComponentLinkedUnitCount,
      ambiguousFallbackUnitCount,
      summary,
      lines: resultLines,
    })
  },
)

bookingRoutes.get(
  '/bizes/:bizId/booking-orders/:bookingOrderId/lines',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('booking_orders.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, bookingOrderId } = c.req.param()
    const booking = await db.query.bookingOrders.findFirst({
      where: and(eq(bookingOrders.bizId, bizId), eq(bookingOrders.id, bookingOrderId)),
    })
    if (!booking) return fail(c, 'NOT_FOUND', 'Booking order not found.', 404)

    const [lines, attributions] = await Promise.all([
      db.query.bookingOrderLines.findMany({
        where: and(eq(bookingOrderLines.bizId, bizId), eq(bookingOrderLines.bookingOrderId, bookingOrderId)),
        orderBy: [asc(bookingOrderLines.id)],
      }),
      db.query.bookingOrderLineSellables.findMany({
        where: eq(bookingOrderLineSellables.bizId, bizId),
        orderBy: [asc(bookingOrderLineSellables.id)],
      }),
    ])

    const lineIds = new Set(lines.map((line) => line.id))
    const attributionByLineId = new Map<string, Array<typeof attributions[number]>>()
    for (const row of attributions) {
      if (!lineIds.has(row.bookingOrderLineId)) continue
      const bucket = attributionByLineId.get(row.bookingOrderLineId) ?? []
      bucket.push(row)
      attributionByLineId.set(row.bookingOrderLineId, bucket)
    }

    return ok(c, lines.map((line) => ({
      ...line,
      sellables: attributionByLineId.get(line.id) ?? [],
    })))
  },
)

bookingRoutes.patch(
  '/bizes/:bizId/booking-orders/:bookingOrderId',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('booking_orders.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, bookingOrderId } = c.req.param()
    const actor = getCurrentUser(c)

    const body = await c.req.json().catch(() => null)
    const parsed = updateBodySchema.safeParse(body)
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    }

    const existing = await db.query.bookingOrders.findFirst({
      where: and(eq(bookingOrders.bizId, bizId), eq(bookingOrders.id, bookingOrderId)),
    })
    if (!existing) return fail(c, 'NOT_FOUND', 'Booking order not found.', 404)

    const subtotalMinor = parsed.data.subtotalMinor ?? existing.subtotalMinor
    const taxMinor = parsed.data.taxMinor ?? existing.taxMinor
    const feeMinor = parsed.data.feeMinor ?? existing.feeMinor
    const discountMinor = parsed.data.discountMinor ?? existing.discountMinor
    const totalMinor = parsed.data.totalMinor ?? computeTotal(subtotalMinor, taxMinor, feeMinor, discountMinor)
    const offerVersion = await db.query.offerVersions.findFirst({
      where: and(
        eq(offerVersions.bizId, bizId),
        eq(offerVersions.id, existing.offerVersionId),
      ),
      columns: {
        defaultDurationMin: true,
      },
    })
    const mergedMetadata = withBookingScopeMetadata(
      (parsed.data.metadata ?? existing.metadata) as Record<string, unknown>,
      {
        locationId: parsed.data.locationId,
        resourceId: parsed.data.resourceId,
      },
    )
    const nextLocationId =
      parsed.data.locationId === undefined
        ? parsed.data.metadata === undefined
          ? undefined
          : metadataString(mergedMetadata, 'locationId') ?? null
        : parsed.data.locationId
    const nextResourceId =
      parsed.data.resourceId === undefined
        ? parsed.data.metadata === undefined
          ? undefined
          : metadataString(mergedMetadata, 'resourceId') ?? null
        : parsed.data.resourceId
    const nextServiceProductId =
      parsed.data.serviceProductId === undefined
        ? parsed.data.metadata === undefined
          ? undefined
          : metadataString(mergedMetadata, 'serviceProductId') ?? null
        : parsed.data.serviceProductId
    const nextProviderUserId =
      parsed.data.providerUserId === undefined
        ? parsed.data.metadata === undefined
          ? undefined
          : metadataString(mergedMetadata, 'providerUserId') ?? null
        : parsed.data.providerUserId
    const nextAcquisitionSource =
      parsed.data.acquisitionSource === undefined
        ? parsed.data.metadata === undefined
          ? undefined
          : metadataString(mergedMetadata, 'acquisitionSource') ?? null
        : parsed.data.acquisitionSource
    const nextAttendanceOutcome =
      parsed.data.attendanceOutcome === undefined
        ? parsed.data.metadata === undefined
          ? undefined
          : metadataString(mergedMetadata, 'attendanceOutcome') ?? null
        : parsed.data.attendanceOutcome
    const nextLeadTimeMinutes =
      parsed.data.leadTimeMinutes === undefined
        ? parsed.data.metadata === undefined
          ? undefined
          : metadataNonNegativeInt(mergedMetadata, 'leadTimeMinutes') ?? null
        : parsed.data.leadTimeMinutes
    const { resourceId: _ignoredResourceId, ...patchableFields } = parsed.data
    const nextStatus = parsed.data.status ?? existing.status
    const nextRequestedStartAt =
      parsed.data.requestedStartAt === undefined
        ? existing.requestedStartAt
        : parsed.data.requestedStartAt === null
          ? null
          : new Date(parsed.data.requestedStartAt)
    const nextRequestedEndAt =
      parsed.data.requestedEndAt === undefined
        ? existing.requestedEndAt
        : parsed.data.requestedEndAt === null
          ? null
          : new Date(parsed.data.requestedEndAt)
    const nextConfirmedStartAt =
      parsed.data.confirmedStartAt === undefined
        ? existing.confirmedStartAt
        : parsed.data.confirmedStartAt === null
          ? null
          : new Date(parsed.data.confirmedStartAt)
    const nextConfirmedEndAt =
      parsed.data.confirmedEndAt === undefined
        ? existing.confirmedEndAt
        : parsed.data.confirmedEndAt === null
          ? null
          : new Date(parsed.data.confirmedEndAt)

    const nextWindow = resolveBookingCapacityWindow({
      startsAt: nextConfirmedStartAt ?? nextRequestedStartAt ?? null,
      endsAt: nextConfirmedEndAt ?? nextRequestedEndAt ?? null,
      durationMinutes: Number(offerVersion?.defaultDurationMin ?? 60),
    })
    if (nextWindow.startsAt && nextWindow.endsAt && ['confirmed', 'checked_in', 'in_progress'].includes(nextStatus)) {
      const resolvedServiceId = metadataString(mergedMetadata, 'serviceId')
      const availabilityDecision = await validateBookingWindow({
        bizId,
        offerId: existing.offerId,
        offerVersionId: existing.offerVersionId,
        locationId: nextLocationId === undefined ? existing.locationId : nextLocationId,
        serviceId: resolvedServiceId,
        serviceProductId: nextServiceProductId === undefined ? existing.serviceProductId : nextServiceProductId,
        providerUserId: nextProviderUserId === undefined ? existing.providerUserId : nextProviderUserId,
        resourceId: nextResourceId === undefined ? metadataString(existing.metadata, 'resourceId') ?? null : nextResourceId,
        ignoreBookingOrderId: bookingOrderId,
        slotStartAt: nextWindow.startsAt,
        slotEndAt: nextWindow.endsAt,
      })
      if (!availabilityDecision.bookable) {
        return fail(
          c,
          'SLOT_UNAVAILABLE',
          'Selected time is not available under current availability policy.',
          409,
          availabilityDecision,
        )
      }
    }

    const updated = await updateBookingRow(c, bizId, bookingOrderId, {
        ...patchableFields,
        requestedStartAt: parsed.data.requestedStartAt === undefined ? undefined : nextRequestedStartAt,
        requestedEndAt: parsed.data.requestedEndAt === undefined ? undefined : nextRequestedEndAt,
        confirmedStartAt: parsed.data.confirmedStartAt === undefined ? undefined : nextConfirmedStartAt,
        confirmedEndAt: parsed.data.confirmedEndAt === undefined ? undefined : nextConfirmedEndAt,
        subtotalMinor,
        taxMinor,
        feeMinor,
        discountMinor,
        totalMinor,
        locationId: nextLocationId,
        serviceProductId: nextServiceProductId,
        providerUserId: nextProviderUserId,
        acquisitionSource: nextAcquisitionSource,
        attendanceOutcome: nextAttendanceOutcome,
        leadTimeMinutes: nextLeadTimeMinutes,
        metadata: mergedMetadata,
      })
    if (updated instanceof Response) return updated

    await syncPersistedBookingCapacityClaims({
      bizId,
      bookingOrderId,
      bookingStatus: nextStatus,
      providerUserId: nextProviderUserId === undefined ? existing.providerUserId : nextProviderUserId,
      resourceId: nextResourceId === undefined ? metadataString(existing.metadata, 'resourceId') ?? null : nextResourceId,
      confirmedStartAt: nextConfirmedStartAt,
      confirmedEndAt: nextConfirmedEndAt,
      requestedStartAt: nextRequestedStartAt,
      requestedEndAt: nextRequestedEndAt,
      durationMinutes: Number(offerVersion?.defaultDurationMin ?? 60),
      actorUserId: actor?.id ?? null,
    })

    return ok(c, updated)
  },
)

bookingRoutes.patch(
  '/bizes/:bizId/booking-orders/:bookingOrderId/status',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('booking_orders.status.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, bookingOrderId } = c.req.param()
    const actor = getCurrentUser(c)

    const body = await c.req.json().catch(() => null)
    const parsed = updateStatusBodySchema.safeParse(body)
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    }

    const existing = await db.query.bookingOrders.findFirst({
      where: and(eq(bookingOrders.bizId, bizId), eq(bookingOrders.id, bookingOrderId)),
    })
    if (!existing) return fail(c, 'NOT_FOUND', 'Booking order not found.', 404)

    const offerVersion = await db.query.offerVersions.findFirst({
      where: and(eq(offerVersions.bizId, bizId), eq(offerVersions.id, existing.offerVersionId)),
      columns: { defaultDurationMin: true },
    })
    const existingWindow = resolveBookingCapacityWindow({
      startsAt: existing.confirmedStartAt ?? existing.requestedStartAt ?? null,
      endsAt: existing.confirmedEndAt ?? existing.requestedEndAt ?? null,
      durationMinutes: Number(offerVersion?.defaultDurationMin ?? 60),
    })
    if (existingWindow.startsAt && existingWindow.endsAt && ['confirmed', 'checked_in', 'in_progress'].includes(parsed.data.status)) {
      const availabilityDecision = await validateBookingWindow({
        bizId,
        offerId: existing.offerId,
        offerVersionId: existing.offerVersionId,
        locationId: existing.locationId,
        serviceId: metadataString(existing.metadata, 'serviceId'),
        serviceProductId: existing.serviceProductId,
        providerUserId: existing.providerUserId,
        resourceId: metadataString(existing.metadata, 'resourceId') ?? null,
        ignoreBookingOrderId: bookingOrderId,
        slotStartAt: existingWindow.startsAt,
        slotEndAt: existingWindow.endsAt,
      })
      if (!availabilityDecision.bookable) {
        return fail(
          c,
          'SLOT_UNAVAILABLE',
          'Selected time is not available under current availability policy.',
          409,
          availabilityDecision,
        )
      }
    }

    const updated = await updateBookingRow(c, bizId, bookingOrderId, {
        status: parsed.data.status,
      })
    if (updated instanceof Response) return updated

    await syncPersistedBookingCapacityClaims({
      bizId,
      bookingOrderId,
      bookingStatus: parsed.data.status,
      providerUserId: existing.providerUserId,
      resourceId: metadataString(existing.metadata, 'resourceId') ?? null,
      confirmedStartAt: existing.confirmedStartAt,
      confirmedEndAt: existing.confirmedEndAt,
      requestedStartAt: existing.requestedStartAt,
      requestedEndAt: existing.requestedEndAt,
      durationMinutes: Number(offerVersion?.defaultDurationMin ?? 60),
      actorUserId: actor?.id ?? null,
    })

    if (!updated) return fail(c, 'NOT_FOUND', 'Booking order not found.', 404)
    return ok(c, updated)
  },
)

bookingRoutes.delete(
  '/bizes/:bizId/booking-orders/:bookingOrderId',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('booking_orders.cancel', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, bookingOrderId } = c.req.param()
    const _user = getCurrentUser(c)

    const existing = await db.query.bookingOrders.findFirst({
      where: and(eq(bookingOrders.bizId, bizId), eq(bookingOrders.id, bookingOrderId)),
    })
    if (!existing) return fail(c, 'NOT_FOUND', 'Booking order not found.', 404)

    const updated = await updateBookingRow(c, bizId, bookingOrderId, {
        status: 'cancelled',
      })
    if (updated instanceof Response) return updated

    const recipientUser = existing.customerUserId
      ? await db.query.users.findFirst({
          where: eq(users.id, existing.customerUserId),
          columns: {
            id: true,
            email: true,
          },
        })
      : null

    if (recipientUser?.email) {
      await createBookingLifecycleMessage({
        bizId,
        recipientUserId: recipientUser.id,
        recipientRef: recipientUser.email,
        bookingOrderId,
        subject: 'Booking cancelled',
        body: `Your booking ${bookingOrderId} has been cancelled.`,
        templateSlug: 'booking-cancelled',
        eventType: 'booking.cancelled',
      })
    }

    return ok(c, { id: bookingOrderId, status: 'cancelled' })
  },
)
