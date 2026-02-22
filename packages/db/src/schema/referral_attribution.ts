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
import { bookingOrders } from "./fulfillment";
import { groupAccounts } from "./group_accounts";
import { lifecycleStatusEnum } from "./enums";
import { crossBizOrders, referralEvents, referralPrograms } from "./marketplace";
import { sellables } from "./product_commerce";
import { offerVersions } from "./offers";
import { subjects } from "./subjects";
import { users } from "./users";

/**
 * referral_links
 *
 * ELI5:
 * One row = one shareable referral link/token that can be distributed.
 *
 * Why this exists:
 * - campaign rows are not enough for deterministic attribution,
 * - links need their own lifecycle, ownership, and attribution policy.
 */
export const referralLinks = pgTable(
  "referral_links",
  {
    /** Stable primary key for one referral link record. */
    id: idWithTag("referral_link"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent referral program context. */
    referralProgramId: idRef("referral_program_id")
      .references(() => referralPrograms.id)
      .notNull(),

    /** Stable link/token code used in URL generation. */
    linkCode: varchar("link_code", { length: 140 }).notNull(),

    /** Lifecycle status of this link. */
    status: lifecycleStatusEnum("status").default("active").notNull(),

    /** Owner pointer: user. */
    ownerUserId: idRef("owner_user_id").references(() => users.id),

    /** Owner pointer: group account. */
    ownerGroupAccountId: idRef("owner_group_account_id").references(
      () => groupAccounts.id,
    ),

    /** Owner pointer: custom subject namespace. */
    ownerSubjectType: varchar("owner_subject_type", { length: 80 }),

    /** Owner pointer: custom subject id. */
    ownerSubjectId: varchar("owner_subject_id", { length: 140 }),

    /** Optional primary sellable destination for this link. */
    sellableId: idRef("sellable_id").references(() => sellables.id),

    /** Optional primary offer-version destination. */
    offerVersionId: idRef("offer_version_id").references(() => offerVersions.id),

    /** Optional custom destination subject namespace. */
    targetSubjectType: varchar("target_subject_type", { length: 80 }),

    /** Optional custom destination subject id. */
    targetSubjectId: varchar("target_subject_id", { length: 140 }),

    /** Optional activation timestamp. */
    startsAt: timestamp("starts_at", { withTimezone: true }),

    /** Optional deactivation timestamp. */
    endsAt: timestamp("ends_at", { withTimezone: true }),

    /**
     * Attribution model.
     * Common values: first_touch / last_touch / custom_%.
     */
    attributionModel: varchar("attribution_model", { length: 60 })
      .default("last_touch")
      .notNull(),

    /** Attribution window in minutes (e.g., 10080 = 7 days). */
    attributionWindowMinutes: integer("attribution_window_minutes")
      .default(10080)
      .notNull(),

    /** Extension payload for campaign-specific flags. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    referralLinksBizIdIdUnique: uniqueIndex("referral_links_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Composite key for tenant-safe click/attribution child FKs. */

    /** Link code must be unique within a tenant. */
    referralLinksBizLinkCodeUnique: uniqueIndex("referral_links_biz_link_code_unique").on(
      table.bizId,
      table.linkCode,
    ),

    /** Program listing path by status. */
    referralLinksBizProgramStatusIdx: index("referral_links_biz_program_status_idx").on(
      table.bizId,
      table.referralProgramId,
      table.status,
    ),

    /** Tenant-safe FK to program. */
    referralLinksBizProgramFk: foreignKey({
      columns: [table.bizId, table.referralProgramId],
      foreignColumns: [referralPrograms.bizId, referralPrograms.id],
      name: "referral_links_biz_program_fk",
    }),

    /** Tenant-safe FK to sellable destination. */
    referralLinksBizSellableFk: foreignKey({
      columns: [table.bizId, table.sellableId],
      foreignColumns: [sellables.bizId, sellables.id],
      name: "referral_links_biz_sellable_fk",
    }),

    /** Tenant-safe FK to offer destination. */
    referralLinksBizOfferVersionFk: foreignKey({
      columns: [table.bizId, table.offerVersionId],
      foreignColumns: [offerVersions.bizId, offerVersions.id],
      name: "referral_links_biz_offer_version_fk",
    }),

    /** Tenant-safe FK to owner subject. */
    referralLinksBizOwnerSubjectFk: foreignKey({
      columns: [table.bizId, table.ownerSubjectType, table.ownerSubjectId],
      foreignColumns: [subjects.bizId, subjects.subjectType, subjects.subjectId],
      name: "referral_links_biz_owner_subject_fk",
    }),

    /** Tenant-safe FK to destination subject. */
    referralLinksBizTargetSubjectFk: foreignKey({
      columns: [table.bizId, table.targetSubjectType, table.targetSubjectId],
      foreignColumns: [subjects.bizId, subjects.subjectType, subjects.subjectId],
      name: "referral_links_biz_target_subject_fk",
    }),

    /** Owner subject pointer should be fully null or fully set. */
    referralLinksOwnerSubjectPairCheck: check(
      "referral_links_owner_subject_pair_check",
      sql`
      (
        "owner_subject_type" IS NULL
        AND "owner_subject_id" IS NULL
      ) OR (
        "owner_subject_type" IS NOT NULL
        AND "owner_subject_id" IS NOT NULL
      )
      `,
    ),

    /** Destination subject pointer should be fully null or fully set. */
    referralLinksTargetSubjectPairCheck: check(
      "referral_links_target_subject_pair_check",
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

    /** Exactly one owner pointer is required. */
    referralLinksOwnerShapeCheck: check(
      "referral_links_owner_shape_check",
      sql`
      (
        ("owner_user_id" IS NOT NULL)::int
        + ("owner_group_account_id" IS NOT NULL)::int
        + ("owner_subject_type" IS NOT NULL)::int
      ) = 1
      `,
    ),

    /** At least one destination pointer must be configured. */
    referralLinksDestinationShapeCheck: check(
      "referral_links_destination_shape_check",
      sql`
      (
        ("sellable_id" IS NOT NULL)::int
        + ("offer_version_id" IS NOT NULL)::int
        + ("target_subject_type" IS NOT NULL)::int
      ) >= 1
      `,
    ),

    /** Attribution bounds and campaign window sanity checks. */
    referralLinksWindowAndAttributionCheck: check(
      "referral_links_window_attribution_check",
      sql`
      ("starts_at" IS NULL OR "ends_at" IS NULL OR "ends_at" > "starts_at")
      AND "attribution_window_minutes" > 0
      `,
    ),

    /** Attribution model vocabulary guard. */
    referralLinksAttributionModelCheck: check(
      "referral_links_attribution_model_check",
      sql`
      "attribution_model" IN ('first_touch', 'last_touch')
      OR "attribution_model" LIKE 'custom_%'
      `,
    ),
  }),
);

/**
 * referral_link_clicks
 *
 * ELI5:
 * One row = one tracked click/session entry for a referral link.
 *
 * Why this exists:
 * - provides deterministic input for attribution decisions,
 * - avoids inferring referral from weak request metadata later.
 */
export const referralLinkClicks = pgTable(
  "referral_link_clicks",
  {
    /** Stable primary key for one click record. */
    id: idWithTag("referral_click"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Source referral link. */
    referralLinkId: idRef("referral_link_id")
      .references(() => referralLinks.id)
      .notNull(),

    /** Click timestamp. */
    clickedAt: timestamp("clicked_at", { withTimezone: true }).defaultNow().notNull(),

    /** Optional visitor user (if already authenticated). */
    visitorUserId: idRef("visitor_user_id").references(() => users.id),

    /** Session key used to stitch anonymous click->checkout journey. */
    sessionKey: varchar("session_key", { length: 140 }),

    /** Optional hashed IP for risk/fraud and uniqueness heuristics. */
    ipHash: varchar("ip_hash", { length: 255 }),

    /** Optional hashed user-agent/device signature. */
    userAgentHash: varchar("user_agent_hash", { length: 255 }),

    /** Optional source channel key (ig, fb, email, partner_portal, etc.). */
    sourceChannel: varchar("source_channel", { length: 80 }),

    /** Optional landing path/route. */
    landingPath: varchar("landing_path", { length: 1000 }),

    /** UTM and campaign parameters payload. */
    campaignParams: jsonb("campaign_params").default({}).notNull(),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    referralLinkClicksBizIdIdUnique: uniqueIndex("referral_link_clicks_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Composite key for tenant-safe attribution rows. */

    /** Common attribution window query path. */
    referralLinkClicksBizLinkClickedIdx: index("referral_link_clicks_biz_link_clicked_idx").on(
      table.bizId,
      table.referralLinkId,
      table.clickedAt,
    ),

    /** Session stitching path. */
    referralLinkClicksBizSessionClickedIdx: index(
      "referral_link_clicks_biz_session_clicked_idx",
    ).on(table.bizId, table.sessionKey, table.clickedAt),

    /** Tenant-safe FK to referral link. */
    referralLinkClicksBizLinkFk: foreignKey({
      columns: [table.bizId, table.referralLinkId],
      foreignColumns: [referralLinks.bizId, referralLinks.id],
      name: "referral_link_clicks_biz_link_fk",
    }),
  }),
);

/**
 * referral_attributions
 *
 * ELI5:
 * One row = one attribution decision for one conversion outcome.
 *
 * Why this exists:
 * - attribution rules can evolve and be replayed,
 * - explicit attribution rows keep reward decisions auditable.
 */
export const referralAttributions = pgTable(
  "referral_attributions",
  {
    /** Stable primary key for one attribution decision row. */
    id: idWithTag("referral_attr"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Link selected by attribution model. */
    referralLinkId: idRef("referral_link_id")
      .references(() => referralLinks.id)
      .notNull(),

    /** Optional click selected by attribution model. */
    referralLinkClickId: idRef("referral_link_click_id").references(
      () => referralLinkClicks.id,
    ),

    /** Optional downstream referral event record created from this attribution. */
    referralEventId: idRef("referral_event_id").references(() => referralEvents.id),

    /** Optional booking-order conversion target. */
    bookingOrderId: idRef("booking_order_id").references(() => bookingOrders.id),

    /** Optional cross-biz conversion target. */
    crossBizOrderId: idRef("cross_biz_order_id").references(() => crossBizOrders.id),

    /** Attribution decision timestamp. */
    attributedAt: timestamp("attributed_at", { withTimezone: true }).defaultNow().notNull(),

    /** Attribution model used for this decision. */
    attributionModel: varchar("attribution_model", { length: 60 })
      .default("last_touch")
      .notNull(),

    /** Attribution window cutoff time used by the evaluator. */
    windowExpiresAt: timestamp("window_expires_at", { withTimezone: true }),

    /** Whether this conversion was eligible under policy. */
    isEligible: boolean("is_eligible").default(true).notNull(),

    /** Whether this attribution should produce reward grant side-effects. */
    isRewardEligible: boolean("is_reward_eligible").default(true).notNull(),

    /** Optional decision reason code (e.g., late_conversion, self_referral_block). */
    reasonCode: varchar("reason_code", { length: 120 }),

    /** Optional evaluator details payload for explainability. */
    decisionDetails: jsonb("decision_details").default({}).notNull(),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    referralAttributionsBizIdIdUnique: uniqueIndex("referral_attributions_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** One attribution per booking conversion target. */
    referralAttributionsBizBookingOrderUnique: uniqueIndex(
      "referral_attributions_biz_booking_order_unique",
    )
      .on(table.bizId, table.bookingOrderId)
      .where(sql`"booking_order_id" IS NOT NULL`),

    /** One attribution per cross-biz conversion target. */
    referralAttributionsBizCrossBizOrderUnique: uniqueIndex(
      "referral_attributions_biz_cross_biz_order_unique",
    )
      .on(table.bizId, table.crossBizOrderId)
      .where(sql`"cross_biz_order_id" IS NOT NULL`),

    /** Attribution timeline path by link. */
    referralAttributionsBizLinkAttributedIdx: index(
      "referral_attributions_biz_link_attributed_idx",
    ).on(table.bizId, table.referralLinkId, table.attributedAt),

    /** Tenant-safe FK to referral link. */
    referralAttributionsBizLinkFk: foreignKey({
      columns: [table.bizId, table.referralLinkId],
      foreignColumns: [referralLinks.bizId, referralLinks.id],
      name: "referral_attributions_biz_link_fk",
    }),

    /** Tenant-safe FK to referral click. */
    referralAttributionsBizClickFk: foreignKey({
      columns: [table.bizId, table.referralLinkClickId],
      foreignColumns: [referralLinkClicks.bizId, referralLinkClicks.id],
      name: "referral_attributions_biz_click_fk",
    }),

    /** Tenant-safe FK to referral event. */
    referralAttributionsBizEventFk: foreignKey({
      columns: [table.bizId, table.referralEventId],
      foreignColumns: [referralEvents.bizId, referralEvents.id],
      name: "referral_attributions_biz_event_fk",
    }),

    /** Tenant-safe FK to booking order conversion target. */
    referralAttributionsBizBookingOrderFk: foreignKey({
      columns: [table.bizId, table.bookingOrderId],
      foreignColumns: [bookingOrders.bizId, bookingOrders.id],
      name: "referral_attributions_biz_booking_order_fk",
    }),

    /** Tenant-safe FK to cross-biz order conversion target. */
    referralAttributionsBizCrossBizOrderFk: foreignKey({
      columns: [table.bizId, table.crossBizOrderId],
      foreignColumns: [crossBizOrders.bizId, crossBizOrders.id],
      name: "referral_attributions_biz_cross_biz_order_fk",
    }),

    /** A conversion attribution must point to at least one conversion target row. */
    referralAttributionsConversionTargetCheck: check(
      "referral_attributions_conversion_target_check",
      sql`"booking_order_id" IS NOT NULL OR "cross_biz_order_id" IS NOT NULL`,
    ),

    /** Attribution model vocabulary guard. */
    referralAttributionsModelCheck: check(
      "referral_attributions_model_check",
      sql`
      "attribution_model" IN ('first_touch', 'last_touch')
      OR "attribution_model" LIKE 'custom_%'
      `,
    ),
  }),
);

export type ReferralLink = typeof referralLinks.$inferSelect;
export type NewReferralLink = typeof referralLinks.$inferInsert;
export type ReferralLinkClick = typeof referralLinkClicks.$inferSelect;
export type NewReferralLinkClick = typeof referralLinkClicks.$inferInsert;
export type ReferralAttribution = typeof referralAttributions.$inferSelect;
export type NewReferralAttribution = typeof referralAttributions.$inferInsert;

