import { sql } from 'drizzle-orm'
import { check, foreignKey, index, uniqueIndex } from 'drizzle-orm/pg-core'
import { integer, jsonb, pgTable, text, varchar } from 'drizzle-orm/pg-core'
import { id, idRef, withAuditRefs } from './_common'
import { lifecycleStatusEnum, productTypeEnum } from './enums'
import { locations } from './locations'
import { bizes } from './bizes'
import { users } from './users'

/**
 * products
 *
 * Product catalog identity for sellable items.
 *
 * Important v0 boundary:
 * - This table stores catalog identity + commercial defaults.
 * - Bundle composition, stock, reservations, and physical fulfillment live in
 *   `product_commerce.ts` tables.
 *
 * Relationship map:
 * - Referenced by `booking_order_lines`/future commerce line-item tables for
 *   checkout and accounting attribution.
 * - Can represent non-time sellables independently of booking flows.
 * - Can be used by pricing/fee policies as reusable productized charges.
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

  /** Canonical minor-unit base price for accounting/reporting (e.g., cents). */
  basePriceMinor: integer('base_price_minor').notNull().default(0),

  /** Unit cost for margin analytics and profitability reports. */
  costMinor: integer('cost_minor'),

  /**
   * Merchant settlement/display currency for this product.
   * Kept non-null so money math/read models never need "null currency" fallbacks.
   */
  currency: varchar('currency', { length: 3 }).default('USD').notNull(),

  /**
   * Flexible product classification for routing/fulfillment logic.
   * Keep this generic so one catalog can support many business models.
   */
  type: productTypeEnum('type').default('digital').notNull(),

  /** Content lifecycle: draft -> active -> inactive/archived. */
  status: lifecycleStatusEnum('status').default('draft').notNull(),

  /** Delivery target for downloadable assets when digital. */
  downloadUrl: varchar('download_url', { length: 500 }),

  /** Extension payload for tags/attributes not yet normalized. */
  metadata: jsonb('metadata').default({}),

  /** Full audit timestamps + actor references. */
  ...withAuditRefs(() => users.id),
}, (table) => ({
  productsBizIdIdUnique: uniqueIndex('products_biz_id_id_unique').on(table.bizId, table.id),
  productsOrgSlugUnique: uniqueIndex('products_org_slug_unique').on(table.bizId, table.slug),
  productsOrgSkuUnique: uniqueIndex('products_org_sku_unique').on(table.bizId, table.sku),
  productsOrgStatusIdx: index('products_org_status_idx').on(table.bizId, table.status),
  /** Tenant-safe optional location scope pointer. */
  productsBizLocationFk: foreignKey({
    columns: [table.bizId, table.locationId],
    foreignColumns: [locations.bizId, locations.id],
    name: 'products_biz_location_fk',
  }),
  /** Currency must always be uppercase ISO-like format (e.g. USD). */
  productsCurrencyFormatCheck: check(
    'products_currency_format_check',
    sql`"currency" ~ '^[A-Z]{3}$'`,
  ),
}))

export type Product = typeof products.$inferSelect
export type NewProduct = typeof products.$inferInsert
