import { sql } from "drizzle-orm";
import { check, foreignKey, index, uniqueIndex } from "drizzle-orm/pg-core";
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  varchar,
} from "drizzle-orm/pg-core";
import { id, idRef, withAuditRefs } from "./_common";
import {
  serviceProductKindEnum,
  requirementModeEnum,
  selectorMatchModeEnum,
  resourceSelectorTypeEnum,
  resourceTypeEnum,
  durationModeEnum,
  lifecycleStatusEnum,
} from "./enums";
import { bizConfigValues } from "./biz_configs";
import { resources } from "./resources";
import { locations } from "./locations";
import { products } from "./products";
import { serviceGroups, services } from "./services";
import { resourceCapabilityTemplates } from "./supply";
import { subjects } from "./subjects";
import { users } from "./users";
import { bizes } from "./bizes";
import { resourceSelectorShapeCheckSql } from "./_resource_selector_shape";

/**
 * service_products
 *
 * Time-based sellable definitions that can bundle one or many resources.
 *
 * Why this exists (separate from `products`):
 * - `products` is the generic sellable catalog (physical/digital/fees/etc.).
 * - `service_products` is the schedule-aware commercial definition that drives
 *   booking/rental availability, resource requirements, and duration behavior.
 *
 * Typical setup:
 * 1) Create a service product.
 * 2) Define requirement groups (required/optional, min/max counts).
 * 3) Add resource selectors (specific resource, tag template, category).
 * 4) Add service bindings (`service_product_services`) for service intent.
 * 5) Configure seat types and pricing.
 * 6) Publish and optionally map to a generic `products` row for mixed carts.
 *
 * Location rollout note:
 * - service-product-to-location mapping is stored in the generic
 *   `subject_location_bindings` table with `subject_type='service_product'`.
 */
