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
import { executeCrudRouteAction } from '../services/action-route-bridge.js'
import { sanitizePlainText, sanitizeUnknown } from '../lib/sanitize.js'
import { fail, ok, parsePositiveInt } from './_api.js'

const {
  db,
  outboundMessages,
  outboundMessageEvents,
  communicationConsents,
  quietHourPolicies,
  messageTemplates,
  messageTemplateBindings,
  marketingCampaigns,
  marketingCampaignSteps,
  marketingCampaignEnrollments,
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
const createMessageTemplateBodySchema = z.object({
  channel: z.enum(['sms', 'email', 'push', 'whatsapp', 'postal', 'voice', 'webhook']),
  purpose: z.enum(['transactional', 'marketing', 'operational', 'legal']),
  name: z.string().min(1).max(220),
  slug: z.string().min(1).max(140),
  version: z.number().int().positive().default(1),
  status: z.enum(['draft', 'active', 'inactive', 'archived']).default('draft'),
  isCurrent: z.boolean().default(false),
  locale: z.string().min(1).max(20).default('en-US'),
  subjectTemplate: z.string().max(600).optional().nullable(),
  bodyTemplate: z.string().min(1).max(50000),
  structuredTemplate: z.record(z.unknown()).optional(),
  variableSchema: z.record(z.unknown()).optional(),
  renderPolicy: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
})
const patchMessageTemplateBodySchema = createMessageTemplateBodySchema.partial()
const createMessageTemplateBindingBodySchema = z.object({
  messageTemplateId: z.string().min(1),
  eventPattern: z.string().min(1).max(200),
  targetType: z
    .enum(['biz', 'location', 'user', 'group_account', 'resource', 'service', 'service_product', 'offer', 'offer_version', 'product', 'sellable', 'booking_order', 'booking_order_line', 'fulfillment_unit', 'payment_intent', 'queue_entry', 'trip', 'custom'])
    .optional()
    .nullable(),
  priority: z.number().int().min(0).default(100),
  isActive: z.boolean().default(true),
  conditionExpr: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
})
const createMarketingCampaignBodySchema = z.object({
  name: z.string().min(1).max(220),
  slug: z.string().min(1).max(140),
  status: z.enum(['draft', 'active', 'paused', 'completed', 'archived']).default('draft'),
  description: z.string().max(5000).optional().nullable(),
  startsAt: z.string().datetime().optional().nullable(),
  endsAt: z.string().datetime().optional().nullable(),
  entryPolicy: z.record(z.unknown()).optional(),
  exitPolicy: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
})
const patchMarketingCampaignBodySchema = createMarketingCampaignBodySchema.partial()
const createMarketingCampaignStepBodySchema = z.object({
  marketingCampaignId: z.string().min(1),
  stepKey: z.string().min(1).max(120),
  stepType: z.enum(['delay', 'message', 'condition', 'exit']),
  name: z.string().max(220).optional().nullable(),
  sortOrder: z.number().int().min(0).default(100),
  channel: z.enum(['sms', 'email', 'push', 'whatsapp', 'postal', 'voice', 'webhook']).optional().nullable(),
  messageTemplateId: z.string().min(1).optional().nullable(),
  delayMinutes: z.number().int().min(0).optional().nullable(),
  conditionExpr: z.record(z.unknown()).optional(),
  nextStepKey: z.string().max(120).optional().nullable(),
  onTrueStepKey: z.string().max(120).optional().nullable(),
  onFalseStepKey: z.string().max(120).optional().nullable(),
  status: z.enum(['draft', 'active', 'inactive', 'archived']).default('active'),
  metadata: z.record(z.unknown()).optional(),
})
const createMarketingCampaignEnrollmentBodySchema = z.object({
  marketingCampaignId: z.string().min(1),
  subjectType: z.enum(['biz', 'location', 'user', 'group_account', 'resource', 'service', 'service_product', 'offer', 'offer_version', 'product', 'sellable', 'booking_order', 'booking_order_line', 'fulfillment_unit', 'payment_intent', 'queue_entry', 'trip', 'custom']),
  subjectRefId: z.string().min(1).max(140),
  subjectUserId: z.string().optional().nullable(),
  subjectGroupAccountId: z.string().optional().nullable(),
  status: z.enum(['active', 'paused', 'completed', 'exited', 'failed']).default('active'),
  currentStepKey: z.string().max(120).optional().nullable(),
  exitReason: z.string().max(240).optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
})
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

async function createCommunicationRow<T extends Record<string, unknown>>(input: {
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
    metadata: { routeFamily: 'communications' },
  })
  if (!delegated.ok) return fail(input.c, delegated.code, delegated.message, delegated.httpStatus, delegated.details)
  return delegated.row as T
}

