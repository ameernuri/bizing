import { sql } from "drizzle-orm";
import { check, foreignKey, index, uniqueIndex } from "drizzle-orm/pg-core";
import {
  integer,
  jsonb,
  pgTable,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { idRef, idWithTag, withAuditRefs } from "./_common";
import { bizes } from "./bizes";
import { bookingOrders } from "./fulfillment";
import { groupAccounts } from "./group_accounts";
import { offerVersions } from "./offers";
import { serviceProducts } from "./service_products";
import { subjects } from "./subjects";
import { users } from "./users";

/**
 * payer_authorizations
 *
 * ELI5:
 * This is a pre-approval/authorization record from a payer-like entity.
 *
 * Why generic:
 * - supports insurance pre-auth, sponsor approvals, third-party guarantee flows,
 * - avoids hardcoding a medical-only schema while still supporting healthcare
 *   and enterprise billing use cases.
 */
export const payerAuthorizations = pgTable(
  "payer_authorizations",
  {
    /** Stable primary key for one authorization record. */
    id: idWithTag("payer_auth"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /**
     * Authorization class.
     * Examples: eligibility, preauthorization, guarantee, custom_%.
     */
    authorizationType: varchar("authorization_type", { length: 60 }).notNull(),

    /** Authorization lifecycle state. */
    authorizationState: varchar("authorization_state", { length: 40 })
      .default("pending")
      .notNull(),

    /** Member/beneficiary pointer: user. */
    memberUserId: idRef("member_user_id").references(() => users.id),

    /** Member/beneficiary pointer: group account. */
    memberGroupAccountId: idRef("member_group_account_id").references(
      () => groupAccounts.id,
    ),

    /** Member/beneficiary pointer: custom subject namespace. */
    memberSubjectType: varchar("member_subject_type", { length: 80 }),

    /** Member/beneficiary pointer: custom subject id. */
    memberSubjectId: varchar("member_subject_id", { length: 140 }),

    /** Payer name/key for operational readability. */
    payerName: varchar("payer_name", { length: 240 }).notNull(),

    /** Optional payer reference id from external system. */
    payerReference: varchar("payer_reference", { length: 180 }),

    /** Optional member reference used by payer system. */
    memberReference: varchar("member_reference", { length: 180 }),

    /** Optional plan/group reference in payer system. */
    planReference: varchar("plan_reference", { length: 180 }),

    /** Optional offer-version context being authorized. */
    offerVersionId: idRef("offer_version_id").references(() => offerVersions.id),

    /** Optional service-product context being authorized. */
    serviceProductId: idRef("service_product_id").references(() => serviceProducts.id),

    /** Optional custom target context namespace. */
    targetSubjectType: varchar("target_subject_type", { length: 80 }),

    /** Optional custom target context id. */
    targetSubjectId: varchar("target_subject_id", { length: 140 }),

    /** Optional booking order tied to this authorization request. */
    bookingOrderId: idRef("booking_order_id").references(() => bookingOrders.id),

    /** Optional authorized amount ceiling (minor units). */
    authorizedAmountMinor: integer("authorized_amount_minor"),

    /** Optional authorized units/session count. */
    authorizedUnits: integer("authorized_units"),

    /** Currency for authorized amount. */
    currency: varchar("currency", { length: 3 }).default("USD").notNull(),

    /** Optional request submission timestamp. */
    requestedAt: timestamp("requested_at", { withTimezone: true }).defaultNow().notNull(),

    /** Optional decision timestamp from payer. */
    decidedAt: timestamp("decided_at", { withTimezone: true }),

    /** Optional validity start. */
    validFrom: timestamp("valid_from", { withTimezone: true }),

    /** Optional validity end. */
    validUntil: timestamp("valid_until", { withTimezone: true }),

    /** Optional payer-issued authorization id. */
    externalAuthorizationRef: varchar("external_authorization_ref", { length: 180 }),

    /** Optional reason code when denied/partial/conditional. */
    reasonCode: varchar("reason_code", { length: 120 }),

    /** Raw response snapshot from payer and normalized interpretation data. */
    decisionSnapshot: jsonb("decision_snapshot").default({}).notNull(),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    payerAuthorizationsBizIdIdUnique: uniqueIndex("payer_authorizations_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Composite key for tenant-safe eligibility child rows. */

    /** External authorization ref should be unique when present. */
    payerAuthorizationsExternalRefUnique: uniqueIndex(
      "payer_authorizations_external_ref_unique",
    )
      .on(table.bizId, table.externalAuthorizationRef)
      .where(sql`"external_authorization_ref" IS NOT NULL`),

    /** Main operational queue path by state and requested time. */
    payerAuthorizationsBizStateRequestedIdx: index(
      "payer_authorizations_biz_state_requested_idx",
    ).on(table.bizId, table.authorizationState, table.requestedAt),

    /** Member-centric lookup path. */
    payerAuthorizationsBizMemberUserIdx: index(
      "payer_authorizations_biz_member_user_idx",
    ).on(table.bizId, table.memberUserId, table.authorizationState, table.requestedAt),

    /** Tenant-safe FK to offer context. */
    payerAuthorizationsBizOfferVersionFk: foreignKey({
      columns: [table.bizId, table.offerVersionId],
      foreignColumns: [offerVersions.bizId, offerVersions.id],
      name: "payer_authorizations_biz_offer_version_fk",
    }),

    /** Tenant-safe FK to service-product context. */
    payerAuthorizationsBizServiceProductFk: foreignKey({
      columns: [table.bizId, table.serviceProductId],
      foreignColumns: [serviceProducts.bizId, serviceProducts.id],
      name: "payer_authorizations_biz_service_product_fk",
    }),

    /** Tenant-safe FK to booking order context. */
    payerAuthorizationsBizBookingOrderFk: foreignKey({
      columns: [table.bizId, table.bookingOrderId],
      foreignColumns: [bookingOrders.bizId, bookingOrders.id],
      name: "payer_authorizations_biz_booking_order_fk",
    }),

    /** Tenant-safe FK to member subject. */
    payerAuthorizationsBizMemberSubjectFk: foreignKey({
      columns: [table.bizId, table.memberSubjectType, table.memberSubjectId],
      foreignColumns: [subjects.bizId, subjects.subjectType, subjects.subjectId],
      name: "payer_authorizations_biz_member_subject_fk",
    }),

    /** Tenant-safe FK to target subject context. */
    payerAuthorizationsBizTargetSubjectFk: foreignKey({
      columns: [table.bizId, table.targetSubjectType, table.targetSubjectId],
      foreignColumns: [subjects.bizId, subjects.subjectType, subjects.subjectId],
      name: "payer_authorizations_biz_target_subject_fk",
    }),

    /** Member subject pointer should be fully null or fully set. */
    payerAuthorizationsMemberSubjectPairCheck: check(
      "payer_authorizations_member_subject_pair_check",
      sql`
      (
        "member_subject_type" IS NULL
        AND "member_subject_id" IS NULL
      ) OR (
        "member_subject_type" IS NOT NULL
        AND "member_subject_id" IS NOT NULL
      )
      `,
    ),

    /** Target subject pointer should be fully null or fully set. */
    payerAuthorizationsTargetSubjectPairCheck: check(
      "payer_authorizations_target_subject_pair_check",
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

    /** Exactly one member pointer is required. */
    payerAuthorizationsMemberShapeCheck: check(
      "payer_authorizations_member_shape_check",
      sql`
      (
        ("member_user_id" IS NOT NULL)::int
        + ("member_group_account_id" IS NOT NULL)::int
        + ("member_subject_type" IS NOT NULL)::int
      ) = 1
      `,
    ),

    /** At least one authorization target context should be present. */
    payerAuthorizationsTargetShapeCheck: check(
      "payer_authorizations_target_shape_check",
      sql`
      (
        ("offer_version_id" IS NOT NULL)::int
        + ("service_product_id" IS NOT NULL)::int
        + ("target_subject_type" IS NOT NULL)::int
      ) >= 1
      `,
    ),

    /** Authorization vocabulary guards + bounds checks. */
    payerAuthorizationsStateAndBoundsCheck: check(
      "payer_authorizations_state_bounds_check",
      sql`
      (
        "authorization_type" IN ('eligibility', 'preauthorization', 'guarantee')
        OR "authorization_type" LIKE 'custom_%'
      )
      AND (
        "authorization_state" IN ('pending', 'approved', 'denied', 'partial', 'expired', 'cancelled')
        OR "authorization_state" LIKE 'custom_%'
      )
      AND ("authorized_amount_minor" IS NULL OR "authorized_amount_minor" >= 0)
      AND ("authorized_units" IS NULL OR "authorized_units" >= 0)
      AND "currency" ~ '^[A-Z]{3}$'
      AND ("decided_at" IS NULL OR "decided_at" >= "requested_at")
      AND ("valid_until" IS NULL OR "valid_from" IS NULL OR "valid_until" >= "valid_from")
      `,
    ),
  }),
);

/**
 * eligibility_snapshots
 *
 * ELI5:
 * One row = one deterministic eligibility check result at one moment in time.
 *
 * Why this exists:
 * - businesses often need re-checks (before booking, before fulfillment, before claim),
 * - snapshotting preserves exactly what decision data was used at each checkpoint.
 */
export const eligibilitySnapshots = pgTable(
  "eligibility_snapshots",
  {
    /** Stable primary key for one snapshot result. */
    id: idWithTag("eligibility_snapshot"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Optional parent payer authorization record. */
    payerAuthorizationId: idRef("payer_authorization_id").references(
      () => payerAuthorizations.id,
    ),

    /** Member pointer: user. */
    memberUserId: idRef("member_user_id").references(() => users.id),

    /** Member pointer: group account. */
    memberGroupAccountId: idRef("member_group_account_id").references(
      () => groupAccounts.id,
    ),

    /** Member pointer: custom subject namespace. */
    memberSubjectType: varchar("member_subject_type", { length: 80 }),

    /** Member pointer: custom subject id. */
    memberSubjectId: varchar("member_subject_id", { length: 140 }),

    /** Optional offer-version context checked. */
    offerVersionId: idRef("offer_version_id").references(() => offerVersions.id),

    /** Optional service-product context checked. */
    serviceProductId: idRef("service_product_id").references(() => serviceProducts.id),

    /** Optional custom target namespace checked. */
    targetSubjectType: varchar("target_subject_type", { length: 80 }),

    /** Optional custom target id checked. */
    targetSubjectId: varchar("target_subject_id", { length: 140 }),

    /** Optional booking order context where this check was run. */
    bookingOrderId: idRef("booking_order_id").references(() => bookingOrders.id),

    /** Snapshot outcome. */
    outcome: varchar("outcome", { length: 40 }).notNull(),

    /** Optional confidence score (0..100) from decision engine/provider. */
    confidence: integer("confidence"),

    /** Evaluation timestamp. */
    evaluatedAt: timestamp("evaluated_at", { withTimezone: true }).defaultNow().notNull(),

    /** Optional expiry timestamp for this eligibility result. */
    expiresAt: timestamp("expires_at", { withTimezone: true }),

    /** Optional short reason code. */
    reasonCode: varchar("reason_code", { length: 120 }),

    /** Raw response + normalized decision payload. */
    snapshot: jsonb("snapshot").default({}).notNull(),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    eligibilitySnapshotsBizIdIdUnique: uniqueIndex("eligibility_snapshots_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Main lookup path for repeat checks and staleness checks. */
    eligibilitySnapshotsBizMemberEvaluatedIdx: index(
      "eligibility_snapshots_biz_member_evaluated_idx",
    ).on(table.bizId, table.memberUserId, table.memberGroupAccountId, table.evaluatedAt),

    /** Operational path by outcome and recency. */
    eligibilitySnapshotsBizOutcomeEvaluatedIdx: index(
      "eligibility_snapshots_biz_outcome_evaluated_idx",
    ).on(table.bizId, table.outcome, table.evaluatedAt),

    /** Tenant-safe FK to parent authorization. */
    eligibilitySnapshotsBizPayerAuthorizationFk: foreignKey({
      columns: [table.bizId, table.payerAuthorizationId],
      foreignColumns: [payerAuthorizations.bizId, payerAuthorizations.id],
      name: "eligibility_snapshots_biz_payer_authorization_fk",
    }),

    /** Tenant-safe FK to offer context. */
    eligibilitySnapshotsBizOfferVersionFk: foreignKey({
      columns: [table.bizId, table.offerVersionId],
      foreignColumns: [offerVersions.bizId, offerVersions.id],
      name: "eligibility_snapshots_biz_offer_version_fk",
    }),

    /** Tenant-safe FK to service-product context. */
    eligibilitySnapshotsBizServiceProductFk: foreignKey({
      columns: [table.bizId, table.serviceProductId],
      foreignColumns: [serviceProducts.bizId, serviceProducts.id],
      name: "eligibility_snapshots_biz_service_product_fk",
    }),

    /** Tenant-safe FK to booking order context. */
    eligibilitySnapshotsBizBookingOrderFk: foreignKey({
      columns: [table.bizId, table.bookingOrderId],
      foreignColumns: [bookingOrders.bizId, bookingOrders.id],
      name: "eligibility_snapshots_biz_booking_order_fk",
    }),

    /** Tenant-safe FK to member subject pointer. */
    eligibilitySnapshotsBizMemberSubjectFk: foreignKey({
      columns: [table.bizId, table.memberSubjectType, table.memberSubjectId],
      foreignColumns: [subjects.bizId, subjects.subjectType, subjects.subjectId],
      name: "eligibility_snapshots_biz_member_subject_fk",
    }),

    /** Tenant-safe FK to target subject pointer. */
    eligibilitySnapshotsBizTargetSubjectFk: foreignKey({
      columns: [table.bizId, table.targetSubjectType, table.targetSubjectId],
      foreignColumns: [subjects.bizId, subjects.subjectType, subjects.subjectId],
      name: "eligibility_snapshots_biz_target_subject_fk",
    }),

    /** Member subject pointer should be fully null or fully set. */
    eligibilitySnapshotsMemberSubjectPairCheck: check(
      "eligibility_snapshots_member_subject_pair_check",
      sql`
      (
        "member_subject_type" IS NULL
        AND "member_subject_id" IS NULL
      ) OR (
        "member_subject_type" IS NOT NULL
        AND "member_subject_id" IS NOT NULL
      )
      `,
    ),

    /** Target subject pointer should be fully null or fully set. */
    eligibilitySnapshotsTargetSubjectPairCheck: check(
      "eligibility_snapshots_target_subject_pair_check",
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

    /** Exactly one member pointer is required for deterministic identity scope. */
    eligibilitySnapshotsMemberShapeCheck: check(
      "eligibility_snapshots_member_shape_check",
      sql`
      (
        ("member_user_id" IS NOT NULL)::int
        + ("member_group_account_id" IS NOT NULL)::int
        + ("member_subject_type" IS NOT NULL)::int
      ) = 1
      `,
    ),

    /** At least one target pointer should exist. */
    eligibilitySnapshotsTargetShapeCheck: check(
      "eligibility_snapshots_target_shape_check",
      sql`
      (
        ("offer_version_id" IS NOT NULL)::int
        + ("service_product_id" IS NOT NULL)::int
        + ("target_subject_type" IS NOT NULL)::int
      ) >= 1
      `,
    ),

    /** Outcome vocabulary and temporal/score bounds. */
    eligibilitySnapshotsOutcomeBoundsCheck: check(
      "eligibility_snapshots_outcome_bounds_check",
      sql`
      (
        "outcome" IN ('eligible', 'ineligible', 'conditional', 'error')
        OR "outcome" LIKE 'custom_%'
      )
      AND ("confidence" IS NULL OR ("confidence" >= 0 AND "confidence" <= 100))
      AND ("expires_at" IS NULL OR "expires_at" >= "evaluated_at")
      `,
    ),
  }),
);

export type PayerAuthorization = typeof payerAuthorizations.$inferSelect;
export type NewPayerAuthorization = typeof payerAuthorizations.$inferInsert;
export type EligibilitySnapshot = typeof eligibilitySnapshots.$inferSelect;
export type NewEligibilitySnapshot = typeof eligibilitySnapshots.$inferInsert;

