/**
 * Lifecycle event + webhook delivery routes.
 *
 * ELI5:
 * A lifecycle event is the "something happened" fact.
 * A lifecycle-event subscription is the "tell me when that happens" rule.
 * A delivery row is one concrete attempt/result of sending that event to one listener.
 *
 * Why this route exists:
 * - webhook-heavy use cases need a canonical API surface,
 * - retry/debug dashboards need explicit delivery rows,
 * - sagas should validate hook behavior through normal endpoints.
 */

import { Hono } from 'hono'
import { and, asc, desc, eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import dbPackage from '@bizing/db'
import { requireAclPermission, requireAuth, requireBizAccess } from '../middleware/auth.js'
import { executeCrudRouteAction } from '../services/action-route-bridge.js'
import {
  getLifecycleDeliveryWorkerHealth,
  processLifecycleDeliveryQueueAcrossBizes,
  processLifecycleDeliveryQueueForBiz,
} from '../services/lifecycle-delivery-worker.js'
import { sanitizePlainText, sanitizeUnknown } from '../lib/sanitize.js'
import { fail, ok, parsePositiveInt } from './_api.js'

const {
  db,
  domainEvents,
  lifecycleEventSubscriptions,
  lifecycleEventDeliveries,
} = dbPackage

function pagination(input: { page?: string; perPage?: string }) {
  const page = parsePositiveInt(input.page, 1)
  const perPage = Math.min(parsePositiveInt(input.perPage, 20), 100)
  return { page, perPage, offset: (page - 1) * perPage }
}

function cleanMetadata(value: Record<string, unknown> | undefined) {
  return sanitizeUnknown(value ?? {}) as Record<string, unknown>
}

function toLegacyLifecycleEventShape(row: {
  eventKey: string
  subjectType: string
  subjectId: string
  eventFamily: string
  actorType: string | null
  causationId: string | null
  metadata: unknown
}) {
  const metadata = (row.metadata ?? {}) as Record<string, unknown>
  return {
    ...row,
    eventName: row.eventKey,
    entityType: row.subjectType,
    entityId: row.subjectId,
    sourceType: row.actorType ?? row.eventFamily,
    eventVersion: Number(metadata.eventVersion ?? 1),
    aggregateType: (metadata.aggregateType as string | undefined) ?? null,
    aggregateId: (metadata.aggregateId as string | undefined) ?? null,
    causationEventId: row.causationId ?? null,
    idempotencyKey: (metadata.idempotencyKey as string | undefined) ?? null,
  }
}

const listEventQuerySchema = z.object({
  page: z.string().optional(),
  perPage: z.string().optional(),
  eventName: z.string().optional(),
  entityType: z.string().optional(),
  entityId: z.string().optional(),
})

const createEventBodySchema = z.object({
  sourceType: z.enum(['api', 'system', 'workflow', 'integration', 'manual', 'migration']),
  eventName: z.string().min(1).max(200),
  eventVersion: z.number().int().positive().default(1),
  entityType: z.string().min(1).max(120),
  entityId: z.string().min(1).max(140),
  aggregateType: z.string().max(120).optional().nullable(),
  aggregateId: z.string().max(140).optional().nullable(),
  occurredAt: z.string().datetime().optional().nullable(),
  actorUserId: z.string().optional().nullable(),
  correlationId: z.string().max(200).optional().nullable(),
  causationEventId: z.string().optional().nullable(),
  idempotencyKey: z.string().max(200).optional().nullable(),
  payload: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
})

const lifecycleStatusSchema = z.enum(['draft', 'active', 'inactive', 'archived'])

const listSubscriptionQuerySchema = z.object({
  page: z.string().optional(),
  perPage: z.string().optional(),
  status: lifecycleStatusSchema.optional(),
  deliveryMode: z.enum(['internal_handler', 'webhook']).optional(),
  eventPattern: z.string().optional(),
})

const subscriptionBodyBaseSchema = z.object({
  bizExtensionInstallId: z.string().optional().nullable(),
  name: z.string().min(1).max(200),
  status: lifecycleStatusSchema.default('active'),
  eventPattern: z.string().min(1).max(200),
  phase: z.enum(['before', 'after']).default('after'),
  deliveryMode: z.enum(['internal_handler', 'webhook']),
  internalHandlerKey: z.string().max(200).optional().nullable(),
  webhookUrl: z.string().url().max(1000).optional().nullable(),
  signingSecretRef: z.string().max(255).optional().nullable(),
  timeoutMs: z.number().int().min(100).max(300000).default(10000),
  maxAttempts: z.number().int().min(1).max(100).default(8),
  retryPolicy: z.record(z.unknown()).optional(),
  filter: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
})

const createSubscriptionBodySchema = subscriptionBodyBaseSchema.superRefine((value, ctx) => {
  if (value.deliveryMode === 'internal_handler' && !value.internalHandlerKey) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'internalHandlerKey is required for internal_handler mode.' })
  }
  if (value.deliveryMode === 'webhook' && !value.webhookUrl) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'webhookUrl is required for webhook mode.' })
  }
})

