import { sql } from "drizzle-orm";
import { check, foreignKey, index, uniqueIndex } from "drizzle-orm/pg-core";
import { integer, jsonb, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";
import { idRef, idWithTag, withAuditRefs } from "./_common";
import { bizes } from "./bizes";
import { bookingOrderLines, bookingOrders } from "./fulfillment";
import { groupAccounts } from "./group_accounts";
import {
  participantObligationEventTypeEnum,
  participantObligationStatusEnum,
  participantObligationTypeEnum,
} from "./enums";
import { users } from "./users";

/**
 * booking_participant_obligations
 *
 * ELI5:
 * This table assigns "what this participant still owes/done" for a booking.
 * It supports split payment and non-payment obligations in one generic model.
 */
export const bookingParticipantObligations = pgTable(
  "booking_participant_obligations",
  {
    id: idWithTag("participant_obligation"),
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    bookingOrderId: idRef("booking_order_id")
      .references(() => bookingOrders.id)
      .notNull(),
    bookingOrderLineId: idRef("booking_order_line_id").references(
      () => bookingOrderLines.id,
    ),

    /** Participant identity (user or group account). */
    participantUserId: idRef("participant_user_id").references(() => users.id),
    participantGroupAccountId: idRef("participant_group_account_id").references(
      () => groupAccounts.id,
    ),

    obligationType: participantObligationTypeEnum("obligation_type").notNull(),
    status: participantObligationStatusEnum("status").default("pending").notNull(),

    /** Monetary fields are used mainly for payment-contribution obligations. */
    amountDueMinor: integer("amount_due_minor"),
    amountSatisfiedMinor: integer("amount_satisfied_minor").default(0).notNull(),
    currency: varchar("currency", { length: 3 }).default("USD").notNull(),

    dueAt: timestamp("due_at", { withTimezone: true }),
    satisfiedAt: timestamp("satisfied_at", { withTimezone: true }),
    statusReason: varchar("status_reason", { length: 400 }),
    metadata: jsonb("metadata").default({}),
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    bookingParticipantObligationsBizIdIdUnique: uniqueIndex(
      "booking_participant_obligations_biz_id_id_unique",
    ).on(table.bizId, table.id),

    bookingParticipantObligationsBizOrderStatusDueIdx: index(
      "booking_participant_obligations_biz_order_status_due_idx",
    ).on(table.bizId, table.bookingOrderId, table.status, table.dueAt),

    bookingParticipantObligationsBizParticipantStatusIdx: index(
      "booking_participant_obligations_biz_participant_status_idx",
    ).on(
      table.bizId,
      table.participantUserId,
      table.participantGroupAccountId,
      table.status,
    ),

    bookingParticipantObligationsBizOrderFk: foreignKey({
      columns: [table.bizId, table.bookingOrderId],
      foreignColumns: [bookingOrders.bizId, bookingOrders.id],
      name: "booking_participant_obligations_biz_order_fk",
    }),

    bookingParticipantObligationsBizOrderLineFk: foreignKey({
      columns: [table.bizId, table.bookingOrderLineId],
      foreignColumns: [bookingOrderLines.bizId, bookingOrderLines.id],
      name: "booking_participant_obligations_biz_order_line_fk",
    }),

    /** Exactly one participant identity is required. */
    bookingParticipantObligationsParticipantShapeCheck: check(
      "booking_participant_obligations_participant_shape_check",
      sql`
      (
        ("participant_user_id" IS NOT NULL)::int
        + ("participant_group_account_id" IS NOT NULL)::int
      ) = 1
      `,
    ),

    /** Monetary invariants for partial/full satisfaction. */
    bookingParticipantObligationsAmountsCheck: check(
      "booking_participant_obligations_amounts_check",
      sql`
      ("amount_due_minor" IS NULL OR "amount_due_minor" >= 0)
      AND "amount_satisfied_minor" >= 0
      AND (
        "amount_due_minor" IS NULL
        OR "amount_satisfied_minor" <= "amount_due_minor"
      )
      `,
    ),

    /**
     * Payment contribution obligations require explicit due amount.
     * Non-payment obligations should not carry monetary due amount.
     */
    bookingParticipantObligationsTypeAmountShapeCheck: check(
      "booking_participant_obligations_type_amount_shape_check",
      sql`
      (
        "obligation_type" = 'payment_contribution'
        AND "amount_due_minor" IS NOT NULL
      ) OR (
        "obligation_type" <> 'payment_contribution'
        AND "amount_due_minor" IS NULL
      )
      `,
    ),

    bookingParticipantObligationsCurrencyFormatCheck: check(
      "booking_participant_obligations_currency_format_check",
      sql`"currency" ~ '^[A-Z]{3}$'`,
    ),
  }),
);

/**
 * participant_obligation_events
 *
 * ELI5:
 * Timeline log for obligation changes. This is the auditable event trail.
 */
export const participantObligationEvents = pgTable(
  "participant_obligation_events",
  {
    id: idWithTag("participant_obligation_event"),
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),
    bookingParticipantObligationId: idRef("booking_participant_obligation_id")
      .references(() => bookingParticipantObligations.id)
      .notNull(),
    eventType: participantObligationEventTypeEnum("event_type").notNull(),
    deltaAmountMinor: integer("delta_amount_minor"),
    happenedAt: timestamp("happened_at", { withTimezone: true }).defaultNow().notNull(),
    actorUserId: idRef("actor_user_id").references(() => users.id),
    note: varchar("note", { length: 1000 }),
    metadata: jsonb("metadata").default({}),
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    participantObligationEventsBizIdIdUnique: uniqueIndex("participant_obligation_events_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    participantObligationEventsBizObligationHappenedIdx: index(
      "participant_obligation_events_biz_obligation_happened_idx",
    ).on(table.bizId, table.bookingParticipantObligationId, table.happenedAt),

    participantObligationEventsBizObligationFk: foreignKey({
      columns: [table.bizId, table.bookingParticipantObligationId],
      foreignColumns: [bookingParticipantObligations.bizId, bookingParticipantObligations.id],
      name: "participant_obligation_events_biz_obligation_fk",
    }),
  }),
);
