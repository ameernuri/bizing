import { sql } from "drizzle-orm";
import { check, foreignKey, index, uniqueIndex } from "drizzle-orm/pg-core";
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { idRef, idWithTag, withAuditRefs } from "./_common";
import { bizes } from "./bizes";
import { lifecycleStatusEnum, subjectRelationshipDirectionEnum } from "./enums";
import { locations } from "./locations";
import { users } from "./users";

/**
 * subjects
 *
 * ELI5:
 * This is a central directory for "things" that can be referenced through
 * extensible `type + id` links in other tables.
 *
 * Why this table exists:
 * - Some domains (like calendars/capacity pools) support plugin-defined owners
 *   and members via `*_ref_type` + `*_ref_id`.
 * - Without a shared registry, those refs are flexible but can become dangling.
 * - This table keeps flexibility while restoring relational integrity.
 *
 * What goes here:
 * - each row is one canonical `(biz_id, subject_type, subject_id)` identity.
 * - `subject_type` is a stable namespace key (example: `project_site`).
 * - `subject_id` is the target record id in that namespace.
 *
 * Important:
 * - We intentionally do not add direct FK from this table to every plugin table.
 * - Instead, plugin/domain code should register subjects here when created.
 * - Core tables can then safely FK to this registry.
 */
export const subjects = pgTable(
  "subjects",
  {
    /** Stable surrogate id for joins/admin tooling. */
    id: idWithTag("subject"),

    /** Tenant boundary; subjects are isolated per biz. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /**
     * Namespace key describing what the target is.
     *
     * Examples:
     * - `project_site`
     * - `shift_template`
     * - `external_resource`
     */
    subjectType: varchar("subject_type", { length: 80 }).notNull(),

    /**
     * Canonical id of the subject in its own namespace.
     * This can be an internal ULID or provider-specific stable key.
     */
    subjectId: varchar("subject_id", { length: 140 }).notNull(),

    /** Optional human-friendly label for UI and debugging. */
    displayName: varchar("display_name", { length: 240 }),

    /** Optional category/subtype hint for filtering. */
    category: varchar("category", { length: 80 }),

    /** Lifecycle state for safe retirement/archival. */
    status: lifecycleStatusEnum("status").default("active").notNull(),

    /** Whether this subject can currently be used for new links. */
    isLinkable: boolean("is_linkable").default(true).notNull(),

    /**
     * Extensibility payload for namespace-specific metadata.
     * Keep indexed/query-critical fields out of this JSON.
     */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata (who/when/deleted markers). */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    subjectsBizIdIdUnique: uniqueIndex("subjects_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Composite unique identity used by foreign keys from polymorphic refs. */
    subjectsBizTypeIdUnique: uniqueIndex("subjects_biz_type_id_unique").on(
      table.bizId,
      table.subjectType,
      table.subjectId,
    ),

    /** Common listing/query path by status. */
    subjectsBizStatusIdx: index("subjects_biz_status_idx").on(
      table.bizId,
      table.status,
      table.isLinkable,
    ),

    /** Common lookup path by namespace. */
    subjectsBizTypeIdx: index("subjects_biz_type_idx").on(
      table.bizId,
      table.subjectType,
    ),

    /** Prevent empty-string namespace keys/ids. */
    subjectsNonEmptyKeysCheck: check(
      "subjects_non_empty_keys_check",
      sql`length("subject_type") > 0 AND length("subject_id") > 0`,
    ),
  }),
);

/**
 * subject_location_bindings
 *
 * ELI5:
 * This table answers one question in a reusable way:
 * "At which business locations is this subject active?"
 *
 * Why this exists:
 * - many domains need the same location-rollout behavior (services, service
 *   groups, service products, offer versions, and future plugin entities),
 * - creating one join table per domain repeats the same shape and constraints,
 * - this single table keeps rollout behavior fungible and extensible.
 *
 * How to use:
 * - register your entity in `subjects` with a stable `subject_type`,
 * - write one row per `(subject, location)` where it should be available.
 */
