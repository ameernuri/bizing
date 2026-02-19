import { index, uniqueIndex } from 'drizzle-orm/pg-core'
import { integer, jsonb, pgTable, uuid, varchar } from 'drizzle-orm/pg-core'
import { createdAt, deletedAt, id, idRef, updatedAt } from './_common'
import { bookings } from './bookings'
import { lifecycleStatusEnum, paymentStatusEnum } from './enums'
import { bizes } from './bizes'
import { products } from './products'
import { services } from './services'
import { users } from './users'

/**
 * orders
 *
 * Commercial ledger root for booking and non-booking purchases.
 *
 * Why separate from bookings:
 * - Allows product-only sales and mixed carts.
 * - Preserves accounting flexibility when booking state diverges from payment.
 *
 * Relationship map:
 * - Optional 1:1 with `bookings` via `orders.booking_id`.
 * - 1:many with `order_items`.
 * - Referenced by `payment_intents.order_id` + `payment_transactions.order_id`.
 * - Referenced by Stripe mirrors (`stripe_checkout_sessions`, `stripe_invoices`).
 */
export const orders = pgTable('orders', {
  id: id,

  /** Tenant boundary for accounting/reporting partitioning. */
  bizId: idRef('biz_id').references(() => bizes.id).notNull(),

  /** Optional booking linkage for service-related commerce flows. */
  bookingId: idRef('booking_id').references(() => bookings.id),

  /** Customer accountable for this order; nullable for guest/import flows. */
  customerUserId: idRef('customer_user_id').references(() => users.id),

  /** Commercial lifecycle (active, archived, etc.). */
  status: lifecycleStatusEnum('status').default('active').notNull(),

  /** Payment settlement state mirrored from payment subsystem. */
  paymentStatus: paymentStatusEnum('payment_status').default('unpaid').notNull(),

  /** Sum of base line item amounts before taxes/fees/discounts. */
  subtotalAmount: integer('subtotal_amount').default(0).notNull(),

  /** Aggregated service/call/processing fees applied to this order. */
  feesAmount: integer('fees_amount').default(0).notNull(),

  /** Aggregated discounts/coupons/promotions. */
  discountsAmount: integer('discounts_amount').default(0).notNull(),

  /** Tax total in minor units. */
  taxAmount: integer('tax_amount').default(0).notNull(),

  /** Final payable total = subtotal + fees + tax - discounts. */
  totalAmount: integer('total_amount').default(0).notNull(),

  /** Cumulative settled amount captured from payment provider(s). */
  paidAmount: integer('paid_amount').default(0).notNull(),

  /** Cumulative refunded amount. */
  refundedAmount: integer('refunded_amount').default(0).notNull(),

  /** Remaining due balance after captures/refunds. */
  balanceAmount: integer('balance_amount').default(0).notNull(),

  /** Order currency; should match payment intent currency for settlement. */
  currency: varchar('currency', { length: 3 }).default('USD').notNull(),

  /** Extension payload for tax snapshots, checkout metadata, etc. */
  metadata: jsonb('metadata').default({}),

  createdAt: createdAt,
  updatedAt: updatedAt,
  deletedAt: deletedAt,
}, (table) => ({
  ordersOrgStatusIdx: index('orders_org_status_idx').on(table.bizId, table.status, table.paymentStatus),
  ordersBookingUnique: uniqueIndex('orders_booking_unique').on(table.bookingId),
}))

/** Order line-items for service/product/fee entries. */
export const orderItems = pgTable('order_items', {
  id: id,

  /** Tenant boundary copied from order for denormalized filtering/indexing. */
  bizId: idRef('biz_id').references(() => bizes.id).notNull(),

  /** Parent order this line belongs to. */
  orderId: idRef('order_id').references(() => orders.id).notNull(),

  /** `service` / `product` / `fee` / etc (controlled by app-level enum for now). */
  itemType: varchar('item_type', { length: 30 }).notNull(),

  /** Optional reference when line is service-backed. */
  serviceId: idRef('service_id').references(() => services.id),

  /** Optional reference when line is product-backed. */
  productId: idRef('product_id').references(() => products.id),

  /** Customer-facing line item label shown on invoices/receipts. */
  label: varchar('label', { length: 255 }).notNull(),

  /** Units purchased (or fee quantity). */
  quantity: integer('quantity').default(1).notNull(),

  /** Price per unit in minor units. */
  unitAmount: integer('unit_amount').default(0).notNull(),

  /** Extended amount in minor units (quantity * unitAmount +/- adjustments). */
  totalAmount: integer('total_amount').default(0).notNull(),

  /** Currency for this line; typically matches order currency. */
  currency: varchar('currency', { length: 3 }).default('USD').notNull(),

  /** Extension payload for entitlement/fulfillment/tax detail. */
  metadata: jsonb('metadata').default({}),

  createdAt: createdAt,
  updatedAt: updatedAt,
}, (table) => ({
  orderItemsOrgOrderIdx: index('order_items_org_order_idx').on(table.bizId, table.orderId),
}))

export type Order = typeof orders.$inferSelect
export type NewOrder = typeof orders.$inferInsert

export type OrderItem = typeof orderItems.$inferSelect
export type NewOrderItem = typeof orderItems.$inferInsert
