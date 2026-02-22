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
import { bookingOrderLines, bookingOrders, fulfillmentUnits } from "./fulfillment";
import { groupAccounts } from "./group_accounts";
import { lifecycleStatusEnum } from "./enums";
import { queueEntries } from "./queue";
import { resources } from "./resources";
import { subjects } from "./subjects";
import { users } from "./users";

/**
 * seat_maps
 *
 * ELI5:
 * One seat map is the "drawing + rules" for a seatable space.
 *
 * Why generic:
 * - one map model should work for theaters, classrooms, buses, boats, labs,
 *   and any future custom subject,
 * - this avoids hardcoding "venue seats" in one vertical.
 *
 * How this connects:
 * - `seat_map_seats` stores individual seats in this map,
 * - `seat_holds` temporarily claims seats during checkout/queue windows,
 * - `seat_reservations` stores committed seat allocations after confirmation.
 */
export const seatMaps = pgTable(
  "seat_maps",
  {
    /** Stable primary key for one seat map definition. */
    id: idWithTag("seat_map"),

    /** Tenant boundary for strict multi-biz isolation. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Human-facing map name for setup and operations. */
    name: varchar("name", { length: 200 }).notNull(),

    /** Stable machine slug for APIs/import/export and deep links. */
    slug: varchar("slug", { length: 140 }).notNull(),

    /** Map lifecycle state (draft/active/archived style semantics). */
    status: lifecycleStatusEnum("status").default("active").notNull(),

    /**
     * Target pointer shape discriminator.
     *
     * Allowed:
     * - resource: map belongs to one resource row,
     * - custom_subject: map belongs to any subject namespace/id pair,
     * - custom_%: extension-defined target classes.
     */
    targetType: varchar("target_type", { length: 60 }).default("resource").notNull(),

    /** Direct resource pointer when target_type='resource'. */
    resourceId: idRef("resource_id").references(() => resources.id),

    /** Custom subject pointer when target_type='custom_subject'. */
    targetSubjectType: varchar("target_subject_type", { length: 80 }),
    targetSubjectId: varchar("target_subject_id", { length: 140 }),

    /**
     * Optional timezone hint for seat-hold windows and local-day rendering.
     * Keep nullable so target calendars can still be canonical source-of-truth.
     */
    timezone: varchar("timezone", { length: 50 }).default("UTC"),

    /**
     * Optional layout payload for render engines.
     *
     * Keep this flexible so UIs can evolve geometry format without migrations.
     * Examples:
     * - stage/aisle polygons,
     * - zoom/view presets,
     * - section-level display metadata.
     */
    layout: jsonb("layout").default({}).notNull(),

    /** Optional seat-policy knobs (adjacency constraints, hold defaults, etc.). */
    policy: jsonb("policy").default({}).notNull(),

    /** Extension payload for future cross-domain integrations. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    seatMapsBizIdIdUnique: uniqueIndex("seat_maps_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Composite key for tenant-safe downstream references. */

    /** Stable map slug per tenant. */
    seatMapsBizSlugUnique: uniqueIndex("seat_maps_biz_slug_unique").on(
      table.bizId,
      table.slug,
    ),

    /** Operational lookup by target and status. */
    seatMapsBizTargetStatusIdx: index("seat_maps_biz_target_status_idx").on(
      table.bizId,
      table.targetType,
      table.status,
    ),

    /** Tenant-safe FK for direct resource pointer. */
    seatMapsBizResourceFk: foreignKey({
      columns: [table.bizId, table.resourceId],
      foreignColumns: [resources.bizId, resources.id],
      name: "seat_maps_biz_resource_fk",
    }),

    /** Tenant-safe FK for custom-subject pointer. */
    seatMapsBizTargetSubjectFk: foreignKey({
      columns: [table.bizId, table.targetSubjectType, table.targetSubjectId],
      foreignColumns: [subjects.bizId, subjects.subjectType, subjects.subjectId],
      name: "seat_maps_biz_target_subject_fk",
    }),

    /** Subject pointer should be fully null or fully set. */
    seatMapsTargetSubjectPairCheck: check(
      "seat_maps_target_subject_pair_check",
      sql`
      (
        "target_subject_type" IS NULL
        AND "target_subject_id" IS NULL
      ) OR (
        "target_subject_type" IS NOT NULL
        AND "target_subject_id" IS NOT NULL
      )
      `,
    ),

    /** Target payload shape must match target_type deterministically. */
    seatMapsTargetShapeCheck: check(
      "seat_maps_target_shape_check",
      sql`
      (
        "target_type" = 'resource'
        AND "resource_id" IS NOT NULL
        AND "target_subject_type" IS NULL
        AND "target_subject_id" IS NULL
      ) OR (
        "target_type" = 'custom_subject'
        AND "resource_id" IS NULL
        AND "target_subject_type" IS NOT NULL
        AND "target_subject_id" IS NOT NULL
      ) OR (
        "target_type" LIKE 'custom_%'
      )
      `,
    ),
  }),
);

