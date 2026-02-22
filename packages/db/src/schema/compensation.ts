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
  compensationCalculationModeEnum,
  compensationLedgerEntryTypeEnum,
  compensationPayRunItemStatusEnum,
  compensationPayRunStatusEnum,
  compensationPlanVersionStatusEnum,
  compensationRuleSelectorTypeEnum,
  lifecycleStatusEnum,
  resourceTypeEnum,
} from "./enums";
import {
  bookingOrderLines,
  bookingOrders,
  fulfillmentAssignments,
  fulfillmentUnits,
} from "./fulfillment";
import { locations } from "./locations";
import { crossBizOrders } from "./marketplace";
import { payouts, paymentTransactions } from "./payments";
import { resources } from "./resources";
import { serviceProducts } from "./service_products";
import { services } from "./services";
import { staffingAssignments } from "./intelligence";
import { resourceCapabilityTemplates } from "./supply";
import { users } from "./users";
import { offerComponents } from "./offers";
import { workTimeSegments } from "./work_management";

/**
 * compensation_role_templates
 *
 * ELI5:
 * This is the role dictionary for compensation.
 *
 * Why this exists:
 * - Free-text role names are inconsistent ("lead", "Lead Stylist", "senior").
 * - Payroll and commission rules need stable role keys.
 * - A biz can define role vocabulary once and reuse it everywhere.
 *
 * How it connects:
 * - Used by `compensation_assignment_roles` to normalize assignment roles.
 * - Used by `compensation_plan_rules` to apply role-based payout formulas.
 */
