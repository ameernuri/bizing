import { sql } from "drizzle-orm";
import { check, foreignKey, index, pgTable, uniqueIndex } from "drizzle-orm/pg-core";
import {
  boolean,
  integer,
  jsonb,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { idRef, idWithTag, withAuditRefs } from "./_common";
import { bizes } from "./bizes";
import { debugSnapshots } from "./projections";
import { users } from "./users";
import { subjects } from "./subjects";

/**
 * action_requests
 *
 * ELI5:
 * This table is the front door for important business writes.
 *
 * Instead of only saying:
 * - "row X changed"
 *
 * we also record:
 * - who asked for the change
 * - what they were trying to do
 * - whether they only previewed it or executed it
 * - what object they were acting on
 * - what payload they sent
 *
 * Why this matters:
 * - humans think in tasks ("reschedule booking")
 * - agents think in capabilities ("execute booking.reschedule")
 * - audit/debugging need request-level truth, not just final state
 *
 * This table is intentionally generic.
 * It should be reusable for booking, payments, staffing, external installs,
 * compliance actions, admin operations, and future plugins.
 */
export const actionRequests = pgTable(
  "action_requests",
  {
    /** Stable primary key for one requested business action. */
    id: idWithTag("action_request"),

    /** Tenant boundary. Null allows a future platform-global action if needed. */
    bizId: idRef("biz_id").references(() => bizes.id),

    /**
     * Stable business action key.
     *
     * Examples:
     * - `booking.create`
     * - `booking.reschedule`
     * - `member.offboard`
     * - `payment.capture`
     */
    actionKey: varchar("action_key", { length: 160 }).notNull(),

    /**
     * Broad execution class used for routing, dashboards, and policy lanes.
     *
     * Examples:
     * - `booking`
     * - `payments`
     * - `members`
     * - `compliance`
     */
    actionFamily: varchar("action_family", { length: 80 }).notNull(),

    /**
     * Who initiated the request at a broad level.
     *
     * Examples:
     * - `user`
     * - `api_key`
     * - `agent`
     * - `integration`
     * - `system`
     */
    actorType: varchar("actor_type", { length: 40 }).notNull(),

    /** Optional direct user link when the actor is or resolves to a user. */
    actorUserId: idRef("actor_user_id").references(() => users.id),

    /**
     * Free-form actor reference for non-user principals.
     *
     * Examples:
     * - API credential id
     * - agent run id
     * - installation id
     * - system worker key
     */
    actorRef: varchar("actor_ref", { length: 160 }),

    /**
     * Optional installation/integration source.
     *
     * ELI5:
     * This lets us answer which outside surface sent the action.
     * Example: WordPress site install `wp_install_123`.
     */
    sourceInstallationRef: varchar("source_installation_ref", { length: 160 }),

    /**
     * Business intent mode.
     *
     * Examples:
     * - `execute` = do the real mutation
     * - `dry_run` = preview only
     * - `validate_only` = check input/rules only
     */
    intentMode: varchar("intent_mode", { length: 32 }).default("execute").notNull(),

    /**
     * Overall lifecycle state of the request itself.
     *
     * This is not the same as the final business object state.
     * It only answers what happened to the request.
     */
    status: varchar("status", { length: 32 }).default("pending").notNull(),

    /**
     * Risk lane used by policy/approval logic.
     *
     * Typical values:
     * - `green` = auto allowed
     * - `yellow` = review needed
     * - `red` = explicit approval required
     */
    riskLane: varchar("risk_lane", { length: 32 }).default("green").notNull(),

    /** Optional subject being acted upon, using the canonical subject registry. */
    targetSubjectType: varchar("target_subject_type", { length: 80 }),
    targetSubjectId: varchar("target_subject_id", { length: 140 }),

    /** Request payload exactly as received after normalization/sanitization. */
    inputPayload: jsonb("input_payload").default({}).notNull(),

    /**
     * Optional preview payload generated during dry-run/validation.
     *
     * This can include:
     * - expected changes
     * - conflicts
     * - approvals needed
     * - side effects
     */
    previewPayload: jsonb("preview_payload").default({}).notNull(),

    /** Response payload that was returned to the caller. */
    outputPayload: jsonb("output_payload").default({}).notNull(),

    /** Human-readable explanation for why the request failed or was blocked. */
    statusReason: text("status_reason"),

    /** Correlation id used to tie action, events, workflows, and logs together. */
    correlationId: varchar("correlation_id", { length: 160 }),

    /** Optional causation id when this action was triggered by a prior action/event. */
    causationId: varchar("causation_id", { length: 160 }),

    /** When the caller first asked for the action. */
    requestedAt: timestamp("requested_at", { withTimezone: true }).defaultNow().notNull(),

    /** When the request started real execution. */
    executionStartedAt: timestamp("execution_started_at", { withTimezone: true }),

    /** When the request reached a terminal state. */
    completedAt: timestamp("completed_at", { withTimezone: true }),

    /** Generic metadata bucket for routing/source hints. */
    metadata: jsonb("metadata").default({}).notNull(),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    actionRequestsBizIdIdUnique: uniqueIndex("action_requests_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),

    /** Main operational lookup: show recent actions for one biz. */
    actionRequestsBizRequestedAtIdx: index("action_requests_biz_requested_at_idx").on(
      table.bizId,
      table.requestedAt,
    ),

    /** Common debug path: filter by action type and status. */
    actionRequestsBizActionStatusIdx: index("action_requests_biz_action_status_idx").on(
      table.bizId,
      table.actionFamily,
      table.actionKey,
      table.status,
    ),

    /** Common "what did this user/integration do?" path. */
    actionRequestsActorIdx: index("action_requests_actor_idx").on(
      table.bizId,
      table.actorType,
      table.actorUserId,
      table.actorRef,
      table.requestedAt,
    ),

    /** Optional but very useful for end-to-end tracing. */
    actionRequestsCorrelationIdx: index("action_requests_correlation_idx").on(
      table.correlationId,
      table.causationId,
    ),

    /** Tenant-safe FK into shared subject registry when a target is present. */
    actionRequestsTargetSubjectFk: foreignKey({
      columns: [table.bizId, table.targetSubjectType, table.targetSubjectId],
      foreignColumns: [subjects.bizId, subjects.subjectType, subjects.subjectId],
      name: "action_requests_target_subject_fk",
    }),

    /** Prevent empty action keys and impossible execution windows. */
    actionRequestsSanityCheck: check(
      "action_requests_sanity_check",
      sql`
      length("action_key") > 0
      AND length("action_family") > 0
      AND (
        "execution_started_at" IS NULL
        OR "execution_started_at" >= "requested_at"
      )
      AND (
        "completed_at" IS NULL
        OR "completed_at" >= "requested_at"
      )
      `,
    ),
  }),
);

/**
 * action_idempotency_keys
 *
 * ELI5:
 * This table remembers retry keys for important actions.
 *
 * Why:
 * Real systems retry.
 * Browsers retry, webhooks retry, mobile apps retry, agents retry.
 *
 * We do not want the same booking/payment/offboarding action to run twice
 * just because the network was messy.
 */
export const actionIdempotencyKeys = pgTable(
  "action_idempotency_keys",
  {
    /** Stable primary key. */
    id: idWithTag("action_idempotency"),

    /** Tenant boundary. */
    bizId: idRef("biz_id").references(() => bizes.id),

    /** Action this key belongs to. */
    actionRequestId: idRef("action_request_id")
      .references(() => actionRequests.id, { onDelete: "cascade" })
      .notNull(),

    /** Public idempotency key supplied by caller or generated by orchestration layer. */
    idempotencyKey: varchar("idempotency_key", { length: 200 }).notNull(),

    /** Action key this idempotency key applies to. */
    actionKey: varchar("action_key", { length: 160 }).notNull(),

    /** Optional caller/credential namespace to avoid accidental collisions. */
    actorNamespace: varchar("actor_namespace", { length: 160 }),

    /** Hash of normalized payload for replay safety. */
    requestHash: varchar("request_hash", { length: 128 }).notNull(),

    /** Current replay status for this key. */
    status: varchar("status", { length: 32 }).default("reserved").notNull(),

    /** When this key should stop being reused. */
    expiresAt: timestamp("expires_at", { withTimezone: true }),

    /** Metadata for client/debug notes. */
    metadata: jsonb("metadata").default({}).notNull(),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    actionIdempotencyBizIdIdUnique: uniqueIndex("action_idempotency_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),

    /**
     * One logical key per action namespace.
     *
     * The payload hash lives separately so the API can reject mismatched replays
     * using the same key.
     */
    actionIdempotencyNamespaceUnique: uniqueIndex(
      "action_idempotency_namespace_unique",
    ).on(table.bizId, table.actionKey, table.actorNamespace, table.idempotencyKey),

    /** Useful cleanup and replay query path. */
    actionIdempotencyStatusExpiryIdx: index("action_idempotency_status_expiry_idx").on(
      table.status,
      table.expiresAt,
    ),

    actionIdempotencyNonEmptyCheck: check(
      "action_idempotency_non_empty_check",
      sql`length("idempotency_key") > 0 AND length("action_key") > 0 AND length("request_hash") > 0`,
    ),
  }),
);

/**
 * action_executions
 *
 * ELI5:
 * A single action request may have one main execution attempt plus retries or
 * resumed execution phases.
 *
 * This table stores the execution-level story:
 * - what phase ran
 * - what result it had
 * - what failed
 * - whether it can be retried
 */
export const actionExecutions = pgTable(
  "action_executions",
  {
    /** Stable primary key. */
    id: idWithTag("action_execution"),

    /** Parent request. */
    actionRequestId: idRef("action_request_id")
      .references(() => actionRequests.id, { onDelete: "cascade" })
      .notNull(),

    /** Tenant boundary duplicated for tenant-safe filtering. */
    bizId: idRef("biz_id").references(() => bizes.id),

    /** Attempt number for retries/re-entry. */
    attemptNumber: integer("attempt_number").default(1).notNull(),

    /** Execution phase label. Example: validate, policy, execute, finalize. */
    phaseKey: varchar("phase_key", { length: 100 }).notNull(),

    /** Execution result. */
    status: varchar("status", { length: 32 }).default("pending").notNull(),

    /** Machine-friendly error/failure code when status is not success. */
    failureCode: varchar("failure_code", { length: 120 }),

    /** Human-readable explanation for operators and debugging. */
    failureMessage: text("failure_message"),

    /** Whether the platform thinks this failure is retryable. */
    isRetryable: boolean("is_retryable").default(false).notNull(),

    /** Structured diagnostics for this phase. */
    diagnostics: jsonb("diagnostics").default({}).notNull(),

    /** Structured payload of what changed or would have changed. */
    effectSummary: jsonb("effect_summary").default({}).notNull(),

    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),

    metadata: jsonb("metadata").default({}).notNull(),

    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    actionExecutionsBizIdIdUnique: uniqueIndex("action_executions_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),

    actionExecutionsRequestAttemptUnique: uniqueIndex(
      "action_executions_request_attempt_unique",
    ).on(table.actionRequestId, table.attemptNumber, table.phaseKey),

    actionExecutionsRequestStatusIdx: index("action_executions_request_status_idx").on(
      table.actionRequestId,
      table.status,
      table.startedAt,
    ),

    actionExecutionsRetryIdx: index("action_executions_retry_idx").on(
      table.failureCode,
      table.isRetryable,
    ),

    actionExecutionsTimeCheck: check(
      "action_executions_time_check",
      sql`"completed_at" IS NULL OR "completed_at" >= "started_at"`,
    ),
  }),
);

