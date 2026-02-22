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
import { communicationChannelEnum, customFieldTargetTypeEnum, lifecycleStatusEnum, piiSensitivityLevelEnum } from "./enums";
import {
  baaPartyTypeEnum,
  baaStatusEnum,
  breachNotificationRecipientTypeEnum,
  breachNotificationStatusEnum,
  breakGlassReviewStatusEnum,
  disclosureRecipientTypeEnum,
  extensionScopeEnum,
  hipaaAuthorizationStatusEnum,
  hipaaPurposeOfUseEnum,
  phiAccessActionEnum,
  phiAccessDecisionEnum,
  securityIncidentSeverityEnum,
  securityIncidentStatusEnum,
  securityIncidentTypeEnum,
} from "./enums";
import { bizExtensionInstalls } from "./extensions";
import { tenantComplianceProfiles } from "./governance";
import { groupAccounts } from "./group_accounts";
import { locations } from "./locations";
import { subjects } from "./subjects";
import { users } from "./users";

/**
 * business_associate_agreements
 *
 * ELI5:
 * A BAA row is the contract checkpoint that says:
 * "This outside party is allowed to handle PHI under agreed safeguards."
 *
 * Why this is first-class:
 * - HIPAA programs need contract lifecycle traceability,
 * - PHI-capable integrations should be blocked when BAA is not active,
 * - compliance teams need one place for status/effective dates/evidence refs.
 */
export const businessAssociateAgreements = pgTable(
  "business_associate_agreements",
  {
    /** Stable primary key. */
    id: idWithTag("baa"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Optional compliance profile anchor (usually HIPAA profile). */
    complianceProfileId: idRef("compliance_profile_id").references(
      () => tenantComplianceProfiles.id,
    ),

    /** Counterparty kind for this agreement. */
    partyType: baaPartyTypeEnum("party_type").notNull(),

    /** Human-facing counterparty legal/trading name. */
    partyName: varchar("party_name", { length: 220 }).notNull(),

    /** Optional external/legal reference for counterparty identity. */
    partyExternalRef: varchar("party_external_ref", { length: 200 }),

    /**
     * Optional extension-install pointer when counterparty is a plugin vendor.
     * This keeps PHI enablement directly connected to integration lifecycle.
     */
    bizExtensionInstallId: idRef("biz_extension_install_id").references(
      () => bizExtensionInstalls.id,
    ),

    /** Agreement lifecycle state. */
    status: baaStatusEnum("status").default("draft").notNull(),

    /** Contract version string for legal traceability. */
    agreementVersion: varchar("agreement_version", { length: 60 }).default("1.0").notNull(),

    /** Optional contract/reference code from legal system. */
    contractRef: varchar("contract_ref", { length: 200 }),

    /** Optional doc-store pointer to the signed agreement artifact. */
    documentRef: varchar("document_ref", { length: 600 }),

    /** Whether this BAA explicitly permits PHI processing. */
    allowsPhiProcessing: boolean("allows_phi_processing").default(false).notNull(),

    /** Whether downstream subcontractor flow-down obligations are required. */
    requiresSubcontractorFlowDown: boolean("requires_subcontractor_flow_down")
      .default(true)
      .notNull(),

    /** Breach notice commitment window in hours (e.g., 72). */
    breachNoticeWindowHours: integer("breach_notice_window_hours")
      .default(72)
      .notNull(),

    /** Effective date start for operational enforcement. */
    effectiveFrom: timestamp("effective_from", { withTimezone: true }),

    /** Effective date end if contract is expiring/terminated. */
    effectiveTo: timestamp("effective_to", { withTimezone: true }),

    /** Signature completion timestamp. */
    signedAt: timestamp("signed_at", { withTimezone: true }),

    /** Explicit termination timestamp when applicable. */
    terminatedAt: timestamp("terminated_at", { withTimezone: true }),

    /** Structured legal/security obligations snapshot. */
    obligations: jsonb("obligations").default({}).notNull(),

    /** Extension payload for implementation-specific metadata. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    businessAssociateAgreementsBizIdIdUnique: uniqueIndex(
      "business_associate_agreements_biz_id_id_unique",
    ).on(table.bizId, table.id),

    businessAssociateAgreementsBizStatusEffectiveIdx: index(
      "business_associate_agreements_biz_status_effective_idx",
    ).on(table.bizId, table.status, table.effectiveFrom),

    businessAssociateAgreementsBizPartyIdx: index(
      "business_associate_agreements_biz_party_idx",
    ).on(table.bizId, table.partyType, table.partyName, table.status),

    businessAssociateAgreementsBizComplianceProfileFk: foreignKey({
      columns: [table.bizId, table.complianceProfileId],
      foreignColumns: [tenantComplianceProfiles.bizId, tenantComplianceProfiles.id],
      name: "business_associate_agreements_biz_compliance_profile_fk",
    }),

    businessAssociateAgreementsBizInstallFk: foreignKey({
      columns: [table.bizId, table.bizExtensionInstallId],
      foreignColumns: [bizExtensionInstalls.bizId, bizExtensionInstalls.id],
      name: "business_associate_agreements_biz_install_fk",
    }),

    /** Extension-install party must include extension install pointer. */
    businessAssociateAgreementsPartyShapeCheck: check(
      "business_associate_agreements_party_shape_check",
      sql`
      (
        "party_type" = 'extension_install'
        AND "biz_extension_install_id" IS NOT NULL
      ) OR (
        "party_type" <> 'extension_install'
      )
      `,
    ),

    /** Contract timeline and numeric sanity checks. */
    businessAssociateAgreementsTimelineCheck: check(
      "business_associate_agreements_timeline_check",
      sql`
      "breach_notice_window_hours" >= 1
      AND "breach_notice_window_hours" <= 720
      AND (
        "effective_from" IS NULL
        OR "effective_to" IS NULL
        OR "effective_to" >= "effective_from"
      )
      AND ("signed_at" IS NULL OR "effective_from" IS NULL OR "signed_at" <= "effective_from")
      AND ("terminated_at" IS NULL OR "effective_from" IS NULL OR "terminated_at" >= "effective_from")
      `,
    ),
  }),
);

