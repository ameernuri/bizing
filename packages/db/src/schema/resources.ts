import { sql } from "drizzle-orm";
import { check, foreignKey, index, uniqueIndex } from "drizzle-orm/pg-core";
import { boolean, integer, jsonb, pgTable, varchar } from "drizzle-orm/pg-core";
import { id, idRef, withAuditRefs } from "./_common";
import { lifecycleStatusEnum, resourceTypeEnum } from "./enums";
import { assets } from "./assets";
import { groupAccounts } from "./group_accounts";
import { locations } from "./locations";
import { bizes } from "./bizes";
import { services } from "./services";
import { users } from "./users";
import { venues } from "./venues";

/**
 * resource_status_definitions
 *
 * This table is the configurable status dictionary for resource rows.
 *
 * Why this table exists:
 * - Different businesses describe resource states differently.
 * - Hardcoding one global status enum makes cross-industry use harder.
 * - This dictionary lets each biz define names/slugs that match real operations.
 *
 * How it connects:
 * - `resources.status_definition_id` points here.
 * - Slot-finding and assignment logic typically uses `is_bookable` to decide
 *   whether rows in a given status should be considered available candidates.
 */
export const resourceStatusDefinitions = pgTable(
  "resource_status_definitions",
  {
    id,

    /** Tenant boundary; all status definitions are owned by one biz. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /**
     * Optional location override. Null means this status is biz-wide.
     * A non-null value means this definition is only for one location.
     */
    locationId: idRef("location_id").references(() => locations.id),

    /** Human label used in admin screens and internal tooling. */
    name: varchar("name", { length: 100 }).notNull(),

    /**
     * Stable machine key used by APIs/imports/filters.
     * Example: `active`, `out_of_service`, `cleaning`.
     */
    slug: varchar("slug", { length: 100 }).notNull(),

    /** Optional explanation shown to operators/admins. */
    description: varchar("description", { length: 600 }),

    /**
     * If false, scheduler should treat resources in this status as unavailable.
     * This powers operational toggles without deleting/archiving resources.
     */
    isBookable: boolean("is_bookable").default(true).notNull(),

    /** UI ordering hint for dropdowns/chips. */
    sortOrder: integer("sort_order").default(100).notNull(),

    /** Freeform extension payload for future status metadata. */
    metadata: jsonb("metadata").default({}),

    /** Audit metadata for who/when created/changed/deleted this row. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    resourceStatusDefinitionsBizIdIdUnique: uniqueIndex(
      "resource_status_definitions_biz_id_id_unique",
    ).on(table.bizId, table.id),
    resourceStatusDefinitionsBizLocationSlugUnique: uniqueIndex(
      "resource_status_definitions_biz_location_slug_unique",
    ).on(table.bizId, table.locationId, table.slug),
    resourceStatusDefinitionsBizSchedulableIdx: index(
      "resource_status_definitions_biz_schedulable_idx",
    ).on(table.bizId, table.isBookable),
    /** Tenant-safe optional location scope pointer. */
    resourceStatusDefinitionsBizLocationFk: foreignKey({
      columns: [table.bizId, table.locationId],
      foreignColumns: [locations.bizId, locations.id],
      name: "resource_status_definitions_biz_location_fk",
    }),
  }),
);

/**
 * resources
 *
 * Canonical polymorphic resource table.
 *
 * Mental model:
 * - A `service` describes requested work.
 * - A `resource` describes concrete supply that can fulfill/host that work.
 *
 * This table intentionally does NOT include service rows.
 * Resource types are strictly supply-side entities:
 * - host (individual person)
 * - company_host (group account / dispatch team)
 * - asset (equipment/object)
 * - venue (space/location unit)
 *
 * Strict invariants enforced here:
 * - `type` determines exactly which FK is populated.
 * - Type-target FK shape is checked at DB level.
 * - Capacity and simultaneous booking fields are validated for sane values.
 */
