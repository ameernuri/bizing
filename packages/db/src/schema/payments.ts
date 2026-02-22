import { sql } from "drizzle-orm";
import { check, foreignKey, index, uniqueIndex } from "drizzle-orm/pg-core";
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { idRef, idWithTag, withAuditRefs } from "./_common";
import { bizes } from "./bizes";
import { users } from "./users";
import { bookingOrderLines, bookingOrders } from "./fulfillment";
import {
  lifecycleStatusEnum,
  paymentDisputeStatusEnum,
  paymentIntentEventTypeEnum,
  paymentIntentStatusEnum,
  paymentMethodTypeEnum,
  paymentTransactionStatusEnum,
  paymentTransactionTypeEnum,
  payoutLedgerEntryTypeEnum,
  payoutStatusEnum,
  settlementBatchStatusEnum,
} from "./enums";
import { crossBizOrders } from "./marketplace";

/**
 * payment_processor_accounts
 *
 * ELI5:
 * This is the routing table for "which processor account handles money for this biz".
 *
 * Why this table exists:
 * - one biz can use multiple processor accounts (for example platform MOR + own account),
 * - platform-managed accounts (Bizing-owned) and biz-owned accounts are both first-class,
 * - payment intents/transactions/payouts can point to one explicit processing rail.
 *
 * This is the core backbone for:
 * - Stripe platform-MOR defaults for small businesses,
 * - custom processors and partner-managed rails,
 * - future account-routing policies without hardcoding provider assumptions.
 */
