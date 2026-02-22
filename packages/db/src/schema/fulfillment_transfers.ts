import { sql } from "drizzle-orm";
import { check, foreignKey, index, uniqueIndex } from "drizzle-orm/pg-core";
import {
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { idRef, idWithTag, withAuditRefs } from "./_common";
import { bizes } from "./bizes";
import { bookingOrderLines, bookingOrders, fulfillmentUnits } from "./fulfillment";
import { groupAccounts } from "./group_accounts";
import { paymentTransactions } from "./payments";
import { subjects } from "./subjects";
import { users } from "./users";

/**
 * fulfillment_transfer_requests
 *
 * ELI5:
 * This is the transfer "contract row" between a current owner and a target owner.
 *
 * Why this is generic:
 * - supports transfer of whole booking order, one booking line, one fulfillment
 *   unit, or any custom subject,
 * - same primitive can later be reused for passes, reservations, and custom
 *   plugin-owned fulfillments.
 *
 * Design note:
 * - `source_subject_*` is the canonical anchor for extensibility.
 * - booking/order/unit pointers are optional hot-path accelerators.
 */
export const fulfillmentTransferRequests = pgTable(
  "fulfillment_transfer_requests",
  {
    /** Stable primary key for one transfer request. */
    id: idWithTag("fulfillment_transfer"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Canonical source anchor namespace. */
    sourceSubjectType: varchar("source_subject_type", { length: 80 }).notNull(),

    /** Canonical source anchor id. */
    sourceSubjectId: varchar("source_subject_id", { length: 140 }).notNull(),

    /** Optional booking order hot-path pointer. */
    bookingOrderId: idRef("booking_order_id").references(() => bookingOrders.id),

    /** Optional booking order line hot-path pointer. */
    bookingOrderLineId: idRef("booking_order_line_id").references(
      () => bookingOrderLines.id,
    ),

    /** Optional fulfillment unit hot-path pointer. */
    fulfillmentUnitId: idRef("fulfillment_unit_id").references(
      () => fulfillmentUnits.id,
    ),

    /** Current owner pointer: user. */
    fromUserId: idRef("from_user_id").references(() => users.id),

    /** Current owner pointer: group account. */
    fromGroupAccountId: idRef("from_group_account_id").references(() => groupAccounts.id),

    /** Current owner pointer: custom subject namespace. */
    fromSubjectType: varchar("from_subject_type", { length: 80 }),

    /** Current owner pointer: custom subject id. */
    fromSubjectId: varchar("from_subject_id", { length: 140 }),

    /** Target owner pointer: user. */
    toUserId: idRef("to_user_id").references(() => users.id),

    /** Target owner pointer: group account. */
    toGroupAccountId: idRef("to_group_account_id").references(() => groupAccounts.id),

    /** Target owner pointer: custom subject namespace. */
    toSubjectType: varchar("to_subject_type", { length: 80 }),

    /** Target owner pointer: custom subject id. */
    toSubjectId: varchar("to_subject_id", { length: 140 }),

    /**
     * Transfer lifecycle state.
     *
     * Keep as varchar + check to allow `custom_%` extensions later.
     */
    transferState: varchar("transfer_state", { length: 40 })
      .default("pending")
      .notNull(),

    /** Transfer policy mode label (manual, auto_accept, approval_required, etc.). */
    transferMode: varchar("transfer_mode", { length: 60 })
      .default("approval_required")
      .notNull(),

    /** Optional transfer fee in minor units. */
    feeAmountMinor: integer("fee_amount_minor").default(0).notNull(),

    /** Currency for transfer fee. */
    currency: varchar("currency", { length: 3 }).default("USD").notNull(),

    /** Optional payment transaction used to settle transfer fee. */
    paymentTransactionId: idRef("payment_transaction_id").references(
      () => paymentTransactions.id,
    ),

    /** Request creation time. */
    requestedAt: timestamp("requested_at", { withTimezone: true }).defaultNow().notNull(),

    /** Optional acceptance/decision deadline. */
    expiresAt: timestamp("expires_at", { withTimezone: true }),

    /** Optional decision timestamp. */
    decidedAt: timestamp("decided_at", { withTimezone: true }),

    /** Optional completion timestamp after ownership handoff. */
    completedAt: timestamp("completed_at", { withTimezone: true }),

    /** Request initiator. */
    requestedByUserId: idRef("requested_by_user_id")
      .references(() => users.id)
      .notNull(),

    /** Optional user who made final decision. */
    decidedByUserId: idRef("decided_by_user_id").references(() => users.id),

    /** Optional reason note for manual support decisions. */
    reasonNote: text("reason_note"),

    /** Immutable policy snapshot used to evaluate this transfer. */
    policySnapshot: jsonb("policy_snapshot").default({}).notNull(),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite key for tenant-safe event child rows. */
    fulfillmentTransferRequestsBizIdIdUnique: uniqueIndex(
      "fulfillment_transfer_requests_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** Common transfer queue path by state and expiry. */
    fulfillmentTransferRequestsBizStateExpiryIdx: index(
      "fulfillment_transfer_requests_biz_state_expiry_idx",
    ).on(table.bizId, table.transferState, table.expiresAt),

    /** Source-owner operational lookup path. */
    fulfillmentTransferRequestsBizFromUserStateIdx: index(
      "fulfillment_transfer_requests_biz_from_user_state_idx",
    ).on(table.bizId, table.fromUserId, table.transferState, table.requestedAt),

    /** Target-owner operational lookup path. */
    fulfillmentTransferRequestsBizToUserStateIdx: index(
      "fulfillment_transfer_requests_biz_to_user_state_idx",
    ).on(table.bizId, table.toUserId, table.transferState, table.requestedAt),

    /**
     * One active pending transfer request per source subject.
     * This prevents duplicate parallel requests on the same source anchor.
     */
    fulfillmentTransferRequestsActiveSourceUnique: uniqueIndex(
      "fulfillment_transfer_requests_active_source_unique",
    )
      .on(table.bizId, table.sourceSubjectType, table.sourceSubjectId)
      .where(sql`"transfer_state" = 'pending' AND "deleted_at" IS NULL`),

    /** Tenant-safe FK to source subject anchor. */
    fulfillmentTransferRequestsBizSourceSubjectFk: foreignKey({
      columns: [table.bizId, table.sourceSubjectType, table.sourceSubjectId],
      foreignColumns: [subjects.bizId, subjects.subjectType, subjects.subjectId],
      name: "fulfillment_transfer_requests_biz_source_subject_fk",
    }),

    /** Tenant-safe FK to optional booking order pointer. */
    fulfillmentTransferRequestsBizBookingOrderFk: foreignKey({
      columns: [table.bizId, table.bookingOrderId],
      foreignColumns: [bookingOrders.bizId, bookingOrders.id],
      name: "fulfillment_transfer_requests_biz_booking_order_fk",
    }),

    /** Tenant-safe FK to optional booking line pointer. */
    fulfillmentTransferRequestsBizBookingOrderLineFk: foreignKey({
      columns: [table.bizId, table.bookingOrderLineId],
      foreignColumns: [bookingOrderLines.bizId, bookingOrderLines.id],
      name: "fulfillment_transfer_requests_biz_booking_order_line_fk",
    }),

    /** Tenant-safe FK to optional fulfillment unit pointer. */
    fulfillmentTransferRequestsBizFulfillmentUnitFk: foreignKey({
      columns: [table.bizId, table.fulfillmentUnitId],
      foreignColumns: [fulfillmentUnits.bizId, fulfillmentUnits.id],
      name: "fulfillment_transfer_requests_biz_fulfillment_unit_fk",
    }),

    /** Tenant-safe FK to optional fee transaction pointer. */
    fulfillmentTransferRequestsBizPaymentTransactionFk: foreignKey({
      columns: [table.bizId, table.paymentTransactionId],
      foreignColumns: [paymentTransactions.bizId, paymentTransactions.id],
      name: "fulfillment_transfer_requests_biz_payment_transaction_fk",
    }),
    /** Tenant-safe FK for from-group owner pointer. */
    fulfillmentTransferRequestsBizFromGroupAccountFk: foreignKey({
      columns: [table.bizId, table.fromGroupAccountId],
      foreignColumns: [groupAccounts.bizId, groupAccounts.id],
      name: "fulfillment_transfer_requests_biz_from_group_account_fk",
    }),
    /** Tenant-safe FK for to-group owner pointer. */
    fulfillmentTransferRequestsBizToGroupAccountFk: foreignKey({
      columns: [table.bizId, table.toGroupAccountId],
      foreignColumns: [groupAccounts.bizId, groupAccounts.id],
      name: "fulfillment_transfer_requests_biz_to_group_account_fk",
    }),

    /** Tenant-safe FK for from-subject owner pointer. */
    fulfillmentTransferRequestsBizFromSubjectFk: foreignKey({
      columns: [table.bizId, table.fromSubjectType, table.fromSubjectId],
      foreignColumns: [subjects.bizId, subjects.subjectType, subjects.subjectId],
      name: "fulfillment_transfer_requests_biz_from_subject_fk",
    }),

    /** Tenant-safe FK for to-subject owner pointer. */
    fulfillmentTransferRequestsBizToSubjectFk: foreignKey({
      columns: [table.bizId, table.toSubjectType, table.toSubjectId],
      foreignColumns: [subjects.bizId, subjects.subjectType, subjects.subjectId],
      name: "fulfillment_transfer_requests_biz_to_subject_fk",
    }),

    /** From-subject pointer should be fully null or fully set. */
    fulfillmentTransferRequestsFromSubjectPairCheck: check(
      "fulfillment_transfer_requests_from_subject_pair_check",
      sql`
      (
        "from_subject_type" IS NULL
        AND "from_subject_id" IS NULL
      ) OR (
        "from_subject_type" IS NOT NULL
        AND "from_subject_id" IS NOT NULL
      )
      `,
    ),

    /** To-subject pointer should be fully null or fully set. */
    fulfillmentTransferRequestsToSubjectPairCheck: check(
      "fulfillment_transfer_requests_to_subject_pair_check",
      sql`
      (
        "to_subject_type" IS NULL
        AND "to_subject_id" IS NULL
      ) OR (
        "to_subject_type" IS NOT NULL
        AND "to_subject_id" IS NOT NULL
      )
      `,
    ),

    /** Exactly one source-owner pointer and one target-owner pointer are required. */
    fulfillmentTransferRequestsOwnerShapeCheck: check(
      "fulfillment_transfer_requests_owner_shape_check",
      sql`
      (
        ("from_user_id" IS NOT NULL)::int
        + ("from_group_account_id" IS NOT NULL)::int
        + ("from_subject_type" IS NOT NULL)::int
      ) = 1
      AND (
        ("to_user_id" IS NOT NULL)::int
        + ("to_group_account_id" IS NOT NULL)::int
        + ("to_subject_type" IS NOT NULL)::int
      ) = 1
      `,
    ),

    /** At least one hot-path pointer should exist for ops/reporting ergonomics. */
    fulfillmentTransferRequestsHotPathAnchorCheck: check(
      "fulfillment_transfer_requests_hot_path_anchor_check",
      sql`
      (
        ("booking_order_id" IS NOT NULL)::int
        + ("booking_order_line_id" IS NOT NULL)::int
        + ("fulfillment_unit_id" IS NOT NULL)::int
      ) >= 1
      `,
    ),

    /** Transfer state vocabulary guard with extension escape hatch. */
    fulfillmentTransferRequestsStateCheck: check(
      "fulfillment_transfer_requests_state_check",
      sql`
      "transfer_state" IN ('pending', 'accepted', 'rejected', 'expired', 'cancelled', 'completed')
      OR "transfer_state" LIKE 'custom_%'
      `,
    ),

    /** Transfer mode vocabulary guard with extension escape hatch. */
    fulfillmentTransferRequestsModeCheck: check(
      "fulfillment_transfer_requests_mode_check",
      sql`
      "transfer_mode" IN ('auto_accept', 'approval_required', 'manual')
      OR "transfer_mode" LIKE 'custom_%'
      `,
    ),

    /** Transfer fee/currency and timeline checks. */
    fulfillmentTransferRequestsMoneyTimelineCheck: check(
      "fulfillment_transfer_requests_money_timeline_check",
      sql`
      "fee_amount_minor" >= 0
      AND "currency" ~ '^[A-Z]{3}$'
      AND ("expires_at" IS NULL OR "expires_at" > "requested_at")
      AND ("decided_at" IS NULL OR "decided_at" >= "requested_at")
      AND ("completed_at" IS NULL OR "decided_at" IS NULL OR "completed_at" >= "decided_at")
      `,
    ),
  }),
);

/**
 * fulfillment_transfer_events
 *
 * ELI5:
 * Append-only timeline for transfer request lifecycle changes.
 *
 * Why this exists:
 * - keeps one immutable history of who did what and when,
 * - supports support/debug/audit without diffing mutable request rows.
 */
export const fulfillmentTransferEvents = pgTable(
  "fulfillment_transfer_events",
  {
    /** Stable primary key for one transfer timeline event. */
    id: idWithTag("fulfillment_transfer_event"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent transfer request. */
    fulfillmentTransferRequestId: idRef("fulfillment_transfer_request_id")
      .references(() => fulfillmentTransferRequests.id)
      .notNull(),

    /** Event type classification (`requested`, `accepted`, `rejected`, etc.). */
    eventType: varchar("event_type", { length: 60 }).notNull(),

    /** Event timestamp. */
    eventAt: timestamp("event_at", { withTimezone: true }).defaultNow().notNull(),

    /** Optional actor user pointer. */
    actorUserId: idRef("actor_user_id").references(() => users.id),

    /** Structured event payload (reason codes, policy output, etc.). */
    payload: jsonb("payload").default({}).notNull(),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    fulfillmentTransferEventsBizIdIdUnique: uniqueIndex("fulfillment_transfer_events_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Timeline query path for one request. */
    fulfillmentTransferEventsBizRequestEventAtIdx: index(
      "fulfillment_transfer_events_biz_request_event_at_idx",
    ).on(table.bizId, table.fulfillmentTransferRequestId, table.eventAt),

    /** Tenant-safe FK to parent request. */
    fulfillmentTransferEventsBizRequestFk: foreignKey({
      columns: [table.bizId, table.fulfillmentTransferRequestId],
      foreignColumns: [fulfillmentTransferRequests.bizId, fulfillmentTransferRequests.id],
      name: "fulfillment_transfer_events_biz_request_fk",
    }),

    /** Event type vocabulary guard with extension escape hatch. */
    fulfillmentTransferEventsTypeCheck: check(
      "fulfillment_transfer_events_type_check",
      sql`
      "event_type" IN ('requested', 'accepted', 'rejected', 'expired', 'cancelled', 'completed', 'fee_captured', 'ownership_switched')
      OR "event_type" LIKE 'custom_%'
      `,
    ),
  }),
);

export type FulfillmentTransferRequest = typeof fulfillmentTransferRequests.$inferSelect;
export type NewFulfillmentTransferRequest = typeof fulfillmentTransferRequests.$inferInsert;
export type FulfillmentTransferEvent = typeof fulfillmentTransferEvents.$inferSelect;
export type NewFulfillmentTransferEvent = typeof fulfillmentTransferEvents.$inferInsert;