export const resources = pgTable(
  "resources",
  {
    id,

    /** Tenant boundary for partitioning and multi-tenant safety. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /**
     * Primary operating location for this resource.
     * Resource can still be made available elsewhere through calendars/policies,
     * but this is the default home location for filtering and routing.
     */
    locationId: idRef("location_id")
      .references(() => locations.id)
      .notNull(),

    /**
     * Polymorphic discriminator that defines what this row points to.
     * The `resources_type_target_shape_check` constraint below enforces shape.
     */
    type: resourceTypeEnum("type").notNull(),

    /** Display name used in assignment UIs and customer/admin views. */
    name: varchar("name", { length: 255 }).notNull(),

    /** Stable per-biz key used by APIs/routes/import tools. */
    slug: varchar("slug", { length: 120 }).notNull(),

    /** Optional narrative/notes about this resource. */
    description: varchar("description", { length: 1000 }),

    /** Timezone used when rendering this resource's schedule. */
    timezone: varchar("timezone", { length: 50 }).default("UTC").notNull(),

    /** Optional status pointer into biz-configured status dictionary. */
    statusDefinitionId: idRef("status_definition_id").references(
      () => resourceStatusDefinitions.id,
    ),

    /**
     * Target FK for `type = host`.
     * Points to canonical `users` identity for individual host resources.
     */
    hostUserId: idRef("host_user_id").references(() => users.id),

    /**
     * Target FK for `type = company_host`.
     * Points to a group account that represents a dispatchable team/company.
     */
    groupAccountId: idRef("group_account_id").references(
      () => groupAccounts.id,
    ),

    /** Target FK for `type = asset`. */
    assetId: idRef("asset_id").references(() => assets.id),

    /** Target FK for `type = venue`. */
    venueId: idRef("venue_id").references(() => venues.id),

    /** Optional resource capacity (seats/units). */
    capacity: integer("capacity"),

    /** Whether this resource allows overlapping bookings. */
    allowSimultaneousBookings: boolean("allow_simultaneous_bookings")
      .default(false)
      .notNull(),

    /** Max concurrent bookings allowed when overlap is enabled. */
    maxSimultaneousBookings: integer("max_simultaneous_bookings"),

    /**
     * Buffer added before each booking window for this resource.
     *
     * Examples:
     * - prep room before appointment
     * - inspect vehicle before rental
     * - setup equipment before session
     */
    bufferBeforeMinutes: integer("buffer_before_minutes").default(0).notNull(),

    /**
     * Buffer added after each booking window for this resource.
     *
     * Examples:
     * - cleanup/sanitization
     * - handoff/checkout steps
     * - reset equipment for next customer
     */
    bufferAfterMinutes: integer("buffer_after_minutes").default(0).notNull(),

    /** Extension payload for non-indexed custom attributes. */
    metadata: jsonb("metadata").default({}),

    /** Audit metadata for who/when created/changed/deleted this row. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    resourcesBizIdIdUnique: uniqueIndex("resources_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    resourcesBizSlugUnique: uniqueIndex("resources_biz_slug_unique").on(
      table.bizId,
      table.slug,
    ),
    resourcesBizTypeIdx: index("resources_biz_type_idx").on(
      table.bizId,
      table.type,
    ),
    resourcesBizStatusDefinitionIdx: index(
      "resources_biz_status_definition_idx",
    ).on(table.bizId, table.statusDefinitionId),
    /**
     * One canonical resource wrapper per underlying host user.
     *
     * This prevents duplicate schedule identities for the same person and keeps
     * assignment/conflict checks deterministic.
     */
    resourcesHostUserSingleWrapperUnique: uniqueIndex(
      "resources_host_user_single_wrapper_unique",
    )
      .on(table.hostUserId)
      .where(sql`"type" = 'host' AND "host_user_id" IS NOT NULL AND "deleted_at" IS NULL`),

    /**
     * One canonical resource wrapper per underlying company-host account.
     */
    resourcesGroupAccountSingleWrapperUnique: uniqueIndex(
      "resources_group_account_single_wrapper_unique",
    )
      .on(table.groupAccountId)
      .where(
        sql`"type" = 'company_host' AND "group_account_id" IS NOT NULL AND "deleted_at" IS NULL`,
      ),

    /**
     * One canonical resource wrapper per asset row.
     */
    resourcesAssetSingleWrapperUnique: uniqueIndex(
      "resources_asset_single_wrapper_unique",
    )
      .on(table.assetId)
      .where(sql`"type" = 'asset' AND "asset_id" IS NOT NULL AND "deleted_at" IS NULL`),

    /**
     * One canonical resource wrapper per venue row.
     */
    resourcesVenueSingleWrapperUnique: uniqueIndex(
      "resources_venue_single_wrapper_unique",
    )
      .on(table.venueId)
      .where(sql`"type" = 'venue' AND "venue_id" IS NOT NULL AND "deleted_at" IS NULL`),

    /** Keeps resource location pointer inside the same tenant boundary. */
    resourcesBizLocationFk: foreignKey({
      columns: [table.bizId, table.locationId],
      foreignColumns: [locations.bizId, locations.id],
      name: "resources_biz_location_fk",
    }),

    /** Keeps resource status-definition pointer inside the same tenant boundary. */
    resourcesBizStatusDefinitionFk: foreignKey({
      columns: [table.bizId, table.statusDefinitionId],
      foreignColumns: [resourceStatusDefinitions.bizId, resourceStatusDefinitions.id],
      name: "resources_biz_status_definition_fk",
    }),

    /** Keeps company-host target pointer inside the same tenant boundary. */
    resourcesBizGroupAccountFk: foreignKey({
      columns: [table.bizId, table.groupAccountId],
      foreignColumns: [groupAccounts.bizId, groupAccounts.id],
      name: "resources_biz_group_account_fk",
    }),

    /** Keeps asset target pointer inside the same tenant boundary. */
    resourcesBizAssetFk: foreignKey({
      columns: [table.bizId, table.assetId],
      foreignColumns: [assets.bizId, assets.id],
      name: "resources_biz_asset_fk",
    }),

    /** Keeps venue target pointer inside the same tenant boundary. */
    resourcesBizVenueFk: foreignKey({
      columns: [table.bizId, table.venueId],
      foreignColumns: [venues.bizId, venues.id],
      name: "resources_biz_venue_fk",
    }),

    /** Capacity must be positive when present. */
    resourcesCapacityPositiveCheck: check(
      "resources_capacity_positive_check",
      sql`"capacity" IS NULL OR "capacity" > 0`,
    ),

    /** Max simultaneous bookings must be positive when present. */
    resourcesMaxSimultaneousPositiveCheck: check(
      "resources_max_simultaneous_positive_check",
      sql`"max_simultaneous_bookings" IS NULL OR "max_simultaneous_bookings" > 0`,
    ),
    /** Resource-level pre-buffer cannot be negative. */
    resourcesBufferBeforeMinutesNonNegativeCheck: check(
      "resources_buffer_before_minutes_non_negative_check",
      sql`"buffer_before_minutes" >= 0`,
    ),
    /** Resource-level post-buffer cannot be negative. */
    resourcesBufferAfterMinutesNonNegativeCheck: check(
      "resources_buffer_after_minutes_non_negative_check",
      sql`"buffer_after_minutes" >= 0`,
    ),

    /**
     * If overlap is disabled, max simultaneous must be unset or effectively 1.
     * This keeps semantics clear for scheduling/conflict checks.
     */
    resourcesSimultaneousConsistencyCheck: check(
      "resources_simultaneous_consistency_check",
      sql`"allow_simultaneous_bookings" = true OR "max_simultaneous_bookings" IS NULL OR "max_simultaneous_bookings" <= 1`,
    ),

    /**
     * Strict type-target invariant:
     * exactly one target FK must be populated, according to resource type.
     */
    resourcesTypeTargetShapeCheck: check(
      "resources_type_target_shape_check",
      sql`
      (
        "type" = 'host'
        AND "host_user_id" IS NOT NULL
        AND "group_account_id" IS NULL
        AND "asset_id" IS NULL
        AND "venue_id" IS NULL
      ) OR (
        "type" = 'company_host'
        AND "host_user_id" IS NULL
        AND "group_account_id" IS NOT NULL
        AND "asset_id" IS NULL
        AND "venue_id" IS NULL
      ) OR (
        "type" = 'asset'
        AND "host_user_id" IS NULL
        AND "group_account_id" IS NULL
        AND "asset_id" IS NOT NULL
        AND "venue_id" IS NULL
      ) OR (
        "type" = 'venue'
        AND "host_user_id" IS NULL
        AND "group_account_id" IS NULL
        AND "asset_id" IS NULL
        AND "venue_id" IS NOT NULL
      )
      `,
    ),
  }),
);

