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
  bookingOrderLines,
  bookingOrders,
  fulfillmentUnits,
} from "./fulfillment";
import { locations } from "./locations";
import { offerVersions, offers } from "./offers";
import { products } from "./products";
import { resources } from "./resources";
import { serviceProducts } from "./service_products";
import { users } from "./users";
import {
  bundleComponentPriceModeEnum,
  bundleComponentTargetTypeEnum,
  bundlePricingModeEnum,
  inventoryLocationKindEnum,
  inventoryMovementTypeEnum,
  inventoryReservationStatusEnum,
  lifecycleStatusEnum,
  physicalFulfillmentItemStatusEnum,
  physicalFulfillmentMethodEnum,
  physicalFulfillmentStatusEnum,
  requirementModeEnum,
  resourceRateUnitEnum,
  sellableKindEnum,
} from "./enums";

/**
 * sellables
 *
 * ELI5:
 * This is the single "thing we can sell" identity table.
 *
 * Why this table exists:
 * - Without this, products/services/offers can feel like separate worlds.
 * - With this, every commercial line can point to one canonical sellable id.
 * - Reporting becomes unified ("top sellers", "revenue by sellable", etc.)
 *
 * How it connects:
 * - Typed mapping tables connect one sellable row to its source primitive:
 *   product, service product, offer version, or resource-rate definition.
 * - `booking_order_line_sellables.sellable_id` is the main attribution bridge.
 */
export const sellables = pgTable(
  "sellables",
  {
    /** Stable primary key for canonical sellable identity. */
    id: idWithTag("sellable"),

    /** Tenant boundary for strict isolation. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Sellable source kind. */
    kind: sellableKindEnum("kind").notNull(),

    /** Human-facing label shown in reporting and admin UIs. */
    displayName: varchar("display_name", { length: 255 }).notNull(),

    /** Stable key for imports/routing/reference. */
    slug: varchar("slug", { length: 140 }).notNull(),

    /** Canonical lifecycle for this sellable identity. */
    status: lifecycleStatusEnum("status").default("active").notNull(),

    /** Commercial default currency for this sellable family. */
    currency: varchar("currency", { length: 3 }).default("USD").notNull(),

    /** Optional policy envelope for global sellable behavior. */
    policy: jsonb("policy").default({}),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    sellablesBizIdIdUnique: uniqueIndex("sellables_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Composite unique key for tenant-safe references. */
    /**
     * Composite identity including kind.
     *
     * Typed bridge tables use this FK target so the DB can enforce that each
     * bridge row points to the correct sellable kind.
     */
    sellablesBizIdIdKindUnique: uniqueIndex("sellables_biz_id_id_kind_unique").on(
      table.bizId,
      table.id,
      table.kind,
    ),

    /** One stable slug per tenant. */
    sellablesBizSlugUnique: uniqueIndex("sellables_biz_slug_unique").on(
      table.bizId,
      table.slug,
    ),

    /** Common reporting and browse path. */
    sellablesBizKindStatusIdx: index("sellables_biz_kind_status_idx").on(
      table.bizId,
      table.kind,
      table.status,
    ),

    /** Currency should always use uppercase ISO-like code shape. */
    sellablesCurrencyFormatCheck: check(
      "sellables_currency_format_check",
      sql`"currency" ~ '^[A-Z]{3}$'`,
    ),
  }),
);

/**
 * sellable_products
 *
 * Canonical one-to-one bridge from `sellables` to `products`.
 */
export const sellableProducts = pgTable(
  "sellable_products",
  {
    id: idWithTag("sellable_product"),
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),
    sellableId: idRef("sellable_id")
      .references(() => sellables.id)
      .notNull(),
    /**
     * Fixed kind discriminator for this typed bridge.
     *
     * This lets the FK below enforce that this bridge can only target
     * `sellables(kind='product')`.
     */
    sellableKind: sellableKindEnum("sellable_kind")
      .default("product")
      .notNull(),
    productId: idRef("product_id")
      .references(() => products.id)
      .notNull(),
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    sellableProductsBizIdIdUnique: uniqueIndex("sellable_products_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    sellableProductsSellableUnique: uniqueIndex(
      "sellable_products_sellable_unique",
    ).on(table.sellableId),
    sellableProductsProductUnique: uniqueIndex(
      "sellable_products_product_unique",
    ).on(table.productId),
    sellableProductsBizSellableFk: foreignKey({
      columns: [table.bizId, table.sellableId, table.sellableKind],
      foreignColumns: [sellables.bizId, sellables.id, sellables.kind],
      name: "sellable_products_biz_sellable_fk",
    }),
    sellableProductsBizProductFk: foreignKey({
      columns: [table.bizId, table.productId],
      foreignColumns: [products.bizId, products.id],
      name: "sellable_products_biz_product_fk",
    }),
    /** `sellable_kind` is immutable for this typed bridge table. */
    sellableProductsKindCheck: check(
      "sellable_products_kind_check",
      sql`"sellable_kind" = 'product'`,
    ),
  }),
);

/**
 * sellable_service_products
 *
 * Canonical one-to-one bridge from `sellables` to `service_products`.
 */
export const sellableServiceProducts = pgTable(
  "sellable_service_products",
  {
    id: idWithTag("sellable_service_product"),
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),
    sellableId: idRef("sellable_id")
      .references(() => sellables.id)
      .notNull(),
    /**
     * Fixed kind discriminator for this typed bridge.
     *
     * Enforces linkage only to `sellables(kind='service_product')`.
     */
    sellableKind: sellableKindEnum("sellable_kind")
      .default("service_product")
      .notNull(),
    serviceProductId: idRef("service_product_id")
      .references(() => serviceProducts.id)
      .notNull(),
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    sellableServiceProductsBizIdIdUnique: uniqueIndex("sellable_service_products_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    sellableServiceProductsSellableUnique: uniqueIndex(
      "sellable_service_products_sellable_unique",
    ).on(table.sellableId),
    sellableServiceProductsServiceProductUnique: uniqueIndex(
      "sellable_service_products_service_product_unique",
    ).on(table.serviceProductId),
    sellableServiceProductsBizSellableFk: foreignKey({
      columns: [table.bizId, table.sellableId, table.sellableKind],
      foreignColumns: [sellables.bizId, sellables.id, sellables.kind],
      name: "sellable_service_products_biz_sellable_fk",
    }),
    sellableServiceProductsBizServiceProductFk: foreignKey({
      columns: [table.bizId, table.serviceProductId],
      foreignColumns: [serviceProducts.bizId, serviceProducts.id],
      name: "sellable_service_products_biz_service_product_fk",
    }),
    /** `sellable_kind` is immutable for this typed bridge table. */
    sellableServiceProductsKindCheck: check(
      "sellable_service_products_kind_check",
      sql`"sellable_kind" = 'service_product'`,
    ),
  }),
);

