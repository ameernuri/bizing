/**
 * Checkout session and recovery routes.
 *
 * ELI5:
 * A checkout session is the "shopping cart story" before a purchase is fully
 * done. We keep it because:
 * - we need to know what the customer almost bought,
 * - we need abandoned-cart recovery to be traceable,
 * - we want recovery links and messages to be first-class, not guessed from
 *   logs.
 */

import crypto from 'node:crypto'
import { Hono } from 'hono'
import { and, asc, desc, eq } from 'drizzle-orm'
import { z } from 'zod'
import dbPackage from '@bizing/db'
import { requireAclPermission, requireAuth, requireBizAccess } from '../middleware/auth.js'
import { executeCrudRouteAction } from '../services/action-route-bridge.js'
import { repriceCheckoutSessionWithAutomation } from '../services/checkout-automation-hooks.js'
import { fail, ok } from './_api.js'

const {
  db,
  users,
  sellables,
  discountCampaigns,
  checkoutSessions,
  checkoutSessionItems,
  checkoutSessionEvents,
  checkoutRecoveryLinks,
} = dbPackage

const CHECKOUT_SYSTEM_EMAIL = 'system+checkout@bizing.local'
let checkoutSystemActorCache: { id: string; role: string; email: string } | null = null

/**
 * Resolve a concrete users-table actor for unauthenticated public checkout
 * mutations (recovery consume, etc).
 *
 * ELI5:
 * Canonical action rows require `actor_user_id` to reference a real user row.
 * Public routes have no signed-in user, so we keep one deterministic system
 * actor account and use it whenever the route is acting on behalf of the
 * platform.
 */
async function ensureCheckoutSystemActor() {
  if (checkoutSystemActorCache) return checkoutSystemActorCache
  const existing = await db.query.users.findFirst({
    where: eq(users.email, CHECKOUT_SYSTEM_EMAIL),
  })
  if (existing) {
    checkoutSystemActorCache = {
      id: existing.id,
      role: existing.role,
      email: existing.email,
    }
    return checkoutSystemActorCache
  }
  const [created] = await db
    .insert(users)
    .values({
      email: CHECKOUT_SYSTEM_EMAIL,
      name: 'Checkout System',
      role: 'staff',
      status: 'active',
      emailVerified: true,
      metadata: { source: 'routes.checkout.system-actor' },
    })
    .onConflictDoNothing()
    .returning()
  const resolved =
    created ??
    (await db.query.users.findFirst({
      where: eq(users.email, CHECKOUT_SYSTEM_EMAIL),
    }))
  if (!resolved) {
    throw new Error('Failed to resolve checkout system actor user.')
  }
  checkoutSystemActorCache = {
    id: resolved.id,
    role: resolved.role,
    email: resolved.email,
  }
  return checkoutSystemActorCache
}

async function createCheckoutRow<
  TTableKey extends 'checkoutSessions' | 'checkoutSessionItems' | 'checkoutSessionEvents' | 'checkoutRecoveryLinks',
>(
  c: Parameters<typeof executeCrudRouteAction>[0]['c'],
  bizId: string,
  tableKey: TTableKey,
  data: Parameters<typeof executeCrudRouteAction>[0]['data'],
  meta: { subjectType: string; subjectId: string; displayName: string; source: string; system?: boolean },
) {
  const actor = meta.system ? await ensureCheckoutSystemActor() : undefined
  const result = await executeCrudRouteAction({
    c,
    bizId,
    tableKey,
    operation: 'create',
    data,
    subjectType: meta.subjectType,
    subjectId: meta.subjectId,
    displayName: meta.displayName,
    metadata: { source: meta.source },
    actorOverride: actor,
    authSourceOverride: meta.system ? 'session' : undefined,
  })
  if (!result.ok) return result
  if (!result.row) {
    return { ok: false as const, httpStatus: 500, code: 'ACTION_EXECUTION_FAILED', message: `Missing row for ${tableKey} create` }
  }
  return result
}

async function updateCheckoutRow<
  TTableKey extends 'checkoutSessions' | 'checkoutRecoveryLinks' | 'apiAccessTokens',