const updateSubscriptionBodySchema = subscriptionBodyBaseSchema.partial()

const outboxStatusSchema = z.enum(['pending', 'processing', 'published', 'failed', 'dead_letter'])

const listDeliveryQuerySchema = z.object({
  page: z.string().optional(),
  perPage: z.string().optional(),
  lifecycleEventId: z.string().optional(),
  lifecycleEventSubscriptionId: z.string().optional(),
  status: outboxStatusSchema.optional(),
})

const createDeliveryBodySchema = z.object({
  lifecycleEventId: z.string().min(1),
  lifecycleEventSubscriptionId: z.string().min(1),
  status: outboxStatusSchema.default('pending'),
  attemptCount: z.number().int().min(0).default(0),
  nextAttemptAt: z.string().datetime().optional().nullable(),
  lockedAt: z.string().datetime().optional().nullable(),
  publishedAt: z.string().datetime().optional().nullable(),
  deadLetteredAt: z.string().datetime().optional().nullable(),
  httpStatus: z.number().int().min(100).max(599).optional().nullable(),
  lastErrorCode: z.string().max(120).optional().nullable(),
  lastErrorMessage: z.string().max(2000).optional().nullable(),
  requestPayload: z.record(z.unknown()).optional(),
  responsePayload: z.record(z.unknown()).optional(),
  idempotencyKey: z.string().max(200).optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
})

const updateDeliveryBodySchema = createDeliveryBodySchema.partial()
const processDeliveriesBodySchema = z.object({
  limit: z.number().int().min(1).max(500).optional(),
})

const testSubscriptionBodySchema = z.object({
  eventName: z.string().min(1).max(200).default('test.event'),
  entityType: z.string().min(1).max(120).default('test_entity'),
  entityId: z.string().min(1).max(140).default('test'),
  simulateStatus: outboxStatusSchema.default('published'),
  requestPayload: z.record(z.unknown()).optional(),
  responsePayload: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
})

export const lifecycleHookRoutes = new Hono()

async function createLifecycleHookRow<T extends Record<string, unknown>>(input: {
  c: Parameters<typeof fail>[0]
  bizId: string
  tableKey: string
  subjectType: string
  data: Record<string, unknown>
  displayName?: string
}) {
  const delegated = await executeCrudRouteAction({
    c: input.c,
    bizId: input.bizId,
    tableKey: input.tableKey,
    operation: 'create',
    subjectType: input.subjectType,
    displayName: input.displayName,
    data: input.data,
    metadata: { routeFamily: 'lifecycle-hooks' },
  })
  if (!delegated.ok) return fail(input.c, delegated.code, delegated.message, delegated.httpStatus, delegated.details)
  return delegated.row as T
}

async function updateLifecycleHookRow<T extends Record<string, unknown>>(input: {
  c: Parameters<typeof fail>[0]
  bizId: string
  tableKey: string
  subjectType: string
  id: string
  patch: Record<string, unknown>
  notFoundMessage: string
}) {
  const delegated = await executeCrudRouteAction({
    c: input.c,
    bizId: input.bizId,
    tableKey: input.tableKey,
    operation: 'update',
    id: input.id,
    subjectType: input.subjectType,
    subjectId: input.id,
    patch: input.patch,
    metadata: { routeFamily: 'lifecycle-hooks' },
  })
  if (!delegated.ok) {
    if (delegated.code === 'CRUD_TARGET_NOT_FOUND') return fail(input.c, 'NOT_FOUND', input.notFoundMessage, 404)
    return fail(input.c, delegated.code, delegated.message, delegated.httpStatus, delegated.details)
  }
  if (!delegated.row) return fail(input.c, 'NOT_FOUND', input.notFoundMessage, 404)
  return delegated.row as T
}

