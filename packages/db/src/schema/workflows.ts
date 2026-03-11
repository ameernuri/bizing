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
import { actionRequests } from "./action_backbone";
import { bizes } from "./bizes";
import { domainEvents } from "./domain_events";
import { users } from "./users";
import { bookingOrders, fulfillmentUnits } from "./fulfillment";
import {
  asyncDeliverableStatusEnum,
  asyncDeliverableTypeEnum,
  lifecycleStatusEnum,
  reviewItemStatusEnum,
  reviewQueueStatusEnum,
  reviewQueueTypeEnum,
  workflowDecisionOutcomeEnum,
  workflowInstanceStatusEnum,
  workflowStepStatusEnum,
  workflowTriggerTypeEnum,
} from "./enums";

/**
 * workflow_definitions
 *
 * ELI5:
 * Defines reusable workflow templates that can be launched from lifecycle
 * hooks, events, actions, schedules, or manual operator actions.
 */
export const workflowDefinitions = pgTable(
  "workflow_definitions",
  {
    /** Stable primary key. */
    id: idWithTag("workflow_definition"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Stable machine key. */
    key: varchar("key", { length: 160 }).notNull(),

    /** Human-readable display name. */
    name: varchar("name", { length: 220 }).notNull(),

    /** Definition lifecycle status. */
    status: lifecycleStatusEnum("status").default("active").notNull(),

    /** Default trigger mode for this workflow definition. */
    triggerMode: varchar("trigger_mode", { length: 40 }).default("manual").notNull(),

    /** Optional target object class this definition is scoped to. */
    targetType: varchar("target_type", { length: 120 }),

    /** Active version pointer. */
    currentVersion: integer("current_version").default(1).notNull(),

    /** Optional user-facing description. */
    description: text("description"),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    workflowDefinitionsBizIdIdUnique: uniqueIndex(
      "workflow_definitions_biz_id_id_unique",
    ).on(table.bizId, table.id),

    workflowDefinitionsBizKeyUnique: uniqueIndex(
      "workflow_definitions_biz_key_unique",
    ).on(table.bizId, table.key),

    workflowDefinitionsBizStatusTriggerIdx: index(
      "workflow_definitions_biz_status_trigger_idx",
    ).on(table.bizId, table.status, table.triggerMode),

    workflowDefinitionsTriggerModeCheck: check(
      "workflow_definitions_trigger_mode_check",
      sql`"trigger_mode" IN ('manual', 'lifecycle_hook', 'domain_event', 'action', 'schedule', 'system')`,
    ),

    workflowDefinitionsCurrentVersionCheck: check(
      "workflow_definitions_current_version_check",
      sql`"current_version" >= 1`,
    ),
  }),
);

/**
 * workflow_definition_versions
 *
 * ELI5:
 * Versioned workflow plan payload for each definition.
 */
export const workflowDefinitionVersions = pgTable(
  "workflow_definition_versions",
  {
    /** Stable primary key. */
    id: idWithTag("workflow_definition_version"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent definition. */
    workflowDefinitionId: idRef("workflow_definition_id")
      .references(() => workflowDefinitions.id)
      .notNull(),

    /** Version number. */
    version: integer("version").notNull(),

    /** Version lifecycle status. */
    status: lifecycleStatusEnum("status").default("active").notNull(),

    /** Ordered step plan for materializing workflow_steps. */
    stepPlan: jsonb("step_plan").default([]).notNull(),

    /** Optional input contract schema payload. */
    inputSchema: jsonb("input_schema").default({}).notNull(),

    /** Optional output contract schema payload. */
    outputSchema: jsonb("output_schema").default({}).notNull(),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    workflowDefinitionVersionsBizIdIdUnique: uniqueIndex(
      "workflow_definition_versions_biz_id_id_unique",
    ).on(table.bizId, table.id),

    workflowDefinitionVersionsBizDefinitionVersionUnique: uniqueIndex(
      "workflow_definition_versions_biz_definition_version_unique",
    ).on(table.bizId, table.workflowDefinitionId, table.version),

    workflowDefinitionVersionsBizDefinitionStatusIdx: index(
      "workflow_definition_versions_biz_definition_status_idx",
    ).on(table.bizId, table.workflowDefinitionId, table.status, table.version),

    workflowDefinitionVersionsBizDefinitionFk: foreignKey({
      columns: [table.bizId, table.workflowDefinitionId],
      foreignColumns: [workflowDefinitions.bizId, workflowDefinitions.id],
      name: "workflow_definition_versions_biz_definition_fk",
    }),

    workflowDefinitionVersionsVersionCheck: check(
      "workflow_definition_versions_version_check",
      sql`"version" >= 1`,
    ),
  }),
);

