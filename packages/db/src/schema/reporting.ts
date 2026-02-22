import { sql } from "drizzle-orm";
import { check, foreignKey, index, uniqueIndex } from "drizzle-orm/pg-core";
import {
  date,
  integer,
  jsonb,
  pgTable,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { idRef, idWithTag, withAuditRefs } from "./_common";
import { bizes } from "./bizes";
import { lifecycleEvents } from "./extensions";
import {
  factRefreshStatusEnum,
  operationalDemandSourceTypeEnum,
  projectionHealthStatusEnum,
  projectionScopeTypeEnum,
} from "./enums";
import { locations } from "./locations";
import { sellables } from "./product_commerce";
import { resources } from "./resources";
import { subjects } from "./subjects";
import { users } from "./users";

/**
 * fact_refresh_runs
 *
 * ELI5:
 * Every ETL/aggregation run that updates fact tables logs one row here.
 * This is the control-plane ledger for reporting freshness and troubleshooting.
 */
export const factRefreshRuns = pgTable(
  "fact_refresh_runs",
  {
    id: idWithTag("fact_run"),
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Which fact family this run was producing. */
    factKey: varchar("fact_key", { length: 120 }).notNull(),

    status: factRefreshStatusEnum("status").default("running").notNull(),

    /** Inclusive date window processed by this run. */
    windowStartDate: date("window_start_date").notNull(),
    windowEndDate: date("window_end_date").notNull(),

    /** Input/output row counters for observability. */
    inputRows: integer("input_rows").default(0).notNull(),
    outputRows: integer("output_rows").default(0).notNull(),

    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    errorSummary: varchar("error_summary", { length: 2000 }),
    metadata: jsonb("metadata").default({}),
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    factRefreshRunsBizIdIdUnique: uniqueIndex("fact_refresh_runs_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    factRefreshRunsBizFactStartedIdx: index("fact_refresh_runs_biz_fact_started_idx").on(
      table.bizId,
      table.factKey,
      table.startedAt,
    ),

    factRefreshRunsWindowCheck: check(
      "fact_refresh_runs_window_check",
      sql`
      "window_end_date" >= "window_start_date"
      AND "input_rows" >= 0
      AND "output_rows" >= 0
      AND ("finished_at" IS NULL OR "finished_at" >= "started_at")
      `,
    ),
  }),
);

/**
 * fact_revenue_daily
 *
 * ELI5:
 * One row per day per tenant (optionally per location/currency) for fast KPI
 * queries like "how much did we make yesterday?".
 */
export const factRevenueDaily = pgTable(
  "fact_revenue_daily",
  {
    id: idWithTag("fact_revenue_day"),
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Optional location slice; null means tenant total for that day. */
    locationId: idRef("location_id").references(() => locations.id),

    factDate: date("fact_date").notNull(),
    currency: varchar("currency", { length: 3 }).default("USD").notNull(),

    grossMinor: integer("gross_minor").default(0).notNull(),
    taxMinor: integer("tax_minor").default(0).notNull(),
    feeMinor: integer("fee_minor").default(0).notNull(),
    discountMinor: integer("discount_minor").default(0).notNull(),
    refundMinor: integer("refund_minor").default(0).notNull(),
    netMinor: integer("net_minor").default(0).notNull(),

    ordersCount: integer("orders_count").default(0).notNull(),
    paidOrdersCount: integer("paid_orders_count").default(0).notNull(),
    metadata: jsonb("metadata").default({}),
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    factRevenueDailyBizIdIdUnique: uniqueIndex("fact_revenue_daily_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** One row per day/location/currency slice. */
    factRevenueDailySliceUnique: uniqueIndex("fact_revenue_daily_slice_unique").on(
      table.bizId,
      table.locationId,
      table.factDate,
      table.currency,
    ),

    factRevenueDailyBizDateIdx: index("fact_revenue_daily_biz_date_idx").on(
      table.bizId,
      table.factDate,
    ),

    factRevenueDailyBizLocationDateIdx: index(
      "fact_revenue_daily_biz_location_date_idx",
    ).on(table.bizId, table.locationId, table.factDate),

    factRevenueDailyBizLocationFk: foreignKey({
      columns: [table.bizId, table.locationId],
      foreignColumns: [locations.bizId, locations.id],
      name: "fact_revenue_daily_biz_location_fk",
    }),

    factRevenueDailyMoneyCheck: check(
      "fact_revenue_daily_money_check",
      sql`
      "gross_minor" >= 0
      AND "tax_minor" >= 0
      AND "fee_minor" >= 0
      AND "discount_minor" >= 0
      AND "refund_minor" >= 0
      AND "orders_count" >= 0
      AND "paid_orders_count" >= 0
      AND "net_minor" = (
        "gross_minor"
        + "tax_minor"
        + "fee_minor"
        - "discount_minor"
        - "refund_minor"
      )
      `,
    ),

    factRevenueDailyCurrencyFormatCheck: check(
      "fact_revenue_daily_currency_format_check",
      sql`"currency" ~ '^[A-Z]{3}$'`,
    ),
  }),
);

