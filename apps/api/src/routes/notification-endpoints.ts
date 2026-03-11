/**
 * Notification endpoint routes.
 *
 * ELI5:
 * A "notification endpoint" is one place where a user can be reached.
 * Examples:
 * - in-app inbox,
 * - email address,
 * - phone number for SMS,
 * - push token,
 * - webhook destination.
 *
 * Why this route exists:
 * - the schema already has a first-class endpoint registry,
 * - subscription and event-delivery flows need a real API surface,
 * - sagas should prove endpoint ownership/defaulting/lifecycle behavior
 *   through HTTP, not by reading tables directly.
 */

import { Hono } from 'hono'
import { and, desc, eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import dbPackage from '@bizing/db'
import { getCurrentUser, requireAuth } from '../middleware/auth.js'
import { ensureBizMembership } from '../services/sagas.js'
import { executeCrudRouteAction } from '../services/action-route-bridge.js'
import { fail, ok, parsePositiveInt } from './_api.js'

const { db, graphIdentities, graphIdentityNotificationEndpoints } = dbPackage

function isKnownOrCustom(value: string, known: readonly string[]) {
  return known.includes(value) || value.startsWith('custom_')
}

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

async function createNotificationRow(
  c: Parameters<typeof executeCrudRouteAction>[0]['c'],
  bizId: string | null,
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

async function updateNotificationRow(
  c: Parameters<typeof executeCrudRouteAction>[0]['c'],
  bizId: string | null,
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

async function ensureUserGraphIdentity(input: {
  c: Parameters<typeof executeCrudRouteAction>[0]['c']
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
      const created = await createNotificationRow(input.c, null, 'graphIdentities', {
          ownerType: 'user',
          ownerUserId: input.userId,
          handle,
          displayName: input.email ?? `User ${input.userId.slice(-6)}`,
          status: 'active',
          isDiscoverable: true,
          metadata: { source: 'notification-endpoints-api' },
        }, {
        subjectType: 'graph_identity',
        displayName: handle,
      })
      if (created instanceof Response) throw new Error('Failed to create graph identity.')
      if (created) return created as GraphIdentityRow
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

const listQuerySchema = z.object({
  page: z.string().optional(),
  perPage: z.string().optional(),
  bizId: z.string().optional(),
  channel: z.enum(['in_app', 'email', 'sms', 'push', 'webhook']).optional(),
  status: z.enum(['draft', 'active', 'inactive', 'archived']).optional(),
})

const createBodySchema = z.object({
  bizId: z.string().optional().nullable(),
  channel: z.enum(['in_app', 'email', 'sms', 'push', 'webhook']).default('in_app'),
  destination: z.string().max(500).optional().nullable(),
  status: z.enum(['draft', 'active', 'inactive', 'archived']).default('active'),
  isDefault: z.boolean().default(false),
  verifiedAt: z.string().datetime().optional().nullable(),
  lastUsedAt: z.string().datetime().optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
})

const updateBodySchema = createBodySchema.partial()

export const notificationEndpointRoutes = new Hono()

notificationEndpointRoutes.get('/users/me/notification-endpoints', requireAuth, async (c) => {
  const user = getCurrentUser(c)
  if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)

  const parsed = listQuerySchema.safeParse(c.req.query())
  if (!parsed.success) {
    return fail(c, 'VALIDATION_ERROR', 'Invalid query parameters.', 400, parsed.error.flatten())
  }

  if (parsed.data.bizId) {
    const membership = await ensureBizMembership(user.id, parsed.data.bizId)
    if (!membership) return fail(c, 'FORBIDDEN', 'You are not a member of this biz.', 403)
  }

  const identity = await ensureUserGraphIdentity({ c, userId: user.id, email: user.email })
  const page = parsePositiveInt(parsed.data.page, 1)
  const perPage = Math.min(parsePositiveInt(parsed.data.perPage, 20), 100)
  const where = and(
    eq(graphIdentityNotificationEndpoints.ownerIdentityId, identity.id),
    sql`"deleted_at" IS NULL`,
    parsed.data.bizId ? eq(graphIdentityNotificationEndpoints.bizId, parsed.data.bizId) : undefined,
    parsed.data.channel ? eq(graphIdentityNotificationEndpoints.channel, parsed.data.channel) : undefined,
    parsed.data.status ? eq(graphIdentityNotificationEndpoints.status, parsed.data.status) : undefined,
  )

  const [rows, countRows] = await Promise.all([
    db.query.graphIdentityNotificationEndpoints.findMany({
      where,
      orderBy: [desc(graphIdentityNotificationEndpoints.isDefault), desc(graphIdentityNotificationEndpoints.id)],
      limit: perPage,
      offset: (page - 1) * perPage,
    }),
    db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(graphIdentityNotificationEndpoints)
      .where(where),
  ])

  const total = countRows[0]?.count ?? 0
  return ok(c, rows, 200, {
    pagination: {
      page,
      perPage,
      total,
      hasMore: page * perPage < total,
    },
  })
})

notificationEndpointRoutes.post('/users/me/notification-endpoints', requireAuth, async (c) => {
  const user = getCurrentUser(c)
  if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)

  const parsed = createBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) {
    return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  }

  if (!isKnownOrCustom(parsed.data.channel, ['in_app', 'email', 'sms', 'push', 'webhook'])) {
    return fail(c, 'VALIDATION_ERROR', 'Unsupported channel.', 400)
  }
  if (!isKnownOrCustom(parsed.data.status, ['draft', 'active', 'inactive', 'archived'])) {
    return fail(c, 'VALIDATION_ERROR', 'Unsupported status.', 400)
  }

  const bizId = parsed.data.bizId ?? null
  if (bizId) {
    const membership = await ensureBizMembership(user.id, bizId)
    if (!membership) return fail(c, 'FORBIDDEN', 'You are not a member of this biz.', 403)
  }

  if (parsed.data.channel === 'in_app' && parsed.data.destination) {
    return fail(c, 'VALIDATION_ERROR', 'In-app endpoints must not have a destination.', 400)
  }
  if (parsed.data.channel !== 'in_app' && !parsed.data.destination) {
    return fail(c, 'VALIDATION_ERROR', 'Destination is required for non in-app endpoints.', 400)
  }

  const identity = await ensureUserGraphIdentity({ c, userId: user.id, email: user.email })
  if (parsed.data.destination != null) {
    const existing = await db.query.graphIdentityNotificationEndpoints.findFirst({
      where: and(
        eq(graphIdentityNotificationEndpoints.ownerIdentityId, identity.id),
        eq(graphIdentityNotificationEndpoints.channel, parsed.data.channel),
        eq(graphIdentityNotificationEndpoints.destination, parsed.data.destination),
        sql`"deleted_at" IS NULL`,
      ),
    })
    if (existing) {
      return ok(c, existing)
    }
  }

  if (parsed.data.isDefault) {
    const existingDefaults = await db.query.graphIdentityNotificationEndpoints.findMany({
      where: and(
        eq(graphIdentityNotificationEndpoints.ownerIdentityId, identity.id),
        eq(graphIdentityNotificationEndpoints.channel, parsed.data.channel),
        sql`"deleted_at" IS NULL`,
      ),
    })
    for (const existing of existingDefaults) {
      const unset = await updateNotificationRow(c, existing.bizId ?? null, 'graphIdentityNotificationEndpoints', existing.id, {
        isDefault: false,
      }, {
        subjectType: 'notification_endpoint',
        displayName: existing.channel,
      })
      if (unset instanceof Response) return unset
    }
  }

  const created = await createNotificationRow(c, bizId, 'graphIdentityNotificationEndpoints', {
      ownerIdentityId: identity.id,
      bizId,
      channel: parsed.data.channel,
      destination: parsed.data.destination ?? null,
      status: parsed.data.status,
      isDefault: parsed.data.isDefault,
      verifiedAt: parsed.data.verifiedAt ? new Date(parsed.data.verifiedAt) : null,
      lastUsedAt: parsed.data.lastUsedAt ? new Date(parsed.data.lastUsedAt) : null,
      metadata: parsed.data.metadata ?? {},
    }, {
    subjectType: 'notification_endpoint',
    displayName: parsed.data.channel,
  })
  if (created instanceof Response) return created

  return ok(c, created, 201)
})

notificationEndpointRoutes.patch('/users/me/notification-endpoints/:endpointId', requireAuth, async (c) => {
  const user = getCurrentUser(c)
  if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)

  const parsed = updateBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) {
    return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  }

  const identity = await ensureUserGraphIdentity({ c, userId: user.id, email: user.email })
  const endpointId = c.req.param('endpointId')
  const existing = await db.query.graphIdentityNotificationEndpoints.findFirst({
    where: and(
      eq(graphIdentityNotificationEndpoints.id, endpointId),
      eq(graphIdentityNotificationEndpoints.ownerIdentityId, identity.id),
      sql`"deleted_at" IS NULL`,
    ),
  })
  if (!existing) return fail(c, 'NOT_FOUND', 'Notification endpoint not found.', 404)

  const nextBizId = parsed.data.bizId === undefined ? existing.bizId : parsed.data.bizId
  if (nextBizId) {
    const membership = await ensureBizMembership(user.id, nextBizId)
    if (!membership) return fail(c, 'FORBIDDEN', 'You are not a member of this biz.', 403)
  }

  const nextChannel = parsed.data.channel ?? existing.channel
  const nextStatus = parsed.data.status ?? existing.status
  const nextDestination =
    parsed.data.destination === undefined ? existing.destination : parsed.data.destination

  if (!isKnownOrCustom(nextChannel, ['in_app', 'email', 'sms', 'push', 'webhook'])) {
    return fail(c, 'VALIDATION_ERROR', 'Unsupported channel.', 400)
  }
  if (!isKnownOrCustom(nextStatus, ['draft', 'active', 'inactive', 'archived'])) {
    return fail(c, 'VALIDATION_ERROR', 'Unsupported status.', 400)
  }
  if (nextChannel === 'in_app' && nextDestination) {
    return fail(c, 'VALIDATION_ERROR', 'In-app endpoints must not have a destination.', 400)
  }
  if (nextChannel !== 'in_app' && !nextDestination) {
    return fail(c, 'VALIDATION_ERROR', 'Destination is required for non in-app endpoints.', 400)
  }

  const nextIsDefault = parsed.data.isDefault ?? existing.isDefault
  if (nextIsDefault) {
    const existingDefaults = await db.query.graphIdentityNotificationEndpoints.findMany({
      where: and(
        eq(graphIdentityNotificationEndpoints.ownerIdentityId, identity.id),
        eq(graphIdentityNotificationEndpoints.channel, nextChannel),
        sql`"deleted_at" IS NULL`,
        sql`"id" <> ${endpointId}`,
      ),
    })
    for (const defaultRow of existingDefaults) {
      const unset = await updateNotificationRow(c, defaultRow.bizId ?? null, 'graphIdentityNotificationEndpoints', defaultRow.id, {
        isDefault: false,
      }, {
        subjectType: 'notification_endpoint',
        displayName: defaultRow.channel,
      })
      if (unset instanceof Response) return unset
    }
  }

  const updated = await updateNotificationRow(c, nextBizId ?? null, 'graphIdentityNotificationEndpoints', endpointId, {
      bizId: nextBizId ?? null,
      channel: nextChannel,
      destination: nextDestination ?? null,
      status: nextStatus,
      isDefault: nextIsDefault,
      verifiedAt:
        parsed.data.verifiedAt === undefined
          ? existing.verifiedAt
          : parsed.data.verifiedAt
            ? new Date(parsed.data.verifiedAt)
            : null,
      lastUsedAt:
        parsed.data.lastUsedAt === undefined
          ? existing.lastUsedAt
          : parsed.data.lastUsedAt
            ? new Date(parsed.data.lastUsedAt)
            : null,
      metadata: parsed.data.metadata === undefined ? existing.metadata : parsed.data.metadata,
    }, {
    subjectType: 'notification_endpoint',
    displayName: nextChannel,
  })
  if (updated instanceof Response) return updated

  return ok(c, updated)
})