async function updateCommunicationRow<T extends Record<string, unknown>>(input: {
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
    metadata: { routeFamily: 'communications' },
  })
  if (!delegated.ok) {
    if (delegated.code === 'CRUD_TARGET_NOT_FOUND') return fail(input.c, 'NOT_FOUND', input.notFoundMessage, 404)
    return fail(input.c, delegated.code, delegated.message, delegated.httpStatus, delegated.details)
  }
  if (!delegated.row) return fail(input.c, 'NOT_FOUND', input.notFoundMessage, 404)
  return delegated.row as T
}

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

    const created = await createCommunicationRow<typeof outboundMessages.$inferSelect>({
      c,
      bizId,
      tableKey: 'outboundMessages',
      subjectType: 'outbound_message',
      displayName: parsed.data.recipientRef,
      data: {
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
      },
    })
    if (created instanceof Response) return created

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
    const event = await createCommunicationRow<typeof outboundMessageEvents.$inferSelect>({
      c,
      bizId,
      tableKey: 'outboundMessageEvents',
      subjectType: 'outbound_message_event',
      displayName: parsed.data.eventType,
      data: {
        bizId,
        outboundMessageId: messageId,
        eventType: parsed.data.eventType,
        providerEventRef: parsed.data.providerEventRef,
        payload: cleanMetadata(parsed.data.payload),
        metadata: cleanMetadata(parsed.data.metadata),
      },
    })
    if (event instanceof Response) return event

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

    const updatedMessage = await updateCommunicationRow<typeof outboundMessages.$inferSelect>({
      c,
      bizId,
      tableKey: 'outboundMessages',
      subjectType: 'outbound_message',
      id: messageId,
      notFoundMessage: 'Outbound message not found.',
      patch,
    })
    if (updatedMessage instanceof Response) return updatedMessage

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

    const existing = await db.query.communicationConsents.findFirst({
      where: and(
        eq(communicationConsents.bizId, bizId),
        eq(communicationConsents.subjectType, parsed.data.subjectType as never),
        eq(communicationConsents.subjectRefId, parsed.data.subjectRefId),
        eq(communicationConsents.channel, parsed.data.channel),
        eq(communicationConsents.purpose, parsed.data.purpose),
      ),
    })

    const payload = {
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
    }

    if (existing) {
      const updated = await updateCommunicationRow<typeof communicationConsents.$inferSelect>({
        c,
        bizId,
        tableKey: 'communicationConsents',
        subjectType: 'communication_consent',
        id: existing.id,
        patch: payload,
        notFoundMessage: 'Communication consent not found.',
      })
      if (updated instanceof Response) return updated
      return ok(c, updated, 201, { reused: true })
    }

    const created = await createCommunicationRow<typeof communicationConsents.$inferSelect>({
      c,
      bizId,
      tableKey: 'communicationConsents',
      subjectType: 'communication_consent',
      displayName: `${parsed.data.channel}:${parsed.data.purpose}`,
      data: {
        bizId,
        ...payload,
      },
    })
    if (created instanceof Response) return created

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

    const updated = await updateCommunicationRow<typeof communicationConsents.$inferSelect>({
      c,
      bizId,
      tableKey: 'communicationConsents',
      subjectType: 'communication_consent',
      id: consentId,
      notFoundMessage: 'Communication consent not found.',
      patch: {
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
      },
    })
    if (updated instanceof Response) return updated

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

    const created = await createCommunicationRow<typeof quietHourPolicies.$inferSelect>({
      c,
      bizId,
      tableKey: 'quietHourPolicies',
      subjectType: 'quiet_hour_policy',
      displayName: parsed.data.name,
      data: {
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
      },
    })
    if (created instanceof Response) return created

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

    const updated = await updateCommunicationRow<typeof quietHourPolicies.$inferSelect>({
      c,
      bizId,
      tableKey: 'quietHourPolicies',
      subjectType: 'quiet_hour_policy',
      id: policyId,
      notFoundMessage: 'Quiet-hour policy not found.',
      patch: {
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
      },
    })
    if (updated instanceof Response) return updated

    return ok(c, updated)
  },
)

