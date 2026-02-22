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
import { users } from "./users";
import {
  discountCampaignStatusEnum,
  discountRedemptionStatusEnum,
  discountScopeEnum,
  discountStackingModeEnum,
  discountTypeEnum,
} from "./enums";
import { bookingOrderLines, bookingOrders } from "./fulfillment";
import { bizExtensionInstalls } from "./extensions";

/**
 * discount_campaigns
 *
 * ELI5:
 * A discount campaign defines pricing adjustment rules that can be:
 * - code-based (coupon),
 * - automatic (time/segment conditions),
 * - campaign-window scoped (flash sales, win-back offers).
 *
 * Why this is separate from runtime redemptions:
 * - campaign holds reusable policy/config,
 * - redemptions hold immutable historical usage facts.
 */
export const discountCampaigns = pgTable(
  "discount_campaigns",
  {
    /** Stable primary key for one campaign. */
    id: idWithTag("discount_campaign"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Optional extension owner for plugin-managed campaigns. */
    bizExtensionInstallId: idRef("biz_extension_install_id").references(
      () => bizExtensionInstalls.id,
    ),

    /** Human campaign name. */
    name: varchar("name", { length: 220 }).notNull(),

    /** Stable slug for APIs/operations. */
    slug: varchar("slug", { length: 140 }).notNull(),

    /** Campaign lifecycle. */
    status: discountCampaignStatusEnum("status").default("draft").notNull(),

    /** Discount calculation method. */
    discountType: discountTypeEnum("discount_type").notNull(),

    /** Commercial scope where this discount can apply. */
    scope: discountScopeEnum("scope").default("order").notNull(),

    /** Whether this campaign can stack with other discounts. */
    stackingMode: discountStackingModeEnum("stacking_mode")
      .default("exclusive")
      .notNull(),

    /** Currency for amount-based discount columns. */
    currency: varchar("currency", { length: 3 }).default("USD").notNull(),

    /** Percentage off in basis points (10000 = 100%). */
    percentOffBps: integer("percent_off_bps"),

    /** Fixed amount off in minor units. */
    fixedAmountMinor: integer("fixed_amount_minor"),

    /** Optional discount cap in minor units. */
    maxDiscountMinor: integer("max_discount_minor"),

    /** Minimum order subtotal required to apply campaign. */
    minSubtotalMinor: integer("min_subtotal_minor").default(0).notNull(),

    /** Optional total redemption cap across all customers. */
    maxTotalRedemptions: integer("max_total_redemptions"),

    /** Optional per-customer redemption cap. */
    maxPerCustomer: integer("max_per_customer"),

    /** Restricts campaign to first-time customers only when true. */
    firstTimeOnly: boolean("first_time_only").default(false).notNull(),

    /** Optional campaign start time. */
    startsAt: timestamp("starts_at", { withTimezone: true }),

    /** Optional campaign end time. */
    endsAt: timestamp("ends_at", { withTimezone: true }),

    /**
     * Condition payload for segment/service/location/channel constraints.
     * Kept JSON to stay extensible without frequent schema churn.
     */
    conditions: jsonb("conditions").default({}).notNull(),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite key for tenant-safe child references. */
    discountCampaignsBizIdIdUnique: uniqueIndex(
      "discount_campaigns_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** One slug per tenant. */
    discountCampaignsBizSlugUnique: uniqueIndex(
      "discount_campaigns_biz_slug_unique",
    ).on(table.bizId, table.slug),

    /** Campaign operations board query path. */
    discountCampaignsBizStatusStartsIdx: index(
      "discount_campaigns_biz_status_starts_idx",
    ).on(table.bizId, table.status, table.startsAt),

    /** Tenant-safe FK to optional extension owner. */
    discountCampaignsBizInstallFk: foreignKey({
      columns: [table.bizId, table.bizExtensionInstallId],
      foreignColumns: [bizExtensionInstalls.bizId, bizExtensionInstalls.id],
      name: "discount_campaigns_biz_install_fk",
    }),

    /** Numeric and temporal bounds. */
    discountCampaignsBoundsCheck: check(
      "discount_campaigns_bounds_check",
      sql`
      "min_subtotal_minor" >= 0
      AND ("max_discount_minor" IS NULL OR "max_discount_minor" >= 0)
      AND ("max_total_redemptions" IS NULL OR "max_total_redemptions" >= 0)
      AND ("max_per_customer" IS NULL OR "max_per_customer" >= 0)
      AND ("starts_at" IS NULL OR "ends_at" IS NULL OR "ends_at" > "starts_at")
      `,
    ),

    /** Discount payload shape by discount type. */
    discountCampaignsTypeShapeCheck: check(
      "discount_campaigns_type_shape_check",
      sql`
      (
        "discount_type" = 'percentage'
        AND "percent_off_bps" IS NOT NULL
        AND "fixed_amount_minor" IS NULL
      ) OR (
        "discount_type" = 'fixed_amount'
        AND "percent_off_bps" IS NULL
        AND "fixed_amount_minor" IS NOT NULL
      ) OR (
        "discount_type" IN ('free_item', 'free_service')
        AND "percent_off_bps" IS NULL
        AND "fixed_amount_minor" IS NULL
      )
      `,
    ),

    /** Percentage bounds when percentage mode is used. */
    discountCampaignsPercentBoundsCheck: check(
      "discount_campaigns_percent_bounds_check",
      sql`"percent_off_bps" IS NULL OR ("percent_off_bps" >= 1 AND "percent_off_bps" <= 10000)`,
    ),

    /** Currency should always use uppercase ISO-like code shape. */
    discountCampaignsCurrencyFormatCheck: check(
      "discount_campaigns_currency_format_check",
      sql`"currency" ~ '^[A-Z]{3}$'`,
    ),
  }),
);

/**
 * discount_codes
 *
 * ELI5:
 * One row is one redeemable code linked to a campaign.
 *
 * Campaign may have:
 * - one canonical code,
 * - bulk-generated partner codes,
 * - zero codes for automatic discounts.
 */
export const discountCodes = pgTable(
  "discount_codes",
  {
    /** Stable primary key. */
    id: idWithTag("discount_code"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent discount campaign. */
    discountCampaignId: idRef("discount_campaign_id")
      .references(() => discountCampaigns.id)
      .notNull(),

    /** Human/shared redemption code. */
    code: varchar("code", { length: 100 }).notNull(),

    /** Code lifecycle state. */
    status: discountCampaignStatusEnum("status").default("active").notNull(),

    /** Optional code-level validity start. */
    startsAt: timestamp("starts_at", { withTimezone: true }),

    /** Optional code-level validity end. */
    expiresAt: timestamp("expires_at", { withTimezone: true }),

    /** Optional total redemption cap specific to this code. */
    maxRedemptions: integer("max_redemptions"),

    /** Optional per-customer cap specific to this code. */
    maxPerCustomer: integer("max_per_customer"),

    /** Running redemption counter cache. */
    redemptionCount: integer("redemption_count").default(0).notNull(),

    /** If true, code should be consumed by one redemption only. */
    isSingleUse: boolean("is_single_use").default(false).notNull(),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    discountCodesBizIdIdUnique: uniqueIndex("discount_codes_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Composite key for tenant-safe references to this discount-code row. */

    /** One code text per tenant (case-sensitive by default). */
    discountCodesBizCodeUnique: uniqueIndex("discount_codes_biz_code_unique").on(
      table.bizId,
      table.code,
    ),

    /** Common campaign management path. */
    discountCodesBizCampaignStatusIdx: index(
      "discount_codes_biz_campaign_status_idx",
    ).on(table.bizId, table.discountCampaignId, table.status),

    /** Tenant-safe FK to parent campaign. */
    discountCodesBizCampaignFk: foreignKey({
      columns: [table.bizId, table.discountCampaignId],
      foreignColumns: [discountCampaigns.bizId, discountCampaigns.id],
      name: "discount_codes_biz_campaign_fk",
    }),

    /** Numeric/window bounds. */
    discountCodesBoundsCheck: check(
      "discount_codes_bounds_check",
      sql`
      "redemption_count" >= 0
      AND ("max_redemptions" IS NULL OR "max_redemptions" >= 0)
      AND ("max_per_customer" IS NULL OR "max_per_customer" >= 0)
      AND ("starts_at" IS NULL OR "expires_at" IS NULL OR "expires_at" > "starts_at")
      `,
    ),
  }),
);

/**
 * discount_redemptions
 *
 * ELI5:
 * Immutable-ish ledger of discount usage events.
 *
 * One row captures:
 * - who redeemed,
 * - where it applied,
 * - how much discount value was granted,
 * - and whether it was later voided/reversed.
 */
export const discountRedemptions = pgTable(
  "discount_redemptions",
  {
    /** Stable primary key. */
    id: idWithTag("discount_redemption"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Campaign used for this redemption. */
    discountCampaignId: idRef("discount_campaign_id")
      .references(() => discountCampaigns.id)
      .notNull(),

    /** Optional specific code used for this redemption. */
    discountCodeId: idRef("discount_code_id").references(() => discountCodes.id),

    /** Optional booking order where this redemption applied. */
    bookingOrderId: idRef("booking_order_id").references(() => bookingOrders.id),

    /** Optional booking line where this redemption applied. */
    bookingOrderLineId: idRef("booking_order_line_id").references(
      () => bookingOrderLines.id,
    ),

    /** Optional customer identity receiving this discount. */
    customerUserId: idRef("customer_user_id").references(() => users.id),

    /** Redemption status lifecycle. */
    status: discountRedemptionStatusEnum("status").default("applied").notNull(),

    /** Currency for discount amount. */
    currency: varchar("currency", { length: 3 }).default("USD").notNull(),

    /** Discount amount granted in minor units. */
    discountMinor: integer("discount_minor").default(0).notNull(),

    /** When discount was applied/reserved. */
    redeemedAt: timestamp("redeemed_at", { withTimezone: true })
      .defaultNow()
      .notNull(),

    /** When discount was voided/reversed, if applicable. */
    voidedAt: timestamp("voided_at", { withTimezone: true }),

    /** Extension payload for trace ids, formula detail, etc. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    discountRedemptionsBizIdIdUnique: uniqueIndex("discount_redemptions_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Common revenue/discount analysis path. */
    discountRedemptionsBizCampaignRedeemedIdx: index(
      "discount_redemptions_biz_campaign_redeemed_idx",
    ).on(table.bizId, table.discountCampaignId, table.redeemedAt),

    /** Common customer discount history path. */
    discountRedemptionsBizCustomerRedeemedIdx: index(
      "discount_redemptions_biz_customer_redeemed_idx",
    ).on(table.bizId, table.customerUserId, table.redeemedAt),

    /** Tenant-safe FK to campaign. */
    discountRedemptionsBizCampaignFk: foreignKey({
      columns: [table.bizId, table.discountCampaignId],
      foreignColumns: [discountCampaigns.bizId, discountCampaigns.id],
      name: "discount_redemptions_biz_campaign_fk",
    }),

    /** Tenant-safe FK to optional code. */
    discountRedemptionsBizCodeFk: foreignKey({
      columns: [table.bizId, table.discountCodeId],
      foreignColumns: [discountCodes.bizId, discountCodes.id],
      name: "discount_redemptions_biz_code_fk",
    }),

    /** Tenant-safe FK to optional booking order. */
    discountRedemptionsBizOrderFk: foreignKey({
      columns: [table.bizId, table.bookingOrderId],
      foreignColumns: [bookingOrders.bizId, bookingOrders.id],
      name: "discount_redemptions_biz_order_fk",
    }),

    /** Tenant-safe FK to optional booking order line. */
    discountRedemptionsBizOrderLineFk: foreignKey({
      columns: [table.bizId, table.bookingOrderLineId],
      foreignColumns: [bookingOrderLines.bizId, bookingOrderLines.id],
      name: "discount_redemptions_biz_order_line_fk",
    }),

    /** Discount amount must be non-negative. */
    discountRedemptionsAmountCheck: check(
      "discount_redemptions_amount_check",
      sql`"discount_minor" >= 0`,
    ),

    /** Currency should always use uppercase ISO-like code shape. */
    discountRedemptionsCurrencyFormatCheck: check(
      "discount_redemptions_currency_format_check",
      sql`"currency" ~ '^[A-Z]{3}$'`,
    ),

    /** One commercial anchor should exist for accounting traceability. */
    discountRedemptionsAnchorCheck: check(
      "discount_redemptions_anchor_check",
      sql`
      "booking_order_id" IS NOT NULL
      OR "booking_order_line_id" IS NOT NULL
      `,
    ),
  }),
);

export type DiscountCampaign = typeof discountCampaigns.$inferSelect;
export type NewDiscountCampaign = typeof discountCampaigns.$inferInsert;

export type DiscountCode = typeof discountCodes.$inferSelect;
export type NewDiscountCode = typeof discountCodes.$inferInsert;

export type DiscountRedemption = typeof discountRedemptions.$inferSelect;
export type NewDiscountRedemption = typeof discountRedemptions.$inferInsert;
