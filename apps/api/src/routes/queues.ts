/**
 * Queue + waitlist routes (biz scoped + public self-join surface).
 *
 * Why this module exists:
 * - Queue/waitlist is a first-class fulfillment mode (not a metadata flag).
 * - Businesses need operational APIs (create/manage queues and entries).
 * - Customers need public APIs to self-join waitlists without internal member
 *   access.
 *
 * Design notes:
 * - Biz routes are protected by auth + biz membership + ACL permissions.
 * - Public routes are authenticated customer surfaces (no internal ACL role
 *   required) and only expose "my queue entries" data.
 * - Soft-deleted rows are hidden from read paths.
 */

import { Hono } from 'hono'
import { and, asc, desc, eq, ilike, sql } from 'drizzle-orm'
import { z } from 'zod'
import dbPackage from '@bizing/db'
import {
  getCurrentUser,
  requireAclPermission,
  requireAuth,
  requireBizAccess,
} from '../middleware/auth.js'
import { fail, ok, parsePositiveInt } from './_api.js'

const { db, queues, queueEntries } = dbPackage

/**
 * Canonical queue strategy values from schema enum.
 */
const queueStrategySchema = z.enum(['fifo', 'priority', 'weighted', 'fair_share'])

/**
 * Canonical queue lifecycle values from schema enum.
 */
const queueStatusSchema = z.enum(['active', 'paused', 'closed', 'archived'])

/**
 * Canonical queue-entry lifecycle values from schema enum.
 */
const queueEntryStatusSchema = z.enum([
  'waiting',
  'offered',
  'claimed',
  'expired',
  'removed',
  'served',
  'cancelled',
  'no_show',
])

const listQueuesQuerySchema = z.object({
  page: z.string().optional(),
  perPage: z.string().optional(),
  locationId: z.string().optional(),
  strategy: queueStrategySchema.optional(),
  status: queueStatusSchema.optional(),
  selfJoinOnly: z.enum(['true', 'false']).optional(),
  search: z.string().optional(),
  sortBy: z.enum(['name']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
})

const createQueueBodySchema = z.object({
  locationId: z.string().optional(),
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(140).regex(/^[a-z0-9-]+$/),
  description: z.string().max(600).optional(),
  strategy: queueStrategySchema.default('fifo'),
  status: queueStatusSchema.default('active'),
  strategyConfigValueId: z.string().optional(),
  statusConfigValueId: z.string().optional(),
  calendarBindingId: z.string().optional(),
  isSelfJoinEnabled: z.boolean().default(true),
  policy: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
})

const updateQueueBodySchema = createQueueBodySchema.partial().omit({ slug: true })

const listQueueEntriesQuerySchema = z.object({
  page: z.string().optional(),
  perPage: z.string().optional(),
  status: queueEntryStatusSchema.optional(),
  customerUserId: z.string().optional(),
  search: z.string().optional(),
  sortBy: z.enum(['joinedAt', 'priorityScore']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
})

const createQueueEntryBodySchema = z
  .object({
    customerUserId: z.string().optional(),
    customerGroupAccountId: z.string().optional(),
    requestedOfferVersionId: z.string().optional(),
    bookingOrderId: z.string().optional(),
    fulfillmentUnitId: z.string().optional(),
    status: queueEntryStatusSchema.default('waiting'),
    statusConfigValueId: z.string().optional(),
    priorityScore: z.number().int().default(0),
    displayCode: z.string().max(60).optional(),
    estimatedStartAt: z.string().datetime().optional(),
    estimatedWaitMin: z.number().int().min(0).optional(),
    offeredAt: z.string().datetime().optional(),
    offerExpiresAt: z.string().datetime().optional(),
    servedAt: z.string().datetime().optional(),
    decisionState: z.record(z.unknown()).optional(),
    metadata: z.record(z.unknown()).optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.customerUserId && !value.customerGroupAccountId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Either customerUserId or customerGroupAccountId is required.',
        path: ['customerUserId'],
      })
    }
  })