export const compensationRoleTemplates = pgTable(
  "compensation_role_templates",
  {
    /** Stable primary key. */
    id: idWithTag("comp_role"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /**
     * Optional location-specific role vocabulary.
     * Null means this role can be used across all locations in the biz.
     */
    locationId: idRef("location_id").references(() => locations.id),

    /** Human-readable role label shown in admin/payroll UI. */
    name: varchar("name", { length: 140 }).notNull(),

    /** Stable machine key used in APIs and imports. */
    slug: varchar("slug", { length: 140 }).notNull(),

    /** Optional explanation for operators. */
    description: text("description"),

    /** Lifecycle state for retiring old role templates safely. */
    status: lifecycleStatusEnum("status").default("active").notNull(),

    /** UI ordering hint. */
    sortOrder: integer("sort_order").default(100).notNull(),

    /** Extension payload for custom fields. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite unique key for tenant-safe FKs from child tables. */
    compensationRoleTemplatesBizIdIdUnique: uniqueIndex(
      "compensation_role_templates_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** Unique slug per location scope. */
    compensationRoleTemplatesBizLocationSlugUnique: uniqueIndex(
      "compensation_role_templates_biz_location_slug_unique",
    ).on(table.bizId, table.locationId, table.slug),

    /** Unique slug for biz-wide roles where location is null. */
    compensationRoleTemplatesBizGlobalSlugUnique: uniqueIndex(
      "compensation_role_templates_biz_global_slug_unique",
    )
      .on(table.bizId, table.slug)
      .where(sql`"location_id" IS NULL`),

    /** Common admin listing path. */
    compensationRoleTemplatesBizStatusSortIdx: index(
      "compensation_role_templates_biz_status_sort_idx",
    ).on(table.bizId, table.status, table.sortOrder),

    /** Tenant-safe FK to optional location scope. */
    compensationRoleTemplatesBizLocationFk: foreignKey({
      columns: [table.bizId, table.locationId],
      foreignColumns: [locations.bizId, locations.id],
      name: "compensation_role_templates_biz_location_fk",
    }),
  }),
);

/**
 * compensation_plans
 *
 * ELI5:
 * Plan is the named container for payout strategy.
 *
 * Example:
 * - "Standard salon commission"
 * - "Weekend premium staffing plan"
 *
 * Why split plan vs plan version:
 * - Plan shell is stable identity (slug/name).
 * - Plan versions are immutable snapshots used for historical explainability.
 */
export const compensationPlans = pgTable(
  "compensation_plans",
  {
    /** Stable primary key. */
    id: idWithTag("comp_plan"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Human-readable plan name. */
    name: varchar("name", { length: 180 }).notNull(),

    /** Stable key used by APIs and config imports. */
    slug: varchar("slug", { length: 140 }).notNull(),

    /** Optional long-form description for admins. */
    description: text("description"),

    /** Lifecycle gate for publishing/retiring plans. */
    status: lifecycleStatusEnum("status").default("draft").notNull(),

    /** Currency used by payout calculations in this plan. */
    currency: varchar("currency", { length: 3 }).default("USD").notNull(),

    /**
     * Optional location scope.
     * Null means the plan can apply across all locations.
     */
    locationId: idRef("location_id").references(() => locations.id),

    /**
     * Optional service scope.
     * Null means all services.
     */
    serviceId: idRef("service_id").references(() => services.id),

    /**
     * Optional service-product scope.
     * Null means all service products.
     */
    serviceProductId: idRef("service_product_id").references(
      () => serviceProducts.id,
    ),

    /** Default resolver candidate when no more-specific plan matches. */
    isDefault: boolean("is_default").default(false).notNull(),

    /**
     * Resolver precedence where lower numbers are evaluated first.
     * Useful when several active plans could match one assignment.
     */
    priority: integer("priority").default(100).notNull(),

    /** Plan-level settings used by compensation workers. */
    policy: jsonb("policy").default({}),

    /** Extension payload for future knobs. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite unique key for tenant-safe FKs from plan versions. */
    compensationPlansBizIdIdUnique: uniqueIndex(
      "compensation_plans_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** One slug per tenant. */
    compensationPlansBizSlugUnique: uniqueIndex(
      "compensation_plans_biz_slug_unique",
    ).on(table.bizId, table.slug),

    /** Optional one default plan per biz. */
    compensationPlansBizDefaultUnique: uniqueIndex(
      "compensation_plans_biz_default_unique",
    )
      .on(table.bizId)
      .where(sql`"is_default" = true AND "deleted_at" IS NULL`),

    /** Main listing and resolver query path. */
    compensationPlansBizStatusPriorityIdx: index(
      "compensation_plans_biz_status_priority_idx",
    ).on(table.bizId, table.status, table.priority),

    /** Tenant-safe FK to optional location scope. */
    compensationPlansBizLocationFk: foreignKey({
      columns: [table.bizId, table.locationId],
      foreignColumns: [locations.bizId, locations.id],
      name: "compensation_plans_biz_location_fk",
    }),

    /** Tenant-safe FK to optional service scope. */
    compensationPlansBizServiceFk: foreignKey({
      columns: [table.bizId, table.serviceId],
      foreignColumns: [services.bizId, services.id],
      name: "compensation_plans_biz_service_fk",
    }),

    /** Tenant-safe FK to optional service-product scope. */
    compensationPlansBizServiceProductFk: foreignKey({
      columns: [table.bizId, table.serviceProductId],
      foreignColumns: [serviceProducts.bizId, serviceProducts.id],
      name: "compensation_plans_biz_service_product_fk",
    }),

    /** Priority must be non-negative. */
    compensationPlansPriorityCheck: check(
      "compensation_plans_priority_check",
      sql`"priority" >= 0`,
    ),

    /** Currency should always use uppercase ISO-like code shape. */
    compensationPlansCurrencyFormatCheck: check(
      "compensation_plans_currency_format_check",
      sql`"currency" ~ '^[A-Z]{3}$'`,
    ),
  }),
);

/**
 * compensation_plan_versions
 *
 * ELI5:
 * Each version is an immutable rule snapshot of a compensation plan.
 *
 * Why immutable:
 * - Past payouts must remain explainable exactly as computed.
 * - New policy should create a new version, not edit history.
 */
export const compensationPlanVersions = pgTable(
  "compensation_plan_versions",
  {
    /** Stable primary key. */
    id: idWithTag("comp_plan_version"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent plan shell identity. */
    compensationPlanId: idRef("compensation_plan_id")
      .references(() => compensationPlans.id)
      .notNull(),

    /** Monotonic version number for this plan. */
    versionNumber: integer("version_number").notNull(),

    /** Version lifecycle state. */
    status: compensationPlanVersionStatusEnum("status")
      .default("draft")
      .notNull(),

    /** Inclusive start instant for this version's applicability. */
    effectiveFromAt: timestamp("effective_from_at", {
      withTimezone: true,
    }).notNull(),

    /** Optional end instant (exclusive) when version is retired. */
    effectiveToAt: timestamp("effective_to_at", { withTimezone: true }),

    /** Active-pointer hint for fast rule resolution. */
    isCurrent: boolean("is_current").default(false).notNull(),

    /** Optional release/change note for admins and audits. */
    notes: text("notes"),

    /** Calculation engine knobs frozen with this version. */
    calculationPolicy: jsonb("calculation_policy").default({}),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite unique key for tenant-safe FKs from rules/ledger. */
    compensationPlanVersionsBizIdIdUnique: uniqueIndex(
      "compensation_plan_versions_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** One version number per plan. */
    compensationPlanVersionsPlanVersionUnique: uniqueIndex(
      "compensation_plan_versions_plan_version_unique",
    ).on(table.compensationPlanId, table.versionNumber),

    /** Optional one current version per plan. */
    compensationPlanVersionsCurrentUnique: uniqueIndex(
      "compensation_plan_versions_current_unique",
    )
      .on(table.compensationPlanId)
      .where(sql`"is_current" = true AND "deleted_at" IS NULL`),

    /** Common version lookup path for resolver workers. */
    compensationPlanVersionsBizPlanStatusIdx: index(
      "compensation_plan_versions_biz_plan_status_idx",
    ).on(table.bizId, table.compensationPlanId, table.status, table.effectiveFromAt),

    /** Tenant-safe FK to parent plan shell. */
    compensationPlanVersionsBizPlanFk: foreignKey({
      columns: [table.bizId, table.compensationPlanId],
      foreignColumns: [compensationPlans.bizId, compensationPlans.id],
      name: "compensation_plan_versions_biz_plan_fk",
    }),

    /** Version number starts at 1. */
    compensationPlanVersionsVersionNumberCheck: check(
      "compensation_plan_versions_version_number_check",
      sql`"version_number" >= 1`,
    ),

    /** End time must be after start when both are set. */
    compensationPlanVersionsWindowCheck: check(
      "compensation_plan_versions_window_check",
      sql`"effective_to_at" IS NULL OR "effective_to_at" > "effective_from_at"`,
    ),

    /** Current version should be active. */
    compensationPlanVersionsCurrentStatusCheck: check(
      "compensation_plan_versions_current_status_check",
      sql`"is_current" = false OR "status" = 'active'`,
    ),
  }),
);

/**
 * compensation_plan_rules
 *
 * ELI5:
 * These are the actual payout formulas inside one plan version.
 *
 * Rule matching model:
 * 1) choose a selector target (resource, service, category, etc.),
 * 2) optionally narrow by compensation role,
 * 3) apply formula (flat/percent/hourly/hybrid).
 *
 * Why the strict selector shape check exists:
 * - One row must represent one matching idea only.
 * - This keeps rule resolution deterministic and debuggable.
 */
export const compensationPlanRules = pgTable(
  "compensation_plan_rules",
  {
    /** Stable primary key. */
    id: idWithTag("comp_rule"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Owning plan version snapshot. */
    compensationPlanVersionId: idRef("compensation_plan_version_id")
      .references(() => compensationPlanVersions.id)
      .notNull(),

    /** Human-readable rule name for admin/debug tooling. */
    name: varchar("name", { length: 160 }).notNull(),

    /** Optional explanation for operators. */
    description: text("description"),

    /** Enable/disable flag without deleting historical rows. */
    isEnabled: boolean("is_enabled").default(true).notNull(),

    /** Match precedence where lower values run first. */
    priority: integer("priority").default(100).notNull(),

    /**
     * Optional normalized role filter.
     * Example: "lead_stylist" can have 70% while "assistant" has 30%.
     */
    roleTemplateId: idRef("role_template_id").references(
      () => compensationRoleTemplates.id,
    ),

    /** Selector discriminator for matching context. */
    selectorType: compensationRuleSelectorTypeEnum("selector_type").notNull(),

    /** Selector payload for one specific resource. */
    resourceId: idRef("resource_id").references(() => resources.id),

    /** Selector payload for broad resource type matching. */
    resourceType: resourceTypeEnum("resource_type"),

    /**
     * Selector payload for capability taxonomy.
     *
     * This is intentionally generic so payout rules can target any capability
     * scope (host, company host, asset, venue) using one shared dictionary.
     */
    capabilityTemplateId: idRef("capability_template_id").references(
      () => resourceCapabilityTemplates.id,
    ),

    /** Selector payload for location-level matching. */
    locationId: idRef("location_id").references(() => locations.id),

    /** Selector payload for service-level matching. */
    serviceId: idRef("service_id").references(() => services.id),

    /** Selector payload for service-product-level matching. */
    serviceProductId: idRef("service_product_id").references(
      () => serviceProducts.id,
    ),

    /** Selector payload for offer component-level matching. */
    offerComponentId: idRef("offer_component_id").references(
      () => offerComponents.id,
    ),

    /** Formula model to use when this rule matches. */
    calculationMode: compensationCalculationModeEnum("calculation_mode").notNull(),

    /** Flat payout amount in minor units (flat mode). */
    flatAmountMinor: integer("flat_amount_minor"),

    /** Base amount in minor units (hybrid mode). */
    baseAmountMinor: integer("base_amount_minor"),

    /** Percent component in basis points (percent and hybrid modes). */
    percentBps: integer("percent_bps"),

    /** Hourly rate in minor units per hour (hourly mode). */
    hourlyRateMinor: integer("hourly_rate_minor"),

    /** Optional payout floor in minor units after formula evaluation. */
    minimumPayoutMinor: integer("minimum_payout_minor"),

    /** Optional payout ceiling in minor units after formula evaluation. */
    maximumPayoutMinor: integer("maximum_payout_minor"),

    /**
     * If true, worker may multiply by quantity dimension when available.
     * Example: per-seat or per-unit scenarios.
     */
    applyPerQuantity: boolean("apply_per_quantity").default(false).notNull(),

    /** Optional rule-local effective start. */
    effectiveFromAt: timestamp("effective_from_at", { withTimezone: true }),

    /** Optional rule-local effective end. */
    effectiveToAt: timestamp("effective_to_at", { withTimezone: true }),

    /** Extension payload for future formula parameters. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite unique key for tenant-safe FKs from ledger rows. */
    compensationPlanRulesBizIdIdUnique: uniqueIndex(
      "compensation_plan_rules_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** Main rule resolution query path. */
    compensationPlanRulesBizVersionEnabledPriorityIdx: index(
      "compensation_plan_rules_biz_version_enabled_priority_idx",
    ).on(table.bizId, table.compensationPlanVersionId, table.isEnabled, table.priority),

    /** Common role-filtered resolution path. */
    compensationPlanRulesBizRoleEnabledIdx: index(
      "compensation_plan_rules_biz_role_enabled_idx",
    ).on(table.bizId, table.roleTemplateId, table.isEnabled, table.priority),

    /** Tenant-safe FK to parent plan version. */
    compensationPlanRulesBizPlanVersionFk: foreignKey({
      columns: [table.bizId, table.compensationPlanVersionId],
      foreignColumns: [compensationPlanVersions.bizId, compensationPlanVersions.id],
      name: "compensation_plan_rules_biz_plan_version_fk",
    }),

    /** Tenant-safe FK to optional role template. */
    compensationPlanRulesBizRoleTemplateFk: foreignKey({
      columns: [table.bizId, table.roleTemplateId],
      foreignColumns: [compensationRoleTemplates.bizId, compensationRoleTemplates.id],
      name: "compensation_plan_rules_biz_role_template_fk",
    }),

    /** Tenant-safe FK to optional resource selector payload. */
    compensationPlanRulesBizResourceFk: foreignKey({
      columns: [table.bizId, table.resourceId],
      foreignColumns: [resources.bizId, resources.id],
      name: "compensation_plan_rules_biz_resource_fk",
    }),

    /** Tenant-safe FK to optional capability selector payload. */
    compensationPlanRulesBizCapabilityTemplateFk: foreignKey({
      columns: [table.bizId, table.capabilityTemplateId],
      foreignColumns: [resourceCapabilityTemplates.bizId, resourceCapabilityTemplates.id],
      name: "compensation_plan_rules_biz_capability_template_fk",
    }),

    /** Tenant-safe FK to optional location selector payload. */
    compensationPlanRulesBizLocationFk: foreignKey({
      columns: [table.bizId, table.locationId],
      foreignColumns: [locations.bizId, locations.id],
      name: "compensation_plan_rules_biz_location_fk",
    }),

    /** Tenant-safe FK to optional service selector payload. */
    compensationPlanRulesBizServiceFk: foreignKey({
      columns: [table.bizId, table.serviceId],
      foreignColumns: [services.bizId, services.id],
      name: "compensation_plan_rules_biz_service_fk",
    }),

    /** Tenant-safe FK to optional service-product selector payload. */
    compensationPlanRulesBizServiceProductFk: foreignKey({
      columns: [table.bizId, table.serviceProductId],
      foreignColumns: [serviceProducts.bizId, serviceProducts.id],
      name: "compensation_plan_rules_biz_service_product_fk",
    }),

    /** Tenant-safe FK to optional offer-component selector payload. */
    compensationPlanRulesBizOfferComponentFk: foreignKey({
      columns: [table.bizId, table.offerComponentId],
      foreignColumns: [offerComponents.bizId, offerComponents.id],
      name: "compensation_plan_rules_biz_offer_component_fk",
    }),

    /** Priority must be non-negative. */
    compensationPlanRulesPriorityCheck: check(
      "compensation_plan_rules_priority_check",
      sql`"priority" >= 0`,
    ),

    /** Numeric bounds for payout formula fields. */
    compensationPlanRulesFormulaBoundsCheck: check(
      "compensation_plan_rules_formula_bounds_check",
      sql`
      ("flat_amount_minor" IS NULL OR "flat_amount_minor" >= 0)
      AND ("base_amount_minor" IS NULL OR "base_amount_minor" >= 0)
      AND ("percent_bps" IS NULL OR ("percent_bps" >= 0 AND "percent_bps" <= 100000))
      AND ("hourly_rate_minor" IS NULL OR "hourly_rate_minor" >= 0)
      AND ("minimum_payout_minor" IS NULL OR "minimum_payout_minor" >= 0)
      AND ("maximum_payout_minor" IS NULL OR "maximum_payout_minor" >= 0)
      AND ("maximum_payout_minor" IS NULL OR "minimum_payout_minor" IS NULL OR "maximum_payout_minor" >= "minimum_payout_minor")
      `,
    ),

    /** Rule-local effective window ordering check. */
    compensationPlanRulesWindowCheck: check(
      "compensation_plan_rules_window_check",
      sql`"effective_to_at" IS NULL OR "effective_from_at" IS NULL OR "effective_to_at" > "effective_from_at"`,
    ),

    /**
     * Selector payload must match selector type exactly.
     *
     * This prevents ambiguous rules where multiple selector payloads are set.
     */
    compensationPlanRulesSelectorShapeCheck: check(
      "compensation_plan_rules_selector_shape_check",
      sql`
      (
        "selector_type" = 'any'
        AND "resource_id" IS NULL
        AND "resource_type" IS NULL
        AND "capability_template_id" IS NULL
        AND "location_id" IS NULL
        AND "service_id" IS NULL
        AND "service_product_id" IS NULL
        AND "offer_component_id" IS NULL
      ) OR (
        "selector_type" = 'resource'
        AND "resource_id" IS NOT NULL
        AND "resource_type" IS NULL
        AND "capability_template_id" IS NULL
        AND "location_id" IS NULL
        AND "service_id" IS NULL
        AND "service_product_id" IS NULL
        AND "offer_component_id" IS NULL
      ) OR (
        "selector_type" = 'resource_type'
        AND "resource_id" IS NULL
        AND "resource_type" IS NOT NULL
        AND "capability_template_id" IS NULL
        AND "location_id" IS NULL
        AND "service_id" IS NULL
        AND "service_product_id" IS NULL
        AND "offer_component_id" IS NULL
      ) OR (
        "selector_type" = 'capability_template'
        AND "resource_id" IS NULL
        AND "resource_type" IS NULL
        AND "capability_template_id" IS NOT NULL
        AND "location_id" IS NULL
        AND "service_id" IS NULL
        AND "service_product_id" IS NULL
        AND "offer_component_id" IS NULL
      ) OR (
        "selector_type" = 'location'
        AND "resource_id" IS NULL
        AND "resource_type" IS NULL
        AND "capability_template_id" IS NULL
        AND "location_id" IS NOT NULL
        AND "service_id" IS NULL
        AND "service_product_id" IS NULL
        AND "offer_component_id" IS NULL
      ) OR (
        "selector_type" = 'service'
        AND "resource_id" IS NULL
        AND "resource_type" IS NULL
        AND "capability_template_id" IS NULL
        AND "location_id" IS NULL
        AND "service_id" IS NOT NULL
        AND "service_product_id" IS NULL
        AND "offer_component_id" IS NULL
      ) OR (
        "selector_type" = 'service_product'
        AND "resource_id" IS NULL
        AND "resource_type" IS NULL
        AND "capability_template_id" IS NULL
        AND "location_id" IS NULL
        AND "service_id" IS NULL
        AND "service_product_id" IS NOT NULL
        AND "offer_component_id" IS NULL
      ) OR (
        "selector_type" = 'offer_component'
        AND "resource_id" IS NULL
        AND "resource_type" IS NULL
        AND "capability_template_id" IS NULL
        AND "location_id" IS NULL
        AND "service_id" IS NULL
        AND "service_product_id" IS NULL
        AND "offer_component_id" IS NOT NULL
      )
      `,
    ),

    /**
     * Formula payload must match calculation mode exactly.
     *
     * This prevents partially-valid rows that are hard to evaluate.
     */
    compensationPlanRulesCalculationShapeCheck: check(
      "compensation_plan_rules_calculation_shape_check",
      sql`
      (
        "calculation_mode" = 'flat_amount'
        AND "flat_amount_minor" IS NOT NULL
        AND "base_amount_minor" IS NULL
        AND "percent_bps" IS NULL
        AND "hourly_rate_minor" IS NULL
      ) OR (
        "calculation_mode" = 'percent_of_order_total'
        AND "flat_amount_minor" IS NULL
        AND "base_amount_minor" IS NULL
        AND "percent_bps" IS NOT NULL
        AND "hourly_rate_minor" IS NULL
      ) OR (
        "calculation_mode" = 'percent_of_order_subtotal'
        AND "flat_amount_minor" IS NULL
        AND "base_amount_minor" IS NULL
        AND "percent_bps" IS NOT NULL
        AND "hourly_rate_minor" IS NULL
      ) OR (
        "calculation_mode" = 'percent_of_line_total'
        AND "flat_amount_minor" IS NULL
        AND "base_amount_minor" IS NULL
        AND "percent_bps" IS NOT NULL
        AND "hourly_rate_minor" IS NULL
      ) OR (
        "calculation_mode" = 'hourly'
        AND "flat_amount_minor" IS NULL
        AND "base_amount_minor" IS NULL
        AND "percent_bps" IS NULL
        AND "hourly_rate_minor" IS NOT NULL
      ) OR (
        "calculation_mode" = 'base_plus_percent'
        AND "flat_amount_minor" IS NULL
        AND "base_amount_minor" IS NOT NULL
        AND "percent_bps" IS NOT NULL
        AND "hourly_rate_minor" IS NULL
      )
      `,
    ),
  }),
);

/**
 * compensation_assignment_roles
 *
 * ELI5:
 * This table assigns one normalized compensation role to one fulfillment assignment.
 *
 * Why this exists when `fulfillment_assignments.role_label` already exists:
 * - `role_label` is free text for operational UX.
 * - Payroll/commission needs stable normalized role references.
 */
export const compensationAssignmentRoles = pgTable(
  "compensation_assignment_roles",
  {
    /** Stable primary key. */
    id: idWithTag("comp_assignment_role"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Target assignment receiving normalized compensation role. */
    fulfillmentAssignmentId: idRef("fulfillment_assignment_id")
      .references(() => fulfillmentAssignments.id)
      .notNull(),

    /** Normalized role template used by compensation resolver. */
    roleTemplateId: idRef("role_template_id")
      .references(() => compensationRoleTemplates.id)
      .notNull(),

    /**
     * Source of the mapping:
     * - manual, import, or derived from role-label mapping rules.
     */
    source: varchar("source", { length: 60 }).default("manual").notNull(),

    /** Timestamp when mapping was established. */
    assignedAt: timestamp("assigned_at", { withTimezone: true }).defaultNow().notNull(),

    /** Optional actor who established this mapping. */
    assignedByUserId: idRef("assigned_by_user_id").references(() => users.id),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite unique key for tenant-safe FKs from ledger rows. */
    compensationAssignmentRolesBizIdIdUnique: uniqueIndex(
      "compensation_assignment_roles_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** One normalized role per assignment. */
    compensationAssignmentRolesAssignmentUnique: uniqueIndex(
      "compensation_assignment_roles_assignment_unique",
    ).on(table.fulfillmentAssignmentId),

    /** Common payroll lookup path by role. */
    compensationAssignmentRolesBizRoleIdx: index(
      "compensation_assignment_roles_biz_role_idx",
    ).on(table.bizId, table.roleTemplateId),

    /** Tenant-safe FK to assignment. */
    compensationAssignmentRolesBizAssignmentFk: foreignKey({
      columns: [table.bizId, table.fulfillmentAssignmentId],
      foreignColumns: [fulfillmentAssignments.bizId, fulfillmentAssignments.id],
      name: "compensation_assignment_roles_biz_assignment_fk",
    }),

    /** Tenant-safe FK to role template. */
    compensationAssignmentRolesBizRoleTemplateFk: foreignKey({
      columns: [table.bizId, table.roleTemplateId],
      foreignColumns: [compensationRoleTemplates.bizId, compensationRoleTemplates.id],
      name: "compensation_assignment_roles_biz_role_template_fk",
    }),
  }),
);

/**
 * compensation_ledger_entries
 *
 * ELI5:
 * This is the payroll-grade, append-only compensation ledger.
 *
 * Key idea:
 * - Every compensation fact is one row.
 * - Corrections are written as new rows (never rewrite old rows).
 *
 * Signed amount semantics:
 * - Positive = increases payee balance.
 * - Negative = decreases payee balance.
 */
export const compensationLedgerEntries = pgTable(
  "compensation_ledger_entries",
  {
    /** Stable primary key. */
    id: idWithTag("comp_ledger"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Resource that receives this compensation movement. */
    payeeResourceId: idRef("payee_resource_id")
      .references(() => resources.id)
      .notNull(),

    /** Optional normalized role context for this movement. */
    roleTemplateId: idRef("role_template_id").references(
      () => compensationRoleTemplates.id,
    ),

    /** Optional exact assignment-role mapping context. */
    compensationAssignmentRoleId: idRef("compensation_assignment_role_id").references(
      () => compensationAssignmentRoles.id,
    ),

    /** Optional resolved plan version used for this calculation. */
    compensationPlanVersionId: idRef("compensation_plan_version_id").references(
      () => compensationPlanVersions.id,
    ),

    /** Optional resolved plan rule used for this calculation. */
    compensationPlanRuleId: idRef("compensation_plan_rule_id").references(
      () => compensationPlanRules.id,
    ),

    /** Optional booking contract context. */
    bookingOrderId: idRef("booking_order_id").references(() => bookingOrders.id),

    /** Optional booking line-item context. */
    bookingOrderLineId: idRef("booking_order_line_id").references(
      () => bookingOrderLines.id,
    ),

    /** Optional fulfillment unit context. */
    fulfillmentUnitId: idRef("fulfillment_unit_id").references(
      () => fulfillmentUnits.id,
    ),

    /** Optional fulfillment assignment context. */
    fulfillmentAssignmentId: idRef("fulfillment_assignment_id").references(
      () => fulfillmentAssignments.id,
    ),

    /**
     * Optional internal staffing assignment context.
     *
     * Why this exists:
     * not all paid work comes from customer bookings. Internal staffing shifts
     * (front desk coverage, on-call windows, back-office tasks) should have the
     * same payroll-grade traceability as booking-linked assignments.
     */
    staffingAssignmentId: idRef("staffing_assignment_id").references(
      () => staffingAssignments.id,
    ),

    /**
     * Optional work time segment context for timesheet-backed payroll lineage.
     *
     * This gives direct traceability from ledger movements to concrete clock
     * events captured in work/time domain.
     */
    workTimeSegmentId: idRef("work_time_segment_id").references(
      () => workTimeSegments.id,
    ),

    /** Optional payment transaction context for payment-linked payouts. */
    paymentTransactionId: idRef("payment_transaction_id").references(
      () => paymentTransactions.id,
    ),

    /** Optional cross-biz marketplace order context. */
    crossBizOrderId: idRef("cross_biz_order_id").references(() => crossBizOrders.id),

    /** Ledger movement type. */
    entryType: compensationLedgerEntryTypeEnum("entry_type").notNull(),

    /** Signed amount in minor units; never zero. */
    amountMinor: integer("amount_minor").notNull(),

    /** Currency for this movement. */
    currency: varchar("currency", { length: 3 }).default("USD").notNull(),

    /** Event timestamp when this movement happened. */
    occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),

    /** Optional accounting-effective time (can differ from occurred time). */
    effectiveAt: timestamp("effective_at", { withTimezone: true }),

    /** Optional human-readable reason. */
    description: varchar("description", { length: 500 }),

    /** Optional dedupe key for idempotent write workers. */
    idempotencyKey: varchar("idempotency_key", { length: 200 }),

    /** Extension payload (calculator traces, debugging context, etc.). */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite unique key for tenant-safe inclusion joins from pay-run items. */
    compensationLedgerEntriesBizIdIdUnique: uniqueIndex(
      "compensation_ledger_entries_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** Optional dedupe guard for idempotent workers. */
    compensationLedgerEntriesBizIdempotencyUnique: uniqueIndex(
      "compensation_ledger_entries_biz_idempotency_unique",
    )
      .on(table.bizId, table.idempotencyKey)
      .where(sql`"idempotency_key" IS NOT NULL`),

    /** Common per-payee timeline query path. */
    compensationLedgerEntriesBizPayeeOccurredIdx: index(
      "compensation_ledger_entries_biz_payee_occurred_idx",
    ).on(table.bizId, table.payeeResourceId, table.occurredAt),

    /**
     * Accounting-period path for payroll exports/reconciliation.
     *
     * `effective_at` is often used for period close (can differ from occurred
     * time), so it gets a dedicated index for predictable reporting queries.
     */
    compensationLedgerEntriesBizPayeeEffectiveIdx: index(
      "compensation_ledger_entries_biz_payee_effective_idx",
    ).on(table.bizId, table.payeeResourceId, table.effectiveAt),

    /** Common source-booking timeline query path. */
    compensationLedgerEntriesBizBookingOccurredIdx: index(
      "compensation_ledger_entries_biz_booking_occurred_idx",
    ).on(table.bizId, table.bookingOrderId, table.occurredAt),

    /** Tenant-safe FK to payee resource. */
    compensationLedgerEntriesBizPayeeFk: foreignKey({
      columns: [table.bizId, table.payeeResourceId],
      foreignColumns: [resources.bizId, resources.id],
      name: "compensation_ledger_entries_biz_payee_fk",
    }),

    /** Tenant-safe FK to optional role template. */
    compensationLedgerEntriesBizRoleTemplateFk: foreignKey({
      columns: [table.bizId, table.roleTemplateId],
      foreignColumns: [compensationRoleTemplates.bizId, compensationRoleTemplates.id],
      name: "compensation_ledger_entries_biz_role_template_fk",
    }),

    /** Tenant-safe FK to optional assignment-role mapping. */
    compensationLedgerEntriesBizAssignmentRoleFk: foreignKey({
      columns: [table.bizId, table.compensationAssignmentRoleId],
      foreignColumns: [compensationAssignmentRoles.bizId, compensationAssignmentRoles.id],
      name: "compensation_ledger_entries_biz_assignment_role_fk",
    }),

    /** Tenant-safe FK to optional plan version context. */
    compensationLedgerEntriesBizPlanVersionFk: foreignKey({
      columns: [table.bizId, table.compensationPlanVersionId],
      foreignColumns: [compensationPlanVersions.bizId, compensationPlanVersions.id],
      name: "compensation_ledger_entries_biz_plan_version_fk",
    }),

    /** Tenant-safe FK to optional plan rule context. */
    compensationLedgerEntriesBizPlanRuleFk: foreignKey({
      columns: [table.bizId, table.compensationPlanRuleId],
      foreignColumns: [compensationPlanRules.bizId, compensationPlanRules.id],
      name: "compensation_ledger_entries_biz_plan_rule_fk",
    }),

    /** Tenant-safe FK to optional booking order context. */
    compensationLedgerEntriesBizBookingOrderFk: foreignKey({
      columns: [table.bizId, table.bookingOrderId],
      foreignColumns: [bookingOrders.bizId, bookingOrders.id],
      name: "compensation_ledger_entries_biz_booking_order_fk",
    }),

    /** Tenant-safe FK to optional booking line context. */
    compensationLedgerEntriesBizBookingOrderLineFk: foreignKey({
      columns: [table.bizId, table.bookingOrderLineId],
      foreignColumns: [bookingOrderLines.bizId, bookingOrderLines.id],
      name: "compensation_ledger_entries_biz_booking_order_line_fk",
    }),

    /** Tenant-safe FK to optional fulfillment unit context. */
    compensationLedgerEntriesBizFulfillmentUnitFk: foreignKey({
      columns: [table.bizId, table.fulfillmentUnitId],
      foreignColumns: [fulfillmentUnits.bizId, fulfillmentUnits.id],
      name: "compensation_ledger_entries_biz_fulfillment_unit_fk",
    }),

    /** Tenant-safe FK to optional fulfillment assignment context. */
    compensationLedgerEntriesBizFulfillmentAssignmentFk: foreignKey({
      columns: [table.bizId, table.fulfillmentAssignmentId],
      foreignColumns: [fulfillmentAssignments.bizId, fulfillmentAssignments.id],
      name: "compensation_ledger_entries_biz_fulfillment_assignment_fk",
    }),

    /** Tenant-safe FK to optional staffing assignment context. */
    compensationLedgerEntriesBizStaffingAssignmentFk: foreignKey({
      columns: [table.bizId, table.staffingAssignmentId],
      foreignColumns: [staffingAssignments.bizId, staffingAssignments.id],
      name: "compensation_ledger_entries_biz_staffing_assignment_fk",
    }),

    /** Tenant-safe FK to optional work time segment context. */
    compensationLedgerEntriesBizWorkTimeSegmentFk: foreignKey({
      columns: [table.bizId, table.workTimeSegmentId],
      foreignColumns: [workTimeSegments.bizId, workTimeSegments.id],
      name: "compensation_ledger_entries_biz_work_time_segment_fk",
    }),

    /** Tenant-safe FK to optional payment transaction context. */
    compensationLedgerEntriesBizPaymentTransactionFk: foreignKey({
      columns: [table.bizId, table.paymentTransactionId],
      foreignColumns: [paymentTransactions.bizId, paymentTransactions.id],
      name: "compensation_ledger_entries_biz_payment_transaction_fk",
    }),

    /** Tenant-safe FK to optional cross-biz order context. */
    compensationLedgerEntriesBizCrossBizOrderFk: foreignKey({
      columns: [table.bizId, table.crossBizOrderId],
      foreignColumns: [crossBizOrders.bizId, crossBizOrders.id],
      name: "compensation_ledger_entries_biz_cross_biz_order_fk",
    }),

    /** Ledger amounts must never be zero. */
    compensationLedgerEntriesAmountCheck: check(
      "compensation_ledger_entries_amount_check",
      sql`"amount_minor" <> 0`,
    ),

    /** Currency should always use uppercase ISO-like code shape. */
    compensationLedgerEntriesCurrencyFormatCheck: check(
      "compensation_ledger_entries_currency_format_check",
      sql`"currency" ~ '^[A-Z]{3}$'`,
    ),

    /** Effective time cannot precede occurrence when both are present. */
    compensationLedgerEntriesTimelineCheck: check(
      "compensation_ledger_entries_timeline_check",
      sql`"effective_at" IS NULL OR "effective_at" >= "occurred_at"`,
    ),

    /**
     * Require at least one source context unless row is manual adjustment/correction.
     *
     * This keeps operational lineage strong while still allowing explicit manual
     * accounting actions.
     */
    compensationLedgerEntriesContextCheck: check(
      "compensation_ledger_entries_context_check",
      sql`
      (
        "booking_order_id" IS NOT NULL
        OR "booking_order_line_id" IS NOT NULL
        OR "fulfillment_unit_id" IS NOT NULL
        OR "fulfillment_assignment_id" IS NOT NULL
        OR "staffing_assignment_id" IS NOT NULL
        OR "work_time_segment_id" IS NOT NULL
        OR "payment_transaction_id" IS NOT NULL
        OR "cross_biz_order_id" IS NOT NULL
        OR "compensation_assignment_role_id" IS NOT NULL
      )
      OR "entry_type" IN ('adjustment', 'correction')
      `,
    ),
  }),
);

/**
 * compensation_pay_runs
 *
 * ELI5:
 * A pay run is one payroll batch window.
 *
 * Example:
 * - "Weekly payroll, Jan 1 - Jan 7"
 *
 * It groups many ledger entries into payable statements per payee.
 */
export const compensationPayRuns = pgTable(
  "compensation_pay_runs",
  {
    /** Stable primary key. */
    id: idWithTag("comp_pay_run"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Human label for operations/payroll UI. */
    name: varchar("name", { length: 220 }).notNull(),

    /** Batch lifecycle state. */
    status: compensationPayRunStatusEnum("status").default("draft").notNull(),

    /** Payout currency for this run. */
    currency: varchar("currency", { length: 3 }).default("USD").notNull(),

    /** Inclusive start instant for source-ledger selection window. */
    periodStartAt: timestamp("period_start_at", { withTimezone: true }).notNull(),

    /** Exclusive end instant for source-ledger selection window. */
    periodEndAt: timestamp("period_end_at", { withTimezone: true }).notNull(),

    /** Optional planned disbursement instant. */
    scheduledPayAt: timestamp("scheduled_pay_at", { withTimezone: true }),

    /** Optional approver actor for governance. */
    approvedByUserId: idRef("approved_by_user_id").references(() => users.id),

    /** Approval instant. */
    approvedAt: timestamp("approved_at", { withTimezone: true }),

    /** Finalization instant when item set is locked. */
    finalizedAt: timestamp("finalized_at", { withTimezone: true }),

    /** Payment completion instant for the whole run. */
    paidAt: timestamp("paid_at", { withTimezone: true }),

    /** Optional notes for payroll ops. */
    notes: text("notes"),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite unique key for tenant-safe child FKs. */
    compensationPayRunsBizIdIdUnique: uniqueIndex(
      "compensation_pay_runs_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** Main operations dashboard path. */
    compensationPayRunsBizStatusPeriodIdx: index(
      "compensation_pay_runs_biz_status_period_idx",
    ).on(table.bizId, table.status, table.periodStartAt),

    /** Time windows and timeline ordering invariants. */
    compensationPayRunsTimelineCheck: check(
      "compensation_pay_runs_timeline_check",
      sql`
      "period_end_at" > "period_start_at"
      AND ("approved_at" IS NULL OR "approved_at" >= "period_start_at")
      AND ("finalized_at" IS NULL OR "finalized_at" >= "period_start_at")
      AND ("paid_at" IS NULL OR "paid_at" >= "period_start_at")
      `,
    ),

    /** Currency should always use uppercase ISO-like code shape. */
    compensationPayRunsCurrencyFormatCheck: check(
      "compensation_pay_runs_currency_format_check",
      sql`"currency" ~ '^[A-Z]{3}$'`,
    ),
  }),
);

/**
 * compensation_pay_run_items
 *
 * ELI5:
 * One row = one payee statement inside one pay run.
 *
 * This is the rolled-up payable view for a payee after grouping many ledger rows.
 */
export const compensationPayRunItems = pgTable(
  "compensation_pay_run_items",
  {
    /** Stable primary key. */
    id: idWithTag("comp_pay_item"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent payroll batch. */
    compensationPayRunId: idRef("compensation_pay_run_id")
      .references(() => compensationPayRuns.id)
      .notNull(),

    /** Payee resource receiving this statement amount. */
    payeeResourceId: idRef("payee_resource_id")
      .references(() => resources.id)
      .notNull(),

    /** Item lifecycle for approval/withholding/disbursement flow. */
    status: compensationPayRunItemStatusEnum("status")
      .default("pending")
      .notNull(),

    /** Currency for this statement. */
    currency: varchar("currency", { length: 3 }).default("USD").notNull(),

    /** Sum of accrual ledger movements included. */
    accrualMinor: integer("accrual_minor").default(0).notNull(),

    /** Net sum of adjustments included (can be negative). */
    adjustmentMinor: integer("adjustment_minor").default(0).notNull(),

    /** Sum of deductions/withholds included. */
    deductionMinor: integer("deduction_minor").default(0).notNull(),

    /** Final payable net amount for this statement. */
    netMinor: integer("net_minor").default(0).notNull(),

    /** Number of source ledger rows included in this statement. */
    entryCount: integer("entry_count").default(0).notNull(),

    /** Optional payout row when disbursement is executed. */
    payoutId: idRef("payout_id").references(() => payouts.id),

    /** Snapshot of destination account identifier used for payout. */
    payoutDestinationRef: varchar("payout_destination_ref", { length: 200 }),

    /** Paid timestamp for this payee statement. */
    paidAt: timestamp("paid_at", { withTimezone: true }),

    /** Optional operator notes for exceptions/withholds. */
    notes: text("notes"),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite unique key for tenant-safe inclusion table FKs. */
    compensationPayRunItemsBizIdIdUnique: uniqueIndex(
      "compensation_pay_run_items_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** One statement per payee per pay run. */
    compensationPayRunItemsRunPayeeUnique: uniqueIndex(
      "compensation_pay_run_items_run_payee_unique",
    ).on(table.compensationPayRunId, table.payeeResourceId),

    /** Main payroll operations path. */
    compensationPayRunItemsBizRunStatusIdx: index(
      "compensation_pay_run_items_biz_run_status_idx",
    ).on(table.bizId, table.compensationPayRunId, table.status),

    /** Common payee history query path. */
    compensationPayRunItemsBizPayeePaidIdx: index(
      "compensation_pay_run_items_biz_payee_paid_idx",
    ).on(table.bizId, table.payeeResourceId, table.paidAt),

    /** Tenant-safe FK to parent pay run. */
    compensationPayRunItemsBizPayRunFk: foreignKey({
      columns: [table.bizId, table.compensationPayRunId],
      foreignColumns: [compensationPayRuns.bizId, compensationPayRuns.id],
      name: "compensation_pay_run_items_biz_pay_run_fk",
    }),

    /** Tenant-safe FK to payee resource. */
    compensationPayRunItemsBizPayeeFk: foreignKey({
      columns: [table.bizId, table.payeeResourceId],
      foreignColumns: [resources.bizId, resources.id],
      name: "compensation_pay_run_items_biz_payee_fk",
    }),

    /** Tenant-safe FK to optional payout row. */
    compensationPayRunItemsBizPayoutFk: foreignKey({
      columns: [table.bizId, table.payoutId],
      foreignColumns: [payouts.bizId, payouts.id],
      name: "compensation_pay_run_items_biz_payout_fk",
    }),

    /** Arithmetic and bounds invariants. */
    compensationPayRunItemsAmountsCheck: check(
      "compensation_pay_run_items_amounts_check",
      sql`
      "accrual_minor" >= 0
      AND "deduction_minor" >= 0
      AND "entry_count" >= 0
      AND "net_minor" = ("accrual_minor" + "adjustment_minor" - "deduction_minor")
      `,
    ),

    /** Currency should always use uppercase ISO-like code shape. */
    compensationPayRunItemsCurrencyFormatCheck: check(
      "compensation_pay_run_items_currency_format_check",
      sql`"currency" ~ '^[A-Z]{3}$'`,
    ),
  }),
);

/**
 * compensation_pay_run_item_entries
 *
 * ELI5:
 * This join table records exactly which ledger rows were included in which
 * pay-run item and for what amount.
 *
 * Why this is important:
 * - Full traceability from payroll statement back to atomic ledger facts.
 * - Safe re-runs and audits (you can prove inclusion/exclusion deterministically).
 */
export const compensationPayRunItemEntries = pgTable(
  "compensation_pay_run_item_entries",
  {
    /** Stable primary key. */
    id: idWithTag("comp_pay_item_entry"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent pay-run item statement. */
    compensationPayRunItemId: idRef("compensation_pay_run_item_id")
      .references(() => compensationPayRunItems.id)
      .notNull(),

    /** Source compensation ledger row included in statement. */
    compensationLedgerEntryId: idRef("compensation_ledger_entry_id")
      .references(() => compensationLedgerEntries.id)
      .notNull(),

    /** Signed amount from this ledger row included in this statement. */
    includedAmountMinor: integer("included_amount_minor").notNull(),

    /** Extension payload (split details, worker trace ids, etc.). */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    compensationPayRunItemEntriesBizIdIdUnique: uniqueIndex("compensation_pay_run_item_entries_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Prevent duplicate inclusion of same ledger row in same statement. */
    compensationPayRunItemEntriesUnique: uniqueIndex(
      "compensation_pay_run_item_entries_unique",
    ).on(table.compensationPayRunItemId, table.compensationLedgerEntryId),

    /** Query path for statement detail rendering. */
    compensationPayRunItemEntriesBizItemIdx: index(
      "compensation_pay_run_item_entries_biz_item_idx",
    ).on(table.bizId, table.compensationPayRunItemId),

    /** Query path for reverse lineage from ledger row to payroll statements. */
    compensationPayRunItemEntriesBizLedgerIdx: index(
      "compensation_pay_run_item_entries_biz_ledger_idx",
    ).on(table.bizId, table.compensationLedgerEntryId),

    /** Tenant-safe FK to statement item. */
    compensationPayRunItemEntriesBizItemFk: foreignKey({
      columns: [table.bizId, table.compensationPayRunItemId],
      foreignColumns: [compensationPayRunItems.bizId, compensationPayRunItems.id],
      name: "compensation_pay_run_item_entries_biz_item_fk",
    }),

    /** Tenant-safe FK to source ledger entry. */
    compensationPayRunItemEntriesBizLedgerFk: foreignKey({
      columns: [table.bizId, table.compensationLedgerEntryId],
      foreignColumns: [compensationLedgerEntries.bizId, compensationLedgerEntries.id],
      name: "compensation_pay_run_item_entries_biz_ledger_fk",
    }),

    /** Included amount should not be zero for meaningful lineage. */
    compensationPayRunItemEntriesAmountCheck: check(
      "compensation_pay_run_item_entries_amount_check",
      sql`"included_amount_minor" <> 0`,
    ),
  }),
);
