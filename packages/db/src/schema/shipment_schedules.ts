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
import { memberships } from "./entitlements";
import { bookingOrders } from "./fulfillment";
import { groupAccounts } from "./group_accounts";
import { lifecycleStatusEnum } from "./enums";
import {
  inventoryLocations,
  physicalFulfillments,
  sellables,
} from "./product_commerce";
import { subjects } from "./subjects";
import { users } from "./users";

/**
 * shipment_schedules
 *
 * ELI5:
 * One row defines "what should be shipped on a repeating cadence".
 *
 * Why generic:
 * - supports subscription boxes, replenishment kits, membership shipments,
 *   and enterprise recurring physical deliveries,
 * - cadence and generation controls are explicit data, not hidden cron logic.
 */
export const shipmentSchedules = pgTable(
  "shipment_schedules",
  {
    /** Stable primary key for one recurring shipment definition. */
    id: idWithTag("shipment_schedule"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Human display name for operators. */
    name: varchar("name", { length: 220 }).notNull(),

    /** Stable slug for APIs/import/export and routing. */
    slug: varchar("slug", { length: 140 }).notNull(),

    /** Lifecycle status of this schedule. */
    status: lifecycleStatusEnum("status").default("active").notNull(),

    /** Recipient pointer: user. */
    recipientUserId: idRef("recipient_user_id").references(() => users.id),

    /** Recipient pointer: group account. */
    recipientGroupAccountId: idRef("recipient_group_account_id").references(
      () => groupAccounts.id,
    ),

    /** Recipient pointer: custom subject namespace. */
    recipientSubjectType: varchar("recipient_subject_type", { length: 80 }),

    /** Recipient pointer: custom subject id. */
    recipientSubjectId: varchar("recipient_subject_id", { length: 140 }),

    /** Sellable being shipped on this schedule. */
    sellableId: idRef("sellable_id")
      .references(() => sellables.id)
      .notNull(),

    /** Optional membership context that grants this recurring shipment. */
    membershipId: idRef("membership_id").references(() => memberships.id),

    /** Optional preferred inventory location for reservation/stock picks. */
    inventoryLocationId: idRef("inventory_location_id").references(
      () => inventoryLocations.id,
    ),

    /** Quantity per scheduled shipment occurrence. */
    quantity: integer("quantity").default(1).notNull(),

    /**
     * Recurrence mode.
     * - interval: use interval_count + interval_unit
     * - calendar_rule: use recurrence_rule_text
     * - custom_%: extension-managed schedulers
     */
    recurrenceMode: varchar("recurrence_mode", { length: 40 })
      .default("interval")
      .notNull(),

    /** Interval count used when recurrence_mode='interval'. */
    intervalCount: integer("interval_count"),

    /** Interval unit used when recurrence_mode='interval'. */
    intervalUnit: varchar("interval_unit", { length: 20 }),

    /**
     * Calendar rule expression used when recurrence_mode='calendar_rule'.
     *
     * Note:
     * The text can hold RRULE-like or domain-specific rule syntax.
     * Keeping this generic avoids hard-coupling DB schema to one parser.
     */
    recurrenceRuleText: text("recurrence_rule_text"),

    /** Lead time before occurrence for generation job (minutes). */
    generationLeadMinutes: integer("generation_lead_minutes").default(60).notNull(),

    /** Optional processing window width in minutes. */
    generationWindowMinutes: integer("generation_window_minutes").default(120).notNull(),

    /** Optional maximum occurrence count for finite schedules. */
    maxOccurrences: integer("max_occurrences"),

    /** Optional current generated occurrence count. */
    generatedOccurrences: integer("generated_occurrences").default(0).notNull(),

    /** Schedule effective start. */
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),

    /** Optional schedule end. */
    endsAt: timestamp("ends_at", { withTimezone: true }),

    /** Last generation execution timestamp. */
    lastGeneratedAt: timestamp("last_generated_at", { withTimezone: true }),

    /** Next generation target timestamp. */
    nextGenerationAt: timestamp("next_generation_at", { withTimezone: true }),

    /** Immutable policy snapshot for deterministic run behavior. */
    policySnapshot: jsonb("policy_snapshot").default({}).notNull(),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    shipmentSchedulesBizIdIdUnique: uniqueIndex("shipment_schedules_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Composite key for tenant-safe run item references. */

    /** Unique slug per tenant. */
    shipmentSchedulesBizSlugUnique: uniqueIndex("shipment_schedules_biz_slug_unique").on(
      table.bizId,
      table.slug,
    ),

    /** Operational generation queue path. */
    shipmentSchedulesBizStatusNextGenIdx: index("shipment_schedules_biz_status_next_gen_idx").on(
      table.bizId,
      table.status,
      table.nextGenerationAt,
    ),

    /** Recipient-centric path for account pages/support. */
    shipmentSchedulesBizRecipientIdx: index("shipment_schedules_biz_recipient_idx").on(
      table.bizId,
      table.recipientUserId,
      table.status,
      table.startsAt,
    ),

    /** Tenant-safe FK to recipient subject pointer. */
    shipmentSchedulesBizRecipientSubjectFk: foreignKey({
      columns: [table.bizId, table.recipientSubjectType, table.recipientSubjectId],
      foreignColumns: [subjects.bizId, subjects.subjectType, subjects.subjectId],
      name: "shipment_schedules_biz_recipient_subject_fk",
    }),

    /** Tenant-safe FK to sellable root. */
    shipmentSchedulesBizSellableFk: foreignKey({
      columns: [table.bizId, table.sellableId],
      foreignColumns: [sellables.bizId, sellables.id],
      name: "shipment_schedules_biz_sellable_fk",
    }),

    /** Tenant-safe FK to optional membership context. */
    shipmentSchedulesBizMembershipFk: foreignKey({
      columns: [table.bizId, table.membershipId],
      foreignColumns: [memberships.bizId, memberships.id],
      name: "shipment_schedules_biz_membership_fk",
    }),

    /** Tenant-safe FK to optional inventory location context. */
    shipmentSchedulesBizInventoryLocationFk: foreignKey({
      columns: [table.bizId, table.inventoryLocationId],
      foreignColumns: [inventoryLocations.bizId, inventoryLocations.id],
      name: "shipment_schedules_biz_inventory_location_fk",
    }),

    /** Recipient subject pointer should be fully null or fully set. */
    shipmentSchedulesRecipientSubjectPairCheck: check(
      "shipment_schedules_recipient_subject_pair_check",
      sql`
      (
        "recipient_subject_type" IS NULL
        AND "recipient_subject_id" IS NULL
      ) OR (
        "recipient_subject_type" IS NOT NULL
        AND "recipient_subject_id" IS NOT NULL
      )
      `,
    ),

    /** Exactly one recipient pointer is required. */
    shipmentSchedulesRecipientShapeCheck: check(
      "shipment_schedules_recipient_shape_check",
      sql`
      (
        ("recipient_user_id" IS NOT NULL)::int
        + ("recipient_group_account_id" IS NOT NULL)::int
        + ("recipient_subject_type" IS NOT NULL)::int
      ) = 1
      `,
    ),

    /** Recurrence shape and bounds checks. */
    shipmentSchedulesRecurrenceShapeCheck: check(
      "shipment_schedules_recurrence_shape_check",
      sql`
      (
        "recurrence_mode" = 'interval'
        AND "interval_count" IS NOT NULL
        AND "interval_count" > 0
        AND "interval_unit" IN ('day', 'week', 'month')
        AND "recurrence_rule_text" IS NULL
      ) OR (
        "recurrence_mode" = 'calendar_rule'
        AND "interval_count" IS NULL
        AND "interval_unit" IS NULL
        AND "recurrence_rule_text" IS NOT NULL
      ) OR (
        "recurrence_mode" LIKE 'custom_%'
      )
      `,
    ),

    /** Schedule window and quantity bounds checks. */
    shipmentSchedulesBoundsCheck: check(
      "shipment_schedules_bounds_check",
      sql`
      "quantity" > 0
      AND "generation_lead_minutes" >= 0
      AND "generation_window_minutes" > 0
      AND "generated_occurrences" >= 0
      AND ("max_occurrences" IS NULL OR "max_occurrences" >= 0)
      AND ("max_occurrences" IS NULL OR "generated_occurrences" <= "max_occurrences")
      AND ("ends_at" IS NULL OR "ends_at" > "starts_at")
      `,
    ),
  }),
);

