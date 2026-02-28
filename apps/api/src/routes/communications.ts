/**
 * Communications routes.
 *
 * ELI5:
 * This module answers three related questions:
 * 1. What messages did we send?
 * 2. Are we allowed to contact this person on this channel/purpose?
 * 3. When should we stay quiet unless the message is urgent?
 *
 * Keeping these as first-class routes matters because notification-heavy use
 * cases should be provable through the API, not inferred from loose metadata.
 */

import { Hono } from 'hono'
import { and, asc, desc, eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import dbPackage from '@bizing/db'
import { requireAclPermission, requireAuth, requireBizAccess } from '../middleware/auth.js'
import { sanitizeUnknown } from '../lib/sanitize.js'
import { fail, ok, parsePositiveInt } from './_api.js'

const {
  db,
  outboundMessages,
  outboundMessageEvents,
  communicationConsents,
  quietHourPolicies,
} = dbPackage

const listOutboundMessagesQuerySchema = z.object({
  page: z.string().optional(),
  perPage: z.string().optional(),
  recipientUserId: z.string().optional(),
  channel: z.enum(['sms', 'email', 'push', 'whatsapp', 'postal', 'voice', 'webhook']).optional(),
  purpose: z.enum(['transactional', 'marketing', 'operational', 'legal']).optional(),
  status: z
    .enum([
      'queued',
      'processing',
      'sent',
      'delivered',
      'failed',
      'bounced',
      'opened',
      'clicked',
      'replied',
      'cancelled',
      'suppressed',
    ])
    .optional(),
  bookingOrderId: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
})

const paginationQuerySchema = z.object({
  page: z.string().optional(),
  perPage: z.string().optional(),
})

const listConsentQuerySchema = paginationQuerySchema.extend({
  subjectType: z.string().optional(),
  subjectRefId: z.string().optional(),
  subjectUserId: z.string().optional(),
  channel: z.enum(['sms', 'email', 'push', 'whatsapp', 'postal', 'voice', 'webhook']).optional(),
  purpose: z.enum(['transactional', 'marketing', 'operational', 'legal']).optional(),
  status: z.enum(['opted_in', 'opted_out', 'suppressed']).optional(),
})

const createConsentBodySchema = z.object({
  subjectType: z.enum([
    'biz',
    'location',
    'user',
    'group_account',
    'resource',
    'service',
    'service_product',
    'offer',
    'offer_version',
    'product',
    'sellable',
    'booking_order',
    'booking_order_line',
    'fulfillment_unit',
    'payment_intent',
    'queue_entry',
    'trip',
    'custom',
  ]),
  subjectRefId: z.string().min(1).max(140),
  subjectUserId: z.string().optional(),
  subjectGroupAccountId: z.string().optional(),
  channel: z.enum(['sms', 'email', 'push', 'whatsapp', 'postal', 'voice', 'webhook']),
  purpose: z.enum(['transactional', 'marketing', 'operational', 'legal']),
  status: z.enum(['opted_in', 'opted_out', 'suppressed']).default('opted_in'),
  source: z.enum(['user_action', 'admin_override', 'import', 'system', 'legal_update']).default('user_action'),
  legalBasis: z.string().max(180).optional(),
  capturedAt: z.string().datetime().optional(),
  expiresAt: z.string().datetime().optional(),
  revokedAt: z.string().datetime().optional(),
  metadata: z.record(z.unknown()).optional(),
})

const updateConsentBodySchema = createConsentBodySchema.partial()

const listQuietPolicyQuerySchema = paginationQuerySchema.extend({
  status: z.enum(['draft', 'active', 'inactive', 'archived']).optional(),
  channel: z.enum(['sms', 'email', 'push', 'whatsapp', 'postal', 'voice', 'webhook']).optional(),
  targetUserId: z.string().optional(),
})

const createQuietPolicyBodySchema = z.object({
  name: z.string().min(1).max(200),
  status: z.enum(['draft', 'active', 'inactive', 'archived']).default('active'),
  channel: z.enum(['sms', 'email', 'push', 'whatsapp', 'postal', 'voice', 'webhook']).optional(),
  timezone: z.string().min(1).max(50).default('UTC'),
  quietStartLocal: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/),
  quietEndLocal: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/),
  targetType: z.enum([
    'biz',
    'location',
    'user',
    'group_account',
    'resource',
    'service',
    'service_product',
    'offer',
    'offer_version',
    'product',
    'sellable',
    'booking_order',
    'booking_order_line',
    'fulfillment_unit',
    'payment_intent',
    'queue_entry',
    'trip',
    'custom',
  ]).optional().nullable(),
  targetRefId: z.string().max(140).optional().nullable(),
  targetUserId: z.string().optional().nullable(),
  targetGroupAccountId: z.string().optional().nullable(),
  allowTransactionalBypass: z.boolean().default(true),
  allowEmergencyBypass: z.boolean().default(true),
  metadata: z.record(z.unknown()).optional(),
})