/**
 * hipaa_authorizations
 *
 * ELI5:
 * This table stores explicit patient/guardian authorization records for PHI
 * use/disclosure contexts that require signed authorization.
 */
export const hipaaAuthorizations = pgTable(
  "hipaa_authorizations",
  {
    id: idWithTag("hipaa_authz"),
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),
    complianceProfileId: idRef("compliance_profile_id").references(
      () => tenantComplianceProfiles.id,
    ),

    /** Subject pointers (one is required). */
    subjectUserId: idRef("subject_user_id").references(() => users.id),
    subjectGroupAccountId: idRef("subject_group_account_id").references(
      () => groupAccounts.id,
    ),
    subjectExternalRef: varchar("subject_external_ref", { length: 200 }),

    status: hipaaAuthorizationStatusEnum("status").default("draft").notNull(),
    purposeOfUse: hipaaPurposeOfUseEnum("purpose_of_use").notNull(),

    /** Human-readable scope of what is allowed. */
    scopeDescription: text("scope_description").notNull(),

    signedAt: timestamp("signed_at", { withTimezone: true }),
    effectiveFrom: timestamp("effective_from", { withTimezone: true }),
    effectiveTo: timestamp("effective_to", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revokedReason: text("revoked_reason"),

    /** Optional artifact refs for signed documents/evidence. */
    documentRef: varchar("document_ref", { length: 600 }),
    grantedByUserId: idRef("granted_by_user_id").references(() => users.id),
    witnessedByUserId: idRef("witnessed_by_user_id").references(() => users.id),

    metadata: jsonb("metadata").default({}),
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    hipaaAuthorizationsBizIdIdUnique: uniqueIndex(
      "hipaa_authorizations_biz_id_id_unique",
    ).on(table.bizId, table.id),

    hipaaAuthorizationsBizSubjectStatusIdx: index(
      "hipaa_authorizations_biz_subject_status_idx",
    ).on(table.bizId, table.subjectUserId, table.subjectGroupAccountId, table.status),

    hipaaAuthorizationsBizComplianceProfileFk: foreignKey({
      columns: [table.bizId, table.complianceProfileId],
      foreignColumns: [tenantComplianceProfiles.bizId, tenantComplianceProfiles.id],
      name: "hipaa_authorizations_biz_compliance_profile_fk",
    }),

    hipaaAuthorizationsSubjectPointerCheck: check(
      "hipaa_authorizations_subject_pointer_check",
      sql`
      "subject_user_id" IS NOT NULL
      OR "subject_group_account_id" IS NOT NULL
      OR "subject_external_ref" IS NOT NULL
      `,
    ),

    /** Status requires expected timestamps and ordered timeline. */
    hipaaAuthorizationsStatusTimelineCheck: check(
      "hipaa_authorizations_status_timeline_check",
      sql`
      (
        "status" = 'draft'
      ) OR (
        "status" = 'signed'
        AND "signed_at" IS NOT NULL
      ) OR (
        "status" = 'revoked'
        AND "signed_at" IS NOT NULL
        AND "revoked_at" IS NOT NULL
      ) OR (
        "status" = 'expired'
        AND "signed_at" IS NOT NULL
        AND "effective_to" IS NOT NULL
      )
      AND ("effective_from" IS NULL OR "effective_to" IS NULL OR "effective_to" >= "effective_from")
      AND ("revoked_at" IS NULL OR "signed_at" IS NULL OR "revoked_at" >= "signed_at")
      `,
    ),
  }),
);