/**
 * workflow_definition_triggers
 *
 * ELI5:
 * Rules describing what lifecycle/action/event signal launches a workflow
 * definition.
 */
export const workflowDefinitionTriggers = pgTable(
  "workflow_definition_triggers",
  {
    /** Stable primary key. */
    id: idWithTag("workflow_trigger"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Target workflow definition. */
    workflowDefinitionId: idRef("workflow_definition_id")
      .references(() => workflowDefinitions.id)
      .notNull(),

    /** Trigger rule lifecycle status. */
    status: lifecycleStatusEnum("status").default("active").notNull(),

    /** Rule source category. */
    triggerSource: varchar("trigger_source", { length: 50 }).notNull(),

    /** Optional lifecycle hook contract key selector. */
    lifecycleHookContractKey: varchar("lifecycle_hook_contract_key", { length: 180 }),

    /** Optional lifecycle invocation status selector. */
    lifecycleHookInvocationStatus: varchar("lifecycle_hook_invocation_status", { length: 20 }),

    /** Optional effect-type selector for lifecycle hook effects. */
    lifecycleHookEffectType: varchar("lifecycle_hook_effect_type", { length: 120 }),

    /** Optional domain-event wildcard pattern (supports *). */
    domainEventPattern: varchar("domain_event_pattern", { length: 200 }),

    /** Optional action key selector. */
    actionKey: varchar("action_key", { length: 160 }),

    /** Optional target type selector. */
    targetType: varchar("target_type", { length: 120 }),

    /** Priority for deterministic rule ordering. */
    priority: integer("priority").default(100).notNull(),

    /** Which definition version to launch by default. */
    workflowDefinitionVersion: integer("workflow_definition_version")
      .default(1)
      .notNull(),

    /** Idempotency strategy for this trigger. */
    idempotencyMode: varchar("idempotency_mode", { length: 30 })
      .default("trigger_target")
      .notNull(),

    /** Trigger-time materialization configuration. */
    configuration: jsonb("configuration").default({}).notNull(),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    workflowDefinitionTriggersBizIdIdUnique: uniqueIndex(
      "workflow_definition_triggers_biz_id_id_unique",
    ).on(table.bizId, table.id),

    workflowDefinitionTriggersBizDefinitionStatusPriorityIdx: index(
      "workflow_definition_triggers_biz_definition_status_priority_idx",
    ).on(table.bizId, table.workflowDefinitionId, table.status, table.priority, table.id),

    workflowDefinitionTriggersBizSourceStatusPriorityIdx: index(
      "workflow_definition_triggers_biz_source_status_priority_idx",
    ).on(table.bizId, table.triggerSource, table.status, table.priority, table.id),

    workflowDefinitionTriggersBizDefinitionFk: foreignKey({
      columns: [table.bizId, table.workflowDefinitionId],
      foreignColumns: [workflowDefinitions.bizId, workflowDefinitions.id],
      name: "workflow_definition_triggers_biz_definition_fk",
    }),

    /**
     * Trigger target version must reference an existing definition version row.
     * This prevents silent runtime version drift when a trigger points to a
     * non-existent version.
     */
    workflowDefinitionTriggersBizDefinitionVersionFk: foreignKey({
      columns: [table.bizId, table.workflowDefinitionId, table.workflowDefinitionVersion],
      foreignColumns: [
        workflowDefinitionVersions.bizId,
        workflowDefinitionVersions.workflowDefinitionId,
        workflowDefinitionVersions.version,
      ],
      name: "workflow_definition_triggers_biz_definition_version_fk",
    }),

    /**
     * Prevent accidental duplicate trigger selectors for the same target
     * definition/version/status/source tuple.
     */
    workflowDefinitionTriggersSelectorUnique: uniqueIndex(
      "workflow_definition_triggers_selector_unique",
    ).on(
      table.bizId,
      table.workflowDefinitionId,
      table.workflowDefinitionVersion,
      table.status,
      table.triggerSource,
      table.lifecycleHookContractKey,
      table.lifecycleHookInvocationStatus,
      table.lifecycleHookEffectType,
      table.domainEventPattern,
      table.actionKey,
      table.targetType,
    ),

    workflowDefinitionTriggersTriggerSourceCheck: check(
      "workflow_definition_triggers_trigger_source_check",
      sql`
      "trigger_source" IN (
        'lifecycle_hook_invocation',
        'lifecycle_hook_effect',
        'domain_event',
        'action_request',
        'manual',
        'schedule',
        'system'
      )
      `,
    ),

    workflowDefinitionTriggersInvocationStatusCheck: check(
      "workflow_definition_triggers_invocation_status_check",
      sql`
      "lifecycle_hook_invocation_status" IS NULL
      OR "lifecycle_hook_invocation_status" IN ('running', 'succeeded', 'failed', 'skipped')
      `,
    ),

    workflowDefinitionTriggersPriorityCheck: check(
      "workflow_definition_triggers_priority_check",
      sql`"priority" >= 0 AND "priority" <= 100000`,
    ),

    workflowDefinitionTriggersVersionCheck: check(
      "workflow_definition_triggers_version_check",
      sql`"workflow_definition_version" >= 1`,
    ),

    workflowDefinitionTriggersIdempotencyModeCheck: check(
      "workflow_definition_triggers_idempotency_mode_check",
      sql`"idempotency_mode" IN ('none', 'trigger', 'trigger_target')`,
    ),

    workflowDefinitionTriggersSelectorCheck: check(
      "workflow_definition_triggers_selector_check",
      sql`
      (
        "trigger_source" = 'lifecycle_hook_invocation'
        AND "lifecycle_hook_contract_key" IS NOT NULL
      ) OR (
        "trigger_source" = 'lifecycle_hook_effect'
        AND (
          "lifecycle_hook_contract_key" IS NOT NULL
          OR "lifecycle_hook_effect_type" IS NOT NULL
        )
      ) OR (
        "trigger_source" = 'domain_event'
        AND "domain_event_pattern" IS NOT NULL
      ) OR (
        "trigger_source" = 'action_request'
        AND "action_key" IS NOT NULL
      ) OR (
        "trigger_source" IN ('manual', 'schedule', 'system')
      )
      `,
    ),
  }),
);