>(
  c: Parameters<typeof executeCrudRouteAction>[0]['c'],
  bizId: string,
  tableKey: TTableKey,
  id: string,
  patch: Parameters<typeof executeCrudRouteAction>[0]['patch'],
  meta: { subjectType: string; subjectId: string; displayName: string; source: string; system?: boolean },
) {
  const actor = meta.system ? await ensureCheckoutSystemActor() : undefined
  const result = await executeCrudRouteAction({
    c,
    bizId,
    tableKey,
    operation: 'update',
    id,
    patch,
    subjectType: meta.subjectType,
    subjectId: meta.subjectId,
    displayName: meta.displayName,
    metadata: { source: meta.source },
    actorOverride: actor,
    authSourceOverride: meta.system ? 'session' : undefined,
  })
  if (!result.ok) return result
  if (!result.row) {
    return { ok: false as const, httpStatus: 500, code: 'ACTION_EXECUTION_FAILED', message: `Missing row for ${tableKey} update` }
  }
  return result
}

const sessionBodySchema = z.object({
  status: z.enum(['active', 'abandoned', 'recovery_sent', 'recovered', 'completed', 'expired', 'cancelled']).default('active'),
  channel: z.enum(['web', 'mobile', 'pos', 'api', 'admin', 'external_channel']).default('web'),
  ownerUserId: z.string().optional().nullable(),
  ownerGroupAccountId: z.string().optional().nullable(),
  locationId: z.string().optional().nullable(),
  currency: z.string().length(3).default('USD'),
  subtotalMinor: z.number().int().min(0).default(0),
  taxMinor: z.number().int().min(0).default(0),
  feeMinor: z.number().int().min(0).default(0),
  discountMinor: z.number().int().min(0).default(0),
  totalMinor: z.number().int().min(0).default(0),
  startedAt: z.string().datetime().optional(),
  lastActivityAt: z.string().datetime().optional(),
  abandonedAt: z.string().datetime().optional().nullable(),
  recoveredAt: z.string().datetime().optional().nullable(),
  completedAt: z.string().datetime().optional().nullable(),
  expiresAt: z.string().datetime().optional().nullable(),
  cancelledAt: z.string().datetime().optional().nullable(),
  acquisitionSource: z.string().max(120).optional().nullable(),
  campaignReference: z.string().max(140).optional().nullable(),
  policySnapshot: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
})

const itemBodySchema = z.object({
  itemType: z.enum(['sellable', 'custom_fee', 'custom_subject']),
  sellableId: z.string().optional().nullable(),
  customSubjectType: z.string().max(80).optional().nullable(),
  customSubjectId: z.string().max(140).optional().nullable(),
  displayName: z.string().min(1).max(255),
  description: z.string().optional().nullable(),
  quantity: z.number().int().min(1).default(1),
  unitPriceMinor: z.number().int().min(0).default(0),
  lineSubtotalMinor: z.number().int().min(0),
  taxMinor: z.number().int().min(0).default(0),
  feeMinor: z.number().int().min(0).default(0),
  discountMinor: z.number().int().min(0).default(0),
  totalMinor: z.number().int().min(0),
  currency: z.string().length(3).default('USD'),
  requestedStartAt: z.string().datetime().optional().nullable(),
  requestedEndAt: z.string().datetime().optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
})

const eventBodySchema = z.object({
  eventType: z.enum(['started', 'item_added', 'item_updated', 'item_removed', 'coupon_applied', 'coupon_removed', 'payment_started', 'payment_failed', 'abandoned', 'recovery_sent', 'recovered', 'completed', 'expired', 'cancelled']),
  eventAt: z.string().datetime().optional(),
  actorUserId: z.string().optional().nullable(),
  actorSubjectType: z.string().max(80).optional().nullable(),
  actorSubjectId: z.string().max(140).optional().nullable(),
  requestKey: z.string().max(140).optional().nullable(),
  payload: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
})

const recoveryBodySchema = z.object({
  channel: z.enum(['email', 'sms', 'push', 'manual', 'link']),
  expiresAt: z.string().datetime().optional().nullable(),
  maxUseCount: z.number().int().min(1).default(1),
  discountCampaignId: z.string().optional().nullable(),
  deliveryTarget: z.string().max(255).optional().nullable(),
  requestKey: z.string().max(140).optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
})