lifecycleHookRoutes.get(
  '/bizes/:bizId/lifecycle-events',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('events.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = listEventQuerySchema.safeParse(c.req.query())
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid query parameters.', 400, parsed.error.flatten())
    const pageInfo = pagination(parsed.data)
    const where = and(
      eq(domainEvents.bizId, bizId),
      parsed.data.eventName ? eq(domainEvents.eventKey, parsed.data.eventName) : undefined,
      parsed.data.entityType ? eq(domainEvents.subjectType, parsed.data.entityType) : undefined,
      parsed.data.entityId ? eq(domainEvents.subjectId, parsed.data.entityId) : undefined,
    )
    const [rows, countRows] = await Promise.all([
      db.query.domainEvents.findMany({
        where,
        orderBy: [desc(domainEvents.occurredAt)],
        limit: pageInfo.perPage,
        offset: pageInfo.offset,
      }),
      db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(domainEvents).where(where),
    ])
    return ok(c, rows.map(toLegacyLifecycleEventShape), 200, {
      pagination: {
        page: pageInfo.page,
        perPage: pageInfo.perPage,
        total: countRows[0]?.count ?? 0,
        hasMore: pageInfo.page * pageInfo.perPage < (countRows[0]?.count ?? 0),
      },
    })
  },
)

lifecycleHookRoutes.post(
  '/bizes/:bizId/lifecycle-events',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('events.write', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = createEventBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    const created = await createLifecycleHookRow<typeof domainEvents.$inferSelect>({
      c,
      bizId,
      tableKey: 'domainEvents',
      subjectType: 'domain_event',
      displayName: parsed.data.eventName,
      data: {
      bizId,
      eventKey: sanitizePlainText(parsed.data.eventName),
      eventFamily: sanitizePlainText(
        parsed.data.aggregateType ?? parsed.data.sourceType ?? parsed.data.eventName.split('.')[0] ?? 'general',
      ),
      subjectType: sanitizePlainText(parsed.data.entityType),
      subjectId: parsed.data.entityId,
      actorType: parsed.data.sourceType,
      occurredAt: parsed.data.occurredAt ? new Date(parsed.data.occurredAt) : new Date(),
      actorUserId: parsed.data.actorUserId ?? null,
      correlationId: parsed.data.correlationId ?? null,
      causationId: parsed.data.causationEventId ?? null,
      payload: cleanMetadata(parsed.data.payload),
      metadata: cleanMetadata({
        eventVersion: parsed.data.eventVersion,
        aggregateType: parsed.data.aggregateType ?? null,
        aggregateId: parsed.data.aggregateId ?? null,
        idempotencyKey: parsed.data.idempotencyKey ?? null,
        ...(parsed.data.metadata ?? {}),
      }),
      },
    })
    if (created instanceof Response) return created
    return ok(c, toLegacyLifecycleEventShape(created), 201)
  },
)

lifecycleHookRoutes.get(
  '/bizes/:bizId/lifecycle-event-subscriptions',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('events.write', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = listSubscriptionQuerySchema.safeParse(c.req.query())
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid query parameters.', 400, parsed.error.flatten())
    const pageInfo = pagination(parsed.data)
    const where = and(
      eq(lifecycleEventSubscriptions.bizId, bizId),
      parsed.data.status ? eq(lifecycleEventSubscriptions.status, parsed.data.status) : undefined,
      parsed.data.deliveryMode ? eq(lifecycleEventSubscriptions.deliveryMode, parsed.data.deliveryMode) : undefined,
      parsed.data.eventPattern ? eq(lifecycleEventSubscriptions.eventPattern, parsed.data.eventPattern) : undefined,
    )
    const [rows, countRows] = await Promise.all([
      db.query.lifecycleEventSubscriptions.findMany({
        where,
        orderBy: [asc(lifecycleEventSubscriptions.name)],
        limit: pageInfo.perPage,
        offset: pageInfo.offset,
      }),
      db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(lifecycleEventSubscriptions).where(where),
    ])
    return ok(c, rows, 200, {
      pagination: {
        page: pageInfo.page,
        perPage: pageInfo.perPage,
        total: countRows[0]?.count ?? 0,
        hasMore: pageInfo.page * pageInfo.perPage < (countRows[0]?.count ?? 0),
      },
    })
  },
)

