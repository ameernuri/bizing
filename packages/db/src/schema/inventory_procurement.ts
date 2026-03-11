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
import { actionRequests } from "./action_backbone";
import { bizes } from "./bizes";
import { domainEvents } from "./domain_events";
import {
  lifecycleStatusEnum,
  procurementOrderLineStatusEnum,
  procurementOrderStatusEnum,
  receiptBatchStatusEnum,
  replenishmentPolicyModeEnum,
  replenishmentRunStatusEnum,
  replenishmentSuggestionStatusEnum,
  supplyPartnerTypeEnum,
} from "./enums";
import {
  inventoryItems,
  inventoryLocations,
  inventoryMovements,
} from "./product_commerce";
import { debugSnapshots, projectionDocuments } from "./projections";
import { subjects } from "./subjects";
import { users } from "./users";

/**
 * supply_partners
 *
 * ELI5:
 * Procurement counterparty directory shared across inventory, replenishment,
 * receiving, and cost policies.
 */
export const supplyPartners = pgTable(
  "supply_partners",
  {
    /** Stable primary key. */
    id: idWithTag("supply_partner"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Counterparty class (supplier/manufacturer/3PL/internal/etc.). */
    partnerType: supplyPartnerTypeEnum("partner_type").notNull(),

    /** Lifecycle status for this partner contract row. */
    status: lifecycleStatusEnum("status").default("draft").notNull(),

    /** Human-readable counterparty name. */
    name: varchar("name", { length: 220 }).notNull(),

    /** Stable slug for APIs/imports. */
    slug: varchar("slug", { length: 140 }).notNull(),

    /** Optional legal entity name used for documents. */
    legalName: varchar("legal_name", { length: 260 }),

    /** Optional default lead time for planning. */
    defaultLeadTimeDays: integer("default_lead_time_days").default(0).notNull(),

    /** Generic order/fulfillment policy payload. */
    orderingPolicy: jsonb("ordering_policy").default({}).notNull(),

    /** Contact and address snapshot for this partner. */
    contactSnapshot: jsonb("contact_snapshot").default({}).notNull(),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    supplyPartnersBizIdIdUnique: uniqueIndex("supply_partners_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),

    supplyPartnersBizSlugUnique: uniqueIndex("supply_partners_biz_slug_unique").on(
      table.bizId,
      table.slug,
    ),

    supplyPartnersBizTypeStatusIdx: index("supply_partners_biz_type_status_idx").on(
      table.bizId,
      table.partnerType,
      table.status,
    ),

    supplyPartnersLeadTimeCheck: check(
      "supply_partners_lead_time_check",
      sql`"default_lead_time_days" >= 0`,
    ),
  }),
);

/**
 * supply_partner_catalog_items
 *
 * ELI5:
 * Partner-specific sourcing rows that map one counterparty SKU/cost profile to
 * one canonical business subject (usually product/sellable).
 */
export const supplyPartnerCatalogItems = pgTable(
  "supply_partner_catalog_items",
  {
    /** Stable primary key. */
    id: idWithTag("supply_catalog"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Counterparty this catalog row belongs to. */
    supplyPartnerId: idRef("supply_partner_id")
      .references(() => supplyPartners.id)
      .notNull(),

    /** Canonical target subject class. */
    targetSubjectType: varchar("target_subject_type", { length: 80 }).notNull(),

    /** Canonical target subject id. */
    targetSubjectId: varchar("target_subject_id", { length: 140 }).notNull(),

    /** Partner-facing SKU/code for ordering. */
    partnerSku: varchar("partner_sku", { length: 180 }).notNull(),

    /** Lifecycle state for this sourcing option. */
    status: lifecycleStatusEnum("status").default("active").notNull(),

    /** Currency for unit-cost economics. */
    currency: varchar("currency", { length: 3 }).default("USD").notNull(),

    /** Unit cost in minor units. */
    unitCostMinor: integer("unit_cost_minor").default(0).notNull(),

    /** Minimum purchasable quantity. */
    minOrderQty: integer("min_order_qty").default(1).notNull(),

    /** Quantity increment for orders (e.g., case pack size). */
    orderIncrementQty: integer("order_increment_qty").default(1).notNull(),

    /** Optional lead-time override for this SKU. */
    leadTimeDays: integer("lead_time_days"),

    /** Preferred sourcing hint for planners. */
    isPreferred: boolean("is_preferred").default(false).notNull(),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    supplyPartnerCatalogItemsBizIdIdUnique: uniqueIndex(
      "supply_partner_catalog_items_biz_id_id_unique",
    ).on(table.bizId, table.id),

    supplyPartnerCatalogItemsPartnerSkuUnique: uniqueIndex(
      "supply_partner_catalog_items_partner_sku_unique",
    ).on(table.bizId, table.supplyPartnerId, table.partnerSku),

    supplyPartnerCatalogItemsPartnerStatusIdx: index(
      "supply_partner_catalog_items_partner_status_idx",
    ).on(table.bizId, table.supplyPartnerId, table.status, table.isPreferred),

    supplyPartnerCatalogItemsTargetIdx: index(
      "supply_partner_catalog_items_target_idx",
    ).on(table.bizId, table.targetSubjectType, table.targetSubjectId, table.status),

    supplyPartnerCatalogItemsBizPartnerFk: foreignKey({
      columns: [table.bizId, table.supplyPartnerId],
      foreignColumns: [supplyPartners.bizId, supplyPartners.id],
      name: "supply_partner_catalog_items_biz_partner_fk",
    }),

    supplyPartnerCatalogItemsBizTargetSubjectFk: foreignKey({
      columns: [table.bizId, table.targetSubjectType, table.targetSubjectId],
      foreignColumns: [subjects.bizId, subjects.subjectType, subjects.subjectId],
      name: "supply_partner_catalog_items_biz_target_subject_fk",
    }),

    supplyPartnerCatalogItemsBoundsCheck: check(
      "supply_partner_catalog_items_bounds_check",
      sql`
      "unit_cost_minor" >= 0
      AND "min_order_qty" >= 1
      AND "order_increment_qty" >= 1
      AND ("lead_time_days" IS NULL OR "lead_time_days" >= 0)
      `,
    ),

    supplyPartnerCatalogItemsCurrencyFormatCheck: check(
      "supply_partner_catalog_items_currency_format_check",
      sql`"currency" ~ '^[A-Z]{3}$'`,
    ),
  }),
);

/**
 * inventory_replenishment_policies
 *
 * ELI5:
 * Policy rows define how one inventory item should be replenished.
 */
export const inventoryReplenishmentPolicies = pgTable(
  "inventory_replenishment_policies",
  {
    /** Stable primary key. */
    id: idWithTag("replen_policy"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Inventory item governed by this policy. */
    inventoryItemId: idRef("inventory_item_id")
      .references(() => inventoryItems.id)
      .notNull(),

    /** Replenishment strategy shape. */
    policyMode: replenishmentPolicyModeEnum("policy_mode")
      .default("min_max")
      .notNull(),

    /** Lifecycle state for this policy. */
    status: lifecycleStatusEnum("status").default("active").notNull(),

    /** Optional preferred source partner. */
    preferredSupplyPartnerId: idRef("preferred_supply_partner_id").references(
      () => supplyPartners.id,
    ),

    /** Priority where lower values win during policy selection. */
    policyPriority: integer("policy_priority").default(100).notNull(),

    /** Evaluation cadence for scheduled planning workers. */
    reviewCadenceMinutes: integer("review_cadence_minutes").default(1440).notNull(),

    /** Min-max reorder point threshold. */
    reorderPointQty: integer("reorder_point_qty"),

    /** Min-max target quantity. */
    reorderTargetQty: integer("reorder_target_qty"),

    /** Safety stock buffer quantity. */
    safetyStockQty: integer("safety_stock_qty").default(0).notNull(),

    /** Days-of-cover target when policy mode is cover-based. */
    daysOfCover: integer("days_of_cover"),

    /** If true, accepted suggestions may auto-create draft procurement orders. */
    allowAutoDraftOrders: boolean("allow_auto_draft_orders")
      .default(false)
      .notNull(),

    /** Structured planner/evaluator settings. */
    policy: jsonb("policy").default({}).notNull(),

    /** Last successful evaluation timestamp. */
    lastEvaluatedAt: timestamp("last_evaluated_at", { withTimezone: true }),

    /** Canonical action linked to policy update. */
    actionRequestId: idRef("action_request_id").references(() => actionRequests.id),

    /** Latest event explaining policy state. */
    latestDomainEventId: idRef("latest_domain_event_id").references(
      () => domainEvents.id,
    ),

    /** Optional policy projection document. */
    projectionDocumentId: idRef("projection_document_id").references(
      () => projectionDocuments.id,
    ),

    /** Optional debug payload. */
    debugSnapshotId: idRef("debug_snapshot_id").references(() => debugSnapshots.id),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    inventoryReplenishmentPoliciesBizIdIdUnique: uniqueIndex(
      "inventory_replenishment_policies_biz_id_id_unique",
    ).on(table.bizId, table.id),

    inventoryReplenishmentPoliciesActivePerItemUnique: uniqueIndex(
      "inventory_replenishment_policies_active_per_item_unique",
    )
      .on(table.bizId, table.inventoryItemId)
      .where(sql`"status" = 'active' AND "deleted_at" IS NULL`),

    inventoryReplenishmentPoliciesBizModeStatusPriorityIdx: index(
      "inventory_replenishment_policies_biz_mode_status_priority_idx",
    ).on(table.bizId, table.policyMode, table.status, table.policyPriority),

    inventoryReplenishmentPoliciesActionRequestIdx: index(
      "inventory_replenishment_policies_action_request_idx",
    ).on(table.actionRequestId),

    inventoryReplenishmentPoliciesBizInventoryItemFk: foreignKey({
      columns: [table.bizId, table.inventoryItemId],
      foreignColumns: [inventoryItems.bizId, inventoryItems.id],
      name: "inventory_replenishment_policies_biz_inventory_item_fk",
    }),

    inventoryReplenishmentPoliciesBizPreferredPartnerFk: foreignKey({
      columns: [table.bizId, table.preferredSupplyPartnerId],
      foreignColumns: [supplyPartners.bizId, supplyPartners.id],
      name: "inventory_replenishment_policies_biz_preferred_partner_fk",
    }),

    inventoryReplenishmentPoliciesBoundsCheck: check(
      "inventory_replenishment_policies_bounds_check",
      sql`
      "policy_priority" >= 0
      AND "review_cadence_minutes" > 0
      AND "safety_stock_qty" >= 0
      AND ("reorder_point_qty" IS NULL OR "reorder_point_qty" >= 0)
      AND ("reorder_target_qty" IS NULL OR "reorder_target_qty" >= 0)
      AND ("days_of_cover" IS NULL OR "days_of_cover" > 0)
      AND (
        "reorder_target_qty" IS NULL
        OR "reorder_point_qty" IS NULL
        OR "reorder_target_qty" >= "reorder_point_qty"
      )
      `,
    ),

    inventoryReplenishmentPoliciesModeShapeCheck: check(
      "inventory_replenishment_policies_mode_shape_check",
      sql`
      (
        "policy_mode" = 'min_max'
        AND "reorder_point_qty" IS NOT NULL
        AND "reorder_target_qty" IS NOT NULL
      ) OR (
        "policy_mode" = 'days_of_cover'
        AND "days_of_cover" IS NOT NULL
      ) OR (
        "policy_mode" IN ('event_driven', 'manual')
      )
      `,
    ),
  }),
);

/**
 * inventory_replenishment_runs
 *
 * ELI5:
 * One run captures a deterministic planning pass that generated replenishment
 * suggestions.
 */
export const inventoryReplenishmentRuns = pgTable(
  "inventory_replenishment_runs",
  {
    /** Stable primary key. */
    id: idWithTag("replen_run"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Run lifecycle. */
    status: replenishmentRunStatusEnum("status").default("pending").notNull(),

    /** Trigger source class for this run. */
    triggerType: varchar("trigger_type", { length: 60 }).default("schedule").notNull(),

    /** Optional actor when run was manually initiated. */
    triggeredByUserId: idRef("triggered_by_user_id").references(() => users.id),

    /** Evaluation window start. */
    windowStartsAt: timestamp("window_starts_at", { withTimezone: true }).notNull(),

    /** Evaluation window end. */
    windowEndsAt: timestamp("window_ends_at", { withTimezone: true }).notNull(),

    /** Execution start timestamp. */
    startedAt: timestamp("started_at", { withTimezone: true }),

    /** Execution completion timestamp. */
    completedAt: timestamp("completed_at", { withTimezone: true }),

    /** Number of generated suggestions in this run. */
    suggestionCount: integer("suggestion_count").default(0).notNull(),

    /** Number of accepted suggestions. */
    acceptedCount: integer("accepted_count").default(0).notNull(),

    /** Number of procurement draft orders generated from this run. */
    draftOrderCount: integer("draft_order_count").default(0).notNull(),

    /** Structured planner summary payload. */
    summary: jsonb("summary").default({}).notNull(),

    /** Canonical action for the run trigger. */
    actionRequestId: idRef("action_request_id").references(() => actionRequests.id),

    /** Latest event associated with this run. */
    latestDomainEventId: idRef("latest_domain_event_id").references(
      () => domainEvents.id,
    ),

    /** Projection row used by planner dashboards. */
    projectionDocumentId: idRef("projection_document_id").references(
      () => projectionDocuments.id,
    ),

    /** Debug payload for run failures/anomalies. */
    debugSnapshotId: idRef("debug_snapshot_id").references(() => debugSnapshots.id),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    inventoryReplenishmentRunsBizIdIdUnique: uniqueIndex(
      "inventory_replenishment_runs_biz_id_id_unique",
    ).on(table.bizId, table.id),

    inventoryReplenishmentRunsBizStatusStartedIdx: index(
      "inventory_replenishment_runs_biz_status_started_idx",
    ).on(table.bizId, table.status, table.startedAt),

    inventoryReplenishmentRunsWindowIdx: index(
      "inventory_replenishment_runs_window_idx",
    ).on(table.bizId, table.windowStartsAt, table.windowEndsAt),

    inventoryReplenishmentRunsActionRequestIdx: index(
      "inventory_replenishment_runs_action_request_idx",
    ).on(table.actionRequestId),

    inventoryReplenishmentRunsBizActionRequestFk: foreignKey({
      columns: [table.bizId, table.actionRequestId],
      foreignColumns: [actionRequests.bizId, actionRequests.id],
      name: "inventory_replenishment_runs_biz_action_request_fk",
    }),

    inventoryReplenishmentRunsBoundsCheck: check(
      "inventory_replenishment_runs_bounds_check",
      sql`
      "window_ends_at" > "window_starts_at"
      AND "suggestion_count" >= 0
      AND "accepted_count" >= 0
      AND "draft_order_count" >= 0
      AND ("completed_at" IS NULL OR "started_at" IS NULL OR "completed_at" >= "started_at")
      `,
    ),

    inventoryReplenishmentRunsTriggerTypeCheck: check(
      "inventory_replenishment_runs_trigger_type_check",
      sql`
      "trigger_type" IN ('schedule', 'manual', 'event', 'api')
      OR "trigger_type" LIKE 'custom_%'
      `,
    ),
  }),
);

/**
 * inventory_procurement_orders
 *
 * ELI5:
 * Canonical stock-procurement order shell (separate from AR purchase orders).
 */
export const inventoryProcurementOrders = pgTable(
  "inventory_procurement_orders",
  {
    /** Stable primary key. */
    id: idWithTag("inv_proc_order"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Counterparty receiving this order. */
    supplyPartnerId: idRef("supply_partner_id")
      .references(() => supplyPartners.id)
      .notNull(),

    /** Order lifecycle status. */
    status: procurementOrderStatusEnum("status").default("draft").notNull(),

    /** Stable order number for external communication. */
    orderNumber: varchar("order_number", { length: 160 }).notNull(),

    /** Currency for order amounts. */
    currency: varchar("currency", { length: 3 }).default("USD").notNull(),

    /** Optional source replenishment run. */
    inventoryReplenishmentRunId: idRef("inventory_replenishment_run_id").references(
      () => inventoryReplenishmentRuns.id,
    ),

    /** Ordered total in minor units. */
    orderedTotalMinor: integer("ordered_total_minor").default(0).notNull(),

    /** Received total in minor units. */
    receivedTotalMinor: integer("received_total_minor").default(0).notNull(),

    /** Invoiced total in minor units. */
    invoicedTotalMinor: integer("invoiced_total_minor").default(0).notNull(),

    /** Draft/create timestamp. */
    orderedAt: timestamp("ordered_at", { withTimezone: true }),

    /** Submit timestamp for partner dispatch. */
    submittedAt: timestamp("submitted_at", { withTimezone: true }),

    /** Partner acknowledgement timestamp. */
    acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),

    /** Expected fulfillment date. */
    expectedByAt: timestamp("expected_by_at", { withTimezone: true }),

    /** Closure timestamp. */
    closedAt: timestamp("closed_at", { withTimezone: true }),

    /** Cancellation timestamp. */
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),

    /** Optional operator note. */
    notes: text("notes"),

    /** Canonical action behind this order state. */
    actionRequestId: idRef("action_request_id").references(() => actionRequests.id),

    /** Latest event associated with this order. */
    latestDomainEventId: idRef("latest_domain_event_id").references(
      () => domainEvents.id,
    ),

    /** Optional projection row for procurement board rendering. */
    projectionDocumentId: idRef("projection_document_id").references(
      () => projectionDocuments.id,
    ),

    /** Debug payload for procurement issues. */
    debugSnapshotId: idRef("debug_snapshot_id").references(() => debugSnapshots.id),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    inventoryProcurementOrdersBizIdIdUnique: uniqueIndex(
      "inventory_procurement_orders_biz_id_id_unique",
    ).on(table.bizId, table.id),

    inventoryProcurementOrdersBizOrderNumberUnique: uniqueIndex(
      "inventory_procurement_orders_biz_order_number_unique",
    ).on(table.bizId, table.orderNumber),

    inventoryProcurementOrdersBizStatusExpectedIdx: index(
      "inventory_procurement_orders_biz_status_expected_idx",
    ).on(table.bizId, table.status, table.expectedByAt),

    inventoryProcurementOrdersActionRequestIdx: index(
      "inventory_procurement_orders_action_request_idx",
    ).on(table.actionRequestId),

    inventoryProcurementOrdersBizPartnerFk: foreignKey({
      columns: [table.bizId, table.supplyPartnerId],
      foreignColumns: [supplyPartners.bizId, supplyPartners.id],
      name: "inventory_procurement_orders_biz_partner_fk",
    }),

    inventoryProcurementOrdersBizRunFk: foreignKey({
      columns: [table.bizId, table.inventoryReplenishmentRunId],
      foreignColumns: [inventoryReplenishmentRuns.bizId, inventoryReplenishmentRuns.id],
      name: "inventory_procurement_orders_biz_replenishment_run_fk",
    }),

    inventoryProcurementOrdersAmountsCheck: check(
      "inventory_procurement_orders_amounts_check",
      sql`
      "ordered_total_minor" >= 0
      AND "received_total_minor" >= 0
      AND "invoiced_total_minor" >= 0
      `,
    ),

    inventoryProcurementOrdersTimelineCheck: check(
      "inventory_procurement_orders_timeline_check",
      sql`
      ("submitted_at" IS NULL OR "ordered_at" IS NULL OR "submitted_at" >= "ordered_at")
      AND ("acknowledged_at" IS NULL OR "submitted_at" IS NULL OR "acknowledged_at" >= "submitted_at")
      AND ("closed_at" IS NULL OR "ordered_at" IS NULL OR "closed_at" >= "ordered_at")
      AND ("cancelled_at" IS NULL OR "ordered_at" IS NULL OR "cancelled_at" >= "ordered_at")
      `,
    ),

    inventoryProcurementOrdersCurrencyFormatCheck: check(
      "inventory_procurement_orders_currency_format_check",
      sql`"currency" ~ '^[A-Z]{3}$'`,
    ),
  }),
);

