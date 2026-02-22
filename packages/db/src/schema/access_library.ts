import { sql } from "drizzle-orm";
import { check, foreignKey, index, uniqueIndex } from "drizzle-orm/pg-core";
import {
  integer,
  jsonb,
  pgTable,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { idRef, idWithTag, withAuditRefs } from "./_common";
import { accessArtifacts, accessUsageWindows } from "./access_rights";
import { bizes } from "./bizes";
import { entitlementGrants, memberships } from "./entitlements";
import { groupAccounts } from "./group_accounts";
import { lifecycleStatusEnum } from "./enums";
import { sellables } from "./product_commerce";
import { subjects } from "./subjects";
import { users } from "./users";

/**
 * access_library_items
 *
 * ELI5:
 * This is a read-model table: one row per "library item shown to an owner".
 *
 * Why this exists:
 * - source-of-truth tables stay normalized and event-rich,
 * - customer portals need very fast "my library" reads,
 * - this table can be deterministically rebuilt from source records/events.
 *
 * Core principle:
 * - no unique business facts should live only here,
 * - this table stores query-optimized snapshots and references.
 */
export const accessLibraryItems = pgTable(
  "access_library_items",
  {
    /** Stable primary key for one projection row. */
    id: idWithTag("library_item"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Owner pointer: user. */
    ownerUserId: idRef("owner_user_id").references(() => users.id),

    /** Owner pointer: group account. */
    ownerGroupAccountId: idRef("owner_group_account_id").references(
      () => groupAccounts.id,
    ),

    /** Owner pointer: custom subject namespace. */
    ownerSubjectType: varchar("owner_subject_type", { length: 80 }),

    /** Owner pointer: custom subject id. */
    ownerSubjectId: varchar("owner_subject_id", { length: 140 }),

    /** Stable projection key for deterministic upserts/rebuilds. */
    projectionKey: varchar("projection_key", { length: 220 }).notNull(),

    /** Snapshot row lifecycle status. */
    status: lifecycleStatusEnum("status").default("active").notNull(),

    /**
     * Item availability state used by library UIs.
     * Keep as flexible string + check with `custom_%` extension path.
     */
    availabilityState: varchar("availability_state", { length: 40 })
      .default("available")
      .notNull(),

    /** Optional access-artifact source pointer. */
    accessArtifactId: idRef("access_artifact_id").references(() => accessArtifacts.id),

    /** Optional usage-window source pointer. */
    accessUsageWindowId: idRef("access_usage_window_id").references(
      () => accessUsageWindows.id,
    ),

    /** Optional sellable source pointer. */
    sellableId: idRef("sellable_id").references(() => sellables.id),

    /** Optional membership source pointer. */
    membershipId: idRef("membership_id").references(() => memberships.id),

    /** Optional entitlement-grant source pointer. */
    entitlementGrantId: idRef("entitlement_grant_id").references(
      () => entitlementGrants.id,
    ),

    /** Optional availability window start for this snapshot item. */
    availableFrom: timestamp("available_from", { withTimezone: true }),

    /** Optional availability window end for this snapshot item. */
    availableUntil: timestamp("available_until", { withTimezone: true }),

    /** Optional last usage timestamp for display/sorting. */
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),

    /** Optional granted quantity snapshot. */
    usageGranted: integer("usage_granted"),

    /** Optional remaining quantity snapshot. */
    usageRemaining: integer("usage_remaining"),

    /** Source-system update watermark (for change data capture ordering). */
    sourceUpdatedAt: timestamp("source_updated_at", { withTimezone: true }),

    /** Projection refresh timestamp. */
    refreshedAt: timestamp("refreshed_at", { withTimezone: true }).defaultNow().notNull(),

    /** Projection schema version for controlled read-model evolution. */
    projectionVersion: integer("projection_version").default(1).notNull(),

    /** Denormalized snapshot payload used by API/UI reads. */
    snapshot: jsonb("snapshot").default({}).notNull(),

    /** Extension payload for plugin read-model enrichments. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    accessLibraryItemsBizIdIdUnique: uniqueIndex("access_library_items_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Projection key is unique for one owner in one tenant. */
    accessLibraryItemsOwnerProjectionUnique: uniqueIndex(
      "access_library_items_owner_projection_unique",
    ).on(
      table.bizId,
      table.ownerUserId,
      table.ownerGroupAccountId,
      table.ownerSubjectType,
      table.ownerSubjectId,
      table.projectionKey,
    ),

    /** One row per owner + artifact anchor when artifact source exists. */
    accessLibraryItemsOwnerArtifactUnique: uniqueIndex(
      "access_library_items_owner_artifact_unique",
    )
      .on(
        table.bizId,
        table.ownerUserId,
        table.ownerGroupAccountId,
        table.ownerSubjectType,
        table.ownerSubjectId,
        table.accessArtifactId,
      )
      .where(sql`"access_artifact_id" IS NOT NULL AND "deleted_at" IS NULL`),

    /** Main owner portal query path. */
    accessLibraryItemsOwnerStatusIdx: index("access_library_items_owner_status_idx").on(
      table.bizId,
      table.ownerUserId,
      table.ownerGroupAccountId,
      table.status,
      table.availabilityState,
      table.availableUntil,
    ),

    /** Tenant-safe FK to optional owner subject pointer. */
    accessLibraryItemsBizOwnerSubjectFk: foreignKey({
      columns: [table.bizId, table.ownerSubjectType, table.ownerSubjectId],
      foreignColumns: [subjects.bizId, subjects.subjectType, subjects.subjectId],
      name: "access_library_items_biz_owner_subject_fk",
    }),

    /** Tenant-safe FK to optional access artifact source. */
    accessLibraryItemsBizAccessArtifactFk: foreignKey({
      columns: [table.bizId, table.accessArtifactId],
      foreignColumns: [accessArtifacts.bizId, accessArtifacts.id],
      name: "access_library_items_biz_access_artifact_fk",
    }),

    /** Tenant-safe FK to optional usage-window source. */
    accessLibraryItemsBizAccessUsageWindowFk: foreignKey({
      columns: [table.bizId, table.accessUsageWindowId],
      foreignColumns: [accessUsageWindows.bizId, accessUsageWindows.id],
      name: "access_library_items_biz_access_usage_window_fk",
    }),

    /** Tenant-safe FK to optional sellable source. */
    accessLibraryItemsBizSellableFk: foreignKey({
      columns: [table.bizId, table.sellableId],
      foreignColumns: [sellables.bizId, sellables.id],
      name: "access_library_items_biz_sellable_fk",
    }),

    /** Tenant-safe FK to optional membership source. */
    accessLibraryItemsBizMembershipFk: foreignKey({
      columns: [table.bizId, table.membershipId],
      foreignColumns: [memberships.bizId, memberships.id],
      name: "access_library_items_biz_membership_fk",
    }),

    /** Tenant-safe FK to optional entitlement-grant source. */
    accessLibraryItemsBizEntitlementGrantFk: foreignKey({
      columns: [table.bizId, table.entitlementGrantId],
      foreignColumns: [entitlementGrants.bizId, entitlementGrants.id],
      name: "access_library_items_biz_entitlement_grant_fk",
    }),

    /** Owner subject pointer should be fully null or fully set. */
    accessLibraryItemsOwnerSubjectPairCheck: check(
      "access_library_items_owner_subject_pair_check",
      sql`
      (
        "owner_subject_type" IS NULL
        AND "owner_subject_id" IS NULL
      ) OR (
        "owner_subject_type" IS NOT NULL
        AND "owner_subject_id" IS NOT NULL
      )
      `,
    ),

    /** Exactly one owner pointer is required. */
    accessLibraryItemsOwnerShapeCheck: check(
      "access_library_items_owner_shape_check",
      sql`
      (
        ("owner_user_id" IS NOT NULL)::int
        + ("owner_group_account_id" IS NOT NULL)::int
        + ("owner_subject_type" IS NOT NULL)::int
      ) = 1
      `,
    ),

    /** At least one source pointer should exist so projections stay traceable. */
    accessLibraryItemsSourceShapeCheck: check(
      "access_library_items_source_shape_check",
      sql`
      (
        ("access_artifact_id" IS NOT NULL)::int
        + ("access_usage_window_id" IS NOT NULL)::int
        + ("sellable_id" IS NOT NULL)::int
        + ("membership_id" IS NOT NULL)::int
        + ("entitlement_grant_id" IS NOT NULL)::int
      ) >= 1
      `,
    ),

    /** Availability-state vocabulary guard with extension escape hatch. */
    accessLibraryItemsAvailabilityStateCheck: check(
      "access_library_items_availability_state_check",
      sql`
      "availability_state" IN ('available', 'scheduled', 'expiring', 'expired', 'suspended', 'consumed')
      OR "availability_state" LIKE 'custom_%'
      `,
    ),

    /** Quantity and timeline bounds. */
    accessLibraryItemsBoundsCheck: check(
      "access_library_items_bounds_check",
      sql`
      "projection_version" >= 1
      AND ("usage_granted" IS NULL OR "usage_granted" >= 0)
      AND ("usage_remaining" IS NULL OR "usage_remaining" >= 0)
      AND ("usage_granted" IS NULL OR "usage_remaining" IS NULL OR "usage_remaining" <= "usage_granted")
      AND ("available_from" IS NULL OR "available_until" IS NULL OR "available_until" >= "available_from")
      `,
    ),
  }),
);

export type AccessLibraryItem = typeof accessLibraryItems.$inferSelect;
export type NewAccessLibraryItem = typeof accessLibraryItems.$inferInsert;

