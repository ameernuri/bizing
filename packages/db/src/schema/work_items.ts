import { sql } from "drizzle-orm";
import { check, foreignKey, index, pgTable, uniqueIndex } from "drizzle-orm/pg-core";
import {
  boolean,
  doublePrecision,
  integer,
  jsonb,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { createdAt, deletedAt, idRef, idWithTag, updatedAt } from "./_common";
import { actionRequests } from "./action_backbone";
import { bizes } from "./bizes";
import { domainEvents } from "./domain_events";
import {
  lifecycleStatusEnum,
  workCommandKindEnum,
  workCommandRunStatusEnum,
  workCommandTargetScopeEnum,
  workItemEventTypeEnum,
  workItemLinkTypeEnum,
  workItemSourceTypeEnum,
  workItemStatusEnum,
  workItemUrgencyEnum,
} from "./enums";
import { operationalAssignments, operationalDemands } from "./operations_backbone";
import { projectionDocuments } from "./projections";
import { subjects } from "./subjects";
import { users } from "./users";
import {
  reviewQueueItems,
  workflowDefinitions,
  workflowInstances,
  workflowSteps,
} from "./workflows";

/**
 * work_items
 *
 * ELI5:
 * One canonical inbox row for work that needs attention.
 *
 * Why this exists:
 * - task-like work was scattered across many domain tables
 * - operators/agents need one prioritized queue across those domains
 * - source tables stay canonical; this table is the unified operational lens
 */
export const workItems = pgTable(
  "work_items",
  {
    id: idWithTag("work_item"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Domain source family for this unified work row. */
    sourceType: workItemSourceTypeEnum("source_type").default("manual").notNull(),

    /** Stable source identity inside its source family. */
    sourceRefId: varchar("source_ref_id", { length: 160 }).notNull(),
    sourceRefLabel: varchar("source_ref_label", { length: 220 }),

    /** Optional canonical subject bridge for cross-domain joins. */
    subjectType: varchar("subject_type", { length: 80 }),
    subjectId: varchar("subject_id", { length: 140 }),

    /** Human-first queue card fields. */
    title: varchar("title", { length: 260 }).notNull(),
    summary: text("summary"),

    status: workItemStatusEnum("status").default("open").notNull(),
    urgency: workItemUrgencyEnum("urgency").default("normal").notNull(),
    priority: integer("priority").default(100).notNull(),

    /** Optional floating rank for deterministic list ordering. */
    rank: doublePrecision("rank"),

    startsAt: timestamp("starts_at", { withTimezone: true }),
    dueAt: timestamp("due_at", { withTimezone: true }),
    snoozedUntil: timestamp("snoozed_until", { withTimezone: true }),
    lastActivityAt: timestamp("last_activity_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),

    assigneeUserId: idRef("assignee_user_id").references(() => users.id),
    ownerUserId: idRef("owner_user_id").references(() => users.id),

    /** Optional direct links to canonical source artifacts. */
    workflowInstanceId: idRef("workflow_instance_id").references(() => workflowInstances.id),
    workflowStepId: idRef("workflow_step_id").references(() => workflowSteps.id),
    reviewQueueItemId: idRef("review_queue_item_id").references(() => reviewQueueItems.id),
    actionRequestId: idRef("action_request_id").references(() => actionRequests.id),
    domainEventId: idRef("domain_event_id").references(() => domainEvents.id),
    operationalDemandId: idRef("operational_demand_id").references(() => operationalDemands.id),
    operationalAssignmentId: idRef("operational_assignment_id").references(
      () => operationalAssignments.id,
    ),
    projectionDocumentId: idRef("projection_document_id").references(() => projectionDocuments.id),

    metadata: jsonb("metadata").default({}).notNull(),

    createdAt,
    updatedAt,
    deletedAt,
    createdBy: idRef("created_by").references(() => users.id),
    updatedBy: idRef("updated_by").references(() => users.id),
    deletedBy: idRef("deleted_by").references(() => users.id),
  },
  (table) => ({
    workItemsBizIdIdUnique: uniqueIndex("work_items_biz_id_id_unique").on(table.bizId, table.id),

    /** One canonical work row per source tuple. */
    workItemsBizSourceUnique: uniqueIndex("work_items_biz_source_unique").on(
      table.bizId,
      table.sourceType,
      table.sourceRefId,
    ),

    workItemsBizStatusPriorityDueIdx: index("work_items_biz_status_priority_due_idx").on(
      table.bizId,
      table.status,
      table.urgency,
      table.priority,
      table.dueAt,
      table.rank,
    ),

    workItemsBizAssigneeStatusIdx: index("work_items_biz_assignee_status_idx").on(
      table.bizId,
      table.assigneeUserId,
      table.status,
      table.priority,
      table.dueAt,
    ),

    workItemsBizSourceIdx: index("work_items_biz_source_idx").on(
      table.bizId,
      table.sourceType,
      table.sourceRefId,
      table.status,
    ),

    workItemsBizSubjectIdx: index("work_items_biz_subject_idx").on(
      table.bizId,
      table.subjectType,
      table.subjectId,
      table.status,
    ),

    workItemsBizActionRequestFk: foreignKey({
      columns: [table.bizId, table.actionRequestId],
      foreignColumns: [actionRequests.bizId, actionRequests.id],
      name: "work_items_biz_action_request_fk",
    }),

    workItemsBizDomainEventFk: foreignKey({
      columns: [table.bizId, table.domainEventId],
      foreignColumns: [domainEvents.bizId, domainEvents.id],
      name: "work_items_biz_domain_event_fk",
    }),

    workItemsBizWorkflowInstanceFk: foreignKey({
      columns: [table.bizId, table.workflowInstanceId],
      foreignColumns: [workflowInstances.bizId, workflowInstances.id],
      name: "work_items_biz_workflow_instance_fk",
    }),

    workItemsBizWorkflowStepFk: foreignKey({
      columns: [table.bizId, table.workflowStepId],
      foreignColumns: [workflowSteps.bizId, workflowSteps.id],
      name: "work_items_biz_workflow_step_fk",
    }),

    workItemsBizReviewItemFk: foreignKey({
      columns: [table.bizId, table.reviewQueueItemId],
      foreignColumns: [reviewQueueItems.bizId, reviewQueueItems.id],
      name: "work_items_biz_review_item_fk",
    }),

    workItemsBizOperationalDemandFk: foreignKey({
      columns: [table.bizId, table.operationalDemandId],
      foreignColumns: [operationalDemands.bizId, operationalDemands.id],
      name: "work_items_biz_operational_demand_fk",
    }),

    workItemsBizOperationalAssignmentFk: foreignKey({
      columns: [table.bizId, table.operationalAssignmentId],
      foreignColumns: [operationalAssignments.bizId, operationalAssignments.id],
      name: "work_items_biz_operational_assignment_fk",
    }),

    workItemsBizProjectionDocumentFk: foreignKey({
      columns: [table.bizId, table.projectionDocumentId],
      foreignColumns: [projectionDocuments.bizId, projectionDocuments.id],
      name: "work_items_biz_projection_document_fk",
    }),

    workItemsBizSubjectFk: foreignKey({
      columns: [table.bizId, table.subjectType, table.subjectId],
      foreignColumns: [subjects.bizId, subjects.subjectType, subjects.subjectId],
      name: "work_items_biz_subject_fk",
    }),

    workItemsSubjectPairCheck: check(
      "work_items_subject_pair_check",
      sql`
      (
        "subject_type" IS NULL
        AND "subject_id" IS NULL
      ) OR (
        "subject_type" IS NOT NULL
        AND "subject_id" IS NOT NULL
      )
      `,
    ),

    workItemsBoundsCheck: check(
      "work_items_bounds_check",
      sql`
      length("title") > 0
      AND "priority" >= 0
      AND ("rank" IS NULL OR "rank" >= 0)
      AND (
        "due_at" IS NULL
        OR "starts_at" IS NULL
        OR "due_at" >= "starts_at"
      )
      AND (
        "completed_at" IS NULL
        OR "completed_at" >= coalesce("starts_at", "created_at")
      )
      AND (
        "snoozed_until" IS NULL
        OR "status" = 'snoozed'
      )
      `,
    ),
  }),
);

/**
 * work_item_events
 *
 * Immutable event ledger for work-item lifecycle transitions.
 */
export const workItemEvents = pgTable(
  "work_item_events",
  {
    id: idWithTag("work_item_event"),

    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    workItemId: idRef("work_item_id")
      .references(() => workItems.id)
      .notNull(),

    eventType: workItemEventTypeEnum("event_type").notNull(),

    fromStatus: workItemStatusEnum("from_status"),
    toStatus: workItemStatusEnum("to_status"),

    actorType: varchar("actor_type", { length: 40 }),
    actorUserId: idRef("actor_user_id").references(() => users.id),
    actorRef: varchar("actor_ref", { length: 160 }),

    note: text("note"),
    payload: jsonb("payload").default({}).notNull(),

    occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),

    createdAt,
    updatedAt,
    deletedAt,
    createdBy: idRef("created_by").references(() => users.id),
    updatedBy: idRef("updated_by").references(() => users.id),
    deletedBy: idRef("deleted_by").references(() => users.id),
  },
  (table) => ({
    workItemEventsBizIdIdUnique: uniqueIndex("work_item_events_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),

    workItemEventsBizItemOccurredIdx: index("work_item_events_biz_item_occurred_idx").on(
      table.bizId,
      table.workItemId,
      table.occurredAt,
    ),

    workItemEventsBizTypeOccurredIdx: index("work_item_events_biz_type_occurred_idx").on(
      table.bizId,
      table.eventType,
      table.occurredAt,
    ),

    workItemEventsBizItemFk: foreignKey({
      columns: [table.bizId, table.workItemId],
      foreignColumns: [workItems.bizId, workItems.id],
      name: "work_item_events_biz_item_fk",
    }),

    workItemEventsStatusTransitionCheck: check(
      "work_item_events_status_transition_check",
      sql`
      (
        "from_status" IS NULL
        AND "to_status" IS NULL
      ) OR (
        "from_status" IS NOT NULL
        AND "to_status" IS NOT NULL
        AND "from_status" <> "to_status"
      )
      `,
    ),
  }),
);

/**
 * work_item_links
 *
 * Structured graph edges from one work item to related domain entities.
 */
export const workItemLinks = pgTable(
  "work_item_links",
  {
    id: idWithTag("work_item_link"),

    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    workItemId: idRef("work_item_id")
      .references(() => workItems.id)
      .notNull(),

    linkType: workItemLinkTypeEnum("link_type").notNull(),

    targetType: varchar("target_type", { length: 80 }).notNull(),
    targetRefId: varchar("target_ref_id", { length: 160 }).notNull(),

    label: varchar("label", { length: 220 }),
    href: text("href"),

    isPrimary: boolean("is_primary").default(false).notNull(),

    metadata: jsonb("metadata").default({}).notNull(),

    createdAt,
    updatedAt,
    deletedAt,
    createdBy: idRef("created_by").references(() => users.id),
    updatedBy: idRef("updated_by").references(() => users.id),
    deletedBy: idRef("deleted_by").references(() => users.id),
  },
  (table) => ({
    workItemLinksBizIdIdUnique: uniqueIndex("work_item_links_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),

    workItemLinksBizUnique: uniqueIndex("work_item_links_biz_unique").on(
      table.bizId,
      table.workItemId,
      table.linkType,
      table.targetType,
      table.targetRefId,
    ),

    workItemLinksBizItemPrimaryUnique: uniqueIndex("work_item_links_biz_item_primary_unique")
      .on(table.bizId, table.workItemId)
      .where(sql`"is_primary" = true`),

    workItemLinksBizTargetIdx: index("work_item_links_biz_target_idx").on(
      table.bizId,
      table.targetType,
      table.targetRefId,
    ),

    workItemLinksBizItemFk: foreignKey({
      columns: [table.bizId, table.workItemId],
      foreignColumns: [workItems.bizId, workItems.id],
      name: "work_item_links_biz_item_fk",
    }),

    workItemLinksNonEmptyTargetCheck: check(
      "work_item_links_non_empty_target_check",
      sql`length("target_type") > 0 AND length("target_ref_id") > 0`,
    ),
  }),
);

/**
 * work_commands
 *
 * ELI5:
 * A command is one reusable operator/agent action card.
 *
 * Commands can point at:
 * - canonical action keys
 * - workflow definitions
 * - navigation/custom automations
 */
export const workCommands = pgTable(
  "work_commands",
  {
    id: idWithTag("work_command"),

    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    commandKey: varchar("command_key", { length: 120 }).notNull(),
    title: varchar("title", { length: 180 }).notNull(),
    description: text("description"),

    status: lifecycleStatusEnum("status").default("active").notNull(),
    commandKind: workCommandKindEnum("command_kind").default("custom").notNull(),
    targetScope: workCommandTargetScopeEnum("target_scope").default("work_item").notNull(),

    actionKey: varchar("action_key", { length: 160 }),
    workflowDefinitionId: idRef("workflow_definition_id").references(() => workflowDefinitions.id),

    defaultPayload: jsonb("default_payload").default({}).notNull(),
    guardPolicy: jsonb("guard_policy").default({}).notNull(),
    metadata: jsonb("metadata").default({}).notNull(),

    createdAt,
    updatedAt,
    deletedAt,
    createdBy: idRef("created_by").references(() => users.id),
    updatedBy: idRef("updated_by").references(() => users.id),
    deletedBy: idRef("deleted_by").references(() => users.id),
  },
  (table) => ({
    workCommandsBizIdIdUnique: uniqueIndex("work_commands_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),

    workCommandsBizKeyUnique: uniqueIndex("work_commands_biz_key_unique").on(
      table.bizId,
      table.commandKey,
    ),

    workCommandsBizStatusKindIdx: index("work_commands_biz_status_kind_idx").on(
      table.bizId,
      table.status,
      table.commandKind,
      table.targetScope,
    ),

    workCommandsBizWorkflowDefinitionFk: foreignKey({
      columns: [table.bizId, table.workflowDefinitionId],
      foreignColumns: [workflowDefinitions.bizId, workflowDefinitions.id],
      name: "work_commands_biz_workflow_definition_fk",
    }),

    workCommandsShapeCheck: check(
      "work_commands_shape_check",
      sql`
      length("command_key") > 0
      AND length("title") > 0
      AND (
        "command_kind" <> 'action'
        OR "action_key" IS NOT NULL
      )
      AND (
        "command_kind" <> 'workflow'
        OR "workflow_definition_id" IS NOT NULL
      )
      `,
    ),
  }),
);

/**
 * work_command_runs
 *
 * Immutable run ledger for command executions.
 */
export const workCommandRuns = pgTable(
  "work_command_runs",
  {
    id: idWithTag("work_command_run"),

    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    workCommandId: idRef("work_command_id")
      .references(() => workCommands.id)
      .notNull(),

    workItemId: idRef("work_item_id").references(() => workItems.id),

    status: workCommandRunStatusEnum("status").default("pending").notNull(),

    requestedByUserId: idRef("requested_by_user_id")
      .references(() => users.id)
      .notNull(),

    actionRequestId: idRef("action_request_id").references(() => actionRequests.id),
    workflowInstanceId: idRef("workflow_instance_id").references(() => workflowInstances.id),

    inputPayload: jsonb("input_payload").default({}).notNull(),
    outputPayload: jsonb("output_payload").default({}).notNull(),
    errorPayload: jsonb("error_payload").default({}).notNull(),

    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),

    metadata: jsonb("metadata").default({}).notNull(),

    createdAt,
    updatedAt,
    deletedAt,
    createdBy: idRef("created_by").references(() => users.id),
    updatedBy: idRef("updated_by").references(() => users.id),
    deletedBy: idRef("deleted_by").references(() => users.id),
  },
  (table) => ({
    workCommandRunsBizIdIdUnique: uniqueIndex("work_command_runs_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),

    workCommandRunsBizCommandStartedIdx: index("work_command_runs_biz_command_started_idx").on(
      table.bizId,
      table.workCommandId,
      table.startedAt,
    ),

    workCommandRunsBizWorkItemIdx: index("work_command_runs_biz_work_item_idx").on(
      table.bizId,
      table.workItemId,
      table.status,
      table.startedAt,
    ),

    workCommandRunsBizStatusStartedIdx: index("work_command_runs_biz_status_started_idx").on(
      table.bizId,
      table.status,
      table.startedAt,
    ),

    workCommandRunsBizCommandFk: foreignKey({
      columns: [table.bizId, table.workCommandId],
      foreignColumns: [workCommands.bizId, workCommands.id],
      name: "work_command_runs_biz_command_fk",
    }),

    workCommandRunsBizWorkItemFk: foreignKey({
      columns: [table.bizId, table.workItemId],
      foreignColumns: [workItems.bizId, workItems.id],
      name: "work_command_runs_biz_work_item_fk",
    }),

    workCommandRunsBizActionRequestFk: foreignKey({
      columns: [table.bizId, table.actionRequestId],
      foreignColumns: [actionRequests.bizId, actionRequests.id],
      name: "work_command_runs_biz_action_request_fk",
    }),

    workCommandRunsBizWorkflowInstanceFk: foreignKey({
      columns: [table.bizId, table.workflowInstanceId],
      foreignColumns: [workflowInstances.bizId, workflowInstances.id],
      name: "work_command_runs_biz_workflow_instance_fk",
    }),

    workCommandRunsBoundsCheck: check(
      "work_command_runs_bounds_check",
      sql`
      (
        "completed_at" IS NULL
        OR "started_at" IS NULL
        OR "completed_at" >= "started_at"
      )
      `,
    ),
  }),
);
