/**
 * Product and bundle routes.
 *
 * ELI5:
 * Products are normal catalog items.
 * Bundles are "box products" that contain other products, service products,
 * or offers.
 *
 * Why this route exists:
 * - the schema already models products and bundles canonically,
 * - storefront sagas need a clean API surface for variants/bundles,
 * - agents should be able to inspect and mutate product composition without
 *   touching raw database tables.
 */

import { Hono } from 'hono'
import { and, asc, eq } from 'drizzle-orm'
import { z } from 'zod'
import dbPackage from '@bizing/db'
import { requireAclPermission, requireAuth, requireBizAccess } from '../middleware/auth.js'
import { fail, ok } from './_api.js'

const {
  db,
  products,
  productBundles,
  productBundleComponents,
  sellables,
  sellableProducts,
} = dbPackage

function asSellableStatus(status: string | null | undefined): 'draft' | 'active' | 'inactive' | 'archived' {
  if (status === 'active') return 'active'
  if (status === 'inactive') return 'inactive'
  if (status === 'archived') return 'archived'
  return 'draft'
}

async function ensureCanonicalSellableForProduct(input: {
  bizId: string
  productId: string
  name: string
  slug: string
  currency: string
  status: string | null | undefined
}) {
  const bridge = await db.query.sellableProducts.findFirst({
    where: and(eq(sellableProducts.bizId, input.bizId), eq(sellableProducts.productId, input.productId)),
  })

  if (bridge) {
    await db.update(sellables).set({
      displayName: input.name,
      slug: input.slug,
      currency: input.currency,
      status: asSellableStatus(input.status),
    }).where(and(eq(sellables.bizId, input.bizId), eq(sellables.id, bridge.sellableId)))
    return bridge.sellableId
  }

  const [sellable] = await db.insert(sellables).values({
    bizId: input.bizId,
    kind: 'product',
    displayName: input.name,
    slug: input.slug,
    currency: input.currency,
    status: asSellableStatus(input.status),
  }).returning()

  await db.insert(sellableProducts).values({
    bizId: input.bizId,
    sellableId: sellable.id,
    productId: input.productId,
  })

  return sellable.id
}

const productBodySchema = z.object({
  locationId: z.string().optional().nullable(),
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(100),
  sku: z.string().max(120).optional().nullable(),
  description: z.string().max(5000).optional().nullable(),
  basePriceMinor: z.number().int().default(0),
  costMinor: z.number().int().optional().nullable(),
  currency: z.string().length(3).default('USD'),
  type: z.enum(['physical', 'digital', 'service', 'membership', 'pass', 'credit_pack', 'fee', 'other']).default('digital'),
  status: z.enum(['draft', 'active', 'inactive', 'archived']).default('draft'),
  downloadUrl: z.string().max(500).optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
})

const productBundleBodySchema = z.object({
  bundleProductId: z.string().min(1),
  pricingMode: z.enum(['fixed_bundle_price', 'sum_components', 'hybrid']).default('fixed_bundle_price'),
  allowPartialSelection: z.boolean().default(false),
  minComponentSelections: z.number().int().min(0).default(0),
  maxComponentSelections: z.number().int().min(0).optional().nullable(),
  status: z.enum(['draft', 'active', 'inactive', 'archived']).default('draft'),
  policy: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
})

const productBundleComponentBodySchema = z.object({
  productBundleId: z.string().min(1),
  requirementMode: z.enum(['required', 'optional']).default('required'),
  targetType: z.enum(['product', 'service_product', 'offer']),
  productId: z.string().optional().nullable(),
  serviceProductId: z.string().optional().nullable(),
  offerId: z.string().optional().nullable(),
  minQuantity: z.number().int().min(0).default(1),
  maxQuantity: z.number().int().min(0).optional().nullable(),
  defaultQuantity: z.number().int().min(0).default(1),
  priceMode: z.enum(['included', 'fixed_override', 'surcharge', 'multiplier']).default('included'),
  priceOverrideMinor: z.number().int().min(0).optional().nullable(),
  surchargeMinor: z.number().int().min(0).optional().nullable(),
  priceMultiplierBps: z.number().int().min(0).optional().nullable(),
  sortOrder: z.number().int().min(0).default(100),
  description: z.string().max(2000).optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
})

export const productRoutes = new Hono()

productRoutes.get('/bizes/:bizId/products', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.read', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const rows = await db.query.products.findMany({
    where: eq(products.bizId, bizId),
    orderBy: [asc(products.name)],
  })
  return ok(c, rows)
})

productRoutes.post('/bizes/:bizId/products', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const parsed = productBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  const [row] = await db.insert(products).values({ bizId, ...parsed.data, metadata: parsed.data.metadata ?? {} }).returning()
  await ensureCanonicalSellableForProduct({
    bizId,
    productId: row.id,
    name: row.name,
    slug: row.slug,
    currency: row.currency,
    status: row.status,
  })
  return ok(c, row, 201)
})

productRoutes.patch('/bizes/:bizId/products/:productId', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const { bizId, productId } = c.req.param()
  const parsed = productBodySchema.partial().safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  const [row] = await db.update(products).set(parsed.data).where(and(eq(products.bizId, bizId), eq(products.id, productId))).returning()
  if (!row) return fail(c, 'NOT_FOUND', 'Product not found.', 404)
  await ensureCanonicalSellableForProduct({
    bizId,
    productId: row.id,
    name: row.name,
    slug: row.slug,
    currency: row.currency,
    status: row.status,
  })
  return ok(c, row)
})

productRoutes.get('/bizes/:bizId/product-bundles', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.read', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const rows = await db.query.productBundles.findMany({
    where: eq(productBundles.bizId, bizId),
    orderBy: [asc(productBundles.bundleProductId)],
  })
  return ok(c, rows)
})

productRoutes.post('/bizes/:bizId/product-bundles', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const parsed = productBundleBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  const [row] = await db.insert(productBundles).values({
    bizId,
    ...parsed.data,
    policy: parsed.data.policy ?? {},
    metadata: parsed.data.metadata ?? {},
  }).returning()
  return ok(c, row, 201)
})

productRoutes.get('/bizes/:bizId/product-bundles/:bundleId/components', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.read', { bizIdParam: 'bizId' }), async (c) => {
  const { bizId, bundleId } = c.req.param()
  const rows = await db.query.productBundleComponents.findMany({
    where: and(eq(productBundleComponents.bizId, bizId), eq(productBundleComponents.productBundleId, bundleId)),
    orderBy: [asc(productBundleComponents.sortOrder), asc(productBundleComponents.id)],
  })
  return ok(c, rows)
})

productRoutes.post('/bizes/:bizId/product-bundles/:bundleId/components', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const { bizId, bundleId } = c.req.param()
  const parsed = productBundleComponentBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  if (parsed.data.productBundleId !== bundleId) {
    return fail(c, 'VALIDATION_ERROR', 'Bundle id mismatch.', 400)
  }
  const [row] = await db.insert(productBundleComponents).values({
    bizId,
    ...parsed.data,
    metadata: parsed.data.metadata ?? {},
  }).returning()
  return ok(c, row, 201)
})