/**
 * inventory_procurement_order_lines
 *
 * ELI5:
 * Line-level sourcing and quantity facts for one inventory procurement order.
 */
export const inventoryProcurementOrderLines = pgTable(
  "inventory_procurement_order_lines",
  {
    /** Stable primary key. */
    id: idWithTag("inv_proc_line"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent procurement order. */
    inventoryProcurementOrderId: idRef("inventory_procurement_order_id")
      .references(() => inventoryProcurementOrders.id)
      .notNull(),

    /** Optional stock item target. */
    inventoryItemId: idRef("inventory_item_id").references(() => inventoryItems.id),

    /** Optional sourcing-catalog pointer. */
    supplyPartnerCatalogItemId: idRef("supply_partner_catalog_item_id").references(
      () => supplyPartnerCatalogItems.id,
    ),

    /** Optional generic target subject type (when not bound to inventory item). */
    targetSubjectType: varchar("target_subject_type", { length: 80 }),

    /** Optional generic target subject id (when not bound to inventory item). */
    targetSubjectId: varchar("target_subject_id", { length: 140 }),

    /** Line status lifecycle. */
    status: procurementOrderLineStatusEnum("status").default("open").notNull(),

    /** Deterministic line number inside one order. */
    lineNumber: integer("line_number").default(1).notNull(),

    /** Optional line title/description. */
    description: text("description"),

    /** Ordered quantity. */
    quantityOrdered: integer("quantity_ordered").notNull(),

    /** Received quantity. */
    quantityReceived: integer("quantity_received").default(0).notNull(),

    /** Unit cost in minor units. */
    unitCostMinor: integer("unit_cost_minor").default(0).notNull(),

    /** Currency for this line. */
    currency: varchar("currency", { length: 3 }).default("USD").notNull(),

    /** Line total in minor units. */
    lineTotalMinor: integer("line_total_minor").default(0).notNull(),

    /** Optional expected delivery date for this specific line. */
    expectedByAt: timestamp("expected_by_at", { withTimezone: true }),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    inventoryProcurementOrderLinesBizIdIdUnique: uniqueIndex(
      "inventory_procurement_order_lines_biz_id_id_unique",
    ).on(table.bizId, table.id),

    inventoryProcurementOrderLinesOrderLineNumberUnique: uniqueIndex(
      "inventory_procurement_order_lines_order_line_number_unique",
    ).on(table.inventoryProcurementOrderId, table.lineNumber),

    inventoryProcurementOrderLinesBizOrderStatusIdx: index(
      "inventory_procurement_order_lines_biz_order_status_idx",
    ).on(table.bizId, table.inventoryProcurementOrderId, table.status),

    inventoryProcurementOrderLinesBizOrderFk: foreignKey({
      columns: [table.bizId, table.inventoryProcurementOrderId],
      foreignColumns: [inventoryProcurementOrders.bizId, inventoryProcurementOrders.id],
      name: "inventory_procurement_order_lines_biz_order_fk",
    }),

    inventoryProcurementOrderLinesBizInventoryItemFk: foreignKey({
      columns: [table.bizId, table.inventoryItemId],
      foreignColumns: [inventoryItems.bizId, inventoryItems.id],
      name: "inventory_procurement_order_lines_biz_inventory_item_fk",
    }),

    inventoryProcurementOrderLinesBizCatalogItemFk: foreignKey({
      columns: [table.bizId, table.supplyPartnerCatalogItemId],
      foreignColumns: [supplyPartnerCatalogItems.bizId, supplyPartnerCatalogItems.id],
      name: "inventory_procurement_order_lines_biz_catalog_item_fk",
    }),

    inventoryProcurementOrderLinesBizTargetSubjectFk: foreignKey({
      columns: [table.bizId, table.targetSubjectType, table.targetSubjectId],
      foreignColumns: [subjects.bizId, subjects.subjectType, subjects.subjectId],
      name: "inventory_procurement_order_lines_biz_target_subject_fk",
    }),

    inventoryProcurementOrderLinesBoundsCheck: check(
      "inventory_procurement_order_lines_bounds_check",
      sql`
      "line_number" >= 1
      AND "quantity_ordered" > 0
      AND "quantity_received" >= 0
      AND "quantity_received" <= "quantity_ordered"
      AND "unit_cost_minor" >= 0
      AND "line_total_minor" >= 0
      `,
    ),

    inventoryProcurementOrderLinesTargetShapeCheck: check(
      "inventory_procurement_order_lines_target_shape_check",
      sql`
      (
        "inventory_item_id" IS NOT NULL
      ) OR (
        "target_subject_type" IS NOT NULL
        AND "target_subject_id" IS NOT NULL
      )
      `,
    ),

    inventoryProcurementOrderLinesCurrencyFormatCheck: check(
      "inventory_procurement_order_lines_currency_format_check",
      sql`"currency" ~ '^[A-Z]{3}$'`,
    ),
  }),
);