/**
 * sellable_offer_versions
 *
 * Canonical one-to-one bridge from `sellables` to `offer_versions`.
 */
export const sellableOfferVersions = pgTable(
  "sellable_offer_versions",
  {
    id: idWithTag("sellable_offer_version"),
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),
    sellableId: idRef("sellable_id")
      .references(() => sellables.id)
      .notNull(),
    /**
     * Fixed kind discriminator for this typed bridge.
     *
     * Enforces linkage only to `sellables(kind='offer_version')`.
     */
    sellableKind: sellableKindEnum("sellable_kind")
      .default("offer_version")
      .notNull(),
    offerVersionId: idRef("offer_version_id")
      .references(() => offerVersions.id)
      .notNull(),
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    sellableOfferVersionsBizIdIdUnique: uniqueIndex("sellable_offer_versions_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    sellableOfferVersionsSellableUnique: uniqueIndex(
      "sellable_offer_versions_sellable_unique",
    ).on(table.sellableId),
    sellableOfferVersionsOfferVersionUnique: uniqueIndex(
      "sellable_offer_versions_offer_version_unique",
    ).on(table.offerVersionId),
    sellableOfferVersionsBizSellableFk: foreignKey({
      columns: [table.bizId, table.sellableId, table.sellableKind],
      foreignColumns: [sellables.bizId, sellables.id, sellables.kind],
      name: "sellable_offer_versions_biz_sellable_fk",
    }),
    sellableOfferVersionsBizOfferVersionFk: foreignKey({
      columns: [table.bizId, table.offerVersionId],
      foreignColumns: [offerVersions.bizId, offerVersions.id],
      name: "sellable_offer_versions_biz_offer_version_fk",
    }),
    /** `sellable_kind` is immutable for this typed bridge table. */
    sellableOfferVersionsKindCheck: check(
      "sellable_offer_versions_kind_check",
      sql`"sellable_kind" = 'offer_version'`,
    ),
  }),
);

/**
 * sellable_resource_rates
 *
 * ELI5:
 * This table lets a raw resource (host/asset/venue/company host) be sold
 * directly as a first-class commercial sellable, with explicit rate semantics.
 *
 * Examples:
 * - host consultation: $120 per hour
 * - venue rental: $900 per day
 * - dispatch callout: $75 flat per session
 */
export const sellableResourceRates = pgTable(
  "sellable_resource_rates",
  {
    id: idWithTag("sellable_resource_rate"),
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),
    sellableId: idRef("sellable_id")
      .references(() => sellables.id)
      .notNull(),
    /**
     * Fixed kind discriminator for this typed bridge.
     *
     * Enforces linkage only to `sellables(kind='resource_rate')`.
     */
    sellableKind: sellableKindEnum("sellable_kind")
      .default("resource_rate")
      .notNull(),
    resourceId: idRef("resource_id")
      .references(() => resources.id)
      .notNull(),
    rateUnit: resourceRateUnitEnum("rate_unit").notNull(),
    basePriceMinor: integer("base_price_minor").default(0).notNull(),
    currency: varchar("currency", { length: 3 }).default("USD").notNull(),
    minimumChargeMinor: integer("minimum_charge_minor"),
    minimumDurationMin: integer("minimum_duration_min"),
    billingIncrementMin: integer("billing_increment_min"),
    policy: jsonb("policy").default({}),
    metadata: jsonb("metadata").default({}),
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    sellableResourceRatesBizIdIdUnique: uniqueIndex("sellable_resource_rates_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    sellableResourceRatesSellableUnique: uniqueIndex(
      "sellable_resource_rates_sellable_unique",
    ).on(table.sellableId),
    sellableResourceRatesBizResourceIdx: index(
      "sellable_resource_rates_biz_resource_idx",
    ).on(table.bizId, table.resourceId, table.rateUnit),
    sellableResourceRatesBizSellableFk: foreignKey({
      columns: [table.bizId, table.sellableId, table.sellableKind],
      foreignColumns: [sellables.bizId, sellables.id, sellables.kind],
      name: "sellable_resource_rates_biz_sellable_fk",
    }),
    sellableResourceRatesBizResourceFk: foreignKey({
      columns: [table.bizId, table.resourceId],
      foreignColumns: [resources.bizId, resources.id],
      name: "sellable_resource_rates_biz_resource_fk",
    }),
    sellableResourceRatesBoundsCheck: check(
      "sellable_resource_rates_bounds_check",
      sql`
      "base_price_minor" >= 0
      AND ("minimum_charge_minor" IS NULL OR "minimum_charge_minor" >= 0)
      AND ("minimum_duration_min" IS NULL OR "minimum_duration_min" > 0)
      AND ("billing_increment_min" IS NULL OR "billing_increment_min" > 0)
      `,
    ),
    /** Currency should always use uppercase ISO-like code shape. */
    sellableResourceRatesCurrencyFormatCheck: check(
      "sellable_resource_rates_currency_format_check",
      sql`"currency" ~ '^[A-Z]{3}$'`,
    ),
    /** `sellable_kind` is immutable for this typed bridge table. */
    sellableResourceRatesKindCheck: check(
      "sellable_resource_rates_kind_check",
      sql`"sellable_kind" = 'resource_rate'`,
    ),
  }),
);

/**
 * product_bundles
 *
 * ELI5:
 * A bundle is a "box" product that contains many components.
 * Components can be:
 * - normal catalog products (physical or digital),
 * - service products (time-based),
 * - offers (direct commercial shell).
 *
 * Why this table exists:
 * - The `products` table defines one sellable item.
 * - This table marks which products are composite bundles and stores bundle-
 *   specific behavior that should not exist on non-bundle products.
 */