/**
 * seat_map_seats
 *
 * ELI5:
 * One row = one specific seat inside one seat map.
 *
 * Why this exists:
 * - gives each seat a stable id and key for holds/reservations/audits,
 * - supports seat metadata (accessibility, section, attributes) without
 *   re-encoding the whole map on every change.
 */
export const seatMapSeats = pgTable(
  "seat_map_seats",
  {
    /** Stable primary key for one seat definition. */
    id: idWithTag("seat"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent seat map. */
    seatMapId: idRef("seat_map_id")
      .references(() => seatMaps.id)
      .notNull(),

    /** Stable seat identity key within one map (e.g., A-12, VIP-01). */
    seatKey: varchar("seat_key", { length: 120 }).notNull(),

    /** Optional section label for grouped pricing/filters. */
    sectionKey: varchar("section_key", { length: 80 }),

    /** Optional row label for operator/customer readability. */
    rowLabel: varchar("row_label", { length: 60 }),

    /** Optional column/number label for readability. */
    columnLabel: varchar("column_label", { length: 60 }),

    /** Optional grid x-position for simple map renderers. */
    gridX: integer("grid_x"),

    /** Optional grid y-position for simple map renderers. */
    gridY: integer("grid_y"),

    /** Sort order used by deterministic seat listing UIs. */
    sortOrder: integer("sort_order").default(100).notNull(),

    /** Seat lifecycle status (active, paused, archived). */
    status: lifecycleStatusEnum("status").default("active").notNull(),

    /** Whether this seat supports accessibility requirements. */
    isAccessible: boolean("is_accessible").default(false).notNull(),

    /**
     * Logical seat capacity.
     * Usually 1, but can represent bench/booth spots where capacity > 1.
     */
    capacity: integer("capacity").default(1).notNull(),

    /** Optional metadata for seat-level flags/labels. */
    attributes: jsonb("attributes").default({}).notNull(),

    /** Extension payload for future integrations. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    seatMapSeatsBizIdIdUnique: uniqueIndex("seat_map_seats_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Composite key used by tenant-safe hold/reservation FKs. */

    /** Composite key used to assert seat belongs to map in child tables. */
    seatMapSeatsBizMapIdIdUnique: uniqueIndex(
      "seat_map_seats_biz_map_id_id_unique",
    ).on(table.bizId, table.seatMapId, table.id),

    /** One seat key per map. */
    seatMapSeatsMapSeatKeyUnique: uniqueIndex("seat_map_seats_map_seat_key_unique").on(
      table.seatMapId,
      table.seatKey,
    ),

    /** Common seat listing path. */
    seatMapSeatsBizMapStatusSortIdx: index("seat_map_seats_biz_map_status_sort_idx").on(
      table.bizId,
      table.seatMapId,
      table.status,
      table.sortOrder,
    ),

    /** Tenant-safe FK to seat map. */
    seatMapSeatsBizMapFk: foreignKey({
      columns: [table.bizId, table.seatMapId],
      foreignColumns: [seatMaps.bizId, seatMaps.id],
      name: "seat_map_seats_biz_map_fk",
    }),

    /** Sort/capacity bounds. */
    seatMapSeatsBoundsCheck: check(
      "seat_map_seats_bounds_check",
      sql`
      "sort_order" >= 0
      AND "capacity" > 0
      `,
    ),
  }),
);

/**
 * seat_holds
 *
 * ELI5:
 * Temporary seat lock while the customer is deciding/paying.
 *
 * Why this exists:
 * - prevents race conditions where two customers try to buy same seat,
 * - keeps hold lifecycle auditable and deterministic,
 * - can be reused for checkout holds, queue claims, and operator pre-holds.
 */
