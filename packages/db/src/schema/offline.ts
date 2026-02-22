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
import {
  offlineConflictStatusEnum,
  offlineConflictTypeEnum,
  offlineOperationKindEnum,
  offlineOperationStatusEnum,
  offlineResolutionActionEnum,
} from "./enums";
import { users } from "./users";

/**
 * offline_ops_journal
 *
 * ELI5:
 * This is the inbox of writes captured while client/device was offline.
 * Each row is one intended operation that can later be replayed safely.
 *
 * Why this exists:
 * - gives deterministic replay order,
 * - keeps idempotency history,
 * - makes sync/debug workflows auditable.
 */
export const offlineOpsJournal = pgTable(
  "offline_ops_journal",
  {
    /** Stable primary key. */
    id: idWithTag("offline_op"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Optional actor identity who originated operation. */
    actorUserId: idRef("actor_user_id").references(() => users.id),

    /** Device/client key to partition ordering and retry flows. */
    clientId: varchar("client_id", { length: 200 }).notNull(),

    /** Optional device-local session key (for reconnect reconciliation). */
    sessionKey: varchar("session_key", { length: 200 }),

    /** Stable idempotency key from device/client. */
    operationKey: varchar("operation_key", { length: 200 }).notNull(),

    /** Operation semantics. */
    operationKind: offlineOperationKindEnum("operation_kind").notNull(),

    /** Processing lifecycle state. */
    status: offlineOperationStatusEnum("status").default("pending").notNull(),

    /** Entity namespace for routing replay handlers. */
    entityType: varchar("entity_type", { length: 120 }).notNull(),

    /** Entity id targeted by this operation (if known). */
    entityId: varchar("entity_id", { length: 140 }),

    /** Optional expected remote row version for optimistic concurrency checks. */
    expectedVersion: integer("expected_version"),

    /** Optional resulting version after successful apply. */
    appliedVersion: integer("applied_version"),

    /** Operation payload (patch/create body/delete context). */
    payload: jsonb("payload").default({}).notNull(),

    /** Optional normalized patch for deterministic merge tooling. */
    patch: jsonb("patch"),

    /** Optional failure context for diagnostics. */
    failureReason: text("failure_reason"),

    /** Time operation was enqueued client-side. */
    queuedAt: timestamp("queued_at", { withTimezone: true }).notNull(),

    /** Server receive time for this journal row. */
    receivedAt: timestamp("received_at", { withTimezone: true }).defaultNow().notNull(),

    /** Time operation was finally applied (if succeeded). */
    appliedAt: timestamp("applied_at", { withTimezone: true }),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    offlineOpsJournalBizIdIdUnique: uniqueIndex("offline_ops_journal_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),

    /** Prevent duplicate operation replay for same client + op key. */
    offlineOpsJournalBizClientOperationUnique: uniqueIndex(
      "offline_ops_journal_biz_client_operation_unique",
    ).on(table.bizId, table.clientId, table.operationKey),

    /** Replay worker path by status/time. */
    offlineOpsJournalBizStatusReceivedIdx: index(
      "offline_ops_journal_biz_status_received_idx",
    ).on(table.bizId, table.status, table.receivedAt),

    /** Entity-focused diagnostics and recovery path. */
    offlineOpsJournalBizEntityReceivedIdx: index(
      "offline_ops_journal_biz_entity_received_idx",
    ).on(table.bizId, table.entityType, table.entityId, table.receivedAt),

    offlineOpsJournalQueuedReceivedCheck: check(
      "offline_ops_journal_queued_received_check",
      sql`"received_at" >= "queued_at"`,
    ),

    offlineOpsJournalVersionCheck: check(
      "offline_ops_journal_version_check",
      sql`
      ("expected_version" IS NULL OR "expected_version" >= 0)
      AND ("applied_version" IS NULL OR "applied_version" >= 0)
      `,
    ),

    /** Applied/superseded operations should carry terminal timestamps. */
    offlineOpsJournalAppliedAtRequiredCheck: check(
      "offline_ops_journal_applied_at_required_check",
      sql`
      "status" NOT IN ('applied', 'superseded')
      OR "applied_at" IS NOT NULL
      `,
    ),
  }),
);

/**
 * offline_merge_conflicts
 *
 * ELI5:
 * If replay cannot apply cleanly, we store one conflict row here.
 * It is the "issue ticket" for that sync mismatch.
 */
export const offlineMergeConflicts = pgTable(
  "offline_merge_conflicts",
  {
    id: idWithTag("offline_conflict"),
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Journal operation that generated this conflict. */
    offlineOpJournalId: idRef("offline_op_journal_id")
      .references(() => offlineOpsJournal.id)
      .notNull(),

    conflictType: offlineConflictTypeEnum("conflict_type").notNull(),
    status: offlineConflictStatusEnum("status").default("open").notNull(),

    /** Conflict target pointer. */
    entityType: varchar("entity_type", { length: 120 }).notNull(),
    entityId: varchar("entity_id", { length: 140 }),

    /** Snapshot values for deterministic resolution tooling. */
    localSnapshot: jsonb("local_snapshot").default({}).notNull(),
    remoteSnapshot: jsonb("remote_snapshot").default({}).notNull(),

    /** Human/system explanation of conflict reason. */
    summary: varchar("summary", { length: 1000 }),
    details: jsonb("details").default({}),

    detectedAt: timestamp("detected_at", { withTimezone: true }).defaultNow().notNull(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),

    metadata: jsonb("metadata").default({}),
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    offlineMergeConflictsBizIdIdUnique: uniqueIndex(
      "offline_merge_conflicts_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** One open conflict record per journal operation at a time. */
    offlineMergeConflictsOpenPerOpUnique: uniqueIndex(
      "offline_merge_conflicts_open_per_op_unique",
    )
      .on(table.offlineOpJournalId)
      .where(sql`"status" = 'open' AND "deleted_at" IS NULL`),

    offlineMergeConflictsBizStatusDetectedIdx: index(
      "offline_merge_conflicts_biz_status_detected_idx",
    ).on(table.bizId, table.status, table.detectedAt),

    offlineMergeConflictsBizEntityDetectedIdx: index(
      "offline_merge_conflicts_biz_entity_detected_idx",
    ).on(table.bizId, table.entityType, table.entityId, table.detectedAt),

    offlineMergeConflictsBizJournalFk: foreignKey({
      columns: [table.bizId, table.offlineOpJournalId],
      foreignColumns: [offlineOpsJournal.bizId, offlineOpsJournal.id],
      name: "offline_merge_conflicts_biz_journal_fk",
    }),

    offlineMergeConflictsResolvedAtCheck: check(
      "offline_merge_conflicts_resolved_at_check",
      sql`
      "status" = 'open'
      OR "resolved_at" IS NOT NULL
      `,
    ),
  }),
);

/**
 * offline_resolution_events
 *
 * ELI5:
 * Every conflict-resolution decision is appended here as an immutable trail.
 */
export const offlineResolutionEvents = pgTable(
  "offline_resolution_events",
  {
    id: idWithTag("offline_resolution"),
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    offlineMergeConflictId: idRef("offline_merge_conflict_id")
      .references(() => offlineMergeConflicts.id)
      .notNull(),

    action: offlineResolutionActionEnum("action").notNull(),
    actorUserId: idRef("actor_user_id").references(() => users.id),
    happenedAt: timestamp("happened_at", { withTimezone: true }).defaultNow().notNull(),

    /** Optional operation id created by replay-after-merge action. */
    resultingOfflineOpJournalId: idRef("resulting_offline_op_journal_id").references(
      () => offlineOpsJournal.id,
    ),

    note: varchar("note", { length: 1000 }),
    patchApplied: jsonb("patch_applied"),
    metadata: jsonb("metadata").default({}),
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    offlineResolutionEventsBizIdIdUnique: uniqueIndex("offline_resolution_events_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    offlineResolutionEventsBizConflictHappenedIdx: index(
      "offline_resolution_events_biz_conflict_happened_idx",
    ).on(table.bizId, table.offlineMergeConflictId, table.happenedAt),

    offlineResolutionEventsBizConflictFk: foreignKey({
      columns: [table.bizId, table.offlineMergeConflictId],
      foreignColumns: [offlineMergeConflicts.bizId, offlineMergeConflicts.id],
      name: "offline_resolution_events_biz_conflict_fk",
    }),

    offlineResolutionEventsBizResultingOpFk: foreignKey({
      columns: [table.bizId, table.resultingOfflineOpJournalId],
      foreignColumns: [offlineOpsJournal.bizId, offlineOpsJournal.id],
      name: "offline_resolution_events_biz_resulting_op_fk",
    }),
  }),
);
