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
import { locations } from "./locations";
import { resources } from "./resources";
import { subjects } from "./subjects";
import { users } from "./users";
import { bizConfigValues } from "./biz_configs";
import { resourceSelectorShapeCheckSql } from "./_resource_selector_shape";
import {
  durationModeEnum,
  requirementModeEnum,
  selectorMatchModeEnum,
  resourceSelectorTypeEnum,
  offerExecutionModeEnum,
  lifecycleStatusEnum,
  offerSeatPricingModeEnum,
  offerStatusEnum,
  resourceTypeEnum,
  offerVersionStatusEnum,
} from "./enums";
import { resourceCapabilityTemplates } from "./supply";

/**
 * offers
 *
 * ELI5:
 * An offer is the product shell customers see in catalog/search.
 * It says "we sell this kind of thing" but does NOT freeze all booking rules.
 *
 * Why split shell vs version:
 * - businesses keep one stable offer URL/identity,
 * - while publishing new immutable versions over time.
 *
 * Future improvement note:
 * if offer-level localization grows, add `offer_translations` rather than
 * adding many language columns here.
 */
export const offers = pgTable(
  "offers",
  {
    /** Stable primary key for this offer shell. */
    id: idWithTag("offer"),

    /** Tenant boundary; every offer belongs to exactly one biz. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Human-facing name shown in admin and customer catalog views. */
    name: varchar("name", { length: 255 }).notNull(),

    /** Stable machine slug for URLs/import APIs; unique per biz. */
    slug: varchar("slug", { length: 140 }).notNull(),

    /** Long-form description for storefront and onboarding context. */
    description: text("description"),

    /**
     * ELI5: this is the "how people get this offer" switch.
     *
     * - `slot`: customer picks a time on a calendar (normal appointment).
     * - `queue`: customer joins a wait line and is called when ready.
     * - `request`: customer asks first, business approves/declines later.
     * - `auction`: price/selection is decided by bids.
     * - `async`: customer submits now, work/result is delivered later.
     * - `route_trip`: tied to transport-style route/trip schedules.
     * - `open_access`: no strict time slot required.
     * - `itinerary`: multi-step journey/experience.
     */
    executionMode: offerExecutionModeEnum("execution_mode").notNull(),
    /**
     * Optional biz-config dictionary value for execution-mode naming.
     * This supports vertical-specific language while keeping core mode semantics.
     */
    executionModeConfigValueId: idRef("execution_mode_config_value_id").references(
      () => bizConfigValues.id,
    ),

    /**
     * Offer shell lifecycle.
     * Draft/inactive stops new sales while preserving historical references.
     */
    status: offerStatusEnum("status").default("draft").notNull(),
    /**
     * Optional biz-config dictionary value for offer status wording/lifecycle UX.
     */
    statusConfigValueId: idRef("status_config_value_id").references(
      () => bizConfigValues.id,
    ),

    /**
     * Publish flag for customer channels.
     * `status` governs lifecycle; this flag governs storefront visibility.
     */
    isPublished: boolean("is_published").default(false).notNull(),

    /**
     * Default timezone for offer-level time rendering.
     * Version-level policies can still override behavior if needed.
     */
    timezone: varchar("timezone", { length: 50 }).default("UTC").notNull(),

    /**
     * Lightweight extensibility bucket.
     * Keep indexed/critical fields out of JSON for query performance.
     */
    metadata: jsonb("metadata").default({}),

    /** Standard full audit metadata (who + when + soft delete). */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    offersBizIdIdUnique: uniqueIndex("offers_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Composite unique key used by tenant-safe foreign keys. */
    /** Guarantees one slug identity per biz. */
    offersBizSlugUnique: uniqueIndex("offers_biz_slug_unique").on(
      table.bizId,
      table.slug,
    ),
    /** Common admin listing filter path. */
    offersBizStatusIdx: index("offers_biz_status_idx").on(
      table.bizId,
      table.status,
    ),
    offersBizStatusConfigIdx: index("offers_biz_status_config_idx").on(
      table.bizId,
      table.statusConfigValueId,
    ),
    /** Common execution-mode listing filter path. */
    offersBizExecutionModeIdx: index("offers_biz_execution_mode_idx").on(
      table.bizId,
      table.executionMode,
    ),
    offersBizExecutionModeConfigIdx: index(
      "offers_biz_execution_mode_config_idx",
    ).on(table.bizId, table.executionModeConfigValueId),
    /** Tenant-safe FK to optional configurable offer status value. */
    offersBizStatusConfigFk: foreignKey({
      columns: [table.bizId, table.statusConfigValueId],
      foreignColumns: [bizConfigValues.bizId, bizConfigValues.id],
      name: "offers_biz_status_config_fk",
    }),
    /** Tenant-safe FK to optional configurable execution-mode value. */
    offersBizExecutionModeConfigFk: foreignKey({
      columns: [table.bizId, table.executionModeConfigValueId],
      foreignColumns: [bizConfigValues.bizId, bizConfigValues.id],
      name: "offers_biz_execution_mode_config_fk",
    }),
  }),
);

