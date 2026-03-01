/**
 * Referral and attribution routes.
 *
 * ELI5:
 * A referral program is the reusable incentive plan.
 * A referral link is one shareable URL/code.
 * A click is one "someone tapped the link" fact.
 * An attribution is one "this booking counts because of that link" decision.
 * A reward grant is one "pay the referrer/referee this value" fact.
 *
 * Why this route exists:
 * - referrals should be provable through the API,
 * - growth/reporting sagas need deterministic reads and writes here,
 * - future customer UI needs one canonical referral contract.
 */

import { Hono } from 'hono'
import { and, asc, desc, eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import { randomUUID } from 'node:crypto'
import dbPackage from '@bizing/db'
import { requireAclPermission, requireAuth, requireBizAccess } from '../middleware/auth.js'
import { sanitizePlainText, sanitizeUnknown } from '../lib/sanitize.js'
import { fail, ok, parsePositiveInt } from './_api.js'

const {
  db,
  referralPrograms,
  referralEvents,
  rewardGrants,
  referralLinks,
  referralLinkClicks,
  referralAttributions,
} = dbPackage

function pagination(input: { page?: string; perPage?: string }) {
  const page = parsePositiveInt(input.page, 1)
  const perPage = Math.min(parsePositiveInt(input.perPage, 20), 100)
  return { page, perPage, offset: (page - 1) * perPage }
}

function cleanMetadata(value: Record<string, unknown> | undefined) {
  return sanitizeUnknown(value ?? {}) as Record<string, unknown>
}

const listProgramQuerySchema = z.object({
  page: z.string().optional(),
  perPage: z.string().optional(),
  isActive: z.enum(['true', 'false']).optional(),
})

const createProgramBodySchema = z.object({
  name: z.string().min(1).max(220),
  slug: z.string().min(1).max(140),
  isActive: z.boolean().default(true),
  startsAt: z.string().datetime().optional().nullable(),
  endsAt: z.string().datetime().optional().nullable(),
  policy: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
})

const updateProgramBodySchema = createProgramBodySchema.partial()

const listLinkQuerySchema = z.object({
  page: z.string().optional(),
  perPage: z.string().optional(),
  referralProgramId: z.string().optional(),
  ownerUserId: z.string().optional(),
  status: z.enum(['draft', 'active', 'inactive', 'archived']).optional(),
})

const createLinkBodySchema = z.object({
  referralProgramId: z.string().min(1),
  linkCode: z.string().min(1).max(140).optional(),
  status: z.enum(['draft', 'active', 'inactive', 'archived']).default('active'),
  ownerUserId: z.string().optional(),
  ownerGroupAccountId: z.string().optional(),
  ownerSubjectType: z.string().optional(),
  ownerSubjectId: z.string().optional(),
  sellableId: z.string().optional(),
  offerVersionId: z.string().optional(),
  targetSubjectType: z.string().optional(),
  targetSubjectId: z.string().optional(),
  startsAt: z.string().datetime().optional().nullable(),
  endsAt: z.string().datetime().optional().nullable(),
  attributionModel: z.string().max(60).default('last_touch'),
  attributionWindowMinutes: z.number().int().positive().default(10080),
  metadata: z.record(z.unknown()).optional(),
})

function makeReferralCode() {
  return `REF-${randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase()}`
}

const listClickQuerySchema = z.object({
  page: z.string().optional(),
  perPage: z.string().optional(),
  referralLinkId: z.string().optional(),
  sessionKey: z.string().optional(),
})

const createClickBodySchema = z.object({
  referralLinkId: z.string().min(1),
  clickedAt: z.string().datetime().optional().nullable(),
  visitorUserId: z.string().optional().nullable(),
  sessionKey: z.string().max(140).optional().nullable(),
  ipHash: z.string().max(255).optional().nullable(),
  userAgentHash: z.string().max(255).optional().nullable(),
  sourceChannel: z.string().max(80).optional().nullable(),
  landingPath: z.string().max(1000).optional().nullable(),
  campaignParams: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
})

const listAttributionQuerySchema = z.object({
  page: z.string().optional(),
  perPage: z.string().optional(),
  referralLinkId: z.string().optional(),
  bookingOrderId: z.string().optional(),
  reasonCode: z.string().optional(),
})

const createAttributionBodySchema = z.object({
  referralLinkId: z.string().min(1),
  referralLinkClickId: z.string().optional().nullable(),
  referralEventId: z.string().optional().nullable(),
  bookingOrderId: z.string().optional().nullable(),
  crossBizOrderId: z.string().optional().nullable(),
  attributedAt: z.string().datetime().optional().nullable(),
  attributionModel: z.string().max(60).default('last_touch'),
  windowExpiresAt: z.string().datetime().optional().nullable(),
  isEligible: z.boolean().default(true),
  isRewardEligible: z.boolean().default(true),
  reasonCode: z.string().max(120).optional().nullable(),
  decisionDetails: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
})

const listRewardQuerySchema = z.object({
  page: z.string().optional(),
  perPage: z.string().optional(),
  referralProgramId: z.string().optional(),
  recipientUserId: z.string().optional(),
  status: z.enum(['pending', 'approved', 'granted', 'reversed', 'expired']).optional(),
})

const listPayoutStatementQuerySchema = z.object({
  referralProgramId: z.string().optional(),
  recipientUserId: z.string().optional(),
})

const createRewardBodySchema = z.object({
  referralProgramId: z.string().min(1),
  referralEventId: z.string().min(1),
  recipientUserId: z.string().min(1),
  status: z.enum(['pending', 'approved', 'granted', 'reversed', 'expired']).default('pending'),
  rewardType: z.string().min(1).max(80),
  amountMinor: z.number().int().min(0).default(0),
  currency: z.string().length(3).default('USD'),
  grantedAt: z.string().datetime().optional().nullable(),
  reversedAt: z.string().datetime().optional().nullable(),
  payoutReference: z.string().max(140).optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
})

const createEventBodySchema = z.object({
  referralProgramId: z.string().min(1),
  eventType: z.enum(['referral_created', 'qualified_purchase', 'converted', 'reward_granted', 'expired', 'reversed']),
  referrerUserId: z.string().optional().nullable(),
  referredUserId: z.string().optional().nullable(),
  bookingOrderId: z.string().optional().nullable(),
  crossBizOrderId: z.string().optional().nullable(),
  eventAt: z.string().datetime().optional().nullable(),
  payload: z.record(z.unknown()).optional(),
  actionRequestId: z.string().optional().nullable(),
  domainEventId: z.string().optional().nullable(),
  debugSnapshotId: z.string().optional().nullable(),
})

export const referralRoutes = new Hono()

referralRoutes.get(
  '/bizes/:bizId/referral-programs',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = listProgramQuerySchema.safeParse(c.req.query())
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid query parameters.', 400, parsed.error.flatten())
    const pageInfo = pagination(parsed.data)
    const where = and(
      eq(referralPrograms.bizId, bizId),
      parsed.data.isActive === undefined ? undefined : eq(referralPrograms.isActive, parsed.data.isActive === 'true'),
    )
    const [rows, countRows] = await Promise.all([
      db.query.referralPrograms.findMany({
        where,
        orderBy: [asc(referralPrograms.name)],
        limit: pageInfo.perPage,
        offset: pageInfo.offset,
      }),
      db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(referralPrograms).where(where),
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

referralRoutes.post(
  '/bizes/:bizId/referral-programs',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = createProgramBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    const [created] = await db.insert(referralPrograms).values({
      bizId,
      name: sanitizePlainText(parsed.data.name),
      slug: sanitizePlainText(parsed.data.slug),
      isActive: parsed.data.isActive,
      startsAt: parsed.data.startsAt ? new Date(parsed.data.startsAt) : null,
      endsAt: parsed.data.endsAt ? new Date(parsed.data.endsAt) : null,
      policy: cleanMetadata(parsed.data.policy),
      metadata: cleanMetadata(parsed.data.metadata),
    }).returning()
    return ok(c, created, 201)
  },
)

referralRoutes.patch(
  '/bizes/:bizId/referral-programs/:programId',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const programId = c.req.param('programId')
    const parsed = updateProgramBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    const existing = await db.query.referralPrograms.findFirst({
      where: and(eq(referralPrograms.bizId, bizId), eq(referralPrograms.id, programId)),
    })
    if (!existing) return fail(c, 'NOT_FOUND', 'Referral program not found.', 404)
    const [updated] = await db.update(referralPrograms).set({
      name: parsed.data.name === undefined ? existing.name : sanitizePlainText(parsed.data.name),
      slug: parsed.data.slug === undefined ? existing.slug : sanitizePlainText(parsed.data.slug),
      isActive: parsed.data.isActive ?? existing.isActive,
      startsAt: parsed.data.startsAt === undefined ? existing.startsAt : (parsed.data.startsAt ? new Date(parsed.data.startsAt) : null),
      endsAt: parsed.data.endsAt === undefined ? existing.endsAt : (parsed.data.endsAt ? new Date(parsed.data.endsAt) : null),
      policy: parsed.data.policy === undefined ? existing.policy : cleanMetadata(parsed.data.policy),
      metadata: parsed.data.metadata === undefined ? existing.metadata : cleanMetadata(parsed.data.metadata),
    }).where(and(eq(referralPrograms.bizId, bizId), eq(referralPrograms.id, programId))).returning()
    return ok(c, updated)
  },
)

referralRoutes.get(
  '/bizes/:bizId/referral-links',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = listLinkQuerySchema.safeParse(c.req.query())
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid query parameters.', 400, parsed.error.flatten())
    const pageInfo = pagination(parsed.data)
    const where = and(
      eq(referralLinks.bizId, bizId),
      parsed.data.referralProgramId ? eq(referralLinks.referralProgramId, parsed.data.referralProgramId) : undefined,
      parsed.data.ownerUserId ? eq(referralLinks.ownerUserId, parsed.data.ownerUserId) : undefined,
      parsed.data.status ? eq(referralLinks.status, parsed.data.status) : undefined,
    )
    const [rows, countRows] = await Promise.all([
      db.query.referralLinks.findMany({
        where,
        orderBy: [desc(referralLinks.startsAt), asc(referralLinks.linkCode)],
        limit: pageInfo.perPage,
        offset: pageInfo.offset,
      }),
      db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(referralLinks).where(where),
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

referralRoutes.post(
  '/bizes/:bizId/referral-links',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = createLinkBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    const [created] = await db.insert(referralLinks).values({
      bizId,
      referralProgramId: parsed.data.referralProgramId,
      linkCode: sanitizePlainText(parsed.data.linkCode ?? makeReferralCode()),
      status: parsed.data.status,
      ownerUserId: parsed.data.ownerUserId ?? null,
      ownerGroupAccountId: parsed.data.ownerGroupAccountId ?? null,
      ownerSubjectType: parsed.data.ownerSubjectType ?? null,
      ownerSubjectId: parsed.data.ownerSubjectId ?? null,
      sellableId: parsed.data.sellableId ?? null,
      offerVersionId: parsed.data.offerVersionId ?? null,
      targetSubjectType: parsed.data.targetSubjectType ?? null,
      targetSubjectId: parsed.data.targetSubjectId ?? null,
      startsAt: parsed.data.startsAt ? new Date(parsed.data.startsAt) : null,
      endsAt: parsed.data.endsAt ? new Date(parsed.data.endsAt) : null,
      attributionModel: parsed.data.attributionModel,
      attributionWindowMinutes: parsed.data.attributionWindowMinutes,
      metadata: cleanMetadata(parsed.data.metadata),
    }).returning()
    return ok(c, created, 201)
  },
)

referralRoutes.get(
  '/bizes/:bizId/referral-link-clicks',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = listClickQuerySchema.safeParse(c.req.query())
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid query parameters.', 400, parsed.error.flatten())
    const pageInfo = pagination(parsed.data)
    const where = and(
      eq(referralLinkClicks.bizId, bizId),
      parsed.data.referralLinkId ? eq(referralLinkClicks.referralLinkId, parsed.data.referralLinkId) : undefined,
      parsed.data.sessionKey ? eq(referralLinkClicks.sessionKey, parsed.data.sessionKey) : undefined,
    )
    const [rows, countRows] = await Promise.all([
      db.query.referralLinkClicks.findMany({
        where,
        orderBy: [desc(referralLinkClicks.clickedAt)],
        limit: pageInfo.perPage,
        offset: pageInfo.offset,
      }),
      db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(referralLinkClicks).where(where),
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

referralRoutes.post(
  '/bizes/:bizId/referral-link-clicks',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.write', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = createClickBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    const [created] = await db.insert(referralLinkClicks).values({
      bizId,
      referralLinkId: parsed.data.referralLinkId,
      clickedAt: parsed.data.clickedAt ? new Date(parsed.data.clickedAt) : new Date(),
      visitorUserId: parsed.data.visitorUserId ?? null,
      sessionKey: parsed.data.sessionKey ?? null,
      ipHash: parsed.data.ipHash ?? null,
      userAgentHash: parsed.data.userAgentHash ?? null,
      sourceChannel: parsed.data.sourceChannel ?? null,
      landingPath: parsed.data.landingPath ?? null,
      campaignParams: cleanMetadata(parsed.data.campaignParams),
      metadata: cleanMetadata(parsed.data.metadata),
    }).returning()
    return ok(c, created, 201)
  },
)

referralRoutes.get(
  '/bizes/:bizId/referral-attributions',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = listAttributionQuerySchema.safeParse(c.req.query())
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid query parameters.', 400, parsed.error.flatten())
    const pageInfo = pagination(parsed.data)
    const where = and(
      eq(referralAttributions.bizId, bizId),
      parsed.data.referralLinkId ? eq(referralAttributions.referralLinkId, parsed.data.referralLinkId) : undefined,
      parsed.data.bookingOrderId ? eq(referralAttributions.bookingOrderId, parsed.data.bookingOrderId) : undefined,
      parsed.data.reasonCode ? eq(referralAttributions.reasonCode, parsed.data.reasonCode) : undefined,
    )
    const [rows, countRows] = await Promise.all([
      db.query.referralAttributions.findMany({
        where,
        orderBy: [desc(referralAttributions.attributedAt)],
        limit: pageInfo.perPage,
        offset: pageInfo.offset,
      }),
      db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(referralAttributions).where(where),
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

referralRoutes.post(
  '/bizes/:bizId/referral-attributions',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = createAttributionBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    const [created] = await db.insert(referralAttributions).values({
      bizId,
      referralLinkId: parsed.data.referralLinkId,
      referralLinkClickId: parsed.data.referralLinkClickId ?? null,
      referralEventId: parsed.data.referralEventId ?? null,
      bookingOrderId: parsed.data.bookingOrderId ?? null,
      crossBizOrderId: parsed.data.crossBizOrderId ?? null,
      attributedAt: parsed.data.attributedAt ? new Date(parsed.data.attributedAt) : new Date(),
      attributionModel: parsed.data.attributionModel,
      windowExpiresAt: parsed.data.windowExpiresAt ? new Date(parsed.data.windowExpiresAt) : null,
      isEligible: parsed.data.isEligible,
      isRewardEligible: parsed.data.isRewardEligible,
      reasonCode: parsed.data.reasonCode ?? null,
      decisionDetails: cleanMetadata(parsed.data.decisionDetails),
      metadata: cleanMetadata(parsed.data.metadata),
    }).returning()
    return ok(c, created, 201)
  },
)

referralRoutes.get(
  '/bizes/:bizId/referral-events',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const pageInfo = pagination(c.req.query())
    const rows = await db.query.referralEvents.findMany({
      where: eq(referralEvents.bizId, bizId),
      orderBy: [desc(referralEvents.eventAt)],
      limit: pageInfo.perPage,
      offset: pageInfo.offset,
    })
    return ok(c, rows)
  },
)

referralRoutes.post(
  '/bizes/:bizId/referral-events',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = createEventBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    const [created] = await db.insert(referralEvents).values({
      bizId,
      referralProgramId: parsed.data.referralProgramId,
      eventType: parsed.data.eventType,
      referrerUserId: parsed.data.referrerUserId ?? null,
      referredUserId: parsed.data.referredUserId ?? null,
      bookingOrderId: parsed.data.bookingOrderId ?? null,
      crossBizOrderId: parsed.data.crossBizOrderId ?? null,
      eventAt: parsed.data.eventAt ? new Date(parsed.data.eventAt) : new Date(),
      payload: cleanMetadata(parsed.data.payload),
      actionRequestId: parsed.data.actionRequestId ?? null,
      domainEventId: parsed.data.domainEventId ?? null,
      debugSnapshotId: parsed.data.debugSnapshotId ?? null,
    }).returning()
    return ok(c, created, 201)
  },
)

referralRoutes.get(
  '/bizes/:bizId/reward-grants',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = listRewardQuerySchema.safeParse(c.req.query())
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid query parameters.', 400, parsed.error.flatten())
    const pageInfo = pagination(parsed.data)
    const where = and(
      eq(rewardGrants.bizId, bizId),
      parsed.data.referralProgramId ? eq(rewardGrants.referralProgramId, parsed.data.referralProgramId) : undefined,
      parsed.data.recipientUserId ? eq(rewardGrants.recipientUserId, parsed.data.recipientUserId) : undefined,
      parsed.data.status ? eq(rewardGrants.status, parsed.data.status) : undefined,
    )
    const [rows, countRows] = await Promise.all([
      db.query.rewardGrants.findMany({
        where,
        orderBy: [desc(rewardGrants.grantedAt), desc(rewardGrants.id)],
        limit: pageInfo.perPage,
        offset: pageInfo.offset,
      }),
      db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(rewardGrants).where(where),
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

referralRoutes.post(
  '/bizes/:bizId/reward-grants',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = createRewardBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    const [created] = await db.insert(rewardGrants).values({
      bizId,
      referralProgramId: parsed.data.referralProgramId,
      referralEventId: parsed.data.referralEventId,
      recipientUserId: parsed.data.recipientUserId,
      status: parsed.data.status,
      rewardType: sanitizePlainText(parsed.data.rewardType),
      amountMinor: parsed.data.amountMinor,
      currency: parsed.data.currency.toUpperCase(),
      grantedAt: parsed.data.grantedAt ? new Date(parsed.data.grantedAt) : null,
      reversedAt: parsed.data.reversedAt ? new Date(parsed.data.reversedAt) : null,
      payoutReference: parsed.data.payoutReference ?? null,
      metadata: cleanMetadata(parsed.data.metadata),
    }).returning()
    return ok(c, created, 201)
  },
)

referralRoutes.get(
  '/bizes/:bizId/referral-payout-statements',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = listPayoutStatementQuerySchema.safeParse(c.req.query())
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid query parameters.', 400, parsed.error.flatten())

    const grants = await db.query.rewardGrants.findMany({
      where: and(
        eq(rewardGrants.bizId, bizId),
        parsed.data.referralProgramId ? eq(rewardGrants.referralProgramId, parsed.data.referralProgramId) : undefined,
        parsed.data.recipientUserId ? eq(rewardGrants.recipientUserId, parsed.data.recipientUserId) : undefined,
      ),
      orderBy: [desc(rewardGrants.grantedAt), desc(rewardGrants.id)],
    })

    const byRecipient = new Map<string, {
      recipientUserId: string
      referralProgramIds: Set<string>
      currencies: Set<string>
      grantedMinor: number
      reversedMinor: number
      pendingMinor: number
      approvedMinor: number
      rewardCount: number
      payoutReferences: Set<string>
      latestGrantedAt: Date | null
      grants: Array<typeof rewardGrants.$inferSelect>
    }>()

    for (const grant of grants) {
      const recipientUserId = grant.recipientUserId ?? 'unknown'
      const current = byRecipient.get(recipientUserId) ?? {
        recipientUserId,
        referralProgramIds: new Set<string>(),
        currencies: new Set<string>(),
        grantedMinor: 0,
        reversedMinor: 0,
        pendingMinor: 0,
        approvedMinor: 0,
        rewardCount: 0,
        payoutReferences: new Set<string>(),
        latestGrantedAt: null,
        grants: [],
      }
      current.rewardCount += 1
      current.referralProgramIds.add(grant.referralProgramId)
      current.currencies.add(grant.currency)
      if (grant.payoutReference) current.payoutReferences.add(grant.payoutReference)
      if (grant.grantedAt && (!current.latestGrantedAt || grant.grantedAt > current.latestGrantedAt)) {
        current.latestGrantedAt = grant.grantedAt
      }
      if (grant.status === 'granted') current.grantedMinor += grant.amountMinor
      if (grant.status === 'reversed') current.reversedMinor += grant.amountMinor
      if (grant.status === 'pending') current.pendingMinor += grant.amountMinor
      if (grant.status === 'approved') current.approvedMinor += grant.amountMinor
      current.grants.push(grant)
      byRecipient.set(recipientUserId, current)
    }

    const rows = Array.from(byRecipient.values()).map((row) => ({
      recipientUserId: row.recipientUserId,
      referralProgramIds: Array.from(row.referralProgramIds).sort(),
      currencies: Array.from(row.currencies).sort(),
      rewardCount: row.rewardCount,
      grantedMinor: row.grantedMinor,
      reversedMinor: row.reversedMinor,
      pendingMinor: row.pendingMinor,
      approvedMinor: row.approvedMinor,
      netEarnedMinor: row.grantedMinor - row.reversedMinor,
      payoutReferences: Array.from(row.payoutReferences).sort(),
      latestGrantedAt: row.latestGrantedAt?.toISOString() ?? null,
      grants: row.grants,
    }))

    return ok(c, rows)
  },
)

referralRoutes.get(
  '/bizes/:bizId/referral-leaderboard',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const [links, events, grants] = await Promise.all([
      db.query.referralLinks.findMany({
        where: eq(referralLinks.bizId, bizId),
        columns: { id: true, ownerUserId: true, linkCode: true, metadata: true },
      }),
      db.query.referralEvents.findMany({
        where: eq(referralEvents.bizId, bizId),
        columns: { id: true, referrerUserId: true, referredUserId: true, eventType: true, payload: true },
      }),
      db.query.rewardGrants.findMany({
        where: eq(rewardGrants.bizId, bizId),
        columns: { id: true, recipientUserId: true, rewardType: true, amountMinor: true, status: true },
      }),
    ])

    const byUser = new Map<string, {
      ownerUserId: string
      linkCount: number
      clickCount: number
      conversionCount: number
      rewardMinor: number
      rewardTypes: Set<string>
    }>()

    for (const link of links) {
      if (!link.ownerUserId) continue
      const current = byUser.get(link.ownerUserId) ?? {
        ownerUserId: link.ownerUserId,
        linkCount: 0,
        clickCount: 0,
        conversionCount: 0,
        rewardMinor: 0,
        rewardTypes: new Set<string>(),
      }
      current.linkCount += 1
      current.clickCount += Number((link.metadata as Record<string, unknown> | null)?.shareCount ?? 0)
      byUser.set(link.ownerUserId, current)
    }

    for (const event of events) {
      if (!event.referrerUserId) continue
      const current = byUser.get(event.referrerUserId) ?? {
        ownerUserId: event.referrerUserId,
        linkCount: 0,
        clickCount: 0,
        conversionCount: 0,
        rewardMinor: 0,
        rewardTypes: new Set<string>(),
      }
      if (event.eventType === 'converted' || event.eventType === 'qualified_purchase') current.conversionCount += 1
      if (event.eventType === 'referral_created') {
        current.clickCount += Number((event.payload as Record<string, unknown> | null)?.clickCount ?? 0)
      }
      byUser.set(event.referrerUserId, current)
    }

    for (const grant of grants) {
      if (!grant.recipientUserId) continue
      const current = byUser.get(grant.recipientUserId) ?? {
        ownerUserId: grant.recipientUserId,
        linkCount: 0,
        clickCount: 0,
        conversionCount: 0,
        rewardMinor: 0,
        rewardTypes: new Set<string>(),
      }
      current.rewardMinor += grant.amountMinor
      current.rewardTypes.add(grant.rewardType)
      byUser.set(grant.recipientUserId, current)
    }

    const rows = Array.from(byUser.values())
      .map((row) => ({
        ownerUserId: row.ownerUserId,
        linkCount: row.linkCount,
        clickCount: row.clickCount,
        conversionCount: row.conversionCount,
        rewardMinor: row.rewardMinor,
        rewardTypes: Array.from(row.rewardTypes.values()).sort(),
      }))
      .sort((a, b) => b.conversionCount - a.conversionCount || b.rewardMinor - a.rewardMinor)

    return ok(c, rows)
  },
)

referralRoutes.get(
  '/bizes/:bizId/referral-status',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const ownerUserId = c.req.query('ownerUserId')
    if (!ownerUserId) return fail(c, 'VALIDATION_ERROR', 'ownerUserId is required.', 400)

    const [links, clicks, attributions, events, grants] = await Promise.all([
      db.query.referralLinks.findMany({
        where: and(eq(referralLinks.bizId, bizId), eq(referralLinks.ownerUserId, ownerUserId)),
      }),
      db.query.referralLinkClicks.findMany({
        where: eq(referralLinkClicks.bizId, bizId),
      }),
      db.query.referralAttributions.findMany({
        where: eq(referralAttributions.bizId, bizId),
      }),
      db.query.referralEvents.findMany({
        where: and(eq(referralEvents.bizId, bizId), eq(referralEvents.referrerUserId, ownerUserId)),
      }),
      db.query.rewardGrants.findMany({
        where: and(eq(rewardGrants.bizId, bizId), eq(rewardGrants.recipientUserId, ownerUserId)),
      }),
    ])

    const linkIds = new Set(links.map((row) => row.id))
    const clickRows = clicks.filter((row) => linkIds.has(row.referralLinkId))
    const attributionRows = attributions.filter((row) => linkIds.has(row.referralLinkId))

    return ok(c, {
      ownerUserId,
      links,
      stats: {
        linkCount: links.length,
        clickCount: clickRows.length,
        attributionCount: attributionRows.length,
        conversionCount: events.filter((row) => row.eventType === 'converted' || row.eventType === 'qualified_purchase').length,
        rewardGrantCount: grants.length,
        rewardMinor: grants.reduce((sum, row) => sum + row.amountMinor, 0),
      },
      rewardTypes: Array.from(new Set(grants.map((row) => row.rewardType))).sort(),
      latestEvent: events.sort((a, b) => b.eventAt.getTime() - a.eventAt.getTime())[0] ?? null,
    })
  },
)
