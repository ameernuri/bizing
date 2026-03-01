/**
 * Subject event and delivery routes.
 *
 * ELI5:
 * A "subject event" is one immutable fact like:
 * - offer slots opened,
 * - queue threshold crossed,
 * - product restocked,
 * - custom plugin warning emitted.
 *
 * A "delivery" row is the follow-up story for one subscriber/channel pair:
 * - queued,
 * - retried,
 * - delivered,
 * - seen,
 * - failed.
 *
 * Why this route exists:
 * - the schema already has a proper event stream and delivery timeline,
 * - automation/saga/debug flows need API-level proof surfaces,
 * - subject events are designed to be generic so future domains can publish
 *   facts without inventing ad-hoc logging tables.
 */

import { Hono } from 'hono'
import { and, desc, eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import dbPackage from '@bizing/db'
import {
  getCurrentUser,
  requireAclPermission,
  requireAuth,
  requireBizAccess,
} from '../middleware/auth.js'
import { fail, ok, parsePositiveInt } from './_api.js'

const {
  db,
  subjects,
  graphIdentities,
  graphSubjectEvents,
  graphSubjectEventDeliveries,
  graphSubjectSubscriptions,
  graphIdentityNotificationEndpoints,
} = dbPackage

function sanitizeHandle(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 100)
}

function randomHandleSuffix() {
  return Math.random().toString(36).slice(2, 8)
}

type GraphIdentityRow = typeof graphIdentities.$inferSelect

async function ensureUserGraphIdentity(input: {
  userId: string
  email?: string
}): Promise<GraphIdentityRow> {
  const existing = await db.query.graphIdentities.findFirst({
    where: and(
      eq(graphIdentities.ownerType, 'user'),
      eq(graphIdentities.ownerUserId, input.userId),
      sql`"deleted_at" IS NULL`,
    ),
  })
  if (existing) return existing

  const base =
    sanitizeHandle((input.email ?? '').split('@')[0] || `user_${input.userId.slice(-8)}`) ||
    `user_${input.userId.slice(-8)}`

  let lastError: unknown = null
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const handle = attempt === 0 ? base : `${base}_${randomHandleSuffix()}`.slice(0, 140)
    try {
      const [created] = await db
        .insert(graphIdentities)
        .values({
          ownerType: 'user',
          ownerUserId: input.userId,
          handle,
          displayName: input.email ?? `User ${input.userId.slice(-6)}`,
          status: 'active',
          isDiscoverable: true,
          metadata: { source: 'subject-events-api' },
        })
        .returning()
      if (created) return created
    } catch (error) {
      lastError = error
    }
  }

  const afterConflict = await db.query.graphIdentities.findFirst({
    where: and(
      eq(graphIdentities.ownerType, 'user'),
      eq(graphIdentities.ownerUserId, input.userId),
      sql`"deleted_at" IS NULL`,
    ),
  })
  if (afterConflict) return afterConflict

  throw lastError instanceof Error
    ? lastError
    : new Error('Could not create or resolve graph identity for user.')
}

const listEventsQuerySchema = z.object({
  page: z.string().optional(),
  perPage: z.string().optional(),
  subjectType: z.string().optional(),
  subjectId: z.string().optional(),
  eventType: z.string().optional(),
  actorIdentityId: z.string().optional(),
  correlationKey: z.string().optional(),
  requestKey: z.string().optional(),
})

const createEventBodySchema = z.object({
  subjectType: z.string().min(1).max(80),
  subjectId: z.string().min(1).max(140),
  eventType: z.string().min(1).max(100),
  actorIdentityId: z.string().optional().nullable(),
  happenedAt: z.string().datetime().optional().nullable(),
  priority: z.number().int().min(0).default(100),
  requestKey: z.string().max(140).optional().nullable(),
  correlationKey: z.string().max(200).optional().nullable(),
  payload: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
  autoRegisterSubject: z.boolean().default(true),
  targetDisplayName: z.string().max(240).optional(),
  targetCategory: z.string().max(80).optional(),
})