export const subjectLocationBindings = pgTable(
  "subject_location_bindings",
  {
    /** Stable surrogate id for one binding row. */
    id: idWithTag("subject_location"),

    /** Tenant boundary for strict isolation. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Subject namespace key from the canonical subject directory. */
    subjectType: varchar("subject_type", { length: 80 }).notNull(),

    /** Subject id from the canonical subject directory. */
    subjectId: varchar("subject_id", { length: 140 }).notNull(),

    /** Location where this subject should be considered active/available. */
    locationId: idRef("location_id")
      .references(() => locations.id)
      .notNull(),

    /** Quick enable/disable toggle without deleting the mapping. */
    isActive: boolean("is_active").default(true).notNull(),

    /** Optional primary-location hint when one subject has many locations. */
    isPrimary: boolean("is_primary").default(false).notNull(),

    /** Optional priority hint for deterministic tie-breaking in resolvers. */
    priority: integer("priority").default(100).notNull(),

    /** Optional activation window start. */
    effectiveFrom: timestamp("effective_from", { withTimezone: true }),

    /** Optional activation window end. */
    effectiveTo: timestamp("effective_to", { withTimezone: true }),

    /** Optional rollout policy payload for advanced location-level behavior. */
    policy: jsonb("policy").default({}),

    /** Extension payload for plugin/domain-specific fields. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata for traceability. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    subjectLocationBindingsBizIdIdUnique: uniqueIndex("subject_location_bindings_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Prevent duplicate active bindings for same subject and location. */
    subjectLocationBindingsUnique: uniqueIndex(
      "subject_location_bindings_unique",
    )
      .on(table.bizId, table.subjectType, table.subjectId, table.locationId)
      .where(sql`"deleted_at" IS NULL`),

    /** Common read path when listing what is active in one location. */
    subjectLocationBindingsBizLocationActiveIdx: index(
      "subject_location_bindings_biz_location_active_idx",
    ).on(table.bizId, table.locationId, table.isActive),

    /** Common read path when resolving one subject's rollout map. */
    subjectLocationBindingsBizSubjectActiveIdx: index(
      "subject_location_bindings_biz_subject_active_idx",
    ).on(table.bizId, table.subjectType, table.subjectId, table.isActive),

    /** Keep one active primary location marker per subject. */
    subjectLocationBindingsSinglePrimaryPerSubjectUnique: uniqueIndex(
      "subject_location_bindings_single_primary_per_subject_unique",
    )
      .on(table.bizId, table.subjectType, table.subjectId)
      .where(
        sql`"is_primary" = true AND "is_active" = true AND "deleted_at" IS NULL`,
      ),

    /** Tenant-safe FK to canonical subject identity. */
    subjectLocationBindingsBizSubjectFk: foreignKey({
      columns: [table.bizId, table.subjectType, table.subjectId],
      foreignColumns: [subjects.bizId, subjects.subjectType, subjects.subjectId],
      name: "subject_location_bindings_biz_subject_fk",
    }),

    /** Tenant-safe FK to business location. */
    subjectLocationBindingsBizLocationFk: foreignKey({
      columns: [table.bizId, table.locationId],
      foreignColumns: [locations.bizId, locations.id],
      name: "subject_location_bindings_biz_location_fk",
    }),

    /** Keep keys non-empty and windows/priority sane. */
    subjectLocationBindingsSanityCheck: check(
      "subject_location_bindings_sanity_check",
      sql`
      length("subject_type") > 0
      AND length("subject_id") > 0
      AND "priority" >= 0
      AND (
        "effective_from" IS NULL
        OR "effective_to" IS NULL
        OR "effective_to" > "effective_from"
      )
      `,
    ),
  }),
);

/**
 * subject_relationships
 *
 * ELI5:
 * This table is a generic "line between two subjects".
 *
 * Why this exists:
 * - Core and plugin features often need graph-like links ("A belongs to B",
 *   "Host is certified for Program X", "Project depends on Asset Group Y").
 * - Without this table, each new relationship shape tends to create one-off
 *   join tables that are hard to reuse across domains.
 * - With this table, we keep one durable backbone for relationship modeling,
 *   while still preserving tenant-safe FK integrity through `subjects`.
 *
 * Important modeling note:
 * - This table stores relationships as *subject-to-subject* edges.
 * - If a core entity is not yet represented in `subjects`, register it there
 *   first, then link it here.
 */
