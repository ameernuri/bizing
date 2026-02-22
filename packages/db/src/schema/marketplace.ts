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
import { resources } from "./resources";
import { subjects } from "./subjects";
import { users } from "./users";
import { bookingOrders } from "./fulfillment";
import {
  auctionTargetTypeEnum,
  auctionStatusEnum,
  bidStatusEnum,
  crossBizContractStatusEnum,
  crossBizOrderStatusEnum,
  marketplaceListingStatusEnum,
  marketplaceListingTypeEnum,
  referralEventTypeEnum,
  referralRewardStatusEnum,
  revenueShareRuleTypeEnum,
} from "./enums";
import { offerVersions } from "./offers";

/**
 * marketplace_listings
 *
 * ELI5:
 * Listing = what gets published into a marketplace channel.
 * It can reference an offer version or a specific resource package.
 */
export const marketplaceListings = pgTable(
  "marketplace_listings",
  {
    /** Stable primary key. */
    id: idWithTag("market_listing"),

    /** Tenant boundary for listing owner. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Listing type discriminator. */
    listingType: marketplaceListingTypeEnum("listing_type").notNull(),

    /** Optional offer-version target listing payload. */
    offerVersionId: idRef("offer_version_id").references(() => offerVersions.id),

    /** Optional direct resource target listing payload. */
    resourceId: idRef("resource_id").references(() => resources.id),

    /** Human listing title. */
    title: varchar("title", { length: 240 }).notNull(),

    /** Optional short summary. */
    summary: varchar("summary", { length: 1000 }),

    /** Listing lifecycle state. */
    status: marketplaceListingStatusEnum("status").default("draft").notNull(),

    /** Listing currency for price display. */
    currency: varchar("currency", { length: 3 }).default("USD").notNull(),

    /** Base list price in minor units. */
    basePriceMinor: integer("base_price_minor").default(0).notNull(),

    /** Marketplace visibility/channel rules. */
    visibilityPolicy: jsonb("visibility_policy").default({}),

    /** Optional publish time. */
    publishedAt: timestamp("published_at", { withTimezone: true }),

    /** Optional listing expiry time. */
    expiresAt: timestamp("expires_at", { withTimezone: true }),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite unique key used by tenant-safe child FKs. */
    marketplaceListingsBizIdIdUnique: uniqueIndex(
      "marketplace_listings_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** Common listing discovery path. */
    marketplaceListingsBizStatusPublishedIdx: index(
      "marketplace_listings_biz_status_published_idx",
    ).on(table.bizId, table.status, table.publishedAt),

    /** Tenant-safe FK to offer version payload. */
    marketplaceListingsBizOfferVersionFk: foreignKey({
      columns: [table.bizId, table.offerVersionId],
      foreignColumns: [offerVersions.bizId, offerVersions.id],
      name: "marketplace_listings_biz_offer_version_fk",
    }),

    /** Tenant-safe FK to resource payload. */
    marketplaceListingsBizResourceFk: foreignKey({
      columns: [table.bizId, table.resourceId],
      foreignColumns: [resources.bizId, resources.id],
      name: "marketplace_listings_biz_resource_fk",
    }),

    /** Listing payload shape check by discriminator. */
    marketplaceListingsShapeCheck: check(
      "marketplace_listings_shape_check",
      sql`
      (
        "listing_type" = 'offer_version'
        AND "offer_version_id" IS NOT NULL
      ) OR (
        "listing_type" IN ('resource', 'package')
        AND "resource_id" IS NOT NULL
      )
      `,
    ),

    /** Price and publish windows must be sane. */
    marketplaceListingsPriceAndWindowCheck: check(
      "marketplace_listings_price_and_window_check",
      sql`
      "base_price_minor" >= 0
      AND ("published_at" IS NULL OR "expires_at" IS NULL OR "expires_at" > "published_at")
      `,
    ),

    /** Currency should always use uppercase ISO-like code shape. */
    marketplaceListingsCurrencyFormatCheck: check(
      "marketplace_listings_currency_format_check",
      sql`"currency" ~ '^[A-Z]{3}$'`,
    ),
  }),
);

/**
 * auctions
 *
 * ELI5:
 * Auction windows attached to listings.
 */