/**
 * action_related_entities
 *
 * ELI5:
 * This table says which business entities were touched or discovered while an
 * action executed.
 *
 * Why:
 * - lets debugging answer "what did this action touch?"
 * - lets audit answer "what changed because of this request?"
 * - lets UIs show a useful timeline without scanning every table
 */
export const actionRelatedEntities = pgTable(
  "action_related_entities",
  {
    id: idWithTag("action_entity"),

    actionRequestId: idRef("action_request_id")
      .references(() => actionRequests.id, { onDelete: "cascade" })
      .notNull(),

    bizId: idRef("biz_id").references(() => bizes.id),

    entityRole: varchar("entity_role", { length: 60 }).notNull(),
    entitySubjectType: varchar("entity_subject_type", { length: 80 }).notNull(),
    entitySubjectId: varchar("entity_subject_id", { length: 140 }).notNull(),

    /**
     * Relation type helps distinguish:
     * - target
     * - created
     * - updated
     * - deleted
     * - read
     * - blocked_by
     * - approved_by
     */
    relationType: varchar("relation_type", { length: 40 }).notNull(),

    metadata: jsonb("metadata").default({}).notNull(),

    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    actionRelatedEntitiesBizIdIdUnique: uniqueIndex(
      "action_related_entities_biz_id_id_unique",
    ).on(table.bizId, table.id),

    actionRelatedEntitiesActionIdx: index("action_related_entities_action_idx").on(
      table.actionRequestId,
      table.relationType,
    ),

    actionRelatedEntitiesEntityIdx: index("action_related_entities_entity_idx").on(
      table.bizId,
      table.entitySubjectType,
      table.entitySubjectId,
      table.relationType,
    ),

    actionRelatedEntitiesSubjectFk: foreignKey({
      columns: [table.bizId, table.entitySubjectType, table.entitySubjectId],
      foreignColumns: [subjects.bizId, subjects.subjectType, subjects.subjectId],
      name: "action_related_entities_subject_fk",
    }),
  }),
);

