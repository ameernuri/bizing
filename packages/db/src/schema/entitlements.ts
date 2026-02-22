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
import { bizes } from "./bizes";
import { groupAccounts } from "./group_accounts";
import { users } from "./users";
import { bookingOrders, fulfillmentUnits } from "./fulfillment";
import {
  entitlementGrantTypeEnum,
  entitlementLedgerEntryTypeEnum,
  entitlementTransferStatusEnum,
  membershipBillingIntervalUnitEnum,
  membershipPlanStatusEnum,
  membershipStatusEnum,
  rolloverRunStatusEnum,
} from "./enums";

/**
 * membership_plans
 *
 * ELI5:
 * A membership plan is a reusable template (price, billing cadence, and what
 * entitlement value members receive).
 */
export const membershipPlans = pgTable(
  "membership_plans",
  {
    /** Stable primary key. */
    id: idWithTag("membership_plan"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Human plan name. */
    name: varchar("name", { length: 200 }).notNull(),

    /** Stable slug for routing/import APIs. */
    slug: varchar("slug", { length: 140 }).notNull(),

    /** Optional plan description. */
    description: text("description"),

    /** Plan lifecycle state. */
    status: membershipPlanStatusEnum("status").default("draft").notNull(),

    /** Recurring billing interval amount (e.g., every 1 month, every 2 weeks). */
    billingIntervalCount: integer("billing_interval_count").default(1).notNull(),

    /** Recurring billing interval unit. */
    billingIntervalUnit: membershipBillingIntervalUnitEnum("billing_interval_unit")
      .default("month")
      .notNull(),

    /** Price charged per interval in minor units. */
    priceMinor: integer("price_minor").default(0).notNull(),

    /** Settlement/display currency. */
    currency: varchar("currency", { length: 3 }).default("USD").notNull(),

    /** What kind of entitlement this plan grants each cycle. */
    entitlementType: entitlementGrantTypeEnum("entitlement_type").notNull(),

    /** Quantity granted each cycle (credits, sessions, minutes, etc.). */
    entitlementQuantityPerCycle: integer("entitlement_quantity_per_cycle")
      .default(0)
      .notNull(),

    /** Whether unused value can roll into next billing cycle. */
    allowRollover: boolean("allow_rollover").default(false).notNull(),

    /** Optional rollover cap to avoid infinite accrual. */
    rolloverCapQuantity: integer("rollover_cap_quantity"),

    /** Whether members may transfer value to another wallet/account. */
    allowTransfers: boolean("allow_transfers").default(false).notNull(),

    /** Optional transfer fee in minor units. */
    transferFeeMinor: integer("transfer_fee_minor").default(0).notNull(),

    /** Structured entitlement grant rules and constraints. */
    entitlementPolicy: jsonb("entitlement_policy").default({}),

    /** Structured cancellation/pause/resume policy. */
    membershipPolicy: jsonb("membership_policy").default({}),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    membershipPlansBizIdIdUnique: uniqueIndex("membership_plans_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Composite unique target for tenant-safe membership FKs. */

    /** Unique slug per tenant. */
    membershipPlansBizSlugUnique: uniqueIndex("membership_plans_biz_slug_unique").on(
      table.bizId,
      table.slug,
    ),

    /** Common plan listing path. */
    membershipPlansBizStatusIdx: index("membership_plans_biz_status_idx").on(
      table.bizId,
      table.status,
    ),

    /** Price and quantity constraints. */
    membershipPlansValueCheck: check(
      "membership_plans_value_check",
      sql`
      "billing_interval_count" > 0
      AND "price_minor" >= 0
      AND "entitlement_quantity_per_cycle" >= 0
      AND "transfer_fee_minor" >= 0
      AND ("rollover_cap_quantity" IS NULL OR "rollover_cap_quantity" >= 0)
      `,
    ),

    /** Currency should always use uppercase ISO-like code shape. */
    membershipPlansCurrencyFormatCheck: check(
      "membership_plans_currency_format_check",
      sql`"currency" ~ '^[A-Z]{3}$'`,
    ),
  }),
);

/**
 * memberships
 *
 * ELI5:
 * One membership row = one customer's active/paused/cancelled subscription to
 * a membership plan.
 */
export const memberships = pgTable(
  "memberships",
  {
    /** Stable primary key. */
    id: idWithTag("membership"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Plan this membership subscribes to. */
    membershipPlanId: idRef("membership_plan_id")
      .references(() => membershipPlans.id)
      .notNull(),

    /** Optional individual owner. */
    ownerUserId: idRef("owner_user_id").references(() => users.id),

    /** Optional group owner. */
    ownerGroupAccountId: idRef("owner_group_account_id").references(
      () => groupAccounts.id,
    ),

    /** Membership lifecycle status. */
    status: membershipStatusEnum("status").default("trialing").notNull(),

    /** Membership start date/time. */
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),

    /** Current billing period start. */
    currentPeriodStartAt: timestamp("current_period_start_at", {
      withTimezone: true,
    }).notNull(),

    /** Current billing period end. */
    currentPeriodEndAt: timestamp("current_period_end_at", {
      withTimezone: true,
    }).notNull(),

    /** Optional pause time marker. */
    pausedAt: timestamp("paused_at", { withTimezone: true }),

    /** Optional cancellation request/completion time. */
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),

    /** Optional natural end/expiry timestamp. */
    endedAt: timestamp("ended_at", { withTimezone: true }),

    /** Whether system should auto-renew into next period. */
    autoRenew: boolean("auto_renew").default(true).notNull(),

    /** External subscription reference (Stripe/etc.). */
    providerSubscriptionRef: varchar("provider_subscription_ref", { length: 200 }),

    /** Optional pause/cancel reason. */
    statusReason: varchar("status_reason", { length: 400 }),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    membershipsBizIdIdUnique: uniqueIndex("memberships_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Composite unique target used by wallet/grant rows. */

    /** One active membership per user per plan can be enforced at DB level. */
    membershipsActivePerUserPlanUnique: uniqueIndex(
      "memberships_active_per_user_plan_unique",
    )
      .on(table.bizId, table.membershipPlanId, table.ownerUserId)
      .where(sql`"owner_user_id" IS NOT NULL AND "status" IN ('trialing', 'active', 'paused', 'past_due') AND "deleted_at" IS NULL`),

    /** Membership ops listing path. */
    membershipsBizStatusPeriodIdx: index("memberships_biz_status_period_idx").on(
      table.bizId,
      table.status,
      table.currentPeriodEndAt,
    ),

    /** Tenant-safe FK to plan. */
    membershipsBizPlanFk: foreignKey({
      columns: [table.bizId, table.membershipPlanId],
      foreignColumns: [membershipPlans.bizId, membershipPlans.id],
      name: "memberships_biz_plan_fk",
    }),

    /** Exactly one owner pointer is required. */
    membershipsOwnerShapeCheck: check(
      "memberships_owner_shape_check",
      sql`
      (
        ("owner_user_id" IS NOT NULL)::int
        + ("owner_group_account_id" IS NOT NULL)::int
      ) = 1
      `,
    ),

    /** Period ordering invariants. */
    membershipsPeriodCheck: check(
      "memberships_period_check",
      sql`
      "current_period_end_at" > "current_period_start_at"
      AND "current_period_start_at" >= "starts_at"
      AND ("ended_at" IS NULL OR "ended_at" >= "starts_at")
      `,
    ),
  }),
);

