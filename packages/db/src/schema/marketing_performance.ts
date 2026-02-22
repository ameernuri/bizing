import { sql } from "drizzle-orm";
import { check, foreignKey, index, uniqueIndex } from "drizzle-orm/pg-core";
import {
  date,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { idRef, idWithTag, withAuditRefs } from "./_common";
import { bizes } from "./bizes";
import { bizConfigValues } from "./biz_configs";
import { channelAccounts } from "./channels";
import { crmContacts } from "./crm";
import { lifecycleStatusEnum } from "./enums";
import { bookingOrders } from "./fulfillment";
import { paymentTransactions } from "./payments";
import { referralAttributions } from "./referral_attribution";
import { graphAudienceSegments } from "./social_graph";
import { subjects } from "./subjects";
import { users } from "./users";

/**
 * marketing_audience_segments
 *
 * ELI5:
 * Business-owned audience cohorts for targeting and export.
 *
 * Why this table exists when `graph_audience_segments` already exists:
 * - graph segments are social/privacy identity-owned lists,
 * - marketing segments are business-operational cohorts (ads, CRM, journeys),
 * - optional linkage to graph segment keeps both systems interoperable.
 */
export const marketingAudienceSegments = pgTable(
  "marketing_audience_segments",
  {
    /** Stable primary key for one marketing segment. */
    id: idWithTag("mkt_segment"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Human segment name. */
    name: varchar("name", { length: 220 }).notNull(),

    /** Stable machine slug unique within one tenant. */
    slug: varchar("slug", { length: 140 }).notNull(),

    /** Segment lifecycle. */
    status: lifecycleStatusEnum("status").default("active").notNull(),

    /**
     * Segment class.
     * Examples: static, dynamic, lookalike, suppression.
     */
    segmentType: varchar("segment_type", { length: 40 }).default("dynamic").notNull(),

    /**
     * Source model for population.
     * - rule: computed from selectors
     * - manual: explicit member curation
     * - import: external list import
     * - graph_link: mirrors linked graph segment
     */
    sourceType: varchar("source_type", { length: 40 }).default("rule").notNull(),

    /** Optional linked graph/social segment for interoperability. */
    graphAudienceSegmentId: idRef("graph_audience_segment_id").references(
      () => graphAudienceSegments.id,
    ),

    /** Dynamic definition payload used by segment materialization workers. */
    definition: jsonb("definition").default({}).notNull(),

    /** Last successful materialization timestamp. */
    lastMaterializedAt: timestamp("last_materialized_at", { withTimezone: true }),

    /** Cached current member count for quick operator dashboards. */
    memberCount: integer("member_count").default(0).notNull(),

    /** Extensible payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite key for tenant-safe membership/sync references. */
    marketingAudienceSegmentsBizIdIdUnique: uniqueIndex(
      "marketing_audience_segments_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** One slug per tenant. */
    marketingAudienceSegmentsBizSlugUnique: uniqueIndex(
      "marketing_audience_segments_biz_slug_unique",
    ).on(table.bizId, table.slug),

    /** Segment board path by state and kind. */
    marketingAudienceSegmentsBizStatusTypeIdx: index(
      "marketing_audience_segments_biz_status_type_idx",
    ).on(table.bizId, table.status, table.segmentType),

    /** Segment/source analytics path. */
    marketingAudienceSegmentsBizSourceTypeIdx: index(
      "marketing_audience_segments_biz_source_type_idx",
    ).on(table.bizId, table.sourceType, table.lastMaterializedAt),

    /** Segment/source vocabulary remains extensible. */
    marketingAudienceSegmentsTypeCheck: check(
      "marketing_audience_segments_type_check",
      sql`
      ("segment_type" IN ('static', 'dynamic', 'lookalike', 'suppression') OR "segment_type" LIKE 'custom_%')
      AND ("source_type" IN ('rule', 'manual', 'import', 'graph_link') OR "source_type" LIKE 'custom_%')
      AND "member_count" >= 0
      `,
    ),
  }),
);

/**
 * marketing_audience_segment_memberships
 *
 * ELI5:
 * Explicit membership rows for one marketing segment.
 *
 * This table supports:
 * - static/manual list curation,
 * - materialized snapshots for dynamic selectors,
 * - import/export reconciliation.
 */
export const marketingAudienceSegmentMemberships = pgTable(
  "marketing_audience_segment_memberships",
  {
    /** Stable primary key for one membership row. */
    id: idWithTag("mkt_segment_member"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent marketing segment. */
    marketingAudienceSegmentId: idRef("marketing_audience_segment_id")
      .references(() => marketingAudienceSegments.id)
      .notNull(),

    /**
     * Preferred member anchor as CRM contact.
     * Use this for people/accounts that participate in CRM lifecycle.
     */
    memberCrmContactId: idRef("member_crm_contact_id").references(() => crmContacts.id),

    /**
     * Optional fallback member anchor as generic subject.
     * Use this for non-contact entities (for example plugin-defined actors).
     */
    memberSubjectType: varchar("member_subject_type", { length: 80 }),
    memberSubjectId: varchar("member_subject_id", { length: 140 }),

    /** Membership lifecycle. */
    status: lifecycleStatusEnum("status").default("active").notNull(),

    /** Origin of this membership row. */
    sourceType: varchar("source_type", { length: 40 }).default("rule").notNull(),

    /** Optional import/sync/workflow source reference. */
    sourceRef: varchar("source_ref", { length: 180 }),

    /** Optional ranking/relevance score for prioritization. */
    score: integer("score"),

    /** Membership activation timestamp. */
    addedAt: timestamp("added_at", { withTimezone: true }).defaultNow().notNull(),

    /** Membership removal timestamp when status transitions out of active. */
    removedAt: timestamp("removed_at", { withTimezone: true }),

    /** Extensible payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite key for external references. */
    marketingAudienceSegmentMembershipsBizIdIdUnique: uniqueIndex(
      "marketing_audience_segment_memberships_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /**
     * One active row per CRM-contact member in one segment.
     *
     * Important:
     * We keep contact and subject uniqueness in separate partial indexes
     * because nullable columns in one combined unique index can allow
     * accidental duplicates under PostgreSQL NULL semantics.
     */
    marketingAudienceSegmentMembershipsActiveContactUnique: uniqueIndex(
      "marketing_audience_segment_memberships_active_contact_unique",
    )
      .on(table.bizId, table.marketingAudienceSegmentId, table.memberCrmContactId)
      .where(sql`"member_crm_contact_id" IS NOT NULL AND "deleted_at" IS NULL`),

    /**
     * One active row per subject-anchored member in one segment.
     *
     * Kept separate from contact-path uniqueness for deterministic enforcement.
     */
    marketingAudienceSegmentMembershipsActiveSubjectUnique: uniqueIndex(
      "marketing_audience_segment_memberships_active_subject_unique",
    )
      .on(
        table.bizId,
        table.marketingAudienceSegmentId,
        table.memberSubjectType,
        table.memberSubjectId,
      )
      .where(
        sql`"member_subject_type" IS NOT NULL AND "member_subject_id" IS NOT NULL AND "deleted_at" IS NULL`,
      ),

    /** Segment resolution path. */
    marketingAudienceSegmentMembershipsBizSegmentStatusIdx: index(
      "marketing_audience_segment_memberships_biz_segment_status_idx",
    ).on(table.bizId, table.marketingAudienceSegmentId, table.status, table.addedAt),

    /** Reverse target lookup path. */
    marketingAudienceSegmentMembershipsBizMemberIdx: index(
      "marketing_audience_segment_memberships_biz_member_idx",
    ).on(
      table.bizId,
      table.memberCrmContactId,
      table.memberSubjectType,
      table.memberSubjectId,
      table.status,
    ),

    /** Tenant-safe FK to segment. */
    marketingAudienceSegmentMembershipsBizSegmentFk: foreignKey({
      columns: [table.bizId, table.marketingAudienceSegmentId],
      foreignColumns: [marketingAudienceSegments.bizId, marketingAudienceSegments.id],
      name: "marketing_audience_segment_memberships_biz_segment_fk",
    }),

    /** Tenant-safe FK to optional CRM contact member anchor. */
    marketingAudienceSegmentMembershipsBizContactFk: foreignKey({
      columns: [table.bizId, table.memberCrmContactId],
      foreignColumns: [crmContacts.bizId, crmContacts.id],
      name: "marketing_audience_segment_memberships_biz_contact_fk",
    }),

    /** Tenant-safe FK to optional subject member anchor. */
    marketingAudienceSegmentMembershipsBizSubjectFk: foreignKey({
      columns: [table.bizId, table.memberSubjectType, table.memberSubjectId],
      foreignColumns: [subjects.bizId, subjects.subjectType, subjects.subjectId],
      name: "marketing_audience_segment_memberships_biz_subject_fk",
    }),

    /** Source vocabulary remains extensible. */
    marketingAudienceSegmentMembershipsSourceCheck: check(
      "marketing_audience_segment_memberships_source_check",
      sql`
      "source_type" IN ('rule', 'manual', 'import', 'sync', 'api')
      OR "source_type" LIKE 'custom_%'
      `,
    ),

    /** Subject anchor must be fully null or fully populated. */
    marketingAudienceSegmentMembershipsMemberSubjectPairCheck: check(
      "marketing_audience_segment_memberships_member_subject_pair_check",
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

    /** Exactly one anchor path keeps audience semantics deterministic. */
    marketingAudienceSegmentMembershipsMemberAnchorCheck: check(
      "marketing_audience_segment_memberships_member_anchor_check",
      sql`
      (
        ("member_crm_contact_id" IS NOT NULL)::int
        + ("member_subject_type" IS NOT NULL)::int
      ) = 1
      `,
    ),

    /** Membership timeline and score bounds. */
    marketingAudienceSegmentMembershipsBoundsCheck: check(
      "marketing_audience_segment_memberships_bounds_check",
      sql`
      ("removed_at" IS NULL OR "removed_at" >= "added_at")
      AND ("score" IS NULL OR "score" >= 0)
      `,
    ),
  }),
);

/**
 * marketing_audience_sync_runs
 *
 * ELI5:
 * One row is one push/pull sync execution between a marketing segment and an
 * external channel audience list.
 */
export const marketingAudienceSyncRuns = pgTable(
  "marketing_audience_sync_runs",
  {
    /** Stable primary key for one sync run. */
    id: idWithTag("mkt_sync_run"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Segment being synchronized. */
    marketingAudienceSegmentId: idRef("marketing_audience_segment_id")
      .references(() => marketingAudienceSegments.id)
      .notNull(),

    /** Optional connected channel account used for this sync. */
    channelAccountId: idRef("channel_account_id").references(() => channelAccounts.id),

    /** Provider key when account linkage is indirect. */
    provider: varchar("provider", { length: 80 }).notNull(),

    /** External audience/list identifier in provider namespace. */
    externalAudienceRef: varchar("external_audience_ref", { length: 220 }),

    /** Sync direction for this run. */
    direction: varchar("direction", { length: 40 }).default("export").notNull(),

    /** Run status. */
    status: varchar("status", { length: 40 }).default("queued").notNull(),
    /**
     * Optional configurable lifecycle pointer for sync-run status wording.
     *
     * Canonical `status` continues to drive worker state semantics.
     */
    statusConfigValueId: idRef("status_config_value_id"),

    /** User that requested this run (if manually triggered). */
    requestedByUserId: idRef("requested_by_user_id").references(() => users.id),

    /** Request timestamp. */
    requestedAt: timestamp("requested_at", { withTimezone: true }).defaultNow().notNull(),

    /** Worker start timestamp. */
    startedAt: timestamp("started_at", { withTimezone: true }),

    /** Worker end timestamp. */
    finishedAt: timestamp("finished_at", { withTimezone: true }),

    /** Input rows scanned by this run. */
    inputCount: integer("input_count").default(0).notNull(),

    /** Members added in destination for this run. */
    addedCount: integer("added_count").default(0).notNull(),

    /** Members removed in destination for this run. */
    removedCount: integer("removed_count").default(0).notNull(),

    /** Members that failed sync. */
    failedCount: integer("failed_count").default(0).notNull(),

    /** Compact error summary for failed/partial runs. */
    errorSummary: text("error_summary"),

    /** Worker request/response payload snapshot. */
    payload: jsonb("payload").default({}).notNull(),

    /** Extensible payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite key for external references. */
    marketingAudienceSyncRunsBizIdIdUnique: uniqueIndex(
      "marketing_audience_sync_runs_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** Queue/ops path for run orchestration. */
    marketingAudienceSyncRunsBizStatusRequestedIdx: index(
      "marketing_audience_sync_runs_biz_status_requested_idx",
    ).on(table.bizId, table.status, table.requestedAt),
    /** Configurable lifecycle queue path for sync orchestration UIs. */
    marketingAudienceSyncRunsBizStatusConfigRequestedIdx: index(
      "marketing_audience_sync_runs_biz_status_config_requested_idx",
    ).on(table.bizId, table.statusConfigValueId, table.requestedAt),

    /** Segment history path. */
    marketingAudienceSyncRunsBizSegmentRequestedIdx: index(
      "marketing_audience_sync_runs_biz_segment_requested_idx",
    ).on(table.bizId, table.marketingAudienceSegmentId, table.requestedAt),

    /** Tenant-safe FK to segment. */
    marketingAudienceSyncRunsBizSegmentFk: foreignKey({
      columns: [table.bizId, table.marketingAudienceSegmentId],
      foreignColumns: [marketingAudienceSegments.bizId, marketingAudienceSegments.id],
      name: "marketing_audience_sync_runs_biz_segment_fk",
    }),

    /** Tenant-safe FK to optional channel account. */
    marketingAudienceSyncRunsBizChannelAccountFk: foreignKey({
      columns: [table.bizId, table.channelAccountId],
      foreignColumns: [channelAccounts.bizId, channelAccounts.id],
      name: "marketing_audience_sync_runs_biz_channel_account_fk",
    }),
    /** Tenant-safe FK to optional configured status dictionary value. */
    marketingAudienceSyncRunsBizStatusConfigFk: foreignKey({
      columns: [table.bizId, table.statusConfigValueId],
      foreignColumns: [bizConfigValues.bizId, bizConfigValues.id],
      name: "marketing_audience_sync_runs_biz_status_config_fk",
    }),

    /** Direction/status vocabulary remains extensible. */
    marketingAudienceSyncRunsVocabularyCheck: check(
      "marketing_audience_sync_runs_vocabulary_check",
      sql`
      ("direction" IN ('export', 'import', 'bidirectional') OR "direction" LIKE 'custom_%')
      AND ("status" IN ('queued', 'running', 'succeeded', 'failed', 'partial', 'cancelled') OR "status" LIKE 'custom_%')
      `,
    ),

    /** Run counters and timeline bounds. */
    marketingAudienceSyncRunsBoundsCheck: check(
      "marketing_audience_sync_runs_bounds_check",
      sql`
      "input_count" >= 0
      AND "added_count" >= 0
      AND "removed_count" >= 0
      AND "failed_count" >= 0
      AND ("started_at" IS NULL OR "started_at" >= "requested_at")
      AND ("finished_at" IS NULL OR "started_at" IS NULL OR "finished_at" >= "started_at")
      `,
    ),
  }),
);

/**
 * ad_spend_daily_facts
 *
 * ELI5:
 * One row = ad spend metrics for one provider hierarchy slice on one day.
 *
 * This is the missing spend-side dataset needed to compute ROAS/CAC when joined
 * with existing conversion/revenue attribution data.
 */
export const adSpendDailyFacts = pgTable(
  "ad_spend_daily_facts",
  {
    /** Stable primary key for one daily spend fact row. */
    id: idWithTag("ad_spend_fact"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Fact date in provider reporting timezone normalization. */
    factDate: date("fact_date").notNull(),

    /** Provider key (google_ads, meta_ads, tiktok_ads, etc.). */
    provider: varchar("provider", { length: 80 }).notNull(),

    /** Optional connected channel account source for this fact row. */
    channelAccountId: idRef("channel_account_id").references(() => channelAccounts.id),

    /** Provider account id. */
    providerAccountRef: varchar("provider_account_ref", { length: 220 }),

    /** Provider account display name snapshot. */
    providerAccountName: varchar("provider_account_name", { length: 220 }),

    /** Provider campaign id. */
    campaignRef: varchar("campaign_ref", { length: 220 }),

    /** Campaign display name snapshot. */
    campaignName: varchar("campaign_name", { length: 220 }),

    /** Provider ad group/ad set id. */
    adGroupRef: varchar("ad_group_ref", { length: 220 }),

    /** Ad group/ad set display name snapshot. */
    adGroupName: varchar("ad_group_name", { length: 220 }),

    /** Provider ad/creative id. */
    adRef: varchar("ad_ref", { length: 220 }),

    /** Ad/creative display name snapshot. */
    adName: varchar("ad_name", { length: 220 }),

    /** Spend currency. */
    currency: varchar("currency", { length: 3 }).default("USD").notNull(),

    /** Impression count. */
    impressions: integer("impressions").default(0).notNull(),

    /** Click count. */
    clicks: integer("clicks").default(0).notNull(),

    /** Conversion count as reported by provider. */
    conversions: integer("conversions").default(0).notNull(),

    /** Spend amount in minor units. */
    spendMinor: integer("spend_minor").default(0).notNull(),

    /** Provider-reported conversion value in minor units (if available). */
    conversionValueMinor: integer("conversion_value_minor"),

    /** Optional internal-attributed revenue in minor units for this slice/day. */
    attributedRevenueMinor: integer("attributed_revenue_minor"),

    /** Extensible payload for provider-specific metrics fields. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    adSpendDailyFactsBizIdIdUnique: uniqueIndex("ad_spend_daily_facts_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Slice uniqueness guard for idempotent daily ingest. */
    adSpendDailyFactsSliceUnique: uniqueIndex("ad_spend_daily_facts_slice_unique").on(
      table.bizId,
      table.factDate,
      table.provider,
      table.providerAccountRef,
      table.campaignRef,
      table.adGroupRef,
      table.adRef,
      table.currency,
    ),

    /** Main BI query path by date/provider. */
    adSpendDailyFactsBizDateProviderIdx: index(
      "ad_spend_daily_facts_biz_date_provider_idx",
    ).on(table.bizId, table.factDate, table.provider),

    /** Campaign-level analytics path. */
    adSpendDailyFactsBizCampaignDateIdx: index(
      "ad_spend_daily_facts_biz_campaign_date_idx",
    ).on(table.bizId, table.campaignRef, table.factDate),

    /** Tenant-safe FK to optional channel account source. */
    adSpendDailyFactsBizChannelAccountFk: foreignKey({
      columns: [table.bizId, table.channelAccountId],
      foreignColumns: [channelAccounts.bizId, channelAccounts.id],
      name: "ad_spend_daily_facts_biz_channel_account_fk",
    }),

    /** Non-negative metric constraints. */
    adSpendDailyFactsBoundsCheck: check(
      "ad_spend_daily_facts_bounds_check",
      sql`
      "impressions" >= 0
      AND "clicks" >= 0
      AND "conversions" >= 0
      AND "spend_minor" >= 0
      AND ("conversion_value_minor" IS NULL OR "conversion_value_minor" >= 0)
      AND ("attributed_revenue_minor" IS NULL OR "attributed_revenue_minor" >= 0)
      AND "clicks" <= "impressions"
      `,
    ),

    /** Currency shape should stay uppercase ISO-like. */
    adSpendDailyFactsCurrencyFormatCheck: check(
      "ad_spend_daily_facts_currency_format_check",
      sql`"currency" ~ '^[A-Z]{3}$'`,
    ),
  }),
);

/**
 * offline_conversion_pushes
 *
 * ELI5:
 * Outbound conversion events sent back to ad platforms for optimization loops.
 *
 * This table tracks:
 * - what conversion was pushed,
 * - where it came from internally,
 * - whether provider accepted it.
 */
export const offlineConversionPushes = pgTable(
  "offline_conversion_pushes",
  {
    /** Stable primary key for one push event. */
    id: idWithTag("offline_conversion"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Optional connected channel account used for this push. */
    channelAccountId: idRef("channel_account_id").references(() => channelAccounts.id),

    /** Provider key for this push. */
    provider: varchar("provider", { length: 80 }).notNull(),

    /** Optional provider conversion-action identifier. */
    conversionActionRef: varchar("conversion_action_ref", { length: 220 }),

    /** Push lifecycle state. */
    status: varchar("status", { length: 40 }).default("queued").notNull(),
    /**
     * Optional configurable lifecycle pointer for push-status wording.
     *
     * Canonical `status` remains the deterministic delivery state.
     */
    statusConfigValueId: idRef("status_config_value_id"),

    /** Optional linked booking order conversion source. */
    bookingOrderId: idRef("booking_order_id").references(() => bookingOrders.id),

    /** Optional linked payment transaction conversion source. */
    paymentTransactionId: idRef("payment_transaction_id").references(
      () => paymentTransactions.id,
    ),

    /** Optional linked referral attribution decision source. */
    referralAttributionId: idRef("referral_attribution_id").references(
      () => referralAttributions.id,
    ),

    /** Conversion instant being reported to provider. */
    conversionAt: timestamp("conversion_at", { withTimezone: true }).notNull(),

    /** Conversion value in minor units being reported. */
    conversionValueMinor: integer("conversion_value_minor").default(0).notNull(),

    /** Currency for conversion value. */
    currency: varchar("currency", { length: 3 }).default("USD").notNull(),

    /** Provider-side accepted event id when available. */
    externalEventRef: varchar("external_event_ref", { length: 220 }),

    /** Attempt count for retries. */
    attemptCount: integer("attempt_count").default(0).notNull(),

    /** Last attempt timestamp. */
    lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }),

    /** Sent timestamp when push succeeds. */
    sentAt: timestamp("sent_at", { withTimezone: true }),

    /** Optional error code. */
    errorCode: varchar("error_code", { length: 120 }),

    /** Optional error detail. */
    errorMessage: text("error_message"),

    /** Immutable payload snapshot sent to provider. */
    payload: jsonb("payload").default({}).notNull(),

    /** Extensible metadata. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite key for external references. */
    offlineConversionPushesBizIdIdUnique: uniqueIndex(
      "offline_conversion_pushes_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** Provider idempotency path when provider returns event refs. */
    offlineConversionPushesExternalRefUnique: uniqueIndex(
      "offline_conversion_pushes_external_ref_unique",
    )
      .on(table.bizId, table.provider, table.externalEventRef)
      .where(sql`"external_event_ref" IS NOT NULL`),

    /** Push queue execution path. */
    offlineConversionPushesBizStatusConversionIdx: index(
      "offline_conversion_pushes_biz_status_conversion_idx",
    ).on(table.bizId, table.status, table.conversionAt),
    /** Configurable lifecycle queue path for outbound conversion workers. */
    offlineConversionPushesBizStatusConfigConversionIdx: index(
      "offline_conversion_pushes_biz_status_config_conversion_idx",
    ).on(table.bizId, table.statusConfigValueId, table.conversionAt),

    /** Attribution reconciliation path. */
    offlineConversionPushesBizAttributionIdx: index(
      "offline_conversion_pushes_biz_attribution_idx",
    ).on(table.bizId, table.referralAttributionId, table.conversionAt),

    /** Tenant-safe FK to optional channel account. */
    offlineConversionPushesBizChannelAccountFk: foreignKey({
      columns: [table.bizId, table.channelAccountId],
      foreignColumns: [channelAccounts.bizId, channelAccounts.id],
      name: "offline_conversion_pushes_biz_channel_account_fk",
    }),

    /** Tenant-safe FK to optional booking order source. */
    offlineConversionPushesBizBookingOrderFk: foreignKey({
      columns: [table.bizId, table.bookingOrderId],
      foreignColumns: [bookingOrders.bizId, bookingOrders.id],
      name: "offline_conversion_pushes_biz_booking_order_fk",
    }),

    /** Tenant-safe FK to optional payment transaction source. */
    offlineConversionPushesBizPaymentTransactionFk: foreignKey({
      columns: [table.bizId, table.paymentTransactionId],
      foreignColumns: [paymentTransactions.bizId, paymentTransactions.id],
      name: "offline_conversion_pushes_biz_payment_transaction_fk",
    }),
    /** Tenant-safe FK to optional configured status dictionary value. */
    offlineConversionPushesBizStatusConfigFk: foreignKey({
      columns: [table.bizId, table.statusConfigValueId],
      foreignColumns: [bizConfigValues.bizId, bizConfigValues.id],
      name: "offline_conversion_pushes_biz_status_config_fk",
    }),

    /** Status vocabulary remains extensible. */
    offlineConversionPushesStatusCheck: check(
      "offline_conversion_pushes_status_check",
      sql`
      "status" IN ('queued', 'sending', 'sent', 'failed', 'skipped')
      OR "status" LIKE 'custom_%'
      `,
    ),

    /** At least one concrete source should explain conversion lineage. */
    offlineConversionPushesSourceShapeCheck: check(
      "offline_conversion_pushes_source_shape_check",
      sql`
      (
        ("booking_order_id" IS NOT NULL)::int
        + ("payment_transaction_id" IS NOT NULL)::int
        + ("referral_attribution_id" IS NOT NULL)::int
      ) >= 1
      `,
    ),

    /** Attempt and value bounds. */
    offlineConversionPushesBoundsCheck: check(
      "offline_conversion_pushes_bounds_check",
      sql`
      "conversion_value_minor" >= 0
      AND "attempt_count" >= 0
      `,
    ),

    /** Currency shape should stay uppercase ISO-like. */
    offlineConversionPushesCurrencyFormatCheck: check(
      "offline_conversion_pushes_currency_format_check",
      sql`"currency" ~ '^[A-Z]{3}$'`,
    ),
  }),
);

export type MarketingAudienceSegment = typeof marketingAudienceSegments.$inferSelect;
export type NewMarketingAudienceSegment = typeof marketingAudienceSegments.$inferInsert;

export type MarketingAudienceSegmentMembership =
  typeof marketingAudienceSegmentMemberships.$inferSelect;
export type NewMarketingAudienceSegmentMembership =
  typeof marketingAudienceSegmentMemberships.$inferInsert;

export type MarketingAudienceSyncRun = typeof marketingAudienceSyncRuns.$inferSelect;
export type NewMarketingAudienceSyncRun = typeof marketingAudienceSyncRuns.$inferInsert;

export type AdSpendDailyFact = typeof adSpendDailyFacts.$inferSelect;
export type NewAdSpendDailyFact = typeof adSpendDailyFacts.$inferInsert;

export type OfflineConversionPush = typeof offlineConversionPushes.$inferSelect;
export type NewOfflineConversionPush = typeof offlineConversionPushes.$inferInsert;
