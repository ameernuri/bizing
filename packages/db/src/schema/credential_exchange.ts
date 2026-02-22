import { sql } from "drizzle-orm";
import { check, foreignKey, index, pgTable, uniqueIndex } from "drizzle-orm/pg-core";
import {
  boolean,
  date,
  integer,
  jsonb,
  numeric,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { createdAt, idRef, idWithTag, withAuditRefs } from "./_common";
import { bizes } from "./bizes";
import { lifecycleStatusEnum } from "./enums";
import { subjects } from "./subjects";
import { users } from "./users";

/**
 * credential_type_definitions
 *
 * ELI5:
 * This is the platform's shared dictionary of credential kinds.
 *
 * Why this table exists:
 * - Different industries use different language for similar qualifications.
 * - A shared dictionary gives us consistent filtering/reporting keys.
 * - Users can still provide custom keys when a definition does not exist yet.
 *
 * Examples:
 * - key: `drivers_license`
 * - key: `background_check`
 * - key: `rn_license`
 * - key: `osha_10`
 */
export const credentialTypeDefinitions = pgTable(
  "credential_type_definitions",
  {
    /** Stable primary key for one credential type dictionary row. */
    id: idWithTag("credential_type"),

    /** Stable machine key used by APIs/filtering. */
    key: varchar("key", { length: 120 }).notNull(),

    /** Human-readable label for admin/candidate UIs. */
    name: varchar("name", { length: 220 }).notNull(),

    /** Optional broad category for grouped filtering. */
    category: varchar("category", { length: 80 }),

    /** Optional explanation of what this credential type means. */
    description: varchar("description", { length: 1000 }),

    /** Lifecycle state for dictionary governance. */
    status: lifecycleStatusEnum("status").default("active").notNull(),

    /** True when seeded/owned by platform default packs. */
    isSystem: boolean("is_system").default(false).notNull(),

    /** Extension payload for additional metadata (icons, aliases, etc.). */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** One dictionary key per deployment. */
    credentialTypeDefinitionsKeyUnique: uniqueIndex(
      "credential_type_definitions_key_unique",
    ).on(table.key),

    /** Common listing path for active dictionary records. */
    credentialTypeDefinitionsStatusIdx: index(
      "credential_type_definitions_status_idx",
    ).on(table.status, table.category),

    /** Prevent empty-string keys. */
    credentialTypeDefinitionsKeyCheck: check(
      "credential_type_definitions_key_check",
      sql`length("key") > 0`,
    ),
  }),
);

/**
 * user_credential_profiles
 *
 * ELI5:
 * One row = one person's credential-sharing profile settings.
 *
 * This is where a user controls marketplace discoverability defaults and
 * inbound request policy before any specific business grant is created.
 */
export const userCredentialProfiles = pgTable(
  "user_credential_profiles",
  {
    /** Stable primary key. */
    id: idWithTag("credential_profile"),

    /** User who owns this portable credential profile. */
    ownerUserId: idRef("owner_user_id")
      .references(() => users.id)
      .notNull(),

    /** Profile lifecycle state (active/disabled/etc.). */
    status: lifecycleStatusEnum("status").default("active").notNull(),

    /**
     * If true, safe marketplace-summary facts can be used in candidate discovery
     * filters without opening full document access.
     */
    allowMarketplaceDiscovery: boolean("allow_marketplace_discovery")
      .default(false)
      .notNull(),

    /** If true, businesses can send credential requests to this user. */
    allowInboundCredentialRequests: boolean("allow_inbound_credential_requests")
      .default(true)
      .notNull(),

    /**
     * Default grant access level suggested when a new business asks for share.
     *
     * Values:
     * - `existence_only`: biz can only know that credential exists.
     * - `summary`: biz can see sanitized summary fields.
     * - `facts`: biz can filter on approved facts.
     * - `documents`: biz can preview/download according to flags.
     * - `full`: full row-level visibility.
     */
    defaultGrantAccessLevel: varchar("default_grant_access_level", { length: 60 })
      .default("summary")
      .notNull(),

    /**
     * Default grant scope model for new business shares.
     *
     * Values:
     * - `all_records`
     * - `selected_records`
     * - `selected_types`
     */
    defaultGrantScope: varchar("default_grant_scope", { length: 60 })
      .default("selected_records")
      .notNull(),

    /** Public-safe candidate profile snapshot (headline, specialties, etc.). */
    publicSummary: jsonb("public_summary").default({}).notNull(),

    /** User preference knobs for request handling and review queues. */
    preferences: jsonb("preferences").default({}).notNull(),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** One profile row per user. */
    userCredentialProfilesOwnerUnique: uniqueIndex(
      "user_credential_profiles_owner_unique",
    ).on(table.ownerUserId),

    /** Listing path for candidate discovery/profile moderation. */
    userCredentialProfilesStatusDiscoveryIdx: index(
      "user_credential_profiles_status_discovery_idx",
    ).on(table.status, table.allowMarketplaceDiscovery, table.allowInboundCredentialRequests),

    /** Access-level vocabulary guard. */
    userCredentialProfilesAccessLevelCheck: check(
      "user_credential_profiles_access_level_check",
      sql`
      "default_grant_access_level" IN ('existence_only', 'summary', 'facts', 'documents', 'full')
      OR "default_grant_access_level" LIKE 'custom_%'
      `,
    ),

    /** Scope vocabulary guard. */
    userCredentialProfilesScopeCheck: check(
      "user_credential_profiles_scope_check",
      sql`
      "default_grant_scope" IN ('all_records', 'selected_records', 'selected_types')
      OR "default_grant_scope" LIKE 'custom_%'
      `,
    ),
  }),
);

/**
 * user_credential_records
 *
 * ELI5:
 * One row = one credential that belongs to one user globally, not to one biz.
 *
 * Why this matters:
 * - user uploads once,
 * - user can share to many businesses using explicit grants,
 * - businesses can filter candidates on approved facts without copying data
 *   into each biz tenant.
 *
 * Security/RLS note:
 * - this table is intentionally user-portable (no `biz_id`),
 * - row access should be enforced by `owner_user_id` ownership, or by explicit
 *   active grants from `biz_credential_share_grants`.
 */