const updateQueueEntryBodySchema = z.object({
  status: queueEntryStatusSchema.optional(),
  statusConfigValueId: z.string().nullable().optional(),
  priorityScore: z.number().int().optional(),
  displayCode: z.string().max(60).nullable().optional(),
  estimatedStartAt: z.string().datetime().nullable().optional(),
  estimatedWaitMin: z.number().int().min(0).nullable().optional(),
  offeredAt: z.string().datetime().nullable().optional(),
  offerExpiresAt: z.string().datetime().nullable().optional(),
  servedAt: z.string().datetime().nullable().optional(),
  decisionState: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
})

const publicListQueuesQuerySchema = z.object({
  locationId: z.string().optional(),
  search: z.string().optional(),
  limit: z.string().optional(),
})

const publicCreateQueueEntryBodySchema = z.object({
  customerGroupAccountId: z.string().optional(),
  requestedOfferVersionId: z.string().optional(),
  bookingOrderId: z.string().optional(),
  priorityScore: z.number().int().default(0),
  displayCode: z.string().max(60).optional(),
  metadata: z.record(z.unknown()).optional(),
})

function isUniqueViolationForQueueActiveCustomer(error: unknown) {
  if (!error || typeof error !== 'object') return false
  const pgCode = (error as { code?: string }).code
  const message = String((error as { message?: string }).message || '')
  if (pgCode === '23505' && message.includes('queue_entries_active_customer_queue_unique')) return true
  return message.includes('queue_entries_active_customer_queue_unique')
}

export const queueRoutes = new Hono()

queueRoutes.get(
  '/bizes/:bizId/queues',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('queues.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = listQueuesQuerySchema.safeParse(c.req.query())
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid query parameters.', 400, parsed.error.flatten())
    }

    const pageNum = parsePositiveInt(parsed.data.page, 1)
    const perPageNum = Math.min(parsePositiveInt(parsed.data.perPage, 20), 100)
    const sortColumn = queues.name
    const orderByExpr = parsed.data.sortOrder === 'asc' ? asc(sortColumn) : desc(sortColumn)

    const where = and(
      eq(queues.bizId, bizId),
      parsed.data.locationId ? eq(queues.locationId, parsed.data.locationId) : undefined,
      parsed.data.strategy ? eq(queues.strategy, parsed.data.strategy) : undefined,
      parsed.data.status ? eq(queues.status, parsed.data.status) : undefined,
      parsed.data.selfJoinOnly ? eq(queues.isSelfJoinEnabled, parsed.data.selfJoinOnly === 'true') : undefined,
      parsed.data.search ? ilike(queues.name, `%${parsed.data.search}%`) : undefined,
    )

    const [rows, countRows] = await Promise.all([
      db.query.queues.findMany({
        where,
        orderBy: orderByExpr,
        limit: perPageNum,
        offset: (pageNum - 1) * perPageNum,
      }),
      db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(queues).where(where),
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

queueRoutes.post(
  '/bizes/:bizId/queues',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('queues.create', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const _user = getCurrentUser(c)
    const body = await c.req.json().catch(() => null)
    const parsed = createQueueBodySchema.safeParse(body)
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    }

    const [created] = await db
      .insert(queues)
      .values({
        bizId,
        locationId: parsed.data.locationId,
        name: parsed.data.name,
        slug: parsed.data.slug,
        description: parsed.data.description,
        strategy: parsed.data.strategy,
        status: parsed.data.status,
        strategyConfigValueId: parsed.data.strategyConfigValueId,
        statusConfigValueId: parsed.data.statusConfigValueId,
        calendarBindingId: parsed.data.calendarBindingId,
        isSelfJoinEnabled: parsed.data.isSelfJoinEnabled,
        policy: parsed.data.policy ?? {},
        metadata: parsed.data.metadata ?? {},
      })
      .returning()

    return ok(c, created, 201)
  },
)

queueRoutes.get(
  '/bizes/:bizId/queues/:queueId',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('queues.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, queueId } = c.req.param()
    const row = await db.query.queues.findFirst({
      where: and(eq(queues.bizId, bizId), eq(queues.id, queueId)),
    })
    if (!row) return fail(c, 'NOT_FOUND', 'Queue not found.', 404)
    return ok(c, row)
  },
)

queueRoutes.patch(
  '/bizes/:bizId/queues/:queueId',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('queues.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, queueId } = c.req.param()
    const _user = getCurrentUser(c)
    const body = await c.req.json().catch(() => null)
    const parsed = updateQueueBodySchema.safeParse(body)
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    }

    const existing = await db.query.queues.findFirst({
      where: and(eq(queues.bizId, bizId), eq(queues.id, queueId)),
    })
    if (!existing) return fail(c, 'NOT_FOUND', 'Queue not found.', 404)

    const [updated] = await db
      .update(queues)
      .set({
        ...parsed.data,
      })
      .where(and(eq(queues.bizId, bizId), eq(queues.id, queueId)))
      .returning()

    return ok(c, updated)
  },
)

queueRoutes.delete(
  '/bizes/:bizId/queues/:queueId',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('queues.archive', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, queueId } = c.req.param()
    const _user = getCurrentUser(c)
    const existing = await db.query.queues.findFirst({
      where: and(eq(queues.bizId, bizId), eq(queues.id, queueId)),
    })
    if (!existing) return fail(c, 'NOT_FOUND', 'Queue not found.', 404)

    await db
      .update(queues)
      .set({
        status: 'archived',
      })
      .where(and(eq(queues.bizId, bizId), eq(queues.id, queueId)))

    return ok(c, { id: queueId })
  },
)

