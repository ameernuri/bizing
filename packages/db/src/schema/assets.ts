import { index, uniqueIndex } from "drizzle-orm/pg-core";
import { boolean, integer, jsonb, pgTable, text, varchar } from "drizzle-orm/pg-core";
import { id, idRef, withAuditRefs } from "./_common";
import { locations } from "./locations";
import { bizes } from "./bizes";
import { schedules } from "./scheduling";
import { users } from "./users";

/**
 * asset_categories
 *
 * Lightweight taxonomy for asset classification.
 *
 * Relationship map:
 * - Referenced by `assets.category_id`.
 * - Enables category-based filtering and reporting without embedding category
 *   labels on each asset row.
 */
export const assetCategories = pgTable("asset_categories", {
  id,

  /** Tenant boundary so categories are private per biz. */
  bizId: idRef("biz_id")
    .references(() => bizes.id)
    .notNull(),

  /** Human-readable category name shown in admin/filters. */
  name: varchar("name", { length: 100 }).notNull(),

  /** Stable API/UI key for routes and integrations. */
  slug: varchar("slug", { length: 100 }).notNull(),

  /** Optional explanation/help text for admins. */
  description: text("description"),

  /** Audit actor/timestamp columns. */
  ...withAuditRefs(() => users.id),
});

/**
 * asset_status_definitions
 *
 * Biz-configurable status dictionary for assets.
 *
 * Why this exists:
 * - Replaces hardcoded status enums with tenant-owned statuses.
 * - Supports branch-specific vocabularies via optional `location_id`.
 * - Tag scoping is handled by `asset_status_definition_tag_scopes` so each
 *   asset-tag template can expose different allowed statuses.
 */
export const assetStatusDefinitions = pgTable(
  "asset_status_definitions",
  {
    id,

    /** Tenant boundary for status ownership and query filtering. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Optional branch-specific status definition. Null means org-wide. */
    locationId: idRef("location_id").references(() => locations.id),

    /** Human label shown in admin and assignment UX. */
    name: varchar("name", { length: 100 }).notNull(),

    /** Stable key used in APIs and filters (example: `active`, `out_of_service`). */
    slug: varchar("slug", { length: 100 }).notNull(),

    /** Optional help text with operational meaning for this status. */
    description: text("description"),

    /** If false, scheduler should treat assets with this status as unavailable. */
    isBookable: boolean("is_bookable").default(true).notNull(),

    /** Per-scope default used when a new asset is created without explicit status. */
    isDefault: boolean("is_default").default(false).notNull(),

    /** UI ordering hint for status dropdowns/chips. */
    sortOrder: integer("sort_order").default(100).notNull(),

    metadata: jsonb("metadata").default({}),
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    assetStatusDefinitionsBizLocationSlugUnique: uniqueIndex(
      "asset_status_definitions_biz_location_slug_unique",
    ).on(table.bizId, table.locationId, table.slug),
    assetStatusDefinitionsBizBookableIdx: index(
      "asset_status_definitions_biz_bookable_idx",
    ).on(table.bizId, table.isBookable),
  }),
);

/**
 * assets
 *
 * Tangible resources/equipment inventory used by booking assignments.
 *
 * Relationship map:
 * - `bookables.asset_id` links a generic schedulable resource to this row.
 * - `bookings.asset_id` stores direct assignments for simple workflows.
 * - `asset_tag_assignments.asset_id` links assets to predefined tag templates.
 */
export const assets = pgTable(
  "assets",
  {
    id,

    /** Tenant boundary for inventory ownership and filtering. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Optional branch where this asset is normally located. */
    locationId: idRef("location_id").references(() => locations.id),

    /** Optional taxonomy grouping for operational reporting/filtering. */
    categoryId: idRef("category_id").references(() => assetCategories.id),

    /** Display name used in assignment UX and admin lists. */
    name: varchar("name", { length: 255 }).notNull(),

    /** Stable per-org identifier for API routes and imports. */
    slug: varchar("slug", { length: 100 }).notNull(),
    description: text("description"),

    /**
     * Optional pointer to the configured status definition row.
     * Null is allowed for legacy rows and migration windows.
     */
    statusDefinitionId: idRef("status_definition_id").references(
      () => assetStatusDefinitions.id,
    ),

    /**
     * Denormalized status key for simple filters and backward compatibility.
     * Recommended value source: `asset_status_definitions.slug`.
     */
    status: varchar("status", { length: 100 }).default("active").notNull(),

    /** Max simultaneous capacity if asset supports multi-occupancy use. */
    capacity: integer("capacity"),

    /** Optional reusable schedule profile (availability, maintenance, policy windows). */
    scheduleId: idRef("schedule_id").references(() => schedules.id),

    /**
     * External calendar id for synced assets/resources.
     * Used by Google/Microsoft calendar sync and third-party schedulers that
     * map an internal asset to their external resource identifier.
     */
    calendarId: varchar("calendar_id", { length: 100 }),

    /** Extension payload for model-specific attributes. */
    metadata: jsonb("metadata").default({}),

    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    assetsBizSlugUnique: uniqueIndex("assets_biz_slug_unique").on(
      table.bizId,
      table.slug,
    ),
    assetsBizStatusIdx: index("assets_biz_status_idx").on(
      table.bizId,
      table.status,
    ),
    assetsBizStatusDefinitionIdx: index("assets_biz_status_definition_idx").on(
      table.bizId,
      table.statusDefinitionId,
    ),
  }),
);