export const serviceProducts = pgTable(
  "service_products",
  {
    id,

    /** Tenant boundary for isolation in catalog, pricing, and scheduling flows. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /**
     * Optional bridge to generic catalog product row.
     *
     * Use this when checkout/order flows should treat this service product as a
     * normal sellable line item while still preserving booking-specific rules.
     */
    productId: idRef("product_id").references(() => products.id),

    /** Admin/customer-facing name shown in service-product catalog and checkout. */
    name: varchar("name", { length: 255 }).notNull(),

    /** Stable per-biz key used by APIs, URLs, and imports. */
    slug: varchar("slug", { length: 120 }).notNull(),

    /** Rich description for storefront and internal setup context. */
    description: text("description"),

    /**
     * High-level commercial classification.
     * Operationally this helps UI present booking vs rental language.
     */
    kind: serviceProductKindEnum("kind").default("booking").notNull(),
    /**
     * Optional biz-config dictionary value for product kind wording/grouping.
     * This allows industry-specific labels while preserving core kind semantics.
     */
    kindConfigValueId: idRef("kind_config_value_id").references(
      () => bizConfigValues.id,
    ),

    /**
     * Fixed, flexible, or multi-day duration behavior.
     * This controls how slot finding and quote calculations treat duration.
     */
    durationMode: durationModeEnum("duration_mode").default("fixed").notNull(),
    /**
     * Optional biz-config dictionary value for duration mode phrasing.
     */
    durationModeConfigValueId: idRef("duration_mode_config_value_id").references(
      () => bizConfigValues.id,
    ),

    /** Canonical duration for fixed-mode products. */
    defaultDurationMinutes: integer("default_duration_minutes")
      .default(60)
      .notNull(),

    /** Lower bound for flexible-mode bookings. */
    minDurationMinutes: integer("min_duration_minutes"),

    /** Upper bound for flexible-mode bookings. */
    maxDurationMinutes: integer("max_duration_minutes"),

    /** Step granularity for flexible duration selection UIs. */
    durationStepMinutes: integer("duration_step_minutes").default(15).notNull(),

    /** Timezone used for service-product level calendar interpretation. */
    timezone: varchar("timezone", { length: 50 }).default("UTC").notNull(),

    /**
     * Baseline price before seat/resource/time adjustments.
     * Stored in minor units for deterministic accounting math.
     */
    basePriceAmountMinorUnits: integer("base_price_amount").default(0).notNull(),

    /** Settlement/display currency used across derived booking quotes. */
    currency: varchar("currency", { length: 3 }).default("USD").notNull(),

    /**
     * Extended pricing controls (tiering, seat behavior, manual override flags).
     * Intentionally JSON to avoid hardcoding one pricing strategy.
     */
    pricingPolicy: jsonb("pricing_policy").default({}),

    /**
     * Extended scheduling controls beyond calendars/availability rules.
     * Example: "lock slot when N of M required components are pending hold".
     */
    availabilityPolicy: jsonb("availability_policy").default({}),

    /** Publication toggle for customer-visible channels. */
    isPublished: boolean("is_published").default(false).notNull(),

    /** Standard lifecycle for internal operations and archival. */
    status: lifecycleStatusEnum("status").default("draft").notNull(),
    /**
     * Optional biz-config dictionary value for service-product status.
     */
    statusConfigValueId: idRef("status_config_value_id").references(
      () => bizConfigValues.id,
    ),

    /** Extension bucket for non-indexed custom attributes. */
    metadata: jsonb("metadata").default({}),

    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    serviceProductsBizIdIdUnique: uniqueIndex(
      "service_products_biz_id_id_unique",
    ).on(table.bizId, table.id),
    serviceProductsBizSlugUnique: uniqueIndex(
      "service_products_biz_slug_unique",
    ).on(table.bizId, table.slug),
    serviceProductsProductUnique: uniqueIndex(
      "service_products_product_unique",
    ).on(table.productId),
    serviceProductsBizStatusIdx: index("service_products_biz_status_idx").on(
      table.bizId,
      table.status,
    ),
    serviceProductsBizKindIdx: index("service_products_biz_kind_idx").on(
      table.bizId,
      table.kind,
    ),
    serviceProductsBizKindConfigIdx: index(
      "service_products_biz_kind_config_idx",
    ).on(table.bizId, table.kindConfigValueId),
    serviceProductsBizDurationModeConfigIdx: index(
      "service_products_biz_duration_mode_config_idx",
    ).on(table.bizId, table.durationModeConfigValueId),
    serviceProductsBizStatusConfigIdx: index(
      "service_products_biz_status_config_idx",
    ).on(table.bizId, table.statusConfigValueId),
    /** Tenant-safe FK to optional generic catalog-product bridge row. */
    serviceProductsBizProductFk: foreignKey({
      columns: [table.bizId, table.productId],
      foreignColumns: [products.bizId, products.id],
      name: "service_products_biz_product_fk",
    }),
    /** Tenant-safe FK to optional configurable kind value. */
    serviceProductsBizKindConfigFk: foreignKey({
      columns: [table.bizId, table.kindConfigValueId],
      foreignColumns: [bizConfigValues.bizId, bizConfigValues.id],
      name: "service_products_biz_kind_config_fk",
    }),
    /** Tenant-safe FK to optional configurable duration-mode value. */
    serviceProductsBizDurationModeConfigFk: foreignKey({
      columns: [table.bizId, table.durationModeConfigValueId],
      foreignColumns: [bizConfigValues.bizId, bizConfigValues.id],
      name: "service_products_biz_duration_mode_config_fk",
    }),
    /** Tenant-safe FK to optional configurable status value. */
    serviceProductsBizStatusConfigFk: foreignKey({
      columns: [table.bizId, table.statusConfigValueId],
      foreignColumns: [bizConfigValues.bizId, bizConfigValues.id],
      name: "service_products_biz_status_config_fk",
    }),
    serviceProductsMinDurationCheck: check(
      "service_products_min_duration_check",
      sql`"min_duration_minutes" IS NULL OR "min_duration_minutes" > 0`,
    ),
    serviceProductsMaxDurationCheck: check(
      "service_products_max_duration_check",
      sql`"max_duration_minutes" IS NULL OR "max_duration_minutes" > 0`,
    ),
    serviceProductsDurationBoundsCheck: check(
      "service_products_duration_bounds_check",
      sql`
      "min_duration_minutes" IS NULL
      OR "max_duration_minutes" IS NULL
      OR "max_duration_minutes" >= "min_duration_minutes"
      `,
    ),
    /** Currency should always use uppercase ISO-like code shape. */
    serviceProductsCurrencyFormatCheck: check(
      "service_products_currency_format_check",
      sql`"currency" ~ '^[A-Z]{3}$'`,
    ),
  }),
);

