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
import { bizConfigValues } from "./biz_configs";
import { bizes } from "./bizes";
import { checkoutSessions } from "./checkout";
import { bookingOrders } from "./fulfillment";
import { groupAccounts } from "./group_accounts";
import { locations } from "./locations";
import { sellables } from "./product_commerce";
import { users } from "./users";

/**
 * production_batches
 *
 * ELI5:
 * One row is one finite production/supply batch for a sellable.
 *
 * Example:
 * - bakery creates "Sourdough Batch #128" with 80 units.
 * - reservations/waitlist can target this exact batch.
 *
 * Why this matters:
 * - queue alone tells "who is waiting",
 * - batch table adds "what supply exists, when it is ready, and how much is left".
 */
export const productionBatches = pgTable(
  "production_batches",
  {
    /** Stable primary key for one batch. */
    id: idWithTag("prod_batch"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Optional location where this batch is produced/fulfilled. */
    locationId: idRef("location_id").references(() => locations.id),

    /** Canonical sellable being produced by this batch. */
    sellableId: idRef("sellable_id")
      .references(() => sellables.id)
      .notNull(),

    /** Human/ops batch code (ticket, lot number, etc.). */
    batchCode: varchar("batch_code", { length: 120 }).notNull(),

    /** Optional display name for dashboards. */
    name: varchar("name", { length: 220 }),

    /**
     * Batch lifecycle state.
     * `custom_*` values are allowed for domain-specific workflows.
     */
    status: varchar("status", { length: 40 }).default("planned").notNull(),
    /**
     * Optional biz-config lifecycle dictionary pointer.
     *
     * ELI5:
     * - `status` remains the engine's deterministic internal code.
     * - `status_config_value_id` lets each biz map this into their own wording/
     *   workflow labels without schema changes.
     */
    statusConfigValueId: idRef("status_config_value_id"),

    /** Planned quantity for this batch. */
    plannedQuantity: integer("planned_quantity").default(0).notNull(),

    /** Actual produced quantity currently available for release/allocation. */
    producedQuantity: integer("produced_quantity").default(0).notNull(),

    /** Quantity currently reserved across batch reservations. */
    reservedQuantity: integer("reserved_quantity").default(0).notNull(),

    /** Quantity already released/fulfilled from this batch. */
    releasedQuantity: integer("released_quantity").default(0).notNull(),

    /** Production start timestamp. */
    productionStartAt: timestamp("production_start_at", { withTimezone: true }),

    /** Ready-for-fulfillment timestamp. */
    readyAt: timestamp("ready_at", { withTimezone: true }),

    /** Optional expiry/spoilage timestamp for perishable supply. */
    expiresAt: timestamp("expires_at", { withTimezone: true }),

    /** Optional close timestamp when batch is finished/cancelled. */
    closedAt: timestamp("closed_at", { withTimezone: true }),

    /** Immutable policy snapshot (release strategy, overbook policy, etc.). */
    policySnapshot: jsonb("policy_snapshot").default({}).notNull(),

    /** Extensible metadata payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    productionBatchesBizIdIdUnique: uniqueIndex("production_batches_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Composite key for tenant-safe reservation references. */

    /** Batch code uniqueness per tenant. */
    productionBatchesBizCodeUnique: uniqueIndex("production_batches_biz_code_unique").on(
      table.bizId,
      table.batchCode,
    ),

    /** Batch operations board path. */
    productionBatchesBizStatusReadyIdx: index("production_batches_biz_status_ready_idx").on(
      table.bizId,
      table.status,
      table.readyAt,
    ),
    /** Configurable lifecycle lookup path for setup/admin tooling. */
    productionBatchesBizStatusConfigIdx: index(
      "production_batches_biz_status_config_idx",
    ).on(table.bizId, table.statusConfigValueId),

    /** Sellable-level planning analytics path. */
    productionBatchesBizSellableReadyIdx: index(
      "production_batches_biz_sellable_ready_idx",
    ).on(table.bizId, table.sellableId, table.readyAt),

    /** Tenant-safe FK to optional location. */
    productionBatchesBizLocationFk: foreignKey({
      columns: [table.bizId, table.locationId],
      foreignColumns: [locations.bizId, locations.id],
      name: "production_batches_biz_location_fk",
    }),

    /** Tenant-safe FK to sellable. */
    productionBatchesBizSellableFk: foreignKey({
      columns: [table.bizId, table.sellableId],
      foreignColumns: [sellables.bizId, sellables.id],
      name: "production_batches_biz_sellable_fk",
    }),
    /** Tenant-safe FK to optional configured lifecycle dictionary value. */
    productionBatchesBizStatusConfigFk: foreignKey({
      columns: [table.bizId, table.statusConfigValueId],
      foreignColumns: [bizConfigValues.bizId, bizConfigValues.id],
      name: "production_batches_biz_status_config_fk",
    }),

    /** Status vocabulary remains extensible. */
    productionBatchesStatusCheck: check(
      "production_batches_status_check",
      sql`
      "status" IN ('planned', 'in_production', 'ready', 'depleted', 'closed', 'cancelled')
      OR "status" LIKE 'custom_%'
      `,
    ),

    /** Quantity and timeline invariants. */
    productionBatchesBoundsCheck: check(
      "production_batches_bounds_check",
      sql`
      "planned_quantity" >= 0
      AND "produced_quantity" >= 0
      AND "reserved_quantity" >= 0
      AND "released_quantity" >= 0
      AND "reserved_quantity" <= "produced_quantity"
      AND "released_quantity" <= "produced_quantity"
      AND ("ready_at" IS NULL OR "production_start_at" IS NULL OR "ready_at" >= "production_start_at")
      AND ("expires_at" IS NULL OR "ready_at" IS NULL OR "expires_at" >= "ready_at")
      AND ("closed_at" IS NULL OR "production_start_at" IS NULL OR "closed_at" >= "production_start_at")
      `,
    ),
  }),
);