/**
 * fact_revenue_monthly
 *
 * ELI5:
 * Monthly rollup for dashboard speed and simplified financial periods.
 */
export const factRevenueMonthly = pgTable(
  "fact_revenue_monthly",
  {
    id: idWithTag("fact_revenue_month"),
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),
    locationId: idRef("location_id").references(() => locations.id),

    /** First day of month (YYYY-MM-01). */
    monthStartDate: date("month_start_date").notNull(),
    currency: varchar("currency", { length: 3 }).default("USD").notNull(),

    grossMinor: integer("gross_minor").default(0).notNull(),
    taxMinor: integer("tax_minor").default(0).notNull(),
    feeMinor: integer("fee_minor").default(0).notNull(),
    discountMinor: integer("discount_minor").default(0).notNull(),
    refundMinor: integer("refund_minor").default(0).notNull(),
    netMinor: integer("net_minor").default(0).notNull(),

    ordersCount: integer("orders_count").default(0).notNull(),
    paidOrdersCount: integer("paid_orders_count").default(0).notNull(),
    metadata: jsonb("metadata").default({}),
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    factRevenueMonthlyBizIdIdUnique: uniqueIndex("fact_revenue_monthly_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    factRevenueMonthlySliceUnique: uniqueIndex(
      "fact_revenue_monthly_slice_unique",
    ).on(table.bizId, table.locationId, table.monthStartDate, table.currency),

    factRevenueMonthlyBizMonthIdx: index("fact_revenue_monthly_biz_month_idx").on(
      table.bizId,
      table.monthStartDate,
    ),

    factRevenueMonthlyBizLocationFk: foreignKey({
      columns: [table.bizId, table.locationId],
      foreignColumns: [locations.bizId, locations.id],
      name: "fact_revenue_monthly_biz_location_fk",
    }),

    factRevenueMonthlyMoneyCheck: check(
      "fact_revenue_monthly_money_check",
      sql`
      "gross_minor" >= 0
      AND "tax_minor" >= 0
      AND "fee_minor" >= 0
      AND "discount_minor" >= 0
      AND "refund_minor" >= 0
      AND "orders_count" >= 0
      AND "paid_orders_count" >= 0
      AND "net_minor" = (
        "gross_minor"
        + "tax_minor"
        + "fee_minor"
        - "discount_minor"
        - "refund_minor"
      )
      `,
    ),

    factRevenueMonthlyCurrencyFormatCheck: check(
      "fact_revenue_monthly_currency_format_check",
      sql`"currency" ~ '^[A-Z]{3}$'`,
    ),
  }),
);

/**
 * fact_sellable_daily
 *
 * ELI5:
 * One row per day per sellable for "top selling product/service" analytics.
 */
