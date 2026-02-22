import { foreignKey, index, uniqueIndex } from "drizzle-orm/pg-core";
import { jsonb, pgTable, text, varchar } from "drizzle-orm/pg-core";
import { id, idRef, withAuditRefs } from "./_common";
import { locations } from "./locations";
import { bizes } from "./bizes";
import { users } from "./users";

/**
 * assets
 *
 * Tangible inventory records (vehicles, devices, equipment, tools, etc).
 *
 * Streamline note:
 * Why this table intentionally stays lean:
 * - This table is the identity/profile row for an owned thing.
 * - Operational scheduling controls (status/capacity/overlap/buffers) live on
 *   the canonical `resources` row so every resource type follows one model.
 * - Cross-asset classification goes through shared capabilities on `resources`,
 *   not asset-specific category/tag trees.
 */
export const assets = pgTable(
  "assets",
  {
    id,

    /** Tenant boundary for inventory partitioning. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Optional home location anchor. */
    locationId: idRef("location_id").references(() => locations.id),

    /** Display name used in assignment and inventory UIs. */
    name: varchar("name", { length: 255 }).notNull(),

    /** Stable per-biz key for APIs/imports/routing. */
    slug: varchar("slug", { length: 100 }).notNull(),

    /** Optional operator-facing details. */
    description: text("description"),

    /**
     * Extensible payload for model-specific non-indexed attributes.
     *
     * Examples:
     * - serial numbers
     * - fuel type
     * - manufacturer-specific fields
     */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    assetsBizIdIdUnique: uniqueIndex("assets_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    assetsBizSlugUnique: uniqueIndex("assets_biz_slug_unique").on(
      table.bizId,
      table.slug,
    ),
    assetsBizLocationIdx: index("assets_biz_location_idx").on(
      table.bizId,
      table.locationId,
    ),

    /** Tenant-safe location FK. */
    assetsBizLocationFk: foreignKey({
      columns: [table.bizId, table.locationId],
      foreignColumns: [locations.bizId, locations.id],
      name: "assets_biz_location_fk",
    }),
  }),
);

export type Asset = typeof assets.$inferSelect;
export type NewAsset = typeof assets.$inferInsert;
