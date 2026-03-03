/**
 * Sellable variant routes.
 *
 * ELI5:
 * A sellable is the "thing we sell". Variants let one sellable family expose
 * choices like:
 * - Basic / Pro / Team
 * - 30 min / 60 min
 * - English / Spanish
 *
 * Why this route exists:
 * - the schema already has a canonical variant backbone,
 * - sagas and storefronts need to manage that backbone through the API,
 * - this keeps "variants" as a first-class commercial idea instead of hiding
 *   them inside random metadata blobs.
 */

import { Hono } from 'hono'
import { and, asc, eq } from 'drizzle-orm'
import { z } from 'zod'
import dbPackage from '@bizing/db'
import { requireAclPermission, requireAuth, requireBizAccess } from '../middleware/auth.js'
import { executeCrudRouteAction } from '../services/action-route-bridge.js'
import { fail, ok } from './_api.js'

const {
  db,
  sellables,
  sellableVariantDimensions,
  sellableVariantDimensionValues,
  sellableVariants,
  sellableVariantSelections,
} = dbPackage

const dimensionBodySchema = z.object({
  baseSellableId: z.string().min(1),
  dimensionKey: z.string().min(1).max(120),
  name: z.string().min(1).max(180),
  description: z.string().max(2000).optional().nullable(),
  dimensionType: z.enum(['choice', 'boolean', 'numeric', 'text']).default('choice'),
  isRequired: z.boolean().default(true),
  sortOrder: z.number().int().min(0).default(100),
  status: z.enum(['draft', 'active', 'inactive', 'archived']).default('active'),
  metadata: z.record(z.unknown()).optional(),
})

const dimensionValueBodySchema = z.object({
  sellableVariantDimensionId: z.string().min(1),
  valueKey: z.string().min(1).max(120),
  valueLabel: z.string().min(1).max(180),
  sortOrder: z.number().int().min(0).default(100),
  isDefault: z.boolean().default(false),
  status: z.enum(['draft', 'active', 'inactive', 'archived']).default('active'),
  metadata: z.record(z.unknown()).optional(),
})

const variantBodySchema = z.object({
  baseSellableId: z.string().min(1),
  variantSellableId: z.string().min(1),
  status: z.enum(['active', 'inactive', 'archived']).default('active'),
  pricingMode: z.enum(['inherited', 'override', 'delta']).default('inherited'),
  priceOverrideMinor: z.number().int().min(0).optional().nullable(),
  priceDeltaMinor: z.number().int().optional().nullable(),
  skuSuffix: z.string().max(120).optional().nullable(),
  displayLabel: z.string().max(220).optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
})

const selectionBodySchema = z.object({
  sellableVariantId: z.string().min(1),
  baseSellableId: z.string().min(1),
  sellableVariantDimensionId: z.string().min(1),
  sellableVariantDimensionValueId: z.string().min(1),
  metadata: z.record(z.unknown()).optional(),
})

async function ensureSellableInBiz(bizId: string, sellableId: string) {
  return db.query.sellables.findFirst({
    where: and(eq(sellables.bizId, bizId), eq(sellables.id, sellableId)),
  })
}

export const sellableVariantRoutes = new Hono()

async function createSellableVariantRow<T extends Record<string, unknown>>(input: {
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
    metadata: { routeFamily: 'sellable-variants' },
  })
  if (!delegated.ok) return fail(input.c, delegated.code, delegated.message, delegated.httpStatus, delegated.details)
  return delegated.row as T
}

sellableVariantRoutes.get(
  '/bizes/:bizId/sellables/:sellableId/variant-dimensions',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, sellableId } = c.req.param()
    const rows = await db.query.sellableVariantDimensions.findMany({
      where: and(
        eq(sellableVariantDimensions.bizId, bizId),
        eq(sellableVariantDimensions.baseSellableId, sellableId),
      ),
      orderBy: [asc(sellableVariantDimensions.sortOrder), asc(sellableVariantDimensions.dimensionKey)],
    })
    return ok(c, rows)
  },
)

sellableVariantRoutes.post(
  '/bizes/:bizId/sellables/:sellableId/variant-dimensions',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, sellableId } = c.req.param()
    const parsed = dimensionBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    if (parsed.data.baseSellableId !== sellableId) return fail(c, 'VALIDATION_ERROR', 'Sellable id mismatch.', 400)
    const baseSellable = await ensureSellableInBiz(bizId, sellableId)
    if (!baseSellable) return fail(c, 'NOT_FOUND', 'Base sellable not found.', 404)
    const row = await createSellableVariantRow<typeof sellableVariantDimensions.$inferSelect>({
      c,
      bizId,
      tableKey: 'sellableVariantDimensions',
      subjectType: 'sellable_variant_dimension',
      displayName: parsed.data.dimensionKey,
      data: {
      bizId,
      ...parsed.data,
      metadata: parsed.data.metadata ?? {},
      },
    })
    if (row instanceof Response) return row
    return ok(c, row, 201)
  },
)

