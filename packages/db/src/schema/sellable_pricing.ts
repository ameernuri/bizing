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
import { bizes } from "./bizes";
import { channelAccounts } from "./channels";
import {
  lifecycleStatusEnum,
  sellablePricingModeEnum,
  sellablePricingOverrideTypeEnum,
  sellablePricingScopeTypeEnum,
  sellablePricingThresholdTypeEnum,
} from "./enums";
import { locations } from "./locations";
import { sellables } from "./product_commerce";
import { subjects } from "./subjects";
import { users } from "./users";

/**
 * sellable_pricing_modes
 *
 * ELI5:
 * This is the base "how this sellable charges money" row.
 *
 * Examples:
 * - free event -> mode=free
 * - fixed haircut -> mode=fixed + base price
 * - tiered lesson package -> mode=tiered + threshold rows
 * - metered usage -> mode=metered + unit key
 *
 * Why this table exists:
 * - keeps pricing semantics normalized and auditable,
 * - allows one sellable to evolve pricing via versions/time windows,
 * - becomes a stable anchor for thresholds and scoped overrides.
 */
export const sellablePricingModes = pgTable(
  "sellable_pricing_modes",
  {
    /** Stable primary key for one pricing-mode revision row. */
    id: idWithTag("sellable_pricing_mode"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Target sellable whose base pricing this row configures. */
    sellableId: idRef("sellable_id")
      .references(() => sellables.id)
      .notNull(),

    /** Lifecycle status for this pricing mode revision. */
    status: lifecycleStatusEnum("status").default("active").notNull(),

    /** Core pricing strategy. */
    mode: sellablePricingModeEnum("mode").notNull(),

    /** Currency used by monetary fields in this row. */
    currency: varchar("currency", { length: 3 }).default("USD").notNull(),

    /**
     * Base amount in minor units.
     *
     * Required for fixed/flexible modes. Optional for tiered/metered/external.
     */
    basePriceMinor: integer("base_price_minor"),

    /**
     * Minimum order quantity this mode supports.
     *
     * Keep this generic; quantity meaning depends on sellable semantics.
     */
    minimumOrderQuantity: integer("minimum_order_quantity").default(1).notNull(),

    /** Optional maximum order quantity supported by this pricing mode. */
    maximumOrderQuantity: integer("maximum_order_quantity"),

    /**
     * Unit label for pricing math and UI explanation.
     *
     * Examples: `unit`, `minute`, `hour`, `day`, `seat`, `session`.
     */
    billingUnit: varchar("billing_unit", { length: 80 }).default("unit").notNull(),

    /** Number of billing units grouped into one price step. */
    billingUnitCount: integer("billing_unit_count").default(1).notNull(),

    /**
     * Meter key used when `mode=metered`.
     *
     * Example keys: `minutes_used`, `gb_downloaded`, `messages_sent`.
     */
    meteredUnitKey: varchar("metered_unit_key", { length: 140 }),

    /**
     * External quote integration key when `mode=external_quote`.
     *
     * This lets policy/API pick the correct external quote provider/workflow.
     */
    externalQuoteKey: varchar("external_quote_key", { length: 140 }),

    /** Effective window start. */
    effectiveFrom: timestamp("effective_from", { withTimezone: true })
      .defaultNow()
      .notNull(),

    /** Optional effective window end. */
    effectiveTo: timestamp("effective_to", { withTimezone: true }),

    /** Priority when multiple mode rows overlap in time. Higher wins. */
    priority: integer("priority").default(100).notNull(),

    /** Immutable policy snapshot consumed by pricing evaluators. */
    policySnapshot: jsonb("policy_snapshot").default({}).notNull(),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite key used by threshold/override child tables. */
    sellablePricingModesBizIdIdUnique: uniqueIndex(
      "sellable_pricing_modes_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** Main pricing-resolver query path by sellable/status/effective window. */
    sellablePricingModesBizSellableStatusEffectiveIdx: index(
      "sellable_pricing_modes_biz_sellable_status_effective_idx",
    ).on(table.bizId, table.sellableId, table.status, table.effectiveFrom),

    /** Tenant-safe FK to sellable. */
    sellablePricingModesBizSellableFk: foreignKey({
      columns: [table.bizId, table.sellableId],
      foreignColumns: [sellables.bizId, sellables.id],
      name: "sellable_pricing_modes_biz_sellable_fk",
    }),

    /** Numeric bounds + currency + time-window checks. */
    sellablePricingModesBoundsCheck: check(
      "sellable_pricing_modes_bounds_check",
      sql`
      "currency" ~ '^[A-Z]{3}$'
      AND ("base_price_minor" IS NULL OR "base_price_minor" >= 0)
      AND "minimum_order_quantity" > 0
      AND ("maximum_order_quantity" IS NULL OR "maximum_order_quantity" >= "minimum_order_quantity")
      AND "billing_unit_count" > 0
      AND "priority" >= 0
      AND ("effective_to" IS NULL OR "effective_to" > "effective_from")
      `,
    ),

    /** Mode-specific payload shape check for deterministic pricing behavior. */
    sellablePricingModesShapeCheck: check(
      "sellable_pricing_modes_shape_check",
      sql`
      (
        "mode" = 'free'
        AND "base_price_minor" IS NULL
        AND "metered_unit_key" IS NULL
        AND "external_quote_key" IS NULL
      ) OR (
        "mode" IN ('fixed', 'flexible')
        AND "base_price_minor" IS NOT NULL
        AND "metered_unit_key" IS NULL
        AND "external_quote_key" IS NULL
      ) OR (
        "mode" = 'tiered'
        AND "metered_unit_key" IS NULL
        AND "external_quote_key" IS NULL
      ) OR (
        "mode" = 'metered'
        AND "metered_unit_key" IS NOT NULL
        AND "external_quote_key" IS NULL
      ) OR (
        "mode" = 'external_quote'
        AND "external_quote_key" IS NOT NULL
        AND "metered_unit_key" IS NULL
      )
      `,
    ),
  }),
);

/**
 * sellable_pricing_thresholds
 *
 * ELI5:
 * Threshold rows are optional "if condition then guidance/price" rules
 * attached to a base pricing mode.
 *
 * Examples:
 * - if quantity >= 10 then suggested price changes,
 * - min/max allowed quantity guardrails,
 * - tier breakpoints for tiered pricing models.
 */
export const sellablePricingThresholds = pgTable(
  "sellable_pricing_thresholds",
  {
    /** Stable primary key for one threshold row. */
    id: idWithTag("sellable_pricing_threshold"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent pricing-mode row. */
    sellablePricingModeId: idRef("sellable_pricing_mode_id")
      .references(() => sellablePricingModes.id)
      .notNull(),

    /** Threshold semantic class. */
    thresholdType: sellablePricingThresholdTypeEnum("threshold_type").notNull(),

    /**
     * Metric key evaluated by pricing engine.
     *
     * Examples:
     * - `quantity`
     * - `duration_minutes`
     * - `lead_time_hours`
     */
    metricKey: varchar("metric_key", { length: 120 }).notNull(),

    /**
     * Comparator used for threshold evaluation.
     *
     * Keep as text+check so we can add operators without enum migrations.
     */
    comparisonOperator: varchar("comparison_operator", { length: 20 })
      .default("gte")
      .notNull(),

    /** Lower bound value. */
    minValue: integer("min_value"),

    /** Upper bound value. */
    maxValue: integer("max_value"),

    /** Optional suggested/target price in minor units for this threshold. */
    priceMinor: integer("price_minor"),

    /** Lifecycle status. */
    status: lifecycleStatusEnum("status").default("active").notNull(),

    /** Sort order for deterministic evaluator execution. */
    sortOrder: integer("sort_order").default(100).notNull(),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    sellablePricingThresholdsBizIdIdUnique: uniqueIndex("sellable_pricing_thresholds_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Threshold evaluator expansion path. */
    sellablePricingThresholdsBizModeSortIdx: index(
      "sellable_pricing_thresholds_biz_mode_sort_idx",
    ).on(table.bizId, table.sellablePricingModeId, table.sortOrder),

    /** Tenant-safe FK to parent pricing mode. */
    sellablePricingThresholdsBizModeFk: foreignKey({
      columns: [table.bizId, table.sellablePricingModeId],
      foreignColumns: [sellablePricingModes.bizId, sellablePricingModes.id],
      name: "sellable_pricing_thresholds_biz_mode_fk",
    }),

    /** Bounds and comparator checks. */
    sellablePricingThresholdsBoundsCheck: check(
      "sellable_pricing_thresholds_bounds_check",
      sql`
      "comparison_operator" IN ('gte', 'lte', 'eq', 'between')
      AND ("min_value" IS NULL OR "min_value" >= 0)
      AND ("max_value" IS NULL OR "max_value" >= 0)
      AND ("min_value" IS NULL OR "max_value" IS NULL OR "max_value" >= "min_value")
      AND ("price_minor" IS NULL OR "price_minor" >= 0)
      AND "sort_order" >= 0
      `,
    ),

    /** Comparator-specific shape constraints. */
    sellablePricingThresholdsShapeCheck: check(
      "sellable_pricing_thresholds_shape_check",
      sql`
      (
        "comparison_operator" = 'between'
        AND "min_value" IS NOT NULL
        AND "max_value" IS NOT NULL
      ) OR (
        "comparison_operator" IN ('gte', 'lte', 'eq')
        AND (
          ("min_value" IS NOT NULL AND "max_value" IS NULL)
          OR ("min_value" IS NULL AND "max_value" IS NOT NULL)
        )
      )
      `,
    ),
  }),
);

/**
 * sellable_pricing_overrides
 *
 * ELI5:
 * Overrides let businesses tweak base pricing by scope
 * (location/channel/custom subject) without cloning the whole sellable.
 *
 * Example:
 * - Downtown location adds +$10,
 * - one channel runs a 0.9x multiplier,
 * - one custom subject gets a fixed override amount.
 */
export const sellablePricingOverrides = pgTable(
  "sellable_pricing_overrides",
  {
    /** Stable primary key for one scoped override row. */
    id: idWithTag("sellable_pricing_override"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent pricing-mode row this override augments. */
    sellablePricingModeId: idRef("sellable_pricing_mode_id")
      .references(() => sellablePricingModes.id)
      .notNull(),

    /** Scope discriminator for this override row. */
    scopeType: sellablePricingScopeTypeEnum("scope_type").default("biz").notNull(),

    /** Location target when `scope_type=location`. */
    locationId: idRef("location_id").references(() => locations.id),

    /** Channel account target when `scope_type=channel`. */
    channelAccountId: idRef("channel_account_id").references(() => channelAccounts.id),

    /** Custom scope namespace when `scope_type=custom_subject`. */
    customSubjectType: varchar("custom_subject_type", { length: 80 }),

    /** Custom scope id when `scope_type=custom_subject`. */
    customSubjectId: varchar("custom_subject_id", { length: 140 }),

    /** Override arithmetic mode. */
    overrideType: sellablePricingOverrideTypeEnum("override_type").notNull(),

    /** Absolute replacement price in minor units. */
    absolutePriceMinor: integer("absolute_price_minor"),

    /** Signed delta in minor units (+/-). */
    deltaPriceMinor: integer("delta_price_minor"),

    /** Multiplier in basis points (10000 = 1.0x). */
    multiplierBps: integer("multiplier_bps"),

    /** Override effective start. */
    effectiveFrom: timestamp("effective_from", { withTimezone: true })
      .defaultNow()
      .notNull(),

    /** Optional override effective end. */
    effectiveTo: timestamp("effective_to", { withTimezone: true }),

    /** Priority used when multiple overrides match at once. Higher wins. */
    priority: integer("priority").default(100).notNull(),

    /** Optional machine-readable reason key. */
    reasonCode: varchar("reason_code", { length: 80 }),

    /** Optional human-readable reason text. */
    reasonText: varchar("reason_text", { length: 500 }),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    sellablePricingOverridesBizIdIdUnique: uniqueIndex("sellable_pricing_overrides_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Scoped override resolver path. */
    sellablePricingOverridesBizModeScopeEffectiveIdx: index(
      "sellable_pricing_overrides_biz_mode_scope_effective_idx",
    ).on(
      table.bizId,
      table.sellablePricingModeId,
      table.scopeType,
      table.priority,
      table.effectiveFrom,
    ),

    /** Tenant-safe FK to parent pricing mode row. */
    sellablePricingOverridesBizModeFk: foreignKey({
      columns: [table.bizId, table.sellablePricingModeId],
      foreignColumns: [sellablePricingModes.bizId, sellablePricingModes.id],
      name: "sellable_pricing_overrides_biz_mode_fk",
    }),

    /** Tenant-safe FK to optional location scope row. */
    sellablePricingOverridesBizLocationFk: foreignKey({
      columns: [table.bizId, table.locationId],
      foreignColumns: [locations.bizId, locations.id],
      name: "sellable_pricing_overrides_biz_location_fk",
    }),

    /** Tenant-safe FK to optional channel account scope row. */
    sellablePricingOverridesBizChannelFk: foreignKey({
      columns: [table.bizId, table.channelAccountId],
      foreignColumns: [channelAccounts.bizId, channelAccounts.id],
      name: "sellable_pricing_overrides_biz_channel_fk",
    }),

    /** Tenant-safe FK to optional custom subject scope row. */
    sellablePricingOverridesBizSubjectFk: foreignKey({
      columns: [table.bizId, table.customSubjectType, table.customSubjectId],
      foreignColumns: [subjects.bizId, subjects.subjectType, subjects.subjectId],
      name: "sellable_pricing_overrides_biz_subject_fk",
    }),

    /** Custom subject pair must be fully null or fully populated. */
    sellablePricingOverridesSubjectPairCheck: check(
      "sellable_pricing_overrides_subject_pair_check",
      sql`
      (
        "custom_subject_type" IS NULL
        AND "custom_subject_id" IS NULL
      ) OR (
        "custom_subject_type" IS NOT NULL
        AND "custom_subject_id" IS NOT NULL
      )
      `,
    ),

    /** Scope payload shape must match scope type exactly. */
    sellablePricingOverridesScopeShapeCheck: check(
      "sellable_pricing_overrides_scope_shape_check",
      sql`
      (
        "scope_type" = 'biz'
        AND "location_id" IS NULL
        AND "channel_account_id" IS NULL
        AND "custom_subject_type" IS NULL
        AND "custom_subject_id" IS NULL
      ) OR (
        "scope_type" = 'location'
        AND "location_id" IS NOT NULL
        AND "channel_account_id" IS NULL
        AND "custom_subject_type" IS NULL
        AND "custom_subject_id" IS NULL
      ) OR (
        "scope_type" = 'channel'
        AND "location_id" IS NULL
        AND "channel_account_id" IS NOT NULL
        AND "custom_subject_type" IS NULL
        AND "custom_subject_id" IS NULL
      ) OR (
        "scope_type" = 'custom_subject'
        AND "location_id" IS NULL
        AND "channel_account_id" IS NULL
        AND "custom_subject_type" IS NOT NULL
        AND "custom_subject_id" IS NOT NULL
      )
      `,
    ),

    /** Override value payload shape must match override_type exactly. */
    sellablePricingOverridesValueShapeCheck: check(
      "sellable_pricing_overrides_value_shape_check",
      sql`
      (
        "override_type" = 'absolute'
        AND "absolute_price_minor" IS NOT NULL
        AND "delta_price_minor" IS NULL
        AND "multiplier_bps" IS NULL
      ) OR (
        "override_type" = 'delta'
        AND "absolute_price_minor" IS NULL
        AND "delta_price_minor" IS NOT NULL
        AND "multiplier_bps" IS NULL
      ) OR (
        "override_type" = 'multiplier'
        AND "absolute_price_minor" IS NULL
        AND "delta_price_minor" IS NULL
        AND "multiplier_bps" IS NOT NULL
      )
      `,
    ),

    /** Numeric and time-window bounds checks. */
    sellablePricingOverridesBoundsCheck: check(
      "sellable_pricing_overrides_bounds_check",
      sql`
      ("absolute_price_minor" IS NULL OR "absolute_price_minor" >= 0)
      AND ("multiplier_bps" IS NULL OR "multiplier_bps" > 0)
      AND "priority" >= 0
      AND ("effective_to" IS NULL OR "effective_to" > "effective_from")
      `,
    ),
  }),
);

export type SellablePricingMode = typeof sellablePricingModes.$inferSelect;
export type NewSellablePricingMode = typeof sellablePricingModes.$inferInsert;
export type SellablePricingThreshold = typeof sellablePricingThresholds.$inferSelect;
export type NewSellablePricingThreshold = typeof sellablePricingThresholds.$inferInsert;
export type SellablePricingOverride = typeof sellablePricingOverrides.$inferSelect;
export type NewSellablePricingOverride = typeof sellablePricingOverrides.$inferInsert;