/**
 * inventory_replenishment_suggestions
 *
 * ELI5:
 * Deterministic recommendation rows generated by replenishment runs.
 */
export const inventoryReplenishmentSuggestions = pgTable(
  "inventory_replenishment_suggestions",
  {
    /** Stable primary key. */
    id: idWithTag("replen_suggestion"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent run that produced this suggestion. */
    inventoryReplenishmentRunId: idRef("inventory_replenishment_run_id")
      .references(() => inventoryReplenishmentRuns.id)
      .notNull(),

    /** Optional source policy that generated this suggestion. */
    inventoryReplenishmentPolicyId: idRef("inventory_replenishment_policy_id").references(
      () => inventoryReplenishmentPolicies.id,
    ),

    /** Target inventory item to replenish. */
    inventoryItemId: idRef("inventory_item_id")
      .references(() => inventoryItems.id)
      .notNull(),

    /** Optional selected partner recommendation. */
    supplyPartnerId: idRef("supply_partner_id").references(() => supplyPartners.id),

    /** Suggestion decision lifecycle. */
    status: replenishmentSuggestionStatusEnum("status").default("proposed").notNull(),

    /** Priority hint for planner queues. */
    priorityScore: integer("priority_score").default(100).notNull(),

    /** Suggested quantity. */
    quantitySuggested: integer("quantity_suggested").notNull(),

    /** Accepted quantity after operator decision. */
    quantityAccepted: integer("quantity_accepted"),

    /** Optional link to generated procurement order. */
    inventoryProcurementOrderId: idRef("inventory_procurement_order_id").references(
      () => inventoryProcurementOrders.id,
    ),

    /** Optional expiry for stale recommendations. */
    expiresAt: timestamp("expires_at", { withTimezone: true }),

    /** Decision timestamp. */
    decidedAt: timestamp("decided_at", { withTimezone: true }),

    /** Decision actor. */
    decidedByUserId: idRef("decided_by_user_id").references(() => users.id),

    /** Structured explanation payload. */
    rationale: jsonb("rationale").default({}).notNull(),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    inventoryReplenishmentSuggestionsBizIdIdUnique: uniqueIndex(
      "inventory_replenishment_suggestions_biz_id_id_unique",
    ).on(table.bizId, table.id),

    inventoryReplenishmentSuggestionsRunStatusPriorityIdx: index(
      "inventory_replenishment_suggestions_run_status_priority_idx",
    ).on(
      table.bizId,
      table.inventoryReplenishmentRunId,
      table.status,
      table.priorityScore,
    ),

    inventoryReplenishmentSuggestionsItemStatusIdx: index(
      "inventory_replenishment_suggestions_item_status_idx",
    ).on(table.bizId, table.inventoryItemId, table.status),

    inventoryReplenishmentSuggestionsBizRunFk: foreignKey({
      columns: [table.bizId, table.inventoryReplenishmentRunId],
      foreignColumns: [inventoryReplenishmentRuns.bizId, inventoryReplenishmentRuns.id],
      name: "inventory_replenishment_suggestions_biz_run_fk",
    }),

    inventoryReplenishmentSuggestionsBizPolicyFk: foreignKey({
      columns: [table.bizId, table.inventoryReplenishmentPolicyId],
      foreignColumns: [
        inventoryReplenishmentPolicies.bizId,
        inventoryReplenishmentPolicies.id,
      ],
      name: "inventory_replenishment_suggestions_biz_policy_fk",
    }),

    inventoryReplenishmentSuggestionsBizItemFk: foreignKey({
      columns: [table.bizId, table.inventoryItemId],
      foreignColumns: [inventoryItems.bizId, inventoryItems.id],
      name: "inventory_replenishment_suggestions_biz_item_fk",
    }),

    inventoryReplenishmentSuggestionsBizPartnerFk: foreignKey({
      columns: [table.bizId, table.supplyPartnerId],
      foreignColumns: [supplyPartners.bizId, supplyPartners.id],
      name: "inventory_replenishment_suggestions_biz_partner_fk",
    }),

    inventoryReplenishmentSuggestionsBizOrderFk: foreignKey({
      columns: [table.bizId, table.inventoryProcurementOrderId],
      foreignColumns: [inventoryProcurementOrders.bizId, inventoryProcurementOrders.id],
      name: "inventory_replenishment_suggestions_biz_order_fk",
    }),

    inventoryReplenishmentSuggestionsBoundsCheck: check(
      "inventory_replenishment_suggestions_bounds_check",
      sql`
      "priority_score" >= 0
      AND "quantity_suggested" > 0
      AND ("quantity_accepted" IS NULL OR "quantity_accepted" >= 0)
      AND (
        "quantity_accepted" IS NULL
        OR "quantity_accepted" <= "quantity_suggested"
      )
      AND ("decided_at" IS NULL OR "decided_at" >= "created_at")
      `,
    ),
  }),
);

