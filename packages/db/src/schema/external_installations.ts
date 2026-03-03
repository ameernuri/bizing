import { sql } from "drizzle-orm";
import { check, foreignKey, index, pgTable, uniqueIndex } from "drizzle-orm/pg-core";
import {
  boolean,
  jsonb,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { idRef, idWithTag, withAuditRefs } from "./_common";
import { actionRequests } from "./action_backbone";
import { bizes } from "./bizes";
import { debugSnapshots } from "./projections";
import { domainEvents } from "./domain_events";
import { crmContacts } from "./crm";
import { users } from "./users";
import { subjects } from "./subjects";

/**
 * client_installations
 *
 * ELI5:
 * One row = one outside app/site installation that is connected to Bizing.
 *
 * Examples:
 * - a WordPress plugin install on one clinic website
 * - a React storefront embed
 * - a partner admin portal
 *
 * Why this matters:
 * We want external channels to be first-class citizens of the platform,
 * not hidden API key blobs with no identity.
 */
export const clientInstallations = pgTable(
  "client_installations",
  {
    id: idWithTag("client_installation"),
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    installationType: varchar("installation_type", { length: 60 }).notNull(),
    providerKey: varchar("provider_key", { length: 80 }).notNull(),
    displayName: varchar("display_name", { length: 240 }).notNull(),
    originUrl: varchar("origin_url", { length: 700 }),
    siteKey: varchar("site_key", { length: 180 }),
    status: varchar("status", { length: 32 }).default("active").notNull(),
    trustMode: varchar("trust_mode", { length: 40 }).default("write_only").notNull(),
    config: jsonb("config").default({}).notNull(),
    metadata: jsonb("metadata").default({}).notNull(),

    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    clientInstallationsBizIdIdUnique: uniqueIndex("client_installations_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    clientInstallationsBizProviderSiteUnique: uniqueIndex(
      "client_installations_biz_provider_site_unique",
    ).on(table.bizId, table.providerKey, table.siteKey),
    clientInstallationsBizStatusIdx: index("client_installations_biz_status_idx").on(
      table.bizId,
      table.status,
    ),
  }),
);

/**
 * client_installation_credentials
 *
 * ELI5:
 * This records machine credentials owned by one installation.
 * We intentionally separate installation identity from credential rotation.
 */
export const clientInstallationCredentials = pgTable(
  "client_installation_credentials",
  {
    id: idWithTag("install_credential"),
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),
    clientInstallationId: idRef("client_installation_id")
      .references(() => clientInstallations.id, { onDelete: "cascade" })
      .notNull(),
    credentialType: varchar("credential_type", { length: 40 }).notNull(),
    publicKeyHint: varchar("public_key_hint", { length: 255 }),
    secretHash: varchar("secret_hash", { length: 255 }).notNull(),
    status: varchar("status", { length: 32 }).default("active").notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    scopes: jsonb("scopes").default([]).notNull(),
    metadata: jsonb("metadata").default({}).notNull(),

    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    clientInstallationCredentialsBizIdIdUnique: uniqueIndex(
      "client_installation_credentials_biz_id_id_unique",
    ).on(table.bizId, table.id),
    clientInstallationCredentialsInstallIdx: index(
      "client_installation_credentials_install_idx",
    ).on(table.clientInstallationId, table.status),
  }),
);

/**
 * customer_profiles
 *
 * ELI5:
 * This is the cross-channel customer root.
 *
 * It is NOT just "a logged-in Bizing user".
 * It can represent:
 * - a fully claimed customer
 * - an unclaimed shadow profile
 * - a person known only through external sites so far
 */