const updateQuietPolicyBodySchema = createQuietPolicyBodySchema.partial()
const createOutboundMessageEventBodySchema = z.object({
  eventType: z.enum(['queued', 'sent', 'delivered', 'failed', 'bounced', 'opened', 'clicked', 'replied', 'complained', 'unsubscribed', 'other']),
  providerEventRef: z.string().max(240).optional(),
  payload: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
  nextStatus: z
    .enum(['queued', 'processing', 'sent', 'delivered', 'failed', 'bounced', 'opened', 'clicked', 'replied', 'cancelled', 'suppressed'])
    .optional(),
  errorCode: z.string().max(120).optional(),
  errorMessage: z.string().max(2000).optional(),
})

const createOutboundMessageBodySchema = z.object({
  channel: z.enum(['sms', 'email', 'push', 'whatsapp', 'postal', 'voice', 'webhook']),
  purpose: z.enum(['transactional', 'marketing', 'operational', 'legal']),
  recipientUserId: z.string().optional(),
  recipientGroupAccountId: z.string().optional(),
  recipientRef: z.string().min(1).max(500),
  status: z
    .enum([
      'queued',
      'processing',
      'sent',
      'delivered',
      'failed',
      'bounced',
      'opened',
      'clicked',
      'replied',
      'cancelled',
      'suppressed',
    ])
    .default('queued'),
  scheduledFor: z.string().datetime().optional(),
  providerKey: z.string().max(120).optional(),
  providerMessageRef: z.string().max(240).optional(),
  errorCode: z.string().max(120).optional(),
  errorMessage: z.string().max(2000).optional(),
  payload: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
})

function cleanMetadata(value: Record<string, unknown> | undefined) {
  return sanitizeUnknown(value ?? {}) as Record<string, unknown>
}

function pagination(input: { page?: string; perPage?: string }) {
  const page = parsePositiveInt(input.page, 1)
  const perPage = Math.min(parsePositiveInt(input.perPage, 20), 100)
  return { page, perPage, offset: (page - 1) * perPage }
}

export const communicationRoutes = new Hono()

communicationRoutes.get(
  '/bizes/:bizId/outbound-messages',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('communications.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = listOutboundMessagesQuerySchema.safeParse(c.req.query())
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid query parameters.', 400, parsed.error.flatten())
    }

    const pageInfo = pagination(parsed.data)
    const orderByExpr =
      parsed.data.sortOrder === 'asc' ? asc(outboundMessages.scheduledFor) : desc(outboundMessages.scheduledFor)

    const where = and(
      eq(outboundMessages.bizId, bizId),
      parsed.data.recipientUserId ? eq(outboundMessages.recipientUserId, parsed.data.recipientUserId) : undefined,
      parsed.data.channel ? eq(outboundMessages.channel, parsed.data.channel) : undefined,
      parsed.data.purpose ? eq(outboundMessages.purpose, parsed.data.purpose) : undefined,
      parsed.data.status ? eq(outboundMessages.status, parsed.data.status) : undefined,
      parsed.data.bookingOrderId
        ? sql`${outboundMessages.metadata} ->> 'bookingOrderId' = ${parsed.data.bookingOrderId}`
        : undefined,
    )

    const [rows, countRows] = await Promise.all([
      db.query.outboundMessages.findMany({
        where,
        orderBy: [orderByExpr],
        limit: pageInfo.perPage,
        offset: pageInfo.offset,
      }),
      db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(outboundMessages).where(where),
    ])

    const total = countRows[0]?.count ?? 0
    return ok(c, rows, 200, {
      pagination: {
        page: pageInfo.page,
        perPage: pageInfo.perPage,
        total,
        hasMore: pageInfo.page * pageInfo.perPage < total,
      },
    })
  },
)

