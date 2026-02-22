import { sql } from "drizzle-orm";
import { check, foreignKey, index, uniqueIndex } from "drizzle-orm/pg-core";
import { integer, jsonb, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";
import { idRef, idWithTag, withAuditRefs } from "./_common";
import { bizes } from "./bizes";
import { bookingOrderLines, bookingOrders } from "./fulfillment";
import {
  paymentIntents,
  paymentIntentTenders,
  paymentTransactions,
} from "./payments";
import { users } from "./users";
import { groupAccounts } from "./group_accounts";
import { sellables } from "./product_commerce";
import {
  giftExpirationReasonEnum,
  giftInstrumentSourceTypeEnum,
  giftInstrumentStatusEnum,
  giftLedgerEntryTypeEnum,
  giftRedemptionStatusEnum,
  giftTransferModeEnum,
  giftTransferStatusEnum,
} from "./enums";

/**
 * gift_instruments
 *
 * ELI5:
 * This is a reusable "stored value ticket" row (gift card/voucher/certificate).
 * It can later be redeemed against orders, transferred, or expire.
 */
export const giftInstruments = pgTable(
  "gift_instruments",
  {
    /** Stable primary key. */
    id: idWithTag("gift"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Human/shareable code shown to customer and support agents. */
    code: varchar("code", { length: 120 }).notNull(),

    /** Lifecycle state of this stored-value instrument. */
    status: giftInstrumentStatusEnum("status").default("draft").notNull(),

    /** Stored-value currency. */
    currency: varchar("currency", { length: 3 }).default("USD").notNull(),

    /** Initial value loaded when issued. */
    initialAmountMinor: integer("initial_amount_minor").notNull(),

    /** Remaining redeemable value. */
    remainingAmountMinor: integer("remaining_amount_minor").notNull(),

    /**
     * Optimistic-concurrency marker for balance mutation workflows.
     *
     * API pattern:
     * - read current `balance_version`
     * - write with `where balance_version = X`
     * - increment on success
     */
    balanceVersion: integer("balance_version").default(0).notNull(),

    /**
     * Issuance provenance class.
     * Helps explain whether the instrument came from purchase/promo/manual/etc.
     */
    sourceType: giftInstrumentSourceTypeEnum("source_type")
      .default("manual")
      .notNull(),

    /**
     * Optional parent instrument when this row is created by split transfer.
     *
     * Example:
     * - source gift has $100
     * - transfer $30 to recipient
     * - create child instrument with `source_gift_instrument_id` pointing to source
     */
    sourceGiftInstrumentId: idRef("source_gift_instrument_id"),

    /**
     * Optional sellable that issued this gift.
     * Usually a gift-card product sellable in checkout flows.
     */
    issuedFromSellableId: idRef("issued_from_sellable_id").references(() => sellables.id),

    /** Optional booking-order anchor for issuance provenance. */
    issuedFromBookingOrderId: idRef("issued_from_booking_order_id").references(
      () => bookingOrders.id,
    ),

    /** Optional booking-order-line anchor for issuance provenance. */
    issuedFromBookingOrderLineId: idRef("issued_from_booking_order_line_id").references(
      () => bookingOrderLines.id,
    ),

    /** Optional payment-intent anchor for issuance provenance. */
    issuedFromPaymentIntentId: idRef("issued_from_payment_intent_id").references(
      () => paymentIntents.id,
    ),

    /** Optional payment-intent-tender anchor for issuance provenance. */
    issuedFromPaymentIntentTenderId: idRef(
      "issued_from_payment_intent_tender_id",
    ).references(() => paymentIntentTenders.id),

    /** Optional payment-transaction anchor for issuance provenance. */
    issuedFromPaymentTransactionId: idRef("issued_from_payment_transaction_id").references(
      () => paymentTransactions.id,
    ),

    /** Optional current owner user identity. */
    ownerUserId: idRef("owner_user_id").references(() => users.id),

    /** Optional current owner group-account identity. */
    ownerGroupAccountId: idRef("owner_group_account_id").references(
      () => groupAccounts.id,
    ),

    /** Optional expiry timestamp. */
    expiresAt: timestamp("expires_at", { withTimezone: true }),

    /** Issuance timestamp. */
    issuedAt: timestamp("issued_at", { withTimezone: true }).defaultNow().notNull(),

    /** Optional activation timestamp. */
    activatedAt: timestamp("activated_at", { withTimezone: true }),

    /** Optional void timestamp for compliance/fraud reversal. */
    voidedAt: timestamp("voided_at", { withTimezone: true }),

    /** Extensible payload (issuer notes, channel metadata, etc.). */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    giftInstrumentsBizIdIdUnique: uniqueIndex("gift_instruments_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Composite unique key used by tenant-safe child FKs. */

    /** One code per tenant. */
    giftInstrumentsBizCodeUnique: uniqueIndex("gift_instruments_biz_code_unique").on(
      table.bizId,
      table.code,
    ),

    /** Operator list path by status/expiry. */
    giftInstrumentsBizStatusExpiryIdx: index("gift_instruments_biz_status_expiry_idx").on(
      table.bizId,
      table.status,
      table.expiresAt,
    ),

    /** Query path for issuance provenance and source classification. */
    giftInstrumentsBizSourceTypeIdx: index("gift_instruments_biz_source_type_idx").on(
      table.bizId,
      table.sourceType,
      table.issuedAt,
    ),

    /** Owner lookup path for customer wallets. */
    giftInstrumentsBizOwnerIdx: index("gift_instruments_biz_owner_idx").on(
      table.bizId,
      table.ownerUserId,
      table.ownerGroupAccountId,
    ),

    /** Common path to trace child gift instruments created from split transfer. */
    giftInstrumentsBizSourceGiftIdx: index("gift_instruments_biz_source_gift_idx").on(
      table.bizId,
      table.sourceGiftInstrumentId,
    ),

    /** Common issuance-provenance lookups by sellable source. */
    giftInstrumentsBizIssuedSellableIdx: index("gift_instruments_biz_issued_sellable_idx").on(
      table.bizId,
      table.issuedFromSellableId,
      table.issuedAt,
    ),

    /** Tenant-safe FK to parent gift instrument for split-transfer lineage. */
    giftInstrumentsBizSourceGiftFk: foreignKey({
      columns: [table.bizId, table.sourceGiftInstrumentId],
      foreignColumns: [table.bizId, table.id],
      name: "gift_instruments_biz_source_gift_fk",
    }),

    /** Tenant-safe FK to optional sellable issuance anchor. */
    giftInstrumentsBizIssuedSellableFk: foreignKey({
      columns: [table.bizId, table.issuedFromSellableId],
      foreignColumns: [sellables.bizId, sellables.id],
      name: "gift_instruments_biz_issued_sellable_fk",
    }),

    /** Tenant-safe FK to optional order issuance anchor. */
    giftInstrumentsBizIssuedOrderFk: foreignKey({
      columns: [table.bizId, table.issuedFromBookingOrderId],
      foreignColumns: [bookingOrders.bizId, bookingOrders.id],
      name: "gift_instruments_biz_issued_order_fk",
    }),

    /** Tenant-safe FK to optional order-line issuance anchor. */
    giftInstrumentsBizIssuedOrderLineFk: foreignKey({
      columns: [table.bizId, table.issuedFromBookingOrderLineId],
      foreignColumns: [bookingOrderLines.bizId, bookingOrderLines.id],
      name: "gift_instruments_biz_issued_order_line_fk",
    }),

    /** Tenant-safe FK to optional payment-intent issuance anchor. */
    giftInstrumentsBizIssuedPaymentIntentFk: foreignKey({
      columns: [table.bizId, table.issuedFromPaymentIntentId],
      foreignColumns: [paymentIntents.bizId, paymentIntents.id],
      name: "gift_instruments_biz_issued_payment_intent_fk",
    }),

    /** Tenant-safe FK to optional payment-intent-tender issuance anchor. */
    giftInstrumentsBizIssuedPaymentTenderFk: foreignKey({
      columns: [table.bizId, table.issuedFromPaymentIntentTenderId],
      foreignColumns: [paymentIntentTenders.bizId, paymentIntentTenders.id],
      name: "gift_instruments_biz_issued_payment_tender_fk",
    }),

    /** Tenant-safe FK to optional payment-transaction issuance anchor. */
    giftInstrumentsBizIssuedPaymentTransactionFk: foreignKey({
      columns: [table.bizId, table.issuedFromPaymentTransactionId],
      foreignColumns: [paymentTransactions.bizId, paymentTransactions.id],
      name: "gift_instruments_biz_issued_payment_transaction_fk",
    }),

    /** Exactly one owner pointer or none (unassigned inventory) is allowed. */
    giftInstrumentsOwnerShapeCheck: check(
      "gift_instruments_owner_shape_check",
      sql`
      (
        ("owner_user_id" IS NOT NULL)::int
        + ("owner_group_account_id" IS NOT NULL)::int
      ) <= 1
      `,
    ),

    /** Monetary/state/timeline integrity. */
    giftInstrumentsValueCheck: check(
      "gift_instruments_value_check",
      sql`
      "initial_amount_minor" >= 0
      AND "remaining_amount_minor" >= 0
      AND "remaining_amount_minor" <= "initial_amount_minor"
      AND "balance_version" >= 0
      AND ("expires_at" IS NULL OR "expires_at" >= "issued_at")
      AND ("activated_at" IS NULL OR "activated_at" >= "issued_at")
      `,
    ),

    /** Parent linkage is only valid for transfer-split sourced instruments. */
    giftInstrumentsSourceShapeCheck: check(
      "gift_instruments_source_shape_check",
      sql`
      (
        "source_type" = 'transfer_split'
        AND "source_gift_instrument_id" IS NOT NULL
      ) OR (
        "source_type" <> 'transfer_split'
        AND "source_gift_instrument_id" IS NULL
      )
      `,
    ),

    /** Prevent self-parent loops in split-transfer lineage. */
    giftInstrumentsSourceNoSelfCheck: check(
      "gift_instruments_source_no_self_check",
      sql`"source_gift_instrument_id" IS NULL OR "source_gift_instrument_id" <> "id"`,
    ),

    /** Order-line and tender issuance anchors imply their parent order/intent anchors. */
    giftInstrumentsIssuanceAnchorHierarchyCheck: check(
      "gift_instruments_issuance_anchor_hierarchy_check",
      sql`
      ("issued_from_booking_order_line_id" IS NULL OR "issued_from_booking_order_id" IS NOT NULL)
      AND ("issued_from_payment_intent_tender_id" IS NULL OR "issued_from_payment_intent_id" IS NOT NULL)
      `,
    ),

    /** Purchase-sourced instruments should carry at least one issuance anchor. */
    giftInstrumentsPurchaseSourceAnchorCheck: check(
      "gift_instruments_purchase_source_anchor_check",
      sql`
      "source_type" <> 'purchase'
      OR (
        "issued_from_sellable_id" IS NOT NULL
        OR "issued_from_booking_order_id" IS NOT NULL
        OR "issued_from_booking_order_line_id" IS NOT NULL
        OR "issued_from_payment_intent_id" IS NOT NULL
        OR "issued_from_payment_intent_tender_id" IS NOT NULL
        OR "issued_from_payment_transaction_id" IS NOT NULL
      )
      `,
    ),

    /** Currency should always use uppercase ISO-like code shape. */
    giftInstrumentsCurrencyFormatCheck: check(
      "gift_instruments_currency_format_check",
      sql`"currency" ~ '^[A-Z]{3}$'`,
    ),
  }),
);

/**
 * gift_redemptions
 *
 * ELI5:
 * One row says "this gift value was applied here at this time".
 * It is immutable-style financial history and should be reversed by new rows.
 */
export const giftRedemptions = pgTable(
  "gift_redemptions",
  {
    id: idWithTag("gift_redemption"),
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),
    giftInstrumentId: idRef("gift_instrument_id")
      .references(() => giftInstruments.id)
      .notNull(),

    /** Optional commercial context. */
    bookingOrderId: idRef("booking_order_id").references(() => bookingOrders.id),
    bookingOrderLineId: idRef("booking_order_line_id").references(
      () => bookingOrderLines.id,
    ),
    paymentIntentId: idRef("payment_intent_id").references(() => paymentIntents.id),
    /** Optional tender-leg anchor to reconcile exact split-tender gift usage. */
    paymentIntentTenderId: idRef("payment_intent_tender_id").references(
      () => paymentIntentTenders.id,
    ),
    /** Optional immutable money-event anchor for deep reconciliation. */
    paymentTransactionId: idRef("payment_transaction_id").references(
      () => paymentTransactions.id,
    ),

    status: giftRedemptionStatusEnum("status").default("applied").notNull(),
    amountMinor: integer("amount_minor").notNull(),
    currency: varchar("currency", { length: 3 }).default("USD").notNull(),
    redeemedAt: timestamp("redeemed_at", { withTimezone: true }).defaultNow().notNull(),
    reversedAt: timestamp("reversed_at", { withTimezone: true }),
    idempotencyKey: varchar("idempotency_key", { length: 200 }),
    metadata: jsonb("metadata").default({}),
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    giftRedemptionsBizIdIdUnique: uniqueIndex("gift_redemptions_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Composite key for tenant-safe references to this redemption row. */

    giftRedemptionsBizIdempotencyUnique: uniqueIndex(
      "gift_redemptions_biz_idempotency_unique",
    )
      .on(table.bizId, table.idempotencyKey)
      .where(sql`"idempotency_key" IS NOT NULL`),

    giftRedemptionsBizGiftRedeemedIdx: index("gift_redemptions_biz_gift_redeemed_idx").on(
      table.bizId,
      table.giftInstrumentId,
      table.redeemedAt,
    ),

    giftRedemptionsBizOrderRedeemedIdx: index("gift_redemptions_biz_order_redeemed_idx").on(
      table.bizId,
      table.bookingOrderId,
      table.redeemedAt,
    ),
    giftRedemptionsBizPaymentTenderRedeemedIdx: index(
      "gift_redemptions_biz_payment_tender_redeemed_idx",
    ).on(table.bizId, table.paymentIntentTenderId, table.redeemedAt),

    giftRedemptionsBizGiftFk: foreignKey({
      columns: [table.bizId, table.giftInstrumentId],
      foreignColumns: [giftInstruments.bizId, giftInstruments.id],
      name: "gift_redemptions_biz_gift_fk",
    }),

    giftRedemptionsBizOrderFk: foreignKey({
      columns: [table.bizId, table.bookingOrderId],
      foreignColumns: [bookingOrders.bizId, bookingOrders.id],
      name: "gift_redemptions_biz_order_fk",
    }),

    giftRedemptionsBizOrderLineFk: foreignKey({
      columns: [table.bizId, table.bookingOrderLineId],
      foreignColumns: [bookingOrderLines.bizId, bookingOrderLines.id],
      name: "gift_redemptions_biz_order_line_fk",
    }),

    giftRedemptionsBizPaymentIntentFk: foreignKey({
      columns: [table.bizId, table.paymentIntentId],
      foreignColumns: [paymentIntents.bizId, paymentIntents.id],
      name: "gift_redemptions_biz_payment_intent_fk",
    }),
    giftRedemptionsBizPaymentTenderFk: foreignKey({
      columns: [table.bizId, table.paymentIntentTenderId],
      foreignColumns: [paymentIntentTenders.bizId, paymentIntentTenders.id],
      name: "gift_redemptions_biz_payment_tender_fk",
    }),
    giftRedemptionsBizPaymentTransactionFk: foreignKey({
      columns: [table.bizId, table.paymentTransactionId],
      foreignColumns: [paymentTransactions.bizId, paymentTransactions.id],
      name: "gift_redemptions_biz_payment_transaction_fk",
    }),

    /** Every redemption must point to at least one commercial anchor. */
    giftRedemptionsAnchorCheck: check(
      "gift_redemptions_anchor_check",
      sql`
      "booking_order_id" IS NOT NULL
      OR "booking_order_line_id" IS NOT NULL
      OR "payment_intent_id" IS NOT NULL
      OR "payment_intent_tender_id" IS NOT NULL
      OR "payment_transaction_id" IS NOT NULL
      `,
    ),

    /** Monetary/timeline invariants. */
    giftRedemptionsAmountCheck: check(
      "gift_redemptions_amount_check",
      sql`
      "amount_minor" > 0
      AND ("reversed_at" IS NULL OR "reversed_at" >= "redeemed_at")
      `,
    ),

    /** Tender anchors must reference parent intent when present. */
    giftRedemptionsIntentHierarchyCheck: check(
      "gift_redemptions_intent_hierarchy_check",
      sql`"payment_intent_tender_id" IS NULL OR "payment_intent_id" IS NOT NULL`,
    ),

    /** Status/timestamp shape consistency for applied/reversed/failed rows. */
    giftRedemptionsStatusShapeCheck: check(
      "gift_redemptions_status_shape_check",
      sql`
      (
        "status" = 'applied'
        AND "reversed_at" IS NULL
      ) OR (
        "status" = 'reversed'
        AND "reversed_at" IS NOT NULL
      ) OR (
        "status" = 'failed'
        AND "reversed_at" IS NULL
      )
      `,
    ),

    giftRedemptionsCurrencyFormatCheck: check(
      "gift_redemptions_currency_format_check",
      sql`"currency" ~ '^[A-Z]{3}$'`,
    ),
  }),
);

/**
 * gift_transfers
 *
 * ELI5:
 * A transfer row moves remaining gift value from one owner to another.
 */
export const giftTransfers = pgTable(
  "gift_transfers",
  {
    id: idWithTag("gift_transfer"),
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),
    giftInstrumentId: idRef("gift_instrument_id")
      .references(() => giftInstruments.id)
      .notNull(),

    /**
     * Transfer behavior:
     * - full_transfer: reassign ownership on one existing instrument
     * - split_transfer: move amount into a separate target instrument
     */
    mode: giftTransferModeEnum("mode").default("full_transfer").notNull(),

    /** Optional target child instrument (required for split_transfer mode). */
    targetGiftInstrumentId: idRef("target_gift_instrument_id").references(
      () => giftInstruments.id,
    ),

    fromUserId: idRef("from_user_id").references(() => users.id),
    fromGroupAccountId: idRef("from_group_account_id").references(
      () => groupAccounts.id,
    ),
    toUserId: idRef("to_user_id").references(() => users.id),
    toGroupAccountId: idRef("to_group_account_id").references(
      () => groupAccounts.id,
    ),

    status: giftTransferStatusEnum("status").default("pending").notNull(),
    amountMinor: integer("amount_minor").notNull(),
    currency: varchar("currency", { length: 3 }).default("USD").notNull(),
    transferredAt: timestamp("transferred_at", { withTimezone: true }),
    metadata: jsonb("metadata").default({}),
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    giftTransfersBizIdIdUnique: uniqueIndex("gift_transfers_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Composite key for tenant-safe references to this transfer row. */

    giftTransfersBizGiftTransferredIdx: index("gift_transfers_biz_gift_transferred_idx").on(
      table.bizId,
      table.giftInstrumentId,
      table.transferredAt,
    ),
    giftTransfersBizTargetGiftTransferredIdx: index(
      "gift_transfers_biz_target_gift_transferred_idx",
    ).on(table.bizId, table.targetGiftInstrumentId, table.transferredAt),

    giftTransfersBizGiftFk: foreignKey({
      columns: [table.bizId, table.giftInstrumentId],
      foreignColumns: [giftInstruments.bizId, giftInstruments.id],
      name: "gift_transfers_biz_gift_fk",
    }),
    giftTransfersBizTargetGiftFk: foreignKey({
      columns: [table.bizId, table.targetGiftInstrumentId],
      foreignColumns: [giftInstruments.bizId, giftInstruments.id],
      name: "gift_transfers_biz_target_gift_fk",
    }),

    /** From-side must identify exactly one principal. */
    giftTransfersFromShapeCheck: check(
      "gift_transfers_from_shape_check",
      sql`
      (
        ("from_user_id" IS NOT NULL)::int
        + ("from_group_account_id" IS NOT NULL)::int
      ) = 1
      `,
    ),

    /** To-side must identify exactly one principal. */
    giftTransfersToShapeCheck: check(
      "gift_transfers_to_shape_check",
      sql`
      (
        ("to_user_id" IS NOT NULL)::int
        + ("to_group_account_id" IS NOT NULL)::int
      ) = 1
      `,
    ),

    /** Prevent no-op transfers to the same principal. */
    giftTransfersDistinctPartiesCheck: check(
      "gift_transfers_distinct_parties_check",
      sql`
      COALESCE("from_user_id", '') <> COALESCE("to_user_id", '')
      OR COALESCE("from_group_account_id", '') <> COALESCE("to_group_account_id", '')
      `,
    ),

    giftTransfersAmountCheck: check(
      "gift_transfers_amount_check",
      sql`"amount_minor" > 0`,
    ),

    /** Mode-specific payload shape: split transfers must point to target instrument. */
    giftTransfersModeShapeCheck: check(
      "gift_transfers_mode_shape_check",
      sql`
      (
        "mode" = 'full_transfer'
        AND "target_gift_instrument_id" IS NULL
      ) OR (
        "mode" = 'split_transfer'
        AND "target_gift_instrument_id" IS NOT NULL
      )
      `,
    ),

    /** Source and target instrument must differ when target is present. */
    giftTransfersDistinctInstrumentsCheck: check(
      "gift_transfers_distinct_instruments_check",
      sql`"target_gift_instrument_id" IS NULL OR "target_gift_instrument_id" <> "gift_instrument_id"`,
    ),

    /** Completed transfers should carry completion timestamp. */
    giftTransfersCompletionTimestampCheck: check(
      "gift_transfers_completion_timestamp_check",
      sql`"status" <> 'completed' OR "transferred_at" IS NOT NULL`,
    ),

    giftTransfersCurrencyFormatCheck: check(
      "gift_transfers_currency_format_check",
      sql`"currency" ~ '^[A-Z]{3}$'`,
    ),
  }),
);