queueRoutes.get(
  '/bizes/:bizId/queues/:queueId/entries',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('queue_entries.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, queueId } = c.req.param()
    const parsed = listQueueEntriesQuerySchema.safeParse(c.req.query())
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid query parameters.', 400, parsed.error.flatten())
    }

    const pageNum = parsePositiveInt(parsed.data.page, 1)
    const perPageNum = Math.min(parsePositiveInt(parsed.data.perPage, 20), 100)
    const sortColumn = parsed.data.sortBy === 'priorityScore' ? queueEntries.priorityScore : queueEntries.joinedAt
    const orderByExpr = parsed.data.sortOrder === 'desc' ? desc(sortColumn) : asc(sortColumn)

    const where = and(
      eq(queueEntries.bizId, bizId),
      eq(queueEntries.queueId, queueId),
      parsed.data.status ? eq(queueEntries.status, parsed.data.status) : undefined,
      parsed.data.customerUserId ? eq(queueEntries.customerUserId, parsed.data.customerUserId) : undefined,
      parsed.data.search ? ilike(queueEntries.displayCode, `%${parsed.data.search}%`) : undefined,
    )

    const [rows, countRows] = await Promise.all([
      db.query.queueEntries.findMany({
        where,
        orderBy: orderByExpr,
        limit: perPageNum,
        offset: (pageNum - 1) * perPageNum,
      }),
      db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(queueEntries).where(where),
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

queueRoutes.post(
  '/bizes/:bizId/queues/:queueId/entries',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('queue_entries.create', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, queueId } = c.req.param()
    const _user = getCurrentUser(c)
    const body = await c.req.json().catch(() => null)
    const parsed = createQueueEntryBodySchema.safeParse(body)
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    }

    const queue = await db.query.queues.findFirst({
      where: and(eq(queues.bizId, bizId), eq(queues.id, queueId)),
    })
    if (!queue) return fail(c, 'NOT_FOUND', 'Queue not found.', 404)

    try {
      const [created] = await db
        .insert(queueEntries)
        .values({
          bizId,
          queueId,
          customerUserId: parsed.data.customerUserId,
          customerGroupAccountId: parsed.data.customerGroupAccountId,
          requestedOfferVersionId: parsed.data.requestedOfferVersionId,
          bookingOrderId: parsed.data.bookingOrderId,
          fulfillmentUnitId: parsed.data.fulfillmentUnitId,
          status: parsed.data.status,
          statusConfigValueId: parsed.data.statusConfigValueId,
          priorityScore: parsed.data.priorityScore,
          displayCode: parsed.data.displayCode,
          estimatedStartAt: parsed.data.estimatedStartAt
            ? new Date(parsed.data.estimatedStartAt)
            : undefined,
          estimatedWaitMin: parsed.data.estimatedWaitMin,
          offeredAt: parsed.data.offeredAt ? new Date(parsed.data.offeredAt) : undefined,
          offerExpiresAt: parsed.data.offerExpiresAt ? new Date(parsed.data.offerExpiresAt) : undefined,
          servedAt: parsed.data.servedAt ? new Date(parsed.data.servedAt) : undefined,
          decisionState: parsed.data.decisionState ?? {},
          metadata: parsed.data.metadata ?? {},
        })
        .returning()
      return ok(c, created, 201)
    } catch (error) {
      if (isUniqueViolationForQueueActiveCustomer(error)) {
        return fail(
          c,
          'QUEUE_ENTRY_ALREADY_ACTIVE',
          'Customer already has an active queue entry for this queue.',
          409,
        )
      }
      throw error
    }
  },
)

queueRoutes.patch(
  '/bizes/:bizId/queues/:queueId/entries/:queueEntryId',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('queue_entries.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, queueId, queueEntryId } = c.req.param()
    const user = getCurrentUser(c)
    const body = await c.req.json().catch(() => null)
    const parsed = updateQueueEntryBodySchema.safeParse(body)
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    }

    const existing = await db.query.queueEntries.findFirst({
      where: and(
        eq(queueEntries.bizId, bizId),
        eq(queueEntries.queueId, queueId),
        eq(queueEntries.id, queueEntryId),
      ),
    })
    if (!existing) return fail(c, 'NOT_FOUND', 'Queue entry not found.', 404)

    const [updated] = await db
      .update(queueEntries)
      .set({
        status: parsed.data.status,
        statusConfigValueId:
          parsed.data.statusConfigValueId === undefined ? undefined : parsed.data.statusConfigValueId,
        priorityScore: parsed.data.priorityScore,
        displayCode: parsed.data.displayCode === undefined ? undefined : parsed.data.displayCode,
        estimatedStartAt:
          parsed.data.estimatedStartAt === undefined
            ? undefined
            : parsed.data.estimatedStartAt
              ? new Date(parsed.data.estimatedStartAt)
              : null,
        estimatedWaitMin:
          parsed.data.estimatedWaitMin === undefined ? undefined : parsed.data.estimatedWaitMin,
        offeredAt:
          parsed.data.offeredAt === undefined
            ? undefined
            : parsed.data.offeredAt
              ? new Date(parsed.data.offeredAt)
              : null,
        offerExpiresAt:
          parsed.data.offerExpiresAt === undefined
            ? undefined
            : parsed.data.offerExpiresAt
              ? new Date(parsed.data.offerExpiresAt)
              : null,
        servedAt:
          parsed.data.servedAt === undefined
            ? undefined
            : parsed.data.servedAt
              ? new Date(parsed.data.servedAt)
              : null,
        decisionState: parsed.data.decisionState,
        metadata: parsed.data.metadata,
      })
      .where(
        and(
          eq(queueEntries.bizId, bizId),
          eq(queueEntries.queueId, queueId),
          eq(queueEntries.id, queueEntryId),
        ),
      )
      .returning()

    return ok(c, updated)
  },
)

