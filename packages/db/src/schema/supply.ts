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
import { calendars, calendarTimelineEvents } from "./time_availability";
import { users } from "./users";
import {
  maintenanceActionTypeEnum,
  maintenanceTriggerTypeEnum,
  maintenanceWorkOrderStatusEnum,
  resourceCapabilityScopeEnum,
  resourceConditionReportTypeEnum,
} from "./enums";

/**
 * resource_capability_templates
 *
 * ELI5:
 * A capability template is a reusable "label with meaning" the biz defines.
 * Example labels: "GP", "Masseuse", "Forklift Certified", "Training Car".
 *
 * Why this matters:
 * - offer selectors can target capability templates,
 * - resources can be assigned these templates,
 * - matching stays consistent and scalable across many resources.
 */
export const resourceCapabilityTemplates = pgTable(
  "resource_capability_templates",
  {
    /** Stable primary key for this capability dictionary row. */
    id: idWithTag("capability_template"),

    /** Tenant boundary for dictionary ownership. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /**
     * Optional location scope.
     * Null means biz-wide. Non-null means local override/dedicated capability.
     */
    locationId: idRef("location_id").references(() => locations.id),

    /** Which supply class this capability applies to. */
    scope: resourceCapabilityScopeEnum("scope").notNull(),

    /** Human-facing capability name. */
    name: varchar("name", { length: 180 }).notNull(),

    /** Stable machine slug, unique per (biz, location, scope). */
    slug: varchar("slug", { length: 140 }).notNull(),

    /** Optional operator-facing explanation/help text. */
    description: text("description"),

    /** Active toggle so templates can be retired without hard deletes. */
    isActive: boolean("is_active").default(true).notNull(),

    /** Extensible metadata payload for future policy decoration. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite unique target used by tenant-safe child FKs. */
    resourceCapabilityTemplatesBizIdIdUnique: uniqueIndex(
      "resource_capability_templates_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** Prevents duplicate capability slugs in one scope bucket. */
    resourceCapabilityTemplatesScopeSlugUnique: uniqueIndex(
      "resource_capability_templates_scope_slug_unique",
    ).on(table.bizId, table.locationId, table.scope, table.slug),

    /** Common query path for selector building UI. */
    resourceCapabilityTemplatesBizScopeIdx: index(
      "resource_capability_templates_biz_scope_idx",
    ).on(table.bizId, table.scope, table.isActive),

    /** Tenant-safe location scope FK when location override is used. */
    resourceCapabilityTemplatesBizLocationFk: foreignKey({
      columns: [table.bizId, table.locationId],
      foreignColumns: [locations.bizId, locations.id],
      name: "resource_capability_templates_biz_location_fk",
    }),
  }),
);

/**
 * resource_capability_assignments
 *
 * ELI5:
 * This is the many-to-many bridge that says "resource X has capability Y".
 * It powers matching like "assign any host with GP capability".
 */
