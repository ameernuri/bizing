import { sql } from "drizzle-orm";
import { check, foreignKey, index, pgTable, uniqueIndex } from "drizzle-orm/pg-core";
import { boolean, integer, jsonb, timestamp, varchar } from "drizzle-orm/pg-core";
import { bizes } from "./bizes";
import { idRef, idWithTag, withAuditRefs } from "./_common";
import { locations } from "./locations";
import { resources } from "./resources";
import { subjects } from "./subjects";
import { users } from "./users";
import { authzPermissionEffectEnum, authzScopeTypeEnum, lifecycleStatusEnum } from "./enums";

/**
 * authz_permission_definitions
 *
 * ELI5:
 * This is the dictionary of "what action names exist".
 *
 * Example keys:
 * - `offers.read`
 * - `offers.create`
 * - `booking_orders.status.update`
 *
 * Why this table exists:
 * - keeps permission vocabulary explicit and discoverable,
 * - lets admins and APIs use stable keys instead of hardcoded role checks,
 * - supports plugins adding new permission keys in a normalized way.
 */
export const authzPermissionDefinitions = pgTable(
  "authz_permission_definitions",
  {
    /** Stable primary key for one permission definition. */
    id: idWithTag("authz_perm"),

    /** Stable machine key used by middleware and API guards. */
    permissionKey: varchar("permission_key", { length: 180 }).notNull(),

    /** Human label for admin tooling. */
    name: varchar("name", { length: 220 }).notNull(),

    /** Optional long description shown in ACL UI. */
    description: varchar("description", { length: 1000 }),

    /** Logical module grouping (catalog, scheduling, bookings, etc.). */
    moduleKey: varchar("module_key", { length: 120 }).default("core").notNull(),

    /** True when this row is seeded/owned by platform code. */
    isSystem: boolean("is_system").default(false).notNull(),

    /** Extensible payload for UI tags, deprecation hints, plugin ownership, etc. */
    metadata: jsonb("metadata").default({}).notNull(),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Permission keys are globally unique across the deployment. */
    authzPermissionDefinitionsKeyUnique: uniqueIndex(
      "authz_permission_definitions_key_unique",
    ).on(table.permissionKey),

    /** Common list/filter path for admin permission libraries. */
    authzPermissionDefinitionsModuleIdx: index("authz_permission_definitions_module_idx").on(
      table.moduleKey,
      table.isSystem,
    ),

    /** Keep dictionary keys non-empty. */
    authzPermissionDefinitionsNonEmptyCheck: check(
      "authz_permission_definitions_non_empty_check",
      sql`length("permission_key") > 0 AND length("module_key") > 0`,
    ),
  }),
);

/**
 * authz_role_definitions
 *
 * ELI5:
 * A role is a named bundle of permissions (example: "manager").
 *
 * Scope model:
 * - `scope_type` says what layer this role belongs to.
 * - `scope_ref` is a canonical key used for stable uniqueness and lookups.
 *
 * Canonical scope_ref examples:
 * - platform: `platform`
 * - biz: `biz:<biz_id>`
 * - location: `location:<location_id>`
 * - resource: `resource:<resource_id>`
 * - subject: `subject:<subject_type>:<subject_id>`
 */
