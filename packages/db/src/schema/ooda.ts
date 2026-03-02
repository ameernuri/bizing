import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { createdAt, deletedAt, idRef, idWithTag, updatedAt } from "./_common";
import { bizes } from "./bizes";
import { sagaCoverageItems, sagaDefinitions, sagaRunSteps, sagaRuns, sagaUseCases } from "./sagas";
import { users } from "./users";

/**
 * ooda_loops
 *
 * ELI5:
 * This table is the "command center list" for evolution work.
 * One row means "we are actively running one Observe → Orient → Decide → Act
 * cycle for this problem/objective".
 *
 * Why we need this:
 * - saga runs tell us what happened during one simulation,
 * - but OODA loops tell us what we are intentionally trying to improve now.
 * - this becomes the top-level dashboard object for architects and agents.
 */
export const oodaLoops = pgTable(
  "ooda_loops",
  {
    /** Stable primary key for one OODA loop. */
    id: idWithTag("ooda_loop"),

    /**
     * Optional tenant scope.
     *
     * Null = platform/global loop.
     * Non-null = tenant-specific improvement loop.
     */
    bizId: idRef("biz_id").references(() => bizes.id),

    /** Stable machine key used by APIs and deep links. */
    loopKey: varchar("loop_key", { length: 160 }).notNull(),

    /** Human-readable objective shown in dashboard cards. */
    title: varchar("title", { length: 255 }).notNull(),

    /** Longer explanation of the intent and success criteria. */
    objective: text("objective"),

    /**
     * Lifecycle state of the loop itself.
     *
     * - draft: still being shaped
     * - active: currently running
     * - paused: temporarily parked
     * - completed: objective reached
     * - archived: historical/no longer active
     */
    status: varchar("status", { length: 24 }).default("active").notNull(),

    /**
     * Current active OODA phase.
     *
     * This powers "where are we right now?" in the dashboard.
     */
    currentPhase: varchar("current_phase", { length: 16 }).default("observe").notNull(),


    /**
     * Relative priority (1-100, higher means more urgent/important).
     * This keeps ordering deterministic without hardcoding categories.
     */
    priority: integer("priority").default(50).notNull(),

    /** Optional owner for accountability. */
    ownerUserId: idRef("owner_user_id").references(() => users.id),

    /**
     * Coarse health score (0-100).
     * Useful for visual trend lines in the OODA dashboard.
     */
    healthScore: integer("health_score").default(0).notNull(),

    /** Last time any meaningful signal was attached to this loop. */
    lastSignalAt: timestamp("last_signal_at", { withTimezone: true }),

    /** Next planned review/checkpoint time. */
    nextReviewAt: timestamp("next_review_at", { withTimezone: true }),

    /** Flexible metadata for non-breaking future additions. */
    metadata: jsonb("metadata").default({}).notNull(),

    /** Standard lifecycle timestamps for timeline/debug/history screens. */
    createdAt,
    updatedAt,
    deletedAt,

    /**
     * Actor stamps keep accountability in-loop.
     * We store explicit FK references so audit trails can resolve to user records.
     */
    createdBy: idRef("created_by").references(() => users.id),
    updatedBy: idRef("updated_by").references(() => users.id),
    deletedBy: idRef("deleted_by").references(() => users.id),
  },
  (table) => ({
    oodaLoopsLoopKeyUnique: uniqueIndex("ooda_loops_loop_key_unique").on(table.loopKey),
    oodaLoopsBizStatusIdx: index("ooda_loops_biz_status_idx").on(table.bizId, table.status),
    oodaLoopsPriorityIdx: index("ooda_loops_priority_idx").on(table.status, table.priority),
    oodaLoopsStatusCheck: check(
      "ooda_loops_status_check",
      sql`"status" IN ('draft', 'active', 'paused', 'completed', 'archived')`,
    ),
    oodaLoopsPhaseCheck: check(
      "ooda_loops_phase_check",
      sql`"current_phase" IN ('observe', 'orient', 'decide', 'act')`,
    ),
    oodaLoopsPriorityCheck: check(
      "ooda_loops_priority_check",
      sql`"priority" >= 1 AND "priority" <= 100`,
    ),
    oodaLoopsHealthScoreCheck: check(
      "ooda_loops_health_score_check",
      sql`"health_score" >= 0 AND "health_score" <= 100`,
    ),
  }),
);

/**
 * ooda_loop_links
 *
 * ELI5:
 * OODA loops point at many things (use cases, personas, saga defs, run ids).
 * This table stores those connections so the dashboard can answer:
 * "What is this loop working on?"
 */