/**
 * phi_access_policies
 *
 * ELI5:
 * These are "minimum necessary" policy rows for PHI access control.
 *
 * Each row says:
 * - where it applies (biz/location/custom subject),
 * - what sensitivity/purpose/action is allowed,
 * - whether stronger controls are required (authorization, MFA, break-glass).
 */
export const phiAccessPolicies = pgTable(
  "phi_access_policies",
  {
    id: idWithTag("phi_policy"),
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),
    complianceProfileId: idRef("compliance_profile_id").references(
      () => tenantComplianceProfiles.id,
    ),

    name: varchar("name", { length: 220 }).notNull(),
    slug: varchar("slug", { length: 140 }).notNull(),
    status: lifecycleStatusEnum("status").default("active").notNull(),

    scope: extensionScopeEnum("scope").default("biz").notNull(),
    scopeRefKey: varchar("scope_ref_key", { length: 300 }).notNull(),
    locationId: idRef("location_id").references(() => locations.id),
    subjectRefType: varchar("subject_ref_type", { length: 80 }),
    subjectRefId: idRef("subject_ref_id"),

    sensitivity: piiSensitivityLevelEnum("sensitivity").default("high").notNull(),
    allowedPurposes: jsonb("allowed_purposes").default([]).notNull(),
    allowedActions: jsonb("allowed_actions").default([]).notNull(),

    requireAuthorization: boolean("require_authorization").default(false).notNull(),
    requireMfa: boolean("require_mfa").default(false).notNull(),
    requireBreakGlassJustification: boolean("require_break_glass_justification")
      .default(true)
      .notNull(),

    /** Extension payload for richer policy engines/rules. */
    policy: jsonb("policy").default({}).notNull(),
    metadata: jsonb("metadata").default({}),
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    phiAccessPoliciesBizIdIdUnique: uniqueIndex("phi_access_policies_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),

    phiAccessPoliciesBizSlugUnique: uniqueIndex("phi_access_policies_biz_slug_unique").on(
      table.bizId,
      table.slug,
    ),

    phiAccessPoliciesBizStatusScopeIdx: index("phi_access_policies_biz_status_scope_idx").on(
      table.bizId,
      table.status,
      table.scope,
    ),

    phiAccessPoliciesBizComplianceProfileFk: foreignKey({
      columns: [table.bizId, table.complianceProfileId],
      foreignColumns: [tenantComplianceProfiles.bizId, tenantComplianceProfiles.id],
      name: "phi_access_policies_biz_compliance_profile_fk",
    }),

    phiAccessPoliciesBizLocationFk: foreignKey({
      columns: [table.bizId, table.locationId],
      foreignColumns: [locations.bizId, locations.id],
      name: "phi_access_policies_biz_location_fk",
    }),

    phiAccessPoliciesBizSubjectFk: foreignKey({
      columns: [table.bizId, table.subjectRefType, table.subjectRefId],
      foreignColumns: [subjects.bizId, subjects.subjectType, subjects.subjectId],
      name: "phi_access_policies_biz_subject_fk",
    }),

    phiAccessPoliciesScopeShapeCheck: check(
      "phi_access_policies_scope_shape_check",
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
  }),
);

