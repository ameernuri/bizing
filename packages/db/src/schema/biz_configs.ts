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
import {
  bizConfigPromotionActionEnum,
  bizConfigPromotionEntityTypeEnum,
  bizConfigPromotionItemStatusEnum,
  bizConfigPromotionOperationEnum,
  bizConfigPromotionRunStatusEnum,
} from "./enums";
import { locations } from "./locations";
import { users } from "./users";

/**
 * biz_config_sets
 *
 * ELI5:
 * Think of one set as a "box of options" owned by a biz.
 * Example boxes:
 * - "Offer Statuses"
 * - "Queue Entry Statuses"
 * - "Checklist Item Types"
 * - "Service Visibility Options"
 *
 * Why this exists:
 * - removes pressure to hardcode business vocabulary in table enums forever,
 * - supports location-specific terminology and behavior,
 * - gives APIs/plugins one generic place to read/write configurable dictionaries.
 *
 * Important design note:
 * - A set can be shared by multiple fields through `biz_config_bindings`.
 * - A set can also stay unbound during setup/drafts, then bound later.
 */
export const bizConfigSets = pgTable(
  "biz_config_sets",
  {
    /** Stable primary key for one option set. */
    id: idWithTag("biz_cfg_set"),

    /** Tenant boundary: every set belongs to exactly one biz. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /**
     * Optional location scope override.
     * Null means the set is reusable biz-wide.
     */
    locationId: idRef("location_id").references(() => locations.id),

    /**
     * Broad category label for this set.
     * Examples: status, checklist, enum, workflow, preference.
     */
    setType: varchar("set_type", { length: 80 }).default("status").notNull(),

    /**
     * Optional source owner identity for extension/plugin-managed dictionaries.
     *
     * ELI5:
     * - native sets leave this null.
     * - extension-managed sets can store "package/name@version" style owner key.
     * - this lets governance tooling protect third-party managed dictionaries.
     */
    sourceOwnerKey: varchar("source_owner_key", { length: 180 }),

    /** Human name shown in setup/admin screens. */
    name: varchar("name", { length: 200 }).notNull(),

    /**
     * Stable machine key for APIs/import/export.
     * Example: offer_status, queue_entry_status, requirement_item_type.
     */
    slug: varchar("slug", { length: 140 }).notNull(),

    /** Optional explanation for operators and future maintainers. */
    description: text("description"),

    /**
     * If true, APIs may accept values not pre-defined in this set.
     * Keep false for stricter governance and analytics consistency.
     */
    allowFreeformValues: boolean("allow_freeform_values").default(false).notNull(),

    /** Soft on/off switch without deleting the set. */
    isActive: boolean("is_active").default(true).notNull(),

    /** Extension payload for future set-level behavior knobs. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    bizConfigSetsBizIdIdUnique: uniqueIndex("biz_config_sets_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Composite unique key used by tenant-safe child FKs. */

    /** Set slug must be unique within one biz/location scope. */
    bizConfigSetsBizLocationSlugUnique: uniqueIndex(
      "biz_config_sets_biz_location_slug_unique",
    ).on(table.bizId, table.locationId, table.slug),

    /** Common setup/admin listing path. */
    bizConfigSetsBizTypeActiveIdx: index("biz_config_sets_biz_type_active_idx").on(
      table.bizId,
      table.setType,
      table.isActive,
    ),

    /** Tenant-safe FK to optional location scope. */
    bizConfigSetsBizLocationFk: foreignKey({
      columns: [table.bizId, table.locationId],
      foreignColumns: [locations.bizId, locations.id],
      name: "biz_config_sets_biz_location_fk",
    }),
  }),
);

/**
 * biz_config_values
 *
 * ELI5:
 * These are the items inside one set.
 *
 * Example values for an "offer_status" set:
 * - draft
 * - live
 * - paused
 * - archived
 *
 * How this bridges existing enum-backed columns:
 * - `system_code` can map a configurable value to a deterministic internal code
 *   used by current workflow logic/check constraints.
 * - This lets bizes customize labels/order/defaults now, while preserving
 *   stable engine behavior.
 */
