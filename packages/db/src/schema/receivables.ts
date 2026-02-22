import { sql } from "drizzle-orm";
import { check, foreignKey, index, uniqueIndex } from "drizzle-orm/pg-core";
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { idRef, idWithTag, withAuditRefs } from "./_common";
import { arInvoices, billingAccounts } from "./ar";
import { bizes } from "./bizes";
import { bizConfigValues } from "./biz_configs";
import { lifecycleStatusEnum } from "./enums";
import { paymentIntents, paymentMethods, paymentTransactions } from "./payments";
import { users } from "./users";

/**
 * installment_plans
 *
 * ELI5:
 * One row defines how one invoice gets split into multiple due items.
 *
 * Why this is first-class:
 * - high-ticket services often need payment over time,
 * - AR invoices store totals, but not schedule semantics,
 * - this table makes installment plans auditable and deterministic.
 */
export const installmentPlans = pgTable(
  "installment_plans",
  {
    /** Stable primary key for one installment plan version. */
    id: idWithTag("installment_plan"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Target receivable invoice this plan collects. */
    arInvoiceId: idRef("ar_invoice_id")
      .references(() => arInvoices.id)
      .notNull(),

    /** Monotonic plan revision number per invoice. */
    version: integer("version").default(1).notNull(),

    /** Current-plan marker for easy invoice screen reads. */
    isCurrent: boolean("is_current").default(true).notNull(),

    /**
     * Plan lifecycle state.
     * `custom_*` allows plugin-defined debt-collection workflows.
     */
    status: varchar("status", { length: 40 }).default("draft").notNull(),
    /**
     * Optional configurable lifecycle pointer.
     *
     * Keeps the internal status code deterministic while allowing each biz to
     * map that code to their preferred labels and workflow naming.
     */
    statusConfigValueId: idRef("status_config_value_id"),

    /**
     * Schedule model.
     * - fixed_count: equal-ish installments by count
     * - custom_schedule: explicit arbitrary schedule item amounts/dates
     * - deferred_balloon: small periodic items + one larger final item
     */
    planKind: varchar("plan_kind", { length: 40 })
      .default("custom_schedule")
      .notNull(),

    /** Collection currency in minor-unit columns. */
    currency: varchar("currency", { length: 3 }).default("USD").notNull(),

    /** Planned total of all schedule items in this plan. */
    totalPlannedMinor: integer("total_planned_minor").default(0).notNull(),

    /** Sum paid from linked schedule items/transactions. */
    totalPaidMinor: integer("total_paid_minor").default(0).notNull(),

    /** Sum waived by manual policy actions. */
    totalWaivedMinor: integer("total_waived_minor").default(0).notNull(),

    /** Sum failed/charged-off for reporting and risk. */
    totalFailedMinor: integer("total_failed_minor").default(0).notNull(),

    /** Number of schedule items expected for this plan. */
    installmentCount: integer("installment_count").default(1).notNull(),

    /** Optional plan start anchor. */
    startsAt: timestamp("starts_at", { withTimezone: true }),

    /** Optional plan end anchor. */
    endsAt: timestamp("ends_at", { withTimezone: true }),

    /** Next expected due item instant, maintained by workers/API. */
    nextDueAt: timestamp("next_due_at", { withTimezone: true }),

    /** If true, system can automatically mark completed/advanced states. */
    autoAdvance: boolean("auto_advance").default(true).notNull(),

    /** Immutable policy snapshot used by collection workers. */
    policySnapshot: jsonb("policy_snapshot").default({}).notNull(),

    /** Extensible payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    installmentPlansBizIdIdUnique: uniqueIndex("installment_plans_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Composite key for tenant-safe schedule/attempt references. */

    /** One version row per invoice/version tuple. */
    installmentPlansInvoiceVersionUnique: uniqueIndex(
      "installment_plans_invoice_version_unique",
    ).on(table.arInvoiceId, table.version),

    /** At most one current plan per invoice. */
    installmentPlansInvoiceCurrentUnique: uniqueIndex(
      "installment_plans_invoice_current_unique",
    )
      .on(table.arInvoiceId)
      .where(sql`"is_current" = true AND "deleted_at" IS NULL`),

    /** Collection operations path by status and next due item. */
    installmentPlansBizStatusNextDueIdx: index(
      "installment_plans_biz_status_next_due_idx",
    ).on(table.bizId, table.status, table.nextDueAt),
    /** Configurable lifecycle lookup path for collection dashboards. */
    installmentPlansBizStatusConfigNextDueIdx: index(
      "installment_plans_biz_status_config_next_due_idx",
    ).on(table.bizId, table.statusConfigValueId, table.nextDueAt),

    /** Tenant-safe FK to AR invoice. */
    installmentPlansBizInvoiceFk: foreignKey({
      columns: [table.bizId, table.arInvoiceId],
      foreignColumns: [arInvoices.bizId, arInvoices.id],
      name: "installment_plans_biz_invoice_fk",
    }),
    /** Tenant-safe FK to optional configured lifecycle dictionary value. */
    installmentPlansBizStatusConfigFk: foreignKey({
      columns: [table.bizId, table.statusConfigValueId],
      foreignColumns: [bizConfigValues.bizId, bizConfigValues.id],
      name: "installment_plans_biz_status_config_fk",
    }),

    /** Plan lifecycle vocabulary remains extensible. */
    installmentPlansStatusCheck: check(
      "installment_plans_status_check",
      sql`
      "status" IN ('draft', 'active', 'paused', 'completed', 'defaulted', 'cancelled')
      OR "status" LIKE 'custom_%'
      `,
    ),

    /** Plan kind vocabulary remains extensible. */
    installmentPlansKindCheck: check(
      "installment_plans_kind_check",
      sql`
      "plan_kind" IN ('fixed_count', 'custom_schedule', 'deferred_balloon')
      OR "plan_kind" LIKE 'custom_%'
      `,
    ),

    /** Numeric and timeline invariants for reconciliation safety. */
    installmentPlansBoundsCheck: check(
      "installment_plans_bounds_check",
      sql`
      "version" >= 1
      AND "installment_count" >= 1
      AND "total_planned_minor" >= 0
      AND "total_paid_minor" >= 0
      AND "total_waived_minor" >= 0
      AND "total_failed_minor" >= 0
      AND ("ends_at" IS NULL OR "starts_at" IS NULL OR "ends_at" > "starts_at")
      `,
    ),

    /** Currency should remain uppercase ISO-like. */
    installmentPlansCurrencyFormatCheck: check(
      "installment_plans_currency_format_check",
      sql`"currency" ~ '^[A-Z]{3}$'`,
    ),
  }),
);

