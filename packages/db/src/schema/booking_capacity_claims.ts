import { sql } from "drizzle-orm";
import { check, foreignKey, index, pgTable, uniqueIndex } from "drizzle-orm/pg-core";
import { integer, jsonb, timestamp, varchar } from "drizzle-orm/pg-core";
import { idRef, idWithTag, withAuditRefs } from "./_common";
import { bizes } from "./bizes";
import { bookingOrders } from "./fulfillment";
import { timeScopes } from "./time_scopes";
import { users } from "./users";
import { timeScopeTypeEnum } from "./enums";

/**
 * booking_capacity_claims
 *
 * ELI5:
 * This is the explicit list of capacity owners a booking consumes.
 *
 * Why this exists:
 * - availability reads should not scrape booking metadata to guess conflicts,
 * - one booking can consume multiple owners (host + room + asset),
 * - booking writes can now materialize the exact overlap keys once, then the
 *   resolver reads those normalized claims directly.
 */
export const bookingCapacityClaims = pgTable(
  "booking_capacity_claims",
  {
    id: idWithTag("booking_capacity_claim"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Booking that owns this claim row. */
    bookingOrderId: idRef("booking_order_id")
      .references(() => bookingOrders.id, { onDelete: "cascade" })
      .notNull(),

    /**
     * Canonical reusable scope pointer when it exists.
     *
     * This allows claims to plug into the broader time-scope ecosystem without
     * forcing all writers to duplicate typed scope payload columns.
     */
    timeScopeId: idRef("time_scope_id").references(() => timeScopes.id),

    /** Broad scope discriminator. */
    scopeType: timeScopeTypeEnum("scope_type").notNull(),

    /**
     * Canonical scope key used by overlap checks.
     *
     * Examples:
     * - `user:user_...`
     * - `resource:resource_...`
     * - `offer_version:offer_version_...`
     */
    scopeRefKey: varchar("scope_ref_key", { length: 320 }).notNull(),

    /** Units of capacity consumed for this scope. */
    quantity: integer("quantity").default(1).notNull(),

    /** Effective booking window start for this claim. */
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),

    /** Effective booking window end for this claim. */
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),

    /** Extension payload for future claim semantics. */
    metadata: jsonb("metadata").default({}).notNull(),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    bookingCapacityClaimsBizIdIdUnique: uniqueIndex(
      "booking_capacity_claims_biz_id_id_unique",
    ).on(table.bizId, table.id),

    bookingCapacityClaimsBookingScopeUnique: uniqueIndex(
      "booking_capacity_claims_booking_scope_unique",
    ).on(table.bookingOrderId, table.scopeRefKey),

    bookingCapacityClaimsBizScopeWindowIdx: index(
      "booking_capacity_claims_biz_scope_window_idx",
    ).on(table.bizId, table.scopeRefKey, table.startsAt, table.endsAt),

    bookingCapacityClaimsBizBookingIdx: index(
      "booking_capacity_claims_biz_booking_idx",
    ).on(table.bizId, table.bookingOrderId),

    bookingCapacityClaimsBizTimeScopeIdx: index(
      "booking_capacity_claims_biz_time_scope_idx",
    ).on(table.bizId, table.timeScopeId),

    bookingCapacityClaimsBizBookingFk: foreignKey({
      columns: [table.bizId, table.bookingOrderId],
      foreignColumns: [bookingOrders.bizId, bookingOrders.id],
      name: "booking_capacity_claims_biz_booking_fk",
    }),

    bookingCapacityClaimsBizTimeScopeFk: foreignKey({
      columns: [table.bizId, table.timeScopeId],
      foreignColumns: [timeScopes.bizId, timeScopes.id],
      name: "booking_capacity_claims_biz_time_scope_fk",
    }),

    bookingCapacityClaimsBoundsCheck: check(
      "booking_capacity_claims_bounds_check",
      sql`
      length("scope_ref_key") > 0
      AND "quantity" > 0
      AND "ends_at" > "starts_at"
      `,
    ),
  }),
);
