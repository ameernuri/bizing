import { sql } from 'drizzle-orm'
import { check, foreignKey, index, uniqueIndex } from 'drizzle-orm/pg-core'
import { boolean, integer, jsonb, pgTable, timestamp, varchar } from 'drizzle-orm/pg-core'
import { createdAt, deletedAt, id, idRef, updatedAt } from './_common'
import { bookingOrders } from './fulfillment'
import { groupAccounts } from './group_accounts'
import { bizes } from './bizes'
import { paymentIntents, paymentProcessorAccounts, paymentTransactions } from './payments'
import { users } from './users'
import { crossBizOrders } from './marketplace'

/**
 * Stripe integration notes
 *
 * These tables intentionally mirror selected Stripe objects instead of storing
 * every provider field. The goals are:
 * - idempotent webhook processing
 * - fast local joins for API responses
 * - forensic reconciliation without repeatedly calling Stripe APIs
 *
 * PII/secrets handling:
 * - raw card data must never be stored.
 * - client secrets are stored as hash/fingerprint only.
 */

/**
 * stripe_accounts
 *
 * Stripe Connect account state per org.
 *
 * Used for:
 * - marketplace payouts
 * - destination charges/transfers
 * - onboarding requirement tracking
 */
export const stripeAccounts = pgTable('stripe_accounts', {
  id: id,

  /** Owning tenant using this connected account. */
  bizId: idRef('biz_id').references(() => bizes.id).notNull(),

  /**
   * Generic processor-account routing row this Stripe mirror belongs to.
   *
   * Why this exists:
   * - keeps Stripe-specific mirrors aligned with processor-agnostic routing,
   * - supports platform-managed MOR and biz-owned account models uniformly,
   * - makes future processor expansion coherent with one payments backbone.
   */
  paymentProcessorAccountId: idRef('payment_processor_account_id')
    .references(() => paymentProcessorAccounts.id)
    .notNull(),

  /** `acct_...` identifier from Stripe. */
  stripeAccountId: varchar('stripe_account_id', { length: 255 }).notNull(),

  /** Connect account model (`standard`, `express`, `custom`). */
  accountType: varchar('account_type', { length: 30 }).default('express').notNull(),

  /** Country/currency defaults used for settlement assumptions. */
  country: varchar('country', { length: 2 }),
  defaultCurrency: varchar('default_currency', { length: 3 }).default('USD').notNull(),

  /** Capability flags mirrored for onboarding gating in UI/API. */
  chargesEnabled: boolean('charges_enabled').default(false).notNull(),
  payoutsEnabled: boolean('payouts_enabled').default(false).notNull(),
  detailsSubmitted: boolean('details_submitted').default(false).notNull(),

  /**
   * Operational usage role for this account within one biz.
   * Supports default Bizing platform MOR while allowing direct-account expansion.
   */
  accountUsageModel: varchar('account_usage_model', { length: 40 })
    .default('platform_mor')
    .notNull(),

  /**
   * Commercial responsibility model for this account in this biz context.
   * This complements generic `payment_processor_accounts.commerce_model`.
   */
  merchantModel: varchar('merchant_model', { length: 40 })
    .default('merchant_of_record')
    .notNull(),

  /** Marks default account used when creating charge-side Stripe flows. */
  isDefaultForCharges: boolean('is_default_for_charges').default(false).notNull(),

  /** Marks default account used for payout/transfer-side Stripe flows. */
  isDefaultForPayouts: boolean('is_default_for_payouts').default(false).notNull(),

  /** Next Stripe deadline for required onboarding details. */
  requirementsCurrentDeadline: timestamp('requirements_current_deadline', { withTimezone: true }),

  /** Selected JSON mirrors from Stripe account payload. */
  capabilities: jsonb('capabilities').default({}),
  businessProfile: jsonb('business_profile').default({}),
  settings: jsonb('settings').default({}),
  metadata: jsonb('metadata').default({}),

  createdAt: createdAt,
  updatedAt: updatedAt,
  deletedAt: deletedAt,
}, (table) => ({
    stripeAccountsBizIdIdUnique: uniqueIndex("stripe_accounts_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
  /** Composite key for tenant-safe FKs from other Stripe mirrors. */
  /** One Stripe mirror row per processor-account routing row. */
  stripeAccountsBizProcessorAccountUnique: uniqueIndex(
    'stripe_accounts_biz_processor_account_unique',
  ).on(table.bizId, table.paymentProcessorAccountId),
  /**
   * Stripe account ids are unique inside one biz namespace.
   *
   * We intentionally do not keep this globally unique because platform-managed
   * MOR accounts may be mirrored across many biz tenants.
   */
  stripeAccountsBizStripeIdUnique: uniqueIndex('stripe_accounts_biz_stripe_id_unique').on(
    table.bizId,
    table.stripeAccountId,
  ),
  /** One active default charge account per biz. */
  stripeAccountsBizDefaultChargesUnique: uniqueIndex(
    'stripe_accounts_biz_default_charges_unique',
  )
    .on(table.bizId)
    .where(sql`"is_default_for_charges" = true AND "deleted_at" IS NULL`),
  /** One active default payout account per biz. */
  stripeAccountsBizDefaultPayoutsUnique: uniqueIndex(
    'stripe_accounts_biz_default_payouts_unique',
  )
    .on(table.bizId)
    .where(sql`"is_default_for_payouts" = true AND "deleted_at" IS NULL`),
  stripeAccountsEnabledIdx: index('stripe_accounts_enabled_idx').on(table.chargesEnabled, table.payoutsEnabled),
  stripeAccountsBizUsageModelIdx: index('stripe_accounts_biz_usage_model_idx').on(
    table.bizId,
    table.accountUsageModel,
    table.merchantModel,
  ),
  stripeAccountsUsageModelCheck: check(
    'stripe_accounts_usage_model_check',
    sql`
    ("account_usage_model" IN ('platform_mor', 'biz_direct', 'marketplace_destination', 'payout_only')
      OR "account_usage_model" LIKE 'custom_%')
    AND ("merchant_model" IN ('merchant_of_record', 'payment_facilitator', 'direct')
      OR "merchant_model" LIKE 'custom_%')
    `,
  ),
  stripeAccountsBizProcessorAccountFk: foreignKey({
    columns: [table.bizId, table.paymentProcessorAccountId],
    foreignColumns: [paymentProcessorAccounts.bizId, paymentProcessorAccounts.id],
    name: 'stripe_accounts_biz_processor_account_fk',
  }),
  /** Currency defaults should be uppercase ISO-like code shape. */
  stripeAccountsDefaultCurrencyFormatCheck: check(
    'stripe_accounts_default_currency_format_check',
    sql`"default_currency" ~ '^[A-Z]{3}$'`,
  ),
}))

/**
 * stripe_customers
 *
 * Maps internal user/group-account to Stripe customer (`cus_...`).
 *
 * One internal identity can have one Stripe customer per org.
 */
export const stripeCustomers = pgTable('stripe_customers', {
  id: id,
  bizId: idRef('biz_id').references(() => bizes.id).notNull(),

  /**
   * Stripe account context for this customer mapping.
   * Required for multi-account-per-biz setups where one user can exist as
   * different Stripe customers under different connected accounts.
   */
  stripeAccountRefId: idRef('stripe_account_ref_id')
    .references(() => stripeAccounts.id)
    .notNull(),

  /** Optional individual owner for B2C identity linkage. */
  userId: idRef('user_id').references(() => users.id),

  /** Optional group account owner for shared billing. */
  groupAccountId: idRef('group_account_id').references(() => groupAccounts.id),

  /** `cus_...` identifier from Stripe. */
  stripeCustomerId: varchar('stripe_customer_id', { length: 255 }).notNull(),

  /** Denormalized contact mirrors for fast display/filtering. */
  email: varchar('email', { length: 255 }),
  name: varchar('name', { length: 255 }),
  phone: varchar('phone', { length: 50 }),

  /** `pm_...` id for default PM at Stripe side. */
  defaultPaymentMethodStripeId: varchar('default_payment_method_stripe_id', { length: 255 }),

  livemode: boolean('livemode').default(false).notNull(),
  metadata: jsonb('metadata').default({}),

  createdAt: createdAt,
  updatedAt: updatedAt,
  deletedAt: deletedAt,
}, (table) => ({
    stripeCustomersBizIdIdUnique: uniqueIndex("stripe_customers_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
  stripeCustomersStripeIdUnique: uniqueIndex('stripe_customers_stripe_id_unique').on(table.stripeCustomerId),
  stripeCustomersBizAccountUserUnique: uniqueIndex('stripe_customers_biz_account_user_unique')
    .on(table.bizId, table.stripeAccountRefId, table.userId)
    .where(sql`"user_id" IS NOT NULL`),
  stripeCustomersBizAccountGroupAccountUnique: uniqueIndex('stripe_customers_biz_account_group_account_unique')
    .on(table.bizId, table.stripeAccountRefId, table.groupAccountId)
    .where(sql`"group_account_id" IS NOT NULL`),
  stripeCustomersBizAccountIdx: index('stripe_customers_biz_account_idx').on(
    table.bizId,
    table.stripeAccountRefId,
  ),
  stripeCustomersBizAccountFk: foreignKey({
    columns: [table.bizId, table.stripeAccountRefId],
    foreignColumns: [stripeAccounts.bizId, stripeAccounts.id],
    name: 'stripe_customers_biz_account_fk',
  }),
  stripeCustomersBizGroupAccountFk: foreignKey({
    columns: [table.bizId, table.groupAccountId],
    foreignColumns: [groupAccounts.bizId, groupAccounts.id],
    name: 'stripe_customers_biz_group_account_fk',
  }),
}))

/**
 * stripe_payment_methods
 *
 * Cached payment method metadata for fast display and safe default selection.
 */
export const stripePaymentMethods = pgTable('stripe_payment_methods', {
  id: id,
  bizId: idRef('biz_id').references(() => bizes.id).notNull(),

  /** Local link to `stripe_customers` row if known. */
  stripeCustomerRefId: idRef('stripe_customer_ref_id').references(() => stripeCustomers.id),

  /** `pm_...` identifier from Stripe. */
  stripePaymentMethodId: varchar('stripe_payment_method_id', { length: 255 }).notNull(),

  /** Card/bank wallet summary fields for checkout UI. */
  type: varchar('type', { length: 50 }),
  brand: varchar('brand', { length: 50 }),
  last4: varchar('last4', { length: 4 }),
  expMonth: integer('exp_month'),
  expYear: integer('exp_year'),
  fingerprint: varchar('fingerprint', { length: 255 }),
  country: varchar('country', { length: 2 }),
  funding: varchar('funding', { length: 20 }),

  isDefault: boolean('is_default').default(false).notNull(),
  livemode: boolean('livemode').default(false).notNull(),

  billingDetails: jsonb('billing_details').default({}),
  metadata: jsonb('metadata').default({}),

  createdAt: createdAt,
  updatedAt: updatedAt,
  deletedAt: deletedAt,
}, (table) => ({
    stripePaymentMethodsBizIdIdUnique: uniqueIndex("stripe_payment_methods_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
  stripePaymentMethodsStripeIdUnique: uniqueIndex('stripe_payment_methods_stripe_id_unique').on(table.stripePaymentMethodId),
  stripePaymentMethodsOrgCustomerIdx: index('stripe_payment_methods_org_customer_idx').on(table.bizId, table.stripeCustomerRefId),
  stripePaymentMethodsFingerprintIdx: index('stripe_payment_methods_fingerprint_idx').on(table.fingerprint),
  stripePaymentMethodsBizCustomerFk: foreignKey({
    columns: [table.bizId, table.stripeCustomerRefId],
    foreignColumns: [stripeCustomers.bizId, stripeCustomers.id],
    name: 'stripe_payment_methods_biz_customer_fk',
  }),
}))

/**
 * stripe_setup_intents
 *
 * Tracks save-card/setup authorization flows (`seti_...`).
 */
export const stripeSetupIntents = pgTable('stripe_setup_intents', {
  id: id,
  bizId: idRef('biz_id').references(() => bizes.id).notNull(),

  /** Owner pointers mirror customer identity context. */
  userId: idRef('user_id').references(() => users.id),
  groupAccountId: idRef('group_account_id').references(() => groupAccounts.id),
  stripeCustomerRefId: idRef('stripe_customer_ref_id').references(() => stripeCustomers.id),

  /** `seti_...` identifier from Stripe. */
  stripeSetupIntentId: varchar('stripe_setup_intent_id', { length: 255 }).notNull(),

  /** Provider status (`requires_action`, `succeeded`, etc.). */
  status: varchar('status', { length: 50 }).notNull(),
  usage: varchar('usage', { length: 50 }),

  /** Resolved payment method when setup succeeds. */
  stripePaymentMethodId: varchar('stripe_payment_method_id', { length: 255 }),
  lastSetupError: jsonb('last_setup_error').default({}),

  livemode: boolean('livemode').default(false).notNull(),
  metadata: jsonb('metadata').default({}),

  createdAt: createdAt,
  updatedAt: updatedAt,
  deletedAt: deletedAt,
}, (table) => ({
    stripeSetupIntentsBizIdIdUnique: uniqueIndex("stripe_setup_intents_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
  stripeSetupIntentsStripeIdUnique: uniqueIndex('stripe_setup_intents_stripe_id_unique').on(table.stripeSetupIntentId),
  stripeSetupIntentsOrgStatusIdx: index('stripe_setup_intents_org_status_idx').on(table.bizId, table.status),
}))

/**
 * stripe_checkout_sessions
 *
 * Checkout session tracking (`cs_...`) for hosted checkout flows.
 */
export const stripeCheckoutSessions = pgTable('stripe_checkout_sessions', {
  id: id,
  bizId: idRef('biz_id').references(() => bizes.id).notNull(),

  /** Canonical commercial linkage for reconciliation and post-checkout routing. */
  bookingOrderId: idRef('booking_order_id').references(() => bookingOrders.id),
  crossBizOrderId: idRef('cross_biz_order_id').references(() => crossBizOrders.id),
  paymentIntentRefId: idRef('payment_intent_ref_id').references(() => paymentIntents.id),
  stripeCustomerRefId: idRef('stripe_customer_ref_id').references(() => stripeCustomers.id),
  /** Stripe account context used for this checkout session. */
  stripeAccountRefId: idRef('stripe_account_ref_id')
    .references(() => stripeAccounts.id)
    .notNull(),

  /** `cs_...` identifier from Stripe. */
  stripeCheckoutSessionId: varchar('stripe_checkout_session_id', { length: 255 }).notNull(),

  /** Session mode (`payment`, `setup`, `subscription`). */
  mode: varchar('mode', { length: 30 }).notNull(),

  /** Stripe checkout and payment status mirrors. */
  status: varchar('status', { length: 30 }),
  paymentStatus: varchar('payment_status', { length: 30 }),

  url: varchar('url', { length: 1000 }),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),

  livemode: boolean('livemode').default(false).notNull(),
  metadata: jsonb('metadata').default({}),

  createdAt: createdAt,
  updatedAt: updatedAt,
}, (table) => ({
    stripeCheckoutSessionsBizIdIdUnique: uniqueIndex("stripe_checkout_sessions_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
  stripeCheckoutSessionsStripeIdUnique: uniqueIndex('stripe_checkout_sessions_stripe_id_unique').on(table.stripeCheckoutSessionId),
  stripeCheckoutSessionsOrgStatusIdx: index('stripe_checkout_sessions_org_status_idx').on(table.bizId, table.status, table.paymentStatus),
  stripeCheckoutSessionsBizAccountIdx: index('stripe_checkout_sessions_biz_account_idx').on(
    table.bizId,
    table.stripeAccountRefId,
    table.status,
  ),
  stripeCheckoutSessionsBizAccountFk: foreignKey({
    columns: [table.bizId, table.stripeAccountRefId],
    foreignColumns: [stripeAccounts.bizId, stripeAccounts.id],
    name: 'stripe_checkout_sessions_biz_account_fk',
  }),
}))

/**
 * stripe_invoices
 *
 * Stripe invoice mirrors for subscriptions, memberships, and postpaid flows.
 */
export const stripeInvoices = pgTable('stripe_invoices', {
  id: id,
  bizId: idRef('biz_id').references(() => bizes.id).notNull(),

  /** Canonical commercial linkage for invoice traceability. */
  bookingOrderId: idRef('booking_order_id').references(() => bookingOrders.id),
  crossBizOrderId: idRef('cross_biz_order_id').references(() => crossBizOrders.id),
  stripeCustomerRefId: idRef('stripe_customer_ref_id').references(() => stripeCustomers.id),
  /** Stripe account context used for this invoice. */
  stripeAccountRefId: idRef('stripe_account_ref_id')
    .references(() => stripeAccounts.id)
    .notNull(),

  /** `in_...` identifier from Stripe. */
  stripeInvoiceId: varchar('stripe_invoice_id', { length: 255 }).notNull(),
  status: varchar('status', { length: 30 }),
  billingReason: varchar('billing_reason', { length: 50 }),

  amountDue: integer('amount_due').default(0).notNull(),
  amountPaid: integer('amount_paid').default(0).notNull(),
  amountRemaining: integer('amount_remaining').default(0).notNull(),
  currency: varchar('currency', { length: 3 }).default('USD').notNull(),

  hostedInvoiceUrl: varchar('hosted_invoice_url', { length: 1000 }),
  invoicePdfUrl: varchar('invoice_pdf_url', { length: 1000 }),

  dueAt: timestamp('due_at', { withTimezone: true }),
  paidAt: timestamp('paid_at', { withTimezone: true }),

  livemode: boolean('livemode').default(false).notNull(),
  metadata: jsonb('metadata').default({}),

  createdAt: createdAt,
  updatedAt: updatedAt,
}, (table) => ({
    stripeInvoicesBizIdIdUnique: uniqueIndex("stripe_invoices_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
  stripeInvoicesStripeIdUnique: uniqueIndex('stripe_invoices_stripe_id_unique').on(table.stripeInvoiceId),
  stripeInvoicesOrgStatusIdx: index('stripe_invoices_org_status_idx').on(table.bizId, table.status),
  stripeInvoicesBizAccountIdx: index('stripe_invoices_biz_account_idx').on(
    table.bizId,
    table.stripeAccountRefId,
    table.status,
  ),
  stripeInvoicesBizAccountFk: foreignKey({
    columns: [table.bizId, table.stripeAccountRefId],
    foreignColumns: [stripeAccounts.bizId, stripeAccounts.id],
    name: 'stripe_invoices_biz_account_fk',
  }),
  /** Currency should always use uppercase ISO-like code shape. */
  stripeInvoicesCurrencyFormatCheck: check(
    'stripe_invoices_currency_format_check',
    sql`"currency" ~ '^[A-Z]{3}$'`,
  ),
}))

/**
 * stripe_webhook_events
 *
 * Raw webhook intake store for idempotent processing + replay safety.
 */
export const stripeWebhookEvents = pgTable('stripe_webhook_events', {
  id: id,

  /** May be null on first ingest until tenant mapping resolves. */
  bizId: idRef('biz_id').references(() => bizes.id),

  /** Unique `evt_...` id for idempotent webhook handling. */
  stripeEventId: varchar('stripe_event_id', { length: 255 }).notNull(),

  /** Connect account context for multiplexed webhook endpoints. */
  stripeAccountId: varchar('stripe_account_id', { length: 255 }),
  /** Resolved local stripe-account row when mapping is known. */
  stripeAccountRefId: idRef('stripe_account_ref_id').references(() => stripeAccounts.id),
  eventType: varchar('event_type', { length: 120 }).notNull(),
  apiVersion: varchar('api_version', { length: 50 }),

  livemode: boolean('livemode').default(false).notNull(),

  /** Stripe's event created timestamp projected into timestamptz. */
  eventCreatedAt: timestamp('event_created_at', { withTimezone: true }),

  payload: jsonb('payload').notNull(),

  signatureVerified: boolean('signature_verified').default(false).notNull(),

  processingStatus: varchar('processing_status', { length: 30 }).default('pending').notNull(),
  attempts: integer('attempts').default(0).notNull(),
  processedAt: timestamp('processed_at', { withTimezone: true }),
  processingError: varchar('processing_error', { length: 2000 }),

  createdAt: createdAt,
  updatedAt: updatedAt,
}, (table) => ({
    stripeWebhookEventsBizIdIdUnique: uniqueIndex("stripe_webhook_events_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
  stripeWebhookEventsStripeIdUnique: uniqueIndex('stripe_webhook_events_stripe_id_unique').on(table.stripeEventId),
  stripeWebhookEventsStatusIdx: index('stripe_webhook_events_status_idx').on(table.processingStatus, table.createdAt),
  stripeWebhookEventsTypeIdx: index('stripe_webhook_events_type_idx').on(table.eventType),
  stripeWebhookEventsBizAccountIdx: index('stripe_webhook_events_biz_account_idx').on(
    table.bizId,
    table.stripeAccountRefId,
    table.processingStatus,
  ),
  stripeWebhookEventsBizAccountFk: foreignKey({
    columns: [table.bizId, table.stripeAccountRefId],
    foreignColumns: [stripeAccounts.bizId, stripeAccounts.id],
    name: 'stripe_webhook_events_biz_account_fk',
  }),
}))

/**
 * stripe_payouts
 *
 * Connect payout tracking for org settlement reconciliation.
 */
export const stripePayouts = pgTable('stripe_payouts', {
  id: id,
  bizId: idRef('biz_id').references(() => bizes.id).notNull(),

  /** Local account record this payout belongs to. */
  stripeAccountRefId: idRef('stripe_account_ref_id')
    .references(() => stripeAccounts.id)
    .notNull(),

  /** `po_...` identifier from Stripe. */
  stripePayoutId: varchar('stripe_payout_id', { length: 255 }).notNull(),
  amount: integer('amount').notNull(),
  currency: varchar('currency', { length: 3 }).default('USD').notNull(),
  status: varchar('status', { length: 30 }).notNull(),

  arrivalAt: timestamp('arrival_at', { withTimezone: true }),
  failureCode: varchar('failure_code', { length: 120 }),
  failureMessage: varchar('failure_message', { length: 2000 }),

  method: varchar('method', { length: 50 }),
  statementDescriptor: varchar('statement_descriptor', { length: 255 }),

  metadata: jsonb('metadata').default({}),

  createdAt: createdAt,
  updatedAt: updatedAt,
}, (table) => ({
    stripePayoutsBizIdIdUnique: uniqueIndex("stripe_payouts_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
  stripePayoutsStripeIdUnique: uniqueIndex('stripe_payouts_stripe_id_unique').on(table.stripePayoutId),
  stripePayoutsOrgStatusIdx: index('stripe_payouts_org_status_idx').on(table.bizId, table.status),
  stripePayoutsBizAccountIdx: index('stripe_payouts_biz_account_idx').on(
    table.bizId,
    table.stripeAccountRefId,
    table.status,
  ),
  stripePayoutsBizAccountFk: foreignKey({
    columns: [table.bizId, table.stripeAccountRefId],
    foreignColumns: [stripeAccounts.bizId, stripeAccounts.id],
    name: 'stripe_payouts_biz_account_fk',
  }),
  /** Currency should always use uppercase ISO-like code shape. */
  stripePayoutsCurrencyFormatCheck: check(
    'stripe_payouts_currency_format_check',
    sql`"currency" ~ '^[A-Z]{3}$'`,
  ),
}))

/**
 * stripe_transfers
 *
 * Transfer records for split payouts/commission flows in Connect setups.
 */
export const stripeTransfers = pgTable('stripe_transfers', {
  id: id,
  bizId: idRef('biz_id').references(() => bizes.id).notNull(),

  /** Optional commercial linkage for split settlement tracing. */
  bookingOrderId: idRef('booking_order_id').references(() => bookingOrders.id),
  crossBizOrderId: idRef('cross_biz_order_id').references(() => crossBizOrders.id),
  paymentIntentRefId: idRef('payment_intent_ref_id').references(() => paymentIntents.id),
  paymentTransactionRefId: idRef('payment_transaction_ref_id').references(() => paymentTransactions.id),

  /** Destination connected account receiving funds. */
  destinationAccountRefId: idRef('destination_account_ref_id')
    .references(() => stripeAccounts.id)
    .notNull(),

  /** `tr_...` identifier from Stripe. */
  stripeTransferId: varchar('stripe_transfer_id', { length: 255 }).notNull(),
  amount: integer('amount').notNull(),
  currency: varchar('currency', { length: 3 }).default('USD').notNull(),

  transferGroup: varchar('transfer_group', { length: 255 }),
  sourceTransactionId: varchar('source_transaction_id', { length: 255 }),
  status: varchar('status', { length: 30 }).default('pending').notNull(),

  metadata: jsonb('metadata').default({}),

  createdAt: createdAt,
  updatedAt: updatedAt,
  deletedAt: deletedAt,
}, (table) => ({
    stripeTransfersBizIdIdUnique: uniqueIndex("stripe_transfers_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
  stripeTransfersStripeIdUnique: uniqueIndex('stripe_transfers_stripe_id_unique').on(table.stripeTransferId),
  stripeTransfersOrgStatusIdx: index('stripe_transfers_org_status_idx').on(table.bizId, table.status),
  stripeTransfersBizDestinationAccountIdx: index(
    'stripe_transfers_biz_destination_account_idx',
  ).on(table.bizId, table.destinationAccountRefId, table.status),
  stripeTransfersBizDestinationAccountFk: foreignKey({
    columns: [table.bizId, table.destinationAccountRefId],
    foreignColumns: [stripeAccounts.bizId, stripeAccounts.id],
    name: 'stripe_transfers_biz_destination_account_fk',
  }),
  stripeTransfersBookingOrderIdx: index('stripe_transfers_booking_order_idx').on(table.bookingOrderId),
  stripeTransfersCrossBizOrderIdx: index('stripe_transfers_cross_biz_order_idx').on(table.crossBizOrderId),
  /** Currency should always use uppercase ISO-like code shape. */
  stripeTransfersCurrencyFormatCheck: check(
    'stripe_transfers_currency_format_check',
    sql`"currency" ~ '^[A-Z]{3}$'`,
  ),
}))

export type StripeAccount = typeof stripeAccounts.$inferSelect
export type NewStripeAccount = typeof stripeAccounts.$inferInsert

export type StripeCustomer = typeof stripeCustomers.$inferSelect
export type NewStripeCustomer = typeof stripeCustomers.$inferInsert

export type StripePaymentMethod = typeof stripePaymentMethods.$inferSelect
export type NewStripePaymentMethod = typeof stripePaymentMethods.$inferInsert

export type StripeSetupIntent = typeof stripeSetupIntents.$inferSelect
export type NewStripeSetupIntent = typeof stripeSetupIntents.$inferInsert

export type StripeCheckoutSession = typeof stripeCheckoutSessions.$inferSelect
export type NewStripeCheckoutSession = typeof stripeCheckoutSessions.$inferInsert

export type StripeInvoice = typeof stripeInvoices.$inferSelect
export type NewStripeInvoice = typeof stripeInvoices.$inferInsert

export type StripeWebhookEvent = typeof stripeWebhookEvents.$inferSelect
export type NewStripeWebhookEvent = typeof stripeWebhookEvents.$inferInsert

export type StripePayout = typeof stripePayouts.$inferSelect
export type NewStripePayout = typeof stripePayouts.$inferInsert

export type StripeTransfer = typeof stripeTransfers.$inferSelect
export type NewStripeTransfer = typeof stripeTransfers.$inferInsert