export const userCredentialRecords = pgTable(
  "user_credential_records",
  {
    /** Stable primary key. */
    id: idWithTag("credential"),

    /** User who owns this credential record. */
    ownerUserId: idRef("owner_user_id")
      .references(() => users.id)
      .notNull(),

    /** Optional pointer into global credential type dictionary. */
    credentialTypeDefinitionId: idRef("credential_type_definition_id").references(
      () => credentialTypeDefinitions.id,
    ),

    /** Machine key for broad credential class. */
    credentialTypeKey: varchar("credential_type_key", { length: 120 }).notNull(),

    /**
     * Specific credential key in that type family.
     * Example:
     * - type: `license`
     * - key: `drivers_license_class_c`
     */
    credentialKey: varchar("credential_key", { length: 140 }).notNull(),

    /** Human-readable display name shown in profile and request UIs. */
    displayName: varchar("display_name", { length: 260 }),

    /** Issuer name (DMV board, certification body, provider, etc.). */
    issuerName: varchar("issuer_name", { length: 260 }),

    /** Optional issuer country code for jurisdiction filtering. */
    issuerCountry: varchar("issuer_country", { length: 2 }),

    /** Optional issuer region/state code. */
    issuerRegion: varchar("issuer_region", { length: 16 }),

    /**
     * Optional hash of sensitive number/identifier.
     *
     * Store hash, not raw credential number, to keep privacy posture strong
     * while still enabling duplicate-detection workflows.
     */
    credentialNumberHash: varchar("credential_number_hash", { length: 255 }),

    /** Issuance timestamp when known. */
    issuedAt: timestamp("issued_at", { withTimezone: true }),

    /** Expiry timestamp when known. */
    expiresAt: timestamp("expires_at", { withTimezone: true }),

    /** Record lifecycle status. */
    status: varchar("status", { length: 60 }).default("active").notNull(),

    /** Verification status independent from lifecycle status. */
    verificationStatus: varchar("verification_status", { length: 60 })
      .default("unverified")
      .notNull(),

    /** Last successful verification timestamp. */
    lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true }),

    /** Optional recommended next reverification timestamp. */
    nextReverificationAt: timestamp("next_reverification_at", { withTimezone: true }),

    /**
     * Visibility in candidate discovery/filter surfaces.
     *
     * - `private`: hidden from discovery and grants by default.
     * - `grant_required`: only visible when user grants business access.
     * - `marketplace_summary`: safe summary can power marketplace filters.
     */
    discoveryVisibility: varchar("discovery_visibility", { length: 60 })
      .default("grant_required")
      .notNull(),

    /** Master toggle to allow/deny sharing this credential. */
    isShareable: boolean("is_shareable").default(true).notNull(),

    /** Safe summary payload used by grant/marketplace projection logic. */
    summary: jsonb("summary").default({}).notNull(),

    /** Structured attributes (class level, restrictions, notes, etc.). */
    attributes: jsonb("attributes").default({}).notNull(),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite key used by owner-safe child FKs. */
    userCredentialRecordsOwnerIdUnique: uniqueIndex(
      "user_credential_records_owner_id_unique",
    ).on(table.ownerUserId, table.id),

    /** Helps avoid duplicate active records for same user/type/key. */
    userCredentialRecordsOwnerTypeKeyUnique: uniqueIndex(
      "user_credential_records_owner_type_key_unique",
    )
      .on(table.ownerUserId, table.credentialTypeKey, table.credentialKey)
      .where(sql`"deleted_at" IS NULL`),

    /** Main query path for owner credential timeline. */
    userCredentialRecordsOwnerStatusExpiryIdx: index(
      "user_credential_records_owner_status_expiry_idx",
    ).on(table.ownerUserId, table.status, table.verificationStatus, table.expiresAt),

    /** Discovery/filter path for marketplace candidate matching. */
    userCredentialRecordsDiscoveryIdx: index("user_credential_records_discovery_idx").on(
      table.discoveryVisibility,
      table.status,
      table.verificationStatus,
      table.expiresAt,
    ),

    /** Optional pointer integrity to dictionary row. */
    userCredentialRecordsTypeDefinitionFk: foreignKey({
      columns: [table.credentialTypeDefinitionId],
      foreignColumns: [credentialTypeDefinitions.id],
      name: "user_credential_records_type_definition_fk",
    }),

    /** Non-empty machine keys for deterministic querying. */
    userCredentialRecordsKeyCheck: check(
      "user_credential_records_key_check",
      sql`length("credential_type_key") > 0 AND length("credential_key") > 0`,
    ),

    /** Record status vocabulary guard. */
    userCredentialRecordsStatusCheck: check(
      "user_credential_records_status_check",
      sql`
      "status" IN ('draft', 'active', 'expired', 'revoked', 'rejected')
      OR "status" LIKE 'custom_%'
      `,
    ),

    /** Verification status vocabulary guard. */
    userCredentialRecordsVerificationStatusCheck: check(
      "user_credential_records_verification_status_check",
      sql`
      "verification_status" IN ('unverified', 'pending', 'verified', 'rejected', 'expired', 'revoked')
      OR "verification_status" LIKE 'custom_%'
      `,
    ),

    /** Discovery visibility vocabulary guard. */
    userCredentialRecordsDiscoveryVisibilityCheck: check(
      "user_credential_records_discovery_visibility_check",
      sql`
      "discovery_visibility" IN ('private', 'grant_required', 'marketplace_summary')
      OR "discovery_visibility" LIKE 'custom_%'
      `,
    ),

    /** Timeline ordering rules. */
    userCredentialRecordsTimelineCheck: check(
      "user_credential_records_timeline_check",
      sql`
      ("issued_at" IS NULL OR "expires_at" IS NULL OR "expires_at" >= "issued_at")
      AND ("last_verified_at" IS NULL OR "issued_at" IS NULL OR "last_verified_at" >= "issued_at")
      AND (
        "next_reverification_at" IS NULL
        OR "last_verified_at" IS NULL
        OR "next_reverification_at" >= "last_verified_at"
      )
      `,
    ),

    /** Country code format guard for deterministic filters when present. */
    userCredentialRecordsCountryFormatCheck: check(
      "user_credential_records_country_format_check",
      sql`"issuer_country" IS NULL OR "issuer_country" ~ '^[A-Z]{2}$'`,
    ),
  }),
);

/**
 * user_credential_documents
 *
 * ELI5:
 * One credential can have many attached files (front image, back image,
 * certificate PDF, transcript, background report, etc.).
 *
 * Privacy posture:
 * - this table stores storage references and metadata,
 * - access is controlled by user->biz share grants,
 * - preview/download permissions are policy-driven.
 */