lifecycleHookRoutes.post(
  '/bizes/:bizId/lifecycle-event-subscriptions',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('events.write', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = createSubscriptionBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    const created = await createLifecycleHookRow<typeof lifecycleEventSubscriptions.$inferSelect>({
      c,
      bizId,
      tableKey: 'lifecycleEventSubscriptions',
      subjectType: 'lifecycle_event_subscription',
      displayName: parsed.data.name,
      data: {
      bizId,
      bizExtensionInstallId: parsed.data.bizExtensionInstallId ?? null,
      name: sanitizePlainText(parsed.data.name),
      status: parsed.data.status,
      eventPattern: sanitizePlainText(parsed.data.eventPattern),
      phase: parsed.data.phase,
      deliveryMode: parsed.data.deliveryMode,
      internalHandlerKey: parsed.data.internalHandlerKey ?? null,
      webhookUrl: parsed.data.webhookUrl ?? null,
      signingSecretRef: parsed.data.signingSecretRef ?? null,
      timeoutMs: parsed.data.timeoutMs,
      maxAttempts: parsed.data.maxAttempts,
      retryPolicy: cleanMetadata(parsed.data.retryPolicy),
      filter: cleanMetadata(parsed.data.filter),
      metadata: cleanMetadata(parsed.data.metadata),
      },
    })
    if (created instanceof Response) return created
    return ok(c, created, 201)
  },
)

lifecycleHookRoutes.patch(
  '/bizes/:bizId/lifecycle-event-subscriptions/:subscriptionId',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('events.write', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const subscriptionId = c.req.param('subscriptionId')
    const parsed = updateSubscriptionBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    const existing = await db.query.lifecycleEventSubscriptions.findFirst({
      where: and(eq(lifecycleEventSubscriptions.bizId, bizId), eq(lifecycleEventSubscriptions.id, subscriptionId)),
    })
    if (!existing) return fail(c, 'NOT_FOUND', 'Lifecycle event subscription not found.', 404)
    const updated = await updateLifecycleHookRow<typeof lifecycleEventSubscriptions.$inferSelect>({
      c,
      bizId,
      tableKey: 'lifecycleEventSubscriptions',
      subjectType: 'lifecycle_event_subscription',
      id: subscriptionId,
      notFoundMessage: 'Lifecycle event subscription not found.',
      patch: {
      bizExtensionInstallId: parsed.data.bizExtensionInstallId === undefined ? existing.bizExtensionInstallId : (parsed.data.bizExtensionInstallId ?? null),
      name: parsed.data.name === undefined ? existing.name : sanitizePlainText(parsed.data.name),
      status: parsed.data.status ?? existing.status,
      eventPattern: parsed.data.eventPattern === undefined ? existing.eventPattern : sanitizePlainText(parsed.data.eventPattern),
      phase: parsed.data.phase ?? existing.phase,
      deliveryMode: parsed.data.deliveryMode ?? existing.deliveryMode,
      internalHandlerKey: parsed.data.internalHandlerKey === undefined ? existing.internalHandlerKey : (parsed.data.internalHandlerKey ?? null),
      webhookUrl: parsed.data.webhookUrl === undefined ? existing.webhookUrl : (parsed.data.webhookUrl ?? null),
      signingSecretRef: parsed.data.signingSecretRef === undefined ? existing.signingSecretRef : (parsed.data.signingSecretRef ?? null),
      timeoutMs: parsed.data.timeoutMs ?? existing.timeoutMs,
      maxAttempts: parsed.data.maxAttempts ?? existing.maxAttempts,
      retryPolicy: parsed.data.retryPolicy === undefined ? existing.retryPolicy : cleanMetadata(parsed.data.retryPolicy),
      filter: parsed.data.filter === undefined ? existing.filter : cleanMetadata(parsed.data.filter),
      metadata: parsed.data.metadata === undefined ? existing.metadata : cleanMetadata(parsed.data.metadata),
      },
    })
    if (updated instanceof Response) return updated
    return ok(c, updated)
  },
)

