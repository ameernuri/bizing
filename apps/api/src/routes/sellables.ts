/**
 * Sellable routes.
 *
 * ELI5:
 * A sellable is the common commercial face for things we can sell.
 * Products, service products, offer versions, and direct resource rates all
 * plug into this one root so pricing/reporting APIs do not need to guess where
 * commerce started.
 *
 * Why this route exists:
 * - lets operators and agents discover the canonical commercial id,
 * - keeps pricing, checkout, tax, invoice, and reporting flows keyed to one
 *   stable entity instead of many ad-hoc source ids,
 * - gives sagas and debugging a clean way to prove which sellable a scenario
 *   is talking about.
 */

import { Hono } from 'hono'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import dbPackage from '@bizing/db'
import { requireAclPermission, requireAuth, requireBizAccess } from '../middleware/auth.js'
import { fail, ok } from './_api.js'

const {
  db,
  sellables,
  sellableProducts,
  sellableServiceProducts,
  sellableOfferVersions,
  sellableResourceRates,
} = dbPackage

const listQuerySchema = z.object({
  kind: z.enum(['product', 'service_product', 'offer_version', 'resource_rate']).optional(),
  status: z.enum(['draft', 'active', 'inactive', 'suspended', 'archived']).optional(),
  slug: z.string().min(1).max(160).optional(),
  productId: z.string().optional(),
  serviceProductId: z.string().optional(),
  offerVersionId: z.string().optional(),
  resourceRateId: z.string().optional(),
})

export const sellableRoutes = new Hono()

sellableRoutes.get(
  '/bizes/:bizId/sellables',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = listQuerySchema.safeParse(c.req.query())
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid query parameters.', 400, parsed.error.flatten())
    }

    const query = parsed.data
    const rows = await db.query.sellables.findMany({
      where: and(
        eq(sellables.bizId, bizId),
        query.kind ? eq(sellables.kind, query.kind) : undefined,
        query.status ? eq(sellables.status, query.status) : undefined,
        query.slug ? eq(sellables.slug, query.slug) : undefined,
      ),
    })

    const productIds = new Set<string>()
    const serviceProductIds = new Set<string>()
    const offerVersionIds = new Set<string>()
    const resourceRateIds = new Set<string>()

    for (const row of rows) {
      if (row.kind === 'product') productIds.add(row.id)
      if (row.kind === 'service_product') serviceProductIds.add(row.id)
      if (row.kind === 'offer_version') offerVersionIds.add(row.id)
      if (row.kind === 'resource_rate') resourceRateIds.add(row.id)
    }

    const [productLinks, serviceProductLinks, offerVersionLinks, resourceRateLinks] = await Promise.all([
      productIds.size
        ? db.query.sellableProducts.findMany({ where: and(eq(sellableProducts.bizId, bizId)) })
        : Promise.resolve([]),
      serviceProductIds.size
        ? db.query.sellableServiceProducts.findMany({ where: and(eq(sellableServiceProducts.bizId, bizId)) })
        : Promise.resolve([]),
      offerVersionIds.size
        ? db.query.sellableOfferVersions.findMany({ where: and(eq(sellableOfferVersions.bizId, bizId)) })
        : Promise.resolve([]),
      resourceRateIds.size
        ? db.query.sellableResourceRates.findMany({ where: and(eq(sellableResourceRates.bizId, bizId)) })
        : Promise.resolve([]),
    ])

    const productBySellableId = new Map(productLinks.map((row) => [row.sellableId, row.productId]))
    const serviceProductBySellableId = new Map(serviceProductLinks.map((row) => [row.sellableId, row.serviceProductId]))
    const offerVersionBySellableId = new Map(offerVersionLinks.map((row) => [row.sellableId, row.offerVersionId]))
    const resourceRateBySellableId = new Map(resourceRateLinks.map((row) => [row.sellableId, row.id]))

    const enriched = rows.map((row) => ({
      ...row,
      source: {
        productId: productBySellableId.get(row.id) ?? null,
        serviceProductId: serviceProductBySellableId.get(row.id) ?? null,
        offerVersionId: offerVersionBySellableId.get(row.id) ?? null,
        resourceRateId: resourceRateBySellableId.get(row.id) ?? null,
      },
    }))

    const filtered = enriched.filter((row) => {
      if (query.productId && row.source.productId !== query.productId) return false
      if (query.serviceProductId && row.source.serviceProductId !== query.serviceProductId) return false
      if (query.offerVersionId && row.source.offerVersionId !== query.offerVersionId) return false
      if (query.resourceRateId && row.source.resourceRateId !== query.resourceRateId) return false
      return true
    })

    return ok(c, filtered)
  },
)

sellableRoutes.get(
  '/bizes/:bizId/sellables/:sellableId',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, sellableId } = c.req.param()
    const row = await db.query.sellables.findFirst({
      where: and(eq(sellables.bizId, bizId), eq(sellables.id, sellableId)),
    })
    if (!row) return fail(c, 'NOT_FOUND', 'Sellable not found.', 404)

    const [productLink, serviceProductLink, offerVersionLink, resourceRateLink] = await Promise.all([
      db.query.sellableProducts.findFirst({ where: and(eq(sellableProducts.bizId, bizId), eq(sellableProducts.sellableId, sellableId)) }),
      db.query.sellableServiceProducts.findFirst({ where: and(eq(sellableServiceProducts.bizId, bizId), eq(sellableServiceProducts.sellableId, sellableId)) }),
      db.query.sellableOfferVersions.findFirst({ where: and(eq(sellableOfferVersions.bizId, bizId), eq(sellableOfferVersions.sellableId, sellableId)) }),
      db.query.sellableResourceRates.findFirst({ where: and(eq(sellableResourceRates.bizId, bizId), eq(sellableResourceRates.sellableId, sellableId)) }),
    ])

    return ok(c, {
      ...row,
      source: {
        productId: productLink?.productId ?? null,
        serviceProductId: serviceProductLink?.serviceProductId ?? null,
        offerVersionId: offerVersionLink?.offerVersionId ?? null,
        resourceRateId: resourceRateLink?.id ?? null,
      },
    })
  },
)
