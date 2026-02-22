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
import { compensationLedgerEntries } from "./compensation";
import { locations } from "./locations";
import { offerVersions, offers } from "./offers";
import { paymentTransactions, settlementEntries } from "./payments";
import { queues } from "./queue";
import { resources } from "./resources";
import { serviceProducts } from "./service_products";
import { services } from "./services";
import { subjects } from "./subjects";
import { users } from "./users";
import { reviewQueueItems, workflowInstances } from "./workflows";
import {
  complianceRegimeEnum,
  dataSubjectRequestStatusEnum,
  dataSubjectRequestTypeEnum,
  dsrVerificationMethodEnum,
  legalHoldScopeEnum,
  legalHoldStatusEnum,
  lifecycleStatusEnum,
  piiSensitivityLevelEnum,
  policyBindingTargetTypeEnum,
  policyBreachDetectionSourceEnum,
  policyBreachStatusEnum,
  policyConsequenceStatusEnum,
  policyConsequenceTypeEnum,
  policyRuleAggregationModeEnum,
  policyRulePredicateTypeEnum,
  policyRuleSeverityEnum,
  privacyIdentityModeEnum,
  redactionJobStatusEnum,
  redactionTargetTypeEnum,
  residencyEnforcementModeEnum,
  residencyScopeEnum,
  retentionActionEnum,
  retentionIntervalUnitEnum,
} from "./enums";

/**
 * tenant_compliance_profiles
 *
 * ELI5:
 * This table is the "rulebook pack" a business says it follows.
 *
 * Example:
 * - a clinic may choose HIPAA profile,
 * - a school may choose FERPA profile,
 * - a marketplace may choose SOC2 + custom controls.
 *
 * Why this exists:
 * Instead of sprinkling compliance booleans across many tables, we centralize
 * the chosen regime and policy snapshots here, then reference this profile from
 * residency/retention/privacy workflows.
 *
 * Future improvement note:
 * If businesses need multiple active profiles by data domain, add
 * `tenant_compliance_profile_scopes` join table.
 */