/**
 * inventory_receipt_batches
 *
 * ELI5:
 * One inbound receiving execution batch for stock intake.
 */
export const inventoryReceiptBatches = pgTable(
  "inventory_receipt_batches",
  {
    /** Stable primary key. */
    id: idWithTag("receipt_batch"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Optional source procurement order. */
    inventoryProcurementOrderId: idRef("inventory_procurement_order_id").references(
      () => inventoryProcurementOrders.id,
    ),

    /** Optional source partner when receipt is not tied to a specific order. */
    supplyPartnerId: idRef("supply_partner_id").references(() => supplyPartners.id),

    /** Optional receiving stock location. */
    inventoryLocationId: idRef("inventory_location_id").references(
      () => inventoryLocations.id,
    ),

    /** Receipt lifecycle status. */
    status: receiptBatchStatusEnum("status").default("draft").notNull(),

    /** Physical receive timestamp. */
    receivedAt: timestamp("received_at", { withTimezone: true }).defaultNow().notNull(),

    /** Processing completion timestamp. */
    processedAt: timestamp("processed_at", { withTimezone: true }),

    /** Receiver actor. */
    receivedByUserId: idRef("received_by_user_id").references(() => users.id),

    /** Optional external reference (bill of lading, ASN, etc.). */
    sourceDocumentRef: varchar("source_document_ref", { length: 180 }),

    /** Optional operator note. */
    notes: text("notes"),

    /** Canonical action backing this receipt. */
    actionRequestId: idRef("action_request_id").references(() => actionRequests.id),

    /** Latest event tied to this receipt batch. */
    latestDomainEventId: idRef("latest_domain_event_id").references(
      () => domainEvents.id,
    ),

    /** Optional receipt projection row. */
    projectionDocumentId: idRef("projection_document_id").references(
      () => projectionDocuments.id,
    ),

    /** Optional debug payload. */
    debugSnapshotId: idRef("debug_snapshot_id").references(() => debugSnapshots.id),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    inventoryReceiptBatchesBizIdIdUnique: uniqueIndex(
      "inventory_receipt_batches_biz_id_id_unique",
    ).on(table.bizId, table.id),

    inventoryReceiptBatchesBizStatusReceivedIdx: index(
      "inventory_receipt_batches_biz_status_received_idx",
    ).on(table.bizId, table.status, table.receivedAt),

    inventoryReceiptBatchesBizOrderIdx: index("inventory_receipt_batches_biz_order_idx").on(
      table.bizId,
      table.inventoryProcurementOrderId,
      table.receivedAt,
    ),

    inventoryReceiptBatchesActionRequestIdx: index(
      "inventory_receipt_batches_action_request_idx",
    ).on(table.actionRequestId),

    inventoryReceiptBatchesBizActionRequestFk: foreignKey({
      columns: [table.bizId, table.actionRequestId],
      foreignColumns: [actionRequests.bizId, actionRequests.id],
      name: "inventory_receipt_batches_biz_action_request_fk",
    }),

    inventoryReceiptBatchesBizOrderFk: foreignKey({
      columns: [table.bizId, table.inventoryProcurementOrderId],
      foreignColumns: [inventoryProcurementOrders.bizId, inventoryProcurementOrders.id],
      name: "inventory_receipt_batches_biz_order_fk",
    }),

    inventoryReceiptBatchesBizPartnerFk: foreignKey({
      columns: [table.bizId, table.supplyPartnerId],
      foreignColumns: [supplyPartners.bizId, supplyPartners.id],
      name: "inventory_receipt_batches_biz_partner_fk",
    }),

    inventoryReceiptBatchesBizLocationFk: foreignKey({
      columns: [table.bizId, table.inventoryLocationId],
      foreignColumns: [inventoryLocations.bizId, inventoryLocations.id],
      name: "inventory_receipt_batches_biz_location_fk",
    }),

    inventoryReceiptBatchesShapeCheck: check(
      "inventory_receipt_batches_shape_check",
      sql`
      "inventory_procurement_order_id" IS NOT NULL
      OR "supply_partner_id" IS NOT NULL
      `,
    ),

    inventoryReceiptBatchesTimelineCheck: check(
      "inventory_receipt_batches_timeline_check",
      sql`"processed_at" IS NULL OR "processed_at" >= "received_at"`,
    ),
  }),
);

