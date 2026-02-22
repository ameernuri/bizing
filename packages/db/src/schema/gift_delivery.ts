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
import { bizConfigValues } from "./biz_configs";
import { messageTemplates, outboundMessages } from "./communications";
import { giftInstruments } from "./gifts";
import { users } from "./users";

/**
 * gift_delivery_schedules
 *
 * ELI5:
 * One row says "send this gift to this recipient at this time".
 *
 * Why this table exists:
 * - gift instruments store value and ownership,
 * - this table stores delivery orchestration (channel, timing, message),
 * - retries and send outcomes are tracked in `gift_delivery_attempts`.
 */
export const giftDeliverySchedules = pgTable(
  "gift_delivery_schedules",
  {
    /** Stable primary key for one delivery schedule. */
    id: idWithTag("gift_delivery"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Gift instrument being delivered. */
    giftInstrumentId: idRef("gift_instrument_id")
      .references(() => giftInstruments.id)
      .notNull(),

    /**
     * Delivery lifecycle state.
     * `custom_*` allows provider/plugin-specific states.
     */
    status: varchar("status", { length: 40 }).default("scheduled").notNull(),
    /**
     * Optional configurable lifecycle pointer for gift-delivery status wording.
     *
     * Core engine behavior still keys off canonical `status`.
     */
    statusConfigValueId: idRef("status_config_value_id"),

    /** Recipient display name. */
    recipientName: varchar("recipient_name", { length: 220 }),

    /**
     * Delivery channel key.
     * Examples: email, sms, push, whatsapp, postal, in_app.
     */
    recipientChannel: varchar("recipient_channel", { length: 40 }).notNull(),

    /**
     * Channel destination.
     * Example: email address, phone number, push token, postal contact reference.
     */
    recipientAddress: varchar("recipient_address", { length: 500 }).notNull(),

    /** Optional locale hint for template rendering. */
    recipientLocale: varchar("recipient_locale", { length: 20 }),

    /** Timezone used for local-time schedule interpretation. */
    timezone: varchar("timezone", { length: 50 }).default("UTC").notNull(),

    /** Scheduled send timestamp. */
    sendAt: timestamp("send_at", { withTimezone: true }).notNull(),

    /** Optional minimum send timestamp guard. */
    notBeforeAt: timestamp("not_before_at", { withTimezone: true }),

    /** Optional deadline after which attempts should stop. */
    expiresAt: timestamp("expires_at", { withTimezone: true }),

    /** Optional subject/title text. */
    messageSubject: varchar("message_subject", { length: 300 }),

    /** Optional body text to include with gift. */
    messageBody: text("message_body"),

    /** Optional template used to render this delivery message. */
    messageTemplateId: idRef("message_template_id").references(
      () => messageTemplates.id,
    ),

    /** Optional outbound message row created when delivered. */
    outboundMessageId: idRef("outbound_message_id").references(
      () => outboundMessages.id,
    ),

    /** Attempt counter maintained by delivery worker. */
    attemptCount: integer("attempt_count").default(0).notNull(),

    /** Last attempt timestamp for this schedule. */
    lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }),

    /** Final sent timestamp when delivery succeeds. */
    sentAt: timestamp("sent_at", { withTimezone: true }),

    /** Cancellation timestamp if schedule is cancelled. */
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),

    /** Optional immutable delivery policy snapshot. */
    deliveryPolicy: jsonb("delivery_policy").default({}).notNull(),

    /** Extensible payload for channel/provider metadata. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite key for tenant-safe child references. */
    giftDeliverySchedulesBizIdIdUnique: uniqueIndex(
      "gift_delivery_schedules_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** Prevent duplicate schedule rows for same gift and exact send instant. */
    giftDeliverySchedulesGiftSendUnique: uniqueIndex(
      "gift_delivery_schedules_gift_send_unique",
    )
      .on(table.giftInstrumentId, table.sendAt)
      .where(sql`"deleted_at" IS NULL`),

    /** Delivery queue path. */
    giftDeliverySchedulesBizStatusSendIdx: index(
      "gift_delivery_schedules_biz_status_send_idx",
    ).on(table.bizId, table.status, table.sendAt),
    /** Configurable lifecycle queue path for operator dashboards. */
    giftDeliverySchedulesBizStatusConfigSendIdx: index(
      "gift_delivery_schedules_biz_status_config_send_idx",
    ).on(table.bizId, table.statusConfigValueId, table.sendAt),

    /** Gift timeline path. */
    giftDeliverySchedulesBizGiftSendIdx: index(
      "gift_delivery_schedules_biz_gift_send_idx",
    ).on(table.bizId, table.giftInstrumentId, table.sendAt),

    /** Tenant-safe FK to gift instrument. */
    giftDeliverySchedulesBizGiftFk: foreignKey({
      columns: [table.bizId, table.giftInstrumentId],
      foreignColumns: [giftInstruments.bizId, giftInstruments.id],
      name: "gift_delivery_schedules_biz_gift_fk",
    }),

    /** Tenant-safe FK to optional message template. */
    giftDeliverySchedulesBizTemplateFk: foreignKey({
      columns: [table.bizId, table.messageTemplateId],
      foreignColumns: [messageTemplates.bizId, messageTemplates.id],
      name: "gift_delivery_schedules_biz_template_fk",
    }),

    /** Tenant-safe FK to optional outbound message row. */
    giftDeliverySchedulesBizOutboundMessageFk: foreignKey({
      columns: [table.bizId, table.outboundMessageId],
      foreignColumns: [outboundMessages.bizId, outboundMessages.id],
      name: "gift_delivery_schedules_biz_outbound_message_fk",
    }),
    /** Tenant-safe FK to optional configured status dictionary value. */
    giftDeliverySchedulesBizStatusConfigFk: foreignKey({
      columns: [table.bizId, table.statusConfigValueId],
      foreignColumns: [bizConfigValues.bizId, bizConfigValues.id],
      name: "gift_delivery_schedules_biz_status_config_fk",
    }),

    /** Status vocabulary remains extensible. */
    giftDeliverySchedulesStatusCheck: check(
      "gift_delivery_schedules_status_check",
      sql`
      "status" IN ('scheduled', 'sending', 'sent', 'failed', 'cancelled', 'expired')
      OR "status" LIKE 'custom_%'
      `,
    ),

    /** Channel vocabulary remains extensible. */
    giftDeliverySchedulesChannelCheck: check(
      "gift_delivery_schedules_channel_check",
      sql`
      "recipient_channel" IN ('email', 'sms', 'push', 'whatsapp', 'in_app', 'postal')
      OR "recipient_channel" LIKE 'custom_%'
      `,
    ),

    /** Timeline/attempt sanity checks. */
    giftDeliverySchedulesBoundsCheck: check(
      "gift_delivery_schedules_bounds_check",
      sql`
      length("recipient_address") > 0
      AND "attempt_count" >= 0
      AND ("not_before_at" IS NULL OR "send_at" >= "not_before_at")
      AND ("expires_at" IS NULL OR "expires_at" > "send_at")
      AND ("last_attempt_at" IS NULL OR "last_attempt_at" >= "send_at" - INTERVAL '3650 days')
      AND ("sent_at" IS NULL OR "sent_at" >= "send_at" - INTERVAL '3650 days')
      `,
    ),

    /** Sent/cancelled statuses should carry matching timestamps. */
    giftDeliverySchedulesStatusShapeCheck: check(
      "gift_delivery_schedules_status_shape_check",
      sql`
      ("status" <> 'sent' OR "sent_at" IS NOT NULL)
      AND ("status" <> 'cancelled' OR "cancelled_at" IS NOT NULL)
      `,
    ),
  }),
);

