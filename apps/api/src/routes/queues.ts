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
import { executeCrudRouteAction } from '../services/action-route-bridge.js'
import { fail, ok, parsePositiveInt } from './_api.js'

const { db, queues, queueEntries, bizConfigValues } = dbPackage

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
  bookingOrderId: z.string().nullable().optional(),
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

const offerNextQueueEntryBodySchema = z.object({
  offerTtlMinutes: z.number().int().min(1).max(60 * 24 * 14).default(60),
  sourceBookingOrderId: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
})

const publicRespondQueueEntryBodySchema = z.object({
  action: z.enum(['accept', 'decline']),
  metadata: z.record(z.unknown()).optional(),
})

function queueEntryResponseMatchesExisting(
  entry: { status: string; customerUserId: string | null; decisionState: unknown },
  userId: string,
  action: 'accept' | 'decline',
) {
  const expectedStatus = action === 'accept' ? 'claimed' : 'cancelled'
  if (entry.status !== expectedStatus || entry.customerUserId !== userId) return false
  if (!entry.decisionState || typeof entry.decisionState !== 'object' || Array.isArray(entry.decisionState)) {
    return true
  }

  const response = (entry.decisionState as Record<string, unknown>).response
  if (!response || typeof response !== 'object' || Array.isArray(response)) return true
  const existingAction = (response as Record<string, unknown>).action
  const existingCustomerUserId = (response as Record<string, unknown>).customerUserId
  if (existingAction == null && existingCustomerUserId == null) return true
  return existingAction === action && existingCustomerUserId === userId
}

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

const transferQueueEntryBodySchema = z.object({
  targetQueueId: z.string().min(1),
  preservePriorityScore: z.boolean().default(true),
  metadata: z.record(z.unknown()).optional(),
})

const recallQueueEntryBodySchema = z.object({
  holdMinutes: z.number().int().min(1).max(60).default(2),
  metadata: z.record(z.unknown()).optional(),
})

async function createQueueRow(
  c: Parameters<typeof executeCrudRouteAction>[0]['c'],
  bizId: string,
  tableKey: string,
  data: Record<string, unknown>,
  options?: {
    subjectType?: string
    subjectId?: string
    displayName?: string
    metadata?: Record<string, unknown>
  },
) {
  const result = await executeCrudRouteAction({
    c,
    bizId,
    tableKey,
    operation: 'create',
    data,
    subjectType: options?.subjectType,
    subjectId: options?.subjectId,
    displayName: options?.displayName,
    metadata: options?.metadata,
  })
  if (!result.ok) return fail(c, result.code, result.message, result.httpStatus, result.details)
  return result.row
}

async function updateQueueRow(
  c: Parameters<typeof executeCrudRouteAction>[0]['c'],
  bizId: string,
  tableKey: string,
  id: string,
  patch: Record<string, unknown>,
  options?: {
    subjectType?: string
    subjectId?: string
    displayName?: string
    metadata?: Record<string, unknown>
  },
) {
  const result = await executeCrudRouteAction({
    c,
    bizId,
    tableKey,
    operation: 'update',
    id,
    patch,
    subjectType: options?.subjectType,
    subjectId: options?.subjectId ?? id,
    displayName: options?.displayName,
    metadata: options?.metadata,
  })
  if (!result.ok) return fail(c, result.code, result.message, result.httpStatus, result.details)
  return result.row
}

function isUniqueViolationForQueueActiveCustomer(error: unknown) {
  if (!error || typeof error !== 'object') return false
  const pgCode = (error as { code?: string }).code
  const message = String((error as { message?: string }).message || '')
  if (pgCode === '23505' && message.includes('queue_entries_active_customer_queue_unique')) return true
  return message.includes('queue_entries_active_customer_queue_unique')
}