/**
 * inventory_receipt_items
 *
 * ELI5:
 * Line-level quantities received/accepted/rejected per receipt batch.
 */
export const inventoryReceiptItems = pgTable(
  "inventory_receipt_items",
  {
    /** Stable primary key. */
    id: idWithTag("receipt_item"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent receipt batch. */
    inventoryReceiptBatchId: idRef("inventory_receipt_batch_id")
      .references(() => inventoryReceiptBatches.id)
      .notNull(),

    /** Optional source procurement-order line. */
    inventoryProcurementOrderLineId: idRef("inventory_procurement_order_line_id").references(
      () => inventoryProcurementOrderLines.id,
    ),

    /** Optional target inventory item. */
    inventoryItemId: idRef("inventory_item_id").references(() => inventoryItems.id),

    /** Quantity physically received. */
    quantityReceived: integer("quantity_received").notNull(),

    /** Quantity accepted into inventory. */
    quantityAccepted: integer("quantity_accepted").default(0).notNull(),

    /** Quantity rejected by QA. */
    quantityRejected: integer("quantity_rejected").default(0).notNull(),

    /** Quantity marked damaged/spoilage. */
    quantityDamaged: integer("quantity_damaged").default(0).notNull(),

    /** Optional unit cost snapshot. */
    unitCostMinor: integer("unit_cost_minor"),

    /** Optional resulting stock movement row for accepted quantity. */
    inventoryMovementId: idRef("inventory_movement_id").references(
      () => inventoryMovements.id,
    ),

    /** Optional lot/batch code from supplier docs. */
    lotCode: varchar("lot_code", { length: 160 }),

    /** Optional serial range start marker. */
    serialStart: varchar("serial_start", { length: 160 }),

    /** Optional serial range end marker. */
    serialEnd: varchar("serial_end", { length: 160 }),

    /** Optional expiration marker for perishable receipt line. */
    expiresAt: timestamp("expires_at", { withTimezone: true }),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    inventoryReceiptItemsBizIdIdUnique: uniqueIndex("inventory_receipt_items_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),

    inventoryReceiptItemsBizBatchIdx: index("inventory_receipt_items_biz_batch_idx").on(
      table.bizId,
      table.inventoryReceiptBatchId,
    ),

    inventoryReceiptItemsBizItemIdx: index("inventory_receipt_items_biz_item_idx").on(
      table.bizId,
      table.inventoryItemId,
    ),

    inventoryReceiptItemsBizBatchFk: foreignKey({
      columns: [table.bizId, table.inventoryReceiptBatchId],
      foreignColumns: [inventoryReceiptBatches.bizId, inventoryReceiptBatches.id],
      name: "inventory_receipt_items_biz_batch_fk",
    }),

    inventoryReceiptItemsBizOrderLineFk: foreignKey({
      columns: [table.bizId, table.inventoryProcurementOrderLineId],
      foreignColumns: [inventoryProcurementOrderLines.bizId, inventoryProcurementOrderLines.id],
      name: "inventory_receipt_items_biz_order_line_fk",
    }),

    inventoryReceiptItemsBizInventoryItemFk: foreignKey({
      columns: [table.bizId, table.inventoryItemId],
      foreignColumns: [inventoryItems.bizId, inventoryItems.id],
      name: "inventory_receipt_items_biz_inventory_item_fk",
    }),

    inventoryReceiptItemsBizMovementFk: foreignKey({
      columns: [table.bizId, table.inventoryMovementId],
      foreignColumns: [inventoryMovements.bizId, inventoryMovements.id],
      name: "inventory_receipt_items_biz_inventory_movement_fk",
    }),

    inventoryReceiptItemsQuantitiesCheck: check(
      "inventory_receipt_items_quantities_check",
      sql`
      "quantity_received" >= 0
      AND "quantity_accepted" >= 0
      AND "quantity_rejected" >= 0
      AND "quantity_damaged" >= 0
      AND ("quantity_accepted" + "quantity_rejected" + "quantity_damaged") <= "quantity_received"
      AND ("unit_cost_minor" IS NULL OR "unit_cost_minor" >= 0)
      `,
    ),

    inventoryReceiptItemsSerialPairCheck: check(
      "inventory_receipt_items_serial_pair_check",
      sql`
      (
        "serial_start" IS NULL
        AND "serial_end" IS NULL
      ) OR (
        "serial_start" IS NOT NULL
        AND "serial_end" IS NOT NULL
      )
      `,
    ),
  }),
);

/**
 * inventory_lot_units
 *
 * ELI5:
 * Lot/serial scoped stock state for traceability, expiry control, and
 * high-confidence recall workflows.
 */
export const inventoryLotUnits = pgTable(
  "inventory_lot_units",
  {
    /** Stable primary key. */
    id: idWithTag("inventory_lot"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Canonical inventory item this lot belongs to. */
    inventoryItemId: idRef("inventory_item_id")
      .references(() => inventoryItems.id)
      .notNull(),

    /** Optional location scope for this lot state. */
    inventoryLocationId: idRef("inventory_location_id").references(
      () => inventoryLocations.id,
    ),

    /** Optional source receipt item for lineage. */
    inventoryReceiptItemId: idRef("inventory_receipt_item_id").references(
      () => inventoryReceiptItems.id,
    ),

    /** Human lot/batch code. */
    lotCode: varchar("lot_code", { length: 160 }).notNull(),

    /** Optional serial range start marker. */
    serialStart: varchar("serial_start", { length: 160 }),

    /** Optional serial range end marker. */
    serialEnd: varchar("serial_end", { length: 160 }),

    /** Optional manufactured timestamp. */
    manufacturedAt: timestamp("manufactured_at", { withTimezone: true }),

    /** Optional expiry timestamp. */
    expiresAt: timestamp("expires_at", { withTimezone: true }),

    /** Lot lifecycle status. */
    status: lifecycleStatusEnum("status").default("active").notNull(),

    /** Current on-hand quantity in this lot scope. */
    quantityOnHand: integer("quantity_on_hand").default(0).notNull(),

    /** Quantity reserved in this lot scope. */
    quantityReserved: integer("quantity_reserved").default(0).notNull(),

    /** Quantity consumed from this lot scope. */
    quantityConsumed: integer("quantity_consumed").default(0).notNull(),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    inventoryLotUnitsBizIdIdUnique: uniqueIndex("inventory_lot_units_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),

    inventoryLotUnitsBizItemLotUnique: uniqueIndex("inventory_lot_units_biz_item_lot_unique").on(
      table.bizId,
      table.inventoryItemId,
      table.inventoryLocationId,
      table.lotCode,
    ),

    inventoryLotUnitsBizStatusExpiryIdx: index("inventory_lot_units_biz_status_expiry_idx").on(
      table.bizId,
      table.status,
      table.expiresAt,
    ),

    inventoryLotUnitsBizInventoryItemFk: foreignKey({
      columns: [table.bizId, table.inventoryItemId],
      foreignColumns: [inventoryItems.bizId, inventoryItems.id],
      name: "inventory_lot_units_biz_inventory_item_fk",
    }),

    inventoryLotUnitsBizLocationFk: foreignKey({
      columns: [table.bizId, table.inventoryLocationId],
      foreignColumns: [inventoryLocations.bizId, inventoryLocations.id],
      name: "inventory_lot_units_biz_location_fk",
    }),

    inventoryLotUnitsBizReceiptItemFk: foreignKey({
      columns: [table.bizId, table.inventoryReceiptItemId],
      foreignColumns: [inventoryReceiptItems.bizId, inventoryReceiptItems.id],
      name: "inventory_lot_units_biz_receipt_item_fk",
    }),

    inventoryLotUnitsQuantitiesCheck: check(
      "inventory_lot_units_quantities_check",
      sql`
      "quantity_on_hand" >= 0
      AND "quantity_reserved" >= 0
      AND "quantity_consumed" >= 0
      AND "quantity_reserved" <= "quantity_on_hand"
      `,
    ),

    inventoryLotUnitsTimelineCheck: check(
      "inventory_lot_units_timeline_check",
      sql`
      ("expires_at" IS NULL OR "manufactured_at" IS NULL OR "expires_at" >= "manufactured_at")
      `,
    ),

    inventoryLotUnitsSerialPairCheck: check(
      "inventory_lot_units_serial_pair_check",
      sql`
      (
        "serial_start" IS NULL
        AND "serial_end" IS NULL
      ) OR (
        "serial_start" IS NOT NULL
        AND "serial_end" IS NOT NULL
      )
      `,
    ),
  }),
);

export type SupplyPartner = typeof supplyPartners.$inferSelect;
export type NewSupplyPartner = typeof supplyPartners.$inferInsert;

export type SupplyPartnerCatalogItem = typeof supplyPartnerCatalogItems.$inferSelect;
export type NewSupplyPartnerCatalogItem = typeof supplyPartnerCatalogItems.$inferInsert;

export type InventoryReplenishmentPolicy = typeof inventoryReplenishmentPolicies.$inferSelect;
export type NewInventoryReplenishmentPolicy =
  typeof inventoryReplenishmentPolicies.$inferInsert;

export type InventoryReplenishmentRun = typeof inventoryReplenishmentRuns.$inferSelect;
export type NewInventoryReplenishmentRun = typeof inventoryReplenishmentRuns.$inferInsert;

export type InventoryProcurementOrder = typeof inventoryProcurementOrders.$inferSelect;
export type NewInventoryProcurementOrder = typeof inventoryProcurementOrders.$inferInsert;

export type InventoryProcurementOrderLine = typeof inventoryProcurementOrderLines.$inferSelect;
export type NewInventoryProcurementOrderLine =
  typeof inventoryProcurementOrderLines.$inferInsert;

export type InventoryReplenishmentSuggestion =
  typeof inventoryReplenishmentSuggestions.$inferSelect;
export type NewInventoryReplenishmentSuggestion =
  typeof inventoryReplenishmentSuggestions.$inferInsert;

export type InventoryReceiptBatch = typeof inventoryReceiptBatches.$inferSelect;
export type NewInventoryReceiptBatch = typeof inventoryReceiptBatches.$inferInsert;

export type InventoryReceiptItem = typeof inventoryReceiptItems.$inferSelect;
export type NewInventoryReceiptItem = typeof inventoryReceiptItems.$inferInsert;

export type InventoryLotUnit = typeof inventoryLotUnits.$inferSelect;
export type NewInventoryLotUnit = typeof inventoryLotUnits.$inferInsert;