/**
 * gift_expiration_events
 *
 * ELI5:
 * Explicit ledger of value that expired from an instrument.
 */
export const giftExpirationEvents = pgTable(
  "gift_expiration_events",
  {
    id: idWithTag("gift_expiry"),
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),
    giftInstrumentId: idRef("gift_instrument_id")
      .references(() => giftInstruments.id)
      .notNull(),
    reason: giftExpirationReasonEnum("reason").notNull(),
    amountMinor: integer("amount_minor").notNull(),
    currency: varchar("currency", { length: 3 }).default("USD").notNull(),
    expiredAt: timestamp("expired_at", { withTimezone: true }).defaultNow().notNull(),
    metadata: jsonb("metadata").default({}),
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite key for tenant-safe references to this expiration row. */
    giftExpirationEventsBizIdIdUnique: uniqueIndex(
      "gift_expiration_events_biz_id_id_unique",
    ).on(table.bizId, table.id),

    giftExpirationEventsBizGiftExpiredIdx: index(
      "gift_expiration_events_biz_gift_expired_idx",
    ).on(table.bizId, table.giftInstrumentId, table.expiredAt),

    giftExpirationEventsBizGiftFk: foreignKey({
      columns: [table.bizId, table.giftInstrumentId],
      foreignColumns: [giftInstruments.bizId, giftInstruments.id],
      name: "gift_expiration_events_biz_gift_fk",
    }),

    giftExpirationEventsAmountCheck: check(
      "gift_expiration_events_amount_check",
      sql`"amount_minor" > 0`,
    ),

    giftExpirationEventsCurrencyFormatCheck: check(
      "gift_expiration_events_currency_format_check",
      sql`"currency" ~ '^[A-Z]{3}$'`,
    ),
  }),
);