async function findActiveQueueEntryForCustomer(input: {
  bizId: string
  queueId: string
  customerUserId: string
}) {
  return db.query.queueEntries.findFirst({
    where: and(
      eq(queueEntries.bizId, input.bizId),
      eq(queueEntries.queueId, input.queueId),
      eq(queueEntries.customerUserId, input.customerUserId),
      sql`${queueEntries.status} in ('waiting', 'offered')`,
    ),
    orderBy: [desc(queueEntries.joinedAt)],
  })
}

/**
 * Ensures a referenced config value is still active before new writes use it.
 *
 * ELI5:
 * - historical rows may keep pointing at retired values forever,
 * - but new rows should not revive a retired dictionary option by accident,
 * - so create/update paths call this guard before saving `statusConfigValueId`.
 */
async function validateActiveStatusConfigValue(input: {
  bizId: string
  statusConfigValueId: string | null | undefined
}) {
  if (!input.statusConfigValueId) return { ok: true as const }
  const row = await db.query.bizConfigValues.findFirst({
    where: and(eq(bizConfigValues.bizId, input.bizId), eq(bizConfigValues.id, input.statusConfigValueId)),
  })
  if (!row) {
    return { ok: false as const, code: 'CONFIG_VALUE_NOT_FOUND', message: 'Config value not found.' }
  }
  if (!row.isActive) {
    return {
      ok: false as const,
      code: 'INACTIVE_CONFIG_VALUE',
      message: 'Retired config values cannot be used for new queue-entry writes.',
    }
  }
  return { ok: true as const }
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

    const created = await createQueueRow(c, bizId, 'queues', {
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
      }, {
      subjectType: 'queue',
      displayName: parsed.data.name,
    })
    if (created instanceof Response) return created

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

queueRoutes.get(
  '/bizes/:bizId/queues/:queueId/display-board',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('queues.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, queueId } = c.req.param()
    const queue = await db.query.queues.findFirst({
      where: and(eq(queues.bizId, bizId), eq(queues.id, queueId)),
    })
    if (!queue) return fail(c, 'NOT_FOUND', 'Queue not found.', 404)

    const entries = await db.query.queueEntries.findMany({
      where: and(eq(queueEntries.bizId, bizId), eq(queueEntries.queueId, queueId)),
      orderBy: [asc(queueEntries.joinedAt)],
    })

    const waiting = entries.filter((row) => row.status === 'waiting')
    const offered = entries.filter((row) => row.status === 'offered')
    const served = entries.filter((row) => row.status === 'served')
    const activeCounters = Array.isArray((queue.metadata as Record<string, unknown> | null)?.activeCounters)
      ? ((queue.metadata as Record<string, unknown>).activeCounters as Array<Record<string, unknown>>)
      : [
          { counterKey: 'A', nowServing: served.at(-1)?.displayCode ?? null },
        ]

    const avgWait = waiting.length > 0
      ? Math.round(waiting.reduce((sum, row) => sum + Number(row.estimatedWaitMin ?? 0), 0) / waiting.length)
      : 0

    return ok(c, {
      queue: {
        id: queue.id,
        name: queue.name,
        strategy: queue.strategy,
        status: queue.status,
      },
      display: {
        nowServing: activeCounters,
        nextUp: waiting.slice(0, 5).map((row) => ({
          queueEntryId: row.id,
          displayCode: row.displayCode,
          estimatedWaitMin: row.estimatedWaitMin,
        })),
        offered: offered.map((row) => ({
          queueEntryId: row.id,
          displayCode: row.displayCode,
          offerExpiresAt: row.offerExpiresAt,
        })),
        averageEstimatedWaitMin: avgWait,
        queueDepth: waiting.length,
      },
    })
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

    const updated = await updateQueueRow(c, bizId, 'queues', queueId, {
        ...parsed.data,
      }, {
      subjectType: 'queue',
      displayName: existing.name,
    })
    if (updated instanceof Response) return updated

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

    const archived = await updateQueueRow(c, bizId, 'queues', queueId, {
        status: 'archived',
      }, {
      subjectType: 'queue',
      displayName: existing.name,
    })
    if (archived instanceof Response) return archived

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

    const statusConfigValidation = await validateActiveStatusConfigValue({
      bizId,
      statusConfigValueId: parsed.data.statusConfigValueId,
    })
    if (!statusConfigValidation.ok) {
      return fail(c, statusConfigValidation.code, statusConfigValidation.message, 409)
    }

    const activeExisting =
      parsed.data.customerUserId &&
      (parsed.data.status === 'waiting' || parsed.data.status === 'offered')
        ? await findActiveQueueEntryForCustomer({
            bizId,
            queueId,
            customerUserId: parsed.data.customerUserId,
          })
        : null
    if (activeExisting) {
      return ok(c, activeExisting)
    }

    try {
      const created = await createQueueRow(c, bizId, 'queueEntries', {
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
        }, {
        subjectType: 'queue_entry',
        displayName: parsed.data.displayCode ?? 'Queue Entry',
      })
      if (created instanceof Response) return created
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

    const statusConfigValidation = await validateActiveStatusConfigValue({
      bizId,
      statusConfigValueId: parsed.data.statusConfigValueId,
    })
    if (!statusConfigValidation.ok) {
      return fail(c, statusConfigValidation.code, statusConfigValidation.message, 409)
    }

    const updated = await updateQueueRow(c, bizId, 'queueEntries', queueEntryId, {
        status: parsed.data.status,
        statusConfigValueId:
          parsed.data.statusConfigValueId === undefined ? undefined : parsed.data.statusConfigValueId,
        bookingOrderId: parsed.data.bookingOrderId === undefined ? undefined : parsed.data.bookingOrderId,
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
      }, {
      subjectType: 'queue_entry',
      displayName: existing.displayCode ?? existing.id,
    })
    if (updated instanceof Response) return updated

    return ok(c, updated)
  },
)

/**
 * Transfer one queue ticket to another queue.
 *
 * ELI5:
 * - sometimes a customer grabbed the wrong line,
 * - or a simple task becomes a complex task mid-flow,
 * - this keeps the same queue-entry identity but moves it to a new queue with
 *   explicit transfer metadata so reporting/debugging can explain what happened.
 */
queueRoutes.post(
  '/bizes/:bizId/queues/:queueId/entries/:queueEntryId/transfer',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('queue_entries.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, queueId, queueEntryId } = c.req.param()
    const parsed = transferQueueEntryBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    }

    const [existing, targetQueue] = await Promise.all([
      db.query.queueEntries.findFirst({
        where: and(eq(queueEntries.bizId, bizId), eq(queueEntries.queueId, queueId), eq(queueEntries.id, queueEntryId)),
      }),
      db.query.queues.findFirst({
        where: and(eq(queues.bizId, bizId), eq(queues.id, parsed.data.targetQueueId)),
      }),
    ])
    if (!existing) return fail(c, 'NOT_FOUND', 'Queue entry not found.', 404)
    if (!targetQueue) return fail(c, 'NOT_FOUND', 'Target queue not found.', 404)

    const updated = await updateQueueRow(c, bizId, 'queueEntries', queueEntryId, {
        queueId: parsed.data.targetQueueId,
        priorityScore: parsed.data.preservePriorityScore ? existing.priorityScore : 0,
        metadata: {
          ...((existing.metadata ?? {}) as Record<string, unknown>),
          transfer: {
            fromQueueId: queueId,
            toQueueId: parsed.data.targetQueueId,
            transferredAt: new Date().toISOString(),
          },
          ...((parsed.data.metadata ?? {}) as Record<string, unknown>),
        },
      }, {
      subjectType: 'queue_entry',
      displayName: existing.displayCode ?? existing.id,
    })
    if (updated instanceof Response) return updated

    return ok(c, updated, 201)
  },
)

/**
 * Recall a missed customer and hold their spot for a short grace window.
 *
 * ELI5:
 * - "you were called, but maybe you were in the bathroom"
 * - instead of deleting the ticket immediately, we reopen the offer window for
 *   a tiny grace period and record the recall count.
 */
queueRoutes.post(
  '/bizes/:bizId/queues/:queueId/entries/:queueEntryId/recall',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('queue_entries.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, queueId, queueEntryId } = c.req.param()
    const parsed = recallQueueEntryBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    }

    const existing = await db.query.queueEntries.findFirst({
      where: and(eq(queueEntries.bizId, bizId), eq(queueEntries.queueId, queueId), eq(queueEntries.id, queueEntryId)),
    })
    if (!existing) return fail(c, 'NOT_FOUND', 'Queue entry not found.', 404)

    const now = new Date()
    const recallCount = Number(((existing.metadata ?? {}) as Record<string, unknown>).recallCount ?? 0) + 1
    const updated = await updateQueueRow(c, bizId, 'queueEntries', queueEntryId, {
        status: 'offered',
        offeredAt: now,
        offerExpiresAt: new Date(now.getTime() + parsed.data.holdMinutes * 60 * 1000),
        metadata: {
          ...((existing.metadata ?? {}) as Record<string, unknown>),
          recallCount,
          recallHoldMinutes: parsed.data.holdMinutes,
          recallAt: now.toISOString(),
          ...((parsed.data.metadata ?? {}) as Record<string, unknown>),
        },
      }, {
      subjectType: 'queue_entry',
      displayName: existing.displayCode ?? existing.id,
    })
    if (updated instanceof Response) return updated

    return ok(c, updated, 201)
  },
)