communicationRoutes.get(
  '/bizes/:bizId/message-templates',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('communications.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const rows = await db.query.messageTemplates.findMany({
      where: eq(messageTemplates.bizId, bizId),
      orderBy: [asc(messageTemplates.channel), asc(messageTemplates.slug), desc(messageTemplates.version)],
    })
    return ok(c, rows)
  },
)

communicationRoutes.post(
  '/bizes/:bizId/message-templates',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('communications.write', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = createMessageTemplateBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())

    const created = await createCommunicationRow<typeof messageTemplates.$inferSelect>({
      c,
      bizId,
      tableKey: 'messageTemplates',
      subjectType: 'message_template',
      displayName: parsed.data.name,
      data: {
      bizId,
      channel: parsed.data.channel,
      purpose: parsed.data.purpose,
      name: sanitizePlainText(parsed.data.name),
      slug: sanitizePlainText(parsed.data.slug),
      version: parsed.data.version,
      status: parsed.data.status,
      isCurrent: parsed.data.isCurrent,
      locale: sanitizePlainText(parsed.data.locale),
      subjectTemplate: parsed.data.subjectTemplate ? sanitizePlainText(parsed.data.subjectTemplate) : null,
      bodyTemplate: sanitizePlainText(parsed.data.bodyTemplate),
      structuredTemplate: cleanMetadata(parsed.data.structuredTemplate),
      variableSchema: cleanMetadata(parsed.data.variableSchema),
      renderPolicy: cleanMetadata(parsed.data.renderPolicy),
      metadata: cleanMetadata(parsed.data.metadata),
      },
    })
    if (created instanceof Response) return created

    return ok(c, created, 201)
  },
)

communicationRoutes.patch(
  '/bizes/:bizId/message-templates/:templateId',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('communications.write', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, templateId } = c.req.param()
    const parsed = patchMessageTemplateBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())

    const updated = await updateCommunicationRow<typeof messageTemplates.$inferSelect>({
      c,
      bizId,
      tableKey: 'messageTemplates',
      subjectType: 'message_template',
      id: templateId,
      notFoundMessage: 'Message template not found.',
      patch: {
      channel: parsed.data.channel,
      purpose: parsed.data.purpose,
      name: parsed.data.name !== undefined ? sanitizePlainText(parsed.data.name) : undefined,
      slug: parsed.data.slug !== undefined ? sanitizePlainText(parsed.data.slug) : undefined,
      version: parsed.data.version,
      status: parsed.data.status,
      isCurrent: parsed.data.isCurrent,
      locale: parsed.data.locale !== undefined ? sanitizePlainText(parsed.data.locale) : undefined,
      subjectTemplate:
        parsed.data.subjectTemplate === undefined ? undefined : parsed.data.subjectTemplate ? sanitizePlainText(parsed.data.subjectTemplate) : null,
      bodyTemplate: parsed.data.bodyTemplate !== undefined ? sanitizePlainText(parsed.data.bodyTemplate) : undefined,
      structuredTemplate: parsed.data.structuredTemplate === undefined ? undefined : cleanMetadata(parsed.data.structuredTemplate),
      variableSchema: parsed.data.variableSchema === undefined ? undefined : cleanMetadata(parsed.data.variableSchema),
      renderPolicy: parsed.data.renderPolicy === undefined ? undefined : cleanMetadata(parsed.data.renderPolicy),
      metadata: parsed.data.metadata === undefined ? undefined : cleanMetadata(parsed.data.metadata),
      },
    })
    if (updated instanceof Response) return updated

    if (!updated) return fail(c, 'NOT_FOUND', 'Message template not found.', 404)
    return ok(c, updated)
  },
)