export const customerProfiles = pgTable(
  "customer_profiles",
  {
    id: idWithTag("customer_profile"),
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /**
     * Profile lifecycle.
     * Example values:
     * - shadow
     * - claimed
     * - merged
     * - archived
     */
    status: varchar("status", { length: 32 }).default("shadow").notNull(),

    displayName: varchar("display_name", { length: 240 }),
    primaryEmail: varchar("primary_email", { length: 320 }),
    primaryPhone: varchar("primary_phone", { length: 40 }),
    claimedUserId: idRef("claimed_user_id").references(() => users.id),
    primaryCrmContactId: idRef("primary_crm_contact_id").references(() => crmContacts.id),
    isVerified: boolean("is_verified").default(false).notNull(),
    lifecycleStage: varchar("lifecycle_stage", { length: 40 })
      .default("prospect")
      .notNull(),
    supportTier: varchar("support_tier", { length: 40 })
      .default("standard")
      .notNull(),
    acquisitionSourceType: varchar("acquisition_source_type", { length: 80 }),
    acquisitionSourceRef: varchar("acquisition_source_ref", { length: 220 }),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).defaultNow().notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    lastEngagedAt: timestamp("last_engaged_at", { withTimezone: true }),
    lastPurchaseAt: timestamp("last_purchase_at", { withTimezone: true }),
    profileData: jsonb("profile_data").default({}).notNull(),
    metadata: jsonb("metadata").default({}).notNull(),

    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    customerProfilesBizIdIdUnique: uniqueIndex("customer_profiles_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    customerProfilesBizStatusIdx: index("customer_profiles_biz_status_idx").on(
      table.bizId,
      table.status,
      table.lifecycleStage,
      table.supportTier,
      table.isVerified,
    ),
    customerProfilesBizEmailIdx: index("customer_profiles_biz_email_idx").on(
      table.bizId,
      table.primaryEmail,
    ),
    customerProfilesBizPhoneIdx: index("customer_profiles_biz_phone_idx").on(
      table.bizId,
      table.primaryPhone,
    ),
    customerProfilesStageCheck: check(
      "customer_profiles_stage_check",
      sql`
      "lifecycle_stage" IN ('lead', 'prospect', 'customer', 'retained', 'at_risk', 'churned')
      OR "lifecycle_stage" LIKE 'custom_%'
      `,
    ),
    customerProfilesSupportTierCheck: check(
      "customer_profiles_support_tier_check",
      sql`
      "support_tier" IN ('standard', 'priority', 'vip', 'enterprise')
      OR "support_tier" LIKE 'custom_%'
      `,
    ),
    customerProfilesTimelineCheck: check(
      "customer_profiles_timeline_check",
      sql`
      ("last_seen_at" IS NULL OR "last_seen_at" >= "first_seen_at")
      AND ("last_engaged_at" IS NULL OR "last_engaged_at" >= "first_seen_at")
      AND ("last_purchase_at" IS NULL OR "last_purchase_at" >= "first_seen_at")
      `,
    ),
  }),
);

/**
 * customer_identity_handles
 *
 * ELI5:
 * This stores identity signals we know about a person.
 *
 * Examples:
 * - email
 * - phone
 * - WordPress user id on a specific site
 * - guest browser token on one installation
 *
 * Why:
 * Email alone should not be the whole identity model.
 */
export const customerIdentityHandles = pgTable(
  "customer_identity_handles",
  {
    id: idWithTag("customer_identity"),
    bizId: idRef("biz_id").references(() => bizes.id),
    handleType: varchar("handle_type", { length: 60 }).notNull(),
    normalizedValue: varchar("normalized_value", { length: 500 }).notNull(),
    displayValue: varchar("display_value", { length: 500 }),
    status: varchar("status", { length: 32 }).default("active").notNull(),
    metadata: jsonb("metadata").default({}).notNull(),

    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    customerIdentityHandlesBizIdIdUnique: uniqueIndex(
      "customer_identity_handles_biz_id_id_unique",
    ).on(table.bizId, table.id),
    customerIdentityHandlesUnique: uniqueIndex("customer_identity_handles_unique").on(
      table.bizId,
      table.handleType,
      table.normalizedValue,
    ),
    customerIdentityHandlesLookupIdx: index("customer_identity_handles_lookup_idx").on(
      table.bizId,
      table.handleType,
      table.status,
    ),
  }),
);

/**
 * customer_identity_links
 *
 * ELI5:
 * This table answers:
 * "why do we think this identity handle belongs to this customer profile?"
 *
 * It also stores confidence and verification state.
 */
export const customerIdentityLinks = pgTable(
  "customer_identity_links",
  {
    id: idWithTag("customer_identity_link"),
    bizId: idRef("biz_id").references(() => bizes.id),
    customerProfileId: idRef("customer_profile_id")
      .references(() => customerProfiles.id, { onDelete: "cascade" })
      .notNull(),
    customerIdentityHandleId: idRef("customer_identity_handle_id")
      .references(() => customerIdentityHandles.id, { onDelete: "cascade" })
      .notNull(),
    clientInstallationId: idRef("client_installation_id").references(
      () => clientInstallations.id,
    ),
    linkSource: varchar("link_source", { length: 60 }).notNull(),
    confidenceLevel: varchar("confidence_level", { length: 32 }).default("asserted").notNull(),
    verificationState: varchar("verification_state", { length: 32 }).default("unverified").notNull(),
    isPrimary: boolean("is_primary").default(false).notNull(),
    metadata: jsonb("metadata").default({}).notNull(),

    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    customerIdentityLinksBizIdIdUnique: uniqueIndex(
      "customer_identity_links_biz_id_id_unique",
    ).on(table.bizId, table.id),
    customerIdentityLinksUnique: uniqueIndex("customer_identity_links_unique").on(
      table.customerProfileId,
      table.customerIdentityHandleId,
      table.clientInstallationId,
    ),
    customerIdentityLinksProfileIdx: index("customer_identity_links_profile_idx").on(
      table.customerProfileId,
      table.verificationState,
      table.confidenceLevel,
    ),
  }),
);

/**
 * client_external_subjects
 *
 * ELI5:
 * One row = one local external subject from one installation.
 *
 * Examples:
 * - wp_user_123
 * - guest_cookie_abcd
 * - local_customer_87
 */