/**
 * Offer the next waiting queue entry.
 *
 * ELI5:
 * - a waitlist is only useful if the business can promote the next person,
 * - this endpoint picks the next eligible waiting entry using queue strategy,
 * - then marks that entry as "offered" with an expiration window.
 *
 * Why this exists:
 * - deterministic saga validation for waitlist promotion,
 * - real operational need for cancellations/no-shows,
 * - keeps queue promotion logic in one canonical place instead of scattered
 *   client-side patches.
 */
queueRoutes.post(
  '/bizes/:bizId/queues/:queueId/offer-next',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('queue_entries.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, queueId } = c.req.param()
    const user = getCurrentUser(c)
    if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)
    const body = await c.req.json().catch(() => ({}))
    const parsed = offerNextQueueEntryBodySchema.safeParse(body)
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    }

    const queue = await db.query.queues.findFirst({
      where: and(eq(queues.bizId, bizId), eq(queues.id, queueId)),
    })
    if (!queue) return fail(c, 'NOT_FOUND', 'Queue not found.', 404)

    const waitingEntries = await db.query.queueEntries.findMany({
      where: and(eq(queueEntries.bizId, bizId), eq(queueEntries.queueId, queueId), eq(queueEntries.status, 'waiting')),
    })
    if (waitingEntries.length === 0) {
      return fail(c, 'NO_WAITING_ENTRIES', 'No waiting queue entries are available to offer.', 409)
    }

    const sortedEntries = [...waitingEntries].sort((a, b) => {
      if (queue.strategy === 'priority') {
        if (b.priorityScore !== a.priorityScore) return b.priorityScore - a.priorityScore
        return a.joinedAt.getTime() - b.joinedAt.getTime()
      }
      return a.joinedAt.getTime() - b.joinedAt.getTime()
    })

    const selected = sortedEntries[0]
    const offeredAt = new Date()
    const offerExpiresAt = new Date(offeredAt.getTime() + parsed.data.offerTtlMinutes * 60 * 1000)
    const nextDecisionState = {
      ...((selected.decisionState ?? {}) as Record<string, unknown>),
      offer: {
        action: 'offered',
        offeredAt: offeredAt.toISOString(),
        offerExpiresAt: offerExpiresAt.toISOString(),
        sourceBookingOrderId: parsed.data.sourceBookingOrderId ?? null,
        promotedByUserId: user.id,
      },
    }
    const nextMetadata = {
      ...((selected.metadata ?? {}) as Record<string, unknown>),
      ...(parsed.data.metadata ?? {}),
    }

    const updated = await updateQueueRow(c, bizId, 'queueEntries', selected.id, {
        status: 'offered',
        offeredAt,
        offerExpiresAt,
        decisionState: nextDecisionState,
        metadata: nextMetadata,
      }, {
      subjectType: 'queue_entry',
      displayName: selected.displayCode ?? selected.id,
    })
    if (updated instanceof Response) return updated

    return ok(c, updated, 201)
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

  const activeExisting = await findActiveQueueEntryForCustomer({
    bizId,
    queueId,
    customerUserId: user.id,
  })
  if (activeExisting) {
    return ok(c, activeExisting)
  }

  try {
    const created = await createQueueRow(c, bizId, 'queueEntries', {
        bizId,
        queueId,
        customerUserId: user.id,
        customerGroupAccountId: parsed.data.customerGroupAccountId,
        requestedOfferVersionId: parsed.data.requestedOfferVersionId,
        bookingOrderId: parsed.data.bookingOrderId,
        priorityScore: parsed.data.priorityScore,
        displayCode: parsed.data.displayCode,
        metadata: parsed.data.metadata ?? {},
      }, {
      subjectType: 'queue_entry',
      displayName: parsed.data.displayCode ?? 'Public Queue Entry',
    })
    if (created instanceof Response) return created

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

/**
 * Public customer response to an offered waitlist entry.
 *
 * ELI5:
 * - once the business offers a spot, the customer needs to answer,
 * - "accept" means they are taking the offered chance,
 * - "decline" means give it to someone else.
 *
 * The route enforces:
 * - customer can only respond to their own entry,
 * - only offered entries can be answered,
 * - expired offers cannot be accepted.
 */
queueRoutes.post('/public/bizes/:bizId/queues/:queueId/entries/:queueEntryId/respond', requireAuth, async (c) => {
  const { bizId, queueId, queueEntryId } = c.req.param()
  const user = getCurrentUser(c)
  if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)
  const body = await c.req.json().catch(() => null)
  const parsed = publicRespondQueueEntryBodySchema.safeParse(body)
  if (!parsed.success) {
    return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  }

  const existing = await db.query.queueEntries.findFirst({
    where: and(
      eq(queueEntries.bizId, bizId),
      eq(queueEntries.queueId, queueId),
      eq(queueEntries.id, queueEntryId),
      eq(queueEntries.customerUserId, user.id),
    ),
  })
  if (!existing) return fail(c, 'NOT_FOUND', 'Queue entry not found.', 404)
  if (queueEntryResponseMatchesExisting(existing, user.id, parsed.data.action)) {
    return ok(c, existing)
  }
  if (existing.status !== 'offered') {
    return fail(c, 'INVALID_STATE', 'Only offered queue entries can be answered.', 409)
  }

  const now = new Date()
  if (parsed.data.action === 'accept' && existing.offerExpiresAt && existing.offerExpiresAt.getTime() < now.getTime()) {
    return fail(c, 'OFFER_EXPIRED', 'The offered waitlist slot has already expired.', 409)
  }

  const nextStatus = parsed.data.action === 'accept' ? 'claimed' : 'cancelled'
  const nextDecisionState = {
    ...((existing.decisionState ?? {}) as Record<string, unknown>),
    response: {
      action: parsed.data.action,
      respondedAt: now.toISOString(),
      customerUserId: user.id,
    },
  }
  const nextMetadata = {
    ...((existing.metadata ?? {}) as Record<string, unknown>),
    ...(parsed.data.metadata ?? {}),
  }

  const updated = await updateQueueRow(c, bizId, 'queueEntries', queueEntryId, {
      status: nextStatus,
      decisionState: nextDecisionState,
      metadata: nextMetadata,
    }, {
    subjectType: 'queue_entry',
    displayName: existing.displayCode ?? existing.id,
  })
  if (updated instanceof Response) return updated

  return ok(c, updated)
})