export const factSellableDaily = pgTable(
  "fact_sellable_daily",
  {
    id: idWithTag("fact_sellable_day"),
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),
    sellableId: idRef("sellable_id")
      .references(() => sellables.id)
      .notNull(),

    factDate: date("fact_date").notNull(),
    currency: varchar("currency", { length: 3 }).default("USD").notNull(),

    quantity: integer("quantity").default(0).notNull(),
    grossMinor: integer("gross_minor").default(0).notNull(),
    discountMinor: integer("discount_minor").default(0).notNull(),
    refundMinor: integer("refund_minor").default(0).notNull(),
    netMinor: integer("net_minor").default(0).notNull(),

    /** Cost may be unavailable for some sellables; margin is nullable then. */
    costMinor: integer("cost_minor"),
    marginMinor: integer("margin_minor"),
    ordersCount: integer("orders_count").default(0).notNull(),
    metadata: jsonb("metadata").default({}),
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    factSellableDailyBizIdIdUnique: uniqueIndex("fact_sellable_daily_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    factSellableDailySliceUnique: uniqueIndex("fact_sellable_daily_slice_unique").on(
      table.bizId,
      table.sellableId,
      table.factDate,
      table.currency,
    ),

    factSellableDailyBizDateNetIdx: index("fact_sellable_daily_biz_date_net_idx").on(
      table.bizId,
      table.factDate,
      table.netMinor,
    ),

    factSellableDailyBizSellableFk: foreignKey({
      columns: [table.bizId, table.sellableId],
      foreignColumns: [sellables.bizId, sellables.id],
      name: "fact_sellable_daily_biz_sellable_fk",
    }),

    factSellableDailyMoneyCheck: check(
      "fact_sellable_daily_money_check",
      sql`
      "quantity" >= 0
      AND "gross_minor" >= 0
      AND "discount_minor" >= 0
      AND "refund_minor" >= 0
      AND "orders_count" >= 0
      AND "net_minor" = ("gross_minor" - "discount_minor" - "refund_minor")
      AND ("cost_minor" IS NULL OR "cost_minor" >= 0)
      AND (
        ("cost_minor" IS NULL AND "margin_minor" IS NULL)
        OR ("cost_minor" IS NOT NULL AND "margin_minor" = ("net_minor" - "cost_minor"))
      )
      `,
    ),

    factSellableDailyCurrencyFormatCheck: check(
      "fact_sellable_daily_currency_format_check",
      sql`"currency" ~ '^[A-Z]{3}$'`,
    ),
  }),
);

/**
 * fact_resource_utilization_daily
 *
 * ELI5:
 * One row per day per resource describing capacity usage.
 */
export const factResourceUtilizationDaily = pgTable(
  "fact_resource_utilization_daily",
  {
    id: idWithTag("fact_util_day"),
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),
    resourceId: idRef("resource_id")
      .references(() => resources.id)
      .notNull(),
    factDate: date("fact_date").notNull(),

    availableMinutes: integer("available_minutes").default(0).notNull(),
    bookedMinutes: integer("booked_minutes").default(0).notNull(),
    blockedMinutes: integer("blocked_minutes").default(0).notNull(),

    /**
     * Utilization in basis points (10000 = 100%).
     * Stored explicitly for fast ranking/filtering.
     */
    utilizationBps: integer("utilization_bps").default(0).notNull(),

    assignmentsCount: integer("assignments_count").default(0).notNull(),
    noShowCount: integer("no_show_count").default(0).notNull(),
    metadata: jsonb("metadata").default({}),
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    factResourceUtilizationDailyBizIdIdUnique: uniqueIndex("fact_resource_utilization_daily_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    factResourceUtilDailySliceUnique: uniqueIndex(
      "fact_resource_utilization_daily_slice_unique",
    ).on(table.bizId, table.resourceId, table.factDate),

    factResourceUtilDailyBizDateUtilIdx: index(
      "fact_resource_utilization_daily_biz_date_util_idx",
    ).on(table.bizId, table.factDate, table.utilizationBps),

    factResourceUtilDailyBizResourceFk: foreignKey({
      columns: [table.bizId, table.resourceId],
      foreignColumns: [resources.bizId, resources.id],
      name: "fact_resource_utilization_daily_biz_resource_fk",
    }),

    factResourceUtilDailyBoundsCheck: check(
      "fact_resource_utilization_daily_bounds_check",
      sql`
      "available_minutes" >= 0
      AND "booked_minutes" >= 0
      AND "blocked_minutes" >= 0
      AND "assignments_count" >= 0
      AND "no_show_count" >= 0
      AND "booked_minutes" <= "available_minutes"
      AND "utilization_bps" >= 0
      AND "utilization_bps" <= 10000
      AND (
        ("available_minutes" = 0 AND "utilization_bps" = 0)
        OR ("available_minutes" > 0)
      )
      `,
    ),
  }),
);

