import { sql } from "drizzle-orm";
import { check, foreignKey, index, pgTable, uniqueIndex } from "drizzle-orm/pg-core";
import { integer, jsonb, timestamp, varchar } from "drizzle-orm/pg-core";
import { idRef, idWithTag, withAuditRefs } from "./_common";
import { bizes } from "./bizes";
import { timeScopes } from "./time_scopes";
import { users } from "./users";
import {
  capacityHoldEffectModeEnum,
  capacityHoldStatusEnum,
  capacityReservationKindEnum,
  timeScopeTypeEnum,
} from "./enums";

/**
 * capacity_reservations
 *
 * ELI5:
 * This is the one normalized ledger for "something is reserving capacity".
 *
 * Why this exists:
 * - bookings and temporary holds both reserve scarce time/capacity,
 * - reads should not have to union two different ledgers forever,
 * - one canonical row shape makes conflict scans, analytics, and future caching
 *   much simpler.
 *
 * The older source tables can still exist as write-specific compatibility
 * surfaces, but resolver reads should converge on this table.
 */
export const capacityReservations = pgTable(
  "capacity_reservations",
  {
    id: idWithTag("capacity_reservation"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Whether this reservation came from a booking claim or a hold row. */
    reservationKind: capacityReservationKindEnum("reservation_kind").notNull(),

    /**
     * Canonical normalized scope pointer when known.
     *
     * This matches the broader time-scope backbone.
     */
    timeScopeId: idRef("time_scope_id").references(() => timeScopes.id),

    /** Broad scope discriminator. */
    scopeType: timeScopeTypeEnum("scope_type").notNull(),

    /** Canonical overlap key. */
    scopeRefKey: varchar("scope_ref_key", { length: 320 }).notNull(),

    /** Blocking vs advisory semantics. */
    effectMode: capacityHoldEffectModeEnum("effect_mode").default("blocking").notNull(),

    /** Current reservation lifecycle state. */
    status: capacityHoldStatusEnum("status").default("active").notNull(),

    /** Units reserved from the target scope. */
    quantity: integer("quantity").default(1).notNull(),

    /** Effective reservation window start. */
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),

    /** Effective reservation window end. */
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),

    /**
     * Canonical source pointer for idempotent sync.
     *
     * Examples:
     * - booking_claim + booking_order + booking_...
     * - capacity_hold + capacity_hold + hold_...
     */
    sourceRefType: varchar("source_ref_type", { length: 80 }).notNull(),
    sourceRefId: idRef("source_ref_id").notNull(),

    /** Optional owner identity used for anti-abuse or attribution. */
    ownerRefKey: varchar("owner_ref_key", { length: 320 }),

    /** Extension payload for source-specific details. */
    metadata: jsonb("metadata").default({}).notNull(),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    capacityReservationsBizIdIdUnique: uniqueIndex(
      "capacity_reservations_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** One current row per source+scope mirror. */
    capacityReservationsSourceScopeUnique: uniqueIndex(
      "capacity_reservations_source_scope_unique",
    ).on(
      table.bizId,
      table.reservationKind,
      table.sourceRefType,
      table.sourceRefId,
      table.scopeRefKey,
    ),

    /** Main overlap-scan path for resolver reads. */
    capacityReservationsBizScopeWindowIdx: index(
      "capacity_reservations_biz_scope_window_idx",
    ).on(table.bizId, table.scopeRefKey, table.status, table.startsAt, table.endsAt),

    /** Source lookup path for sync workers and reconciliation. */
    capacityReservationsBizSourceIdx: index(
      "capacity_reservations_biz_source_idx",
    ).on(
      table.bizId,
      table.reservationKind,
      table.sourceRefType,
      table.sourceRefId,
    ),

    /** Normalized time-scope path for broader analytics and projections. */
    capacityReservationsBizTimeScopeIdx: index(
      "capacity_reservations_biz_time_scope_idx",
    ).on(table.bizId, table.timeScopeId, table.status, table.startsAt, table.endsAt),

    capacityReservationsBizTimeScopeFk: foreignKey({
      columns: [table.bizId, table.timeScopeId],
      foreignColumns: [timeScopes.bizId, timeScopes.id],
      name: "capacity_reservations_biz_time_scope_fk",
    }),

    capacityReservationsBoundsCheck: check(
      "capacity_reservations_bounds_check",
      sql`
      length("scope_ref_key") > 0
      AND length("source_ref_type") > 0
      AND "quantity" > 0
      AND "ends_at" > "starts_at"
      `,
    ),
  }),
);