/**
 * service_product_requirement_groups
 *
 * Cardinality constraints for each resource component class in a service product.
 *
 * Examples:
 * - "Required: at least 1 host"
 * - "Optional: up to 2 observer hosts"
 * - "Required: exactly 1 venue"
 * - "Required: at least 1 qualifying asset"
 *
 * Selectors are attached in `service_product_requirement_selectors`.
 */
export const serviceProductRequirementGroups = pgTable(
  "service_product_requirement_groups",
  {
    id,
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),
    serviceProductId: idRef("service_product_id")
      .references(() => serviceProducts.id)
      .notNull(),

    /** Human label for this requirement block in admin UI. */
    name: varchar("name", { length: 160 }).notNull(),

    /** Stable key for API payloads/import templates. */
    slug: varchar("slug", { length: 120 }).notNull(),

    /**
     * Component type governed by this group.
     * Values align with the polymorphic `resources.type` discriminator.
     */
    targetResourceType: resourceTypeEnum("target_resource_type").notNull(),

    /** Required or optional intent. */
    requirementMode: requirementModeEnum("requirement_mode")
      .default("required")
      .notNull(),

    /**
     * Lower bound that must be satisfied for this component group.
     * For optional groups this is commonly `0`.
     */
    minQuantity: integer("min_quantity").default(1).notNull(),

    /** Upper bound allowed for this group; null means "no explicit max". */
    maxQuantity: integer("max_quantity"),

    /**
     * Selector evaluation mode:
     * - any: any selector can satisfy required quantity.
     * - all: each selector contributes and must be represented.
     */
    selectorMatchMode: selectorMatchModeEnum(
      "selector_match_mode",
    )
      .default("any")
      .notNull(),

    /**
     * If true, fulfillment can swap candidates that match selectors.
     * If false, assignment should preserve initial candidate choices.
     */
    allowSubstitution: boolean("allow_substitution").default(true).notNull(),

    /** UI ordering hint. */
    sortOrder: integer("sort_order").default(100).notNull(),

    description: text("description"),
    metadata: jsonb("metadata").default({}),

    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    serviceProductRequirementGroupsBizIdIdUnique: uniqueIndex(
      "service_product_requirement_groups_biz_id_id_unique",
    ).on(table.bizId, table.id),
    serviceProductRequirementGroupsBizServiceProductFk: foreignKey({
      columns: [table.bizId, table.serviceProductId],
      foreignColumns: [serviceProducts.bizId, serviceProducts.id],
      name: "service_product_requirement_groups_biz_service_product_fk",
    }),
    serviceProductRequirementGroupsUnique: uniqueIndex(
      "service_product_requirement_groups_unique",
    ).on(table.serviceProductId, table.slug),
    serviceProductRequirementGroupsBizProductIdx: index(
      "service_product_requirement_groups_biz_product_idx",
    ).on(table.bizId, table.serviceProductId),
    serviceProductRequirementGroupsBizTypeIdx: index(
      "service_product_requirement_groups_biz_type_idx",
    ).on(table.bizId, table.targetResourceType),
    /** Quantity bounds sanity checks for resource requirement groups. */
    serviceProductRequirementGroupsMinQtyCheck: check(
      "service_product_requirement_groups_min_qty_check",
      sql`"min_quantity" >= 0`,
    ),
    serviceProductRequirementGroupsMaxQtyCheck: check(
      "service_product_requirement_groups_max_qty_check",
      sql`"max_quantity" IS NULL OR "max_quantity" >= "min_quantity"`,
    ),
  }),
);