communicationRoutes.post(
  '/bizes/:bizId/outbound-messages',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('communications.write', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = createOutboundMessageBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    }

    const [created] = await db
      .insert(outboundMessages)
      .values({
        bizId,
        channel: parsed.data.channel,
        purpose: parsed.data.purpose,
        recipientUserId: parsed.data.recipientUserId ?? null,
        recipientGroupAccountId: parsed.data.recipientGroupAccountId ?? null,
        recipientRef: parsed.data.recipientRef,
        status: parsed.data.status,
        scheduledFor: parsed.data.scheduledFor ? new Date(parsed.data.scheduledFor) : new Date(),
        providerKey: parsed.data.providerKey ?? null,
        providerMessageRef: parsed.data.providerMessageRef ?? null,
        errorCode: parsed.data.errorCode ?? null,
        errorMessage: parsed.data.errorMessage ?? null,
        payload: cleanMetadata(parsed.data.payload),
        metadata: cleanMetadata(parsed.data.metadata),
      })
      .returning()

    return ok(c, created, 201)
  },
)

communicationRoutes.get(
  '/bizes/:bizId/outbound-messages/:messageId',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('communications.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, messageId } = c.req.param()

    const message = await db.query.outboundMessages.findFirst({
      where: and(eq(outboundMessages.bizId, bizId), eq(outboundMessages.id, messageId)),
    })
    if (!message) return fail(c, 'NOT_FOUND', 'Outbound message not found.', 404)

    const events = await db.query.outboundMessageEvents.findMany({
      where: and(eq(outboundMessageEvents.bizId, bizId), eq(outboundMessageEvents.outboundMessageId, messageId)),
      orderBy: [asc(outboundMessageEvents.occurredAt)],
    })

    return ok(c, { message, events })
  },
)

communicationRoutes.post(
  '/bizes/:bizId/outbound-messages/:messageId/events',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('communications.write', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, messageId } = c.req.param()
    const parsed = createOutboundMessageEventBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    }

    const message = await db.query.outboundMessages.findFirst({
      where: and(eq(outboundMessages.bizId, bizId), eq(outboundMessages.id, messageId)),
    })
    if (!message) return fail(c, 'NOT_FOUND', 'Outbound message not found.', 404)

    const occurredAt = new Date()
    const [event] = await db
      .insert(outboundMessageEvents)
      .values({
        bizId,
        outboundMessageId: messageId,
        eventType: parsed.data.eventType,
        providerEventRef: parsed.data.providerEventRef,
        payload: cleanMetadata(parsed.data.payload),
        metadata: cleanMetadata(parsed.data.metadata),
      })
      .returning()

    const nextStatus = parsed.data.nextStatus ?? (
      parsed.data.eventType === 'failed' || parsed.data.eventType === 'bounced'
        ? parsed.data.eventType
        : parsed.data.eventType === 'queued'
          ? 'queued'
          : parsed.data.eventType
    )

    const patch: Partial<typeof outboundMessages.$inferInsert> = {
      status: nextStatus as typeof message.status,
      errorCode: parsed.data.errorCode ?? undefined,
      errorMessage: parsed.data.errorMessage ?? undefined,
    }
    if (nextStatus === 'sent') patch.sentAt = occurredAt
    if (nextStatus === 'delivered') patch.deliveredAt = occurredAt
    if (nextStatus === 'failed' || nextStatus === 'bounced') patch.failedAt = occurredAt

    const [updatedMessage] = await db
      .update(outboundMessages)
      .set(patch)
      .where(and(eq(outboundMessages.bizId, bizId), eq(outboundMessages.id, messageId)))
      .returning()

    return ok(c, { event, message: updatedMessage }, 201)
  },
)