export const auctions = pgTable(
  "auctions",
  {
    /** Stable primary key. */
    id: idWithTag("auction"),

    /** Tenant boundary for listing owner context. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Auction target class. */
    targetType: auctionTargetTypeEnum("target_type")
      .default("marketplace_listing")
      .notNull(),

    /** Listing target payload when `target_type=marketplace_listing`. */
    marketplaceListingId: idRef("marketplace_listing_id").references(
      () => marketplaceListings.id,
    ),

    /** Custom-subject target payload when `target_type=custom_subject`. */
    targetSubjectType: varchar("target_subject_type", { length: 80 }),
    targetSubjectId: varchar("target_subject_id", { length: 140 }),

    /** Optional auction label/title. */
    title: varchar("title", { length: 220 }),

    /** Auction lifecycle state. */
    status: auctionStatusEnum("status").default("scheduled").notNull(),

    /** Auction start time. */
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),

    /** Auction end time. */
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),

    /** Optional reserve price in minor units. */
    reservePriceMinor: integer("reserve_price_minor"),

    /** Optional buy-now price in minor units. */
    buyNowPriceMinor: integer("buy_now_price_minor"),

    /** Minimum increment in minor units. */
    minIncrementMinor: integer("min_increment_minor").default(1).notNull(),

    /** Optional winning bid id pointer once settled. */
    winningBidId: idRef("winning_bid_id"),

    /** Policy payload for anti-sniping, extension windows, etc. */
    policy: jsonb("policy").default({}),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    auctionsBizIdIdUnique: uniqueIndex("auctions_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Composite unique key used by tenant-safe bid FKs. */

    /** Common operator listing path. */
    auctionsBizStatusStartsIdx: index("auctions_biz_status_starts_idx").on(
      table.bizId,
      table.status,
      table.startsAt,
    ),

    /** Reverse lookup path for custom-subject targets. */
    auctionsBizTargetSubjectIdx: index("auctions_biz_target_subject_idx").on(
      table.bizId,
      table.targetSubjectType,
      table.targetSubjectId,
    ),

    /** Tenant-safe FK to listing. */
    auctionsBizMarketplaceListingFk: foreignKey({
      columns: [table.bizId, table.marketplaceListingId],
      foreignColumns: [marketplaceListings.bizId, marketplaceListings.id],
      name: "auctions_biz_marketplace_listing_fk",
    }),

    /** Tenant-safe FK to custom-subject target payload. */
    auctionsBizTargetSubjectFk: foreignKey({
      columns: [table.bizId, table.targetSubjectType, table.targetSubjectId],
      foreignColumns: [subjects.bizId, subjects.subjectType, subjects.subjectId],
      name: "auctions_biz_target_subject_fk",
    }),

    /** Subject payload should be fully-null or fully-populated. */
    auctionsTargetSubjectPairCheck: check(
      "auctions_target_subject_pair_check",
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

    /** Target payload must match target type exactly. */
    auctionsTargetShapeCheck: check(
      "auctions_target_shape_check",
      sql`
      (
        "target_type" = 'marketplace_listing'
        AND "marketplace_listing_id" IS NOT NULL
        AND "target_subject_type" IS NULL
        AND "target_subject_id" IS NULL
      ) OR (
        "target_type" = 'custom_subject'
        AND "marketplace_listing_id" IS NULL
        AND "target_subject_type" IS NOT NULL
        AND "target_subject_id" IS NOT NULL
      )
      `,
    ),

    /** Auction windows and numeric values must be sane. */
    auctionsWindowAndPriceCheck: check(
      "auctions_window_and_price_check",
      sql`
      "ends_at" > "starts_at"
      AND "min_increment_minor" > 0
      AND ("reserve_price_minor" IS NULL OR "reserve_price_minor" >= 0)
      AND ("buy_now_price_minor" IS NULL OR "buy_now_price_minor" >= 0)
      `,
    ),
  }),
);

/**
 * bids
 *
 * ELI5:
 * One bid attempt in an auction/reverse-auction process.
 */
