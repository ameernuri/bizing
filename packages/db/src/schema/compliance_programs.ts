import { sql } from "drizzle-orm";
import { check, foreignKey, index, uniqueIndex } from "drizzle-orm/pg-core";
import {
  boolean,
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
  complianceCheckStatusEnum,
  complianceControlStatusEnum,
  complianceEvidenceStatusEnum,
  complianceProgramModeEnum,
  complianceRegimeEnum,
  extensionScopeEnum,
  lifecycleStatusEnum,
} from "./enums";
import { tenantComplianceProfiles } from "./governance";
import { locations } from "./locations";
import { subjects } from "./subjects";
import { users } from "./users";

/**
 * compliance_program_enrollments
 *
 * ELI5:
 * This is the explicit opt-in switchboard for compliance frameworks.
 *
 * Why it matters:
 * - Non-regulated tenants can stay simple (`mode=off` or no row at all).
 * - Regulated tenants can turn on monitor/enforced modes per scope.
 * - HIPAA/SOC2/etc can share one rollout/control-plane model.
 */
export const complianceProgramEnrollments = pgTable(
  "compliance_program_enrollments",
  {
    /** Stable primary key. */
    id: idWithTag("compliance_program"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Compliance regime this enrollment represents. */
    regime: complianceRegimeEnum("regime").notNull(),

    /**
     * Optional profile anchor from governance domain.
     * Useful when enrollment references a policy pack snapshot.
     */
    complianceProfileId: idRef("compliance_profile_id").references(
      () => tenantComplianceProfiles.id,
    ),

    /** Human-friendly enrollment name (for admin dashboards). */
    name: varchar("name", { length: 220 }).notNull(),

    /** Lifecycle status (draft/active/inactive/archived). */
    status: lifecycleStatusEnum("status").default("draft").notNull(),

    /**
     * Activation mode:
     * - off: disabled
     * - monitor: observe/report only
     * - enforced: hard guardrails expected
     */
    mode: complianceProgramModeEnum("mode").default("monitor").notNull(),

    /**
     * Scope where this enrollment applies.
     * We reuse extension scope semantics for consistency:
     * - biz
     * - location
     * - custom_subject
     */
    scope: extensionScopeEnum("scope").default("biz").notNull(),

    /** Deterministic scope key for read-model joins and cache keys. */
    scopeRefKey: varchar("scope_ref_key", { length: 300 }).notNull(),

    /** Optional location pointer when scope=location. */
    locationId: idRef("location_id").references(() => locations.id),

    /** Optional subject pointer when scope=custom_subject. */
    subjectRefType: varchar("subject_ref_type", { length: 80 }),
    subjectRefId: idRef("subject_ref_id"),

    /** Optional rollout start timestamp. */
    effectiveFrom: timestamp("effective_from", { withTimezone: true }),

    /** Optional rollout end timestamp. */
    effectiveTo: timestamp("effective_to", { withTimezone: true }),

    /** Shared control toggles used by API guardrails/read models. */
    requiresAuditLogging: boolean("requires_audit_logging").default(false).notNull(),
    requiresDataResidencyEnforcement: boolean("requires_data_residency_enforcement")
      .default(false)
      .notNull(),
    requiresEncryptionAtRest: boolean("requires_encryption_at_rest")
      .default(false)
      .notNull(),

    /** Regime-specific policy details and rollout overrides. */
    controlPolicy: jsonb("control_policy").default({}).notNull(),

    /** Extensible payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite key for tenant-safe control rows. */
    complianceProgramEnrollmentsBizIdIdUnique: uniqueIndex(
      "compliance_program_enrollments_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** One active enrollment per regime+scope key keeps evaluation deterministic. */
    complianceProgramEnrollmentsActiveUnique: uniqueIndex(
      "compliance_program_enrollments_active_unique",
    )
      .on(table.bizId, table.regime, table.scopeRefKey)
      .where(sql`"status" = 'active' AND "deleted_at" IS NULL`),

    /** Common runtime lookup path. */
    complianceProgramEnrollmentsBizRegimeModeIdx: index(
      "compliance_program_enrollments_biz_regime_mode_idx",
    ).on(table.bizId, table.regime, table.mode, table.status),

    /** Tenant-safe FK to governance profile. */
    complianceProgramEnrollmentsBizProfileFk: foreignKey({
      columns: [table.bizId, table.complianceProfileId],
      foreignColumns: [tenantComplianceProfiles.bizId, tenantComplianceProfiles.id],
      name: "compliance_program_enrollments_biz_profile_fk",
    }),

    /** Tenant-safe FK to location scope. */
    complianceProgramEnrollmentsBizLocationFk: foreignKey({
      columns: [table.bizId, table.locationId],
      foreignColumns: [locations.bizId, locations.id],
      name: "compliance_program_enrollments_biz_location_fk",
    }),

    /** Tenant-safe FK to custom subject scope. */
    complianceProgramEnrollmentsBizSubjectFk: foreignKey({
      columns: [table.bizId, table.subjectRefType, table.subjectRefId],
      foreignColumns: [subjects.bizId, subjects.subjectType, subjects.subjectId],
      name: "compliance_program_enrollments_biz_subject_fk",
    }),

    /** Scope payload must match scope mode exactly. */
    complianceProgramEnrollmentsScopeShapeCheck: check(
      "compliance_program_enrollments_scope_shape_check",
      sql`
      (
        "scope" = 'biz'
        AND "location_id" IS NULL
        AND "subject_ref_type" IS NULL
        AND "subject_ref_id" IS NULL
        AND "scope_ref_key" = 'biz'
      ) OR (
        "scope" = 'location'
        AND "location_id" IS NOT NULL
        AND "subject_ref_type" IS NULL
        AND "subject_ref_id" IS NULL
        AND "scope_ref_key" = ('location:' || "location_id")
      ) OR (
        "scope" = 'custom_subject'
        AND "location_id" IS NULL
        AND "subject_ref_type" IS NOT NULL
        AND "subject_ref_id" IS NOT NULL
        AND "scope_ref_key" = ('subject:' || "subject_ref_type" || ':' || "subject_ref_id")
      )
      `,
    ),

    /** Timeline sanity check. */
    complianceProgramEnrollmentsTimelineCheck: check(
      "compliance_program_enrollments_timeline_check",
      sql`
      "effective_from" IS NULL
      OR "effective_to" IS NULL
      OR "effective_to" >= "effective_from"
      `,
    ),
  }),
);

/**
 * compliance_control_implementations
 *
 * ELI5:
 * One row = one concrete control implementation under a program enrollment.
 *
 * Example controls:
 * - "PHI access must be logged"
 * - "admin actions require MFA"
 * - "retain audit logs for N days"
 */
export const complianceControlImplementations = pgTable(
  "compliance_control_implementations",
  {
    /** Stable primary key. */
    id: idWithTag("compliance_control"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent opt-in enrollment. */
    complianceProgramEnrollmentId: idRef("compliance_program_enrollment_id")
      .references(() => complianceProgramEnrollments.id)
      .notNull(),

    /** Stable control key (example: hipaa.164.312.b.audit_controls). */
    controlKey: varchar("control_key", { length: 200 }).notNull(),

    /** Control family for grouped reporting. */
    controlFamily: varchar("control_family", { length: 120 }).notNull(),

    /** Human title. */
    title: varchar("title", { length: 260 }).notNull(),

    /** Optional detailed explanation. */
    description: text("description"),

    /** Source regime this control originates from. */
    sourceRegime: complianceRegimeEnum("source_regime").notNull(),

    /** Implementation status. */
    status: complianceControlStatusEnum("status").default("not_started").notNull(),

    /**
     * Implementation style:
     * manual, automated, hybrid, policy, workflow, etc.
     * Kept open-text to avoid rigid strategy taxonomies.
     */
    implementationType: varchar("implementation_type", { length: 80 })
      .default("policy")
      .notNull(),

    /** Optional owner subject for accountability. */
    ownerSubjectBizId: idRef("owner_subject_biz_id").references(() => bizes.id),
    ownerSubjectType: varchar("owner_subject_type", { length: 80 }),
    ownerSubjectId: idRef("owner_subject_id"),

    /** Optional due date for target implementation. */
    dueAt: timestamp("due_at", { withTimezone: true }),

    /** Validation completion timestamp. */
    validatedAt: timestamp("validated_at", { withTimezone: true }),

    /** Automated/manual validation policy. */
    validationPolicy: jsonb("validation_policy").default({}).notNull(),

    /** Evidence expectations for this control. */
    evidencePolicy: jsonb("evidence_policy").default({}).notNull(),

    /** Automation/check runner policy (cron, thresholds, integrations). */
    automationPolicy: jsonb("automation_policy").default({}).notNull(),

    /** Extensible payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite key for tenant-safe evidence/check child rows. */
    complianceControlImplementationsBizIdIdUnique: uniqueIndex(
      "compliance_control_implementations_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** One control key per enrollment avoids duplicate state rows. */
    complianceControlImplementationsUnique: uniqueIndex(
      "compliance_control_implementations_unique",
    ).on(table.complianceProgramEnrollmentId, table.controlKey),

    /** Main operations path by status and due date. */
    complianceControlImplementationsBizStatusDueIdx: index(
      "compliance_control_implementations_biz_status_due_idx",
    ).on(table.bizId, table.status, table.dueAt),

    /** Tenant-safe FK to enrollment. */
    complianceControlImplementationsBizEnrollmentFk: foreignKey({
      columns: [table.bizId, table.complianceProgramEnrollmentId],
      foreignColumns: [complianceProgramEnrollments.bizId, complianceProgramEnrollments.id],
      name: "compliance_control_implementations_biz_enrollment_fk",
    }),

    /** Tenant-safe FK to owner subject. */
    complianceControlImplementationsOwnerSubjectFk: foreignKey({
      columns: [table.ownerSubjectBizId, table.ownerSubjectType, table.ownerSubjectId],
      foreignColumns: [subjects.bizId, subjects.subjectType, subjects.subjectId],
      name: "compliance_control_implementations_owner_subject_fk",
    }),

    /** Owner pointer should be fully-null or fully-populated. */
    complianceControlImplementationsOwnerPairCheck: check(
      "compliance_control_implementations_owner_pair_check",
      sql`
      (
        "owner_subject_biz_id" IS NULL
        AND "owner_subject_type" IS NULL
        AND "owner_subject_id" IS NULL
      ) OR (
        "owner_subject_biz_id" IS NOT NULL
        AND "owner_subject_type" IS NOT NULL
        AND "owner_subject_id" IS NOT NULL
      )
      `,
    ),
  }),
);

/**
 * compliance_control_evidence
 *
 * ELI5:
 * Artifacts proving a control is implemented and operating.
 */
export const complianceControlEvidence = pgTable(
  "compliance_control_evidence",
  {
    /** Stable primary key. */
    id: idWithTag("compliance_evidence"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent control implementation. */
    complianceControlImplementationId: idRef("compliance_control_implementation_id")
      .references(() => complianceControlImplementations.id)
      .notNull(),

    /** Evidence class (document, report, log-export, screenshot, etc.). */
    evidenceType: varchar("evidence_type", { length: 80 }).notNull(),

    /** Storage/document-system reference key/URL. */
    artifactRef: varchar("artifact_ref", { length: 600 }).notNull(),

    /** Capture timestamp. */
    capturedAt: timestamp("captured_at", { withTimezone: true }).defaultNow().notNull(),

    /** Optional expiration timestamp. */
    expiresAt: timestamp("expires_at", { withTimezone: true }),

    /** Verification status. */
    status: complianceEvidenceStatusEnum("status").default("pending").notNull(),

    /** Optional verifier subject pointer. */
    verifiedBySubjectBizId: idRef("verified_by_subject_biz_id").references(
      () => bizes.id,
    ),
    verifiedBySubjectType: varchar("verified_by_subject_type", { length: 80 }),
    verifiedBySubjectId: idRef("verified_by_subject_id"),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),

    /** Optional verifier/operator summary. */
    summary: text("summary"),

    /** Structured detail payload. */
    payload: jsonb("payload").default({}).notNull(),

    /** Extensible payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    complianceControlEvidenceBizIdIdUnique: uniqueIndex(
      "compliance_control_evidence_biz_id_id_unique",
    ).on(table.bizId, table.id),

    complianceControlEvidenceBizStatusCapturedIdx: index(
      "compliance_control_evidence_biz_status_captured_idx",
    ).on(table.bizId, table.status, table.capturedAt),

    /** Tenant-safe FK to parent control implementation. */
    complianceControlEvidenceBizControlFk: foreignKey({
      columns: [table.bizId, table.complianceControlImplementationId],
      foreignColumns: [complianceControlImplementations.bizId, complianceControlImplementations.id],
      name: "compliance_control_evidence_biz_control_fk",
    }),

    /** Tenant-safe FK to verifier subject. */
    complianceControlEvidenceVerifierSubjectFk: foreignKey({
      columns: [table.verifiedBySubjectBizId, table.verifiedBySubjectType, table.verifiedBySubjectId],
      foreignColumns: [subjects.bizId, subjects.subjectType, subjects.subjectId],
      name: "compliance_control_evidence_verifier_subject_fk",
    }),

    /** Verifier pointer should be fully-null or fully-populated. */
    complianceControlEvidenceVerifierPairCheck: check(
      "compliance_control_evidence_verifier_pair_check",
      sql`
      (
        "verified_by_subject_biz_id" IS NULL
        AND "verified_by_subject_type" IS NULL
        AND "verified_by_subject_id" IS NULL
        AND "verified_at" IS NULL
      ) OR (
        "verified_by_subject_biz_id" IS NOT NULL
        AND "verified_by_subject_type" IS NOT NULL
        AND "verified_by_subject_id" IS NOT NULL
      )
      `,
    ),

    /** Timeline sanity check. */
    complianceControlEvidenceTimelineCheck: check(
      "compliance_control_evidence_timeline_check",
      sql`
      ("expires_at" IS NULL OR "expires_at" >= "captured_at")
      AND ("verified_at" IS NULL OR "verified_at" >= "captured_at")
      `,
    ),
  }),
);

/**
 * compliance_control_checks
 *
 * ELI5:
 * Executions of automated/manual checks for one control.
 */
export const complianceControlChecks = pgTable(
  "compliance_control_checks",
  {
    /** Stable primary key. */
    id: idWithTag("compliance_check"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent control implementation. */
    complianceControlImplementationId: idRef("compliance_control_implementation_id")
      .references(() => complianceControlImplementations.id)
      .notNull(),

    /** Stable check key per control (example: daily-phi-audit-log-check). */
    checkKey: varchar("check_key", { length: 160 }).notNull(),

    /** Check lifecycle result status. */
    status: complianceCheckStatusEnum("status").default("queued").notNull(),

    /** Source class (system, integration, agent, manual). */
    runSource: varchar("run_source", { length: 80 }).default("system").notNull(),

    /** Start/end timestamps. */
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),

    /** Optional normalized score (0..100). */
    scorePercent: integer("score_percent"),

    /** Structured findings payload. */
    findings: jsonb("findings").default({}).notNull(),

    /** Optional error summary for failed/error runs. */
    errorSummary: text("error_summary"),

    /** Extensible payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    complianceControlChecksBizIdIdUnique: uniqueIndex(
      "compliance_control_checks_biz_id_id_unique",
    ).on(table.bizId, table.id),

    complianceControlChecksBizStatusStartedIdx: index(
      "compliance_control_checks_biz_status_started_idx",
    ).on(table.bizId, table.status, table.startedAt),

    complianceControlChecksBizControlCheckKeyIdx: index(
      "compliance_control_checks_biz_control_check_key_idx",
    ).on(table.bizId, table.complianceControlImplementationId, table.checkKey, table.startedAt),

    /** Tenant-safe FK to parent control. */
    complianceControlChecksBizControlFk: foreignKey({
      columns: [table.bizId, table.complianceControlImplementationId],
      foreignColumns: [complianceControlImplementations.bizId, complianceControlImplementations.id],
      name: "compliance_control_checks_biz_control_fk",
    }),

    /** Timeline/score sanity checks. */
    complianceControlChecksBoundsCheck: check(
      "compliance_control_checks_bounds_check",
      sql`
      ("started_at" IS NULL OR "completed_at" IS NULL OR "completed_at" >= "started_at")
      AND ("score_percent" IS NULL OR ("score_percent" >= 0 AND "score_percent" <= 100))
      `,
    ),
  }),
);