export const authzRoleDefinitions = pgTable(
  "authz_role_definitions",
  {
    /** Stable primary key for one role definition. */
    id: idWithTag("authz_role"),

    /**
     * Optional tenant boundary for scoped role templates.
     * Null means this role is platform-global.
     */
    bizId: idRef("biz_id").references(() => bizes.id),

    /** Scope discriminator used by ACL resolvers. */
    scopeType: authzScopeTypeEnum("scope_type").notNull(),

    /**
     * Canonical stable scope key.
     * This keeps uniqueness deterministic even when nullable target columns are used.
     */
    scopeRef: varchar("scope_ref", { length: 280 }).notNull(),

    /** Optional typed scope targets for efficient joins and validations. */
    locationId: idRef("location_id").references(() => locations.id),
    resourceId: idRef("resource_id").references(() => resources.id),
    scopeSubjectType: varchar("scope_subject_type", { length: 80 }),
    scopeSubjectId: varchar("scope_subject_id", { length: 140 }),

    /** Stable machine key for role lookup/import. */
    roleKey: varchar("role_key", { length: 140 }).notNull(),

    /** Human-facing role name. */
    name: varchar("name", { length: 220 }).notNull(),

    /** Optional long description of role intent/usage. */
    description: varchar("description", { length: 1000 }),

    /** Lifecycle status so role sets can be retired safely. */
    status: lifecycleStatusEnum("status").default("active").notNull(),

    /** System marker for seeded roles. */
    isSystem: boolean("is_system").default(false).notNull(),

    /** Convenience marker for default selectable role templates. */
    isDefault: boolean("is_default").default(false).notNull(),

    /** Extensible role metadata (labels, icon hints, plugin ownership, etc.). */
    metadata: jsonb("metadata").default({}).notNull(),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    authzRoleDefinitionsBizIdIdUnique: uniqueIndex("authz_role_definitions_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** One role key per scope_ref for deterministic ACL behavior. */
    authzRoleDefinitionsScopeRoleUnique: uniqueIndex(
      "authz_role_definitions_scope_role_unique",
    ).on(table.scopeRef, table.roleKey),

    /** Common route for listing editable roles in one tenant. */
    authzRoleDefinitionsBizScopeStatusIdx: index("authz_role_definitions_biz_scope_status_idx").on(
      table.bizId,
      table.scopeType,
      table.status,
    ),

    /** Tenant-safe typed scope FKs. */
    authzRoleDefinitionsBizLocationFk: foreignKey({
      columns: [table.bizId, table.locationId],
      foreignColumns: [locations.bizId, locations.id],
      name: "authz_role_definitions_biz_location_fk",
    }),
    authzRoleDefinitionsBizResourceFk: foreignKey({
      columns: [table.bizId, table.resourceId],
      foreignColumns: [resources.bizId, resources.id],
      name: "authz_role_definitions_biz_resource_fk",
    }),
    authzRoleDefinitionsBizSubjectFk: foreignKey({
      columns: [table.bizId, table.scopeSubjectType, table.scopeSubjectId],
      foreignColumns: [subjects.bizId, subjects.subjectType, subjects.subjectId],
      name: "authz_role_definitions_biz_subject_fk",
    }),

    /** Subject pointer should be all-null or fully set. */
    authzRoleDefinitionsScopeSubjectPairCheck: check(
      "authz_role_definitions_scope_subject_pair_check",
      sql`
      (
        "scope_subject_type" IS NULL
        AND "scope_subject_id" IS NULL
      ) OR (
        "scope_subject_type" IS NOT NULL
        AND "scope_subject_id" IS NOT NULL
      )
      `,
    ),

    /** Typed payload must match scope type exactly. */
    authzRoleDefinitionsScopeShapeCheck: check(
      "authz_role_definitions_scope_shape_check",
      sql`
      (
        "scope_type" = 'platform'
        AND "biz_id" IS NULL
        AND "location_id" IS NULL
        AND "resource_id" IS NULL
        AND "scope_subject_type" IS NULL
        AND "scope_subject_id" IS NULL
        AND "scope_ref" = 'platform'
      ) OR (
        "scope_type" = 'biz'
        AND "biz_id" IS NOT NULL
        AND "location_id" IS NULL
        AND "resource_id" IS NULL
        AND "scope_subject_type" IS NULL
        AND "scope_subject_id" IS NULL
      ) OR (
        "scope_type" = 'location'
        AND "biz_id" IS NOT NULL
        AND "location_id" IS NOT NULL
        AND "resource_id" IS NULL
        AND "scope_subject_type" IS NULL
        AND "scope_subject_id" IS NULL
      ) OR (
        "scope_type" = 'resource'
        AND "biz_id" IS NOT NULL
        AND "location_id" IS NULL
        AND "resource_id" IS NOT NULL
        AND "scope_subject_type" IS NULL
        AND "scope_subject_id" IS NULL
      ) OR (
        "scope_type" = 'subject'
        AND "biz_id" IS NOT NULL
        AND "location_id" IS NULL
        AND "resource_id" IS NULL
        AND "scope_subject_type" IS NOT NULL
        AND "scope_subject_id" IS NOT NULL
      )
      `,
    ),

    authzRoleDefinitionsIdentityCheck: check(
      "authz_role_definitions_identity_check",
      sql`length("scope_ref") > 0 AND length("role_key") > 0`,
    ),
  }),
);

