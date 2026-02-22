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
  demandPricingEvaluationStatusEnum,
  demandPricingPolicyStatusEnum,
  demandPricingScoringModeEnum,
  demandPricingTargetTypeEnum,
  demandSignalAggregationMethodEnum,
  demandSignalKindEnum,
  demandSignalSourceEnum,
  pricingAdjustmentTypeEnum,
  pricingApplyAsEnum,
} from "./enums";
import { bookingOrderLines, bookingOrders } from "./fulfillment";
import { locations } from "./locations";
import { offers, offerVersions } from "./offers";
import { resources } from "./resources";
import { serviceProducts } from "./service_products";
import { services } from "./services";
import { users } from "./users";

/**
 * demand_signal_definitions
 *
 * ELI5:
 * A demand signal definition is the "recipe" for one measurable pressure input
 * used by automated pricing.
 *
 * Examples:
 * - quote requests per hour for one service,
 * - waitlist depth for one offer version,
 * - capacity utilization for one location.
 *
 * Why this table exists:
 * - keeps demand metrics normalized and reusable across policies,
 * - separates "what signal means" from observed values,
 * - avoids hardcoding demand indicators in application code.
 */
export const demandSignalDefinitions = pgTable(
  "demand_signal_definitions",
  {
    /** Stable primary key for one signal definition recipe. */
    id: idWithTag("demand_signal"),

    /** Tenant boundary for strict multi-biz isolation. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Human label shown in pricing/admin tooling. */
    name: varchar("name", { length: 180 }).notNull(),

    /** Stable machine key used by workers, APIs, and imports. */
    slug: varchar("slug", { length: 140 }).notNull(),

    /** Optional plain-language explanation for operators. */
    description: text("description"),

    /** Signal category (quotes, utilization, waitlist, etc.). */
    kind: demandSignalKindEnum("kind").notNull(),

    /** Origin of observations for this signal. */
    source: demandSignalSourceEnum("source").default("system").notNull(),

    /**
     * How raw events are aggregated into one observed value.
     * Example: sum of quote events in rolling 60 minutes.
     */
    aggregationMethod: demandSignalAggregationMethodEnum("aggregation_method")
      .default("avg")
      .notNull(),

    /** Rolling window length used for aggregation. */
    aggregationWindowMin: integer("aggregation_window_min").default(60).notNull(),

    /**
     * Integer scaling factor for signal values.
     * Example: 10000 means value is stored in basis points precision.
     */
    valueScale: integer("value_scale").default(10000).notNull(),

    /**
     * Signal target scope type.
     * Exactly one payload field below must match this selector.
     */
    targetType: demandPricingTargetTypeEnum("target_type")
      .default("global")
      .notNull(),

    /** Target payload for `target_type=resource`. */
    resourceId: idRef("resource_id").references(() => resources.id),

    /** Target payload for `target_type=service`. */
    serviceId: idRef("service_id").references(() => services.id),

    /** Target payload for `target_type=service_product`. */
    serviceProductId: idRef("service_product_id").references(
      () => serviceProducts.id,
    ),

    /** Target payload for `target_type=offer`. */
    offerId: idRef("offer_id").references(() => offers.id),

    /** Target payload for `target_type=offer_version`. */
    offerVersionId: idRef("offer_version_id").references(() => offerVersions.id),

    /** Target payload for `target_type=location`. */
    locationId: idRef("location_id").references(() => locations.id),

    /** Toggle for staged rollout without deleting signal recipes. */
    isEnabled: boolean("is_enabled").default(true).notNull(),

    /** Timezone used for local-time demand bucketing. */
    timezone: varchar("timezone", { length: 50 }).default("UTC").notNull(),

    /** Extension payload for connector-specific attributes. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite unique key for tenant-safe child FKs. */
    demandSignalDefinitionsBizIdIdUnique: uniqueIndex(
      "demand_signal_definitions_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** One slug identity per tenant. */
    demandSignalDefinitionsBizSlugUnique: uniqueIndex(
      "demand_signal_definitions_biz_slug_unique",
    ).on(table.bizId, table.slug),

    /** Common lookup path for active signal pipelines. */
    demandSignalDefinitionsBizEnabledKindIdx: index(
      "demand_signal_definitions_biz_enabled_kind_idx",
    ).on(table.bizId, table.isEnabled, table.kind),

    /** Tenant-safe FK to optional resource scope payload. */
    demandSignalDefinitionsBizResourceFk: foreignKey({
      columns: [table.bizId, table.resourceId],
      foreignColumns: [resources.bizId, resources.id],
      name: "demand_signal_definitions_biz_resource_fk",
    }),

    /** Tenant-safe FK to optional service scope payload. */
    demandSignalDefinitionsBizServiceFk: foreignKey({
      columns: [table.bizId, table.serviceId],
      foreignColumns: [services.bizId, services.id],
      name: "demand_signal_definitions_biz_service_fk",
    }),

    /** Tenant-safe FK to optional service-product scope payload. */
    demandSignalDefinitionsBizServiceProductFk: foreignKey({
      columns: [table.bizId, table.serviceProductId],
      foreignColumns: [serviceProducts.bizId, serviceProducts.id],
      name: "demand_signal_definitions_biz_service_product_fk",
    }),

    /** Tenant-safe FK to optional offer scope payload. */
    demandSignalDefinitionsBizOfferFk: foreignKey({
      columns: [table.bizId, table.offerId],
      foreignColumns: [offers.bizId, offers.id],
      name: "demand_signal_definitions_biz_offer_fk",
    }),

    /** Tenant-safe FK to optional offer-version scope payload. */
    demandSignalDefinitionsBizOfferVersionFk: foreignKey({
      columns: [table.bizId, table.offerVersionId],
      foreignColumns: [offerVersions.bizId, offerVersions.id],
      name: "demand_signal_definitions_biz_offer_version_fk",
    }),

    /** Tenant-safe FK to optional location scope payload. */
    demandSignalDefinitionsBizLocationFk: foreignKey({
      columns: [table.bizId, table.locationId],
      foreignColumns: [locations.bizId, locations.id],
      name: "demand_signal_definitions_biz_location_fk",
    }),

    /** Numeric fields must be positive to keep scaling deterministic. */
    demandSignalDefinitionsNumericCheck: check(
      "demand_signal_definitions_numeric_check",
      sql`"aggregation_window_min" > 0 AND "value_scale" > 0`,
    ),

    /** Scope shape invariant by target type. */
    demandSignalDefinitionsTargetShapeCheck: check(
      "demand_signal_definitions_target_shape_check",
      sql`
      (
        "target_type" = 'global'
        AND "resource_id" IS NULL
        AND "service_id" IS NULL
        AND "service_product_id" IS NULL
        AND "offer_id" IS NULL
        AND "offer_version_id" IS NULL
        AND "location_id" IS NULL
      ) OR (
        "target_type" = 'resource'
        AND "resource_id" IS NOT NULL
        AND "service_id" IS NULL
        AND "service_product_id" IS NULL
        AND "offer_id" IS NULL
        AND "offer_version_id" IS NULL
        AND "location_id" IS NULL
      ) OR (
        "target_type" = 'service'
        AND "resource_id" IS NULL
        AND "service_id" IS NOT NULL
        AND "service_product_id" IS NULL
        AND "offer_id" IS NULL
        AND "offer_version_id" IS NULL
        AND "location_id" IS NULL
      ) OR (
        "target_type" = 'service_product'
        AND "resource_id" IS NULL
        AND "service_id" IS NULL
        AND "service_product_id" IS NOT NULL
        AND "offer_id" IS NULL
        AND "offer_version_id" IS NULL
        AND "location_id" IS NULL
      ) OR (
        "target_type" = 'offer'
        AND "resource_id" IS NULL
        AND "service_id" IS NULL
        AND "service_product_id" IS NULL
        AND "offer_id" IS NOT NULL
        AND "offer_version_id" IS NULL
        AND "location_id" IS NULL
      ) OR (
        "target_type" = 'offer_version'
        AND "resource_id" IS NULL
        AND "service_id" IS NULL
        AND "service_product_id" IS NULL
        AND "offer_id" IS NULL
        AND "offer_version_id" IS NOT NULL
        AND "location_id" IS NULL
      ) OR (
        "target_type" = 'location'
        AND "resource_id" IS NULL
        AND "service_id" IS NULL
        AND "service_product_id" IS NULL
        AND "offer_id" IS NULL
        AND "offer_version_id" IS NULL
        AND "location_id" IS NOT NULL
      )
      `,
    ),
  }),
);