communicationRoutes.get(
  '/bizes/:bizId/message-template-bindings',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('communications.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const rows = await db.query.messageTemplateBindings.findMany({
      where: eq(messageTemplateBindings.bizId, bizId),
      orderBy: [asc(messageTemplateBindings.eventPattern), asc(messageTemplateBindings.priority)],
    })
    return ok(c, rows)
  },
)

communicationRoutes.post(
  '/bizes/:bizId/message-template-bindings',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('communications.write', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = createMessageTemplateBindingBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())

    const created = await createCommunicationRow<typeof messageTemplateBindings.$inferSelect>({
      c,
      bizId,
      tableKey: 'messageTemplateBindings',
      subjectType: 'message_template_binding',
      displayName: parsed.data.eventPattern,
      data: {
      bizId,
      messageTemplateId: parsed.data.messageTemplateId,
      eventPattern: sanitizePlainText(parsed.data.eventPattern),
      targetType: parsed.data.targetType ?? null,
      priority: parsed.data.priority,
      isActive: parsed.data.isActive,
      conditionExpr: cleanMetadata(parsed.data.conditionExpr),
      metadata: cleanMetadata(parsed.data.metadata),
      },
    })
    if (created instanceof Response) return created

    return ok(c, created, 201)
  },
)

communicationRoutes.get(
  '/bizes/:bizId/marketing-campaigns',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('communications.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const rows = await db.query.marketingCampaigns.findMany({
      where: eq(marketingCampaigns.bizId, bizId),
      orderBy: [asc(marketingCampaigns.status), asc(marketingCampaigns.slug)],
    })
    return ok(c, rows)
  },
)

communicationRoutes.post(
  '/bizes/:bizId/marketing-campaigns',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('communications.write', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = createMarketingCampaignBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())

    const created = await createCommunicationRow<typeof marketingCampaigns.$inferSelect>({
      c,
      bizId,
      tableKey: 'marketingCampaigns',
      subjectType: 'marketing_campaign',
      displayName: parsed.data.name,
      data: {
      bizId,
      name: sanitizePlainText(parsed.data.name),
      slug: sanitizePlainText(parsed.data.slug),
      status: parsed.data.status,
      description: parsed.data.description ? sanitizePlainText(parsed.data.description) : null,
      startsAt: parsed.data.startsAt ? new Date(parsed.data.startsAt) : null,
      endsAt: parsed.data.endsAt ? new Date(parsed.data.endsAt) : null,
      entryPolicy: cleanMetadata(parsed.data.entryPolicy),
      exitPolicy: cleanMetadata(parsed.data.exitPolicy),
      metadata: cleanMetadata(parsed.data.metadata),
      },
    })
    if (created instanceof Response) return created

    return ok(c, created, 201)
  },
)

communicationRoutes.patch(
  '/bizes/:bizId/marketing-campaigns/:campaignId',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('communications.write', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, campaignId } = c.req.param()
    const parsed = patchMarketingCampaignBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())

    const updated = await updateCommunicationRow<typeof marketingCampaigns.$inferSelect>({
      c,
      bizId,
      tableKey: 'marketingCampaigns',
      subjectType: 'marketing_campaign',
      id: campaignId,
      notFoundMessage: 'Marketing campaign not found.',
      patch: {
      name: parsed.data.name !== undefined ? sanitizePlainText(parsed.data.name) : undefined,
      slug: parsed.data.slug !== undefined ? sanitizePlainText(parsed.data.slug) : undefined,
      status: parsed.data.status,
      description: parsed.data.description === undefined ? undefined : parsed.data.description ? sanitizePlainText(parsed.data.description) : null,
      startsAt: parsed.data.startsAt === undefined ? undefined : parsed.data.startsAt ? new Date(parsed.data.startsAt) : null,
      endsAt: parsed.data.endsAt === undefined ? undefined : parsed.data.endsAt ? new Date(parsed.data.endsAt) : null,
      entryPolicy: parsed.data.entryPolicy === undefined ? undefined : cleanMetadata(parsed.data.entryPolicy),
      exitPolicy: parsed.data.exitPolicy === undefined ? undefined : cleanMetadata(parsed.data.exitPolicy),
      metadata: parsed.data.metadata === undefined ? undefined : cleanMetadata(parsed.data.metadata),
      },
    })
    if (updated instanceof Response) return updated

    if (!updated) return fail(c, 'NOT_FOUND', 'Marketing campaign not found.', 404)
    return ok(c, updated)
  },
)

