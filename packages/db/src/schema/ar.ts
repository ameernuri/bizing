import { sql } from "drizzle-orm";
import { check, foreignKey, index, uniqueIndex } from "drizzle-orm/pg-core";
import { integer, jsonb, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { idRef, idWithTag, withAuditRefs } from "./_common";
import { bizes } from "./bizes";
import { groupAccounts } from "./group_accounts";
import { users } from "./users";
import {
  arInvoiceStatusEnum,
  billingAccountStatusEnum,
  billingAccountTypeEnum,
  invoiceEventTypeEnum,
  purchaseOrderStatusEnum,
} from "./enums";

/**
 * billing_accounts
 *
 * ELI5:
 * One billing account is a reusable AR counterparty profile for invoicing.
 * It can point to a user, a group account, or another business.
 */
export const billingAccounts = pgTable(
  "billing_accounts",
  {
    id: idWithTag("billing_account"),
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    name: varchar("name", { length: 220 }).notNull(),
    accountType: billingAccountTypeEnum("account_type").notNull(),
    status: billingAccountStatusEnum("status").default("active").notNull(),

    counterpartyBizId: idRef("counterparty_biz_id").references(() => bizes.id),
    counterpartyUserId: idRef("counterparty_user_id").references(() => users.id),
    counterpartyGroupAccountId: idRef("counterparty_group_account_id").references(
      () => groupAccounts.id,
    ),

    currency: varchar("currency", { length: 3 }).default("USD").notNull(),
    creditLimitMinor: integer("credit_limit_minor"),
    paymentTermsDays: integer("payment_terms_days").default(0).notNull(),
    taxProfile: jsonb("tax_profile").default({}),
    metadata: jsonb("metadata").default({}),
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    billingAccountsBizIdIdUnique: uniqueIndex("billing_accounts_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),

    billingAccountsBizStatusTypeIdx: index("billing_accounts_biz_status_type_idx").on(
      table.bizId,
      table.status,
      table.accountType,
    ),

    /** One and only one counterparty pointer must exist. */
    billingAccountsCounterpartyShapeCheck: check(
      "billing_accounts_counterparty_shape_check",
      sql`
      (
        ("counterparty_biz_id" IS NOT NULL)::int
        + ("counterparty_user_id" IS NOT NULL)::int
        + ("counterparty_group_account_id" IS NOT NULL)::int
      ) = 1
      `,
    ),

    billingAccountsTypeCounterpartyCheck: check(
      "billing_accounts_type_counterparty_check",
      sql`
      (
        "account_type" = 'biz'
        AND "counterparty_biz_id" IS NOT NULL
        AND "counterparty_user_id" IS NULL
        AND "counterparty_group_account_id" IS NULL
      ) OR (
        "account_type" = 'user'
        AND "counterparty_biz_id" IS NULL
        AND "counterparty_user_id" IS NOT NULL
        AND "counterparty_group_account_id" IS NULL
      ) OR (
        "account_type" = 'group_account'
        AND "counterparty_biz_id" IS NULL
        AND "counterparty_user_id" IS NULL
        AND "counterparty_group_account_id" IS NOT NULL
      )
      `,
    ),

    billingAccountsNumericBoundsCheck: check(
      "billing_accounts_numeric_bounds_check",
      sql`
      ("credit_limit_minor" IS NULL OR "credit_limit_minor" >= 0)
      AND "payment_terms_days" >= 0
      `,
    ),

    billingAccountsCurrencyFormatCheck: check(
      "billing_accounts_currency_format_check",
      sql`"currency" ~ '^[A-Z]{3}$'`,
    ),
  }),
);

/**
 * purchase_orders
 *
 * ELI5:
 * PO row is a pre-approved spending envelope from a billing account.
 */
export const purchaseOrders = pgTable(
  "purchase_orders",
  {
    id: idWithTag("po"),
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),
    billingAccountId: idRef("billing_account_id")
      .references(() => billingAccounts.id)
      .notNull(),
    poNumber: varchar("po_number", { length: 120 }).notNull(),
    status: purchaseOrderStatusEnum("status").default("draft").notNull(),
    currency: varchar("currency", { length: 3 }).default("USD").notNull(),
    authorizedAmountMinor: integer("authorized_amount_minor").default(0).notNull(),
    billedAmountMinor: integer("billed_amount_minor").default(0).notNull(),
    issuedAt: timestamp("issued_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    notes: text("notes"),
    metadata: jsonb("metadata").default({}),
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    purchaseOrdersBizIdIdUnique: uniqueIndex("purchase_orders_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),

    purchaseOrdersBizNumberUnique: uniqueIndex("purchase_orders_biz_number_unique").on(
      table.bizId,
      table.poNumber,
    ),

    purchaseOrdersBizStatusIssuedIdx: index("purchase_orders_biz_status_issued_idx").on(
      table.bizId,
      table.status,
      table.issuedAt,
    ),

    purchaseOrdersBizBillingAccountFk: foreignKey({
      columns: [table.bizId, table.billingAccountId],
      foreignColumns: [billingAccounts.bizId, billingAccounts.id],
      name: "purchase_orders_biz_billing_account_fk",
    }),

    purchaseOrdersBoundsCheck: check(
      "purchase_orders_bounds_check",
      sql`
      "authorized_amount_minor" >= 0
      AND "billed_amount_minor" >= 0
      AND "billed_amount_minor" <= "authorized_amount_minor"
      AND ("issued_at" IS NULL OR "expires_at" IS NULL OR "expires_at" > "issued_at")
      `,
    ),

    purchaseOrdersCurrencyFormatCheck: check(
      "purchase_orders_currency_format_check",
      sql`"currency" ~ '^[A-Z]{3}$'`,
    ),
  }),
);

/**
 * ar_invoices
 *
 * ELI5:
 * Receivable invoice row sent to a billing account with deterministic totals.
 */
export const arInvoices = pgTable(
  "ar_invoices",
  {
    id: idWithTag("ar_invoice"),
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),
    billingAccountId: idRef("billing_account_id")
      .references(() => billingAccounts.id)
      .notNull(),
    purchaseOrderId: idRef("purchase_order_id").references(() => purchaseOrders.id),

    invoiceNumber: varchar("invoice_number", { length: 120 }).notNull(),
    status: arInvoiceStatusEnum("status").default("draft").notNull(),
    currency: varchar("currency", { length: 3 }).default("USD").notNull(),

    subtotalMinor: integer("subtotal_minor").default(0).notNull(),
    taxMinor: integer("tax_minor").default(0).notNull(),
    feeMinor: integer("fee_minor").default(0).notNull(),
    discountMinor: integer("discount_minor").default(0).notNull(),
    totalMinor: integer("total_minor").default(0).notNull(),
    outstandingMinor: integer("outstanding_minor").default(0).notNull(),

    issuedAt: timestamp("issued_at", { withTimezone: true }),
    dueAt: timestamp("due_at", { withTimezone: true }),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    voidedAt: timestamp("voided_at", { withTimezone: true }),
    notes: text("notes"),
    metadata: jsonb("metadata").default({}),
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    arInvoicesBizIdIdUnique: uniqueIndex("ar_invoices_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),

    arInvoicesBizNumberUnique: uniqueIndex("ar_invoices_biz_number_unique").on(
      table.bizId,
      table.invoiceNumber,
    ),

    arInvoicesBizStatusDueIdx: index("ar_invoices_biz_status_due_idx").on(
      table.bizId,
      table.status,
      table.dueAt,
    ),

    arInvoicesBizBillingAccountFk: foreignKey({
      columns: [table.bizId, table.billingAccountId],
      foreignColumns: [billingAccounts.bizId, billingAccounts.id],
      name: "ar_invoices_biz_billing_account_fk",
    }),

    arInvoicesBizPurchaseOrderFk: foreignKey({
      columns: [table.bizId, table.purchaseOrderId],
      foreignColumns: [purchaseOrders.bizId, purchaseOrders.id],
      name: "ar_invoices_biz_purchase_order_fk",
    }),

    arInvoicesMoneyBoundsCheck: check(
      "ar_invoices_money_bounds_check",
      sql`
      "subtotal_minor" >= 0
      AND "tax_minor" >= 0
      AND "fee_minor" >= 0
      AND "discount_minor" >= 0
      AND "outstanding_minor" >= 0
      AND "total_minor" >= 0
      `,
    ),

    arInvoicesMoneyReconciliationCheck: check(
      "ar_invoices_money_reconciliation_check",
      sql`
      "total_minor" = ("subtotal_minor" + "tax_minor" + "fee_minor" - "discount_minor")
      AND "outstanding_minor" <= "total_minor"
      `,
    ),

    arInvoicesTimelineCheck: check(
      "ar_invoices_timeline_check",
      sql`
      ("issued_at" IS NULL OR "due_at" IS NULL OR "due_at" >= "issued_at")
      AND ("paid_at" IS NULL OR "issued_at" IS NULL OR "paid_at" >= "issued_at")
      AND ("voided_at" IS NULL OR "issued_at" IS NULL OR "voided_at" >= "issued_at")
      `,
    ),

    arInvoicesCurrencyFormatCheck: check(
      "ar_invoices_currency_format_check",
      sql`"currency" ~ '^[A-Z]{3}$'`,
    ),
  }),
);