/**
 * projection_checkpoints
 *
 * ELI5:
 * A projection is a fast "summary view" built from source events/tables.
 * This table tracks where each projection is, so rebuild/replay workers know
 * the last safe checkpoint and operators can spot lag or failures quickly.
 *
 * Why this exists even though extension state docs already exist:
 * - `extension_state_documents` is extension-owned data.
 * - `projection_checkpoints` is platform-owned observability/control-plane data
 *   for both internal and extension projections.
 */
export const projectionCheckpoints = pgTable(
  "projection_checkpoints",
  {
    /** Stable checkpoint row id. */
    id: idWithTag("projection_checkpoint"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Logical projection family key (e.g., ops_board, revenue_daily_rollup). */
    projectionKey: varchar("projection_key", { length: 140 }).notNull(),

    /** Scope discriminator for this checkpoint row. */
    scopeType: projectionScopeTypeEnum("scope_type").default("biz").notNull(),

    /** Scope payload when `scope_type=location`. */
    locationId: idRef("location_id").references(() => locations.id),

    /** Scope payload when `scope_type=resource`. */
    resourceId: idRef("resource_id").references(() => resources.id),

    /** Scope payload when `scope_type=sellable`. */
    sellableId: idRef("sellable_id").references(() => sellables.id),

    /** Scope payload when `scope_type=custom_subject`. */
    subjectType: varchar("subject_type", { length: 80 }),
    subjectId: varchar("subject_id", { length: 140 }),

    /** Health signal used by ops dashboards/alerts. */
    status: projectionHealthStatusEnum("status").default("healthy").notNull(),

    /** Monotonic revision of this projection state. */
    revision: integer("revision").default(0).notNull(),

    /** Latest lifecycle-event cursor consumed by this projection, if event-driven. */
    lastLifecycleEventId: idRef("last_lifecycle_event_id").references(
      () => lifecycleEvents.id,
    ),

    /** Business occurrence time of the last consumed event. */
    lastEventOccurredAt: timestamp("last_event_occurred_at", { withTimezone: true }),

    /** Last successful apply time for projection materialization. */
    lastAppliedAt: timestamp("last_applied_at", { withTimezone: true })
      .defaultNow()
      .notNull(),

    /** Current lag in seconds (materialized for quick monitoring queries). */
    lagSeconds: integer("lag_seconds").default(0).notNull(),

    /** Optional error summary when projection run fails/degrades. */
    errorSummary: varchar("error_summary", { length: 2000 }),

    /** Non-indexed extension payload for projection-specific metrics. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    projectionCheckpointsBizIdIdUnique: uniqueIndex("projection_checkpoints_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Main operator query path for stale/broken projection detection. */
    projectionCheckpointsBizStatusLagIdx: index(
      "projection_checkpoints_biz_status_lag_idx",
    ).on(table.bizId, table.status, table.lagSeconds, table.lastAppliedAt),

    /** Projection-key oriented lookup path. */
    projectionCheckpointsBizProjectionAppliedIdx: index(
      "projection_checkpoints_biz_projection_applied_idx",
    ).on(table.bizId, table.projectionKey, table.lastAppliedAt),

    /** Reverse lookup path for custom-subject scoped projections. */
    projectionCheckpointsBizSubjectIdx: index(
      "projection_checkpoints_biz_subject_idx",
    ).on(table.bizId, table.subjectType, table.subjectId),

    /** One biz-scope checkpoint row per projection key. */
    projectionCheckpointsBizScopeUnique: uniqueIndex(
      "projection_checkpoints_biz_scope_unique",
    )
      .on(table.bizId, table.projectionKey)
      .where(sql`"scope_type" = 'biz' AND "deleted_at" IS NULL`),

    /** One location-scope checkpoint row per projection key/location. */
    projectionCheckpointsLocationScopeUnique: uniqueIndex(
      "projection_checkpoints_location_scope_unique",
    )
      .on(table.bizId, table.projectionKey, table.locationId)
      .where(sql`"scope_type" = 'location' AND "deleted_at" IS NULL`),

    /** One resource-scope checkpoint row per projection key/resource. */
    projectionCheckpointsResourceScopeUnique: uniqueIndex(
      "projection_checkpoints_resource_scope_unique",
    )
      .on(table.bizId, table.projectionKey, table.resourceId)
      .where(sql`"scope_type" = 'resource' AND "deleted_at" IS NULL`),

    /** One sellable-scope checkpoint row per projection key/sellable. */
    projectionCheckpointsSellableScopeUnique: uniqueIndex(
      "projection_checkpoints_sellable_scope_unique",
    )
      .on(table.bizId, table.projectionKey, table.sellableId)
      .where(sql`"scope_type" = 'sellable' AND "deleted_at" IS NULL`),

    /** One custom-subject checkpoint row per projection key/subject. */
    projectionCheckpointsCustomSubjectScopeUnique: uniqueIndex(
      "projection_checkpoints_custom_subject_scope_unique",
    )
      .on(table.bizId, table.projectionKey, table.subjectType, table.subjectId)
      .where(sql`"scope_type" = 'custom_subject' AND "deleted_at" IS NULL`),

    /** Tenant-safe FK to optional location scope payload. */
    projectionCheckpointsBizLocationFk: foreignKey({
      columns: [table.bizId, table.locationId],
      foreignColumns: [locations.bizId, locations.id],
      name: "projection_checkpoints_biz_location_fk",
    }),

    /** Tenant-safe FK to optional resource scope payload. */
    projectionCheckpointsBizResourceFk: foreignKey({
      columns: [table.bizId, table.resourceId],
      foreignColumns: [resources.bizId, resources.id],
      name: "projection_checkpoints_biz_resource_fk",
    }),

    /** Tenant-safe FK to optional sellable scope payload. */
    projectionCheckpointsBizSellableFk: foreignKey({
      columns: [table.bizId, table.sellableId],
      foreignColumns: [sellables.bizId, sellables.id],
      name: "projection_checkpoints_biz_sellable_fk",
    }),

    /** Tenant-safe FK to optional custom-subject scope payload. */
    projectionCheckpointsBizSubjectFk: foreignKey({
      columns: [table.bizId, table.subjectType, table.subjectId],
      foreignColumns: [subjects.bizId, subjects.subjectType, subjects.subjectId],
      name: "projection_checkpoints_biz_subject_fk",
    }),

    /** Tenant-safe FK to optional lifecycle-event cursor. */
    projectionCheckpointsBizLifecycleEventFk: foreignKey({
      columns: [table.bizId, table.lastLifecycleEventId],
      foreignColumns: [lifecycleEvents.bizId, lifecycleEvents.id],
      name: "projection_checkpoints_biz_lifecycle_event_fk",
    }),

    /** Basic numeric and timeline sanity checks. */
    projectionCheckpointsBoundsCheck: check(
      "projection_checkpoints_bounds_check",
      sql`
      "revision" >= 0
      AND "lag_seconds" >= 0
      AND ("last_event_occurred_at" IS NULL OR "last_applied_at" >= "last_event_occurred_at")
      `,
    ),

    /** Subject payload should be fully-null or fully-populated. */
    projectionCheckpointsSubjectPairCheck: check(
      "projection_checkpoints_subject_pair_check",
      sql`
      (
        "subject_type" IS NULL
        AND "subject_id" IS NULL
      ) OR (
        "subject_type" IS NOT NULL
        AND "subject_id" IS NOT NULL
      )
      `,
    ),

    /** Scope payload must match `scope_type` exactly. */
    projectionCheckpointsScopeShapeCheck: check(
      "projection_checkpoints_scope_shape_check",
      sql`
      (
        "scope_type" = 'biz'
        AND "location_id" IS NULL
        AND "resource_id" IS NULL
        AND "sellable_id" IS NULL
        AND "subject_type" IS NULL
        AND "subject_id" IS NULL
      ) OR (
        "scope_type" = 'location'
        AND "location_id" IS NOT NULL
        AND "resource_id" IS NULL
        AND "sellable_id" IS NULL
        AND "subject_type" IS NULL
        AND "subject_id" IS NULL
      ) OR (
        "scope_type" = 'resource'
        AND "location_id" IS NULL
        AND "resource_id" IS NOT NULL
        AND "sellable_id" IS NULL
        AND "subject_type" IS NULL
        AND "subject_id" IS NULL
      ) OR (
        "scope_type" = 'sellable'
        AND "location_id" IS NULL
        AND "resource_id" IS NULL
        AND "sellable_id" IS NOT NULL
        AND "subject_type" IS NULL
        AND "subject_id" IS NULL
      ) OR (
        "scope_type" = 'custom_subject'
        AND "location_id" IS NULL
        AND "resource_id" IS NULL
        AND "sellable_id" IS NULL
        AND "subject_type" IS NOT NULL
        AND "subject_id" IS NOT NULL
      )
      `,
    ),
  }),
);

