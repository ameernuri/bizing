import { sql } from "drizzle-orm";
import { check, foreignKey, index, uniqueIndex } from "drizzle-orm/pg-core";
import { boolean, integer, jsonb, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";
import { createdAt, idRef, idWithTag, withAuditRefs } from "./_common";
import { bizes } from "./bizes";
import { users } from "./users";
import {
  auditActorTypeEnum,
  auditEventTypeEnum,
  auditIntegrityStatusEnum,
} from "./enums";

/**
 * audit_streams
 *
 * ELI5:
 * A stream is a named timeline bucket for immutable events.
 *
 * Example stream keys:
 * - booking_order:booking_order_abc123
 * - payment_intent:payment_intent_xyz
 * - tenant:biz_123
 */
export const auditStreams = pgTable(
  "audit_streams",
  {
    /** Stable primary key. */
    id: idWithTag("audit_stream"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Stream key unique within tenant. */
    streamKey: varchar("stream_key", { length: 260 }).notNull(),

    /** Stream type category. */
    streamType: varchar("stream_type", { length: 120 }).notNull(),

    /** Optional entity type this stream represents. */
    entityType: varchar("entity_type", { length: 120 }),

    /** Optional entity id this stream represents. */
    entityId: varchar("entity_id", { length: 140 }),

    /** Optional description for operator readability. */
    description: varchar("description", { length: 600 }),

    /** Stream active toggle. */
    isActive: boolean("is_active").default(true).notNull(),

    /** Full audit metadata for stream config changes. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    auditStreamsBizIdIdUnique: uniqueIndex("audit_streams_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Composite unique key used by event/integrity tables. */

    /** One stream key per tenant. */
    auditStreamsBizStreamKeyUnique: uniqueIndex(
      "audit_streams_biz_stream_key_unique",
    ).on(table.bizId, table.streamKey),

    /** Stream listing query path. */
    auditStreamsBizTypeActiveIdx: index("audit_streams_biz_type_active_idx").on(
      table.bizId,
      table.streamType,
      table.isActive,
    ),
  }),
);

/**
 * audit_events
 *
 * ELI5:
 * Immutable append-only event history.
 *
 * Key integrity idea:
 * - each event stores `previous_event_hash` and `event_hash`,
 * - sequence is strictly increasing per stream,
 * - this enables tamper detection by hash-chain verification.
 *
 * IMPORTANT operational rule:
 * Application and DB permissions should forbid UPDATE/DELETE on this table.
 * Corrections must be new compensating events.
 */
export const auditEvents = pgTable(
  "audit_events",
  {
    /** Stable primary key for event row. */
    id: idWithTag("audit_event"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Stream this event belongs to. */
    streamId: idRef("stream_id")
      .references(() => auditStreams.id)
      .notNull(),

    /** Monotonic sequence number in stream. */
    sequence: integer("sequence").notNull(),

    /** Event type (create/update/delete/read/etc.). */
    eventType: auditEventTypeEnum("event_type").notNull(),

    /** Actor kind. */
    actorType: auditActorTypeEnum("actor_type").notNull(),

    /** Optional user actor id. */
    actorUserId: idRef("actor_user_id").references(() => users.id),

    /** Optional non-user actor reference (api key/integration/system id). */
    actorRef: varchar("actor_ref", { length: 200 }),

    /** Event occurrence timestamp. */
    occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),

    /** Entity type changed/read by this event. */
    entityType: varchar("entity_type", { length: 120 }).notNull(),

    /** Entity id changed/read by this event. */
    entityId: varchar("entity_id", { length: 140 }).notNull(),

    /** Optional reason code. */
    reasonCode: varchar("reason_code", { length: 120 }),

    /** Optional human note. */
    note: varchar("note", { length: 1000 }),

    /** Request correlation id (API request id / job id). */
    requestRef: varchar("request_ref", { length: 200 }),

    /** Optional network/IP source. */
    sourceIp: varchar("source_ip", { length: 80 }),

    /** Optional user agent snapshot. */
    userAgent: varchar("user_agent", { length: 500 }),

    /** Before-state snapshot (if applicable). */
    beforeState: jsonb("before_state"),

    /** After-state snapshot (if applicable). */
    afterState: jsonb("after_state"),

    /** Optional normalized patch/diff payload. */
    diff: jsonb("diff"),

    /** Hash of previous event in same stream. */
    previousEventHash: varchar("previous_event_hash", { length: 128 }),

    /** Hash of this event payload. */
    eventHash: varchar("event_hash", { length: 128 }).notNull(),

    /** Optional signature for stronger non-repudiation. */
    signature: varchar("signature", { length: 256 }),

    /** Event insertion time; intentionally separate from business `occurred_at`. */
    recordedAt: createdAt,

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),
  },
  (table) => ({
    auditEventsBizIdIdUnique: uniqueIndex("audit_events_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Composite unique target for tenant-safe foreign keys. */

    /** One sequence number per stream. */
    auditEventsStreamSequenceUnique: uniqueIndex("audit_events_stream_sequence_unique").on(
      table.streamId,
      table.sequence,
    ),

    /** Event hash uniqueness inside stream for chain stability. */
    auditEventsStreamHashUnique: uniqueIndex("audit_events_stream_hash_unique").on(
      table.streamId,
      table.eventHash,
    ),

    /** Composite tenant-safe stream timeline path. */
    auditEventsBizStreamSequenceIdx: index("audit_events_biz_stream_sequence_idx").on(
      table.bizId,
      table.streamId,
      table.sequence,
    ),

    /** Query path by entity for forensic lookup. */
    auditEventsBizEntityOccurredIdx: index("audit_events_biz_entity_occurred_idx").on(
      table.bizId,
      table.entityType,
      table.entityId,
      table.occurredAt,
    ),

    /** Tenant-safe FK to stream. */
    auditEventsBizStreamFk: foreignKey({
      columns: [table.bizId, table.streamId],
      foreignColumns: [auditStreams.bizId, auditStreams.id],
      name: "audit_events_biz_stream_fk",
    }),

    /** Sequence starts at 1. */
    auditEventsSequenceCheck: check(
      "audit_events_sequence_check",
      sql`"sequence" >= 1`,
    ),

    /** Hash chain anchor rule: first event has no previous hash. */
    auditEventsHashChainAnchorCheck: check(
      "audit_events_hash_chain_anchor_check",
      sql`
      ("sequence" = 1 AND "previous_event_hash" IS NULL)
      OR ("sequence" > 1 AND "previous_event_hash" IS NOT NULL)
      `,
    ),

    /** Actor shape: user actors require user id; others can use actor_ref. */
    auditEventsActorShapeCheck: check(
      "audit_events_actor_shape_check",
      sql`
      (
        "actor_type" = 'user'
        AND "actor_user_id" IS NOT NULL
      ) OR (
        "actor_type" <> 'user'
      )
      `,
    ),
  }),
);

/**
 * audit_integrity_runs
 *
 * ELI5:
 * Each row stores results of a hash-chain integrity verification run.
 */
export const auditIntegrityRuns = pgTable(
  "audit_integrity_runs",
  {
    /** Stable primary key. */
    id: idWithTag("audit_integrity_run"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Optional single-stream scope. Null means full tenant audit run. */
    streamId: idRef("stream_id").references(() => auditStreams.id),

    /** Verification status. */
    status: auditIntegrityStatusEnum("status").default("unverified").notNull(),

    /** Run start timestamp. */
    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),

    /** Run end timestamp. */
    completedAt: timestamp("completed_at", { withTimezone: true }),

    /** Number of events checked. */
    checkedEvents: integer("checked_events").default(0).notNull(),

    /** Number of events with detected integrity issues. */
    brokenEvents: integer("broken_events").default(0).notNull(),

    /** Optional first broken event id pointer for triage. */
    firstBrokenEventId: idRef("first_broken_event_id").references(() => auditEvents.id),

    /** Optional summary message. */
    summary: varchar("summary", { length: 800 }),

    /** Structured evidence/details payload. */
    details: jsonb("details").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    auditIntegrityRunsBizIdIdUnique: uniqueIndex("audit_integrity_runs_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Common forensic monitoring path. */
    auditIntegrityRunsBizStartedIdx: index("audit_integrity_runs_biz_started_idx").on(
      table.bizId,
      table.startedAt,
    ),

    /** Tenant-safe FK to stream. */
    auditIntegrityRunsBizStreamFk: foreignKey({
      columns: [table.bizId, table.streamId],
      foreignColumns: [auditStreams.bizId, auditStreams.id],
      name: "audit_integrity_runs_biz_stream_fk",
    }),

    /** Tenant-safe FK to first broken event pointer. */
    auditIntegrityRunsBizFirstBrokenEventFk: foreignKey({
      columns: [table.bizId, table.firstBrokenEventId],
      foreignColumns: [auditEvents.bizId, auditEvents.id],
      name: "audit_integrity_runs_biz_first_broken_event_fk",
    }),

    /** Counts and timeline checks. */
    auditIntegrityRunsCheck: check(
      "audit_integrity_runs_check",
      sql`
      "checked_events" >= 0
      AND "broken_events" >= 0
      AND "broken_events" <= "checked_events"
      AND ("completed_at" IS NULL OR "completed_at" >= "started_at")
      `,
    ),
  }),
);