export const userCredentialDocuments = pgTable(
  "user_credential_documents",
  {
    /** Stable primary key. */
    id: idWithTag("credential_doc"),

    /** Owner boundary for ownership-safe FKs. */
    ownerUserId: idRef("owner_user_id")
      .references(() => users.id)
      .notNull(),

    /** Parent credential record. */
    userCredentialRecordId: idRef("user_credential_record_id")
      .references(() => userCredentialRecords.id)
      .notNull(),

    /** Document class. */
    documentType: varchar("document_type", { length: 80 }).notNull(),

    /** Opaque file/blob pointer (S3 key, object id, vault reference, etc.). */
    storageRef: varchar("storage_ref", { length: 700 }).notNull(),

    /** Optional original filename. */
    fileName: varchar("file_name", { length: 260 }),

    /** Optional mime type for render/scan behavior. */
    mimeType: varchar("mime_type", { length: 160 }),

    /** Optional file size in bytes. */
    fileSizeBytes: integer("file_size_bytes"),

    /** Optional hash for integrity verification. */
    sha256: varchar("sha256", { length: 128 }),

    /** Capture/import timestamp. */
    capturedAt: timestamp("captured_at", { withTimezone: true }).defaultNow().notNull(),

    /** Capture source channel. */
    sourceType: varchar("source_type", { length: 60 }).default("upload").notNull(),

    /** Data sensitivity class used by disclosure policy engines. */
    sensitivityClass: varchar("sensitivity_class", { length: 60 })
      .default("restricted")
      .notNull(),

    /** Preview mode allowed when grants permit document visibility. */
    previewPolicy: varchar("preview_policy", { length: 60 }).default("redacted").notNull(),

    /** Primary file marker for UI defaults. */
    isPrimary: boolean("is_primary").default(false).notNull(),

    /** File lifecycle status. */
    status: lifecycleStatusEnum("status").default("active").notNull(),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite key used by owner-safe event FKs. */
    userCredentialDocumentsOwnerIdUnique: uniqueIndex(
      "user_credential_documents_owner_id_unique",
    ).on(table.ownerUserId, table.id),

    /** Fast listing path for one credential's document set. */
    userCredentialDocumentsOwnerRecordIdx: index(
      "user_credential_documents_owner_record_idx",
    ).on(table.ownerUserId, table.userCredentialRecordId, table.capturedAt),

    /** Fast lookup by document class and lifecycle. */
    userCredentialDocumentsOwnerTypeStatusIdx: index(
      "user_credential_documents_owner_type_status_idx",
    ).on(table.ownerUserId, table.documentType, table.status),

    /** One primary doc per credential record (optional). */
    userCredentialDocumentsPrimaryPerRecordUnique: uniqueIndex(
      "user_credential_documents_primary_per_record_unique",
    )
      .on(table.ownerUserId, table.userCredentialRecordId)
      .where(sql`"is_primary" = true AND "deleted_at" IS NULL`),

    /** Owner-safe FK to parent credential record. */
    userCredentialDocumentsOwnerRecordFk: foreignKey({
      columns: [table.ownerUserId, table.userCredentialRecordId],
      foreignColumns: [userCredentialRecords.ownerUserId, userCredentialRecords.id],
      name: "user_credential_documents_owner_record_fk",
    }),

    /** File size non-negative when present. */
    userCredentialDocumentsFileSizeCheck: check(
      "user_credential_documents_file_size_check",
      sql`"file_size_bytes" IS NULL OR "file_size_bytes" >= 0`,
    ),

    /** Non-empty storage reference for deterministic retrieval. */
    userCredentialDocumentsStorageRefCheck: check(
      "user_credential_documents_storage_ref_check",
      sql`length("storage_ref") > 0`,
    ),

    /** Document/source vocabulary guards. */
    userCredentialDocumentsDocumentTypeCheck: check(
      "user_credential_documents_document_type_check",
      sql`
      "document_type" IN (
        'front_image',
        'back_image',
        'certificate_pdf',
        'transcript_pdf',
        'background_report',
        'identity_scan',
        'verification_attachment',
        'other'
      ) OR "document_type" LIKE 'custom_%'
      `,
    ),

    userCredentialDocumentsSourceTypeCheck: check(
      "user_credential_documents_source_type_check",
      sql`
      "source_type" IN ('upload', 'import', 'issuer_api', 'verification_provider')
      OR "source_type" LIKE 'custom_%'
      `,
    ),

    userCredentialDocumentsSensitivityClassCheck: check(
      "user_credential_documents_sensitivity_class_check",
      sql`
      "sensitivity_class" IN ('normal', 'sensitive', 'restricted')
      OR "sensitivity_class" LIKE 'custom_%'
      `,
    ),

    userCredentialDocumentsPreviewPolicyCheck: check(
      "user_credential_documents_preview_policy_check",
      sql`
      "preview_policy" IN ('none', 'redacted', 'full')
      OR "preview_policy" LIKE 'custom_%'
      `,
    ),
  }),
);

/**
 * user_credential_facts
 *
 * ELI5:
 * This is the normalized, filterable fact table for credentials.
 *
 * Why not only JSON:
 * - candidate filtering needs fast, indexable predicates,
 * - one table supports text/number/date/boolean filters consistently,
 * - businesses can filter only on facts users choose to expose.
 */
export const userCredentialFacts = pgTable(
  "user_credential_facts",
  {
    /** Stable primary key. */
    id: idWithTag("credential_fact"),

    /** Owner boundary. */
    ownerUserId: idRef("owner_user_id")
      .references(() => users.id)
      .notNull(),

    /** Parent credential record. */
    userCredentialRecordId: idRef("user_credential_record_id")
      .references(() => userCredentialRecords.id)
      .notNull(),

    /** Machine key for this fact dimension. */
    factKey: varchar("fact_key", { length: 120 }).notNull(),

    /** Optional normalized key value for enum-like comparisons. */
    valueKey: varchar("value_key", { length: 120 }),

    /** Optional text projection. */
    valueText: varchar("value_text", { length: 500 }),

    /** Optional numeric projection. */
    valueNumber: numeric("value_number", { precision: 24, scale: 8 }),

    /** Optional boolean projection. */
    valueBoolean: boolean("value_boolean"),

    /** Optional date projection. */
    valueDate: date("value_date"),

    /** Optional timestamp projection. */
    valueTimestamp: timestamp("value_timestamp", { withTimezone: true }),

    /**
     * Visibility for this fact.
     *
     * - `private`: only owner and system.
     * - `grant_required`: visible only when grant allows facts.
     * - `marketplace_summary`: can be used in discovery filtering.
     */
    visibilityMode: varchar("visibility_mode", { length: 60 })
      .default("grant_required")
      .notNull(),

    /** Marks whether this fact should be used in candidate filters. */
    isFilterable: boolean("is_filterable").default(true).notNull(),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Main expansion path for one credential record's fact set. */
    userCredentialFactsOwnerRecordIdx: index("user_credential_facts_owner_record_idx").on(
      table.ownerUserId,
      table.userCredentialRecordId,
      table.factKey,
    ),

    /** Candidate filtering path for text dimensions. */
    userCredentialFactsFilterTextIdx: index("user_credential_facts_filter_text_idx").on(
      table.visibilityMode,
      table.isFilterable,
      table.factKey,
      table.valueKey,
      table.valueText,
    ),

    /** Candidate filtering path for numeric dimensions. */
    userCredentialFactsFilterNumberIdx: index(
      "user_credential_facts_filter_number_idx",
    ).on(table.visibilityMode, table.isFilterable, table.factKey, table.valueNumber),

    /** Candidate filtering path for date dimensions. */
    userCredentialFactsFilterDateIdx: index("user_credential_facts_filter_date_idx").on(
      table.visibilityMode,
      table.isFilterable,
      table.factKey,
      table.valueDate,
    ),

    /** Owner-safe FK to parent credential record. */
    userCredentialFactsOwnerRecordFk: foreignKey({
      columns: [table.ownerUserId, table.userCredentialRecordId],
      foreignColumns: [userCredentialRecords.ownerUserId, userCredentialRecords.id],
      name: "user_credential_facts_owner_record_fk",
    }),

    /** Non-empty fact keys. */
    userCredentialFactsFactKeyCheck: check(
      "user_credential_facts_fact_key_check",
      sql`length("fact_key") > 0`,
    ),

    /** At least one value projection must be present. */
    userCredentialFactsValueShapeCheck: check(
      "user_credential_facts_value_shape_check",
      sql`
      ("value_key" IS NOT NULL)::int
      + ("value_text" IS NOT NULL)::int
      + ("value_number" IS NOT NULL)::int
      + ("value_boolean" IS NOT NULL)::int
      + ("value_date" IS NOT NULL)::int
      + ("value_timestamp" IS NOT NULL)::int
      >= 1
      `,
    ),

    /** Visibility vocabulary guard. */
    userCredentialFactsVisibilityModeCheck: check(
      "user_credential_facts_visibility_mode_check",
      sql`
      "visibility_mode" IN ('private', 'grant_required', 'marketplace_summary')
      OR "visibility_mode" LIKE 'custom_%'
      `,
    ),
  }),
);

