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
  assessmentAttemptStatusEnum,
  assessmentEvaluationModeEnum,
  assessmentItemTypeEnum,
  assessmentResultStatusEnum,
  assessmentTemplateStatusEnum,
  gradingEventTypeEnum,
  lifecycleStatusEnum,
} from "./enums";
import {
  requirementEvaluations,
  requirementNodes,
  requirementSets,
} from "./progression";
import { subjects } from "./subjects";
import { users } from "./users";

/**
 * assessment_templates
 *
 * ELI5:
 * A template is the reusable "exam/checklist/quiz blueprint".
 *
 * Why it exists:
 * - one business can run many attempts from the same template,
 * - template keeps grading policy and attempt limits in one place,
 * - template can optionally connect to progression requirements.
 */
export const assessmentTemplates = pgTable(
  "assessment_templates",
  {
    /** Stable primary key for one assessment template. */
    id: idWithTag("assessment_template"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Human-readable template name. */
    name: varchar("name", { length: 220 }).notNull(),

    /** Stable slug for API/import references. */
    slug: varchar("slug", { length: 140 }).notNull(),

    /** Optional plain-language template description. */
    description: varchar("description", { length: 2000 }),

    /** Template lifecycle status. */
    status: assessmentTemplateStatusEnum("status").default("draft").notNull(),

    /** Grading/evaluation mode. */
    evaluationMode: assessmentEvaluationModeEnum("evaluation_mode")
      .default("hybrid")
      .notNull(),

    /** Optional pass threshold in percent (0..100). */
    passScorePercent: integer("pass_score_percent"),

    /** Optional maximum number of attempts allowed. */
    maxAttempts: integer("max_attempts"),

    /** Optional duration limit per attempt in seconds. */
    attemptDurationSeconds: integer("attempt_duration_seconds"),

    /**
     * Optional linked requirement set.
     *
     * Use this when assessment outcomes contribute to progression gating.
     */
    requirementSetId: idRef("requirement_set_id").references(() => requirementSets.id),

    /** Monotonic template revision number. */
    version: integer("version").default(1).notNull(),

    /** Immutable grading policy snapshot. */
    policySnapshot: jsonb("policy_snapshot").default({}).notNull(),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite key used by item/attempt/result child tables. */
    assessmentTemplatesBizIdIdUnique: uniqueIndex(
      "assessment_templates_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** Unique slug per tenant. */
    assessmentTemplatesBizSlugUnique: uniqueIndex(
      "assessment_templates_biz_slug_unique",
    ).on(table.bizId, table.slug),

    /** Template listing path. */
    assessmentTemplatesBizStatusIdx: index("assessment_templates_biz_status_idx").on(
      table.bizId,
      table.status,
    ),

    /** Tenant-safe FK to optional requirement set anchor. */
    assessmentTemplatesBizRequirementSetFk: foreignKey({
      columns: [table.bizId, table.requirementSetId],
      foreignColumns: [requirementSets.bizId, requirementSets.id],
      name: "assessment_templates_biz_requirement_set_fk",
    }),

    /** Template bounds checks. */
    assessmentTemplatesBoundsCheck: check(
      "assessment_templates_bounds_check",
      sql`
      "version" > 0
      AND ("pass_score_percent" IS NULL OR ("pass_score_percent" >= 0 AND "pass_score_percent" <= 100))
      AND ("max_attempts" IS NULL OR "max_attempts" > 0)
      AND ("attempt_duration_seconds" IS NULL OR "attempt_duration_seconds" > 0)
      `,
    ),
  }),
);

/**
 * assessment_items
 *
 * ELI5:
 * One template contains many items (questions/prompts/checkpoints).
 *
 * The payload fields stay generic so this table can model:
 * - objective quiz items,
 * - free-text responses,
 * - file uploads,
 * - custom evaluation widgets.
 */
export const assessmentItems = pgTable(
  "assessment_items",
  {
    /** Stable primary key for one assessment item. */
    id: idWithTag("assessment_item"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent assessment template. */
    assessmentTemplateId: idRef("assessment_template_id")
      .references(() => assessmentTemplates.id)
      .notNull(),

    /** Stable item key within one template. */
    itemKey: varchar("item_key", { length: 140 }).notNull(),

    /** Item prompt title/question text. */
    prompt: text("prompt").notNull(),

    /** Optional helper/description text. */
    description: text("description"),

    /** Item type discriminator for response parsing/scoring logic. */
    itemType: assessmentItemTypeEnum("item_type").notNull(),

    /** Lifecycle status for this item. */
    status: lifecycleStatusEnum("status").default("active").notNull(),

    /** Whether candidate must provide a response for this item. */
    isRequired: boolean("is_required").default(true).notNull(),

    /** Sort order within template. */
    sortOrder: integer("sort_order").default(100).notNull(),

    /** Maximum points this item can contribute. */
    maxScore: integer("max_score").default(1).notNull(),

    /**
     * Optional linked requirement node for progression integration.
     *
     * This enables direct mapping from question-level outcomes to requirement
     * graph nodes without custom join tables.
     */
    requirementNodeId: idRef("requirement_node_id").references(() => requirementNodes.id),

    /** Structured item config (choices, correct answers, validators, rubric). */
    config: jsonb("config").default({}).notNull(),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    assessmentItemsBizIdIdUnique: uniqueIndex("assessment_items_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Composite key used by response table integrity checks. */
    assessmentItemsBizIdIdTemplateUnique: uniqueIndex(
      "assessment_items_biz_id_id_template_unique",
    ).on(table.bizId, table.id, table.assessmentTemplateId),

    /** One key per template. */
    assessmentItemsTemplateItemKeyUnique: uniqueIndex(
      "assessment_items_template_item_key_unique",
    ).on(table.assessmentTemplateId, table.itemKey),

    /** Template item expansion path. */
    assessmentItemsBizTemplateSortIdx: index("assessment_items_biz_template_sort_idx").on(
      table.bizId,
      table.assessmentTemplateId,
      table.sortOrder,
    ),

    /** Tenant-safe FK to parent template. */
    assessmentItemsBizTemplateFk: foreignKey({
      columns: [table.bizId, table.assessmentTemplateId],
      foreignColumns: [assessmentTemplates.bizId, assessmentTemplates.id],
      name: "assessment_items_biz_template_fk",
    }),

    /** Tenant-safe FK to optional requirement node. */
    assessmentItemsBizRequirementNodeFk: foreignKey({
      columns: [table.bizId, table.requirementNodeId],
      foreignColumns: [requirementNodes.bizId, requirementNodes.id],
      name: "assessment_items_biz_requirement_node_fk",
    }),

    /** Item bounds checks. */
    assessmentItemsBoundsCheck: check(
      "assessment_items_bounds_check",
      sql`
      "sort_order" >= 0
      AND "max_score" >= 0
      AND length("item_key") > 0
      `,
    ),
  }),
);

/**
 * assessment_attempts
 *
 * ELI5:
 * One row = one candidate attempt/run against one template.
 *
 * Attempts can be in-progress, submitted, graded, passed, failed, etc.
 */
export const assessmentAttempts = pgTable(
  "assessment_attempts",
  {
    /** Stable primary key for one attempt. */
    id: idWithTag("assessment_attempt"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent template being attempted. */
    assessmentTemplateId: idRef("assessment_template_id")
      .references(() => assessmentTemplates.id)
      .notNull(),

    /** Candidate subject namespace. */
    candidateSubjectType: varchar("candidate_subject_type", { length: 80 }).notNull(),

    /** Candidate subject id. */
    candidateSubjectId: varchar("candidate_subject_id", { length: 140 }).notNull(),

    /** Optional contextual subject namespace (cohort/session/booking/etc.). */
    contextSubjectType: varchar("context_subject_type", { length: 80 }),

    /** Optional contextual subject id. */
    contextSubjectId: varchar("context_subject_id", { length: 140 }),

    /**
     * Optional progression evaluation anchor.
     *
     * Use when this attempt directly contributes to one requirement evaluation.
     */
    requirementEvaluationId: idRef("requirement_evaluation_id").references(
      () => requirementEvaluations.id,
    ),

    /** Attempt lifecycle status. */
    status: assessmentAttemptStatusEnum("status").default("started").notNull(),

    /** Attempt ordinal number for one candidate+template pair. */
    attemptNumber: integer("attempt_number").default(1).notNull(),

    /** When attempt started. */
    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),

    /** When candidate submitted attempt. */
    submittedAt: timestamp("submitted_at", { withTimezone: true }),

    /** When grading completed (manual/auto/hybrid). */
    gradedAt: timestamp("graded_at", { withTimezone: true }),

    /** Optional expiration timestamp for stale/incomplete attempts. */
    expiresAt: timestamp("expires_at", { withTimezone: true }),

    /** Optional score percent (0..100). */
    scorePercent: integer("score_percent"),

    /** Total points available snapshot. */
    maxScore: integer("max_score"),

    /** Total points earned snapshot. */
    earnedScore: integer("earned_score"),

    /** Effective evaluation mode used for this attempt. */
    evaluationMode: assessmentEvaluationModeEnum("evaluation_mode"),

    /** Optional assigned reviewer/grader user. */
    reviewerUserId: idRef("reviewer_user_id").references(() => users.id),

    /** Optional idempotency key for deterministic attempt-start APIs. */
    requestKey: varchar("request_key", { length: 140 }),

    /** Result summary payload for this attempt. */
    resultSnapshot: jsonb("result_snapshot").default({}).notNull(),

    /** Policy snapshot applied during this attempt. */
    policySnapshot: jsonb("policy_snapshot").default({}).notNull(),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    assessmentAttemptsBizIdIdUnique: uniqueIndex("assessment_attempts_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Composite key used by response/result/grade child tables. */
    assessmentAttemptsBizIdIdTemplateUnique: uniqueIndex(
      "assessment_attempts_biz_id_id_template_unique",
    ).on(table.bizId, table.id, table.assessmentTemplateId),

    /** Unique attempt number per candidate+template. */
    assessmentAttemptsTemplateCandidateAttemptUnique: uniqueIndex(
      "assessment_attempts_template_candidate_attempt_unique",
    ).on(
      table.assessmentTemplateId,
      table.candidateSubjectType,
      table.candidateSubjectId,
      table.attemptNumber,
    ),

    /** Optional request-key dedupe path. */
    assessmentAttemptsBizRequestKeyUnique: uniqueIndex(
      "assessment_attempts_biz_request_key_unique",
    )
      .on(table.bizId, table.requestKey)
      .where(sql`"request_key" IS NOT NULL`),

    /** Attempt board path by template/status/time. */
    assessmentAttemptsBizTemplateStatusStartedIdx: index(
      "assessment_attempts_biz_template_status_started_idx",
    ).on(table.bizId, table.assessmentTemplateId, table.status, table.startedAt),

    /** Candidate history path. */
    assessmentAttemptsBizCandidateStartedIdx: index(
      "assessment_attempts_biz_candidate_started_idx",
    ).on(
      table.bizId,
      table.candidateSubjectType,
      table.candidateSubjectId,
      table.startedAt,
    ),

    /** Tenant-safe FK to template. */
    assessmentAttemptsBizTemplateFk: foreignKey({
      columns: [table.bizId, table.assessmentTemplateId],
      foreignColumns: [assessmentTemplates.bizId, assessmentTemplates.id],
      name: "assessment_attempts_biz_template_fk",
    }),

    /** Tenant-safe FK to candidate subject. */
    assessmentAttemptsBizCandidateFk: foreignKey({
      columns: [table.bizId, table.candidateSubjectType, table.candidateSubjectId],
      foreignColumns: [subjects.bizId, subjects.subjectType, subjects.subjectId],
      name: "assessment_attempts_biz_candidate_fk",
    }),

    /** Tenant-safe FK to optional context subject. */
    assessmentAttemptsBizContextFk: foreignKey({
      columns: [table.bizId, table.contextSubjectType, table.contextSubjectId],
      foreignColumns: [subjects.bizId, subjects.subjectType, subjects.subjectId],
      name: "assessment_attempts_biz_context_fk",
    }),

    /** Tenant-safe FK to optional requirement evaluation. */
    assessmentAttemptsBizRequirementEvalFk: foreignKey({
      columns: [table.bizId, table.requirementEvaluationId],
      foreignColumns: [requirementEvaluations.bizId, requirementEvaluations.id],
      name: "assessment_attempts_biz_requirement_eval_fk",
    }),

    /** Context subject pair must be fully null or fully populated. */
    assessmentAttemptsContextPairCheck: check(
      "assessment_attempts_context_pair_check",
      sql`
      (
        "context_subject_type" IS NULL
        AND "context_subject_id" IS NULL
      ) OR (
        "context_subject_type" IS NOT NULL
        AND "context_subject_id" IS NOT NULL
      )
      `,
    ),

    /** Attempt score/count/timeline bounds checks. */
    assessmentAttemptsBoundsAndTimelineCheck: check(
      "assessment_attempts_bounds_timeline_check",
      sql`
      "attempt_number" > 0
      AND ("score_percent" IS NULL OR ("score_percent" >= 0 AND "score_percent" <= 100))
      AND ("max_score" IS NULL OR "max_score" >= 0)
      AND ("earned_score" IS NULL OR "earned_score" >= 0)
      AND (
        "max_score" IS NULL
        OR "earned_score" IS NULL
        OR "earned_score" <= "max_score"
      )
      AND ("submitted_at" IS NULL OR "submitted_at" >= "started_at")
      AND ("graded_at" IS NULL OR "graded_at" >= "started_at")
      AND ("expires_at" IS NULL OR "expires_at" >= "started_at")
      `,
    ),

    /** Status-specific timestamps for deterministic lifecycle semantics. */
    assessmentAttemptsStatusShapeCheck: check(
      "assessment_attempts_status_shape_check",
      sql`
      (
        "status" NOT IN ('submitted', 'graded', 'passed', 'failed')
        OR "submitted_at" IS NOT NULL
      )
      AND (
        "status" NOT IN ('graded', 'passed', 'failed')
        OR "graded_at" IS NOT NULL
      )
      AND ("status" <> 'expired' OR "expires_at" IS NOT NULL)
      `,
    ),
  }),
);

/**
 * assessment_responses
 *
 * ELI5:
 * Candidate responses for each item in an attempt.
 *
 * Integrity goal:
 * - response references both attempt and item,
 * - and both are forced to belong to the same template.
 */
export const assessmentResponses = pgTable(
  "assessment_responses",
  {
    /** Stable primary key for one response row. */
    id: idWithTag("assessment_response"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent attempt row. */
    assessmentAttemptId: idRef("assessment_attempt_id")
      .references(() => assessmentAttempts.id)
      .notNull(),

    /** Template anchor duplicated for strong FK shape checks. */
    assessmentTemplateId: idRef("assessment_template_id")
      .references(() => assessmentTemplates.id)
      .notNull(),

    /** Item being answered. */
    assessmentItemId: idRef("assessment_item_id")
      .references(() => assessmentItems.id)
      .notNull(),

    /** Candidate response payload (choice ids, text, numeric value, file refs). */
    responsePayload: jsonb("response_payload").default({}).notNull(),

    /** Optional plain text extract for search/support. */
    responseText: text("response_text"),

    /** Optional score awarded for this response item. */
    scoreAwarded: integer("score_awarded"),

    /** Whether score was computed automatically. */
    autoScored: boolean("auto_scored").default(false).notNull(),

    /** Optional grader user when scoring is manual/hybrid. */
    scoredByUserId: idRef("scored_by_user_id").references(() => users.id),

    /** When response was saved/submitted. */
    respondedAt: timestamp("responded_at", { withTimezone: true }).defaultNow().notNull(),

    /** When score/feedback was applied. */
    scoredAt: timestamp("scored_at", { withTimezone: true }),

    /** Optional scorer feedback. */
    feedback: text("feedback"),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite key used by grading-events tenant-safe references. */
    assessmentResponsesBizIdIdUnique: uniqueIndex(
      "assessment_responses_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** One response per item per attempt. */
    assessmentResponsesAttemptItemUnique: uniqueIndex(
      "assessment_responses_attempt_item_unique",
    ).on(table.assessmentAttemptId, table.assessmentItemId),

    /** Attempt response query path. */
    assessmentResponsesBizAttemptIdx: index("assessment_responses_biz_attempt_idx").on(
      table.bizId,
      table.assessmentAttemptId,
      table.respondedAt,
    ),

    /** Item analytics query path. */
    assessmentResponsesBizItemIdx: index("assessment_responses_biz_item_idx").on(
      table.bizId,
      table.assessmentItemId,
      table.respondedAt,
    ),

    /** Tenant-safe FK to template. */
    assessmentResponsesBizTemplateFk: foreignKey({
      columns: [table.bizId, table.assessmentTemplateId],
      foreignColumns: [assessmentTemplates.bizId, assessmentTemplates.id],
      name: "assessment_responses_biz_template_fk",
    }),

    /** Tenant-safe FK to attempt with template consistency. */
    assessmentResponsesBizAttemptTemplateFk: foreignKey({
      columns: [table.bizId, table.assessmentAttemptId, table.assessmentTemplateId],
      foreignColumns: [
        assessmentAttempts.bizId,
        assessmentAttempts.id,
        assessmentAttempts.assessmentTemplateId,
      ],
      name: "assessment_responses_biz_attempt_template_fk",
    }),

    /** Tenant-safe FK to item with template consistency. */
    assessmentResponsesBizItemTemplateFk: foreignKey({
      columns: [table.bizId, table.assessmentItemId, table.assessmentTemplateId],
      foreignColumns: [
        assessmentItems.bizId,
        assessmentItems.id,
        assessmentItems.assessmentTemplateId,
      ],
      name: "assessment_responses_biz_item_template_fk",
    }),

    /** Response scoring bounds/timeline checks. */
    assessmentResponsesBoundsAndTimelineCheck: check(
      "assessment_responses_bounds_timeline_check",
      sql`
      ("score_awarded" IS NULL OR "score_awarded" >= 0)
      AND ("scored_at" IS NULL OR "scored_at" >= "responded_at")
      `,
    ),
  }),
);

/**
 * assessment_results
 *
 * ELI5:
 * Finalized attempt outcome snapshot.
 *
 * Why separate from `assessment_attempts`:
 * - keeps attempt lifecycle row lean for runtime writes,
 * - stores immutable-ish outcome snapshot for reporting/compliance,
 * - supports result invalidation/reissue without mutating raw responses.
 */
export const assessmentResults = pgTable(
  "assessment_results",
  {
    /** Stable primary key for one finalized result row. */
    id: idWithTag("assessment_result"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Source attempt row this result summarizes. */
    assessmentAttemptId: idRef("assessment_attempt_id")
      .references(() => assessmentAttempts.id)
      .notNull(),

    /** Template anchor snapshot. */
    assessmentTemplateId: idRef("assessment_template_id")
      .references(() => assessmentTemplates.id)
      .notNull(),

    /** Candidate subject snapshot. */
    candidateSubjectType: varchar("candidate_subject_type", { length: 80 }).notNull(),

    /** Candidate subject id snapshot. */
    candidateSubjectId: varchar("candidate_subject_id", { length: 140 }).notNull(),

    /** Final result status. */
    status: assessmentResultStatusEnum("status").default("pending").notNull(),

    /** Final score percent snapshot. */
    scorePercent: integer("score_percent"),

    /** Final max score snapshot. */
    maxScore: integer("max_score"),

    /** Final earned score snapshot. */
    earnedScore: integer("earned_score"),

    /** Finalization/decision timestamp. */
    decidedAt: timestamp("decided_at", { withTimezone: true }).defaultNow().notNull(),

    /** Optional invalidation timestamp. */
    invalidatedAt: timestamp("invalidated_at", { withTimezone: true }),

    /** Optional requirement-evaluation anchor for progression handoff. */
    requirementEvaluationId: idRef("requirement_evaluation_id").references(
      () => requirementEvaluations.id,
    ),

    /** Structured explanation payload (rubric output, waiver reason, etc.). */
    details: jsonb("details").default({}).notNull(),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    assessmentResultsBizIdIdUnique: uniqueIndex("assessment_results_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** One active result snapshot per attempt. */
    assessmentResultsAttemptUnique: uniqueIndex("assessment_results_attempt_unique").on(
      table.assessmentAttemptId,
    ),

    /** Result reporting path. */
    assessmentResultsBizStatusDecidedIdx: index("assessment_results_biz_status_decided_idx").on(
      table.bizId,
      table.status,
      table.decidedAt,
    ),

    /** Candidate result history path. */
    assessmentResultsBizCandidateDecidedIdx: index(
      "assessment_results_biz_candidate_decided_idx",
    ).on(table.bizId, table.candidateSubjectType, table.candidateSubjectId, table.decidedAt),

    /** Tenant-safe FK to attempt with template consistency. */
    assessmentResultsBizAttemptTemplateFk: foreignKey({
      columns: [table.bizId, table.assessmentAttemptId, table.assessmentTemplateId],
      foreignColumns: [
        assessmentAttempts.bizId,
        assessmentAttempts.id,
        assessmentAttempts.assessmentTemplateId,
      ],
      name: "assessment_results_biz_attempt_template_fk",
    }),

    /** Tenant-safe FK to template. */
    assessmentResultsBizTemplateFk: foreignKey({
      columns: [table.bizId, table.assessmentTemplateId],
      foreignColumns: [assessmentTemplates.bizId, assessmentTemplates.id],
      name: "assessment_results_biz_template_fk",
    }),

    /** Tenant-safe FK to candidate subject. */
    assessmentResultsBizCandidateFk: foreignKey({
      columns: [table.bizId, table.candidateSubjectType, table.candidateSubjectId],
      foreignColumns: [subjects.bizId, subjects.subjectType, subjects.subjectId],
      name: "assessment_results_biz_candidate_fk",
    }),

    /** Tenant-safe FK to optional requirement evaluation. */
    assessmentResultsBizRequirementEvalFk: foreignKey({
      columns: [table.bizId, table.requirementEvaluationId],
      foreignColumns: [requirementEvaluations.bizId, requirementEvaluations.id],
      name: "assessment_results_biz_requirement_eval_fk",
    }),

    /** Result bounds and timeline checks. */
    assessmentResultsBoundsAndTimelineCheck: check(
      "assessment_results_bounds_timeline_check",
      sql`
      ("score_percent" IS NULL OR ("score_percent" >= 0 AND "score_percent" <= 100))
      AND ("max_score" IS NULL OR "max_score" >= 0)
      AND ("earned_score" IS NULL OR "earned_score" >= 0)
      AND ("max_score" IS NULL OR "earned_score" IS NULL OR "earned_score" <= "max_score")
      AND ("invalidated_at" IS NULL OR "invalidated_at" >= "decided_at")
      `,
    ),

    /** Status-specific timeline requirements. */
    assessmentResultsStatusShapeCheck: check(
      "assessment_results_status_shape_check",
      sql`"status" <> 'invalidated' OR "invalidated_at" IS NOT NULL`,
    ),
  }),
);

/**
 * grading_events
 *
 * ELI5:
 * Immutable timeline of grading/override actions for one attempt.
 *
 * This table is the audit trail for grading behavior, not just the final score.
 */
export const gradingEvents = pgTable(
  "grading_events",
  {
    /** Stable primary key for one grading event. */
    id: idWithTag("grading_event"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent attempt. */
    assessmentAttemptId: idRef("assessment_attempt_id")
      .references(() => assessmentAttempts.id)
      .notNull(),

    /** Template anchor for stronger FK consistency. */
    assessmentTemplateId: idRef("assessment_template_id")
      .references(() => assessmentTemplates.id)
      .notNull(),

    /** Optional related response row when event is item-level. */
    assessmentResponseId: idRef("assessment_response_id").references(
      () => assessmentResponses.id,
    ),

    /** Event taxonomy. */
    eventType: gradingEventTypeEnum("event_type").notNull(),

    /** Event timestamp. */
    happenedAt: timestamp("happened_at", { withTimezone: true }).defaultNow().notNull(),

    /** Optional direct user actor (reviewer/system operator). */
    actorUserId: idRef("actor_user_id").references(() => users.id),

    /** Optional custom actor namespace (plugin/automation worker/etc.). */
    actorSubjectType: varchar("actor_subject_type", { length: 80 }),

    /** Optional custom actor id. */
    actorSubjectId: varchar("actor_subject_id", { length: 140 }),

    /** Optional signed score change represented by this event. */
    scoreDelta: integer("score_delta"),

    /** Optional note payload for reviewer context. */
    note: text("note"),

    /** Structured event details. */
    payload: jsonb("payload").default({}).notNull(),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    gradingEventsBizIdIdUnique: uniqueIndex("grading_events_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Attempt timeline query path. */
    gradingEventsBizAttemptHappenedIdx: index("grading_events_biz_attempt_happened_idx").on(
      table.bizId,
      table.assessmentAttemptId,
      table.happenedAt,
    ),

    /** Event-type analytics path. */
    gradingEventsBizTypeHappenedIdx: index("grading_events_biz_type_happened_idx").on(
      table.bizId,
      table.eventType,
      table.happenedAt,
    ),
    /** Tenant-safe FK to assessment template anchor. */
    gradingEventsBizTemplateFk: foreignKey({
      columns: [table.bizId, table.assessmentTemplateId],
      foreignColumns: [assessmentTemplates.bizId, assessmentTemplates.id],
      name: "grading_events_biz_template_fk",
    }),

    /** Tenant-safe FK to attempt with template consistency. */
    gradingEventsBizAttemptTemplateFk: foreignKey({
      columns: [table.bizId, table.assessmentAttemptId, table.assessmentTemplateId],
      foreignColumns: [
        assessmentAttempts.bizId,
        assessmentAttempts.id,
        assessmentAttempts.assessmentTemplateId,
      ],
      name: "grading_events_biz_attempt_template_fk",
    }),

    /** Tenant-safe FK to optional response row. */
    gradingEventsBizResponseFk: foreignKey({
      columns: [table.bizId, table.assessmentResponseId],
      foreignColumns: [assessmentResponses.bizId, assessmentResponses.id],
      name: "grading_events_biz_response_fk",
    }),

    /** Tenant-safe FK to optional actor subject pointer. */
    gradingEventsBizActorSubjectFk: foreignKey({
      columns: [table.bizId, table.actorSubjectType, table.actorSubjectId],
      foreignColumns: [subjects.bizId, subjects.subjectType, subjects.subjectId],
      name: "grading_events_biz_actor_subject_fk",
    }),

    /** Actor subject pointer must be fully null or fully populated. */
    gradingEventsActorSubjectPairCheck: check(
      "grading_events_actor_subject_pair_check",
      sql`
      (
        "actor_subject_type" IS NULL
        AND "actor_subject_id" IS NULL
      ) OR (
        "actor_subject_type" IS NOT NULL
        AND "actor_subject_id" IS NOT NULL
      )
      `,
    ),
  }),
);

export type AssessmentTemplate = typeof assessmentTemplates.$inferSelect;
export type NewAssessmentTemplate = typeof assessmentTemplates.$inferInsert;
export type AssessmentItem = typeof assessmentItems.$inferSelect;
export type NewAssessmentItem = typeof assessmentItems.$inferInsert;
export type AssessmentAttempt = typeof assessmentAttempts.$inferSelect;
export type NewAssessmentAttempt = typeof assessmentAttempts.$inferInsert;
export type AssessmentResponse = typeof assessmentResponses.$inferSelect;
export type NewAssessmentResponse = typeof assessmentResponses.$inferInsert;
export type AssessmentResult = typeof assessmentResults.$inferSelect;
export type NewAssessmentResult = typeof assessmentResults.$inferInsert;
export type GradingEvent = typeof gradingEvents.$inferSelect;
export type NewGradingEvent = typeof gradingEvents.$inferInsert;