export const productBundles = pgTable(
  "product_bundles",
  {
    /** Stable primary key for bundle configuration row. */
    id: idWithTag("product_bundle"),

    /** Tenant boundary for strict multi-biz isolation. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Product row acting as the bundle shell sold in catalog/checkout. */
    bundleProductId: idRef("bundle_product_id")
      .references(() => products.id)
      .notNull(),

    /**
     * Pricing strategy for the bundle.
     * This controls how bundle-level quote workers combine component prices.
     */
    pricingMode: bundlePricingModeEnum("pricing_mode")
      .default("fixed_bundle_price")
      .notNull(),

    /**
     * If true, customers may omit optional components.
     * If false, configured defaults/required components should always apply.
     */
    allowPartialSelection: boolean("allow_partial_selection")
      .default(false)
      .notNull(),

    /** Optional minimum total component selections. */
    minComponentSelections: integer("min_component_selections")
      .default(0)
      .notNull(),

    /** Optional maximum total component selections. */
    maxComponentSelections: integer("max_component_selections"),

    /** Bundle lifecycle independent from product shell lifecycle. */
    status: lifecycleStatusEnum("status").default("draft").notNull(),

    /** Bundle-level policy knobs (selection, substitutions, etc.). */
    policy: jsonb("policy").default({}),

    /** Extension payload for future bundle capabilities. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    productBundlesBizIdIdUnique: uniqueIndex("product_bundles_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Composite unique key for tenant-safe child FKs. */

    /** One bundle configuration per product shell. */
    productBundlesBundleProductUnique: uniqueIndex(
      "product_bundles_bundle_product_unique",
    ).on(table.bundleProductId),

    /** Common admin listing path by status. */
    productBundlesBizStatusIdx: index("product_bundles_biz_status_idx").on(
      table.bizId,
      table.status,
    ),

    /** Tenant-safe FK to bundle shell product. */
    productBundlesBizBundleProductFk: foreignKey({
      columns: [table.bizId, table.bundleProductId],
      foreignColumns: [products.bizId, products.id],
      name: "product_bundles_biz_bundle_product_fk",
    }),

    /** Selection bounds sanity checks. */
    productBundlesSelectionBoundsCheck: check(
      "product_bundles_selection_bounds_check",
      sql`
      "min_component_selections" >= 0
      AND ("max_component_selections" IS NULL OR "max_component_selections" >= "min_component_selections")
      `,
    ),
  }),
);

/**
 * product_bundle_components
 *
 * ELI5:
 * One row = one component rule inside one bundle.
 *
 * Example:
 * - required: 1 driving lesson service product
 * - optional: up to 2 helmets (physical products)
 * - optional: 1 insurance offer add-on
 *
 * Why strict shape checks:
 * - One row should point to exactly one component target type.
 * - This avoids ambiguous composition rows and keeps evaluation deterministic.
 */
