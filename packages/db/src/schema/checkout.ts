import { sql } from "drizzle-orm";
import { check, foreignKey, index, uniqueIndex } from "drizzle-orm/pg-core";
import {
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
  checkoutChannelEnum,
  checkoutEventTypeEnum,
  checkoutItemTypeEnum,
  checkoutRecoveryChannelEnum,
  checkoutRecoveryStatusEnum,
  checkoutSessionStatusEnum,
} from "./enums";
import { bookingOrders } from "./fulfillment";
import { groupAccounts } from "./group_accounts";
import { locations } from "./locations";
import { discountCampaigns } from "./promotions";
import { sellables } from "./product_commerce";
import { subjects } from "./subjects";
import { users } from "./users";

/**
 * checkout_sessions
 *
 * ELI5:
 * One row is one "cart + intent" lifecycle.
 *
 * Why this table exists:
 * - lets us track started-but-not-finished purchases,
 * - enables recovery campaigns without guessing from sparse logs,
 * - keeps both product and service checkout in one backbone.
 *
 * How it connects:
 * - item rows live in `checkout_session_items`,
 * - timeline rows live in `checkout_session_events`,
 * - recovery outreach rows live in `checkout_recovery_links`,
 * - successful conversion can link to a final `booking_orders` row.
 */
