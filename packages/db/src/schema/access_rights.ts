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
  accessActionOutcomeEnum,
  accessActionTokenEventTypeEnum,
  accessActionTokenStatusEnum,
  accessActionTokenTypeEnum,
  accessActionTypeEnum,
  accessArtifactEventTypeEnum,
  accessArtifactLinkTypeEnum,
  accessArtifactStatusEnum,
  accessArtifactTypeEnum,
  accessDeliveryLinkChannelEnum,
  accessDeliveryLinkStatusEnum,
  accessResaleStatusEnum,
  accessSecurityDecisionOutcomeEnum,
  accessSecurityDecisionStatusEnum,
  accessSecuritySignalStatusEnum,
  accessSecuritySignalTypeEnum,
  accessTransferModeEnum,
  accessTransferStatusEnum,
  accessUsageWindowModeEnum,
  lifecycleStatusEnum,
} from "./enums";
import { entitlementGrants, memberships } from "./entitlements";
import { bookingOrderLines, bookingOrders, fulfillmentUnits } from "./fulfillment";
import { groupAccounts } from "./group_accounts";
import { paymentTransactions } from "./payments";
import { sellables } from "./product_commerce";
import { subjects } from "./subjects";
import { users } from "./users";

/**
 * access_artifacts
 *
 * ELI5:
 * This is one universal "access-right card".
 *
 * Why this table exists:
 * - businesses sell many kinds of access rights (license keys, tickets,
 *   downloads, replay access, gated content),
 * - each right has similar lifecycle needs (issued -> active -> suspended/
 *   revoked/expired),
 * - one backbone avoids creating separate one-off tables per product type.
 *
 * How it fits the bigger schema:
 * - links to `sellables` for commercial identity,
 * - links to holder identities (user/group/custom subject),
 * - link/event/log tables use this as their stable root id.
 */
export const accessArtifacts = pgTable(
  "access_artifacts",
  {
    /** Stable primary key for one reusable access-right artifact. */
    id: idWithTag("access_artifact"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Broad artifact class (license, ticket, download entitlement, etc.). */
    artifactType: accessArtifactTypeEnum("artifact_type").notNull(),

    /** Artifact lifecycle state. */
    status: accessArtifactStatusEnum("status").default("draft").notNull(),

    /**
     * Optional public code used by support/customer verification flows.
     *
     * Examples:
     * - license key visible to customer,
     * - ticket code shown in wallet,
     * - redemption code for support-assisted recovery.
     */
    publicCode: varchar("public_code", { length: 200 }),

    /**
     * Optional hash of secret/token material used for secure verification.
     *
     * We store hashes, not raw secrets.
     */
    secretHash: varchar("secret_hash", { length: 255 }),

    /** Optional direct user holder pointer. */
    holderUserId: idRef("holder_user_id").references(() => users.id),

    /** Optional shared-account holder pointer (family/company/group). */
    holderGroupAccountId: idRef("holder_group_account_id").references(
      () => groupAccounts.id,
    ),

    /** Optional custom-subject holder namespace. */
    holderSubjectType: varchar("holder_subject_type", { length: 80 }),

    /** Optional custom-subject holder id. */
    holderSubjectId: varchar("holder_subject_id", { length: 140 }),

    /** Optional canonical sellable this artifact grants rights for. */
    sellableId: idRef("sellable_id").references(() => sellables.id),

    /** Issuance timestamp of the artifact. */
    issuedAt: timestamp("issued_at", { withTimezone: true }).defaultNow().notNull(),

    /** Activation timestamp (when right becomes usable). */
    activatedAt: timestamp("activated_at", { withTimezone: true }),

    /** Expiry timestamp for time-bound access rights. */
    expiresAt: timestamp("expires_at", { withTimezone: true }),

    /** Suspension timestamp for temporary lockouts. */
    suspendedAt: timestamp("suspended_at", { withTimezone: true }),

    /** Revocation timestamp for permanent/manual invalidation. */
    revokedAt: timestamp("revoked_at", { withTimezone: true }),

    /** Consumption timestamp when one-time rights are fully consumed. */
    consumedAt: timestamp("consumed_at", { withTimezone: true }),

    /** Whether ownership transfer is allowed by policy for this artifact. */
    transferable: boolean("transferable").default(false).notNull(),

    /** Total usage units granted, if this artifact uses counters. */
    usageGranted: integer("usage_granted"),

    /** Remaining usage units, if this artifact uses counters. */
    usageRemaining: integer("usage_remaining"),

    /** Immutable policy snapshot copied at issuance for deterministic behavior. */
    policySnapshot: jsonb("policy_snapshot").default({}).notNull(),

    /** Extension payload for non-indexed domain details. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    accessArtifactsBizIdIdUnique: uniqueIndex("access_artifacts_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Composite key for tenant-safe child foreign keys. */

    /** Public code should be unique per tenant when present. */
    accessArtifactsBizPublicCodeUnique: uniqueIndex(
      "access_artifacts_biz_public_code_unique",
    )
      .on(table.bizId, table.publicCode)
      .where(sql`"public_code" IS NOT NULL`),

    /** Common operational board query path by type/status/time. */
    accessArtifactsBizTypeStatusIssuedIdx: index(
      "access_artifacts_biz_type_status_issued_idx",
    ).on(table.bizId, table.artifactType, table.status, table.issuedAt),

    /** Common owner-centric lookup for user portals. */
    accessArtifactsBizHolderUserStatusIdx: index(
      "access_artifacts_biz_holder_user_status_idx",
    ).on(table.bizId, table.holderUserId, table.status),

    /** Shared-account holder lookup path. */
    accessArtifactsBizHolderGroupStatusIdx: index(
      "access_artifacts_biz_holder_group_status_idx",
    ).on(table.bizId, table.holderGroupAccountId, table.status),

    /** Common sellable-right lookup path. */
    accessArtifactsBizSellableStatusIdx: index(
      "access_artifacts_biz_sellable_status_idx",
    ).on(table.bizId, table.sellableId, table.status),

    /** Tenant-safe FK to optional sellable root. */
    accessArtifactsBizSellableFk: foreignKey({
      columns: [table.bizId, table.sellableId],
      foreignColumns: [sellables.bizId, sellables.id],
      name: "access_artifacts_biz_sellable_fk",
    }),

    /** Tenant-safe FK to optional custom holder subject. */
    accessArtifactsBizHolderSubjectFk: foreignKey({
      columns: [table.bizId, table.holderSubjectType, table.holderSubjectId],
      foreignColumns: [subjects.bizId, subjects.subjectType, subjects.subjectId],
      name: "access_artifacts_biz_holder_subject_fk",
    }),

    /** Holder subject pointer must be fully null or fully populated. */
    accessArtifactsHolderSubjectPairCheck: check(
      "access_artifacts_holder_subject_pair_check",
      sql`
      (
        "holder_subject_type" IS NULL
        AND "holder_subject_id" IS NULL
      ) OR (
        "holder_subject_type" IS NOT NULL
        AND "holder_subject_id" IS NOT NULL
      )
      `,
    ),

    /** At most one holder source should be active for one artifact row. */
    accessArtifactsHolderShapeCheck: check(
      "access_artifacts_holder_shape_check",
      sql`
      (
        ("holder_user_id" IS NOT NULL)::int
        + ("holder_group_account_id" IS NOT NULL)::int
        + ("holder_subject_type" IS NOT NULL)::int
      ) <= 1
      `,
    ),

    /** Usage counters and timeline values must remain coherent. */
    accessArtifactsUsageAndTimelineCheck: check(
      "access_artifacts_usage_and_timeline_check",
      sql`
      ("usage_granted" IS NULL OR "usage_granted" >= 0)
      AND ("usage_remaining" IS NULL OR "usage_remaining" >= 0)
      AND (
        "usage_granted" IS NULL
        OR "usage_remaining" IS NULL
        OR "usage_remaining" <= "usage_granted"
      )
      AND ("activated_at" IS NULL OR "activated_at" >= "issued_at")
      AND ("expires_at" IS NULL OR "expires_at" >= "issued_at")
      AND ("suspended_at" IS NULL OR "suspended_at" >= "issued_at")
      AND ("revoked_at" IS NULL OR "revoked_at" >= "issued_at")
      AND ("consumed_at" IS NULL OR "consumed_at" >= "issued_at")
      `,
    ),

    /** Status-specific timestamps should exist when status implies final state. */
    accessArtifactsStatusTimestampCheck: check(
      "access_artifacts_status_timestamp_check",
      sql`
      ("status" <> 'revoked' OR "revoked_at" IS NOT NULL)
      AND ("status" <> 'consumed' OR "consumed_at" IS NOT NULL)
      `,
    ),
  }),
);

/**
 * access_artifact_links
 *
 * ELI5:
 * One access artifact can come from many sources (order, membership, grant) and
 * can also be linked to operational records (fulfillment unit, custom subject).
 *
 * This table keeps that relationship graph normalized and auditable.
 */
