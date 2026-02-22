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
import { crmContacts } from "./crm";
import { lifecycleStatusEnum } from "./enums";
import { sellables } from "./product_commerce";
import { users } from "./users";

/**
 * wishlists
 *
 * ELI5:
 * A wishlist is a "save for later" container.
 *
 * Why this table exists:
 * - checkout sessions are short-lived carts,
 * - wishlists are long-lived intent storage ("I want this later"),
 * - this unlocks reminder, back-in-stock, and cross-sell flows without
 *   overloading checkout tables.
 *
 * Ownership model:
 * - one row belongs to exactly one `crm_contact` owner.
 * - this avoids repeating user/group ownership columns in each commerce table.
 */
export const wishlists = pgTable(
  "wishlists",
  {
    /** Stable primary key for one wishlist container. */
    id: idWithTag("wishlist"),

    /** Tenant boundary for strict data isolation. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Shared contact owner for this wishlist. */
    crmContactId: idRef("crm_contact_id")
      .references(() => crmContacts.id)
      .notNull(),

    /** Human-friendly wishlist name shown in customer/admin UIs. */
    name: varchar("name", { length: 180 }).notNull(),

    /** Stable machine slug used by APIs and deep links. */
    slug: varchar("slug", { length: 140 }).notNull(),

    /** Generic lifecycle for active/archived/deleted flows. */
    status: lifecycleStatusEnum("status").default("active").notNull(),

    /**
     * Visibility policy for share links and internal recommendations.
     * - private: only owner/admin can read
     * - shared: explicit share links/grants required
     * - public: discoverable by public surfaces
     *
     * `custom_*` values are allowed for plugin-defined policies.
     */
    visibilityMode: varchar("visibility_mode", { length: 40 })
      .default("private")
      .notNull(),

    /**
     * If true, this is the owner's default list for "save" actions when no
     * explicit wishlist is provided by the client.
     */
    isDefault: boolean("is_default").default(false).notNull(),

    /** Optional ordering hint for owner-facing list UIs. */
    sortOrder: integer("sort_order").default(100).notNull(),

    /** Extensible payload for future preference knobs. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    wishlistsBizIdIdUnique: uniqueIndex("wishlists_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Composite key for tenant-safe foreign keys from child tables. */

    /** Prevent duplicate slugs for one owner. */
    wishlistsOwnerSlugUnique: uniqueIndex("wishlists_owner_slug_unique").on(
      table.bizId,
      table.crmContactId,
      table.slug,
    ),

    /** At most one active default wishlist per owner. */
    wishlistsOneDefaultPerOwnerUnique: uniqueIndex(
      "wishlists_one_default_per_owner_unique",
    )
      .on(table.bizId, table.crmContactId)
      .where(sql`"is_default" = true AND "deleted_at" IS NULL`),

    /** Common owner portal listing path. */
    wishlistsBizOwnerStatusIdx: index("wishlists_biz_owner_status_idx").on(
      table.bizId,
      table.crmContactId,
      table.status,
      table.sortOrder,
    ),

    /** Tenant-safe FK to shared CRM contact owner. */
    wishlistsBizContactFk: foreignKey({
      columns: [table.bizId, table.crmContactId],
      foreignColumns: [crmContacts.bizId, crmContacts.id],
      name: "wishlists_biz_contact_fk",
    }),

    /** Visibility values stay extensible but deterministic. */
    wishlistsVisibilityModeCheck: check(
      "wishlists_visibility_mode_check",
      sql`
      "visibility_mode" IN ('private', 'shared', 'public')
      OR "visibility_mode" LIKE 'custom_%'
      `,
    ),

    /** Non-negative ordering helps predictable list rendering. */
    wishlistsSortOrderCheck: check(
      "wishlists_sort_order_check",
      sql`"sort_order" >= 0`,
    ),
  }),
);

/**
 * wishlist_items
 *
 * ELI5:
 * One row is one "thing saved for later" inside a wishlist.
 *
 * Why this shape is flexible:
 * - canonical `sellable_id` keeps all commerce types unified
 *   (products, service products, offers, resource rates),
 * - optional `variant_key` supports variant-specific saves without creating
 *   hardcoded columns per industry.
 */