/**
 * review_queues
 *
 * ELI5:
 * Review queue is a reusable inbox for manual checks
 * (fraud, approvals, compliance moderation, etc.).
 */
export const reviewQueues = pgTable(
  "review_queues",
  {
    /** Stable primary key. */
    id: idWithTag("review_queue"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Queue name in admin tooling. */
    name: varchar("name", { length: 200 }).notNull(),

    /** Stable slug for routing/APIs. */
    slug: varchar("slug", { length: 140 }).notNull(),

    /** Queue classification. */
    type: reviewQueueTypeEnum("type").notNull(),

    /** Queue lifecycle status. */
    status: reviewQueueStatusEnum("status").default("active").notNull(),

    /** Queue behavior policy payload (SLA, assignment strategy, escalation). */
    policy: jsonb("policy").default({}),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    reviewQueuesBizIdIdUnique: uniqueIndex("review_queues_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Composite unique key used by tenant-safe queue-item FKs. */

    /** Unique slug per tenant. */
    reviewQueuesBizSlugUnique: uniqueIndex("review_queues_biz_slug_unique").on(
      table.bizId,
      table.slug,
    ),

    /** Common queue listing path. */
    reviewQueuesBizTypeStatusIdx: index("review_queues_biz_type_status_idx").on(
      table.bizId,
      table.type,
      table.status,
    ),
  }),
);

/**
 * review_queue_items
 *
 * ELI5:
 * One row = one case waiting for reviewer action.
 */
export const reviewQueueItems = pgTable(
  "review_queue_items",
  {
    /** Stable primary key. */
    id: idWithTag("review_item"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent queue. */
    reviewQueueId: idRef("review_queue_id")
      .references(() => reviewQueues.id)
      .notNull(),

    /** Queue-item status. */
    status: reviewItemStatusEnum("status").default("pending").notNull(),

    /** Class of object being reviewed (booking_order, user, payment, etc.). */
    itemType: varchar("item_type", { length: 100 }).notNull(),

    /** Canonical id of the reviewed record. */
    itemRefId: varchar("item_ref_id", { length: 140 }).notNull(),

    /** Optional direct booking-order link for common review paths. */
    bookingOrderId: idRef("booking_order_id").references(() => bookingOrders.id),

    /** Optional direct fulfillment-unit link for operational reviews. */
    fulfillmentUnitId: idRef("fulfillment_unit_id").references(
      () => fulfillmentUnits.id,
    ),

    /**
     * Optional action that caused this review item to exist.
     *
     * ELI5:
     * Reviewers often need to see the original attempted action, not just the
     * object under review. This gives them that "why did this land here?"
     * breadcrumb without hunting through logs.
     */
    sourceActionRequestId: idRef("source_action_request_id").references(
      () => actionRequests.id,
    ),

    /**
     * Optional domain event that spawned this review item.
     *
     * ELI5:
     * Some cases come from automated rules after an event happened. This lets
     * us preserve that causal chain explicitly.
     */
    sourceDomainEventId: idRef("source_domain_event_id").references(
      () => domainEvents.id,
    ),

    /** Priority score for sorting and SLA handling. */
    priority: integer("priority").default(100).notNull(),

    /** Optional risk score (0..100). */
    riskScore: integer("risk_score"),

    /** Optional reviewer assignment. */
    assignedToUserId: idRef("assigned_to_user_id").references(() => users.id),

    /** SLA due time. */
    dueAt: timestamp("due_at", { withTimezone: true }),

    /** Resolution time. */
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),

    /** Structured decision payload. */
    resolutionPayload: jsonb("resolution_payload").default({}),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite unique key used by workflow links. */
    reviewQueueItemsBizIdIdUnique: uniqueIndex(
      "review_queue_items_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** Common active queue board path. */
    reviewQueueItemsBizQueueStatusPriorityIdx: index(
      "review_queue_items_biz_queue_status_priority_idx",
    ).on(table.bizId, table.reviewQueueId, table.status, table.priority),

    /** Common reviewer workload path. */
    reviewQueueItemsBizAssigneeIdx: index("review_queue_items_biz_assignee_idx").on(
      table.bizId,
      table.assignedToUserId,
      table.status,
    ),

    /** Common triage path from one action to the review items it created. */
    reviewQueueItemsSourceActionIdx: index("review_queue_items_source_action_idx").on(
      table.sourceActionRequestId,
    ),

    /** Common triage path from one event to the review items it triggered. */
    reviewQueueItemsSourceDomainEventIdx: index(
      "review_queue_items_source_domain_event_idx",
    ).on(table.sourceDomainEventId),

    /** Tenant-safe FK to parent queue. */
    reviewQueueItemsBizReviewQueueFk: foreignKey({
      columns: [table.bizId, table.reviewQueueId],
      foreignColumns: [reviewQueues.bizId, reviewQueues.id],
      name: "review_queue_items_biz_review_queue_fk",
    }),

    /** Tenant-safe FK to booking order. */
    reviewQueueItemsBizBookingOrderFk: foreignKey({
      columns: [table.bizId, table.bookingOrderId],
      foreignColumns: [bookingOrders.bizId, bookingOrders.id],
      name: "review_queue_items_biz_booking_order_fk",
    }),

    /** Tenant-safe FK to fulfillment unit. */
    reviewQueueItemsBizFulfillmentUnitFk: foreignKey({
      columns: [table.bizId, table.fulfillmentUnitId],
      foreignColumns: [fulfillmentUnits.bizId, fulfillmentUnits.id],
      name: "review_queue_items_biz_fulfillment_unit_fk",
    }),

    /** Risk score must be 0..100 when present. */
    reviewQueueItemsRiskBoundsCheck: check(
      "review_queue_items_risk_bounds_check",
      sql`"risk_score" IS NULL OR ("risk_score" >= 0 AND "risk_score" <= 100)`,
    ),

    /** Resolution cannot occur before creation in practical terms. */
    reviewQueueItemsResolutionTimeCheck: check(
      "review_queue_items_resolution_time_check",
      sql`"resolved_at" IS NULL OR "resolved_at" >= "created_at"`,
    ),
  }),
);

/**
 * workflow_instances
 *
 * ELI5:
 * One workflow instance tracks the state of one running process.
 * Example processes: approval flow, fraud review flow, async service pipeline.
 */
export const workflowInstances = pgTable(
  "workflow_instances",
  {
    /** Stable primary key. */
    id: idWithTag("workflow_instance"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Workflow template key (e.g., "medical_approval_v1"). */
    workflowKey: varchar("workflow_key", { length: 140 }).notNull(),

    /** Optional source workflow definition for this instance. */
    workflowDefinitionId: idRef("workflow_definition_id").references(
      () => workflowDefinitions.id,
    ),

    /** Optional source workflow definition version. */
    workflowDefinitionVersion: integer("workflow_definition_version"),

    /** Trigger source. */
    triggerType: workflowTriggerTypeEnum("trigger_type").notNull(),

    /**
     * Optional originating action request.
     *
     * ELI5:
     * This answers "which requested business action started this process?"
     * Example: `booking.create` caused an approval workflow.
     */
    actionRequestId: idRef("action_request_id").references(() => actionRequests.id),

    /**
     * Optional triggering domain event.
     *
     * ELI5:
     * This answers "which business fact woke up this workflow?"
     * Example: `payment.failed` started a recovery process.
     */
    triggeringDomainEventId: idRef("triggering_domain_event_id").references(
      () => domainEvents.id,
    ),

    /** Instance lifecycle status. */
    status: workflowInstanceStatusEnum("status").default("pending").notNull(),

    /** Target object class (booking_order, fulfillment_unit, etc.). */
    targetType: varchar("target_type", { length: 100 }).notNull(),

    /** Target object id. */
    targetRefId: varchar("target_ref_id", { length: 140 }).notNull(),

    /** Optional direct booking-order link for common workflow cases. */
    bookingOrderId: idRef("booking_order_id").references(() => bookingOrders.id),

    /** Optional direct fulfillment-unit link. */
    fulfillmentUnitId: idRef("fulfillment_unit_id").references(
      () => fulfillmentUnits.id,
    ),

    /** Optional direct queue-item link. */
    reviewQueueItemId: idRef("review_queue_item_id").references(
      () => reviewQueueItems.id,
    ),

    /** Workflow start timestamp. */
    startedAt: timestamp("started_at", { withTimezone: true }),

    /** Workflow completion timestamp. */
    completedAt: timestamp("completed_at", { withTimezone: true }),

    /** Current step key for quick state display. */
    currentStepKey: varchar("current_step_key", { length: 140 }),

    /** Optional terminal error code/reason. */
    errorCode: varchar("error_code", { length: 120 }),

    /** Workflow input payload snapshot. */
    inputPayload: jsonb("input_payload").default({}).notNull(),

    /** Workflow output payload snapshot. */
    outputPayload: jsonb("output_payload").default({}),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite unique key used by step/decision tables. */
    workflowInstancesBizIdIdUnique: uniqueIndex(
      "workflow_instances_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** Common runtime workflow board path. */
    workflowInstancesBizStatusStartedIdx: index(
      "workflow_instances_biz_status_started_idx",
    ).on(table.bizId, table.status, table.startedAt),

    /** Common path for definition-centric drilldowns. */
    workflowInstancesBizDefinitionStatusStartedIdx: index(
      "workflow_instances_biz_definition_status_started_idx",
    ).on(
      table.bizId,
      table.workflowDefinitionId,
      table.workflowDefinitionVersion,
      table.status,
      table.startedAt,
    ),

    /** Lookup by target object. */
    workflowInstancesBizTargetIdx: index("workflow_instances_biz_target_idx").on(
      table.bizId,
      table.targetType,
      table.targetRefId,
    ),

    /** Common trace path from action -> workflow. */
    workflowInstancesActionRequestIdx: index("workflow_instances_action_request_idx").on(
      table.actionRequestId,
    ),

    /** Common trace path from event -> workflow. */
    workflowInstancesTriggeringDomainEventIdx: index(
      "workflow_instances_triggering_domain_event_idx",
    ).on(table.triggeringDomainEventId),

    /** Tenant-safe FK to booking order. */
    workflowInstancesBizBookingOrderFk: foreignKey({
      columns: [table.bizId, table.bookingOrderId],
      foreignColumns: [bookingOrders.bizId, bookingOrders.id],
      name: "workflow_instances_biz_booking_order_fk",
    }),

    /** Tenant-safe FK to fulfillment unit. */
    workflowInstancesBizFulfillmentUnitFk: foreignKey({
      columns: [table.bizId, table.fulfillmentUnitId],
      foreignColumns: [fulfillmentUnits.bizId, fulfillmentUnits.id],
      name: "workflow_instances_biz_fulfillment_unit_fk",
    }),

    /** Tenant-safe FK to review queue item. */
    workflowInstancesBizReviewQueueItemFk: foreignKey({
      columns: [table.bizId, table.reviewQueueItemId],
      foreignColumns: [reviewQueueItems.bizId, reviewQueueItems.id],
      name: "workflow_instances_biz_review_queue_item_fk",
    }),

    /** Tenant-safe FK to source workflow definition. */
    workflowInstancesBizDefinitionFk: foreignKey({
      columns: [table.bizId, table.workflowDefinitionId],
      foreignColumns: [workflowDefinitions.bizId, workflowDefinitions.id],
      name: "workflow_instances_biz_definition_fk",
    }),

    /** Tenant-safe FK to concrete workflow definition version. */
    workflowInstancesBizDefinitionVersionFk: foreignKey({
      columns: [table.bizId, table.workflowDefinitionId, table.workflowDefinitionVersion],
      foreignColumns: [
        workflowDefinitionVersions.bizId,
        workflowDefinitionVersions.workflowDefinitionId,
        workflowDefinitionVersions.version,
      ],
      name: "workflow_instances_biz_definition_version_fk",
    }),

    /** Definition/version references must be paired and valid. */
    workflowInstancesDefinitionVersionCheck: check(
      "workflow_instances_definition_version_check",
      sql`
      (
        "workflow_definition_id" IS NULL
        AND "workflow_definition_version" IS NULL
      ) OR (
        "workflow_definition_id" IS NOT NULL
        AND "workflow_definition_version" IS NOT NULL
        AND "workflow_definition_version" >= 1
      )
      `,
    ),

    /** Workflow completion should not predate start when both are present. */
    workflowInstancesTimelineCheck: check(
      "workflow_instances_timeline_check",
      sql`"started_at" IS NULL OR "completed_at" IS NULL OR "completed_at" >= "started_at"`,
    ),
  }),
);

/**
 * workflow_trigger_invocations
 *
 * ELI5:
 * One row records one attempt to launch a workflow from a trigger binding.
 * This gives us deterministic idempotency and execution evidence.
 */
export const workflowTriggerInvocations = pgTable(
  "workflow_trigger_invocations",
  {
    /** Stable primary key. */
    id: idWithTag("workflow_trigger_invocation"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Source trigger binding that fired. */
    workflowDefinitionTriggerId: idRef("workflow_definition_trigger_id")
      .references(() => workflowDefinitionTriggers.id)
      .notNull(),

    /** Workflow definition chosen by the trigger binding. */
    workflowDefinitionId: idRef("workflow_definition_id")
      .references(() => workflowDefinitions.id)
      .notNull(),

    /** Materialized definition version used to create instance/steps. */
    workflowDefinitionVersion: integer("workflow_definition_version").notNull(),

    /** Optional linked runtime workflow instance. */
    workflowInstanceId: idRef("workflow_instance_id").references(
      () => workflowInstances.id,
    ),

    /** Trigger source snapshot. */
    triggerSource: varchar("trigger_source", { length: 50 }).notNull(),

    /** External reference for the upstream signal (event/action/invocation id). */
    triggerRefId: varchar("trigger_ref_id", { length: 160 }).notNull(),

    /** Target object class passed into the trigger dispatcher. */
    targetType: varchar("target_type", { length: 120 }).notNull(),

    /** Target object id passed into the trigger dispatcher. */
    targetRefId: varchar("target_ref_id", { length: 160 }).notNull(),

    /** Idempotency key controlled by trigger idempotency mode. */
    idempotencyKey: varchar("idempotency_key", { length: 260 }),

    /** Invocation status. */
    status: varchar("status", { length: 20 }).default("running").notNull(),

    /** Started timestamp. */
    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),

    /** Completion timestamp. */
    completedAt: timestamp("completed_at", { withTimezone: true }),

    /** Optional runtime duration. */
    durationMs: integer("duration_ms"),

    /** Trigger input snapshot. */
    inputPayload: jsonb("input_payload").default({}).notNull(),

    /** Trigger output snapshot. */
    outputPayload: jsonb("output_payload").default({}),

    /** Optional error details. */
    errorCode: varchar("error_code", { length: 120 }),
    errorMessage: varchar("error_message", { length: 2000 }),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    workflowTriggerInvocationsBizIdIdUnique: uniqueIndex(
      "workflow_trigger_invocations_biz_id_id_unique",
    ).on(table.bizId, table.id),

    workflowTriggerInvocationsBizTriggerStartedIdx: index(
      "workflow_trigger_invocations_biz_trigger_started_idx",
    ).on(table.bizId, table.workflowDefinitionTriggerId, table.startedAt),

    workflowTriggerInvocationsBizTargetStartedIdx: index(
      "workflow_trigger_invocations_biz_target_started_idx",
    ).on(table.bizId, table.targetType, table.targetRefId, table.startedAt),

    workflowTriggerInvocationsBizIdempotencyUnique: uniqueIndex(
      "workflow_trigger_invocations_biz_idempotency_unique",
    )
      .on(table.bizId, table.idempotencyKey)
      .where(sql`"idempotency_key" IS NOT NULL`),

    workflowTriggerInvocationsBizTriggerFk: foreignKey({
      columns: [table.bizId, table.workflowDefinitionTriggerId],
      foreignColumns: [workflowDefinitionTriggers.bizId, workflowDefinitionTriggers.id],
      name: "workflow_trigger_invocations_biz_trigger_fk",
    }),

    workflowTriggerInvocationsBizDefinitionFk: foreignKey({
      columns: [table.bizId, table.workflowDefinitionId],
      foreignColumns: [workflowDefinitions.bizId, workflowDefinitions.id],
      name: "workflow_trigger_invocations_biz_definition_fk",
    }),

    workflowTriggerInvocationsBizDefinitionVersionFk: foreignKey({
      columns: [table.bizId, table.workflowDefinitionId, table.workflowDefinitionVersion],
      foreignColumns: [
        workflowDefinitionVersions.bizId,
        workflowDefinitionVersions.workflowDefinitionId,
        workflowDefinitionVersions.version,
      ],
      name: "workflow_trigger_invocations_biz_definition_version_fk",
    }),

    workflowTriggerInvocationsBizWorkflowInstanceFk: foreignKey({
      columns: [table.bizId, table.workflowInstanceId],
      foreignColumns: [workflowInstances.bizId, workflowInstances.id],
      name: "workflow_trigger_invocations_biz_workflow_instance_fk",
    }),

    workflowTriggerInvocationsTriggerSourceCheck: check(
      "workflow_trigger_invocations_trigger_source_check",
      sql`
      "trigger_source" IN (
        'lifecycle_hook_invocation',
        'lifecycle_hook_effect',
        'domain_event',
        'action_request',
        'manual',
        'schedule',
        'system'
      )
      `,
    ),

    workflowTriggerInvocationsStatusCheck: check(
      "workflow_trigger_invocations_status_check",
      sql`"status" IN ('running', 'succeeded', 'failed', 'skipped')`,
    ),

    workflowTriggerInvocationsVersionCheck: check(
      "workflow_trigger_invocations_version_check",
      sql`"workflow_definition_version" >= 1`,
    ),

    workflowTriggerInvocationsDurationCheck: check(
      "workflow_trigger_invocations_duration_check",
      sql`"duration_ms" IS NULL OR "duration_ms" >= 0`,
    ),

    workflowTriggerInvocationsTimelineCheck: check(
      "workflow_trigger_invocations_timeline_check",
      sql`"completed_at" IS NULL OR "completed_at" >= "started_at"`,
    ),
  }),
);

/**
 * workflow_steps
 *
 * ELI5:
 * Step rows provide fine-grained state inside a workflow instance.
 */
export const workflowSteps = pgTable(
  "workflow_steps",
  {
    /** Stable primary key. */
    id: idWithTag("workflow_step"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent workflow instance. */
    workflowInstanceId: idRef("workflow_instance_id")
      .references(() => workflowInstances.id)
      .notNull(),

    /** Step key from workflow definition. */
    stepKey: varchar("step_key", { length: 140 }).notNull(),

    /** Human step name. */
    name: varchar("name", { length: 200 }).notNull(),

    /** Sequence ordering for deterministic flow display. */
    sequence: integer("sequence").notNull(),

    /** Step lifecycle status. */
    status: workflowStepStatusEnum("status").default("pending").notNull(),

    /** Optional assignee for manual steps. */
    assignedToUserId: idRef("assigned_to_user_id").references(() => users.id),

    /** Optional start time. */
    startedAt: timestamp("started_at", { withTimezone: true }),

    /** Optional completion time. */
    completedAt: timestamp("completed_at", { withTimezone: true }),

    /** Optional deadline. */
    dueAt: timestamp("due_at", { withTimezone: true }),

    /** Structured input context for this step. */
    inputPayload: jsonb("input_payload").default({}),

    /** Structured output context for this step. */
    outputPayload: jsonb("output_payload").default({}),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    workflowStepsBizIdIdUnique: uniqueIndex("workflow_steps_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Composite unique key used by decision table. */

    /** Prevent duplicate step keys in one instance. */
    workflowStepsInstanceStepKeyUnique: uniqueIndex(
      "workflow_steps_instance_step_key_unique",
    ).on(table.workflowInstanceId, table.stepKey),

    /** Common instance timeline path. */
    workflowStepsBizInstanceSequenceIdx: index(
      "workflow_steps_biz_instance_sequence_idx",
    ).on(table.bizId, table.workflowInstanceId, table.sequence),

    /** Tenant-safe FK to instance. */
    workflowStepsBizInstanceFk: foreignKey({
      columns: [table.bizId, table.workflowInstanceId],
      foreignColumns: [workflowInstances.bizId, workflowInstances.id],
      name: "workflow_steps_biz_instance_fk",
    }),

    /** Sequence must be non-negative. */
    workflowStepsSequenceCheck: check(
      "workflow_steps_sequence_check",
      sql`"sequence" >= 0`,
    ),

    /** Step completion cannot predate start when both are present. */
    workflowStepsTimelineCheck: check(
      "workflow_steps_timeline_check",
      sql`"started_at" IS NULL OR "completed_at" IS NULL OR "completed_at" >= "started_at"`,
    ),
  }),
);

/**
 * workflow_decisions
 *
 * ELI5:
 * Decision rows are explicit choice records made by people/policy engines.
 */
export const workflowDecisions = pgTable(
  "workflow_decisions",
  {
    /** Stable primary key. */
    id: idWithTag("workflow_decision"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Workflow instance context. */
    workflowInstanceId: idRef("workflow_instance_id")
      .references(() => workflowInstances.id)
      .notNull(),

    /** Optional step context if decision belongs to a specific step. */
    workflowStepId: idRef("workflow_step_id").references(() => workflowSteps.id),

    /** Decision outcome. */
    outcome: workflowDecisionOutcomeEnum("outcome").notNull(),

    /** Optional decider identity. */
    deciderUserId: idRef("decider_user_id").references(() => users.id),

    /** Decision time. */
    decidedAt: timestamp("decided_at", { withTimezone: true }).defaultNow().notNull(),

    /** Optional reason text for decision transparency. */
    reason: text("reason"),

    /** Structured decision context payload. */
    payload: jsonb("payload").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    workflowDecisionsBizIdIdUnique: uniqueIndex("workflow_decisions_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Common instance decision timeline path. */
    workflowDecisionsBizInstanceDecidedIdx: index(
      "workflow_decisions_biz_instance_decided_idx",
    ).on(table.bizId, table.workflowInstanceId, table.decidedAt),

    /** Tenant-safe FK to instance. */
    workflowDecisionsBizInstanceFk: foreignKey({
      columns: [table.bizId, table.workflowInstanceId],
      foreignColumns: [workflowInstances.bizId, workflowInstances.id],
      name: "workflow_decisions_biz_instance_fk",
    }),

    /** Tenant-safe FK to step. */
    workflowDecisionsBizStepFk: foreignKey({
      columns: [table.bizId, table.workflowStepId],
      foreignColumns: [workflowSteps.bizId, workflowSteps.id],
      name: "workflow_decisions_biz_step_fk",
    }),
  }),
);

/**
 * async_deliverables
 *
 * ELI5:
 * Records output-producing async work (e.g., submit files now, get report later).
 */
export const asyncDeliverables = pgTable(
  "async_deliverables",
  {
    /** Stable primary key. */
    id: idWithTag("async_deliverable"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Optional workflow instance running this deliverable. */
    workflowInstanceId: idRef("workflow_instance_id").references(
      () => workflowInstances.id,
    ),

    /** Optional order link. */
    bookingOrderId: idRef("booking_order_id").references(() => bookingOrders.id),

    /** Optional fulfillment unit link. */
    fulfillmentUnitId: idRef("fulfillment_unit_id").references(
      () => fulfillmentUnits.id,
    ),

    /** Deliverable output type. */
    deliverableType: asyncDeliverableTypeEnum("deliverable_type").notNull(),

    /** Deliverable lifecycle status. */
    status: asyncDeliverableStatusEnum("status").default("queued").notNull(),

    /** Requested timestamp. */
    requestedAt: timestamp("requested_at", { withTimezone: true }).defaultNow().notNull(),

    /** Optional processing start. */
    processingStartedAt: timestamp("processing_started_at", {
      withTimezone: true,
    }),

    /** Optional completion-ready time. */
    readyAt: timestamp("ready_at", { withTimezone: true }),

    /** Optional expiration time after delivery window closes. */
    expiresAt: timestamp("expires_at", { withTimezone: true }),

    /** Delivery channel hint (email, portal, webhook, etc.). */
    deliveryChannel: varchar("delivery_channel", { length: 80 }),

    /** Output/result payload (links, summary, metrics). */
    resultPayload: jsonb("result_payload").default({}),

    /** Optional failure details. */
    failureReason: text("failure_reason"),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    asyncDeliverablesBizIdIdUnique: uniqueIndex("async_deliverables_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Common operations queue path. */
    asyncDeliverablesBizStatusRequestedIdx: index(
      "async_deliverables_biz_status_requested_idx",
    ).on(table.bizId, table.status, table.requestedAt),

    /** Tenant-safe FK to workflow instance. */
    asyncDeliverablesBizWorkflowInstanceFk: foreignKey({
      columns: [table.bizId, table.workflowInstanceId],
      foreignColumns: [workflowInstances.bizId, workflowInstances.id],
      name: "async_deliverables_biz_workflow_instance_fk",
    }),

    /** Tenant-safe FK to booking order. */
    asyncDeliverablesBizBookingOrderFk: foreignKey({
      columns: [table.bizId, table.bookingOrderId],
      foreignColumns: [bookingOrders.bizId, bookingOrders.id],
      name: "async_deliverables_biz_booking_order_fk",
    }),

    /** Tenant-safe FK to fulfillment unit. */
    asyncDeliverablesBizFulfillmentUnitFk: foreignKey({
      columns: [table.bizId, table.fulfillmentUnitId],
      foreignColumns: [fulfillmentUnits.bizId, fulfillmentUnits.id],
      name: "async_deliverables_biz_fulfillment_unit_fk",
    }),

    /** Timeline ordering sanity checks. */
    asyncDeliverablesTimelineCheck: check(
      "async_deliverables_timeline_check",
      sql`
      ("processing_started_at" IS NULL OR "processing_started_at" >= "requested_at")
      AND ("ready_at" IS NULL OR "processing_started_at" IS NULL OR "ready_at" >= "processing_started_at")
      AND ("expires_at" IS NULL OR "ready_at" IS NULL OR "expires_at" >= "ready_at")
      `,
    ),
  }),
);