const listDeliveriesQuerySchema = z.object({
  page: z.string().optional(),
  perPage: z.string().optional(),
  subjectEventId: z.string().optional(),
  subscriptionId: z.string().optional(),
  channel: z.string().optional(),
  state: z.string().optional(),
})

const createDeliveryBodySchema = z.object({
  subjectEventId: z.string().min(1),
  subscriptionId: z.string().min(1),
  endpointId: z.string().optional().nullable(),
  channel: z.string().min(1).max(40),
  state: z.string().min(1).max(40).default('queued'),
  queuedAt: z.string().datetime().optional().nullable(),
  attemptedAt: z.string().datetime().optional().nullable(),
  deliveredAt: z.string().datetime().optional().nullable(),
  seenAt: z.string().datetime().optional().nullable(),
  failedAt: z.string().datetime().optional().nullable(),
  attemptCount: z.number().int().min(0).default(0),
  failureReason: z.string().max(1000).optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
})

const updateDeliveryBodySchema = createDeliveryBodySchema.partial().omit({
  subjectEventId: true,
  subscriptionId: true,
  channel: true,
})

export const subjectEventRoutes = new Hono()

subjectEventRoutes.get(
  '/bizes/:bizId/subject-events',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = listEventsQuerySchema.safeParse(c.req.query())
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid query parameters.', 400, parsed.error.flatten())
    }

    const page = parsePositiveInt(parsed.data.page, 1)
    const perPage = Math.min(parsePositiveInt(parsed.data.perPage, 20), 100)
    const where = and(
      eq(graphSubjectEvents.bizId, bizId),
      parsed.data.subjectType ? eq(graphSubjectEvents.subjectType, parsed.data.subjectType) : undefined,
      parsed.data.subjectId ? eq(graphSubjectEvents.subjectId, parsed.data.subjectId) : undefined,
      parsed.data.eventType ? eq(graphSubjectEvents.eventType, parsed.data.eventType) : undefined,
      parsed.data.actorIdentityId ? eq(graphSubjectEvents.actorIdentityId, parsed.data.actorIdentityId) : undefined,
      parsed.data.correlationKey ? eq(graphSubjectEvents.correlationKey, parsed.data.correlationKey) : undefined,
      parsed.data.requestKey ? eq(graphSubjectEvents.requestKey, parsed.data.requestKey) : undefined,
    )

    const [rows, countRows] = await Promise.all([
      db.query.graphSubjectEvents.findMany({
        where,
        orderBy: [desc(graphSubjectEvents.happenedAt), desc(graphSubjectEvents.id)],
        limit: perPage,
        offset: (page - 1) * perPage,
      }),
      db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(graphSubjectEvents).where(where),
    ])

    const total = countRows[0]?.count ?? 0
    return ok(c, rows, 200, {
      pagination: { page, perPage, total, hasMore: page * perPage < total },
    })
  },
)

subjectEventRoutes.post(
  '/bizes/:bizId/subject-events',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const user = getCurrentUser(c)
    if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)
    const parsed = createEventBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    }

    if (parsed.data.autoRegisterSubject) {
      const existing = await db.query.subjects.findFirst({
        where: and(
          eq(subjects.bizId, bizId),
          eq(subjects.subjectType, parsed.data.subjectType),
          eq(subjects.subjectId, parsed.data.subjectId),
          sql`"deleted_at" IS NULL`,
        ),
      })
      if (!existing) {
        await db.insert(subjects).values({
          bizId,
          subjectType: parsed.data.subjectType,
          subjectId: parsed.data.subjectId,
          displayName:
            parsed.data.targetDisplayName ??
            `${parsed.data.subjectType}:${parsed.data.subjectId.slice(-8)}`,
          category: parsed.data.targetCategory ?? 'custom',
          status: 'active',
          metadata: {
            source: 'subject-events-api',
          },
        })
      }
    }

    const actorIdentityId =
      parsed.data.actorIdentityId ??
      (await ensureUserGraphIdentity({ userId: user.id, email: user.email })).id

    if (parsed.data.requestKey) {
      const existingByRequestKey = await db.query.graphSubjectEvents.findFirst({
        where: and(
          eq(graphSubjectEvents.bizId, bizId),
          eq(graphSubjectEvents.requestKey, parsed.data.requestKey),
          sql`"deleted_at" IS NULL`,
        ),
      })
      if (existingByRequestKey) {
        return ok(c, existingByRequestKey, 200)
      }
    }

    const [created] = await db
      .insert(graphSubjectEvents)
      .values({
        bizId,
        subjectType: parsed.data.subjectType,
        subjectId: parsed.data.subjectId,
        eventType: parsed.data.eventType,
        actorIdentityId,
        happenedAt: parsed.data.happenedAt ? new Date(parsed.data.happenedAt) : new Date(),
        priority: parsed.data.priority,
        requestKey: parsed.data.requestKey ?? null,
        correlationKey: parsed.data.correlationKey ?? null,
        payload: parsed.data.payload ?? {},
        metadata: parsed.data.metadata ?? {},
      })
      .returning()

    return ok(c, created, 201)
  },
)

