import { sql } from "drizzle-orm";
import { check, foreignKey, index, uniqueIndex } from "drizzle-orm/pg-core";
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { idRef, idWithTag, withAuditRefs } from "./_common";
import { bizes } from "./bizes";
import {
  lifecycleStatusEnum,
  requirementEdgeTypeEnum,
  requirementEvaluationStatusEnum,
  requirementEvidenceTypeEnum,
  requirementNodeTypeEnum,
  requirementSetEvaluationModeEnum,
  requirementSetStatusEnum,
} from "./enums";
import { subjects } from "./subjects";
import { users } from "./users";

/**
 * requirement_sets
 *
 * ELI5:
 * A requirement set is a reusable "rulebook graph" that says what must be
 * satisfied before something is allowed/unlocked.
 *
 * Why this exists:
 * - prerequisite gating appears in many domains (education, compliance,
 *   onboarding, entitlement unlocks),
 * - one shared set model avoids hardcoding separate gate tables per domain.
 */
export const requirementSets = pgTable(
  "requirement_sets",
  {
    /** Stable primary key for one requirement set definition. */
    id: idWithTag("requirement_set"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Human-readable set name. */
    name: varchar("name", { length: 220 }).notNull(),

    /** Stable slug used by API/import flows. */
    slug: varchar("slug", { length: 140 }).notNull(),

    /** Optional plain-language description. */
    description: varchar("description", { length: 2000 }),

    /** Definition lifecycle status. */
    status: requirementSetStatusEnum("status").default("draft").notNull(),

    /** How node results combine to produce pass/fail outcome. */
    evaluationMode: requirementSetEvaluationModeEnum("evaluation_mode")
      .default("all")
      .notNull(),

    /** Threshold mode minimum satisfied-node count. */
    minSatisfiedCount: integer("min_satisfied_count"),

    /** Threshold mode minimum percent score (0..100). */
    passThresholdPercent: integer("pass_threshold_percent"),

    /** Monotonic version for auditable definition evolution. */
    version: integer("version").default(1).notNull(),

    /** Immutable policy snapshot for evaluator behavior controls. */
    policySnapshot: jsonb("policy_snapshot").default({}).notNull(),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    requirementSetsBizIdIdUnique: uniqueIndex("requirement_sets_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Composite key for tenant-safe child references. */

    /** One slug per tenant. */
    requirementSetsBizSlugUnique: uniqueIndex("requirement_sets_biz_slug_unique").on(
      table.bizId,
      table.slug,
    ),

    /** Listing path for active/inactive set definitions. */
    requirementSetsBizStatusIdx: index("requirement_sets_biz_status_idx").on(
      table.bizId,
      table.status,
    ),

    /** Threshold and version sanity checks. */
    requirementSetsBoundsCheck: check(
      "requirement_sets_bounds_check",
      sql`
      "version" > 0
      AND ("min_satisfied_count" IS NULL OR "min_satisfied_count" >= 0)
      AND (
        "pass_threshold_percent" IS NULL
        OR ("pass_threshold_percent" >= 0 AND "pass_threshold_percent" <= 100)
      )
      `,
    ),

    /** Threshold config should match evaluation mode exactly. */
    requirementSetsEvaluationShapeCheck: check(
      "requirement_sets_evaluation_shape_check",
      sql`
      (
        "evaluation_mode" IN ('all', 'any')
        AND "min_satisfied_count" IS NULL
        AND "pass_threshold_percent" IS NULL
      ) OR (
        "evaluation_mode" = 'threshold'
        AND ("min_satisfied_count" IS NOT NULL OR "pass_threshold_percent" IS NOT NULL)
      )
      `,
    ),
  }),
);

/**
 * requirement_nodes
 *
 * ELI5:
 * One node is one check or milestone inside a requirement set.
 *
 * Node behavior is intentionally generic:
 * - `predicate`: evaluate data/policy condition,
 * - `group`: aggregate child semantics,
 * - `milestone`/`manual`/`custom`: domain-specific gates via payload.
 */
export const requirementNodes = pgTable(
  "requirement_nodes",
  {
    /** Stable primary key for one requirement node. */
    id: idWithTag("requirement_node"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent requirement set. */
    requirementSetId: idRef("requirement_set_id")
      .references(() => requirementSets.id)
      .notNull(),

    /** Stable key for this node in one set. */
    nodeKey: varchar("node_key", { length: 140 }).notNull(),

    /** Human-readable node name. */
    name: varchar("name", { length: 220 }).notNull(),

    /** Node behavior class. */
    nodeType: requirementNodeTypeEnum("node_type").notNull(),

    /** Node lifecycle. */
    status: lifecycleStatusEnum("status").default("active").notNull(),

    /** Optional plain-language description. */
    description: varchar("description", { length: 2000 }),

    /** Sort order for deterministic UI/evaluator processing. */
    sortOrder: integer("sort_order").default(100).notNull(),

    /** Relative node weight used by weighted evaluators. */
    weight: integer("weight").default(1).notNull(),

    /** If true, failing this node should block pass outcome. */
    isBlocking: boolean("is_blocking").default(true).notNull(),

    /**
     * Predicate evaluator key for `node_type=predicate`.
     *
     * Example keys:
     * - `has_completed_module`
     * - `has_min_score`
     * - `has_active_membership_tier`
     */
    predicateType: varchar("predicate_type", { length: 140 }),

    /** Structured predicate/node configuration payload. */
    predicateConfig: jsonb("predicate_config").default({}).notNull(),

    /** Optional target subject namespace this node evaluates against. */
    targetSubjectType: varchar("target_subject_type", { length: 80 }),

    /** Optional target subject id this node evaluates against. */
    targetSubjectId: varchar("target_subject_id", { length: 140 }),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    requirementNodesBizIdIdUnique: uniqueIndex("requirement_nodes_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Composite key for tenant-safe node foreign keys. */

    /** Composite key for tenant-safe edge/evidence joins. */
    requirementNodesBizSetIdIdUnique: uniqueIndex(
      "requirement_nodes_biz_set_id_id_unique",
    ).on(table.bizId, table.requirementSetId, table.id),

    /** One node key per set. */
    requirementNodesSetNodeKeyUnique: uniqueIndex(
      "requirement_nodes_set_node_key_unique",
    ).on(table.requirementSetId, table.nodeKey),

    /** Common graph expansion path for one set. */
    requirementNodesBizSetSortIdx: index("requirement_nodes_biz_set_sort_idx").on(
      table.bizId,
      table.requirementSetId,
      table.sortOrder,
    ),

    /** Target-subject reverse lookup path. */
    requirementNodesBizTargetSubjectIdx: index(
      "requirement_nodes_biz_target_subject_idx",
    ).on(table.bizId, table.targetSubjectType, table.targetSubjectId),

    /** Tenant-safe FK to parent set. */
    requirementNodesBizSetFk: foreignKey({
      columns: [table.bizId, table.requirementSetId],
      foreignColumns: [requirementSets.bizId, requirementSets.id],
      name: "requirement_nodes_biz_set_fk",
    }),

    /** Tenant-safe FK to optional target subject pointer. */
    requirementNodesBizTargetSubjectFk: foreignKey({
      columns: [table.bizId, table.targetSubjectType, table.targetSubjectId],
      foreignColumns: [subjects.bizId, subjects.subjectType, subjects.subjectId],
      name: "requirement_nodes_biz_target_subject_fk",
    }),

    /** Target subject pointer should be fully null or fully populated. */
    requirementNodesTargetSubjectPairCheck: check(
      "requirement_nodes_target_subject_pair_check",
      sql`
      (
        "target_subject_type" IS NULL
        AND "target_subject_id" IS NULL
      ) OR (
        "target_subject_type" IS NOT NULL
        AND "target_subject_id" IS NOT NULL
      )
      `,
    ),

    /** Sort/weight bounds and predicate shape checks. */
    requirementNodesBoundsAndShapeCheck: check(
      "requirement_nodes_bounds_and_shape_check",
      sql`
      "sort_order" >= 0
      AND "weight" > 0
      AND (
        "node_type" <> 'predicate'
        OR "predicate_type" IS NOT NULL
      )
      `,
    ),
  }),
);

/**
 * requirement_edges
 *
 * ELI5:
 * A directed line between two nodes in one requirement set.
 *
 * This models dependency and unlock flows without hardcoding per-domain graphs.
 */
export const requirementEdges = pgTable(
  "requirement_edges",
  {
    /** Stable primary key for one graph edge. */
    id: idWithTag("requirement_edge"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent requirement set that owns this edge. */
    requirementSetId: idRef("requirement_set_id")
      .references(() => requirementSets.id)
      .notNull(),

    /** Upstream/source node id. */
    fromNodeId: idRef("from_node_id")
      .references(() => requirementNodes.id)
      .notNull(),

    /** Downstream/target node id. */
    toNodeId: idRef("to_node_id")
      .references(() => requirementNodes.id)
      .notNull(),

    /** Edge semantic class. */
    edgeType: requirementEdgeTypeEnum("edge_type").default("depends_on").notNull(),

    /** If true, this edge is mandatory in evaluation logic. */
    isRequired: boolean("is_required").default(true).notNull(),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    requirementEdgesBizIdIdUnique: uniqueIndex("requirement_edges_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Prevent duplicate edge rows in one set. */
    requirementEdgesSetEdgeUnique: uniqueIndex("requirement_edges_set_edge_unique")
      .on(table.requirementSetId, table.fromNodeId, table.toNodeId, table.edgeType)
      .where(sql`"deleted_at" IS NULL`),

    /** Outbound traversal path. */
    requirementEdgesBizSetFromIdx: index("requirement_edges_biz_set_from_idx").on(
      table.bizId,
      table.requirementSetId,
      table.fromNodeId,
    ),

    /** Inbound traversal path. */
    requirementEdgesBizSetToIdx: index("requirement_edges_biz_set_to_idx").on(
      table.bizId,
      table.requirementSetId,
      table.toNodeId,
    ),

    /** Tenant-safe FK to parent set. */
    requirementEdgesBizSetFk: foreignKey({
      columns: [table.bizId, table.requirementSetId],
      foreignColumns: [requirementSets.bizId, requirementSets.id],
      name: "requirement_edges_biz_set_fk",
    }),

    /**
     * Tenant-safe FK to source node with set-id anchoring.
     *
     * This ensures source node belongs to the same requirement set as edge row.
     */
    requirementEdgesBizSetFromNodeFk: foreignKey({
      columns: [table.bizId, table.requirementSetId, table.fromNodeId],
      foreignColumns: [
        requirementNodes.bizId,
        requirementNodes.requirementSetId,
        requirementNodes.id,
      ],
      name: "requirement_edges_biz_set_from_node_fk",
    }),

    /**
     * Tenant-safe FK to target node with set-id anchoring.
     *
     * This prevents cross-set edge corruption.
     */
    requirementEdgesBizSetToNodeFk: foreignKey({
      columns: [table.bizId, table.requirementSetId, table.toNodeId],
      foreignColumns: [
        requirementNodes.bizId,
        requirementNodes.requirementSetId,
        requirementNodes.id,
      ],
      name: "requirement_edges_biz_set_to_node_fk",
    }),

    /** Prevent self-loop edges and keep graph semantics valid. */
    requirementEdgesNoSelfLoopCheck: check(
      "requirement_edges_no_self_loop_check",
      sql`"from_node_id" <> "to_node_id"`,
    ),
  }),
);

/**
 * requirement_evaluations
 *
 * ELI5:
 * One row = one runtime evaluation attempt for one subject against one
 * requirement set.
 *
 * This is the auditable history of gating decisions.
 */
export const requirementEvaluations = pgTable(
  "requirement_evaluations",
  {
    /** Stable primary key for one evaluation run. */
    id: idWithTag("requirement_eval"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Requirement set being evaluated. */
    requirementSetId: idRef("requirement_set_id")
      .references(() => requirementSets.id)
      .notNull(),

    /** Evaluated subject namespace (learner/customer/account/custom entity). */
    evaluatedSubjectType: varchar("evaluated_subject_type", { length: 80 }).notNull(),

    /** Evaluated subject id. */
    evaluatedSubjectId: varchar("evaluated_subject_id", { length: 140 }).notNull(),

    /** Optional context subject namespace (target object being unlocked). */
    contextSubjectType: varchar("context_subject_type", { length: 80 }),

    /** Optional context subject id. */
    contextSubjectId: varchar("context_subject_id", { length: 140 }),

    /** Runtime evaluation lifecycle state. */
    status: requirementEvaluationStatusEnum("status").default("pending").notNull(),

    /** Evaluation start timestamp. */
    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),

    /** Evaluation completion/decision timestamp. */
    evaluatedAt: timestamp("evaluated_at", { withTimezone: true }),

    /** Optional expiry timestamp for stale decisions. */
    expiresAt: timestamp("expires_at", { withTimezone: true }),

    /** Total node count considered in this run snapshot. */
    totalNodeCount: integer("total_node_count").default(0).notNull(),

    /** Satisfied node count in this run snapshot. */
    satisfiedNodeCount: integer("satisfied_node_count").default(0).notNull(),

    /** Optional score percent (0..100). */
    scorePercent: integer("score_percent"),

    /** Optional idempotency key for deterministic evaluator retries. */
    requestKey: varchar("request_key", { length: 140 }),

    /** Result details snapshot. */
    resultSnapshot: jsonb("result_snapshot").default({}).notNull(),

    /** Policy snapshot copied from definition/evaluator at runtime. */
    policySnapshot: jsonb("policy_snapshot").default({}).notNull(),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite key for tenant-safe evidence foreign keys. */
    requirementEvaluationsBizIdIdUnique: uniqueIndex(
      "requirement_evaluations_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** Idempotency dedupe path for evaluators. */
    requirementEvaluationsBizRequestKeyUnique: uniqueIndex(
      "requirement_evaluations_biz_request_key_unique",
    )
      .on(table.bizId, table.requestKey)
      .where(sql`"request_key" IS NOT NULL`),

    /** Main board path by set/status/time. */
    requirementEvaluationsBizSetStatusStartedIdx: index(
      "requirement_evaluations_biz_set_status_started_idx",
    ).on(table.bizId, table.requirementSetId, table.status, table.startedAt),

    /** Subject-history path. */
    requirementEvaluationsBizSubjectStartedIdx: index(
      "requirement_evaluations_biz_subject_started_idx",
    ).on(table.bizId, table.evaluatedSubjectType, table.evaluatedSubjectId, table.startedAt),

    /** Tenant-safe FK to requirement set. */
    requirementEvaluationsBizSetFk: foreignKey({
      columns: [table.bizId, table.requirementSetId],
      foreignColumns: [requirementSets.bizId, requirementSets.id],
      name: "requirement_evaluations_biz_set_fk",
    }),

    /** Tenant-safe FK to evaluated subject. */
    requirementEvaluationsBizEvaluatedSubjectFk: foreignKey({
      columns: [table.bizId, table.evaluatedSubjectType, table.evaluatedSubjectId],
      foreignColumns: [subjects.bizId, subjects.subjectType, subjects.subjectId],
      name: "requirement_evaluations_biz_evaluated_subject_fk",
    }),

    /** Tenant-safe FK to optional context subject. */
    requirementEvaluationsBizContextSubjectFk: foreignKey({
      columns: [table.bizId, table.contextSubjectType, table.contextSubjectId],
      foreignColumns: [subjects.bizId, subjects.subjectType, subjects.subjectId],
      name: "requirement_evaluations_biz_context_subject_fk",
    }),

    /** Context subject pointer should be fully null or fully populated. */
    requirementEvaluationsContextSubjectPairCheck: check(
      "requirement_evaluations_context_subject_pair_check",
      sql`
      (
        "context_subject_type" IS NULL
        AND "context_subject_id" IS NULL
      ) OR (
        "context_subject_type" IS NOT NULL
        AND "context_subject_id" IS NOT NULL
      )
      `,
    ),

    /** Counts/score/timeline invariants. */
    requirementEvaluationsBoundsAndTimelineCheck: check(
      "requirement_evaluations_bounds_and_timeline_check",
      sql`
      "total_node_count" >= 0
      AND "satisfied_node_count" >= 0
      AND "satisfied_node_count" <= "total_node_count"
      AND (
        "score_percent" IS NULL
        OR ("score_percent" >= 0 AND "score_percent" <= 100)
      )
      AND ("evaluated_at" IS NULL OR "evaluated_at" >= "started_at")
      AND ("expires_at" IS NULL OR "expires_at" >= "started_at")
      `,
    ),

    /** Terminal statuses should carry evaluated timestamp. */
    requirementEvaluationsStatusShapeCheck: check(
      "requirement_evaluations_status_shape_check",
      sql`
      ("status" IN ('pending', 'in_progress') OR "evaluated_at" IS NOT NULL)
      `,
    ),
  }),
);

/**
 * requirement_evidence_links
 *
 * ELI5:
 * Evidence rows explain "why" an evaluation passed/failed/blocked.
 *
 * This table is deliberately generic so many domains can attach proof without
 * changing schema each time.
 */
export const requirementEvidenceLinks = pgTable(
  "requirement_evidence_links",
  {
    /** Stable primary key for one evidence link row. */
    id: idWithTag("requirement_evidence"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent evaluation record. */
    requirementEvaluationId: idRef("requirement_evaluation_id")
      .references(() => requirementEvaluations.id)
      .notNull(),

    /** Optional node pointer evidence is attached to. */
    requirementNodeId: idRef("requirement_node_id").references(() => requirementNodes.id),

    /** Evidence source class. */
    evidenceType: requirementEvidenceTypeEnum("evidence_type").notNull(),

    /** Subject evidence namespace (for evidence_type=subject). */
    subjectType: varchar("subject_type", { length: 80 }),

    /** Subject evidence id. */
    subjectId: varchar("subject_id", { length: 140 }),

    /** External reference family (for evidence_type=external_reference). */
    externalReferenceType: varchar("external_reference_type", { length: 80 }),

    /** External reference id (for evidence_type=external_reference). */
    externalReferenceId: varchar("external_reference_id", { length: 180 }),

    /** Generic artifact family key (for evidence_type=artifact). */
    artifactType: varchar("artifact_type", { length: 120 }),

    /** Generic artifact id/value (for evidence_type=artifact). */
    artifactId: varchar("artifact_id", { length: 180 }),

    /** Generic event family key (for evidence_type=event). */
    eventType: varchar("event_type", { length: 120 }),

    /** Generic event id/value (for evidence_type=event). */
    eventId: varchar("event_id", { length: 180 }),

    /** Optional occurrence time for evidence artifact/event. */
    occurredAt: timestamp("occurred_at", { withTimezone: true }),

    /** Structured evidence details. */
    details: jsonb("details").default({}).notNull(),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    requirementEvidenceLinksBizIdIdUnique: uniqueIndex("requirement_evidence_links_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Parent evaluation evidence timeline path. */
    requirementEvidenceLinksBizEvaluationIdx: index(
      "requirement_evidence_links_biz_evaluation_idx",
    ).on(table.bizId, table.requirementEvaluationId, table.occurredAt),

    /** Node-level evidence lookup path. */
    requirementEvidenceLinksBizNodeIdx: index("requirement_evidence_links_biz_node_idx").on(
      table.bizId,
      table.requirementNodeId,
      table.evidenceType,
    ),

    /** Tenant-safe FK to parent evaluation. */
    requirementEvidenceLinksBizEvaluationFk: foreignKey({
      columns: [table.bizId, table.requirementEvaluationId],
      foreignColumns: [requirementEvaluations.bizId, requirementEvaluations.id],
      name: "requirement_evidence_links_biz_evaluation_fk",
    }),

    /** Tenant-safe FK to optional requirement node. */
    requirementEvidenceLinksBizNodeFk: foreignKey({
      columns: [table.bizId, table.requirementNodeId],
      foreignColumns: [requirementNodes.bizId, requirementNodes.id],
      name: "requirement_evidence_links_biz_node_fk",
    }),

    /** Tenant-safe FK to optional subject evidence pointer. */
    requirementEvidenceLinksBizSubjectFk: foreignKey({
      columns: [table.bizId, table.subjectType, table.subjectId],
      foreignColumns: [subjects.bizId, subjects.subjectType, subjects.subjectId],
      name: "requirement_evidence_links_biz_subject_fk",
    }),

    /** Subject evidence pointer should be fully null or fully populated. */
    requirementEvidenceLinksSubjectPairCheck: check(
      "requirement_evidence_links_subject_pair_check",
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

    /** External reference pointer should be fully null or fully populated. */
    requirementEvidenceLinksExternalPairCheck: check(
      "requirement_evidence_links_external_pair_check",
      sql`
      (
        "external_reference_type" IS NULL
        AND "external_reference_id" IS NULL
      ) OR (
        "external_reference_type" IS NOT NULL
        AND "external_reference_id" IS NOT NULL
      )
      `,
    ),

    /** Artifact pointer should be fully null or fully populated. */
    requirementEvidenceLinksArtifactPairCheck: check(
      "requirement_evidence_links_artifact_pair_check",
      sql`
      (
        "artifact_type" IS NULL
        AND "artifact_id" IS NULL
      ) OR (
        "artifact_type" IS NOT NULL
        AND "artifact_id" IS NOT NULL
      )
      `,
    ),

    /** Event pointer should be fully null or fully populated. */
    requirementEvidenceLinksEventPairCheck: check(
      "requirement_evidence_links_event_pair_check",
      sql`
      (
        "event_type" IS NULL
        AND "event_id" IS NULL
      ) OR (
        "event_type" IS NOT NULL
        AND "event_id" IS NOT NULL
      )
      `,
    ),

    /** Evidence payload shape should match evidence_type exactly. */
    requirementEvidenceLinksShapeCheck: check(
      "requirement_evidence_links_shape_check",
      sql`
      (
        "evidence_type" = 'subject'
        AND "subject_type" IS NOT NULL
        AND "subject_id" IS NOT NULL
        AND "external_reference_type" IS NULL
        AND "external_reference_id" IS NULL
        AND "artifact_type" IS NULL
        AND "artifact_id" IS NULL
        AND "event_type" IS NULL
        AND "event_id" IS NULL
      ) OR (
        "evidence_type" = 'external_reference'
        AND "subject_type" IS NULL
        AND "subject_id" IS NULL
        AND "external_reference_type" IS NOT NULL
        AND "external_reference_id" IS NOT NULL
        AND "artifact_type" IS NULL
        AND "artifact_id" IS NULL
        AND "event_type" IS NULL
        AND "event_id" IS NULL
      ) OR (
        "evidence_type" = 'artifact'
        AND "subject_type" IS NULL
        AND "subject_id" IS NULL
        AND "external_reference_type" IS NULL
        AND "external_reference_id" IS NULL
        AND "artifact_type" IS NOT NULL
        AND "artifact_id" IS NOT NULL
        AND "event_type" IS NULL
        AND "event_id" IS NULL
      ) OR (
        "evidence_type" = 'event'
        AND "subject_type" IS NULL
        AND "subject_id" IS NULL
        AND "external_reference_type" IS NULL
        AND "external_reference_id" IS NULL
        AND "artifact_type" IS NULL
        AND "artifact_id" IS NULL
        AND "event_type" IS NOT NULL
        AND "event_id" IS NOT NULL
      )
      `,
    ),
  }),
);

export type RequirementSet = typeof requirementSets.$inferSelect;
export type NewRequirementSet = typeof requirementSets.$inferInsert;
export type RequirementNode = typeof requirementNodes.$inferSelect;
export type NewRequirementNode = typeof requirementNodes.$inferInsert;
export type RequirementEdge = typeof requirementEdges.$inferSelect;
export type NewRequirementEdge = typeof requirementEdges.$inferInsert;
export type RequirementEvaluation = typeof requirementEvaluations.$inferSelect;
export type NewRequirementEvaluation = typeof requirementEvaluations.$inferInsert;
export type RequirementEvidenceLink = typeof requirementEvidenceLinks.$inferSelect;
export type NewRequirementEvidenceLink = typeof requirementEvidenceLinks.$inferInsert;
