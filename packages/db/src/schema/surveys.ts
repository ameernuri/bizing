import { sql } from "drizzle-orm";
import { check, foreignKey, index, uniqueIndex } from "drizzle-orm/pg-core";
import {
  boolean,
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
import { communicationChannelEnum, customFieldTargetTypeEnum, lifecycleStatusEnum, surveyInvitationStatusEnum, surveyQuestionTypeEnum, surveyResponseStatusEnum, surveyResponseVisibilityEnum } from "./enums";
import { bizExtensionInstalls } from "./extensions";
import { groupAccounts } from "./group_accounts";
import { users } from "./users";

/**
 * survey_templates
 *
 * ELI5:
 * Reusable survey definitions with immutable versioning.
 *
 * Example:
 * - post-appointment NPS survey
 * - cancellation reason survey
 * - course completion feedback survey
 */
export const surveyTemplates = pgTable(
  "survey_templates",
  {
    /** Stable primary key for one survey version. */
    id: idWithTag("survey_template"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Optional extension owner for plugin-driven survey templates. */
    bizExtensionInstallId: idRef("biz_extension_install_id").references(
      () => bizExtensionInstalls.id,
    ),

    /** Human-readable survey name. */
    name: varchar("name", { length: 220 }).notNull(),

    /** Stable machine slug for template version families. */
    slug: varchar("slug", { length: 140 }).notNull(),

    /** Immutable version inside one slug. */
    version: integer("version").default(1).notNull(),

    /** Template lifecycle status. */
    status: lifecycleStatusEnum("status").default("draft").notNull(),

    /** Marks this as default active version for slug. */
    isCurrent: boolean("is_current").default(false).notNull(),

    /** Optional survey title shown to respondent. */
    title: varchar("title", { length: 320 }),

    /** Optional description/instructions shown before answering. */
    description: text("description"),

    /** Allows no-auth response mode when true. */
    allowAnonymous: boolean("allow_anonymous").default(false).notNull(),

    /** Optional trigger topic key used by orchestration. */
    triggerEvent: varchar("trigger_event", { length: 180 }),

    /** Delay between trigger and invitation send. */
    sendDelayMinutes: integer("send_delay_minutes").default(0).notNull(),

    /** Incentive/reward policy payload for completion incentives. */
    incentivePolicy: jsonb("incentive_policy").default({}).notNull(),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    surveyTemplatesBizIdIdUnique: uniqueIndex("survey_templates_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Composite key for tenant-safe child references. */

    /** One immutable version per slug/version tuple. */
    surveyTemplatesBizSlugVersionUnique: uniqueIndex(
      "survey_templates_biz_slug_version_unique",
    ).on(table.bizId, table.slug, table.version),

    /** One current version per slug. */
    surveyTemplatesBizSlugCurrentUnique: uniqueIndex(
      "survey_templates_biz_slug_current_unique",
    )
      .on(table.bizId, table.slug)
      .where(sql`"is_current" = true`),

    /** Common picker/list path. */
    surveyTemplatesBizStatusIdx: index("survey_templates_biz_status_idx").on(
      table.bizId,
      table.status,
      table.isCurrent,
    ),

    /** Tenant-safe FK to optional extension owner. */
    surveyTemplatesBizInstallFk: foreignKey({
      columns: [table.bizId, table.bizExtensionInstallId],
      foreignColumns: [bizExtensionInstalls.bizId, bizExtensionInstalls.id],
      name: "survey_templates_biz_install_fk",
    }),

    /** Version and delay bounds. */
    surveyTemplatesBoundsCheck: check(
      "survey_templates_bounds_check",
      sql`"version" >= 1 AND "send_delay_minutes" >= 0`,
    ),
  }),
);

/**
 * survey_questions
 *
 * ELI5:
 * One row is one question definition in a survey template.
 */
export const surveyQuestions = pgTable(
  "survey_questions",
  {
    /** Stable primary key. */
    id: idWithTag("survey_question"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent template. */
    surveyTemplateId: idRef("survey_template_id")
      .references(() => surveyTemplates.id)
      .notNull(),

    /** Stable question key in API payloads and exports. */
    questionKey: varchar("question_key", { length: 120 }).notNull(),

    /** Question input type. */
    questionType: surveyQuestionTypeEnum("question_type").notNull(),

    /** Prompt shown to respondent. */
    prompt: text("prompt").notNull(),

    /** Requiredness for completion validation. */
    isRequired: boolean("is_required").default(false).notNull(),

    /** Ordering hint in rendered survey. */
    sortOrder: integer("sort_order").default(100).notNull(),

    /**
     * Select-option list and display config.
     * Kept JSON to support flexible question builders.
     */
    options: jsonb("options").default([]).notNull(),

    /** Optional minimum value for numeric/rating scales. */
    scaleMin: integer("scale_min"),

    /** Optional maximum value for numeric/rating scales. */
    scaleMax: integer("scale_max"),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    surveyQuestionsBizIdIdUnique: uniqueIndex("survey_questions_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Composite key for tenant-safe references to this survey-question row. */

    /** One key per survey template. */
    surveyQuestionsUnique: uniqueIndex("survey_questions_unique").on(
      table.surveyTemplateId,
      table.questionKey,
    ),

    /** Common render path. */
    surveyQuestionsBizTemplateSortIdx: index(
      "survey_questions_biz_template_sort_idx",
    ).on(table.bizId, table.surveyTemplateId, table.sortOrder),

    /** Tenant-safe FK to template. */
    surveyQuestionsBizTemplateFk: foreignKey({
      columns: [table.bizId, table.surveyTemplateId],
      foreignColumns: [surveyTemplates.bizId, surveyTemplates.id],
      name: "survey_questions_biz_template_fk",
    }),

    /** Scale/sort bounds sanity checks. */
    surveyQuestionsBoundsCheck: check(
      "survey_questions_bounds_check",
      sql`
      "sort_order" >= 0
      AND ("scale_min" IS NULL OR "scale_max" IS NULL OR "scale_max" >= "scale_min")
      `,
    ),
  }),
);

/**
 * survey_invitations
 *
 * ELI5:
 * One invitation represents one request sent to a subject to complete a survey.
 */
export const surveyInvitations = pgTable(
  "survey_invitations",
  {
    /** Stable primary key. */
    id: idWithTag("survey_invite"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Survey template version used for this invitation. */
    surveyTemplateId: idRef("survey_template_id")
      .references(() => surveyTemplates.id)
      .notNull(),

    /** Target object class that triggered this invitation. */
    targetType: customFieldTargetTypeEnum("target_type").notNull(),

    /** Triggering object id (booking, order, service, etc.). */
    targetRefId: varchar("target_ref_id", { length: 140 }).notNull(),

    /** Optional convenience FK to user recipient. */
    recipientUserId: idRef("recipient_user_id").references(() => users.id),

    /** Optional convenience FK to group-account recipient. */
    recipientGroupAccountId: idRef("recipient_group_account_id").references(
      () => groupAccounts.id,
    ),

    /** Channel used for invitation delivery. */
    channel: communicationChannelEnum("channel").default("email").notNull(),

    /** Invitation lifecycle status. */
    status: surveyInvitationStatusEnum("status").default("pending").notNull(),

    /** Opaque response token hash for anonymous/public response URLs. */
    tokenHash: varchar("token_hash", { length: 128 }),

    /** Send timestamp. */
    sentAt: timestamp("sent_at", { withTimezone: true }),

    /** First open timestamp. */
    openedAt: timestamp("opened_at", { withTimezone: true }),

    /** Completion timestamp when response accepted. */
    completedAt: timestamp("completed_at", { withTimezone: true }),

    /** Optional expiry timestamp. */
    expiresAt: timestamp("expires_at", { withTimezone: true }),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite key for tenant-safe response FK. */
    surveyInvitationsBizIdIdUnique: uniqueIndex(
      "survey_invitations_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** Token uniqueness for secure anonymous response URLs. */
    surveyInvitationsTokenUnique: uniqueIndex("survey_invitations_token_unique")
      .on(table.bizId, table.tokenHash)
      .where(sql`"token_hash" IS NOT NULL`),

    /** Common operational queue path. */
    surveyInvitationsBizStatusSentIdx: index(
      "survey_invitations_biz_status_sent_idx",
    ).on(table.bizId, table.status, table.sentAt),

    /** Tenant-safe FK to survey template. */
    surveyInvitationsBizTemplateFk: foreignKey({
      columns: [table.bizId, table.surveyTemplateId],
      foreignColumns: [surveyTemplates.bizId, surveyTemplates.id],
      name: "survey_invitations_biz_template_fk",
    }),

    /** At least one recipient identity anchor should exist. */
    surveyInvitationsRecipientCheck: check(
      "survey_invitations_recipient_check",
      sql`
      "recipient_user_id" IS NOT NULL
      OR "recipient_group_account_id" IS NOT NULL
      OR "token_hash" IS NOT NULL
      `,
    ),
  }),
);

/**
 * survey_responses
 *
 * ELI5:
 * One row is one response attempt tied to one invitation.
 */
export const surveyResponses = pgTable(
  "survey_responses",
  {
    /** Stable primary key. */
    id: idWithTag("survey_response"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent invitation. */
    surveyInvitationId: idRef("survey_invitation_id")
      .references(() => surveyInvitations.id)
      .notNull(),

    /** Response lifecycle status. */
    status: surveyResponseStatusEnum("status").default("started").notNull(),

    /** Identity visibility mode for this response. */
    visibility: surveyResponseVisibilityEnum("visibility")
      .default("identified")
      .notNull(),

    /** Optional responder identity when known. */
    respondentUserId: idRef("respondent_user_id").references(() => users.id),

    /** Response start timestamp. */
    startedAt: timestamp("started_at", { withTimezone: true })
      .defaultNow()
      .notNull(),

    /** Response completion timestamp. */
    submittedAt: timestamp("submitted_at", { withTimezone: true }),

    /** Optional high-level rating metric for quick dashboards. */
    overallRating: integer("overall_rating"),

    /** Optional NPS score (0..10). */
    npsScore: integer("nps_score"),

    /** Canonical full response payload snapshot. */
    responsePayload: jsonb("response_payload").default({}).notNull(),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    surveyResponsesBizIdIdUnique: uniqueIndex("survey_responses_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** One response row per invitation by default. */
    surveyResponsesInvitationUnique: uniqueIndex("survey_responses_invitation_unique").on(
      table.surveyInvitationId,
    ),

    /** Composite key for tenant-safe answers FK. */

    /** Common review/analysis path. */
    surveyResponsesBizStatusSubmittedIdx: index(
      "survey_responses_biz_status_submitted_idx",
    ).on(table.bizId, table.status, table.submittedAt),

    /** Tenant-safe FK to invitation. */
    surveyResponsesBizInvitationFk: foreignKey({
      columns: [table.bizId, table.surveyInvitationId],
      foreignColumns: [surveyInvitations.bizId, surveyInvitations.id],
      name: "survey_responses_biz_invitation_fk",
    }),

    /** Numeric and timestamp bounds sanity checks. */
    surveyResponsesBoundsCheck: check(
      "survey_responses_bounds_check",
      sql`
      ("overall_rating" IS NULL OR ("overall_rating" >= 0 AND "overall_rating" <= 10))
      AND ("nps_score" IS NULL OR ("nps_score" >= 0 AND "nps_score" <= 10))
      AND ("submitted_at" IS NULL OR "submitted_at" >= "started_at")
      `,
    ),
  }),
);

/**
 * survey_response_answers
 *
 * ELI5:
 * Per-question normalized answer rows for analytics and filtering.
 */
export const surveyResponseAnswers = pgTable(
  "survey_response_answers",
  {
    /** Stable primary key. */
    id: idWithTag("survey_answer"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent response. */
    surveyResponseId: idRef("survey_response_id")
      .references(() => surveyResponses.id)
      .notNull(),

    /** Question this answer corresponds to. */
    surveyQuestionId: idRef("survey_question_id")
      .references(() => surveyQuestions.id)
      .notNull(),

    /** Optional text answer projection. */
    answerText: text("answer_text"),

    /**
     * Optional numeric answer projection.
     *
     * Fixed precision avoids floating-point drift in analytics boundaries.
     */
    answerNumber: numeric("answer_number", { precision: 24, scale: 8 }),

    /** Optional boolean answer projection. */
    answerBoolean: boolean("answer_boolean"),

    /** Optional option list answer projection for single/multi select. */
    answerOptions: jsonb("answer_options"),

    /** Canonical answer payload for rich/custom answer types. */
    answerPayload: jsonb("answer_payload").default({}).notNull(),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    surveyResponseAnswersBizIdIdUnique: uniqueIndex("survey_response_answers_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** One answer per question per response. */
    surveyResponseAnswersUnique: uniqueIndex("survey_response_answers_unique").on(
      table.surveyResponseId,
      table.surveyQuestionId,
    ),

    /** Common response detail path. */
    surveyResponseAnswersBizResponseIdx: index(
      "survey_response_answers_biz_response_idx",
    ).on(table.bizId, table.surveyResponseId),

    /** Common question analytics path. */
    surveyResponseAnswersBizQuestionIdx: index(
      "survey_response_answers_biz_question_idx",
    ).on(table.bizId, table.surveyQuestionId),

    /** Tenant-safe FK to response. */
    surveyResponseAnswersBizResponseFk: foreignKey({
      columns: [table.bizId, table.surveyResponseId],
      foreignColumns: [surveyResponses.bizId, surveyResponses.id],
      name: "survey_response_answers_biz_response_fk",
    }),

    /** Tenant-safe FK to question. */
    surveyResponseAnswersBizQuestionFk: foreignKey({
      columns: [table.bizId, table.surveyQuestionId],
      foreignColumns: [surveyQuestions.bizId, surveyQuestions.id],
      name: "survey_response_answers_biz_question_fk",
    }),

    /** At least one answer surface should be populated. */
    surveyResponseAnswersShapeCheck: check(
      "survey_response_answers_shape_check",
      sql`
      "answer_text" IS NOT NULL
      OR "answer_number" IS NOT NULL
      OR "answer_boolean" IS NOT NULL
      OR "answer_options" IS NOT NULL
      OR "answer_payload" <> '{}'::jsonb
      `,
    ),
  }),
);

export type SurveyTemplate = typeof surveyTemplates.$inferSelect;
export type NewSurveyTemplate = typeof surveyTemplates.$inferInsert;

export type SurveyQuestion = typeof surveyQuestions.$inferSelect;
export type NewSurveyQuestion = typeof surveyQuestions.$inferInsert;

export type SurveyInvitation = typeof surveyInvitations.$inferSelect;
export type NewSurveyInvitation = typeof surveyInvitations.$inferInsert;

export type SurveyResponse = typeof surveyResponses.$inferSelect;
export type NewSurveyResponse = typeof surveyResponses.$inferInsert;

export type SurveyResponseAnswer = typeof surveyResponseAnswers.$inferSelect;
export type NewSurveyResponseAnswer = typeof surveyResponseAnswers.$inferInsert;