/**
 * gift_delivery_attempts
 *
 * ELI5:
 * One row is one actual delivery attempt for a schedule.
 *
 * This gives retry-level traceability: every try, error, provider ref, and
 * success timestamp is retained.
 */
export const giftDeliveryAttempts = pgTable(
  "gift_delivery_attempts",
  {
    /** Stable primary key for one attempt row. */
    id: idWithTag("gift_delivery_attempt"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent delivery schedule. */
    giftDeliveryScheduleId: idRef("gift_delivery_schedule_id")
      .references(() => giftDeliverySchedules.id)
      .notNull(),

    /** Retry number in the schedule's attempt timeline. */
    attemptNo: integer("attempt_no").default(1).notNull(),

    /**
     * Attempt status.
     * `custom_*` supports integration-specific states.
     */
    status: varchar("status", { length: 40 }).default("queued").notNull(),
    /**
     * Optional configurable lifecycle pointer for attempt status wording.
     *
     * Canonical `status` remains the deterministic retry state machine code.
     */
    statusConfigValueId: idRef("status_config_value_id"),

    /** Delivery channel used by this attempt. */
    channel: varchar("channel", { length: 40 }).notNull(),

    /** Attempt start timestamp. */
    attemptedAt: timestamp("attempted_at", { withTimezone: true }).defaultNow().notNull(),

    /** Attempt completion timestamp. */
    completedAt: timestamp("completed_at", { withTimezone: true }),

    /** Optional provider key used for this send. */
    provider: varchar("provider", { length: 80 }),

    /** Optional provider-side message id for webhook reconciliation. */
    providerMessageRef: varchar("provider_message_ref", { length: 220 }),

    /** Optional outbound message linkage when routed through outbound pipeline. */
    outboundMessageId: idRef("outbound_message_id").references(
      () => outboundMessages.id,
    ),

    /** Optional compact failure code. */
    errorCode: varchar("error_code", { length: 120 }),

    /** Optional verbose failure detail. */
    errorMessage: text("error_message"),

    /** Extensible payload for raw provider responses. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite key for external references. */
    giftDeliveryAttemptsBizIdIdUnique: uniqueIndex(
      "gift_delivery_attempts_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** One attempt number per schedule. */
    giftDeliveryAttemptsScheduleAttemptUnique: uniqueIndex(
      "gift_delivery_attempts_schedule_attempt_unique",
    ).on(table.giftDeliveryScheduleId, table.attemptNo),

    /** Retry queue analytics path. */
    giftDeliveryAttemptsBizStatusAttemptedIdx: index(
      "gift_delivery_attempts_biz_status_attempted_idx",
    ).on(table.bizId, table.status, table.attemptedAt),
    /** Configurable lifecycle queue path for delivery-retry operations. */
    giftDeliveryAttemptsBizStatusConfigAttemptedIdx: index(
      "gift_delivery_attempts_biz_status_config_attempted_idx",
    ).on(table.bizId, table.statusConfigValueId, table.attemptedAt),

    /** Schedule timeline path. */
    giftDeliveryAttemptsBizScheduleAttemptedIdx: index(
      "gift_delivery_attempts_biz_schedule_attempted_idx",
    ).on(table.bizId, table.giftDeliveryScheduleId, table.attemptedAt),

    /** Tenant-safe FK to parent schedule. */
    giftDeliveryAttemptsBizScheduleFk: foreignKey({
      columns: [table.bizId, table.giftDeliveryScheduleId],
      foreignColumns: [giftDeliverySchedules.bizId, giftDeliverySchedules.id],
      name: "gift_delivery_attempts_biz_schedule_fk",
    }),

    /** Tenant-safe FK to optional outbound message. */
    giftDeliveryAttemptsBizOutboundMessageFk: foreignKey({
      columns: [table.bizId, table.outboundMessageId],
      foreignColumns: [outboundMessages.bizId, outboundMessages.id],
      name: "gift_delivery_attempts_biz_outbound_message_fk",
    }),
    /** Tenant-safe FK to optional configured status dictionary value. */
    giftDeliveryAttemptsBizStatusConfigFk: foreignKey({
      columns: [table.bizId, table.statusConfigValueId],
      foreignColumns: [bizConfigValues.bizId, bizConfigValues.id],
      name: "gift_delivery_attempts_biz_status_config_fk",
    }),

    /** Attempt status vocabulary remains extensible. */
    giftDeliveryAttemptsStatusCheck: check(
      "gift_delivery_attempts_status_check",
      sql`
      "status" IN ('queued', 'sending', 'sent', 'failed', 'skipped')
      OR "status" LIKE 'custom_%'
      `,
    ),

    /** Channel vocabulary remains extensible. */
    giftDeliveryAttemptsChannelCheck: check(
      "gift_delivery_attempts_channel_check",
      sql`
      "channel" IN ('email', 'sms', 'push', 'whatsapp', 'in_app', 'postal')
      OR "channel" LIKE 'custom_%'
      `,
    ),

    /** Basic attempt timeline bounds. */
    giftDeliveryAttemptsBoundsCheck: check(
      "gift_delivery_attempts_bounds_check",
      sql`
      "attempt_no" >= 1
      AND ("completed_at" IS NULL OR "completed_at" >= "attempted_at")
      `,
    ),

    /** Sent attempts should include completion evidence. */
    giftDeliveryAttemptsSentShapeCheck: check(
      "gift_delivery_attempts_sent_shape_check",
      sql`
      "status" <> 'sent'
      OR (
        "completed_at" IS NOT NULL
        AND (
          "provider_message_ref" IS NOT NULL
          OR "outbound_message_id" IS NOT NULL
        )
      )
      `,
    ),
  }),
);

export type GiftDeliverySchedule = typeof giftDeliverySchedules.$inferSelect;
export type NewGiftDeliverySchedule = typeof giftDeliverySchedules.$inferInsert;

export type GiftDeliveryAttempt = typeof giftDeliveryAttempts.$inferSelect;
export type NewGiftDeliveryAttempt = typeof giftDeliveryAttempts.$inferInsert;