export const bizConfigValues = pgTable(
  "biz_config_values",
  {
    /** Stable primary key for one option value. */
    id: idWithTag("biz_cfg_value"),

    /** Tenant boundary for ownership + tenant-safe joins. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent set this value belongs to. */
    configSetId: idRef("config_set_id")
      .references(() => bizConfigSets.id)
      .notNull(),

    /**
     * Stable machine value.
     * This is what APIs should persist when this value is selected.
     */
    code: varchar("code", { length: 140 }).notNull(),

    /** Human-friendly label for UI chips/dropdowns. */
    label: varchar("label", { length: 200 }).notNull(),

    /** Optional longer help text. */
    description: text("description"),

    /**
     * Optional deterministic internal code mapping.
     *
     * Example:
     * - code = "ready_for_pickup"
     * - system_code = "confirmed"
     *
     * Engine workflows can still run on `system_code` while biz UX uses `code`.
     */
    systemCode: varchar("system_code", { length: 140 }),

    /**
     * Optional successor value for safe retirement flows.
     *
     * ELI5:
     * if this value is being retired, this points at the replacement value in
     * the same set. Historical rows keep this original id; new writes can be
     * redirected by application policy.
     */
    replacedByConfigValueId: idRef("replaced_by_config_value_id"),

    /** One default per set is recommended for deterministic create flows. */
    isDefault: boolean("is_default").default(false).notNull(),

    /** Soft on/off switch for value lifecycle without hard deletes. */
    isActive: boolean("is_active").default(true).notNull(),

    /** UI ordering hint (lower = earlier). */
    sortOrder: integer("sort_order").default(100).notNull(),

    /**
     * Optional UI color token/code (not interpreted by DB logic).
     * Kept as plain text to avoid coupling DB to one design system.
     */
    colorHint: varchar("color_hint", { length: 40 }),

    /** Optional behavior flags/settings specific to this option value. */
    behavior: jsonb("behavior").default({}),

    /** Extension payload for future needs. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    bizConfigValuesBizIdIdUnique: uniqueIndex("biz_config_values_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Composite unique key used by tenant-safe parent/child joins. */

    /**
     * Composite unique key used by bindings that need to validate both set and value.
     * This makes tenant-safe "default value belongs to this set" constraints possible.
     */
    bizConfigValuesBizSetIdIdUnique: uniqueIndex(
      "biz_config_values_biz_set_id_id_unique",
    ).on(table.bizId, table.configSetId, table.id),

    /** One code per set. */
    bizConfigValuesSetCodeUnique: uniqueIndex("biz_config_values_set_code_unique").on(
      table.configSetId,
      table.code,
    ),

    /**
     * At most one default value per set.
     * Keeps create-time default resolution deterministic.
     */
    bizConfigValuesSingleDefaultPerSetUnique: uniqueIndex(
      "biz_config_values_single_default_per_set_unique",
    )
      .on(table.configSetId)
      .where(sql`"is_default" = true AND "deleted_at" IS NULL`),

    /** Common dropdown loading path. */
    bizConfigValuesSetActiveSortIdx: index("biz_config_values_set_active_sort_idx").on(
      table.configSetId,
      table.isActive,
      table.sortOrder,
    ),
    /** Helps "retire -> replacement" lookups. */
    bizConfigValuesReplacementIdx: index("biz_config_values_replacement_idx").on(
      table.configSetId,
      table.replacedByConfigValueId,
    ),

    /** Tenant-safe FK to parent set. */
    bizConfigValuesBizSetFk: foreignKey({
      columns: [table.bizId, table.configSetId],
      foreignColumns: [bizConfigSets.bizId, bizConfigSets.id],
      name: "biz_config_values_biz_set_fk",
    }),
    /**
     * Tenant-safe self-FK for replacement values.
     *
     * Guarantees replacement stays in same biz and same config set.
     */
    bizConfigValuesReplacementSetMatchFk: foreignKey({
      columns: [table.bizId, table.configSetId, table.replacedByConfigValueId],
      foreignColumns: [table.bizId, table.configSetId, table.id],
      name: "biz_config_values_replacement_set_match_fk",
    }),

    /** Sort order should stay non-negative. */
    bizConfigValuesSortOrderCheck: check(
      "biz_config_values_sort_order_check",
      sql`"sort_order" >= 0`,
    ),
    /** Replacement pointer cannot point to self. */
    bizConfigValuesReplacementNoSelfCheck: check(
      "biz_config_values_replacement_no_self_check",
      sql`"replaced_by_config_value_id" IS NULL OR "replaced_by_config_value_id" <> "id"`,
    ),
  }),
);