export const subjectRelationships = pgTable(
  "subject_relationships",
  {
    /** Stable surrogate id for one relationship edge. */
    id: idWithTag("subject_rel"),

    /** Tenant boundary for strict isolation. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** From-side subject namespace and id. */
    fromSubjectType: varchar("from_subject_type", { length: 80 }).notNull(),
    fromSubjectId: varchar("from_subject_id", { length: 140 }).notNull(),

    /** To-side subject namespace and id. */
    toSubjectType: varchar("to_subject_type", { length: 80 }).notNull(),
    toSubjectId: varchar("to_subject_id", { length: 140 }).notNull(),

    /**
     * Relationship key describing the edge meaning.
     *
     * Examples:
     * - `belongs_to`
     * - `depends_on`
     * - `certified_for`
     * - `managed_by`
     */
    relationshipType: varchar("relationship_type", { length: 120 }).notNull(),

    /**
     * Directed vs undirected semantics for consumers.
     *
     * Use `directed` when A -> B has specific meaning.
     * Use `undirected` when link is symmetric.
     */
    direction: subjectRelationshipDirectionEnum("direction")
      .default("directed")
      .notNull(),

    /** Lifecycle state so relationships can be retired without hard delete. */
    status: lifecycleStatusEnum("status").default("active").notNull(),

    /** Optional effective window start for time-bounded relationships. */
    effectiveFrom: timestamp("effective_from", { withTimezone: true }),

    /** Optional effective window end for time-bounded relationships. */
    effectiveTo: timestamp("effective_to", { withTimezone: true }),

    /**
     * Optional ranking weight for tie-breaking in graph resolution.
     *
     * Example:
     * - two potential parents, choose lower/higher priority based on policy.
     */
    priority: integer("priority").default(100).notNull(),

    /** Non-indexed extension payload for relationship-specific metadata. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata for traceable relationship lifecycle changes. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    subjectRelationshipsBizIdIdUnique: uniqueIndex("subject_relationships_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /**
     * Prevent duplicate logical edge rows in the same tenant.
     *
     * Includes direction so "A -> B" and "B -> A" can co-exist when needed.
     */
    subjectRelationshipsBizEdgeUnique: uniqueIndex(
      "subject_relationships_biz_edge_unique",
    )
      .on(
        table.bizId,
        table.fromSubjectType,
        table.fromSubjectId,
        table.relationshipType,
        table.toSubjectType,
        table.toSubjectId,
        table.direction,
      )
      .where(sql`"deleted_at" IS NULL`),

    /** Common traversal path from one source subject. */
    subjectRelationshipsBizFromIdx: index("subject_relationships_biz_from_idx").on(
      table.bizId,
      table.fromSubjectType,
      table.fromSubjectId,
      table.relationshipType,
      table.status,
    ),

    /** Common reverse traversal path to one target subject. */
    subjectRelationshipsBizToIdx: index("subject_relationships_biz_to_idx").on(
      table.bizId,
      table.toSubjectType,
      table.toSubjectId,
      table.relationshipType,
      table.status,
    ),

    /** Tenant-safe FK from edge source to `subjects` registry. */
    subjectRelationshipsBizFromSubjectFk: foreignKey({
      columns: [table.bizId, table.fromSubjectType, table.fromSubjectId],
      foreignColumns: [subjects.bizId, subjects.subjectType, subjects.subjectId],
      name: "subject_relationships_biz_from_subject_fk",
    }),

    /** Tenant-safe FK from edge target to `subjects` registry. */
    subjectRelationshipsBizToSubjectFk: foreignKey({
      columns: [table.bizId, table.toSubjectType, table.toSubjectId],
      foreignColumns: [subjects.bizId, subjects.subjectType, subjects.subjectId],
      name: "subject_relationships_biz_to_subject_fk",
    }),

    /** Keep namespace keys non-empty and window timestamps ordered. */
    subjectRelationshipsKeysAndWindowCheck: check(
      "subject_relationships_keys_and_window_check",
      sql`
      length("from_subject_type") > 0
      AND length("from_subject_id") > 0
      AND length("to_subject_type") > 0
      AND length("to_subject_id") > 0
      AND length("relationship_type") > 0
      AND "priority" >= 0
      AND (
        "effective_from" IS NULL
        OR "effective_to" IS NULL
        OR "effective_to" > "effective_from"
      )
      `,
    ),

    /** Prevent self-loop edges for the exact same subject identity. */
    subjectRelationshipsNoSelfLoopCheck: check(
      "subject_relationships_no_self_loop_check",
      sql`
      NOT (
        "from_subject_type" = "to_subject_type"
        AND "from_subject_id" = "to_subject_id"
      )
      `,
    ),
  }),
);

export type Subject = typeof subjects.$inferSelect;
export type NewSubject = typeof subjects.$inferInsert;
export type SubjectLocationBinding = typeof subjectLocationBindings.$inferSelect;
export type NewSubjectLocationBinding =
  typeof subjectLocationBindings.$inferInsert;
export type SubjectRelationship = typeof subjectRelationships.$inferSelect;
export type NewSubjectRelationship = typeof subjectRelationships.$inferInsert;