/**
 * service_product_services
 *
 * Service-intent bindings for a service product.
 *
 * Why this table exists:
 * - Resource requirement groups answer: "what resources are needed?"
 * - This table answers: "what service templates does this product represent?"
 *
 * This separation removes overlap and keeps responsibilities clear:
 * - service intent + operational semantics live here
 * - resource matching semantics live in `service_product_requirement_*` tables
 *
 * Binding modes:
 * - direct service row (`service_id`)
 * - service group row (`service_group_id`) for broad category-level matching
 *
 * Exactly one of `service_id` or `service_group_id` must be set.
 */
export const serviceProductServices = pgTable(
  "service_product_services",
  {
    id,

    /** Tenant boundary for ownership/filtering. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent service product that this binding contributes to. */
    serviceProductId: idRef("service_product_id")
      .references(() => serviceProducts.id)
      .notNull(),

    /**
     * Direct service binding.
     * Set this for explicit single-service product composition.
     */
    serviceId: idRef("service_id").references(() => services.id),

    /**
     * Service-group binding.
     * Set this when product should match any service from a group.
     */
    serviceGroupId: idRef("service_group_id").references(
      () => serviceGroups.id,
    ),

    /** Required or optional service intent for this product. */
    requirementMode: requirementModeEnum("requirement_mode")
      .default("required")
      .notNull(),

    /**
     * Minimum count of this service binding that must be satisfied.
     * For optional rows this is commonly 0.
     */
    minQuantity: integer("min_quantity").default(1).notNull(),

    /** Maximum allowed count for this binding; null means no explicit cap. */
    maxQuantity: integer("max_quantity"),

    /** Display/evaluation ordering hint for deterministic behavior. */
    sortOrder: integer("sort_order").default(100).notNull(),

    /** Optional operations/admin explanation for this binding rule. */
    description: text("description"),

    /** Extension payload for future service-binding options. */
    metadata: jsonb("metadata").default({}),

    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    serviceProductServicesBizServiceProductFk: foreignKey({
      columns: [table.bizId, table.serviceProductId],
      foreignColumns: [serviceProducts.bizId, serviceProducts.id],
      name: "service_product_services_biz_service_product_fk",
    }),
    serviceProductServicesBizServiceFk: foreignKey({
      columns: [table.bizId, table.serviceId],
      foreignColumns: [services.bizId, services.id],
      name: "service_product_services_biz_service_fk",
    }),
    serviceProductServicesBizServiceGroupFk: foreignKey({
      columns: [table.bizId, table.serviceGroupId],
      foreignColumns: [serviceGroups.bizId, serviceGroups.id],
      name: "service_product_services_biz_service_group_fk",
    }),
    serviceProductServicesUniqueService: uniqueIndex(
      "service_product_services_unique_service",
    ).on(table.serviceProductId, table.serviceId),
    serviceProductServicesUniqueGroup: uniqueIndex(
      "service_product_services_unique_group",
    ).on(table.serviceProductId, table.serviceGroupId),
    serviceProductServicesBizProductIdx: index(
      "service_product_services_biz_product_idx",
    ).on(table.bizId, table.serviceProductId, table.sortOrder),

    /** Exactly one service target must be populated. */
    serviceProductServicesTargetShapeCheck: check(
      "service_product_services_target_shape_check",
      sql`
      (
        "service_id" IS NOT NULL
        AND "service_group_id" IS NULL
      ) OR (
        "service_id" IS NULL
        AND "service_group_id" IS NOT NULL
      )
      `,
    ),

    /** Quantity bounds sanity checks. */
    serviceProductServicesMinQtyCheck: check(
      "service_product_services_min_qty_check",
      sql`"min_quantity" >= 0`,
    ),
    serviceProductServicesMaxQtyCheck: check(
      "service_product_services_max_qty_check",
      sql`"max_quantity" IS NULL OR "max_quantity" >= "min_quantity"`,
    ),
  }),
);