/**
 * host_users
 *
 * Host-specific profile extension for a `resources(type=host)` row.
 *
 * Why this is separate from `resources`:
 * - Keeps core resource table generic/lean.
 * - Stores host-only operational attributes without null-bloating resource rows.
 *
 * Capability note:
 * - host "specialties" are not stored in host-only tables anymore.
 * - use shared `resource_capability_templates` and
 *   `resource_capability_assignments` from `supply.ts` so hosts, assets,
 *   venues, and company-host groups all use one capability backbone.
 */
export const hostUsers = pgTable(
  "host_users",
  {
    id,

    /** Tenant boundary for ownership/filtering. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** One-to-one pointer to the root resource row (type must be host). */
    resourceId: idRef("resource_id")
      .references(() => resources.id)
      .notNull(),

    /** Optional direct link to canonical auth/user identity row. */
    userId: idRef("user_id").references(() => users.id),

    /** Optional contact email for dispatch/ops workflows. */
    email: varchar("email", { length: 255 }),

    /** Optional contact phone for dispatch/ops workflows. */
    phone: varchar("phone", { length: 50 }),

    /** Host bio/summary for customer-facing selection pages. */
    bio: varchar("bio", { length: 1500 }),

    /** Languages spoken/served by host for matching/filtering. */
    languages: jsonb("languages").default([]),

    /** Max travel radius for mobile/on-site jobs. */
    travelRadiusMiles: integer("travel_radius_miles"),

    /** Daily booking load guardrail. */
    maxDailyBookings: integer("max_daily_bookings"),

    /** Required rest buffer between consecutive host assignments. */
    minRestBetweenBookingsMin: integer("min_rest_between_bookings_min")
      .default(0)
      .notNull(),

    /** Payment/compensation preferences (kept flexible as JSON). */
    paymentProfile: jsonb("payment_profile").default({}),

    /** Optional quality/rating summary fields. */
    rating: integer("rating"),
    reviewCount: integer("review_count").default(0).notNull(),

    /** Host profile lifecycle independent from core resource row lifecycle. */
    status: lifecycleStatusEnum("status").default("active").notNull(),

    /** Extension payload for host-only custom fields. */
    metadata: jsonb("metadata").default({}),

    /** Audit metadata for who/when created/changed/deleted this row. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    hostUsersBizIdIdUnique: uniqueIndex("host_users_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    hostUsersResourceUnique: uniqueIndex("host_users_resource_unique").on(
      table.resourceId,
    ),
    hostUsersBizStatusIdx: index("host_users_biz_status_idx").on(
      table.bizId,
      table.status,
    ),
    /** Tenant-safe FK to wrapped resource row. */
    hostUsersBizResourceFk: foreignKey({
      columns: [table.bizId, table.resourceId],
      foreignColumns: [resources.bizId, resources.id],
      name: "host_users_biz_resource_fk",
    }),
  }),
);