/**
 * phi_access_events
 *
 * ELI5:
 * This is the operational log of PHI access attempts.
 *
 * It records:
 * - who tried to access,
 * - what they tried to access,
 * - why (purpose of use),
 * - whether it was allowed/denied,
 * - and whether emergency break-glass was used.
 */
export const phiAccessEvents = pgTable(
  "phi_access_events",
  {
    id: idWithTag("phi_access"),
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    phiAccessPolicyId: idRef("phi_access_policy_id").references(() => phiAccessPolicies.id),
    hipaaAuthorizationId: idRef("hipaa_authorization_id").references(
      () => hipaaAuthorizations.id,
    ),

    actorUserId: idRef("actor_user_id").references(() => users.id),
    actorRef: varchar("actor_ref", { length: 200 }),

    targetType: customFieldTargetTypeEnum("target_type").notNull(),
    targetRefId: varchar("target_ref_id", { length: 140 }).notNull(),

    /** Subject pointers for whose PHI is involved (one required). */
    subjectUserId: idRef("subject_user_id").references(() => users.id),
    subjectGroupAccountId: idRef("subject_group_account_id").references(
      () => groupAccounts.id,
    ),
    subjectExternalRef: varchar("subject_external_ref", { length: 200 }),

    purposeOfUse: hipaaPurposeOfUseEnum("purpose_of_use").notNull(),
    action: phiAccessActionEnum("action").notNull(),
    decision: phiAccessDecisionEnum("decision").default("allowed").notNull(),

    isBreakGlass: boolean("is_break_glass").default(false).notNull(),
    breakGlassReason: text("break_glass_reason"),

    requestRef: varchar("request_ref", { length: 200 }),
    sourceIp: varchar("source_ip", { length: 80 }),
    userAgent: varchar("user_agent", { length: 500 }),

    occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),
    fieldsAccessed: jsonb("fields_accessed").default([]).notNull(),
    metadata: jsonb("metadata").default({}),
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    phiAccessEventsBizIdIdUnique: uniqueIndex("phi_access_events_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),

    phiAccessEventsBizDecisionOccurredIdx: index(
      "phi_access_events_biz_decision_occurred_idx",
    ).on(table.bizId, table.decision, table.occurredAt),

    phiAccessEventsBizSubjectOccurredIdx: index(
      "phi_access_events_biz_subject_occurred_idx",
    ).on(table.bizId, table.subjectUserId, table.subjectGroupAccountId, table.occurredAt),

    phiAccessEventsBizActorOccurredIdx: index("phi_access_events_biz_actor_occurred_idx").on(
      table.bizId,
      table.actorUserId,
      table.occurredAt,
    ),

    phiAccessEventsBizPolicyFk: foreignKey({
      columns: [table.bizId, table.phiAccessPolicyId],
      foreignColumns: [phiAccessPolicies.bizId, phiAccessPolicies.id],
      name: "phi_access_events_biz_policy_fk",
    }),

    phiAccessEventsBizAuthorizationFk: foreignKey({
      columns: [table.bizId, table.hipaaAuthorizationId],
      foreignColumns: [hipaaAuthorizations.bizId, hipaaAuthorizations.id],
      name: "phi_access_events_biz_authorization_fk",
    }),

    phiAccessEventsSubjectPointerCheck: check(
      "phi_access_events_subject_pointer_check",
      sql`
      "subject_user_id" IS NOT NULL
      OR "subject_group_account_id" IS NOT NULL
      OR "subject_external_ref" IS NOT NULL
      `,
    ),

    phiAccessEventsBreakGlassReasonCheck: check(
      "phi_access_events_break_glass_reason_check",
      sql`
      ("is_break_glass" = false)
      OR ("is_break_glass" = true AND length(trim(coalesce("break_glass_reason", ''))) > 0)
      `,
    ),
  }),
);