/**
 * Public customer queue list.
 *
 * This powers customer discovery pages showing available self-join queues.
 */
queueRoutes.get('/public/bizes/:bizId/queues', requireAuth, async (c) => {
  const bizId = c.req.param('bizId')
  const parsed = publicListQueuesQuerySchema.safeParse(c.req.query())
  if (!parsed.success) {
    return fail(c, 'VALIDATION_ERROR', 'Invalid query parameters.', 400, parsed.error.flatten())
  }

  const limit = Math.min(parsePositiveInt(parsed.data.limit, 50), 200)
  const where = and(
    eq(queues.bizId, bizId),
    eq(queues.isSelfJoinEnabled, true),
    eq(queues.status, 'active'),
    parsed.data.locationId ? eq(queues.locationId, parsed.data.locationId) : undefined,
    parsed.data.search ? ilike(queues.name, `%${parsed.data.search}%`) : undefined,
  )

  const rows = await db.query.queues.findMany({
    where,
    orderBy: asc(queues.name),
    limit,
  })

  return ok(c, rows)
})

/**
 * Public customer waitlist join endpoint.
 *
 * ELI5:
 * - customer logs in,
 * - customer joins queue,
 * - server stores queue entry with customerUserId from session (not from body),
 * - duplicate active entry is blocked cleanly with 409.
 */