lifecycleHookRoutes.get(
  '/bizes/:bizId/lifecycle-event-deliveries',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('events.write', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = listDeliveryQuerySchema.safeParse(c.req.query())
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid query parameters.', 400, parsed.error.flatten())
    const pageInfo = pagination(parsed.data)
    const where = and(
      eq(lifecycleEventDeliveries.bizId, bizId),
      parsed.data.lifecycleEventId ? eq(lifecycleEventDeliveries.lifecycleEventId, parsed.data.lifecycleEventId) : undefined,
      parsed.data.lifecycleEventSubscriptionId ? eq(lifecycleEventDeliveries.lifecycleEventSubscriptionId, parsed.data.lifecycleEventSubscriptionId) : undefined,
      parsed.data.status ? eq(lifecycleEventDeliveries.status, parsed.data.status) : undefined,
    )
    const [rows, countRows] = await Promise.all([
      db.query.lifecycleEventDeliveries.findMany({
        where,
        orderBy: [desc(lifecycleEventDeliveries.nextAttemptAt)],
        limit: pageInfo.perPage,
        offset: pageInfo.offset,
      }),
      db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(lifecycleEventDeliveries).where(where),
    ])
    return ok(c, rows, 200, {
      pagination: {
        page: pageInfo.page,
        perPage: pageInfo.perPage,
        total: countRows[0]?.count ?? 0,
        hasMore: pageInfo.page * pageInfo.perPage < (countRows[0]?.count ?? 0),
      },
    })
  },
)

lifecycleHookRoutes.post(
  '/bizes/:bizId/lifecycle-event-deliveries',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('events.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = createDeliveryBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    const created = await createLifecycleHookRow<typeof lifecycleEventDeliveries.$inferSelect>({
      c,
      bizId,
      tableKey: 'lifecycleEventDeliveries',
      subjectType: 'lifecycle_event_delivery',
      displayName: parsed.data.lifecycleEventId,
      data: {
      bizId,
      lifecycleEventId: parsed.data.lifecycleEventId,
      lifecycleEventSubscriptionId: parsed.data.lifecycleEventSubscriptionId,
      status: parsed.data.status,
      attemptCount: parsed.data.attemptCount,
      nextAttemptAt: parsed.data.nextAttemptAt ? new Date(parsed.data.nextAttemptAt) : new Date(),
      lockedAt: parsed.data.lockedAt ? new Date(parsed.data.lockedAt) : null,
      publishedAt: parsed.data.publishedAt ? new Date(parsed.data.publishedAt) : null,
      deadLetteredAt: parsed.data.deadLetteredAt ? new Date(parsed.data.deadLetteredAt) : null,
      httpStatus: parsed.data.httpStatus ?? null,
      lastErrorCode: parsed.data.lastErrorCode ?? null,
      lastErrorMessage: parsed.data.lastErrorMessage ?? null,
      requestPayload: cleanMetadata(parsed.data.requestPayload),
      responsePayload: parsed.data.responsePayload ? cleanMetadata(parsed.data.responsePayload) : null,
      idempotencyKey: parsed.data.idempotencyKey ?? null,
      metadata: cleanMetadata(parsed.data.metadata),
      },
    })
    if (created instanceof Response) return created
    return ok(c, created, 201)
  },
)

