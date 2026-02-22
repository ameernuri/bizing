import { sql } from "drizzle-orm";
import { check, foreignKey, index, uniqueIndex } from "drizzle-orm/pg-core";
import {
  jsonb,
  pgTable,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { idRef, idWithTag, withAuditRefs } from "./_common";
import { bizes } from "./bizes";
import { groupAccounts } from "./group_accounts";
import { lifecycleStatusEnum } from "./enums";
import { locations } from "./locations";
import { queueEntries, queueTickets, queues } from "./queue";
import { resources } from "./resources";
import { subjects } from "./subjects";
import { users } from "./users";

/**
 * queue_counters
 *
 * ELI5:
 * A counter is a "service point" where a queue ticket can be called.
 *
 * Why generic:
 * - works for reception windows, help desks, kiosks, lab stations, repair bays,
 *   and virtual service desks,
 * - decouples queue logic from one physical layout assumption.
 */
export const queueCounters = pgTable(
  "queue_counters",
  {
    /** Stable primary key for one service point. */
    id: idWithTag("queue_counter"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent queue this counter serves. */
    queueId: idRef("queue_id")
      .references(() => queues.id)
      .notNull(),

    /** Optional location scope for multi-location queue definitions. */
    locationId: idRef("location_id").references(() => locations.id),

    /** Stable machine code (e.g., W1, FRONT_DESK_A, BAY_03). */
    code: varchar("code", { length: 80 }).notNull(),

    /** Human-friendly label shown in signage/UIs. */
    name: varchar("name", { length: 200 }).notNull(),

    /** Lifecycle status of this counter (active/paused/archived). */
    status: lifecycleStatusEnum("status").default("active").notNull(),

    /** Optional category label (window, desk, kiosk, bay, room, virtual). */
    counterType: varchar("counter_type", { length: 60 }).default("window").notNull(),

    /** Policy payload for per-counter behavior knobs. */
    policy: jsonb("policy").default({}).notNull(),

    /** Extension payload for provider/device links and metadata. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    queueCountersBizIdIdUnique: uniqueIndex("queue_counters_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Composite key for tenant-safe child FKs. */

    /** Counter code is unique within each queue. */
    queueCountersQueueCodeUnique: uniqueIndex("queue_counters_queue_code_unique").on(
      table.queueId,
      table.code,
    ),

    /** Dispatch-board listing path. */
    queueCountersBizQueueStatusIdx: index("queue_counters_biz_queue_status_idx").on(
      table.bizId,
      table.queueId,
      table.status,
    ),

    /** Tenant-safe FK to queue. */
    queueCountersBizQueueFk: foreignKey({
      columns: [table.bizId, table.queueId],
      foreignColumns: [queues.bizId, queues.id],
      name: "queue_counters_biz_queue_fk",
    }),

    /** Tenant-safe FK to optional location. */
    queueCountersBizLocationFk: foreignKey({
      columns: [table.bizId, table.locationId],
      foreignColumns: [locations.bizId, locations.id],
      name: "queue_counters_biz_location_fk",
    }),

    /** Counter type vocabulary guard with extension escape hatch. */
    queueCountersTypeCheck: check(
      "queue_counters_type_check",
      sql`
      "counter_type" IN ('window', 'desk', 'kiosk', 'bay', 'room', 'virtual')
      OR "counter_type" LIKE 'custom_%'
      `,
    ),
  }),
);

/**
 * queue_counter_assignments
 *
 * ELI5:
 * Who is currently (or scheduled to be) staffing a counter.
 *
 * Why this exists:
 * - gives deterministic "who is at counter X now?" answers,
 * - supports cross-domain dispatch because assignee can be user/group/resource/subject.
 */
export const queueCounterAssignments = pgTable(
  "queue_counter_assignments",
  {
    /** Stable primary key for one counter staffing assignment row. */
    id: idWithTag("queue_counter_assign"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Counter being staffed. */
    queueCounterId: idRef("queue_counter_id")
      .references(() => queueCounters.id)
      .notNull(),

    /** Optional direct user assignee. */
    assigneeUserId: idRef("assignee_user_id").references(() => users.id),

    /** Optional group assignee (team rotation/shared desk). */
    assigneeGroupAccountId: idRef("assignee_group_account_id").references(
      () => groupAccounts.id,
    ),

    /** Optional resource assignee (device/kiosk station actor). */
    assigneeResourceId: idRef("assignee_resource_id").references(() => resources.id),

    /** Optional custom-subject assignee namespace for plugin domains. */
    assigneeSubjectType: varchar("assignee_subject_type", { length: 80 }),

    /** Optional custom-subject assignee id. */
    assigneeSubjectId: varchar("assignee_subject_id", { length: 140 }),

    /** Assignment lifecycle state (`scheduled`, `active`, `ended`, etc.). */
    assignmentState: varchar("assignment_state", { length: 40 })
      .default("scheduled")
      .notNull(),

    /** Planned shift start. */
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),

    /** Planned shift end. */
    endsAt: timestamp("ends_at", { withTimezone: true }),

    /** Actual claim/start timestamp. */
    activatedAt: timestamp("activated_at", { withTimezone: true }),

    /** Actual end timestamp. */
    endedAt: timestamp("ended_at", { withTimezone: true }),

    /** Optional actor who made this assignment decision. */
    assignedByUserId: idRef("assigned_by_user_id").references(() => users.id),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite key for tenant-safe references. */
    queueCounterAssignmentsBizIdIdUnique: uniqueIndex(
      "queue_counter_assignments_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** Active staffing board query path. */
    queueCounterAssignmentsBizCounterStateStartIdx: index(
      "queue_counter_assignments_biz_counter_state_start_idx",
    ).on(table.bizId, table.queueCounterId, table.assignmentState, table.startsAt),

    /** One active assignment per counter at a time. */
    queueCounterAssignmentsActiveCounterUnique: uniqueIndex(
      "queue_counter_assignments_active_counter_unique",
    )
      .on(table.bizId, table.queueCounterId)
      .where(sql`"assignment_state" = 'active' AND "deleted_at" IS NULL`),

    /** Tenant-safe FK to counter. */
    queueCounterAssignmentsBizCounterFk: foreignKey({
      columns: [table.bizId, table.queueCounterId],
      foreignColumns: [queueCounters.bizId, queueCounters.id],
      name: "queue_counter_assignments_biz_counter_fk",
    }),

    /** Tenant-safe FK to optional resource assignee. */
    queueCounterAssignmentsBizResourceFk: foreignKey({
      columns: [table.bizId, table.assigneeResourceId],
      foreignColumns: [resources.bizId, resources.id],
      name: "queue_counter_assignments_biz_resource_fk",
    }),

    /** Tenant-safe FK to optional custom-subject assignee. */
    queueCounterAssignmentsBizAssigneeSubjectFk: foreignKey({
      columns: [table.bizId, table.assigneeSubjectType, table.assigneeSubjectId],
      foreignColumns: [subjects.bizId, subjects.subjectType, subjects.subjectId],
      name: "queue_counter_assignments_biz_assignee_subject_fk",
    }),

    /** Assignee subject pointer should be fully null or fully set. */
    queueCounterAssignmentsAssigneeSubjectPairCheck: check(
      "queue_counter_assignments_assignee_subject_pair_check",
      sql`
      (
        "assignee_subject_type" IS NULL
        AND "assignee_subject_id" IS NULL
      ) OR (
        "assignee_subject_type" IS NOT NULL
        AND "assignee_subject_id" IS NOT NULL
      )
      `,
    ),

    /** Exactly one assignee pointer is required for deterministic staffing ownership. */
    queueCounterAssignmentsAssigneeShapeCheck: check(
      "queue_counter_assignments_assignee_shape_check",
      sql`
      (
        ("assignee_user_id" IS NOT NULL)::int
        + ("assignee_group_account_id" IS NOT NULL)::int
        + ("assignee_resource_id" IS NOT NULL)::int
        + ("assignee_subject_type" IS NOT NULL)::int
      ) = 1
      `,
    ),

    /** Assignment state vocabulary guard with extension escape hatch. */
    queueCounterAssignmentsStateCheck: check(
      "queue_counter_assignments_state_check",
      sql`
      "assignment_state" IN ('scheduled', 'active', 'ended', 'cancelled')
      OR "assignment_state" LIKE 'custom_%'
      `,
    ),

    /** Shift timeline checks. */
    queueCounterAssignmentsTimelineCheck: check(
      "queue_counter_assignments_timeline_check",
      sql`
      ("ends_at" IS NULL OR "ends_at" > "starts_at")
      AND ("activated_at" IS NULL OR "activated_at" >= "starts_at")
      AND ("ended_at" IS NULL OR "activated_at" IS NULL OR "ended_at" >= "activated_at")
      `,
    ),
  }),
);

/**
 * queue_ticket_calls
 *
 * ELI5:
 * Every time a ticket is called to a counter, we log one call row.
 *
 * Why this exists:
 * - queue tickets can be recalled/redirected multiple times,
 * - this keeps call history explicit and auditable per counter.
 */
export const queueTicketCalls = pgTable(
  "queue_ticket_calls",
  {
    /** Stable primary key for one ticket-call attempt. */
    id: idWithTag("queue_ticket_call"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Ticket that was called. */
    queueTicketId: idRef("queue_ticket_id")
      .references(() => queueTickets.id)
      .notNull(),

    /** Queue entry pointer for direct journey tracing. */
    queueEntryId: idRef("queue_entry_id")
      .references(() => queueEntries.id)
      .notNull(),

    /** Counter where this call happened. */
    queueCounterId: idRef("queue_counter_id")
      .references(() => queueCounters.id)
      .notNull(),

    /** Call lifecycle state. */
    callState: varchar("call_state", { length: 40 }).default("called").notNull(),

    /** Time ticket was called. */
    calledAt: timestamp("called_at", { withTimezone: true }).defaultNow().notNull(),

    /** Time customer acknowledged call. */
    acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),

    /** Service start time for this call attempt. */
    serviceStartedAt: timestamp("service_started_at", { withTimezone: true }),

    /** Service completion time for this call attempt. */
    serviceEndedAt: timestamp("service_ended_at", { withTimezone: true }),

    /** Optional staff user who initiated call. */
    calledByUserId: idRef("called_by_user_id").references(() => users.id),

    /** Optional staff user who served this call. */
    servedByUserId: idRef("served_by_user_id").references(() => users.id),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    queueTicketCallsBizIdIdUnique: uniqueIndex("queue_ticket_calls_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Composite key for tenant-safe downstream refs. */

    /** Timeline path by ticket. */
    queueTicketCallsBizTicketCalledIdx: index("queue_ticket_calls_biz_ticket_called_idx").on(
      table.bizId,
      table.queueTicketId,
      table.calledAt,
    ),

    /** Counter performance path. */
    queueTicketCallsBizCounterCalledIdx: index(
      "queue_ticket_calls_biz_counter_called_idx",
    ).on(table.bizId, table.queueCounterId, table.calledAt),

    /** Tenant-safe FK to ticket. */
    queueTicketCallsBizTicketFk: foreignKey({
      columns: [table.bizId, table.queueTicketId],
      foreignColumns: [queueTickets.bizId, queueTickets.id],
      name: "queue_ticket_calls_biz_ticket_fk",
    }),

    /** Tenant-safe FK to queue entry. */
    queueTicketCallsBizEntryFk: foreignKey({
      columns: [table.bizId, table.queueEntryId],
      foreignColumns: [queueEntries.bizId, queueEntries.id],
      name: "queue_ticket_calls_biz_entry_fk",
    }),

    /** Tenant-safe FK to counter. */
    queueTicketCallsBizCounterFk: foreignKey({
      columns: [table.bizId, table.queueCounterId],
      foreignColumns: [queueCounters.bizId, queueCounters.id],
      name: "queue_ticket_calls_biz_counter_fk",
    }),

    /** Call-state vocabulary guard with extension escape hatch. */
    queueTicketCallsStateCheck: check(
      "queue_ticket_calls_state_check",
      sql`
      "call_state" IN ('called', 'acknowledged', 'no_show', 'served', 'redirected', 'cancelled')
      OR "call_state" LIKE 'custom_%'
      `,
    ),

    /** Timeline sanity checks for call progression. */
    queueTicketCallsTimelineCheck: check(
      "queue_ticket_calls_timeline_check",
      sql`
      ("acknowledged_at" IS NULL OR "acknowledged_at" >= "called_at")
      AND ("service_started_at" IS NULL OR "service_started_at" >= "called_at")
      AND ("service_ended_at" IS NULL OR "service_started_at" IS NULL OR "service_ended_at" >= "service_started_at")
      `,
    ),
  }),
);

export type QueueCounter = typeof queueCounters.$inferSelect;
export type NewQueueCounter = typeof queueCounters.$inferInsert;
export type QueueCounterAssignment = typeof queueCounterAssignments.$inferSelect;
export type NewQueueCounterAssignment = typeof queueCounterAssignments.$inferInsert;
export type QueueTicketCall = typeof queueTicketCalls.$inferSelect;
export type NewQueueTicketCall = typeof queueTicketCalls.$inferInsert;