/**
 * service_product_requirement_selectors
 *
 * Candidate pools that can satisfy a requirement group.
 *
 * Selector examples:
 * - specific host: `selector_type=resource`, `resource_id=<host resource>`
 * - host/asset/venue capability: `selector_type=capability_template`, `capability_template_id=...`
 * - location scoped pool: `selector_type=location`, `location_id=...`
 *
 * Integrity note:
 * - Exactly one selector reference should be populated per row, based on
 *   `selector_type`. This is enforced by DB check constraint below.
 */
export const serviceProductRequirementSelectors = pgTable(
  "service_product_requirement_selectors",
  {
    id,
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),
    requirementGroupId: idRef("requirement_group_id")
      .references(() => serviceProductRequirementGroups.id)
      .notNull(),

    /** Selector shape/type that determines which FK column should be populated. */
    selectorType: resourceSelectorTypeEnum("selector_type").notNull(),

    /**
     * Include/exclude toggle for advanced selection logic.
     * - true: candidate is allowed.
     * - false: candidate should be excluded from matching.
     */
    isIncluded: boolean("is_included").default(true).notNull(),

    /** Direct individual candidate in the polymorphic resource catalog. */
    resourceId: idRef("resource_id").references(() => resources.id),

    /** Broad selector by resource class (host/company_host/asset/venue). */
    resourceType: resourceTypeEnum("resource_type"),

    /** Generic capability selector across host/asset/venue/company-host supply. */
    capabilityTemplateId: idRef("capability_template_id").references(
      () => resourceCapabilityTemplates.id,
    ),

    /** Optional location selector for location-scoped requirement pools. */
    locationId: idRef("location_id").references(() => locations.id),

    /** Extensible selector payload for plugin/custom subject namespaces. */
    subjectType: varchar("subject_type", { length: 80 }),
    subjectId: varchar("subject_id", { length: 140 }),

    /** UI ordering hint for deterministic selector rendering/evaluation. */
    sortOrder: integer("sort_order").default(100).notNull(),

    description: text("description"),
    metadata: jsonb("metadata").default({}),

    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    serviceProductRequirementSelectorsBizGroupFk: foreignKey({
      columns: [table.bizId, table.requirementGroupId],
      foreignColumns: [serviceProductRequirementGroups.bizId, serviceProductRequirementGroups.id],
      name: "service_product_requirement_selectors_biz_group_fk",
    }),
    serviceProductRequirementSelectorsBizResourceFk: foreignKey({
      columns: [table.bizId, table.resourceId],
      foreignColumns: [resources.bizId, resources.id],
      name: "service_product_requirement_selectors_biz_resource_fk",
    }),
    serviceProductRequirementSelectorsBizSubjectFk: foreignKey({
      columns: [table.bizId, table.subjectType, table.subjectId],
      foreignColumns: [subjects.bizId, subjects.subjectType, subjects.subjectId],
      name: "service_product_requirement_selectors_biz_subject_fk",
    }),
    serviceProductRequirementSelectorsBizCapabilityTemplateFk: foreignKey({
      columns: [table.bizId, table.capabilityTemplateId],
      foreignColumns: [resourceCapabilityTemplates.bizId, resourceCapabilityTemplates.id],
      name: "service_product_requirement_selectors_biz_capability_template_fk",
    }),
    serviceProductRequirementSelectorsBizLocationFk: foreignKey({
      columns: [table.bizId, table.locationId],
      foreignColumns: [locations.bizId, locations.id],
      name: "service_product_requirement_selectors_biz_location_fk",
    }),
    serviceProductRequirementSelectorsGroupIdx: index(
      "service_product_requirement_selectors_group_idx",
    ).on(table.requirementGroupId, table.sortOrder),
    serviceProductRequirementSelectorsResourceIdx: index(
      "service_product_requirement_selectors_resource_idx",
    ).on(table.resourceId),
    serviceProductRequirementSelectorsResourceTypeIdx: index(
      "service_product_requirement_selectors_resource_type_idx",
    ).on(table.resourceType),
    serviceProductRequirementSelectorsSubjectIdx: index(
      "service_product_requirement_selectors_subject_idx",
    ).on(table.subjectType, table.subjectId),
    serviceProductRequirementSelectorsCapabilityIdx: index(
      "service_product_requirement_selectors_capability_idx",
    ).on(table.capabilityTemplateId),
    serviceProductRequirementSelectorsLocationIdx: index(
      "service_product_requirement_selectors_location_idx",
    ).on(table.locationId),

    /**
     * Ensures selector payload matches selector type exactly.
     *
     * This keeps selector semantics deterministic and prevents partially-valid
     * rows that are hard to interpret at runtime.
     */
    serviceProductRequirementSelectorsShapeCheck: check(
      "service_product_requirement_selectors_shape_check",
      resourceSelectorShapeCheckSql,
    ),
  }),
);