export const wishlistItems = pgTable(
  "wishlist_items",
  {
    /** Stable primary key for one saved item row. */
    id: idWithTag("wishlist_item"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent wishlist container. */
    wishlistId: idRef("wishlist_id")
      .references(() => wishlists.id)
      .notNull(),

    /** Canonical commercial identity being saved. */
    sellableId: idRef("sellable_id")
      .references(() => sellables.id)
      .notNull(),

    /**
     * Optional variant selector key.
     * Example: "size:M|color:blue" or a variant id from client domain.
     */
    variantKey: varchar("variant_key", { length: 180 }),

    /** Generic lifecycle marker for item-level archive/remove behaviors. */
    status: lifecycleStatusEnum("status").default("active").notNull(),

    /** Desired quantity hint captured from user intent. */
    desiredQuantity: integer("desired_quantity").default(1).notNull(),

    /** Optional priority rank inside the list (lower can mean higher priority). */
    priority: integer("priority").default(100).notNull(),

    /** Optional owner note ("buy next paycheck", "gift idea", etc.). */
    note: text("note"),

    /** Optional desired unit price threshold in minor units. */
    desiredUnitPriceMinor: integer("desired_unit_price_minor"),

    /** Currency for desired price thresholds. */
    currency: varchar("currency", { length: 3 }).default("USD").notNull(),

    /** Business timestamp when item was intentionally added. */
    addedAt: timestamp("added_at", { withTimezone: true }).defaultNow().notNull(),

    /** Last touch timestamp for ranking/recommendation recency logic. */
    lastTouchedAt: timestamp("last_touched_at", { withTimezone: true })
      .defaultNow()
      .notNull(),

    /** Extensible payload for recommendation and merchandising metadata. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    wishlistItemsBizIdIdUnique: uniqueIndex("wishlist_items_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Composite key for tenant-safe external references. */

    /** Prevent duplicate active rows for same sellable variant in one list. */
    wishlistItemsActiveUnique: uniqueIndex("wishlist_items_active_unique")
      .on(table.wishlistId, table.sellableId, table.variantKey)
      .where(sql`"deleted_at" IS NULL`),

    /** Main render/query path for one wishlist page. */
    wishlistItemsBizWishlistPriorityIdx: index(
      "wishlist_items_biz_wishlist_priority_idx",
    ).on(table.bizId, table.wishlistId, table.priority, table.addedAt),

    /** Reverse lookup path for "who saved this sellable?" analytics. */
    wishlistItemsBizSellableIdx: index("wishlist_items_biz_sellable_idx").on(
      table.bizId,
      table.sellableId,
      table.status,
    ),

    /** Tenant-safe FK to parent wishlist. */
    wishlistItemsBizWishlistFk: foreignKey({
      columns: [table.bizId, table.wishlistId],
      foreignColumns: [wishlists.bizId, wishlists.id],
      name: "wishlist_items_biz_wishlist_fk",
    }),

    /** Tenant-safe FK to canonical sellable. */
    wishlistItemsBizSellableFk: foreignKey({
      columns: [table.bizId, table.sellableId],
      foreignColumns: [sellables.bizId, sellables.id],
      name: "wishlist_items_biz_sellable_fk",
    }),

    /** Item intent and timestamp sanity checks. */
    wishlistItemsBoundsCheck: check(
      "wishlist_items_bounds_check",
      sql`
      "desired_quantity" > 0
      AND "priority" >= 0
      AND ("desired_unit_price_minor" IS NULL OR "desired_unit_price_minor" >= 0)
      AND "last_touched_at" >= "added_at"
      `,
    ),

    /** Currency format should remain uppercase ISO-like. */
    wishlistItemsCurrencyFormatCheck: check(
      "wishlist_items_currency_format_check",
      sql`"currency" ~ '^[A-Z]{3}$'`,
    ),
  }),
);

export type Wishlist = typeof wishlists.$inferSelect;
export type NewWishlist = typeof wishlists.$inferInsert;

export type WishlistItem = typeof wishlistItems.$inferSelect;
export type NewWishlistItem = typeof wishlistItems.$inferInsert;