communicationRoutes.get(
  '/bizes/:bizId/marketing-campaign-steps',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('communications.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const campaignId = c.req.query('marketingCampaignId')
    const rows = await db.query.marketingCampaignSteps.findMany({
      where: and(eq(marketingCampaignSteps.bizId, bizId), campaignId ? eq(marketingCampaignSteps.marketingCampaignId, campaignId) : undefined),
      orderBy: [asc(marketingCampaignSteps.sortOrder), asc(marketingCampaignSteps.stepKey)],
    })
    return ok(c, rows)
  },
)

communicationRoutes.post(
  '/bizes/:bizId/marketing-campaign-steps',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('communications.write', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = createMarketingCampaignStepBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())

    const created = await createCommunicationRow<typeof marketingCampaignSteps.$inferSelect>({
      c,
      bizId,
      tableKey: 'marketingCampaignSteps',
      subjectType: 'marketing_campaign_step',
      displayName: parsed.data.stepKey,
      data: {
      bizId,
      marketingCampaignId: parsed.data.marketingCampaignId,
      stepKey: sanitizePlainText(parsed.data.stepKey),
      stepType: parsed.data.stepType,
      name: parsed.data.name ? sanitizePlainText(parsed.data.name) : null,
      sortOrder: parsed.data.sortOrder,
      channel: parsed.data.channel ?? null,
      messageTemplateId: parsed.data.messageTemplateId ?? null,
      delayMinutes: parsed.data.delayMinutes ?? null,
      conditionExpr: cleanMetadata(parsed.data.conditionExpr),
      nextStepKey: parsed.data.nextStepKey ?? null,
      onTrueStepKey: parsed.data.onTrueStepKey ?? null,
      onFalseStepKey: parsed.data.onFalseStepKey ?? null,
      status: parsed.data.status,
      metadata: cleanMetadata(parsed.data.metadata),
      },
    })
    if (created instanceof Response) return created

    return ok(c, created, 201)
  },
)

communicationRoutes.get(
  '/bizes/:bizId/marketing-campaign-enrollments',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('communications.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const campaignId = c.req.query('marketingCampaignId')
    const rows = await db.query.marketingCampaignEnrollments.findMany({
      where: and(eq(marketingCampaignEnrollments.bizId, bizId), campaignId ? eq(marketingCampaignEnrollments.marketingCampaignId, campaignId) : undefined),
      orderBy: [desc(marketingCampaignEnrollments.enteredAt)],
    })
    return ok(c, rows)
  },
)

communicationRoutes.post(
  '/bizes/:bizId/marketing-campaign-enrollments',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('communications.write', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = createMarketingCampaignEnrollmentBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())

    const created = await createCommunicationRow<typeof marketingCampaignEnrollments.$inferSelect>({
      c,
      bizId,
      tableKey: 'marketingCampaignEnrollments',
      subjectType: 'marketing_campaign_enrollment',
      displayName: parsed.data.subjectType,
      data: {
      bizId,
      marketingCampaignId: parsed.data.marketingCampaignId,
      subjectType: parsed.data.subjectType,
      subjectRefId: parsed.data.subjectRefId,
      subjectUserId: parsed.data.subjectUserId ?? null,
      subjectGroupAccountId: parsed.data.subjectGroupAccountId ?? null,
      status: parsed.data.status,
      currentStepKey: parsed.data.currentStepKey ?? null,
      exitReason: parsed.data.exitReason ?? null,
      metadata: cleanMetadata(parsed.data.metadata),
      },
    })
    if (created instanceof Response) return created

    return ok(c, created, 201)
  },
)