/**
 * user_credential_verifications
 *
 * ELI5:
 * This table tracks trust decisions for credentials over time.
 *
 * One record can have many verification rows (manual checks, issuer API checks,
 * periodic re-checks, rejection/revocation decisions).
 */
export const userCredentialVerifications = pgTable(
  "user_credential_verifications",
  {
    /** Stable primary key. */
    id: idWithTag("credential_verification"),

    /** Owner boundary. */
    ownerUserId: idRef("owner_user_id")
      .references(() => users.id)
      .notNull(),

    /** Parent credential record. */
    userCredentialRecordId: idRef("user_credential_record_id")
      .references(() => userCredentialRecords.id)
      .notNull(),

    /** Optional supporting document row. */
    userCredentialDocumentId: idRef("user_credential_document_id").references(
      () => userCredentialDocuments.id,
    ),

    /** Verifier actor class. */
    verifierType: varchar("verifier_type", { length: 60 }).default("system").notNull(),

    /** Optional verifier business. */
    verifierBizId: idRef("verifier_biz_id").references(() => bizes.id),

    /** Optional verifier user (manual review workflows). */
    verifierUserId: idRef("verifier_user_id").references(() => users.id),

    /** Verification method class. */
    method: varchar("method", { length: 80 }).default("manual_review").notNull(),

    /** Decision status for this verification row. */
    status: varchar("status", { length: 60 }).default("pending").notNull(),

    /** Optional confidence score for ranking/risk logic. */
    confidenceScore: integer("confidence_score"),

    /** Verification request timestamp. */
    requestedAt: timestamp("requested_at", { withTimezone: true }).defaultNow().notNull(),

    /** Decision timestamp. */
    decidedAt: timestamp("decided_at", { withTimezone: true }),

    /** Effective verification timestamp. */
    verifiedAt: timestamp("verified_at", { withTimezone: true }),

    /** Optional verification expiry timestamp. */
    expiresAt: timestamp("expires_at", { withTimezone: true }),

    /** Optional plain-language summary for operators and users. */
    summary: varchar("summary", { length: 1000 }),

    /** Structured evidence payload (provider refs, response snapshots, etc.). */
    evidence: jsonb("evidence").default({}).notNull(),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Main verification timeline path for one credential. */
    userCredentialVerificationsOwnerRecordRequestedIdx: index(
      "user_credential_verifications_owner_record_requested_idx",
    ).on(table.ownerUserId, table.userCredentialRecordId, table.requestedAt),

    /** Common business reviewer queue path. */
    userCredentialVerificationsVerifierBizStatusIdx: index(
      "user_credential_verifications_verifier_biz_status_idx",
    ).on(table.verifierBizId, table.status, table.requestedAt),

    /** Owner-safe FK to parent credential record. */
    userCredentialVerificationsOwnerRecordFk: foreignKey({
      columns: [table.ownerUserId, table.userCredentialRecordId],
      foreignColumns: [userCredentialRecords.ownerUserId, userCredentialRecords.id],
      name: "user_credential_verifications_owner_record_fk",
    }),

    /** Owner-safe FK to optional document row. */
    userCredentialVerificationsOwnerDocumentFk: foreignKey({
      columns: [table.ownerUserId, table.userCredentialDocumentId],
      foreignColumns: [userCredentialDocuments.ownerUserId, userCredentialDocuments.id],
      name: "user_credential_verifications_owner_document_fk",
    }),

    /** Confidence bounds for deterministic ranking semantics. */
    userCredentialVerificationsConfidenceCheck: check(
      "user_credential_verifications_confidence_check",
      sql`
      "confidence_score" IS NULL
      OR ("confidence_score" >= 0 AND "confidence_score" <= 100)
      `,
    ),

    /** Verifier type vocabulary guard. */
    userCredentialVerificationsVerifierTypeCheck: check(
      "user_credential_verifications_verifier_type_check",
      sql`
      "verifier_type" IN ('system', 'biz', 'user', 'issuer', 'provider')
      OR "verifier_type" LIKE 'custom_%'
      `,
    ),

    /** Method vocabulary guard. */
    userCredentialVerificationsMethodCheck: check(
      "user_credential_verifications_method_check",
      sql`
      "method" IN ('manual_review', 'document_scan', 'issuer_api', 'background_check', 'reference_check')
      OR "method" LIKE 'custom_%'
      `,
    ),

    /** Status vocabulary guard. */
    userCredentialVerificationsStatusCheck: check(
      "user_credential_verifications_status_check",
      sql`
      "status" IN ('pending', 'verified', 'rejected', 'expired', 'revoked')
      OR "status" LIKE 'custom_%'
      `,
    ),

    /** Timeline coherence guard. */
    userCredentialVerificationsTimelineCheck: check(
      "user_credential_verifications_timeline_check",
      sql`
      ("decided_at" IS NULL OR "decided_at" >= "requested_at")
      AND ("verified_at" IS NULL OR "verified_at" >= "requested_at")
      AND (
        "expires_at" IS NULL
        OR "verified_at" IS NULL
        OR "expires_at" >= "verified_at"
      )
      `,
    ),

    /** Verifier-pointer consistency guard. */
    userCredentialVerificationsVerifierPointerCheck: check(
      "user_credential_verifications_verifier_pointer_check",
      sql`
      (
        "verifier_type" = 'biz'
        AND "verifier_biz_id" IS NOT NULL
      ) OR (
        "verifier_type" = 'user'
        AND "verifier_user_id" IS NOT NULL
      ) OR (
        "verifier_type" IN ('system', 'issuer', 'provider')
      ) OR (
        "verifier_type" LIKE 'custom_%'
      )
      `,
    ),
  }),
);

/**
 * biz_credential_share_grants
 *
 * ELI5:
 * One row = "user U allows biz B to access credential data at level X".
 *
 * This is the core privacy contract for cross-biz credential sharing.
 *
 * Security/RLS note:
 * - no `biz_id` on purpose because this row bridges two parties:
 *   `owner_user_id` and `grantee_biz_id`,
 * - access checks should always enforce one of:
 *   1) owner-side management by `owner_user_id`,
 *   2) grantee-side access by `grantee_biz_id` with status/capability rules.
 */
