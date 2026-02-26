/**
 * Demand pricing routes (biz-scoped).
 *
 * ELI5:
 * This module lets a biz configure "when demand is high, adjust price like this"
 * rules as first-class data. It avoids stuffing surge logic into ad-hoc metadata.
 *
 * Why this matters:
 * - Saga coverage can assert a real API capability for demand pricing.
 * - Policies are reusable and queryable by APIs, agents, and future workers.
 * - Validation is deterministic, so rows are always understandable.
 */

import { Hono } from 'hono'
import { and, asc, desc, eq, ilike, or, sql } from 'drizzle-orm'
import { z } from 'zod'
import dbPackage from '@bizing/db'
import {
  getCurrentUser,
  requireAclPermission,
  requireAuth,
  requireBizAccess,
} from '../middleware/auth.js'
import { fail, ok, parsePositiveInt } from './_api.js'

const { db, demandPricingPolicies } = dbPackage

const policyStatusValues = ['draft', 'active', 'inactive', 'archived'] as const
const targetTypeValues = [
  'global',
  'resource',
  'service',
  'service_product',
  'offer',
  'offer_version',
  'location',
] as const
const scoringModeValues = ['weighted_sum', 'max_signal', 'manual_only'] as const
const adjustmentTypeValues = ['set_price', 'fixed_amount', 'percentage'] as const
const applyAsValues = [
  'base_price',
  'discount',
  'surcharge',
  'call_fee',
  'booking_fee',
  'after_hours_fee',
  'emergency_fee',
] as const

const listPoliciesQuerySchema = z.object({
  page: z.string().optional(),
  perPage: z.string().optional(),
  status: z.enum(policyStatusValues).optional(),
  targetType: z.enum(targetTypeValues).optional(),
  isEnabled: z.enum(['true', 'false']).optional(),
  search: z.string().min(1).max(140).optional(),
  sortBy: z.enum(['id', 'priority']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
})

const createPolicyBodySchema = z.object({
  name: z.string().min(2).max(200),
  slug: z.string().min(2).max(140).regex(/^[a-z0-9-]+$/).optional(),
  description: z.string().max(4000).optional(),
  status: z.enum(policyStatusValues).default('active'),
  targetType: z.enum(targetTypeValues).default('global'),
  resourceId: z.string().optional(),
  serviceId: z.string().optional(),
  serviceProductId: z.string().optional(),
  offerId: z.string().optional(),
  offerVersionId: z.string().optional(),
  locationId: z.string().optional(),
  scoringMode: z.enum(scoringModeValues).default('weighted_sum'),
  scoreFloor: z.number().int().min(0).default(0),
  scoreCeiling: z.number().int().min(0).default(10000),
  defaultAdjustmentType: z.enum(adjustmentTypeValues).default('percentage'),
  defaultApplyAs: z.enum(applyAsValues).default('surcharge'),
  defaultAdjustmentValue: z.number().int().optional(),
  minAdjustmentMinor: z.number().int().optional(),
  maxAdjustmentMinor: z.number().int().optional(),
  minFinalUnitPriceMinor: z.number().int().optional(),
  maxFinalUnitPriceMinor: z.number().int().optional(),
  cooldownMin: z.number().int().min(0).default(0),
  effectiveStartAt: z.string().datetime().optional(),
  effectiveEndAt: z.string().datetime().optional(),
  priority: z.number().int().min(0).default(100),
  isEnabled: z.boolean().default(true),
  policy: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
})

type TargetShapeInput = z.infer<typeof createPolicyBodySchema>

/**
 * Converts "Human Name" to "human-name" for stable policy slugs.
 */
function toSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-')
    .slice(0, 140)
}

