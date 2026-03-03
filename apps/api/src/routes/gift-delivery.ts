/**
 * Gift delivery routes.
 *
 * ELI5:
 * Gift instruments hold the value. These routes hold the "when/how/who gets
 * the gift" story.
 *
 * Why this exists:
 * - scheduled gifting is a first-class use case,
 * - delivery retries and event timelines need to be visible through the API,
 * - the same model should work for email, SMS, in-app, or future channels.
 */

import { Hono } from 'hono'
import { and, asc, desc, eq } from 'drizzle-orm'
import { z } from 'zod'
import dbPackage from '@bizing/db'
import { requireAclPermission, requireAuth, requireBizAccess } from '../middleware/auth.js'
import { executeCrudRouteAction } from '../services/action-route-bridge.js'
import { sanitizePlainText, sanitizeUnknown } from '../lib/sanitize.js'
import { fail, ok } from './_api.js'

const {
  db,
  giftDeliveryAttempts,
  giftDeliverySchedules,
  giftInstruments,
} = dbPackage

const giftInstrumentBodySchema = z.object({
  code: z.string().min(1).max(120),
  status: z.enum(['draft', 'active', 'partially_redeemed', 'redeemed', 'expired', 'voided']).default('active'),
  currency: z.string().regex(/^[A-Z]{3}$/).default('USD'),
  initialAmountMinor: z.number().int().min(0),
  remainingAmountMinor: z.number().int().min(0),
  sourceType: z.enum(['manual', 'purchase', 'promotion', 'compensation', 'transfer_split', 'migration', 'external']).default('manual'),
  ownerUserId: z.string().optional().nullable(),
  ownerGroupAccountId: z.string().optional().nullable(),
  expiresAt: z.string().datetime().optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
})

const scheduleBodySchema = z.object({
  giftInstrumentId: z.string().min(1),
  status: z.string().max(40).default('scheduled'),
  statusConfigValueId: z.string().optional().nullable(),
  recipientName: z.string().max(220).optional().nullable(),
  recipientChannel: z.string().max(40),
  recipientAddress: z.string().min(1).max(500),
  recipientLocale: z.string().max(20).optional().nullable(),
  timezone: z.string().max(50).default('UTC'),
  sendAt: z.string().datetime(),
  notBeforeAt: z.string().datetime().optional().nullable(),
  expiresAt: z.string().datetime().optional().nullable(),
  messageSubject: z.string().max(300).optional().nullable(),
  messageBody: z.string().max(12000).optional().nullable(),
  messageTemplateId: z.string().optional().nullable(),
  outboundMessageId: z.string().optional().nullable(),
  attemptCount: z.number().int().min(0).default(0),
  lastAttemptAt: z.string().datetime().optional().nullable(),
  sentAt: z.string().datetime().optional().nullable(),
  cancelledAt: z.string().datetime().optional().nullable(),
  deliveryPolicy: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
})

const schedulePatchSchema = scheduleBodySchema.partial()

const attemptBodySchema = z.object({
  giftDeliveryScheduleId: z.string().min(1),
  attemptNo: z.number().int().min(1).default(1),
  status: z.string().max(40).default('queued'),
  statusConfigValueId: z.string().optional().nullable(),
  recipientChannel: z.string().max(40),
  recipientAddress: z.string().min(1).max(500),
  attemptedAt: z.string().datetime().optional().nullable(),
  finishedAt: z.string().datetime().optional().nullable(),
  outboundMessageId: z.string().optional().nullable(),
  providerKey: z.string().max(120).optional().nullable(),
  providerAttemptRef: z.string().max(180).optional().nullable(),
  errorCode: z.string().max(120).optional().nullable(),
  errorMessage: z.string().max(4000).optional().nullable(),
  deliveryReceipt: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
})

export const giftDeliveryRoutes = new Hono()

async function createGiftDeliveryRow<T extends Record<string, unknown>>(input: {
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
    metadata: { routeFamily: 'gift-delivery' },
  })
  if (!delegated.ok) return fail(input.c, delegated.code, delegated.message, delegated.httpStatus, delegated.details)
  return delegated.row as T
}

async function updateGiftDeliveryRow<T extends Record<string, unknown>>(input: {
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
    metadata: { routeFamily: 'gift-delivery' },
  })
  if (!delegated.ok) {
    if (delegated.code === 'CRUD_TARGET_NOT_FOUND') return fail(input.c, 'NOT_FOUND', input.notFoundMessage, 404)
    return fail(input.c, delegated.code, delegated.message, delegated.httpStatus, delegated.details)
  }
  if (!delegated.row) return fail(input.c, 'NOT_FOUND', input.notFoundMessage, 404)
  return delegated.row as T
}

giftDeliveryRoutes.get(
  '/bizes/:bizId/gift-instruments',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const rows = await db.query.giftInstruments.findMany({
      where: eq(giftInstruments.bizId, bizId),
      orderBy: [desc(giftInstruments.issuedAt)],
    })
    return ok(c, rows)
  },
)