const repriceBodySchema = z.object({
  idempotencyKey: z.string().max(200).optional().nullable(),
})

function hashToken(rawToken: string) {
  return crypto.createHash('sha256').update(rawToken).digest('hex')
}

export const checkoutRoutes = new Hono()

checkoutRoutes.get('/bizes/:bizId/checkout-sessions', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.read', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const rows = await db.query.checkoutSessions.findMany({
    where: eq(checkoutSessions.bizId, bizId),
    orderBy: [desc(checkoutSessions.lastActivityAt)],
  })
  return ok(c, rows)
})

checkoutRoutes.post('/bizes/:bizId/checkout-sessions', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const parsed = sessionBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  const rowResult = await createCheckoutRow(c, bizId, 'checkoutSessions', {
    bizId,
    ...parsed.data,
    startedAt: parsed.data.startedAt ? new Date(parsed.data.startedAt) : undefined,
    lastActivityAt: parsed.data.lastActivityAt ? new Date(parsed.data.lastActivityAt) : undefined,
    abandonedAt: parsed.data.abandonedAt ? new Date(parsed.data.abandonedAt) : null,
    recoveredAt: parsed.data.recoveredAt ? new Date(parsed.data.recoveredAt) : null,
    completedAt: parsed.data.completedAt ? new Date(parsed.data.completedAt) : null,
    expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
    cancelledAt: parsed.data.cancelledAt ? new Date(parsed.data.cancelledAt) : null,
    policySnapshot: parsed.data.policySnapshot ?? {},
    metadata: parsed.data.metadata ?? {},
  }, {
    subjectType: 'checkout_session',
    subjectId: bizId,
    displayName: 'create checkout session',
    source: 'routes.checkout.createSession',
  })
  if (!rowResult.ok) return fail(c, rowResult.code, rowResult.message, rowResult.httpStatus, rowResult.details)
  if (!rowResult.row) return fail(c, 'ACTION_EXECUTION_FAILED', 'Checkout session create returned no row.', 500)
  const row = rowResult.row
  return ok(c, row, 201)
})

checkoutRoutes.get('/bizes/:bizId/checkout-sessions/:checkoutSessionId', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.read', { bizIdParam: 'bizId' }), async (c) => {
  const { bizId, checkoutSessionId } = c.req.param()
  const [session, items, events, recoveries] = await Promise.all([
    db.query.checkoutSessions.findFirst({ where: and(eq(checkoutSessions.bizId, bizId), eq(checkoutSessions.id, checkoutSessionId)) }),
    db.query.checkoutSessionItems.findMany({ where: and(eq(checkoutSessionItems.bizId, bizId), eq(checkoutSessionItems.checkoutSessionId, checkoutSessionId)), orderBy: [asc(checkoutSessionItems.id)] }),
    db.query.checkoutSessionEvents.findMany({ where: and(eq(checkoutSessionEvents.bizId, bizId), eq(checkoutSessionEvents.checkoutSessionId, checkoutSessionId)), orderBy: [asc(checkoutSessionEvents.eventAt)] }),
    db.query.checkoutRecoveryLinks.findMany({ where: and(eq(checkoutRecoveryLinks.bizId, bizId), eq(checkoutRecoveryLinks.checkoutSessionId, checkoutSessionId)), orderBy: [desc(checkoutRecoveryLinks.issuedAt)] }),
  ])
  if (!session) return fail(c, 'NOT_FOUND', 'Checkout session not found.', 404)
  return ok(c, { session, items, events, recoveries })
})