export const bizCredentialShareGrants = pgTable(
  "biz_credential_share_grants",
  {
    /** Stable primary key. */
    id: idWithTag("credential_grant"),

    /** User who owns and grants access to credentials. */
    ownerUserId: idRef("owner_user_id")
      .references(() => users.id)
      .notNull(),

    /** Business receiving access. */
    granteeBizId: idRef("grantee_biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Grant lifecycle state. */
    status: varchar("status", { length: 60 }).default("granted").notNull(),

    /** Data-detail level allowed under this grant. */
    accessLevel: varchar("access_level", { length: 60 }).default("summary").notNull(),

    /** Source selection scope for this grant. */
    scope: varchar("scope", { length: 60 }).default("selected_records").notNull(),

    /** Whether this grant allows candidate discovery/filter participation. */
    allowCandidateSearch: boolean("allow_candidate_search").default(false).notNull(),

    /** Whether facts can be used in filters and matching. */
    allowFactFiltering: boolean("allow_fact_filtering").default(true).notNull(),

    /** Whether document previews are allowed. */
    allowDocumentPreview: boolean("allow_document_preview").default(false).notNull(),

    /** Whether full document downloads are allowed. */
    allowDocumentDownload: boolean("allow_document_download")
      .default(false)
      .notNull(),

    /** Whether biz can open verification requests under this grant. */
    allowVerificationRequests: boolean("allow_verification_requests")
      .default(true)
      .notNull(),

    /** Actor who approved this grant contract. */
    grantedByUserId: idRef("granted_by_user_id").references(() => users.id),

    /** Business timestamp when grant became active. */
    grantedAt: timestamp("granted_at", { withTimezone: true }).defaultNow().notNull(),

    /** Revocation timestamp for revoked status. */
    revokedAt: timestamp("revoked_at", { withTimezone: true }),

    /** Expiry timestamp for time-boxed grants. */
    expiresAt: timestamp("expires_at", { withTimezone: true }),

    /** Optional context/reason text shown in audit UI. */
    reason: varchar("reason", { length: 1000 }),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}).notNull(),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite key for owner-safe child FKs. */
    bizCredentialShareGrantsOwnerIdUnique: uniqueIndex(
      "biz_credential_share_grants_owner_id_unique",
    ).on(table.ownerUserId, table.id),

    /** Composite key for biz-safe child FKs. */
    bizCredentialShareGrantsBizIdUnique: uniqueIndex(
      "biz_credential_share_grants_biz_id_unique",
    ).on(table.granteeBizId, table.id),

    /** At most one active granted contract per (user, biz) pair. */
    bizCredentialShareGrantsActivePairUnique: uniqueIndex(
      "biz_credential_share_grants_active_pair_unique",
    )
      .on(table.ownerUserId, table.granteeBizId)
      .where(sql`"status" = 'granted' AND "deleted_at" IS NULL`),

    /** Main lookup path during access checks. */
    bizCredentialShareGrantsBizLookupIdx: index(
      "biz_credential_share_grants_biz_lookup_idx",
    ).on(table.granteeBizId, table.status, table.accessLevel, table.scope),

    /** Status vocabulary guard. */
    bizCredentialShareGrantsStatusCheck: check(
      "biz_credential_share_grants_status_check",
      sql`
      "status" IN ('granted', 'revoked', 'expired')
      OR "status" LIKE 'custom_%'
      `,
    ),

    /** Access-level vocabulary guard. */
    bizCredentialShareGrantsAccessLevelCheck: check(
      "biz_credential_share_grants_access_level_check",
      sql`
      "access_level" IN ('existence_only', 'summary', 'facts', 'documents', 'full')
      OR "access_level" LIKE 'custom_%'
      `,
    ),

    /** Scope vocabulary guard. */
    bizCredentialShareGrantsScopeCheck: check(
      "biz_credential_share_grants_scope_check",
      sql`
      "scope" IN ('all_records', 'selected_records', 'selected_types')
      OR "scope" LIKE 'custom_%'
      `,
    ),

    /** Timeline ordering and revocation/expiry sanity. */
    bizCredentialShareGrantsTimelineCheck: check(
      "biz_credential_share_grants_timeline_check",
      sql`
      ("revoked_at" IS NULL OR "revoked_at" >= "granted_at")
      AND ("expires_at" IS NULL OR "expires_at" >= "granted_at")
      `,
    ),

    /** Status payload shape guard. */
    bizCredentialShareGrantsStatusShapeCheck: check(
      "biz_credential_share_grants_status_shape_check",
      sql`
      (
        "status" = 'granted'
        AND "revoked_at" IS NULL
      ) OR (
        "status" = 'revoked'
        AND "revoked_at" IS NOT NULL
      ) OR (
        "status" = 'expired'
        AND "revoked_at" IS NULL
        AND "expires_at" IS NOT NULL
      ) OR (
        "status" LIKE 'custom_%'
      )
      `,
    ),

    /** Download implies preview to keep permission semantics coherent. */
    bizCredentialShareGrantsPreviewDownloadCheck: check(
      "biz_credential_share_grants_preview_download_check",
      sql`
      "allow_document_download" = false
      OR "allow_document_preview" = true
      `,
    ),

    /** Known access levels enforce baseline capability ceilings. */
    bizCredentialShareGrantsAccessCapabilityCheck: check(
      "biz_credential_share_grants_access_capability_check",
      sql`
      (
        "access_level" = 'existence_only'
        AND "allow_fact_filtering" = false
        AND "allow_document_preview" = false
        AND "allow_document_download" = false
      ) OR (
        "access_level" = 'summary'
        AND "allow_document_preview" = false
        AND "allow_document_download" = false
      ) OR (
        "access_level" = 'facts'
        AND "allow_document_preview" = false
        AND "allow_document_download" = false
      ) OR (
        "access_level" = 'documents'
      ) OR (
        "access_level" = 'full'
      ) OR (
        "access_level" LIKE 'custom_%'
      )
      `,
    ),
  }),
);

/**
 * biz_credential_share_grant_selectors
 *
 * ELI5:
 * This table is used when grant scope is not "all records".
 *
 * It defines exactly what is included/excluded for one user->biz grant:
 * - specific credential record
 * - credential type family
 * - fact key family
 */