export const seatHolds = pgTable(
  "seat_holds",
  {
    /** Stable primary key for one hold record. */
    id: idWithTag("seat_hold"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent seat map for fast map-local hold operations. */
    seatMapId: idRef("seat_map_id")
      .references(() => seatMaps.id)
      .notNull(),

    /** Seat being held. */
    seatMapSeatId: idRef("seat_map_seat_id")
      .references(() => seatMapSeats.id)
      .notNull(),

    /** Optional booking order context for checkout-driven holds. */
    bookingOrderId: idRef("booking_order_id").references(() => bookingOrders.id),

    /** Optional booking line context for line-level seat holds. */
    bookingOrderLineId: idRef("booking_order_line_id").references(
      () => bookingOrderLines.id,
    ),

    /** Optional queue-entry context for walk-in and counter flows. */
    queueEntryId: idRef("queue_entry_id").references(() => queueEntries.id),

    /** Optional direct holder user pointer. */
    holderUserId: idRef("holder_user_id").references(() => users.id),

    /** Optional direct holder group pointer. */
    holderGroupAccountId: idRef("holder_group_account_id").references(
      () => groupAccounts.id,
    ),

    /** Hold flow classification (`checkout`, `queue`, `manual`, `custom_%`). */
    holdType: varchar("hold_type", { length: 60 }).default("checkout").notNull(),

    /**
     * Hold lifecycle state.
     *
     * Keep as varchar + check to support extension-specific hold states.
     */
    holdState: varchar("hold_state", { length: 40 }).default("held").notNull(),

    /** Time hold became active. */
    heldAt: timestamp("held_at", { withTimezone: true }).defaultNow().notNull(),

    /** Hold expiry time (release worker should enforce this). */
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),

    /** Release timestamp if hold was released/expired/cancelled. */
    releasedAt: timestamp("released_at", { withTimezone: true }),

    /** Conversion timestamp when hold became a reservation. */
    convertedAt: timestamp("converted_at", { withTimezone: true }),

    /** Optional idempotency key for safe retried hold creation. */
    idempotencyKey: varchar("idempotency_key", { length: 200 }),

    /** Structured hold policy snapshot and engine metadata. */
    policySnapshot: jsonb("policy_snapshot").default({}).notNull(),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    seatHoldsBizIdIdUnique: uniqueIndex("seat_holds_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Composite key for tenant-safe reservation conversion linkage. */

    /** Optional dedupe guard for retried hold creation calls. */
    seatHoldsBizIdempotencyUnique: uniqueIndex("seat_holds_biz_idempotency_unique")
      .on(table.bizId, table.idempotencyKey)
      .where(sql`"idempotency_key" IS NOT NULL`),

    /**
     * At most one active hold per seat.
     *
     * `hold_state='held'` is the state that blocks new holds.
     */
    seatHoldsActiveSeatUnique: uniqueIndex("seat_holds_active_seat_unique")
      .on(table.bizId, table.seatMapSeatId)
      .where(sql`"hold_state" = 'held' AND "deleted_at" IS NULL`),

    /** Sweeper path for expiring stale holds. */
    seatHoldsBizStateExpiryIdx: index("seat_holds_biz_state_expiry_idx").on(
      table.bizId,
      table.holdState,
      table.expiresAt,
    ),

    /** Tenant-safe FK to seat map. */
    seatHoldsBizMapFk: foreignKey({
      columns: [table.bizId, table.seatMapId],
      foreignColumns: [seatMaps.bizId, seatMaps.id],
      name: "seat_holds_biz_map_fk",
    }),

    /** Tenant-safe FK to seat id. */
    seatHoldsBizSeatFk: foreignKey({
      columns: [table.bizId, table.seatMapSeatId],
      foreignColumns: [seatMapSeats.bizId, seatMapSeats.id],
      name: "seat_holds_biz_seat_fk",
    }),

    /** Tenant-safe FK to ensure seat belongs to this map. */
    seatHoldsBizMapSeatPairFk: foreignKey({
      columns: [table.bizId, table.seatMapId, table.seatMapSeatId],
      foreignColumns: [seatMapSeats.bizId, seatMapSeats.seatMapId, seatMapSeats.id],
      name: "seat_holds_biz_map_seat_pair_fk",
    }),

    /** Tenant-safe FK to optional booking order. */
    seatHoldsBizBookingOrderFk: foreignKey({
      columns: [table.bizId, table.bookingOrderId],
      foreignColumns: [bookingOrders.bizId, bookingOrders.id],
      name: "seat_holds_biz_booking_order_fk",
    }),

    /** Tenant-safe FK to optional booking line. */
    seatHoldsBizBookingOrderLineFk: foreignKey({
      columns: [table.bizId, table.bookingOrderLineId],
      foreignColumns: [bookingOrderLines.bizId, bookingOrderLines.id],
      name: "seat_holds_biz_booking_order_line_fk",
    }),

    /** Tenant-safe FK to optional queue entry. */
    seatHoldsBizQueueEntryFk: foreignKey({
      columns: [table.bizId, table.queueEntryId],
      foreignColumns: [queueEntries.bizId, queueEntries.id],
      name: "seat_holds_biz_queue_entry_fk",
    }),

    /** Hold type vocabulary guard with extension escape hatch. */
    seatHoldsTypeCheck: check(
      "seat_holds_type_check",
      sql`
      "hold_type" IN ('checkout', 'queue', 'manual')
      OR "hold_type" LIKE 'custom_%'
      `,
    ),

    /** Hold state vocabulary guard with extension escape hatch. */
    seatHoldsStateCheck: check(
      "seat_holds_state_check",
      sql`
      "hold_state" IN ('held', 'released', 'expired', 'converted', 'cancelled')
      OR "hold_state" LIKE 'custom_%'
      `,
    ),

    /** Hold/release timeline sanity checks. */
    seatHoldsTimelineCheck: check(
      "seat_holds_timeline_check",
      sql`
      "expires_at" > "held_at"
      AND ("released_at" IS NULL OR "released_at" >= "held_at")
      AND ("converted_at" IS NULL OR "converted_at" >= "held_at")
      `,
    ),
  }),
);

