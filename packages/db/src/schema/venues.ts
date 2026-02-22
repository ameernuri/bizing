import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  pgTable,
  uniqueIndex,
  integer,
  text,
  varchar,
} from "drizzle-orm/pg-core";
import { id, idRef, withAuditRefs } from "./_common";
import { locations } from "./locations";
import { bizes } from "./bizes";
import { users } from "./users";

/**
 * venues
 *
 * Space inventory records (rooms, bays, tables, courts, halls, etc.).
 *
 * Streamline note:
 * - Classification/tag/amenity dictionaries are intentionally not modeled
 *   here anymore. Use shared capability assignment on the projected resource
 *   row for all supply typing.
 * - Operational scheduling controls (status/capacity/overlap) are handled by
 *   the canonical `resources` row to avoid duplicate state.
 */
export const venues = pgTable(
  "venues",
  {
    id,
    /** Tenant boundary for strict multi-biz isolation. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),
    /** Optional location/facility anchor. */
    locationId: idRef("location_id").references(() => locations.id),
    /** Customer-facing venue name. */
    name: varchar("name", { length: 255 }).notNull(),
    /** Stable per-biz route/import key. */
    slug: varchar("slug", { length: 100 }).notNull(),
    /** Optional human-readable address/locator text. */
    address: text("address"),

    /**
     * Optional default prep buffer for this physical venue.
     *
     * The scheduler can use this as a venue-specific hint when no explicit
     * policy override is configured at offer/service/resource level.
     */
    setupMinutes: integer("setup_minutes").default(0).notNull(),

    /**
     * Optional default cleanup/turnover buffer for this physical venue.
     *
     * Same precedence model as `setup_minutes`.
     */
    teardownMinutes: integer("teardown_minutes").default(0).notNull(),

    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    venuesBizIdIdUnique: uniqueIndex("venues_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    venuesBizSlugUnique: uniqueIndex("venues_biz_slug_unique").on(
      table.bizId,
      table.slug,
    ),
    venuesBizLocationIdx: index("venues_biz_location_idx").on(
      table.bizId,
      table.locationId,
    ),
    venuesBizLocationFk: foreignKey({
      columns: [table.bizId, table.locationId],
      foreignColumns: [locations.bizId, locations.id],
      name: "venues_biz_location_fk",
    }),
    venuesSetupMinutesNonNegativeCheck: check(
      "venues_setup_minutes_non_negative_check",
      sql`"setup_minutes" >= 0`,
    ),
    venuesTeardownMinutesNonNegativeCheck: check(
      "venues_teardown_minutes_non_negative_check",
      sql`"teardown_minutes" >= 0`,
    ),
  }),
);

export type Venue = typeof venues.$inferSelect;
export type NewVenue = typeof venues.$inferInsert;
