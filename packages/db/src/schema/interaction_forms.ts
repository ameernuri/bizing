import { sql } from "drizzle-orm";
import { check, foreignKey, index, uniqueIndex } from "drizzle-orm/pg-core";
import {
  AnyPgColumn,
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
import { groupAccounts } from "./group_accounts";
import { locations } from "./locations";
import { users } from "./users";
import {
  customFieldTargetTypeEnum,
  interactionArtifactTypeEnum,
  interactionAssignmentStatusEnum,
  interactionRequirementModeEnum,
  interactionSubmissionStatusEnum,
  interactionTemplateTypeEnum,
  lifecycleStatusEnum,
  requirementItemStatusEnum,
  requirementItemTypeEnum,
  signatureMethodEnum,
  signatureSignerRoleEnum,
} from "./enums";
import { offers, offerVersions } from "./offers";
import { serviceProducts } from "./service_products";
import { services } from "./services";
import { bizExtensionInstalls } from "./extensions";
import { bizConfigValues } from "./biz_configs";

/**
 * interaction_templates
 *
 * ELI5:
 * This table stores reusable "fill/sign/complete this" templates.
 *
 * One template family can model:
 * - intake forms
 * - waivers/release forms
 * - survey-like questionnaires
 * - checklist-like interaction flows
 *
 * Why template versioning exists:
 * - legal/compliance records need immutable "what text/rules were used"
 * - future edits should create new versions, not mutate historical meaning.
 */
export const interactionTemplates = pgTable(
  "interaction_templates",
  {
    /** Stable primary key for one immutable template version. */
    id: idWithTag("interaction_template"),

    /** Tenant boundary for template ownership and resolution. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /**
     * Optional extension owner.
     * Null means first-party/native template.
     */
    bizExtensionInstallId: idRef("biz_extension_install_id").references(
      () => bizExtensionInstalls.id,
    ),

    /** Broad template family (intake/waiver/checklist/survey/etc.). */
    templateType: interactionTemplateTypeEnum("template_type").notNull(),
    /**
     * Optional biz-config dictionary value for template-family vocabulary.
     */
    templateTypeConfigValueId: idRef("template_type_config_value_id").references(
      () => bizConfigValues.id,
    ),

    /** Human-readable template name shown in admin tooling. */
    name: varchar("name", { length: 220 }).notNull(),

    /** Stable machine slug for APIs/import/export and version grouping. */
    slug: varchar("slug", { length: 140 }).notNull(),

    /**
     * Immutable version number within `(biz_id, slug)`.
     * New edits should produce a new version.
     */
    version: integer("version").default(1).notNull(),

    /** Lifecycle status for this version. */
    status: lifecycleStatusEnum("status").default("draft").notNull(),
    /**
     * Optional biz-config dictionary value for template status wording.
     */
    statusConfigValueId: idRef("status_config_value_id").references(
      () => bizConfigValues.id,
    ),

    /** Indicates this version is the currently selected default for the slug. */
    isCurrent: boolean("is_current").default(false).notNull(),

    /** Optional title rendered to end users. */
    title: varchar("title", { length: 300 }),

    /** Optional explanatory content shown before form/checklist completion. */
    description: text("description"),

    /**
     * JSON schema/layout/rules for rendering the interaction.
     * Kept JSON to remain extensible for new field types and flow controls.
     */
    schema: jsonb("schema").default({}).notNull(),

    /**
     * Validation policy (required groups, regex patterns, dependency rules).
     * This decouples validation semantics from API implementation details.
     */
    validationPolicy: jsonb("validation_policy").default({}).notNull(),

    /** Whether at least one signature record is required before completion. */
    requiresSignature: boolean("requires_signature").default(false).notNull(),

    /**
     * Whether this template can be reused across many records.
     * Some legal templates might be one-off snapshots.
     */
    isReusable: boolean("is_reusable").default(true).notNull(),

    /** Optional business window when this template version is considered valid. */
    effectiveFrom: timestamp("effective_from", { withTimezone: true }),

    /** Optional end of validity window for this template version. */
    effectiveTo: timestamp("effective_to", { withTimezone: true }),

    /** Extension payload for implementation-specific, non-indexed attributes. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata for template governance and legal traceability. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite key for tenant-safe child references. */
    interactionTemplatesBizIdIdUnique: uniqueIndex(
      "interaction_templates_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** One immutable version per slug/version tuple. */
    interactionTemplatesBizSlugVersionUnique: uniqueIndex(
      "interaction_templates_biz_slug_version_unique",
    ).on(table.bizId, table.slug, table.version),

    /** Exactly one "current" template version per slug. */
    interactionTemplatesBizSlugCurrentUnique: uniqueIndex(
      "interaction_templates_biz_slug_current_unique",
    )
      .on(table.bizId, table.slug)
      .where(sql`"is_current" = true`),

    /** Common template picker/listing path. */
    interactionTemplatesBizTypeStatusIdx: index(
      "interaction_templates_biz_type_status_idx",
    ).on(table.bizId, table.templateType, table.status, table.isCurrent),
    interactionTemplatesBizTemplateTypeConfigIdx: index(
      "interaction_templates_biz_template_type_config_idx",
    ).on(table.bizId, table.templateTypeConfigValueId),
    interactionTemplatesBizStatusConfigIdx: index(
      "interaction_templates_biz_status_config_idx",
    ).on(table.bizId, table.statusConfigValueId),

    /** Tenant-safe FK to optional extension owner. */
    interactionTemplatesBizInstallFk: foreignKey({
      columns: [table.bizId, table.bizExtensionInstallId],
      foreignColumns: [bizExtensionInstalls.bizId, bizExtensionInstalls.id],
      name: "interaction_templates_biz_install_fk",
    }),
    /** Tenant-safe FK to optional configurable template-type value. */
    interactionTemplatesBizTemplateTypeConfigFk: foreignKey({
      columns: [table.bizId, table.templateTypeConfigValueId],
      foreignColumns: [bizConfigValues.bizId, bizConfigValues.id],
      name: "interaction_templates_biz_template_type_config_fk",
    }),
    /** Tenant-safe FK to optional configurable template-status value. */
    interactionTemplatesBizStatusConfigFk: foreignKey({
      columns: [table.bizId, table.statusConfigValueId],
      foreignColumns: [bizConfigValues.bizId, bizConfigValues.id],
      name: "interaction_templates_biz_status_config_fk",
    }),

    /** Version must be positive integer. */
    interactionTemplatesVersionCheck: check(
      "interaction_templates_version_check",
      sql`"version" >= 1`,
    ),

    /** Effective window, if both timestamps exist, must be ordered. */
    interactionTemplatesEffectiveWindowCheck: check(
      "interaction_templates_effective_window_check",
      sql`
      "effective_from" IS NULL
      OR "effective_to" IS NULL
      OR "effective_to" > "effective_from"
      `,
    ),
  }),
);

/**
 * interaction_template_bindings
 *
 * ELI5:
 * A binding says "when X happens for Y context, this template is required/optional."
 *
 * Why this exists separately from template rows:
 * - one template can be reused by many services/locations/offers,
 * - one service can have many required documents with different triggers.
 */
export const interactionTemplateBindings = pgTable(
  "interaction_template_bindings",
  {
    /** Stable primary key for one binding rule. */
    id: idWithTag("interaction_binding"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Template version being bound into runtime flows. */
    interactionTemplateId: idRef("interaction_template_id")
      .references(() => interactionTemplates.id)
      .notNull(),

    /**
     * Record class that receives assignment instances.
     * Example: booking_order or fulfillment_unit.
     */
    targetType: customFieldTargetTypeEnum("target_type").notNull(),

    /**
     * Trigger key understood by orchestration/API layers.
     * Example values: booking.created, booking.confirmed, checkin.started.
     */
    triggerEvent: varchar("trigger_event", { length: 180 }).notNull(),

    /** Required vs optional behavior. */
    requirementMode: interactionRequirementModeEnum("requirement_mode")
      .default("required")
      .notNull(),

    /** Optional location scope. Null means applies to all locations. */
    locationId: idRef("location_id").references(() => locations.id),

    /** Optional service scope. */
    serviceId: idRef("service_id").references(() => services.id),

    /** Optional service-product scope. */
    serviceProductId: idRef("service_product_id").references(
      () => serviceProducts.id,
    ),

    /** Optional offer shell scope. */
    offerId: idRef("offer_id").references(() => offers.id),

    /** Optional offer-version scope. */
    offerVersionId: idRef("offer_version_id").references(() => offerVersions.id),

    /** Ordering/precedence for UI and enforcement pipelines. */
    priority: integer("priority").default(100).notNull(),

    /** Structured condition expression payload for advanced matching. */
    conditionExpr: jsonb("condition_expr").default({}).notNull(),

    /** Runtime active toggle. */
    isActive: boolean("is_active").default(true).notNull(),

    /** Extension payload for future policy dimensions. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite key for downstream tenant-safe references. */
    interactionTemplateBindingsBizIdIdUnique: uniqueIndex(
      "interaction_template_bindings_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** Runtime binding resolver lookup path. */
    interactionTemplateBindingsBizTargetTriggerIdx: index(
      "interaction_template_bindings_biz_target_trigger_idx",
    ).on(table.bizId, table.targetType, table.triggerEvent, table.isActive, table.priority),

    /** Tenant-safe FK to template. */
    interactionTemplateBindingsBizTemplateFk: foreignKey({
      columns: [table.bizId, table.interactionTemplateId],
      foreignColumns: [interactionTemplates.bizId, interactionTemplates.id],
      name: "interaction_template_bindings_biz_template_fk",
    }),

    /** Tenant-safe FK to optional location scope. */
    interactionTemplateBindingsBizLocationFk: foreignKey({
      columns: [table.bizId, table.locationId],
      foreignColumns: [locations.bizId, locations.id],
      name: "interaction_template_bindings_biz_location_fk",
    }),

    /** Tenant-safe FK to optional service scope. */
    interactionTemplateBindingsBizServiceFk: foreignKey({
      columns: [table.bizId, table.serviceId],
      foreignColumns: [services.bizId, services.id],
      name: "interaction_template_bindings_biz_service_fk",
    }),

    /** Tenant-safe FK to optional service-product scope. */
    interactionTemplateBindingsBizServiceProductFk: foreignKey({
      columns: [table.bizId, table.serviceProductId],
      foreignColumns: [serviceProducts.bizId, serviceProducts.id],
      name: "interaction_template_bindings_biz_service_product_fk",
    }),

    /** Tenant-safe FK to optional offer scope. */
    interactionTemplateBindingsBizOfferFk: foreignKey({
      columns: [table.bizId, table.offerId],
      foreignColumns: [offers.bizId, offers.id],
      name: "interaction_template_bindings_biz_offer_fk",
    }),

    /** Tenant-safe FK to optional offer-version scope. */
    interactionTemplateBindingsBizOfferVersionFk: foreignKey({
      columns: [table.bizId, table.offerVersionId],
      foreignColumns: [offerVersions.bizId, offerVersions.id],
      name: "interaction_template_bindings_biz_offer_version_fk",
    }),

    /** Priority must remain non-negative. */
    interactionTemplateBindingsPriorityCheck: check(
      "interaction_template_bindings_priority_check",
      sql`"priority" >= 0`,
    ),
  }),
);

/**
 * interaction_assignments
 *
 * ELI5:
 * One row means: "this specific person/group must complete this template
 * for this specific target record."
 *
 * Example:
 * - target: booking_order_123
 * - subject: user_456
 * - template: waiver_v3
 * - status: pending
 */
export const interactionAssignments = pgTable(
  "interaction_assignments",
  {
    /** Stable primary key. */
    id: idWithTag("interaction_assignment"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Template version this assignment is based on. */
    interactionTemplateId: idRef("interaction_template_id")
      .references(() => interactionTemplates.id)
      .notNull(),

    /** Target record type receiving this obligation. */
    targetType: customFieldTargetTypeEnum("target_type").notNull(),

    /** Target record id receiving this obligation. */
    targetRefId: varchar("target_ref_id", { length: 140 }).notNull(),

    /** User subject responsible for completion (common case). */
    subjectUserId: idRef("subject_user_id").references(() => users.id),

    /** Group-account subject for household/company completion contexts. */
    subjectGroupAccountId: idRef("subject_group_account_id").references(
      () => groupAccounts.id,
    ),

    /** Assignment lifecycle. */
    status: interactionAssignmentStatusEnum("status").default("pending").notNull(),
    /**
     * Optional biz-config dictionary value for assignment-status wording.
     */
    statusConfigValueId: idRef("status_config_value_id").references(
      () => bizConfigValues.id,
    ),

    /** Whether this assignment blocks progression if incomplete. */
    isBlocking: boolean("is_blocking").default(true).notNull(),

    /** Optional due time for SLA/compliance enforcement. */
    dueAt: timestamp("due_at", { withTimezone: true }),

    /** When assignee started filling/completing this assignment. */
    startedAt: timestamp("started_at", { withTimezone: true }),

    /** When assignment reached terminal completed state. */
    completedAt: timestamp("completed_at", { withTimezone: true }),

    /** Optional expiry after which assignment can no longer be completed. */
    expiresAt: timestamp("expires_at", { withTimezone: true }),

    /** Last reminder timestamp for reminder throttling policies. */
    lastReminderAt: timestamp("last_reminder_at", { withTimezone: true }),

    /**
     * Snapshot of policy/evaluation context at assignment creation time.
     * This preserves deterministic behavior when templates/rules evolve later.
     */
    policySnapshot: jsonb("policy_snapshot").default({}).notNull(),

    /** Extension payload for runtime fields not yet normalized. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata for assignment lifecycle transitions. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite key for tenant-safe child references. */
    interactionAssignmentsBizIdIdUnique: uniqueIndex(
      "interaction_assignments_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** Operational queue path for unresolved assignments. */
    interactionAssignmentsBizStatusDueIdx: index(
      "interaction_assignments_biz_status_due_idx",
    ).on(table.bizId, table.status, table.dueAt),
    interactionAssignmentsBizStatusConfigIdx: index(
      "interaction_assignments_biz_status_config_idx",
    ).on(table.bizId, table.statusConfigValueId),

    /** Common lookup path by target object. */
    interactionAssignmentsBizTargetIdx: index(
      "interaction_assignments_biz_target_idx",
    ).on(table.bizId, table.targetType, table.targetRefId, table.status),

    /** Common assignee workload path. */
    interactionAssignmentsBizSubjectIdx: index(
      "interaction_assignments_biz_subject_idx",
    ).on(table.bizId, table.subjectUserId, table.status),

    /** Tenant-safe FK to template. */
    interactionAssignmentsBizTemplateFk: foreignKey({
      columns: [table.bizId, table.interactionTemplateId],
      foreignColumns: [interactionTemplates.bizId, interactionTemplates.id],
      name: "interaction_assignments_biz_template_fk",
    }),
    /** Tenant-safe FK to optional configurable assignment-status value. */
    interactionAssignmentsBizStatusConfigFk: foreignKey({
      columns: [table.bizId, table.statusConfigValueId],
      foreignColumns: [bizConfigValues.bizId, bizConfigValues.id],
      name: "interaction_assignments_biz_status_config_fk",
    }),

    /** At least one subject identity path must exist. */
    interactionAssignmentsSubjectShapeCheck: check(
      "interaction_assignments_subject_shape_check",
      sql`
      "subject_user_id" IS NOT NULL
      OR "subject_group_account_id" IS NOT NULL
      `,
    ),

    /** Time ordering sanity checks for assignment lifecycle timestamps. */
    interactionAssignmentsWindowCheck: check(
      "interaction_assignments_window_check",
      sql`
      ("completed_at" IS NULL OR "started_at" IS NULL OR "completed_at" >= "started_at")
      AND ("expires_at" IS NULL OR "due_at" IS NULL OR "expires_at" >= "due_at")
      `,
    ),
  }),
);

/**
 * interaction_submissions
 *
 * ELI5:
 * A submission is one attempt to complete an interaction assignment.
 *
 * Keeping submissions as separate rows (instead of mutating one record)
 * preserves attempt history for compliance and troubleshooting.
 */
export const interactionSubmissions = pgTable(
  "interaction_submissions",
  {
    /** Stable primary key. */
    id: idWithTag("interaction_submission"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent assignment this attempt belongs to. */
    interactionAssignmentId: idRef("interaction_assignment_id")
      .references(() => interactionAssignments.id)
      .notNull(),

    /** Attempt number (1, 2, 3...) inside one assignment. */
    attemptNumber: integer("attempt_number").default(1).notNull(),

    /** Submission lifecycle status. */
    status: interactionSubmissionStatusEnum("status").default("draft").notNull(),
    /**
     * Optional biz-config dictionary value for submission-status wording.
     */
    statusConfigValueId: idRef("status_config_value_id").references(
      () => bizConfigValues.id,
    ),

    /** Submission timestamp for accepted payload. */
    submittedAt: timestamp("submitted_at", { withTimezone: true }),

    /** Reviewer decision timestamp for moderated flows. */
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),

    /** Optional reviewer user id. */
    reviewedByUserId: idRef("reviewed_by_user_id").references(() => users.id),

    /** Completion percentage for progress UI and reminders. */
    completionPercent: integer("completion_percent").default(0).notNull(),

    /** Canonical submission answers/payload snapshot. */
    responsePayload: jsonb("response_payload").default({}).notNull(),

    /** Validation error details captured at submit/review time. */
    validationErrors: jsonb("validation_errors").default({}).notNull(),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata for submission lifecycle transitions. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite key for tenant-safe references to this submission row. */
    interactionSubmissionsBizIdIdUnique: uniqueIndex(
      "interaction_submissions_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** One row per attempt number in one assignment. */
    interactionSubmissionsAssignmentAttemptUnique: uniqueIndex(
      "interaction_submissions_assignment_attempt_unique",
    ).on(table.interactionAssignmentId, table.attemptNumber),

    /** Common lookup path for assignment detail timelines. */
    interactionSubmissionsBizAssignmentIdx: index(
      "interaction_submissions_biz_assignment_idx",
    ).on(table.bizId, table.interactionAssignmentId, table.attemptNumber),
    interactionSubmissionsBizStatusConfigIdx: index(
      "interaction_submissions_biz_status_config_idx",
    ).on(table.bizId, table.statusConfigValueId),

    /** Tenant-safe FK to parent assignment. */
    interactionSubmissionsBizAssignmentFk: foreignKey({
      columns: [table.bizId, table.interactionAssignmentId],
      foreignColumns: [interactionAssignments.bizId, interactionAssignments.id],
      name: "interaction_submissions_biz_assignment_fk",
    }),
    /** Tenant-safe FK to optional configurable submission-status value. */
    interactionSubmissionsBizStatusConfigFk: foreignKey({
      columns: [table.bizId, table.statusConfigValueId],
      foreignColumns: [bizConfigValues.bizId, bizConfigValues.id],
      name: "interaction_submissions_biz_status_config_fk",
    }),

    /** Attempt numbers and completion percentages should stay bounded. */
    interactionSubmissionsNumericBoundsCheck: check(
      "interaction_submissions_numeric_bounds_check",
      sql`
      "attempt_number" >= 1
      AND "completion_percent" >= 0
      AND "completion_percent" <= 100
      `,
    ),

    /** Review timestamp cannot occur before submission timestamp. */
    interactionSubmissionsReviewWindowCheck: check(
      "interaction_submissions_review_window_check",
      sql`"reviewed_at" IS NULL OR "submitted_at" IS NULL OR "reviewed_at" >= "submitted_at"`,
    ),
  }),
);

/**
 * interaction_submission_artifacts
 *
 * ELI5:
 * Artifacts are uploaded evidence linked to a submission:
 * - uploaded files
 * - photos
 * - generated PDFs
 * - signature blobs
 */
export const interactionSubmissionArtifacts = pgTable(
  "interaction_submission_artifacts",
  {
    /** Stable primary key. */
    id: idWithTag("interaction_artifact"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent submission this artifact belongs to. */
    interactionSubmissionId: idRef("interaction_submission_id")
      .references(() => interactionSubmissions.id)
      .notNull(),

    /** Artifact category. */
    artifactType: interactionArtifactTypeEnum("artifact_type").notNull(),

    /** Opaque storage reference (S3 key, blob id, signed URI reference, etc.). */
    storageRef: varchar("storage_ref", { length: 600 }).notNull(),

    /** Optional original filename. */
    fileName: varchar("file_name", { length: 260 }),

    /** Optional MIME type for content handling. */
    mimeType: varchar("mime_type", { length: 160 }),

    /** Optional file size in bytes for quotas and validations. */
    fileSizeBytes: integer("file_size_bytes"),

    /** Optional SHA-256 hash for tamper/integrity checks. */
    sha256: varchar("sha256", { length: 128 }),

    /** Capture timestamp when this artifact was recorded. */
    capturedAt: timestamp("captured_at", { withTimezone: true })
      .defaultNow()
      .notNull(),

    /** Optional actor pointer when capture is user-driven. */
    capturedByUserId: idRef("captured_by_user_id").references(() => users.id),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    interactionSubmissionArtifactsBizIdIdUnique: uniqueIndex("interaction_submission_artifacts_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Common artifact listing path for one submission. */
    interactionSubmissionArtifactsBizSubmissionIdx: index(
      "interaction_submission_artifacts_biz_submission_idx",
    ).on(table.bizId, table.interactionSubmissionId, table.capturedAt),

    /** Tenant-safe FK to parent submission. */
    interactionSubmissionArtifactsBizSubmissionFk: foreignKey({
      columns: [table.bizId, table.interactionSubmissionId],
      foreignColumns: [interactionSubmissions.bizId, interactionSubmissions.id],
      name: "interaction_submission_artifacts_biz_submission_fk",
    }),

    /** File size cannot be negative when present. */
    interactionSubmissionArtifactsFileSizeCheck: check(
      "interaction_submission_artifacts_file_size_check",
      sql`"file_size_bytes" IS NULL OR "file_size_bytes" >= 0`,
    ),
  }),
);

/**
 * interaction_submission_signatures
 *
 * ELI5:
 * Signature rows keep legal-signing evidence separate and explicit.
 *
 * This supports:
 * - guardian and witness signatures,
 * - versioned consent statements,
 * - audit-friendly proof (time/ip/user-agent/method).
 */
export const interactionSubmissionSignatures = pgTable(
  "interaction_submission_signatures",
  {
    /** Stable primary key. */
    id: idWithTag("interaction_signature"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent submission this signature belongs to. */
    interactionSubmissionId: idRef("interaction_submission_id")
      .references(() => interactionSubmissions.id)
      .notNull(),

    /** Signer role context (customer/guardian/witness/etc.). */
    signerRole: signatureSignerRoleEnum("signer_role").notNull(),

    /** Optional linked user identity of signer. */
    signerUserId: idRef("signer_user_id").references(() => users.id),

    /** Fallback signer display name when no linked user exists. */
    signerName: varchar("signer_name", { length: 220 }),

    /** Signature capture method. */
    signatureMethod: signatureMethodEnum("signature_method").notNull(),

    /** Consent text/statement the signer accepted. */
    consentStatement: text("consent_statement").notNull(),

    /**
     * Signature payload (stroke data, typed text, acceptance hash, etc.).
     * Kept JSON for method-specific extensibility.
     */
    signaturePayload: jsonb("signature_payload").default({}).notNull(),

    /** Signature timestamp. */
    signedAt: timestamp("signed_at", { withTimezone: true })
      .defaultNow()
      .notNull(),

    /** Optional IP source for legal audit. */
    ipAddress: varchar("ip_address", { length: 80 }),

    /** Optional user-agent snapshot for legal audit. */
    userAgent: varchar("user_agent", { length: 500 }),

    /** Signature lifecycle (e.g., revoked when superseded). */
    status: lifecycleStatusEnum("status").default("active").notNull(),
    /**
     * Optional biz-config dictionary value for signature-status wording.
     */
    statusConfigValueId: idRef("status_config_value_id").references(
      () => bizConfigValues.id,
    ),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    interactionSubmissionSignaturesBizIdIdUnique: uniqueIndex("interaction_submission_signatures_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Common signature timeline lookup path per submission. */
    interactionSubmissionSignaturesBizSubmissionIdx: index(
      "interaction_submission_signatures_biz_submission_idx",
    ).on(table.bizId, table.interactionSubmissionId, table.signedAt),
    interactionSubmissionSignaturesBizStatusConfigIdx: index(
      "interaction_submission_signatures_biz_status_config_idx",
    ).on(table.bizId, table.statusConfigValueId),

    /** Tenant-safe FK to parent submission. */
    interactionSubmissionSignaturesBizSubmissionFk: foreignKey({
      columns: [table.bizId, table.interactionSubmissionId],
      foreignColumns: [interactionSubmissions.bizId, interactionSubmissions.id],
      name: "interaction_submission_signatures_biz_submission_fk",
    }),
    /** Tenant-safe FK to optional configurable signature-status value. */
    interactionSubmissionSignaturesBizStatusConfigFk: foreignKey({
      columns: [table.bizId, table.statusConfigValueId],
      foreignColumns: [bizConfigValues.bizId, bizConfigValues.id],
      name: "interaction_submission_signatures_biz_status_config_fk",
    }),

    /** Signature must have either linked user or explicit signer name. */
    interactionSubmissionSignaturesSignerShapeCheck: check(
      "interaction_submission_signatures_signer_shape_check",
      sql`
      "signer_user_id" IS NOT NULL
      OR "signer_name" IS NOT NULL
      `,
    ),
  }),
);

/**
 * requirement_list_templates
 *
 * ELI5:
 * A requirement list is a reusable checklist template.
 *
 * This is intentionally separate from generic interaction templates because:
 * - checklist tasks need explicit item rows and dependency edges,
 * - operations dashboards often query checklist completion per task.
 */
export const requirementListTemplates = pgTable(
  "requirement_list_templates",
  {
    /** Stable primary key. */
    id: idWithTag("requirement_list"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Optional extension owner. */
    bizExtensionInstallId: idRef("biz_extension_install_id").references(
      () => bizExtensionInstalls.id,
    ),

    /** Human template name. */
    name: varchar("name", { length: 220 }).notNull(),

    /** Stable machine slug used for version families. */
    slug: varchar("slug", { length: 140 }).notNull(),

    /** Immutable version number within `(biz_id, slug)`. */
    version: integer("version").default(1).notNull(),

    /** Lifecycle status for this template version. */
    status: lifecycleStatusEnum("status").default("draft").notNull(),
    /**
     * Optional biz-config dictionary value for checklist-template status wording.
     */
    statusConfigValueId: idRef("status_config_value_id").references(
      () => bizConfigValues.id,
    ),

    /** Marks this version as currently selected default. */
    isCurrent: boolean("is_current").default(false).notNull(),

    /** Optional title shown to end users. */
    title: varchar("title", { length: 300 }),

    /** Optional explanatory description. */
    description: text("description"),

    /** Generic checklist policy payload. */
    policy: jsonb("policy").default({}).notNull(),

    /** Optional valid-from timestamp. */
    effectiveFrom: timestamp("effective_from", { withTimezone: true }),

    /** Optional valid-to timestamp. */
    effectiveTo: timestamp("effective_to", { withTimezone: true }),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite key for tenant-safe children. */
    requirementListTemplatesBizIdIdUnique: uniqueIndex(
      "requirement_list_templates_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** One immutable version per slug/version tuple. */
    requirementListTemplatesBizSlugVersionUnique: uniqueIndex(
      "requirement_list_templates_biz_slug_version_unique",
    ).on(table.bizId, table.slug, table.version),

    /** One active current version per slug. */
    requirementListTemplatesBizSlugCurrentUnique: uniqueIndex(
      "requirement_list_templates_biz_slug_current_unique",
    )
      .on(table.bizId, table.slug)
      .where(sql`"is_current" = true`),

    /** Common listing path. */
    requirementListTemplatesBizStatusIdx: index(
      "requirement_list_templates_biz_status_idx",
    ).on(table.bizId, table.status, table.isCurrent),
    requirementListTemplatesBizStatusConfigIdx: index(
      "requirement_list_templates_biz_status_config_idx",
    ).on(table.bizId, table.statusConfigValueId),

    /** Tenant-safe FK to optional extension owner. */
    requirementListTemplatesBizInstallFk: foreignKey({
      columns: [table.bizId, table.bizExtensionInstallId],
      foreignColumns: [bizExtensionInstalls.bizId, bizExtensionInstalls.id],
      name: "requirement_list_templates_biz_install_fk",
    }),
    /** Tenant-safe FK to optional configurable checklist-template status value. */
    requirementListTemplatesBizStatusConfigFk: foreignKey({
      columns: [table.bizId, table.statusConfigValueId],
      foreignColumns: [bizConfigValues.bizId, bizConfigValues.id],
      name: "requirement_list_templates_biz_status_config_fk",
    }),

    /** Version and effective window sanity checks. */
    requirementListTemplatesBoundsCheck: check(
      "requirement_list_templates_bounds_check",
      sql`
      "version" >= 1
      AND (
        "effective_from" IS NULL
        OR "effective_to" IS NULL
        OR "effective_to" > "effective_from"
      )
      `,
    ),
  }),
);

/**
 * requirement_list_template_items
 *
 * ELI5:
 * One row = one checklist step definition in a requirement template.
 */
export const requirementListTemplateItems = pgTable(
  "requirement_list_template_items",
  {
    /** Stable primary key. */
    id: idWithTag("requirement_item"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent requirement list template. */
    requirementListTemplateId: idRef("requirement_list_template_id")
      .references(() => requirementListTemplates.id)
      .notNull(),

    /** Stable key used in APIs and imports. */
    itemKey: varchar("item_key", { length: 120 }).notNull(),

    /** Human task title. */
    title: varchar("title", { length: 240 }).notNull(),

    /** Optional longer guidance text for users. */
    description: text("description"),

    /** Task category used by UI/workflow logic. */
    itemType: requirementItemTypeEnum("item_type").default("confirm").notNull(),
    /**
     * Optional biz-config dictionary value for checklist-item type vocabulary.
     */
    itemTypeConfigValueId: idRef("item_type_config_value_id").references(
      () => bizConfigValues.id,
    ),

    /** Required items gate completion; optional items are informational. */
    isRequired: boolean("is_required").default(true).notNull(),

    /** Optional dependency on another template item. */
    dependsOnTemplateItemId: idRef("depends_on_template_item_id").references(
      (): AnyPgColumn => requirementListTemplateItems.id,
    ),

    /** Ordering hint in rendered checklist UIs. */
    sortOrder: integer("sort_order").default(100).notNull(),

    /** Optional rich instructions/in-app markdown text. */
    instructions: text("instructions"),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite key for tenant-safe references to this requirement-item row. */
    requirementListTemplateItemsBizIdIdUnique: uniqueIndex(
      "requirement_list_template_items_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** One key per template. */
    requirementListTemplateItemsUnique: uniqueIndex(
      "requirement_list_template_items_unique",
    ).on(table.requirementListTemplateId, table.itemKey),

    /** Common item rendering path. */
    requirementListTemplateItemsBizTemplateSortIdx: index(
      "requirement_list_template_items_biz_template_sort_idx",
    ).on(table.bizId, table.requirementListTemplateId, table.sortOrder),
    requirementListTemplateItemsBizItemTypeConfigIdx: index(
      "requirement_list_template_items_biz_item_type_config_idx",
    ).on(table.bizId, table.itemTypeConfigValueId),

    /** Tenant-safe FK to template. */
    requirementListTemplateItemsBizTemplateFk: foreignKey({
      columns: [table.bizId, table.requirementListTemplateId],
      foreignColumns: [requirementListTemplates.bizId, requirementListTemplates.id],
      name: "requirement_list_template_items_biz_template_fk",
    }),
    /** Tenant-safe FK to optional configurable checklist-item type value. */
    requirementListTemplateItemsBizItemTypeConfigFk: foreignKey({
      columns: [table.bizId, table.itemTypeConfigValueId],
      foreignColumns: [bizConfigValues.bizId, bizConfigValues.id],
      name: "requirement_list_template_items_biz_item_type_config_fk",
    }),

    /** Prevent self-dependency and negative sort orders. */
    requirementListTemplateItemsBoundsCheck: check(
      "requirement_list_template_items_bounds_check",
      sql`
      "sort_order" >= 0
      AND (
        "depends_on_template_item_id" IS NULL
        OR "depends_on_template_item_id" <> "id"
      )
      `,
    ),
  }),
);

/**
 * requirement_list_assignments
 *
 * ELI5:
 * Instantiates one checklist template for a concrete target + assignee.
 */
export const requirementListAssignments = pgTable(
  "requirement_list_assignments",
  {
    /** Stable primary key. */
    id: idWithTag("requirement_assignment"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Template used to create this assignment. */
    requirementListTemplateId: idRef("requirement_list_template_id")
      .references(() => requirementListTemplates.id)
      .notNull(),

    /** Target record type receiving this checklist assignment. */
    targetType: customFieldTargetTypeEnum("target_type").notNull(),

    /** Target record id receiving this checklist assignment. */
    targetRefId: varchar("target_ref_id", { length: 140 }).notNull(),

    /** Optional direct user subject for this checklist. */
    subjectUserId: idRef("subject_user_id").references(() => users.id),

    /** Optional group-account subject for this checklist. */
    subjectGroupAccountId: idRef("subject_group_account_id").references(
      () => groupAccounts.id,
    ),

    /** Assignment lifecycle state. */
    status: interactionAssignmentStatusEnum("status").default("pending").notNull(),
    /**
     * Optional biz-config dictionary value for checklist-assignment status wording.
     */
    statusConfigValueId: idRef("status_config_value_id").references(
      () => bizConfigValues.id,
    ),

    /** Whether unresolved required items should block progression. */
    isBlocking: boolean("is_blocking").default(true).notNull(),

    /** Optional due time. */
    dueAt: timestamp("due_at", { withTimezone: true }),

    /** Start timestamp when checklist interaction began. */
    startedAt: timestamp("started_at", { withTimezone: true }),

    /** Completion timestamp when checklist reached terminal complete state. */
    completedAt: timestamp("completed_at", { withTimezone: true }),

    /** Optional expiry timestamp. */
    expiresAt: timestamp("expires_at", { withTimezone: true }),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite key for tenant-safe child references. */
    requirementListAssignmentsBizIdIdUnique: uniqueIndex(
      "requirement_list_assignments_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** Operational queue path. */
    requirementListAssignmentsBizStatusDueIdx: index(
      "requirement_list_assignments_biz_status_due_idx",
    ).on(table.bizId, table.status, table.dueAt),
    requirementListAssignmentsBizStatusConfigIdx: index(
      "requirement_list_assignments_biz_status_config_idx",
    ).on(table.bizId, table.statusConfigValueId),

    /** Lookup path by target. */
    requirementListAssignmentsBizTargetIdx: index(
      "requirement_list_assignments_biz_target_idx",
    ).on(table.bizId, table.targetType, table.targetRefId, table.status),

    /** Tenant-safe FK to checklist template. */
    requirementListAssignmentsBizTemplateFk: foreignKey({
      columns: [table.bizId, table.requirementListTemplateId],
      foreignColumns: [requirementListTemplates.bizId, requirementListTemplates.id],
      name: "requirement_list_assignments_biz_template_fk",
    }),
    /** Tenant-safe FK to optional configurable checklist-assignment status value. */
    requirementListAssignmentsBizStatusConfigFk: foreignKey({
      columns: [table.bizId, table.statusConfigValueId],
      foreignColumns: [bizConfigValues.bizId, bizConfigValues.id],
      name: "requirement_list_assignments_biz_status_config_fk",
    }),

    /** Subject must be either user and/or group account. */
    requirementListAssignmentsSubjectShapeCheck: check(
      "requirement_list_assignments_subject_shape_check",
      sql`
      "subject_user_id" IS NOT NULL
      OR "subject_group_account_id" IS NOT NULL
      `,
    ),
  }),
);

/**
 * requirement_list_assignment_items
 *
 * ELI5:
 * Runtime status row per checklist item in one assignment.
 *
 * Keeping this separate lets APIs/UI show progress instantly and lets
 * analytics ask "which required step causes most failures?".
 */
export const requirementListAssignmentItems = pgTable(
  "requirement_list_assignment_items",
  {
    /** Stable primary key. */
    id: idWithTag("requirement_assignment_item"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent checklist assignment. */
    requirementListAssignmentId: idRef("requirement_list_assignment_id")
      .references(() => requirementListAssignments.id)
      .notNull(),

    /** Template item this runtime row mirrors. */
    templateItemId: idRef("template_item_id")
      .references(() => requirementListTemplateItems.id)
      .notNull(),

    /** Runtime status for this checklist item. */
    status: requirementItemStatusEnum("status").default("pending").notNull(),
    /**
     * Optional biz-config dictionary value for checklist runtime-item status wording.
     */
    statusConfigValueId: idRef("status_config_value_id").references(
      () => bizConfigValues.id,
    ),

    /** Completion timestamp for completed item states. */
    completedAt: timestamp("completed_at", { withTimezone: true }),

    /** Optional actor who marked this item complete/waived/skipped. */
    completedByUserId: idRef("completed_by_user_id").references(() => users.id),

    /** Evidence payload (upload refs, attestation detail, notes, etc.). */
    evidence: jsonb("evidence").default({}).notNull(),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    requirementListAssignmentItemsBizIdIdUnique: uniqueIndex("requirement_list_assignment_items_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** One runtime item row per assignment+template-item pair. */
    requirementListAssignmentItemsUnique: uniqueIndex(
      "requirement_list_assignment_items_unique",
    ).on(table.requirementListAssignmentId, table.templateItemId),

    /** Common progress rendering path. */
    requirementListAssignmentItemsBizAssignmentStatusIdx: index(
      "requirement_list_assignment_items_biz_assignment_status_idx",
    ).on(table.bizId, table.requirementListAssignmentId, table.status),
    requirementListAssignmentItemsBizStatusConfigIdx: index(
      "requirement_list_assignment_items_biz_status_config_idx",
    ).on(table.bizId, table.statusConfigValueId),

    /** Tenant-safe FK to parent assignment. */
    requirementListAssignmentItemsBizAssignmentFk: foreignKey({
      columns: [table.bizId, table.requirementListAssignmentId],
      foreignColumns: [requirementListAssignments.bizId, requirementListAssignments.id],
      name: "requirement_list_assignment_items_biz_assignment_fk",
    }),

    /** Tenant-safe FK to source template item. */
    requirementListAssignmentItemsBizTemplateItemFk: foreignKey({
      columns: [table.bizId, table.templateItemId],
      foreignColumns: [requirementListTemplateItems.bizId, requirementListTemplateItems.id],
      name: "requirement_list_assignment_items_biz_template_item_fk",
    }),
    /** Tenant-safe FK to optional configurable checklist runtime-item status value. */
    requirementListAssignmentItemsBizStatusConfigFk: foreignKey({
      columns: [table.bizId, table.statusConfigValueId],
      foreignColumns: [bizConfigValues.bizId, bizConfigValues.id],
      name: "requirement_list_assignment_items_biz_status_config_fk",
    }),

    /** Completed status should carry completion timestamp. */
    requirementListAssignmentItemsCompletionShapeCheck: check(
      "requirement_list_assignment_items_completion_shape_check",
      sql`
      (
        "status" = 'completed'
        AND "completed_at" IS NOT NULL
      ) OR (
        "status" <> 'completed'
      )
      `,
    ),
  }),
);

export type InteractionTemplate = typeof interactionTemplates.$inferSelect;
export type NewInteractionTemplate = typeof interactionTemplates.$inferInsert;

export type InteractionTemplateBinding =
  typeof interactionTemplateBindings.$inferSelect;
export type NewInteractionTemplateBinding =
  typeof interactionTemplateBindings.$inferInsert;

export type InteractionAssignment = typeof interactionAssignments.$inferSelect;
export type NewInteractionAssignment = typeof interactionAssignments.$inferInsert;

export type InteractionSubmission = typeof interactionSubmissions.$inferSelect;
export type NewInteractionSubmission = typeof interactionSubmissions.$inferInsert;

export type InteractionSubmissionArtifact =
  typeof interactionSubmissionArtifacts.$inferSelect;
export type NewInteractionSubmissionArtifact =
  typeof interactionSubmissionArtifacts.$inferInsert;

export type InteractionSubmissionSignature =
  typeof interactionSubmissionSignatures.$inferSelect;
export type NewInteractionSubmissionSignature =
  typeof interactionSubmissionSignatures.$inferInsert;

export type RequirementListTemplate = typeof requirementListTemplates.$inferSelect;
export type NewRequirementListTemplate = typeof requirementListTemplates.$inferInsert;

export type RequirementListTemplateItem =
  typeof requirementListTemplateItems.$inferSelect;
export type NewRequirementListTemplateItem =
  typeof requirementListTemplateItems.$inferInsert;

export type RequirementListAssignment =
  typeof requirementListAssignments.$inferSelect;
export type NewRequirementListAssignment =
  typeof requirementListAssignments.$inferInsert;

export type RequirementListAssignmentItem =
  typeof requirementListAssignmentItems.$inferSelect;
export type NewRequirementListAssignmentItem =
  typeof requirementListAssignmentItems.$inferInsert;