/**
 * host_groups
 *
 * Group/company host profile extension for `resources(type=company_host)`.
 */
export const hostGroups = pgTable(
  "host_groups",
  {
    id,

    /** Tenant boundary for ownership/filtering. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** One-to-one pointer to root resource row (type must be company_host). */
    resourceId: idRef("resource_id")
      .references(() => resources.id)
      .notNull(),

    /** Backing group account identity used for members/delegation. */
    groupAccountId: idRef("group_account_id")
      .references(() => groupAccounts.id)
      .notNull(),

    /** Optional dispatch/public contact fields. */
    email: varchar("email", { length: 255 }),
    phone: varchar("phone", { length: 50 }),
    website: varchar("website", { length: 500 }),

    /** Dispatch mode hint used by scheduling/assignment layer. */
    dispatchMethod: varchar("dispatch_method", { length: 50 })
      .default("manual")
      .notNull(),

    /** Service radius used for mobile/on-site matching. */
    serviceRadiusMiles: integer("service_radius_miles"),

    /** Optional company-level hours object for dispatch policy checks. */
    businessHours: jsonb("business_hours").default({}),

    /** Host-group lifecycle state independent from root resource row. */
    status: lifecycleStatusEnum("status").default("active").notNull(),

    /** Extension payload for host-group custom fields. */
    metadata: jsonb("metadata").default({}),

    /** Audit metadata for who/when created/changed/deleted this row. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    hostGroupsBizIdIdUnique: uniqueIndex("host_groups_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    hostGroupsResourceUnique: uniqueIndex("host_groups_resource_unique").on(
      table.resourceId,
    ),
    hostGroupsBizStatusIdx: index("host_groups_biz_status_idx").on(
      table.bizId,
      table.status,
    ),
    /** Tenant-safe FK to wrapped company-host resource row. */
    hostGroupsBizResourceFk: foreignKey({
      columns: [table.bizId, table.resourceId],
      foreignColumns: [resources.bizId, resources.id],
      name: "host_groups_biz_resource_fk",
    }),
    /** Tenant-safe FK to backing group-account identity. */
    hostGroupsBizGroupAccountFk: foreignKey({
      columns: [table.bizId, table.groupAccountId],
      foreignColumns: [groupAccounts.bizId, groupAccounts.id],
      name: "host_groups_biz_group_account_fk",
    }),
  }),
);