/**
 * fact_operational_daily
 *
 * ELI5:
 * Daily operational read model for staffing/fulfillment demand flow.
 * This keeps "how operations performed yesterday?" queries fast and stable.
 *
 * Examples:
 * - open vs filled demand counts by day
 * - active/completed assignment counts by day
 * - average fill lead and assignment duration trends
 */
export const factOperationalDaily = pgTable(
  "fact_operational_daily",
  {
    id: idWithTag("fact_ops_day"),
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Optional location slice; null means tenant total. */
    locationId: idRef("location_id").references(() => locations.id),

    /** Optional source-family slice; null means all sources combined. */
    sourceType: operationalDemandSourceTypeEnum("source_type"),

    factDate: date("fact_date").notNull(),

    openDemandsCount: integer("open_demands_count").default(0).notNull(),
    filledDemandsCount: integer("filled_demands_count").default(0).notNull(),
    activeAssignmentsCount: integer("active_assignments_count")
      .default(0)
      .notNull(),
    completedAssignmentsCount: integer("completed_assignments_count")
      .default(0)
      .notNull(),

    /** Average lead time from demand creation to first assignment start. */
    avgFillLeadMinutes: integer("avg_fill_lead_minutes"),

    /** Average assignment window duration in minutes. */
    avgAssignmentDurationMinutes: integer("avg_assignment_duration_minutes"),

    metadata: jsonb("metadata").default({}),
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    factOperationalDailyBizIdIdUnique: uniqueIndex("fact_operational_daily_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** One row per day/location/source slice. */
    factOperationalDailySliceUnique: uniqueIndex(
      "fact_operational_daily_slice_unique",
    ).on(table.bizId, table.locationId, table.sourceType, table.factDate),

    /** Main timeline query path for operations dashboards. */
    factOperationalDailyBizDateIdx: index("fact_operational_daily_biz_date_idx").on(
      table.bizId,
      table.factDate,
    ),

    /** Location-aware trend query path. */
    factOperationalDailyBizLocationDateIdx: index(
      "fact_operational_daily_biz_location_date_idx",
    ).on(table.bizId, table.locationId, table.factDate),

    /** Tenant-safe FK to optional location slice. */
    factOperationalDailyBizLocationFk: foreignKey({
      columns: [table.bizId, table.locationId],
      foreignColumns: [locations.bizId, locations.id],
      name: "fact_operational_daily_biz_location_fk",
    }),

    /** Counter and duration/lead values must be non-negative when present. */
    factOperationalDailyBoundsCheck: check(
      "fact_operational_daily_bounds_check",
      sql`
      "open_demands_count" >= 0
      AND "filled_demands_count" >= 0
      AND "active_assignments_count" >= 0
      AND "completed_assignments_count" >= 0
      AND ("avg_fill_lead_minutes" IS NULL OR "avg_fill_lead_minutes" >= 0)
      AND (
        "avg_assignment_duration_minutes" IS NULL
        OR "avg_assignment_duration_minutes" >= 0
      )
      `,
    ),
  }),
);
