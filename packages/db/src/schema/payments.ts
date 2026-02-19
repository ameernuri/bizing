import { index, uniqueIndex } from 'drizzle-orm/pg-core'
import { integer, jsonb, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'
import { createdAt, deletedAt, id, idRef, updatedAt } from './_common'
import { bookings } from './bookings'
import { orders } from './commerce'
import {
  allocationSourceTypeEnum,
  allocationTargetTypeEnum,
  disputeStatusEnum,
  paymentIntentStatusEnum,
  paymentStatusEnum,
  transactionStatusEnum,
  transactionTypeEnum,
} from './enums'
import { bizes } from './bizes'
import { users } from './users'

/**
 * payment_intents
 *
 * Provider-facing payment orchestration record (Stripe-first but provider-agnostic).
 *
 * Notes:
 * - stores normalized money fields in minor units
 * - keeps provider pointers for reconciliation + webhook correlation
 */
export const paymentIntents = pgTable('payment_intents', {
  id: id,
  bizId: idRef('biz_id').references(() => bizes.id).notNull(),
  bookingId: idRef('booking_id').references(() => bookings.id),
  orderId: idRef('order_id').references(() => orders.id),
  customerUserId: idRef('customer_user_id').references(() => users.id),

  /** Usually `stripe`; kept generic for future provider abstraction. */
  provider: varchar('provider', { length: 50 }).default('stripe').notNull(),

  /** Provider intent id (`pi_...` for Stripe). */
  providerIntentId: varchar('provider_intent_id', { length: 255 }),

  /** Optional provider-side related pointers. */
  providerCustomerId: varchar('provider_customer_id', { length: 255 }),
  providerPaymentMethodId: varchar('provider_payment_method_id', { length: 255 }),
  providerSetupIntentId: varchar('provider_setup_intent_id', { length: 255 }),

  /**
   * Only a hash/fingerprint of client secret should be persisted, not raw secret.
   * Useful for duplicate protection and traceability.
   */
  providerClientSecretHash: varchar('provider_client_secret_hash', { length: 255 }),

  status: paymentIntentStatusEnum('status').default('requires_payment_method').notNull(),
  paymentStatus: paymentStatusEnum('payment_status').default('unpaid').notNull(),

  amountAuthorized: integer('amount_authorized').default(0).notNull(),
  amountCaptured: integer('amount_captured').default(0).notNull(),
  amountRefunded: integer('amount_refunded').default(0).notNull(),
  currency: varchar('currency', { length: 3 }).default('USD').notNull(),

  /** Capture strategy + connect transfer grouping. */
  captureMethod: varchar('capture_method', { length: 50 }).default('automatic').notNull(),
  transferGroup: varchar('transfer_group', { length: 255 }),
  onBehalfOfAccountId: varchar('on_behalf_of_account_id', { length: 255 }),
  statementDescriptor: varchar('statement_descriptor', { length: 255 }),

  /** Provider-specific recoverable error / next-action context. */
  lastProviderError: jsonb('last_provider_error').default({}),
  providerNextAction: jsonb('provider_next_action').default({}),

  idempotencyKey: varchar('idempotency_key', { length: 255 }),
  metadata: jsonb('metadata').default({}),

  createdAt: createdAt,
  updatedAt: updatedAt,
  deletedAt: deletedAt,
}, (table) => ({
  paymentIntentsProviderUnique: uniqueIndex('payment_intents_provider_unique').on(table.provider, table.providerIntentId),
  paymentIntentsOrgIdx: index('payment_intents_org_idx').on(table.bizId, table.status, table.paymentStatus),
  paymentIntentsBookingIdx: index('payment_intents_booking_idx').on(table.bookingId),
  paymentIntentsIdempotencyUnique: uniqueIndex('payment_intents_idempotency_unique').on(table.bizId, table.idempotencyKey),
  paymentIntentsProviderCustomerIdx: index('payment_intents_provider_customer_idx').on(table.providerCustomerId),
}))

/**
 * payment_transactions
 *
 * Ledger entries under a payment intent.
 * One intent can have multiple transactions (auth + capture + refunds).
 */
export const paymentTransactions = pgTable('payment_transactions', {
  id: id,
  bizId: idRef('biz_id').references(() => bizes.id).notNull(),
  paymentIntentId: idRef('payment_intent_id').references(() => paymentIntents.id).notNull(),
  bookingId: idRef('booking_id').references(() => bookings.id),
  orderId: idRef('order_id').references(() => orders.id),

  type: transactionTypeEnum('type').notNull(),
  status: transactionStatusEnum('status').default('pending').notNull(),

  amount: integer('amount').notNull(),
  currency: varchar('currency', { length: 3 }).default('USD').notNull(),

  /** Provider transaction id (e.g., Stripe charge/refund id). */
  providerTransactionId: varchar('provider_transaction_id', { length: 255 }),

  /** Stripe-friendly pointers (also useful for other providers with equivalents). */
  providerChargeId: varchar('provider_charge_id', { length: 255 }),
  providerRefundId: varchar('provider_refund_id', { length: 255 }),
  providerBalanceTransactionId: varchar('provider_balance_transaction_id', { length: 255 }),
  providerTransferId: varchar('provider_transfer_id', { length: 255 }),

  /** Provider processing fee in minor units when available. */
  providerFeeAmount: integer('provider_fee_amount'),

  reason: varchar('reason', { length: 500 }),
  metadata: jsonb('metadata').default({}),

  occurredAt: timestamp('occurred_at', { withTimezone: true }).defaultNow().notNull(),
  createdAt: createdAt,
}, (table) => ({
  paymentTransactionsOrgIdx: index('payment_transactions_org_idx').on(table.bizId, table.paymentIntentId, table.occurredAt),
  paymentTransactionsProviderIdx: index('payment_transactions_provider_idx').on(table.providerTransactionId),
  paymentTransactionsChargeIdx: index('payment_transactions_charge_idx').on(table.providerChargeId),
}))

/**
 * payment_allocations
 *
 * Split-tender and component-level allocation ledger.
 * Explains exactly what part of a transaction funded what target.
 */
export const paymentAllocations = pgTable('payment_allocations', {
  id: id,
  bizId: idRef('biz_id').references(() => bizes.id).notNull(),
  paymentTransactionId: idRef('payment_transaction_id').references(() => paymentTransactions.id).notNull(),
  bookingId: idRef('booking_id').references(() => bookings.id),
  orderId: idRef('order_id').references(() => orders.id),

  sourceType: allocationSourceTypeEnum('source_type').notNull(),
  sourceRef: varchar('source_ref', { length: 255 }),

  targetType: allocationTargetTypeEnum('target_type').notNull(),
  targetRef: varchar('target_ref', { length: 255 }),

  amount: integer('amount').notNull(),
  currency: varchar('currency', { length: 3 }).default('USD').notNull(),
  metadata: jsonb('metadata').default({}),

  createdAt: createdAt,
}, (table) => ({
  paymentAllocationsOrgIdx: index('payment_allocations_org_idx').on(table.bizId, table.paymentTransactionId),
  paymentAllocationsBookingIdx: index('payment_allocations_booking_idx').on(table.bookingId),
}))

/**
 * payment_disputes
 *
 * Dispute/chargeback lifecycle tracking.
 */
export const paymentDisputes = pgTable('payment_disputes', {
  id: id,
  bizId: idRef('biz_id').references(() => bizes.id).notNull(),
  paymentIntentId: idRef('payment_intent_id').references(() => paymentIntents.id).notNull(),
  paymentTransactionId: idRef('payment_transaction_id').references(() => paymentTransactions.id),
  bookingId: idRef('booking_id').references(() => bookings.id),
  customerUserId: idRef('customer_user_id').references(() => users.id),

  /** Provider dispute id (`dp_...` in Stripe). */
  providerDisputeId: varchar('provider_dispute_id', { length: 255 }),

  /** Provider charge id tied to the dispute. */
  providerChargeId: varchar('provider_charge_id', { length: 255 }),

  status: disputeStatusEnum('status').default('needs_response').notNull(),
  reason: varchar('reason', { length: 255 }),

  /** Provider-native reason code if supplied. */
  providerReasonCode: varchar('provider_reason_code', { length: 100 }),

  amount: integer('amount').notNull(),
  currency: varchar('currency', { length: 3 }).default('USD').notNull(),

  evidence: jsonb('evidence').default({}),

  /** Provider response SLA deadline (critical for automated workflows). */
  dueAt: timestamp('due_at', { withTimezone: true }),
  providerEvidenceDueAt: timestamp('provider_evidence_due_at', { withTimezone: true }),

  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  outcome: varchar('outcome', { length: 50 }),

  metadata: jsonb('metadata').default({}),

  createdAt: createdAt,
  updatedAt: updatedAt,
  deletedAt: deletedAt,
}, (table) => ({
  paymentDisputesOrgStatusIdx: index('payment_disputes_org_status_idx').on(table.bizId, table.status),
  paymentDisputesProviderUnique: uniqueIndex('payment_disputes_provider_unique').on(table.providerDisputeId),
  paymentDisputesChargeIdx: index('payment_disputes_charge_idx').on(table.providerChargeId),
}))

export type PaymentIntent = typeof paymentIntents.$inferSelect
export type NewPaymentIntent = typeof paymentIntents.$inferInsert

export type PaymentTransaction = typeof paymentTransactions.$inferSelect
export type NewPaymentTransaction = typeof paymentTransactions.$inferInsert

export type PaymentAllocation = typeof paymentAllocations.$inferSelect
export type NewPaymentAllocation = typeof paymentAllocations.$inferInsert

export type PaymentDispute = typeof paymentDisputes.$inferSelect
export type NewPaymentDispute = typeof paymentDisputes.$inferInsert