checkoutRoutes.post('/bizes/:bizId/checkout-sessions/:checkoutSessionId/items', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const { bizId, checkoutSessionId } = c.req.param()
  const parsed = itemBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  if (parsed.data.itemType === 'sellable' && !parsed.data.sellableId) return fail(c, 'VALIDATION_ERROR', 'sellableId is required for sellable items.', 400)
  if (parsed.data.itemType === 'custom_subject' && (!parsed.data.customSubjectType || !parsed.data.customSubjectId)) return fail(c, 'VALIDATION_ERROR', 'customSubjectType and customSubjectId are required for custom-subject items.', 400)
  if (parsed.data.sellableId) {
    const sellable = await db.query.sellables.findFirst({ where: and(eq(sellables.bizId, bizId), eq(sellables.id, parsed.data.sellableId)) })
    if (!sellable) return fail(c, 'NOT_FOUND', 'Sellable not found.', 404)
  }
  const rowResult = await createCheckoutRow(c, bizId, 'checkoutSessionItems', {
    bizId,
    checkoutSessionId,
    ...parsed.data,
    requestedStartAt: parsed.data.requestedStartAt ? new Date(parsed.data.requestedStartAt) : null,
    requestedEndAt: parsed.data.requestedEndAt ? new Date(parsed.data.requestedEndAt) : null,
    metadata: parsed.data.metadata ?? {},
  }, {
    subjectType: 'checkout_session_item',
    subjectId: checkoutSessionId,
    displayName: parsed.data.displayName,
    source: 'routes.checkout.createSessionItem',
  })
  if (!rowResult.ok) return fail(c, rowResult.code, rowResult.message, rowResult.httpStatus, rowResult.details)
  if (!rowResult.row) return fail(c, 'ACTION_EXECUTION_FAILED', 'Checkout item create returned no row.', 500)
  const row = rowResult.row
  return ok(c, row, 201)
})

checkoutRoutes.post('/bizes/:bizId/checkout-sessions/:checkoutSessionId/reprice', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const { bizId, checkoutSessionId } = c.req.param()
  const parsed = repriceBodySchema.safeParse(await c.req.json().catch(() => ({})))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  try {
    const result = await repriceCheckoutSessionWithAutomation({
      bizId,
      checkoutSessionId,
      idempotencyKey: parsed.data.idempotencyKey ?? null,
    })
    return ok(c, result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to reprice checkout session.'
    if (message.toLowerCase().includes('not found')) {
      return fail(c, 'NOT_FOUND', 'Checkout session not found.', 404)
    }
    return fail(c, 'AUTOMATION_HOOK_EXECUTION_FAILED', message, 409)
  }
})

checkoutRoutes.post('/bizes/:bizId/checkout-sessions/:checkoutSessionId/events', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const { bizId, checkoutSessionId } = c.req.param()
  const parsed = eventBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  if (parsed.data.requestKey) {
    const existing = await db.query.checkoutSessionEvents.findFirst({
      where: and(eq(checkoutSessionEvents.bizId, bizId), eq(checkoutSessionEvents.requestKey, parsed.data.requestKey)),
    })
    if (existing) return ok(c, existing)
  }
  const rowResult = await createCheckoutRow(c, bizId, 'checkoutSessionEvents', {
    bizId,
    checkoutSessionId,
    ...parsed.data,
    eventAt: parsed.data.eventAt ? new Date(parsed.data.eventAt) : undefined,
    payload: parsed.data.payload ?? {},
    metadata: parsed.data.metadata ?? {},
  }, {
    subjectType: 'checkout_session_event',
    subjectId: checkoutSessionId,
    displayName: parsed.data.eventType,
    source: 'routes.checkout.createEvent',
  })
  if (!rowResult.ok) return fail(c, rowResult.code, rowResult.message, rowResult.httpStatus, rowResult.details)
  if (!rowResult.row) return fail(c, 'ACTION_EXECUTION_FAILED', 'Checkout event create returned no row.', 500)
  const row = rowResult.row
  const sessionUpdateResult = await updateCheckoutRow(c, bizId, 'checkoutSessions', checkoutSessionId, {
    status: parsed.data.eventType === 'abandoned'
      ? 'abandoned'
      : parsed.data.eventType === 'recovery_sent'
        ? 'recovery_sent'
        : parsed.data.eventType === 'recovered'
          ? 'recovered'
          : parsed.data.eventType === 'completed'
            ? 'completed'
            : parsed.data.eventType === 'expired'
              ? 'expired'
              : parsed.data.eventType === 'cancelled'
                ? 'cancelled'
                : undefined,
    lastActivityAt: row.eventAt as Date,
    abandonedAt: parsed.data.eventType === 'abandoned' ? (row.eventAt as Date) : undefined,
    recoveredAt: parsed.data.eventType === 'recovered' ? (row.eventAt as Date) : undefined,
    completedAt: parsed.data.eventType === 'completed' ? (row.eventAt as Date) : undefined,
    cancelledAt: parsed.data.eventType === 'cancelled' ? (row.eventAt as Date) : undefined,
  }, {
    subjectType: 'checkout_session',
    subjectId: checkoutSessionId,
    displayName: 'sync status from event',
    source: 'routes.checkout.syncStatusFromEvent',
  })
  if (!sessionUpdateResult.ok) return fail(c, sessionUpdateResult.code, sessionUpdateResult.message, sessionUpdateResult.httpStatus, sessionUpdateResult.details)
  return ok(c, row, 201)
})