/**
 * seat_reservations
 *
 * ELI5:
 * A committed seat allocation after hold confirmation.
 *
 * Why separate from holds:
 * - holds are temporary and expected to expire often,
 * - reservations are durable business facts used by check-in, manifests,
 *   refunds, transfer, and reporting workflows.
 */
export const seatReservations = pgTable(
  "seat_reservations",
  {
    /** Stable primary key for one committed seat reservation. */
    id: idWithTag("seat_reservation"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent seat map. */
    seatMapId: idRef("seat_map_id")
      .references(() => seatMaps.id)
      .notNull(),

    /** Reserved seat. */
    seatMapSeatId: idRef("seat_map_seat_id")
      .references(() => seatMapSeats.id)
      .notNull(),

    /** Optional original hold that converted into this reservation. */
    seatHoldId: idRef("seat_hold_id").references(() => seatHolds.id),

    /** Optional booking order context. */
    bookingOrderId: idRef("booking_order_id").references(() => bookingOrders.id),

    /** Optional booking line context. */
    bookingOrderLineId: idRef("booking_order_line_id").references(
      () => bookingOrderLines.id,
    ),

    /** Optional fulfillment-unit context (for operational execution flows). */
    fulfillmentUnitId: idRef("fulfillment_unit_id").references(
      () => fulfillmentUnits.id,
    ),

    /** Optional queue-entry context (walk-in counter commitments). */
    queueEntryId: idRef("queue_entry_id").references(() => queueEntries.id),

    /**
     * Reservation lifecycle state.
     * Use `state` to keep domain-specific progression separate from row status.
     */
    reservationState: varchar("reservation_state", { length: 40 })
      .default("reserved")
      .notNull(),

    /** Reservation commit timestamp. */
    reservedAt: timestamp("reserved_at", { withTimezone: true })
      .defaultNow()
      .notNull(),

    /** Optional release/cancel timestamp. */
    releasedAt: timestamp("released_at", { withTimezone: true }),

    /** Optional explanatory note for support/ops traces. */
    note: text("note"),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite key for tenant-safe downstream joins. */
    seatReservationsBizIdIdUnique: uniqueIndex(
      "seat_reservations_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** One active reservation per seat at a time. */
    seatReservationsActiveSeatUnique: uniqueIndex("seat_reservations_active_seat_unique")
      .on(table.bizId, table.seatMapSeatId)
      .where(sql`"reservation_state" = 'reserved' AND "deleted_at" IS NULL`),

    /** Common booking lookup path for ticketing/check-in APIs. */
    seatReservationsBizBookingIdx: index("seat_reservations_biz_booking_idx").on(
      table.bizId,
      table.bookingOrderLineId,
      table.reservationState,
    ),

    /** Tenant-safe FK to seat map. */
    seatReservationsBizMapFk: foreignKey({
      columns: [table.bizId, table.seatMapId],
      foreignColumns: [seatMaps.bizId, seatMaps.id],
      name: "seat_reservations_biz_map_fk",
    }),

    /** Tenant-safe FK to seat id. */
    seatReservationsBizSeatFk: foreignKey({
      columns: [table.bizId, table.seatMapSeatId],
      foreignColumns: [seatMapSeats.bizId, seatMapSeats.id],
      name: "seat_reservations_biz_seat_fk",
    }),

    /** Tenant-safe FK to ensure seat belongs to this map. */
    seatReservationsBizMapSeatPairFk: foreignKey({
      columns: [table.bizId, table.seatMapId, table.seatMapSeatId],
      foreignColumns: [seatMapSeats.bizId, seatMapSeats.seatMapId, seatMapSeats.id],
      name: "seat_reservations_biz_map_seat_pair_fk",
    }),

    /** Tenant-safe FK to optional hold pointer. */
    seatReservationsBizSeatHoldFk: foreignKey({
      columns: [table.bizId, table.seatHoldId],
      foreignColumns: [seatHolds.bizId, seatHolds.id],
      name: "seat_reservations_biz_seat_hold_fk",
    }),

    /** Tenant-safe FK to optional booking order. */
    seatReservationsBizBookingOrderFk: foreignKey({
      columns: [table.bizId, table.bookingOrderId],
      foreignColumns: [bookingOrders.bizId, bookingOrders.id],
      name: "seat_reservations_biz_booking_order_fk",
    }),

    /** Tenant-safe FK to optional booking line. */
    seatReservationsBizBookingOrderLineFk: foreignKey({
      columns: [table.bizId, table.bookingOrderLineId],
      foreignColumns: [bookingOrderLines.bizId, bookingOrderLines.id],
      name: "seat_reservations_biz_booking_order_line_fk",
    }),

    /** Tenant-safe FK to optional fulfillment unit. */
    seatReservationsBizFulfillmentUnitFk: foreignKey({
      columns: [table.bizId, table.fulfillmentUnitId],
      foreignColumns: [fulfillmentUnits.bizId, fulfillmentUnits.id],
      name: "seat_reservations_biz_fulfillment_unit_fk",
    }),

    /** Tenant-safe FK to optional queue entry. */
    seatReservationsBizQueueEntryFk: foreignKey({
      columns: [table.bizId, table.queueEntryId],
      foreignColumns: [queueEntries.bizId, queueEntries.id],
      name: "seat_reservations_biz_queue_entry_fk",
    }),

    /** Reservation state vocabulary guard with extension escape hatch. */
    seatReservationsStateCheck: check(
      "seat_reservations_state_check",
      sql`
      "reservation_state" IN ('reserved', 'released', 'consumed', 'cancelled', 'transferred')
      OR "reservation_state" LIKE 'custom_%'
      `,
    ),

    /** Release cannot happen before reserve. */
    seatReservationsTimelineCheck: check(
      "seat_reservations_timeline_check",
      sql`"released_at" IS NULL OR "released_at" >= "reserved_at"`,
    ),
  }),
);

export type SeatMap = typeof seatMaps.$inferSelect;
export type NewSeatMap = typeof seatMaps.$inferInsert;
export type SeatMapSeat = typeof seatMapSeats.$inferSelect;
export type NewSeatMapSeat = typeof seatMapSeats.$inferInsert;
export type SeatHold = typeof seatHolds.$inferSelect;
export type NewSeatHold = typeof seatHolds.$inferInsert;
export type SeatReservation = typeof seatReservations.$inferSelect;
export type NewSeatReservation = typeof seatReservations.$inferInsert;