/**
 * host_group_members
 *
 * Membership join table for users inside a host group.
 *
 * This keeps dispatch membership normalized and auditable.
 */
export const hostGroupMembers = pgTable(
  "host_group_members",
  {
    id,
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),
    hostGroupId: idRef("host_group_id")
      .references(() => hostGroups.id)
      .notNull(),
    userId: idRef("user_id")
      .references(() => users.id)
      .notNull(),

    /**
     * Role inside host group operating pool.
     * Examples: member, dispatcher, lead, contractor.
     */
    role: varchar("role", { length: 50 }).default("member").notNull(),

    /** Whether this member can be auto-assigned to jobs. */
    isAssignable: boolean("is_assignable").default(true).notNull(),

    metadata: jsonb("metadata").default({}),
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    hostGroupMembersUnique: uniqueIndex("host_group_members_unique").on(
      table.hostGroupId,
      table.userId,
    ),
    hostGroupMembersBizGroupIdx: index("host_group_members_biz_group_idx").on(
      table.bizId,
      table.hostGroupId,
    ),
    hostGroupMembersBizUserIdx: index("host_group_members_biz_user_idx").on(
      table.bizId,
      table.userId,
    ),
    /** Tenant-safe FK to host-group parent. */
    hostGroupMembersBizHostGroupFk: foreignKey({
      columns: [table.bizId, table.hostGroupId],
      foreignColumns: [hostGroups.bizId, hostGroups.id],
      name: "host_group_members_biz_host_group_fk",
    }),
  }),
);