/**
 * offer_versions
 *
 * ELI5:
 * This is the "frozen recipe" used at purchase time.
 * Once published, it should be treated as immutable so historical bookings are
 * always explainable with the exact rules/prices that existed then.
 *
 * How it connects:
 * - `offer_components` reference this table.
 * - `booking_orders` point here to lock commercial behavior at checkout time.
 * - location rollout is managed by `subject_location_bindings` with
 *   `subject_type='offer_version'` for reusable multi-domain rollout behavior.
 */
export const offerVersions = pgTable(
  "offer_versions",
  {
    /** Stable primary key for one immutable version snapshot. */
    id: idWithTag("offer_version"),

    /** Tenant boundary for strict multi-tenant isolation. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent offer shell this version belongs to. */
    offerId: idRef("offer_id")
      .references(() => offers.id)
      .notNull(),

    /** Monotonic version number per offer (1,2,3...). */
    version: integer("version").notNull(),

    /** Version publication lifecycle state. */
    status: offerVersionStatusEnum("status").default("draft").notNull(),
    /**
     * Optional biz-config dictionary value for version status wording.
     */
    statusConfigValueId: idRef("status_config_value_id").references(
      () => bizConfigValues.id,
    ),

    /**
     * Optional publication start instant.
     * Useful for pre-scheduling launches.
     */
    publishAt: timestamp("publish_at", { withTimezone: true }),

    /**
     * Optional publication end instant.
     * Useful for seasonal/limited-time versions.
     */
    retireAt: timestamp("retire_at", { withTimezone: true }),

    /** Duration behavior: fixed/flexible/multi_day. */
    durationMode: durationModeEnum("duration_mode").default("fixed").notNull(),
    /**
     * Optional biz-config dictionary value for duration-mode vocabulary.
     */
    durationModeConfigValueId: idRef("duration_mode_config_value_id").references(
      () => bizConfigValues.id,
    ),

    /**
     * Fixed-mode canonical duration in minutes.
     * Also used as default for flexible mode if UI wants a preselected value.
     */
    defaultDurationMin: integer("default_duration_min").default(60).notNull(),

    /** Flexible-mode lower bound in minutes. */
    minDurationMin: integer("min_duration_min"),

    /** Flexible-mode upper bound in minutes. */
    maxDurationMin: integer("max_duration_min"),

    /** Flexible-mode step (e.g., 15-min increments). */
    durationStepMin: integer("duration_step_min").default(15).notNull(),

    /**
     * Base price in minor units (e.g., cents).
     * Deterministic integer math avoids floating-point money bugs.
     */
    basePriceMinor: integer("base_price_minor").default(0).notNull(),

    /** Currency for settlement/display at this version. */
    currency: varchar("currency", { length: 3 }).default("USD").notNull(),

    /**
     * Price model details (surge flags, bundles, minimum charges, etc).
     * Keep this as structured JSON because pricing strategy differs by industry.
     */
    pricingModel: jsonb("pricing_model").default({}),

    /**
     * Availability and booking behavior policy payload.
     * Examples: callout fee policy, approval requirement, lead-time constraints.
     */
    policyModel: jsonb("policy_model").default({}),

    /**
     * Capacity strategy payload.
     * Examples: overbooking factors, seat pools, waitlist thresholds.
     */
    capacityModel: jsonb("capacity_model").default({}),

    /** Optional immutable recipe hash for external verification/debugging. */
    revisionHash: varchar("revision_hash", { length: 128 }),

    /** Non-indexed extension area for implementation-specific attributes. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite unique key used for tenant-safe child FKs. */
    offerVersionsBizIdIdUnique: uniqueIndex(
      "offer_versions_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** Enforces monotonic identity of one version number per offer. */
    offerVersionsOfferVersionUnique: uniqueIndex(
      "offer_versions_offer_version_unique",
    ).on(table.offerId, table.version),

    /** At most one currently-published version per offer at a time. */
    offerVersionsSinglePublishedPerOfferUnique: uniqueIndex(
      "offer_versions_single_published_per_offer_unique",
    )
      .on(table.offerId)
      .where(sql`"status" = 'published' AND "deleted_at" IS NULL`),

    /** Common admin listing path for tenant + status. */
    offerVersionsBizStatusIdx: index("offer_versions_biz_status_idx").on(
      table.bizId,
      table.status,
    ),
    offerVersionsBizStatusConfigIdx: index(
      "offer_versions_biz_status_config_idx",
    ).on(table.bizId, table.statusConfigValueId),
    offerVersionsBizDurationModeConfigIdx: index(
      "offer_versions_biz_duration_mode_config_idx",
    ).on(table.bizId, table.durationModeConfigValueId),

    /** Tenant-safe FK so versions cannot point to offer in another biz. */
    offerVersionsBizOfferFk: foreignKey({
      columns: [table.bizId, table.offerId],
      foreignColumns: [offers.bizId, offers.id],
      name: "offer_versions_biz_offer_fk",
    }),
    /** Tenant-safe FK to optional configurable version status value. */
    offerVersionsBizStatusConfigFk: foreignKey({
      columns: [table.bizId, table.statusConfigValueId],
      foreignColumns: [bizConfigValues.bizId, bizConfigValues.id],
      name: "offer_versions_biz_status_config_fk",
    }),
    /** Tenant-safe FK to optional configurable duration-mode value. */
    offerVersionsBizDurationModeConfigFk: foreignKey({
      columns: [table.bizId, table.durationModeConfigValueId],
      foreignColumns: [bizConfigValues.bizId, bizConfigValues.id],
      name: "offer_versions_biz_duration_mode_config_fk",
    }),

    /** Duration sanity: default and step must be positive numbers. */
    offerVersionsDurationPositiveCheck: check(
      "offer_versions_duration_positive_check",
      sql`"default_duration_min" > 0 AND "duration_step_min" > 0`,
    ),

    /** Flexible duration bounds must be ordered when both are provided. */
    offerVersionsDurationBoundsCheck: check(
      "offer_versions_duration_bounds_check",
      sql`
      "min_duration_min" IS NULL
      OR "max_duration_min" IS NULL
      OR "max_duration_min" >= "min_duration_min"
      `,
    ),

    /**
     * Duration mode shape check.
     *
     * Why this matters:
     * Without this, rows can carry contradictory fields (e.g., flexible mode
     * with missing min/max), which makes slot search nondeterministic.
     */
    offerVersionsDurationModeShapeCheck: check(
      "offer_versions_duration_mode_shape_check",
      sql`
      (
        "duration_mode" = 'fixed'
        AND "default_duration_min" > 0
      ) OR (
        "duration_mode" = 'flexible'
        AND "min_duration_min" IS NOT NULL
        AND "max_duration_min" IS NOT NULL
        AND "max_duration_min" >= "min_duration_min"
      ) OR (
        "duration_mode" = 'multi_day'
        AND "default_duration_min" >= 1440
      )
      `,
    ),

    /** Publication window must not end before it starts. */
    offerVersionsPublishWindowCheck: check(
      "offer_versions_publish_window_check",
      sql`"publish_at" IS NULL OR "retire_at" IS NULL OR "retire_at" > "publish_at"`,
    ),

    /** Currency should always use uppercase ISO-like code shape. */
    offerVersionsCurrencyFormatCheck: check(
      "offer_versions_currency_format_check",
      sql`"currency" ~ '^[A-Z]{3}$'`,
    ),
  }),
);