export const bizCredentialShareGrantSelectors = pgTable(
  "biz_credential_share_grant_selectors",
  {
    /** Stable primary key. */
    id: idWithTag("credential_grant_selector"),

    /** Owner boundary for safe joins. */
    ownerUserId: idRef("owner_user_id")
      .references(() => users.id)
      .notNull(),

    /** Grantee biz boundary for safe joins. */
    granteeBizId: idRef("grantee_biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent grant contract. */
    bizCredentialShareGrantId: idRef("biz_credential_share_grant_id")
      .references(() => bizCredentialShareGrants.id)
      .notNull(),

    /** Selector payload discriminator. */
    selectorType: varchar("selector_type", { length: 60 }).notNull(),

    /** Include vs exclude mode for advanced policy composition. */
    isIncluded: boolean("is_included").default(true).notNull(),

    /** Payload for `selector_type=credential_record`. */
    credentialRecordId: idRef("credential_record_id").references(() => userCredentialRecords.id),

    /** Payload for `selector_type=credential_type`. */
    credentialTypeKey: varchar("credential_type_key", { length: 120 }),

    /** Payload for `selector_type=fact_key`. */
    factKey: varchar("fact_key", { length: 120 }),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}).notNull(),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Common expansion path for one grant selector set. */
    bizCredentialShareGrantSelectorsGrantIdx: index(
      "biz_credential_share_grant_selectors_grant_idx",
    ).on(table.bizCredentialShareGrantId, table.selectorType, table.isIncluded),

    /** Prevent duplicate record selectors in same include/exclude mode. */
    bizCredentialShareGrantSelectorsUniqueRecord: uniqueIndex(
      "biz_credential_share_grant_selectors_unique_record",
    )
      .on(table.bizCredentialShareGrantId, table.isIncluded, table.credentialRecordId)
      .where(sql`"selector_type" = 'credential_record' AND "deleted_at" IS NULL`),

    /** Prevent duplicate type selectors in same include/exclude mode. */
    bizCredentialShareGrantSelectorsUniqueType: uniqueIndex(
      "biz_credential_share_grant_selectors_unique_type",
    )
      .on(table.bizCredentialShareGrantId, table.isIncluded, table.credentialTypeKey)
      .where(sql`"selector_type" = 'credential_type' AND "deleted_at" IS NULL`),

    /** Prevent duplicate fact-key selectors in same include/exclude mode. */
    bizCredentialShareGrantSelectorsUniqueFactKey: uniqueIndex(
      "biz_credential_share_grant_selectors_unique_fact_key",
    )
      .on(table.bizCredentialShareGrantId, table.isIncluded, table.factKey)
      .where(sql`"selector_type" = 'fact_key' AND "deleted_at" IS NULL`),

    /** Owner-safe FK to parent grant. */
    bizCredentialShareGrantSelectorsOwnerGrantFk: foreignKey({
      columns: [table.ownerUserId, table.bizCredentialShareGrantId],
      foreignColumns: [bizCredentialShareGrants.ownerUserId, bizCredentialShareGrants.id],
      name: "biz_credential_share_grant_selectors_owner_grant_fk",
    }),

    /** Biz-safe FK to parent grant. */
    bizCredentialShareGrantSelectorsBizGrantFk: foreignKey({
      columns: [table.granteeBizId, table.bizCredentialShareGrantId],
      foreignColumns: [bizCredentialShareGrants.granteeBizId, bizCredentialShareGrants.id],
      name: "biz_credential_share_grant_selectors_biz_grant_fk",
    }),

    /** Owner-safe FK to optional record payload. */
    bizCredentialShareGrantSelectorsOwnerRecordFk: foreignKey({
      columns: [table.ownerUserId, table.credentialRecordId],
      foreignColumns: [userCredentialRecords.ownerUserId, userCredentialRecords.id],
      name: "biz_credential_share_grant_selectors_owner_record_fk",
    }),

    /** Selector type vocabulary guard. */
    bizCredentialShareGrantSelectorsTypeCheck: check(
      "biz_credential_share_grant_selectors_type_check",
      sql`
      "selector_type" IN ('credential_record', 'credential_type', 'fact_key')
      OR "selector_type" LIKE 'custom_%'
      `,
    ),

    /** Selector payload shape must match selector type exactly. */
    bizCredentialShareGrantSelectorsShapeCheck: check(
      "biz_credential_share_grant_selectors_shape_check",
      sql`
      (
        "selector_type" = 'credential_record'
        AND "credential_record_id" IS NOT NULL
        AND "credential_type_key" IS NULL
        AND "fact_key" IS NULL
      ) OR (
        "selector_type" = 'credential_type'
        AND "credential_record_id" IS NULL
        AND "credential_type_key" IS NOT NULL
        AND "fact_key" IS NULL
      ) OR (
        "selector_type" = 'fact_key'
        AND "credential_record_id" IS NULL
        AND "credential_type_key" IS NULL
        AND "fact_key" IS NOT NULL
      ) OR (
        "selector_type" LIKE 'custom_%'
      )
      `,
    ),
  }),
);

/**
 * biz_credential_requests
 *
 * ELI5:
 * One row = one business asks one user for credential sharing/completion.
 *
 * This table supports marketplace/onboarding workflows where the user is not
 * necessarily a member/resource in that biz yet.
 */
export const bizCredentialRequests = pgTable(
  "biz_credential_requests",
  {
    /** Stable primary key. */
    id: idWithTag("credential_request"),

    /** Requesting business (tenant boundary for request workflow). */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Candidate user receiving this request. */
    candidateUserId: idRef("candidate_user_id")
      .references(() => users.id)
      .notNull(),

    /** Optional biz actor who created the request. */
    requestedByUserId: idRef("requested_by_user_id").references(() => users.id),

    /** Request lifecycle state. */
    status: varchar("status", { length: 60 }).default("open").notNull(),

    /** Human request title. */
    title: varchar("title", { length: 260 }).notNull(),

    /** Optional description/instructions. */
    description: varchar("description", { length: 1200 }),

    /** Priority hint for recruiter/operator queues. */
    priority: integer("priority").default(100).notNull(),

    /** Optional due date for requested credential completion. */
    dueAt: timestamp("due_at", { withTimezone: true }),

    /** Optional response/decision timestamp. */
    respondedAt: timestamp("responded_at", { withTimezone: true }),

    /** Optional linked share grant created from this request. */
    bizCredentialShareGrantId: idRef("biz_credential_share_grant_id").references(
      () => bizCredentialShareGrants.id,
    ),

    /**
     * Optional source subject pointer for cross-domain linkage.
     *
     * Example use cases:
     * - staffing opening
     * - project/task posting
     * - marketplace demand card
     */
    sourceSubjectType: varchar("source_subject_type", { length: 80 }),
    sourceSubjectId: varchar("source_subject_id", { length: 140 }),

    /** Optional idempotency key for deterministic request creation APIs. */
    requestKey: varchar("request_key", { length: 140 }),

    /** Request-level policy payload (SLA, reminder cadence, etc.). */
    policy: jsonb("policy").default({}).notNull(),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite key used by tenant-safe child FKs. */
    bizCredentialRequestsBizIdIdUnique: uniqueIndex(
      "biz_credential_requests_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** Composite key used to enforce candidate consistency in request items. */
    bizCredentialRequestsBizIdIdCandidateUnique: uniqueIndex(
      "biz_credential_requests_biz_id_id_candidate_unique",
    ).on(table.bizId, table.id, table.candidateUserId),

    /** Common request board query path. */
    bizCredentialRequestsBizStatusDueIdx: index(
      "biz_credential_requests_biz_status_due_idx",
    ).on(table.bizId, table.status, table.dueAt, table.priority),

    /** Candidate-centric history path. */
    bizCredentialRequestsCandidateStatusIdx: index(
      "biz_credential_requests_candidate_status_idx",
    ).on(table.candidateUserId, table.status, table.dueAt),

    /** Optional dedupe path for idempotent create calls. */
    bizCredentialRequestsBizRequestKeyUnique: uniqueIndex(
      "biz_credential_requests_biz_request_key_unique",
    )
      .on(table.bizId, table.requestKey)
      .where(sql`"request_key" IS NOT NULL`),

    /** Tenant-safe FK to optional linked share grant. */
    bizCredentialRequestsBizShareGrantFk: foreignKey({
      columns: [table.bizId, table.bizCredentialShareGrantId],
      foreignColumns: [bizCredentialShareGrants.granteeBizId, bizCredentialShareGrants.id],
      name: "biz_credential_requests_biz_share_grant_fk",
    }),

    /** Tenant-safe FK to optional source subject. */
    bizCredentialRequestsBizSourceSubjectFk: foreignKey({
      columns: [table.bizId, table.sourceSubjectType, table.sourceSubjectId],
      foreignColumns: [subjects.bizId, subjects.subjectType, subjects.subjectId],
      name: "biz_credential_requests_biz_source_subject_fk",
    }),

    /** Status vocabulary guard. */
    bizCredentialRequestsStatusCheck: check(
      "biz_credential_requests_status_check",
      sql`
      "status" IN ('open', 'fulfilled', 'declined', 'cancelled', 'expired', 'withdrawn')
      OR "status" LIKE 'custom_%'
      `,
    ),

    /** Priority should stay non-negative. */
    bizCredentialRequestsPriorityCheck: check(
      "biz_credential_requests_priority_check",
      sql`"priority" >= 0`,
    ),

    /** Response should not precede creation. */
    bizCredentialRequestsTimelineCheck: check(
      "biz_credential_requests_timeline_check",
      sql`"responded_at" IS NULL OR "responded_at" >= "created_at"`,
    ),

    /** Source-subject pointer should be fully-null or fully-set. */
    bizCredentialRequestsSourceSubjectPairCheck: check(
      "biz_credential_requests_source_subject_pair_check",
      sql`
      (
        "source_subject_type" IS NULL
        AND "source_subject_id" IS NULL
      ) OR (
        "source_subject_type" IS NOT NULL
        AND "source_subject_id" IS NOT NULL
      )
      `,
    ),
  }),
);