/**
 * security_incidents
 *
 * ELI5:
 * Tracks security/compliance incidents (especially PHI-related) from detection
 * through containment and closure.
 */
export const securityIncidents = pgTable(
  "security_incidents",
  {
    id: idWithTag("sec_incident"),
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),
    complianceProfileId: idRef("compliance_profile_id").references(
      () => tenantComplianceProfiles.id,
    ),

    incidentType: securityIncidentTypeEnum("incident_type").notNull(),
    severity: securityIncidentSeverityEnum("severity").default("medium").notNull(),
    status: securityIncidentStatusEnum("status").default("open").notNull(),

    summary: varchar("summary", { length: 800 }).notNull(),
    details: jsonb("details").default({}).notNull(),
    affectedRecordsCount: integer("affected_records_count"),

    reportedByUserId: idRef("reported_by_user_id").references(() => users.id),
    detectedAt: timestamp("detected_at", { withTimezone: true }).defaultNow().notNull(),
    containedAt: timestamp("contained_at", { withTimezone: true }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    closedAt: timestamp("closed_at", { withTimezone: true }),

    metadata: jsonb("metadata").default({}),
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    securityIncidentsBizIdIdUnique: uniqueIndex("security_incidents_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),

    securityIncidentsBizStatusDetectedIdx: index(
      "security_incidents_biz_status_detected_idx",
    ).on(table.bizId, table.status, table.detectedAt),

    securityIncidentsBizSeverityDetectedIdx: index(
      "security_incidents_biz_severity_detected_idx",
    ).on(table.bizId, table.severity, table.detectedAt),

    securityIncidentsBizComplianceProfileFk: foreignKey({
      columns: [table.bizId, table.complianceProfileId],
      foreignColumns: [tenantComplianceProfiles.bizId, tenantComplianceProfiles.id],
      name: "security_incidents_biz_compliance_profile_fk",
    }),

    securityIncidentsTimelineCheck: check(
      "security_incidents_timeline_check",
      sql`
      ("affected_records_count" IS NULL OR "affected_records_count" >= 0)
      AND ("contained_at" IS NULL OR "contained_at" >= "detected_at")
      AND ("resolved_at" IS NULL OR "resolved_at" >= "detected_at")
      AND ("closed_at" IS NULL OR "resolved_at" IS NULL OR "closed_at" >= "resolved_at")
      `,
    ),
  }),
);

/**
 * break_glass_reviews
 *
 * ELI5:
 * Every emergency PHI access should be reviewed after the emergency.
 * This table captures that follow-up review decision.
 */
export const breakGlassReviews = pgTable(
  "break_glass_reviews",
  {
    id: idWithTag("break_glass_review"),
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),
    phiAccessEventId: idRef("phi_access_event_id")
      .references(() => phiAccessEvents.id)
      .notNull(),

    status: breakGlassReviewStatusEnum("status").default("pending").notNull(),
    reviewerUserId: idRef("reviewer_user_id").references(() => users.id),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    summary: text("summary"),

    /** Optional incident linkage if review identified a potential breach/event. */
    securityIncidentId: idRef("security_incident_id").references(
      () => securityIncidents.id,
    ),

    metadata: jsonb("metadata").default({}),
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    breakGlassReviewsBizIdIdUnique: uniqueIndex("break_glass_reviews_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** One review row per break-glass access event. */
    breakGlassReviewsBizAccessEventUnique: uniqueIndex(
      "break_glass_reviews_biz_access_event_unique",
    )
      .on(table.bizId, table.phiAccessEventId)
      .where(sql`"deleted_at" IS NULL`),

    breakGlassReviewsBizStatusReviewedIdx: index(
      "break_glass_reviews_biz_status_reviewed_idx",
    ).on(table.bizId, table.status, table.reviewedAt),

    breakGlassReviewsBizAccessEventFk: foreignKey({
      columns: [table.bizId, table.phiAccessEventId],
      foreignColumns: [phiAccessEvents.bizId, phiAccessEvents.id],
      name: "break_glass_reviews_biz_access_event_fk",
    }),

    breakGlassReviewsBizIncidentFk: foreignKey({
      columns: [table.bizId, table.securityIncidentId],
      foreignColumns: [securityIncidents.bizId, securityIncidents.id],
      name: "break_glass_reviews_biz_incident_fk",
    }),

    /** Non-pending reviews must carry reviewer and timestamp. */
    breakGlassReviewsDecisionShapeCheck: check(
      "break_glass_reviews_decision_shape_check",
      sql`
      (
        "status" = 'pending'
      ) OR (
        "status" <> 'pending'
        AND "reviewer_user_id" IS NOT NULL
        AND "reviewed_at" IS NOT NULL
      )
      `,
    ),
  }),
);

