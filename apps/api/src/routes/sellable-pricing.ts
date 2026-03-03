/**
 * Sellable pricing routes.
 *
 * ELI5:
 * A sellable can be free, fixed, flexible, tiered, metered, or externally
 * quoted. These routes expose that generic pricing backbone directly so
 * products and offers do not need separate pricing subsystems.
 */

import { Hono } from 'hono'
import { and, asc, eq } from 'drizzle-orm'
import { z } from 'zod'
import dbPackage from '@bizing/db'
import { requireAclPermission, requireAuth, requireBizAccess } from '../middleware/auth.js'
import { executeCrudRouteAction } from '../services/action-route-bridge.js'
import { fail, ok } from './_api.js'

const { db, sellablePricingModes, sellablePricingThresholds, sellablePricingOverrides } = dbPackage

const createPricingModeBodySchema = z.object({
  sellableId: z.string().min(1),
  status: z.enum(['draft', 'active', 'inactive', 'suspended', 'archived']).default('active'),
  mode: z.enum(['free', 'fixed', 'flexible', 'tiered', 'metered', 'external_quote']),
  currency: z.string().length(3).transform((value) => value.toUpperCase()).default('USD'),
  basePriceMinor: z.number().int().min(0).optional(),
  minimumOrderQuantity: z.number().int().min(1).default(1),
  maximumOrderQuantity: z.number().int().min(1).optional(),
  billingUnit: z.string().max(80).default('unit'),
  billingUnitCount: z.number().int().min(1).default(1),
  meteredUnitKey: z.string().max(140).optional(),
  externalQuoteKey: z.string().max(140).optional(),
  effectiveFrom: z.string().datetime().optional(),
  effectiveTo: z.string().datetime().optional(),
  priority: z.number().int().min(0).default(100),
  policySnapshot: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
})

const createPricingThresholdBodySchema = z.object({
  sellablePricingModeId: z.string().min(1),
  thresholdType: z.enum(['minimum', 'maximum', 'suggested', 'default']),
  metricKey: z.string().min(1).max(120),
  comparisonOperator: z.string().min(1).max(20).default('gte'),
  minValue: z.number().int().optional(),
  maxValue: z.number().int().optional(),
  priceMinor: z.number().int().optional(),
  sortOrder: z.number().int().min(0).default(100),
  metadata: z.record(z.unknown()).optional(),
})

const createPricingOverrideBodySchema = z.object({
  sellablePricingModeId: z.string().min(1),
  scopeType: z.enum(['biz', 'location', 'channel', 'custom_subject']).default('biz'),
  locationId: z.string().optional(),
  channelAccountId: z.string().optional(),
  customSubjectType: z.string().optional(),
  customSubjectId: z.string().optional(),
  overrideType: z.enum(['absolute', 'delta', 'multiplier']),
  absolutePriceMinor: z.number().int().optional(),
  deltaPriceMinor: z.number().int().optional(),
  multiplierBps: z.number().int().min(0).optional(),
  effectiveFrom: z.string().datetime().optional(),
  effectiveTo: z.string().datetime().optional(),
  priority: z.number().int().min(0).default(100),
  metadata: z.record(z.unknown()).optional(),
})

export const sellablePricingRoutes = new Hono()

async function createSellablePricingRow<T extends Record<string, unknown>>(input: {
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
    metadata: { routeFamily: 'sellable-pricing' },
  })
  if (!delegated.ok) return fail(input.c, delegated.code, delegated.message, delegated.httpStatus, delegated.details)
  return delegated.row as T
}

sellablePricingRoutes.get('/bizes/:bizId/sellable-pricing-modes', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.read', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const sellableId = c.req.query('sellableId')
  const rows = await db.query.sellablePricingModes.findMany({
    where: and(eq(sellablePricingModes.bizId, bizId), sellableId ? eq(sellablePricingModes.sellableId, sellableId) : undefined),
    orderBy: [asc(sellablePricingModes.priority), asc(sellablePricingModes.effectiveFrom)],
  })
  return ok(c, rows)
})

