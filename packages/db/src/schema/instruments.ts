import { sql } from "drizzle-orm";
import { check, foreignKey, index, uniqueIndex } from "drizzle-orm/pg-core";
import {
  AnyPgColumn,
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
import { bizConfigValues } from "./biz_configs";
import { customFieldTargetTypeEnum, lifecycleStatusEnum, requirementModeEnum } from "./enums";
import {
  instrumentEvaluationModeEnum,
  instrumentItemTypeEnum,
  instrumentResultStatusEnum,
  instrumentRunStatusEnum,
  instrumentTypeEnum,
} from "./enums";
import { bizExtensionInstalls } from "./extensions";
import { locations } from "./locations";
import { offers, offerVersions } from "./offers";
import { serviceProducts } from "./service_products";
import { services } from "./services";
import { subjects } from "./subjects";
import { users } from "./users";

/**
 * instruments
 *
 * ELI5:
 * This is the single reusable definition table for:
 * - intake forms,
 * - quizzes,
 * - assessments,
 * - checklists and survey-like flows.
 *
 * Terminology note:
 * "Intake form" here means data capture before/around service delivery.
 * It is different from operational "check-in" flows used in attendance/ticketing.
 *
 * Why this exists:
 * Historically, products often split these into separate domains, which causes:
 * - duplicated binding logic,
 * - duplicated assignment/attempt state machines,
 * - harder cross-feature reporting.
 *
 * This table is the unified abstraction. Differences are configured via:
 * - `instrument_type`
 * - `evaluation_mode`
 * - `schema_snapshot` / `validation_policy` / `scoring_policy`.
 */
export const instruments = pgTable(
  "instruments",
  {
    /** Stable primary key for one immutable definition version. */
    id: idWithTag("instrument"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /**
     * Optional extension owner.
     * Null means first-party/native definition.
     */
    bizExtensionInstallId: idRef("biz_extension_install_id").references(
      () => bizExtensionInstalls.id,
    ),

    /** Human-readable definition name for admin tooling. */
    name: varchar("name", { length: 220 }).notNull(),

    /**
     * Stable machine key for version families.
     * Example: `new-patient-intake`, `driving-theory-quiz`.
     */
    slug: varchar("slug", { length: 140 }).notNull(),

    /** Immutable version number within `(biz_id, slug)`. */
    version: integer("version").default(1).notNull(),

    /** Current/default marker for one slug family. */
    isCurrent: boolean("is_current").default(false).notNull(),

    /** Unified class: intake form, quiz, assessment, etc. */
    instrumentType: instrumentTypeEnum("instrument_type").notNull(),
    /**
     * Optional configurable dictionary pointer for tenant-specific vocabulary.
     *
     * Core behavior should still be driven by `instrument_type`.
     */
    instrumentTypeConfigValueId: idRef("instrument_type_config_value_id").references(
      () => bizConfigValues.id,
    ),

    /** Lifecycle status for this definition version. */
    status: lifecycleStatusEnum("status").default("draft").notNull(),
    /** Optional configurable dictionary pointer for status wording. */
    statusConfigValueId: idRef("status_config_value_id").references(
      () => bizConfigValues.id,
    ),

    /** Evaluation strategy (none/auto/manual/hybrid). */
    evaluationMode: instrumentEvaluationModeEnum("evaluation_mode")
      .default("none")
      .notNull(),

    /** Optional explanatory description shown to operators/participants. */
    description: text("description"),

    /**
     * Structured render/config snapshot.
     * Contains field layout, branching rules, item-level settings, etc.
     */
    schemaSnapshot: jsonb("schema_snapshot").default({}).notNull(),

    /** Validation constraints/policies (required groups, regex, dependencies). */
    validationPolicy: jsonb("validation_policy").default({}).notNull(),

    /** Scoring/evaluation policy (rubrics, weighted logic, cutoffs). */
    scoringPolicy: jsonb("scoring_policy").default({}).notNull(),

    /** Completion policy (submission rules, retries, finalization behavior). */
    completionPolicy: jsonb("completion_policy").default({}).notNull(),

    /** Optional passing threshold in percent for graded flows. */
    passScorePercent: integer("pass_score_percent"),

    /** Optional attempt limit per subject+target. */
    maxAttempts: integer("max_attempts"),

    /** Optional duration cap per run in seconds. */
    attemptDurationSeconds: integer("attempt_duration_seconds"),

    /** Whether at least one signature is required to complete. */
    requiresSignature: boolean("requires_signature").default(false).notNull(),

    /** Extension payload for non-indexed custom attributes. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite key for tenant-safe child references. */
    instrumentsBizIdIdUnique: uniqueIndex("instruments_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),

    /** One immutable version row per slug+version. */
    instrumentsBizSlugVersionUnique: uniqueIndex("instruments_biz_slug_version_unique").on(
      table.bizId,
      table.slug,
      table.version,
    ),

    /** One current/default version per slug family. */
    instrumentsBizSlugCurrentUnique: uniqueIndex("instruments_biz_slug_current_unique")
      .on(table.bizId, table.slug)
      .where(sql`"is_current" = true AND "deleted_at" IS NULL`),

    /** Common picker/list path. */
    instrumentsBizTypeStatusIdx: index("instruments_biz_type_status_idx").on(
      table.bizId,
      table.instrumentType,
      table.status,
      table.isCurrent,
    ),

    instrumentsBizInstrumentTypeConfigIdx: index(
      "instruments_biz_instrument_type_config_idx",
    ).on(table.bizId, table.instrumentTypeConfigValueId),
    instrumentsBizStatusConfigIdx: index("instruments_biz_status_config_idx").on(
      table.bizId,
      table.statusConfigValueId,
    ),

    /** Tenant-safe FK to extension owner. */
    instrumentsBizInstallFk: foreignKey({
      columns: [table.bizId, table.bizExtensionInstallId],
      foreignColumns: [bizExtensionInstalls.bizId, bizExtensionInstalls.id],
      name: "instruments_biz_install_fk",
    }),

    /** Tenant-safe FK to optional configurable type value. */
    instrumentsBizTypeConfigFk: foreignKey({
      columns: [table.bizId, table.instrumentTypeConfigValueId],
      foreignColumns: [bizConfigValues.bizId, bizConfigValues.id],
      name: "instruments_biz_type_config_fk",
    }),

    /** Tenant-safe FK to optional configurable status value. */
    instrumentsBizStatusConfigFk: foreignKey({
      columns: [table.bizId, table.statusConfigValueId],
      foreignColumns: [bizConfigValues.bizId, bizConfigValues.id],
      name: "instruments_biz_status_config_fk",
    }),

    /** Numeric bounds for deterministic runtime behavior. */
    instrumentsBoundsCheck: check(
      "instruments_bounds_check",
      sql`
      "version" >= 1
      AND ("pass_score_percent" IS NULL OR ("pass_score_percent" >= 0 AND "pass_score_percent" <= 100))
      AND ("max_attempts" IS NULL OR "max_attempts" > 0)
      AND ("attempt_duration_seconds" IS NULL OR "attempt_duration_seconds" > 0)
      `,
    ),
  }),
);

/**
 * instrument_items
 *
 * ELI5:
 * Each row is one question/field/task in the instrument definition.
 */
export const instrumentItems = pgTable(
  "instrument_items",
  {
    /** Stable primary key. */
    id: idWithTag("instrument_item"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent instrument definition. */
    instrumentId: idRef("instrument_id")
      .references(() => instruments.id)
      .notNull(),

    /** Stable key for payload mapping/export/import. */
    itemKey: varchar("item_key", { length: 140 }).notNull(),

    /** Human prompt shown to participant. */
    prompt: text("prompt").notNull(),

    /** Optional helper/description text. */
    description: text("description"),

    /** Item input type. */
    itemType: instrumentItemTypeEnum("item_type").notNull(),

    /** Requiredness for completion validation. */
    isRequired: boolean("is_required").default(true).notNull(),

    /** Render order. */
    sortOrder: integer("sort_order").default(100).notNull(),

    /** Optional max score contribution for graded flows. */
    maxScore: integer("max_score").default(0).notNull(),

    /** Structured item config (choices, validators, rubric fragments, etc.). */
    config: jsonb("config").default({}).notNull(),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite key for tenant-safe run-response references. */
    instrumentItemsBizIdIdInstrumentUnique: uniqueIndex(
      "instrument_items_biz_id_id_instrument_unique",
    ).on(table.bizId, table.id, table.instrumentId),

    /** One key per instrument definition. */
    instrumentItemsInstrumentKeyUnique: uniqueIndex("instrument_items_instrument_key_unique").on(
      table.instrumentId,
      table.itemKey,
    ),

    /** Expansion/render path. */
    instrumentItemsBizInstrumentSortIdx: index("instrument_items_biz_instrument_sort_idx").on(
      table.bizId,
      table.instrumentId,
      table.sortOrder,
    ),

    /** Tenant-safe FK to instrument definition. */
    instrumentItemsBizInstrumentFk: foreignKey({
      columns: [table.bizId, table.instrumentId],
      foreignColumns: [instruments.bizId, instruments.id],
      name: "instrument_items_biz_instrument_fk",
    }),

    /** Item bounds sanity checks. */
    instrumentItemsBoundsCheck: check(
      "instrument_items_bounds_check",
      sql`"sort_order" >= 0 AND "max_score" >= 0 AND length("item_key") > 0`,
    ),
  }),
);

/**
 * instrument_bindings
 *
 * ELI5:
 * Binding says "for this trigger + target context, this instrument is required
 * or optional".
 */
export const instrumentBindings = pgTable(
  "instrument_bindings",
  {
    /** Stable primary key. */
    id: idWithTag("instrument_binding"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Instrument definition used at runtime. */
    instrumentId: idRef("instrument_id")
      .references(() => instruments.id)
      .notNull(),

    /** Runtime object class receiving instrument runs. */
    targetType: customFieldTargetTypeEnum("target_type").notNull(),

    /** Trigger key used by orchestration/API (example: `booking.created`). */
    triggerEvent: varchar("trigger_event", { length: 180 }).notNull(),

    /** Required vs optional behavior. */
    requirementMode: requirementModeEnum("requirement_mode")
      .default("required")
      .notNull(),

    /** Optional location scope. Null means all locations. */
    locationId: idRef("location_id").references(() => locations.id),

    /** Optional service scope. */
    serviceId: idRef("service_id").references(() => services.id),

    /** Optional service-product scope. */
    serviceProductId: idRef("service_product_id").references(
      () => serviceProducts.id,
    ),

    /** Optional offer shell scope. */
    offerId: idRef("offer_id").references(() => offers.id),

    /** Optional offer-version scope. */
    offerVersionId: idRef("offer_version_id").references(() => offerVersions.id),

    /** Resolver precedence/order hint. */
    priority: integer("priority").default(100).notNull(),

    /** Structured conditional expression for advanced matching. */
    conditionExpr: jsonb("condition_expr").default({}).notNull(),

    /** Runtime active toggle. */
    isActive: boolean("is_active").default(true).notNull(),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite key for tenant-safe references from future link tables. */
    instrumentBindingsBizIdIdUnique: uniqueIndex("instrument_bindings_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),

    /** Runtime resolver path. */
    instrumentBindingsBizTargetTriggerIdx: index(
      "instrument_bindings_biz_target_trigger_idx",
    ).on(table.bizId, table.targetType, table.triggerEvent, table.isActive, table.priority),

    /** Tenant-safe FK to instrument definition. */
    instrumentBindingsBizInstrumentFk: foreignKey({
      columns: [table.bizId, table.instrumentId],
      foreignColumns: [instruments.bizId, instruments.id],
      name: "instrument_bindings_biz_instrument_fk",
    }),

    /** Tenant-safe FK to location scope. */
    instrumentBindingsBizLocationFk: foreignKey({
      columns: [table.bizId, table.locationId],
      foreignColumns: [locations.bizId, locations.id],
      name: "instrument_bindings_biz_location_fk",
    }),

    /** Tenant-safe FK to service scope. */
    instrumentBindingsBizServiceFk: foreignKey({
      columns: [table.bizId, table.serviceId],
      foreignColumns: [services.bizId, services.id],
      name: "instrument_bindings_biz_service_fk",
    }),

    /** Tenant-safe FK to service-product scope. */
    instrumentBindingsBizServiceProductFk: foreignKey({
      columns: [table.bizId, table.serviceProductId],
      foreignColumns: [serviceProducts.bizId, serviceProducts.id],
      name: "instrument_bindings_biz_service_product_fk",
    }),

    /** Tenant-safe FK to offer scope. */
    instrumentBindingsBizOfferFk: foreignKey({
      columns: [table.bizId, table.offerId],
      foreignColumns: [offers.bizId, offers.id],
      name: "instrument_bindings_biz_offer_fk",
    }),

    /** Tenant-safe FK to offer-version scope. */
    instrumentBindingsBizOfferVersionFk: foreignKey({
      columns: [table.bizId, table.offerVersionId],
      foreignColumns: [offerVersions.bizId, offerVersions.id],
      name: "instrument_bindings_biz_offer_version_fk",
    }),

    /** Priority should be non-negative. */
    instrumentBindingsPriorityCheck: check(
      "instrument_bindings_priority_check",
      sql`"priority" >= 0`,
    ),
  }),
);

/**
 * instrument_runs
 *
 * ELI5:
 * One run is the runtime "instance" of an instrument for one subject + target.
 *
 * This table intentionally merges concepts that are often split as:
 * assignment + invitation + attempt + submission.
 *
 * Why:
 * - less cross-table state drift,
 * - easier analytics ("how many intake/quiz/assessment runs are stuck?"),
 * - simpler integration and quote/compliance linkage.
 */
export const instrumentRuns = pgTable(
  "instrument_runs",
  {
    /** Stable primary key. */
    id: idWithTag("instrument_run"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Definition being executed. */
    instrumentId: idRef("instrument_id")
      .references(() => instruments.id)
      .notNull(),

    /** Runtime target class for this run (booking/order/service/etc.). */
    targetType: customFieldTargetTypeEnum("target_type").notNull(),

    /** Runtime target id for this run. */
    targetRefId: varchar("target_ref_id", { length: 140 }).notNull(),

    /**
     * Assignee subject pointer.
     * We keep explicit subject biz to support cross-biz workflows safely.
     */
    assigneeSubjectBizId: idRef("assignee_subject_biz_id")
      .references(() => bizes.id)
      .notNull(),
    assigneeSubjectType: varchar("assignee_subject_type", { length: 80 }).notNull(),
    assigneeSubjectId: idRef("assignee_subject_id").notNull(),

    /** Run lifecycle state. */
    status: instrumentRunStatusEnum("status").default("pending").notNull(),

    /** Attempt ordinal for repeated runs over same target/assignee. */
    attemptNumber: integer("attempt_number").default(1).notNull(),

    /** Optional idempotency/request key for API retries. */
    requestKey: varchar("request_key", { length: 140 }),

    /** Runtime timestamps. */
    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    evaluatedAt: timestamp("evaluated_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),

    /** Optional grading outcome fields for quiz/assessment-like runs. */
    scorePercent: integer("score_percent"),
    maxScore: integer("max_score"),
    resultStatus: instrumentResultStatusEnum("result_status"),

    /** Whole-run response payload (normalized + raw response shape). */
    responsePayload: jsonb("response_payload").default({}).notNull(),

    /** Evaluator summary/notes. */
    evaluationSummary: text("evaluation_summary"),

    /** Optional evaluator subject pointer (manual/agent/hybrid). */
    evaluatorSubjectBizId: idRef("evaluator_subject_biz_id").references(
      () => bizes.id,
    ),
    evaluatorSubjectType: varchar("evaluator_subject_type", { length: 80 }),
    evaluatorSubjectId: idRef("evaluator_subject_id"),

    /** Extensible payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite key used by response/event child rows with strict instrument tie. */
    instrumentRunsBizIdIdInstrumentUnique: uniqueIndex(
      "instrument_runs_biz_id_id_instrument_unique",
    ).on(table.bizId, table.id, table.instrumentId),

    /** Common queue path for runtime processing dashboards. */
    instrumentRunsBizStatusStartedIdx: index("instrument_runs_biz_status_started_idx").on(
      table.bizId,
      table.status,
      table.startedAt,
    ),

    /** Subject-centric timeline path. */
    instrumentRunsBizAssigneeStartedIdx: index("instrument_runs_biz_assignee_started_idx").on(
      table.bizId,
      table.assigneeSubjectBizId,
      table.assigneeSubjectType,
      table.assigneeSubjectId,
      table.startedAt,
    ),

    /** Optional request-key uniqueness for idempotent run creation. */
    instrumentRunsBizRequestKeyUnique: uniqueIndex("instrument_runs_biz_request_key_unique")
      .on(table.bizId, table.requestKey)
      .where(sql`"request_key" IS NOT NULL AND "deleted_at" IS NULL`),

    /** Tenant-safe FK to definition. */
    instrumentRunsBizInstrumentFk: foreignKey({
      columns: [table.bizId, table.instrumentId],
      foreignColumns: [instruments.bizId, instruments.id],
      name: "instrument_runs_biz_instrument_fk",
    }),

    /** Tenant-safe FK to assignee subject. */
    instrumentRunsAssigneeSubjectFk: foreignKey({
      columns: [table.assigneeSubjectBizId, table.assigneeSubjectType, table.assigneeSubjectId],
      foreignColumns: [subjects.bizId, subjects.subjectType, subjects.subjectId],
      name: "instrument_runs_assignee_subject_fk",
    }),

    /** Tenant-safe FK to evaluator subject. */
    instrumentRunsEvaluatorSubjectFk: foreignKey({
      columns: [table.evaluatorSubjectBizId, table.evaluatorSubjectType, table.evaluatorSubjectId],
      foreignColumns: [subjects.bizId, subjects.subjectType, subjects.subjectId],
      name: "instrument_runs_evaluator_subject_fk",
    }),

    /** Evaluator pointer should be all-null or all-populated. */
    instrumentRunsEvaluatorSubjectPairCheck: check(
      "instrument_runs_evaluator_subject_pair_check",
      sql`
      (
        "evaluator_subject_biz_id" IS NULL
        AND "evaluator_subject_type" IS NULL
        AND "evaluator_subject_id" IS NULL
      ) OR (
        "evaluator_subject_biz_id" IS NOT NULL
        AND "evaluator_subject_type" IS NOT NULL
        AND "evaluator_subject_id" IS NOT NULL
      )
      `,
    ),

    /** Numeric and timeline invariants. */
    instrumentRunsBoundsAndTimelineCheck: check(
      "instrument_runs_bounds_and_timeline_check",
      sql`
      "attempt_number" >= 1
      AND ("score_percent" IS NULL OR ("score_percent" >= 0 AND "score_percent" <= 100))
      AND ("max_score" IS NULL OR "max_score" >= 0)
      AND ("submitted_at" IS NULL OR "submitted_at" >= "started_at")
      AND ("evaluated_at" IS NULL OR "submitted_at" IS NULL OR "evaluated_at" >= "submitted_at")
      AND ("completed_at" IS NULL OR "completed_at" >= "started_at")
      AND ("expires_at" IS NULL OR "expires_at" >= "started_at")
      `,
    ),
  }),
);

/**
 * instrument_responses
 *
 * ELI5:
 * Item-level response rows for one run.
 *
 * Why keep this table when `instrument_runs.response_payload` exists:
 * - easy filtering/querying by item key/value,
 * - supports streaming partial responses and per-item scoring,
 * - avoids heavy JSON traversal in analytics paths.
 */
export const instrumentResponses = pgTable(
  "instrument_responses",
  {
    /** Stable primary key. */
    id: idWithTag("instrument_response"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent instrument definition (denormalized for strict FK shape). */
    instrumentId: idRef("instrument_id")
      .references(() => instruments.id)
      .notNull(),

    /** Parent run row. */
    instrumentRunId: idRef("instrument_run_id")
      .references(() => instrumentRuns.id)
      .notNull(),

    /** Optional direct item-row pointer. */
    instrumentItemId: idRef("instrument_item_id").references(() => instrumentItems.id),

    /** Item key for robust imports/custom item flows. */
    itemKey: varchar("item_key", { length: 140 }).notNull(),

    /** Raw value payload for the response. */
    value: jsonb("value").default({}).notNull(),

    /** Optional normalized fields for easier indexing/search/filtering. */
    normalizedText: text("normalized_text"),
    normalizedNumber: integer("normalized_number"),
    normalizedBoolean: boolean("normalized_boolean"),

    /** Optional per-item score assigned by evaluator/rule engine. */
    score: integer("score"),

    /** Optional evaluator feedback per item. */
    feedback: text("feedback"),

    /** Marks latest/final response for this item in this run. */
    isFinal: boolean("is_final").default(true).notNull(),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    instrumentResponsesBizIdIdUnique: uniqueIndex("instrument_responses_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),

    /** At most one final response per run+item key. */
    instrumentResponsesFinalPerItemUnique: uniqueIndex(
      "instrument_responses_final_per_item_unique",
    )
      .on(table.instrumentRunId, table.itemKey)
      .where(sql`"is_final" = true AND "deleted_at" IS NULL`),

    /** Run expansion path. */
    instrumentResponsesBizRunItemIdx: index("instrument_responses_biz_run_item_idx").on(
      table.bizId,
      table.instrumentRunId,
      table.itemKey,
    ),

    /** Tenant-safe FK to run with strict instrument consistency. */
    instrumentResponsesBizRunInstrumentFk: foreignKey({
      columns: [table.bizId, table.instrumentRunId, table.instrumentId],
      foreignColumns: [instrumentRuns.bizId, instrumentRuns.id, instrumentRuns.instrumentId],
      name: "instrument_responses_biz_run_instrument_fk",
    }),

    /** Tenant-safe FK to item with strict instrument consistency. */
    instrumentResponsesBizItemInstrumentFk: foreignKey({
      columns: [table.bizId, table.instrumentItemId, table.instrumentId],
      foreignColumns: [instrumentItems.bizId, instrumentItems.id, instrumentItems.instrumentId],
      name: "instrument_responses_biz_item_instrument_fk",
    }),

    /** Score bounds sanity. */
    instrumentResponsesScoreCheck: check(
      "instrument_responses_score_check",
      sql`"score" IS NULL OR "score" >= 0`,
    ),
  }),
);

/**
 * instrument_events
 *
 * ELI5:
 * Timeline log for run lifecycle and evaluation events.
 *
 * This table is append-oriented and suitable for:
 * - debugging,
 * - user-facing timeline rendering,
 * - compliance traceability.
 */
export const instrumentEvents = pgTable(
  "instrument_events",
  {
    /** Stable primary key. */
    id: idWithTag("instrument_event"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent run. */
    instrumentRunId: idRef("instrument_run_id")
      .references(() => instrumentRuns.id)
      .notNull(),

    /** Event key (example: run_started, submitted, auto_graded, waived). */
    eventType: varchar("event_type", { length: 80 }).notNull(),

    /** Optional actor subject pointer. */
    actorSubjectBizId: idRef("actor_subject_biz_id").references(() => bizes.id),
    actorSubjectType: varchar("actor_subject_type", { length: 80 }),
    actorSubjectId: idRef("actor_subject_id"),

    /** Event timestamp. */
    occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),

    /** Structured event payload. */
    payload: jsonb("payload").default({}).notNull(),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    instrumentEventsBizIdIdUnique: uniqueIndex("instrument_events_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),

    /** Run timeline path. */
    instrumentEventsBizRunOccurredIdx: index("instrument_events_biz_run_occurred_idx").on(
      table.bizId,
      table.instrumentRunId,
      table.occurredAt,
    ),

    /** Tenant-safe FK to run. */
    instrumentEventsBizRunFk: foreignKey({
      columns: [table.bizId, table.instrumentRunId],
      foreignColumns: [instrumentRuns.bizId, instrumentRuns.id],
      name: "instrument_events_biz_run_fk",
    }),

    /** Tenant-safe FK to actor subject. */
    instrumentEventsActorSubjectFk: foreignKey({
      columns: [table.actorSubjectBizId, table.actorSubjectType, table.actorSubjectId],
      foreignColumns: [subjects.bizId, subjects.subjectType, subjects.subjectId],
      name: "instrument_events_actor_subject_fk",
    }),

    /** Actor subject should be fully-null or fully-populated. */
    instrumentEventsActorPairCheck: check(
      "instrument_events_actor_pair_check",
      sql`
      (
        "actor_subject_biz_id" IS NULL
        AND "actor_subject_type" IS NULL
        AND "actor_subject_id" IS NULL
      ) OR (
        "actor_subject_biz_id" IS NOT NULL
        AND "actor_subject_type" IS NOT NULL
        AND "actor_subject_id" IS NOT NULL
      )
      `,
    ),
  }),
);

export type Instrument = typeof instruments.$inferSelect;
export type NewInstrument = typeof instruments.$inferInsert;

export type InstrumentRun = typeof instrumentRuns.$inferSelect;
export type NewInstrumentRun = typeof instrumentRuns.$inferInsert;