queueRoutes.post('/public/bizes/:bizId/queues/:queueId/entries', requireAuth, async (c) => {
  const user = getCurrentUser(c)
  if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)

  const { bizId, queueId } = c.req.param()
  const body = await c.req.json().catch(() => null)
  const parsed = publicCreateQueueEntryBodySchema.safeParse(body)
  if (!parsed.success) {
    return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  }

  const queue = await db.query.queues.findFirst({
    where: and(eq(queues.bizId, bizId), eq(queues.id, queueId)),
  })
  if (!queue) return fail(c, 'NOT_FOUND', 'Queue not found.', 404)
  if (queue.status !== 'active') return fail(c, 'QUEUE_CLOSED', 'Queue is not accepting joins.', 409)
  if (!queue.isSelfJoinEnabled) {
    return fail(c, 'SELF_JOIN_DISABLED', 'Queue self-join is disabled.', 409)
  }

  try {
    const [created] = await db
      .insert(queueEntries)
      .values({
        bizId,
        queueId,
        customerUserId: user.id,
        customerGroupAccountId: parsed.data.customerGroupAccountId,
        requestedOfferVersionId: parsed.data.requestedOfferVersionId,
        bookingOrderId: parsed.data.bookingOrderId,
        priorityScore: parsed.data.priorityScore,
        displayCode: parsed.data.displayCode,
        metadata: parsed.data.metadata ?? {},
      })
      .returning()

    return ok(c, created, 201)
  } catch (error) {
    if (isUniqueViolationForQueueActiveCustomer(error)) {
      return fail(
        c,
        'QUEUE_ENTRY_ALREADY_ACTIVE',
        'You already have an active queue entry for this queue.',
        409,
      )
    }
    throw error
  }
})

/**
 * Public customer queue history endpoint for one queue.
 *
 * This lets users verify "am I in line?" from their own account context.
 */
queueRoutes.get('/public/bizes/:bizId/queues/:queueId/entries', requireAuth, async (c) => {
  const user = getCurrentUser(c)
  if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)

  const { bizId, queueId } = c.req.param()
  const parsed = listQueueEntriesQuerySchema.safeParse(c.req.query())
  if (!parsed.success) {
    return fail(c, 'VALIDATION_ERROR', 'Invalid query parameters.', 400, parsed.error.flatten())
  }

  const pageNum = parsePositiveInt(parsed.data.page, 1)
  const perPageNum = Math.min(parsePositiveInt(parsed.data.perPage, 20), 100)
  const where = and(
    eq(queueEntries.bizId, bizId),
    eq(queueEntries.queueId, queueId),
    eq(queueEntries.customerUserId, user.id),
    parsed.data.status ? eq(queueEntries.status, parsed.data.status) : undefined,
  )

  const [rows, countRows] = await Promise.all([
    db.query.queueEntries.findMany({
      where,
      orderBy: desc(queueEntries.joinedAt),
      limit: perPageNum,
      offset: (pageNum - 1) * perPageNum,
    }),
    db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(queueEntries).where(where),
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