/**
 * authz_role_permissions
 *
 * ELI5:
 * This table says which permissions a role allows/denies.
 *
 * Why this is separate:
 * - keeps role definitions reusable,
 * - keeps permission catalog normalized,
 * - supports explicit deny rows for sensitive actions.
 */
export const authzRolePermissions = pgTable(
  "authz_role_permissions",
  {
    id: idWithTag("authz_role_perm"),

    /** Parent role definition that owns this row. */
    roleDefinitionId: idRef("role_definition_id")
      .references(() => authzRoleDefinitions.id)
      .notNull(),

    /** Permission dictionary row referenced by this rule. */
    permissionDefinitionId: idRef("permission_definition_id")
      .references(() => authzPermissionDefinitions.id)
      .notNull(),

    /** Allow/deny effect for this role-permission pair. */
    effect: authzPermissionEffectEnum("effect").default("allow").notNull(),

    /** Priority for deterministic tie-breaking within same specificity. */
    priority: integer("priority").default(100).notNull(),

    /** Runtime toggle so admins can disable a row without deleting history. */
    isActive: boolean("is_active").default(true).notNull(),

    /** Optional future condition payload for ABAC-style enrichments. */
    condition: jsonb("condition").default({}).notNull(),

    /** Extensible metadata. */
    metadata: jsonb("metadata").default({}).notNull(),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** One active row per (role, permission) pair. */
    authzRolePermissionsUnique: uniqueIndex("authz_role_permissions_unique").on(
      table.roleDefinitionId,
      table.permissionDefinitionId,
    ),

    /** Common ACL resolver lookup path. */
    authzRolePermissionsRoleActiveIdx: index("authz_role_permissions_role_active_idx").on(
      table.roleDefinitionId,
      table.isActive,
      table.priority,
    ),

    authzRolePermissionsPriorityCheck: check(
      "authz_role_permissions_priority_check",
      sql`"priority" >= 0`,
    ),
  }),
);

/**
 * authz_membership_role_mappings
 *
 * ELI5:
 * This table bridges Better Auth org membership roles to configurable ACL roles.
 *
 * Why this exists:
 * - membership role names (`owner`, `manager`, etc.) come from org lifecycle,
 * - ACL role bundles are configurable and may evolve over time,
 * - this mapping keeps "org role" and "ACL role" decoupled but connected.
 */
export const authzMembershipRoleMappings = pgTable(
  "authz_membership_role_mappings",
  {
    id: idWithTag("authz_member_map"),

    /**
     * Optional tenant override scope.
     * Null rows are platform defaults.
     */
    bizId: idRef("biz_id").references(() => bizes.id),

    /** Membership role text from Better Auth member rows. */
    membershipRole: varchar("membership_role", { length: 60 }).notNull(),

    /** ACL role applied when this mapping matches. */
    roleDefinitionId: idRef("role_definition_id")
      .references(() => authzRoleDefinitions.id)
      .notNull(),

    /** Runtime toggle for staged rollouts. */
    isActive: boolean("is_active").default(true).notNull(),

    /** Priority used when multiple mappings exist for same membership role. */
    priority: integer("priority").default(100).notNull(),

    /** Extensible metadata. */
    metadata: jsonb("metadata").default({}).notNull(),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    authzMembershipRoleMappingsBizIdIdUnique: uniqueIndex(
      "authz_membership_role_mappings_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** One mapping row per exact tuple. */
    authzMembershipRoleMappingsUnique: uniqueIndex("authz_membership_role_mappings_unique").on(
      table.bizId,
      table.membershipRole,
      table.roleDefinitionId,
    ),

    /** Lookup path for mapping membership role -> ACL role. */
    authzMembershipRoleMappingsLookupIdx: index("authz_membership_role_mappings_lookup_idx").on(
      table.bizId,
      table.membershipRole,
      table.isActive,
      table.priority,
    ),

    authzMembershipRoleMappingsBoundsCheck: check(
      "authz_membership_role_mappings_bounds_check",
      sql`length("membership_role") > 0 AND "priority" >= 0`,
    ),
  }),
);