/**
 * phi_disclosure_events
 *
 * ELI5:
 * Accounting-of-disclosures ledger for PHI sharing.
 *
 * This supports:
 * - compliance reporting,
 * - patient disclosure history requests,
 * - linkage to authorization and BAA records.
 */
export const phiDisclosureEvents = pgTable(
  "phi_disclosure_events",
  {
    id: idWithTag("phi_disclosure"),
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),
    complianceProfileId: idRef("compliance_profile_id").references(
      () => tenantComplianceProfiles.id,
    ),

    subjectUserId: idRef("subject_user_id").references(() => users.id),
    subjectGroupAccountId: idRef("subject_group_account_id").references(
      () => groupAccounts.id,
    ),
    subjectExternalRef: varchar("subject_external_ref", { length: 200 }),

    disclosedByUserId: idRef("disclosed_by_user_id").references(() => users.id),
    recipientType: disclosureRecipientTypeEnum("recipient_type").notNull(),
    recipientName: varchar("recipient_name", { length: 260 }).notNull(),
    recipientRef: varchar("recipient_ref", { length: 200 }),

    purposeOfUse: hipaaPurposeOfUseEnum("purpose_of_use").notNull(),
    disclosedAt: timestamp("disclosed_at", { withTimezone: true }).defaultNow().notNull(),

    dataClasses: jsonb("data_classes").default([]).notNull(),
    legalBasis: varchar("legal_basis", { length: 220 }),
    isTpoExempt: boolean("is_tpo_exempt").default(false).notNull(),

    hipaaAuthorizationId: idRef("hipaa_authorization_id").references(
      () => hipaaAuthorizations.id,
    ),
    businessAssociateAgreementId: idRef("business_associate_agreement_id").references(
      () => businessAssociateAgreements.id,
    ),

    requestRef: varchar("request_ref", { length: 200 }),
    metadata: jsonb("metadata").default({}),
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    phiDisclosureEventsBizIdIdUnique: uniqueIndex("phi_disclosure_events_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    phiDisclosureEventsBizSubjectDisclosedIdx: index(
      "phi_disclosure_events_biz_subject_disclosed_idx",
    ).on(table.bizId, table.subjectUserId, table.subjectGroupAccountId, table.disclosedAt),

    phiDisclosureEventsBizRecipientDisclosedIdx: index(
      "phi_disclosure_events_biz_recipient_disclosed_idx",
    ).on(table.bizId, table.recipientType, table.disclosedAt),

    phiDisclosureEventsBizComplianceProfileFk: foreignKey({
      columns: [table.bizId, table.complianceProfileId],
      foreignColumns: [tenantComplianceProfiles.bizId, tenantComplianceProfiles.id],
      name: "phi_disclosure_events_biz_compliance_profile_fk",
    }),

    phiDisclosureEventsBizAuthorizationFk: foreignKey({
      columns: [table.bizId, table.hipaaAuthorizationId],
      foreignColumns: [hipaaAuthorizations.bizId, hipaaAuthorizations.id],
      name: "phi_disclosure_events_biz_authorization_fk",
    }),

    phiDisclosureEventsBizBaaFk: foreignKey({
      columns: [table.bizId, table.businessAssociateAgreementId],
      foreignColumns: [businessAssociateAgreements.bizId, businessAssociateAgreements.id],
      name: "phi_disclosure_events_biz_baa_fk",
    }),

    phiDisclosureEventsSubjectPointerCheck: check(
      "phi_disclosure_events_subject_pointer_check",
      sql`
      "subject_user_id" IS NOT NULL
      OR "subject_group_account_id" IS NOT NULL
      OR "subject_external_ref" IS NOT NULL
      `,
    ),
  }),
);