/**
 * action_failures
 *
 * ELI5:
 * This is the "why did it fail?" table.
 *
 * Audit tells us what happened.
 * This table helps us debug why it broke.
 *
 * It stores one normalized failure record per important failure point.
 */
export const actionFailures = pgTable(
  "action_failures",
  {
    id: idWithTag("action_failure"),

    bizId: idRef("biz_id").references(() => bizes.id),

    actionRequestId: idRef("action_request_id")
      .references(() => actionRequests.id, { onDelete: "cascade" })
      .notNull(),

    actionExecutionId: idRef("action_execution_id").references(
      () => actionExecutions.id,
      { onDelete: "cascade" },
    ),

    /**
     * High-level failure family.
     *
     * Examples:
     * - validation
     * - policy
     * - approval
     * - conflict
     * - dependency
     * - integration
     * - timeout
     * - internal
     */
    failureFamily: varchar("failure_family", { length: 40 }).notNull(),

    /** Specific machine-readable code. */
    failureCode: varchar("failure_code", { length: 120 }).notNull(),

    /** Human-readable explanation. */
    failureMessage: text("failure_message").notNull(),

    /** Optional recommended next step for UI/agents/operators. */
    suggestedResolution: text("suggested_resolution"),

    /** Whether retrying the same action is expected to work. */
    isRetryable: boolean("is_retryable").default(false).notNull(),

    /** Useful debugging data captured at failure time. */
    diagnostics: jsonb("diagnostics").default({}).notNull(),

    /** Snapshot of visible state that influenced the failure. */
    stateSnapshot: jsonb("state_snapshot").default({}).notNull(),

    /**
     * Optional structured debug snapshot.
     *
     * ELI5:
     * `state_snapshot` is a copy stored on the failure row.
     * `debug_snapshot_id` points at a richer shared debugging artifact when we
     * captured one. This keeps debugging first-class instead of burying
     * everything in text fields.
     */
    debugSnapshotId: idRef("debug_snapshot_id").references(() => debugSnapshots.id),

    failedAt: timestamp("failed_at", { withTimezone: true }).defaultNow().notNull(),

    metadata: jsonb("metadata").default({}).notNull(),

    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    actionFailuresBizIdIdUnique: uniqueIndex("action_failures_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),

    actionFailuresRequestIdx: index("action_failures_request_idx").on(
      table.actionRequestId,
      table.failedAt,
    ),

    actionFailuresFamilyCodeIdx: index("action_failures_family_code_idx").on(
      table.failureFamily,
      table.failureCode,
      table.failedAt,
    ),

    /** Useful when one debug snapshot explains multiple related failures. */
    actionFailuresDebugSnapshotIdx: index("action_failures_debug_snapshot_idx").on(
      table.debugSnapshotId,
    ),
  }),
);
