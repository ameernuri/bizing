import { index, uniqueIndex } from 'drizzle-orm/pg-core'
import { decimal, integer, jsonb, pgTable, text, uuid, varchar } from 'drizzle-orm/pg-core'
import { createdAt, deletedAt, id, idRef, updatedAt } from './_common'
import { lifecycleStatusEnum } from './enums'
import { locations } from './locations'
import { bizes } from './bizes'

/**
 * products
 *
 * Product catalog for add-ons, bundles, digital fulfillment, and mixed carts.
 *
 * Relationship map:
 * - Referenced by `order_items.product_id` for checkout and accounting lines.
 * - Can be referenced by `booking_fees.product_id` when fees are represented as
 *   productized line items.
 * - Can be sold without bookings through `orders` + `order_items`.
 */
export const products = pgTable('products', {
  id: id,

  /** Tenant boundary for product catalog partitioning. */
  bizId: idRef('biz_id').references(() => bizes.id).notNull(),

  /** Optional location-scope for branch-specific product availability. */
  locationId: idRef('location_id').references(() => locations.id),

  /** Customer-visible name shown in carts, invoices, and catalogs. */
  name: varchar('name', { length: 255 }).notNull(),

  /** Stable per-org route key used by admin and storefront APIs. */
  slug: varchar('slug', { length: 100 }).notNull(),

  /** Internal stock identifier used for ERP/accounting sync. */
  sku: varchar('sku', { length: 120 }),
  description: text('description'),

  /** Legacy decimal retained for compatibility with existing queries. */
  price: decimal('price', { precision: 10, scale: 2 }).notNull(),

  /** Canonical minor-unit price/cost for accounting and reporting. */
  basePriceAmount: integer('base_price_amount').notNull().default(0),

  /** Unit cost for margin analytics and profitability reports. */
  costAmount: integer('cost_amount'),

  /** Merchant settlement/display currency for this product. */
  currency: varchar('currency', { length: 3 }).default('USD'),

  /** Flexible product classification (digital, physical, fee, etc.). */
  type: varchar('type', { length: 50 }).default('digital'),

  /** Content lifecycle: draft -> active -> inactive/archived. */
  status: lifecycleStatusEnum('status').default('draft').notNull(),

  /** Delivery target for downloadable assets when digital. */
  downloadUrl: varchar('download_url', { length: 500 }),

  /** Fulfillment channel selector used by post-purchase automation. */
  fulfillmentType: varchar('fulfillment_type', { length: 50 }).default('none').notNull(),

  /** Inventory controls (stock, backorder policy, thresholds). */
  inventoryTracking: jsonb('inventory_tracking').default({}),

  /** Extension payload for tags/attributes not yet normalized. */
  metadata: jsonb('metadata').default({}),

  createdAt: createdAt,
  updatedAt: updatedAt,
  deletedAt: deletedAt,
}, (table) => ({
  productsOrgSlugUnique: uniqueIndex('products_org_slug_unique').on(table.bizId, table.slug),
  productsOrgSkuUnique: uniqueIndex('products_org_sku_unique').on(table.bizId, table.sku),
  productsOrgStatusIdx: index('products_org_status_idx').on(table.bizId, table.status),
}))

export type Product = typeof products.$inferSelect
export type NewProduct = typeof products.$inferInsert
