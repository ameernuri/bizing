/**
 * Booking order routes (biz-scoped).
 */

import { Hono } from 'hono'
import { and, asc, desc, eq, sql } from 'drizzle-orm'
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
import { fail, ok, parsePositiveInt } from './_api.js'

const {
  db,
  bookingOrders,
  bookingOrderLines,
  bookingOrderLineSellables,
  offers,
  offerVersions,
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

const publicBookingStatusSchema = z.enum(['draft', 'quoted', 'awaiting_payment', 'confirmed'])

const publicCreateBodySchema = z.object({
  offerId: z.string().min(1),
  offerVersionId: z.string().min(1),
  locationId: z.string().optional(),
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

function withLocationMetadata(
  existing: Record<string, unknown> | null | undefined,
  locationId: string | null | undefined,
) {
  const base = sanitizeUnknown(existing ?? {}) as Record<string, unknown>
  if (locationId === undefined) return base
  if (locationId === null) {
    delete base.locationId
    return base
  }
  base.locationId = locationId
  return base
}

function locationMetadataFilter(locationId?: string) {
  if (!locationId) return undefined
  return sql`${bookingOrders.metadata} ->> 'locationId' = ${locationId}`
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
      pricingSnapshot: derivedPricingSnapshot,
      policySnapshot: derivedPolicySnapshot,
      metadata: withLocationMetadata(parsed.data.metadata ?? {}, parsed.data.locationId),
    },
    parsed.data.offerId,
  )
  if (created instanceof Response) return created

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
        pricingSnapshot: derivedPricingSnapshot,
        policySnapshot: derivedPolicySnapshot,
        metadata: withLocationMetadata(parsed.data.metadata ?? {}, parsed.data.locationId),
      },
      parsed.data.offerId,
    )
    if (created instanceof Response) return created

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
    const _user = getCurrentUser(c)

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

    const updated = await updateBookingRow(c, bizId, bookingOrderId, {
        ...parsed.data,
        requestedStartAt:
          parsed.data.requestedStartAt === undefined
            ? undefined
            : parsed.data.requestedStartAt === null
              ? null
              : new Date(parsed.data.requestedStartAt),
        requestedEndAt:
          parsed.data.requestedEndAt === undefined
            ? undefined
            : parsed.data.requestedEndAt === null
              ? null
              : new Date(parsed.data.requestedEndAt),
        confirmedStartAt:
          parsed.data.confirmedStartAt === undefined
            ? undefined
            : parsed.data.confirmedStartAt === null
              ? null
              : new Date(parsed.data.confirmedStartAt),
        confirmedEndAt:
          parsed.data.confirmedEndAt === undefined
            ? undefined
            : parsed.data.confirmedEndAt === null
              ? null
              : new Date(parsed.data.confirmedEndAt),
        subtotalMinor,
        taxMinor,
        feeMinor,
        discountMinor,
        totalMinor,
        metadata: withLocationMetadata(
          (parsed.data.metadata ?? existing.metadata) as Record<string, unknown>,
          parsed.data.locationId,
        ),
      })
    if (updated instanceof Response) return updated

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
    const _user = getCurrentUser(c)

    const body = await c.req.json().catch(() => null)
    const parsed = updateStatusBodySchema.safeParse(body)
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    }

    const updated = await updateBookingRow(c, bizId, bookingOrderId, {
        status: parsed.data.status,
      })
    if (updated instanceof Response) return updated

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