subjectEventRoutes.get(
  '/bizes/:bizId/subject-events/:subjectEventId',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, subjectEventId } = c.req.param()
    const row = await db.query.graphSubjectEvents.findFirst({
      where: and(eq(graphSubjectEvents.bizId, bizId), eq(graphSubjectEvents.id, subjectEventId)),
    })
    if (!row) return fail(c, 'NOT_FOUND', 'Subject event not found.', 404)
    return ok(c, row)
  },
)

subjectEventRoutes.get(
  '/bizes/:bizId/subject-event-deliveries',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = listDeliveriesQuerySchema.safeParse(c.req.query())
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid query parameters.', 400, parsed.error.flatten())
    }

    const page = parsePositiveInt(parsed.data.page, 1)
    const perPage = Math.min(parsePositiveInt(parsed.data.perPage, 20), 100)
    const where = and(
      eq(graphSubjectEventDeliveries.bizId, bizId),
      parsed.data.subjectEventId ? eq(graphSubjectEventDeliveries.subjectEventId, parsed.data.subjectEventId) : undefined,
      parsed.data.subscriptionId ? eq(graphSubjectEventDeliveries.subscriptionId, parsed.data.subscriptionId) : undefined,
      parsed.data.channel ? eq(graphSubjectEventDeliveries.channel, parsed.data.channel) : undefined,
      parsed.data.state ? eq(graphSubjectEventDeliveries.state, parsed.data.state) : undefined,
      sql`"deleted_at" IS NULL`,
    )

    const [rows, countRows] = await Promise.all([
      db.query.graphSubjectEventDeliveries.findMany({
        where,
        orderBy: [desc(graphSubjectEventDeliveries.queuedAt), desc(graphSubjectEventDeliveries.id)],
        limit: perPage,
        offset: (page - 1) * perPage,
      }),
      db
        .select({ count: sql<number>`count(*)`.mapWith(Number) })
        .from(graphSubjectEventDeliveries)
        .where(where),
    ])

    const total = countRows[0]?.count ?? 0
    return ok(c, rows, 200, {
      pagination: { page, perPage, total, hasMore: page * perPage < total },
    })
  },
)