checkoutRoutes.get('/bizes/:bizId/checkout-sessions/:checkoutSessionId/recovery-links', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.read', { bizIdParam: 'bizId' }), async (c) => {
  const { bizId, checkoutSessionId } = c.req.param()
  const rows = await db.query.checkoutRecoveryLinks.findMany({
    where: and(eq(checkoutRecoveryLinks.bizId, bizId), eq(checkoutRecoveryLinks.checkoutSessionId, checkoutSessionId)),
    orderBy: [desc(checkoutRecoveryLinks.issuedAt)],
  })
  return ok(c, rows)
})

checkoutRoutes.post('/bizes/:bizId/checkout-sessions/:checkoutSessionId/recovery-links', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const { bizId, checkoutSessionId } = c.req.param()
  const parsed = recoveryBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  if (parsed.data.requestKey) {
    const existing = await db.query.checkoutRecoveryLinks.findFirst({
      where: and(eq(checkoutRecoveryLinks.bizId, bizId), eq(checkoutRecoveryLinks.requestKey, parsed.data.requestKey)),
    })
    if (existing) return ok(c, { ...existing, token: { rawToken: null, tokenPreview: existing.tokenPreview } })
  }
  if (parsed.data.discountCampaignId) {
    const campaign = await db.query.discountCampaigns.findFirst({
      where: and(eq(discountCampaigns.bizId, bizId), eq(discountCampaigns.id, parsed.data.discountCampaignId)),
    })
    if (!campaign) return fail(c, 'NOT_FOUND', 'Discount campaign not found.', 404)
  }
  const rawToken = `recovery_${crypto.randomUUID().replace(/-/g, '')}`
  const rowResult = await createCheckoutRow(c, bizId, 'checkoutRecoveryLinks', {
    bizId,
    checkoutSessionId,
    ...parsed.data,
    tokenHash: hashToken(rawToken),
    tokenPreview: rawToken.slice(-8),
    expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
    metadata: parsed.data.metadata ?? {},
  }, {
    subjectType: 'checkout_recovery_link',
    subjectId: checkoutSessionId,
    displayName: 'create recovery link',
    source: 'routes.checkout.createRecoveryLink',
  })
  if (!rowResult.ok) return fail(c, rowResult.code, rowResult.message, rowResult.httpStatus, rowResult.details)
  if (!rowResult.row) return fail(c, 'ACTION_EXECUTION_FAILED', 'Recovery link create returned no row.', 500)
  const row = rowResult.row
  const recoveryStatusResult = await updateCheckoutRow(c, bizId, 'checkoutSessions', checkoutSessionId, { status: 'recovery_sent' }, {
    subjectType: 'checkout_session',
    subjectId: checkoutSessionId,
    displayName: 'mark recovery sent',
    source: 'routes.checkout.markRecoverySent',
  })
  if (!recoveryStatusResult.ok) return fail(c, recoveryStatusResult.code, recoveryStatusResult.message, recoveryStatusResult.httpStatus, recoveryStatusResult.details)
  return ok(c, { ...row, token: { rawToken, tokenPreview: row.tokenPreview } }, 201)
})