/**
 * service_product_seat_types
 *
 * Seat classes for one service product (e.g., student, observer, VIP).
 *
 * This enables:
 * - differentiated seat pricing
 * - capacity controls by seat type
 * - future seat-based resource requirement overrides
 */
export const serviceProductSeatTypes = pgTable(
  "service_product_seat_types",
  {
    id,
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),
    serviceProductId: idRef("service_product_id")
      .references(() => serviceProducts.id)
      .notNull(),

    name: varchar("name", { length: 120 }).notNull(),
    slug: varchar("slug", { length: 120 }).notNull(),
    description: text("description"),

    /** Marks the default seat type used when no explicit customer selection is made. */
    isDefault: boolean("is_default").default(false).notNull(),

    /** Minimum quantity of this seat type allowed per booking. */
    minSeats: integer("min_seats").default(0).notNull(),

    /** Maximum quantity of this seat type allowed per booking. */
    maxSeats: integer("max_seats"),

    /** Suggested default quantity pre-filled in booking UX. */
    defaultQuantity: integer("default_quantity").default(1).notNull(),

    /** Unit seat price in minor currency units. */
    basePriceAmount: integer("base_price_amount").default(0).notNull(),
    currency: varchar("currency", { length: 3 }).default("USD").notNull(),

    status: lifecycleStatusEnum("status").default("active").notNull(),
    /**
     * Optional biz-config dictionary value for seat-type lifecycle status.
     */
    statusConfigValueId: idRef("status_config_value_id").references(
      () => bizConfigValues.id,
    ),
    metadata: jsonb("metadata").default({}),

    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    serviceProductSeatTypesBizIdIdUnique: uniqueIndex(
      "service_product_seat_types_biz_id_id_unique",
    ).on(table.bizId, table.id),
    serviceProductSeatTypesBizServiceProductFk: foreignKey({
      columns: [table.bizId, table.serviceProductId],
      foreignColumns: [serviceProducts.bizId, serviceProducts.id],
      name: "service_product_seat_types_biz_service_product_fk",
    }),
    serviceProductSeatTypesUnique: uniqueIndex(
      "service_product_seat_types_unique",
    ).on(table.serviceProductId, table.slug),
    serviceProductSeatTypesBizProductIdx: index(
      "service_product_seat_types_biz_product_idx",
    ).on(table.bizId, table.serviceProductId),
    serviceProductSeatTypesBizStatusConfigIdx: index(
      "service_product_seat_types_biz_status_config_idx",
    ).on(table.bizId, table.statusConfigValueId),
    /** Tenant-safe FK to optional configurable seat-type status. */
    serviceProductSeatTypesBizStatusConfigFk: foreignKey({
      columns: [table.bizId, table.statusConfigValueId],
      foreignColumns: [bizConfigValues.bizId, bizConfigValues.id],
      name: "service_product_seat_types_biz_status_config_fk",
    }),
    serviceProductSeatTypesMinSeatsCheck: check(
      "service_product_seat_types_min_seats_check",
      sql`"min_seats" >= 0`,
    ),
    serviceProductSeatTypesMaxSeatsCheck: check(
      "service_product_seat_types_max_seats_check",
      sql`"max_seats" IS NULL OR "max_seats" >= "min_seats"`,
    ),
    serviceProductSeatTypesDefaultQtyCheck: check(
      "service_product_seat_types_default_qty_check",
      sql`"default_quantity" >= "min_seats" AND ("max_seats" IS NULL OR "default_quantity" <= "max_seats")`,
    ),
    /** Currency should always use uppercase ISO-like code shape. */
    serviceProductSeatTypesCurrencyFormatCheck: check(
      "service_product_seat_types_currency_format_check",
      sql`"currency" ~ '^[A-Z]{3}$'`,
    ),
  }),
);