export type AssetStatusDefinition = typeof assetStatusDefinitions.$inferSelect;
export type NewAssetStatusDefinition = typeof assetStatusDefinitions.$inferInsert;

export type Asset = typeof assets.$inferSelect;
export type NewAsset = typeof assets.$inferInsert;

/**
 * asset_tag_templates
 *
 * Biz-defined dictionary of reusable asset tags.
 *
 * Setup flow:
 * - Admin creates these once during onboarding/configuration.
 * - Assets then select from these templates instead of creating ad-hoc tags.
 */
export const assetTagTemplates = pgTable(
  "asset_tag_templates",
  {
    id,

    /** Tenant boundary for template ownership and filtering. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Human label shown in setup and asset editors. */
    name: varchar("name", { length: 100 }).notNull(),

    /** Stable key used for APIs/imports and uniqueness per biz. */
    slug: varchar("slug", { length: 100 }).notNull(),

    /** Optional help text describing when this tag should be used. */
    description: varchar("description", { length: 500 }),

    /** Audit actor/timestamp columns. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    assetTagTemplatesBizSlugUnique: uniqueIndex(
      "asset_tag_templates_biz_slug_unique",
    ).on(table.bizId, table.slug),
    assetTagTemplatesBizNameIdx: index("asset_tag_templates_biz_name_idx").on(
      table.bizId,
      table.name,
    ),
  }),
);

/**
 * asset_tag_assignments
 *
 * Join table connecting assets to predefined templates.
 */
export const assetTagAssignments = pgTable(
  "asset_tag_assignments",
  {
    id,
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),
    assetId: idRef("asset_id")
      .references(() => assets.id)
      .notNull(),
    templateId: idRef("template_id")
      .references(() => assetTagTemplates.id)
      .notNull(),
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    assetTagAssignmentsUnique: uniqueIndex("asset_tag_assignments_unique").on(
      table.assetId,
      table.templateId,
    ),
    assetTagAssignmentsBizTemplateIdx: index(
      "asset_tag_assignments_biz_template_idx",
    ).on(table.bizId, table.templateId),
    assetTagAssignmentsBizAssetIdx: index(
      "asset_tag_assignments_biz_asset_idx",
    ).on(table.bizId, table.assetId),
  }),
);

/**
 * asset_status_definition_tag_scopes
 *
 * Optional constraint map that defines which status definitions are valid for
 * each asset tag template.
 */
export const assetStatusDefinitionTagScopes = pgTable(
  "asset_status_definition_tag_scopes",
  {
    id,
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),
    statusDefinitionId: idRef("status_definition_id")
      .references(() => assetStatusDefinitions.id)
      .notNull(),
    templateId: idRef("template_id")
      .references(() => assetTagTemplates.id)
      .notNull(),
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    assetStatusDefinitionTagScopesUnique: uniqueIndex(
      "asset_status_definition_tag_scopes_unique",
    ).on(table.bizId, table.statusDefinitionId, table.templateId),
    assetStatusDefinitionTagScopesTemplateIdx: index(
      "asset_status_definition_tag_scopes_template_idx",
    ).on(table.bizId, table.templateId),
  }),
);

export type AssetCategory = typeof assetCategories.$inferSelect;
export type NewAssetCategory = typeof assetCategories.$inferInsert;

export type AssetTagTemplate = typeof assetTagTemplates.$inferSelect;
export type NewAssetTagTemplate = typeof assetTagTemplates.$inferInsert;

export type AssetTagAssignment = typeof assetTagAssignments.$inferSelect;
export type NewAssetTagAssignment = typeof assetTagAssignments.$inferInsert;

export type AssetStatusDefinitionTagScope =
  typeof assetStatusDefinitionTagScopes.$inferSelect;
export type NewAssetStatusDefinitionTagScope =
  typeof assetStatusDefinitionTagScopes.$inferInsert;

/** Backwards-compat type aliases for previous single-table model. */
export type AssetTag = AssetTagAssignment;
export type NewAssetTag = NewAssetTagAssignment;
