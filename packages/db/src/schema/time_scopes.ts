import { sql } from "drizzle-orm";
import { check, foreignKey, index, pgTable, uniqueIndex } from "drizzle-orm/pg-core";
import { boolean, jsonb, varchar } from "drizzle-orm/pg-core";
import { idRef, idWithTag, withAuditRefs } from "./_common";
import { bizes } from "./bizes";
import { users } from "./users";
import { subjects } from "./subjects";
import { timeScopeTypeEnum } from "./enums";

/**
 * time_scopes
 *
 * ELI5:
 * This table is a normalized dictionary of "where time rules apply".
 *
 * Why this exists:
 * - many scheduling/capacity tables currently duplicate polymorphic scope
 *   payload columns (`location_id`, `calendar_id`, `service_id`, ...).
 * - this table gives one canonical scope identity (`scope_ref_key`) that API,
 *   policy, and plugins can reference without branching by many nullable cols.
 *
 * Transition strategy:
 * - existing typed scope columns remain in domain tables for v0 continuity.
 * - new writes should start attaching `time_scope_id` whenever possible.
 * - once read/write surfaces converge, typed scope payload columns can be
 *   retired from downstream tables.
 */
export const timeScopes = pgTable(
  "time_scopes",
  {
    /** Stable primary key for one reusable scope identity. */
    id: idWithTag("time_scope"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /**
     * Broad scope discriminator.
     *
     * This is descriptive. The canonical lookup identity is `scopeRefKey`.
     */
    scopeType: timeScopeTypeEnum("scope_type").notNull(),

    /**
     * Optional generic subject payload.
     *
     * For plugin/extensible domains, this should reference the shared subjects
     * registry. For built-in scopes, these can stay null while `scopeRefKey`
     * carries canonical identity.
     */
    scopeRefType: varchar("scope_ref_type", { length: 80 }),
    scopeRefId: idRef("scope_ref_id"),

    /**
     * Canonical scope key consumed by resolver/query layers.
     *
     * Examples:
     * - `biz`
     * - `calendar:calendar_...`
     * - `resource:resource_...`
     * - `custom_subject:foo:bar`
     */
    scopeRefKey: varchar("scope_ref_key", { length: 320 }).notNull(),

    /** Optional human label for operators/admins. */
    displayName: varchar("display_name", { length: 220 }),

    /** Operational toggle for staged migrations and soft retirement. */
    isActive: boolean("is_active").default(true).notNull(),

    /** Optional policy payload for scope-level extensions. */
    policy: jsonb("policy").default({}),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite key used by tenant-safe child FKs. */
    timeScopesBizIdIdUnique: uniqueIndex("time_scopes_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),

    /** Canonical unique scope identity per tenant. */
    timeScopesBizScopeRefUnique: uniqueIndex("time_scopes_biz_scope_ref_unique").on(
      table.bizId,
      table.scopeRefKey,
    ),

    /** Common resolver lookup path. */
    timeScopesBizScopeTypeActiveIdx: index("time_scopes_biz_scope_type_active_idx").on(
      table.bizId,
      table.scopeType,
      table.isActive,
    ),

    /** Subject-based lookup path for plugin/extensible scopes. */
    timeScopesBizScopeSubjectIdx: index("time_scopes_biz_scope_subject_idx").on(
      table.bizId,
      table.scopeRefType,
      table.scopeRefId,
    ),

    /** Tenant-safe FK to optional subject registry payload. */
    timeScopesBizScopeSubjectFk: foreignKey({
      columns: [table.bizId, table.scopeRefType, table.scopeRefId],
      foreignColumns: [subjects.bizId, subjects.subjectType, subjects.subjectId],
      name: "time_scopes_biz_scope_subject_fk",
    }),

    /** Scope key cannot be empty and subject payload must be fully-null or fully-set. */
    timeScopesShapeCheck: check(
      "time_scopes_shape_check",
      sql`
      length("scope_ref_key") > 0
      AND (
        ("scope_ref_type" IS NULL AND "scope_ref_id" IS NULL)
        OR ("scope_ref_type" IS NOT NULL AND "scope_ref_id" IS NOT NULL)
      )
      `,
    ),
  }),
);