/**
 * resource_service_capabilities
 *
 * Compatibility matrix between resources and services.
 *
 * Purpose:
 * - Declares which resources can fulfill which service templates.
 * - Keeps eligibility logic out of hardcoded app conditions.
 * - Supports scoped overrides by location.
 *
 * How it is used with service products:
 * - Product requirements/selectors define candidate pools.
 * - This table filters candidates to only service-compatible resources.
 * - Calendar/availability rules then determine time-slot feasibility.
 */
export const resourceServiceCapabilities = pgTable(
  "resource_service_capabilities",
  {
    id,
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Candidate resource row being declared as capable/incapable. */
    resourceId: idRef("resource_id")
      .references(() => resources.id)
      .notNull(),

    /** Service template this capability row applies to. */
    serviceId: idRef("service_id")
      .references(() => services.id)
      .notNull(),

    /** Optional location-level override; null means all locations. */
    locationId: idRef("location_id").references(() => locations.id),

    /** Feature flag for temporarily disabling a capability row. */
    isEnabled: boolean("is_enabled").default(true).notNull(),

    /** Priority hint for candidate ranking/selection logic. */
    priority: integer("priority").default(100).notNull(),

    /** Optional human-readable note for operations/admin context. */
    description: varchar("description", { length: 600 }),

    metadata: jsonb("metadata").default({}),
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    resourceServiceCapabilitiesUnique: uniqueIndex(
      "resource_service_capabilities_unique",
    ).on(table.resourceId, table.serviceId, table.locationId),
    resourceServiceCapabilitiesBizServiceIdx: index(
      "resource_service_capabilities_biz_service_idx",
    ).on(table.bizId, table.serviceId, table.isEnabled),
    resourceServiceCapabilitiesBizResourceIdx: index(
      "resource_service_capabilities_biz_resource_idx",
    ).on(table.bizId, table.resourceId, table.isEnabled),
    /** Tenant-safe FK to resource candidate. */
    resourceServiceCapabilitiesBizResourceFk: foreignKey({
      columns: [table.bizId, table.resourceId],
      foreignColumns: [resources.bizId, resources.id],
      name: "resource_service_capabilities_biz_resource_fk",
    }),
    /** Tenant-safe FK to service template. */
    resourceServiceCapabilitiesBizServiceFk: foreignKey({
      columns: [table.bizId, table.serviceId],
      foreignColumns: [services.bizId, services.id],
      name: "resource_service_capabilities_biz_service_fk",
    }),
    /** Tenant-safe FK to optional location override. */
    resourceServiceCapabilitiesBizLocationFk: foreignKey({
      columns: [table.bizId, table.locationId],
      foreignColumns: [locations.bizId, locations.id],
      name: "resource_service_capabilities_biz_location_fk",
    }),
  }),
);

export type Resource = typeof resources.$inferSelect;
export type NewResource = typeof resources.$inferInsert;

export type ResourceStatusDefinition =
  typeof resourceStatusDefinitions.$inferSelect;
export type NewResourceStatusDefinition =
  typeof resourceStatusDefinitions.$inferInsert;

export type HostUser = typeof hostUsers.$inferSelect;
export type NewHostUser = typeof hostUsers.$inferInsert;

export type HostGroup = typeof hostGroups.$inferSelect;
export type NewHostGroup = typeof hostGroups.$inferInsert;

export type HostGroupMember = typeof hostGroupMembers.$inferSelect;
export type NewHostGroupMember = typeof hostGroupMembers.$inferInsert;

export type ResourceServiceCapability =
  typeof resourceServiceCapabilities.$inferSelect;
export type NewResourceServiceCapability =
  typeof resourceServiceCapabilities.$inferInsert;
