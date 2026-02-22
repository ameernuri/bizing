import { sql } from "drizzle-orm";
import { check, foreignKey, index, uniqueIndex } from "drizzle-orm/pg-core";
import {
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { idRef, idWithTag, withAuditRefs } from "./_common";
import { bizes } from "./bizes";
import { cohortEnrollments, programCohortSessions } from "./education";
import {
  sessionInteractionSourceTypeEnum,
  sessionInteractionTypeEnum,
  sessionInteractionVisibilityEnum,
} from "./enums";
import { fulfillmentUnits } from "./fulfillment";
import { subjects } from "./subjects";
import { users } from "./users";

/**
 * session_interaction_events
 *
 * ELI5:
 * One row = one interaction moment around a live or virtual session.
 *
 * Examples:
 * - attendee joins/leaves,
 * - chat message,
 * - Q&A question/answer,
 * - poll response,
 * - replay view.
 *
 * Why this exists:
 * - engagement is often needed for operations, quality, and follow-up,
 * - today those details usually hide in provider webhooks/logs,
 * - this table gives one normalized, queryable engagement timeline.
 */
export const sessionInteractionEvents = pgTable(
  "session_interaction_events",
  {
    /** Stable primary key for one interaction event. */
    id: idWithTag("session_interaction"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Session source family for this interaction event. */
    sourceType: sessionInteractionSourceTypeEnum("source_type").notNull(),

    /** Session pointer when source_type=program_session. */
    programSessionId: idRef("program_session_id").references(
      () => programCohortSessions.id,
    ),

    /** Session pointer when source_type=fulfillment_unit. */
    fulfillmentUnitId: idRef("fulfillment_unit_id").references(
      () => fulfillmentUnits.id,
    ),

    /** Session pointer when source_type=custom_subject (namespace). */
    customSessionSubjectType: varchar("custom_session_subject_type", { length: 80 }),

    /** Session pointer when source_type=custom_subject (id). */
    customSessionSubjectId: varchar("custom_session_subject_id", { length: 140 }),

    /** Optional direct participant user. */
    participantUserId: idRef("participant_user_id").references(() => users.id),

    /** Optional participant enrollment pointer for education sessions. */
    participantEnrollmentId: idRef("participant_enrollment_id").references(
      () => cohortEnrollments.id,
    ),

    /** Optional participant custom subject namespace. */
    participantSubjectType: varchar("participant_subject_type", { length: 80 }),

    /** Optional participant custom subject id. */
    participantSubjectId: varchar("participant_subject_id", { length: 140 }),

    /** Interaction type classification. */
    interactionType: sessionInteractionTypeEnum("interaction_type").notNull(),

    /** Visibility class used by UI/API redaction logic. */
    visibility: sessionInteractionVisibilityEnum("visibility")
      .default("public")
      .notNull(),

    /** Event occurrence timestamp. */
    occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),

    /** Optional thread key (Q&A thread, poll question key, etc.). */
    threadKey: varchar("thread_key", { length: 120 }),

    /** Optional plain-text content for message/question/answer style events. */
    contentText: text("content_text"),

    /** Structured event payload for provider-specific or typed data. */
    payload: jsonb("payload").default({}).notNull(),

    /** Optional idempotency key for webhook ingestors. */
    requestKey: varchar("request_key", { length: 140 }),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    sessionInteractionEventsBizIdIdUnique: uniqueIndex("session_interaction_events_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Session timeline path. */
    sessionInteractionEventsBizSourceOccurredIdx: index(
      "session_interaction_events_biz_source_occurred_idx",
    ).on(
      table.bizId,
      table.sourceType,
      table.programSessionId,
      table.fulfillmentUnitId,
      table.occurredAt,
    ),

    /** Participant journey path. */
    sessionInteractionEventsBizParticipantOccurredIdx: index(
      "session_interaction_events_biz_participant_occurred_idx",
    ).on(table.bizId, table.participantUserId, table.participantEnrollmentId, table.occurredAt),

    /** Interaction analytics path. */
    sessionInteractionEventsBizTypeOccurredIdx: index(
      "session_interaction_events_biz_type_occurred_idx",
    ).on(table.bizId, table.interactionType, table.occurredAt),

    /** Optional dedupe path for ingestion workers. */
    sessionInteractionEventsBizRequestKeyUnique: uniqueIndex(
      "session_interaction_events_biz_request_key_unique",
    )
      .on(table.bizId, table.requestKey)
      .where(sql`"request_key" IS NOT NULL`),

    /** Tenant-safe FK to optional program session. */
    sessionInteractionEventsBizProgramSessionFk: foreignKey({
      columns: [table.bizId, table.programSessionId],
      foreignColumns: [programCohortSessions.bizId, programCohortSessions.id],
      name: "session_interaction_events_biz_program_session_fk",
    }),

    /** Tenant-safe FK to optional fulfillment unit. */
    sessionInteractionEventsBizFulfillmentUnitFk: foreignKey({
      columns: [table.bizId, table.fulfillmentUnitId],
      foreignColumns: [fulfillmentUnits.bizId, fulfillmentUnits.id],
      name: "session_interaction_events_biz_fulfillment_unit_fk",
    }),

    /** Tenant-safe FK to optional custom-session subject. */
    sessionInteractionEventsBizCustomSessionSubjectFk: foreignKey({
      columns: [table.bizId, table.customSessionSubjectType, table.customSessionSubjectId],
      foreignColumns: [subjects.bizId, subjects.subjectType, subjects.subjectId],
      name: "session_interaction_events_biz_custom_session_subject_fk",
    }),

    /** Tenant-safe FK to optional participant enrollment pointer. */
    sessionInteractionEventsBizEnrollmentFk: foreignKey({
      columns: [table.bizId, table.participantEnrollmentId],
      foreignColumns: [cohortEnrollments.bizId, cohortEnrollments.id],
      name: "session_interaction_events_biz_enrollment_fk",
    }),

    /** Tenant-safe FK to optional participant custom subject pointer. */
    sessionInteractionEventsBizParticipantSubjectFk: foreignKey({
      columns: [table.bizId, table.participantSubjectType, table.participantSubjectId],
      foreignColumns: [subjects.bizId, subjects.subjectType, subjects.subjectId],
      name: "session_interaction_events_biz_participant_subject_fk",
    }),

    /** Custom session pointer should be fully null or fully populated. */
    sessionInteractionEventsCustomSessionPairCheck: check(
      "session_interaction_events_custom_session_pair_check",
      sql`
      (
        "custom_session_subject_type" IS NULL
        AND "custom_session_subject_id" IS NULL
      ) OR (
        "custom_session_subject_type" IS NOT NULL
        AND "custom_session_subject_id" IS NOT NULL
      )
      `,
    ),

    /** Participant subject pointer should be fully null or fully populated. */
    sessionInteractionEventsParticipantSubjectPairCheck: check(
      "session_interaction_events_participant_subject_pair_check",
      sql`
      (
        "participant_subject_type" IS NULL
        AND "participant_subject_id" IS NULL
      ) OR (
        "participant_subject_type" IS NOT NULL
        AND "participant_subject_id" IS NOT NULL
      )
      `,
    ),

    /** At most one participant identity source should be set to avoid ambiguity. */
    sessionInteractionEventsParticipantShapeCheck: check(
      "session_interaction_events_participant_shape_check",
      sql`
      (
        ("participant_user_id" IS NOT NULL)::int
        + ("participant_enrollment_id" IS NOT NULL)::int
        + ("participant_subject_type" IS NOT NULL)::int
      ) <= 1
      `,
    ),

    /** Source payload should match source_type exactly. */
    sessionInteractionEventsSourceShapeCheck: check(
      "session_interaction_events_source_shape_check",
      sql`
      (
        "source_type" = 'program_session'
        AND "program_session_id" IS NOT NULL
        AND "fulfillment_unit_id" IS NULL
        AND "custom_session_subject_type" IS NULL
        AND "custom_session_subject_id" IS NULL
      ) OR (
        "source_type" = 'fulfillment_unit'
        AND "program_session_id" IS NULL
        AND "fulfillment_unit_id" IS NOT NULL
        AND "custom_session_subject_type" IS NULL
        AND "custom_session_subject_id" IS NULL
      ) OR (
        "source_type" = 'custom_subject'
        AND "program_session_id" IS NULL
        AND "fulfillment_unit_id" IS NULL
        AND "custom_session_subject_type" IS NOT NULL
        AND "custom_session_subject_id" IS NOT NULL
      )
      `,
    ),

    /** Text payload is required for chat/qna message types. */
    sessionInteractionEventsTextShapeCheck: check(
      "session_interaction_events_text_shape_check",
      sql`
      (
        "interaction_type" IN ('chat_message', 'qna_question', 'qna_answer')
        AND "content_text" IS NOT NULL
      ) OR (
        "interaction_type" NOT IN ('chat_message', 'qna_question', 'qna_answer')
      )
      `,
    ),
  }),
);

/**
 * session_interaction_aggregates
 *
 * ELI5:
 * Optional read-model table for fast dashboards (counts by bucket/type/session).
 *
 * Why this table exists:
 * - keeps heavy analytics queries off the raw event stream,
 * - supports real-time-ish engagement dashboards without complex ad-hoc SQL.
 */
export const sessionInteractionAggregates = pgTable(
  "session_interaction_aggregates",
  {
    /** Stable primary key for one aggregate bucket row. */
    id: idWithTag("session_interaction_agg"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Session source family represented by this aggregate row. */
    sourceType: sessionInteractionSourceTypeEnum("source_type").notNull(),

    /** Session pointer when source_type=program_session. */
    programSessionId: idRef("program_session_id").references(
      () => programCohortSessions.id,
    ),

    /** Session pointer when source_type=fulfillment_unit. */
    fulfillmentUnitId: idRef("fulfillment_unit_id").references(
      () => fulfillmentUnits.id,
    ),

    /** Session pointer when source_type=custom_subject (namespace). */
    customSessionSubjectType: varchar("custom_session_subject_type", { length: 80 }),

    /** Session pointer when source_type=custom_subject (id). */
    customSessionSubjectId: varchar("custom_session_subject_id", { length: 140 }),

    /** Bucket granularity key (`minute`, `hour`, `day`, etc.). */
    granularity: varchar("granularity", { length: 24 }).notNull(),

    /** Aggregate bucket start time. */
    bucketStartsAt: timestamp("bucket_starts_at", { withTimezone: true }).notNull(),

    /** Aggregate bucket end time (exclusive). */
    bucketEndsAt: timestamp("bucket_ends_at", { withTimezone: true }).notNull(),

    /** Optional interaction type slice; null means "all types". */
    interactionType: sessionInteractionTypeEnum("interaction_type"),

    /** Event count in this bucket slice. */
    eventCount: integer("event_count").default(0).notNull(),

    /** Unique participant count in this bucket slice. */
    uniqueParticipantCount: integer("unique_participant_count")
      .default(0)
      .notNull(),

    /** Optional latest event timestamp included in this aggregate. */
    lastEventAt: timestamp("last_event_at", { withTimezone: true }),

    /** Extra aggregate metrics payload. */
    metrics: jsonb("metrics").default({}).notNull(),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    sessionInteractionAggregatesBizIdIdUnique: uniqueIndex("session_interaction_aggregates_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /**
     * Prevent duplicate aggregate rows for same bucket slice.
     *
     * Uses all source pointers so one session-source tuple has deterministic
     * aggregate identity per bucket and interaction slice.
     */
    sessionInteractionAggregatesBucketUnique: uniqueIndex(
      "session_interaction_aggregates_bucket_unique",
    ).on(
      table.bizId,
      table.sourceType,
      table.programSessionId,
      table.fulfillmentUnitId,
      table.customSessionSubjectType,
      table.customSessionSubjectId,
      table.granularity,
      table.bucketStartsAt,
      table.interactionType,
    ),

    /** Main dashboard query path. */
    sessionInteractionAggregatesBizSourceBucketIdx: index(
      "session_interaction_aggregates_biz_source_bucket_idx",
    ).on(table.bizId, table.sourceType, table.bucketStartsAt, table.interactionType),

    /** Tenant-safe FK to optional program session. */
    sessionInteractionAggregatesBizProgramSessionFk: foreignKey({
      columns: [table.bizId, table.programSessionId],
      foreignColumns: [programCohortSessions.bizId, programCohortSessions.id],
      name: "session_interaction_aggregates_biz_program_session_fk",
    }),

    /** Tenant-safe FK to optional fulfillment unit. */
    sessionInteractionAggregatesBizFulfillmentUnitFk: foreignKey({
      columns: [table.bizId, table.fulfillmentUnitId],
      foreignColumns: [fulfillmentUnits.bizId, fulfillmentUnits.id],
      name: "session_interaction_aggregates_biz_fulfillment_unit_fk",
    }),

    /** Tenant-safe FK to optional custom-session subject pointer. */
    sessionInteractionAggregatesBizCustomSessionSubjectFk: foreignKey({
      columns: [table.bizId, table.customSessionSubjectType, table.customSessionSubjectId],
      foreignColumns: [subjects.bizId, subjects.subjectType, subjects.subjectId],
      name: "session_interaction_aggregates_biz_custom_session_subject_fk",
    }),

    /** Custom session pointer should be fully null or fully populated. */
    sessionInteractionAggregatesCustomSessionPairCheck: check(
      "session_interaction_aggregates_custom_session_pair_check",
      sql`
      (
        "custom_session_subject_type" IS NULL
        AND "custom_session_subject_id" IS NULL
      ) OR (
        "custom_session_subject_type" IS NOT NULL
        AND "custom_session_subject_id" IS NOT NULL
      )
      `,
    ),

    /** Source payload shape should match source_type exactly. */
    sessionInteractionAggregatesSourceShapeCheck: check(
      "session_interaction_aggregates_source_shape_check",
      sql`
      (
        "source_type" = 'program_session'
        AND "program_session_id" IS NOT NULL
        AND "fulfillment_unit_id" IS NULL
        AND "custom_session_subject_type" IS NULL
        AND "custom_session_subject_id" IS NULL
      ) OR (
        "source_type" = 'fulfillment_unit'
        AND "program_session_id" IS NULL
        AND "fulfillment_unit_id" IS NOT NULL
        AND "custom_session_subject_type" IS NULL
        AND "custom_session_subject_id" IS NULL
      ) OR (
        "source_type" = 'custom_subject'
        AND "program_session_id" IS NULL
        AND "fulfillment_unit_id" IS NULL
        AND "custom_session_subject_type" IS NOT NULL
        AND "custom_session_subject_id" IS NOT NULL
      )
      `,
    ),

    /** Aggregate window and count bounds. */
    sessionInteractionAggregatesBoundsCheck: check(
      "session_interaction_aggregates_bounds_check",
      sql`
      "bucket_ends_at" > "bucket_starts_at"
      AND "event_count" >= 0
      AND "unique_participant_count" >= 0
      AND "unique_participant_count" <= "event_count"
      AND "granularity" IN ('minute', 'hour', 'day')
      AND ("last_event_at" IS NULL OR "last_event_at" >= "bucket_starts_at")
      `,
    ),
  }),
);

export type SessionInteractionEvent = typeof sessionInteractionEvents.$inferSelect;
export type NewSessionInteractionEvent = typeof sessionInteractionEvents.$inferInsert;
export type SessionInteractionAggregate = typeof sessionInteractionAggregates.$inferSelect;
export type NewSessionInteractionAggregate = typeof sessionInteractionAggregates.$inferInsert;