/**
 * authz_role_assignments
 *
 * ELI5:
 * This table answers: "Which user has which ACL role at which scope?"
 *
 * Scope is explicit and hierarchical:
 * - platform
 * - biz
 * - location
 * - resource
 * - subject (extensible plugin/custom target)
 *
 * This enables admins to delegate granular access safely without hardcoding.
 */
export const authzRoleAssignments = pgTable(
  "authz_role_assignments",
  {
    id: idWithTag("authz_assign"),

    /** User receiving this role assignment. */
    userId: idRef("user_id")
      .references(() => users.id)
      .notNull(),

    /** Optional tenant boundary for non-platform assignments. */
    bizId: idRef("biz_id").references(() => bizes.id),

    /** Assigned role bundle. */
    roleDefinitionId: idRef("role_definition_id")
      .references(() => authzRoleDefinitions.id)
      .notNull(),

    /** Scope discriminator for this assignment. */
    scopeType: authzScopeTypeEnum("scope_type").notNull(),

    /**
     * Canonical scope key used by evaluators and uniqueness constraints.
     * Must match the assignment payload.
     */
    scopeRef: varchar("scope_ref", { length: 280 }).notNull(),

    /** Optional typed scope targets for fast joins/lookups. */
    locationId: idRef("location_id").references(() => locations.id),
    resourceId: idRef("resource_id").references(() => resources.id),
    scopeSubjectType: varchar("scope_subject_type", { length: 80 }),
    scopeSubjectId: varchar("scope_subject_id", { length: 140 }),

    /** Lifecycle status for safe deactivation without hard-delete. */
    status: lifecycleStatusEnum("status").default("active").notNull(),

    /** Optional activation window start. */
    effectiveFrom: timestamp("effective_from", { withTimezone: true }).defaultNow().notNull(),

    /** Optional activation window end. */
    effectiveTo: timestamp("effective_to", { withTimezone: true }),

    /** Extensible metadata payload. */
    metadata: jsonb("metadata").default({}).notNull(),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    authzRoleAssignmentsBizIdIdUnique: uniqueIndex("authz_role_assignments_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Prevent duplicate assignment tuples. */
    authzRoleAssignmentsUnique: uniqueIndex("authz_role_assignments_unique").on(
      table.userId,
      table.roleDefinitionId,
      table.scopeRef,
    ),

    /** Resolver path for "what roles does this user have?". */
    authzRoleAssignmentsUserStatusIdx: index("authz_role_assignments_user_status_idx").on(
      table.userId,
      table.status,
      table.effectiveFrom,
      table.effectiveTo,
    ),

    /** Resolver path for tenant-scoped checks. */
    authzRoleAssignmentsBizScopeIdx: index("authz_role_assignments_biz_scope_idx").on(
      table.bizId,
      table.scopeType,
      table.status,
    ),

    /** Tenant-safe typed scope FKs. */
    authzRoleAssignmentsBizLocationFk: foreignKey({
      columns: [table.bizId, table.locationId],
      foreignColumns: [locations.bizId, locations.id],
      name: "authz_role_assignments_biz_location_fk",
    }),
    authzRoleAssignmentsBizResourceFk: foreignKey({
      columns: [table.bizId, table.resourceId],
      foreignColumns: [resources.bizId, resources.id],
      name: "authz_role_assignments_biz_resource_fk",
    }),
    authzRoleAssignmentsBizSubjectFk: foreignKey({
      columns: [table.bizId, table.scopeSubjectType, table.scopeSubjectId],
      foreignColumns: [subjects.bizId, subjects.subjectType, subjects.subjectId],
      name: "authz_role_assignments_biz_subject_fk",
    }),

    /** Subject pointer should be fully null or fully set. */
    authzRoleAssignmentsScopeSubjectPairCheck: check(
      "authz_role_assignments_scope_subject_pair_check",
      sql`
      (
        "scope_subject_type" IS NULL
        AND "scope_subject_id" IS NULL
      ) OR (
        "scope_subject_type" IS NOT NULL
        AND "scope_subject_id" IS NOT NULL
      )
      `,
    ),

    /** Scope payload must match scope type exactly. */
    authzRoleAssignmentsScopeShapeCheck: check(
      "authz_role_assignments_scope_shape_check",
      sql`
      (
        "scope_type" = 'platform'
        AND "biz_id" IS NULL
        AND "location_id" IS NULL
        AND "resource_id" IS NULL
        AND "scope_subject_type" IS NULL
        AND "scope_subject_id" IS NULL
        AND "scope_ref" = 'platform'
      ) OR (
        "scope_type" = 'biz'
        AND "biz_id" IS NOT NULL
        AND "location_id" IS NULL
        AND "resource_id" IS NULL
        AND "scope_subject_type" IS NULL
        AND "scope_subject_id" IS NULL
      ) OR (
        "scope_type" = 'location'
        AND "biz_id" IS NOT NULL
        AND "location_id" IS NOT NULL
        AND "resource_id" IS NULL
        AND "scope_subject_type" IS NULL
        AND "scope_subject_id" IS NULL
      ) OR (
        "scope_type" = 'resource'
        AND "biz_id" IS NOT NULL
        AND "location_id" IS NULL
        AND "resource_id" IS NOT NULL
        AND "scope_subject_type" IS NULL
        AND "scope_subject_id" IS NULL
      ) OR (
        "scope_type" = 'subject'
        AND "biz_id" IS NOT NULL
        AND "location_id" IS NULL
        AND "resource_id" IS NULL
        AND "scope_subject_type" IS NOT NULL
        AND "scope_subject_id" IS NOT NULL
      )
      `,
    ),

    /** Assignment windows must be chronological. */
    authzRoleAssignmentsEffectiveWindowCheck: check(
      "authz_role_assignments_effective_window_check",
      sql`"effective_to" IS NULL OR "effective_to" > "effective_from"`,
    ),

    authzRoleAssignmentsIdentityCheck: check(
      "authz_role_assignments_identity_check",
      sql`length("scope_ref") > 0`,
    ),
  }),
);

export type AuthzPermissionDefinition = typeof authzPermissionDefinitions.$inferSelect;
export type NewAuthzPermissionDefinition = typeof authzPermissionDefinitions.$inferInsert;

export type AuthzRoleDefinition = typeof authzRoleDefinitions.$inferSelect;
export type NewAuthzRoleDefinition = typeof authzRoleDefinitions.$inferInsert;

export type AuthzRolePermission = typeof authzRolePermissions.$inferSelect;
export type NewAuthzRolePermission = typeof authzRolePermissions.$inferInsert;

export type AuthzMembershipRoleMapping = typeof authzMembershipRoleMappings.$inferSelect;
export type NewAuthzMembershipRoleMapping = typeof authzMembershipRoleMappings.$inferInsert;

export type AuthzRoleAssignment = typeof authzRoleAssignments.$inferSelect;
export type NewAuthzRoleAssignment = typeof authzRoleAssignments.$inferInsert;