lifecycleHookRoutes.patch(
  '/bizes/:bizId/lifecycle-event-deliveries/:deliveryId',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('events.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const deliveryId = c.req.param('deliveryId')
    const parsed = updateDeliveryBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    const existing = await db.query.lifecycleEventDeliveries.findFirst({
      where: and(eq(lifecycleEventDeliveries.bizId, bizId), eq(lifecycleEventDeliveries.id, deliveryId)),
    })
    if (!existing) return fail(c, 'NOT_FOUND', 'Lifecycle event delivery not found.', 404)
    const updated = await updateLifecycleHookRow<typeof lifecycleEventDeliveries.$inferSelect>({
      c,
      bizId,
      tableKey: 'lifecycleEventDeliveries',
      subjectType: 'lifecycle_event_delivery',
      id: deliveryId,
      notFoundMessage: 'Lifecycle event delivery not found.',
      patch: {
      lifecycleEventId: parsed.data.lifecycleEventId ?? existing.lifecycleEventId,
      lifecycleEventSubscriptionId: parsed.data.lifecycleEventSubscriptionId ?? existing.lifecycleEventSubscriptionId,
      status: parsed.data.status ?? existing.status,
      attemptCount: parsed.data.attemptCount ?? existing.attemptCount,
      nextAttemptAt: parsed.data.nextAttemptAt === undefined ? existing.nextAttemptAt : (parsed.data.nextAttemptAt ? new Date(parsed.data.nextAttemptAt) : existing.nextAttemptAt),
      lockedAt: parsed.data.lockedAt === undefined ? existing.lockedAt : (parsed.data.lockedAt ? new Date(parsed.data.lockedAt) : null),
      publishedAt: parsed.data.publishedAt === undefined ? existing.publishedAt : (parsed.data.publishedAt ? new Date(parsed.data.publishedAt) : null),
      deadLetteredAt: parsed.data.deadLetteredAt === undefined ? existing.deadLetteredAt : (parsed.data.deadLetteredAt ? new Date(parsed.data.deadLetteredAt) : null),
      httpStatus: parsed.data.httpStatus === undefined ? existing.httpStatus : parsed.data.httpStatus,
      lastErrorCode: parsed.data.lastErrorCode === undefined ? existing.lastErrorCode : parsed.data.lastErrorCode,
      lastErrorMessage: parsed.data.lastErrorMessage === undefined ? existing.lastErrorMessage : parsed.data.lastErrorMessage,
      requestPayload: parsed.data.requestPayload === undefined ? existing.requestPayload : cleanMetadata(parsed.data.requestPayload),
      responsePayload: parsed.data.responsePayload === undefined ? existing.responsePayload : cleanMetadata(parsed.data.responsePayload),
      idempotencyKey: parsed.data.idempotencyKey === undefined ? existing.idempotencyKey : parsed.data.idempotencyKey,
      metadata: parsed.data.metadata === undefined ? existing.metadata : cleanMetadata(parsed.data.metadata),
      },
    })
    if (updated instanceof Response) return updated
    return ok(c, updated)
  },
)

lifecycleHookRoutes.post(
  '/bizes/:bizId/lifecycle-event-subscriptions/:subscriptionId/test',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('events.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const subscriptionId = c.req.param('subscriptionId')
    const parsed = testSubscriptionBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())

    const subscription = await db.query.lifecycleEventSubscriptions.findFirst({
      where: and(eq(lifecycleEventSubscriptions.bizId, bizId), eq(lifecycleEventSubscriptions.id, subscriptionId)),
    })
    if (!subscription) return fail(c, 'NOT_FOUND', 'Lifecycle event subscription not found.', 404)

    const requestPayload = cleanMetadata(parsed.data.requestPayload)
    const event = await createLifecycleHookRow<typeof domainEvents.$inferSelect>({
      c,
      bizId,
      tableKey: 'domainEvents',
      subjectType: 'domain_event',
      displayName: parsed.data.eventName,
      data: {
      bizId,
      eventKey: sanitizePlainText(parsed.data.eventName),
      eventFamily: 'manual',
      subjectType: sanitizePlainText(parsed.data.entityType),
      subjectId: parsed.data.entityId,
      actorType: 'manual',
      payload: requestPayload,
      metadata: cleanMetadata({
        testMode: true,
        eventVersion: 1,
        generatedFromSubscriptionId: subscription.id,
        ...(parsed.data.metadata ?? {}),
      }),
      },
    })
    if (event instanceof Response) return event

    const attemptCount = parsed.data.simulateStatus === 'published' ? 1 : 0
    const now = new Date()
    const lifecycleEventId = typeof event.id === 'string' && event.id.length > 0 ? event.id : null
    if (!lifecycleEventId) {
      return fail(c, 'INTERNAL_ERROR', 'Lifecycle test event creation did not return a valid id.', 500, {
        event,
      })
    }

    const delivery = await createLifecycleHookRow<typeof lifecycleEventDeliveries.$inferSelect>({
      c,
      bizId,
      tableKey: 'lifecycleEventDeliveries',
      subjectType: 'lifecycle_event_delivery',
      displayName: subscription.name,
      data: {
      bizId,
      lifecycleEventId,
      lifecycleEventSubscriptionId: subscription.id,
      status: parsed.data.simulateStatus,
      attemptCount,
      nextAttemptAt: now,
      publishedAt: parsed.data.simulateStatus === 'published' ? now : null,
      deadLetteredAt: parsed.data.simulateStatus === 'dead_letter' ? now : null,
      httpStatus: parsed.data.simulateStatus === 'published' ? 200 : parsed.data.simulateStatus === 'failed' ? 500 : null,
      requestPayload: cleanMetadata(parsed.data.requestPayload),
      responsePayload: parsed.data.responsePayload ? cleanMetadata(parsed.data.responsePayload) : null,
      idempotencyKey: `test:${subscription.id}:${Date.now()}`,
      metadata: cleanMetadata({
        testMode: true,
        signingSecretRef: subscription.signingSecretRef,
        deliveryMode: subscription.deliveryMode,
        webhookUrl: subscription.webhookUrl,
        retryPolicy: subscription.retryPolicy,
        ...(parsed.data.metadata ?? {}),
      }),
      },
    })
    if (delivery instanceof Response) return delivery

    return ok(c, { event: toLegacyLifecycleEventShape(event), subscription, delivery }, 201)
  },
)