sellablePricingRoutes.post('/bizes/:bizId/sellable-pricing-modes', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const parsed = createPricingModeBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  const row = await createSellablePricingRow<typeof sellablePricingModes.$inferSelect>({
    c,
    bizId,
    tableKey: 'sellablePricingModes',
    subjectType: 'sellable_pricing_mode',
    displayName: parsed.data.mode,
    data: {
    bizId,
    sellableId: parsed.data.sellableId,
    status: parsed.data.status,
    mode: parsed.data.mode,
    currency: parsed.data.currency,
    basePriceMinor: parsed.data.basePriceMinor ?? null,
    minimumOrderQuantity: parsed.data.minimumOrderQuantity,
    maximumOrderQuantity: parsed.data.maximumOrderQuantity ?? null,
    billingUnit: parsed.data.billingUnit,
    billingUnitCount: parsed.data.billingUnitCount,
    meteredUnitKey: parsed.data.meteredUnitKey ?? null,
    externalQuoteKey: parsed.data.externalQuoteKey ?? null,
    effectiveFrom: parsed.data.effectiveFrom ? new Date(parsed.data.effectiveFrom) : new Date(),
    effectiveTo: parsed.data.effectiveTo ? new Date(parsed.data.effectiveTo) : null,
    priority: parsed.data.priority,
    policySnapshot: parsed.data.policySnapshot ?? {},
    metadata: parsed.data.metadata ?? {},
    },
  })
  if (row instanceof Response) return row
  return ok(c, row, 201)
})

sellablePricingRoutes.post('/bizes/:bizId/sellable-pricing-thresholds', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const parsed = createPricingThresholdBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  const row = await createSellablePricingRow<typeof sellablePricingThresholds.$inferSelect>({
    c,
    bizId,
    tableKey: 'sellablePricingThresholds',
    subjectType: 'sellable_pricing_threshold',
    displayName: parsed.data.metricKey,
    data: {
    bizId,
    sellablePricingModeId: parsed.data.sellablePricingModeId,
    thresholdType: parsed.data.thresholdType,
    metricKey: parsed.data.metricKey,
    comparisonOperator: parsed.data.comparisonOperator,
    minValue: parsed.data.minValue ?? null,
    maxValue: parsed.data.maxValue ?? null,
    priceMinor: parsed.data.priceMinor ?? null,
    sortOrder: parsed.data.sortOrder,
    metadata: parsed.data.metadata ?? {},
    },
  })
  if (row instanceof Response) return row
  return ok(c, row, 201)
})

sellablePricingRoutes.post('/bizes/:bizId/sellable-pricing-overrides', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const parsed = createPricingOverrideBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  const row = await createSellablePricingRow<typeof sellablePricingOverrides.$inferSelect>({
    c,
    bizId,
    tableKey: 'sellablePricingOverrides',
    subjectType: 'sellable_pricing_override',
    displayName: parsed.data.overrideType,
    data: {
    bizId,
    sellablePricingModeId: parsed.data.sellablePricingModeId,
    scopeType: parsed.data.scopeType,
    locationId: parsed.data.locationId ?? null,
    channelAccountId: parsed.data.channelAccountId ?? null,
    customSubjectType: parsed.data.customSubjectType ?? null,
    customSubjectId: parsed.data.customSubjectId ?? null,
    overrideType: parsed.data.overrideType,
    absolutePriceMinor: parsed.data.absolutePriceMinor ?? null,
    deltaPriceMinor: parsed.data.deltaPriceMinor ?? null,
    multiplierBps: parsed.data.multiplierBps ?? null,
    effectiveFrom: parsed.data.effectiveFrom ? new Date(parsed.data.effectiveFrom) : new Date(),
    effectiveTo: parsed.data.effectiveTo ? new Date(parsed.data.effectiveTo) : null,
    priority: parsed.data.priority,
    metadata: parsed.data.metadata ?? {},
    },
  })
  if (row instanceof Response) return row
  return ok(c, row, 201)
})