communicationRoutes.get(
  '/bizes/:bizId/communication-consents',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('communications.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = listConsentQuerySchema.safeParse(c.req.query())
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid query parameters.', 400, parsed.error.flatten())
    }

    const pageInfo = pagination(parsed.data)
    const where = and(
      eq(communicationConsents.bizId, bizId),
      parsed.data.subjectType ? eq(communicationConsents.subjectType, parsed.data.subjectType as never) : undefined,
      parsed.data.subjectRefId ? eq(communicationConsents.subjectRefId, parsed.data.subjectRefId) : undefined,
      parsed.data.subjectUserId ? eq(communicationConsents.subjectUserId, parsed.data.subjectUserId) : undefined,
      parsed.data.channel ? eq(communicationConsents.channel, parsed.data.channel) : undefined,
      parsed.data.purpose ? eq(communicationConsents.purpose, parsed.data.purpose) : undefined,
      parsed.data.status ? eq(communicationConsents.status, parsed.data.status) : undefined,
    )

    const [rows, countRows] = await Promise.all([
      db.query.communicationConsents.findMany({
        where,
        orderBy: [desc(communicationConsents.capturedAt)],
        limit: pageInfo.perPage,
        offset: pageInfo.offset,
      }),
      db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(communicationConsents).where(where),
    ])

    const total = countRows[0]?.count ?? 0
    return ok(c, rows, 200, {
      pagination: {
        page: pageInfo.page,
        perPage: pageInfo.perPage,
        total,
        hasMore: pageInfo.page * pageInfo.perPage < total,
      },
    })
  },
)

communicationRoutes.post(
  '/bizes/:bizId/communication-consents',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('communications.write', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const body = await c.req.json().catch(() => null)
    const parsed = createConsentBodySchema.safeParse(body)
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    }

    const [created] = await db
      .insert(communicationConsents)
      .values({
        bizId,
        subjectType: parsed.data.subjectType as never,
        subjectRefId: parsed.data.subjectRefId,
        subjectUserId: parsed.data.subjectUserId,
        subjectGroupAccountId: parsed.data.subjectGroupAccountId,
        channel: parsed.data.channel,
        purpose: parsed.data.purpose,
        status: parsed.data.status,
        source: parsed.data.source,
        legalBasis: parsed.data.legalBasis,
        capturedAt: parsed.data.capturedAt ? new Date(parsed.data.capturedAt) : new Date(),
        expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
        revokedAt: parsed.data.revokedAt ? new Date(parsed.data.revokedAt) : null,
        metadata: cleanMetadata(parsed.data.metadata),
      })
      .returning()

    return ok(c, created, 201)
  },
)

communicationRoutes.patch(
  '/bizes/:bizId/communication-consents/:consentId',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('communications.write', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, consentId } = c.req.param()
    const body = await c.req.json().catch(() => null)
    const parsed = updateConsentBodySchema.safeParse(body)
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    }

    const existing = await db.query.communicationConsents.findFirst({
      where: and(eq(communicationConsents.bizId, bizId), eq(communicationConsents.id, consentId)),
    })
    if (!existing) return fail(c, 'NOT_FOUND', 'Communication consent not found.', 404)

    const [updated] = await db
      .update(communicationConsents)
      .set({
        subjectType: parsed.data.subjectType as never | undefined,
        subjectRefId: parsed.data.subjectRefId,
        subjectUserId: parsed.data.subjectUserId,
        subjectGroupAccountId: parsed.data.subjectGroupAccountId,
        channel: parsed.data.channel,
        purpose: parsed.data.purpose,
        status: parsed.data.status,
        source: parsed.data.source,
        legalBasis: parsed.data.legalBasis,
        capturedAt: parsed.data.capturedAt ? new Date(parsed.data.capturedAt) : undefined,
        expiresAt: parsed.data.expiresAt === undefined ? undefined : parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
        revokedAt: parsed.data.revokedAt === undefined ? undefined : parsed.data.revokedAt ? new Date(parsed.data.revokedAt) : null,
        metadata: parsed.data.metadata === undefined ? undefined : cleanMetadata(parsed.data.metadata),
      })
      .where(and(eq(communicationConsents.bizId, bizId), eq(communicationConsents.id, consentId)))
      .returning()

    return ok(c, updated)
  },
)