export const oodaLoopLinks = pgTable(
  "ooda_loop_links",
  {
    id: idWithTag("ooda_loop_link"),
    oodaLoopId: idRef("ooda_loop_id")
      .references(() => oodaLoops.id, { onDelete: "cascade" })
      .notNull(),

    /**
     * What kind of object is linked.
     * We keep this generic for extensibility while still validating known values.
     */
    targetType: varchar("target_type", { length: 48 }).notNull(),

    /** Stable id/key of the linked object. */
    targetId: text("target_id").notNull(),

    /**
     * Why this object is linked:
     * - focus: primary objective
     * - input: evidence/signal source
     * - output: produced result
     * - dependency: required upstream/downstream thing
     */
    relationRole: varchar("relation_role", { length: 32 }).default("focus").notNull(),

    metadata: jsonb("metadata").default({}).notNull(),
    createdAt,
    updatedAt,
    deletedAt,
    createdBy: idRef("created_by").references(() => users.id),
    updatedBy: idRef("updated_by").references(() => users.id),
    deletedBy: idRef("deleted_by").references(() => users.id),
  },
  (table) => ({
    oodaLoopLinksUnique: uniqueIndex("ooda_loop_links_unique").on(
      table.oodaLoopId,
      table.targetType,
      table.targetId,
      table.relationRole,
    ),
    oodaLoopLinksLoopIdx: index("ooda_loop_links_loop_idx").on(table.oodaLoopId, table.relationRole),
    oodaLoopLinksTypeCheck: check(
      "ooda_loop_links_target_type_check",
      sql`
        "target_type" IN (
          'use_case',
          'persona',
          'saga_definition',
          'saga_run',
          'saga_step',
          'coverage_report',
          'coverage_item',
          'note'
        )
      `,
    ),
    oodaLoopLinksRoleCheck: check(
      "ooda_loop_links_relation_role_check",
      sql`"relation_role" IN ('focus', 'input', 'output', 'dependency', 'evidence')`,
    ),
  }),
);

/**
 * ooda_loop_entries
 *
 * ELI5:
 * This is the timeline/journal of one OODA loop.
 * Each row is one concrete signal/hypothesis/decision/result.
 */
export const oodaLoopEntries = pgTable(
  "ooda_loop_entries",
  {
    id: idWithTag("ooda_entry"),
    oodaLoopId: idRef("ooda_loop_id")
      .references(() => oodaLoops.id, { onDelete: "cascade" })
      .notNull(),

    /** Which OODA phase this entry belongs to. */
    phase: varchar("phase", { length: 16 }).notNull(),

    /**
     * Entry semantic kind.
     * Keeps the timeline interpretable by both humans and agents.
     */
    entryType: varchar("entry_type", { length: 32 }).notNull(),

    title: varchar("title", { length: 255 }).notNull(),
    bodyMarkdown: text("body_markdown"),

    /** Severity used for visual attention cues. */
    severity: varchar("severity", { length: 16 }).default("medium").notNull(),

    /** Resolution state of this entry item. */
    status: varchar("status", { length: 24 }).default("open").notNull(),

    /**
     * Canonical gap taxonomy from workflow docs.
     * Null means informational/non-gap entry.
     */
    gapType: varchar("gap_type", { length: 40 }),


    /** Source channel of this entry (manual, saga runtime, API, LLM, etc). */
    sourceType: varchar("source_type", { length: 24 }).default("manual").notNull(),
    sourceRefId: text("source_ref_id"),

    /** Optional strong links to canonical saga coverage/runtime objects. */
    linkedUseCaseId: idRef("linked_use_case_id").references(() => sagaUseCases.id),
    linkedSagaDefinitionId: idRef("linked_saga_definition_id").references(() => sagaDefinitions.id),
    linkedSagaRunId: idRef("linked_saga_run_id").references(() => sagaRuns.id),
    linkedSagaRunStepId: idRef("linked_saga_run_step_id").references(() => sagaRunSteps.id),
    linkedCoverageItemId: idRef("linked_coverage_item_id").references(() => sagaCoverageItems.id),

    /** Structured evidence pointers and computed details. */
    evidence: jsonb("evidence").default({}).notNull(),

    /** Stable ordering in a loop timeline. */
    sortOrder: integer("sort_order").default(0).notNull(),

    createdAt,
    updatedAt,
    deletedAt,
    createdBy: idRef("created_by").references(() => users.id),
    updatedBy: idRef("updated_by").references(() => users.id),
    deletedBy: idRef("deleted_by").references(() => users.id),
  },
  (table) => ({
    oodaLoopEntriesLoopPhaseIdx: index("ooda_loop_entries_loop_phase_idx").on(
      table.oodaLoopId,
      table.phase,
      table.sortOrder,
    ),
    oodaLoopEntriesGapIdx: index("ooda_loop_entries_gap_idx").on(table.gapType, table.severity),
    oodaLoopEntriesPhaseCheck: check(
      "ooda_loop_entries_phase_check",
      sql`"phase" IN ('observe', 'orient', 'decide', 'act')`,
    ),
    oodaLoopEntriesTypeCheck: check(
      "ooda_loop_entries_type_check",
      sql`
        "entry_type" IN (
          'signal',
          'hypothesis',
          'decision',
          'action_plan',
          'result',
          'postmortem'
        )
      `,
    ),
    oodaLoopEntriesSeverityCheck: check(
      "ooda_loop_entries_severity_check",
      sql`"severity" IN ('low', 'medium', 'high', 'critical')`,
    ),
    oodaLoopEntriesStatusCheck: check(
      "ooda_loop_entries_status_check",
      sql`"status" IN ('open', 'accepted', 'rejected', 'resolved', 'blocked')`,
    ),
    oodaLoopEntriesGapTypeCheck: check(
      "ooda_loop_entries_gap_type_check",
      sql`
        "gap_type" IS NULL OR "gap_type" IN (
          'pnp_gap',
          'uc_gap',
          'persona_gap',
          'schema_gap',
          'api_gap',
          'workflow_gap',
          'policy_gap',
          'event_gap',
          'audit_gap',
          'test_pack_gap',
          'docs_gap'
        )
      `,
    ),
    oodaLoopEntriesSourceTypeCheck: check(
      "ooda_loop_entries_source_type_check",
      sql`"source_type" IN ('manual', 'saga_run', 'api', 'system', 'llm')`,
    ),
  }),
);