export const bids = pgTable(
  "bids",
  {
    /** Stable primary key. */
    id: idWithTag("bid"),

    /** Tenant boundary (auction owner context). */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent auction. */
    auctionId: idRef("auction_id")
      .references(() => auctions.id)
      .notNull(),

    /** Optional bidder business identity. */
    bidderBizId: idRef("bidder_biz_id").references(() => bizes.id),

    /** Optional bidder user identity. */
    bidderUserId: idRef("bidder_user_id").references(() => users.id),

    /** Bid amount in minor units. */
    amountMinor: integer("amount_minor").notNull(),

    /** Bid currency. */
    currency: varchar("currency", { length: 3 }).default("USD").notNull(),

    /** Bid lifecycle state. */
    status: bidStatusEnum("status").default("pending").notNull(),

    /** Bid submission timestamp. */
    submittedAt: timestamp("submitted_at", { withTimezone: true }).defaultNow().notNull(),

    /** Optional expiry timestamp for timed offers. */
    expiresAt: timestamp("expires_at", { withTimezone: true }),

    /** Bid metadata (notes/proofs/source context). */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    bidsBizIdIdUnique: uniqueIndex("bids_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Common live-auction orderbook path. */
    bidsBizAuctionSubmittedIdx: index("bids_biz_auction_submitted_idx").on(
      table.bizId,
      table.auctionId,
      table.submittedAt,
    ),

    /** Tenant-safe FK to auction. */
    bidsBizAuctionFk: foreignKey({
      columns: [table.bizId, table.auctionId],
      foreignColumns: [auctions.bizId, auctions.id],
      name: "bids_biz_auction_fk",
    }),

    /** Bid amounts must be positive. */
    bidsAmountPositiveCheck: check(
      "bids_amount_positive_check",
      sql`"amount_minor" > 0`,
    ),

    /** Currency should always use uppercase ISO-like code shape. */
    bidsCurrencyFormatCheck: check(
      "bids_currency_format_check",
      sql`"currency" ~ '^[A-Z]{3}$'`,
    ),

    /** Expiry should be after submission when present. */
    bidsExpiryCheck: check(
      "bids_expiry_check",
      sql`"expires_at" IS NULL OR "expires_at" > "submitted_at"`,
    ),

    /** Must identify at least one bidder principal. */
    bidsBidderPointerCheck: check(
      "bids_bidder_pointer_check",
      sql`"bidder_biz_id" IS NOT NULL OR "bidder_user_id" IS NOT NULL`,
    ),
  }),
);

/**
 * cross_biz_contracts
 *
 * ELI5:
 * Contract object between two businesses for marketplace/cross-org operations.
 */