export const checkoutSessions = pgTable(
  "checkout_sessions",
  {
    /** Stable primary key for one checkout lifecycle. */
    id: idWithTag("checkout_session"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Checkout lifecycle status. */
    status: checkoutSessionStatusEnum("status").default("active").notNull(),

    /** Channel where checkout began or is managed. */
    channel: checkoutChannelEnum("channel").default("web").notNull(),

    /** Optional direct user owner. */
    ownerUserId: idRef("owner_user_id").references(() => users.id),

    /** Optional shared-account owner (family/company/group checkout context). */
    ownerGroupAccountId: idRef("owner_group_account_id").references(
      () => groupAccounts.id,
    ),

    /** Optional location scope where checkout was initiated. */
    locationId: idRef("location_id").references(() => locations.id),

    /** Checkout currency. */
    currency: varchar("currency", { length: 3 }).default("USD").notNull(),

    /** Running subtotal in minor units. */
    subtotalMinor: integer("subtotal_minor").default(0).notNull(),

    /** Running tax total in minor units. */
    taxMinor: integer("tax_minor").default(0).notNull(),

    /** Running fee total in minor units. */
    feeMinor: integer("fee_minor").default(0).notNull(),

    /** Running discount total in minor units. */
    discountMinor: integer("discount_minor").default(0).notNull(),

    /** Final checkout total in minor units. */
    totalMinor: integer("total_minor").default(0).notNull(),

    /** Checkout start timestamp. */
    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),

    /** Last activity timestamp for abandonment heuristics. */
    lastActivityAt: timestamp("last_activity_at", { withTimezone: true })
      .defaultNow()
      .notNull(),

    /** Mark when session was classified as abandoned. */
    abandonedAt: timestamp("abandoned_at", { withTimezone: true }),

    /** Mark when user returned through recovery flow. */
    recoveredAt: timestamp("recovered_at", { withTimezone: true }),

    /** Mark when session became a completed purchase. */
    completedAt: timestamp("completed_at", { withTimezone: true }),

    /** Optional expiry time for stale sessions. */
    expiresAt: timestamp("expires_at", { withTimezone: true }),

    /** Optional cancellation timestamp. */
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),

    /** Optional booking-order created from this session. */
    bookingOrderId: idRef("booking_order_id").references(() => bookingOrders.id),

    /** Optional pointer to a previous abandoned session that was recovered. */
    recoveredFromCheckoutSessionId: idRef("recovered_from_checkout_session_id"),

    /** Optional acquisition/referrer channel key (utm/source/etc.). */
    acquisitionSource: varchar("acquisition_source", { length: 120 }),

    /** Optional campaign key for attribution. */
    campaignReference: varchar("campaign_reference", { length: 140 }),

    /** Immutable policy snapshot for timeout/recovery behavior. */
    policySnapshot: jsonb("policy_snapshot").default({}).notNull(),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    checkoutSessionsBizIdIdUnique: uniqueIndex("checkout_sessions_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Composite key for tenant-safe child foreign keys. */

    /** Main operations path by lifecycle timing. */
    checkoutSessionsBizStatusActivityIdx: index(
      "checkout_sessions_biz_status_activity_idx",
    ).on(table.bizId, table.status, table.lastActivityAt),

    /** Owner-facing portal history path. */
    checkoutSessionsBizOwnerIdx: index("checkout_sessions_biz_owner_idx").on(
      table.bizId,
      table.ownerUserId,
      table.startedAt,
    ),

    /** Recovery chain traversal path. */
    checkoutSessionsBizRecoveredFromIdx: index(
      "checkout_sessions_biz_recovered_from_idx",
    ).on(table.bizId, table.recoveredFromCheckoutSessionId),

    /** Self-reference FK for recovered-session lineage. */
    checkoutSessionsBizRecoveredFromFk: foreignKey({
      columns: [table.bizId, table.recoveredFromCheckoutSessionId],
      foreignColumns: [table.bizId, table.id],
      name: "checkout_sessions_biz_recovered_from_fk",
    }),

    /** Tenant-safe FK to optional location scope. */
    checkoutSessionsBizLocationFk: foreignKey({
      columns: [table.bizId, table.locationId],
      foreignColumns: [locations.bizId, locations.id],
      name: "checkout_sessions_biz_location_fk",
    }),

    /** Tenant-safe FK to optional booking-order conversion. */
    checkoutSessionsBizBookingOrderFk: foreignKey({
      columns: [table.bizId, table.bookingOrderId],
      foreignColumns: [bookingOrders.bizId, bookingOrders.id],
      name: "checkout_sessions_biz_booking_order_fk",
    }),

    /**
     * Owner shape: allow guest (none), individual (user), or group account.
     * Prevent ambiguous dual ownership pointers.
     */
    checkoutSessionsOwnerShapeCheck: check(
      "checkout_sessions_owner_shape_check",
      sql`
      (
        ("owner_user_id" IS NOT NULL)::int
        + ("owner_group_account_id" IS NOT NULL)::int
      ) <= 1
      `,
    ),

    /** Currency and money arithmetic invariants. */
    checkoutSessionsMoneyCheck: check(
      "checkout_sessions_money_check",
      sql`
      "currency" ~ '^[A-Z]{3}$'
      AND "subtotal_minor" >= 0
      AND "tax_minor" >= 0
      AND "fee_minor" >= 0
      AND "discount_minor" >= 0
      AND "total_minor" >= 0
      AND "total_minor" = ("subtotal_minor" + "tax_minor" + "fee_minor" - "discount_minor")
      `,
    ),

    /** Timeline order checks. */
    checkoutSessionsTimelineCheck: check(
      "checkout_sessions_timeline_check",
      sql`
      "last_activity_at" >= "started_at"
      AND ("abandoned_at" IS NULL OR "abandoned_at" >= "started_at")
      AND ("recovered_at" IS NULL OR "recovered_at" >= "started_at")
      AND ("completed_at" IS NULL OR "completed_at" >= "started_at")
      AND ("expires_at" IS NULL OR "expires_at" >= "started_at")
      AND ("cancelled_at" IS NULL OR "cancelled_at" >= "started_at")
      `,
    ),

    /** Status-specific timestamps should exist when status implies terminal state. */
    checkoutSessionsStatusShapeCheck: check(
      "checkout_sessions_status_shape_check",
      sql`
      ("status" <> 'abandoned' OR "abandoned_at" IS NOT NULL)
      AND ("status" <> 'recovered' OR "recovered_at" IS NOT NULL)
      AND ("status" <> 'completed' OR "completed_at" IS NOT NULL)
      AND ("status" <> 'expired' OR "expires_at" IS NOT NULL)
      AND ("status" <> 'cancelled' OR "cancelled_at" IS NOT NULL)
      `,
    ),
  }),
);

/**
 * checkout_session_items
 *
 * ELI5:
 * The line items inside one checkout session.
 *
 * Supports:
 * - canonical sellable lines,
 * - ad-hoc fee lines,
 * - custom-subject lines for plugin-defined commerce surfaces.
 */