/**
 * production_batch_reservations
 *
 * ELI5:
 * One row is one reservation or waitlist intent against a production batch.
 *
 * This supports:
 * - prepaid allocation requests,
 * - waitlist entries when capacity is not enough,
 * - later conversion to finalized booking/order rows.
 */
export const productionBatchReservations = pgTable(
  "production_batch_reservations",
  {
    /** Stable primary key for one reservation row. */
    id: idWithTag("batch_reservation"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Target production batch. */
    productionBatchId: idRef("production_batch_id")
      .references(() => productionBatches.id)
      .notNull(),

    /**
     * Reservation lifecycle.
     * - reserved: holds quantity
     * - waitlisted: waiting for released capacity
     * - fulfilled: converted/released to final order
     * - cancelled/expired: inactive
     */
    status: varchar("status", { length: 40 }).default("waitlisted").notNull(),
    /**
     * Optional biz-config lifecycle dictionary pointer.
     *
     * This gives businesses custom labels/states while keeping deterministic
     * internal reservation-state semantics in `status`.
     */
    statusConfigValueId: idRef("status_config_value_id"),

    /** Optional owner user. */
    ownerUserId: idRef("owner_user_id").references(() => users.id),

    /** Optional owner group account. */
    ownerGroupAccountId: idRef("owner_group_account_id").references(
      () => groupAccounts.id,
    ),

    /** Optional guest email for non-authenticated pre-orders. */
    guestEmail: varchar("guest_email", { length: 320 }),

    /** Quantity requested by buyer. */
    requestedQuantity: integer("requested_quantity").default(1).notNull(),

    /** Quantity currently allocated from batch capacity. */
    allocatedQuantity: integer("allocated_quantity").default(0).notNull(),

    /** Amount paid toward this reservation in minor units. */
    paidAmountMinor: integer("paid_amount_minor").default(0).notNull(),

    /** Currency for paid amount. */
    currency: varchar("currency", { length: 3 }).default("USD").notNull(),

    /** Optional originating checkout session for commerce lineage. */
    sourceCheckoutSessionId: idRef("source_checkout_session_id").references(
      () => checkoutSessions.id,
    ),

    /** Optional final booking order once fulfilled. */
    bookingOrderId: idRef("booking_order_id").references(() => bookingOrders.id),

    /** Reservation request timestamp. */
    requestedAt: timestamp("requested_at", { withTimezone: true }).defaultNow().notNull(),

    /** Fulfillment timestamp when reservation is completed. */
    fulfilledAt: timestamp("fulfilled_at", { withTimezone: true }),

    /** Cancellation timestamp. */
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),

    /** Optional reservation expiry timestamp. */
    expiresAt: timestamp("expires_at", { withTimezone: true }),

    /** Optional operator note. */
    notes: text("notes"),

    /** Extensible metadata payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite key for external references. */
    productionBatchReservationsBizIdIdUnique: uniqueIndex(
      "production_batch_reservations_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** Reservation queue path by batch and status. */
    productionBatchReservationsBizBatchStatusRequestedIdx: index(
      "production_batch_reservations_biz_batch_status_requested_idx",
    ).on(table.bizId, table.productionBatchId, table.status, table.requestedAt),
    /** Configurable lifecycle lookup path for reservation operations boards. */
    productionBatchReservationsBizStatusConfigRequestedIdx: index(
      "production_batch_reservations_biz_status_config_requested_idx",
    ).on(table.bizId, table.statusConfigValueId, table.requestedAt),

    /** Owner history path. */
    productionBatchReservationsBizOwnerRequestedIdx: index(
      "production_batch_reservations_biz_owner_requested_idx",
    ).on(table.bizId, table.ownerUserId, table.ownerGroupAccountId, table.requestedAt),

    /** Tenant-safe FK to batch. */
    productionBatchReservationsBizBatchFk: foreignKey({
      columns: [table.bizId, table.productionBatchId],
      foreignColumns: [productionBatches.bizId, productionBatches.id],
      name: "production_batch_reservations_biz_batch_fk",
    }),

    /** Tenant-safe FK to optional checkout source. */
    productionBatchReservationsBizCheckoutSessionFk: foreignKey({
      columns: [table.bizId, table.sourceCheckoutSessionId],
      foreignColumns: [checkoutSessions.bizId, checkoutSessions.id],
      name: "production_batch_reservations_biz_checkout_session_fk",
    }),

    /** Tenant-safe FK to optional booking order. */
    productionBatchReservationsBizBookingOrderFk: foreignKey({
      columns: [table.bizId, table.bookingOrderId],
      foreignColumns: [bookingOrders.bizId, bookingOrders.id],
      name: "production_batch_reservations_biz_booking_order_fk",
    }),
    /** Tenant-safe FK to optional configured lifecycle dictionary value. */
    productionBatchReservationsBizStatusConfigFk: foreignKey({
      columns: [table.bizId, table.statusConfigValueId],
      foreignColumns: [bizConfigValues.bizId, bizConfigValues.id],
      name: "production_batch_reservations_biz_status_config_fk",
    }),

    /** Reservation status vocabulary remains extensible. */
    productionBatchReservationsStatusCheck: check(
      "production_batch_reservations_status_check",
      sql`
      "status" IN ('reserved', 'waitlisted', 'fulfilled', 'cancelled', 'expired')
      OR "status" LIKE 'custom_%'
      `,
    ),

    /** Owner, quantity, and timeline invariants. */
    productionBatchReservationsBoundsCheck: check(
      "production_batch_reservations_bounds_check",
      sql`
      (
        ("owner_user_id" IS NOT NULL)::int
        + ("owner_group_account_id" IS NOT NULL)::int
        + ("guest_email" IS NOT NULL)::int
      ) = 1
      AND "requested_quantity" >= 1
      AND "allocated_quantity" >= 0
      AND "allocated_quantity" <= "requested_quantity"
      AND "paid_amount_minor" >= 0
      AND ("fulfilled_at" IS NULL OR "fulfilled_at" >= "requested_at")
      AND ("cancelled_at" IS NULL OR "cancelled_at" >= "requested_at")
      AND ("expires_at" IS NULL OR "expires_at" >= "requested_at")
      `,
    ),

    /** Fulfilled status should link to final order and fulfillment timestamp. */
    productionBatchReservationsFulfilledShapeCheck: check(
      "production_batch_reservations_fulfilled_shape_check",
      sql`
      "status" <> 'fulfilled'
      OR (
        "fulfilled_at" IS NOT NULL
        AND "booking_order_id" IS NOT NULL
      )
      `,
    ),

    /** Currency shape should remain uppercase ISO-like. */
    productionBatchReservationsCurrencyFormatCheck: check(
      "production_batch_reservations_currency_format_check",
      sql`"currency" ~ '^[A-Z]{3}$'`,
    ),
  }),
);

export type ProductionBatch = typeof productionBatches.$inferSelect;
export type NewProductionBatch = typeof productionBatches.$inferInsert;

export type ProductionBatchReservation = typeof productionBatchReservations.$inferSelect;
export type NewProductionBatchReservation = typeof productionBatchReservations.$inferInsert;