/**
 * demand_signal_observations
 *
 * ELI5:
 * This is the append-style history of measured signal values over time.
 *
 * One row usually represents:
 * - one signal definition,
 * - one time window,
 * - one observed value (scaled integer).
 */
export const demandSignalObservations = pgTable(
  "demand_signal_observations",
  {
    /** Stable primary key for one observation sample. */
    id: idWithTag("demand_observation"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Signal definition this observation belongs to. */
    demandSignalDefinitionId: idRef("demand_signal_definition_id")
      .references(() => demandSignalDefinitions.id)
      .notNull(),

    /** Inclusive observation window start. */
    windowStartAt: timestamp("window_start_at", { withTimezone: true }).notNull(),

    /** Exclusive observation window end. */
    windowEndAt: timestamp("window_end_at", { withTimezone: true }).notNull(),

    /** Time this sample was recorded in DB. */
    observedAt: timestamp("observed_at", { withTimezone: true }).defaultNow().notNull(),

    /**
     * Scaled integer signal value.
     * Interpretation uses `demand_signal_definitions.value_scale`.
     */
    value: integer("value").notNull(),

    /** Optional sample size used to compute this value. */
    sampleSize: integer("sample_size"),

    /**
     * Optional confidence in basis points (0..10000).
     * Useful for forecast/import signal quality weighting.
     */
    confidenceBps: integer("confidence_bps"),

    /** Observation source at row level (can differ from definition defaults). */
    source: demandSignalSourceEnum("source").default("system").notNull(),

    /** Optional external id for upstream traceability. */
    sourceRef: varchar("source_ref", { length: 200 }),

    /** Optional idempotency key for safe retried ingestion jobs. */
    idempotencyKey: varchar("idempotency_key", { length: 200 }),

    /** Optional dimensional details used by analytics/debugging. */
    dimensions: jsonb("dimensions").default({}),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    demandSignalObservationsBizIdIdUnique: uniqueIndex("demand_signal_observations_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Unique observation key per definition and window. */
    demandSignalObservationsDefinitionWindowUnique: uniqueIndex(
      "demand_signal_observations_definition_window_unique",
    ).on(table.demandSignalDefinitionId, table.windowStartAt, table.windowEndAt, table.source),

    /** Optional idempotency dedupe guard. */
    demandSignalObservationsBizIdempotencyUnique: uniqueIndex(
      "demand_signal_observations_biz_idempotency_unique",
    )
      .on(table.bizId, table.idempotencyKey)
      .where(sql`"idempotency_key" IS NOT NULL`),

    /** Common trend-analysis path by signal over time. */
    demandSignalObservationsBizSignalWindowIdx: index(
      "demand_signal_observations_biz_signal_window_idx",
    ).on(table.bizId, table.demandSignalDefinitionId, table.windowStartAt),

    /** Tenant-safe FK to parent signal definition. */
    demandSignalObservationsBizDefinitionFk: foreignKey({
      columns: [table.bizId, table.demandSignalDefinitionId],
      foreignColumns: [demandSignalDefinitions.bizId, demandSignalDefinitions.id],
      name: "demand_signal_observations_biz_definition_fk",
    }),

    /** Window must be time-ordered. */
    demandSignalObservationsWindowCheck: check(
      "demand_signal_observations_window_check",
      sql`"window_end_at" > "window_start_at"`,
    ),

    /** Optional confidence and sample-size bounds. */
    demandSignalObservationsBoundsCheck: check(
      "demand_signal_observations_bounds_check",
      sql`
      ("sample_size" IS NULL OR "sample_size" >= 0)
      AND ("confidence_bps" IS NULL OR ("confidence_bps" >= 0 AND "confidence_bps" <= 10000))
      `,
    ),
  }),
);

/**
 * demand_pricing_policies
 *
 * ELI5:
 * A policy defines:
 * - where automated pricing applies,
 * - how demand score is computed,
 * - guardrails to cap/limit resulting price changes.
 *
 * Rules/tiers are stored separately so one policy can express multiple score
 * bands without duplicating scope metadata.
 */
export const demandPricingPolicies = pgTable(
  "demand_pricing_policies",
  {
    /** Stable primary key for one automated pricing policy. */
    id: idWithTag("demand_policy"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Human policy label shown in admin. */
    name: varchar("name", { length: 200 }).notNull(),

    /** Stable machine key for APIs and policy resolution. */
    slug: varchar("slug", { length: 140 }).notNull(),

    /** Optional plain-language explanation. */
    description: text("description"),

    /** Policy lifecycle state. */
    status: demandPricingPolicyStatusEnum("status").default("draft").notNull(),

    /** Scope selector discriminator. */
    targetType: demandPricingTargetTypeEnum("target_type")
      .default("global")
      .notNull(),

    /** Target payload for `target_type=resource`. */
    resourceId: idRef("resource_id").references(() => resources.id),

    /** Target payload for `target_type=service`. */
    serviceId: idRef("service_id").references(() => services.id),

    /** Target payload for `target_type=service_product`. */
    serviceProductId: idRef("service_product_id").references(
      () => serviceProducts.id,
    ),

    /** Target payload for `target_type=offer`. */
    offerId: idRef("offer_id").references(() => offers.id),

    /** Target payload for `target_type=offer_version`. */
    offerVersionId: idRef("offer_version_id").references(() => offerVersions.id),

    /** Target payload for `target_type=location`. */
    locationId: idRef("location_id").references(() => locations.id),

    /** Score combination strategy for bound signals. */
    scoringMode: demandPricingScoringModeEnum("scoring_mode")
      .default("weighted_sum")
      .notNull(),

    /** Lower score bound used in normalization/clamping. */
    scoreFloor: integer("score_floor").default(0).notNull(),

    /** Upper score bound used in normalization/clamping. */
    scoreCeiling: integer("score_ceiling").default(10000).notNull(),

    /** Fallback adjustment type when no tier-specific override is set. */
    defaultAdjustmentType: pricingAdjustmentTypeEnum("default_adjustment_type")
      .default("percentage")
      .notNull(),

    /** Fallback accounting/UI classification for applied adjustment. */
    defaultApplyAs: pricingApplyAsEnum("default_apply_as")
      .default("surcharge")
      .notNull(),

    /**
     * Optional policy-level default adjustment value.
     * Semantics follow `default_adjustment_type`.
     */
    defaultAdjustmentValue: integer("default_adjustment_value"),

    /** Optional lower cap for computed adjustment amount (minor units). */
    minAdjustmentMinor: integer("min_adjustment_minor"),

    /** Optional upper cap for computed adjustment amount (minor units). */
    maxAdjustmentMinor: integer("max_adjustment_minor"),

    /** Optional hard floor for resulting final unit price. */
    minFinalUnitPriceMinor: integer("min_final_unit_price_minor"),

    /** Optional hard ceiling for resulting final unit price. */
    maxFinalUnitPriceMinor: integer("max_final_unit_price_minor"),

    /** Cooldown between repeated applications for same target context. */
    cooldownMin: integer("cooldown_min").default(0).notNull(),

    /** Policy effective window start. */
    effectiveStartAt: timestamp("effective_start_at", { withTimezone: true }),

    /** Policy effective window end. */
    effectiveEndAt: timestamp("effective_end_at", { withTimezone: true }),

    /** Lower number means higher evaluation precedence. */
    priority: integer("priority").default(100).notNull(),

    /** Toggle for staged rollout without deleting policy rows. */
    isEnabled: boolean("is_enabled").default(true).notNull(),

    /** Policy-level settings for evaluation workers. */
    policy: jsonb("policy").default({}),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite unique key for tenant-safe child FKs. */
    demandPricingPoliciesBizIdIdUnique: uniqueIndex(
      "demand_pricing_policies_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** One slug identity per tenant. */
    demandPricingPoliciesBizSlugUnique: uniqueIndex(
      "demand_pricing_policies_biz_slug_unique",
    ).on(table.bizId, table.slug),

    /** Common policy resolution query path. */
    demandPricingPoliciesBizEnabledPriorityIdx: index(
      "demand_pricing_policies_biz_enabled_priority_idx",
    ).on(table.bizId, table.isEnabled, table.status, table.priority),

    /** Tenant-safe FK to optional resource scope payload. */
    demandPricingPoliciesBizResourceFk: foreignKey({
      columns: [table.bizId, table.resourceId],
      foreignColumns: [resources.bizId, resources.id],
      name: "demand_pricing_policies_biz_resource_fk",
    }),

    /** Tenant-safe FK to optional service scope payload. */
    demandPricingPoliciesBizServiceFk: foreignKey({
      columns: [table.bizId, table.serviceId],
      foreignColumns: [services.bizId, services.id],
      name: "demand_pricing_policies_biz_service_fk",
    }),

    /** Tenant-safe FK to optional service-product scope payload. */
    demandPricingPoliciesBizServiceProductFk: foreignKey({
      columns: [table.bizId, table.serviceProductId],
      foreignColumns: [serviceProducts.bizId, serviceProducts.id],
      name: "demand_pricing_policies_biz_service_product_fk",
    }),

    /** Tenant-safe FK to optional offer scope payload. */
    demandPricingPoliciesBizOfferFk: foreignKey({
      columns: [table.bizId, table.offerId],
      foreignColumns: [offers.bizId, offers.id],
      name: "demand_pricing_policies_biz_offer_fk",
    }),

    /** Tenant-safe FK to optional offer-version scope payload. */
    demandPricingPoliciesBizOfferVersionFk: foreignKey({
      columns: [table.bizId, table.offerVersionId],
      foreignColumns: [offerVersions.bizId, offerVersions.id],
      name: "demand_pricing_policies_biz_offer_version_fk",
    }),

    /** Tenant-safe FK to optional location scope payload. */
    demandPricingPoliciesBizLocationFk: foreignKey({
      columns: [table.bizId, table.locationId],
      foreignColumns: [locations.bizId, locations.id],
      name: "demand_pricing_policies_biz_location_fk",
    }),

    /** Numeric policy fields must be valid and ordered. */
    demandPricingPoliciesNumericCheck: check(
      "demand_pricing_policies_numeric_check",
      sql`
      "score_floor" >= 0
      AND "score_ceiling" >= "score_floor"
      AND "priority" >= 0
      AND "cooldown_min" >= 0
      AND ("min_adjustment_minor" IS NULL OR "max_adjustment_minor" IS NULL OR "max_adjustment_minor" >= "min_adjustment_minor")
      AND ("min_final_unit_price_minor" IS NULL OR "min_final_unit_price_minor" >= 0)
      AND ("max_final_unit_price_minor" IS NULL OR "max_final_unit_price_minor" >= 0)
      AND ("min_final_unit_price_minor" IS NULL OR "max_final_unit_price_minor" IS NULL OR "max_final_unit_price_minor" >= "min_final_unit_price_minor")
      `,
    ),

    /** Effective window must be ordered when both ends are present. */
    demandPricingPoliciesEffectiveWindowCheck: check(
      "demand_pricing_policies_effective_window_check",
      sql`"effective_end_at" IS NULL OR "effective_start_at" IS NULL OR "effective_end_at" > "effective_start_at"`,
    ),

    /** Target scope shape invariant by selector discriminator. */
    demandPricingPoliciesTargetShapeCheck: check(
      "demand_pricing_policies_target_shape_check",
      sql`
      (
        "target_type" = 'global'
        AND "resource_id" IS NULL
        AND "service_id" IS NULL
        AND "service_product_id" IS NULL
        AND "offer_id" IS NULL
        AND "offer_version_id" IS NULL
        AND "location_id" IS NULL
      ) OR (
        "target_type" = 'resource'
        AND "resource_id" IS NOT NULL
        AND "service_id" IS NULL
        AND "service_product_id" IS NULL
        AND "offer_id" IS NULL
        AND "offer_version_id" IS NULL
        AND "location_id" IS NULL
      ) OR (
        "target_type" = 'service'
        AND "resource_id" IS NULL
        AND "service_id" IS NOT NULL
        AND "service_product_id" IS NULL
        AND "offer_id" IS NULL
        AND "offer_version_id" IS NULL
        AND "location_id" IS NULL
      ) OR (
        "target_type" = 'service_product'
        AND "resource_id" IS NULL
        AND "service_id" IS NULL
        AND "service_product_id" IS NOT NULL
        AND "offer_id" IS NULL
        AND "offer_version_id" IS NULL
        AND "location_id" IS NULL
      ) OR (
        "target_type" = 'offer'
        AND "resource_id" IS NULL
        AND "service_id" IS NULL
        AND "service_product_id" IS NULL
        AND "offer_id" IS NOT NULL
        AND "offer_version_id" IS NULL
        AND "location_id" IS NULL
      ) OR (
        "target_type" = 'offer_version'
        AND "resource_id" IS NULL
        AND "service_id" IS NULL
        AND "service_product_id" IS NULL
        AND "offer_id" IS NULL
        AND "offer_version_id" IS NOT NULL
        AND "location_id" IS NULL
      ) OR (
        "target_type" = 'location'
        AND "resource_id" IS NULL
        AND "service_id" IS NULL
        AND "service_product_id" IS NULL
        AND "offer_id" IS NULL
        AND "offer_version_id" IS NULL
        AND "location_id" IS NOT NULL
      )
      `,
    ),
  }),
);

/**
 * demand_pricing_policy_signals
 *
 * ELI5:
 * These rows connect a policy to the demand signals it consumes.
 *
 * Each row defines:
 * - which signal to read,
 * - how strongly it contributes (weight),
 * - freshness requirement,
 * - optional transformation (offset/multiplier/clamps).
 */
export const demandPricingPolicySignals = pgTable(
  "demand_pricing_policy_signals",
  {
    /** Stable primary key. */
    id: idWithTag("demand_policy_signal"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent demand-pricing policy. */
    demandPricingPolicyId: idRef("demand_pricing_policy_id")
      .references(() => demandPricingPolicies.id)
      .notNull(),

    /** Input signal consumed by this policy. */
    demandSignalDefinitionId: idRef("demand_signal_definition_id")
      .references(() => demandSignalDefinitions.id)
      .notNull(),

    /**
     * Weight in basis points used by weighted scoring mode.
     * Example: 5000 = 50% weight.
     */
    weightBps: integer("weight_bps").default(10000).notNull(),

    /** Whether policy evaluation requires this signal to be present/fresh. */
    isRequired: boolean("is_required").default(false).notNull(),

    /** Maximum acceptable age of latest observation before considered stale. */
    freshnessMaxMin: integer("freshness_max_min").default(180).notNull(),

    /** Additive offset applied before multiplier and clamping. */
    offsetValue: integer("offset_value").default(0).notNull(),

    /**
     * Multiplier in basis points applied after offset.
     * Example: 12000 means 1.2x transformed signal.
     */
    multiplierBps: integer("multiplier_bps").default(10000).notNull(),

    /** Optional lower clamp for transformed signal value. */
    clampMinValue: integer("clamp_min_value"),

    /** Optional upper clamp for transformed signal value. */
    clampMaxValue: integer("clamp_max_value"),

    /** Deterministic ordering for scoring pipeline traces. */
    sortOrder: integer("sort_order").default(100).notNull(),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    demandPricingPolicySignalsBizIdIdUnique: uniqueIndex("demand_pricing_policy_signals_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** One row per policy+signal pair. */
    demandPricingPolicySignalsUnique: uniqueIndex(
      "demand_pricing_policy_signals_unique",
    ).on(table.demandPricingPolicyId, table.demandSignalDefinitionId),

    /** Common evaluation path for one policy. */
    demandPricingPolicySignalsBizPolicySortIdx: index(
      "demand_pricing_policy_signals_biz_policy_sort_idx",
    ).on(table.bizId, table.demandPricingPolicyId, table.sortOrder),

    /** Tenant-safe FK to parent policy. */
    demandPricingPolicySignalsBizPolicyFk: foreignKey({
      columns: [table.bizId, table.demandPricingPolicyId],
      foreignColumns: [demandPricingPolicies.bizId, demandPricingPolicies.id],
      name: "demand_pricing_policy_signals_biz_policy_fk",
    }),

    /** Tenant-safe FK to signal definition. */
    demandPricingPolicySignalsBizSignalFk: foreignKey({
      columns: [table.bizId, table.demandSignalDefinitionId],
      foreignColumns: [demandSignalDefinitions.bizId, demandSignalDefinitions.id],
      name: "demand_pricing_policy_signals_biz_signal_fk",
    }),

    /** Bounds checks for transform and freshness parameters. */
    demandPricingPolicySignalsBoundsCheck: check(
      "demand_pricing_policy_signals_bounds_check",
      sql`
      "weight_bps" >= 0
      AND "freshness_max_min" >= 0
      AND "multiplier_bps" >= 0
      AND "sort_order" >= 0
      AND ("clamp_max_value" IS NULL OR "clamp_min_value" IS NULL OR "clamp_max_value" >= "clamp_min_value")
      `,
    ),
  }),
);

/**
 * demand_pricing_policy_tiers
 *
 * ELI5:
 * Tiers map score bands to pricing adjustments.
 *
 * Example:
 * - score 0..2999 => no change,
 * - score 3000..6999 => +5% surcharge,
 * - score 7000+ => +15% surcharge with cap.
 */
export const demandPricingPolicyTiers = pgTable(
  "demand_pricing_policy_tiers",
  {
    /** Stable primary key. */
    id: idWithTag("demand_tier"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent policy this tier belongs to. */
    demandPricingPolicyId: idRef("demand_pricing_policy_id")
      .references(() => demandPricingPolicies.id)
      .notNull(),

    /** Human tier label for admin visibility. */
    name: varchar("name", { length: 180 }).notNull(),

    /** Inclusive lower score bound for this tier. */
    minScore: integer("min_score").default(0).notNull(),

    /** Inclusive upper score bound; null means open-ended. */
    maxScore: integer("max_score"),

    /** How this tier transforms price. */
    adjustmentType: pricingAdjustmentTypeEnum("adjustment_type")
      .default("percentage")
      .notNull(),

    /** Accounting/UI category for resulting price delta. */
    applyAs: pricingApplyAsEnum("apply_as").default("surcharge").notNull(),

    /**
     * Adjustment value interpreted by `adjustment_type`.
     * - percentage: basis points (1000 = 10%)
     * - fixed_amount: minor units (+/-)
     * - set_price: target unit price in minor units
     */
    adjustmentValue: integer("adjustment_value").notNull(),

    /** Optional lower cap for this tier's adjustment amount. */
    minAdjustmentMinor: integer("min_adjustment_minor"),

    /** Optional upper cap for this tier's adjustment amount. */
    maxAdjustmentMinor: integer("max_adjustment_minor"),

    /** Deterministic ordering for tier evaluation/inspection. */
    sortOrder: integer("sort_order").default(100).notNull(),

    /** Toggle for safe staged rollout of individual tiers. */
    isActive: boolean("is_active").default(true).notNull(),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite unique key for tenant-safe evaluation FKs. */
    demandPricingPolicyTiersBizIdIdUnique: uniqueIndex(
      "demand_pricing_policy_tiers_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** Tier list path for one policy. */
    demandPricingPolicyTiersBizPolicySortIdx: index(
      "demand_pricing_policy_tiers_biz_policy_sort_idx",
    ).on(table.bizId, table.demandPricingPolicyId, table.sortOrder),

    /** Tenant-safe FK to parent policy. */
    demandPricingPolicyTiersBizPolicyFk: foreignKey({
      columns: [table.bizId, table.demandPricingPolicyId],
      foreignColumns: [demandPricingPolicies.bizId, demandPricingPolicies.id],
      name: "demand_pricing_policy_tiers_biz_policy_fk",
    }),

    /** Score and cap bounds checks. */
    demandPricingPolicyTiersBoundsCheck: check(
      "demand_pricing_policy_tiers_bounds_check",
      sql`
      "min_score" >= 0
      AND ("max_score" IS NULL OR "max_score" >= "min_score")
      AND "sort_order" >= 0
      AND ("min_adjustment_minor" IS NULL OR "max_adjustment_minor" IS NULL OR "max_adjustment_minor" >= "min_adjustment_minor")
      `,
    ),

    /** Adjustment value shape check by adjustment type. */
    demandPricingPolicyTiersAdjustmentShapeCheck: check(
      "demand_pricing_policy_tiers_adjustment_shape_check",
      sql`
      (
        "adjustment_type" = 'set_price'
        AND "adjustment_value" >= 0
      ) OR (
        "adjustment_type" = 'fixed_amount'
      ) OR (
        "adjustment_type" = 'percentage'
        AND "adjustment_value" >= -100000
        AND "adjustment_value" <= 100000
      )
      `,
    ),
  }),
);

/**
 * demand_pricing_evaluations
 *
 * ELI5:
 * Every automated pricing run can write one row here as an explainable trace.
 *
 * Why this matters:
 * - support can answer "why was surge applied?",
 * - analytics can inspect demand score evolution,
 * - auditors can trace policy/tier chosen for each quote/order event.
 */
export const demandPricingEvaluations = pgTable(
  "demand_pricing_evaluations",
  {
    /** Stable primary key. */
    id: idWithTag("demand_eval"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Policy used during this evaluation run. */
    demandPricingPolicyId: idRef("demand_pricing_policy_id")
      .references(() => demandPricingPolicies.id)
      .notNull(),

    /** Optional tier that matched computed score. */
    demandPricingPolicyTierId: idRef("demand_pricing_policy_tier_id").references(
      () => demandPricingPolicyTiers.id,
    ),

    /** Optional booking order context. */
    bookingOrderId: idRef("booking_order_id").references(() => bookingOrders.id),

    /** Optional booking line context. */
    bookingOrderLineId: idRef("booking_order_line_id").references(
      () => bookingOrderLines.id,
    ),

    /** Optional slot/range window start evaluated by quote/pricing engine. */
    windowStartAt: timestamp("window_start_at", { withTimezone: true }),

    /** Optional slot/range window end evaluated by quote/pricing engine. */
    windowEndAt: timestamp("window_end_at", { withTimezone: true }),

    /** Evaluation status outcome. */
    status: demandPricingEvaluationStatusEnum("status").notNull(),

    /** Base unit price before automated demand adjustment. */
    baseUnitPriceMinor: integer("base_unit_price_minor").notNull(),

    /** Computed composite demand score used for tier matching. */
    computedScore: integer("computed_score"),

    /** Applied adjustment type after tier/policy resolution. */
    adjustmentType: pricingAdjustmentTypeEnum("adjustment_type"),

    /** Applied adjustment accounting category. */
    applyAs: pricingApplyAsEnum("apply_as"),

    /**
     * Raw adjustment value selected by tier/policy.
     * Semantics follow `adjustment_type`.
     */
    adjustmentValue: integer("adjustment_value"),

    /** Final adjustment amount in minor units after caps/guards. */
    adjustmentAmountMinor: integer("adjustment_amount_minor").default(0).notNull(),

    /** Final unit price after applying adjustment amount. */
    finalUnitPriceMinor: integer("final_unit_price_minor").notNull(),

    /** Optional short reason code for result (tier_miss, stale_signal, etc.). */
    reasonCode: varchar("reason_code", { length: 120 }),

    /** Optional idempotency key for deduped quote retries. */
    requestKey: varchar("request_key", { length: 200 }),

    /** Snapshot of signal values read during this evaluation. */
    signalSnapshot: jsonb("signal_snapshot").default({}).notNull(),

    /** Detailed calculation trace for explainability/debugging. */
    calculationTrace: jsonb("calculation_trace").default({}).notNull(),

    /** Timestamp when evaluation finished. */
    evaluatedAt: timestamp("evaluated_at", { withTimezone: true }).defaultNow().notNull(),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite unique key for tenant-safe application FKs. */
    demandPricingEvaluationsBizIdIdUnique: uniqueIndex(
      "demand_pricing_evaluations_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** Optional dedupe for idempotent request replay. */
    demandPricingEvaluationsBizRequestKeyUnique: uniqueIndex(
      "demand_pricing_evaluations_biz_request_key_unique",
    )
      .on(table.bizId, table.requestKey)
      .where(sql`"request_key" IS NOT NULL`),

    /** Common lookup path by policy and evaluation time. */
    demandPricingEvaluationsBizPolicyAtIdx: index(
      "demand_pricing_evaluations_biz_policy_at_idx",
    ).on(table.bizId, table.demandPricingPolicyId, table.evaluatedAt),

    /** Common lookup path by booking line context. */
    demandPricingEvaluationsBizBookingLineIdx: index(
      "demand_pricing_evaluations_biz_booking_line_idx",
    ).on(table.bizId, table.bookingOrderLineId, table.evaluatedAt),

    /** Tenant-safe FK to policy. */
    demandPricingEvaluationsBizPolicyFk: foreignKey({
      columns: [table.bizId, table.demandPricingPolicyId],
      foreignColumns: [demandPricingPolicies.bizId, demandPricingPolicies.id],
      name: "demand_pricing_evaluations_biz_policy_fk",
    }),

    /** Tenant-safe FK to optional tier. */
    demandPricingEvaluationsBizTierFk: foreignKey({
      columns: [table.bizId, table.demandPricingPolicyTierId],
      foreignColumns: [demandPricingPolicyTiers.bizId, demandPricingPolicyTiers.id],
      name: "demand_pricing_evaluations_biz_tier_fk",
    }),

    /** Tenant-safe FK to optional booking order. */
    demandPricingEvaluationsBizBookingOrderFk: foreignKey({
      columns: [table.bizId, table.bookingOrderId],
      foreignColumns: [bookingOrders.bizId, bookingOrders.id],
      name: "demand_pricing_evaluations_biz_booking_order_fk",
    }),

    /** Tenant-safe FK to optional booking line. */
    demandPricingEvaluationsBizBookingLineFk: foreignKey({
      columns: [table.bizId, table.bookingOrderLineId],
      foreignColumns: [bookingOrderLines.bizId, bookingOrderLines.id],
      name: "demand_pricing_evaluations_biz_booking_line_fk",
    }),

    /** Price math and bounds checks. */
    demandPricingEvaluationsPriceCheck: check(
      "demand_pricing_evaluations_price_check",
      sql`
      "base_unit_price_minor" >= 0
      AND "final_unit_price_minor" >= 0
      AND "final_unit_price_minor" = ("base_unit_price_minor" + "adjustment_amount_minor")
      `,
    ),

    /** Optional time window must be ordered. */
    demandPricingEvaluationsWindowCheck: check(
      "demand_pricing_evaluations_window_check",
      sql`"window_start_at" IS NULL OR "window_end_at" IS NULL OR "window_end_at" > "window_start_at"`,
    ),

    /** At least one commercial or request context should exist for traceability. */
    demandPricingEvaluationsContextCheck: check(
      "demand_pricing_evaluations_context_check",
      sql`
      "booking_order_id" IS NOT NULL
      OR "booking_order_line_id" IS NOT NULL
      OR "request_key" IS NOT NULL
      `,
    ),
  }),
);

/**
 * demand_pricing_applications
 *
 * ELI5:
 * This is the append-style record of "we actually applied that evaluation
 * result to commerce."
 *
 * Why separate from evaluations:
 * - evaluation can run without final application (preview/quote),
 * - application captures commercial lock-in and reversals explicitly.
 */
export const demandPricingApplications = pgTable(
  "demand_pricing_applications",
  {
    /** Stable primary key. */
    id: idWithTag("demand_apply"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Source evaluation that produced this applied pricing decision. */
    demandPricingEvaluationId: idRef("demand_pricing_evaluation_id")
      .references(() => demandPricingEvaluations.id)
      .notNull(),

    /** Optional booking order context that received this application. */
    bookingOrderId: idRef("booking_order_id").references(() => bookingOrders.id),

    /** Optional booking line context that received this application. */
    bookingOrderLineId: idRef("booking_order_line_id").references(
      () => bookingOrderLines.id,
    ),

    /** Signed amount applied to price in minor units. */
    appliedAmountMinor: integer("applied_amount_minor").notNull(),

    /** Final unit price after application in minor units. */
    appliedFinalUnitPriceMinor: integer("applied_final_unit_price_minor").notNull(),

    /** Currency used when applied (snapshot). */
    currency: varchar("currency", { length: 3 }).default("USD").notNull(),

    /** Timestamp when adjustment was committed to commerce. */
    appliedAt: timestamp("applied_at", { withTimezone: true }).defaultNow().notNull(),

    /**
     * Lock marker for invoice/ledger immutability workflows.
     * When true, application should only be changed via explicit reversal rows.
     */
    isLocked: boolean("is_locked").default(false).notNull(),

    /** Optional pointer to the application row this one reverses. */
    reversalOfApplicationId: idRef("reversal_of_application_id"),

    /** Optional operations/support note. */
    note: text("note"),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /**
     * Composite unique target used by tenant-safe self references.
     * Postgres requires referenced columns of a composite FK to be unique.
     */
    demandPricingApplicationsBizIdIdUnique: uniqueIndex(
      "demand_pricing_applications_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** Common timeline path by booking line. */
    demandPricingApplicationsBizBookingLineAtIdx: index(
      "demand_pricing_applications_biz_booking_line_at_idx",
    ).on(table.bizId, table.bookingOrderLineId, table.appliedAt),

    /** Common timeline path by booking order. */
    demandPricingApplicationsBizBookingOrderAtIdx: index(
      "demand_pricing_applications_biz_booking_order_at_idx",
    ).on(table.bizId, table.bookingOrderId, table.appliedAt),

    /** Common timeline path by evaluation source. */
    demandPricingApplicationsBizEvaluationAtIdx: index(
      "demand_pricing_applications_biz_evaluation_at_idx",
    ).on(table.bizId, table.demandPricingEvaluationId, table.appliedAt),

    /** Tenant-safe FK to evaluation. */
    demandPricingApplicationsBizEvaluationFk: foreignKey({
      columns: [table.bizId, table.demandPricingEvaluationId],
      foreignColumns: [demandPricingEvaluations.bizId, demandPricingEvaluations.id],
      name: "demand_pricing_applications_biz_evaluation_fk",
    }),

    /** Tenant-safe FK to optional booking order. */
    demandPricingApplicationsBizBookingOrderFk: foreignKey({
      columns: [table.bizId, table.bookingOrderId],
      foreignColumns: [bookingOrders.bizId, bookingOrders.id],
      name: "demand_pricing_applications_biz_booking_order_fk",
    }),

    /** Tenant-safe FK to optional booking line. */
    demandPricingApplicationsBizBookingLineFk: foreignKey({
      columns: [table.bizId, table.bookingOrderLineId],
      foreignColumns: [bookingOrderLines.bizId, bookingOrderLines.id],
      name: "demand_pricing_applications_biz_booking_line_fk",
    }),

    /** Tenant-safe self-FK for explicit reversal chains. */
    demandPricingApplicationsBizReversalFk: foreignKey({
      columns: [table.bizId, table.reversalOfApplicationId],
      foreignColumns: [table.bizId, table.id],
      name: "demand_pricing_applications_biz_reversal_fk",
    }),

    /** Amount and final price bounds. */
    demandPricingApplicationsAmountCheck: check(
      "demand_pricing_applications_amount_check",
      sql`"applied_amount_minor" <> 0 AND "applied_final_unit_price_minor" >= 0`,
    ),

    /** Currency should always use uppercase ISO-like code shape. */
    demandPricingApplicationsCurrencyFormatCheck: check(
      "demand_pricing_applications_currency_format_check",
      sql`"currency" ~ '^[A-Z]{3}$'`,
    ),

    /** Reversal pointer cannot point to itself. */
    demandPricingApplicationsNoSelfReversalCheck: check(
      "demand_pricing_applications_no_self_reversal_check",
      sql`"reversal_of_application_id" IS NULL OR "reversal_of_application_id" <> "id"`,
    ),

    /** Require at least one commercial context for applied entries. */
    demandPricingApplicationsContextCheck: check(
      "demand_pricing_applications_context_check",
      sql`"booking_order_id" IS NOT NULL OR "booking_order_line_id" IS NOT NULL`,
    ),
  }),
);
