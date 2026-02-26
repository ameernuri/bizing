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
import { fail, ok, parsePositiveInt } from './_api.js'

const { db, bookingOrders, offers, offerVersions } = dbPackage

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
  sortBy: z.enum(['requestedStartAt', 'confirmedStartAt']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
})

const createBodySchema = z.object({
  offerId: z.string().min(1),
  offerVersionId: z.string().min(1),
  customerUserId: z.string().optional(),
  customerGroupAccountId: z.string().optional(),
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

export const bookingRoutes = new Hono()

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

  const [created] = await db
    .insert(bookingOrders)
    .values({
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
      pricingSnapshot: parsed.data.pricingSnapshot ?? {},
      policySnapshot: parsed.data.policySnapshot ?? {},
      metadata: parsed.data.metadata ?? {},
    })
    .returning()

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
    const _user = getCurrentUser(c)

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

    const [created] = await db
      .insert(bookingOrders)
      .values({
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
        pricingSnapshot: parsed.data.pricingSnapshot ?? {},
        policySnapshot: parsed.data.policySnapshot ?? {},
        metadata: parsed.data.metadata ?? {},
      })
      .returning()

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

    const [updated] = await db
      .update(bookingOrders)
      .set({
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
      })
      .where(and(eq(bookingOrders.bizId, bizId), eq(bookingOrders.id, bookingOrderId)))
      .returning()

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

    const [updated] = await db
      .update(bookingOrders)
      .set({
        status: parsed.data.status,
      })
      .where(and(eq(bookingOrders.bizId, bizId), eq(bookingOrders.id, bookingOrderId)))
      .returning()

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

    const [updated] = await db
      .update(bookingOrders)
      .set({
        status: 'cancelled',
      })
      .where(and(eq(bookingOrders.bizId, bizId), eq(bookingOrders.id, bookingOrderId)))
      .returning()

    if (!updated) return fail(c, 'NOT_FOUND', 'Booking order not found.', 404)
    return ok(c, { id: bookingOrderId, status: 'cancelled' })
  },
)