export const clientExternalSubjects = pgTable(
  "client_external_subjects",
  {
    id: idWithTag("external_subject"),
    bizId: idRef("biz_id").references(() => bizes.id),
    clientInstallationId: idRef("client_installation_id")
      .references(() => clientInstallations.id, { onDelete: "cascade" })
      .notNull(),
    subjectKind: varchar("subject_kind", { length: 60 }).notNull(),
    externalSubjectKey: varchar("external_subject_key", { length: 240 }).notNull(),
    customerProfileId: idRef("customer_profile_id").references(() => customerProfiles.id),
    status: varchar("status", { length: 32 }).default("active").notNull(),
    payload: jsonb("payload").default({}).notNull(),
    metadata: jsonb("metadata").default({}).notNull(),

    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    clientExternalSubjectsBizIdIdUnique: uniqueIndex(
      "client_external_subjects_biz_id_id_unique",
    ).on(table.bizId, table.id),
    clientExternalSubjectsInstallUnique: uniqueIndex(
      "client_external_subjects_install_unique",
    ).on(table.clientInstallationId, table.subjectKind, table.externalSubjectKey),
    clientExternalSubjectsProfileIdx: index("client_external_subjects_profile_idx").on(
      table.customerProfileId,
      table.status,
    ),
  }),
);

/**
 * customer_verification_challenges
 *
 * ELI5:
 * This stores "prove you are really this person" challenges.
 *
 * Examples:
 * - email OTP
 * - magic link
 * - phone code
 */
export const customerVerificationChallenges = pgTable(
  "customer_verification_challenges",
  {
    id: idWithTag("customer_verify"),
    bizId: idRef("biz_id").references(() => bizes.id),
    customerProfileId: idRef("customer_profile_id")
      .references(() => customerProfiles.id, { onDelete: "cascade" })
      .notNull(),
    handleId: idRef("handle_id").references(() => customerIdentityHandles.id),
    challengeType: varchar("challenge_type", { length: 40 }).notNull(),
    status: varchar("status", { length: 32 }).default("pending").notNull(),
    codeHash: varchar("code_hash", { length: 255 }),
    sentTo: varchar("sent_to", { length: 500 }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    actionRequestId: idRef("action_request_id").references(() => actionRequests.id),
    completedDomainEventId: idRef("completed_domain_event_id").references(
      () => domainEvents.id,
    ),
    debugSnapshotId: idRef("debug_snapshot_id").references(() => debugSnapshots.id),
    metadata: jsonb("metadata").default({}).notNull(),

    ...withAuditRefs(() => users.id),
  },
);

/**
 * customer_profile_merges
 *
 * ELI5:
 * Sometimes we create two shadow profiles that later prove to be the same
 * person. This table records that merge decision instead of hiding it.
 */
export const customerProfileMerges = pgTable(
  "customer_profile_merges",
  {
    id: idWithTag("customer_merge"),
    bizId: idRef("biz_id").references(() => bizes.id),
    sourceCustomerProfileId: idRef("source_customer_profile_id")
      .references(() => customerProfiles.id)
      .notNull(),
    targetCustomerProfileId: idRef("target_customer_profile_id")
      .references(() => customerProfiles.id)
      .notNull(),
    mergeReason: text("merge_reason").notNull(),
    mergeSummary: jsonb("merge_summary").default({}).notNull(),
    actionRequestId: idRef("action_request_id").references(() => actionRequests.id),
    mergeDomainEventId: idRef("merge_domain_event_id").references(() => domainEvents.id),
    debugSnapshotId: idRef("debug_snapshot_id").references(() => debugSnapshots.id),

    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    customerProfileMergesActionRequestIdx: index(
      "customer_profile_merges_action_request_idx",
    ).on(table.actionRequestId),
    customerProfileMergesDistinctCheck: check(
      "customer_profile_merges_distinct_check",
      sql`"source_customer_profile_id" <> "target_customer_profile_id"`,
    ),
  }),
);

/**
 * customer_visibility_policies
 *
 * ELI5:
 * Bizing may internally know that two bookings belong to the same person.
 * This table controls what outside installations are allowed to see.
 */
export const customerVisibilityPolicies = pgTable(
  "customer_visibility_policies",
  {
    id: idWithTag("customer_visibility"),
    bizId: idRef("biz_id").references(() => bizes.id),
    customerProfileId: idRef("customer_profile_id")
      .references(() => customerProfiles.id, { onDelete: "cascade" })
      .notNull(),
    clientInstallationId: idRef("client_installation_id").references(
      () => clientInstallations.id,
    ),
    visibilityScope: varchar("visibility_scope", { length: 60 }).notNull(),
    status: varchar("status", { length: 32 }).default("active").notNull(),
    policy: jsonb("policy").default({}).notNull(),
    metadata: jsonb("metadata").default({}).notNull(),

    ...withAuditRefs(() => users.id),
  },
);