export const paymentProcessorAccounts = pgTable(
  "payment_processor_accounts",
  {
    /** Stable primary key. */
    id: idWithTag("pay_proc_account"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /**
     * Processor namespace key.
     * Examples: `stripe`, `adyen`, `square`, `bizing_platform`, `custom_xyz`.
     */
    providerKey: varchar("provider_key", { length: 120 }).notNull(),

    /** Stable account reference in provider namespace. */
    processorAccountRef: varchar("processor_account_ref", { length: 220 }).notNull(),

    /** Lifecycle state for routing/operations. */
    status: lifecycleStatusEnum("status").default("active").notNull(),

    /**
     * Who controls this account relationship.
     * - `platform_managed`: Bizing/partner manages processor relationship
     * - `biz_owned`: biz directly owns processor account
     * - `partner_managed`: third-party partner manages account
     */
    ownershipModel: varchar("ownership_model", { length: 40 })
      .default("platform_managed")
      .notNull(),

    /**
     * Commercial responsibility model for this processing rail.
     * - `merchant_of_record`: platform/owner of this account is MOR
     * - `payment_facilitator`: facilitator model
     * - `direct`: direct merchant processing
     */
    commerceModel: varchar("commerce_model", { length: 40 })
      .default("merchant_of_record")
      .notNull(),

    /**
     * Primary default routing target for this biz.
     * Keep one active default row per biz for deterministic fallback routing.
     */
    isDefault: boolean("is_default").default(false).notNull(),

    /** Capability mirrors for quick policy checks and guardrails. */
    chargesEnabled: boolean("charges_enabled").default(true).notNull(),
    payoutsEnabled: boolean("payouts_enabled").default(true).notNull(),
    supportsSplitTender: boolean("supports_split_tender").default(true).notNull(),
    supportsDisputes: boolean("supports_disputes").default(true).notNull(),
    supportsRefunds: boolean("supports_refunds").default(true).notNull(),

    /**
     * Secret pointer for auth material in external secret manager.
     * Keep credentials out of DB rows.
     */
    secretRef: varchar("secret_ref", { length: 255 }),

    /** Non-secret provider config (region, mode, account options). */
    configuration: jsonb("configuration").default({}).notNull(),

    /** Capability and limits payload mirrored from provider/profile APIs. */
    capabilities: jsonb("capabilities").default({}).notNull(),

    /** Extensible metadata payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite key for tenant-safe FKs from payment tables. */
    paymentProcessorAccountsBizIdIdUnique: uniqueIndex(
      "payment_processor_accounts_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** Prevent duplicate provider account references per tenant. */
    paymentProcessorAccountsBizProviderAccountUnique: uniqueIndex(
      "payment_processor_accounts_biz_provider_account_unique",
    ).on(table.bizId, table.providerKey, table.processorAccountRef),

    /** Keep one active default routing account per biz. */
    paymentProcessorAccountsBizDefaultUnique: uniqueIndex(
      "payment_processor_accounts_biz_default_unique",
    )
      .on(table.bizId)
      .where(sql`"is_default" = true AND "status" = 'active' AND "deleted_at" IS NULL`),

    /** Common routing/ops lookup path. */
    paymentProcessorAccountsBizProviderStatusIdx: index(
      "payment_processor_accounts_biz_provider_status_idx",
    ).on(table.bizId, table.providerKey, table.status, table.isDefault),

    /** Provider key must not be empty. */
    paymentProcessorAccountsProviderKeyCheck: check(
      "payment_processor_accounts_provider_key_check",
      sql`length("provider_key") > 0`,
    ),

    /** Ownership model vocabulary with custom_* escape hatch. */
    paymentProcessorAccountsOwnershipModelCheck: check(
      "payment_processor_accounts_ownership_model_check",
      sql`
      "ownership_model" IN ('platform_managed', 'biz_owned', 'partner_managed')
      OR "ownership_model" LIKE 'custom_%'
      `,
    ),

    /** Commerce model vocabulary with custom_* escape hatch. */
    paymentProcessorAccountsCommerceModelCheck: check(
      "payment_processor_accounts_commerce_model_check",
      sql`
      "commerce_model" IN ('merchant_of_record', 'payment_facilitator', 'direct')
      OR "commerce_model" LIKE 'custom_%'
      `,
    ),
  }),
);

/**
 * payment_methods
 *
 * ELI5:
 * This is the safe payment method catalog (references/tokens only).
 * It stores pointers, not full PCI secrets.
 *
 * Why it exists:
 * - split-tender needs a reusable method registry,
 * - billing history should reference stable payment method ids,
 * - multiple orders can use same method safely.
 */
export const paymentMethods = pgTable(
  "payment_methods",
  {
    /** Stable primary key. */
    id: idWithTag("payment_method"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Optional owner user when method is customer-specific. */
    ownerUserId: idRef("owner_user_id").references(() => users.id),

    /** Optional processor account route used by this method/token. */
    paymentProcessorAccountId: idRef("payment_processor_account_id").references(
      () => paymentProcessorAccounts.id,
    ),

    /** Tender instrument class (card/cash/bank/wallet/etc.). */
    type: paymentMethodTypeEnum("type").notNull(),

    /** Payment processor/provider key (stripe, square, adyen, etc.). */
    provider: varchar("provider", { length: 80 }).notNull(),

    /** Provider-side payment method id/token. */
    providerMethodRef: varchar("provider_method_ref", { length: 200 }).notNull(),

    /** Optional user-facing label ("Personal Visa", "Corp AMEX"). */
    label: varchar("label", { length: 120 }),

    /** Non-sensitive card brand metadata when type=card. */
    cardBrand: varchar("card_brand", { length: 40 }),

    /** Non-sensitive last4 metadata when type=card. */
    cardLast4: varchar("card_last4", { length: 4 }),

    /** Expiry month when card metadata exists. */
    cardExpMonth: integer("card_exp_month"),

    /** Expiry year when card metadata exists. */
    cardExpYear: integer("card_exp_year"),

    /** Default method marker for user profile checkout convenience. */
    isDefault: boolean("is_default").default(false).notNull(),

    /** Active toggle for soft-retiring invalid/revoked methods. */
    isActive: boolean("is_active").default(true).notNull(),

    /** Extension payload (billing address refs, wallet details, etc.). */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    paymentMethodsBizIdIdUnique: uniqueIndex("payment_methods_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Composite unique key for tenant-safe tender allocations. */

    /** Avoid duplicate provider refs in one tenant namespace. */
    paymentMethodsBizProviderRefUnique: uniqueIndex(
      "payment_methods_biz_provider_ref_unique",
    ).on(table.bizId, table.provider, table.providerMethodRef),

    /** Query path for user checkout defaults. */
    paymentMethodsBizOwnerIdx: index("payment_methods_biz_owner_idx").on(
      table.bizId,
      table.ownerUserId,
      table.isDefault,
      table.isActive,
    ),

    /** Routing-path index for processor-account scoped method queries. */
    paymentMethodsBizProcessorOwnerIdx: index(
      "payment_methods_biz_processor_owner_idx",
    ).on(table.bizId, table.paymentProcessorAccountId, table.ownerUserId, table.isActive),

    /** Tenant-safe FK to processor account routing row. */
    paymentMethodsBizProcessorAccountFk: foreignKey({
      columns: [table.bizId, table.paymentProcessorAccountId],
      foreignColumns: [paymentProcessorAccounts.bizId, paymentProcessorAccounts.id],
      name: "payment_methods_biz_processor_account_fk",
    }),

    /** At most one active default method per user per tenant. */
    paymentMethodsOneDefaultPerUserUnique: uniqueIndex(
      "payment_methods_one_default_per_user_unique",
    )
      .on(table.bizId, table.ownerUserId)
      .where(sql`"owner_user_id" IS NOT NULL AND "is_default" = true AND "is_active" = true AND "deleted_at" IS NULL`),

    /** Card expiry month/year bounds when present. */
    paymentMethodsCardExpiryCheck: check(
      "payment_methods_card_expiry_check",
      sql`
      ("card_exp_month" IS NULL OR ("card_exp_month" >= 1 AND "card_exp_month" <= 12))
      AND ("card_exp_year" IS NULL OR "card_exp_year" >= 2000)
      `,
    ),
  }),
);

/**
 * payment_intents
 *
 * ELI5:
 * One payment intent represents the planned and running money collection for
 * one booking order or one cross-biz order.
 *
 * Split tender support:
 * - one intent can have multiple `payment_intent_tenders` rows.
 */
export const paymentIntents = pgTable(
  "payment_intents",
  {
    /** Stable primary key. */
    id: idWithTag("payment_intent"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Optional booking-order commercial context. */
    bookingOrderId: idRef("booking_order_id").references(() => bookingOrders.id),

    /** Optional cross-biz order settlement context. */
    crossBizOrderId: idRef("cross_biz_order_id").references(() => crossBizOrders.id),

    /**
     * Optional processor-account routing target.
     * This allows one biz to run intents through different rails/accounts.
     */
    paymentProcessorAccountId: idRef("payment_processor_account_id").references(
      () => paymentProcessorAccounts.id,
    ),

    /** Current intent lifecycle state. */
    status: paymentIntentStatusEnum("status")
      .default("requires_payment_method")
      .notNull(),

    /** Intent currency. */
    currency: varchar("currency", { length: 3 }).default("USD").notNull(),

    /** Target amount to collect in minor units. */
    amountTargetMinor: integer("amount_target_minor").notNull(),

    /** Total captured amount in minor units. */
    amountCapturedMinor: integer("amount_captured_minor").default(0).notNull(),

    /** Total refunded amount in minor units. */
    amountRefundedMinor: integer("amount_refunded_minor").default(0).notNull(),

    /** If true, auth+capture are separate stages. */
    requiresCapture: boolean("requires_capture").default(false).notNull(),

    /** Optional processor-side intent reference id. */
    providerIntentRef: varchar("provider_intent_ref", { length: 200 }),

    /** Optional creation source tag (web/admin/api/channel). */
    source: varchar("source", { length: 40 }).default("api").notNull(),

    /** Authorization time marker (if used). */
    authorizedAt: timestamp("authorized_at", { withTimezone: true }),

    /** Capture completion marker. */
    capturedAt: timestamp("captured_at", { withTimezone: true }),

    /** Failure/cancellation marker. */
    failedAt: timestamp("failed_at", { withTimezone: true }),

    /**
     * Snapshot of pricing/tax/fees context when payment started.
     * Keeps money explainability stable even if upstream pricing changes.
     */
    amountSnapshot: jsonb("amount_snapshot").default({}).notNull(),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    paymentIntentsBizIdIdUnique: uniqueIndex("payment_intents_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Composite unique key for tenant-safe child transaction/tender FKs. */

    /** Avoid duplicate provider intent refs in tenant namespace when set. */
    paymentIntentsBizProviderRefUnique: uniqueIndex(
      "payment_intents_biz_provider_ref_unique",
    )
      .on(table.bizId, table.providerIntentRef)
      .where(sql`"provider_intent_ref" IS NOT NULL`),

    /** Query path for unresolved collection operations. */
    paymentIntentsBizStatusIdx: index("payment_intents_biz_status_idx").on(
      table.bizId,
      table.status,
    ),

    /** Routing-focused query path for processor-specific operations. */
    paymentIntentsBizProcessorStatusIdx: index(
      "payment_intents_biz_processor_status_idx",
    ).on(table.bizId, table.paymentProcessorAccountId, table.status),

    /** Tenant-safe FK to processor account routing row. */
    paymentIntentsBizProcessorAccountFk: foreignKey({
      columns: [table.bizId, table.paymentProcessorAccountId],
      foreignColumns: [paymentProcessorAccounts.bizId, paymentProcessorAccounts.id],
      name: "payment_intents_biz_processor_account_fk",
    }),

    /** Tenant-safe FK to booking order. */
    paymentIntentsBizBookingOrderFk: foreignKey({
      columns: [table.bizId, table.bookingOrderId],
      foreignColumns: [bookingOrders.bizId, bookingOrders.id],
      name: "payment_intents_biz_booking_order_fk",
    }),

    /** Tenant-safe FK to cross-biz order. */
    paymentIntentsBizCrossBizOrderFk: foreignKey({
      columns: [table.bizId, table.crossBizOrderId],
      foreignColumns: [crossBizOrders.bizId, crossBizOrders.id],
      name: "payment_intents_biz_cross_biz_order_fk",
    }),

    /** One and only one commercial target must be provided. */
    paymentIntentsTargetShapeCheck: check(
      "payment_intents_target_shape_check",
      sql`
      (
        ("booking_order_id" IS NOT NULL)::int
        + ("cross_biz_order_id" IS NOT NULL)::int
      ) = 1
      `,
    ),

    /** Core amount invariants for deterministic money math. */
    paymentIntentsAmountCheck: check(
      "payment_intents_amount_check",
      sql`
      "amount_target_minor" >= 0
      AND "amount_captured_minor" >= 0
      AND "amount_refunded_minor" >= 0
      AND "amount_captured_minor" <= "amount_target_minor"
      AND "amount_refunded_minor" <= "amount_captured_minor"
      `,
    ),

    /** Currency should always be uppercase ISO-4217 format. */
    paymentIntentsCurrencyFormatCheck: check(
      "payment_intents_currency_format_check",
      sql`"currency" ~ '^[A-Z]{3}$'`,
    ),
  }),
);

/**
 * payment_intent_events
 *
 * ELI5:
 * `payment_intents` stores current snapshot state.
 * `payment_intent_events` stores immutable transition facts over time.
 *
 * Why this matters:
 * - support can explain exactly who changed an intent and when,
 * - analytics can build conversion/failed/capture funnels from events,
 * - auditors can reconstruct lifecycle history without diffing snapshots.
 */
export const paymentIntentEvents = pgTable(
  "payment_intent_events",
  {
    /** Stable primary key for one event row. */
    id: idWithTag("payment_intent_event"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent payment intent. */
    paymentIntentId: idRef("payment_intent_id").notNull(),

    /** Transition/event category. */
    eventType: paymentIntentEventTypeEnum("event_type").notNull(),

    /** Previous status snapshot when relevant. */
    previousStatus: paymentIntentStatusEnum("previous_status"),

    /** New status snapshot when relevant. */
    nextStatus: paymentIntentStatusEnum("next_status"),

    /** Previous target amount snapshot when relevant. */
    previousAmountTargetMinor: integer("previous_amount_target_minor"),

    /** New target amount snapshot when relevant. */
    nextAmountTargetMinor: integer("next_amount_target_minor"),

    /** Previous captured amount snapshot when relevant. */
    previousAmountCapturedMinor: integer("previous_amount_captured_minor"),

    /** New captured amount snapshot when relevant. */
    nextAmountCapturedMinor: integer("next_amount_captured_minor"),

    /** Previous refunded amount snapshot when relevant. */
    previousAmountRefundedMinor: integer("previous_amount_refunded_minor"),

    /** New refunded amount snapshot when relevant. */
    nextAmountRefundedMinor: integer("next_amount_refunded_minor"),

    /** Optional actor user for manual/admin transitions. */
    actorUserId: idRef("actor_user_id").references(() => users.id),

    /** Optional non-user actor ref (worker/integration/api key). */
    actorRef: varchar("actor_ref", { length: 200 }),

    /** Optional request correlation key for trace stitching. */
    requestKey: varchar("request_key", { length: 140 }),

    /** Optional reason code for explainability. */
    reasonCode: varchar("reason_code", { length: 120 }),

    /** Business occurrence timestamp. */
    occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),

    /** Structured transition details snapshot. */
    details: jsonb("details").default({}).notNull(),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    paymentIntentEventsBizIdIdUnique: uniqueIndex("payment_intent_events_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Composite key for tenant-safe references. */

    /** Primary timeline path for one intent. */
    paymentIntentEventsBizIntentOccurredIdx: index(
      "payment_intent_events_biz_intent_occurred_idx",
    ).on(table.bizId, table.paymentIntentId, table.occurredAt),

    /** Cross-intent event analytics path. */
    paymentIntentEventsBizTypeOccurredIdx: index(
      "payment_intent_events_biz_type_occurred_idx",
    ).on(table.bizId, table.eventType, table.nextStatus, table.occurredAt),

    /** Request-level trace path. */
    paymentIntentEventsBizRequestOccurredIdx: index(
      "payment_intent_events_biz_request_occurred_idx",
    ).on(table.bizId, table.requestKey, table.occurredAt),

    /** Tenant-safe FK to parent intent. */
    paymentIntentEventsBizIntentFk: foreignKey({
      columns: [table.bizId, table.paymentIntentId],
      foreignColumns: [paymentIntents.bizId, paymentIntents.id],
      name: "payment_intent_events_biz_intent_fk",
    }),

    /** Amount snapshots must stay non-negative when present. */
    paymentIntentEventsAmountBoundsCheck: check(
      "payment_intent_events_amount_bounds_check",
      sql`
      ("previous_amount_target_minor" IS NULL OR "previous_amount_target_minor" >= 0)
      AND ("next_amount_target_minor" IS NULL OR "next_amount_target_minor" >= 0)
      AND ("previous_amount_captured_minor" IS NULL OR "previous_amount_captured_minor" >= 0)
      AND ("next_amount_captured_minor" IS NULL OR "next_amount_captured_minor" >= 0)
      AND ("previous_amount_refunded_minor" IS NULL OR "previous_amount_refunded_minor" >= 0)
      AND ("next_amount_refunded_minor" IS NULL OR "next_amount_refunded_minor" >= 0)
      `,
    ),

    /** Non-create rows should carry at least one transition dimension. */
    paymentIntentEventsTransitionShapeCheck: check(
      "payment_intent_events_transition_shape_check",
      sql`
      "event_type" = 'created'
      OR "previous_status" IS NOT NULL
      OR "next_status" IS NOT NULL
      OR "previous_amount_target_minor" IS NOT NULL
      OR "next_amount_target_minor" IS NOT NULL
      OR "previous_amount_captured_minor" IS NOT NULL
      OR "next_amount_captured_minor" IS NOT NULL
      OR "previous_amount_refunded_minor" IS NOT NULL
      OR "next_amount_refunded_minor" IS NOT NULL
      `,
    ),
  }),
);

/**
 * payment_intent_tenders
 *
 * ELI5:
 * Split tender rows divide one payment intent across multiple methods.
 * Example: $80 card + $20 gift credit.
 */
export const paymentIntentTenders = pgTable(
  "payment_intent_tenders",
  {
    /** Stable primary key. */
    id: idWithTag("intent_tender"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent payment intent. */
    paymentIntentId: idRef("payment_intent_id")
      .references(() => paymentIntents.id)
      .notNull(),

    /** Optional method reference when tender maps to stored method row. */
    paymentMethodId: idRef("payment_method_id").references(() => paymentMethods.id),

    /**
     * Optional gift instrument link when `method_type=gift_card`.
     *
     * Why this exists:
     * - makes split-tender gift usage explicitly traceable at tender-leg level,
     * - allows direct reconciliation between gift ledger and payment legs.
     *
     * Note:
     * This column intentionally stays as plain idRef in this module to avoid
     * circular type initialization with `gifts.ts`; tenant-safe linkage is
     * still enforced from the gifts-side FKs and reconciliation flows.
     */
    giftInstrumentId: idRef("gift_instrument_id"),

    /** Tender type for this allocation. */
    methodType: paymentMethodTypeEnum("method_type").notNull(),

    /** Allocation amount in minor units for this tender leg. */
    allocatedMinor: integer("allocated_minor").notNull(),

    /** Captured amount in minor units on this leg. */
    capturedMinor: integer("captured_minor").default(0).notNull(),

    /** Refunded amount in minor units on this leg. */
    refundedMinor: integer("refunded_minor").default(0).notNull(),

    /** Order in which tenders are attempted/applied. */
    sortOrder: integer("sort_order").default(1).notNull(),

    /** Optional external source reference for one-time tenders. */
    externalTenderRef: varchar("external_tender_ref", { length: 200 }),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /**
     * Composite unique key for tenant-safe references from external modules.
     *
     * This is especially important because gift and allocation tables point to
     * tenders with `(biz_id, id)` FKs to preserve tenant isolation.
     */
    paymentIntentTendersBizIdIdUnique: uniqueIndex(
      "payment_intent_tenders_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /**
     * Composite unique key proving this tender belongs to this exact payment intent.
     *
     * We use this as a strict FK target from line-allocation tables so rows
     * cannot accidentally point to a tender from another intent.
     */
    paymentIntentTendersBizIntentIdIdUnique: uniqueIndex(
      "payment_intent_tenders_biz_intent_id_id_unique",
    ).on(table.bizId, table.paymentIntentId, table.id),

    /** Avoid duplicate tender order position per intent. */
    paymentIntentTendersIntentSortUnique: uniqueIndex(
      "payment_intent_tenders_intent_sort_unique",
    ).on(table.paymentIntentId, table.sortOrder),

    /** Query path for split-tender reconcilers. */
    paymentIntentTendersBizIntentIdx: index("payment_intent_tenders_biz_intent_idx").on(
      table.bizId,
      table.paymentIntentId,
    ),
    /** Common reconciliation path by gift instrument usage. */
    paymentIntentTendersBizGiftIdx: index("payment_intent_tenders_biz_gift_idx").on(
      table.bizId,
      table.giftInstrumentId,
      table.paymentIntentId,
    ),

    /** Tenant-safe FK to intent. */
    paymentIntentTendersBizIntentFk: foreignKey({
      columns: [table.bizId, table.paymentIntentId],
      foreignColumns: [paymentIntents.bizId, paymentIntents.id],
      name: "payment_intent_tenders_biz_intent_fk",
    }),

    /** Tenant-safe FK to method. */
    paymentIntentTendersBizMethodFk: foreignKey({
      columns: [table.bizId, table.paymentMethodId],
      foreignColumns: [paymentMethods.bizId, paymentMethods.id],
      name: "payment_intent_tenders_biz_method_fk",
    }),

    /** Amount invariants per tender leg. */
    paymentIntentTendersAmountCheck: check(
      "payment_intent_tenders_amount_check",
      sql`
      "allocated_minor" >= 0
      AND "captured_minor" >= 0
      AND "refunded_minor" >= 0
      AND "captured_minor" <= "allocated_minor"
      AND "refunded_minor" <= "captured_minor"
      `,
    ),

    /** Sort order should be positive. */
    paymentIntentTendersSortCheck: check(
      "payment_intent_tenders_sort_check",
      sql`"sort_order" >= 1`,
    ),

    /**
     * If this tender leg is a gift-card leg, it must identify a gift instrument.
     * Non-gift tender legs must not carry gift instrument references.
     */
    paymentIntentTendersGiftShapeCheck: check(
      "payment_intent_tenders_gift_shape_check",
      sql`
      (
        "method_type" = 'gift_card'
        AND "gift_instrument_id" IS NOT NULL
      ) OR (
        "method_type" <> 'gift_card'
        AND "gift_instrument_id" IS NULL
      )
      `,
    ),
  }),
);

/**
 * payment_intent_line_allocations
 *
 * ELI5:
 * One row says "this tender leg plans to pay this order line by this amount."
 *
 * Why this exists:
 * - split tender alone only says how an order is paid at order-total level,
 * - this table makes payment intent traceable at line level,
 * - refund/dispute/commission workflows can now target exact line allocations.
 *
 * Practical example:
 * - line A = $70 service
 * - line B = $30 fee
 * - tender 1 (gift) allocates $30 to line B
 * - tender 2 (card) allocates $70 to line A
 */
export const paymentIntentLineAllocations = pgTable(
  "payment_intent_line_allocations",
  {
    /** Stable primary key for one planned tender-to-line allocation row. */
    id: idWithTag("intent_line_alloc"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent payment intent. */
    paymentIntentId: idRef("payment_intent_id")
      .references(() => paymentIntents.id)
      .notNull(),

    /** Tender leg that funds this line allocation. */
    paymentIntentTenderId: idRef("payment_intent_tender_id")
      .references(() => paymentIntentTenders.id)
      .notNull(),

    /** Booking-order context for deterministic line lineage. */
    bookingOrderId: idRef("booking_order_id")
      .references(() => bookingOrders.id)
      .notNull(),

    /** Exact booking line this tender allocation applies to. */
    bookingOrderLineId: idRef("booking_order_line_id")
      .references(() => bookingOrderLines.id)
      .notNull(),

    /** Planned allocated amount in minor units for this line from this tender. */
    allocatedMinor: integer("allocated_minor").notNull(),

    /**
     * Captured amount snapshot for quick reads.
     *
     * Keep in sync with `payment_transaction_line_allocations` entries.
     */
    capturedMinor: integer("captured_minor").default(0).notNull(),

    /**
     * Refunded amount snapshot for quick reads.
     *
     * Keep in sync with `payment_transaction_line_allocations` entries.
     */
    refundedMinor: integer("refunded_minor").default(0).notNull(),

    /** Display/evaluation ordering when a tender funds many lines. */
    sortOrder: integer("sort_order").default(1).notNull(),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite unique key for tenant-safe references. */
    paymentIntentLineAllocationsBizIdIdUnique: uniqueIndex(
      "payment_intent_line_allocations_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /**
     * One planned allocation row per tender/line pair.
     *
     * If allocation changes, update this row instead of creating duplicates.
     */
    paymentIntentLineAllocationsTenderLineUnique: uniqueIndex(
      "payment_intent_line_allocations_tender_line_unique",
    ).on(table.paymentIntentTenderId, table.bookingOrderLineId),

    /** Common read path for order payment-breakdown APIs. */
    paymentIntentLineAllocationsBizOrderIdx: index(
      "payment_intent_line_allocations_biz_order_idx",
    ).on(table.bizId, table.bookingOrderId, table.bookingOrderLineId),

    /** Common read path for tender-level reconciliation. */
    paymentIntentLineAllocationsBizTenderIdx: index(
      "payment_intent_line_allocations_biz_tender_idx",
    ).on(table.bizId, table.paymentIntentTenderId, table.bookingOrderLineId),

    /** Tenant-safe FK to payment intent. */
    paymentIntentLineAllocationsBizIntentFk: foreignKey({
      columns: [table.bizId, table.paymentIntentId],
      foreignColumns: [paymentIntents.bizId, paymentIntents.id],
      name: "payment_intent_line_allocations_biz_intent_fk",
    }),

    /**
     * Tenant-safe FK to tender plus intent context.
     *
     * This guarantees `payment_intent_tender_id` belongs to `payment_intent_id`.
     */
    paymentIntentLineAllocationsBizTenderIntentFk: foreignKey({
      columns: [table.bizId, table.paymentIntentId, table.paymentIntentTenderId],
      foreignColumns: [
        paymentIntentTenders.bizId,
        paymentIntentTenders.paymentIntentId,
        paymentIntentTenders.id,
      ],
      name: "payment_intent_line_allocations_biz_tender_intent_fk",
    }),

    /** Tenant-safe FK to booking order root. */
    paymentIntentLineAllocationsBizOrderFk: foreignKey({
      columns: [table.bizId, table.bookingOrderId],
      foreignColumns: [bookingOrders.bizId, bookingOrders.id],
      name: "payment_intent_line_allocations_biz_order_fk",
    }),

    /**
     * Tenant-safe FK to booking line with order linkage.
     *
     * This prevents rows that point to an order line not belonging to the
     * stated booking order.
     */
    paymentIntentLineAllocationsBizOrderLineFk: foreignKey({
      columns: [table.bizId, table.bookingOrderId, table.bookingOrderLineId],
      foreignColumns: [
        bookingOrderLines.bizId,
        bookingOrderLines.bookingOrderId,
        bookingOrderLines.id,
      ],
      name: "payment_intent_line_allocations_biz_order_line_fk",
    }),

    /** Amount and lifecycle invariants for deterministic math. */
    paymentIntentLineAllocationsAmountCheck: check(
      "payment_intent_line_allocations_amount_check",
      sql`
      "allocated_minor" >= 0
      AND "captured_minor" >= 0
      AND "refunded_minor" >= 0
      AND "captured_minor" <= "allocated_minor"
      AND "refunded_minor" <= "captured_minor"
      `,
    ),

    /** Sort order must be positive. */
    paymentIntentLineAllocationsSortCheck: check(
      "payment_intent_line_allocations_sort_check",
      sql`"sort_order" >= 1`,
    ),
  }),
);

/**
 * payment_transactions
 *
 * ELI5:
 * Immutable money movement log. Each row is one factual transaction event.
 *
 * Important:
 * - App should treat this table as append-only.
 * - Corrections should be compensating entries, not updates/deletes.
 */
export const paymentTransactions = pgTable(
  "payment_transactions",
  {
    /** Stable primary key. */
    id: idWithTag("payment_txn"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Optional parent payment intent. */
    paymentIntentId: idRef("payment_intent_id").references(() => paymentIntents.id),

    /** Optional booking-order context for direct financial lookups. */
    bookingOrderId: idRef("booking_order_id").references(() => bookingOrders.id),

    /** Optional cross-biz order context for settlement. */
    crossBizOrderId: idRef("cross_biz_order_id").references(() => crossBizOrders.id),

    /** Optional tender leg source. */
    paymentIntentTenderId: idRef("payment_intent_tender_id").references(
      () => paymentIntentTenders.id,
    ),

    /** Optional method actually used for this transaction event. */
    paymentMethodId: idRef("payment_method_id").references(() => paymentMethods.id),

    /** Optional processor account route used for this transaction event. */
    paymentProcessorAccountId: idRef("payment_processor_account_id").references(
      () => paymentProcessorAccounts.id,
    ),

    /**
     * Optional gift instrument reference when this transaction is tied to gift value.
     * This mirrors tender-level linkage for immutable money-event traceability.
     *
     * Note:
     * Kept as plain idRef in payments module to avoid circular table
     * initialization with gift schema declarations.
     */
    giftInstrumentId: idRef("gift_instrument_id"),

    /** Transaction class (charge/refund/dispute fee/etc.). */
    type: paymentTransactionTypeEnum("type").notNull(),

    /** Transaction state. */
    status: paymentTransactionStatusEnum("status").default("pending").notNull(),

    /** Amount in minor units. Use positive numbers with `type` semantics. */
    amountMinor: integer("amount_minor").notNull(),

    /** Transaction currency. */
    currency: varchar("currency", { length: 3 }).default("USD").notNull(),

    /** Processor-side transaction id. */
    providerTransactionRef: varchar("provider_transaction_ref", { length: 200 }),

    /** Idempotency key from API caller/worker for safe retries. */
    idempotencyKey: varchar("idempotency_key", { length: 200 }),

    /** Transaction occurrence timestamp. */
    occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),

    /** Optional failure reason/code payload summary. */
    failureReason: varchar("failure_reason", { length: 400 }),

    /** Structured processor payload snapshot. */
    providerPayload: jsonb("provider_payload").default({}),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite unique key used by dispute/settlement rows. */
    paymentTransactionsBizIdIdUnique: uniqueIndex(
      "payment_transactions_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** Prevent duplicate idempotent writes in one tenant when key is supplied. */
    paymentTransactionsBizIdempotencyUnique: uniqueIndex(
      "payment_transactions_biz_idempotency_unique",
    )
      .on(table.bizId, table.idempotencyKey)
      .where(sql`"idempotency_key" IS NOT NULL`),

    /** Common ledger timeline path. */
    paymentTransactionsBizOccurredIdx: index("payment_transactions_biz_occurred_idx").on(
      table.bizId,
      table.occurredAt,
    ),
    /** Reconciliation path for gift-linked transactions. */
    paymentTransactionsBizGiftOccurredIdx: index(
      "payment_transactions_biz_gift_occurred_idx",
    ).on(table.bizId, table.giftInstrumentId, table.occurredAt),

    /** Reconciliation path scoped by processor account. */
    paymentTransactionsBizProcessorOccurredIdx: index(
      "payment_transactions_biz_processor_occurred_idx",
    ).on(table.bizId, table.paymentProcessorAccountId, table.occurredAt),

    /** Tenant-safe FK to intent. */
    paymentTransactionsBizIntentFk: foreignKey({
      columns: [table.bizId, table.paymentIntentId],
      foreignColumns: [paymentIntents.bizId, paymentIntents.id],
      name: "payment_transactions_biz_intent_fk",
    }),

    /** Tenant-safe FK to booking order. */
    paymentTransactionsBizBookingOrderFk: foreignKey({
      columns: [table.bizId, table.bookingOrderId],
      foreignColumns: [bookingOrders.bizId, bookingOrders.id],
      name: "payment_transactions_biz_booking_order_fk",
    }),

    /** Tenant-safe FK to cross-biz order. */
    paymentTransactionsBizCrossBizOrderFk: foreignKey({
      columns: [table.bizId, table.crossBizOrderId],
      foreignColumns: [crossBizOrders.bizId, crossBizOrders.id],
      name: "payment_transactions_biz_cross_biz_order_fk",
    }),

    /** Tenant-safe FK to tender leg. */
    paymentTransactionsBizTenderFk: foreignKey({
      columns: [table.bizId, table.paymentIntentTenderId],
      foreignColumns: [paymentIntentTenders.bizId, paymentIntentTenders.id],
      name: "payment_transactions_biz_tender_fk",
    }),

    /** Tenant-safe FK to method. */
    paymentTransactionsBizMethodFk: foreignKey({
      columns: [table.bizId, table.paymentMethodId],
      foreignColumns: [paymentMethods.bizId, paymentMethods.id],
      name: "payment_transactions_biz_method_fk",
    }),

    /** Tenant-safe FK to processor account routing row. */
    paymentTransactionsBizProcessorAccountFk: foreignKey({
      columns: [table.bizId, table.paymentProcessorAccountId],
      foreignColumns: [paymentProcessorAccounts.bizId, paymentProcessorAccounts.id],
      name: "payment_transactions_biz_processor_account_fk",
    }),

    /** Money values must be positive. */
    paymentTransactionsAmountPositiveCheck: check(
      "payment_transactions_amount_positive_check",
      sql`"amount_minor" > 0`,
    ),

    /** Transaction should attach to at least one financial context. */
    paymentTransactionsContextCheck: check(
      "payment_transactions_context_check",
      sql`
      "payment_intent_id" IS NOT NULL
      OR "booking_order_id" IS NOT NULL
      OR "cross_biz_order_id" IS NOT NULL
      `,
    ),

    /** Currency should always be uppercase ISO-4217 format. */
    paymentTransactionsCurrencyFormatCheck: check(
      "payment_transactions_currency_format_check",
      sql`"currency" ~ '^[A-Z]{3}$'`,
    ),

    /**
     * Gift-linked transactions should point at a concrete tender leg.
     * Tender rows already enforce `method_type=gift_card` shape.
     */
    paymentTransactionsGiftShapeCheck: check(
      "payment_transactions_gift_shape_check",
      sql`
      "gift_instrument_id" IS NULL
      OR "payment_intent_tender_id" IS NOT NULL
      `,
    ),

    /**
     * Tender hierarchy safety.
     *
     * If a row references one tender leg, it must also reference the parent
     * payment intent so joins and reconciliation remain deterministic.
     */
    paymentTransactionsTenderHierarchyCheck: check(
      "payment_transactions_tender_hierarchy_check",
      sql`"payment_intent_tender_id" IS NULL OR "payment_intent_id" IS NOT NULL`,
    ),
  }),
);

/**
 * payment_transaction_line_allocations
 *
 * ELI5:
 * One row says "this exact payment transaction affected this exact order line
 * by this amount."
 *
 * Why this exists:
 * - this is the immutable line-level payment trail,
 * - answers "which line was paid/refunded by which transaction, when?" exactly,
 * - supports audit-grade dispute/refund/commission traceability.
 *
 * Design note:
 * `payment_transactions` stores money events.
 * This table stores how each money event is distributed across order lines.
 */
export const paymentTransactionLineAllocations = pgTable(
  "payment_transaction_line_allocations",
  {
    /** Stable primary key for one line-level transaction allocation row. */
    id: idWithTag("txn_line_alloc"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Immutable money event being allocated across lines. */
    paymentTransactionId: idRef("payment_transaction_id")
      .references(() => paymentTransactions.id)
      .notNull(),

    /** Parent payment intent context for deterministic lineage. */
    paymentIntentId: idRef("payment_intent_id")
      .references(() => paymentIntents.id)
      .notNull(),

    /** Optional tender leg context for split-tender traceability. */
    paymentIntentTenderId: idRef("payment_intent_tender_id").references(
      () => paymentIntentTenders.id,
    ),

    /** Booking-order root context for this line-level allocation. */
    bookingOrderId: idRef("booking_order_id")
      .references(() => bookingOrders.id)
      .notNull(),

    /** Exact booking line impacted by this money event. */
    bookingOrderLineId: idRef("booking_order_line_id")
      .references(() => bookingOrderLines.id)
      .notNull(),

    /**
     * Optional pointer to planned tender-line allocation.
     *
     * Use this when event-time allocation follows a pre-planned intent split.
     */
    paymentIntentLineAllocationId: idRef("payment_intent_line_allocation_id").references(
      () => paymentIntentLineAllocations.id,
    ),

    /**
     * Absolute allocated amount in minor units for this transaction/line pair.
     *
     * Direction (charge vs refund vs adjustment) is encoded by
     * `payment_transactions.type`; this value stays non-negative.
     */
    amountMinor: integer("amount_minor").notNull(),

    /**
     * Event-time timestamp copied for timeline reads.
     * Normally this equals `payment_transactions.occurred_at`.
     */
    occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),

    /** Optional idempotency key for allocation workers. */
    idempotencyKey: varchar("idempotency_key", { length: 200 }),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite unique key for tenant-safe references. */
    paymentTransactionLineAllocationsBizIdIdUnique: uniqueIndex(
      "payment_transaction_line_allocations_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** Optional dedupe protection for idempotent worker retries. */
    paymentTransactionLineAllocationsBizIdempotencyUnique: uniqueIndex(
      "payment_transaction_line_allocations_biz_idempotency_unique",
    )
      .on(table.bizId, table.idempotencyKey)
      .where(sql`"idempotency_key" IS NOT NULL`),

    /**
     * One transaction should map to one row per booking line.
     *
     * If a caller retries with a different split, they must compensate with a
     * new transaction event rather than duplicate rows for same line.
     */
    paymentTransactionLineAllocationsTxnLineUnique: uniqueIndex(
      "payment_transaction_line_allocations_txn_line_unique",
    ).on(table.paymentTransactionId, table.bookingOrderLineId),

    /** Common query path for one transaction detail view. */
    paymentTransactionLineAllocationsBizTxnIdx: index(
      "payment_transaction_line_allocations_biz_txn_idx",
    ).on(table.bizId, table.paymentTransactionId),

    /** Common statement path for one order line payment timeline. */
    paymentTransactionLineAllocationsBizOrderLineOccurredIdx: index(
      "payment_transaction_line_allocations_biz_order_line_occurred_idx",
    ).on(table.bizId, table.bookingOrderLineId, table.occurredAt),

    /** Tenant-safe FK to immutable transaction row. */
    paymentTransactionLineAllocationsBizTxnFk: foreignKey({
      columns: [table.bizId, table.paymentTransactionId],
      foreignColumns: [paymentTransactions.bizId, paymentTransactions.id],
      name: "payment_transaction_line_allocations_biz_txn_fk",
    }),

    /** Tenant-safe FK to payment intent. */
    paymentTransactionLineAllocationsBizIntentFk: foreignKey({
      columns: [table.bizId, table.paymentIntentId],
      foreignColumns: [paymentIntents.bizId, paymentIntents.id],
      name: "payment_transaction_line_allocations_biz_intent_fk",
    }),

    /**
     * Tenant-safe FK to tender + intent context.
     *
     * This enforces that if a tender is provided, it belongs to this intent.
     */
    paymentTransactionLineAllocationsBizTenderIntentFk: foreignKey({
      columns: [table.bizId, table.paymentIntentId, table.paymentIntentTenderId],
      foreignColumns: [
        paymentIntentTenders.bizId,
        paymentIntentTenders.paymentIntentId,
        paymentIntentTenders.id,
      ],
      name: "payment_transaction_line_allocations_biz_tender_intent_fk",
    }),

    /** Tenant-safe FK to booking order root. */
    paymentTransactionLineAllocationsBizOrderFk: foreignKey({
      columns: [table.bizId, table.bookingOrderId],
      foreignColumns: [bookingOrders.bizId, bookingOrders.id],
      name: "payment_transaction_line_allocations_biz_order_fk",
    }),

    /**
     * Tenant-safe FK to booking line with order linkage.
     *
     * This guarantees order-line consistency in every allocation row.
     */
    paymentTransactionLineAllocationsBizOrderLineFk: foreignKey({
      columns: [table.bizId, table.bookingOrderId, table.bookingOrderLineId],
      foreignColumns: [
        bookingOrderLines.bizId,
        bookingOrderLines.bookingOrderId,
        bookingOrderLines.id,
      ],
      name: "payment_transaction_line_allocations_biz_order_line_fk",
    }),

    /** Tenant-safe FK to optional planned tender-line allocation row. */
    paymentTransactionLineAllocationsBizIntentLineAllocFk: foreignKey({
      columns: [table.bizId, table.paymentIntentLineAllocationId],
      foreignColumns: [
        paymentIntentLineAllocations.bizId,
        paymentIntentLineAllocations.id,
      ],
      name: "payment_transaction_line_allocations_biz_intent_line_alloc_fk",
    }),

    /** Allocation amounts must be positive signal rows. */
    paymentTransactionLineAllocationsAmountCheck: check(
      "payment_transaction_line_allocations_amount_check",
      sql`"amount_minor" > 0`,
    ),

    /**
     * Optional hierarchy check:
     * if a planned allocation pointer exists, a tender should be present too.
     */
    paymentTransactionLineAllocationsPlanPointerShapeCheck: check(
      "payment_transaction_line_allocations_plan_pointer_shape_check",
      sql`"payment_intent_line_allocation_id" IS NULL OR "payment_intent_tender_id" IS NOT NULL`,
    ),
  }),
);

/**
 * payment_disputes
 *
 * ELI5:
 * Dispute records track chargeback/challenge workflows against transactions.
 */
export const paymentDisputes = pgTable(
  "payment_disputes",
  {
    /** Stable primary key. */
    id: idWithTag("payment_dispute"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Disputed transaction. */
    paymentTransactionId: idRef("payment_transaction_id")
      .references(() => paymentTransactions.id)
      .notNull(),

    /** Optional parent payment intent. */
    paymentIntentId: idRef("payment_intent_id").references(() => paymentIntents.id),

    /** Dispute lifecycle state. */
    status: paymentDisputeStatusEnum("status").default("needs_response").notNull(),

    /** Disputed amount in minor units. */
    amountMinor: integer("amount_minor").notNull(),

    /** Dispute currency. */
    currency: varchar("currency", { length: 3 }).default("USD").notNull(),

    /** Network-reported reason code. */
    reasonCode: varchar("reason_code", { length: 120 }),

    /** Provider dispute id for API sync. */
    providerDisputeRef: varchar("provider_dispute_ref", { length: 200 }),

    /** Dispute opening timestamp. */
    openedAt: timestamp("opened_at", { withTimezone: true }).defaultNow().notNull(),

    /** Response due timestamp. */
    responseDueAt: timestamp("response_due_at", { withTimezone: true }),

    /** Final resolution timestamp. */
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),

    /** Evidence payload submitted for challenge. */
    evidencePayload: jsonb("evidence_payload").default({}),

    /** Outcome payload snapshot from processor/network. */
    outcomePayload: jsonb("outcome_payload").default({}),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    paymentDisputesBizIdIdUnique: uniqueIndex("payment_disputes_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** One dispute record per provider dispute ref when available. */
    paymentDisputesProviderRefUnique: uniqueIndex(
      "payment_disputes_provider_ref_unique",
    )
      .on(table.bizId, table.providerDisputeRef)
      .where(sql`"provider_dispute_ref" IS NOT NULL`),

    /** Query path for active dispute ops. */
    paymentDisputesBizStatusDueIdx: index("payment_disputes_biz_status_due_idx").on(
      table.bizId,
      table.status,
      table.responseDueAt,
    ),

    /** Tenant-safe FK to transaction. */
    paymentDisputesBizTransactionFk: foreignKey({
      columns: [table.bizId, table.paymentTransactionId],
      foreignColumns: [paymentTransactions.bizId, paymentTransactions.id],
      name: "payment_disputes_biz_transaction_fk",
    }),

    /** Tenant-safe FK to payment intent. */
    paymentDisputesBizIntentFk: foreignKey({
      columns: [table.bizId, table.paymentIntentId],
      foreignColumns: [paymentIntents.bizId, paymentIntents.id],
      name: "payment_disputes_biz_intent_fk",
    }),

    /** Amount must be positive; resolved must not precede opened. */
    paymentDisputesAmountAndTimelineCheck: check(
      "payment_disputes_amount_and_timeline_check",
      sql`
      "amount_minor" > 0
      AND ("resolved_at" IS NULL OR "resolved_at" >= "opened_at")
      `,
    ),

    /** Currency should always be uppercase ISO-4217 format. */
    paymentDisputesCurrencyFormatCheck: check(
      "payment_disputes_currency_format_check",
      sql`"currency" ~ '^[A-Z]{3}$'`,
    ),
  }),
);

/**
 * settlement_batches
 *
 * ELI5:
 * A settlement batch groups payable/receivable transactions for a period.
 */
export const settlementBatches = pgTable(
  "settlement_batches",
  {
    /** Stable primary key. */
    id: idWithTag("settlement_batch"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Human batch label (e.g., "2026-W08 weekly settlement"). */
    name: varchar("name", { length: 220 }).notNull(),

    /** Batch status. */
    status: settlementBatchStatusEnum("status").default("open").notNull(),

    /** Optional processor account for settlement reconciliation scope. */
    paymentProcessorAccountId: idRef("payment_processor_account_id").references(
      () => paymentProcessorAccounts.id,
    ),

    /** Settlement currency. */
    currency: varchar("currency", { length: 3 }).default("USD").notNull(),

    /** Inclusive period start. */
    periodStartAt: timestamp("period_start_at", { withTimezone: true }).notNull(),

    /** Exclusive period end. */
    periodEndAt: timestamp("period_end_at", { withTimezone: true }).notNull(),

    /** Gross amount in minor units before fees. */
    grossMinor: integer("gross_minor").default(0).notNull(),

    /** Fee amount in minor units. */
    feesMinor: integer("fees_minor").default(0).notNull(),

    /** Net amount in minor units after fees. */
    netMinor: integer("net_minor").default(0).notNull(),

    /** Number of entries included. */
    entryCount: integer("entry_count").default(0).notNull(),

    /** Expected payout date. */
    payoutDueAt: timestamp("payout_due_at", { withTimezone: true }),

    /** Actual settlement paid timestamp. */
    paidAt: timestamp("paid_at", { withTimezone: true }),

    /** Optional provider batch id. */
    providerBatchRef: varchar("provider_batch_ref", { length: 200 }),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite unique key for tenant-safe settlement entry/payout FKs. */
    settlementBatchesBizIdIdUnique: uniqueIndex(
      "settlement_batches_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** Batch listing and reconciliation path. */
    settlementBatchesBizStatusPeriodIdx: index(
      "settlement_batches_biz_status_period_idx",
    ).on(table.bizId, table.status, table.periodStartAt),

    /** Processor-scoped settlement queue path. */
    settlementBatchesBizProcessorStatusPeriodIdx: index(
      "settlement_batches_biz_processor_status_period_idx",
    ).on(table.bizId, table.paymentProcessorAccountId, table.status, table.periodStartAt),

    /** Tenant-safe FK to processor account routing row. */
    settlementBatchesBizProcessorAccountFk: foreignKey({
      columns: [table.bizId, table.paymentProcessorAccountId],
      foreignColumns: [paymentProcessorAccounts.bizId, paymentProcessorAccounts.id],
      name: "settlement_batches_biz_processor_account_fk",
    }),

    /** Period and amounts must reconcile and be valid. */
    settlementBatchesCheck: check(
      "settlement_batches_check",
      sql`
      "period_end_at" > "period_start_at"
      AND "gross_minor" >= 0
      AND "fees_minor" >= 0
      AND "entry_count" >= 0
      AND "net_minor" = ("gross_minor" - "fees_minor")
      `,
    ),

    /** Currency should always be uppercase ISO-4217 format. */
    settlementBatchesCurrencyFormatCheck: check(
      "settlement_batches_currency_format_check",
      sql`"currency" ~ '^[A-Z]{3}$'`,
    ),
  }),
);

/**
 * settlement_entries
 *
 * ELI5:
 * Row-level lines included in one settlement batch.
 */
export const settlementEntries = pgTable(
  "settlement_entries",
  {
    /** Stable primary key. */
    id: idWithTag("settlement_entry"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent settlement batch. */
    settlementBatchId: idRef("settlement_batch_id")
      .references(() => settlementBatches.id)
      .notNull(),

    /** Optional source transaction included in this settlement line. */
    paymentTransactionId: idRef("payment_transaction_id").references(
      () => paymentTransactions.id,
    ),

    /** Optional booking-order context. */
    bookingOrderId: idRef("booking_order_id").references(() => bookingOrders.id),

    /** Optional cross-biz order context. */
    crossBizOrderId: idRef("cross_biz_order_id").references(() => crossBizOrders.id),

    /** Entry type semantics aligned to transaction taxonomy. */
    entryType: paymentTransactionTypeEnum("entry_type").notNull(),

    /** Entry amount in minor units; can be negative for adjustments. */
    amountMinor: integer("amount_minor").notNull(),

    /** Optional description for human reconciliation. */
    description: varchar("description", { length: 500 }),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    settlementEntriesBizIdIdUnique: uniqueIndex("settlement_entries_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Composite key for tenant-safe references to this settlement-entry row. */

    /** Query path for settlement statement generation. */
    settlementEntriesBizBatchIdx: index("settlement_entries_biz_batch_idx").on(
      table.bizId,
      table.settlementBatchId,
    ),

    /** Tenant-safe FK to batch. */
    settlementEntriesBizBatchFk: foreignKey({
      columns: [table.bizId, table.settlementBatchId],
      foreignColumns: [settlementBatches.bizId, settlementBatches.id],
      name: "settlement_entries_biz_batch_fk",
    }),

    /** Tenant-safe FK to transaction. */
    settlementEntriesBizTransactionFk: foreignKey({
      columns: [table.bizId, table.paymentTransactionId],
      foreignColumns: [paymentTransactions.bizId, paymentTransactions.id],
      name: "settlement_entries_biz_transaction_fk",
    }),

    /** Tenant-safe FK to booking order. */
    settlementEntriesBizBookingOrderFk: foreignKey({
      columns: [table.bizId, table.bookingOrderId],
      foreignColumns: [bookingOrders.bizId, bookingOrders.id],
      name: "settlement_entries_biz_booking_order_fk",
    }),

    /** Tenant-safe FK to cross-biz order. */
    settlementEntriesBizCrossBizOrderFk: foreignKey({
      columns: [table.bizId, table.crossBizOrderId],
      foreignColumns: [crossBizOrders.bizId, crossBizOrders.id],
      name: "settlement_entries_biz_cross_biz_order_fk",
    }),

    /** Each line should attach to at least one financial source context. */
    settlementEntriesContextCheck: check(
      "settlement_entries_context_check",
      sql`
      "payment_transaction_id" IS NOT NULL
      OR "booking_order_id" IS NOT NULL
      OR "cross_biz_order_id" IS NOT NULL
      `,
    ),

    /**
     * Keep settlement ledgers signal-only.
     *
     * Zero-value lines add noise, complicate reconciliation, and provide no
     * financial meaning.
     */
    settlementEntriesAmountNonZeroCheck: check(
      "settlement_entries_amount_non_zero_check",
      sql`"amount_minor" <> 0`,
    ),
  }),
);

/**
 * payouts
 *
 * ELI5:
 * Payout row tracks the transfer of settled funds to a destination account.
 */
export const payouts = pgTable(
  "payouts",
  {
    /** Stable primary key. */
    id: idWithTag("payout"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Optional source settlement batch. */
    settlementBatchId: idRef("settlement_batch_id").references(
      () => settlementBatches.id,
    ),

    /** Optional processor account route for payout rail selection. */
    paymentProcessorAccountId: idRef("payment_processor_account_id").references(
      () => paymentProcessorAccounts.id,
    ),

    /** Payout status lifecycle. */
    status: payoutStatusEnum("status").default("pending").notNull(),

    /** Payout currency. */
    currency: varchar("currency", { length: 3 }).default("USD").notNull(),

    /** Gross payout amount in minor units. */
    amountMinor: integer("amount_minor").notNull(),

    /** Destination provider/account reference. */
    destinationRef: varchar("destination_ref", { length: 200 }).notNull(),

    /** Provider payout id/reference. */
    providerPayoutRef: varchar("provider_payout_ref", { length: 200 }),

    /** Initiated timestamp. */
    initiatedAt: timestamp("initiated_at", { withTimezone: true }).defaultNow().notNull(),

    /** Expected arrival timestamp. */
    expectedArrivalAt: timestamp("expected_arrival_at", { withTimezone: true }),

    /** Paid/settled timestamp. */
    paidAt: timestamp("paid_at", { withTimezone: true }),

    /** Failure timestamp. */
    failedAt: timestamp("failed_at", { withTimezone: true }),

    /** Optional failure reason summary. */
    failureReason: varchar("failure_reason", { length: 400 }),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    payoutsBizIdIdUnique: uniqueIndex("payouts_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Composite unique key used by payout ledger entries. */

    /** Prevent duplicate provider payout refs in one tenant when set. */
    payoutsProviderRefUnique: uniqueIndex("payouts_provider_ref_unique")
      .on(table.bizId, table.providerPayoutRef)
      .where(sql`"provider_payout_ref" IS NOT NULL`),

    /** Common cash-ops monitoring path. */
    payoutsBizStatusInitiatedIdx: index("payouts_biz_status_initiated_idx").on(
      table.bizId,
      table.status,
      table.initiatedAt,
    ),

    /** Processor-scoped payout monitor path. */
    payoutsBizProcessorStatusInitiatedIdx: index(
      "payouts_biz_processor_status_initiated_idx",
    ).on(table.bizId, table.paymentProcessorAccountId, table.status, table.initiatedAt),

    /** Tenant-safe FK to settlement batch. */
    payoutsBizSettlementBatchFk: foreignKey({
      columns: [table.bizId, table.settlementBatchId],
      foreignColumns: [settlementBatches.bizId, settlementBatches.id],
      name: "payouts_biz_settlement_batch_fk",
    }),

    /** Tenant-safe FK to processor account routing row. */
    payoutsBizProcessorAccountFk: foreignKey({
      columns: [table.bizId, table.paymentProcessorAccountId],
      foreignColumns: [paymentProcessorAccounts.bizId, paymentProcessorAccounts.id],
      name: "payouts_biz_processor_account_fk",
    }),

    /** Amount must be positive; timeline ordering checks. */
    payoutsChecks: check(
      "payouts_checks",
      sql`
      "amount_minor" > 0
      AND ("paid_at" IS NULL OR "paid_at" >= "initiated_at")
      AND ("failed_at" IS NULL OR "failed_at" >= "initiated_at")
      `,
    ),

    /** Currency should always be uppercase ISO-4217 format. */
    payoutsCurrencyFormatCheck: check(
      "payouts_currency_format_check",
      sql`"currency" ~ '^[A-Z]{3}$'`,
    ),
  }),
);

/**
 * payout_ledger_entries
 *
 * ELI5:
 * Append-style accounting lines attached to payouts.
 */
export const payoutLedgerEntries = pgTable(
  "payout_ledger_entries",
  {
    /** Stable primary key. */
    id: idWithTag("payout_ledger"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent payout. */
    payoutId: idRef("payout_id")
      .references(() => payouts.id)
      .notNull(),

    /** Optional linked settlement entry. */
    settlementEntryId: idRef("settlement_entry_id").references(
      () => settlementEntries.id,
    ),

    /** Movement class (credit/debit/fee/adjustment). */
    entryType: payoutLedgerEntryTypeEnum("entry_type").notNull(),

    /** Amount in minor units (sign handled by entry type). */
    amountMinor: integer("amount_minor").notNull(),

    /** Optional human-readable reason/description. */
    description: varchar("description", { length: 500 }),

    /** Entry timestamp. */
    recordedAt: timestamp("recorded_at", { withTimezone: true }).defaultNow().notNull(),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    payoutLedgerEntriesBizIdIdUnique: uniqueIndex("payout_ledger_entries_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Query path for payout statement generation. */
    payoutLedgerEntriesBizPayoutRecordedIdx: index(
      "payout_ledger_entries_biz_payout_recorded_idx",
    ).on(table.bizId, table.payoutId, table.recordedAt),

    /** Tenant-safe FK to payout. */
    payoutLedgerEntriesBizPayoutFk: foreignKey({
      columns: [table.bizId, table.payoutId],
      foreignColumns: [payouts.bizId, payouts.id],
      name: "payout_ledger_entries_biz_payout_fk",
    }),

    /** Tenant-safe FK to settlement entry. */
    payoutLedgerEntriesBizSettlementEntryFk: foreignKey({
      columns: [table.bizId, table.settlementEntryId],
      foreignColumns: [settlementEntries.bizId, settlementEntries.id],
      name: "payout_ledger_entries_biz_settlement_entry_fk",
    }),

    /** Amount should be non-negative; type conveys accounting direction. */
    payoutLedgerEntriesAmountCheck: check(
      "payout_ledger_entries_amount_check",
      sql`"amount_minor" >= 0`,
    ),
  }),
);