/**
 * breach_notifications
 *
 * ELI5:
 * Task/ledger rows for breach notification obligations.
 *
 * One security incident can require multiple notifications:
 * - affected individuals,
 * - regulator,
 * - media,
 * - business associates.
 */
export const breachNotifications = pgTable(
  "breach_notifications",
  {
    id: idWithTag("breach_notice"),
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),
    securityIncidentId: idRef("security_incident_id")
      .references(() => securityIncidents.id)
      .notNull(),

    recipientType: breachNotificationRecipientTypeEnum("recipient_type").notNull(),
    recipientName: varchar("recipient_name", { length: 260 }),
    recipientRef: varchar("recipient_ref", { length: 200 }),

    channel: communicationChannelEnum("channel").default("email").notNull(),
    status: breachNotificationStatusEnum("status").default("draft").notNull(),

    dueAt: timestamp("due_at", { withTimezone: true }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    failureReason: text("failure_reason"),

    /** Outbound payload snapshot and external delivery ids. */
    payload: jsonb("payload").default({}).notNull(),
    deliveryRef: varchar("delivery_ref", { length: 240 }),

    metadata: jsonb("metadata").default({}),
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    breachNotificationsBizIdIdUnique: uniqueIndex("breach_notifications_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    breachNotificationsBizIncidentStatusIdx: index(
      "breach_notifications_biz_incident_status_idx",
    ).on(table.bizId, table.securityIncidentId, table.status),

    breachNotificationsBizDueIdx: index("breach_notifications_biz_due_idx").on(
      table.bizId,
      table.dueAt,
      table.status,
    ),

    breachNotificationsBizIncidentFk: foreignKey({
      columns: [table.bizId, table.securityIncidentId],
      foreignColumns: [securityIncidents.bizId, securityIncidents.id],
      name: "breach_notifications_biz_incident_fk",
    }),

    /** Sent status must include sent timestamp. */
    breachNotificationsSentShapeCheck: check(
      "breach_notifications_sent_shape_check",
      sql`
      ("status" <> 'sent')
      OR ("status" = 'sent' AND "sent_at" IS NOT NULL)
      `,
    ),
  }),
);

export type BusinessAssociateAgreement =
  typeof businessAssociateAgreements.$inferSelect;
export type NewBusinessAssociateAgreement =
  typeof businessAssociateAgreements.$inferInsert;

export type HipaaAuthorization = typeof hipaaAuthorizations.$inferSelect;
export type NewHipaaAuthorization = typeof hipaaAuthorizations.$inferInsert;

export type PhiAccessPolicy = typeof phiAccessPolicies.$inferSelect;
export type NewPhiAccessPolicy = typeof phiAccessPolicies.$inferInsert;

export type PhiAccessEvent = typeof phiAccessEvents.$inferSelect;
export type NewPhiAccessEvent = typeof phiAccessEvents.$inferInsert;

export type SecurityIncident = typeof securityIncidents.$inferSelect;
export type NewSecurityIncident = typeof securityIncidents.$inferInsert;

export type BreakGlassReview = typeof breakGlassReviews.$inferSelect;
export type NewBreakGlassReview = typeof breakGlassReviews.$inferInsert;

export type PhiDisclosureEvent = typeof phiDisclosureEvents.$inferSelect;
export type NewPhiDisclosureEvent = typeof phiDisclosureEvents.$inferInsert;

export type BreachNotification = typeof breachNotifications.$inferSelect;
export type NewBreachNotification = typeof breachNotifications.$inferInsert;