/**
 * biz_credential_request_items
 *
 * ELI5:
 * One request can ask for many things.
 * Each row here is one required/optional requirement line.
 */
export const bizCredentialRequestItems = pgTable(
  "biz_credential_request_items",
  {
    /** Stable primary key. */
    id: idWithTag("credential_request_item"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent credential request. */
    bizCredentialRequestId: idRef("biz_credential_request_id")
      .references(() => bizCredentialRequests.id)
      .notNull(),

    /**
     * Candidate copied from parent request.
     *
     * Why duplicate this here:
     * - lets us enforce candidate-safe FK to credential records,
     * - avoids ambiguous joins during requirement-evaluation queries.
     */
    candidateUserId: idRef("candidate_user_id")
      .references(() => users.id)
      .notNull(),

    /** Requirement mode. */
    requirementMode: varchar("requirement_mode", { length: 40 })
      .default("required")
      .notNull(),

    /** Selector payload discriminator. */
    selectorType: varchar("selector_type", { length: 60 }).notNull(),

    /** Payload when targeting one specific credential record. */
    credentialRecordId: idRef("credential_record_id").references(() => userCredentialRecords.id),

    /** Payload when targeting one credential type family. */
    credentialTypeKey: varchar("credential_type_key", { length: 120 }),

    /** Payload when targeting one fact predicate. */
    factKey: varchar("fact_key", { length: 120 }),

    /** Optional predicate payload for fact requirement matching. */
    factPredicate: jsonb("fact_predicate"),

    /** Minimum remaining valid days required at fulfillment time. */
    minValidityDaysRemaining: integer("min_validity_days_remaining")
      .default(0)
      .notNull(),

    /** Required verification state for satisfying this line item. */
    requiredVerificationStatus: varchar("required_verification_status", { length: 60 })
      .default("verified")
      .notNull(),

    /** Runtime satisfaction marker for operators/read models. */
    isSatisfied: boolean("is_satisfied").default(false).notNull(),

    /** Optional operator note for manual handling. */
    notes: varchar("notes", { length: 700 }),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    bizCredentialRequestItemsBizIdIdUnique: uniqueIndex("biz_credential_request_items_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Main expansion path for one request's requirement set. */
    bizCredentialRequestItemsBizRequestIdx: index(
      "biz_credential_request_items_biz_request_idx",
    ).on(table.bizId, table.bizCredentialRequestId),

    /** Candidate-centric progress path. */
    bizCredentialRequestItemsCandidateSatisfactionIdx: index(
      "biz_credential_request_items_candidate_satisfaction_idx",
    ).on(table.candidateUserId, table.isSatisfied, table.selectorType),

    /** Tenant-safe FK to parent request. */
    bizCredentialRequestItemsBizRequestFk: foreignKey({
      columns: [table.bizId, table.bizCredentialRequestId],
      foreignColumns: [bizCredentialRequests.bizId, bizCredentialRequests.id],
      name: "biz_credential_request_items_biz_request_fk",
    }),

    /** Candidate must match parent request candidate. */
    bizCredentialRequestItemsBizRequestCandidateFk: foreignKey({
      columns: [table.bizId, table.bizCredentialRequestId, table.candidateUserId],
      foreignColumns: [
        bizCredentialRequests.bizId,
        bizCredentialRequests.id,
        bizCredentialRequests.candidateUserId,
      ],
      name: "biz_credential_request_items_biz_request_candidate_fk",
    }),

    /** Candidate-safe FK to specific credential payload. */
    bizCredentialRequestItemsCandidateRecordFk: foreignKey({
      columns: [table.candidateUserId, table.credentialRecordId],
      foreignColumns: [userCredentialRecords.ownerUserId, userCredentialRecords.id],
      name: "biz_credential_request_items_candidate_record_fk",
    }),

    /** Requirement mode vocabulary guard. */
    bizCredentialRequestItemsRequirementModeCheck: check(
      "biz_credential_request_items_requirement_mode_check",
      sql`
      "requirement_mode" IN ('required', 'optional', 'informational')
      OR "requirement_mode" LIKE 'custom_%'
      `,
    ),

    /** Selector vocabulary guard. */
    bizCredentialRequestItemsSelectorTypeCheck: check(
      "biz_credential_request_items_selector_type_check",
      sql`
      "selector_type" IN ('credential_record', 'credential_type', 'fact_requirement')
      OR "selector_type" LIKE 'custom_%'
      `,
    ),

    /** Verification status vocabulary guard. */
    bizCredentialRequestItemsVerificationStatusCheck: check(
      "biz_credential_request_items_verification_status_check",
      sql`
      "required_verification_status" IN ('unverified', 'pending', 'verified', 'rejected', 'expired', 'revoked')
      OR "required_verification_status" LIKE 'custom_%'
      `,
    ),

    /** Numeric bounds. */
    bizCredentialRequestItemsBoundsCheck: check(
      "biz_credential_request_items_bounds_check",
      sql`"min_validity_days_remaining" >= 0`,
    ),

    /** Selector payload shape should match selector type exactly. */
    bizCredentialRequestItemsSelectorShapeCheck: check(
      "biz_credential_request_items_selector_shape_check",
      sql`
      (
        "selector_type" = 'credential_record'
        AND "credential_record_id" IS NOT NULL
        AND "credential_type_key" IS NULL
        AND "fact_key" IS NULL
      ) OR (
        "selector_type" = 'credential_type'
        AND "credential_record_id" IS NULL
        AND "credential_type_key" IS NOT NULL
        AND "fact_key" IS NULL
      ) OR (
        "selector_type" = 'fact_requirement'
        AND "credential_record_id" IS NULL
        AND "credential_type_key" IS NULL
        AND "fact_key" IS NOT NULL
        AND "fact_predicate" IS NOT NULL
      ) OR (
        "selector_type" LIKE 'custom_%'
      )
      `,
    ),
  }),
);

/**
 * credential_disclosure_events
 *
 * ELI5:
 * Immutable-style timeline of sharing and access actions.
 *
 * Why this exists separately:
 * - businesses and users both need explainability: who saw what and when,
 * - compliance tooling needs deterministic event history,
 * - grant/request tables track current state; this table tracks event facts.
 *
 * Security/RLS note:
 * - this event table is cross-tenant by design (owner + optional grantee biz),
 * - queries should be filtered by either `owner_user_id` or `grantee_biz_id`
 *   depending on viewer role, never by unconstrained full-table scans.
 */
export const credentialDisclosureEvents = pgTable(
  "credential_disclosure_events",
  {
    /** Stable primary key. */
    id: idWithTag("credential_disclosure_event"),

    /** Credential owner boundary. */
    ownerUserId: idRef("owner_user_id")
      .references(() => users.id)
      .notNull(),

    /** Optional grantee biz boundary when event is biz-facing. */
    granteeBizId: idRef("grantee_biz_id").references(() => bizes.id),

    /** Optional grant context pointer. */
    bizCredentialShareGrantId: idRef("biz_credential_share_grant_id").references(
      () => bizCredentialShareGrants.id,
    ),

    /** Optional request context pointer. */
    bizCredentialRequestId: idRef("biz_credential_request_id").references(
      () => bizCredentialRequests.id,
    ),

    /** Event type taxonomy. */
    eventType: varchar("event_type", { length: 80 }).notNull(),

    /** Optional credential record pointer. */
    credentialRecordId: idRef("credential_record_id").references(() => userCredentialRecords.id),

    /** Optional document pointer. */
    credentialDocumentId: idRef("credential_document_id").references(
      () => userCredentialDocuments.id,
    ),

    /** Actor class for this event. */
    actorType: varchar("actor_type", { length: 60 }).default("system").notNull(),

    /** Optional actor user pointer. */
    actorUserId: idRef("actor_user_id").references(() => users.id),

    /** Business occurrence timestamp. */
    occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),

    /** Optional request correlation id for tracing. */
    requestRef: varchar("request_ref", { length: 200 }),

    /** Structured details payload for rendering and forensics. */
    details: jsonb("details").default({}).notNull(),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Insert timestamp (separate from business occurred_at). */
    recordedAt: createdAt,
  },
  (table) => ({
    /** Owner timeline lookup path. */
    credentialDisclosureEventsOwnerOccurredIdx: index(
      "credential_disclosure_events_owner_occurred_idx",
    ).on(table.ownerUserId, table.occurredAt),

    /** Biz-facing audit lookup path. */
    credentialDisclosureEventsBizOccurredIdx: index(
      "credential_disclosure_events_biz_occurred_idx",
    ).on(table.granteeBizId, table.eventType, table.occurredAt),

    /** Record-level forensics path. */
    credentialDisclosureEventsRecordOccurredIdx: index(
      "credential_disclosure_events_record_occurred_idx",
    ).on(table.ownerUserId, table.credentialRecordId, table.occurredAt),

    /** Owner-safe FK to optional credential record. */
    credentialDisclosureEventsOwnerRecordFk: foreignKey({
      columns: [table.ownerUserId, table.credentialRecordId],
      foreignColumns: [userCredentialRecords.ownerUserId, userCredentialRecords.id],
      name: "credential_disclosure_events_owner_record_fk",
    }),

    /** Owner-safe FK to optional credential document. */
    credentialDisclosureEventsOwnerDocumentFk: foreignKey({
      columns: [table.ownerUserId, table.credentialDocumentId],
      foreignColumns: [userCredentialDocuments.ownerUserId, userCredentialDocuments.id],
      name: "credential_disclosure_events_owner_document_fk",
    }),

    /** Owner-safe FK to optional grant context. */
    credentialDisclosureEventsOwnerGrantFk: foreignKey({
      columns: [table.ownerUserId, table.bizCredentialShareGrantId],
      foreignColumns: [bizCredentialShareGrants.ownerUserId, bizCredentialShareGrants.id],
      name: "credential_disclosure_events_owner_grant_fk",
    }),

    /** Biz-safe FK to optional grant context. */
    credentialDisclosureEventsBizGrantFk: foreignKey({
      columns: [table.granteeBizId, table.bizCredentialShareGrantId],
      foreignColumns: [bizCredentialShareGrants.granteeBizId, bizCredentialShareGrants.id],
      name: "credential_disclosure_events_biz_grant_fk",
    }),

    /** Biz-safe FK to optional request context. */
    credentialDisclosureEventsBizRequestFk: foreignKey({
      columns: [table.granteeBizId, table.bizCredentialRequestId],
      foreignColumns: [bizCredentialRequests.bizId, bizCredentialRequests.id],
      name: "credential_disclosure_events_biz_request_fk",
    }),

    /** Event type vocabulary guard. */
    credentialDisclosureEventsTypeCheck: check(
      "credential_disclosure_events_type_check",
      sql`
      "event_type" IN (
        'record_uploaded',
        'record_updated',
        'grant_created',
        'grant_revoked',
        'grant_expired',
        'request_created',
        'request_viewed',
        'record_viewed',
        'document_previewed',
        'document_downloaded',
        'verification_requested',
        'verification_completed'
      ) OR "event_type" LIKE 'custom_%'
      `,
    ),

    /** Actor type vocabulary guard. */
    credentialDisclosureEventsActorTypeCheck: check(
      "credential_disclosure_events_actor_type_check",
      sql`
      "actor_type" IN ('owner_user', 'grantee_user', 'system', 'extension')
      OR "actor_type" LIKE 'custom_%'
      `,
    ),

    /** Grant/request pointers should not be orphaned from biz context. */
    credentialDisclosureEventsGrantRequestShapeCheck: check(
      "credential_disclosure_events_grant_request_shape_check",
      sql`
      (
        "biz_credential_share_grant_id" IS NULL
        OR "grantee_biz_id" IS NOT NULL
      )
      AND (
        "biz_credential_request_id" IS NULL
        OR "grantee_biz_id" IS NOT NULL
      )
      `,
    ),
  }),
);

