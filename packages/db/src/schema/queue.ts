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
import { groupAccounts } from "./group_accounts";
import { locations } from "./locations";
import { resources } from "./resources";
import { users } from "./users";
import { bookingOrders, fulfillmentUnits } from "./fulfillment";
import {
  queueEntryStatusEnum,
  queueEventTypeEnum,
  queueStatusEnum,
  queueStrategyEnum,
  queueTicketStatusEnum,
  serviceTimeObservationSourceEnum,
  waitTimePredictionModelEnum,
} from "./enums";
import { offerVersions } from "./offers";
import { calendarBindings } from "./time_availability";
import { bizConfigValues } from "./biz_configs";

/**
 * queues
 *
 * ELI5:
 * A queue is a live line where people wait for service.
 * This is different from booked slots and must be modeled explicitly.
 */
export const queues = pgTable(
  "queues",
  {
    /** Stable primary key. */
    id: idWithTag("queue"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Optional location where queue physically/virtually operates. */
    locationId: idRef("location_id").references(() => locations.id),

    /** Queue name shown in kiosk/admin/customer apps. */
    name: varchar("name", { length: 200 }).notNull(),

    /** Stable machine slug for APIs and links. */
    slug: varchar("slug", { length: 140 }).notNull(),

    /** Optional description/help text. */
    description: varchar("description", { length: 600 }),

    /** Queue ordering strategy. */
    strategy: queueStrategyEnum("strategy").default("fifo").notNull(),
    /**
     * Optional biz-config dictionary value for queue strategy wording.
     */
    strategyConfigValueId: idRef("strategy_config_value_id").references(
      () => bizConfigValues.id,
    ),

    /** Queue operational status. */
    status: queueStatusEnum("status").default("active").notNull(),
    /**
     * Optional biz-config dictionary value for queue status wording.
     */
    statusConfigValueId: idRef("status_config_value_id").references(
      () => bizConfigValues.id,
    ),

    /** Optional calendar binding controlling queue open hours. */
    calendarBindingId: idRef("calendar_binding_id").references(
      () => calendarBindings.id,
    ),

    /** Whether queue accepts self-join from customer channels. */
    isSelfJoinEnabled: boolean("is_self_join_enabled").default(true).notNull(),

    /** Policy knobs like max queue length, SLA targets, etc. */
    policy: jsonb("policy").default({}),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    queuesBizIdIdUnique: uniqueIndex("queues_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Composite unique key for tenant-safe child FKs. */

    /** Unique queue identity per tenant. */
    queuesBizSlugUnique: uniqueIndex("queues_biz_slug_unique").on(
      table.bizId,
      table.slug,
    ),

    /** Common operator listing path. */
    queuesBizStatusIdx: index("queues_biz_status_idx").on(
      table.bizId,
      table.status,
    ),
    queuesBizStrategyConfigIdx: index("queues_biz_strategy_config_idx").on(
      table.bizId,
      table.strategyConfigValueId,
    ),
    queuesBizStatusConfigIdx: index("queues_biz_status_config_idx").on(
      table.bizId,
      table.statusConfigValueId,
    ),

    /** Tenant-safe FK to location. */
    queuesBizLocationFk: foreignKey({
      columns: [table.bizId, table.locationId],
      foreignColumns: [locations.bizId, locations.id],
      name: "queues_biz_location_fk",
    }),

    /** Tenant-safe FK to calendar binding. */
    queuesBizCalendarBindingFk: foreignKey({
      columns: [table.bizId, table.calendarBindingId],
      foreignColumns: [calendarBindings.bizId, calendarBindings.id],
      name: "queues_biz_calendar_binding_fk",
    }),
    /** Tenant-safe FK to optional configurable strategy value. */
    queuesBizStrategyConfigFk: foreignKey({
      columns: [table.bizId, table.strategyConfigValueId],
      foreignColumns: [bizConfigValues.bizId, bizConfigValues.id],
      name: "queues_biz_strategy_config_fk",
    }),
    /** Tenant-safe FK to optional configurable status value. */
    queuesBizStatusConfigFk: foreignKey({
      columns: [table.bizId, table.statusConfigValueId],
      foreignColumns: [bizConfigValues.bizId, bizConfigValues.id],
      name: "queues_biz_status_config_fk",
    }),
  }),
);

/**
 * queue_entries
 *
 * ELI5:
 * Each row is one customer waiting request in a queue.
 * It can later generate a fulfillment unit/order or link to existing ones.
 */
export const queueEntries = pgTable(
  "queue_entries",
  {
    /** Stable primary key for queue entry. */
    id: idWithTag("queue_entry"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent queue. */
    queueId: idRef("queue_id")
      .references(() => queues.id)
      .notNull(),

    /** Optional linked user profile. */
    customerUserId: idRef("customer_user_id").references(() => users.id),

    /** Optional linked group account (family/company). */
    customerGroupAccountId: idRef("customer_group_account_id").references(
      () => groupAccounts.id,
    ),

    /** Optional requested offer version while waiting in queue. */
    requestedOfferVersionId: idRef("requested_offer_version_id").references(
      () => offerVersions.id,
    ),

    /** Optional order created from this queue entry. */
    bookingOrderId: idRef("booking_order_id").references(() => bookingOrders.id),

    /** Optional fulfillment unit linked to this queue service. */
    fulfillmentUnitId: idRef("fulfillment_unit_id").references(
      () => fulfillmentUnits.id,
    ),

    /** Queue-entry lifecycle status. */
    status: queueEntryStatusEnum("status").default("waiting").notNull(),
    /**
     * Optional biz-config dictionary value for queue-entry status wording.
     */
    statusConfigValueId: idRef("status_config_value_id").references(
      () => bizConfigValues.id,
    ),

    /** Priority score for weighted/priority queues (higher = sooner). */
    priorityScore: integer("priority_score").default(0).notNull(),

    /** Optional customer-facing display token (e.g., A102). */
    displayCode: varchar("display_code", { length: 60 }),

    /** Time customer joined queue. */
    joinedAt: timestamp("joined_at", { withTimezone: true }).defaultNow().notNull(),

    /** Optional promised/estimated service start. */
    estimatedStartAt: timestamp("estimated_start_at", { withTimezone: true }),

    /** Optional estimated wait in minutes. */
    estimatedWaitMin: integer("estimated_wait_min"),

    /** Optional time entry was offered a slot/resource. */
    offeredAt: timestamp("offered_at", { withTimezone: true }),

    /** Optional expiry time for offer acceptance window. */
    offerExpiresAt: timestamp("offer_expires_at", { withTimezone: true }),

    /** Optional time entry was served or completed. */
    servedAt: timestamp("served_at", { withTimezone: true }),

    /** Free-form policy/decision state for queue engines. */
    decisionState: jsonb("decision_state").default({}),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    queueEntriesBizIdIdUnique: uniqueIndex("queue_entries_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Composite unique key for tenant-safe child FKs. */
    /** Composite unique key with queue for strict ticket linkage checks. */
    queueEntriesBizIdIdQueueIdUnique: uniqueIndex(
      "queue_entries_biz_id_id_queue_id_unique",
    ).on(table.bizId, table.id, table.queueId),

    /** Common live queue board query path. */
    queueEntriesBizQueueStatusIdx: index("queue_entries_biz_queue_status_idx").on(
      table.bizId,
      table.queueId,
      table.status,
      table.joinedAt,
    ),
    queueEntriesBizStatusConfigIdx: index("queue_entries_biz_status_config_idx").on(
      table.bizId,
      table.statusConfigValueId,
    ),

    /** Common customer history query path. */
    queueEntriesBizCustomerIdx: index("queue_entries_biz_customer_idx").on(
      table.bizId,
      table.customerUserId,
      table.joinedAt,
    ),

    /** Tenant-safe FK to queue. */
    queueEntriesBizQueueFk: foreignKey({
      columns: [table.bizId, table.queueId],
      foreignColumns: [queues.bizId, queues.id],
      name: "queue_entries_biz_queue_fk",
    }),

    /** Tenant-safe FK to requested offer version. */
    queueEntriesBizOfferVersionFk: foreignKey({
      columns: [table.bizId, table.requestedOfferVersionId],
      foreignColumns: [offerVersions.bizId, offerVersions.id],
      name: "queue_entries_biz_offer_version_fk",
    }),

    /** Tenant-safe FK to booking order. */
    queueEntriesBizBookingOrderFk: foreignKey({
      columns: [table.bizId, table.bookingOrderId],
      foreignColumns: [bookingOrders.bizId, bookingOrders.id],
      name: "queue_entries_biz_booking_order_fk",
    }),

    /** Tenant-safe FK to fulfillment unit. */
    queueEntriesBizFulfillmentUnitFk: foreignKey({
      columns: [table.bizId, table.fulfillmentUnitId],
      foreignColumns: [fulfillmentUnits.bizId, fulfillmentUnits.id],
      name: "queue_entries_biz_fulfillment_unit_fk",
    }),
    /** Tenant-safe FK to optional configurable queue-entry status value. */
    queueEntriesBizStatusConfigFk: foreignKey({
      columns: [table.bizId, table.statusConfigValueId],
      foreignColumns: [bizConfigValues.bizId, bizConfigValues.id],
      name: "queue_entries_biz_status_config_fk",
    }),

    /** Estimated wait must be non-negative when present. */
    queueEntriesEstimatedWaitBoundsCheck: check(
      "queue_entries_estimated_wait_bounds_check",
      sql`"estimated_wait_min" IS NULL OR "estimated_wait_min" >= 0`,
    ),

    /** Offer expiry cannot be before offer issue time. */
    queueEntriesOfferWindowCheck: check(
      "queue_entries_offer_window_check",
      sql`"offered_at" IS NULL OR "offer_expires_at" IS NULL OR "offer_expires_at" > "offered_at"`,
    ),

    /**
     * At least one customer identity pointer should exist.
     * This avoids orphan queue entries that cannot be contacted/served.
     */
    queueEntriesCustomerPointerCheck: check(
      "queue_entries_customer_pointer_check",
      sql`"customer_user_id" IS NOT NULL OR "customer_group_account_id" IS NOT NULL`,
    ),

    /** One active waiting/offered entry per customer per queue. */
    queueEntriesActiveCustomerQueueUnique: uniqueIndex(
      "queue_entries_active_customer_queue_unique",
    )
      .on(table.bizId, table.queueId, table.customerUserId)
      .where(
        sql`"customer_user_id" IS NOT NULL AND "status" IN ('waiting', 'offered') AND "deleted_at" IS NULL`,
      ),
  }),
);

/**
 * queue_tickets
 *
 * ELI5:
 * Tickets are public-facing numbered tokens used by kiosks/front desks.
 * One queue entry can have one or many ticket states over time.
 */
export const queueTickets = pgTable(
  "queue_tickets",
  {
    /** Stable primary key. */
    id: idWithTag("queue_ticket"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent queue entry. */
    queueEntryId: idRef("queue_entry_id")
      .references(() => queueEntries.id)
      .notNull(),

    /** Queue scope duplicated for strict per-queue ticket uniqueness. */
    queueId: idRef("queue_id")
      .references(() => queues.id)
      .notNull(),

    /** Queue-local ticket number (human-facing). */
    ticketNumber: integer("ticket_number").notNull(),

    /** Ticket lifecycle state. */
    status: queueTicketStatusEnum("status").default("issued").notNull(),
    /**
     * Optional biz-config dictionary value for queue-ticket status wording.
     */
    statusConfigValueId: idRef("status_config_value_id").references(
      () => bizConfigValues.id,
    ),

    /** Ticket issuance time. */
    issuedAt: timestamp("issued_at", { withTimezone: true }).defaultNow().notNull(),

    /** Time customer was called to service window. */
    calledAt: timestamp("called_at", { withTimezone: true }),

    /** Time service began for this ticket. */
    serviceStartedAt: timestamp("service_started_at", { withTimezone: true }),

    /** Time service ended for this ticket. */
    serviceEndedAt: timestamp("service_ended_at", { withTimezone: true }),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    queueTicketsBizIdIdUnique: uniqueIndex("queue_tickets_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Unique number per queue is required for kiosk safety. */
    queueTicketsQueueNumberUnique: uniqueIndex("queue_tickets_queue_number_unique").on(
      table.bizId,
      table.queueId,
      table.ticketNumber,
    ),

    /** Common timeline lookup. */
    queueTicketsBizQueueEntryIdx: index("queue_tickets_biz_queue_entry_idx").on(
      table.bizId,
      table.queueEntryId,
      table.issuedAt,
    ),
    queueTicketsBizStatusConfigIdx: index("queue_tickets_biz_status_config_idx").on(
      table.bizId,
      table.statusConfigValueId,
    ),

    /** Tenant-safe FK to queue. */
    queueTicketsBizQueueFk: foreignKey({
      columns: [table.bizId, table.queueId],
      foreignColumns: [queues.bizId, queues.id],
      name: "queue_tickets_biz_queue_fk",
    }),

    /** Tenant-safe FK to queue entry + queue pair for consistency. */
    queueTicketsBizQueueEntryFk: foreignKey({
      columns: [table.bizId, table.queueEntryId, table.queueId],
      foreignColumns: [queueEntries.bizId, queueEntries.id, queueEntries.queueId],
      name: "queue_tickets_biz_queue_entry_fk",
    }),
    /** Tenant-safe FK to optional configurable ticket-status value. */
    queueTicketsBizStatusConfigFk: foreignKey({
      columns: [table.bizId, table.statusConfigValueId],
      foreignColumns: [bizConfigValues.bizId, bizConfigValues.id],
      name: "queue_tickets_biz_status_config_fk",
    }),

    /** Service timeline ordering sanity checks. */
    queueTicketsTimelineCheck: check(
      "queue_tickets_timeline_check",
      sql`
      ("called_at" IS NULL OR "called_at" >= "issued_at")
      AND ("service_started_at" IS NULL OR "called_at" IS NULL OR "service_started_at" >= "called_at")
      AND ("service_ended_at" IS NULL OR "service_started_at" IS NULL OR "service_ended_at" >= "service_started_at")
      `,
    ),
  }),
);

/**
 * queue_events
 *
 * ELI5:
 * Append-only event timeline for queue entry changes.
 * Great for audits, analytics, and replaying what happened.
 */
export const queueEvents = pgTable(
  "queue_events",
  {
    /** Stable primary key. */
    id: idWithTag("queue_event"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent queue entry this event belongs to. */
    queueEntryId: idRef("queue_entry_id")
      .references(() => queueEntries.id)
      .notNull(),

    /** Event type classification. */
    eventType: queueEventTypeEnum("event_type").notNull(),

    /** Optional actor who triggered this event. */
    actorUserId: idRef("actor_user_id").references(() => users.id),

    /** Event time. */
    eventAt: timestamp("event_at", { withTimezone: true }).defaultNow().notNull(),

    /** Structured details for the event. */
    payload: jsonb("payload").default({}).notNull(),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    queueEventsBizIdIdUnique: uniqueIndex("queue_events_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Timeline query path for one entry. */
    queueEventsBizQueueEntryIdx: index("queue_events_biz_queue_entry_idx").on(
      table.bizId,
      table.queueEntryId,
      table.eventAt,
    ),

    /** Tenant-safe FK to queue entry. */
    queueEventsBizQueueEntryFk: foreignKey({
      columns: [table.bizId, table.queueEntryId],
      foreignColumns: [queueEntries.bizId, queueEntries.id],
      name: "queue_events_biz_queue_entry_fk",
    }),
  }),
);

/**
 * service_time_observations
 *
 * ELI5:
 * Stores measured service durations. The prediction engine learns from this.
 */
export const serviceTimeObservations = pgTable(
  "service_time_observations",
  {
    /** Stable primary key. */
    id: idWithTag("service_time_obs"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Queue context where observation was recorded. */
    queueId: idRef("queue_id")
      .references(() => queues.id)
      .notNull(),

    /** Optional offer-version context to segment duration data. */
    offerVersionId: idRef("offer_version_id").references(() => offerVersions.id),

    /** Optional resource context for host-specific speed differences. */
    resourceId: idRef("resource_id").references(() => resources.id),

    /** Optional fulfillment unit being measured. */
    fulfillmentUnitId: idRef("fulfillment_unit_id").references(
      () => fulfillmentUnits.id,
    ),

    /** Observation source classification. */
    source: serviceTimeObservationSourceEnum("source").default("actual").notNull(),

    /** Service start time. */
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),

    /** Service completion time. */
    endedAt: timestamp("ended_at", { withTimezone: true }).notNull(),

    /** Measured duration in seconds for model inputs. */
    durationSeconds: integer("duration_seconds").notNull(),

    /** Structured context features used by estimators/models. */
    features: jsonb("features").default({}).notNull(),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    serviceTimeObservationsBizIdIdUnique: uniqueIndex("service_time_observations_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Query path for model training batches. */
    serviceTimeObservationsBizQueueStartedIdx: index(
      "service_time_observations_biz_queue_started_idx",
    ).on(table.bizId, table.queueId, table.startedAt),

    /** Tenant-safe FK to queue. */
    serviceTimeObservationsBizQueueFk: foreignKey({
      columns: [table.bizId, table.queueId],
      foreignColumns: [queues.bizId, queues.id],
      name: "service_time_observations_biz_queue_fk",
    }),

    /** Tenant-safe FK to offer version. */
    serviceTimeObservationsBizOfferVersionFk: foreignKey({
      columns: [table.bizId, table.offerVersionId],
      foreignColumns: [offerVersions.bizId, offerVersions.id],
      name: "service_time_observations_biz_offer_version_fk",
    }),

    /** Tenant-safe FK to resource. */
    serviceTimeObservationsBizResourceFk: foreignKey({
      columns: [table.bizId, table.resourceId],
      foreignColumns: [resources.bizId, resources.id],
      name: "service_time_observations_biz_resource_fk",
    }),

    /** Tenant-safe FK to fulfillment unit. */
    serviceTimeObservationsBizFulfillmentUnitFk: foreignKey({
      columns: [table.bizId, table.fulfillmentUnitId],
      foreignColumns: [fulfillmentUnits.bizId, fulfillmentUnits.id],
      name: "service_time_observations_biz_fulfillment_unit_fk",
    }),

    /** Duration must be positive and align with timestamps. */
    serviceTimeObservationsDurationCheck: check(
      "service_time_observations_duration_check",
      sql`"duration_seconds" > 0 AND "ended_at" > "started_at"`,
    ),
  }),
);

/**
 * wait_time_predictions
 *
 * ELI5:
 * Snapshot table for estimated wait outputs. Each row is one prediction.
 * This supports analytics and customer ETA explanations later.
 */
export const waitTimePredictions = pgTable(
  "wait_time_predictions",
  {
    /** Stable primary key. */
    id: idWithTag("wait_prediction"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Queue this prediction belongs to. */
    queueId: idRef("queue_id")
      .references(() => queues.id)
      .notNull(),

    /** Optional entry-level prediction target. */
    queueEntryId: idRef("queue_entry_id").references(() => queueEntries.id),

    /** Model family used to generate this estimate. */
    modelType: waitTimePredictionModelEnum("model_type").default("heuristic").notNull(),

    /** Prediction generated time. */
    generatedAt: timestamp("generated_at", { withTimezone: true }).defaultNow().notNull(),

    /** Forecast horizon in minutes. */
    horizonMin: integer("horizon_min").notNull(),

    /** Point estimate in minutes. */
    estimatedWaitMin: integer("estimated_wait_min").notNull(),

    /** Optional uncertainty percentile estimates. */
    p50WaitMin: integer("p50_wait_min"),
    p90WaitMin: integer("p90_wait_min"),

    /** Structured model input/output details. */
    details: jsonb("details").default({}).notNull(),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    waitTimePredictionsBizIdIdUnique: uniqueIndex("wait_time_predictions_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Common dashboard chart query path. */
    waitTimePredictionsBizQueueGeneratedIdx: index(
      "wait_time_predictions_biz_queue_generated_idx",
    ).on(table.bizId, table.queueId, table.generatedAt),

    /** Tenant-safe FK to queue. */
    waitTimePredictionsBizQueueFk: foreignKey({
      columns: [table.bizId, table.queueId],
      foreignColumns: [queues.bizId, queues.id],
      name: "wait_time_predictions_biz_queue_fk",
    }),

    /** Tenant-safe FK to queue entry. */
    waitTimePredictionsBizQueueEntryFk: foreignKey({
      columns: [table.bizId, table.queueEntryId],
      foreignColumns: [queueEntries.bizId, queueEntries.id],
      name: "wait_time_predictions_biz_queue_entry_fk",
    }),

    /** Prediction values must be non-negative. */
    waitTimePredictionsValueBoundsCheck: check(
      "wait_time_predictions_value_bounds_check",
      sql`
      "horizon_min" >= 0
      AND "estimated_wait_min" >= 0
      AND ("p50_wait_min" IS NULL OR "p50_wait_min" >= 0)
      AND ("p90_wait_min" IS NULL OR "p90_wait_min" >= 0)
      `,
    ),

    /** Percentile ordering when both values are set. */
    waitTimePredictionsPercentileOrderCheck: check(
      "wait_time_predictions_percentile_order_check",
      sql`"p50_wait_min" IS NULL OR "p90_wait_min" IS NULL OR "p90_wait_min" >= "p50_wait_min"`,
    ),
  }),
);
