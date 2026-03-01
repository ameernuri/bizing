/**
 * Promotion and discount routes.
 *
 * ELI5:
 * A promotion is the reusable rulebook for "how do we discount this?"
 * A discount code is one concrete redeemable code that points at that rulebook.
 * A redemption is one historical "this discount was actually used" fact.
 *
 * Why this route exists:
 * - the schema already has a clean promotions backbone,
 * - sagas and future UI need a real API contract instead of direct DB reads,
 * - operators need to manage campaigns, codes, and usage through one place.
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
  discountCampaigns,
  discountCodes,
  discountRedemptions,
} = dbPackage

function pagination(input: { page?: string; perPage?: string }) {
  const page = parsePositiveInt(input.page, 1)
  const perPage = Math.min(parsePositiveInt(input.perPage, 20), 100)
  return { page, perPage, offset: (page - 1) * perPage }
}

function cleanMetadata(value: Record<string, unknown> | undefined) {
  return sanitizeUnknown(value ?? {}) as Record<string, unknown>
}

const campaignStatusSchema = z.enum(['draft', 'active', 'paused', 'expired', 'archived'])
const discountTypeSchema = z.enum(['percentage', 'fixed_amount', 'free_item', 'free_service'])
const discountScopeSchema = z.enum(['order', 'line_item', 'sellable', 'service_product', 'offer_version'])
const stackingModeSchema = z.enum(['exclusive', 'stackable', 'capped_stack'])
const redemptionStatusSchema = z.enum(['reserved', 'applied', 'voided', 'reversed'])

const listCampaignQuerySchema = z.object({
  page: z.string().optional(),
  perPage: z.string().optional(),
  status: campaignStatusSchema.optional(),
  discountType: discountTypeSchema.optional(),
})

const createCampaignBodySchema = z.object({
  bizExtensionInstallId: z.string().optional().nullable(),
  name: z.string().min(1).max(220),
  slug: z.string().min(1).max(140),
  status: campaignStatusSchema.default('draft'),
  discountType: discountTypeSchema,
  scope: discountScopeSchema.default('order'),
  stackingMode: stackingModeSchema.default('exclusive'),
  currency: z.string().length(3).default('USD'),
  percentOffBps: z.number().int().min(1).max(10000).optional(),
  fixedAmountMinor: z.number().int().min(0).optional(),
  maxDiscountMinor: z.number().int().min(0).optional(),
  minSubtotalMinor: z.number().int().min(0).default(0),
  maxTotalRedemptions: z.number().int().min(0).optional(),
  maxPerCustomer: z.number().int().min(0).optional(),
  firstTimeOnly: z.boolean().default(false),
  startsAt: z.string().datetime().optional().nullable(),
  endsAt: z.string().datetime().optional().nullable(),
  conditions: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
})

const updateCampaignBodySchema = createCampaignBodySchema.partial()

const listCodeQuerySchema = z.object({
  page: z.string().optional(),
  perPage: z.string().optional(),
  status: campaignStatusSchema.optional(),
  discountCampaignId: z.string().optional(),
})

const createCodeBodySchema = z.object({
  discountCampaignId: z.string().min(1),
  code: z.string().min(1).max(100).optional(),
  status: campaignStatusSchema.default('active'),
  startsAt: z.string().datetime().optional().nullable(),
  expiresAt: z.string().datetime().optional().nullable(),
  maxRedemptions: z.number().int().min(0).optional(),
  maxPerCustomer: z.number().int().min(0).optional(),
  redemptionCount: z.number().int().min(0).optional(),
  isSingleUse: z.boolean().default(false),
  metadata: z.record(z.unknown()).optional(),
})

const updateCodeBodySchema = createCodeBodySchema.partial()

const generateCodesBodySchema = z.object({
  count: z.number().int().min(1).max(200).default(10),
  prefix: z.string().min(1).max(20).default('PROMO'),
  status: campaignStatusSchema.default('active'),
  startsAt: z.string().datetime().optional().nullable(),
  expiresAt: z.string().datetime().optional().nullable(),
  maxRedemptions: z.number().int().min(0).optional(),
  maxPerCustomer: z.number().int().min(0).optional(),
  metadata: z.record(z.unknown()).optional(),
})

const listRedemptionQuerySchema = z.object({
  page: z.string().optional(),
  perPage: z.string().optional(),
  discountCampaignId: z.string().optional(),
  discountCodeId: z.string().optional(),
  bookingOrderId: z.string().optional(),
  customerUserId: z.string().optional(),
  status: redemptionStatusSchema.optional(),
})

const createRedemptionBodySchema = z.object({
  discountCampaignId: z.string().min(1),
  discountCodeId: z.string().optional().nullable(),
  bookingOrderId: z.string().optional().nullable(),
  bookingOrderLineId: z.string().optional().nullable(),
  customerUserId: z.string().optional().nullable(),
  status: redemptionStatusSchema.default('applied'),
  currency: z.string().length(3).default('USD'),
  discountMinor: z.number().int().min(0).default(0),
  redeemedAt: z.string().datetime().optional().nullable(),
  voidedAt: z.string().datetime().optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
})

export const promotionRoutes = new Hono()

function makeDiscountCode(prefix: string) {
  return `${sanitizePlainText(prefix).toUpperCase()}-${randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase()}`
}

promotionRoutes.get(
  '/bizes/:bizId/discount-campaigns',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('offers.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = listCampaignQuerySchema.safeParse(c.req.query())
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid query parameters.', 400, parsed.error.flatten())

    const pageInfo = pagination(parsed.data)
    const where = and(
      eq(discountCampaigns.bizId, bizId),
      parsed.data.status ? eq(discountCampaigns.status, parsed.data.status) : undefined,
      parsed.data.discountType ? eq(discountCampaigns.discountType, parsed.data.discountType) : undefined,
    )

    const [rows, countRows] = await Promise.all([
      db.query.discountCampaigns.findMany({
        where,
        orderBy: [desc(discountCampaigns.startsAt), asc(discountCampaigns.name)],
        limit: pageInfo.perPage,
        offset: pageInfo.offset,
      }),
      db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(discountCampaigns).where(where),
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

promotionRoutes.post(
  '/bizes/:bizId/discount-campaigns',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('offers.write', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = createCampaignBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())

    const [created] = await db.insert(discountCampaigns).values({
      bizId,
      bizExtensionInstallId: parsed.data.bizExtensionInstallId ?? null,
      name: sanitizePlainText(parsed.data.name),
      slug: sanitizePlainText(parsed.data.slug),
      status: parsed.data.status,
      discountType: parsed.data.discountType,
      scope: parsed.data.scope,
      stackingMode: parsed.data.stackingMode,
      currency: parsed.data.currency.toUpperCase(),
      percentOffBps: parsed.data.percentOffBps ?? null,
      fixedAmountMinor: parsed.data.fixedAmountMinor ?? null,
      maxDiscountMinor: parsed.data.maxDiscountMinor ?? null,
      minSubtotalMinor: parsed.data.minSubtotalMinor,
      maxTotalRedemptions: parsed.data.maxTotalRedemptions ?? null,
      maxPerCustomer: parsed.data.maxPerCustomer ?? null,
      firstTimeOnly: parsed.data.firstTimeOnly,
      startsAt: parsed.data.startsAt ? new Date(parsed.data.startsAt) : null,
      endsAt: parsed.data.endsAt ? new Date(parsed.data.endsAt) : null,
      conditions: cleanMetadata(parsed.data.conditions),
      metadata: cleanMetadata(parsed.data.metadata),
    }).returning()

    return ok(c, created, 201)
  },
)

promotionRoutes.patch(
  '/bizes/:bizId/discount-campaigns/:campaignId',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('offers.write', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const campaignId = c.req.param('campaignId')
    const parsed = updateCampaignBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())

    const existing = await db.query.discountCampaigns.findFirst({
      where: and(eq(discountCampaigns.bizId, bizId), eq(discountCampaigns.id, campaignId)),
    })
    if (!existing) return fail(c, 'NOT_FOUND', 'Discount campaign not found.', 404)

    const [updated] = await db.update(discountCampaigns).set({
      bizExtensionInstallId: parsed.data.bizExtensionInstallId === undefined ? existing.bizExtensionInstallId : (parsed.data.bizExtensionInstallId ?? null),
      name: parsed.data.name === undefined ? existing.name : sanitizePlainText(parsed.data.name),
      slug: parsed.data.slug === undefined ? existing.slug : sanitizePlainText(parsed.data.slug),
      status: parsed.data.status ?? existing.status,
      discountType: parsed.data.discountType ?? existing.discountType,
      scope: parsed.data.scope ?? existing.scope,
      stackingMode: parsed.data.stackingMode ?? existing.stackingMode,
      currency: parsed.data.currency ? parsed.data.currency.toUpperCase() : existing.currency,
      percentOffBps: parsed.data.percentOffBps === undefined ? existing.percentOffBps : parsed.data.percentOffBps,
      fixedAmountMinor: parsed.data.fixedAmountMinor === undefined ? existing.fixedAmountMinor : parsed.data.fixedAmountMinor,
      maxDiscountMinor: parsed.data.maxDiscountMinor === undefined ? existing.maxDiscountMinor : parsed.data.maxDiscountMinor,
      minSubtotalMinor: parsed.data.minSubtotalMinor ?? existing.minSubtotalMinor,
      maxTotalRedemptions: parsed.data.maxTotalRedemptions === undefined ? existing.maxTotalRedemptions : parsed.data.maxTotalRedemptions,
      maxPerCustomer: parsed.data.maxPerCustomer === undefined ? existing.maxPerCustomer : parsed.data.maxPerCustomer,
      firstTimeOnly: parsed.data.firstTimeOnly ?? existing.firstTimeOnly,
      startsAt: parsed.data.startsAt === undefined ? existing.startsAt : (parsed.data.startsAt ? new Date(parsed.data.startsAt) : null),
      endsAt: parsed.data.endsAt === undefined ? existing.endsAt : (parsed.data.endsAt ? new Date(parsed.data.endsAt) : null),
      conditions: parsed.data.conditions === undefined ? existing.conditions : cleanMetadata(parsed.data.conditions),
      metadata: parsed.data.metadata === undefined ? existing.metadata : cleanMetadata(parsed.data.metadata),
    }).where(and(eq(discountCampaigns.bizId, bizId), eq(discountCampaigns.id, campaignId))).returning()

    return ok(c, updated)
  },
)

promotionRoutes.get(
  '/bizes/:bizId/discount-codes',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('offers.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = listCodeQuerySchema.safeParse(c.req.query())
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid query parameters.', 400, parsed.error.flatten())
    const pageInfo = pagination(parsed.data)
    const where = and(
      eq(discountCodes.bizId, bizId),
      parsed.data.status ? eq(discountCodes.status, parsed.data.status) : undefined,
      parsed.data.discountCampaignId ? eq(discountCodes.discountCampaignId, parsed.data.discountCampaignId) : undefined,
    )
    const [rows, countRows] = await Promise.all([
      db.query.discountCodes.findMany({
        where,
        orderBy: [asc(discountCodes.code)],
        limit: pageInfo.perPage,
        offset: pageInfo.offset,
      }),
      db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(discountCodes).where(where),
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

promotionRoutes.post(
  '/bizes/:bizId/discount-codes',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('offers.write', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = createCodeBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    const [created] = await db.insert(discountCodes).values({
      bizId,
      discountCampaignId: parsed.data.discountCampaignId,
      code: sanitizePlainText(parsed.data.code ?? makeDiscountCode('PROMO')),
      status: parsed.data.status,
      startsAt: parsed.data.startsAt ? new Date(parsed.data.startsAt) : null,
      expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
      maxRedemptions: parsed.data.maxRedemptions ?? null,
      maxPerCustomer: parsed.data.maxPerCustomer ?? null,
      redemptionCount: parsed.data.redemptionCount ?? 0,
      isSingleUse: parsed.data.isSingleUse,
      metadata: cleanMetadata(parsed.data.metadata),
    }).returning()
    return ok(c, created, 201)
  },
)

promotionRoutes.post(
  '/bizes/:bizId/discount-campaigns/:campaignId/generate-codes',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('offers.write', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, campaignId } = c.req.param()
    const parsed = generateCodesBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    const campaign = await db.query.discountCampaigns.findFirst({
      where: and(eq(discountCampaigns.bizId, bizId), eq(discountCampaigns.id, campaignId)),
    })
    if (!campaign) return fail(c, 'NOT_FOUND', 'Discount campaign not found.', 404)
    const codes = Array.from({ length: parsed.data.count }, () => {
      const code = makeDiscountCode(parsed.data.prefix)
      return {
        bizId,
        discountCampaignId: campaignId,
        code,
        status: parsed.data.status,
        startsAt: parsed.data.startsAt ? new Date(parsed.data.startsAt) : null,
        expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
        maxRedemptions: parsed.data.maxRedemptions ?? null,
        maxPerCustomer: parsed.data.maxPerCustomer ?? null,
        redemptionCount: 0,
        isSingleUse: false,
        metadata: cleanMetadata({
          ...(parsed.data.metadata ?? {}),
          generatedFromCampaignId: campaignId,
          qrPayload: {
            type: 'discount_code',
            bizId,
            campaignId,
            code,
          },
        }),
      }
    })
    const created = await db.insert(discountCodes).values(codes).returning()
    return ok(c, created, 201)
  },
)

promotionRoutes.patch(
  '/bizes/:bizId/discount-codes/:codeId',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('offers.write', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const codeId = c.req.param('codeId')
    const parsed = updateCodeBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    const existing = await db.query.discountCodes.findFirst({
      where: and(eq(discountCodes.bizId, bizId), eq(discountCodes.id, codeId)),
    })
    if (!existing) return fail(c, 'NOT_FOUND', 'Discount code not found.', 404)
    const [updated] = await db.update(discountCodes).set({
      discountCampaignId: parsed.data.discountCampaignId ?? existing.discountCampaignId,
      code: parsed.data.code === undefined ? existing.code : sanitizePlainText(parsed.data.code),
      status: parsed.data.status ?? existing.status,
      startsAt: parsed.data.startsAt === undefined ? existing.startsAt : (parsed.data.startsAt ? new Date(parsed.data.startsAt) : null),
      expiresAt: parsed.data.expiresAt === undefined ? existing.expiresAt : (parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null),
      maxRedemptions: parsed.data.maxRedemptions === undefined ? existing.maxRedemptions : parsed.data.maxRedemptions,
      maxPerCustomer: parsed.data.maxPerCustomer === undefined ? existing.maxPerCustomer : parsed.data.maxPerCustomer,
      redemptionCount: parsed.data.redemptionCount ?? existing.redemptionCount,
      isSingleUse: parsed.data.isSingleUse ?? existing.isSingleUse,
      metadata: parsed.data.metadata === undefined ? existing.metadata : cleanMetadata(parsed.data.metadata),
    }).where(and(eq(discountCodes.bizId, bizId), eq(discountCodes.id, codeId))).returning()
    return ok(c, updated)
  },
)

promotionRoutes.get(
  '/bizes/:bizId/discount-redemptions',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('offers.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = listRedemptionQuerySchema.safeParse(c.req.query())
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid query parameters.', 400, parsed.error.flatten())
    const pageInfo = pagination(parsed.data)
    const where = and(
      eq(discountRedemptions.bizId, bizId),
      parsed.data.discountCampaignId ? eq(discountRedemptions.discountCampaignId, parsed.data.discountCampaignId) : undefined,
      parsed.data.discountCodeId ? eq(discountRedemptions.discountCodeId, parsed.data.discountCodeId) : undefined,
      parsed.data.bookingOrderId ? eq(discountRedemptions.bookingOrderId, parsed.data.bookingOrderId) : undefined,
      parsed.data.customerUserId ? eq(discountRedemptions.customerUserId, parsed.data.customerUserId) : undefined,
      parsed.data.status ? eq(discountRedemptions.status, parsed.data.status) : undefined,
    )
    const [rows, countRows] = await Promise.all([
      db.query.discountRedemptions.findMany({
        where,
        orderBy: [desc(discountRedemptions.redeemedAt), desc(discountRedemptions.id)],
        limit: pageInfo.perPage,
        offset: pageInfo.offset,
      }),
      db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(discountRedemptions).where(where),
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

promotionRoutes.post(
  '/bizes/:bizId/discount-redemptions',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('offers.write', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = createRedemptionBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    const [created] = await db.insert(discountRedemptions).values({
      bizId,
      discountCampaignId: parsed.data.discountCampaignId,
      discountCodeId: parsed.data.discountCodeId ?? null,
      bookingOrderId: parsed.data.bookingOrderId ?? null,
      bookingOrderLineId: parsed.data.bookingOrderLineId ?? null,
      customerUserId: parsed.data.customerUserId ?? null,
      status: parsed.data.status,
      currency: parsed.data.currency.toUpperCase(),
      discountMinor: parsed.data.discountMinor,
      redeemedAt: parsed.data.redeemedAt ? new Date(parsed.data.redeemedAt) : new Date(),
      voidedAt: parsed.data.voidedAt ? new Date(parsed.data.voidedAt) : null,
      metadata: cleanMetadata(parsed.data.metadata),
    }).returning()
    return ok(c, created, 201)
  },
)

promotionRoutes.get(
  '/bizes/:bizId/discount-campaigns/:campaignId/performance',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('offers.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, campaignId } = c.req.param()
    const campaign = await db.query.discountCampaigns.findFirst({
      where: and(eq(discountCampaigns.bizId, bizId), eq(discountCampaigns.id, campaignId)),
    })
    if (!campaign) return fail(c, 'NOT_FOUND', 'Discount campaign not found.', 404)
    const [codes, redemptions] = await Promise.all([
      db.query.discountCodes.findMany({
        where: and(eq(discountCodes.bizId, bizId), eq(discountCodes.discountCampaignId, campaignId)),
        orderBy: [asc(discountCodes.code)],
      }),
      db.query.discountRedemptions.findMany({
        where: and(eq(discountRedemptions.bizId, bizId), eq(discountRedemptions.discountCampaignId, campaignId)),
        orderBy: [desc(discountRedemptions.redeemedAt)],
      }),
    ])
    return ok(c, {
      campaign,
      summary: {
        codeCount: codes.length,
        redemptionCount: redemptions.length,
        totalDiscountMinor: redemptions.reduce((sum, row) => sum + row.discountMinor, 0),
        uniqueCustomerCount: new Set(redemptions.map((row) => row.customerUserId).filter(Boolean)).size,
      },
      codes,
      redemptions,
    })
  },
)