giftDeliveryRoutes.post(
  '/bizes/:bizId/gift-instruments',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = giftInstrumentBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid gift instrument body.', 400, parsed.error.flatten())
    const created = await createGiftDeliveryRow<typeof giftInstruments.$inferSelect>({
      c,
      bizId,
      tableKey: 'giftInstruments',
      subjectType: 'gift_instrument',
      displayName: parsed.data.code,
      data: {
      bizId,
      code: sanitizePlainText(parsed.data.code),
      status: parsed.data.status,
      currency: parsed.data.currency,
      initialAmountMinor: parsed.data.initialAmountMinor,
      remainingAmountMinor: parsed.data.remainingAmountMinor,
      sourceType: parsed.data.sourceType,
      ownerUserId: parsed.data.ownerUserId ?? null,
      ownerGroupAccountId: parsed.data.ownerGroupAccountId ?? null,
      expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
      metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
      },
    })
    if (created instanceof Response) return created
    return ok(c, created, 201)
  },
)

giftDeliveryRoutes.get(
  '/bizes/:bizId/gift-delivery-schedules',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const giftInstrumentId = c.req.query('giftInstrumentId')
    const rows = await db.query.giftDeliverySchedules.findMany({
      where: and(
        eq(giftDeliverySchedules.bizId, bizId),
        giftInstrumentId ? eq(giftDeliverySchedules.giftInstrumentId, giftInstrumentId) : undefined,
      ),
      orderBy: [asc(giftDeliverySchedules.sendAt), asc(giftDeliverySchedules.id)],
    })
    return ok(c, rows)
  },
)

giftDeliveryRoutes.post(
  '/bizes/:bizId/gift-delivery-schedules',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = scheduleBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid gift delivery schedule body.', 400, parsed.error.flatten())

    const created = await createGiftDeliveryRow<typeof giftDeliverySchedules.$inferSelect>({
      c,
      bizId,
      tableKey: 'giftDeliverySchedules',
      subjectType: 'gift_delivery_schedule',
      displayName: parsed.data.recipientAddress,
      data: {
      bizId,
      giftInstrumentId: parsed.data.giftInstrumentId,
      status: sanitizePlainText(parsed.data.status),
      statusConfigValueId: parsed.data.statusConfigValueId ?? null,
      recipientName: parsed.data.recipientName ? sanitizePlainText(parsed.data.recipientName) : null,
      recipientChannel: sanitizePlainText(parsed.data.recipientChannel),
      recipientAddress: sanitizePlainText(parsed.data.recipientAddress),
      recipientLocale: parsed.data.recipientLocale ?? null,
      timezone: sanitizePlainText(parsed.data.timezone),
      sendAt: new Date(parsed.data.sendAt),
      notBeforeAt: parsed.data.notBeforeAt ? new Date(parsed.data.notBeforeAt) : null,
      expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
      messageSubject: parsed.data.messageSubject ? sanitizePlainText(parsed.data.messageSubject) : null,
      messageBody: parsed.data.messageBody ? sanitizePlainText(parsed.data.messageBody) : null,
      messageTemplateId: parsed.data.messageTemplateId ?? null,
      outboundMessageId: parsed.data.outboundMessageId ?? null,
      attemptCount: parsed.data.attemptCount,
      lastAttemptAt: parsed.data.lastAttemptAt ? new Date(parsed.data.lastAttemptAt) : null,
      sentAt: parsed.data.sentAt ? new Date(parsed.data.sentAt) : null,
      cancelledAt: parsed.data.cancelledAt ? new Date(parsed.data.cancelledAt) : null,
      deliveryPolicy: sanitizeUnknown(parsed.data.deliveryPolicy ?? {}),
      metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
      },
    })
    if (created instanceof Response) return created
    return ok(c, created, 201)
  },
)