/**
 * invoice_events
 *
 * ELI5:
 * Immutable timeline of invoice lifecycle facts.
 */
export const invoiceEvents = pgTable(
  "invoice_events",
  {
    id: idWithTag("invoice_event"),
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),
    arInvoiceId: idRef("ar_invoice_id")
      .references(() => arInvoices.id)
      .notNull(),
    eventType: invoiceEventTypeEnum("event_type").notNull(),
    amountMinor: integer("amount_minor"),
    happenedAt: timestamp("happened_at", { withTimezone: true }).defaultNow().notNull(),
    actorUserId: idRef("actor_user_id").references(() => users.id),
    note: varchar("note", { length: 1000 }),
    metadata: jsonb("metadata").default({}),
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    invoiceEventsBizIdIdUnique: uniqueIndex("invoice_events_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    invoiceEventsBizInvoiceHappenedIdx: index("invoice_events_biz_invoice_happened_idx").on(
      table.bizId,
      table.arInvoiceId,
      table.happenedAt,
    ),

    invoiceEventsBizInvoiceFk: foreignKey({
      columns: [table.bizId, table.arInvoiceId],
      foreignColumns: [arInvoices.bizId, arInvoices.id],
      name: "invoice_events_biz_invoice_fk",
    }),

    invoiceEventsAmountBoundsCheck: check(
      "invoice_events_amount_bounds_check",
      sql`"amount_minor" IS NULL OR "amount_minor" >= 0`,
    ),
  }),
);