export const tenantComplianceProfiles = pgTable(
  "tenant_compliance_profiles",
  {
    /** Stable primary key for profile row. */
    id: idWithTag("compliance_profile"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Human profile name (e.g., "US Healthcare Default"). */
    name: varchar("name", { length: 220 }).notNull(),

    /** Which legal/compliance regime this profile aligns with. */
    regime: complianceRegimeEnum("regime").notNull(),

    /** Optional operator-facing explanation of intended use. */
    description: text("description"),

    /**
     * True means this is the default profile for new records/policies.
     * Keep at most one default per tenant.
     */
    isDefault: boolean("is_default").default(false).notNull(),

    /** Active toggle. Inactive profiles remain for historical traceability. */
    isActive: boolean("is_active").default(true).notNull(),

    /**
     * Canonical policy snapshot JSON.
     * Example fields: allowed processors, encryption requirements, audit cadence.
     */
    policySnapshot: jsonb("policy_snapshot").default({}).notNull(),

    /**
     * Evidence expectations for audits.
     * Example fields: required artifacts, retention evidence cadence.
     */
    evidenceRequirements: jsonb("evidence_requirements").default({}),

    /**
     * Incident response policy for this profile.
     * Example: breach notification timelines and escalation channels.
     */
    incidentPolicy: jsonb("incident_policy").default({}),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite unique key used by tenant-safe policy children. */
    tenantComplianceProfilesBizIdIdUnique: uniqueIndex(
      "tenant_compliance_profiles_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** Common admin listing path. */
    tenantComplianceProfilesBizRegimeIdx: index(
      "tenant_compliance_profiles_biz_regime_idx",
    ).on(table.bizId, table.regime, table.isActive),

    /** One default profile per tenant keeps evaluation deterministic. */
    tenantComplianceProfilesSingleDefaultUnique: uniqueIndex(
      "tenant_compliance_profiles_single_default_unique",
    )
      .on(table.bizId)
      .where(sql`"is_default" = true AND "deleted_at" IS NULL`),
  }),
);

/**
 * data_residency_policies
 *
 * ELI5:
 * Data residency means "where data is allowed to physically live/process".
 *
 * Important terms:
 * - scope: how broad policy region is (global/region/country/custom)
 * - enforcement mode:
 *   - hard_block: reject writes that violate residency
 *   - soft_warn: allow but log warning
 *   - report_only: no blocking, only observability
 */
export const dataResidencyPolicies = pgTable(
  "data_residency_policies",
  {
    /** Stable primary key. */
    id: idWithTag("residency_policy"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Optional compliance profile this policy belongs to. */
    complianceProfileId: idRef("compliance_profile_id").references(
      () => tenantComplianceProfiles.id,
    ),

    /** Policy name in admin UI. */
    name: varchar("name", { length: 220 }).notNull(),

    /** Geographic scope category. */
    scope: residencyScopeEnum("scope").notNull(),

    /** Enforcement strictness mode. */
    enforcementMode: residencyEnforcementModeEnum("enforcement_mode")
      .default("hard_block")
      .notNull(),

    /** Allowed regions list (e.g., ["us-east", "eu-west"]). */
    allowedRegions: jsonb("allowed_regions").default([]).notNull(),

    /** Allowed countries list (e.g., ["US", "CA"]). */
    allowedCountries: jsonb("allowed_countries").default([]).notNull(),

    /** Denied regions list for explicit bans. */
    deniedRegions: jsonb("denied_regions").default([]).notNull(),

    /** Denied countries list for explicit bans. */
    deniedCountries: jsonb("denied_countries").default([]).notNull(),

    /**
     * Data classes this policy applies to.
     * Example: ["booking_order", "payment", "health_note"].
     */
    appliesTo: jsonb("applies_to").default([]).notNull(),

    /** Activation toggle. */
    isActive: boolean("is_active").default(true).notNull(),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite unique target for tenant-safe children. */
    dataResidencyPoliciesBizIdIdUnique: uniqueIndex(
      "data_residency_policies_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** Policy listing path. */
    dataResidencyPoliciesBizActiveIdx: index(
      "data_residency_policies_biz_active_idx",
    ).on(table.bizId, table.isActive),

    /** Tenant-safe FK to compliance profile. */
    dataResidencyPoliciesBizComplianceProfileFk: foreignKey({
      columns: [table.bizId, table.complianceProfileId],
      foreignColumns: [tenantComplianceProfiles.bizId, tenantComplianceProfiles.id],
      name: "data_residency_policies_biz_compliance_profile_fk",
    }),
  }),
);

/**
 * retention_policies
 *
 * ELI5:
 * Retention policy answers: "how long do we keep this data class and what do we
 * do when time is up?"
 *
 * Common actions:
 * - delete: remove data
 * - anonymize: keep record shape, remove personal identity
 * - archive: move to cold storage with limited access
 */
export const retentionPolicies = pgTable(
  "retention_policies",
  {
    /** Stable primary key. */
    id: idWithTag("retention_policy"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Optional profile anchor for grouped policy management. */
    complianceProfileId: idRef("compliance_profile_id").references(
      () => tenantComplianceProfiles.id,
    ),

    /** Policy name. */
    name: varchar("name", { length: 220 }).notNull(),

    /** Data class key this rule governs. */
    dataClass: varchar("data_class", { length: 140 }).notNull(),

    /** How much time to retain. */
    intervalValue: integer("interval_value"),

    /** Unit for retention interval. */
    intervalUnit: retentionIntervalUnitEnum("interval_unit").notNull(),

    /** Action taken when retention interval is reached. */
    action: retentionActionEnum("action").notNull(),

    /** Whether legal holds can block this policy's action. */
    honorLegalHolds: boolean("honor_legal_holds").default(true).notNull(),

    /** Optional minimum retention floor in days for safety. */
    minimumRetainDays: integer("minimum_retain_days"),

    /** Activation toggle. */
    isActive: boolean("is_active").default(true).notNull(),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite unique target for child enforcement jobs. */
    retentionPoliciesBizIdIdUnique: uniqueIndex(
      "retention_policies_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** Prevent duplicate active policy per data class. */
    retentionPoliciesDataClassUnique: uniqueIndex(
      "retention_policies_data_class_unique",
    )
      .on(table.bizId, table.dataClass)
      .where(sql`"is_active" = true AND "deleted_at" IS NULL`),

    /** Tenant-safe FK to compliance profile. */
    retentionPoliciesBizComplianceProfileFk: foreignKey({
      columns: [table.bizId, table.complianceProfileId],
      foreignColumns: [tenantComplianceProfiles.bizId, tenantComplianceProfiles.id],
      name: "retention_policies_biz_compliance_profile_fk",
    }),

    /** Retention numeric shape checks. */
    retentionPoliciesIntervalCheck: check(
      "retention_policies_interval_check",
      sql`
      (
        "interval_unit" = 'indefinite'
        AND "interval_value" IS NULL
      ) OR (
        "interval_unit" <> 'indefinite'
        AND "interval_value" IS NOT NULL
        AND "interval_value" > 0
      )
      `,
    ),

    /** Minimum retention bounds when provided. */
    retentionPoliciesMinimumRetainCheck: check(
      "retention_policies_minimum_retain_check",
      sql`"minimum_retain_days" IS NULL OR "minimum_retain_days" >= 0`,
    ),
  }),
);

/**
 * legal_holds
 *
 * ELI5:
 * Legal hold means "do not delete/anonymize this data yet" because of legal,
 * regulatory, or investigation requirements.
 */
export const legalHolds = pgTable(
  "legal_holds",
  {
    /** Stable primary key. */
    id: idWithTag("legal_hold"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** What class of object is held. */
    scope: legalHoldScopeEnum("scope").notNull(),

    /** Optional target record id for scoped hold. */
    targetRecordId: varchar("target_record_id", { length: 140 }),

    /** Legal hold lifecycle state. */
    status: legalHoldStatusEnum("status").default("active").notNull(),

    /** Who/what requested this hold (case id, regulator request, etc.). */
    sourceReference: varchar("source_reference", { length: 200 }),

    /** Human-readable reason for hold. */
    reason: text("reason").notNull(),

    /** Hold start time. */
    startsAt: timestamp("starts_at", { withTimezone: true }).defaultNow().notNull(),

    /** Optional hold release/expiry time. */
    endsAt: timestamp("ends_at", { withTimezone: true }),

    /** Optional user who approved/issued hold. */
    issuedByUserId: idRef("issued_by_user_id").references(() => users.id),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    legalHoldsBizIdIdUnique: uniqueIndex("legal_holds_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Composite unique key used by redaction jobs referencing holds. */

    /** Common active-hold query path for retention evaluators. */
    legalHoldsBizStatusStartsIdx: index("legal_holds_biz_status_starts_idx").on(
      table.bizId,
      table.status,
      table.startsAt,
    ),

    /** Hold windows must be ordered when end exists. */
    legalHoldsWindowCheck: check(
      "legal_holds_window_check",
      sql`"ends_at" IS NULL OR "ends_at" > "starts_at"`,
    ),
  }),
);

/**
 * privacy_identity_modes
 *
 * ELI5:
 * Privacy identity mode controls how much personally identifying information is
 * visible/accessible for a context (booking, review queue, etc.).
 *
 * Modes:
 * - full_identity: regular identifiable profile
 * - pseudonymous: masked identity but linkable internally
 * - anonymous: no direct identity shown
 * - sealed: identity hidden and only revealed under approved workflow
 */
export const privacyIdentityModes = pgTable(
  "privacy_identity_modes",
  {
    /** Stable primary key. */
    id: idWithTag("privacy_mode"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Human mode name. */
    name: varchar("name", { length: 180 }).notNull(),

    /** Stable slug for policy references. */
    slug: varchar("slug", { length: 120 }).notNull(),

    /** Identity mode semantics. */
    mode: privacyIdentityModeEnum("mode").notNull(),

    /**
     * Sensitivity level hint for tooling.
     * Helps UI and pipelines decide default masking strictness.
     */
    sensitivity: piiSensitivityLevelEnum("sensitivity").default("moderate").notNull(),

    /** Structured field masking policy by role/context. */
    maskingPolicy: jsonb("masking_policy").default({}).notNull(),

    /** Structured access workflow requirements for identity reveal. */
    accessPolicy: jsonb("access_policy").default({}).notNull(),

    /** One default mode can be used for newly-created sensitive records. */
    isDefault: boolean("is_default").default(false).notNull(),

    /** Activation toggle. */
    isActive: boolean("is_active").default(true).notNull(),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite unique key used by privacy-aware child tables. */
    privacyIdentityModesBizIdIdUnique: uniqueIndex(
      "privacy_identity_modes_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** Unique slug per tenant. */
    privacyIdentityModesBizSlugUnique: uniqueIndex(
      "privacy_identity_modes_biz_slug_unique",
    ).on(table.bizId, table.slug),

    /** One default privacy mode per tenant keeps behavior deterministic. */
    privacyIdentityModesSingleDefaultUnique: uniqueIndex(
      "privacy_identity_modes_single_default_unique",
    )
      .on(table.bizId)
      .where(sql`"is_default" = true AND "deleted_at" IS NULL`),
  }),
);

/**
 * data_subject_requests
 *
 * ELI5:
 * A data subject request (DSR) is when a person asks for rights over their
 * data (access, deletion, correction, etc.).
 *
 * Typical flow:
 * 1) request submitted,
 * 2) identity verified,
 * 3) request processed,
 * 4) fulfilled/denied with evidence trail.
 */
export const dataSubjectRequests = pgTable(
  "data_subject_requests",
  {
    /** Stable primary key. */
    id: idWithTag("dsr"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** DSR type. */
    requestType: dataSubjectRequestTypeEnum("request_type").notNull(),

    /** Request lifecycle state. */
    status: dataSubjectRequestStatusEnum("status").default("submitted").notNull(),

    /** Optional user record representing request subject. */
    subjectUserId: idRef("subject_user_id").references(() => users.id),

    /** External identifier for subject when no user row exists. */
    subjectExternalRef: varchar("subject_external_ref", { length: 200 }),

    /** Optional user that submitted request (can be agent/admin). */
    submittedByUserId: idRef("submitted_by_user_id").references(() => users.id),

    /** Verification method used before processing sensitive actions. */
    verificationMethod: dsrVerificationMethodEnum("verification_method"),

    /** When identity verification completed. */
    verifiedAt: timestamp("verified_at", { withTimezone: true }),

    /** SLA due date for completion. */
    dueAt: timestamp("due_at", { withTimezone: true }),

    /** Resolution timestamp. */
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),

    /** Optional reason when denied/cancelled. */
    resolutionSummary: text("resolution_summary"),

    /** Structured request payload (scope, documents, locale, etc.). */
    requestPayload: jsonb("request_payload").default({}).notNull(),

    /** Structured fulfillment evidence payload. */
    fulfillmentEvidence: jsonb("fulfillment_evidence").default({}),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite unique key used by redaction jobs. */
    dataSubjectRequestsBizIdIdUnique: uniqueIndex(
      "data_subject_requests_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** Common compliance operations query path. */
    dataSubjectRequestsBizStatusDueIdx: index(
      "data_subject_requests_biz_status_due_idx",
    ).on(table.bizId, table.status, table.dueAt),

    /** At least one subject pointer is required. */
    dataSubjectRequestsSubjectPointerCheck: check(
      "data_subject_requests_subject_pointer_check",
      sql`"subject_user_id" IS NOT NULL OR "subject_external_ref" IS NOT NULL`,
    ),

    /** Verification/resolution chronology sanity checks. */
    dataSubjectRequestsTimelineCheck: check(
      "data_subject_requests_timeline_check",
      sql`
      ("verified_at" IS NULL OR "resolved_at" IS NULL OR "resolved_at" >= "verified_at")
      `,
    ),
  }),
);

/**
 * redaction_jobs
 *
 * ELI5:
 * Redaction job is a tracked batch process that masks/removes sensitive data.
 *
 * Why separate table:
 * - data deletion/anonymization can be long-running,
 * - we need auditable progress/failure state,
 * - jobs must honor legal holds and retention policies.
 */
export const redactionJobs = pgTable(
  "redaction_jobs",
  {
    /** Stable primary key. */
    id: idWithTag("redaction_job"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Optional source DSR triggering this job. */
    dataSubjectRequestId: idRef("data_subject_request_id").references(
      () => dataSubjectRequests.id,
    ),

    /** Optional legal hold that blocked/deferred this job. */
    legalHoldId: idRef("legal_hold_id").references(() => legalHolds.id),

    /** Redaction target class. */
    targetType: redactionTargetTypeEnum("target_type").notNull(),

    /** Target record id or logical key. */
    targetRecordId: varchar("target_record_id", { length: 200 }).notNull(),

    /** Job status lifecycle. */
    status: redactionJobStatusEnum("status").default("queued").notNull(),

    /** Queued time. */
    queuedAt: timestamp("queued_at", { withTimezone: true }).defaultNow().notNull(),

    /** Start execution time. */
    startedAt: timestamp("started_at", { withTimezone: true }),

    /** Completion time. */
    completedAt: timestamp("completed_at", { withTimezone: true }),

    /** Failure reason details when status = failed. */
    failureReason: text("failure_reason"),

    /** Structured execution stats and step logs. */
    executionLog: jsonb("execution_log").default({}),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    redactionJobsBizIdIdUnique: uniqueIndex("redaction_jobs_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Common operations queue path. */
    redactionJobsBizStatusQueuedIdx: index("redaction_jobs_biz_status_queued_idx").on(
      table.bizId,
      table.status,
      table.queuedAt,
    ),

    /** Tenant-safe FK to source DSR. */
    redactionJobsBizDataSubjectRequestFk: foreignKey({
      columns: [table.bizId, table.dataSubjectRequestId],
      foreignColumns: [dataSubjectRequests.bizId, dataSubjectRequests.id],
      name: "redaction_jobs_biz_data_subject_request_fk",
    }),

    /** Tenant-safe FK to legal hold blocker. */
    redactionJobsBizLegalHoldFk: foreignKey({
      columns: [table.bizId, table.legalHoldId],
      foreignColumns: [legalHolds.bizId, legalHolds.id],
      name: "redaction_jobs_biz_legal_hold_fk",
    }),

    /** Start/completion ordering sanity checks. */
    redactionJobsTimelineCheck: check(
      "redaction_jobs_timeline_check",
      sql`"started_at" IS NULL OR "completed_at" IS NULL OR "completed_at" >= "started_at"`,
    ),
  }),
);

/**
 * policy_templates
 *
 * ELI5:
 * A policy template is a reusable rulebook.
 *
 * Why this exists:
 * - Businesses need configurable rulebooks (labor, safety, compliance, etc.)
 *   without hardcoding one industry's schema.
 * - A template can be versioned and bound to different targets.
 */
export const policyTemplates = pgTable(
  "policy_templates",
  {
    /** Stable primary key for one rulebook template version. */
    id: idWithTag("policy_template"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Human-friendly template name shown in admin tooling. */
    name: varchar("name", { length: 220 }).notNull(),

    /** Stable API/import slug (example: "union_local_52_core"). */
    slug: varchar("slug", { length: 140 }).notNull(),

    /** Shared lifecycle state for this template version. */
    status: lifecycleStatusEnum("status").default("draft").notNull(),

    /**
     * Generic classification key (example: labor, safety, qa, custom).
     * Kept text so platform/plugin ecosystems can define their own domains.
     */
    domainKey: varchar("domain_key", { length: 120 }).notNull(),

    /** Optional long description for maintainers/operators. */
    description: text("description"),

    /** Version number for immutable versioned rulebooks. */
    version: integer("version").default(1).notNull(),

    /** How active rules in this template are aggregated. */
    aggregationMode: policyRuleAggregationModeEnum("aggregation_mode")
      .default("all")
      .notNull(),

    /** Minimum passing rules when `aggregation_mode=threshold`. */
    minPassingRuleCount: integer("min_passing_rule_count"),

    /** Optional activation window start. */
    effectiveFromAt: timestamp("effective_from_at", { withTimezone: true }),

    /** Optional activation window end. */
    effectiveToAt: timestamp("effective_to_at", { withTimezone: true }),

    /**
     * Optional default marker for one domain.
     * Useful when new bindings are created via quick-start setup flows.
     */
    isDefault: boolean("is_default").default(false).notNull(),

    /**
     * Frozen policy snapshot at publish time.
     * This makes future incident/debug analysis deterministic.
     */
    policySnapshot: jsonb("policy_snapshot").default({}).notNull(),

    /** Evaluator knobs (sampling, grace behavior, exclusion windows). */
    evaluationPolicy: jsonb("evaluation_policy").default({}).notNull(),

    /** Default consequence knobs used when rule-level policy is absent. */
    consequencePolicy: jsonb("consequence_policy").default({}).notNull(),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    policyTemplatesBizIdIdUnique: uniqueIndex("policy_templates_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Composite unique key for tenant-safe FK references. */

    /** One slug+version per tenant keeps promotion/import deterministic. */
    policyTemplatesBizSlugVersionUnique: uniqueIndex(
      "policy_templates_biz_slug_version_unique",
    ).on(table.bizId, table.slug, table.version),

    /** Common list/filter path for operations and governance tooling. */
    policyTemplatesBizDomainStatusEffectiveIdx: index(
      "policy_templates_biz_domain_status_effective_idx",
    ).on(table.bizId, table.domainKey, table.status, table.effectiveFromAt),

    /** At most one active default template per domain per tenant. */
    policyTemplatesBizDomainDefaultUnique: uniqueIndex(
      "policy_templates_biz_domain_default_unique",
    )
      .on(table.bizId, table.domainKey)
      .where(sql`"is_default" = true AND "status" = 'active' AND "deleted_at" IS NULL`),

    /** Keep basic identifier/version shape deterministic. */
    policyTemplatesIdentityBoundsCheck: check(
      "policy_templates_identity_bounds_check",
      sql`
      length("slug") > 0
      AND length("domain_key") > 0
      AND "version" >= 1
      `,
    ),

    /** Threshold payload must match aggregation mode exactly. */
    policyTemplatesAggregationShapeCheck: check(
      "policy_templates_aggregation_shape_check",
      sql`
      (
        "aggregation_mode" IN ('all', 'any')
        AND "min_passing_rule_count" IS NULL
      ) OR (
        "aggregation_mode" = 'threshold'
        AND "min_passing_rule_count" IS NOT NULL
        AND "min_passing_rule_count" > 0
      )
      `,
    ),

    /** Effective window ordering check. */
    policyTemplatesEffectiveWindowCheck: check(
      "policy_templates_effective_window_check",
      sql`
      "effective_to_at" IS NULL
      OR "effective_from_at" IS NULL
      OR "effective_to_at" > "effective_from_at"
      `,
    ),
  }),
);

/**
 * policy_rules
 *
 * ELI5:
 * One row = one rule inside a policy template.
 *
 * Why this exists:
 * - rule definitions stay normalized (instead of one huge JSON blob),
 * - each rule can have severity, priority, and its own consequence knobs,
 * - breach ledgers can point to the exact violated rule.
 */
export const policyRules = pgTable(
  "policy_rules",
  {
    /** Stable primary key for one rule row. */
    id: idWithTag("policy_rule"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent policy template version. */
    policyTemplateId: idRef("policy_template_id")
      .references(() => policyTemplates.id)
      .notNull(),

    /** Stable per-template key for API/import mapping. */
    ruleKey: varchar("rule_key", { length: 140 }).notNull(),

    /** Human-facing rule title. */
    name: varchar("name", { length: 220 }).notNull(),

    /** Optional long explanation of rule intent. */
    description: text("description"),

    /** Rule lifecycle within a template version. */
    status: lifecycleStatusEnum("status").default("active").notNull(),

    /** Predicate family used by evaluator. */
    predicateType: policyRulePredicateTypeEnum("predicate_type").notNull(),

    /**
     * Generic expression payload:
     * used by expression/event-pattern evaluators.
     */
    conditionExpr: text("condition_expr"),

    /**
     * Metric payload:
     * used by threshold evaluators.
     */
    metricKey: varchar("metric_key", { length: 140 }),
    metricComparator: varchar("metric_comparator", { length: 8 }),
    metricThreshold: integer("metric_threshold"),

    /**
     * Structured schedule payload:
     * used by schedule-window evaluators.
     */
    scheduleWindow: jsonb("schedule_window"),

    /** Severity classification for triage/escalation behavior. */
    severity: policyRuleSeverityEnum("severity").default("medium").notNull(),

    /** Rule evaluation order (lower first if evaluator uses priority ordering). */
    priority: integer("priority").default(100).notNull(),

    /** If true, failure of this rule can block downstream workflow immediately. */
    isBlocking: boolean("is_blocking").default(true).notNull(),

    /** Runtime toggle to disable a rule without deleting history. */
    isEnabled: boolean("is_enabled").default(true).notNull(),

    /** Evidence requirements for proving pass/fail outcomes. */
    evidencePolicy: jsonb("evidence_policy").default({}).notNull(),

    /** Consequence policy overrides for this rule. */
    consequencePolicy: jsonb("consequence_policy").default({}).notNull(),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    policyRulesBizIdIdUnique: uniqueIndex("policy_rules_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Composite unique key for tenant-safe breach FK references. */

    /**
     * Composite unique key used to ensure rule->template coherence in breaches.
     * This lets breaches validate (template_id, rule_id) belongs together.
     */
    policyRulesBizTemplateIdIdUnique: uniqueIndex(
      "policy_rules_biz_template_id_id_unique",
    ).on(table.bizId, table.policyTemplateId, table.id),

    /** One stable rule key per template version. */
    policyRulesTemplateRuleKeyUnique: uniqueIndex("policy_rules_template_rule_key_unique").on(
      table.policyTemplateId,
      table.ruleKey,
    ),

    /** Common evaluator path by template + enabled + priority. */
    policyRulesBizTemplateEnabledPriorityIdx: index(
      "policy_rules_biz_template_enabled_priority_idx",
    ).on(table.bizId, table.policyTemplateId, table.isEnabled, table.priority),

    /** Severity dashboard path for governance operations. */
    policyRulesBizSeverityIdx: index("policy_rules_biz_severity_idx").on(
      table.bizId,
      table.severity,
      table.isEnabled,
    ),

    /** Tenant-safe FK to parent template. */
    policyRulesBizTemplateFk: foreignKey({
      columns: [table.bizId, table.policyTemplateId],
      foreignColumns: [policyTemplates.bizId, policyTemplates.id],
      name: "policy_rules_biz_template_fk",
    }),

    /** Rule key should never be empty, and priority must be non-negative. */
    policyRulesIdentityBoundsCheck: check(
      "policy_rules_identity_bounds_check",
      sql`
      length("rule_key") > 0
      AND "priority" >= 0
      `,
    ),

    /** Metric comparator vocabulary check when metric mode is used. */
    policyRulesMetricComparatorCheck: check(
      "policy_rules_metric_comparator_check",
      sql`
      "metric_comparator" IS NULL
      OR "metric_comparator" IN ('>', '>=', '<', '<=', '=', '!=')
      `,
    ),

    /** Predicate payload should match predicate type exactly. */
    policyRulesPredicateShapeCheck: check(
      "policy_rules_predicate_shape_check",
      sql`
      (
        "predicate_type" = 'expression'
        AND "condition_expr" IS NOT NULL
        AND "metric_key" IS NULL
        AND "metric_comparator" IS NULL
        AND "metric_threshold" IS NULL
        AND "schedule_window" IS NULL
      ) OR (
        "predicate_type" = 'metric_threshold'
        AND "condition_expr" IS NULL
        AND "metric_key" IS NOT NULL
        AND "metric_comparator" IS NOT NULL
        AND "metric_threshold" IS NOT NULL
        AND "schedule_window" IS NULL
      ) OR (
        "predicate_type" = 'schedule_window'
        AND "condition_expr" IS NULL
        AND "metric_key" IS NULL
        AND "metric_comparator" IS NULL
        AND "metric_threshold" IS NULL
        AND "schedule_window" IS NOT NULL
      ) OR (
        "predicate_type" = 'event_pattern'
        AND "condition_expr" IS NOT NULL
        AND "metric_key" IS NULL
        AND "metric_comparator" IS NULL
        AND "metric_threshold" IS NULL
        AND "schedule_window" IS NULL
      ) OR (
        "predicate_type" = 'custom'
      )
      `,
    ),
  }),
);

/**
 * policy_bindings
 *
 * ELI5:
 * A binding says where a policy template applies.
 *
 * Why this exists:
 * - one policy template can be reused across many targets,
 * - target scoping is explicit and queryable,
 * - this remains generic for core + plugin subject targets.
 */
export const policyBindings = pgTable(
  "policy_bindings",
  {
    /** Stable primary key for one binding row. */
    id: idWithTag("policy_binding"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Policy template bound by this row. */
    policyTemplateId: idRef("policy_template_id")
      .references(() => policyTemplates.id)
      .notNull(),

    /** Target class this binding applies to. */
    targetType: policyBindingTargetTypeEnum("target_type").notNull(),

    /** Typed target payloads (exactly one by target type). */
    locationId: idRef("location_id").references(() => locations.id),
    resourceId: idRef("resource_id").references(() => resources.id),
    serviceId: idRef("service_id").references(() => services.id),
    serviceProductId: idRef("service_product_id").references(() => serviceProducts.id),
    offerId: idRef("offer_id").references(() => offers.id),
    offerVersionId: idRef("offer_version_id").references(() => offerVersions.id),
    queueId: idRef("queue_id").references(() => queues.id),

    /** Extensible target payload for plugin/custom domains. */
    targetSubjectType: varchar("target_subject_type", { length: 80 }),
    targetSubjectId: varchar("target_subject_id", { length: 140 }),

    /** Resolver priority for cases where many bindings match one target. */
    priority: integer("priority").default(100).notNull(),

    /** Runtime toggle. */
    isActive: boolean("is_active").default(true).notNull(),

    /** Binding-level enforcement knobs. */
    enforcementPolicy: jsonb("enforcement_policy").default({}).notNull(),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    policyBindingsBizIdIdUnique: uniqueIndex("policy_bindings_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Composite unique key for tenant-safe breach FK references. */

    /**
     * Composite unique key used to ensure binding->template coherence in breaches.
     * This lets breaches validate (template_id, binding_id) belongs together.
     */
    policyBindingsBizTemplateIdIdUnique: uniqueIndex(
      "policy_bindings_biz_template_id_id_unique",
    ).on(table.bizId, table.policyTemplateId, table.id),

    /** Common resolver path by target scope. */
    policyBindingsBizTargetActivePriorityIdx: index(
      "policy_bindings_biz_target_active_priority_idx",
    ).on(table.bizId, table.targetType, table.isActive, table.priority),

    /** Common resolver path for one template. */
    policyBindingsBizTemplateActiveIdx: index("policy_bindings_biz_template_active_idx").on(
      table.bizId,
      table.policyTemplateId,
      table.isActive,
    ),

    /** Tenant-safe custom-subject lookup path. */
    policyBindingsBizSubjectIdx: index("policy_bindings_biz_subject_idx").on(
      table.bizId,
      table.targetSubjectType,
      table.targetSubjectId,
    ),

    /** One active biz-wide binding per template. */
    policyBindingsTemplateBizUnique: uniqueIndex("policy_bindings_template_biz_unique")
      .on(table.policyTemplateId, table.targetType)
      .where(sql`"target_type" = 'biz' AND "deleted_at" IS NULL`),

    /** One active location binding per template+location. */
    policyBindingsTemplateLocationUnique: uniqueIndex(
      "policy_bindings_template_location_unique",
    )
      .on(table.policyTemplateId, table.locationId)
      .where(sql`"target_type" = 'location' AND "deleted_at" IS NULL`),

    /** One active resource binding per template+resource. */
    policyBindingsTemplateResourceUnique: uniqueIndex(
      "policy_bindings_template_resource_unique",
    )
      .on(table.policyTemplateId, table.resourceId)
      .where(sql`"target_type" = 'resource' AND "deleted_at" IS NULL`),

    /** One active service binding per template+service. */
    policyBindingsTemplateServiceUnique: uniqueIndex("policy_bindings_template_service_unique")
      .on(table.policyTemplateId, table.serviceId)
      .where(sql`"target_type" = 'service' AND "deleted_at" IS NULL`),

    /** One active service-product binding per template+service product. */
    policyBindingsTemplateServiceProductUnique: uniqueIndex(
      "policy_bindings_template_service_product_unique",
    )
      .on(table.policyTemplateId, table.serviceProductId)
      .where(sql`"target_type" = 'service_product' AND "deleted_at" IS NULL`),

    /** One active offer binding per template+offer. */
    policyBindingsTemplateOfferUnique: uniqueIndex("policy_bindings_template_offer_unique")
      .on(table.policyTemplateId, table.offerId)
      .where(sql`"target_type" = 'offer' AND "deleted_at" IS NULL`),

    /** One active offer-version binding per template+offer version. */
    policyBindingsTemplateOfferVersionUnique: uniqueIndex(
      "policy_bindings_template_offer_version_unique",
    )
      .on(table.policyTemplateId, table.offerVersionId)
      .where(sql`"target_type" = 'offer_version' AND "deleted_at" IS NULL`),

    /** One active queue binding per template+queue. */
    policyBindingsTemplateQueueUnique: uniqueIndex("policy_bindings_template_queue_unique")
      .on(table.policyTemplateId, table.queueId)
      .where(sql`"target_type" = 'queue' AND "deleted_at" IS NULL`),

    /** One active subject binding per template+subject. */
    policyBindingsTemplateSubjectUnique: uniqueIndex("policy_bindings_template_subject_unique")
      .on(table.policyTemplateId, table.targetSubjectType, table.targetSubjectId)
      .where(sql`"target_type" = 'subject' AND "deleted_at" IS NULL`),

    /** Tenant-safe FK to parent template. */
    policyBindingsBizTemplateFk: foreignKey({
      columns: [table.bizId, table.policyTemplateId],
      foreignColumns: [policyTemplates.bizId, policyTemplates.id],
      name: "policy_bindings_biz_template_fk",
    }),

    /** Tenant-safe FKs for typed targets. */
    policyBindingsBizLocationFk: foreignKey({
      columns: [table.bizId, table.locationId],
      foreignColumns: [locations.bizId, locations.id],
      name: "policy_bindings_biz_location_fk",
    }),
    policyBindingsBizResourceFk: foreignKey({
      columns: [table.bizId, table.resourceId],
      foreignColumns: [resources.bizId, resources.id],
      name: "policy_bindings_biz_resource_fk",
    }),
    policyBindingsBizServiceFk: foreignKey({
      columns: [table.bizId, table.serviceId],
      foreignColumns: [services.bizId, services.id],
      name: "policy_bindings_biz_service_fk",
    }),
    policyBindingsBizServiceProductFk: foreignKey({
      columns: [table.bizId, table.serviceProductId],
      foreignColumns: [serviceProducts.bizId, serviceProducts.id],
      name: "policy_bindings_biz_service_product_fk",
    }),
    policyBindingsBizOfferFk: foreignKey({
      columns: [table.bizId, table.offerId],
      foreignColumns: [offers.bizId, offers.id],
      name: "policy_bindings_biz_offer_fk",
    }),
    policyBindingsBizOfferVersionFk: foreignKey({
      columns: [table.bizId, table.offerVersionId],
      foreignColumns: [offerVersions.bizId, offerVersions.id],
      name: "policy_bindings_biz_offer_version_fk",
    }),
    policyBindingsBizQueueFk: foreignKey({
      columns: [table.bizId, table.queueId],
      foreignColumns: [queues.bizId, queues.id],
      name: "policy_bindings_biz_queue_fk",
    }),
    policyBindingsBizSubjectFk: foreignKey({
      columns: [table.bizId, table.targetSubjectType, table.targetSubjectId],
      foreignColumns: [subjects.bizId, subjects.subjectType, subjects.subjectId],
      name: "policy_bindings_biz_subject_fk",
    }),

    /** Priority should be non-negative. */
    policyBindingsPriorityCheck: check(
      "policy_bindings_priority_check",
      sql`"priority" >= 0`,
    ),

    /** Target payload must match target type exactly. */
    policyBindingsTargetShapeCheck: check(
      "policy_bindings_target_shape_check",
      sql`
      (
        "target_type" = 'biz'
        AND "location_id" IS NULL
        AND "resource_id" IS NULL
        AND "service_id" IS NULL
        AND "service_product_id" IS NULL
        AND "offer_id" IS NULL
        AND "offer_version_id" IS NULL
        AND "queue_id" IS NULL
        AND "target_subject_type" IS NULL
        AND "target_subject_id" IS NULL
      ) OR (
        "target_type" = 'location'
        AND "location_id" IS NOT NULL
        AND "resource_id" IS NULL
        AND "service_id" IS NULL
        AND "service_product_id" IS NULL
        AND "offer_id" IS NULL
        AND "offer_version_id" IS NULL
        AND "queue_id" IS NULL
        AND "target_subject_type" IS NULL
        AND "target_subject_id" IS NULL
      ) OR (
        "target_type" = 'resource'
        AND "location_id" IS NULL
        AND "resource_id" IS NOT NULL
        AND "service_id" IS NULL
        AND "service_product_id" IS NULL
        AND "offer_id" IS NULL
        AND "offer_version_id" IS NULL
        AND "queue_id" IS NULL
        AND "target_subject_type" IS NULL
        AND "target_subject_id" IS NULL
      ) OR (
        "target_type" = 'service'
        AND "location_id" IS NULL
        AND "resource_id" IS NULL
        AND "service_id" IS NOT NULL
        AND "service_product_id" IS NULL
        AND "offer_id" IS NULL
        AND "offer_version_id" IS NULL
        AND "queue_id" IS NULL
        AND "target_subject_type" IS NULL
        AND "target_subject_id" IS NULL
      ) OR (
        "target_type" = 'service_product'
        AND "location_id" IS NULL
        AND "resource_id" IS NULL
        AND "service_id" IS NULL
        AND "service_product_id" IS NOT NULL
        AND "offer_id" IS NULL
        AND "offer_version_id" IS NULL
        AND "queue_id" IS NULL
        AND "target_subject_type" IS NULL
        AND "target_subject_id" IS NULL
      ) OR (
        "target_type" = 'offer'
        AND "location_id" IS NULL
        AND "resource_id" IS NULL
        AND "service_id" IS NULL
        AND "service_product_id" IS NULL
        AND "offer_id" IS NOT NULL
        AND "offer_version_id" IS NULL
        AND "queue_id" IS NULL
        AND "target_subject_type" IS NULL
        AND "target_subject_id" IS NULL
      ) OR (
        "target_type" = 'offer_version'
        AND "location_id" IS NULL
        AND "resource_id" IS NULL
        AND "service_id" IS NULL
        AND "service_product_id" IS NULL
        AND "offer_id" IS NULL
        AND "offer_version_id" IS NOT NULL
        AND "queue_id" IS NULL
        AND "target_subject_type" IS NULL
        AND "target_subject_id" IS NULL
      ) OR (
        "target_type" = 'queue'
        AND "location_id" IS NULL
        AND "resource_id" IS NULL
        AND "service_id" IS NULL
        AND "service_product_id" IS NULL
        AND "offer_id" IS NULL
        AND "offer_version_id" IS NULL
        AND "queue_id" IS NOT NULL
        AND "target_subject_type" IS NULL
        AND "target_subject_id" IS NULL
      ) OR (
        "target_type" = 'subject'
        AND "location_id" IS NULL
        AND "resource_id" IS NULL
        AND "service_id" IS NULL
        AND "service_product_id" IS NULL
        AND "offer_id" IS NULL
        AND "offer_version_id" IS NULL
        AND "queue_id" IS NULL
        AND "target_subject_type" IS NOT NULL
        AND "target_subject_id" IS NOT NULL
      )
      `,
    ),
  }),
);

/**
 * policy_breach_events
 *
 * ELI5:
 * One row = one concrete policy violation instance.
 *
 * Why this exists:
 * - makes rule failures auditable and replay-friendly,
 * - keeps "which rule failed on which target" explicit,
 * - provides source-of-truth for consequence ledgers.
 */
export const policyBreachEvents = pgTable(
  "policy_breach_events",
  {
    /** Stable primary key for one breach row. */
    id: idWithTag("policy_breach"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Policy template that produced this breach. */
    policyTemplateId: idRef("policy_template_id")
      .references(() => policyTemplates.id)
      .notNull(),

    /** Optional exact rule that triggered this breach. */
    policyRuleId: idRef("policy_rule_id").references(() => policyRules.id),

    /** Optional binding that scoped evaluation context. */
    policyBindingId: idRef("policy_binding_id").references(() => policyBindings.id),

    /** Breach lifecycle state. */
    status: policyBreachStatusEnum("status").default("open").notNull(),

    /** Detection origin (auto engine, manual review, import, plugin). */
    detectionSource: policyBreachDetectionSourceEnum("detection_source")
      .default("auto_engine")
      .notNull(),

    /** Severity snapshot at detection time. */
    severity: policyRuleSeverityEnum("severity").default("medium").notNull(),

    /** Target identity that violated/experienced the policy. */
    targetSubjectType: varchar("target_subject_type", { length: 80 }).notNull(),
    targetSubjectId: varchar("target_subject_id", { length: 140 }).notNull(),

    /** Detection timestamp. */
    occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),

    /** Optional lifecycle timestamps for resolution workflow. */
    acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    waivedAt: timestamp("waived_at", { withTimezone: true }),
    dismissedAt: timestamp("dismissed_at", { withTimezone: true }),

    /** Optional measured and threshold values captured for explainability. */
    measuredValue: integer("measured_value"),
    thresholdValue: integer("threshold_value"),

    /** Optional short classifier code for analytics/alert routing. */
    breachCode: varchar("breach_code", { length: 120 }),

    /** Optional human-readable summary. */
    summary: text("summary"),

    /** Structured evidence payload. */
    evidence: jsonb("evidence").default({}).notNull(),

    /** Context snapshot captured at detection time. */
    contextSnapshot: jsonb("context_snapshot").default({}).notNull(),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    policyBreachEventsBizIdIdUnique: uniqueIndex("policy_breach_events_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Composite unique key used by consequence FK references. */

    /** Main operational path for open/in-review breach inboxes. */
    policyBreachEventsBizStatusOccurredIdx: index(
      "policy_breach_events_biz_status_occurred_idx",
    ).on(table.bizId, table.status, table.occurredAt),

    /** Template-level breach reporting path. */
    policyBreachEventsBizTemplateOccurredIdx: index(
      "policy_breach_events_biz_template_occurred_idx",
    ).on(table.bizId, table.policyTemplateId, table.occurredAt),

    /** Target-level forensic path. */
    policyBreachEventsBizTargetOccurredIdx: index(
      "policy_breach_events_biz_target_occurred_idx",
    ).on(table.bizId, table.targetSubjectType, table.targetSubjectId, table.occurredAt),

    /** Tenant-safe FK to template. */
    policyBreachEventsBizTemplateFk: foreignKey({
      columns: [table.bizId, table.policyTemplateId],
      foreignColumns: [policyTemplates.bizId, policyTemplates.id],
      name: "policy_breach_events_biz_template_fk",
    }),

    /**
     * Tenant-safe/coherent FK to rule under template.
     * Prevents linking a rule from another template.
     */
    policyBreachEventsBizTemplateRuleFk: foreignKey({
      columns: [table.bizId, table.policyTemplateId, table.policyRuleId],
      foreignColumns: [policyRules.bizId, policyRules.policyTemplateId, policyRules.id],
      name: "policy_breach_events_biz_template_rule_fk",
    }),

    /**
     * Tenant-safe/coherent FK to binding under template.
     * Prevents linking a binding from another template.
     */
    policyBreachEventsBizTemplateBindingFk: foreignKey({
      columns: [table.bizId, table.policyTemplateId, table.policyBindingId],
      foreignColumns: [
        policyBindings.bizId,
        policyBindings.policyTemplateId,
        policyBindings.id,
      ],
      name: "policy_breach_events_biz_template_binding_fk",
    }),

    /** Tenant-safe FK to target subject identity. */
    policyBreachEventsBizTargetSubjectFk: foreignKey({
      columns: [table.bizId, table.targetSubjectType, table.targetSubjectId],
      foreignColumns: [subjects.bizId, subjects.subjectType, subjects.subjectId],
      name: "policy_breach_events_biz_target_subject_fk",
    }),

    /** Keep status and terminal timestamps consistent. */
    policyBreachEventsStatusShapeCheck: check(
      "policy_breach_events_status_shape_check",
      sql`
      (
        "status" = 'open'
        AND "acknowledged_at" IS NULL
        AND "resolved_at" IS NULL
        AND "waived_at" IS NULL
        AND "dismissed_at" IS NULL
      ) OR (
        "status" = 'acknowledged'
        AND "acknowledged_at" IS NOT NULL
        AND "resolved_at" IS NULL
        AND "waived_at" IS NULL
        AND "dismissed_at" IS NULL
      ) OR (
        "status" = 'in_review'
        AND "acknowledged_at" IS NOT NULL
        AND "resolved_at" IS NULL
        AND "waived_at" IS NULL
        AND "dismissed_at" IS NULL
      ) OR (
        "status" = 'resolved'
        AND "resolved_at" IS NOT NULL
        AND "waived_at" IS NULL
        AND "dismissed_at" IS NULL
      ) OR (
        "status" = 'waived'
        AND "waived_at" IS NOT NULL
        AND "dismissed_at" IS NULL
      ) OR (
        "status" = 'dismissed'
        AND "dismissed_at" IS NOT NULL
      )
      `,
    ),

    /** Lifecycle timestamp ordering sanity checks. */
    policyBreachEventsTimelineCheck: check(
      "policy_breach_events_timeline_check",
      sql`
      ("acknowledged_at" IS NULL OR "acknowledged_at" >= "occurred_at")
      AND ("resolved_at" IS NULL OR "resolved_at" >= "occurred_at")
      AND ("waived_at" IS NULL OR "waived_at" >= "occurred_at")
      AND ("dismissed_at" IS NULL OR "dismissed_at" >= "occurred_at")
      `,
    ),
  }),
);

/**
 * policy_consequence_events
 *
 * ELI5:
 * One row = one outcome emitted because of a breach.
 *
 * Why this exists:
 * - provides a generic penalty/remediation ledger,
 * - supports monetary and non-monetary consequences,
 * - links to finance/workflow artifacts for full traceability.
 */
export const policyConsequenceEvents = pgTable(
  "policy_consequence_events",
  {
    /** Stable primary key for one consequence event row. */
    id: idWithTag("policy_consequence"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent breach that triggered this consequence. */
    policyBreachEventId: idRef("policy_breach_event_id")
      .references(() => policyBreachEvents.id)
      .notNull(),

    /** Consequence classification. */
    consequenceType: policyConsequenceTypeEnum("consequence_type").notNull(),

    /** Consequence lifecycle. */
    status: policyConsequenceStatusEnum("status").default("planned").notNull(),

    /** Planned timestamp (set on creation by default). */
    plannedAt: timestamp("planned_at", { withTimezone: true }).defaultNow().notNull(),

    /** Optional lifecycle timestamps. */
    appliedAt: timestamp("applied_at", { withTimezone: true }),
    failedAt: timestamp("failed_at", { withTimezone: true }),
    revertedAt: timestamp("reverted_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),

    /** Optional signed amount for monetary consequences. */
    amountMinor: integer("amount_minor"),

    /** Currency for monetary consequences. */
    currency: varchar("currency", { length: 3 }).default("USD").notNull(),

    /** Optional actor that executed or changed this consequence. */
    actorUserId: idRef("actor_user_id").references(() => users.id),

    /** Optional financial/workflow artifact links for traceability. */
    compensationLedgerEntryId: idRef("compensation_ledger_entry_id").references(
      () => compensationLedgerEntries.id,
    ),
    paymentTransactionId: idRef("payment_transaction_id").references(
      () => paymentTransactions.id,
    ),
    settlementEntryId: idRef("settlement_entry_id").references(() => settlementEntries.id),
    workflowInstanceId: idRef("workflow_instance_id").references(() => workflowInstances.id),
    reviewQueueItemId: idRef("review_queue_item_id").references(() => reviewQueueItems.id),

    /** Structured outcome details and execution metadata. */
    details: jsonb("details").default({}).notNull(),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite unique key for tenant-safe downstream references. */
    policyConsequenceEventsBizIdIdUnique: uniqueIndex(
      "policy_consequence_events_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** Main queue path for execution workers. */
    policyConsequenceEventsBizStatusPlannedIdx: index(
      "policy_consequence_events_biz_status_planned_idx",
    ).on(table.bizId, table.status, table.plannedAt),

    /** Breach expansion path for explainability timelines. */
    policyConsequenceEventsBizBreachIdx: index("policy_consequence_events_biz_breach_idx").on(
      table.bizId,
      table.policyBreachEventId,
      table.plannedAt,
    ),

    /** Type analytics/reporting path. */
    policyConsequenceEventsBizTypeStatusIdx: index(
      "policy_consequence_events_biz_type_status_idx",
    ).on(table.bizId, table.consequenceType, table.status),

    /** Tenant-safe FK to breach. */
    policyConsequenceEventsBizBreachFk: foreignKey({
      columns: [table.bizId, table.policyBreachEventId],
      foreignColumns: [policyBreachEvents.bizId, policyBreachEvents.id],
      name: "policy_consequence_events_biz_breach_fk",
    }),

    /** Tenant-safe FK to optional compensation ledger row. */
    policyConsequenceEventsBizCompensationLedgerFk: foreignKey({
      columns: [table.bizId, table.compensationLedgerEntryId],
      foreignColumns: [compensationLedgerEntries.bizId, compensationLedgerEntries.id],
      name: "policy_consequence_events_biz_compensation_ledger_fk",
    }),

    /** Tenant-safe FK to optional payment transaction row. */
    policyConsequenceEventsBizPaymentTransactionFk: foreignKey({
      columns: [table.bizId, table.paymentTransactionId],
      foreignColumns: [paymentTransactions.bizId, paymentTransactions.id],
      name: "policy_consequence_events_biz_payment_transaction_fk",
    }),

    /** Tenant-safe FK to optional settlement entry row. */
    policyConsequenceEventsBizSettlementEntryFk: foreignKey({
      columns: [table.bizId, table.settlementEntryId],
      foreignColumns: [settlementEntries.bizId, settlementEntries.id],
      name: "policy_consequence_events_biz_settlement_entry_fk",
    }),

    /** Tenant-safe FK to optional workflow instance row. */
    policyConsequenceEventsBizWorkflowInstanceFk: foreignKey({
      columns: [table.bizId, table.workflowInstanceId],
      foreignColumns: [workflowInstances.bizId, workflowInstances.id],
      name: "policy_consequence_events_biz_workflow_instance_fk",
    }),

    /** Tenant-safe FK to optional review queue item row. */
    policyConsequenceEventsBizReviewQueueItemFk: foreignKey({
      columns: [table.bizId, table.reviewQueueItemId],
      foreignColumns: [reviewQueueItems.bizId, reviewQueueItems.id],
      name: "policy_consequence_events_biz_review_queue_item_fk",
    }),

    /** Monetary value should be meaningful and currency should be valid. */
    policyConsequenceEventsAmountAndCurrencyCheck: check(
      "policy_consequence_events_amount_and_currency_check",
      sql`
      ("amount_minor" IS NULL OR "amount_minor" <> 0)
      AND "currency" ~ '^[A-Z]{3}$'
      `,
    ),

    /** Keep status and lifecycle timestamps aligned. */
    policyConsequenceEventsStatusShapeCheck: check(
      "policy_consequence_events_status_shape_check",
      sql`
      (
        "status" = 'planned'
        AND "applied_at" IS NULL
        AND "failed_at" IS NULL
        AND "reverted_at" IS NULL
        AND "cancelled_at" IS NULL
      ) OR (
        "status" = 'applied'
        AND "applied_at" IS NOT NULL
        AND "failed_at" IS NULL
        AND "cancelled_at" IS NULL
      ) OR (
        "status" = 'failed'
        AND "failed_at" IS NOT NULL
        AND "applied_at" IS NULL
        AND "reverted_at" IS NULL
        AND "cancelled_at" IS NULL
      ) OR (
        "status" = 'reverted'
        AND "applied_at" IS NOT NULL
        AND "reverted_at" IS NOT NULL
        AND "failed_at" IS NULL
        AND "cancelled_at" IS NULL
      ) OR (
        "status" = 'cancelled'
        AND "cancelled_at" IS NOT NULL
        AND "applied_at" IS NULL
        AND "failed_at" IS NULL
        AND "reverted_at" IS NULL
      )
      `,
    ),

    /** Timestamp ordering sanity checks. */
    policyConsequenceEventsTimelineCheck: check(
      "policy_consequence_events_timeline_check",
      sql`
      ("applied_at" IS NULL OR "applied_at" >= "planned_at")
      AND ("failed_at" IS NULL OR "failed_at" >= "planned_at")
      AND ("cancelled_at" IS NULL OR "cancelled_at" >= "planned_at")
      AND ("reverted_at" IS NULL OR ("applied_at" IS NOT NULL AND "reverted_at" >= "applied_at"))
      `,
    ),

    /** Consequence payload should be meaningful for each consequence family. */
    policyConsequenceEventsTypeShapeCheck: check(
      "policy_consequence_events_type_shape_check",
      sql`
      (
        "consequence_type" = 'queue_review'
        AND "review_queue_item_id" IS NOT NULL
      ) OR (
        "consequence_type" = 'workflow_trigger'
        AND "workflow_instance_id" IS NOT NULL
      ) OR (
        "consequence_type" = 'compensation_adjustment'
        AND ("compensation_ledger_entry_id" IS NOT NULL OR "amount_minor" IS NOT NULL)
      ) OR (
        "consequence_type" IN ('payment_adjustment', 'credit', 'debit')
        AND (
          "payment_transaction_id" IS NOT NULL
          OR "settlement_entry_id" IS NOT NULL
          OR "amount_minor" IS NOT NULL
        )
      ) OR (
        "consequence_type" IN ('warning', 'cooldown', 'suspension', 'custom')
      )
      `,
    ),
  }),
);