export type CredentialTypeDefinition = typeof credentialTypeDefinitions.$inferSelect;
export type NewCredentialTypeDefinition = typeof credentialTypeDefinitions.$inferInsert;

export type UserCredentialProfile = typeof userCredentialProfiles.$inferSelect;
export type NewUserCredentialProfile = typeof userCredentialProfiles.$inferInsert;

export type UserCredentialRecord = typeof userCredentialRecords.$inferSelect;
export type NewUserCredentialRecord = typeof userCredentialRecords.$inferInsert;

export type UserCredentialDocument = typeof userCredentialDocuments.$inferSelect;
export type NewUserCredentialDocument = typeof userCredentialDocuments.$inferInsert;

export type UserCredentialFact = typeof userCredentialFacts.$inferSelect;
export type NewUserCredentialFact = typeof userCredentialFacts.$inferInsert;

export type UserCredentialVerification = typeof userCredentialVerifications.$inferSelect;
export type NewUserCredentialVerification = typeof userCredentialVerifications.$inferInsert;

export type BizCredentialShareGrant = typeof bizCredentialShareGrants.$inferSelect;
export type NewBizCredentialShareGrant = typeof bizCredentialShareGrants.$inferInsert;

export type BizCredentialShareGrantSelector =
  typeof bizCredentialShareGrantSelectors.$inferSelect;
export type NewBizCredentialShareGrantSelector =
  typeof bizCredentialShareGrantSelectors.$inferInsert;

export type BizCredentialRequest = typeof bizCredentialRequests.$inferSelect;
export type NewBizCredentialRequest = typeof bizCredentialRequests.$inferInsert;

export type BizCredentialRequestItem = typeof bizCredentialRequestItems.$inferSelect;
export type NewBizCredentialRequestItem = typeof bizCredentialRequestItems.$inferInsert;

export type CredentialDisclosureEvent = typeof credentialDisclosureEvents.$inferSelect;
export type NewCredentialDisclosureEvent = typeof credentialDisclosureEvents.$inferInsert;