/**
 * entitlement_wallets
 *
 * ELI5:
 * Wallet is where entitlement value lives for one owner.
 *
 * Examples:
 * - 10 session credits wallet,
 * - 600 minutes monthly allowance wallet.
 */
export const entitlementWallets = pgTable(
  "entitlement_wallets",
  {
    /** Stable primary key. */
    id: idWithTag("entitlement_wallet"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Optional direct membership link for recurring wallets. */
    membershipId: idRef("membership_id").references(() => memberships.id),

    /** Optional individual owner. */
    ownerUserId: idRef("owner_user_id").references(() => users.id),

    /** Optional group owner. */
    ownerGroupAccountId: idRef("owner_group_account_id").references(
      () => groupAccounts.id,
    ),

    /** Wallet display name. */
    name: varchar("name", { length: 180 }).notNull(),

    /** Value type tracked by this wallet. */
    entitlementType: entitlementGrantTypeEnum("entitlement_type").notNull(),

    /** Unit code for quantity semantics (credits/minutes/sessions/seats). */
    unitCode: varchar("unit_code", { length: 60 }).default("credits").notNull(),

    /** Current available balance. */
    balanceQuantity: integer("balance_quantity").default(0).notNull(),

    /** Optional wallet expiration timestamp. */
    expiresAt: timestamp("expires_at", { withTimezone: true }),

    /** Whether wallet can currently be consumed. */
    isActive: boolean("is_active").default(true).notNull(),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite unique target for grant/ledger/transfer FKs. */
    entitlementWalletsBizIdIdUnique: uniqueIndex(
      "entitlement_wallets_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** Common wallet query path for one owner. */
    entitlementWalletsBizOwnerIdx: index("entitlement_wallets_biz_owner_idx").on(
      table.bizId,
      table.ownerUserId,
      table.ownerGroupAccountId,
      table.isActive,
    ),

    /** Tenant-safe FK to membership. */
    entitlementWalletsBizMembershipFk: foreignKey({
      columns: [table.bizId, table.membershipId],
      foreignColumns: [memberships.bizId, memberships.id],
      name: "entitlement_wallets_biz_membership_fk",
    }),

    /** Exactly one owner pointer is required. */
    entitlementWalletsOwnerShapeCheck: check(
      "entitlement_wallets_owner_shape_check",
      sql`
      (
        ("owner_user_id" IS NOT NULL)::int
        + ("owner_group_account_id" IS NOT NULL)::int
      ) = 1
      `,
    ),

    /** Balance should never be negative in normal operation. */
    entitlementWalletsBalanceCheck: check(
      "entitlement_wallets_balance_check",
      sql`"balance_quantity" >= 0`,
    ),
  }),
);

/**
 * entitlement_grants
 *
 * ELI5:
 * Grant rows add value into a wallet (purchase, membership cycle, promo, etc.).
 */
export const entitlementGrants = pgTable(
  "entitlement_grants",
  {
    /** Stable primary key. */
    id: idWithTag("entitlement_grant"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Destination wallet. */
    walletId: idRef("wallet_id")
      .references(() => entitlementWallets.id)
      .notNull(),

    /** Optional source membership cycle context. */
    membershipId: idRef("membership_id").references(() => memberships.id),

    /** Optional source booking order context. */
    bookingOrderId: idRef("booking_order_id").references(() => bookingOrders.id),

    /** Grant value type. */
    grantType: entitlementGrantTypeEnum("grant_type").notNull(),

    /** Quantity granted (must be positive). */
    quantity: integer("quantity").notNull(),

    /** Validity window start. */
    validFromAt: timestamp("valid_from_at", { withTimezone: true }).notNull(),

    /** Validity window end. */
    validUntilAt: timestamp("valid_until_at", { withTimezone: true }),

    /** Whether this grant may rollover into next cycle. */
    rolloverEligible: boolean("rollover_eligible").default(false).notNull(),

    /** Whether this grant's remaining value can be transferred. */
    transferable: boolean("transferable").default(false).notNull(),

    /** Optional user-facing reason text. */
    reason: varchar("reason", { length: 400 }),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    entitlementGrantsBizIdIdUnique: uniqueIndex("entitlement_grants_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Composite unique target for rollover/ledger references. */

    /** Query path for wallet grant timeline. */
    entitlementGrantsBizWalletValidIdx: index("entitlement_grants_biz_wallet_valid_idx").on(
      table.bizId,
      table.walletId,
      table.validFromAt,
    ),

    /** Tenant-safe FK to wallet. */
    entitlementGrantsBizWalletFk: foreignKey({
      columns: [table.bizId, table.walletId],
      foreignColumns: [entitlementWallets.bizId, entitlementWallets.id],
      name: "entitlement_grants_biz_wallet_fk",
    }),

    /** Tenant-safe FK to membership. */
    entitlementGrantsBizMembershipFk: foreignKey({
      columns: [table.bizId, table.membershipId],
      foreignColumns: [memberships.bizId, memberships.id],
      name: "entitlement_grants_biz_membership_fk",
    }),

    /** Tenant-safe FK to booking order. */
    entitlementGrantsBizBookingOrderFk: foreignKey({
      columns: [table.bizId, table.bookingOrderId],
      foreignColumns: [bookingOrders.bizId, bookingOrders.id],
      name: "entitlement_grants_biz_booking_order_fk",
    }),

    /** Quantity and validity checks. */
    entitlementGrantsCheck: check(
      "entitlement_grants_check",
      sql`
      "quantity" > 0
      AND ("valid_until_at" IS NULL OR "valid_until_at" > "valid_from_at")
      `,
    ),
  }),
);

/**
 * entitlement_transfers
 *
 * ELI5:
 * Transfer requests move entitlement value between two wallets.
 */
export const entitlementTransfers = pgTable(
  "entitlement_transfers",
  {
    /** Stable primary key. */
    id: idWithTag("entitlement_transfer"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Source wallet. */
    fromWalletId: idRef("from_wallet_id")
      .references(() => entitlementWallets.id)
      .notNull(),

    /** Destination wallet. */
    toWalletId: idRef("to_wallet_id")
      .references(() => entitlementWallets.id)
      .notNull(),

    /** Transfer lifecycle state. */
    status: entitlementTransferStatusEnum("status").default("requested").notNull(),

    /** Quantity requested to transfer. */
    quantity: integer("quantity").notNull(),

    /** User requesting transfer. */
    requestedByUserId: idRef("requested_by_user_id").references(() => users.id),

    /** User approving/rejecting transfer. */
    reviewedByUserId: idRef("reviewed_by_user_id").references(() => users.id),

    /** Request timestamp. */
    requestedAt: timestamp("requested_at", { withTimezone: true }).defaultNow().notNull(),

    /** Review timestamp. */
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),

    /** Completion timestamp. */
    completedAt: timestamp("completed_at", { withTimezone: true }),

    /** Optional expiry for pending transfer offers. */
    expiresAt: timestamp("expires_at", { withTimezone: true }),

    /** Optional rejection/cancel reason. */
    reason: varchar("reason", { length: 500 }),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite unique key for tenant-safe ledger refs. */
    entitlementTransfersBizIdIdUnique: uniqueIndex(
      "entitlement_transfers_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** Query path for pending transfer workflows. */
    entitlementTransfersBizStatusRequestedIdx: index(
      "entitlement_transfers_biz_status_requested_idx",
    ).on(table.bizId, table.status, table.requestedAt),

    /** Tenant-safe FK to source wallet. */
    entitlementTransfersBizFromWalletFk: foreignKey({
      columns: [table.bizId, table.fromWalletId],
      foreignColumns: [entitlementWallets.bizId, entitlementWallets.id],
      name: "entitlement_transfers_biz_from_wallet_fk",
    }),

    /** Tenant-safe FK to destination wallet. */
    entitlementTransfersBizToWalletFk: foreignKey({
      columns: [table.bizId, table.toWalletId],
      foreignColumns: [entitlementWallets.bizId, entitlementWallets.id],
      name: "entitlement_transfers_biz_to_wallet_fk",
    }),

    /** Transfer must move positive quantity between different wallets. */
    entitlementTransfersCheck: check(
      "entitlement_transfers_check",
      sql`
      "quantity" > 0
      AND "from_wallet_id" <> "to_wallet_id"
      AND ("reviewed_at" IS NULL OR "reviewed_at" >= "requested_at")
      AND ("completed_at" IS NULL OR "completed_at" >= "requested_at")
      AND ("expires_at" IS NULL OR "expires_at" > "requested_at")
      `,
    ),
  }),
);

/**
 * entitlement_ledger_entries
 *
 * ELI5:
 * Immutable wallet movement history.
 *
 * App should treat this as append-only and use compensating entries for fixes.
 */
export const entitlementLedgerEntries = pgTable(
  "entitlement_ledger_entries",
  {
    /** Stable primary key. */
    id: idWithTag("entitlement_ledger"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Target wallet. */
    walletId: idRef("wallet_id")
      .references(() => entitlementWallets.id)
      .notNull(),

    /** Optional source grant reference. */
    grantId: idRef("grant_id").references(() => entitlementGrants.id),

    /** Optional transfer reference. */
    transferId: idRef("transfer_id").references(() => entitlementTransfers.id),

    /** Optional consumption context (booking order). */
    bookingOrderId: idRef("booking_order_id").references(() => bookingOrders.id),

    /** Optional consumption context (fulfillment unit). */
    fulfillmentUnitId: idRef("fulfillment_unit_id").references(
      () => fulfillmentUnits.id,
    ),

    /** Entry type. */
    entryType: entitlementLedgerEntryTypeEnum("entry_type").notNull(),

    /** Signed quantity delta (positive for add, negative for consume/expire). */
    quantityDelta: integer("quantity_delta").notNull(),

    /** Wallet balance after applying this entry. */
    balanceAfter: integer("balance_after").notNull(),

    /** Optional reason code for reporting/automation. */
    reasonCode: varchar("reason_code", { length: 120 }),

    /** Entry timestamp. */
    occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    entitlementLedgerEntriesBizIdIdUnique: uniqueIndex("entitlement_ledger_entries_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Query path for wallet statement rendering. */
    entitlementLedgerEntriesBizWalletOccurredIdx: index(
      "entitlement_ledger_entries_biz_wallet_occurred_idx",
    ).on(table.bizId, table.walletId, table.occurredAt),

    /** Tenant-safe FK to wallet. */
    entitlementLedgerEntriesBizWalletFk: foreignKey({
      columns: [table.bizId, table.walletId],
      foreignColumns: [entitlementWallets.bizId, entitlementWallets.id],
      name: "entitlement_ledger_entries_biz_wallet_fk",
    }),

    /** Tenant-safe FK to grant. */
    entitlementLedgerEntriesBizGrantFk: foreignKey({
      columns: [table.bizId, table.grantId],
      foreignColumns: [entitlementGrants.bizId, entitlementGrants.id],
      name: "entitlement_ledger_entries_biz_grant_fk",
    }),

    /** Tenant-safe FK to transfer. */
    entitlementLedgerEntriesBizTransferFk: foreignKey({
      columns: [table.bizId, table.transferId],
      foreignColumns: [entitlementTransfers.bizId, entitlementTransfers.id],
      name: "entitlement_ledger_entries_biz_transfer_fk",
    }),

    /** Tenant-safe FK to booking order. */
    entitlementLedgerEntriesBizBookingOrderFk: foreignKey({
      columns: [table.bizId, table.bookingOrderId],
      foreignColumns: [bookingOrders.bizId, bookingOrders.id],
      name: "entitlement_ledger_entries_biz_booking_order_fk",
    }),

    /** Tenant-safe FK to fulfillment unit. */
    entitlementLedgerEntriesBizFulfillmentUnitFk: foreignKey({
      columns: [table.bizId, table.fulfillmentUnitId],
      foreignColumns: [fulfillmentUnits.bizId, fulfillmentUnits.id],
      name: "entitlement_ledger_entries_biz_fulfillment_unit_fk",
    }),

    /** Delta cannot be zero; resulting balance should be non-negative. */
    entitlementLedgerEntriesCheck: check(
      "entitlement_ledger_entries_check",
      sql`"quantity_delta" <> 0 AND "balance_after" >= 0`,
    ),
  }),
);

/**
 * rollover_runs
 *
 * ELI5:
 * Batch execution records for periodic rollover/expiry processing.
 */
export const rolloverRuns = pgTable(
  "rollover_runs",
  {
    /** Stable primary key. */
    id: idWithTag("rollover_run"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Optional plan scope for this run. */
    membershipPlanId: idRef("membership_plan_id").references(() => membershipPlans.id),

    /** Optional specific membership scope for this run. */
    membershipId: idRef("membership_id").references(() => memberships.id),

    /** Run status. */
    status: rolloverRunStatusEnum("status").default("pending").notNull(),

    /** Source period start. */
    sourcePeriodStartAt: timestamp("source_period_start_at", {
      withTimezone: true,
    }).notNull(),

    /** Source period end. */
    sourcePeriodEndAt: timestamp("source_period_end_at", {
      withTimezone: true,
    }).notNull(),

    /** Trigger time for this run. */
    runAt: timestamp("run_at", { withTimezone: true }).defaultNow().notNull(),

    /** Execution start. */
    startedAt: timestamp("started_at", { withTimezone: true }),

    /** Execution completion. */
    completedAt: timestamp("completed_at", { withTimezone: true }),

    /** Quantity rolled over in this batch. */
    rolledOverQuantity: integer("rolled_over_quantity").default(0).notNull(),

    /** Quantity expired in this batch. */
    expiredQuantity: integer("expired_quantity").default(0).notNull(),

    /** Structured run summary payload. */
    summary: jsonb("summary").default({}),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    rolloverRunsBizIdIdUnique: uniqueIndex("rollover_runs_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Query path for rollover monitor dashboards. */
    rolloverRunsBizStatusRunIdx: index("rollover_runs_biz_status_run_idx").on(
      table.bizId,
      table.status,
      table.runAt,
    ),

    /** Tenant-safe FK to plan. */
    rolloverRunsBizPlanFk: foreignKey({
      columns: [table.bizId, table.membershipPlanId],
      foreignColumns: [membershipPlans.bizId, membershipPlans.id],
      name: "rollover_runs_biz_plan_fk",
    }),

    /** Tenant-safe FK to membership. */
    rolloverRunsBizMembershipFk: foreignKey({
      columns: [table.bizId, table.membershipId],
      foreignColumns: [memberships.bizId, memberships.id],
      name: "rollover_runs_biz_membership_fk",
    }),

    /** Period and quantity constraints. */
    rolloverRunsCheck: check(
      "rollover_runs_check",
      sql`
      "source_period_end_at" > "source_period_start_at"
      AND "rolled_over_quantity" >= 0
      AND "expired_quantity" >= 0
      AND ("completed_at" IS NULL OR "started_at" IS NULL OR "completed_at" >= "started_at")
      `,
    ),
  }),
);