/**
 * biz_config_value_localizations
 *
 * ELI5:
 * One value can have many translated labels.
 *
 * Why this exists:
 * - fixes single-label limitation in `biz_config_values`,
 * - keeps stable value code while allowing locale-specific display text.
 */
export const bizConfigValueLocalizations = pgTable(
  "biz_config_value_localizations",
  {
    /** Stable primary key for one localization row. */
    id: idWithTag("biz_cfg_value_i18n"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent config value being translated. */
    configValueId: idRef("config_value_id")
      .references(() => bizConfigValues.id)
      .notNull(),

    /**
     * BCP-47-ish locale tag.
     * Examples: en, en-US, es, fr-CA
     */
    locale: varchar("locale", { length: 35 }).notNull(),

    /** Localized label rendered in UI for this locale. */
    label: varchar("label", { length: 200 }).notNull(),

    /** Optional localized description/help text. */
    description: text("description"),

    /** Localized row lifecycle toggle. */
    isActive: boolean("is_active").default(true).notNull(),

    /** Extension payload for locale-specific rendering hints. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite key for tenant-safe references. */
    bizConfigValueLocalizationsBizIdIdUnique: uniqueIndex(
      "biz_config_value_localizations_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** One translation row per value + locale. */
    bizConfigValueLocalizationsValueLocaleUnique: uniqueIndex(
      "biz_config_value_localizations_value_locale_unique",
    ).on(table.configValueId, table.locale),

    /** Common lookup path by locale. */
    bizConfigValueLocalizationsBizLocaleIdx: index(
      "biz_config_value_localizations_biz_locale_idx",
    ).on(table.bizId, table.locale, table.isActive),

    /** Tenant-safe FK to parent config value. */
    bizConfigValueLocalizationsBizValueFk: foreignKey({
      columns: [table.bizId, table.configValueId],
      foreignColumns: [bizConfigValues.bizId, bizConfigValues.id],
      name: "biz_config_value_localizations_biz_value_fk",
    }),

    /** Locale tag shape check (simple but practical). */
    bizConfigValueLocalizationsLocaleFormatCheck: check(
      "biz_config_value_localizations_locale_format_check",
      sql`"locale" ~ '^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$'`,
    ),
  }),
);

/**
 * biz_config_bindings
 *
 * ELI5:
 * A binding says where one set is used.
 *
 * Example:
 * - Set: "Offer Statuses"
 * - Bound to: target_entity=offers, target_field=status
 *
 * Why this table exists:
 * - one set can be reused by multiple tables/fields,
 * - a target field can have location-level overrides,
 * - plugins can bind custom sets to custom entities without schema rewrites.
 */
export const bizConfigBindings = pgTable(
  "biz_config_bindings",
  {
    /** Stable primary key. */
    id: idWithTag("biz_cfg_binding"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Dictionary set used by this target field. */
    configSetId: idRef("config_set_id")
      .references(() => bizConfigSets.id)
      .notNull(),

    /**
     * Optional location override.
     * Null means binding applies biz-wide.
     */
    locationId: idRef("location_id").references(() => locations.id),

    /**
     * Optional extra scope for plugin/custom domains.
     * Example: scope_ref_type=service_product + scope_ref_id=sp_123...
     */
    scopeRefType: varchar("scope_ref_type", { length: 80 }),

    /** Custom scope target id when `scope_ref_type` is set. */
    scopeRefId: idRef("scope_ref_id"),

    /**
     * Target entity/table name in semantic form.
     * Example: offers, queue_entries, requirement_list_assignment_items.
     */
    targetEntity: varchar("target_entity", { length: 120 }).notNull(),

    /**
     * Target field name that should use this set.
     * Example: status, item_type, execution_mode.
     */
    targetField: varchar("target_field", { length: 120 }).notNull(),

    /**
     * If true, this is the primary active binding for that target scope.
     * A target can have historical/inactive bindings for audit/history.
     */
    isPrimary: boolean("is_primary").default(true).notNull(),

    /**
     * If true, callers should reject values not present in the bound set.
     * If false, binding is advisory/UX-only.
     */
    isStrict: boolean("is_strict").default(true).notNull(),

    /**
     * Optional binding-level default override.
     * Useful when one shared set is bound to many fields with different defaults.
     */
    defaultConfigValueId: idRef("default_config_value_id").references(
      () => bizConfigValues.id,
    ),

    /** Binding lifecycle switch. */
    isActive: boolean("is_active").default(true).notNull(),

    /** Extension payload for binding-specific runtime rules. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite unique key for tenant-safe references. */
    bizConfigBindingsBizIdIdUnique: uniqueIndex(
      "biz_config_bindings_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** Prevent duplicate identical bindings for one target/scope. */
    bizConfigBindingsUnique: uniqueIndex("biz_config_bindings_unique").on(
      table.bizId,
      table.locationId,
      table.scopeRefType,
      table.scopeRefId,
      table.targetEntity,
      table.targetField,
      table.configSetId,
    ),

    /**
     * At most one active primary binding per target scope.
     * This keeps option-resolution deterministic.
     */
    bizConfigBindingsPrimaryPerTargetUnique: uniqueIndex(
      "biz_config_bindings_primary_per_target_unique",
    )
      .on(
        table.bizId,
        table.locationId,
        table.scopeRefType,
        table.scopeRefId,
        table.targetEntity,
        table.targetField,
      )
      .where(sql`"is_primary" = true AND "is_active" = true AND "deleted_at" IS NULL`),

    /** Common resolver path for runtime config lookup. */
    bizConfigBindingsResolverIdx: index("biz_config_bindings_resolver_idx").on(
      table.bizId,
      table.targetEntity,
      table.targetField,
      table.locationId,
      table.scopeRefType,
      table.scopeRefId,
      table.isActive,
    ),

    /** Tenant-safe FK to set. */
    bizConfigBindingsBizSetFk: foreignKey({
      columns: [table.bizId, table.configSetId],
      foreignColumns: [bizConfigSets.bizId, bizConfigSets.id],
      name: "biz_config_bindings_biz_set_fk",
    }),

    /** Tenant-safe FK to optional location scope. */
    bizConfigBindingsBizLocationFk: foreignKey({
      columns: [table.bizId, table.locationId],
      foreignColumns: [locations.bizId, locations.id],
      name: "biz_config_bindings_biz_location_fk",
    }),

    /**
     * Tenant-safe FK to default value.
     * Ensures chosen default belongs to same biz.
     */
    bizConfigBindingsBizDefaultValueFk: foreignKey({
      columns: [table.bizId, table.defaultConfigValueId],
      foreignColumns: [bizConfigValues.bizId, bizConfigValues.id],
      name: "biz_config_bindings_biz_default_value_fk",
    }),

    /**
     * Stronger default-value integrity check:
     * default value must belong to the exact same set used by this binding.
     */
    bizConfigBindingsDefaultValueSetMatchFk: foreignKey({
      columns: [table.bizId, table.configSetId, table.defaultConfigValueId],
      foreignColumns: [
        bizConfigValues.bizId,
        bizConfigValues.configSetId,
        bizConfigValues.id,
      ],
      name: "biz_config_bindings_default_value_set_match_fk",
    }),

    /** Scope reference fields must be set together or omitted together. */
    bizConfigBindingsScopeRefShapeCheck: check(
      "biz_config_bindings_scope_ref_shape_check",
      sql`
      (
        "scope_ref_type" IS NULL
        AND "scope_ref_id" IS NULL
      ) OR (
        "scope_ref_type" IS NOT NULL
        AND "scope_ref_id" IS NOT NULL
      )
      `,
    ),
  }),
);

/**
 * biz_config_promotion_runs
 *
 * ELI5:
 * A promotion run is one auditable deployment of config-as-data between scopes
 * (for example staging-like profile to production-like profile).
 *
 * Why this exists:
 * - gives deterministic promotion history,
 * - allows dry-run, apply, and rollback tracking,
 * - enables post-mortem review without relying on external logs.
 */
export const bizConfigPromotionRuns = pgTable(
  "biz_config_promotion_runs",
  {
    /** Stable primary key. */
    id: idWithTag("biz_cfg_promote_run"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /**
     * Optional source profile label.
     * Example: staging-defaults, region-us-template
     */
    sourceProfileKey: varchar("source_profile_key", { length: 140 }).notNull(),

    /**
     * Optional target profile label.
     * Example: production, location-nyc
     */
    targetProfileKey: varchar("target_profile_key", { length: 140 }).notNull(),

    /** Operation kind for this run. */
    operation: bizConfigPromotionOperationEnum("operation")
      .default("apply")
      .notNull(),

    /** Run status lifecycle. */
    status: bizConfigPromotionRunStatusEnum("status")
      .default("queued")
      .notNull(),

    /** Optional actor that explicitly requested this run. */
    requestedByUserId: idRef("requested_by_user_id").references(() => users.id),

    /** Optional start timestamp. */
    startedAt: timestamp("started_at", { withTimezone: true }),

    /** Optional completion timestamp. */
    completedAt: timestamp("completed_at", { withTimezone: true }),

    /** Summary counters for observability. */
    totalItems: integer("total_items").default(0).notNull(),
    appliedItems: integer("applied_items").default(0).notNull(),
    failedItems: integer("failed_items").default(0).notNull(),

    /** Optional run-level diff summary payload. */
    diffSummary: jsonb("diff_summary").default({}),

    /** Optional run error summary when failed. */
    errorSummary: text("error_summary"),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite key for tenant-safe child references. */
    bizConfigPromotionRunsBizIdIdUnique: uniqueIndex(
      "biz_config_promotion_runs_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** Operational list path by status and recency. */
    bizConfigPromotionRunsBizStatusStartedIdx: index(
      "biz_config_promotion_runs_biz_status_started_idx",
    ).on(table.bizId, table.status, table.startedAt),

    /** Counter sanity. */
    bizConfigPromotionRunsCountsCheck: check(
      "biz_config_promotion_runs_counts_check",
      sql`
      "total_items" >= 0
      AND "applied_items" >= 0
      AND "failed_items" >= 0
      AND "applied_items" + "failed_items" <= "total_items"
      `,
    ),
    /** Window sanity. */
    bizConfigPromotionRunsWindowCheck: check(
      "biz_config_promotion_runs_window_check",
      sql`"completed_at" IS NULL OR "started_at" IS NULL OR "completed_at" >= "started_at"`,
    ),
    /** Status must align with run timestamps. */
    bizConfigPromotionRunsStatusShapeCheck: check(
      "biz_config_promotion_runs_status_shape_check",
      sql`
      (
        "status" = 'queued'
        AND "started_at" IS NULL
      ) OR (
        "status" = 'running'
        AND "started_at" IS NOT NULL
      ) OR (
        "status" IN ('completed', 'failed', 'cancelled')
        AND "completed_at" IS NOT NULL
      )
      `,
    ),
  }),
);

/**
 * biz_config_promotion_run_items
 *
 * ELI5:
 * Each row is one item-level change inside a promotion run.
 *
 * This gives full traceability:
 * - what entity changed,
 * - what action was attempted,
 * - what happened.
 */
export const bizConfigPromotionRunItems = pgTable(
  "biz_config_promotion_run_items",
  {
    /** Stable primary key. */
    id: idWithTag("biz_cfg_promote_item"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent promotion run. */
    promotionRunId: idRef("promotion_run_id")
      .references(() => bizConfigPromotionRuns.id)
      .notNull(),

    /** Entity class being promoted. */
    entityType: bizConfigPromotionEntityTypeEnum("entity_type").notNull(),

    /** Stable source key (slug/code composite encoded by application). */
    sourceKey: varchar("source_key", { length: 240 }).notNull(),

    /** Optional resolved target key. */
    targetKey: varchar("target_key", { length: 240 }),

    /** Requested action. */
    action: bizConfigPromotionActionEnum("action").notNull(),

    /** Execution status for this item. */
    status: bizConfigPromotionItemStatusEnum("status")
      .default("pending")
      .notNull(),

    /** Optional before/after snapshots for audit and review. */
    beforeState: jsonb("before_state"),
    afterState: jsonb("after_state"),

    /** Optional failure detail when status=failed. */
    errorMessage: text("error_message"),

    /** Optional apply timestamp for completed item changes. */
    appliedAt: timestamp("applied_at", { withTimezone: true }),

    /** Optional direct links to resolved entities in target scope. */
    configSetId: idRef("config_set_id").references(() => bizConfigSets.id),
    configValueId: idRef("config_value_id").references(() => bizConfigValues.id),
    configBindingId: idRef("config_binding_id").references(() => bizConfigBindings.id),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    bizConfigPromotionRunItemsBizIdIdUnique: uniqueIndex("biz_config_promotion_run_items_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Unique idempotent key for one source item in one run. */
    bizConfigPromotionRunItemsRunEntitySourceUnique: uniqueIndex(
      "biz_config_promotion_run_items_run_entity_source_unique",
    ).on(table.promotionRunId, table.entityType, table.sourceKey),

    /** Operational list path by run/status. */
    bizConfigPromotionRunItemsBizRunStatusIdx: index(
      "biz_config_promotion_run_items_biz_run_status_idx",
    ).on(table.bizId, table.promotionRunId, table.status),

    /** Tenant-safe FK to parent run. */
    bizConfigPromotionRunItemsBizRunFk: foreignKey({
      columns: [table.bizId, table.promotionRunId],
      foreignColumns: [bizConfigPromotionRuns.bizId, bizConfigPromotionRuns.id],
      name: "biz_config_promotion_run_items_biz_run_fk",
    }),

    /** Tenant-safe FK to optional resolved set. */
    bizConfigPromotionRunItemsBizSetFk: foreignKey({
      columns: [table.bizId, table.configSetId],
      foreignColumns: [bizConfigSets.bizId, bizConfigSets.id],
      name: "biz_config_promotion_run_items_biz_set_fk",
    }),

    /** Tenant-safe FK to optional resolved value. */
    bizConfigPromotionRunItemsBizValueFk: foreignKey({
      columns: [table.bizId, table.configValueId],
      foreignColumns: [bizConfigValues.bizId, bizConfigValues.id],
      name: "biz_config_promotion_run_items_biz_value_fk",
    }),

    /** Tenant-safe FK to optional resolved binding. */
    bizConfigPromotionRunItemsBizBindingFk: foreignKey({
      columns: [table.bizId, table.configBindingId],
      foreignColumns: [bizConfigBindings.bizId, bizConfigBindings.id],
      name: "biz_config_promotion_run_items_biz_binding_fk",
    }),

    /** Failed rows require message, applied rows require timestamp. */
    bizConfigPromotionRunItemsStatusShapeCheck: check(
      "biz_config_promotion_run_items_status_shape_check",
      sql`
      (
        "status" = 'failed'
        AND "error_message" IS NOT NULL
      ) OR (
        "status" <> 'failed'
      )
      AND (
        "status" <> 'applied'
        OR "applied_at" IS NOT NULL
      )
      `,
    ),
  }),
);

export type BizConfigSet = typeof bizConfigSets.$inferSelect;
export type NewBizConfigSet = typeof bizConfigSets.$inferInsert;

export type BizConfigValue = typeof bizConfigValues.$inferSelect;
export type NewBizConfigValue = typeof bizConfigValues.$inferInsert;

export type BizConfigValueLocalization =
  typeof bizConfigValueLocalizations.$inferSelect;
export type NewBizConfigValueLocalization =
  typeof bizConfigValueLocalizations.$inferInsert;

export type BizConfigBinding = typeof bizConfigBindings.$inferSelect;
export type NewBizConfigBinding = typeof bizConfigBindings.$inferInsert;

export type BizConfigPromotionRun = typeof bizConfigPromotionRuns.$inferSelect;
export type NewBizConfigPromotionRun = typeof bizConfigPromotionRuns.$inferInsert;

export type BizConfigPromotionRunItem =
  typeof bizConfigPromotionRunItems.$inferSelect;
export type NewBizConfigPromotionRunItem =
  typeof bizConfigPromotionRunItems.$inferInsert;