/**
 * installment_schedule_items
 *
 * ELI5:
 * One row is one due item inside an installment plan.
 *
 * This is the atomic "pay this much by this date" unit for reminders,
 * auto-collection, and delinquency analytics.
 */
export const installmentScheduleItems = pgTable(
  "installment_schedule_items",
  {
    /** Stable primary key for one schedule item. */
    id: idWithTag("installment_item"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent installment plan. */
    installmentPlanId: idRef("installment_plan_id")
      .references(() => installmentPlans.id)
      .notNull(),

    /** Monotonic sequence number inside one plan. */
    sequenceNo: integer("sequence_no").notNull(),

    /** Due timestamp for this installment item. */
    dueAt: timestamp("due_at", { withTimezone: true }).notNull(),

    /**
     * Item lifecycle state.
     * `custom_*` allows plugin-specific collection statuses.
     */
    status: varchar("status", { length: 40 }).default("pending").notNull(),
    /**
     * Optional configurable lifecycle pointer for installment item status.
     *
     * This lets each biz rename lifecycle steps without changing payment math.
     */
    statusConfigValueId: idRef("status_config_value_id"),

    /** Planned amount for this schedule item. */
    amountMinor: integer("amount_minor").notNull(),

    /** Amount paid toward this item. */
    paidMinor: integer("paid_minor").default(0).notNull(),

    /** Amount waived for this item. */
    waivedMinor: integer("waived_minor").default(0).notNull(),

    /** Amount written off/failed for this item. */
    failedMinor: integer("failed_minor").default(0).notNull(),

    /** Late fee amount attributable to this item. */
    lateFeeMinor: integer("late_fee_minor").default(0).notNull(),

    /** Currency for this item's money columns. */
    currency: varchar("currency", { length: 3 }).default("USD").notNull(),

    /** Number of collection attempts performed for this item. */
    attemptCount: integer("attempt_count").default(0).notNull(),

    /** Last attempt timestamp for this item. */
    lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }),

    /** Paid timestamp when item is fully settled. */
    paidAt: timestamp("paid_at", { withTimezone: true }),

    /** Optional payment intent that settled this installment item. */
    paymentIntentId: idRef("payment_intent_id").references(() => paymentIntents.id),

    /** Optional payment transaction proving settlement. */
    paymentTransactionId: idRef("payment_transaction_id").references(
      () => paymentTransactions.id,
    ),

    /** Optional operator note for this item. */
    notes: text("notes"),

    /** Extensible payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite key for tenant-safe references from attempt logs. */
    installmentScheduleItemsBizIdIdUnique: uniqueIndex(
      "installment_schedule_items_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** One sequence slot per plan. */
    installmentScheduleItemsPlanSequenceUnique: uniqueIndex(
      "installment_schedule_items_plan_sequence_unique",
    ).on(table.installmentPlanId, table.sequenceNo),

    /** Collection execution path per plan and due date. */
    installmentScheduleItemsBizPlanDueIdx: index(
      "installment_schedule_items_biz_plan_due_idx",
    ).on(table.bizId, table.installmentPlanId, table.dueAt),

    /** Dunning queue path. */
    installmentScheduleItemsBizStatusDueIdx: index(
      "installment_schedule_items_biz_status_due_idx",
    ).on(table.bizId, table.status, table.dueAt),
    /** Configurable lifecycle lookup path for dunning queues. */
    installmentScheduleItemsBizStatusConfigDueIdx: index(
      "installment_schedule_items_biz_status_config_due_idx",
    ).on(table.bizId, table.statusConfigValueId, table.dueAt),

    /** Tenant-safe FK to parent plan. */
    installmentScheduleItemsBizPlanFk: foreignKey({
      columns: [table.bizId, table.installmentPlanId],
      foreignColumns: [installmentPlans.bizId, installmentPlans.id],
      name: "installment_schedule_items_biz_plan_fk",
    }),

    /** Tenant-safe FK to optional payment intent. */
    installmentScheduleItemsBizIntentFk: foreignKey({
      columns: [table.bizId, table.paymentIntentId],
      foreignColumns: [paymentIntents.bizId, paymentIntents.id],
      name: "installment_schedule_items_biz_intent_fk",
    }),

    /** Tenant-safe FK to optional payment transaction. */
    installmentScheduleItemsBizTransactionFk: foreignKey({
      columns: [table.bizId, table.paymentTransactionId],
      foreignColumns: [paymentTransactions.bizId, paymentTransactions.id],
      name: "installment_schedule_items_biz_transaction_fk",
    }),
    /** Tenant-safe FK to optional configured lifecycle dictionary value. */
    installmentScheduleItemsBizStatusConfigFk: foreignKey({
      columns: [table.bizId, table.statusConfigValueId],
      foreignColumns: [bizConfigValues.bizId, bizConfigValues.id],
      name: "installment_schedule_items_biz_status_config_fk",
    }),

    /** Status vocabulary remains extensible. */
    installmentScheduleItemsStatusCheck: check(
      "installment_schedule_items_status_check",
      sql`
      "status" IN ('pending', 'processing', 'paid', 'failed', 'waived', 'cancelled')
      OR "status" LIKE 'custom_%'
      `,
    ),

    /** Money/attempt invariants for deterministic receivables math. */
    installmentScheduleItemsMoneyCheck: check(
      "installment_schedule_items_money_check",
      sql`
      "sequence_no" >= 1
      AND "amount_minor" > 0
      AND "paid_minor" >= 0
      AND "waived_minor" >= 0
      AND "failed_minor" >= 0
      AND "late_fee_minor" >= 0
      AND "attempt_count" >= 0
      AND ("last_attempt_at" IS NULL OR "last_attempt_at" >= "due_at" - INTERVAL '3650 days')
      AND ("paid_at" IS NULL OR "paid_at" >= "due_at" - INTERVAL '3650 days')
      AND ("paid_minor" + "waived_minor" + "failed_minor") <= ("amount_minor" + "late_fee_minor")
      `,
    ),

    /** Paid status should carry settlement pointers. */
    installmentScheduleItemsPaidShapeCheck: check(
      "installment_schedule_items_paid_shape_check",
      sql`
      "status" <> 'paid'
      OR (
        "paid_at" IS NOT NULL
        AND "payment_transaction_id" IS NOT NULL
      )
      `,
    ),

    /** Currency shape should remain uppercase ISO-like. */
    installmentScheduleItemsCurrencyFormatCheck: check(
      "installment_schedule_items_currency_format_check",
      sql`"currency" ~ '^[A-Z]{3}$'`,
    ),
  }),
);