function normalizeOptionalId(value: string | undefined) {
  if (!value) return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

/**
 * Enforces deterministic target payload shape.
 *
 * Why this check exists:
 * - each policy must point to exactly one scope selector branch
 * - prevents ambiguous rows like "offer + service" at same time
 * - mirrors DB check constraints with readable API errors
 */
function validateTargetShape(input: TargetShapeInput): string | null {
  const targetMap = {
    resource: normalizeOptionalId(input.resourceId),
    service: normalizeOptionalId(input.serviceId),
    service_product: normalizeOptionalId(input.serviceProductId),
    offer: normalizeOptionalId(input.offerId),
    offer_version: normalizeOptionalId(input.offerVersionId),
    location: normalizeOptionalId(input.locationId),
  } as const

  const nonEmptyTargets = Object.entries(targetMap).filter(([, value]) => Boolean(value))

  if (input.targetType === 'global') {
    if (nonEmptyTargets.length > 0) {
      return 'targetType=global cannot include resource/service/offer/location ids.'
    }
    return null
  }

  const expectedValue = targetMap[input.targetType as keyof typeof targetMap]
  if (!expectedValue) {
    return `targetType=${input.targetType} requires its matching target id.`
  }
  if (nonEmptyTargets.length !== 1) {
    return `targetType=${input.targetType} requires exactly one target id and no extras.`
  }
  if (nonEmptyTargets[0]?.[0] !== input.targetType) {
    return `targetType=${input.targetType} does not match supplied target id field.`
  }
  return null
}

export const demandPricingRoutes = new Hono()

/**
 * List demand-pricing policies for one biz.
 */
demandPricingRoutes.get(
  '/bizes/:bizId/demand-pricing/policies',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('pricing.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const parsed = listPoliciesQuerySchema.safeParse(c.req.query())
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid query params.', 400, parsed.error.flatten())
    }

    const bizId = c.req.param('bizId')
    const page = parsePositiveInt(parsed.data.page, 1)
    const perPage = Math.min(100, parsePositiveInt(parsed.data.perPage, 20))
    const offset = (page - 1) * perPage

    const filters = [eq(demandPricingPolicies.bizId, bizId)]
    if (parsed.data.status) filters.push(eq(demandPricingPolicies.status, parsed.data.status))
    if (parsed.data.targetType) filters.push(eq(demandPricingPolicies.targetType, parsed.data.targetType))
    if (parsed.data.isEnabled) filters.push(eq(demandPricingPolicies.isEnabled, parsed.data.isEnabled === 'true'))
    if (parsed.data.search) {
      const q = `%${parsed.data.search}%`
      filters.push(or(ilike(demandPricingPolicies.name, q), ilike(demandPricingPolicies.slug, q))!)
    }

    const where = and(...filters)
    const sortOrder = parsed.data.sortOrder ?? 'desc'
    const sortBy = parsed.data.sortBy ?? 'id'
    const orderByExpr =
      sortBy === 'priority'
        ? sortOrder === 'asc'
          ? asc(demandPricingPolicies.priority)
          : desc(demandPricingPolicies.priority)
        : sortOrder === 'asc'
          ? asc(demandPricingPolicies.id)
          : desc(demandPricingPolicies.id)

    const [items, totals] = await Promise.all([
      db.query.demandPricingPolicies.findMany({
        where,
        orderBy: [orderByExpr],
        limit: perPage,
        offset,
        columns: {
          id: true,
          bizId: true,
          name: true,
          slug: true,
          description: true,
          status: true,
          targetType: true,
          resourceId: true,
          serviceId: true,
          serviceProductId: true,
          offerId: true,
          offerVersionId: true,
          locationId: true,
          scoringMode: true,
          scoreFloor: true,
          scoreCeiling: true,
          defaultAdjustmentType: true,
          defaultApplyAs: true,
          defaultAdjustmentValue: true,
          minAdjustmentMinor: true,
          maxAdjustmentMinor: true,
          minFinalUnitPriceMinor: true,
          maxFinalUnitPriceMinor: true,
          cooldownMin: true,
          effectiveStartAt: true,
          effectiveEndAt: true,
          priority: true,
          isEnabled: true,
          policy: true,
          metadata: true,
        },
      }),
      db
        .select({
          total: sql<number>`count(*)`.mapWith(Number),
        })
        .from(demandPricingPolicies)
        .where(where),
    ])

    const total = totals[0]?.total ?? 0
    return ok(c, {
      items,
      page,
      perPage,
      total,
      totalPages: Math.max(1, Math.ceil(total / perPage)),
    })
  },
)