export const crossBizContracts = pgTable(
  "cross_biz_contracts",
  {
    /** Stable primary key. */
    id: idWithTag("cross_contract"),

    /** Tenant boundary representing primary/owner biz of this contract row. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Counterparty business identity. */
    counterpartyBizId: idRef("counterparty_biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Contract title. */
    name: varchar("name", { length: 220 }).notNull(),

    /** Contract lifecycle status. */
    status: crossBizContractStatusEnum("status").default("draft").notNull(),

    /** Contract effective start time. */
    effectiveAt: timestamp("effective_at", { withTimezone: true }),

    /** Contract expiry time. */
    expiresAt: timestamp("expires_at", { withTimezone: true }),

    /** Canonical legal/commercial terms snapshot. */
    terms: jsonb("terms").default({}).notNull(),

    /** Optional policy for residency/compliance handling across parties. */
    governancePolicy: jsonb("governance_policy").default({}),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite unique key used by tenant-safe child FKs. */
    crossBizContractsBizIdIdUnique: uniqueIndex(
      "cross_biz_contracts_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** Common contract listing path. */
    crossBizContractsBizStatusIdx: index("cross_biz_contracts_biz_status_idx").on(
      table.bizId,
      table.status,
    ),

    /** Prevent self-contract rows. */
    crossBizContractsNoSelfCheck: check(
      "cross_biz_contracts_no_self_check",
      sql`"biz_id" <> "counterparty_biz_id"`,
    ),

    /** Contract window must be ordered when present. */
    crossBizContractsWindowCheck: check(
      "cross_biz_contracts_window_check",
      sql`"effective_at" IS NULL OR "expires_at" IS NULL OR "expires_at" > "effective_at"`,
    ),
  }),
);

/**
 * cross_biz_orders
 *
 * ELI5:
 * Settlement/order rows that represent transactions across two businesses.
 */
export const crossBizOrders = pgTable(
  "cross_biz_orders",
  {
    /** Stable primary key. */
    id: idWithTag("cross_order"),

    /** Tenant boundary (owner/admin context). */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Buyer business. */
    buyerBizId: idRef("buyer_biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Seller business. */
    sellerBizId: idRef("seller_biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Optional contract governing this order. */
    contractId: idRef("contract_id").references(() => crossBizContracts.id),

    /** Optional linked offer version sold across businesses. */
    offerVersionId: idRef("offer_version_id").references(() => offerVersions.id),

    /** Optional source booking order. */
    bookingOrderId: idRef("booking_order_id").references(() => bookingOrders.id),

    /** Cross-biz order lifecycle status. */
    status: crossBizOrderStatusEnum("status").default("draft").notNull(),

    /** Settlement currency. */
    currency: varchar("currency", { length: 3 }).default("USD").notNull(),

    /** Total amount in minor units. */
    totalMinor: integer("total_minor").default(0).notNull(),

    /** Settlement due timestamp. */
    settlementDueAt: timestamp("settlement_due_at", { withTimezone: true }),

    /** Settlement completion timestamp. */
    settledAt: timestamp("settled_at", { withTimezone: true }),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    crossBizOrdersBizIdIdUnique: uniqueIndex("cross_biz_orders_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Composite key for tenant-safe references to this cross-biz order row. */

    /** Common finance workflow path. */
    crossBizOrdersBizStatusDueIdx: index("cross_biz_orders_biz_status_due_idx").on(
      table.bizId,
      table.status,
      table.settlementDueAt,
    ),

    /** Tenant-safe FK to contract. */
    crossBizOrdersBizContractFk: foreignKey({
      columns: [table.bizId, table.contractId],
      foreignColumns: [crossBizContracts.bizId, crossBizContracts.id],
      name: "cross_biz_orders_biz_contract_fk",
    }),

    /** Tenant-safe FK to offer version. */
    crossBizOrdersBizOfferVersionFk: foreignKey({
      columns: [table.bizId, table.offerVersionId],
      foreignColumns: [offerVersions.bizId, offerVersions.id],
      name: "cross_biz_orders_biz_offer_version_fk",
    }),

    /** Tenant-safe FK to source booking order. */
    crossBizOrdersBizBookingOrderFk: foreignKey({
      columns: [table.bizId, table.bookingOrderId],
      foreignColumns: [bookingOrders.bizId, bookingOrders.id],
      name: "cross_biz_orders_biz_booking_order_fk",
    }),

    /** Basic checks. */
    crossBizOrdersValueCheck: check(
      "cross_biz_orders_value_check",
      sql`
      "total_minor" >= 0
      AND "buyer_biz_id" <> "seller_biz_id"
      AND ("settled_at" IS NULL OR "settlement_due_at" IS NULL OR "settled_at" >= "settlement_due_at")
      `,
    ),

    /** Currency should always use uppercase ISO-like code shape. */
    crossBizOrdersCurrencyFormatCheck: check(
      "cross_biz_orders_currency_format_check",
      sql`"currency" ~ '^[A-Z]{3}$'`,
    ),
  }),
);

/**
 * revenue_share_rules
 *
 * ELI5:
 * Rules that explain how money is split between parties.
 */
export const revenueShareRules = pgTable(
  "revenue_share_rules",
  {
    /** Stable primary key. */
    id: idWithTag("revenue_share_rule"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Optional contract scope. */
    contractId: idRef("contract_id").references(() => crossBizContracts.id),

    /** Optional listing scope. */
    marketplaceListingId: idRef("marketplace_listing_id").references(
      () => marketplaceListings.id,
    ),

    /** Rule calculation mode. */
    ruleType: revenueShareRuleTypeEnum("rule_type").notNull(),

    /** Percentage basis points for percent mode. */
    percentBps: integer("percent_bps"),

    /** Fixed amount in minor units for fixed mode. */
    amountMinor: integer("amount_minor"),

    /** Optional tier model payload for tiered mode. */
    tierModel: jsonb("tier_model"),

    /** Rule activation toggle. */
    isActive: boolean("is_active").default(true).notNull(),

    /** Rule priority when multiple rules could apply. */
    priority: integer("priority").default(100).notNull(),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    revenueShareRulesBizIdIdUnique: uniqueIndex("revenue_share_rules_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Common rule lookup path. */
    revenueShareRulesBizActivePriorityIdx: index(
      "revenue_share_rules_biz_active_priority_idx",
    ).on(table.bizId, table.isActive, table.priority),

    /** Tenant-safe FK to contract. */
    revenueShareRulesBizContractFk: foreignKey({
      columns: [table.bizId, table.contractId],
      foreignColumns: [crossBizContracts.bizId, crossBizContracts.id],
      name: "revenue_share_rules_biz_contract_fk",
    }),

    /** Tenant-safe FK to listing. */
    revenueShareRulesBizMarketplaceListingFk: foreignKey({
      columns: [table.bizId, table.marketplaceListingId],
      foreignColumns: [marketplaceListings.bizId, marketplaceListings.id],
      name: "revenue_share_rules_biz_marketplace_listing_fk",
    }),

    /** Must scope to at least contract or listing. */
    revenueShareRulesScopeCheck: check(
      "revenue_share_rules_scope_check",
      sql`"contract_id" IS NOT NULL OR "marketplace_listing_id" IS NOT NULL`,
    ),

    /** Rule shape check for each calculation mode. */
    revenueShareRulesShapeCheck: check(
      "revenue_share_rules_shape_check",
      sql`
      (
        "rule_type" = 'fixed_percent'
        AND "percent_bps" IS NOT NULL
        AND "amount_minor" IS NULL
      ) OR (
        "rule_type" = 'fixed_amount'
        AND "percent_bps" IS NULL
        AND "amount_minor" IS NOT NULL
      ) OR (
        "rule_type" = 'tiered'
        AND "tier_model" IS NOT NULL
      )
      `,
    ),
  }),
);

/**
 * referral_programs
 *
 * ELI5:
 * Campaign definitions for referral incentives.
 */
export const referralPrograms = pgTable(
  "referral_programs",
  {
    /** Stable primary key. */
    id: idWithTag("referral_program"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Program name. */
    name: varchar("name", { length: 220 }).notNull(),

    /** Stable slug for APIs/admin routes. */
    slug: varchar("slug", { length: 140 }).notNull(),

    /** Activation toggle. */
    isActive: boolean("is_active").default(true).notNull(),

    /** Optional campaign start. */
    startsAt: timestamp("starts_at", { withTimezone: true }),

    /** Optional campaign end. */
    endsAt: timestamp("ends_at", { withTimezone: true }),

    /** Program policy/rule payload. */
    policy: jsonb("policy").default({}).notNull(),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    referralProgramsBizIdIdUnique: uniqueIndex("referral_programs_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Composite unique key for tenant-safe child FKs. */

    /** Unique slug per tenant. */
    referralProgramsBizSlugUnique: uniqueIndex("referral_programs_biz_slug_unique").on(
      table.bizId,
      table.slug,
    ),

    /** Campaign window ordering check. */
    referralProgramsWindowCheck: check(
      "referral_programs_window_check",
      sql`"starts_at" IS NULL OR "ends_at" IS NULL OR "ends_at" > "starts_at"`,
    ),
  }),
);

/**
 * referral_events
 *
 * ELI5:
 * Timeline rows for referral progression.
 */
export const referralEvents = pgTable(
  "referral_events",
  {
    /** Stable primary key. */
    id: idWithTag("referral_event"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent referral program. */
    referralProgramId: idRef("referral_program_id")
      .references(() => referralPrograms.id)
      .notNull(),

    /** Referral event type. */
    eventType: referralEventTypeEnum("event_type").notNull(),

    /** Referrer user id. */
    referrerUserId: idRef("referrer_user_id").references(() => users.id),

    /** Referred user id. */
    referredUserId: idRef("referred_user_id").references(() => users.id),

    /** Optional related booking order. */
    bookingOrderId: idRef("booking_order_id").references(() => bookingOrders.id),

    /** Optional related cross-biz order. */
    crossBizOrderId: idRef("cross_biz_order_id").references(() => crossBizOrders.id),

    /** Event timestamp. */
    eventAt: timestamp("event_at", { withTimezone: true }).defaultNow().notNull(),

    /** Event details payload. */
    payload: jsonb("payload").default({}).notNull(),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    referralEventsBizIdIdUnique: uniqueIndex("referral_events_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Composite key for tenant-safe references to this referral event row. */

    /** Common campaign timeline path. */
    referralEventsBizProgramEventAtIdx: index(
      "referral_events_biz_program_event_at_idx",
    ).on(table.bizId, table.referralProgramId, table.eventAt),

    /** Tenant-safe FK to program. */
    referralEventsBizProgramFk: foreignKey({
      columns: [table.bizId, table.referralProgramId],
      foreignColumns: [referralPrograms.bizId, referralPrograms.id],
      name: "referral_events_biz_program_fk",
    }),

    /** Tenant-safe FK to booking order. */
    referralEventsBizBookingOrderFk: foreignKey({
      columns: [table.bizId, table.bookingOrderId],
      foreignColumns: [bookingOrders.bizId, bookingOrders.id],
      name: "referral_events_biz_booking_order_fk",
    }),

    /** Tenant-safe FK to cross-biz order. */
    referralEventsBizCrossBizOrderFk: foreignKey({
      columns: [table.bizId, table.crossBizOrderId],
      foreignColumns: [crossBizOrders.bizId, crossBizOrders.id],
      name: "referral_events_biz_cross_biz_order_fk",
    }),
  }),
);

/**
 * reward_grants
 *
 * ELI5:
 * Concrete grant/reversal rows for referral rewards.
 */
export const rewardGrants = pgTable(
  "reward_grants",
  {
    /** Stable primary key. */
    id: idWithTag("reward_grant"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Program context. */
    referralProgramId: idRef("referral_program_id")
      .references(() => referralPrograms.id)
      .notNull(),

    /** Source referral event. */
    referralEventId: idRef("referral_event_id")
      .references(() => referralEvents.id)
      .notNull(),

    /** Reward recipient user. */
    recipientUserId: idRef("recipient_user_id")
      .references(() => users.id)
      .notNull(),

    /** Reward status lifecycle. */
    status: referralRewardStatusEnum("status").default("pending").notNull(),

    /** Reward type label (credit, cash, voucher, points). */
    rewardType: varchar("reward_type", { length: 80 }).notNull(),

    /** Reward amount in minor units. */
    amountMinor: integer("amount_minor").default(0).notNull(),

    /** Reward currency. */
    currency: varchar("currency", { length: 3 }).default("USD").notNull(),

    /** Optional grant timestamp. */
    grantedAt: timestamp("granted_at", { withTimezone: true }),

    /** Optional reversal timestamp. */
    reversedAt: timestamp("reversed_at", { withTimezone: true }),

    /** Optional external payout reference (Stripe transfer, wallet tx id, etc.). */
    payoutReference: varchar("payout_reference", { length: 140 }),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    rewardGrantsBizIdIdUnique: uniqueIndex("reward_grants_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Common payout processing path. */
    rewardGrantsBizStatusGrantedIdx: index("reward_grants_biz_status_granted_idx").on(
      table.bizId,
      table.status,
      table.grantedAt,
    ),

    /** Tenant-safe FK to referral program. */
    rewardGrantsBizProgramFk: foreignKey({
      columns: [table.bizId, table.referralProgramId],
      foreignColumns: [referralPrograms.bizId, referralPrograms.id],
      name: "reward_grants_biz_program_fk",
    }),

    /** Tenant-safe FK to referral event. */
    rewardGrantsBizEventFk: foreignKey({
      columns: [table.bizId, table.referralEventId],
      foreignColumns: [referralEvents.bizId, referralEvents.id],
      name: "reward_grants_biz_event_fk",
    }),

    /** Amount must be non-negative. */
    rewardGrantsAmountCheck: check(
      "reward_grants_amount_check",
      sql`"amount_minor" >= 0`,
    ),

    /** Currency should always use uppercase ISO-like code shape. */
    rewardGrantsCurrencyFormatCheck: check(
      "reward_grants_currency_format_check",
      sql`"currency" ~ '^[A-Z]{3}$'`,
    ),

    /** Reversal cannot happen before grant when both exist. */
    rewardGrantsTimelineCheck: check(
      "reward_grants_timeline_check",
      sql`"granted_at" IS NULL OR "reversed_at" IS NULL OR "reversed_at" >= "granted_at"`,
    ),
  }),
);