export const checkoutSessionItems = pgTable(
  "checkout_session_items",
  {
    /** Stable primary key for one checkout item row. */
    id: idWithTag("checkout_item"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent checkout session. */
    checkoutSessionId: idRef("checkout_session_id")
      .references(() => checkoutSessions.id)
      .notNull(),

    /** Item type discriminator controlling payload shape. */
    itemType: checkoutItemTypeEnum("item_type").notNull(),

    /** Optional canonical sellable pointer for sellable items. */
    sellableId: idRef("sellable_id").references(() => sellables.id),

    /** Optional custom subject namespace for custom-subject item rows. */
    customSubjectType: varchar("custom_subject_type", { length: 80 }),

    /** Optional custom subject id for custom-subject item rows. */
    customSubjectId: varchar("custom_subject_id", { length: 140 }),

    /** Frozen item display name for deterministic checkout history. */
    displayName: varchar("display_name", { length: 255 }).notNull(),

    /** Optional description snapshot at checkout time. */
    description: text("description"),

    /** Quantity selected for this item. */
    quantity: integer("quantity").default(1).notNull(),

    /** Unit price in minor units. */
    unitPriceMinor: integer("unit_price_minor").default(0).notNull(),

    /** Line subtotal in minor units. */
    lineSubtotalMinor: integer("line_subtotal_minor").default(0).notNull(),

    /** Line tax in minor units. */
    taxMinor: integer("tax_minor").default(0).notNull(),

    /** Line fee in minor units. */
    feeMinor: integer("fee_minor").default(0).notNull(),

    /** Line discount in minor units. */
    discountMinor: integer("discount_minor").default(0).notNull(),

    /** Line total in minor units. */
    totalMinor: integer("total_minor").default(0).notNull(),

    /** Line currency snapshot. */
    currency: varchar("currency", { length: 3 }).default("USD").notNull(),

    /** Optional requested start for time-based sellables. */
    requestedStartAt: timestamp("requested_start_at", { withTimezone: true }),

    /** Optional requested end for time-based sellables. */
    requestedEndAt: timestamp("requested_end_at", { withTimezone: true }),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    checkoutSessionItemsBizIdIdUnique: uniqueIndex("checkout_session_items_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Parent-session expansion path. */
    checkoutSessionItemsBizSessionIdx: index("checkout_session_items_biz_session_idx").on(
      table.bizId,
      table.checkoutSessionId,
    ),

    /** Sellable analytics path for abandoned-cart reporting. */
    checkoutSessionItemsBizSellableIdx: index("checkout_session_items_biz_sellable_idx").on(
      table.bizId,
      table.sellableId,
    ),

    /** Prevent duplicate sellable rows in one session for simpler merge logic. */
    checkoutSessionItemsSessionSellableUnique: uniqueIndex(
      "checkout_session_items_session_sellable_unique",
    )
      .on(table.checkoutSessionId, table.sellableId)
      .where(sql`"sellable_id" IS NOT NULL`),

    /** Tenant-safe FK to parent session. */
    checkoutSessionItemsBizSessionFk: foreignKey({
      columns: [table.bizId, table.checkoutSessionId],
      foreignColumns: [checkoutSessions.bizId, checkoutSessions.id],
      name: "checkout_session_items_biz_session_fk",
    }),

    /** Tenant-safe FK to optional sellable pointer. */
    checkoutSessionItemsBizSellableFk: foreignKey({
      columns: [table.bizId, table.sellableId],
      foreignColumns: [sellables.bizId, sellables.id],
      name: "checkout_session_items_biz_sellable_fk",
    }),

    /** Tenant-safe FK to optional custom subject pointer. */
    checkoutSessionItemsBizCustomSubjectFk: foreignKey({
      columns: [table.bizId, table.customSubjectType, table.customSubjectId],
      foreignColumns: [subjects.bizId, subjects.subjectType, subjects.subjectId],
      name: "checkout_session_items_biz_custom_subject_fk",
    }),

    /** Custom subject pointer should be fully null or fully populated. */
    checkoutSessionItemsCustomSubjectPairCheck: check(
      "checkout_session_items_custom_subject_pair_check",
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

    /** Quantity/money/timeline invariants. */
    checkoutSessionItemsMoneyAndTimelineCheck: check(
      "checkout_session_items_money_and_timeline_check",
      sql`
      "quantity" > 0
      AND "currency" ~ '^[A-Z]{3}$'
      AND "unit_price_minor" >= 0
      AND "line_subtotal_minor" >= 0
      AND "tax_minor" >= 0
      AND "fee_minor" >= 0
      AND "discount_minor" >= 0
      AND "total_minor" >= 0
      AND "line_subtotal_minor" = ("unit_price_minor" * "quantity")
      AND "total_minor" = ("line_subtotal_minor" + "tax_minor" + "fee_minor" - "discount_minor")
      AND (
        "requested_start_at" IS NULL
        OR "requested_end_at" IS NULL
        OR "requested_end_at" > "requested_start_at"
      )
      `,
    ),

    /**
     * Item payload shape by item type.
     *
     * - sellable: requires `sellable_id`.
     * - custom_subject: requires custom-subject pointer.
     * - custom_fee: ad-hoc line with neither pointer.
     */
    checkoutSessionItemsShapeCheck: check(
      "checkout_session_items_shape_check",
      sql`
      (
        "item_type" = 'sellable'
        AND "sellable_id" IS NOT NULL
        AND "custom_subject_type" IS NULL
        AND "custom_subject_id" IS NULL
      ) OR (
        "item_type" = 'custom_subject'
        AND "sellable_id" IS NULL
        AND "custom_subject_type" IS NOT NULL
        AND "custom_subject_id" IS NOT NULL
      ) OR (
        "item_type" = 'custom_fee'
        AND "sellable_id" IS NULL
        AND "custom_subject_type" IS NULL
        AND "custom_subject_id" IS NULL
      )
      `,
    ),
  }),
);

/**
 * checkout_session_events
 *
 * ELI5:
 * Immutable timeline for what happened during checkout.
 *
 * This drives:
 * - abandonment detection,
 * - recovery triggering,
 * - replay/debug and conversion funnel analytics.
 */
export const checkoutSessionEvents = pgTable(
  "checkout_session_events",
  {
    /** Stable primary key for one checkout event row. */
    id: idWithTag("checkout_event"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent checkout session. */
    checkoutSessionId: idRef("checkout_session_id")
      .references(() => checkoutSessions.id)
      .notNull(),

    /** Event type classification. */
    eventType: checkoutEventTypeEnum("event_type").notNull(),

    /** Event occurrence timestamp. */
    eventAt: timestamp("event_at", { withTimezone: true }).defaultNow().notNull(),

    /** Optional direct user actor pointer. */
    actorUserId: idRef("actor_user_id").references(() => users.id),

    /** Optional custom actor subject namespace for non-user actors. */
    actorSubjectType: varchar("actor_subject_type", { length: 80 }),

    /** Optional custom actor subject id for non-user actors. */
    actorSubjectId: varchar("actor_subject_id", { length: 140 }),

    /** Optional idempotency key for event writers. */
    requestKey: varchar("request_key", { length: 140 }),

    /** Structured event payload snapshot. */
    payload: jsonb("payload").default({}).notNull(),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    checkoutSessionEventsBizIdIdUnique: uniqueIndex("checkout_session_events_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Session timeline query path. */
    checkoutSessionEventsBizSessionEventIdx: index(
      "checkout_session_events_biz_session_event_idx",
    ).on(table.bizId, table.checkoutSessionId, table.eventAt),

    /** Event-type analytics path. */
    checkoutSessionEventsBizTypeEventIdx: index(
      "checkout_session_events_biz_type_event_idx",
    ).on(table.bizId, table.eventType, table.eventAt),

    /** Optional dedupe key path. */
    checkoutSessionEventsBizRequestKeyUnique: uniqueIndex(
      "checkout_session_events_biz_request_key_unique",
    )
      .on(table.bizId, table.requestKey)
      .where(sql`"request_key" IS NOT NULL`),

    /** Tenant-safe FK to parent session. */
    checkoutSessionEventsBizSessionFk: foreignKey({
      columns: [table.bizId, table.checkoutSessionId],
      foreignColumns: [checkoutSessions.bizId, checkoutSessions.id],
      name: "checkout_session_events_biz_session_fk",
    }),

    /** Tenant-safe FK to optional actor subject pointer. */
    checkoutSessionEventsBizActorSubjectFk: foreignKey({
      columns: [table.bizId, table.actorSubjectType, table.actorSubjectId],
      foreignColumns: [subjects.bizId, subjects.subjectType, subjects.subjectId],
      name: "checkout_session_events_biz_actor_subject_fk",
    }),

    /** Actor subject pointer should be fully null or fully populated. */
    checkoutSessionEventsActorSubjectPairCheck: check(
      "checkout_session_events_actor_subject_pair_check",
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
  }),
);

/**
 * checkout_recovery_links
 *
 * ELI5:
 * Controlled recovery outreach tokens/messages for abandoned sessions.
 *
 * Why separate from session table:
 * - a session can have many recovery attempts over time,
 * - each attempt needs its own expiry/status/usage audit.
 */
export const checkoutRecoveryLinks = pgTable(
  "checkout_recovery_links",
  {
    /** Stable primary key for one recovery attempt/token row. */
    id: idWithTag("checkout_recovery"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent abandoned/active checkout session. */
    checkoutSessionId: idRef("checkout_session_id")
      .references(() => checkoutSessions.id)
      .notNull(),

    /** Recovery lifecycle status. */
    status: checkoutRecoveryStatusEnum("status").default("active").notNull(),

    /** Recovery outreach channel. */
    channel: checkoutRecoveryChannelEnum("channel").notNull(),

    /** Hash of opaque recovery token (never store raw token). */
    tokenHash: varchar("token_hash", { length: 255 }).notNull(),

    /** Optional support-safe token preview (last chars). */
    tokenPreview: varchar("token_preview", { length: 40 }),

    /** Issue timestamp. */
    issuedAt: timestamp("issued_at", { withTimezone: true }).defaultNow().notNull(),

    /** Expiry timestamp. */
    expiresAt: timestamp("expires_at", { withTimezone: true }),

    /** Used timestamp when this recovery token is consumed. */
    usedAt: timestamp("used_at", { withTimezone: true }),

    /** Revoked timestamp for manual invalidation. */
    revokedAt: timestamp("revoked_at", { withTimezone: true }),

    /** Max number of times this recovery link can be used. */
    maxUseCount: integer("max_use_count").default(1).notNull(),

    /** Actual usage count so far. */
    usedCount: integer("used_count").default(0).notNull(),

    /** Optional campaign bound to this recovery attempt. */
    discountCampaignId: idRef("discount_campaign_id").references(
      () => discountCampaigns.id,
    ),

    /** Optional delivery target snapshot (email/phone/etc.). */
    deliveryTarget: varchar("delivery_target", { length: 255 }),

    /** Optional idempotency key for outreach workers. */
    requestKey: varchar("request_key", { length: 140 }),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite key for tenant-safe references. */
    checkoutRecoveryLinksBizIdIdUnique: uniqueIndex(
      "checkout_recovery_links_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** One token hash per tenant for deterministic lookup. */
    checkoutRecoveryLinksBizTokenHashUnique: uniqueIndex(
      "checkout_recovery_links_biz_token_hash_unique",
    ).on(table.bizId, table.tokenHash),

    /** Optional idempotency key dedupe path. */
    checkoutRecoveryLinksBizRequestKeyUnique: uniqueIndex(
      "checkout_recovery_links_biz_request_key_unique",
    )
      .on(table.bizId, table.requestKey)
      .where(sql`"request_key" IS NOT NULL`),

    /** Session-centric recovery history path. */
    checkoutRecoveryLinksBizSessionStatusIssuedIdx: index(
      "checkout_recovery_links_biz_session_status_issued_idx",
    ).on(table.bizId, table.checkoutSessionId, table.status, table.issuedAt),

    /** Tenant-safe FK to parent checkout session. */
    checkoutRecoveryLinksBizSessionFk: foreignKey({
      columns: [table.bizId, table.checkoutSessionId],
      foreignColumns: [checkoutSessions.bizId, checkoutSessions.id],
      name: "checkout_recovery_links_biz_session_fk",
    }),

    /** Tenant-safe FK to optional discount campaign. */
    checkoutRecoveryLinksBizDiscountCampaignFk: foreignKey({
      columns: [table.bizId, table.discountCampaignId],
      foreignColumns: [discountCampaigns.bizId, discountCampaigns.id],
      name: "checkout_recovery_links_biz_discount_campaign_fk",
    }),

    /** Usage/timeline bounds sanity checks. */
    checkoutRecoveryLinksUsageTimelineCheck: check(
      "checkout_recovery_links_usage_timeline_check",
      sql`
      "max_use_count" > 0
      AND "used_count" >= 0
      AND "used_count" <= "max_use_count"
      AND ("expires_at" IS NULL OR "expires_at" >= "issued_at")
      AND ("used_at" IS NULL OR "used_at" >= "issued_at")
      AND ("revoked_at" IS NULL OR "revoked_at" >= "issued_at")
      `,
    ),

    /** Status-specific timestamps should exist for terminal states. */
    checkoutRecoveryLinksStatusShapeCheck: check(
      "checkout_recovery_links_status_shape_check",
      sql`
      ("status" <> 'used' OR "used_at" IS NOT NULL)
      AND ("status" <> 'expired' OR "expires_at" IS NOT NULL)
      AND ("status" <> 'revoked' OR "revoked_at" IS NOT NULL)
      `,
    ),
  }),
);

export type CheckoutSession = typeof checkoutSessions.$inferSelect;
export type NewCheckoutSession = typeof checkoutSessions.$inferInsert;
export type CheckoutSessionItem = typeof checkoutSessionItems.$inferSelect;
export type NewCheckoutSessionItem = typeof checkoutSessionItems.$inferInsert;
export type CheckoutSessionEvent = typeof checkoutSessionEvents.$inferSelect;
export type NewCheckoutSessionEvent = typeof checkoutSessionEvents.$inferInsert;
export type CheckoutRecoveryLink = typeof checkoutRecoveryLinks.$inferSelect;
export type NewCheckoutRecoveryLink = typeof checkoutRecoveryLinks.$inferInsert;
