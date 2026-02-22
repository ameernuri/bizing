import { sql } from "drizzle-orm";
import { check, foreignKey, index, uniqueIndex } from "drizzle-orm/pg-core";
import {
  AnyPgColumn,
  boolean,
  doublePrecision,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { idRef, idWithTag, withAuditRefs } from "./_common";
import { bizes } from "./bizes";
import { bizExtensionInstalls, idempotencyKeys } from "./extensions";
import { groupAccounts } from "./group_accounts";
import { staffingAssignments } from "./intelligence";
import { locations } from "./locations";
import { resources } from "./resources";
import { users } from "./users";
import {
  customFieldTargetTypeEnum,
  interactionArtifactTypeEnum,
  lifecycleStatusEnum,
  workApprovalAssigneeTypeEnum,
  workApprovalDecisionEnum,
  workApprovalRoutingModeEnum,
  workClockSourceEnum,
  workEntryStatusEnum,
  workEntryTypeEnum,
  workRunStatusEnum,
  workStepStatusEnum,
  workStepTypeEnum,
  workTemplateKindEnum,
  workTimeSegmentTypeEnum,
} from "./enums";
import { bizConfigValues } from "./biz_configs";

/**
 * work_templates
 *
 * ELI5:
 * Think of this as a reusable blueprint for "how work is recorded and approved".
 *
 * One template system can power many scenarios:
 * - daily site report,
 * - employee timesheet,
 * - inspection form,
 * - quality punch list,
 * - multi-party signoff packet.
 *
 * Why this matters for fungibility:
 * - businesses in very different industries still use the same core tables,
 * - new vertical use cases can be modeled by new template config rather than
 *   adding another hardcoded table family.
 */
export const workTemplates = pgTable(
  "work_templates",
  {
    /** Stable primary key for one immutable template version. */
    id: idWithTag("work_template"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Optional extension owner for plugin-defined templates. */
    bizExtensionInstallId: idRef("biz_extension_install_id").references(
      () => bizExtensionInstalls.id,
    ),

    /** Template family class (timesheet/report/checklist/etc.). */
    kind: workTemplateKindEnum("kind").notNull(),
    /**
     * Optional biz-config dictionary value for template-kind vocabulary.
     */
    kindConfigValueId: idRef("kind_config_value_id").references(
      () => bizConfigValues.id,
    ),

    /** Human-readable template name. */
    name: varchar("name", { length: 220 }).notNull(),

    /** Stable machine key for APIs/import/export and grouping versions. */
    slug: varchar("slug", { length: 140 }).notNull(),

    /**
     * Immutable version in one `(biz_id, slug)` family.
     * New edits should create new versions, not mutate history.
     */
    version: integer("version").default(1).notNull(),

    /** Lifecycle state of this specific version. */
    status: lifecycleStatusEnum("status").default("draft").notNull(),
    /**
     * Optional biz-config dictionary value for template-status wording.
     */
    statusConfigValueId: idRef("status_config_value_id").references(
      () => bizConfigValues.id,
    ),

    /** Flag for the active default version in a slug family. */
    isCurrent: boolean("is_current").default(false).notNull(),

    /** Optional title rendered in worker/customer UI. */
    title: varchar("title", { length: 320 }),

    /** Optional long description/instructions. */
    description: text("description"),

    /**
     * Template schema payload:
     * - field/section layout,
     * - default values,
     * - visibility rules,
     * - client render hints.
     */
    schema: jsonb("schema").default({}).notNull(),

    /**
     * Validation and completion policy:
     * - required steps,
     * - dependency rules,
     * - evidence requirements,
     * - approval thresholds.
     */
    policy: jsonb("policy").default({}).notNull(),

    /** Optional effective-from timestamp for phased rollouts. */
    effectiveFrom: timestamp("effective_from", { withTimezone: true }),

    /** Optional effective-to timestamp for sunset windows. */
    effectiveTo: timestamp("effective_to", { withTimezone: true }),

    /** Extension payload for future knobs not yet normalized. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    workTemplatesBizIdIdUnique: uniqueIndex("work_templates_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Composite unique key for tenant-safe downstream references. */

    /** One immutable version per slug/version tuple. */
    workTemplatesBizSlugVersionUnique: uniqueIndex(
      "work_templates_biz_slug_version_unique",
    ).on(table.bizId, table.slug, table.version),

    /** One current template version per slug. */
    workTemplatesBizSlugCurrentUnique: uniqueIndex(
      "work_templates_biz_slug_current_unique",
    )
      .on(table.bizId, table.slug)
      .where(sql`"is_current" = true`),

    /** Common admin listing path. */
    workTemplatesBizKindStatusIdx: index("work_templates_biz_kind_status_idx").on(
      table.bizId,
      table.kind,
      table.status,
      table.isCurrent,
    ),
    workTemplatesBizKindConfigIdx: index("work_templates_biz_kind_config_idx").on(
      table.bizId,
      table.kindConfigValueId,
    ),
    workTemplatesBizStatusConfigIdx: index(
      "work_templates_biz_status_config_idx",
    ).on(table.bizId, table.statusConfigValueId),

    /** Tenant-safe FK to optional extension owner. */
    workTemplatesBizInstallFk: foreignKey({
      columns: [table.bizId, table.bizExtensionInstallId],
      foreignColumns: [bizExtensionInstalls.bizId, bizExtensionInstalls.id],
      name: "work_templates_biz_install_fk",
    }),
    /** Tenant-safe FK to optional configurable template-kind value. */
    workTemplatesBizKindConfigFk: foreignKey({
      columns: [table.bizId, table.kindConfigValueId],
      foreignColumns: [bizConfigValues.bizId, bizConfigValues.id],
      name: "work_templates_biz_kind_config_fk",
    }),
    /** Tenant-safe FK to optional configurable template-status value. */
    workTemplatesBizStatusConfigFk: foreignKey({
      columns: [table.bizId, table.statusConfigValueId],
      foreignColumns: [bizConfigValues.bizId, bizConfigValues.id],
      name: "work_templates_biz_status_config_fk",
    }),

    /** Version and window sanity checks. */
    workTemplatesBoundsCheck: check(
      "work_templates_bounds_check",
      sql`
      "version" >= 1
      AND (
        "effective_from" IS NULL
        OR "effective_to" IS NULL
        OR "effective_to" > "effective_from"
      )
      `,
    ),
  }),
);

/**
 * work_template_steps
 *
 * ELI5:
 * Each row defines one reusable step in the template.
 *
 * Examples:
 * - "Take front facade photo"
 * - "Enter crew count"
 * - "Sign safety attestation"
 * - "Supervisor approval gate"
 */
export const workTemplateSteps = pgTable(
  "work_template_steps",
  {
    /** Stable primary key for one template step definition. */
    id: idWithTag("work_template_step"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent template. */
    workTemplateId: idRef("work_template_id")
      .references(() => workTemplates.id)
      .notNull(),

    /** Stable step key used by API payloads and dependencies. */
    stepKey: varchar("step_key", { length: 120 }).notNull(),

    /** Step type. */
    stepType: workStepTypeEnum("step_type").default("field").notNull(),

    /** Human-facing label. */
    label: varchar("label", { length: 260 }).notNull(),

    /** Optional long instructions for assignees. */
    instructions: text("instructions"),

    /** Required steps block completion until satisfied. */
    isRequired: boolean("is_required").default(true).notNull(),

    /**
     * Optional dependency by step key.
     * Keeps graph editable without self-FK migration coupling.
     */
    dependsOnStepKey: varchar("depends_on_step_key", { length: 120 }),

    /** UI execution order hint. */
    sortOrder: integer("sort_order").default(100).notNull(),

    /** Step configuration payload (field types, constraints, prompt config). */
    definition: jsonb("definition").default({}).notNull(),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    workTemplateStepsBizIdIdUnique: uniqueIndex("work_template_steps_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Composite key for tenant-safe references to this template-step row. */

    /** One step key per template. */
    workTemplateStepsUnique: uniqueIndex("work_template_steps_unique").on(
      table.workTemplateId,
      table.stepKey,
    ),

    /** Common path for rendering/execution plans. */
    workTemplateStepsBizTemplateSortIdx: index(
      "work_template_steps_biz_template_sort_idx",
    ).on(table.bizId, table.workTemplateId, table.sortOrder),

    /** Tenant-safe FK to template. */
    workTemplateStepsBizTemplateFk: foreignKey({
      columns: [table.bizId, table.workTemplateId],
      foreignColumns: [workTemplates.bizId, workTemplates.id],
      name: "work_template_steps_biz_template_fk",
    }),

    /** Sort order must be non-negative. */
    workTemplateStepsSortOrderCheck: check(
      "work_template_steps_sort_order_check",
      sql`"sort_order" >= 0`,
    ),
  }),
);

/**
 * work_runs
 *
 * ELI5:
 * One row = one real execution instance of a work template.
 *
 * Example instances:
 * - "Daily report for Project P on 2026-02-20"
 * - "Timesheet run for Employee E this shift"
 * - "Safety inspection for Forklift FL-042"
 */
export const workRuns = pgTable(
  "work_runs",
  {
    /** Stable primary key for one work execution instance. */
    id: idWithTag("work_run"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Template version used for this run. */
    workTemplateId: idRef("work_template_id")
      .references(() => workTemplates.id)
      .notNull(),

    /** Optional parent run for nested workflows. */
    parentWorkRunId: idRef("parent_work_run_id").references(
      (): AnyPgColumn => workRuns.id,
    ),

    /**
     * Business target this run belongs to.
     * This keeps work workflows attachable to almost any entity.
     */
    targetType: customFieldTargetTypeEnum("target_type").notNull(),

    /** Canonical target id. */
    targetRefId: varchar("target_ref_id", { length: 140 }).notNull(),

    /** Optional location scope for routing and analytics. */
    locationId: idRef("location_id").references(() => locations.id),

    /** Optional resource scope (vehicle/equipment/host/site asset). */
    resourceId: idRef("resource_id").references(() => resources.id),

    /** Optional primary assignee user. */
    assigneeUserId: idRef("assignee_user_id").references(() => users.id),

    /** Optional primary assignee group. */
    assigneeGroupAccountId: idRef("assignee_group_account_id").references(
      () => groupAccounts.id,
    ),

    /** Execution lifecycle status. */
    status: workRunStatusEnum("status").default("draft").notNull(),
    /**
     * Optional biz-config dictionary value for run-status wording.
     */
    statusConfigValueId: idRef("status_config_value_id").references(
      () => bizConfigValues.id,
    ),

    /** Priority hint for operational queues. */
    priority: integer("priority").default(100).notNull(),

    /** Optional due deadline. */
    dueAt: timestamp("due_at", { withTimezone: true }),

    /** Start timestamp when active work begins. */
    startedAt: timestamp("started_at", { withTimezone: true }),

    /** Submit timestamp for approval review. */
    submittedAt: timestamp("submitted_at", { withTimezone: true }),

    /** Final completion timestamp. */
    completedAt: timestamp("completed_at", { withTimezone: true }),

    /** Optional idempotency linkage for deterministic run creation/retry. */
    idempotencyKeyId: idRef("idempotency_key_id").references(() => idempotencyKeys.id),

    /**
     * Snapshot payload of the resolved policy/context at creation.
     * Prevents behavior drift if templates change later.
     */
    policySnapshot: jsonb("policy_snapshot").default({}).notNull(),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    workRunsBizIdIdUnique: uniqueIndex("work_runs_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Composite key for tenant-safe child references. */

    /** Common operational queue path. */
    workRunsBizStatusDuePriorityIdx: index("work_runs_biz_status_due_priority_idx").on(
      table.bizId,
      table.status,
      table.dueAt,
      table.priority,
    ),
    workRunsBizStatusConfigIdx: index("work_runs_biz_status_config_idx").on(
      table.bizId,
      table.statusConfigValueId,
    ),

    /** Common path for target-centric work queries. */
    workRunsBizTargetStatusIdx: index("work_runs_biz_target_status_idx").on(
      table.bizId,
      table.targetType,
      table.targetRefId,
      table.status,
    ),

    /** Tenant-safe FK to template. */
    workRunsBizTemplateFk: foreignKey({
      columns: [table.bizId, table.workTemplateId],
      foreignColumns: [workTemplates.bizId, workTemplates.id],
      name: "work_runs_biz_template_fk",
    }),

    /** Tenant-safe FK to optional location scope. */
    workRunsBizLocationFk: foreignKey({
      columns: [table.bizId, table.locationId],
      foreignColumns: [locations.bizId, locations.id],
      name: "work_runs_biz_location_fk",
    }),

    /** Tenant-safe FK to optional resource scope. */
    workRunsBizResourceFk: foreignKey({
      columns: [table.bizId, table.resourceId],
      foreignColumns: [resources.bizId, resources.id],
      name: "work_runs_biz_resource_fk",
    }),

    /** Tenant-safe FK to optional idempotency key. */
    workRunsBizIdempotencyKeyFk: foreignKey({
      columns: [table.bizId, table.idempotencyKeyId],
      foreignColumns: [idempotencyKeys.bizId, idempotencyKeys.id],
      name: "work_runs_biz_idempotency_key_fk",
    }),
    /** Tenant-safe FK to optional configurable run-status value. */
    workRunsBizStatusConfigFk: foreignKey({
      columns: [table.bizId, table.statusConfigValueId],
      foreignColumns: [bizConfigValues.bizId, bizConfigValues.id],
      name: "work_runs_biz_status_config_fk",
    }),

    /** Priority and timestamp ordering checks. */
    workRunsBoundsAndWindowCheck: check(
      "work_runs_bounds_and_window_check",
      sql`
      "priority" >= 0
      AND ("submitted_at" IS NULL OR "started_at" IS NULL OR "submitted_at" >= "started_at")
      AND ("completed_at" IS NULL OR "started_at" IS NULL OR "completed_at" >= "started_at")
      `,
    ),
  }),
);

/**
 * work_run_steps
 *
 * ELI5:
 * Runtime status of each template step in one work run.
 */
export const workRunSteps = pgTable(
  "work_run_steps",
  {
    /** Stable primary key for runtime step row. */
    id: idWithTag("work_run_step"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent run. */
    workRunId: idRef("work_run_id")
      .references(() => workRuns.id)
      .notNull(),

    /** Source template step definition. */
    workTemplateStepId: idRef("work_template_step_id")
      .references(() => workTemplateSteps.id)
      .notNull(),

    /** Runtime step state. */
    status: workStepStatusEnum("status").default("pending").notNull(),
    /**
     * Optional biz-config dictionary value for run-step status wording.
     */
    statusConfigValueId: idRef("status_config_value_id").references(
      () => bizConfigValues.id,
    ),

    /** Runtime start timestamp. */
    startedAt: timestamp("started_at", { withTimezone: true }),

    /** Runtime completion timestamp. */
    completedAt: timestamp("completed_at", { withTimezone: true }),

    /** Optional actor who completed or updated this step. */
    completedByUserId: idRef("completed_by_user_id").references(() => users.id),

    /** Runtime result payload for structured outcomes. */
    result: jsonb("result").default({}).notNull(),

    /** Optional notes specific to this step instance. */
    notes: text("notes"),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    workRunStepsBizIdIdUnique: uniqueIndex("work_run_steps_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Composite key for tenant-safe references to this run-step row. */

    /** One runtime row per template step in each run. */
    workRunStepsUnique: uniqueIndex("work_run_steps_unique").on(
      table.workRunId,
      table.workTemplateStepId,
    ),

    /** Common run detail path. */
    workRunStepsBizRunStatusIdx: index("work_run_steps_biz_run_status_idx").on(
      table.bizId,
      table.workRunId,
      table.status,
    ),
    workRunStepsBizStatusConfigIdx: index("work_run_steps_biz_status_config_idx").on(
      table.bizId,
      table.statusConfigValueId,
    ),

    /** Tenant-safe FK to parent run. */
    workRunStepsBizRunFk: foreignKey({
      columns: [table.bizId, table.workRunId],
      foreignColumns: [workRuns.bizId, workRuns.id],
      name: "work_run_steps_biz_run_fk",
    }),

    /** Tenant-safe FK to template step. */
    workRunStepsBizTemplateStepFk: foreignKey({
      columns: [table.bizId, table.workTemplateStepId],
      foreignColumns: [workTemplateSteps.bizId, workTemplateSteps.id],
      name: "work_run_steps_biz_template_step_fk",
    }),
    /** Tenant-safe FK to optional configurable run-step status value. */
    workRunStepsBizStatusConfigFk: foreignKey({
      columns: [table.bizId, table.statusConfigValueId],
      foreignColumns: [bizConfigValues.bizId, bizConfigValues.id],
      name: "work_run_steps_biz_status_config_fk",
    }),

    /** Window ordering check. */
    workRunStepsWindowCheck: check(
      "work_run_steps_window_check",
      sql`"completed_at" IS NULL OR "started_at" IS NULL OR "completed_at" >= "started_at"`,
    ),
  }),
);

/**
 * work_entries
 *
 * ELI5:
 * This is the flexible log table for "what happened during this work run".
 *
 * It can represent:
 * - labor time entries,
 * - material usage,
 * - expense/mileage records,
 * - incidents and observations,
 * - weather notes and measurements.
 */
export const workEntries = pgTable(
  "work_entries",
  {
    /** Stable primary key. */
    id: idWithTag("work_entry"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent run. */
    workRunId: idRef("work_run_id")
      .references(() => workRuns.id)
      .notNull(),

    /** Optional related run-step. */
    workRunStepId: idRef("work_run_step_id").references(() => workRunSteps.id),

    /** Entry category. */
    entryType: workEntryTypeEnum("entry_type").notNull(),

    /** Entry moderation state. */
    status: workEntryStatusEnum("status").default("logged").notNull(),
    /**
     * Optional biz-config dictionary value for work-entry status wording.
     */
    statusConfigValueId: idRef("status_config_value_id").references(
      () => bizConfigValues.id,
    ),

    /** Event occurrence time. */
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .defaultNow()
      .notNull(),

    /** Optional start timestamp for duration-style entries. */
    startsAt: timestamp("starts_at", { withTimezone: true }),

    /** Optional end timestamp for duration-style entries. */
    endsAt: timestamp("ends_at", { withTimezone: true }),

    /** Optional computed duration in minutes. */
    durationMin: integer("duration_min"),

    /**
     * Optional quantitative measure (hours, miles, units, etc.).
     *
     * Fixed-precision numeric is used instead of floating point so totals and
     * comparisons stay deterministic across payroll/invoice workflows.
     */
    quantity: numeric("quantity", { precision: 18, scale: 6 }),

    /** Unit label for quantity (hours, miles, units, etc.). */
    quantityUnit: varchar("quantity_unit", { length: 40 }),

    /** Optional amount in minor units for reimbursable/chargeable entries. */
    amountMinor: integer("amount_minor"),

    /** Currency for monetary values. */
    currency: varchar("currency", { length: 3 }).default("USD").notNull(),

    /** Optional geolocation latitude for field evidence. */
    geoLat: doublePrecision("geo_lat"),

    /** Optional geolocation longitude for field evidence. */
    geoLng: doublePrecision("geo_lng"),

    /** Freeform textual note. */
    note: text("note"),

    /** Structured payload for type-specific details. */
    payload: jsonb("payload").default({}).notNull(),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    workEntriesBizIdIdUnique: uniqueIndex("work_entries_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Composite key for tenant-safe references to this work-entry row. */

    /** Common run timeline query path. */
    workEntriesBizRunOccurredIdx: index("work_entries_biz_run_occurred_idx").on(
      table.bizId,
      table.workRunId,
      table.occurredAt,
    ),

    /** Common type analytics path. */
    workEntriesBizTypeOccurredIdx: index("work_entries_biz_type_occurred_idx").on(
      table.bizId,
      table.entryType,
      table.occurredAt,
    ),
    workEntriesBizStatusConfigIdx: index("work_entries_biz_status_config_idx").on(
      table.bizId,
      table.statusConfigValueId,
      table.occurredAt,
    ),

    /** Tenant-safe FK to run. */
    workEntriesBizRunFk: foreignKey({
      columns: [table.bizId, table.workRunId],
      foreignColumns: [workRuns.bizId, workRuns.id],
      name: "work_entries_biz_run_fk",
    }),

    /** Tenant-safe FK to optional run-step. */
    workEntriesBizRunStepFk: foreignKey({
      columns: [table.bizId, table.workRunStepId],
      foreignColumns: [workRunSteps.bizId, workRunSteps.id],
      name: "work_entries_biz_run_step_fk",
    }),
    /** Tenant-safe FK to optional configurable work-entry status value. */
    workEntriesBizStatusConfigFk: foreignKey({
      columns: [table.bizId, table.statusConfigValueId],
      foreignColumns: [bizConfigValues.bizId, bizConfigValues.id],
      name: "work_entries_biz_status_config_fk",
    }),

    /** Numeric and window sanity checks. */
    workEntriesBoundsCheck: check(
      "work_entries_bounds_check",
      sql`
      ("duration_min" IS NULL OR "duration_min" >= 0)
      AND ("quantity" IS NULL OR "quantity" >= 0)
      AND ("amount_minor" IS NULL OR "amount_minor" >= 0)
      AND ("ends_at" IS NULL OR "starts_at" IS NULL OR "ends_at" >= "starts_at")
      `,
    ),

    /** Currency should always be uppercase ISO-4217 format. */
    workEntriesCurrencyFormatCheck: check(
      "work_entries_currency_format_check",
      sql`"currency" ~ '^[A-Z]{3}$'`,
    ),

    /** Geolocation bounds when coordinates are provided. */
    workEntriesGeoBoundsCheck: check(
      "work_entries_geo_bounds_check",
      sql`
      ("geo_lat" IS NULL OR ("geo_lat" >= -90 AND "geo_lat" <= 90))
      AND ("geo_lng" IS NULL OR ("geo_lng" >= -180 AND "geo_lng" <= 180))
      `,
    ),
  }),
);

/**
 * work_time_segments
 *
 * ELI5:
 * Purpose-built time segments for payroll-grade clock-in/out tracking.
 *
 * Why separate from `work_entries`:
 * - timekeeping needs strict in/out semantics,
 * - geofence evidence and approval flow are common,
 * - downstream payroll integrations need deterministic fields.
 */
export const workTimeSegments = pgTable(
  "work_time_segments",
  {
    /** Stable primary key. */
    id: idWithTag("time_segment"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent run (usually a timesheet run). */
    workRunId: idRef("work_run_id")
      .references(() => workRuns.id)
      .notNull(),

    /** Worker/user this segment belongs to. */
    userId: idRef("user_id")
      .references(() => users.id)
      .notNull(),

    /** Segment type (work/break/travel/etc.). */
    segmentType: workTimeSegmentTypeEnum("segment_type").default("work").notNull(),

    /** Source system of the clock event. */
    clockSource: workClockSourceEnum("clock_source").default("mobile").notNull(),

    /** Clock-in timestamp. */
    clockInAt: timestamp("clock_in_at", { withTimezone: true }).notNull(),

    /** Clock-out timestamp. */
    clockOutAt: timestamp("clock_out_at", { withTimezone: true }),

    /** Optional break minutes attributed within this segment. */
    breakMinutes: integer("break_minutes").default(0).notNull(),

    /** Optional clock-in latitude. */
    clockInLat: doublePrecision("clock_in_lat"),

    /** Optional clock-in longitude. */
    clockInLng: doublePrecision("clock_in_lng"),

    /** Optional clock-out latitude. */
    clockOutLat: doublePrecision("clock_out_lat"),

    /** Optional clock-out longitude. */
    clockOutLng: doublePrecision("clock_out_lng"),

    /** True when geofence validation passed at clock-in. */
    isClockInWithinGeofence: boolean("is_clock_in_within_geofence"),

    /** True when geofence validation passed at clock-out. */
    isClockOutWithinGeofence: boolean("is_clock_out_within_geofence"),

    /** Optional geofence policy reference key. */
    geofencePolicyRef: varchar("geofence_policy_ref", { length: 200 }),

    /** Optional user who approved edit/correction. */
    approvedByUserId: idRef("approved_by_user_id").references(() => users.id),

    /** Optional approval timestamp. */
    approvedAt: timestamp("approved_at", { withTimezone: true }),

    /** Optional note for manual corrections. */
    correctionNote: text("correction_note"),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    workTimeSegmentsBizIdIdUnique: uniqueIndex("work_time_segments_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Composite key for tenant-safe references to this time-segment row. */

    /** Common payroll extraction path. */
    workTimeSegmentsBizUserClockInIdx: index("work_time_segments_biz_user_clock_in_idx").on(
      table.bizId,
      table.userId,
      table.clockInAt,
    ),

    /** Run timeline path. */
    workTimeSegmentsBizRunClockInIdx: index("work_time_segments_biz_run_clock_in_idx").on(
      table.bizId,
      table.workRunId,
      table.clockInAt,
    ),

    /** Tenant-safe FK to parent run. */
    workTimeSegmentsBizRunFk: foreignKey({
      columns: [table.bizId, table.workRunId],
      foreignColumns: [workRuns.bizId, workRuns.id],
      name: "work_time_segments_biz_run_fk",
    }),

    /** Positive/minimum bounds and time ordering checks. */
    workTimeSegmentsBoundsCheck: check(
      "work_time_segments_bounds_check",
      sql`
      "break_minutes" >= 0
      AND ("clock_out_at" IS NULL OR "clock_out_at" >= "clock_in_at")
      `,
    ),

    /** Coordinate bounds when provided. */
    workTimeSegmentsGeoBoundsCheck: check(
      "work_time_segments_geo_bounds_check",
      sql`
      ("clock_in_lat" IS NULL OR ("clock_in_lat" >= -90 AND "clock_in_lat" <= 90))
      AND ("clock_in_lng" IS NULL OR ("clock_in_lng" >= -180 AND "clock_in_lng" <= 180))
      AND ("clock_out_lat" IS NULL OR ("clock_out_lat" >= -90 AND "clock_out_lat" <= 90))
      AND ("clock_out_lng" IS NULL OR ("clock_out_lng" >= -180 AND "clock_out_lng" <= 180))
      `,
    ),
  }),
);

/**
 * work_time_segment_allocations
 *
 * ELI5:
 * One time segment can be allocated to one or many staffing assignments.
 *
 * Why this table exists:
 * - real shifts can be split across tasks/coverage slots,
 * - payroll-grade traceability needs explicit lineage from clock segment
 *   to staffing assignment (not inferred in app code),
 * - supports future rules like weighted/ratio attribution.
 */
export const workTimeSegmentAllocations = pgTable(
  "work_time_segment_allocations",
  {
    /** Stable primary key. */
    id: idWithTag("time_segment_allocation"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Source time segment being allocated. */
    workTimeSegmentId: idRef("work_time_segment_id")
      .references(() => workTimeSegments.id)
      .notNull(),

    /** Target staffing assignment receiving this allocation slice. */
    staffingAssignmentId: idRef("staffing_assignment_id")
      .references(() => staffingAssignments.id)
      .notNull(),

    /**
     * Optional explicit minute allocation.
     * Useful when one segment is split by known durations.
     */
    allocatedMinutes: integer("allocated_minutes"),

    /**
     * Optional ratio allocation in basis points.
     * Example: 5000 = 50% of segment attributed to this assignment.
     */
    allocationBps: integer("allocation_bps"),

    /** Optional operator note for manual split rationale. */
    note: text("note"),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite unique key for tenant-safe downstream references. */
    workTimeSegmentAllocationsBizIdIdUnique: uniqueIndex(
      "work_time_segment_allocations_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** Prevent duplicate allocation row for same segment-assignment pair. */
    workTimeSegmentAllocationsUnique: uniqueIndex(
      "work_time_segment_allocations_unique",
    ).on(table.workTimeSegmentId, table.staffingAssignmentId),

    /** Common extraction path for one time segment split view. */
    workTimeSegmentAllocationsBizSegmentIdx: index(
      "work_time_segment_allocations_biz_segment_idx",
    ).on(table.bizId, table.workTimeSegmentId),

    /** Common extraction path for one staffing assignment cost basis. */
    workTimeSegmentAllocationsBizAssignmentIdx: index(
      "work_time_segment_allocations_biz_assignment_idx",
    ).on(table.bizId, table.staffingAssignmentId),

    /** Tenant-safe FK to source time segment. */
    workTimeSegmentAllocationsBizSegmentFk: foreignKey({
      columns: [table.bizId, table.workTimeSegmentId],
      foreignColumns: [workTimeSegments.bizId, workTimeSegments.id],
      name: "work_time_segment_allocations_biz_segment_fk",
    }),

    /** Tenant-safe FK to target staffing assignment. */
    workTimeSegmentAllocationsBizAssignmentFk: foreignKey({
      columns: [table.bizId, table.staffingAssignmentId],
      foreignColumns: [staffingAssignments.bizId, staffingAssignments.id],
      name: "work_time_segment_allocations_biz_assignment_fk",
    }),

    /** At least one allocation quantity must be provided and bounded. */
    workTimeSegmentAllocationsShapeAndBoundsCheck: check(
      "work_time_segment_allocations_shape_and_bounds_check",
      sql`
      (
        "allocated_minutes" IS NOT NULL
        OR "allocation_bps" IS NOT NULL
      )
      AND ("allocated_minutes" IS NULL OR "allocated_minutes" > 0)
      AND ("allocation_bps" IS NULL OR ("allocation_bps" >= 1 AND "allocation_bps" <= 10000))
      `,
    ),
  }),
);

/**
 * work_artifacts
 *
 * ELI5:
 * Generic evidence attachments for runs or entries.
 *
 * Covers:
 * - photos/videos,
 * - files/PDFs,
 * - signatures,
 * - annotated snapshots.
 */
export const workArtifacts = pgTable(
  "work_artifacts",
  {
    /** Stable primary key. */
    id: idWithTag("work_artifact"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent run. */
    workRunId: idRef("work_run_id")
      .references(() => workRuns.id)
      .notNull(),

    /** Optional linked entry for entry-level evidence. */
    workEntryId: idRef("work_entry_id").references(() => workEntries.id),

    /** Artifact family. */
    artifactType: interactionArtifactTypeEnum("artifact_type").notNull(),

    /** Blob/object storage reference. */
    storageRef: varchar("storage_ref", { length: 600 }).notNull(),

    /** Optional original filename. */
    fileName: varchar("file_name", { length: 260 }),

    /** Optional content type. */
    mimeType: varchar("mime_type", { length: 160 }),

    /** Optional file size in bytes. */
    fileSizeBytes: integer("file_size_bytes"),

    /** Optional SHA-256 hash for integrity checks. */
    sha256: varchar("sha256", { length: 128 }),

    /** Optional capture latitude. */
    geoLat: doublePrecision("geo_lat"),

    /** Optional capture longitude. */
    geoLng: doublePrecision("geo_lng"),

    /** Optional annotations/markups payload. */
    annotations: jsonb("annotations").default({}),

    /** Capture timestamp. */
    capturedAt: timestamp("captured_at", { withTimezone: true })
      .defaultNow()
      .notNull(),

    /** Optional capture actor. */
    capturedByUserId: idRef("captured_by_user_id").references(() => users.id),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    workArtifactsBizIdIdUnique: uniqueIndex("work_artifacts_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Common run evidence timeline path. */
    workArtifactsBizRunCapturedIdx: index("work_artifacts_biz_run_captured_idx").on(
      table.bizId,
      table.workRunId,
      table.capturedAt,
    ),

    /** Common entry evidence path. */
    workArtifactsBizEntryIdx: index("work_artifacts_biz_entry_idx").on(
      table.bizId,
      table.workEntryId,
    ),

    /** Tenant-safe FK to run. */
    workArtifactsBizRunFk: foreignKey({
      columns: [table.bizId, table.workRunId],
      foreignColumns: [workRuns.bizId, workRuns.id],
      name: "work_artifacts_biz_run_fk",
    }),

    /** Tenant-safe FK to optional entry. */
    workArtifactsBizEntryFk: foreignKey({
      columns: [table.bizId, table.workEntryId],
      foreignColumns: [workEntries.bizId, workEntries.id],
      name: "work_artifacts_biz_entry_fk",
    }),

    /** File size and coordinate bounds checks. */
    workArtifactsBoundsCheck: check(
      "work_artifacts_bounds_check",
      sql`
      ("file_size_bytes" IS NULL OR "file_size_bytes" >= 0)
      AND ("geo_lat" IS NULL OR ("geo_lat" >= -90 AND "geo_lat" <= 90))
      AND ("geo_lng" IS NULL OR ("geo_lng" >= -180 AND "geo_lng" <= 180))
      `,
    ),
  }),
);

/**
 * work_approvals
 *
 * ELI5:
 * Multi-party signoff chain for one run.
 *
 * Supports both:
 * - sequential signoff (stage 1, then stage 2...),
 * - parallel signoff (multiple rows at same stage).
 */
export const workApprovals = pgTable(
  "work_approvals",
  {
    /** Stable primary key. */
    id: idWithTag("work_approval"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent work run. */
    workRunId: idRef("work_run_id")
      .references(() => workRuns.id)
      .notNull(),

    /** Routing mode for this approval node. */
    routingMode: workApprovalRoutingModeEnum("routing_mode")
      .default("sequential")
      .notNull(),

    /** Stage number for ordering and grouping approvals. */
    stage: integer("stage").default(1).notNull(),

    /** Assignee selector type. */
    assigneeType: workApprovalAssigneeTypeEnum("assignee_type").notNull(),

    /** Assignee payload for user approvals. */
    approverUserId: idRef("approver_user_id").references(() => users.id),

    /** Assignee payload for group-account approvals. */
    approverGroupAccountId: idRef("approver_group_account_id").references(
      () => groupAccounts.id,
    ),

    /** Assignee payload for role-based routing. */
    approverRoleKey: varchar("approver_role_key", { length: 120 }),

    /** Assignee payload for external routing systems. */
    approverRef: varchar("approver_ref", { length: 200 }),

    /** Decision state. */
    decision: workApprovalDecisionEnum("decision").default("pending").notNull(),

    /** Decision timestamp. */
    decidedAt: timestamp("decided_at", { withTimezone: true }),

    /** Actor who made decision (if known in system). */
    decidedByUserId: idRef("decided_by_user_id").references(() => users.id),

    /** Optional reason/comment for approval/rejection/delegation. */
    decisionNote: text("decision_note"),

    /** Optional deadline for this approval node. */
    dueAt: timestamp("due_at", { withTimezone: true }),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    workApprovalsBizIdIdUnique: uniqueIndex("work_approvals_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Common workflow queue path. */
    workApprovalsBizDecisionDueIdx: index("work_approvals_biz_decision_due_idx").on(
      table.bizId,
      table.decision,
      table.dueAt,
    ),

    /** Common run approval chain path. */
    workApprovalsBizRunStageIdx: index("work_approvals_biz_run_stage_idx").on(
      table.bizId,
      table.workRunId,
      table.stage,
    ),

    /** Tenant-safe FK to parent run. */
    workApprovalsBizRunFk: foreignKey({
      columns: [table.bizId, table.workRunId],
      foreignColumns: [workRuns.bizId, workRuns.id],
      name: "work_approvals_biz_run_fk",
    }),

    /** Stage must be positive integer. */
    workApprovalsStageCheck: check(
      "work_approvals_stage_check",
      sql`"stage" >= 1`,
    ),

    /** Assignee payload shape by assignee type. */
    workApprovalsAssigneeShapeCheck: check(
      "work_approvals_assignee_shape_check",
      sql`
      (
        "assignee_type" = 'user'
        AND "approver_user_id" IS NOT NULL
        AND "approver_group_account_id" IS NULL
        AND "approver_role_key" IS NULL
        AND "approver_ref" IS NULL
      ) OR (
        "assignee_type" = 'group_account'
        AND "approver_user_id" IS NULL
        AND "approver_group_account_id" IS NOT NULL
        AND "approver_role_key" IS NULL
        AND "approver_ref" IS NULL
      ) OR (
        "assignee_type" = 'role'
        AND "approver_user_id" IS NULL
        AND "approver_group_account_id" IS NULL
        AND "approver_role_key" IS NOT NULL
        AND "approver_ref" IS NULL
      ) OR (
        "assignee_type" = 'external'
        AND "approver_user_id" IS NULL
        AND "approver_group_account_id" IS NULL
        AND "approver_role_key" IS NULL
        AND "approver_ref" IS NOT NULL
      )
      `,
    ),
  }),
);

export type WorkTemplate = typeof workTemplates.$inferSelect;
export type NewWorkTemplate = typeof workTemplates.$inferInsert;

export type WorkTemplateStep = typeof workTemplateSteps.$inferSelect;
export type NewWorkTemplateStep = typeof workTemplateSteps.$inferInsert;

export type WorkRun = typeof workRuns.$inferSelect;
export type NewWorkRun = typeof workRuns.$inferInsert;

export type WorkRunStep = typeof workRunSteps.$inferSelect;
export type NewWorkRunStep = typeof workRunSteps.$inferInsert;

export type WorkEntry = typeof workEntries.$inferSelect;
export type NewWorkEntry = typeof workEntries.$inferInsert;

export type WorkTimeSegment = typeof workTimeSegments.$inferSelect;
export type NewWorkTimeSegment = typeof workTimeSegments.$inferInsert;

export type WorkArtifact = typeof workArtifacts.$inferSelect;
export type NewWorkArtifact = typeof workArtifacts.$inferInsert;

export type WorkApproval = typeof workApprovals.$inferSelect;
export type NewWorkApproval = typeof workApprovals.$inferInsert;