subjectEventRoutes.post(
  '/bizes/:bizId/subject-event-deliveries',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const user = getCurrentUser(c)
    if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)
    const parsed = createDeliveryBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    }

    const [eventRow, subscriptionRow] = await Promise.all([
      db.query.graphSubjectEvents.findFirst({
        where: and(eq(graphSubjectEvents.bizId, bizId), eq(graphSubjectEvents.id, parsed.data.subjectEventId)),
      }),
      db.query.graphSubjectSubscriptions.findFirst({
        where: and(eq(graphSubjectSubscriptions.targetSubjectBizId, bizId), eq(graphSubjectSubscriptions.id, parsed.data.subscriptionId)),
      }),
    ])
    if (!eventRow) return fail(c, 'NOT_FOUND', 'Subject event not found.', 404)
    if (!subscriptionRow) return fail(c, 'NOT_FOUND', 'Subject subscription not found.', 404)

    if (parsed.data.endpointId) {
      const endpoint = await db.query.graphIdentityNotificationEndpoints.findFirst({
        where: and(
          eq(graphIdentityNotificationEndpoints.id, parsed.data.endpointId),
          eq(graphIdentityNotificationEndpoints.ownerIdentityId, subscriptionRow.subscriberIdentityId),
          sql`"deleted_at" IS NULL`,
        ),
      })
      if (!endpoint) {
        return fail(c, 'VALIDATION_ERROR', 'Endpoint must belong to the subscriber identity.', 400)
      }
    }

    const [created] = await db
      .insert(graphSubjectEventDeliveries)
      .values({
        bizId,
        subjectEventId: parsed.data.subjectEventId,
        subscriptionId: parsed.data.subscriptionId,
        subscriberIdentityId: subscriptionRow.subscriberIdentityId,
        endpointId: parsed.data.endpointId ?? null,
        channel: parsed.data.channel,
        state: parsed.data.state,
        queuedAt: parsed.data.queuedAt ? new Date(parsed.data.queuedAt) : new Date(),
        attemptedAt: parsed.data.attemptedAt ? new Date(parsed.data.attemptedAt) : null,
        deliveredAt: parsed.data.deliveredAt ? new Date(parsed.data.deliveredAt) : null,
        seenAt: parsed.data.seenAt ? new Date(parsed.data.seenAt) : null,
        failedAt: parsed.data.failedAt ? new Date(parsed.data.failedAt) : null,
        attemptCount: parsed.data.attemptCount,
        failureReason: parsed.data.failureReason ?? null,
        metadata: parsed.data.metadata ?? {},
      })
      .returning()

    return ok(c, created, 201)
  },
)

subjectEventRoutes.patch(
  '/bizes/:bizId/subject-event-deliveries/:deliveryId',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, deliveryId } = c.req.param()
    const user = getCurrentUser(c)
    if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)
    const parsed = updateDeliveryBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    }

    const existing = await db.query.graphSubjectEventDeliveries.findFirst({
      where: and(eq(graphSubjectEventDeliveries.bizId, bizId), eq(graphSubjectEventDeliveries.id, deliveryId)),
    })
    if (!existing) return fail(c, 'NOT_FOUND', 'Subject delivery not found.', 404)

    if (parsed.data.endpointId) {
      const endpoint = await db.query.graphIdentityNotificationEndpoints.findFirst({
        where: and(
          eq(graphIdentityNotificationEndpoints.id, parsed.data.endpointId),
          eq(graphIdentityNotificationEndpoints.ownerIdentityId, existing.subscriberIdentityId),
          sql`"deleted_at" IS NULL`,
        ),
      })
      if (!endpoint) {
        return fail(c, 'VALIDATION_ERROR', 'Endpoint must belong to the subscriber identity.', 400)
      }
    }

    const [updated] = await db
      .update(graphSubjectEventDeliveries)
      .set({
        endpointId: parsed.data.endpointId === undefined ? existing.endpointId : parsed.data.endpointId,
        state: parsed.data.state ?? existing.state,
        attemptedAt:
          parsed.data.attemptedAt === undefined
            ? existing.attemptedAt
            : parsed.data.attemptedAt
              ? new Date(parsed.data.attemptedAt)
              : null,
        deliveredAt:
          parsed.data.deliveredAt === undefined
            ? existing.deliveredAt
            : parsed.data.deliveredAt
              ? new Date(parsed.data.deliveredAt)
              : null,
        seenAt:
          parsed.data.seenAt === undefined
            ? existing.seenAt
            : parsed.data.seenAt
              ? new Date(parsed.data.seenAt)
              : null,
        failedAt:
          parsed.data.failedAt === undefined
            ? existing.failedAt
            : parsed.data.failedAt
              ? new Date(parsed.data.failedAt)
              : null,
        attemptCount: parsed.data.attemptCount ?? existing.attemptCount,
        failureReason:
          parsed.data.failureReason === undefined ? existing.failureReason : parsed.data.failureReason,
        metadata: parsed.data.metadata === undefined ? existing.metadata : parsed.data.metadata,
      })
      .where(and(eq(graphSubjectEventDeliveries.bizId, bizId), eq(graphSubjectEventDeliveries.id, deliveryId)))
      .returning()

    return ok(c, updated)
  },
)