communicationRoutes.get(
  '/bizes/:bizId/quiet-hour-policies',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('communications.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = listQuietPolicyQuerySchema.safeParse(c.req.query())
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid query parameters.', 400, parsed.error.flatten())
    }

    const pageInfo = pagination(parsed.data)
    const where = and(
      eq(quietHourPolicies.bizId, bizId),
      parsed.data.status ? eq(quietHourPolicies.status, parsed.data.status) : undefined,
      parsed.data.channel ? eq(quietHourPolicies.channel, parsed.data.channel) : undefined,
      parsed.data.targetUserId ? eq(quietHourPolicies.targetUserId, parsed.data.targetUserId) : undefined,
    )

    const [rows, countRows] = await Promise.all([
      db.query.quietHourPolicies.findMany({
        where,
        orderBy: [asc(quietHourPolicies.name)],
        limit: pageInfo.perPage,
        offset: pageInfo.offset,
      }),
      db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(quietHourPolicies).where(where),
    ])

    const total = countRows[0]?.count ?? 0
    return ok(c, rows, 200, {
      pagination: {
        page: pageInfo.page,
        perPage: pageInfo.perPage,
        total,
        hasMore: pageInfo.page * pageInfo.perPage < total,
      },
    })
  },
)

communicationRoutes.post(
  '/bizes/:bizId/quiet-hour-policies',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('communications.write', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const body = await c.req.json().catch(() => null)
    const parsed = createQuietPolicyBodySchema.safeParse(body)
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    }

    const [created] = await db
      .insert(quietHourPolicies)
      .values({
        bizId,
        name: parsed.data.name,
        status: parsed.data.status,
        channel: parsed.data.channel ?? null,
        timezone: parsed.data.timezone,
        quietStartLocal: parsed.data.quietStartLocal,
        quietEndLocal: parsed.data.quietEndLocal,
        targetType: parsed.data.targetType ?? null,
        targetRefId: parsed.data.targetRefId ?? null,
        targetUserId: parsed.data.targetUserId ?? null,
        targetGroupAccountId: parsed.data.targetGroupAccountId ?? null,
        allowTransactionalBypass: parsed.data.allowTransactionalBypass,
        allowEmergencyBypass: parsed.data.allowEmergencyBypass,
        metadata: cleanMetadata(parsed.data.metadata),
      })
      .returning()

    return ok(c, created, 201)
  },
)

communicationRoutes.patch(
  '/bizes/:bizId/quiet-hour-policies/:policyId',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('communications.write', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, policyId } = c.req.param()
    const body = await c.req.json().catch(() => null)
    const parsed = updateQuietPolicyBodySchema.safeParse(body)
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    }

    const existing = await db.query.quietHourPolicies.findFirst({
      where: and(eq(quietHourPolicies.bizId, bizId), eq(quietHourPolicies.id, policyId)),
    })
    if (!existing) return fail(c, 'NOT_FOUND', 'Quiet-hour policy not found.', 404)

    const [updated] = await db
      .update(quietHourPolicies)
      .set({
        name: parsed.data.name,
        status: parsed.data.status,
        channel: parsed.data.channel === undefined ? undefined : parsed.data.channel ?? null,
        timezone: parsed.data.timezone,
        quietStartLocal: parsed.data.quietStartLocal,
        quietEndLocal: parsed.data.quietEndLocal,
        targetType: parsed.data.targetType === undefined ? undefined : parsed.data.targetType ?? null,
        targetRefId: parsed.data.targetRefId === undefined ? undefined : parsed.data.targetRefId ?? null,
        targetUserId: parsed.data.targetUserId === undefined ? undefined : parsed.data.targetUserId ?? null,
        targetGroupAccountId:
          parsed.data.targetGroupAccountId === undefined ? undefined : parsed.data.targetGroupAccountId ?? null,
        allowTransactionalBypass: parsed.data.allowTransactionalBypass,
        allowEmergencyBypass: parsed.data.allowEmergencyBypass,
        metadata: parsed.data.metadata === undefined ? undefined : cleanMetadata(parsed.data.metadata),
      })
      .where(and(eq(quietHourPolicies.bizId, bizId), eq(quietHourPolicies.id, policyId)))
      .returning()

    return ok(c, updated)
  },
)