sellableVariantRoutes.get(
  '/bizes/:bizId/sellables/:sellableId/variant-dimensions/:dimensionId/values',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, sellableId, dimensionId } = c.req.param()
    const dimension = await db.query.sellableVariantDimensions.findFirst({
      where: and(
        eq(sellableVariantDimensions.bizId, bizId),
        eq(sellableVariantDimensions.baseSellableId, sellableId),
        eq(sellableVariantDimensions.id, dimensionId),
      ),
    })
    if (!dimension) return fail(c, 'NOT_FOUND', 'Variant dimension not found.', 404)
    const rows = await db.query.sellableVariantDimensionValues.findMany({
      where: and(
        eq(sellableVariantDimensionValues.bizId, bizId),
        eq(sellableVariantDimensionValues.sellableVariantDimensionId, dimensionId),
      ),
      orderBy: [asc(sellableVariantDimensionValues.sortOrder), asc(sellableVariantDimensionValues.valueKey)],
    })
    return ok(c, rows)
  },
)

sellableVariantRoutes.post(
  '/bizes/:bizId/sellables/:sellableId/variant-dimensions/:dimensionId/values',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, sellableId, dimensionId } = c.req.param()
    const parsed = dimensionValueBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    if (parsed.data.sellableVariantDimensionId !== dimensionId) return fail(c, 'VALIDATION_ERROR', 'Dimension id mismatch.', 400)
    const dimension = await db.query.sellableVariantDimensions.findFirst({
      where: and(
        eq(sellableVariantDimensions.bizId, bizId),
        eq(sellableVariantDimensions.baseSellableId, sellableId),
        eq(sellableVariantDimensions.id, dimensionId),
      ),
    })
    if (!dimension) return fail(c, 'NOT_FOUND', 'Variant dimension not found.', 404)
    const row = await createSellableVariantRow<typeof sellableVariantDimensionValues.$inferSelect>({
      c,
      bizId,
      tableKey: 'sellableVariantDimensionValues',
      subjectType: 'sellable_variant_dimension_value',
      displayName: parsed.data.valueKey,
      data: {
      bizId,
      ...parsed.data,
      metadata: parsed.data.metadata ?? {},
      },
    })
    if (row instanceof Response) return row
    return ok(c, row, 201)
  },
)

sellableVariantRoutes.get(
  '/bizes/:bizId/sellables/:sellableId/variants',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, sellableId } = c.req.param()
    const rows = await db.query.sellableVariants.findMany({
      where: and(
        eq(sellableVariants.bizId, bizId),
        eq(sellableVariants.baseSellableId, sellableId),
      ),
      orderBy: [asc(sellableVariants.displayLabel), asc(sellableVariants.id)],
    })
    return ok(c, rows)
  },
)

sellableVariantRoutes.post(
  '/bizes/:bizId/sellables/:sellableId/variants',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, sellableId } = c.req.param()
    const parsed = variantBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    if (parsed.data.baseSellableId !== sellableId) return fail(c, 'VALIDATION_ERROR', 'Sellable id mismatch.', 400)
    const [baseSellable, variantSellable] = await Promise.all([
      ensureSellableInBiz(bizId, sellableId),
      ensureSellableInBiz(bizId, parsed.data.variantSellableId),
    ])
    if (!baseSellable) return fail(c, 'NOT_FOUND', 'Base sellable not found.', 404)
    if (!variantSellable) return fail(c, 'NOT_FOUND', 'Variant sellable not found.', 404)
    const row = await createSellableVariantRow<typeof sellableVariants.$inferSelect>({
      c,
      bizId,
      tableKey: 'sellableVariants',
      subjectType: 'sellable_variant',
      displayName: parsed.data.displayLabel ?? parsed.data.variantSellableId,
      data: {
      bizId,
      ...parsed.data,
      metadata: parsed.data.metadata ?? {},
      },
    })
    if (row instanceof Response) return row
    return ok(c, row, 201)
  },
)

sellableVariantRoutes.get(
  '/bizes/:bizId/sellable-variants/:variantId/selections',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, variantId } = c.req.param()
    const rows = await db.query.sellableVariantSelections.findMany({
      where: and(
        eq(sellableVariantSelections.bizId, bizId),
        eq(sellableVariantSelections.sellableVariantId, variantId),
      ),
      orderBy: [asc(sellableVariantSelections.id)],
    })
    return ok(c, rows)
  },
)

sellableVariantRoutes.post(
  '/bizes/:bizId/sellable-variants/:variantId/selections',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, variantId } = c.req.param()
    const parsed = selectionBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    if (parsed.data.sellableVariantId !== variantId) return fail(c, 'VALIDATION_ERROR', 'Variant id mismatch.', 400)
    const variant = await db.query.sellableVariants.findFirst({
      where: and(eq(sellableVariants.bizId, bizId), eq(sellableVariants.id, variantId)),
    })
    if (!variant) return fail(c, 'NOT_FOUND', 'Sellable variant not found.', 404)
    const row = await createSellableVariantRow<typeof sellableVariantSelections.$inferSelect>({
      c,
      bizId,
      tableKey: 'sellableVariantSelections',
      subjectType: 'sellable_variant_selection',
      displayName: parsed.data.sellableVariantDimensionValueId,
      data: {
      bizId,
      ...parsed.data,
      metadata: parsed.data.metadata ?? {},
      },
    })
    if (row instanceof Response) return row
    return ok(c, row, 201)
  },
)