/**
 * service_product_seat_type_requirements
 *
 * Optional overrides that tune requirement quantities by seat type.
 *
 * Example:
 * - A "student" seat might require one host and one training asset.
 * - An "observer" seat might require no additional host count.
 */
export const serviceProductSeatTypeRequirements = pgTable(
  "service_product_seat_type_requirements",
  {
    id,
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),
    seatTypeId: idRef("seat_type_id")
      .references(() => serviceProductSeatTypes.id)
      .notNull(),
    requirementGroupId: idRef("requirement_group_id")
      .references(() => serviceProductRequirementGroups.id)
      .notNull(),

    /** Optional override for minimum quantity on this seat type. */
    minQuantityOverride: integer("min_quantity_override"),

    /** Optional override for maximum quantity on this seat type. */
    maxQuantityOverride: integer("max_quantity_override"),

    metadata: jsonb("metadata").default({}),
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    serviceProductSeatTypeRequirementsBizSeatTypeFk: foreignKey({
      columns: [table.bizId, table.seatTypeId],
      foreignColumns: [serviceProductSeatTypes.bizId, serviceProductSeatTypes.id],
      name: "service_product_seat_type_requirements_biz_seat_type_fk",
    }),
    serviceProductSeatTypeRequirementsBizRequirementGroupFk: foreignKey({
      columns: [table.bizId, table.requirementGroupId],
      foreignColumns: [serviceProductRequirementGroups.bizId, serviceProductRequirementGroups.id],
      name: "service_product_seat_type_requirements_biz_requirement_group_fk",
    }),
    serviceProductSeatTypeRequirementsUnique: uniqueIndex(
      "service_product_seat_type_requirements_unique",
    ).on(table.seatTypeId, table.requirementGroupId),
    serviceProductSeatTypeRequirementsBizSeatIdx: index(
      "service_product_seat_type_requirements_biz_seat_idx",
    ).on(table.bizId, table.seatTypeId),
    serviceProductSeatTypeRequirementsMinOverrideCheck: check(
      "service_product_seat_type_requirements_min_override_check",
      sql`"min_quantity_override" IS NULL OR "min_quantity_override" >= 0`,
    ),
    serviceProductSeatTypeRequirementsMaxOverrideCheck: check(
      "service_product_seat_type_requirements_max_override_check",
      sql`
      "max_quantity_override" IS NULL
      OR "min_quantity_override" IS NULL
      OR "max_quantity_override" >= "min_quantity_override"
      `,
    ),
  }),
);

export type ServiceProduct = typeof serviceProducts.$inferSelect;
export type NewServiceProduct = typeof serviceProducts.$inferInsert;

export type ServiceProductRequirementGroup =
  typeof serviceProductRequirementGroups.$inferSelect;
export type NewServiceProductRequirementGroup =
  typeof serviceProductRequirementGroups.$inferInsert;

export type ServiceProductService = typeof serviceProductServices.$inferSelect;
export type NewServiceProductService =
  typeof serviceProductServices.$inferInsert;

export type ServiceProductRequirementSelector =
  typeof serviceProductRequirementSelectors.$inferSelect;
export type NewServiceProductRequirementSelector =
  typeof serviceProductRequirementSelectors.$inferInsert;

export type ServiceProductSeatType =
  typeof serviceProductSeatTypes.$inferSelect;
export type NewServiceProductSeatType =
  typeof serviceProductSeatTypes.$inferInsert;

export type ServiceProductSeatTypeRequirement =
  typeof serviceProductSeatTypeRequirements.$inferSelect;
export type NewServiceProductSeatTypeRequirement =
  typeof serviceProductSeatTypeRequirements.$inferInsert;