giftDeliveryRoutes.patch(
  '/bizes/:bizId/gift-delivery-schedules/:scheduleId',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, scheduleId } = c.req.param()
    const parsed = schedulePatchSchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid gift delivery schedule body.', 400, parsed.error.flatten())

    const existing = await db.query.giftDeliverySchedules.findFirst({
      where: and(eq(giftDeliverySchedules.bizId, bizId), eq(giftDeliverySchedules.id, scheduleId)),
    })
    if (!existing) return fail(c, 'NOT_FOUND', 'Gift delivery schedule not found.', 404)

    const updated = await updateGiftDeliveryRow<typeof giftDeliverySchedules.$inferSelect>({
      c,
      bizId,
      tableKey: 'giftDeliverySchedules',
      subjectType: 'gift_delivery_schedule',
      id: scheduleId,
      notFoundMessage: 'Gift delivery schedule not found.',
      patch: {
      giftInstrumentId: parsed.data.giftInstrumentId ?? undefined,
      status: parsed.data.status ? sanitizePlainText(parsed.data.status) : undefined,
      statusConfigValueId: parsed.data.statusConfigValueId === undefined ? undefined : parsed.data.statusConfigValueId,
      recipientName: parsed.data.recipientName === undefined ? undefined : parsed.data.recipientName ? sanitizePlainText(parsed.data.recipientName) : null,
      recipientChannel: parsed.data.recipientChannel ? sanitizePlainText(parsed.data.recipientChannel) : undefined,
      recipientAddress: parsed.data.recipientAddress ? sanitizePlainText(parsed.data.recipientAddress) : undefined,
      recipientLocale: parsed.data.recipientLocale === undefined ? undefined : parsed.data.recipientLocale,
      timezone: parsed.data.timezone ? sanitizePlainText(parsed.data.timezone) : undefined,
      sendAt: parsed.data.sendAt ? new Date(parsed.data.sendAt) : undefined,
      notBeforeAt: parsed.data.notBeforeAt === undefined ? undefined : parsed.data.notBeforeAt ? new Date(parsed.data.notBeforeAt) : null,
      expiresAt: parsed.data.expiresAt === undefined ? undefined : parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
      messageSubject: parsed.data.messageSubject === undefined ? undefined : parsed.data.messageSubject ? sanitizePlainText(parsed.data.messageSubject) : null,
      messageBody: parsed.data.messageBody === undefined ? undefined : parsed.data.messageBody ? sanitizePlainText(parsed.data.messageBody) : null,
      messageTemplateId: parsed.data.messageTemplateId === undefined ? undefined : parsed.data.messageTemplateId,
      outboundMessageId: parsed.data.outboundMessageId === undefined ? undefined : parsed.data.outboundMessageId,
      attemptCount: parsed.data.attemptCount ?? undefined,
      lastAttemptAt: parsed.data.lastAttemptAt === undefined ? undefined : parsed.data.lastAttemptAt ? new Date(parsed.data.lastAttemptAt) : null,
      sentAt: parsed.data.sentAt === undefined ? undefined : parsed.data.sentAt ? new Date(parsed.data.sentAt) : null,
      cancelledAt: parsed.data.cancelledAt === undefined ? undefined : parsed.data.cancelledAt ? new Date(parsed.data.cancelledAt) : null,
      deliveryPolicy: parsed.data.deliveryPolicy ? sanitizeUnknown(parsed.data.deliveryPolicy) : undefined,
      metadata: parsed.data.metadata ? sanitizeUnknown(parsed.data.metadata) : undefined,
      },
    })
    if (updated instanceof Response) return updated
    return ok(c, updated)
  },
)

giftDeliveryRoutes.get(
  '/bizes/:bizId/gift-delivery-schedules/:scheduleId/attempts',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, scheduleId } = c.req.param()
    const rows = await db.query.giftDeliveryAttempts.findMany({
      where: and(eq(giftDeliveryAttempts.bizId, bizId), eq(giftDeliveryAttempts.giftDeliveryScheduleId, scheduleId)),
      orderBy: [asc(giftDeliveryAttempts.attemptNo)],
    })
    return ok(c, rows)
  },
)

giftDeliveryRoutes.post(
  '/bizes/:bizId/gift-delivery-schedules/:scheduleId/attempts',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, scheduleId } = c.req.param()
    const parsed = attemptBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid gift delivery attempt body.', 400, parsed.error.flatten())

    const created = await createGiftDeliveryRow<typeof giftDeliveryAttempts.$inferSelect>({
      c,
      bizId,
      tableKey: 'giftDeliveryAttempts',
      subjectType: 'gift_delivery_attempt',
      displayName: `${scheduleId}#${parsed.data.attemptNo}`,
      data: {
      bizId,
      giftDeliveryScheduleId: scheduleId,
      attemptNo: parsed.data.attemptNo,
      status: sanitizePlainText(parsed.data.status),
      statusConfigValueId: parsed.data.statusConfigValueId ?? null,
      channel: sanitizePlainText(parsed.data.recipientChannel),
      attemptedAt: parsed.data.attemptedAt ? new Date(parsed.data.attemptedAt) : undefined,
      completedAt: parsed.data.finishedAt ? new Date(parsed.data.finishedAt) : undefined,
      outboundMessageId: parsed.data.outboundMessageId ?? null,
      provider: parsed.data.providerKey ? sanitizePlainText(parsed.data.providerKey) : null,
      providerMessageRef: parsed.data.providerAttemptRef ? sanitizePlainText(parsed.data.providerAttemptRef) : null,
      errorCode: parsed.data.errorCode ?? null,
      errorMessage: parsed.data.errorMessage ? sanitizePlainText(parsed.data.errorMessage) : null,
      metadata: sanitizeUnknown({ deliveryReceipt: parsed.data.deliveryReceipt ?? {}, ...(parsed.data.metadata ?? {}) }),
      },
    })
    if (created instanceof Response) return created
    return ok(c, created, 201)
  },
)
