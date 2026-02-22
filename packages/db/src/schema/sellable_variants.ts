import { sql } from "drizzle-orm";
import { check, foreignKey, index, uniqueIndex } from "drizzle-orm/pg-core";
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  varchar,
} from "drizzle-orm/pg-core";
import { idRef, idWithTag, withAuditRefs } from "./_common";
import { bizes } from "./bizes";
import {
  lifecycleStatusEnum,
  sellableVariantDimensionTypeEnum,
  sellableVariantPriceModeEnum,
  sellableVariantStatusEnum,
} from "./enums";
import { sellables } from "./product_commerce";
import { users } from "./users";

/**
 * sellable_variant_dimensions
 *
 * ELI5:
 * A base sellable can expose named dimensions like:
 * - duration: 30m / 60m / 90m
 * - seat type: standard / vip
 * - language: english / spanish
 *
 * This table stores the dimension definitions.
 */
export const sellableVariantDimensions = pgTable(
  "sellable_variant_dimensions",
  {
    /** Stable primary key for one dimension definition. */
    id: idWithTag("sellable_variant_dimension"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Base sellable this dimension belongs to. */
    baseSellableId: idRef("base_sellable_id")
      .references(() => sellables.id)
      .notNull(),

    /** Stable machine key for this dimension in one base sellable. */
    dimensionKey: varchar("dimension_key", { length: 120 }).notNull(),

    /** Human-readable dimension name. */
    name: varchar("name", { length: 180 }).notNull(),

    /** Optional description for admins/operators. */
    description: varchar("description", { length: 2000 }),

    /** Data type hint for validation/UI handling. */
    dimensionType: sellableVariantDimensionTypeEnum("dimension_type")
      .default("choice")
      .notNull(),

    /** Whether this dimension must be selected for valid variants. */
    isRequired: boolean("is_required").default(true).notNull(),

    /** Sort order for deterministic UI and import/export behavior. */
    sortOrder: integer("sort_order").default(100).notNull(),

    /** Lifecycle status of this dimension. */
    status: lifecycleStatusEnum("status").default("active").notNull(),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite key for tenant-safe child references. */
    sellableVariantDimensionsBizIdIdUnique: uniqueIndex(
      "sellable_variant_dimensions_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** Composite key used by selection-table consistency FKs. */
    sellableVariantDimensionsBizIdIdBaseUnique: uniqueIndex(
      "sellable_variant_dimensions_biz_id_id_base_unique",
    ).on(table.bizId, table.id, table.baseSellableId),

    /** One dimension key per base sellable. */
    sellableVariantDimensionsBaseKeyUnique: uniqueIndex(
      "sellable_variant_dimensions_base_key_unique",
    ).on(table.baseSellableId, table.dimensionKey),

    /** Common base-sellable graph expansion path. */
    sellableVariantDimensionsBizBaseSortIdx: index(
      "sellable_variant_dimensions_biz_base_sort_idx",
    ).on(table.bizId, table.baseSellableId, table.sortOrder),

    /** Tenant-safe FK to base sellable. */
    sellableVariantDimensionsBizBaseSellableFk: foreignKey({
      columns: [table.bizId, table.baseSellableId],
      foreignColumns: [sellables.bizId, sellables.id],
      name: "sellable_variant_dimensions_biz_base_sellable_fk",
    }),

    /** Bounds and key-shape checks. */
    sellableVariantDimensionsBoundsCheck: check(
      "sellable_variant_dimensions_bounds_check",
      sql`
      "sort_order" >= 0
      AND length("dimension_key") > 0
      `,
    ),
  }),
);

/**
 * sellable_variant_dimension_values
 *
 * ELI5:
 * Values available inside one dimension (for example: `30m`, `60m`, `90m`).
 */
export const sellableVariantDimensionValues = pgTable(
  "sellable_variant_dimension_values",
  {
    /** Stable primary key for one dimension value. */
    id: idWithTag("sellable_variant_value"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent dimension this value belongs to. */
    sellableVariantDimensionId: idRef("sellable_variant_dimension_id")
      .references(() => sellableVariantDimensions.id)
      .notNull(),

    /** Stable value key in one dimension. */
    valueKey: varchar("value_key", { length: 120 }).notNull(),

    /** Human-readable value label. */
    valueLabel: varchar("value_label", { length: 180 }).notNull(),

    /** Sort order for deterministic display and import behavior. */
    sortOrder: integer("sort_order").default(100).notNull(),

    /** Optional default flag for config UIs/builders. */
    isDefault: boolean("is_default").default(false).notNull(),

    /** Lifecycle status of this value. */
    status: lifecycleStatusEnum("status").default("active").notNull(),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite key for tenant-safe selection references. */
    sellableVariantDimensionValuesBizIdIdUnique: uniqueIndex(
      "sellable_variant_dimension_values_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** Composite key used by selection-table consistency FKs. */
    sellableVariantDimensionValuesBizIdIdDimensionUnique: uniqueIndex(
      "sellable_variant_dimension_values_biz_id_id_dimension_unique",
    ).on(table.bizId, table.id, table.sellableVariantDimensionId),

    /** One value key per dimension. */
    sellableVariantDimensionValuesDimensionKeyUnique: uniqueIndex(
      "sellable_variant_dimension_values_dimension_key_unique",
    ).on(table.sellableVariantDimensionId, table.valueKey),

    /** Common parent-dimension expansion path. */
    sellableVariantDimensionValuesBizDimensionSortIdx: index(
      "sellable_variant_dimension_values_biz_dimension_sort_idx",
    ).on(table.bizId, table.sellableVariantDimensionId, table.sortOrder),

    /** Tenant-safe FK to parent dimension. */
    sellableVariantDimensionValuesBizDimensionFk: foreignKey({
      columns: [table.bizId, table.sellableVariantDimensionId],
      foreignColumns: [sellableVariantDimensions.bizId, sellableVariantDimensions.id],
      name: "sellable_variant_dimension_values_biz_dimension_fk",
    }),

    /** Bounds and key-shape checks. */
    sellableVariantDimensionValuesBoundsCheck: check(
      "sellable_variant_dimension_values_bounds_check",
      sql`
      "sort_order" >= 0
      AND length("value_key") > 0
      `,
    ),
  }),
);

/**
 * sellable_variants
 *
 * ELI5:
 * One row = one concrete purchasable variant mapped to a canonical sellable id.
 *
 * Why this exists:
 * - variants need independent lifecycle/pricing behavior,
 * - but should still roll up to one base sellable family for analytics and
 *   catalog management.
 */
export const sellableVariants = pgTable(
  "sellable_variants",
  {
    /** Stable primary key for one variant mapping row. */
    id: idWithTag("sellable_variant"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Base sellable family this variant belongs to. */
    baseSellableId: idRef("base_sellable_id")
      .references(() => sellables.id)
      .notNull(),

    /** Concrete sellable identity for this variant. */
    variantSellableId: idRef("variant_sellable_id")
      .references(() => sellables.id)
      .notNull(),

    /** Variant lifecycle status. */
    status: sellableVariantStatusEnum("status").default("active").notNull(),

    /** How variant price is derived relative to base sellable pricing. */
    pricingMode: sellableVariantPriceModeEnum("pricing_mode")
      .default("inherited")
      .notNull(),

    /** Absolute override price in minor units when pricing_mode=override. */
    priceOverrideMinor: integer("price_override_minor"),

    /** Signed price delta in minor units when pricing_mode=delta. */
    priceDeltaMinor: integer("price_delta_minor"),

    /** Optional SKU suffix for catalog/inventory integrations. */
    skuSuffix: varchar("sku_suffix", { length: 120 }),

    /** Optional display label override for variant-specific storefront text. */
    displayLabel: varchar("display_label", { length: 220 }),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    sellableVariantsBizIdIdUnique: uniqueIndex("sellable_variants_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Composite key for tenant-safe selection references. */

    /** Composite key used by selection-table consistency FKs. */
    sellableVariantsBizIdIdBaseUnique: uniqueIndex(
      "sellable_variants_biz_id_id_base_unique",
    ).on(table.bizId, table.id, table.baseSellableId),

    /** One variant mapping per concrete sellable. */
    sellableVariantsVariantSellableUnique: uniqueIndex(
      "sellable_variants_variant_sellable_unique",
    ).on(table.variantSellableId),

    /** One base+variant pair per tenant. */
    sellableVariantsBizBaseVariantUnique: uniqueIndex(
      "sellable_variants_biz_base_variant_unique",
    ).on(table.bizId, table.baseSellableId, table.variantSellableId),

    /** Base-family browse path. */
    sellableVariantsBizBaseStatusIdx: index("sellable_variants_biz_base_status_idx").on(
      table.bizId,
      table.baseSellableId,
      table.status,
    ),

    /** Tenant-safe FK to base sellable family. */
    sellableVariantsBizBaseSellableFk: foreignKey({
      columns: [table.bizId, table.baseSellableId],
      foreignColumns: [sellables.bizId, sellables.id],
      name: "sellable_variants_biz_base_sellable_fk",
    }),

    /** Tenant-safe FK to concrete variant sellable. */
    sellableVariantsBizVariantSellableFk: foreignKey({
      columns: [table.bizId, table.variantSellableId],
      foreignColumns: [sellables.bizId, sellables.id],
      name: "sellable_variants_biz_variant_sellable_fk",
    }),

    /** Prevent self-loop base->variant mapping and enforce pricing shape. */
    sellableVariantsShapeCheck: check(
      "sellable_variants_shape_check",
      sql`
      "base_sellable_id" <> "variant_sellable_id"
      AND (
        (
          "pricing_mode" = 'inherited'
          AND "price_override_minor" IS NULL
          AND "price_delta_minor" IS NULL
        ) OR (
          "pricing_mode" = 'override'
          AND "price_override_minor" IS NOT NULL
          AND "price_delta_minor" IS NULL
        ) OR (
          "pricing_mode" = 'delta'
          AND "price_override_minor" IS NULL
          AND "price_delta_minor" IS NOT NULL
        )
      )
      `,
    ),

    /** Price bounds for override/delta fields. */
    sellableVariantsPriceBoundsCheck: check(
      "sellable_variants_price_bounds_check",
      sql`
      ("price_override_minor" IS NULL OR "price_override_minor" >= 0)
      `,
    ),
  }),
);

/**
 * sellable_variant_selections
 *
 * ELI5:
 * Join table that says which value is selected for each dimension on each
 * concrete variant row.
 *
 * Example:
 * - variant A selects duration=60m and seat_type=vip.
 */
export const sellableVariantSelections = pgTable(
  "sellable_variant_selections",
  {
    /** Stable primary key for one variant-dimension-value selection row. */
    id: idWithTag("sellable_variant_selection"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent variant row. */
    sellableVariantId: idRef("sellable_variant_id")
      .references(() => sellableVariants.id)
      .notNull(),

    /** Base sellable duplicated for FK consistency checks. */
    baseSellableId: idRef("base_sellable_id")
      .references(() => sellables.id)
      .notNull(),

    /** Dimension selected by this row. */
    sellableVariantDimensionId: idRef("sellable_variant_dimension_id")
      .references(() => sellableVariantDimensions.id)
      .notNull(),

    /** Dimension value selected by this row. */
    sellableVariantDimensionValueId: idRef("sellable_variant_dimension_value_id")
      .references(() => sellableVariantDimensionValues.id)
      .notNull(),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    sellableVariantSelectionsBizIdIdUnique: uniqueIndex("sellable_variant_selections_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** One selection per variant+dimension. */
    sellableVariantSelectionsVariantDimensionUnique: uniqueIndex(
      "sellable_variant_selections_variant_dimension_unique",
    ).on(table.sellableVariantId, table.sellableVariantDimensionId),

    /** Prevent duplicate exact value rows in one variant. */
    sellableVariantSelectionsVariantValueUnique: uniqueIndex(
      "sellable_variant_selections_variant_value_unique",
    ).on(table.sellableVariantId, table.sellableVariantDimensionValueId),

    /** Variant expansion path. */
    sellableVariantSelectionsBizVariantIdx: index(
      "sellable_variant_selections_biz_variant_idx",
    ).on(table.bizId, table.sellableVariantId),

    /** Dimension reverse lookup path. */
    sellableVariantSelectionsBizDimensionIdx: index(
      "sellable_variant_selections_biz_dimension_idx",
    ).on(table.bizId, table.sellableVariantDimensionId, table.sellableVariantDimensionValueId),

    /** Tenant-safe FK to base sellable family. */
    sellableVariantSelectionsBizBaseSellableFk: foreignKey({
      columns: [table.bizId, table.baseSellableId],
      foreignColumns: [sellables.bizId, sellables.id],
      name: "sellable_variant_selections_biz_base_sellable_fk",
    }),

    /**
     * Tenant-safe FK to variant row with base-sellable anchoring.
     *
     * This prevents selecting dimensions from a different base family.
     */
    sellableVariantSelectionsBizVariantFk: foreignKey({
      columns: [table.bizId, table.sellableVariantId, table.baseSellableId],
      foreignColumns: [
        sellableVariants.bizId,
        sellableVariants.id,
        sellableVariants.baseSellableId,
      ],
      name: "sellable_variant_selections_biz_variant_fk",
    }),

    /**
     * Tenant-safe FK to dimension row with base-sellable anchoring.
     *
     * This enforces that selected dimension belongs to the same base family.
     */
    sellableVariantSelectionsBizDimensionFk: foreignKey({
      columns: [table.bizId, table.sellableVariantDimensionId, table.baseSellableId],
      foreignColumns: [
        sellableVariantDimensions.bizId,
        sellableVariantDimensions.id,
        sellableVariantDimensions.baseSellableId,
      ],
      name: "sellable_variant_selections_biz_dimension_fk",
    }),

    /**
     * Tenant-safe FK to value row anchored by dimension id.
     *
     * This prevents selecting value rows from unrelated dimensions.
     */
    sellableVariantSelectionsBizValueFk: foreignKey({
      columns: [
        table.bizId,
        table.sellableVariantDimensionValueId,
        table.sellableVariantDimensionId,
      ],
      foreignColumns: [
        sellableVariantDimensionValues.bizId,
        sellableVariantDimensionValues.id,
        sellableVariantDimensionValues.sellableVariantDimensionId,
      ],
      name: "sellable_variant_selections_biz_value_fk",
    }),
  }),
);

export type SellableVariantDimension = typeof sellableVariantDimensions.$inferSelect;
export type NewSellableVariantDimension = typeof sellableVariantDimensions.$inferInsert;
export type SellableVariantDimensionValue =
  typeof sellableVariantDimensionValues.$inferSelect;
export type NewSellableVariantDimensionValue =
  typeof sellableVariantDimensionValues.$inferInsert;
export type SellableVariant = typeof sellableVariants.$inferSelect;
export type NewSellableVariant = typeof sellableVariants.$inferInsert;
export type SellableVariantSelection = typeof sellableVariantSelections.$inferSelect;
export type NewSellableVariantSelection = typeof sellableVariantSelections.$inferInsert;