/**
 * ooda_loop_actions
 *
 * ELI5:
 * A decision entry says "what should be done";
 * an action row says "what we actually executed and what happened".
 */
export const oodaLoopActions = pgTable(
  "ooda_loop_actions",
  {
    id: idWithTag("ooda_action"),
    oodaLoopId: idRef("ooda_loop_id")
      .references(() => oodaLoops.id, { onDelete: "cascade" })
      .notNull(),
    oodaLoopEntryId: idRef("ooda_loop_entry_id").references(() => oodaLoopEntries.id, {
      onDelete: "set null",
    }),

    /** Stable action key (example: `saga.run.execute`). */
    actionKey: varchar("action_key", { length: 160 }).notNull(),
    actionTitle: varchar("action_title", { length: 255 }).notNull(),
    status: varchar("status", { length: 24 }).default("queued").notNull(),

    /**
     * If true, this action is a preview-only execution.
     * This mirrors AX/HX design rule: high-risk operations should be previewable.
     */
    dryRun: boolean("dry_run").default(true).notNull(),

    requestedByUserId: idRef("requested_by_user_id")
      .references(() => users.id)
      .notNull(),
    assignedToUserId: idRef("assigned_to_user_id").references(() => users.id),

    /** Optional linkage to saga run created/executed by this action. */
    linkedSagaRunId: idRef("linked_saga_run_id").references(() => sagaRuns.id),

    requestPayload: jsonb("request_payload").default({}).notNull(),
    resultPayload: jsonb("result_payload").default({}).notNull(),
    errorMessage: text("error_message"),

    startedAt: timestamp("started_at", { withTimezone: true }),
    endedAt: timestamp("ended_at", { withTimezone: true }),

    createdAt,
    updatedAt,
    deletedAt,
    createdBy: idRef("created_by").references(() => users.id),
    updatedBy: idRef("updated_by").references(() => users.id),
    deletedBy: idRef("deleted_by").references(() => users.id),
  },
  (table) => ({
    oodaLoopActionsLoopStatusIdx: index("ooda_loop_actions_loop_status_idx").on(
      table.oodaLoopId,
      table.status,
      table.startedAt,
    ),
    oodaLoopActionsRequesterIdx: index("ooda_loop_actions_requester_idx").on(
      table.requestedByUserId,
      table.startedAt,
    ),
    oodaLoopActionsStatusCheck: check(
      "ooda_loop_actions_status_check",
      sql`"status" IN ('queued', 'running', 'succeeded', 'failed', 'cancelled')`,
    ),
    oodaLoopActionsTimelineCheck: check(
      "ooda_loop_actions_timeline_check",
      sql`"started_at" IS NULL OR "ended_at" IS NULL OR "ended_at" >= "started_at"`,
    ),
  }),
);