export const accessArtifactLinks = pgTable(
  "access_artifact_links",
  {
    /** Stable primary key for one artifact linkage row. */
    id: idWithTag("access_artifact_link"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent access artifact. */
    accessArtifactId: idRef("access_artifact_id")
      .references(() => accessArtifacts.id)
      .notNull(),

    /** Which target family this link points to. */
    linkType: accessArtifactLinkTypeEnum("link_type").notNull(),

    /** Optional role label (source, redemption, delivery_context, etc.). */
    relationKey: varchar("relation_key", { length: 120 }).default("source").notNull(),

    /** Optional sellable pointer when link_type=sellable. */
    sellableId: idRef("sellable_id").references(() => sellables.id),

    /** Optional booking order pointer when link_type=booking_order. */
    bookingOrderId: idRef("booking_order_id").references(() => bookingOrders.id),

    /** Optional booking order line pointer when link_type=booking_order_line. */
    bookingOrderLineId: idRef("booking_order_line_id").references(
      () => bookingOrderLines.id,
    ),

    /** Optional membership pointer when link_type=membership. */
    membershipId: idRef("membership_id").references(() => memberships.id),

    /** Optional entitlement grant pointer when link_type=entitlement_grant. */
    entitlementGrantId: idRef("entitlement_grant_id").references(
      () => entitlementGrants.id,
    ),

    /** Optional payment transaction pointer when link_type=payment_transaction. */
    paymentTransactionId: idRef("payment_transaction_id").references(
      () => paymentTransactions.id,
    ),

    /** Optional fulfillment-unit pointer when link_type=fulfillment_unit. */
    fulfillmentUnitId: idRef("fulfillment_unit_id").references(
      () => fulfillmentUnits.id,
    ),

    /** Optional custom subject namespace for extensible linkage. */
    customSubjectType: varchar("custom_subject_type", { length: 80 }),

    /** Optional custom subject id for extensible linkage. */
    customSubjectId: varchar("custom_subject_id", { length: 140 }),

    /** Optional external reference family when link_type=external_reference. */
    externalReferenceType: varchar("external_reference_type", { length: 80 }),

    /** Optional external reference id when link_type=external_reference. */
    externalReferenceId: varchar("external_reference_id", { length: 180 }),

    /** Extension payload for link-level metadata. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite key for tenant-safe link-event foreign keys. */
    accessArtifactLinksBizIdIdUnique: uniqueIndex(
      "access_artifact_links_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** Parent artifact traversal path. */
    accessArtifactLinksBizArtifactTypeIdx: index(
      "access_artifact_links_biz_artifact_type_idx",
    ).on(table.bizId, table.accessArtifactId, table.linkType),

    /** Role-specific link lookup path. */
    accessArtifactLinksBizArtifactRoleIdx: index(
      "access_artifact_links_biz_artifact_role_idx",
    ).on(table.bizId, table.accessArtifactId, table.relationKey),

    /** Tenant-safe FK to parent artifact. */
    accessArtifactLinksBizArtifactFk: foreignKey({
      columns: [table.bizId, table.accessArtifactId],
      foreignColumns: [accessArtifacts.bizId, accessArtifacts.id],
      name: "access_artifact_links_biz_artifact_fk",
    }),

    /** Tenant-safe FK to optional sellable pointer. */
    accessArtifactLinksBizSellableFk: foreignKey({
      columns: [table.bizId, table.sellableId],
      foreignColumns: [sellables.bizId, sellables.id],
      name: "access_artifact_links_biz_sellable_fk",
    }),

    /** Tenant-safe FK to optional booking order pointer. */
    accessArtifactLinksBizBookingOrderFk: foreignKey({
      columns: [table.bizId, table.bookingOrderId],
      foreignColumns: [bookingOrders.bizId, bookingOrders.id],
      name: "access_artifact_links_biz_booking_order_fk",
    }),

    /** Tenant-safe FK to optional booking order line pointer. */
    accessArtifactLinksBizBookingOrderLineFk: foreignKey({
      columns: [table.bizId, table.bookingOrderLineId],
      foreignColumns: [bookingOrderLines.bizId, bookingOrderLines.id],
      name: "access_artifact_links_biz_booking_order_line_fk",
    }),

    /** Tenant-safe FK to optional membership pointer. */
    accessArtifactLinksBizMembershipFk: foreignKey({
      columns: [table.bizId, table.membershipId],
      foreignColumns: [memberships.bizId, memberships.id],
      name: "access_artifact_links_biz_membership_fk",
    }),

    /** Tenant-safe FK to optional entitlement-grant pointer. */
    accessArtifactLinksBizEntitlementGrantFk: foreignKey({
      columns: [table.bizId, table.entitlementGrantId],
      foreignColumns: [entitlementGrants.bizId, entitlementGrants.id],
      name: "access_artifact_links_biz_entitlement_grant_fk",
    }),

    /** Tenant-safe FK to optional payment transaction pointer. */
    accessArtifactLinksBizPaymentTransactionFk: foreignKey({
      columns: [table.bizId, table.paymentTransactionId],
      foreignColumns: [paymentTransactions.bizId, paymentTransactions.id],
      name: "access_artifact_links_biz_payment_transaction_fk",
    }),

    /** Tenant-safe FK to optional fulfillment unit pointer. */
    accessArtifactLinksBizFulfillmentUnitFk: foreignKey({
      columns: [table.bizId, table.fulfillmentUnitId],
      foreignColumns: [fulfillmentUnits.bizId, fulfillmentUnits.id],
      name: "access_artifact_links_biz_fulfillment_unit_fk",
    }),

    /** Tenant-safe FK to optional custom subject pointer. */
    accessArtifactLinksBizCustomSubjectFk: foreignKey({
      columns: [table.bizId, table.customSubjectType, table.customSubjectId],
      foreignColumns: [subjects.bizId, subjects.subjectType, subjects.subjectId],
      name: "access_artifact_links_biz_custom_subject_fk",
    }),

    /** Custom-subject pointer should be fully null or fully populated. */
    accessArtifactLinksCustomSubjectPairCheck: check(
      "access_artifact_links_custom_subject_pair_check",
      sql`
      (
        "custom_subject_type" IS NULL
        AND "custom_subject_id" IS NULL
      ) OR (
        "custom_subject_type" IS NOT NULL
        AND "custom_subject_id" IS NOT NULL
      )
      `,
    ),

    /** External reference pointer should be fully null or fully populated. */
    accessArtifactLinksExternalReferencePairCheck: check(
      "access_artifact_links_external_reference_pair_check",
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

    /**
     * Ensures link payload shape matches link_type exactly.
     *
     * This keeps link semantics deterministic and prevents partially-valid rows.
     */
    accessArtifactLinksShapeCheck: check(
      "access_artifact_links_shape_check",
      sql`
      (
        "link_type" = 'sellable'
        AND "sellable_id" IS NOT NULL
        AND "booking_order_id" IS NULL
        AND "booking_order_line_id" IS NULL
        AND "membership_id" IS NULL
        AND "entitlement_grant_id" IS NULL
        AND "payment_transaction_id" IS NULL
        AND "fulfillment_unit_id" IS NULL
        AND "custom_subject_type" IS NULL
        AND "custom_subject_id" IS NULL
        AND "external_reference_type" IS NULL
        AND "external_reference_id" IS NULL
      ) OR (
        "link_type" = 'booking_order'
        AND "sellable_id" IS NULL
        AND "booking_order_id" IS NOT NULL
        AND "booking_order_line_id" IS NULL
        AND "membership_id" IS NULL
        AND "entitlement_grant_id" IS NULL
        AND "payment_transaction_id" IS NULL
        AND "fulfillment_unit_id" IS NULL
        AND "custom_subject_type" IS NULL
        AND "custom_subject_id" IS NULL
        AND "external_reference_type" IS NULL
        AND "external_reference_id" IS NULL
      ) OR (
        "link_type" = 'booking_order_line'
        AND "sellable_id" IS NULL
        AND "booking_order_id" IS NULL
        AND "booking_order_line_id" IS NOT NULL
        AND "membership_id" IS NULL
        AND "entitlement_grant_id" IS NULL
        AND "payment_transaction_id" IS NULL
        AND "fulfillment_unit_id" IS NULL
        AND "custom_subject_type" IS NULL
        AND "custom_subject_id" IS NULL
        AND "external_reference_type" IS NULL
        AND "external_reference_id" IS NULL
      ) OR (
        "link_type" = 'membership'
        AND "sellable_id" IS NULL
        AND "booking_order_id" IS NULL
        AND "booking_order_line_id" IS NULL
        AND "membership_id" IS NOT NULL
        AND "entitlement_grant_id" IS NULL
        AND "payment_transaction_id" IS NULL
        AND "fulfillment_unit_id" IS NULL
        AND "custom_subject_type" IS NULL
        AND "custom_subject_id" IS NULL
        AND "external_reference_type" IS NULL
        AND "external_reference_id" IS NULL
      ) OR (
        "link_type" = 'entitlement_grant'
        AND "sellable_id" IS NULL
        AND "booking_order_id" IS NULL
        AND "booking_order_line_id" IS NULL
        AND "membership_id" IS NULL
        AND "entitlement_grant_id" IS NOT NULL
        AND "payment_transaction_id" IS NULL
        AND "fulfillment_unit_id" IS NULL
        AND "custom_subject_type" IS NULL
        AND "custom_subject_id" IS NULL
        AND "external_reference_type" IS NULL
        AND "external_reference_id" IS NULL
      ) OR (
        "link_type" = 'payment_transaction'
        AND "sellable_id" IS NULL
        AND "booking_order_id" IS NULL
        AND "booking_order_line_id" IS NULL
        AND "membership_id" IS NULL
        AND "entitlement_grant_id" IS NULL
        AND "payment_transaction_id" IS NOT NULL
        AND "fulfillment_unit_id" IS NULL
        AND "custom_subject_type" IS NULL
        AND "custom_subject_id" IS NULL
        AND "external_reference_type" IS NULL
        AND "external_reference_id" IS NULL
      ) OR (
        "link_type" = 'fulfillment_unit'
        AND "sellable_id" IS NULL
        AND "booking_order_id" IS NULL
        AND "booking_order_line_id" IS NULL
        AND "membership_id" IS NULL
        AND "entitlement_grant_id" IS NULL
        AND "payment_transaction_id" IS NULL
        AND "fulfillment_unit_id" IS NOT NULL
        AND "custom_subject_type" IS NULL
        AND "custom_subject_id" IS NULL
        AND "external_reference_type" IS NULL
        AND "external_reference_id" IS NULL
      ) OR (
        "link_type" = 'custom_subject'
        AND "sellable_id" IS NULL
        AND "booking_order_id" IS NULL
        AND "booking_order_line_id" IS NULL
        AND "membership_id" IS NULL
        AND "entitlement_grant_id" IS NULL
        AND "payment_transaction_id" IS NULL
        AND "fulfillment_unit_id" IS NULL
        AND "custom_subject_type" IS NOT NULL
        AND "custom_subject_id" IS NOT NULL
        AND "external_reference_type" IS NULL
        AND "external_reference_id" IS NULL
      ) OR (
        "link_type" = 'external_reference'
        AND "sellable_id" IS NULL
        AND "booking_order_id" IS NULL
        AND "booking_order_line_id" IS NULL
        AND "membership_id" IS NULL
        AND "entitlement_grant_id" IS NULL
        AND "payment_transaction_id" IS NULL
        AND "fulfillment_unit_id" IS NULL
        AND "custom_subject_type" IS NULL
        AND "custom_subject_id" IS NULL
        AND "external_reference_type" IS NOT NULL
        AND "external_reference_id" IS NOT NULL
      )
      `,
    ),
  }),
);

/**
 * access_artifact_events
 *
 * ELI5:
 * Append-only timeline of state changes and usage movements for one artifact.
 *
 * Why this matters:
 * - makes support and compliance explainable,
 * - keeps behavior replayable and auditable,
 * - enables analytics without mutating history.
 */
export const accessArtifactEvents = pgTable(
  "access_artifact_events",
  {
    /** Stable primary key for one timeline event. */
    id: idWithTag("access_artifact_event"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent artifact receiving this event. */
    accessArtifactId: idRef("access_artifact_id")
      .references(() => accessArtifacts.id)
      .notNull(),

    /** Event classification. */
    eventType: accessArtifactEventTypeEnum("event_type").notNull(),

    /** Event occurrence timestamp. */
    happenedAt: timestamp("happened_at", { withTimezone: true }).defaultNow().notNull(),

    /**
     * Signed quantity change represented by this event.
     *
     * Examples:
     * - usage debit: -1
     * - usage credit/recovery: +1
     * - non-usage events: 0
     */
    quantityDelta: integer("quantity_delta").default(0).notNull(),

    /** Optional action outcome context for verification/access events. */
    outcome: accessActionOutcomeEnum("outcome"),

    /** Optional machine-readable reason code. */
    reasonCode: varchar("reason_code", { length: 80 }),

    /** Optional human-readable reason/details. */
    reasonText: text("reason_text"),

    /** Optional user actor pointer for this event. */
    actorUserId: idRef("actor_user_id").references(() => users.id),

    /** Optional custom actor subject namespace (system/plugin worker/etc.). */
    actorSubjectType: varchar("actor_subject_type", { length: 80 }),

    /** Optional custom actor subject id. */
    actorSubjectId: varchar("actor_subject_id", { length: 140 }),

    /** Optional idempotency key for event writers. */
    requestKey: varchar("request_key", { length: 140 }),

    /** Event payload snapshot for deterministic replay/explanation. */
    payload: jsonb("payload").default({}).notNull(),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    accessArtifactEventsBizIdIdUnique: uniqueIndex("access_artifact_events_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Parent artifact timeline query path. */
    accessArtifactEventsBizArtifactHappenedIdx: index(
      "access_artifact_events_biz_artifact_happened_idx",
    ).on(table.bizId, table.accessArtifactId, table.happenedAt),

    /** Event-type analytics query path. */
    accessArtifactEventsBizTypeHappenedIdx: index(
      "access_artifact_events_biz_type_happened_idx",
    ).on(table.bizId, table.eventType, table.happenedAt),

    /** Optional dedupe key path for idempotent event writers. */
    accessArtifactEventsBizRequestKeyUnique: uniqueIndex(
      "access_artifact_events_biz_request_key_unique",
    )
      .on(table.bizId, table.requestKey)
      .where(sql`"request_key" IS NOT NULL`),

    /** Tenant-safe FK to parent artifact. */
    accessArtifactEventsBizArtifactFk: foreignKey({
      columns: [table.bizId, table.accessArtifactId],
      foreignColumns: [accessArtifacts.bizId, accessArtifacts.id],
      name: "access_artifact_events_biz_artifact_fk",
    }),

    /** Tenant-safe FK to optional actor subject pointer. */
    accessArtifactEventsBizActorSubjectFk: foreignKey({
      columns: [table.bizId, table.actorSubjectType, table.actorSubjectId],
      foreignColumns: [subjects.bizId, subjects.subjectType, subjects.subjectId],
      name: "access_artifact_events_biz_actor_subject_fk",
    }),

    /** Actor subject pointer should be fully null or fully populated. */
    accessArtifactEventsActorSubjectPairCheck: check(
      "access_artifact_events_actor_subject_pair_check",
      sql`
      (
        "actor_subject_type" IS NULL
        AND "actor_subject_id" IS NULL
      ) OR (
        "actor_subject_type" IS NOT NULL
        AND "actor_subject_id" IS NOT NULL
      )
      `,
    ),

    /**
     * Quantity delta semantics should match usage event types.
     *
     * This protects against inconsistent event math that breaks ledgers.
     */
    accessArtifactEventsQuantityDeltaShapeCheck: check(
      "access_artifact_events_quantity_delta_shape_check",
      sql`
      (
        "event_type" = 'usage_debited'
        AND "quantity_delta" < 0
      ) OR (
        "event_type" = 'usage_credited'
        AND "quantity_delta" > 0
      ) OR (
        "event_type" NOT IN ('usage_debited', 'usage_credited')
      )
      `,
    ),
  }),
);

/**
 * access_activity_logs
 *
 * ELI5:
 * This is the immutable telemetry table for access attempts (verify/download/
 * redeem/etc.) including outcome and risk context.
 *
 * Why this matters:
 * - supports abuse detection and support debugging,
 * - enables policy engines to reason over historical behavior,
 * - provides auditable evidence for delivery-security controls.
 */
export const accessActivityLogs = pgTable(
  "access_activity_logs",
  {
    /** Stable primary key for one access attempt record. */
    id: idWithTag("access_activity_log"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Optional artifact pointer (null when artifact cannot be resolved). */
    accessArtifactId: idRef("access_artifact_id").references(() => accessArtifacts.id),

    /** Attempted action type. */
    actionType: accessActionTypeEnum("action_type").notNull(),

    /** Attempt outcome classification. */
    outcome: accessActionOutcomeEnum("outcome").notNull(),

    /** Occurrence timestamp. */
    occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),

    /** Optional user actor performing the action. */
    actorUserId: idRef("actor_user_id").references(() => users.id),

    /** Optional custom actor subject namespace for non-user actors. */
    actorSubjectType: varchar("actor_subject_type", { length: 80 }),

    /** Optional custom actor subject id for non-user actors. */
    actorSubjectId: varchar("actor_subject_id", { length: 140 }),

    /** IP address in string format (IPv4/IPv6). */
    ipAddress: varchar("ip_address", { length: 64 }),

    /** Optional ISO-like 2-letter country code. */
    countryCode: varchar("country_code", { length: 2 }),

    /** Optional hash/fingerprint of user-agent string. */
    userAgentHash: varchar("user_agent_hash", { length: 128 }),

    /** Optional stable device fingerprint id. */
    deviceFingerprint: varchar("device_fingerprint", { length: 180 }),

    /** Optional normalized risk score (0..100). */
    riskScore: integer("risk_score"),

    /** Optional structured risk signals snapshot. */
    riskSignals: jsonb("risk_signals").default({}),

    /** Optional short message for diagnostics/support. */
    message: varchar("message", { length: 400 }),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite key for tenant-safe references from downstream policy tables. */
    accessActivityLogsBizIdIdUnique: uniqueIndex(
      "access_activity_logs_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** Main operations/risk timeline query path. */
    accessActivityLogsBizOccurredIdx: index("access_activity_logs_biz_occurred_idx").on(
      table.bizId,
      table.occurredAt,
    ),

    /** Artifact-centric access timeline path. */
    accessActivityLogsBizArtifactOccurredIdx: index(
      "access_activity_logs_biz_artifact_occurred_idx",
    ).on(table.bizId, table.accessArtifactId, table.occurredAt),

    /** Action/outcome analysis path. */
    accessActivityLogsBizActionOutcomeOccurredIdx: index(
      "access_activity_logs_biz_action_outcome_occurred_idx",
    ).on(table.bizId, table.actionType, table.outcome, table.occurredAt),

    /** Tenant-safe FK to optional artifact pointer. */
    accessActivityLogsBizArtifactFk: foreignKey({
      columns: [table.bizId, table.accessArtifactId],
      foreignColumns: [accessArtifacts.bizId, accessArtifacts.id],
      name: "access_activity_logs_biz_artifact_fk",
    }),

    /** Tenant-safe FK to optional actor subject pointer. */
    accessActivityLogsBizActorSubjectFk: foreignKey({
      columns: [table.bizId, table.actorSubjectType, table.actorSubjectId],
      foreignColumns: [subjects.bizId, subjects.subjectType, subjects.subjectId],
      name: "access_activity_logs_biz_actor_subject_fk",
    }),

    /** Actor subject pointer should be fully null or fully populated. */
    accessActivityLogsActorSubjectPairCheck: check(
      "access_activity_logs_actor_subject_pair_check",
      sql`
      (
        "actor_subject_type" IS NULL
        AND "actor_subject_id" IS NULL
      ) OR (
        "actor_subject_type" IS NOT NULL
        AND "actor_subject_id" IS NOT NULL
      )
      `,
    ),

    /** Risk and country fields should stay in valid bounds/shapes. */
    accessActivityLogsRiskAndCountryCheck: check(
      "access_activity_logs_risk_and_country_check",
      sql`
      ("risk_score" IS NULL OR ("risk_score" >= 0 AND "risk_score" <= 100))
      AND ("country_code" IS NULL OR "country_code" ~ '^[A-Z]{2}$')
      `,
    ),
  }),
);

/**
 * access_usage_windows
 *
 * ELI5:
 * Reusable policy rows that define "how many times/how much" an artifact can
 * be used over specific windows.
 *
 * Examples:
 * - max 5 downloads in lifetime,
 * - max 3 verifications per rolling 24 hours,
 * - max 1 transfer per calendar day.
 */
export const accessUsageWindows = pgTable(
  "access_usage_windows",
  {
    /** Stable primary key for one usage-limit policy row. */
    id: idWithTag("access_usage_window"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent artifact this usage policy applies to. */
    accessArtifactId: idRef("access_artifact_id")
      .references(() => accessArtifacts.id)
      .notNull(),

    /** Action this limit policy applies to. */
    actionType: accessActionTypeEnum("action_type").notNull(),

    /** Window evaluation mode. */
    windowMode: accessUsageWindowModeEnum("window_mode").notNull(),

    /** Max number of events allowed in the window (optional). */
    maxEvents: integer("max_events"),

    /** Max quantity sum allowed in the window (optional). */
    maxQuantity: integer("max_quantity"),

    /** Window size in seconds for rolling/fixed-window modes. */
    windowSeconds: integer("window_seconds"),

    /** Optional fixed-window start timestamp. */
    windowStartsAt: timestamp("window_starts_at", { withTimezone: true }),

    /** Optional fixed-window end timestamp. */
    windowEndsAt: timestamp("window_ends_at", { withTimezone: true }),

    /** Timezone for calendar-day mode semantics. */
    timezone: varchar("timezone", { length: 50 }).default("UTC").notNull(),

    /** Soft limits only warn; hard limits block. */
    isSoftLimit: boolean("is_soft_limit").default(false).notNull(),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /**
     * Composite unique key required for tenant-safe composite FKs.
     *
     * Why:
     * - child tables reference access usage windows using `(biz_id, id)`,
     * - PostgreSQL requires referenced columns to be covered by a unique/PK
     *   constraint with the exact column set/order.
     */
    accessUsageWindowsBizIdIdUnique: uniqueIndex(
      "access_usage_windows_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** Parent artifact + action query path for limit evaluators. */
    accessUsageWindowsBizArtifactActionIdx: index(
      "access_usage_windows_biz_artifact_action_idx",
    ).on(table.bizId, table.accessArtifactId, table.actionType),

    /** Tenant-safe FK to parent artifact. */
    accessUsageWindowsBizArtifactFk: foreignKey({
      columns: [table.bizId, table.accessArtifactId],
      foreignColumns: [accessArtifacts.bizId, accessArtifacts.id],
      name: "access_usage_windows_biz_artifact_fk",
    }),

    /** Numeric bounds and window ordering sanity checks. */
    accessUsageWindowsBoundsCheck: check(
      "access_usage_windows_bounds_check",
      sql`
      ("max_events" IS NULL OR "max_events" > 0)
      AND ("max_quantity" IS NULL OR "max_quantity" > 0)
      AND ("window_seconds" IS NULL OR "window_seconds" > 0)
      AND (
        "window_starts_at" IS NULL
        OR "window_ends_at" IS NULL
        OR "window_ends_at" > "window_starts_at"
      )
      `,
    ),

    /** At least one limit axis must be configured. */
    accessUsageWindowsConfiguredLimitCheck: check(
      "access_usage_windows_configured_limit_check",
      sql`"max_events" IS NOT NULL OR "max_quantity" IS NOT NULL`,
    ),

    /** Mode-specific shape contract for deterministic evaluators. */
    accessUsageWindowsModeShapeCheck: check(
      "access_usage_windows_mode_shape_check",
      sql`
      (
        "window_mode" = 'lifetime'
        AND "window_seconds" IS NULL
        AND "window_starts_at" IS NULL
        AND "window_ends_at" IS NULL
      ) OR (
        "window_mode" = 'rolling_window'
        AND "window_seconds" IS NOT NULL
      ) OR (
        "window_mode" = 'calendar_day'
      ) OR (
        "window_mode" = 'fixed_window'
        AND "window_starts_at" IS NOT NULL
        AND "window_ends_at" IS NOT NULL
      )
      `,
    ),
  }),
);

/**
 * access_delivery_links
 *
 * ELI5:
 * This table stores one controlled delivery token/link for an access artifact.
 *
 * Why it exists:
 * - secure download and replay links need explicit expiry + usage caps,
 * - support teams need controlled reissue with full audit trail,
 * - abuse monitoring needs deterministic link lifecycle states.
 */
export const accessDeliveryLinks = pgTable(
  "access_delivery_links",
  {
    /** Stable primary key for one delivery-link issuance. */
    id: idWithTag("access_delivery_link"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent artifact this delivery link grants access to. */
    accessArtifactId: idRef("access_artifact_id")
      .references(() => accessArtifacts.id)
      .notNull(),

    /** Delivery channel where this link/token is used or distributed. */
    channel: accessDeliveryLinkChannelEnum("channel").notNull(),

    /** Delivery link lifecycle status. */
    status: accessDeliveryLinkStatusEnum("status").default("active").notNull(),

    /** Hash of the opaque token (never store raw token). */
    tokenHash: varchar("token_hash", { length: 255 }).notNull(),

    /** Optional human-safe preview (last 4 chars etc.) for support screens. */
    tokenPreview: varchar("token_preview", { length: 40 }),

    /** Link issue timestamp. */
    issuedAt: timestamp("issued_at", { withTimezone: true }).defaultNow().notNull(),

    /** Expiry timestamp for this link/token. */
    expiresAt: timestamp("expires_at", { withTimezone: true }),

    /** Revocation timestamp when invalidated before expiry. */
    revokedAt: timestamp("revoked_at", { withTimezone: true }),

    /** Consumption timestamp when one-time links are consumed. */
    consumedAt: timestamp("consumed_at", { withTimezone: true }),

    /** Max allowed uses for this link/token. */
    maxAccessCount: integer("max_access_count").default(1).notNull(),

    /** Number of successful uses so far. */
    usedAccessCount: integer("used_access_count").default(0).notNull(),

    /** Last successful access timestamp via this link. */
    lastAccessAt: timestamp("last_access_at", { withTimezone: true }),

    /** Optional destination snapshot (email/phone/ref) where link was sent. */
    deliveryTarget: varchar("delivery_target", { length: 255 }),

    /** Optional idempotency key for deterministic send/reissue workers. */
    requestKey: varchar("request_key", { length: 140 }),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite key for tenant-safe link-usage and analytics joins. */
    accessDeliveryLinksBizIdIdUnique: uniqueIndex(
      "access_delivery_links_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** Token hash should be unique per tenant to prevent ambiguity. */
    accessDeliveryLinksBizTokenHashUnique: uniqueIndex(
      "access_delivery_links_biz_token_hash_unique",
    ).on(table.bizId, table.tokenHash),

    /** Optional idempotency key path for reissue workers. */
    accessDeliveryLinksBizRequestKeyUnique: uniqueIndex(
      "access_delivery_links_biz_request_key_unique",
    )
      .on(table.bizId, table.requestKey)
      .where(sql`"request_key" IS NOT NULL`),

    /** Operational query path by artifact/status/expiry. */
    accessDeliveryLinksBizArtifactStatusExpiryIdx: index(
      "access_delivery_links_biz_artifact_status_expiry_idx",
    ).on(table.bizId, table.accessArtifactId, table.status, table.expiresAt),

    /** Tenant-safe FK to parent artifact. */
    accessDeliveryLinksBizArtifactFk: foreignKey({
      columns: [table.bizId, table.accessArtifactId],
      foreignColumns: [accessArtifacts.bizId, accessArtifacts.id],
      name: "access_delivery_links_biz_artifact_fk",
    }),

    /** Access counts and timeline values should remain coherent. */
    accessDeliveryLinksCountsAndTimelineCheck: check(
      "access_delivery_links_counts_and_timeline_check",
      sql`
      "max_access_count" > 0
      AND "used_access_count" >= 0
      AND "used_access_count" <= "max_access_count"
      AND ("expires_at" IS NULL OR "expires_at" >= "issued_at")
      AND ("revoked_at" IS NULL OR "revoked_at" >= "issued_at")
      AND ("consumed_at" IS NULL OR "consumed_at" >= "issued_at")
      AND ("last_access_at" IS NULL OR "last_access_at" >= "issued_at")
      `,
    ),

    /** Status-specific timestamp coherence. */
    accessDeliveryLinksStatusTimestampCheck: check(
      "access_delivery_links_status_timestamp_check",
      sql`
      ("status" <> 'consumed' OR "consumed_at" IS NOT NULL)
      AND ("status" <> 'revoked' OR "revoked_at" IS NOT NULL)
      `,
    ),
  }),
);

/**
 * access_action_tokens
 *
 * ELI5:
 * A token is a temporary "key" used to perform one access action safely
 * (open link, validate check-in code, redeem one-time right, etc.).
 *
 * Why this exists when `access_delivery_links` also exists:
 * - `access_delivery_links` models delivery/distribution artifacts,
 * - `access_action_tokens` models action-execution credentials.
 *
 * One access artifact can have many action tokens over time.
 */
export const accessActionTokens = pgTable(
  "access_action_tokens",
  {
    /** Stable primary key for one action token row. */
    id: idWithTag("access_action_token"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent access artifact this token authorizes actions against. */
    accessArtifactId: idRef("access_artifact_id")
      .references(() => accessArtifacts.id)
      .notNull(),

    /** Which action this token is valid for. */
    actionType: accessActionTypeEnum("action_type").notNull(),

    /** Token shape for UI/transport handling. */
    tokenType: accessActionTokenTypeEnum("token_type")
      .default("opaque_link")
      .notNull(),

    /** Token lifecycle status. */
    status: accessActionTokenStatusEnum("status").default("active").notNull(),

    /** Secure hash of token material (never store raw token). */
    tokenHash: varchar("token_hash", { length: 255 }).notNull(),

    /** Optional support-safe preview (last characters, masked code, etc.). */
    tokenPreview: varchar("token_preview", { length: 50 }),

    /** Maximum successful validations allowed before token is consumed. */
    maxValidationCount: integer("max_validation_count").default(1).notNull(),

    /** Current successful validation count. */
    successfulValidationCount: integer("successful_validation_count")
      .default(0)
      .notNull(),

    /** Token issuance time. */
    issuedAt: timestamp("issued_at", { withTimezone: true }).defaultNow().notNull(),

    /** Optional expiry time. */
    expiresAt: timestamp("expires_at", { withTimezone: true }),

    /** First successful validation timestamp. */
    firstValidatedAt: timestamp("first_validated_at", { withTimezone: true }),

    /** Last successful validation timestamp. */
    lastValidatedAt: timestamp("last_validated_at", { withTimezone: true }),

    /** Mark when token becomes fully consumed/used. */
    usedAt: timestamp("used_at", { withTimezone: true }),

    /** Mark when token is manually revoked. */
    revokedAt: timestamp("revoked_at", { withTimezone: true }),

    /**
     * Optional intended direct user holder.
     *
     * Use this when token should only validate for one specific user.
     */
    intendedHolderUserId: idRef("intended_holder_user_id").references(() => users.id),

    /**
     * Optional intended group-account holder.
     *
     * Use this when token is valid for members in a shared account.
     */
    intendedHolderGroupAccountId: idRef("intended_holder_group_account_id").references(
      () => groupAccounts.id,
    ),

    /** Optional intended custom holder namespace. */
    intendedHolderSubjectType: varchar("intended_holder_subject_type", {
      length: 80,
    }),

    /** Optional intended custom holder id. */
    intendedHolderSubjectId: varchar("intended_holder_subject_id", { length: 140 }),

    /** Optional idempotency key for deterministic issuance/reissue writers. */
    requestKey: varchar("request_key", { length: 140 }),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite key used by token-event and decision child tables. */
    accessActionTokensBizIdIdUnique: uniqueIndex(
      "access_action_tokens_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** Token hash should be unique per tenant. */
    accessActionTokensBizTokenHashUnique: uniqueIndex(
      "access_action_tokens_biz_token_hash_unique",
    ).on(table.bizId, table.tokenHash),

    /** Optional idempotency dedupe key. */
    accessActionTokensBizRequestKeyUnique: uniqueIndex(
      "access_action_tokens_biz_request_key_unique",
    )
      .on(table.bizId, table.requestKey)
      .where(sql`"request_key" IS NOT NULL`),

    /** Artifact/action operational query path. */
    accessActionTokensBizArtifactActionStatusIdx: index(
      "access_action_tokens_biz_artifact_action_status_idx",
    ).on(table.bizId, table.accessArtifactId, table.actionType, table.status),

    /** Expiry sweeper query path. */
    accessActionTokensBizStatusExpiryIdx: index(
      "access_action_tokens_biz_status_expiry_idx",
    ).on(table.bizId, table.status, table.expiresAt),

    /** Tenant-safe FK to parent artifact. */
    accessActionTokensBizArtifactFk: foreignKey({
      columns: [table.bizId, table.accessArtifactId],
      foreignColumns: [accessArtifacts.bizId, accessArtifacts.id],
      name: "access_action_tokens_biz_artifact_fk",
    }),

    /** Tenant-safe FK to optional intended custom holder pointer. */
    accessActionTokensBizIntendedSubjectFk: foreignKey({
      columns: [
        table.bizId,
        table.intendedHolderSubjectType,
        table.intendedHolderSubjectId,
      ],
      foreignColumns: [subjects.bizId, subjects.subjectType, subjects.subjectId],
      name: "access_action_tokens_biz_intended_subject_fk",
    }),

    /** Intended subject pointer should be fully null or fully populated. */
    accessActionTokensIntendedSubjectPairCheck: check(
      "access_action_tokens_intended_subject_pair_check",
      sql`
      (
        "intended_holder_subject_type" IS NULL
        AND "intended_holder_subject_id" IS NULL
      ) OR (
        "intended_holder_subject_type" IS NOT NULL
        AND "intended_holder_subject_id" IS NOT NULL
      )
      `,
    ),

    /** Intended-holder shape should never be ambiguous. */
    accessActionTokensIntendedHolderShapeCheck: check(
      "access_action_tokens_intended_holder_shape_check",
      sql`
      (
        ("intended_holder_user_id" IS NOT NULL)::int
        + ("intended_holder_group_account_id" IS NOT NULL)::int
        + ("intended_holder_subject_type" IS NOT NULL)::int
      ) <= 1
      `,
    ),

    /** Token counts and timeline values should stay coherent. */
    accessActionTokensCountsAndTimelineCheck: check(
      "access_action_tokens_counts_timeline_check",
      sql`
      "max_validation_count" > 0
      AND "successful_validation_count" >= 0
      AND "successful_validation_count" <= "max_validation_count"
      AND ("expires_at" IS NULL OR "expires_at" >= "issued_at")
      AND ("first_validated_at" IS NULL OR "first_validated_at" >= "issued_at")
      AND ("last_validated_at" IS NULL OR "last_validated_at" >= "issued_at")
      AND (
        "first_validated_at" IS NULL
        OR "last_validated_at" IS NULL
        OR "last_validated_at" >= "first_validated_at"
      )
      AND ("used_at" IS NULL OR "used_at" >= "issued_at")
      AND ("revoked_at" IS NULL OR "revoked_at" >= "issued_at")
      `,
    ),

    /** Terminal statuses should carry matching timestamps. */
    accessActionTokensStatusShapeCheck: check(
      "access_action_tokens_status_shape_check",
      sql`
      ("status" <> 'used' OR "used_at" IS NOT NULL)
      AND ("status" <> 'consumed' OR "used_at" IS NOT NULL)
      AND ("status" <> 'revoked' OR "revoked_at" IS NOT NULL)
      `,
    ),
  }),
);

/**
 * access_action_token_events
 *
 * ELI5:
 * Immutable timeline for token lifecycle and validation attempts.
 *
 * This gives support/compliance a deterministic history of what happened to
 * each token and why.
 */
export const accessActionTokenEvents = pgTable(
  "access_action_token_events",
  {
    /** Stable primary key for one token event row. */
    id: idWithTag("access_action_token_event"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent action token. */
    accessActionTokenId: idRef("access_action_token_id")
      .references(() => accessActionTokens.id)
      .notNull(),

    /** Event classification. */
    eventType: accessActionTokenEventTypeEnum("event_type").notNull(),

    /** Event occurrence timestamp. */
    happenedAt: timestamp("happened_at", { withTimezone: true }).defaultNow().notNull(),

    /** Optional action outcome context for validation events. */
    outcome: accessActionOutcomeEnum("outcome"),

    /** Optional related access attempt log row for correlation. */
    accessActivityLogId: idRef("access_activity_log_id").references(
      () => accessActivityLogs.id,
    ),

    /** Optional direct user actor. */
    actorUserId: idRef("actor_user_id").references(() => users.id),

    /** Optional custom actor namespace. */
    actorSubjectType: varchar("actor_subject_type", { length: 80 }),

    /** Optional custom actor id. */
    actorSubjectId: varchar("actor_subject_id", { length: 140 }),

    /** Optional actor IP address. */
    ipAddress: varchar("ip_address", { length: 64 }),

    /** Optional actor country code. */
    countryCode: varchar("country_code", { length: 2 }),

    /** Optional user-agent hash for deterministic privacy-safe grouping. */
    userAgentHash: varchar("user_agent_hash", { length: 128 }),

    /** Optional device fingerprint. */
    deviceFingerprint: varchar("device_fingerprint", { length: 180 }),

    /** Optional machine-readable reason code. */
    reasonCode: varchar("reason_code", { length: 80 }),

    /** Optional human-readable reason detail. */
    reasonText: text("reason_text"),

    /** Structured details payload for the event. */
    payload: jsonb("payload").default({}).notNull(),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    accessActionTokenEventsBizIdIdUnique: uniqueIndex("access_action_token_events_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Token timeline query path. */
    accessActionTokenEventsBizTokenHappenedIdx: index(
      "access_action_token_events_biz_token_happened_idx",
    ).on(table.bizId, table.accessActionTokenId, table.happenedAt),

    /** Event-type analysis query path. */
    accessActionTokenEventsBizTypeHappenedIdx: index(
      "access_action_token_events_biz_type_happened_idx",
    ).on(table.bizId, table.eventType, table.happenedAt),

    /** Tenant-safe FK to parent token. */
    accessActionTokenEventsBizTokenFk: foreignKey({
      columns: [table.bizId, table.accessActionTokenId],
      foreignColumns: [accessActionTokens.bizId, accessActionTokens.id],
      name: "access_action_token_events_biz_token_fk",
    }),

    /** Tenant-safe FK to optional activity-log anchor. */
    accessActionTokenEventsBizActivityLogFk: foreignKey({
      columns: [table.bizId, table.accessActivityLogId],
      foreignColumns: [accessActivityLogs.bizId, accessActivityLogs.id],
      name: "access_action_token_events_biz_activity_log_fk",
    }),

    /** Tenant-safe FK to optional actor subject pointer. */
    accessActionTokenEventsBizActorSubjectFk: foreignKey({
      columns: [table.bizId, table.actorSubjectType, table.actorSubjectId],
      foreignColumns: [subjects.bizId, subjects.subjectType, subjects.subjectId],
      name: "access_action_token_events_biz_actor_subject_fk",
    }),

    /** Actor subject pointer should be fully null or fully populated. */
    accessActionTokenEventsActorSubjectPairCheck: check(
      "access_action_token_events_actor_subject_pair_check",
      sql`
      (
        "actor_subject_type" IS NULL
        AND "actor_subject_id" IS NULL
      ) OR (
        "actor_subject_type" IS NOT NULL
        AND "actor_subject_id" IS NOT NULL
      )
      `,
    ),

    /** Country formatting guard. */
    accessActionTokenEventsCountryCheck: check(
      "access_action_token_events_country_check",
      sql`"country_code" IS NULL OR "country_code" ~ '^[A-Z]{2}$'`,
    ),
  }),
);

/**
 * access_transfer_policies
 *
 * ELI5:
 * A reusable rulebook describing how access rights may be transferred/resold.
 *
 * This table lets each biz configure transfer behavior without hardcoding
 * policy in code.
 */
export const accessTransferPolicies = pgTable(
  "access_transfer_policies",
  {
    /** Stable primary key for one transfer policy row. */
    id: idWithTag("access_transfer_policy"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Human-readable policy name. */
    name: varchar("name", { length: 220 }).notNull(),

    /** Stable policy slug for API/import references. */
    slug: varchar("slug", { length: 140 }).notNull(),

    /** Policy lifecycle state. */
    status: lifecycleStatusEnum("status").default("active").notNull(),

    /** Optional artifact-type scope constraint. */
    appliesToArtifactType: accessArtifactTypeEnum("applies_to_artifact_type"),

    /** Optional sellable scope constraint. */
    appliesToSellableId: idRef("applies_to_sellable_id").references(() => sellables.id),

    /** Whether transfer operation is generally allowed under this policy. */
    allowTransfers: boolean("allow_transfers").default(true).notNull(),

    /** Whether secondary resale listing is allowed under this policy. */
    allowResale: boolean("allow_resale").default(false).notNull(),

    /** Whether transfer requests require manual approval. */
    approvalRequired: boolean("approval_required").default(false).notNull(),

    /** Optional max transfer count per artifact lifetime. */
    maxTransfersPerArtifact: integer("max_transfers_per_artifact"),

    /** Optional minimum hold time in seconds before transfer is allowed. */
    minHoldSeconds: integer("min_hold_seconds"),

    /** Optional cooldown in seconds between transfer actions. */
    transferCooldownSeconds: integer("transfer_cooldown_seconds"),

    /** Optional transfer fee in minor units. */
    transferFeeMinor: integer("transfer_fee_minor").default(0).notNull(),

    /** Currency for fee and policy monetary fields. */
    currency: varchar("currency", { length: 3 }).default("USD").notNull(),

    /** Immutable rule snapshot payload used by policy evaluators. */
    policySnapshot: jsonb("policy_snapshot").default({}).notNull(),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite key for tenant-safe child-table references. */
    accessTransferPoliciesBizIdIdUnique: uniqueIndex(
      "access_transfer_policies_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** One policy slug per tenant. */
    accessTransferPoliciesBizSlugUnique: uniqueIndex(
      "access_transfer_policies_biz_slug_unique",
    ).on(table.bizId, table.slug),

    /** Policy listing path. */
    accessTransferPoliciesBizStatusIdx: index(
      "access_transfer_policies_biz_status_idx",
    ).on(table.bizId, table.status),

    /** Scope lookup path by sellable. */
    accessTransferPoliciesBizSellableStatusIdx: index(
      "access_transfer_policies_biz_sellable_status_idx",
    ).on(table.bizId, table.appliesToSellableId, table.status),

    /** Tenant-safe FK to optional sellable scope. */
    accessTransferPoliciesBizSellableFk: foreignKey({
      columns: [table.bizId, table.appliesToSellableId],
      foreignColumns: [sellables.bizId, sellables.id],
      name: "access_transfer_policies_biz_sellable_fk",
    }),

    /** Numeric/currency bounds. */
    accessTransferPoliciesBoundsCheck: check(
      "access_transfer_policies_bounds_check",
      sql`
      ("max_transfers_per_artifact" IS NULL OR "max_transfers_per_artifact" > 0)
      AND ("min_hold_seconds" IS NULL OR "min_hold_seconds" >= 0)
      AND ("transfer_cooldown_seconds" IS NULL OR "transfer_cooldown_seconds" >= 0)
      AND "transfer_fee_minor" >= 0
      AND "currency" ~ '^[A-Z]{3}$'
      `,
    ),
  }),
);

/**
 * access_transfers
 *
 * ELI5:
 * One row tracks a transfer workflow from one holder to another.
 *
 * Transfer can be:
 * - full transfer (ownership move),
 * - split transfer (new child artifact receives partial value),
 * - delegation (temporary delegated usage/authority).
 */
export const accessTransfers = pgTable(
  "access_transfers",
  {
    /** Stable primary key for one transfer workflow row. */
    id: idWithTag("access_transfer"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Source artifact being transferred/delegated from. */
    sourceAccessArtifactId: idRef("source_access_artifact_id")
      .references(() => accessArtifacts.id)
      .notNull(),

    /**
     * Optional target artifact id.
     *
     * Used for split/delegation models where transfer creates/reuses a child
     * artifact rather than moving ownership directly on source row.
     */
    targetAccessArtifactId: idRef("target_access_artifact_id").references(
      () => accessArtifacts.id,
    ),

    /** Optional transfer policy row used for this transfer. */
    accessTransferPolicyId: idRef("access_transfer_policy_id").references(
      () => accessTransferPolicies.id,
    ),

    /** Transfer execution mode. */
    mode: accessTransferModeEnum("mode").default("full_transfer").notNull(),

    /** Transfer workflow status. */
    status: accessTransferStatusEnum("status").default("requested").notNull(),

    /** Quantity requested to transfer/delegate. */
    quantityRequested: integer("quantity_requested").default(1).notNull(),

    /** Quantity actually transferred when completed. */
    quantityTransferred: integer("quantity_transferred"),

    /** User who initiated transfer request. */
    requestedByUserId: idRef("requested_by_user_id").references(() => users.id),

    /** User who approved/rejected transfer request. */
    approvedByUserId: idRef("approved_by_user_id").references(() => users.id),

    /** Transfer request timestamp. */
    requestedAt: timestamp("requested_at", { withTimezone: true }).defaultNow().notNull(),

    /** Optional expiry time for pending request. */
    expiresAt: timestamp("expires_at", { withTimezone: true }),

    /** Decision timestamp (approved/rejected/cancelled/expired). */
    decidedAt: timestamp("decided_at", { withTimezone: true }),

    /** Completion timestamp. */
    completedAt: timestamp("completed_at", { withTimezone: true }),

    /** Reversal timestamp. */
    reversedAt: timestamp("reversed_at", { withTimezone: true }),

    /** Optional target direct user holder. */
    targetHolderUserId: idRef("target_holder_user_id").references(() => users.id),

    /** Optional target group-account holder. */
    targetHolderGroupAccountId: idRef("target_holder_group_account_id").references(
      () => groupAccounts.id,
    ),

    /** Optional target custom holder namespace. */
    targetHolderSubjectType: varchar("target_holder_subject_type", { length: 80 }),

    /** Optional target custom holder id. */
    targetHolderSubjectId: varchar("target_holder_subject_id", { length: 140 }),

    /** Optional machine-readable reason code. */
    reasonCode: varchar("reason_code", { length: 80 }),

    /** Optional human-readable reason text. */
    reasonText: text("reason_text"),

    /** Source holder snapshot at request time. */
    fromHolderSnapshot: jsonb("from_holder_snapshot").default({}).notNull(),

    /** Target holder snapshot at decision/completion time. */
    toHolderSnapshot: jsonb("to_holder_snapshot").default({}).notNull(),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    accessTransfersBizIdIdUnique: uniqueIndex("access_transfers_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Composite key for tenant-safe resale listing references. */

    /** Transfer board path. */
    accessTransfersBizStatusRequestedIdx: index(
      "access_transfers_biz_status_requested_idx",
    ).on(table.bizId, table.status, table.requestedAt),

    /** Source-artifact history path. */
    accessTransfersBizSourceRequestedIdx: index(
      "access_transfers_biz_source_requested_idx",
    ).on(table.bizId, table.sourceAccessArtifactId, table.requestedAt),

    /** Tenant-safe FK to source artifact. */
    accessTransfersBizSourceArtifactFk: foreignKey({
      columns: [table.bizId, table.sourceAccessArtifactId],
      foreignColumns: [accessArtifacts.bizId, accessArtifacts.id],
      name: "access_transfers_biz_source_artifact_fk",
    }),

    /** Tenant-safe FK to optional target artifact. */
    accessTransfersBizTargetArtifactFk: foreignKey({
      columns: [table.bizId, table.targetAccessArtifactId],
      foreignColumns: [accessArtifacts.bizId, accessArtifacts.id],
      name: "access_transfers_biz_target_artifact_fk",
    }),

    /** Tenant-safe FK to optional transfer policy. */
    accessTransfersBizPolicyFk: foreignKey({
      columns: [table.bizId, table.accessTransferPolicyId],
      foreignColumns: [accessTransferPolicies.bizId, accessTransferPolicies.id],
      name: "access_transfers_biz_policy_fk",
    }),

    /** Tenant-safe FK to optional target custom holder. */
    accessTransfersBizTargetSubjectFk: foreignKey({
      columns: [table.bizId, table.targetHolderSubjectType, table.targetHolderSubjectId],
      foreignColumns: [subjects.bizId, subjects.subjectType, subjects.subjectId],
      name: "access_transfers_biz_target_subject_fk",
    }),

    /** Target subject pointer should be fully null or fully populated. */
    accessTransfersTargetSubjectPairCheck: check(
      "access_transfers_target_subject_pair_check",
      sql`
      (
        "target_holder_subject_type" IS NULL
        AND "target_holder_subject_id" IS NULL
      ) OR (
        "target_holder_subject_type" IS NOT NULL
        AND "target_holder_subject_id" IS NOT NULL
      )
      `,
    ),

    /** Target-holder shape should never be ambiguous. */
    accessTransfersTargetHolderShapeCheck: check(
      "access_transfers_target_holder_shape_check",
      sql`
      (
        ("target_holder_user_id" IS NOT NULL)::int
        + ("target_holder_group_account_id" IS NOT NULL)::int
        + ("target_holder_subject_type" IS NOT NULL)::int
      ) <= 1
      `,
    ),

    /** Quantity/timeline bounds and source-target sanity checks. */
    accessTransfersBoundsAndTimelineCheck: check(
      "access_transfers_bounds_timeline_check",
      sql`
      "quantity_requested" > 0
      AND ("quantity_transferred" IS NULL OR "quantity_transferred" > 0)
      AND (
        "quantity_transferred" IS NULL
        OR "quantity_transferred" <= "quantity_requested"
      )
      AND ("expires_at" IS NULL OR "expires_at" >= "requested_at")
      AND ("decided_at" IS NULL OR "decided_at" >= "requested_at")
      AND ("completed_at" IS NULL OR "completed_at" >= "requested_at")
      AND ("reversed_at" IS NULL OR "reversed_at" >= "requested_at")
      AND (
        "target_access_artifact_id" IS NULL
        OR "target_access_artifact_id" <> "source_access_artifact_id"
      )
      `,
    ),

    /** Mode-specific payload shape checks. */
    accessTransfersModeShapeCheck: check(
      "access_transfers_mode_shape_check",
      sql`
      (
        "mode" = 'full_transfer'
        AND "target_access_artifact_id" IS NULL
      ) OR (
        "mode" = 'split_transfer'
        AND "target_access_artifact_id" IS NOT NULL
      ) OR (
        "mode" = 'delegation'
      )
      `,
    ),

    /** Status-specific timestamp requirements. */
    accessTransfersStatusShapeCheck: check(
      "access_transfers_status_shape_check",
      sql`
      (
        "status" NOT IN ('approved', 'rejected', 'cancelled', 'expired')
        OR "decided_at" IS NOT NULL
      )
      AND ("status" <> 'completed' OR "completed_at" IS NOT NULL)
      AND ("status" <> 'completed' OR "quantity_transferred" IS NOT NULL)
      AND ("status" <> 'reversed' OR "reversed_at" IS NOT NULL)
      `,
    ),
  }),
);

/**
 * access_resale_listings
 *
 * ELI5:
 * Optional secondary-market listing for one access artifact.
 *
 * This table tracks listing lifecycle from draft -> active -> sold/cancelled
 * and links completion back to transfer workflow for full traceability.
 */
export const accessResaleListings = pgTable(
  "access_resale_listings",
  {
    /** Stable primary key for one resale listing row. */
    id: idWithTag("access_resale_listing"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Artifact being listed for resale. */
    accessArtifactId: idRef("access_artifact_id")
      .references(() => accessArtifacts.id)
      .notNull(),

    /** Optional transfer policy anchor used for this listing. */
    accessTransferPolicyId: idRef("access_transfer_policy_id").references(
      () => accessTransferPolicies.id,
    ),

    /** Listing lifecycle status. */
    status: accessResaleStatusEnum("status").default("draft").notNull(),

    /** Seller direct user pointer. */
    sellerUserId: idRef("seller_user_id").references(() => users.id),

    /** Seller group-account pointer. */
    sellerGroupAccountId: idRef("seller_group_account_id").references(
      () => groupAccounts.id,
    ),

    /** Seller custom subject namespace. */
    sellerSubjectType: varchar("seller_subject_type", { length: 80 }),

    /** Seller custom subject id. */
    sellerSubjectId: varchar("seller_subject_id", { length: 140 }),

    /** Asking price in minor units. */
    listedPriceMinor: integer("listed_price_minor").notNull(),

    /** Optional minimum acceptable price in minor units. */
    minAcceptablePriceMinor: integer("min_acceptable_price_minor"),

    /** Listing currency. */
    currency: varchar("currency", { length: 3 }).default("USD").notNull(),

    /** Listing creation/publish timestamp. */
    listedAt: timestamp("listed_at", { withTimezone: true }).defaultNow().notNull(),

    /** Optional expiry time for active listing. */
    expiresAt: timestamp("expires_at", { withTimezone: true }),

    /** Optional reservation timestamp. */
    reservedAt: timestamp("reserved_at", { withTimezone: true }),

    /** Optional sale completion timestamp. */
    soldAt: timestamp("sold_at", { withTimezone: true }),

    /** Optional cancellation/removal timestamp. */
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),

    /** Optional buyer direct user pointer. */
    buyerUserId: idRef("buyer_user_id").references(() => users.id),

    /** Optional buyer group-account pointer. */
    buyerGroupAccountId: idRef("buyer_group_account_id").references(
      () => groupAccounts.id,
    ),

    /** Optional buyer custom subject namespace. */
    buyerSubjectType: varchar("buyer_subject_type", { length: 80 }),

    /** Optional buyer custom subject id. */
    buyerSubjectId: varchar("buyer_subject_id", { length: 140 }),

    /** Optional completed transfer record produced by this listing. */
    completedTransferId: idRef("completed_transfer_id").references(() => accessTransfers.id),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite key for tenant-safe references. */
    accessResaleListingsBizIdIdUnique: uniqueIndex(
      "access_resale_listings_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** Listing board path. */
    accessResaleListingsBizStatusListedIdx: index(
      "access_resale_listings_biz_status_listed_idx",
    ).on(table.bizId, table.status, table.listedAt),

    /** Artifact history path. */
    accessResaleListingsBizArtifactListedIdx: index(
      "access_resale_listings_biz_artifact_listed_idx",
    ).on(table.bizId, table.accessArtifactId, table.listedAt),

    /** Tenant-safe FK to artifact. */
    accessResaleListingsBizArtifactFk: foreignKey({
      columns: [table.bizId, table.accessArtifactId],
      foreignColumns: [accessArtifacts.bizId, accessArtifacts.id],
      name: "access_resale_listings_biz_artifact_fk",
    }),

    /** Tenant-safe FK to optional transfer policy. */
    accessResaleListingsBizPolicyFk: foreignKey({
      columns: [table.bizId, table.accessTransferPolicyId],
      foreignColumns: [accessTransferPolicies.bizId, accessTransferPolicies.id],
      name: "access_resale_listings_biz_policy_fk",
    }),

    /** Tenant-safe FK to optional completed transfer row. */
    accessResaleListingsBizTransferFk: foreignKey({
      columns: [table.bizId, table.completedTransferId],
      foreignColumns: [accessTransfers.bizId, accessTransfers.id],
      name: "access_resale_listings_biz_transfer_fk",
    }),

    /** Tenant-safe FK to optional seller subject pointer. */
    accessResaleListingsBizSellerSubjectFk: foreignKey({
      columns: [table.bizId, table.sellerSubjectType, table.sellerSubjectId],
      foreignColumns: [subjects.bizId, subjects.subjectType, subjects.subjectId],
      name: "access_resale_listings_biz_seller_subject_fk",
    }),

    /** Tenant-safe FK to optional buyer subject pointer. */
    accessResaleListingsBizBuyerSubjectFk: foreignKey({
      columns: [table.bizId, table.buyerSubjectType, table.buyerSubjectId],
      foreignColumns: [subjects.bizId, subjects.subjectType, subjects.subjectId],
      name: "access_resale_listings_biz_buyer_subject_fk",
    }),

    /** Seller subject pointer should be fully null or fully populated. */
    accessResaleListingsSellerSubjectPairCheck: check(
      "access_resale_listings_seller_subject_pair_check",
      sql`
      (
        "seller_subject_type" IS NULL
        AND "seller_subject_id" IS NULL
      ) OR (
        "seller_subject_type" IS NOT NULL
        AND "seller_subject_id" IS NOT NULL
      )
      `,
    ),

    /** Buyer subject pointer should be fully null or fully populated. */
    accessResaleListingsBuyerSubjectPairCheck: check(
      "access_resale_listings_buyer_subject_pair_check",
      sql`
      (
        "buyer_subject_type" IS NULL
        AND "buyer_subject_id" IS NULL
      ) OR (
        "buyer_subject_type" IS NOT NULL
        AND "buyer_subject_id" IS NOT NULL
      )
      `,
    ),

    /** Seller identity must be deterministic for payout/accounting. */
    accessResaleListingsSellerShapeCheck: check(
      "access_resale_listings_seller_shape_check",
      sql`
      (
        ("seller_user_id" IS NOT NULL)::int
        + ("seller_group_account_id" IS NOT NULL)::int
        + ("seller_subject_type" IS NOT NULL)::int
      ) = 1
      `,
    ),

    /** Buyer identity (if present) should never be ambiguous. */
    accessResaleListingsBuyerShapeCheck: check(
      "access_resale_listings_buyer_shape_check",
      sql`
      (
        ("buyer_user_id" IS NOT NULL)::int
        + ("buyer_group_account_id" IS NOT NULL)::int
        + ("buyer_subject_type" IS NOT NULL)::int
      ) <= 1
      `,
    ),

    /** Price and timeline bounds checks. */
    accessResaleListingsBoundsAndTimelineCheck: check(
      "access_resale_listings_bounds_timeline_check",
      sql`
      "listed_price_minor" >= 0
      AND (
        "min_acceptable_price_minor" IS NULL
        OR (
          "min_acceptable_price_minor" >= 0
          AND "min_acceptable_price_minor" <= "listed_price_minor"
        )
      )
      AND "currency" ~ '^[A-Z]{3}$'
      AND ("expires_at" IS NULL OR "expires_at" >= "listed_at")
      AND ("reserved_at" IS NULL OR "reserved_at" >= "listed_at")
      AND ("sold_at" IS NULL OR "sold_at" >= "listed_at")
      AND ("cancelled_at" IS NULL OR "cancelled_at" >= "listed_at")
      `,
    ),

    /** Status-specific timestamps for deterministic lifecycle interpretation. */
    accessResaleListingsStatusShapeCheck: check(
      "access_resale_listings_status_shape_check",
      sql`
      ("status" <> 'reserved' OR "reserved_at" IS NOT NULL)
      AND ("status" <> 'sold' OR "sold_at" IS NOT NULL)
      AND ("status" NOT IN ('cancelled', 'removed') OR "cancelled_at" IS NOT NULL)
      AND ("status" <> 'expired' OR "expires_at" IS NOT NULL)
      `,
    ),
  }),
);

/**
 * access_security_signals
 *
 * ELI5:
 * A signal is one detected "suspicious pattern" attached to access activity.
 *
 * Security engines (internal or plugin-based) can write signals here, and
 * policy engines can decide what to do using `access_security_decisions`.
 */
export const accessSecuritySignals = pgTable(
  "access_security_signals",
  {
    /** Stable primary key for one security signal. */
    id: idWithTag("access_security_signal"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Signal taxonomy classification. */
    signalType: accessSecuritySignalTypeEnum("signal_type").notNull(),

    /** Signal lifecycle state. */
    status: accessSecuritySignalStatusEnum("status").default("open").notNull(),

    /** Severity score in range 0..100. */
    severity: integer("severity").default(50).notNull(),

    /** Optional confidence score in range 0..100. */
    confidence: integer("confidence"),

    /** Detection timestamp. */
    detectedAt: timestamp("detected_at", { withTimezone: true }).defaultNow().notNull(),

    /** Resolution/dismissal timestamp. */
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),

    /** Optional artifact anchor. */
    accessArtifactId: idRef("access_artifact_id").references(() => accessArtifacts.id),

    /** Optional token anchor. */
    accessActionTokenId: idRef("access_action_token_id").references(
      () => accessActionTokens.id,
    ),

    /** Optional activity-log anchor. */
    accessActivityLogId: idRef("access_activity_log_id").references(
      () => accessActivityLogs.id,
    ),

    /** Optional detector source namespace (plugin/system/manual reviewer). */
    sourceSubjectType: varchar("source_subject_type", { length: 80 }),

    /** Optional detector source id. */
    sourceSubjectId: varchar("source_subject_id", { length: 140 }),

    /** Structured signal details/payload. */
    details: jsonb("details").default({}).notNull(),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite key for tenant-safe decision-table references. */
    accessSecuritySignalsBizIdIdUnique: uniqueIndex(
      "access_security_signals_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** Security board path. */
    accessSecuritySignalsBizStatusDetectedIdx: index(
      "access_security_signals_biz_status_detected_idx",
    ).on(table.bizId, table.status, table.detectedAt),

    /** Artifact-centric signal history path. */
    accessSecuritySignalsBizArtifactDetectedIdx: index(
      "access_security_signals_biz_artifact_detected_idx",
    ).on(table.bizId, table.accessArtifactId, table.detectedAt),

    /** Tenant-safe FK to optional artifact anchor. */
    accessSecuritySignalsBizArtifactFk: foreignKey({
      columns: [table.bizId, table.accessArtifactId],
      foreignColumns: [accessArtifacts.bizId, accessArtifacts.id],
      name: "access_security_signals_biz_artifact_fk",
    }),

    /** Tenant-safe FK to optional token anchor. */
    accessSecuritySignalsBizTokenFk: foreignKey({
      columns: [table.bizId, table.accessActionTokenId],
      foreignColumns: [accessActionTokens.bizId, accessActionTokens.id],
      name: "access_security_signals_biz_token_fk",
    }),

    /** Tenant-safe FK to optional activity-log anchor. */
    accessSecuritySignalsBizActivityLogFk: foreignKey({
      columns: [table.bizId, table.accessActivityLogId],
      foreignColumns: [accessActivityLogs.bizId, accessActivityLogs.id],
      name: "access_security_signals_biz_activity_log_fk",
    }),

    /** Tenant-safe FK to optional source subject pointer. */
    accessSecuritySignalsBizSourceSubjectFk: foreignKey({
      columns: [table.bizId, table.sourceSubjectType, table.sourceSubjectId],
      foreignColumns: [subjects.bizId, subjects.subjectType, subjects.subjectId],
      name: "access_security_signals_biz_source_subject_fk",
    }),

    /** Source subject pointer should be fully null or fully populated. */
    accessSecuritySignalsSourceSubjectPairCheck: check(
      "access_security_signals_source_subject_pair_check",
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

    /** Signal bounds and anchor requirements. */
    accessSecuritySignalsBoundsAndAnchorCheck: check(
      "access_security_signals_bounds_anchor_check",
      sql`
      "severity" >= 0
      AND "severity" <= 100
      AND ("confidence" IS NULL OR ("confidence" >= 0 AND "confidence" <= 100))
      AND (
        ("access_artifact_id" IS NOT NULL)::int
        + ("access_action_token_id" IS NOT NULL)::int
        + ("access_activity_log_id" IS NOT NULL)::int
      ) >= 1
      AND ("resolved_at" IS NULL OR "resolved_at" >= "detected_at")
      `,
    ),

    /** Resolved/dismissed signals should carry resolution timestamp. */
    accessSecuritySignalsStatusShapeCheck: check(
      "access_security_signals_status_shape_check",
      sql`
      (
        "status" NOT IN ('resolved', 'dismissed')
        OR "resolved_at" IS NOT NULL
      )
      `,
    ),
  }),
);

/**
 * access_security_decisions
 *
 * ELI5:
 * A decision is the policy action taken after evaluating one or more signals.
 *
 * This keeps security actions auditable and reversible.
 */
export const accessSecurityDecisions = pgTable(
  "access_security_decisions",
  {
    /** Stable primary key for one security decision row. */
    id: idWithTag("access_security_decision"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Security action/outcome chosen by policy or reviewer. */
    outcome: accessSecurityDecisionOutcomeEnum("outcome").notNull(),

    /** Decision lifecycle state. */
    status: accessSecurityDecisionStatusEnum("status").default("active").notNull(),

    /** Decision creation timestamp. */
    decidedAt: timestamp("decided_at", { withTimezone: true }).defaultNow().notNull(),

    /** When decision starts applying. */
    effectiveFrom: timestamp("effective_from", { withTimezone: true })
      .defaultNow()
      .notNull(),

    /** Optional decision expiry timestamp. */
    effectiveUntil: timestamp("effective_until", { withTimezone: true }),

    /** Optional reversal timestamp. */
    revertedAt: timestamp("reverted_at", { withTimezone: true }),

    /** Optional originating signal pointer. */
    accessSecuritySignalId: idRef("access_security_signal_id").references(
      () => accessSecuritySignals.id,
    ),

    /** Optional artifact target pointer. */
    accessArtifactId: idRef("access_artifact_id").references(() => accessArtifacts.id),

    /** Optional token target pointer. */
    accessActionTokenId: idRef("access_action_token_id").references(
      () => accessActionTokens.id,
    ),

    /** Optional activity-log target pointer. */
    accessActivityLogId: idRef("access_activity_log_id").references(
      () => accessActivityLogs.id,
    ),

    /** Optional direct user actor taking the decision. */
    decidedByUserId: idRef("decided_by_user_id").references(() => users.id),

    /** Optional custom actor namespace (policy engine/plugin/manual system actor). */
    decidedBySubjectType: varchar("decided_by_subject_type", { length: 80 }),

    /** Optional custom actor id. */
    decidedBySubjectId: varchar("decided_by_subject_id", { length: 140 }),

    /** Optional machine-readable reason code. */
    reasonCode: varchar("reason_code", { length: 80 }),

    /** Optional human-readable reason text. */
    reasonText: text("reason_text"),

    /** Immutable policy snapshot used for this decision. */
    policySnapshot: jsonb("policy_snapshot").default({}).notNull(),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    accessSecurityDecisionsBizIdIdUnique: uniqueIndex("access_security_decisions_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Decision timeline query path. */
    accessSecurityDecisionsBizDecidedIdx: index(
      "access_security_decisions_biz_decided_idx",
    ).on(table.bizId, table.decidedAt),

    /** Artifact-target decision lookup path. */
    accessSecurityDecisionsBizArtifactDecidedIdx: index(
      "access_security_decisions_biz_artifact_decided_idx",
    ).on(table.bizId, table.accessArtifactId, table.decidedAt),

    /** Tenant-safe FK to optional source signal. */
    accessSecurityDecisionsBizSignalFk: foreignKey({
      columns: [table.bizId, table.accessSecuritySignalId],
      foreignColumns: [accessSecuritySignals.bizId, accessSecuritySignals.id],
      name: "access_security_decisions_biz_signal_fk",
    }),

    /** Tenant-safe FK to optional artifact target. */
    accessSecurityDecisionsBizArtifactFk: foreignKey({
      columns: [table.bizId, table.accessArtifactId],
      foreignColumns: [accessArtifacts.bizId, accessArtifacts.id],
      name: "access_security_decisions_biz_artifact_fk",
    }),

    /** Tenant-safe FK to optional token target. */
    accessSecurityDecisionsBizTokenFk: foreignKey({
      columns: [table.bizId, table.accessActionTokenId],
      foreignColumns: [accessActionTokens.bizId, accessActionTokens.id],
      name: "access_security_decisions_biz_token_fk",
    }),

    /** Tenant-safe FK to optional activity-log target. */
    accessSecurityDecisionsBizActivityLogFk: foreignKey({
      columns: [table.bizId, table.accessActivityLogId],
      foreignColumns: [accessActivityLogs.bizId, accessActivityLogs.id],
      name: "access_security_decisions_biz_activity_log_fk",
    }),

    /** Tenant-safe FK to optional actor subject pointer. */
    accessSecurityDecisionsBizActorSubjectFk: foreignKey({
      columns: [table.bizId, table.decidedBySubjectType, table.decidedBySubjectId],
      foreignColumns: [subjects.bizId, subjects.subjectType, subjects.subjectId],
      name: "access_security_decisions_biz_actor_subject_fk",
    }),

    /** Actor subject pointer should be fully null or fully populated. */
    accessSecurityDecisionsActorSubjectPairCheck: check(
      "access_security_decisions_actor_subject_pair_check",
      sql`
      (
        "decided_by_subject_type" IS NULL
        AND "decided_by_subject_id" IS NULL
      ) OR (
        "decided_by_subject_type" IS NOT NULL
        AND "decided_by_subject_id" IS NOT NULL
      )
      `,
    ),

    /** Target anchor and timeline validity checks. */
    accessSecurityDecisionsAnchorAndTimelineCheck: check(
      "access_security_decisions_anchor_timeline_check",
      sql`
      (
        ("access_security_signal_id" IS NOT NULL)::int
        + ("access_artifact_id" IS NOT NULL)::int
        + ("access_action_token_id" IS NOT NULL)::int
        + ("access_activity_log_id" IS NOT NULL)::int
      ) >= 1
      AND "effective_from" >= "decided_at"
      AND ("effective_until" IS NULL OR "effective_until" > "effective_from")
      AND ("reverted_at" IS NULL OR "reverted_at" >= "effective_from")
      `,
    ),

    /** Reverted decisions should carry reversal timestamp. */
    accessSecurityDecisionsStatusShapeCheck: check(
      "access_security_decisions_status_shape_check",
      sql`"status" <> 'reverted' OR "reverted_at" IS NOT NULL`,
    ),
  }),
);

export type AccessArtifact = typeof accessArtifacts.$inferSelect;
export type NewAccessArtifact = typeof accessArtifacts.$inferInsert;
export type AccessArtifactLink = typeof accessArtifactLinks.$inferSelect;
export type NewAccessArtifactLink = typeof accessArtifactLinks.$inferInsert;
export type AccessArtifactEvent = typeof accessArtifactEvents.$inferSelect;
export type NewAccessArtifactEvent = typeof accessArtifactEvents.$inferInsert;
export type AccessActivityLog = typeof accessActivityLogs.$inferSelect;
export type NewAccessActivityLog = typeof accessActivityLogs.$inferInsert;
export type AccessUsageWindow = typeof accessUsageWindows.$inferSelect;
export type NewAccessUsageWindow = typeof accessUsageWindows.$inferInsert;
export type AccessDeliveryLink = typeof accessDeliveryLinks.$inferSelect;
export type NewAccessDeliveryLink = typeof accessDeliveryLinks.$inferInsert;
export type AccessActionToken = typeof accessActionTokens.$inferSelect;
export type NewAccessActionToken = typeof accessActionTokens.$inferInsert;
export type AccessActionTokenEvent = typeof accessActionTokenEvents.$inferSelect;
export type NewAccessActionTokenEvent = typeof accessActionTokenEvents.$inferInsert;
export type AccessTransferPolicy = typeof accessTransferPolicies.$inferSelect;
export type NewAccessTransferPolicy = typeof accessTransferPolicies.$inferInsert;
export type AccessTransfer = typeof accessTransfers.$inferSelect;
export type NewAccessTransfer = typeof accessTransfers.$inferInsert;
export type AccessResaleListing = typeof accessResaleListings.$inferSelect;
export type NewAccessResaleListing = typeof accessResaleListings.$inferInsert;
export type AccessSecuritySignal = typeof accessSecuritySignals.$inferSelect;
export type NewAccessSecuritySignal = typeof accessSecuritySignals.$inferInsert;
export type AccessSecurityDecision = typeof accessSecurityDecisions.$inferSelect;
export type NewAccessSecurityDecision = typeof accessSecurityDecisions.$inferInsert;