checkoutRoutes.post('/public/bizes/:bizId/checkout-recovery/resolve', async (c) => {
  const bizId = c.req.param('bizId')
  const parsed = z.object({ token: z.string().min(1) }).safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  const row = await db.query.checkoutRecoveryLinks.findFirst({
    where: and(eq(checkoutRecoveryLinks.bizId, bizId), eq(checkoutRecoveryLinks.tokenHash, hashToken(parsed.data.token))),
  })
  if (!row) return fail(c, 'NOT_FOUND', 'Recovery link not found.', 404)
  const session = await db.query.checkoutSessions.findFirst({
    where: and(eq(checkoutSessions.bizId, bizId), eq(checkoutSessions.id, row.checkoutSessionId)),
  })
  return ok(c, { recovery: row, checkoutSession: session })
})

checkoutRoutes.post('/public/bizes/:bizId/checkout-recovery/consume', async (c) => {
  const bizId = c.req.param('bizId')
  const parsed = z.object({ token: z.string().min(1) }).safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  const row = await db.query.checkoutRecoveryLinks.findFirst({
    where: and(eq(checkoutRecoveryLinks.bizId, bizId), eq(checkoutRecoveryLinks.tokenHash, hashToken(parsed.data.token))),
  })
  if (!row) return fail(c, 'NOT_FOUND', 'Recovery link not found.', 404)
  if (row.status !== 'active') return fail(c, 'CONFLICT', 'Recovery link is not active.', 409)
  if (row.expiresAt && row.expiresAt.getTime() < Date.now()) return fail(c, 'CONFLICT', 'Recovery link has expired.', 409)
  if (row.usedCount >= row.maxUseCount) return fail(c, 'CONFLICT', 'Recovery link usage limit reached.', 409)
  const usedAt = new Date()
  const nextUsedCount = row.usedCount + 1
  const updatedResult = await updateCheckoutRow(c, bizId, 'checkoutRecoveryLinks', row.id, {
    usedCount: nextUsedCount,
    usedAt,
    status: nextUsedCount >= row.maxUseCount ? 'used' : row.status,
  }, {
    subjectType: 'checkout_recovery_link',
    subjectId: row.id,
    displayName: 'consume recovery link',
    source: 'routes.checkout.consumeRecoveryLink',
    system: true,
  })
  if (!updatedResult.ok) return fail(c, updatedResult.code, updatedResult.message, updatedResult.httpStatus, updatedResult.details)
  if (!updatedResult.row) return fail(c, 'ACTION_EXECUTION_FAILED', 'Recovery link update returned no row.', 500)
  const updated = updatedResult.row
  const recoveredSessionResult = await updateCheckoutRow(c, bizId, 'checkoutSessions', row.checkoutSessionId, {
    status: 'recovered',
    recoveredAt: usedAt,
    lastActivityAt: usedAt,
  }, {
    subjectType: 'checkout_session',
    subjectId: row.checkoutSessionId,
    displayName: 'mark recovered from link',
    source: 'routes.checkout.consumeRecoveryMarkSession',
    system: true,
  })
  if (!recoveredSessionResult.ok) return fail(c, recoveredSessionResult.code, recoveredSessionResult.message, recoveredSessionResult.httpStatus, recoveredSessionResult.details)
  const eventResult = await createCheckoutRow(c, bizId, 'checkoutSessionEvents', {
    bizId,
    checkoutSessionId: row.checkoutSessionId,
    eventType: 'recovered',
    eventAt: usedAt,
    payload: { recoveryLinkId: row.id },
    metadata: { source: 'checkout-recovery-consume' },
  }, {
    subjectType: 'checkout_session_event',
    subjectId: row.checkoutSessionId,
    displayName: 'recovered',
    source: 'routes.checkout.consumeRecoveryCreateEvent',
    system: true,
  })
  if (!eventResult.ok) return fail(c, eventResult.code, eventResult.message, eventResult.httpStatus, eventResult.details)
  if (!eventResult.row) return fail(c, 'ACTION_EXECUTION_FAILED', 'Recovery consume event create returned no row.', 500)
  const event = eventResult.row
  return ok(c, { recovery: updated, event })
})