/**
 * billing_account_autopay_rules
 *
 * ELI5:
 * Rules that tell the system *how* and *when* to auto-collect AR balances for
 * one billing account.
 *
 * Why separate from invoice rows:
 * - one account can have reusable collection policy across many invoices,
 * - policy can evolve without mutating historical invoice records.
 */
export const billingAccountAutopayRules = pgTable(
  "billing_account_autopay_rules",
  {
    /** Stable primary key for one rule row. */
    id: idWithTag("autopay_rule"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Billing account this rule applies to. */
    billingAccountId: idRef("billing_account_id")
      .references(() => billingAccounts.id)
      .notNull(),

    /** Rule lifecycle. */
    status: lifecycleStatusEnum("status").default("active").notNull(),

    /** Human-readable rule label. */
    name: varchar("name", { length: 220 }).notNull(),

    /** Priority for rule resolution when multiple rules are active. */
    priority: integer("priority").default(100).notNull(),

    /** Default rule marker for this billing account. */
    isDefault: boolean("is_default").default(false).notNull(),

    /** Optional preferred payment method to charge. */
    paymentMethodId: idRef("payment_method_id").references(() => paymentMethods.id),

    /**
     * Target scope of this rule.
     * - invoice: collect invoice balances
     * - installment: collect installment items
     * - both: whichever due units are eligible
     */
    targetScope: varchar("target_scope", { length: 40 }).default("both").notNull(),

    /**
     * Day offset relative to due date.
     * Examples:
     * - 0 = on due date
     * - -2 = two days before due date
     * - 3 = three days after due date
     */
    runOffsetDays: integer("run_offset_days").default(0).notNull(),

    /** Maximum attempts before giving up for one due unit. */
    maxAttemptsPerItem: integer("max_attempts_per_item").default(3).notNull(),

    /** Delay between retries for failed attempts. */
    retryIntervalHours: integer("retry_interval_hours").default(24).notNull(),

    /** Minimum eligible due amount for this rule to trigger. */
    minimumAmountMinor: integer("minimum_amount_minor").default(0).notNull(),

    /** Optional maximum amount threshold for this rule. */
    maximumAmountMinor: integer("maximum_amount_minor"),

    /** If true, rule may collect partial amount when full collection fails. */
    allowPartialCollection: boolean("allow_partial_collection")
      .default(false)
      .notNull(),

    /** Optional immutable collection-policy snapshot. */
    collectionPolicy: jsonb("collection_policy").default({}).notNull(),

    /** Extensible payload for channel/provider-specific options. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite key for tenant-safe attempt references. */
    billingAccountAutopayRulesBizIdIdUnique: uniqueIndex(
      "billing_account_autopay_rules_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** Prevent duplicate active rule names per billing account. */
    billingAccountAutopayRulesNameUnique: uniqueIndex(
      "billing_account_autopay_rules_name_unique",
    )
      .on(table.bizId, table.billingAccountId, table.name)
      .where(sql`"deleted_at" IS NULL`),

    /** At most one active default rule per billing account. */
    billingAccountAutopayRulesDefaultUnique: uniqueIndex(
      "billing_account_autopay_rules_default_unique",
    )
      .on(table.bizId, table.billingAccountId)
      .where(sql`"is_default" = true AND "status" = 'active' AND "deleted_at" IS NULL`),

    /** Rule resolution path for collection workers. */
    billingAccountAutopayRulesResolveIdx: index(
      "billing_account_autopay_rules_resolve_idx",
    ).on(table.bizId, table.billingAccountId, table.status, table.priority),

    /** Tenant-safe FK to billing account. */
    billingAccountAutopayRulesBizBillingAccountFk: foreignKey({
      columns: [table.bizId, table.billingAccountId],
      foreignColumns: [billingAccounts.bizId, billingAccounts.id],
      name: "billing_account_autopay_rules_biz_billing_account_fk",
    }),

    /** Tenant-safe FK to optional payment method. */
    billingAccountAutopayRulesBizMethodFk: foreignKey({
      columns: [table.bizId, table.paymentMethodId],
      foreignColumns: [paymentMethods.bizId, paymentMethods.id],
      name: "billing_account_autopay_rules_biz_method_fk",
    }),

    /** Scope vocabulary stays extensible. */
    billingAccountAutopayRulesTargetScopeCheck: check(
      "billing_account_autopay_rules_target_scope_check",
      sql`
      "target_scope" IN ('invoice', 'installment', 'both')
      OR "target_scope" LIKE 'custom_%'
      `,
    ),

    /** Retry and amount bounds. */
    billingAccountAutopayRulesBoundsCheck: check(
      "billing_account_autopay_rules_bounds_check",
      sql`
      "priority" >= 0
      AND "run_offset_days" BETWEEN -90 AND 90
      AND "max_attempts_per_item" >= 1
      AND "retry_interval_hours" >= 1
      AND "minimum_amount_minor" >= 0
      AND ("maximum_amount_minor" IS NULL OR "maximum_amount_minor" >= "minimum_amount_minor")
      `,
    ),
  }),
);

/**
 * autocollection_attempts
 *
 * ELI5:
 * Immutable-ish attempt ledger for every auto-collection execution.
 *
 * This is the forensic trail for:
 * - what we tried to charge,
 * - when we tried,
 * - what succeeded or failed,
 * - which payment records were created.
 */
export const autocollectionAttempts = pgTable(
  "autocollection_attempts",
  {
    /** Stable primary key for one attempt. */
    id: idWithTag("autocollect_attempt"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Rule used for this execution attempt. */
    billingAccountAutopayRuleId: idRef("billing_account_autopay_rule_id")
      .references(() => billingAccountAutopayRules.id)
      .notNull(),

    /** Billing account context for this attempt. */
    billingAccountId: idRef("billing_account_id")
      .references(() => billingAccounts.id)
      .notNull(),

    /** Optional invoice target when this attempt is invoice-scoped. */
    arInvoiceId: idRef("ar_invoice_id").references(() => arInvoices.id),

    /** Optional installment-item target when this attempt is installment-scoped. */
    installmentScheduleItemId: idRef("installment_schedule_item_id").references(
      () => installmentScheduleItems.id,
    ),

    /**
     * Attempt lifecycle state.
     * `custom_*` allows provider/plugin-specific transitions.
     */
    status: varchar("status", { length: 40 }).default("queued").notNull(),
    /**
     * Optional configurable lifecycle pointer for attempt workflow stages.
     *
     * Important:
     * - `status` stays the deterministic worker state machine code.
     * - this configurable pointer is for biz-facing naming and grouping.
     */
    statusConfigValueId: idRef("status_config_value_id"),

    /** Retry counter position for one due target. */
    attemptNumber: integer("attempt_number").default(1).notNull(),

    /** Planned execution time. */
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }).notNull(),

    /** Worker start timestamp. */
    startedAt: timestamp("started_at", { withTimezone: true }),

    /** Worker end timestamp. */
    finishedAt: timestamp("finished_at", { withTimezone: true }),

    /** Optional payment intent created/used by this attempt. */
    paymentIntentId: idRef("payment_intent_id").references(() => paymentIntents.id),

    /** Optional payment transaction proving charge/refund movement. */
    paymentTransactionId: idRef("payment_transaction_id").references(
      () => paymentTransactions.id,
    ),

    /** Attempted amount in minor units. */
    attemptedAmountMinor: integer("attempted_amount_minor").default(0).notNull(),

    /** Currency for attempted amount. */
    currency: varchar("currency", { length: 3 }).default("USD").notNull(),

    /** Optional compact error code for deterministic retry routing. */
    failureCode: varchar("failure_code", { length: 120 }),

    /** Optional expanded failure message for support diagnostics. */
    failureMessage: text("failure_message"),

    /** Optional idempotency key for deduping retries/replays. */
    idempotencyKey: varchar("idempotency_key", { length: 160 }),

    /** Extensible attempt payload (provider response snapshots, etc.). */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite key for external references. */
    autocollectionAttemptsBizIdIdUnique: uniqueIndex(
      "autocollection_attempts_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** Replay/idempotency protection path. */
    autocollectionAttemptsIdempotencyUnique: uniqueIndex(
      "autocollection_attempts_idempotency_unique",
    )
      .on(table.bizId, table.idempotencyKey)
      .where(sql`"idempotency_key" IS NOT NULL`),

    /** Collection queue execution path. */
    autocollectionAttemptsBizStatusScheduleIdx: index(
      "autocollection_attempts_biz_status_schedule_idx",
    ).on(table.bizId, table.status, table.scheduledFor),
    /** Configurable lifecycle lookup path for operator queue views. */
    autocollectionAttemptsBizStatusConfigScheduleIdx: index(
      "autocollection_attempts_biz_status_config_schedule_idx",
    ).on(table.bizId, table.statusConfigValueId, table.scheduledFor),

    /** Account-level reconciliation path. */
    autocollectionAttemptsBizAccountScheduleIdx: index(
      "autocollection_attempts_biz_account_schedule_idx",
    ).on(table.bizId, table.billingAccountId, table.scheduledFor),

    /** Invoice-level troubleshooting path. */
    autocollectionAttemptsBizInvoiceScheduleIdx: index(
      "autocollection_attempts_biz_invoice_schedule_idx",
    ).on(table.bizId, table.arInvoiceId, table.scheduledFor),

    /** Tenant-safe FK to source autopay rule. */
    autocollectionAttemptsBizRuleFk: foreignKey({
      columns: [table.bizId, table.billingAccountAutopayRuleId],
      foreignColumns: [billingAccountAutopayRules.bizId, billingAccountAutopayRules.id],
      name: "autocollection_attempts_biz_rule_fk",
    }),

    /** Tenant-safe FK to billing account. */
    autocollectionAttemptsBizBillingAccountFk: foreignKey({
      columns: [table.bizId, table.billingAccountId],
      foreignColumns: [billingAccounts.bizId, billingAccounts.id],
      name: "autocollection_attempts_biz_billing_account_fk",
    }),

    /** Tenant-safe FK to optional invoice target. */
    autocollectionAttemptsBizInvoiceFk: foreignKey({
      columns: [table.bizId, table.arInvoiceId],
      foreignColumns: [arInvoices.bizId, arInvoices.id],
      name: "autocollection_attempts_biz_invoice_fk",
    }),

    /** Tenant-safe FK to optional installment target. */
    autocollectionAttemptsBizInstallmentItemFk: foreignKey({
      columns: [table.bizId, table.installmentScheduleItemId],
      foreignColumns: [installmentScheduleItems.bizId, installmentScheduleItems.id],
      name: "autocollection_attempts_biz_installment_item_fk",
    }),

    /** Tenant-safe FK to optional payment intent. */
    autocollectionAttemptsBizIntentFk: foreignKey({
      columns: [table.bizId, table.paymentIntentId],
      foreignColumns: [paymentIntents.bizId, paymentIntents.id],
      name: "autocollection_attempts_biz_intent_fk",
    }),

    /** Tenant-safe FK to optional payment transaction. */
    autocollectionAttemptsBizTransactionFk: foreignKey({
      columns: [table.bizId, table.paymentTransactionId],
      foreignColumns: [paymentTransactions.bizId, paymentTransactions.id],
      name: "autocollection_attempts_biz_transaction_fk",
    }),
    /** Tenant-safe FK to optional configured lifecycle dictionary value. */
    autocollectionAttemptsBizStatusConfigFk: foreignKey({
      columns: [table.bizId, table.statusConfigValueId],
      foreignColumns: [bizConfigValues.bizId, bizConfigValues.id],
      name: "autocollection_attempts_biz_status_config_fk",
    }),

    /** Attempt status vocabulary remains extensible. */
    autocollectionAttemptsStatusCheck: check(
      "autocollection_attempts_status_check",
      sql`
      "status" IN ('queued', 'running', 'succeeded', 'failed', 'skipped', 'cancelled')
      OR "status" LIKE 'custom_%'
      `,
    ),

    /** One and only one due-target scope should be set. */
    autocollectionAttemptsTargetShapeCheck: check(
      "autocollection_attempts_target_shape_check",
      sql`
      (
        ("ar_invoice_id" IS NOT NULL)::int
        + ("installment_schedule_item_id" IS NOT NULL)::int
      ) = 1
      `,
    ),

    /** Attempt timeline and money invariants. */
    autocollectionAttemptsBoundsCheck: check(
      "autocollection_attempts_bounds_check",
      sql`
      "attempt_number" >= 1
      AND "attempted_amount_minor" >= 0
      AND ("started_at" IS NULL OR "started_at" >= "scheduled_for")
      AND ("finished_at" IS NULL OR "started_at" IS NULL OR "finished_at" >= "started_at")
      `,
    ),

    /** Successful attempts should point to resulting payment movement. */
    autocollectionAttemptsSuccessShapeCheck: check(
      "autocollection_attempts_success_shape_check",
      sql`
      "status" <> 'succeeded'
      OR (
        "finished_at" IS NOT NULL
        AND "payment_transaction_id" IS NOT NULL
      )
      `,
    ),

    /** Currency shape should stay uppercase ISO-like. */
    autocollectionAttemptsCurrencyFormatCheck: check(
      "autocollection_attempts_currency_format_check",
      sql`"currency" ~ '^[A-Z]{3}$'`,
    ),
  }),
);

export type InstallmentPlan = typeof installmentPlans.$inferSelect;
export type NewInstallmentPlan = typeof installmentPlans.$inferInsert;

export type InstallmentScheduleItem = typeof installmentScheduleItems.$inferSelect;
export type NewInstallmentScheduleItem = typeof installmentScheduleItems.$inferInsert;

export type BillingAccountAutopayRule = typeof billingAccountAutopayRules.$inferSelect;
export type NewBillingAccountAutopayRule = typeof billingAccountAutopayRules.$inferInsert;

export type AutocollectionAttempt = typeof autocollectionAttempts.$inferSelect;
export type NewAutocollectionAttempt = typeof autocollectionAttempts.$inferInsert;