export const resourceCapabilityAssignments = pgTable(
  "resource_capability_assignments",
  {
    /** Stable primary key for assignment row. */
    id: idWithTag("capability_assignment"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Resource receiving the capability. */
    resourceId: idRef("resource_id")
      .references(() => resources.id)
      .notNull(),

    /** Capability template being assigned. */
    capabilityTemplateId: idRef("capability_template_id")
      .references(() => resourceCapabilityTemplates.id)
      .notNull(),

    /**
     * Optional quality score (0..100) for ranking candidate resources.
     * Example: seniority/proficiency/confidence.
     */
    proficiencyScore: integer("proficiency_score"),

    /** Marks a "default" capability among multiple assignments. */
    isPrimary: boolean("is_primary").default(false).notNull(),

    /** Optional validity window start. */
    validFrom: timestamp("valid_from", { withTimezone: true }),

    /** Optional validity window end (license expiry, temporary cert, etc.). */
    validTo: timestamp("valid_to", { withTimezone: true }),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    resourceCapabilityAssignmentsBizIdIdUnique: uniqueIndex("resource_capability_assignments_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Prevent duplicate active assignment rows. */
    resourceCapabilityAssignmentsUnique: uniqueIndex(
      "resource_capability_assignments_unique",
    )
      .on(table.resourceId, table.capabilityTemplateId)
      .where(sql`"deleted_at" IS NULL`),

    /** Common query path for "find all capabilities for resource". */
    resourceCapabilityAssignmentsBizResourceIdx: index(
      "resource_capability_assignments_biz_resource_idx",
    ).on(table.bizId, table.resourceId),

    /** Common query path for "find all resources for capability". */
    resourceCapabilityAssignmentsBizCapabilityIdx: index(
      "resource_capability_assignments_biz_capability_idx",
    ).on(table.bizId, table.capabilityTemplateId),

    /** Tenant-safe resource FK. */
    resourceCapabilityAssignmentsBizResourceFk: foreignKey({
      columns: [table.bizId, table.resourceId],
      foreignColumns: [resources.bizId, resources.id],
      name: "resource_capability_assignments_biz_resource_fk",
    }),

    /** Tenant-safe capability FK. */
    resourceCapabilityAssignmentsBizCapabilityFk: foreignKey({
      columns: [table.bizId, table.capabilityTemplateId],
      foreignColumns: [resourceCapabilityTemplates.bizId, resourceCapabilityTemplates.id],
      name: "resource_capability_assignments_biz_capability_fk",
    }),

    /** Proficiency bounds for deterministic scoring semantics. */
    resourceCapabilityAssignmentsProficiencyBoundsCheck: check(
      "resource_capability_assignments_proficiency_bounds_check",
      sql`"proficiency_score" IS NULL OR ("proficiency_score" >= 0 AND "proficiency_score" <= 100)`,
    ),

    /** Validity windows must be time-ordered when both are present. */
    resourceCapabilityAssignmentsValidityWindowCheck: check(
      "resource_capability_assignments_validity_window_check",
      sql`"valid_from" IS NULL OR "valid_to" IS NULL OR "valid_to" > "valid_from"`,
    ),
  }),
);

/**
 * resource_usage_counters
 *
 * ELI5:
 * This table stores cumulative usage for each resource and metric.
 * Example: "Machine A has 934 usage-hours" or "Vehicle B has 12,102 miles".
 *
 * Why this exists:
 * maintenance policies should not parse random event logs every time.
 */
export const resourceUsageCounters = pgTable(
  "resource_usage_counters",
  {
    /** Stable primary key. */
    id: idWithTag("usage_counter"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Resource that owns this counter. */
    resourceId: idRef("resource_id")
      .references(() => resources.id)
      .notNull(),

    /** Counter identifier (e.g., hours, scans, miles, cycles). */
    counterKey: varchar("counter_key", { length: 120 }).notNull(),

    /** Human/technical unit label (hours, count, miles, km, etc.). */
    unit: varchar("unit", { length: 40 }).notNull(),

    /** Current cumulative value (non-negative integer). */
    currentValue: integer("current_value").default(0).notNull(),

    /** Last increment instant for reconciliation and freshness checks. */
    lastIncrementAt: timestamp("last_increment_at", { withTimezone: true }),

    /** Last full reset instant (if counter resets on maintenance cycles). */
    lastResetAt: timestamp("last_reset_at", { withTimezone: true }),

    /** Extension payload for additional measurement metadata. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    resourceUsageCountersBizIdIdUnique: uniqueIndex("resource_usage_counters_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Ensures one row per resource+counter key. */
    resourceUsageCountersUnique: uniqueIndex("resource_usage_counters_unique").on(
      table.resourceId,
      table.counterKey,
    ),

    /** Common lookup path by resource. */
    resourceUsageCountersBizResourceIdx: index(
      "resource_usage_counters_biz_resource_idx",
    ).on(table.bizId, table.resourceId),

    /** Tenant-safe FK to resources. */
    resourceUsageCountersBizResourceFk: foreignKey({
      columns: [table.bizId, table.resourceId],
      foreignColumns: [resources.bizId, resources.id],
      name: "resource_usage_counters_biz_resource_fk",
    }),

    /** Counter values cannot be negative. */
    resourceUsageCountersNonNegativeCheck: check(
      "resource_usage_counters_non_negative_check",
      sql`"current_value" >= 0`,
    ),
  }),
);

/**
 * resource_maintenance_policies
 *
 * ELI5:
 * A maintenance policy says "when X happens, do Y" for resource health.
 *
 * Examples:
 * - after 40 usage-hours, create a work order,
 * - every 90 days, block resource until inspection completes.
 *
 * Scope model:
 * - `resource_id` => specific resource
 * - `capability_template_id` => all resources with that capability
 * - `scope_resource_type` => all resources of one type
 */
export const resourceMaintenancePolicies = pgTable(
  "resource_maintenance_policies",
  {
    /** Stable primary key for policy row. */
    id: idWithTag("maintenance_policy"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Optional direct resource scope. */
    resourceId: idRef("resource_id").references(() => resources.id),

    /** Optional capability scope. */
    capabilityTemplateId: idRef("capability_template_id").references(
      () => resourceCapabilityTemplates.id,
    ),

    /** Optional broad type scope. */
    scopeResourceType: resourceCapabilityScopeEnum("scope_resource_type"),

    /** Human policy label for operations UI. */
    name: varchar("name", { length: 200 }).notNull(),

    /** Stable slug for import/export APIs and audit traces. */
    slug: varchar("slug", { length: 140 }).notNull(),

    /** Trigger kind that determines how threshold fields are interpreted. */
    triggerType: maintenanceTriggerTypeEnum("trigger_type").notNull(),

    /**
     * Numeric threshold used for usage/days triggers.
     * Example: 40 hours, 100 scans, 90 days.
     */
    thresholdValue: integer("threshold_value"),

    /**
     * Optional schedule expression for calendar-date triggers.
     * Example: CRON-ish or business-specific expression parser format.
     */
    triggerExpression: varchar("trigger_expression", { length: 300 }),

    /** Action taken when trigger evaluates true. */
    actionType: maintenanceActionTypeEnum("action_type").notNull(),

    /** Whether to auto-generate maintenance work orders. */
    autoCreateWorkOrder: boolean("auto_create_work_order")
      .default(true)
      .notNull(),

    /** Whether scheduling should block this resource until resolution. */
    blockUntilCompleted: boolean("block_until_completed")
      .default(false)
      .notNull(),

    /** Activation toggle for policy rollout/retirement. */
    isActive: boolean("is_active").default(true).notNull(),

    /** Optional operator notes/documentation text. */
    notes: text("notes"),

    /** Extension payload for future maintenance automation knobs. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite unique target for tenant-safe child FKs. */
    resourceMaintenancePoliciesBizIdIdUnique: uniqueIndex(
      "resource_maintenance_policies_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** Slug uniqueness per tenant. */
    resourceMaintenancePoliciesBizSlugUnique: uniqueIndex(
      "resource_maintenance_policies_biz_slug_unique",
    ).on(table.bizId, table.slug),

    /** Common filter path for policy workers. */
    resourceMaintenancePoliciesBizActiveIdx: index(
      "resource_maintenance_policies_biz_active_idx",
    ).on(table.bizId, table.isActive),

    /** Tenant-safe FK for resource scope. */
    resourceMaintenancePoliciesBizResourceFk: foreignKey({
      columns: [table.bizId, table.resourceId],
      foreignColumns: [resources.bizId, resources.id],
      name: "resource_maintenance_policies_biz_resource_fk",
    }),

    /** Tenant-safe FK for capability scope. */
    resourceMaintenancePoliciesBizCapabilityFk: foreignKey({
      columns: [table.bizId, table.capabilityTemplateId],
      foreignColumns: [resourceCapabilityTemplates.bizId, resourceCapabilityTemplates.id],
      name: "resource_maintenance_policies_biz_capability_fk",
    }),

    /**
     * Policy must target at least one scope type.
     * This prevents orphan policies that can never be evaluated.
     */
    resourceMaintenancePoliciesScopeCheck: check(
      "resource_maintenance_policies_scope_check",
      sql`
      "resource_id" IS NOT NULL
      OR "capability_template_id" IS NOT NULL
      OR "scope_resource_type" IS NOT NULL
      `,
    ),

    /** Trigger thresholds must be positive when provided. */
    resourceMaintenancePoliciesThresholdPositiveCheck: check(
      "resource_maintenance_policies_threshold_positive_check",
      sql`"threshold_value" IS NULL OR "threshold_value" > 0`,
    ),

    /** Trigger payload shape validation by trigger type. */
    resourceMaintenancePoliciesTriggerShapeCheck: check(
      "resource_maintenance_policies_trigger_shape_check",
      sql`
      (
        "trigger_type" IN ('usage_hours', 'usage_count', 'elapsed_days')
        AND "threshold_value" IS NOT NULL
      ) OR (
        "trigger_type" = 'calendar_date'
        AND "trigger_expression" IS NOT NULL
      ) OR (
        "trigger_type" = 'manual'
      )
      `,
    ),
  }),
);

/**
 * resource_maintenance_work_orders
 *
 * ELI5:
 * This is the operational "ticket" generated for maintenance work.
 * Schedulers can look here to decide if a resource should be blocked.
 */
export const resourceMaintenanceWorkOrders = pgTable(
  "resource_maintenance_work_orders",
  {
    /** Stable primary key. */
    id: idWithTag("maintenance_work_order"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Resource being serviced. */
    resourceId: idRef("resource_id")
      .references(() => resources.id)
      .notNull(),

    /** Optional originating policy if this was auto-generated. */
    policyId: idRef("policy_id").references(() => resourceMaintenancePolicies.id),

    /**
     * Optional calendar explicitly affected by this work order.
     *
     * Why this exists:
     * - makes maintenance blackout scope explicit at data level,
     * - allows APIs to answer "which calendar was impacted?" directly.
     */
    calendarId: idRef("calendar_id").references(() => calendars.id),

    /**
     * Optional pointer to normalized timeline interval emitted for this work
     * order's availability impact.
     *
     * This strengthens cross-domain traceability from operations -> calendar UI.
     */
    calendarTimelineEventId: idRef("calendar_timeline_event_id").references(
      () => calendarTimelineEvents.id,
    ),

    /** Work order title for dashboards/lists. */
    title: varchar("title", { length: 220 }).notNull(),

    /** Optional detailed work instruction text. */
    description: text("description"),

    /** Operational status for workflow progression. */
    status: maintenanceWorkOrderStatusEnum("status").default("open").notNull(),

    /** Simple priority scalar for sorting queues (lower can mean higher priority). */
    priority: integer("priority").default(100).notNull(),

    /** Open time marker for SLA metrics. */
    openedAt: timestamp("opened_at", { withTimezone: true }).defaultNow().notNull(),

    /** Planned service start. */
    scheduledStartAt: timestamp("scheduled_start_at", { withTimezone: true }),

    /** Planned service end. */
    scheduledEndAt: timestamp("scheduled_end_at", { withTimezone: true }),

    /** Actual service start. */
    startedAt: timestamp("started_at", { withTimezone: true }),

    /** Actual completion timestamp. */
    completedAt: timestamp("completed_at", { withTimezone: true }),

    /** Explicit cancellation timestamp. */
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),

    /**
     * Indicates if availability should treat this resource as blocked while open.
     * This drives maintenance blackout overlays in calendar resolution.
     */
    blocksAvailability: boolean("blocks_availability").default(true).notNull(),

    /** Optional resolution summary for postmortem/audit context. */
    resolutionNotes: text("resolution_notes"),

    /** Extension payload for integration/system attributes. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    resourceMaintenanceWorkOrdersBizIdIdUnique: uniqueIndex("resource_maintenance_work_orders_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Common query path for open work in one tenant. */
    resourceMaintenanceWorkOrdersBizStatusIdx: index(
      "resource_maintenance_work_orders_biz_status_idx",
    ).on(table.bizId, table.status, table.priority),

    /** Common lookup for one resource maintenance timeline. */
    resourceMaintenanceWorkOrdersBizResourceIdx: index(
      "resource_maintenance_work_orders_biz_resource_idx",
    ).on(table.bizId, table.resourceId),

    /** Calendar-level maintenance board query path. */
    resourceMaintenanceWorkOrdersBizCalendarIdx: index(
      "resource_maintenance_work_orders_biz_calendar_idx",
    ).on(table.bizId, table.calendarId, table.status, table.scheduledStartAt),

    /** Tenant-safe FK to resource. */
    resourceMaintenanceWorkOrdersBizResourceFk: foreignKey({
      columns: [table.bizId, table.resourceId],
      foreignColumns: [resources.bizId, resources.id],
      name: "resource_maintenance_work_orders_biz_resource_fk",
    }),

    /** Tenant-safe FK to source policy. */
    resourceMaintenanceWorkOrdersBizPolicyFk: foreignKey({
      columns: [table.bizId, table.policyId],
      foreignColumns: [resourceMaintenancePolicies.bizId, resourceMaintenancePolicies.id],
      name: "resource_maintenance_work_orders_biz_policy_fk",
    }),

    /** Tenant-safe FK to optional impacted calendar. */
    resourceMaintenanceWorkOrdersBizCalendarFk: foreignKey({
      columns: [table.bizId, table.calendarId],
      foreignColumns: [calendars.bizId, calendars.id],
      name: "resource_maintenance_work_orders_biz_calendar_fk",
    }),

    /** Tenant-safe FK to optional projected calendar timeline row. */
    resourceMaintenanceWorkOrdersBizTimelineEventFk: foreignKey({
      columns: [table.bizId, table.calendarTimelineEventId],
      foreignColumns: [calendarTimelineEvents.bizId, calendarTimelineEvents.id],
      name: "resource_maintenance_work_orders_biz_timeline_event_fk",
    }),

    /** Planned schedule window must be ordered when both are present. */
    resourceMaintenanceWorkOrdersScheduleWindowCheck: check(
      "resource_maintenance_work_orders_schedule_window_check",
      sql`"scheduled_start_at" IS NULL OR "scheduled_end_at" IS NULL OR "scheduled_end_at" > "scheduled_start_at"`,
    ),

    /** Actual start should not be after completion/cancellation if both present. */
    resourceMaintenanceWorkOrdersTimelineCheck: check(
      "resource_maintenance_work_orders_timeline_check",
      sql`
      ("started_at" IS NULL OR "completed_at" IS NULL OR "completed_at" >= "started_at")
      AND ("started_at" IS NULL OR "cancelled_at" IS NULL OR "cancelled_at" >= "started_at")
      `,
    ),

    /**
     * If this work order is configured to block availability, at least one
     * explicit calendar linkage should be present.
     */
    resourceMaintenanceWorkOrdersBlockingLinkageCheck: check(
      "resource_maintenance_work_orders_blocking_linkage_check",
      sql`
      "blocks_availability" = false
      OR "calendar_id" IS NOT NULL
      OR "calendar_timeline_event_id" IS NOT NULL
      `,
    ),
  }),
);

/**
 * resource_condition_reports
 *
 * ELI5:
 * A condition report captures evidence about a resource state before/after use
 * or during incidents. This is crucial for rentals, liability, and disputes.
 *
 * Future improvement note:
 * if external media pipelines mature, store only canonical media IDs here and
 * move file metadata to a dedicated media service table.
 */
export const resourceConditionReports = pgTable(
  "resource_condition_reports",
  {
    /** Stable primary key for condition report row. */
    id: idWithTag("condition_report"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Resource being inspected/reported on. */
    resourceId: idRef("resource_id")
      .references(() => resources.id)
      .notNull(),

    /** Type of report lifecycle stage. */
    reportType: resourceConditionReportTypeEnum("report_type").notNull(),

    /** Optional reporter user identity for accountability. */
    reporterUserId: idRef("reporter_user_id").references(() => users.id),

    /** Event time when the report was captured. */
    reportedAt: timestamp("reported_at", { withTimezone: true }).defaultNow().notNull(),

    /** Severity score (1 low impact .. 5 critical). */
    severity: integer("severity").default(1).notNull(),

    /** Short summary for timeline readability. */
    summary: varchar("summary", { length: 280 }).notNull(),

    /** Optional long-form notes. */
    notes: text("notes"),

    /** Structured checklist values (e.g., scratches, cleanliness, fuel, etc.). */
    checklist: jsonb("checklist").default({}),

    /** Media references (photos/videos/docs) captured as evidence. */
    mediaEvidence: jsonb("media_evidence").default([]),

    /** Resolution timestamp if an incident was remediated. */
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),

    /** Extension payload for domain-specific condition fields. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    resourceConditionReportsBizIdIdUnique: uniqueIndex("resource_condition_reports_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Common query path for per-resource condition timelines. */
    resourceConditionReportsBizResourceIdx: index(
      "resource_condition_reports_biz_resource_idx",
    ).on(table.bizId, table.resourceId, table.reportedAt),

    /** Common queue path for unresolved critical issues. */
    resourceConditionReportsBizSeverityIdx: index(
      "resource_condition_reports_biz_severity_idx",
    ).on(table.bizId, table.severity, table.resolvedAt),

    /** Tenant-safe FK to resource. */
    resourceConditionReportsBizResourceFk: foreignKey({
      columns: [table.bizId, table.resourceId],
      foreignColumns: [resources.bizId, resources.id],
      name: "resource_condition_reports_biz_resource_fk",
    }),

    /** Tenant-safe FK to reporter. */
    resourceConditionReportsReporterFk: foreignKey({
      columns: [table.reporterUserId],
      foreignColumns: [users.id],
      name: "resource_condition_reports_reporter_fk",
    }),

    /** Severity must remain in 1..5 range. */
    resourceConditionReportsSeverityCheck: check(
      "resource_condition_reports_severity_check",
      sql`"severity" >= 1 AND "severity" <= 5`,
    ),

    /** Resolution cannot be before report time. */
    resourceConditionReportsResolvedAfterReportedCheck: check(
      "resource_condition_reports_resolved_after_reported_check",
      sql`"resolved_at" IS NULL OR "resolved_at" >= "reported_at"`,
    ),
  }),
);

export type ResourceCapabilityTemplate = typeof resourceCapabilityTemplates.$inferSelect;
export type NewResourceCapabilityTemplate = typeof resourceCapabilityTemplates.$inferInsert;