lifecycleHookRoutes.post(
  '/bizes/:bizId/lifecycle-event-deliveries/:deliveryId/retry',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('events.write', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const deliveryId = c.req.param('deliveryId')
    const existing = await db.query.lifecycleEventDeliveries.findFirst({
      where: and(eq(lifecycleEventDeliveries.bizId, bizId), eq(lifecycleEventDeliveries.id, deliveryId)),
    })
    if (!existing) return fail(c, 'NOT_FOUND', 'Lifecycle event delivery not found.', 404)

    const nextAttemptCount = (existing.attemptCount ?? 0) + 1
    const backoffMinutes = Math.max(1, 2 ** Math.max(0, nextAttemptCount - 1))
    const nextAttemptAt = new Date(Date.now() + backoffMinutes * 60 * 1000)
    const updated = await updateLifecycleHookRow<typeof lifecycleEventDeliveries.$inferSelect>({
      c,
      bizId,
      tableKey: 'lifecycleEventDeliveries',
      subjectType: 'lifecycle_event_delivery',
      id: deliveryId,
      notFoundMessage: 'Lifecycle event delivery not found.',
      patch: {
      status: 'pending',
      attemptCount: nextAttemptCount,
      nextAttemptAt,
      lockedAt: null,
      deadLetteredAt: null,
      lastErrorCode: null,
      lastErrorMessage: null,
      metadata: cleanMetadata({
        ...(existing.metadata as Record<string, unknown> | null ?? {}),
        manualRetryRequested: true,
        nextBackoffMinutes: backoffMinutes,
      }),
      },
    })
    if (updated instanceof Response) return updated

    return ok(c, {
      delivery: updated,
      backoffMinutes,
    })
  },
)

lifecycleHookRoutes.get(
  '/bizes/:bizId/lifecycle-event-deliveries/worker-health',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('events.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const health = getLifecycleDeliveryWorkerHealth()
    const due = await db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(lifecycleEventDeliveries)
      .where(
        and(
          eq(lifecycleEventDeliveries.bizId, bizId),
          eq(lifecycleEventDeliveries.status, 'pending'),
        ),
      )
    return ok(c, {
      ...health,
      bizId,
      pendingCount: due[0]?.count ?? 0,
    })
  },
)

lifecycleHookRoutes.post(
  '/bizes/:bizId/lifecycle-event-deliveries/process',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('events.write', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = processDeliveriesBodySchema.safeParse(await c.req.json().catch(() => ({})))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())

    const stats = await processLifecycleDeliveryQueueForBiz({
      bizId,
      limit: parsed.data.limit,
    })
    return ok(c, stats)
  },
)

lifecycleHookRoutes.post(
  '/lifecycle-event-deliveries/process-all',
  requireAuth,
  requireAclPermission('events.write'),
  async (c) => {
    const summary = await processLifecycleDeliveryQueueAcrossBizes()
    return ok(c, summary)
  },
)
