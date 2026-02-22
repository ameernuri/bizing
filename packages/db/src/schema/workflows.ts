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
import { users } from "./users";
import { bookingOrders, fulfillmentUnits } from "./fulfillment";
import {
  asyncDeliverableStatusEnum,
  asyncDeliverableTypeEnum,
  reviewItemStatusEnum,
  reviewQueueStatusEnum,
  reviewQueueTypeEnum,
  workflowDecisionOutcomeEnum,
  workflowInstanceStatusEnum,
  workflowStepStatusEnum,
  workflowTriggerTypeEnum,
} from "./enums";

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

    /** Trigger source. */
    triggerType: workflowTriggerTypeEnum("trigger_type").notNull(),

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

    /** Lookup by target object. */
    workflowInstancesBizTargetIdx: index("workflow_instances_biz_target_idx").on(
      table.bizId,
      table.targetType,
      table.targetRefId,
    ),

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

    /** Workflow completion should not predate start when both are present. */
    workflowInstancesTimelineCheck: check(
      "workflow_instances_timeline_check",
      sql`"started_at" IS NULL OR "completed_at" IS NULL OR "completed_at" >= "started_at"`,
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