export const productBundleComponents = pgTable(
  "product_bundle_components",
  {
    /** Stable primary key. */
    id: idWithTag("bundle_component"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent bundle config. */
    productBundleId: idRef("product_bundle_id")
      .references(() => productBundles.id)
      .notNull(),

    /** Required vs optional component behavior. */
    requirementMode: requirementModeEnum("requirement_mode")
      .default("required")
      .notNull(),

    /** Target shape for this component row. */
    targetType: bundleComponentTargetTypeEnum("target_type").notNull(),

    /** Product target payload when `target_type=product`. */
    productId: idRef("product_id").references(() => products.id),

    /** Service-product target payload when `target_type=service_product`. */
    serviceProductId: idRef("service_product_id").references(
      () => serviceProducts.id,
    ),

    /** Offer target payload when `target_type=offer`. */
    offerId: idRef("offer_id").references(() => offers.id),

    /** Minimum quantity of this component allowed/required. */
    minQuantity: integer("min_quantity").default(1).notNull(),

    /** Maximum quantity allowed for this component. */
    maxQuantity: integer("max_quantity"),

    /** Default preselected quantity for quick-book flows. */
    defaultQuantity: integer("default_quantity").default(1).notNull(),

    /**
     * Component-specific pricing behavior inside the bundle.
     * Allows included, override, surcharge, or multiplier behavior.
     */
    priceMode: bundleComponentPriceModeEnum("price_mode")
      .default("included")
      .notNull(),

    /** Fixed override amount in minor units when `price_mode=fixed_override`. */
    priceOverrideMinor: integer("price_override_minor"),

    /** Surcharge amount in minor units when `price_mode=surcharge`. */
    surchargeMinor: integer("surcharge_minor"),

    /**
     * Multiplier in basis points when `price_mode=multiplier`.
     * Example: 12500 means 1.25x.
     */
    priceMultiplierBps: integer("price_multiplier_bps"),

    /** Deterministic ordering in UI and pricing evaluators. */
    sortOrder: integer("sort_order").default(100).notNull(),

    /** Optional explanation for operators/admins. */
    description: text("description"),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    productBundleComponentsBizIdIdUnique: uniqueIndex("product_bundle_components_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Common component listing path. */
    productBundleComponentsBizBundleSortIdx: index(
      "product_bundle_components_biz_bundle_sort_idx",
    ).on(table.bizId, table.productBundleId, table.sortOrder),

    /** Avoid duplicate target rows in one bundle. */
    productBundleComponentsProductUnique: uniqueIndex(
      "product_bundle_components_product_unique",
    )
      .on(table.productBundleId, table.productId)
      .where(sql`"product_id" IS NOT NULL`),

    /** Avoid duplicate service-product targets in one bundle. */
    productBundleComponentsServiceProductUnique: uniqueIndex(
      "product_bundle_components_service_product_unique",
    )
      .on(table.productBundleId, table.serviceProductId)
      .where(sql`"service_product_id" IS NOT NULL`),

    /** Avoid duplicate offer targets in one bundle. */
    productBundleComponentsOfferUnique: uniqueIndex(
      "product_bundle_components_offer_unique",
    )
      .on(table.productBundleId, table.offerId)
      .where(sql`"offer_id" IS NOT NULL`),

    /** Tenant-safe FK to bundle parent. */
    productBundleComponentsBizBundleFk: foreignKey({
      columns: [table.bizId, table.productBundleId],
      foreignColumns: [productBundles.bizId, productBundles.id],
      name: "product_bundle_components_biz_bundle_fk",
    }),

    /** Tenant-safe FK to optional product target. */
    productBundleComponentsBizProductFk: foreignKey({
      columns: [table.bizId, table.productId],
      foreignColumns: [products.bizId, products.id],
      name: "product_bundle_components_biz_product_fk",
    }),

    /** Tenant-safe FK to optional service-product target. */
    productBundleComponentsBizServiceProductFk: foreignKey({
      columns: [table.bizId, table.serviceProductId],
      foreignColumns: [serviceProducts.bizId, serviceProducts.id],
      name: "product_bundle_components_biz_service_product_fk",
    }),

    /** Tenant-safe FK to optional offer target. */
    productBundleComponentsBizOfferFk: foreignKey({
      columns: [table.bizId, table.offerId],
      foreignColumns: [offers.bizId, offers.id],
      name: "product_bundle_components_biz_offer_fk",
    }),

    /** Quantity bounds checks. */
    productBundleComponentsQuantityBoundsCheck: check(
      "product_bundle_components_quantity_bounds_check",
      sql`
      "min_quantity" >= 0
      AND ("max_quantity" IS NULL OR "max_quantity" >= "min_quantity")
      AND "default_quantity" >= "min_quantity"
      AND ("max_quantity" IS NULL OR "default_quantity" <= "max_quantity")
      `,
    ),

    /** Required components must require at least one item. */
    productBundleComponentsRequiredModeCheck: check(
      "product_bundle_components_required_mode_check",
      sql`"requirement_mode" = 'optional' OR "min_quantity" > 0`,
    ),

    /** Component target shape invariant. */
    productBundleComponentsTargetShapeCheck: check(
      "product_bundle_components_target_shape_check",
      sql`
      (
        "target_type" = 'product'
        AND "product_id" IS NOT NULL
        AND "service_product_id" IS NULL
        AND "offer_id" IS NULL
      ) OR (
        "target_type" = 'service_product'
        AND "product_id" IS NULL
        AND "service_product_id" IS NOT NULL
        AND "offer_id" IS NULL
      ) OR (
        "target_type" = 'offer'
        AND "product_id" IS NULL
        AND "service_product_id" IS NULL
        AND "offer_id" IS NOT NULL
      )
      `,
    ),

    /** Component pricing payload must match price mode. */
    productBundleComponentsPriceShapeCheck: check(
      "product_bundle_components_price_shape_check",
      sql`
      (
        "price_mode" = 'included'
        AND "price_override_minor" IS NULL
        AND "surcharge_minor" IS NULL
        AND "price_multiplier_bps" IS NULL
      ) OR (
        "price_mode" = 'fixed_override'
        AND "price_override_minor" IS NOT NULL
        AND "price_override_minor" >= 0
        AND "surcharge_minor" IS NULL
        AND "price_multiplier_bps" IS NULL
      ) OR (
        "price_mode" = 'surcharge'
        AND "price_override_minor" IS NULL
        AND "surcharge_minor" IS NOT NULL
        AND "surcharge_minor" >= 0
        AND "price_multiplier_bps" IS NULL
      ) OR (
        "price_mode" = 'multiplier'
        AND "price_override_minor" IS NULL
        AND "surcharge_minor" IS NULL
        AND "price_multiplier_bps" IS NOT NULL
        AND "price_multiplier_bps" >= 0
      )
      `,
    ),
  }),
);

/**
 * booking_order_line_sellables
 *
 * ELI5:
 * A booking order line can represent multiple underlying sellables.
 *
 * Example:
 * - one "bundle line" sold for $200
 * - decomposed into:
 *   - 1 sellable (service product)
 *   - 2 sellables (physical products)
 *
 * This table provides traceability from commercial lines to underlying
 * sellables used by inventory, finance, and reporting workflows.
 */
export const bookingOrderLineSellables = pgTable(
  "booking_order_line_sellables",
  {
    /** Stable primary key. */
    id: idWithTag("line_sellable"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent commercial booking line. */
    bookingOrderLineId: idRef("booking_order_line_id")
      .references(() => bookingOrderLines.id)
      .notNull(),

    /**
     * Canonical sellable identity for this commercial allocation row.
     * This is the unified commercial pointer regardless of source primitive.
     */
    sellableId: idRef("sellable_id")
      .references(() => sellables.id)
      .notNull(),

    /** Quantity of underlying sellable represented by this attribution row. */
    quantity: integer("quantity").default(1).notNull(),

    /**
     * Optional monetary allocation of this sellable inside line total.
     * Useful for revenue attribution and profitability analytics.
     */
    allocatedAmountMinor: integer("allocated_amount_minor"),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    bookingOrderLineSellablesBizIdIdUnique: uniqueIndex("booking_order_line_sellables_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Query path for line detail expansion. */
    bookingOrderLineSellablesBizLineIdx: index(
      "booking_order_line_sellables_biz_line_idx",
    ).on(table.bizId, table.bookingOrderLineId),

    /**
     * Unified top-seller path by canonical sellable.
     *
     * Why this exists:
     * "Top selling product/service/offer" queries group by sellable id.
     * This index keeps that aggregation path fast before/while materialized
     * fact tables are introduced.
     */
    bookingOrderLineSellablesBizSellableIdx: index(
      "booking_order_line_sellables_biz_sellable_idx",
    ).on(table.bizId, table.sellableId),

    /** Avoid duplicate attribution rows for same sellable in one line. */
    bookingOrderLineSellablesLineSellableUnique: uniqueIndex(
      "booking_order_line_sellables_line_sellable_unique",
    ).on(table.bookingOrderLineId, table.sellableId),

    /** Tenant-safe FK to booking line. */
    bookingOrderLineSellablesBizLineFk: foreignKey({
      columns: [table.bizId, table.bookingOrderLineId],
      foreignColumns: [bookingOrderLines.bizId, bookingOrderLines.id],
      name: "booking_order_line_sellables_biz_line_fk",
    }),

    /** Tenant-safe FK to canonical sellable. */
    bookingOrderLineSellablesBizSellableFk: foreignKey({
      columns: [table.bizId, table.sellableId],
      foreignColumns: [sellables.bizId, sellables.id],
      name: "booking_order_line_sellables_biz_sellable_fk",
    }),

    /** Quantity and allocation bounds. */
    bookingOrderLineSellablesBoundsCheck: check(
      "booking_order_line_sellables_bounds_check",
      sql`
      "quantity" > 0
      AND ("allocated_amount_minor" IS NULL OR "allocated_amount_minor" >= 0)
      `,
    ),
  }),
);

/**
 * inventory_locations
 *
 * ELI5:
 * Inventory location is "where stock lives."
 *
 * It can represent:
 * - warehouse,
 * - storefront shelf/bin,
 * - service vehicle trunk,
 * - virtual pool (preorder / external stock).
 */
export const inventoryLocations = pgTable(
  "inventory_locations",
  {
    /** Stable primary key. */
    id: idWithTag("inventory_location"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /**
     * Optional business location anchor.
     * Null means this is not tied to one registered business location.
     */
    locationId: idRef("location_id").references(() => locations.id),

    /** Human label for operators. */
    name: varchar("name", { length: 180 }).notNull(),

    /** Stable key used by APIs/imports. */
    slug: varchar("slug", { length: 120 }).notNull(),

    /** Location kind for fulfillment routing logic. */
    kind: inventoryLocationKindEnum("kind").notNull(),

    /** Lifecycle state for this stock node. */
    status: lifecycleStatusEnum("status").default("active").notNull(),

    /** Optional operator notes. */
    description: text("description"),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite unique key for tenant-safe stock/fulfillment FKs. */
    inventoryLocationsBizIdIdUnique: uniqueIndex(
      "inventory_locations_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** Stable slug identity per tenant. */
    inventoryLocationsBizSlugUnique: uniqueIndex(
      "inventory_locations_biz_slug_unique",
    ).on(table.bizId, table.slug),

    /** Common operations filter path. */
    inventoryLocationsBizKindStatusIdx: index(
      "inventory_locations_biz_kind_status_idx",
    ).on(table.bizId, table.kind, table.status),

    /** Tenant-safe FK to optional location anchor. */
    inventoryLocationsBizLocationFk: foreignKey({
      columns: [table.bizId, table.locationId],
      foreignColumns: [locations.bizId, locations.id],
      name: "inventory_locations_biz_location_fk",
    }),
  }),
);

/**
 * inventory_items
 *
 * ELI5:
 * One row tracks one product's stock summary inside one inventory location.
 *
 * Why summary exists:
 * - fast reads for availability checks,
 * - immutable movement ledger still exists in `inventory_movements` for audit.
 */
export const inventoryItems = pgTable(
  "inventory_items",
  {
    /** Stable primary key. */
    id: idWithTag("inventory_item"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Stock node where this product balance is tracked. */
    inventoryLocationId: idRef("inventory_location_id")
      .references(() => inventoryLocations.id)
      .notNull(),

    /** Catalog product whose quantity is tracked. */
    productId: idRef("product_id")
      .references(() => products.id)
      .notNull(),

    /** Optional SKU snapshot for quick ops screens and external sync. */
    skuSnapshot: varchar("sku_snapshot", { length: 120 }),

    /** Physical/virtual quantity currently on hand. */
    onHandQty: integer("on_hand_qty").default(0).notNull(),

    /** Quantity reserved for pending orders/jobs. */
    reservedQty: integer("reserved_qty").default(0).notNull(),

    /**
     * Denormalized available quantity.
     * Must equal on_hand_qty - reserved_qty by DB check below.
     */
    availableQty: integer("available_qty").default(0).notNull(),

    /** Optional threshold for low-stock alerts. */
    reorderPointQty: integer("reorder_point_qty"),

    /** Optional target quantity for replenishment suggestions. */
    reorderTargetQty: integer("reorder_target_qty"),

    /** If true, system may allow reservations beyond available stock. */
    allowBackorder: boolean("allow_backorder").default(false).notNull(),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    inventoryItemsBizIdIdUnique: uniqueIndex("inventory_items_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Composite unique key for tenant-safe movement/reservation FKs. */

    /** One stock summary row per location+product pair. */
    inventoryItemsLocationProductUnique: uniqueIndex(
      "inventory_items_location_product_unique",
    ).on(table.inventoryLocationId, table.productId),

    /** Common stock lookup path by product. */
    inventoryItemsBizProductIdx: index("inventory_items_biz_product_idx").on(
      table.bizId,
      table.productId,
    ),

    /** Common stock lookup path by inventory location. */
    inventoryItemsBizLocationIdx: index("inventory_items_biz_location_idx").on(
      table.bizId,
      table.inventoryLocationId,
    ),

    /** Tenant-safe FK to inventory location. */
    inventoryItemsBizInventoryLocationFk: foreignKey({
      columns: [table.bizId, table.inventoryLocationId],
      foreignColumns: [inventoryLocations.bizId, inventoryLocations.id],
      name: "inventory_items_biz_inventory_location_fk",
    }),

    /** Tenant-safe FK to product. */
    inventoryItemsBizProductFk: foreignKey({
      columns: [table.bizId, table.productId],
      foreignColumns: [products.bizId, products.id],
      name: "inventory_items_biz_product_fk",
    }),

    /** Quantity and summary integrity checks. */
    inventoryItemsQuantityCheck: check(
      "inventory_items_quantity_check",
      sql`
      "on_hand_qty" >= 0
      AND "reserved_qty" >= 0
      AND "available_qty" = ("on_hand_qty" - "reserved_qty")
      AND ("reorder_point_qty" IS NULL OR "reorder_point_qty" >= 0)
      AND ("reorder_target_qty" IS NULL OR "reorder_target_qty" >= 0)
      AND ("reorder_target_qty" IS NULL OR "reorder_point_qty" IS NULL OR "reorder_target_qty" >= "reorder_point_qty")
      AND ("allow_backorder" = true OR "available_qty" >= 0)
      `,
    ),
  }),
);

/**
 * inventory_reservations
 *
 * ELI5:
 * Reservation rows "hold" stock for a pending booking/order fulfillment path.
 *
 * This gives us explicit:
 * - reservation quantity,
 * - commit/release lifecycle,
 * - linkage to booking and fulfillment context.
 */
export const inventoryReservations = pgTable(
  "inventory_reservations",
  {
    /** Stable primary key. */
    id: idWithTag("inventory_reservation"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Stock summary row being reserved against. */
    inventoryItemId: idRef("inventory_item_id")
      .references(() => inventoryItems.id)
      .notNull(),

    /** Optional booking root context. */
    bookingOrderId: idRef("booking_order_id").references(() => bookingOrders.id),

    /** Optional line-item context. */
    bookingOrderLineId: idRef("booking_order_line_id").references(
      () => bookingOrderLines.id,
    ),

    /** Optional fulfillment-unit context. */
    fulfillmentUnitId: idRef("fulfillment_unit_id").references(
      () => fulfillmentUnits.id,
    ),

    /** Reservation lifecycle status. */
    status: inventoryReservationStatusEnum("status").default("reserved").notNull(),

    /** Quantity originally reserved. */
    quantityReserved: integer("quantity_reserved").notNull(),

    /** Quantity already committed to shipment/consumption. */
    quantityCommitted: integer("quantity_committed").default(0).notNull(),

    /** Quantity released back to availability. */
    quantityReleased: integer("quantity_released").default(0).notNull(),

    /** Optional expiry for temporary holds. */
    expiresAt: timestamp("expires_at", { withTimezone: true }),

    /** Commit timestamp. */
    committedAt: timestamp("committed_at", { withTimezone: true }),

    /** Release timestamp. */
    releasedAt: timestamp("released_at", { withTimezone: true }),

    /** Cancellation timestamp. */
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),

    /** Optional idempotency key for reservation workers/retries. */
    idempotencyKey: varchar("idempotency_key", { length: 200 }),

    /** Optional note/reason for operators. */
    note: text("note"),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite unique key for tenant-safe child FKs. */
    inventoryReservationsBizIdIdUnique: uniqueIndex(
      "inventory_reservations_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** Optional idempotency dedupe guard. */
    inventoryReservationsBizIdempotencyUnique: uniqueIndex(
      "inventory_reservations_biz_idempotency_unique",
    )
      .on(table.bizId, table.idempotencyKey)
      .where(sql`"idempotency_key" IS NOT NULL`),

    /** Common pending reservation queue path. */
    inventoryReservationsBizStatusExpiryIdx: index(
      "inventory_reservations_biz_status_expiry_idx",
    ).on(table.bizId, table.status, table.expiresAt),

    /** Common lookup path by inventory item. */
    inventoryReservationsBizInventoryItemIdx: index(
      "inventory_reservations_biz_inventory_item_idx",
    ).on(table.bizId, table.inventoryItemId, table.status),

    /** Tenant-safe FK to inventory item. */
    inventoryReservationsBizInventoryItemFk: foreignKey({
      columns: [table.bizId, table.inventoryItemId],
      foreignColumns: [inventoryItems.bizId, inventoryItems.id],
      name: "inventory_reservations_biz_inventory_item_fk",
    }),

    /** Tenant-safe FK to optional booking order. */
    inventoryReservationsBizBookingOrderFk: foreignKey({
      columns: [table.bizId, table.bookingOrderId],
      foreignColumns: [bookingOrders.bizId, bookingOrders.id],
      name: "inventory_reservations_biz_booking_order_fk",
    }),

    /** Tenant-safe FK to optional booking line. */
    inventoryReservationsBizBookingOrderLineFk: foreignKey({
      columns: [table.bizId, table.bookingOrderLineId],
      foreignColumns: [bookingOrderLines.bizId, bookingOrderLines.id],
      name: "inventory_reservations_biz_booking_order_line_fk",
    }),

    /** Tenant-safe FK to optional fulfillment unit. */
    inventoryReservationsBizFulfillmentUnitFk: foreignKey({
      columns: [table.bizId, table.fulfillmentUnitId],
      foreignColumns: [fulfillmentUnits.bizId, fulfillmentUnits.id],
      name: "inventory_reservations_biz_fulfillment_unit_fk",
    }),

    /** Quantity integrity checks for reservation lifecycle. */
    inventoryReservationsQuantityCheck: check(
      "inventory_reservations_quantity_check",
      sql`
      "quantity_reserved" > 0
      AND "quantity_committed" >= 0
      AND "quantity_released" >= 0
      AND ("quantity_committed" + "quantity_released") <= "quantity_reserved"
      `,
    ),

    /** Reservation should be tied to at least one business context. */
    inventoryReservationsContextCheck: check(
      "inventory_reservations_context_check",
      sql`
      "booking_order_id" IS NOT NULL
      OR "booking_order_line_id" IS NOT NULL
      OR "fulfillment_unit_id" IS NOT NULL
      `,
    ),
  }),
);

/**
 * physical_fulfillments
 *
 * ELI5:
 * One row tracks physical delivery/pickup execution for products.
 *
 * This covers shipping, pickup, and handover workflows.
 */
export const physicalFulfillments = pgTable(
  "physical_fulfillments",
  {
    /** Stable primary key. */
    id: idWithTag("physical_fulfillment"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Optional booking order this fulfillment belongs to. */
    bookingOrderId: idRef("booking_order_id").references(() => bookingOrders.id),

    /** Fulfillment method class. */
    method: physicalFulfillmentMethodEnum("method").notNull(),

    /** Fulfillment lifecycle status. */
    status: physicalFulfillmentStatusEnum("status").default("draft").notNull(),

    /**
     * Optional source stock location.
     * Used by picking/packing workflows for inventory attribution.
     */
    originInventoryLocationId: idRef("origin_inventory_location_id").references(
      () => inventoryLocations.id,
    ),

    /**
     * Optional destination business location.
     * Useful for pickup flows or inter-branch transfers.
     */
    destinationLocationId: idRef("destination_location_id").references(
      () => locations.id,
    ),

    /**
     * Recipient delivery/pickup snapshot.
     * Keep this as JSON to preserve exact address/contact state at execution.
     */
    recipientSnapshot: jsonb("recipient_snapshot").default({}).notNull(),

    /** Optional shipping carrier identifier (UPS, FedEx, etc.). */
    carrier: varchar("carrier", { length: 120 }),

    /** Optional service level label (ground, express, same_day). */
    serviceLevel: varchar("service_level", { length: 120 }),

    /** Optional tracking number/reference. */
    trackingNumber: varchar("tracking_number", { length: 160 }),

    /** Optional external provider fulfillment id. */
    externalFulfillmentRef: varchar("external_fulfillment_ref", { length: 200 }),

    /** Optional target ship-by time. */
    shipByAt: timestamp("ship_by_at", { withTimezone: true }),

    /** Time shipment left origin / handover happened. */
    shippedAt: timestamp("shipped_at", { withTimezone: true }),

    /** Time delivery/pickup completion happened. */
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),

    /** Failure timestamp for failed attempts. */
    failedAt: timestamp("failed_at", { withTimezone: true }),

    /** Optional notes for operators/support. */
    notes: text("notes"),

    /** Extension payload for provider-specific data. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite unique key for tenant-safe item/movement references. */
    physicalFulfillmentsBizIdIdUnique: uniqueIndex(
      "physical_fulfillments_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** Optional provider reference dedupe. */
    physicalFulfillmentsBizExternalRefUnique: uniqueIndex(
      "physical_fulfillments_biz_external_ref_unique",
    )
      .on(table.bizId, table.externalFulfillmentRef)
      .where(sql`"external_fulfillment_ref" IS NOT NULL`),

    /** Main operations queue path. */
    physicalFulfillmentsBizStatusShipByIdx: index(
      "physical_fulfillments_biz_status_ship_by_idx",
    ).on(table.bizId, table.status, table.shipByAt),

    /** Tenant-safe FK to optional booking order. */
    physicalFulfillmentsBizBookingOrderFk: foreignKey({
      columns: [table.bizId, table.bookingOrderId],
      foreignColumns: [bookingOrders.bizId, bookingOrders.id],
      name: "physical_fulfillments_biz_booking_order_fk",
    }),

    /** Tenant-safe FK to optional origin inventory location. */
    physicalFulfillmentsBizOriginInventoryLocationFk: foreignKey({
      columns: [table.bizId, table.originInventoryLocationId],
      foreignColumns: [inventoryLocations.bizId, inventoryLocations.id],
      name: "physical_fulfillments_biz_origin_inventory_location_fk",
    }),

    /** Tenant-safe FK to optional destination business location. */
    physicalFulfillmentsBizDestinationLocationFk: foreignKey({
      columns: [table.bizId, table.destinationLocationId],
      foreignColumns: [locations.bizId, locations.id],
      name: "physical_fulfillments_biz_destination_location_fk",
    }),

    /** Timeline sanity checks for fulfillment lifecycle. */
    physicalFulfillmentsTimelineCheck: check(
      "physical_fulfillments_timeline_check",
      sql`
      ("delivered_at" IS NULL OR "shipped_at" IS NULL OR "delivered_at" >= "shipped_at")
      AND ("failed_at" IS NULL OR "shipped_at" IS NULL OR "failed_at" >= "shipped_at")
      `,
    ),
  }),
);

/**
 * physical_fulfillment_items
 *
 * ELI5:
 * One row = one product line being physically fulfilled.
 *
 * This gives per-item visibility for picking, packing, shipping, and returns.
 */
export const physicalFulfillmentItems = pgTable(
  "physical_fulfillment_items",
  {
    /** Stable primary key. */
    id: idWithTag("physical_fulfillment_item"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent physical fulfillment execution row. */
    physicalFulfillmentId: idRef("physical_fulfillment_id")
      .references(() => physicalFulfillments.id)
      .notNull(),

    /** Product being shipped/picked/handovered. */
    productId: idRef("product_id")
      .references(() => products.id)
      .notNull(),

    /** Optional source booking line for commercial traceability. */
    bookingOrderLineId: idRef("booking_order_line_id").references(
      () => bookingOrderLines.id,
    ),

    /** Optional inventory item source used for picking allocation. */
    inventoryItemId: idRef("inventory_item_id").references(() => inventoryItems.id),

    /** Optional inventory reservation consumed by this item. */
    inventoryReservationId: idRef("inventory_reservation_id").references(
      () => inventoryReservations.id,
    ),

    /** Item-level status. */
    status: physicalFulfillmentItemStatusEnum("status")
      .default("pending")
      .notNull(),

    /** Ordered quantity for this fulfillment item. */
    quantity: integer("quantity").notNull(),

    /** Shipped quantity (can be partial). */
    quantityShipped: integer("quantity_shipped").default(0).notNull(),

    /** Delivered quantity (can be partial). */
    quantityDelivered: integer("quantity_delivered").default(0).notNull(),

    /** Optional return quantity for reverse-logistics tracking. */
    quantityReturned: integer("quantity_returned").default(0).notNull(),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite unique key for tenant-safe movement references. */
    physicalFulfillmentItemsBizIdIdUnique: uniqueIndex(
      "physical_fulfillment_items_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** Common detail query path for one fulfillment row. */
    physicalFulfillmentItemsBizFulfillmentIdx: index(
      "physical_fulfillment_items_biz_fulfillment_idx",
    ).on(table.bizId, table.physicalFulfillmentId),

    /** Tenant-safe FK to parent fulfillment row. */
    physicalFulfillmentItemsBizFulfillmentFk: foreignKey({
      columns: [table.bizId, table.physicalFulfillmentId],
      foreignColumns: [physicalFulfillments.bizId, physicalFulfillments.id],
      name: "physical_fulfillment_items_biz_fulfillment_fk",
    }),

    /** Tenant-safe FK to product. */
    physicalFulfillmentItemsBizProductFk: foreignKey({
      columns: [table.bizId, table.productId],
      foreignColumns: [products.bizId, products.id],
      name: "physical_fulfillment_items_biz_product_fk",
    }),

    /** Tenant-safe FK to optional booking line context. */
    physicalFulfillmentItemsBizBookingLineFk: foreignKey({
      columns: [table.bizId, table.bookingOrderLineId],
      foreignColumns: [bookingOrderLines.bizId, bookingOrderLines.id],
      name: "physical_fulfillment_items_biz_booking_line_fk",
    }),

    /** Tenant-safe FK to optional inventory item source. */
    physicalFulfillmentItemsBizInventoryItemFk: foreignKey({
      columns: [table.bizId, table.inventoryItemId],
      foreignColumns: [inventoryItems.bizId, inventoryItems.id],
      name: "physical_fulfillment_items_biz_inventory_item_fk",
    }),

    /** Tenant-safe FK to optional inventory reservation source. */
    physicalFulfillmentItemsBizInventoryReservationFk: foreignKey({
      columns: [table.bizId, table.inventoryReservationId],
      foreignColumns: [inventoryReservations.bizId, inventoryReservations.id],
      name: "physical_fulfillment_items_biz_inventory_reservation_fk",
    }),

    /** Quantity bounds and progression checks. */
    physicalFulfillmentItemsQuantityCheck: check(
      "physical_fulfillment_items_quantity_check",
      sql`
      "quantity" > 0
      AND "quantity_shipped" >= 0
      AND "quantity_delivered" >= 0
      AND "quantity_returned" >= 0
      AND "quantity_shipped" <= "quantity"
      AND "quantity_delivered" <= "quantity_shipped"
      AND "quantity_returned" <= "quantity_delivered"
      `,
    ),
  }),
);

/**
 * inventory_movements
 *
 * ELI5:
 * Immutable stock ledger.
 *
 * Rule:
 * - append new rows for stock changes,
 * - never rewrite history,
 * - use adjustment/correction movements if mistakes happen.
 */
export const inventoryMovements = pgTable(
  "inventory_movements",
  {
    /** Stable primary key. */
    id: idWithTag("inventory_movement"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Stock summary row this movement applies to. */
    inventoryItemId: idRef("inventory_item_id")
      .references(() => inventoryItems.id)
      .notNull(),

    /** Movement category for semantic interpretation. */
    movementType: inventoryMovementTypeEnum("movement_type").notNull(),

    /**
     * Signed quantity delta:
     * - positive = stock increase
     * - negative = stock decrease
     */
    quantityDelta: integer("quantity_delta").notNull(),

    /** Movement occurrence timestamp. */
    occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),

    /** Optional source location context for transfer/reporting. */
    sourceInventoryLocationId: idRef("source_inventory_location_id").references(
      () => inventoryLocations.id,
    ),

    /** Optional destination location context for transfer/reporting. */
    destinationInventoryLocationId: idRef(
      "destination_inventory_location_id",
    ).references(() => inventoryLocations.id),

    /** Optional source booking order context. */
    bookingOrderId: idRef("booking_order_id").references(() => bookingOrders.id),

    /** Optional source booking line context. */
    bookingOrderLineId: idRef("booking_order_line_id").references(
      () => bookingOrderLines.id,
    ),

    /** Optional source fulfillment unit context. */
    fulfillmentUnitId: idRef("fulfillment_unit_id").references(
      () => fulfillmentUnits.id,
    ),

    /** Optional source reservation context. */
    inventoryReservationId: idRef("inventory_reservation_id").references(
      () => inventoryReservations.id,
    ),

    /** Optional source physical-fulfillment-item context. */
    physicalFulfillmentItemId: idRef("physical_fulfillment_item_id").references(
      () => physicalFulfillmentItems.id,
    ),

    /** Optional reason code for analytics/ops controls. */
    reasonCode: varchar("reason_code", { length: 120 }),

    /** Optional operator note. */
    note: text("note"),

    /** Optional idempotency key for safe retried writes. */
    idempotencyKey: varchar("idempotency_key", { length: 200 }),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    inventoryMovementsBizIdIdUnique: uniqueIndex("inventory_movements_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Optional dedupe guard for idempotent workers. */
    inventoryMovementsBizIdempotencyUnique: uniqueIndex(
      "inventory_movements_biz_idempotency_unique",
    )
      .on(table.bizId, table.idempotencyKey)
      .where(sql`"idempotency_key" IS NOT NULL`),

    /** Main stock-ledger timeline path. */
    inventoryMovementsBizItemOccurredIdx: index(
      "inventory_movements_biz_item_occurred_idx",
    ).on(table.bizId, table.inventoryItemId, table.occurredAt),

    /** Reverse lookup path from booking context. */
    inventoryMovementsBizBookingOccurredIdx: index(
      "inventory_movements_biz_booking_occurred_idx",
    ).on(table.bizId, table.bookingOrderId, table.occurredAt),

    /** Tenant-safe FK to inventory item. */
    inventoryMovementsBizInventoryItemFk: foreignKey({
      columns: [table.bizId, table.inventoryItemId],
      foreignColumns: [inventoryItems.bizId, inventoryItems.id],
      name: "inventory_movements_biz_inventory_item_fk",
    }),

    /** Tenant-safe FK to optional source location. */
    inventoryMovementsBizSourceInventoryLocationFk: foreignKey({
      columns: [table.bizId, table.sourceInventoryLocationId],
      foreignColumns: [inventoryLocations.bizId, inventoryLocations.id],
      name: "inventory_movements_biz_source_inventory_location_fk",
    }),

    /** Tenant-safe FK to optional destination location. */
    inventoryMovementsBizDestinationInventoryLocationFk: foreignKey({
      columns: [table.bizId, table.destinationInventoryLocationId],
      foreignColumns: [inventoryLocations.bizId, inventoryLocations.id],
      name: "inventory_movements_biz_destination_inventory_location_fk",
    }),

    /** Tenant-safe FK to optional booking order. */
    inventoryMovementsBizBookingOrderFk: foreignKey({
      columns: [table.bizId, table.bookingOrderId],
      foreignColumns: [bookingOrders.bizId, bookingOrders.id],
      name: "inventory_movements_biz_booking_order_fk",
    }),

    /** Tenant-safe FK to optional booking line. */
    inventoryMovementsBizBookingOrderLineFk: foreignKey({
      columns: [table.bizId, table.bookingOrderLineId],
      foreignColumns: [bookingOrderLines.bizId, bookingOrderLines.id],
      name: "inventory_movements_biz_booking_order_line_fk",
    }),

    /** Tenant-safe FK to optional fulfillment unit. */
    inventoryMovementsBizFulfillmentUnitFk: foreignKey({
      columns: [table.bizId, table.fulfillmentUnitId],
      foreignColumns: [fulfillmentUnits.bizId, fulfillmentUnits.id],
      name: "inventory_movements_biz_fulfillment_unit_fk",
    }),

    /** Tenant-safe FK to optional inventory reservation. */
    inventoryMovementsBizInventoryReservationFk: foreignKey({
      columns: [table.bizId, table.inventoryReservationId],
      foreignColumns: [inventoryReservations.bizId, inventoryReservations.id],
      name: "inventory_movements_biz_inventory_reservation_fk",
    }),

    /** Tenant-safe FK to optional physical fulfillment item. */
    inventoryMovementsBizPhysicalFulfillmentItemFk: foreignKey({
      columns: [table.bizId, table.physicalFulfillmentItemId],
      foreignColumns: [physicalFulfillmentItems.bizId, physicalFulfillmentItems.id],
      name: "inventory_movements_biz_physical_fulfillment_item_fk",
    }),

    /** Movement delta cannot be zero. */
    inventoryMovementsQuantityDeltaCheck: check(
      "inventory_movements_quantity_delta_check",
      sql`"quantity_delta" <> 0`,
    ),

    /** Transfer rows require both source and destination location ids. */
    inventoryMovementsTransferLocationCheck: check(
      "inventory_movements_transfer_location_check",
      sql`
      (
        "movement_type" NOT IN ('transfer_in', 'transfer_out')
      ) OR (
        "source_inventory_location_id" IS NOT NULL
        AND "destination_inventory_location_id" IS NOT NULL
        AND "source_inventory_location_id" <> "destination_inventory_location_id"
      )
      `,
    ),
  }),
);