/**
 * offer_version_admission_modes
 *
 * ELI5:
 * One offer version can be reachable through multiple admission paths.
 *
 * Why this exists:
 * - `offers.execution_mode` is a simple default for quick setup.
 * - advanced operations often need more than one live path at once
 *   (for example slot booking + walk-in queue for the same haircut offer).
 * - this table keeps that flexibility data-driven instead of hardcoded.
 *
 * Typical pattern:
 * - set one primary mode for default UX routing.
 * - enable secondary modes for blended operations.
 * - use mode-level policy to control each path independently.
 */
export const offerVersionAdmissionModes = pgTable(
  "offer_version_admission_modes",
  {
    /** Stable primary key for one mode-binding row. */
    id: idWithTag("offer_admission_mode"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Offer version this admission mode belongs to. */
    offerVersionId: idRef("offer_version_id")
      .references(() => offerVersions.id)
      .notNull(),

    /**
     * Admission path class.
     *
     * Uses canonical execution-mode vocabulary so behavior remains consistent
     * across offer shell defaults and mode-level runtime routing.
     */
    mode: offerExecutionModeEnum("mode").notNull(),

    /**
     * Optional configurable mode label for tenant-facing wording.
     * Canonical `mode` remains source of behavioral truth.
     */
    modeConfigValueId: idRef("mode_config_value_id").references(
      () => bizConfigValues.id,
    ),

    /** Lifecycle for this mode row (draft/active/inactive/archived). */
    status: lifecycleStatusEnum("status").default("active").notNull(),

    /** Marks default route when multiple admission modes are active. */
    isPrimary: boolean("is_primary").default(false).notNull(),

    /**
     * Optional customer-channel visibility toggle.
     *
     * Example:
     * queue mode active internally but hidden from public booking channel.
     */
    isCustomerVisible: boolean("is_customer_visible").default(true).notNull(),

    /** Lower values are chosen first when resolving default mode selection. */
    priority: integer("priority").default(100).notNull(),

    /** Optional mode activation start instant. */
    effectiveStartAt: timestamp("effective_start_at", { withTimezone: true }),

    /** Optional mode activation end instant. */
    effectiveEndAt: timestamp("effective_end_at", { withTimezone: true }),

    /**
     * Path-specific behavior payload.
     *
     * Examples:
     * - queue path can carry ETA admission policy
     * - slot path can carry stricter lead-time constraints
     */
    policy: jsonb("policy").default({}),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite unique target for tenant-safe references. */
    offerVersionAdmissionModesBizIdIdUnique: uniqueIndex(
      "offer_version_admission_modes_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** Prevent duplicate mode rows per offer version. */
    offerVersionAdmissionModesVersionModeUnique: uniqueIndex(
      "offer_version_admission_modes_version_mode_unique",
    )
      .on(table.offerVersionId, table.mode)
      .where(sql`"deleted_at" IS NULL`),

    /** One active primary mode per offer version for deterministic default routing. */
    offerVersionAdmissionModesOnePrimaryUnique: uniqueIndex(
      "offer_version_admission_modes_one_primary_unique",
    )
      .on(table.offerVersionId)
      .where(
        sql`"is_primary" = true AND "status" = 'active' AND "deleted_at" IS NULL`,
      ),

    /** Common runtime lookup path for active modes on one offer version. */
    offerVersionAdmissionModesBizVersionStatusPriorityIdx: index(
      "offer_version_admission_modes_biz_version_status_priority_idx",
    ).on(table.bizId, table.offerVersionId, table.status, table.priority),

    /** Tenant-safe FK to parent offer version. */
    offerVersionAdmissionModesBizOfferVersionFk: foreignKey({
      columns: [table.bizId, table.offerVersionId],
      foreignColumns: [offerVersions.bizId, offerVersions.id],
      name: "offer_version_admission_modes_biz_offer_version_fk",
    }),

    /** Tenant-safe FK to optional configurable mode label value. */
    offerVersionAdmissionModesBizModeConfigFk: foreignKey({
      columns: [table.bizId, table.modeConfigValueId],
      foreignColumns: [bizConfigValues.bizId, bizConfigValues.id],
      name: "offer_version_admission_modes_biz_mode_config_fk",
    }),

    /** Priority must be non-negative. */
    offerVersionAdmissionModesPriorityCheck: check(
      "offer_version_admission_modes_priority_check",
      sql`"priority" >= 0`,
    ),

    /** Effective window must be ordered when both values exist. */
    offerVersionAdmissionModesWindowCheck: check(
      "offer_version_admission_modes_window_check",
      sql`"effective_start_at" IS NULL OR "effective_end_at" IS NULL OR "effective_end_at" > "effective_start_at"`,
    ),
  }),
);

/**
 * offer_components
 *
 * ELI5:
 * A component is a requirement bucket inside an offer version.
 * Example: "Need 1 required host" or "Need 1 optional venue".
 *
 * Selectors are stored in `offer_component_selectors` and answer
 * "which specific resources can satisfy this component".
 */
export const offerComponents = pgTable(
  "offer_components",
  {
    /** Stable primary key for this requirement bucket. */
    id: idWithTag("offer_component"),

    /** Tenant boundary for isolation and strict FK enforcement. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Version that owns this requirement component. */
    offerVersionId: idRef("offer_version_id")
      .references(() => offerVersions.id)
      .notNull(),

    /** Human-friendly label in admin builders. */
    name: varchar("name", { length: 200 }).notNull(),

    /** Stable key for APIs/imports and deterministic diffing. */
    slug: varchar("slug", { length: 140 }).notNull(),

    /** Which supply class this requirement targets. */
    targetType: resourceTypeEnum("target_type").notNull(),

    /** Required vs optional component semantics. */
    mode: requirementModeEnum("mode").default("required").notNull(),

    /**
     * Selector evaluation mode.
     * `any` means one matching selector family is enough.
     * `all` means every selector family must contribute.
     */
    selectorMatchMode: selectorMatchModeEnum(
      "selector_match_mode",
    )
      .default("any")
      .notNull(),

    /** Minimum quantity that must be allocated for this component. */
    minQuantity: integer("min_quantity").default(1).notNull(),

    /** Maximum quantity allowed. Null means no explicit cap. */
    maxQuantity: integer("max_quantity"),

    /**
     * Allow assignment engine to replace with equivalent candidates.
     * If false, first selected candidate should be preserved.
     */
    allowSubstitution: boolean("allow_substitution").default(true).notNull(),

    /** Optional explanation/help text for admins configuring the product. */
    description: text("description"),

    /** Sorting hint for UI rendering. */
    sortOrder: integer("sort_order").default(100).notNull(),

    /** Non-indexed extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite unique key used by child tenant-safe FKs. */
    offerComponentsBizIdIdUnique: uniqueIndex(
      "offer_components_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** One stable slug per component within one version. */
    offerComponentsOfferVersionSlugUnique: uniqueIndex(
      "offer_components_offer_version_slug_unique",
    ).on(table.offerVersionId, table.slug),

    /** Common fetch path for version graph materialization. */
    offerComponentsBizOfferVersionIdx: index(
      "offer_components_biz_offer_version_idx",
    ).on(table.bizId, table.offerVersionId),

    /** Tenant-safe FK for parent version relationship. */
    offerComponentsBizOfferVersionFk: foreignKey({
      columns: [table.bizId, table.offerVersionId],
      foreignColumns: [offerVersions.bizId, offerVersions.id],
      name: "offer_components_biz_offer_version_fk",
    }),

    /** Min quantity must be non-negative. */
    offerComponentsMinQuantityCheck: check(
      "offer_components_min_quantity_check",
      sql`"min_quantity" >= 0`,
    ),

    /** Max quantity cannot be below min quantity. */
    offerComponentsMaxQuantityCheck: check(
      "offer_components_max_quantity_check",
      sql`"max_quantity" IS NULL OR "max_quantity" >= "min_quantity"`,
    ),

    /** Required components should require at least one unit. */
    offerComponentsRequiredModeMinCheck: check(
      "offer_components_required_mode_min_check",
      sql`"mode" = 'optional' OR "min_quantity" > 0`,
    ),
  }),
);

/**
 * offer_component_selectors
 *
 * ELI5:
 * Selectors tell the matcher HOW this component can be satisfied.
 *
 * Examples:
 * - specific person: selector_type = resource + resource_id
 * - any resource with a capability: selector_type = capability_template
 */
export const offerComponentSelectors = pgTable(
  "offer_component_selectors",
  {
    /** Stable primary key for selector row. */
    id: idWithTag("offer_selector"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Component this selector belongs to. */
    componentId: idRef("component_id")
      .references(() => offerComponents.id)
      .notNull(),

    /** Selector discriminator defining which FK payload must be populated. */
    selectorType: resourceSelectorTypeEnum("selector_type").notNull(),

    /**
     * Direct selector for one exact resource row.
     * Great for "must be Dr. John" type requirements.
     */
    resourceId: idRef("resource_id").references(() => resources.id),

    /**
     * Broad selector by resource class.
     * Great for "any host" / "any venue" style requirements without pinning
     * one exact row.
     */
    resourceType: resourceTypeEnum("resource_type"),

    /**
     * Capability template selector.
     * Great for "any GP" / "any certified trainer" style requirements.
     */
    capabilityTemplateId: idRef("capability_template_id").references(
      () => resourceCapabilityTemplates.id,
    ),

    /** Location selector, for location-scoped supply requirements. */
    locationId: idRef("location_id").references(() => locations.id),

    /**
     * Extensible selector payload for plugin/custom subject namespaces.
     * This keeps selector model future-proof without nullable FK explosion.
     */
    subjectType: varchar("subject_type", { length: 80 }),
    subjectId: varchar("subject_id", { length: 140 }),

    /**
     * Optional ranking weight used by match/scoring engines.
     * Higher weight means this selector is more preferred.
     */
    weight: integer("weight").default(100).notNull(),

    /** Extension payload for advanced selector attributes. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    offerComponentSelectorsBizIdIdUnique: uniqueIndex("offer_component_selectors_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Common path for component graph loading. */
    offerComponentSelectorsBizComponentIdx: index(
      "offer_component_selectors_biz_component_idx",
    ).on(table.bizId, table.componentId),

    /** Helpful for matching by broad resource class selectors. */
    offerComponentSelectorsBizResourceTypeIdx: index(
      "offer_component_selectors_biz_resource_type_idx",
    ).on(table.bizId, table.resourceType),

    /** Helpful for matching by custom-subject selectors. */
    offerComponentSelectorsBizSubjectIdx: index(
      "offer_component_selectors_biz_subject_idx",
    ).on(table.bizId, table.subjectType, table.subjectId),

    /** Tenant-safe FK to parent component. */
    offerComponentSelectorsBizComponentFk: foreignKey({
      columns: [table.bizId, table.componentId],
      foreignColumns: [offerComponents.bizId, offerComponents.id],
      name: "offer_component_selectors_biz_component_fk",
    }),

    /** Tenant-safe FK for direct resource selectors. */
    offerComponentSelectorsBizResourceFk: foreignKey({
      columns: [table.bizId, table.resourceId],
      foreignColumns: [resources.bizId, resources.id],
      name: "offer_component_selectors_biz_resource_fk",
    }),

    /** Tenant-safe FK for capability template selectors. */
    offerComponentSelectorsBizCapabilityTemplateFk: foreignKey({
      columns: [table.bizId, table.capabilityTemplateId],
      foreignColumns: [resourceCapabilityTemplates.bizId, resourceCapabilityTemplates.id],
      name: "offer_component_selectors_biz_capability_template_fk",
    }),

    /** Tenant-safe FK for location selectors. */
    offerComponentSelectorsBizLocationFk: foreignKey({
      columns: [table.bizId, table.locationId],
      foreignColumns: [locations.bizId, locations.id],
      name: "offer_component_selectors_biz_location_fk",
    }),

    /** Tenant-safe FK for custom-subject selectors. */
    offerComponentSelectorsBizSubjectFk: foreignKey({
      columns: [table.bizId, table.subjectType, table.subjectId],
      foreignColumns: [subjects.bizId, subjects.subjectType, subjects.subjectId],
      name: "offer_component_selectors_biz_subject_fk",
    }),

    /**
     * Payload shape invariant.
     *
     * Why this matters:
     * We only allow one selector payload family per row. That keeps semantics
     * deterministic and avoids "half-valid" rows that are hard to evaluate.
     */
    offerComponentSelectorsShapeCheck: check(
      "offer_component_selectors_shape_check",
      resourceSelectorShapeCheckSql,
    ),
  }),
);

/**
 * offer_component_seat_types
 *
 * ELI5:
 * Seat types let one offer version define price/capacity variants like:
 * - standard seat
 * - VIP seat
 * - observer seat
 *
 * This is intentionally separate from resource capacity so businesses can sell
 * commercial seat classes even when physical resources are shared.
 */
export const offerComponentSeatTypes = pgTable(
  "offer_component_seat_types",
  {
    /** Stable primary key for a seat class definition. */
    id: idWithTag("offer_seat_type"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Version-level owner for this seat class. */
    offerVersionId: idRef("offer_version_id")
      .references(() => offerVersions.id)
      .notNull(),

    /**
     * Optional component scope.
     * Null means seat class applies to whole offer version.
     */
    componentId: idRef("component_id").references(() => offerComponents.id),

    /** Seat code for APIs and import templates (e.g., vip, observer). */
    code: varchar("code", { length: 100 }).notNull(),

    /** Human label shown in checkout/admin. */
    name: varchar("name", { length: 150 }).notNull(),

    /** Optional guidance text for operators/customers. */
    description: text("description"),

    /** Minimum number of seats of this type that must be selected. */
    minSeats: integer("min_seats").default(0).notNull(),

    /** Maximum seats of this type allowed. */
    maxSeats: integer("max_seats"),

    /** Default preselected seats used by quick-book UI. */
    defaultSeats: integer("default_seats").default(0).notNull(),

    /** How this seat class affects base price. */
    pricingMode: offerSeatPricingModeEnum("pricing_mode")
      .default("included")
      .notNull(),

    /** Minor-unit surcharge used when `pricing_mode = surcharge`. */
    priceDeltaMinor: integer("price_delta_minor"),

    /**
     * Price multiplier in basis points used when `pricing_mode = multiplier`.
     * Example: 12500 = 1.25x.
     */
    priceMultiplierBps: integer("price_multiplier_bps"),

    /** Optional sort order for checkout and admin lists. */
    sortOrder: integer("sort_order").default(100).notNull(),

    /** Extension payload for future seat rules. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite unique target for tenant-safe foreign keys. */
    offerComponentSeatTypesBizIdIdUnique: uniqueIndex(
      "offer_component_seat_types_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** Unique business key for seat classes per version/component scope. */
    offerComponentSeatTypesUnique: uniqueIndex(
      "offer_component_seat_types_unique",
    ).on(table.offerVersionId, table.componentId, table.code),

    /** Common lookup path for offer version detail APIs. */
    offerComponentSeatTypesBizOfferVersionIdx: index(
      "offer_component_seat_types_biz_offer_version_idx",
    ).on(table.bizId, table.offerVersionId),

    /** Tenant-safe FK to version owner. */
    offerComponentSeatTypesBizOfferVersionFk: foreignKey({
      columns: [table.bizId, table.offerVersionId],
      foreignColumns: [offerVersions.bizId, offerVersions.id],
      name: "offer_component_seat_types_biz_offer_version_fk",
    }),

    /** Tenant-safe FK to optional component owner. */
    offerComponentSeatTypesBizComponentFk: foreignKey({
      columns: [table.bizId, table.componentId],
      foreignColumns: [offerComponents.bizId, offerComponents.id],
      name: "offer_component_seat_types_biz_component_fk",
    }),

    /** Seat counts must be non-negative. */
    offerComponentSeatTypesMinSeatsCheck: check(
      "offer_component_seat_types_min_seats_check",
      sql`"min_seats" >= 0`,
    ),

    /** Max seats cannot be less than min seats. */
    offerComponentSeatTypesMaxSeatsCheck: check(
      "offer_component_seat_types_max_seats_check",
      sql`"max_seats" IS NULL OR "max_seats" >= "min_seats"`,
    ),

    /** Default seats must sit inside allowed bounds. */
    offerComponentSeatTypesDefaultSeatsCheck: check(
      "offer_component_seat_types_default_seats_check",
      sql`
      "default_seats" >= "min_seats"
      AND ("max_seats" IS NULL OR "default_seats" <= "max_seats")
      `,
    ),

    /**
     * Pricing payload shape check.
     *
     * Ensures each pricing mode has exactly the needed fields to prevent
     * ambiguous line-item calculations later.
     */
    offerComponentSeatTypesPricingShapeCheck: check(
      "offer_component_seat_types_pricing_shape_check",
      sql`
      (
        "pricing_mode" = 'included'
        AND "price_delta_minor" IS NULL
        AND "price_multiplier_bps" IS NULL
      ) OR (
        "pricing_mode" = 'surcharge'
        AND "price_delta_minor" IS NOT NULL
        AND "price_multiplier_bps" IS NULL
      ) OR (
        "pricing_mode" = 'multiplier'
        AND "price_delta_minor" IS NULL
        AND "price_multiplier_bps" IS NOT NULL
      )
      `,
    ),
  }),
);

export type Offer = typeof offers.$inferSelect;
export type NewOffer = typeof offers.$inferInsert;

export type OfferVersion = typeof offerVersions.$inferSelect;
export type NewOfferVersion = typeof offerVersions.$inferInsert;

export type OfferComponent = typeof offerComponents.$inferSelect;
export type NewOfferComponent = typeof offerComponents.$inferInsert;