/**
 * shipment_generation_runs
 *
 * ELI5:
 * One row = one execution attempt that generates shipment occurrences for
 * a schedule during a specific window.
 */
export const shipmentGenerationRuns = pgTable(
  "shipment_generation_runs",
  {
    /** Stable primary key for one generation run. */
    id: idWithTag("shipment_gen_run"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent schedule. */
    shipmentScheduleId: idRef("shipment_schedule_id")
      .references(() => shipmentSchedules.id)
      .notNull(),

    /** Run lifecycle state. */
    runState: varchar("run_state", { length: 40 }).default("pending").notNull(),

    /** Window start used for generation evaluation. */
    windowStartsAt: timestamp("window_starts_at", { withTimezone: true }).notNull(),

    /** Window end used for generation evaluation. */
    windowEndsAt: timestamp("window_ends_at", { withTimezone: true }).notNull(),

    /** Optional worker-scheduled trigger time. */
    scheduledForAt: timestamp("scheduled_for_at", { withTimezone: true }),

    /** Actual run start time. */
    startedAt: timestamp("started_at", { withTimezone: true }),

    /** Actual run finish time. */
    finishedAt: timestamp("finished_at", { withTimezone: true }),

    /** Generated item count. */
    generatedCount: integer("generated_count").default(0).notNull(),

    /** Skipped item count (already generated/not eligible). */
    skippedCount: integer("skipped_count").default(0).notNull(),

    /** Failed item count. */
    failedCount: integer("failed_count").default(0).notNull(),

    /** Optional idempotency key for scheduler safety. */
    idempotencyKey: varchar("idempotency_key", { length: 200 }),

    /** Optional short failure summary. */
    errorSummary: varchar("error_summary", { length: 1000 }),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite key for tenant-safe generated-item child rows. */
    shipmentGenerationRunsBizIdIdUnique: uniqueIndex(
      "shipment_generation_runs_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** Optional dedupe key for scheduler retries. */
    shipmentGenerationRunsIdempotencyUnique: uniqueIndex(
      "shipment_generation_runs_idempotency_unique",
    )
      .on(table.bizId, table.idempotencyKey)
      .where(sql`"idempotency_key" IS NOT NULL`),

    /** Operational monitor path. */
    shipmentGenerationRunsBizStateStartedIdx: index(
      "shipment_generation_runs_biz_state_started_idx",
    ).on(table.bizId, table.runState, table.startedAt),

    /** Schedule history path. */
    shipmentGenerationRunsBizScheduleWindowIdx: index(
      "shipment_generation_runs_biz_schedule_window_idx",
    ).on(table.bizId, table.shipmentScheduleId, table.windowStartsAt),

    /** Tenant-safe FK to schedule. */
    shipmentGenerationRunsBizScheduleFk: foreignKey({
      columns: [table.bizId, table.shipmentScheduleId],
      foreignColumns: [shipmentSchedules.bizId, shipmentSchedules.id],
      name: "shipment_generation_runs_biz_schedule_fk",
    }),

    /** Run-state vocabulary guard with extension escape hatch. */
    shipmentGenerationRunsStateCheck: check(
      "shipment_generation_runs_state_check",
      sql`
      "run_state" IN ('pending', 'running', 'completed', 'failed', 'cancelled')
      OR "run_state" LIKE 'custom_%'
      `,
    ),

    /** Window/timeline/counter bounds checks. */
    shipmentGenerationRunsBoundsCheck: check(
      "shipment_generation_runs_bounds_check",
      sql`
      "window_ends_at" > "window_starts_at"
      AND ("started_at" IS NULL OR "finished_at" IS NULL OR "finished_at" >= "started_at")
      AND "generated_count" >= 0
      AND "skipped_count" >= 0
      AND "failed_count" >= 0
      `,
    ),
  }),
);

/**
 * shipment_generated_items
 *
 * ELI5:
 * One row = one occurrence created (or skipped/failed) by one generation run.
 */
export const shipmentGeneratedItems = pgTable(
  "shipment_generated_items",
  {
    /** Stable primary key for one generated occurrence row. */
    id: idWithTag("shipment_item"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent generation run. */
    shipmentGenerationRunId: idRef("shipment_generation_run_id")
      .references(() => shipmentGenerationRuns.id)
      .notNull(),

    /** Parent schedule (denormalized for faster querying and integrity checks). */
    shipmentScheduleId: idRef("shipment_schedule_id")
      .references(() => shipmentSchedules.id)
      .notNull(),

    /** Occurrence timestamp represented by this generated row. */
    occurrenceAt: timestamp("occurrence_at", { withTimezone: true }).notNull(),

    /** Item generation state. */
    itemState: varchar("item_state", { length: 40 }).default("generated").notNull(),

    /** Optional booking order created for this shipment occurrence. */
    bookingOrderId: idRef("booking_order_id").references(() => bookingOrders.id),

    /** Optional physical fulfillment created for this shipment occurrence. */
    physicalFulfillmentId: idRef("physical_fulfillment_id").references(
      () => physicalFulfillments.id,
    ),

    /** Optional reason code for skipped/failed occurrences. */
    reasonCode: varchar("reason_code", { length: 120 }),

    /** Occurrence-level details payload. */
    details: jsonb("details").default({}).notNull(),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    shipmentGeneratedItemsBizIdIdUnique: uniqueIndex("shipment_generated_items_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** One generated row per run+occurrence is expected. */
    shipmentGeneratedItemsRunOccurrenceUnique: uniqueIndex(
      "shipment_generated_items_run_occurrence_unique",
    ).on(table.shipmentGenerationRunId, table.occurrenceAt),

    /** Main schedule occurrence history path. */
    shipmentGeneratedItemsBizScheduleOccurrenceIdx: index(
      "shipment_generated_items_biz_schedule_occurrence_idx",
    ).on(table.bizId, table.shipmentScheduleId, table.occurrenceAt),

    /** Tenant-safe FK to parent generation run. */
    shipmentGeneratedItemsBizRunFk: foreignKey({
      columns: [table.bizId, table.shipmentGenerationRunId],
      foreignColumns: [shipmentGenerationRuns.bizId, shipmentGenerationRuns.id],
      name: "shipment_generated_items_biz_run_fk",
    }),

    /** Tenant-safe FK to parent schedule. */
    shipmentGeneratedItemsBizScheduleFk: foreignKey({
      columns: [table.bizId, table.shipmentScheduleId],
      foreignColumns: [shipmentSchedules.bizId, shipmentSchedules.id],
      name: "shipment_generated_items_biz_schedule_fk",
    }),

    /** Tenant-safe FK to optional booking order target. */
    shipmentGeneratedItemsBizBookingOrderFk: foreignKey({
      columns: [table.bizId, table.bookingOrderId],
      foreignColumns: [bookingOrders.bizId, bookingOrders.id],
      name: "shipment_generated_items_biz_booking_order_fk",
    }),

    /** Tenant-safe FK to optional physical fulfillment target. */
    shipmentGeneratedItemsBizPhysicalFulfillmentFk: foreignKey({
      columns: [table.bizId, table.physicalFulfillmentId],
      foreignColumns: [physicalFulfillments.bizId, physicalFulfillments.id],
      name: "shipment_generated_items_biz_physical_fulfillment_fk",
    }),

    /** Item-state vocabulary guard with extension escape hatch. */
    shipmentGeneratedItemsStateCheck: check(
      "shipment_generated_items_state_check",
      sql`
      "item_state" IN ('generated', 'skipped', 'failed', 'cancelled')
      OR "item_state" LIKE 'custom_%'
      `,
    ),
  }),
);

export type ShipmentSchedule = typeof shipmentSchedules.$inferSelect;
export type NewShipmentSchedule = typeof shipmentSchedules.$inferInsert;
export type ShipmentGenerationRun = typeof shipmentGenerationRuns.$inferSelect;
export type NewShipmentGenerationRun = typeof shipmentGenerationRuns.$inferInsert;
export type ShipmentGeneratedItem = typeof shipmentGeneratedItems.$inferSelect;
export type NewShipmentGeneratedItem = typeof shipmentGeneratedItems.$inferInsert;