/**
 * Create one demand-pricing policy row.
 */
demandPricingRoutes.post(
  '/bizes/:bizId/demand-pricing/policies',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('pricing.write', { bizIdParam: 'bizId' }),
  async (c) => {
    const actor = getCurrentUser(c)
    if (!actor) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)

    const bizId = c.req.param('bizId')
    const body = await c.req.json().catch(() => null)
    const parsed = createPolicyBodySchema.safeParse(body)
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    }

    const targetShapeError = validateTargetShape(parsed.data)
    if (targetShapeError) {
      return fail(c, 'VALIDATION_ERROR', targetShapeError, 400)
    }
    if (parsed.data.scoreCeiling < parsed.data.scoreFloor) {
      return fail(c, 'VALIDATION_ERROR', 'scoreCeiling must be >= scoreFloor.', 400)
    }

    const effectiveStartAt = parsed.data.effectiveStartAt
      ? new Date(parsed.data.effectiveStartAt)
      : undefined
    const effectiveEndAt = parsed.data.effectiveEndAt ? new Date(parsed.data.effectiveEndAt) : undefined
    if (effectiveStartAt && Number.isNaN(effectiveStartAt.getTime())) {
      return fail(c, 'VALIDATION_ERROR', 'effectiveStartAt must be a valid ISO datetime.', 400)
    }
    if (effectiveEndAt && Number.isNaN(effectiveEndAt.getTime())) {
      return fail(c, 'VALIDATION_ERROR', 'effectiveEndAt must be a valid ISO datetime.', 400)
    }
    if (effectiveStartAt && effectiveEndAt && effectiveEndAt <= effectiveStartAt) {
      return fail(c, 'VALIDATION_ERROR', 'effectiveEndAt must be after effectiveStartAt.', 400)
    }

    const slugBase = parsed.data.slug ?? toSlug(parsed.data.name)
    const slug = slugBase.length > 0 ? slugBase : `policy-${Date.now()}`

    try {
      const [created] = await db
        .insert(demandPricingPolicies)
        .values({
          bizId,
          name: parsed.data.name,
          slug,
          description: parsed.data.description ?? null,
          status: parsed.data.status,
          targetType: parsed.data.targetType,
          resourceId: normalizeOptionalId(parsed.data.resourceId) ?? null,
          serviceId: normalizeOptionalId(parsed.data.serviceId) ?? null,
          serviceProductId: normalizeOptionalId(parsed.data.serviceProductId) ?? null,
          offerId: normalizeOptionalId(parsed.data.offerId) ?? null,
          offerVersionId: normalizeOptionalId(parsed.data.offerVersionId) ?? null,
          locationId: normalizeOptionalId(parsed.data.locationId) ?? null,
          scoringMode: parsed.data.scoringMode,
          scoreFloor: parsed.data.scoreFloor,
          scoreCeiling: parsed.data.scoreCeiling,
          defaultAdjustmentType: parsed.data.defaultAdjustmentType,
          defaultApplyAs: parsed.data.defaultApplyAs,
          defaultAdjustmentValue: parsed.data.defaultAdjustmentValue ?? null,
          minAdjustmentMinor: parsed.data.minAdjustmentMinor ?? null,
          maxAdjustmentMinor: parsed.data.maxAdjustmentMinor ?? null,
          minFinalUnitPriceMinor: parsed.data.minFinalUnitPriceMinor ?? null,
          maxFinalUnitPriceMinor: parsed.data.maxFinalUnitPriceMinor ?? null,
          cooldownMin: parsed.data.cooldownMin,
          effectiveStartAt: effectiveStartAt ?? null,
          effectiveEndAt: effectiveEndAt ?? null,
          priority: parsed.data.priority,
          isEnabled: parsed.data.isEnabled,
          policy: parsed.data.policy ?? {},
          metadata: parsed.data.metadata ?? {},
        })
        .returning()

      return ok(c, created, 201)
    } catch (error) {
      const code = (error as { code?: string })?.code
      if (code === '23505') {
        return fail(c, 'CONFLICT', 'A demand-pricing policy with this slug already exists.', 409, {
          slug,
        })
      }
      throw error
    }
  },
)