/**
 * gift_instrument_ledger_entries
 *
 * ELI5:
 * This is the immutable accounting trail for gift value.
 *
 * Why this exists:
 * - `gift_instruments.remaining_amount_minor` is the current balance snapshot.
 * - this table is the append-only event ledger explaining exactly *why* the
 *   balance changed over time (issue, redeem, transfer, expire, adjustments).
 * - finance/support tools should prefer this table for forensic reconciliation.
 */
export const giftInstrumentLedgerEntries = pgTable(
  "gift_instrument_ledger_entries",
  {
    /** Stable primary key for one gift-value movement event. */
    id: idWithTag("gift_ledger"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Instrument whose balance this entry modifies. */
    giftInstrumentId: idRef("gift_instrument_id")
      .references(() => giftInstruments.id)
      .notNull(),

    /** Ledger movement class. */
    entryType: giftLedgerEntryTypeEnum("entry_type").notNull(),

    /**
     * Signed amount delta in minor units.
     *
     * Convention:
     * - positive adds value,
     * - negative consumes value.
     */
    amountDeltaMinor: integer("amount_delta_minor").notNull(),

    /** Currency of this ledger amount. */
    currency: varchar("currency", { length: 3 }).default("USD").notNull(),

    /**
     * Snapshot balance after applying this entry.
     * Useful for fast historical statements and reconciliation debugging.
     */
    runningBalanceAfterMinor: integer("running_balance_after_minor").notNull(),

    /** Optional redemption source anchor. */
    giftRedemptionId: idRef("gift_redemption_id").references(() => giftRedemptions.id),

    /** Optional transfer source anchor. */
    giftTransferId: idRef("gift_transfer_id").references(() => giftTransfers.id),

    /** Optional expiration source anchor. */
    giftExpirationEventId: idRef("gift_expiration_event_id").references(
      () => giftExpirationEvents.id,
    ),

    /** Optional commercial anchors for reconciliation. */
    bookingOrderId: idRef("booking_order_id").references(() => bookingOrders.id),
    bookingOrderLineId: idRef("booking_order_line_id").references(
      () => bookingOrderLines.id,
    ),
    paymentIntentId: idRef("payment_intent_id").references(() => paymentIntents.id),
    paymentIntentTenderId: idRef("payment_intent_tender_id").references(
      () => paymentIntentTenders.id,
    ),
    paymentTransactionId: idRef("payment_transaction_id").references(
      () => paymentTransactions.id,
    ),

    /** Business timestamp for when this value movement occurred. */
    occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),

    /** Optional idempotency key for safe retries in async workers. */
    idempotencyKey: varchar("idempotency_key", { length: 200 }),

    /** Extension payload for source-specific details and diagnostics. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite unique key for tenant-safe external references. */
    giftInstrumentLedgerEntriesBizIdIdUnique: uniqueIndex(
      "gift_instrument_ledger_entries_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** Prevent duplicate idempotent writes when caller supplies idempotency key. */
    giftInstrumentLedgerEntriesBizIdempotencyUnique: uniqueIndex(
      "gift_instrument_ledger_entries_biz_idempotency_unique",
    )
      .on(table.bizId, table.idempotencyKey)
      .where(sql`"idempotency_key" IS NOT NULL`),

    /** Common statement path for one instrument timeline. */
    giftInstrumentLedgerEntriesBizGiftOccurredIdx: index(
      "gift_instrument_ledger_entries_biz_gift_occurred_idx",
    ).on(table.bizId, table.giftInstrumentId, table.occurredAt),

    /** Common audit path by movement type. */
    giftInstrumentLedgerEntriesBizTypeOccurredIdx: index(
      "gift_instrument_ledger_entries_biz_type_occurred_idx",
    ).on(table.bizId, table.entryType, table.occurredAt),

    /** Tenant-safe FK to gift instrument. */
    giftInstrumentLedgerEntriesBizGiftFk: foreignKey({
      columns: [table.bizId, table.giftInstrumentId],
      foreignColumns: [giftInstruments.bizId, giftInstruments.id],
      name: "gift_instrument_ledger_entries_biz_gift_fk",
    }),

    /** Tenant-safe FK to optional redemption source. */
    giftInstrumentLedgerEntriesBizRedemptionFk: foreignKey({
      columns: [table.bizId, table.giftRedemptionId],
      foreignColumns: [giftRedemptions.bizId, giftRedemptions.id],
      name: "gift_instrument_ledger_entries_biz_redemption_fk",
    }),

    /** Tenant-safe FK to optional transfer source. */
    giftInstrumentLedgerEntriesBizTransferFk: foreignKey({
      columns: [table.bizId, table.giftTransferId],
      foreignColumns: [giftTransfers.bizId, giftTransfers.id],
      name: "gift_instrument_ledger_entries_biz_transfer_fk",
    }),

    /** Tenant-safe FK to optional expiration source. */
    giftInstrumentLedgerEntriesBizExpirationEventFk: foreignKey({
      columns: [table.bizId, table.giftExpirationEventId],
      foreignColumns: [giftExpirationEvents.bizId, giftExpirationEvents.id],
      name: "gift_instrument_ledger_entries_biz_expiration_event_fk",
    }),

    /** Tenant-safe FK to optional booking-order anchor. */
    giftInstrumentLedgerEntriesBizOrderFk: foreignKey({
      columns: [table.bizId, table.bookingOrderId],
      foreignColumns: [bookingOrders.bizId, bookingOrders.id],
      name: "gift_instrument_ledger_entries_biz_order_fk",
    }),

    /** Tenant-safe FK to optional booking-order-line anchor. */
    giftInstrumentLedgerEntriesBizOrderLineFk: foreignKey({
      columns: [table.bizId, table.bookingOrderLineId],
      foreignColumns: [bookingOrderLines.bizId, bookingOrderLines.id],
      name: "gift_instrument_ledger_entries_biz_order_line_fk",
    }),

    /** Tenant-safe FK to optional payment-intent anchor. */
    giftInstrumentLedgerEntriesBizPaymentIntentFk: foreignKey({
      columns: [table.bizId, table.paymentIntentId],
      foreignColumns: [paymentIntents.bizId, paymentIntents.id],
      name: "gift_instrument_ledger_entries_biz_payment_intent_fk",
    }),

    /** Tenant-safe FK to optional payment-intent-tender anchor. */
    giftInstrumentLedgerEntriesBizPaymentTenderFk: foreignKey({
      columns: [table.bizId, table.paymentIntentTenderId],
      foreignColumns: [paymentIntentTenders.bizId, paymentIntentTenders.id],
      name: "gift_instrument_ledger_entries_biz_payment_tender_fk",
    }),

    /** Tenant-safe FK to optional payment-transaction anchor. */
    giftInstrumentLedgerEntriesBizPaymentTransactionFk: foreignKey({
      columns: [table.bizId, table.paymentTransactionId],
      foreignColumns: [paymentTransactions.bizId, paymentTransactions.id],
      name: "gift_instrument_ledger_entries_biz_payment_transaction_fk",
    }),

    /** Zero-value entries are forbidden in immutable value ledgers. */
    giftInstrumentLedgerEntriesAmountNonZeroCheck: check(
      "gift_instrument_ledger_entries_amount_non_zero_check",
      sql`"amount_delta_minor" <> 0`,
    ),

    /** Running balance snapshots must never be negative. */
    giftInstrumentLedgerEntriesRunningBalanceCheck: check(
      "gift_instrument_ledger_entries_running_balance_check",
      sql`"running_balance_after_minor" >= 0`,
    ),

    /** Currency should always be uppercase ISO-like code shape. */
    giftInstrumentLedgerEntriesCurrencyFormatCheck: check(
      "gift_instrument_ledger_entries_currency_format_check",
      sql`"currency" ~ '^[A-Z]{3}$'`,
    ),

    /**
     * Entry-type sign semantics.
     * This keeps ledger meaning deterministic for finance/reporting code.
     */
    giftInstrumentLedgerEntriesSignCheck: check(
      "gift_instrument_ledger_entries_sign_check",
      sql`
      (
        "entry_type" IN ('issuance', 'redemption_reversal', 'transfer_in')
        AND "amount_delta_minor" > 0
      ) OR (
        "entry_type" IN ('redemption', 'transfer_out', 'expiration')
        AND "amount_delta_minor" < 0
      ) OR (
        "entry_type" = 'void_adjustment'
        AND "amount_delta_minor" <= 0
      ) OR (
        "entry_type" = 'manual_adjustment'
        AND "amount_delta_minor" <> 0
      )
      `,
    ),

    /** Source anchor shape by entry type. */
    giftInstrumentLedgerEntriesAnchorShapeCheck: check(
      "gift_instrument_ledger_entries_anchor_shape_check",
      sql`
      (
        "entry_type" IN ('redemption', 'redemption_reversal')
        AND "gift_redemption_id" IS NOT NULL
      ) OR (
        "entry_type" IN ('transfer_out', 'transfer_in')
        AND "gift_transfer_id" IS NOT NULL
      ) OR (
        "entry_type" = 'expiration'
        AND "gift_expiration_event_id" IS NOT NULL
      ) OR (
        "entry_type" IN ('issuance', 'void_adjustment', 'manual_adjustment')
      )
      `,
    ),

    /** Hierarchy checks for optional anchor pairs. */
    giftInstrumentLedgerEntriesAnchorHierarchyCheck: check(
      "gift_instrument_ledger_entries_anchor_hierarchy_check",
      sql`
      ("booking_order_line_id" IS NULL OR "booking_order_id" IS NOT NULL)
      AND ("payment_intent_tender_id" IS NULL OR "payment_intent_id" IS NOT NULL)
      `,
    ),
  }),
);
