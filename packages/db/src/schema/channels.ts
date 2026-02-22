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
import { users } from "./users";
import { bookingOrders } from "./fulfillment";
import {
  channelConnectionStatusEnum,
  channelObjectTypeEnum,
  channelProviderEnum,
  channelSyncDirectionEnum,
  channelSyncItemStatusEnum,
  channelSyncJobStatusEnum,
  channelWebhookStatusEnum,
} from "./enums";
import { offerVersions } from "./offers";

/**
 * channel_accounts
 *
 * ELI5:
 * One row is one connected external channel account, like:
 * - Google Reserve profile
 * - ClassPass partner account
 * - Instagram/Facebook booking account
 */
export const channelAccounts = pgTable(
  "channel_accounts",
  {
    /** Stable primary key. */
    id: idWithTag("channel_account"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** External channel provider. */
    provider: channelProviderEnum("provider").notNull(),

    /** Human account label in admin UI. */
    name: varchar("name", { length: 180 }).notNull(),

    /** Connection lifecycle/health state. */
    status: channelConnectionStatusEnum("status").default("active").notNull(),

    /** External account id from provider API. */
    providerAccountRef: varchar("provider_account_ref", { length: 200 }),

    /** Authorized scopes/capabilities. */
    scopes: jsonb("scopes").default([]).notNull(),

    /** Encrypted auth payload reference or token metadata envelope. */
    authConfig: jsonb("auth_config").default({}).notNull(),

    /** Last successful sync timestamp for quick health checks. */
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),

    /** Latest sync/webhook error summary. */
    lastError: varchar("last_error", { length: 600 }),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    channelAccountsBizIdIdUnique: uniqueIndex("channel_accounts_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Composite unique key for tenant-safe child tables. */

    /** Prevent duplicate provider account refs in one tenant when available. */
    channelAccountsProviderAccountUnique: uniqueIndex(
      "channel_accounts_provider_account_unique",
    )
      .on(table.bizId, table.provider, table.providerAccountRef)
      .where(sql`"provider_account_ref" IS NOT NULL`),

    /** Common operations listing path. */
    channelAccountsBizProviderStatusIdx: index(
      "channel_accounts_biz_provider_status_idx",
    ).on(table.bizId, table.provider, table.status),
  }),
);

/**
 * channel_sync_states
 *
 * ELI5:
 * Stores incremental sync cursors/checkpoints per account+object type.
 */
export const channelSyncStates = pgTable(
  "channel_sync_states",
  {
    /** Stable primary key. */
    id: idWithTag("channel_sync_state"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Channel account scope. */
    channelAccountId: idRef("channel_account_id")
      .references(() => channelAccounts.id)
      .notNull(),

    /** Object type being synchronized. */
    objectType: channelObjectTypeEnum("object_type").notNull(),

    /** Sync direction mode for this state row. */
    direction: channelSyncDirectionEnum("direction").notNull(),

    /** Last successful inbound cursor/token/checkpoint. */
    inboundCursor: varchar("inbound_cursor", { length: 500 }),

    /** Last successful outbound cursor/token/checkpoint. */
    outboundCursor: varchar("outbound_cursor", { length: 500 }),

    /** Last sync attempt time. */
    lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }),

    /** Last successful sync time. */
    lastSuccessAt: timestamp("last_success_at", { withTimezone: true }),

    /** Last failure summary for this state row. */
    lastFailure: varchar("last_failure", { length: 600 }),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    channelSyncStatesBizIdIdUnique: uniqueIndex("channel_sync_states_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** One state row per account+type+direction. */
    channelSyncStatesUnique: uniqueIndex("channel_sync_states_unique").on(
      table.channelAccountId,
      table.objectType,
      table.direction,
    ),

    /** Common operational listing path. */
    channelSyncStatesBizAccountTypeIdx: index(
      "channel_sync_states_biz_account_type_idx",
    ).on(table.bizId, table.channelAccountId, table.objectType),

    /** Tenant-safe FK to channel account. */
    channelSyncStatesBizAccountFk: foreignKey({
      columns: [table.bizId, table.channelAccountId],
      foreignColumns: [channelAccounts.bizId, channelAccounts.id],
      name: "channel_sync_states_biz_account_fk",
    }),
  }),
);

/**
 * channel_entity_links
 *
 * ELI5:
 * This is the external-ID mapping table.
 * It links a local entity to its provider-side id.
 */
export const channelEntityLinks = pgTable(
  "channel_entity_links",
  {
    /** Stable primary key. */
    id: idWithTag("channel_link"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Channel account where this mapping exists. */
    channelAccountId: idRef("channel_account_id")
      .references(() => channelAccounts.id)
      .notNull(),

    /** Mapped entity type. */
    objectType: channelObjectTypeEnum("object_type").notNull(),

    /** Local payload for offer_version. */
    offerVersionId: idRef("offer_version_id").references(() => offerVersions.id),

    /** Local payload for booking_order. */
    bookingOrderId: idRef("booking_order_id").references(() => bookingOrders.id),

    /** Local payload for resource. */
    resourceId: idRef("resource_id").references(() => resources.id),

    /** Local payload for customer. */
    customerUserId: idRef("customer_user_id").references(() => users.id),

    /** Generic local key for availability/class_session/custom mapping. */
    localReferenceKey: varchar("local_reference_key", { length: 200 }),

    /** Provider-side object id. */
    externalObjectId: varchar("external_object_id", { length: 200 }).notNull(),

    /** Optional provider-side parent object id. */
    externalParentId: varchar("external_parent_id", { length: 200 }),

    /** Last known sync hash/version to avoid unnecessary writes. */
    syncHash: varchar("sync_hash", { length: 140 }),

    /** Active toggle. */
    isActive: boolean("is_active").default(true).notNull(),

    /** Last successful sync timestamp for this mapped object. */
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite unique key used by job item refs. */
    channelEntityLinksBizIdIdUnique: uniqueIndex(
      "channel_entity_links_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** External object id must be unique per channel account. */
    channelEntityLinksExternalUnique: uniqueIndex(
      "channel_entity_links_external_unique",
    ).on(table.channelAccountId, table.externalObjectId),

    /** Prevent duplicate local mapping per account+type+payload. */
    channelEntityLinksLocalOfferVersionUnique: uniqueIndex(
      "channel_entity_links_local_offer_version_unique",
    )
      .on(table.channelAccountId, table.objectType, table.offerVersionId)
      .where(sql`"offer_version_id" IS NOT NULL`),
    channelEntityLinksLocalBookingOrderUnique: uniqueIndex(
      "channel_entity_links_local_booking_order_unique",
    )
      .on(table.channelAccountId, table.objectType, table.bookingOrderId)
      .where(sql`"booking_order_id" IS NOT NULL`),
    channelEntityLinksLocalResourceUnique: uniqueIndex(
      "channel_entity_links_local_resource_unique",
    )
      .on(table.channelAccountId, table.objectType, table.resourceId)
      .where(sql`"resource_id" IS NOT NULL`),
    channelEntityLinksLocalCustomerUnique: uniqueIndex(
      "channel_entity_links_local_customer_unique",
    )
      .on(table.channelAccountId, table.objectType, table.customerUserId)
      .where(sql`"customer_user_id" IS NOT NULL`),
    channelEntityLinksLocalRefKeyUnique: uniqueIndex(
      "channel_entity_links_local_ref_key_unique",
    )
      .on(table.channelAccountId, table.objectType, table.localReferenceKey)
      .where(sql`"local_reference_key" IS NOT NULL`),

    /** Common lookup path by account+type. */
    channelEntityLinksBizAccountTypeIdx: index(
      "channel_entity_links_biz_account_type_idx",
    ).on(table.bizId, table.channelAccountId, table.objectType),

    /** Tenant-safe FK to channel account. */
    channelEntityLinksBizAccountFk: foreignKey({
      columns: [table.bizId, table.channelAccountId],
      foreignColumns: [channelAccounts.bizId, channelAccounts.id],
      name: "channel_entity_links_biz_account_fk",
    }),

    /** Tenant-safe FK to offer version. */
    channelEntityLinksBizOfferVersionFk: foreignKey({
      columns: [table.bizId, table.offerVersionId],
      foreignColumns: [offerVersions.bizId, offerVersions.id],
      name: "channel_entity_links_biz_offer_version_fk",
    }),

    /** Tenant-safe FK to booking order. */
    channelEntityLinksBizBookingOrderFk: foreignKey({
      columns: [table.bizId, table.bookingOrderId],
      foreignColumns: [bookingOrders.bizId, bookingOrders.id],
      name: "channel_entity_links_biz_booking_order_fk",
    }),

    /** Tenant-safe FK to resource. */
    channelEntityLinksBizResourceFk: foreignKey({
      columns: [table.bizId, table.resourceId],
      foreignColumns: [resources.bizId, resources.id],
      name: "channel_entity_links_biz_resource_fk",
    }),

    /** Object payload shape check by type. */
    channelEntityLinksShapeCheck: check(
      "channel_entity_links_shape_check",
      sql`
      (
        "object_type" = 'offer_version'
        AND "offer_version_id" IS NOT NULL
        AND "booking_order_id" IS NULL
        AND "resource_id" IS NULL
        AND "customer_user_id" IS NULL
      ) OR (
        "object_type" = 'booking_order'
        AND "offer_version_id" IS NULL
        AND "booking_order_id" IS NOT NULL
        AND "resource_id" IS NULL
        AND "customer_user_id" IS NULL
      ) OR (
        "object_type" = 'resource'
        AND "offer_version_id" IS NULL
        AND "booking_order_id" IS NULL
        AND "resource_id" IS NOT NULL
        AND "customer_user_id" IS NULL
      ) OR (
        "object_type" = 'customer'
        AND "offer_version_id" IS NULL
        AND "booking_order_id" IS NULL
        AND "resource_id" IS NULL
        AND "customer_user_id" IS NOT NULL
      ) OR (
        "object_type" IN ('availability', 'class_session', 'custom')
        AND "offer_version_id" IS NULL
        AND "booking_order_id" IS NULL
        AND "resource_id" IS NULL
        AND "customer_user_id" IS NULL
        AND "local_reference_key" IS NOT NULL
      )
      `,
    ),
  }),
);

/**
 * channel_sync_jobs
 *
 * ELI5:
 * Sync job = one execution batch to push/pull data between Bizing and channel.
 */
export const channelSyncJobs = pgTable(
  "channel_sync_jobs",
  {
    /** Stable primary key. */
    id: idWithTag("channel_sync_job"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Channel account this job belongs to. */
    channelAccountId: idRef("channel_account_id")
      .references(() => channelAccounts.id)
      .notNull(),

    /** Sync direction. */
    direction: channelSyncDirectionEnum("direction").notNull(),

    /** Object type being synced. */
    objectType: channelObjectTypeEnum("object_type").notNull(),

    /** Job lifecycle status. */
    status: channelSyncJobStatusEnum("status").default("queued").notNull(),

    /** Requested/queued time. */
    requestedAt: timestamp("requested_at", { withTimezone: true }).defaultNow().notNull(),

    /** Job start time. */
    startedAt: timestamp("started_at", { withTimezone: true }),

    /** Job completion time. */
    completedAt: timestamp("completed_at", { withTimezone: true }),

    /** Cursor/checkpoint snapshot used to start this run. */
    cursorSnapshot: jsonb("cursor_snapshot").default({}),

    /** Optional count of processed items. */
    processedCount: integer("processed_count").default(0).notNull(),

    /** Optional count of failed items. */
    failedCount: integer("failed_count").default(0).notNull(),

    /** Human/system summary of final result. */
    summary: varchar("summary", { length: 800 }),

    /** Optional error details payload. */
    errorPayload: jsonb("error_payload").default({}),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    channelSyncJobsBizIdIdUnique: uniqueIndex("channel_sync_jobs_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Composite unique key for tenant-safe sync item rows. */

    /** Common queue monitor path. */
    channelSyncJobsBizStatusRequestedIdx: index(
      "channel_sync_jobs_biz_status_requested_idx",
    ).on(table.bizId, table.status, table.requestedAt),

    /** Tenant-safe FK to channel account. */
    channelSyncJobsBizAccountFk: foreignKey({
      columns: [table.bizId, table.channelAccountId],
      foreignColumns: [channelAccounts.bizId, channelAccounts.id],
      name: "channel_sync_jobs_biz_account_fk",
    }),

    /** Processing counters must be non-negative. */
    channelSyncJobsCountersCheck: check(
      "channel_sync_jobs_counters_check",
      sql`"processed_count" >= 0 AND "failed_count" >= 0`,
    ),

    /** Start/complete timeline must be ordered. */
    channelSyncJobsTimelineCheck: check(
      "channel_sync_jobs_timeline_check",
      sql`"started_at" IS NULL OR "completed_at" IS NULL OR "completed_at" >= "started_at"`,
    ),
  }),
);

/**
 * channel_sync_items
 *
 * ELI5:
 * Row-level execution log per object inside one sync job.
 */
export const channelSyncItems = pgTable(
  "channel_sync_items",
  {
    /** Stable primary key. */
    id: idWithTag("channel_sync_item"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent sync job. */
    channelSyncJobId: idRef("channel_sync_job_id")
      .references(() => channelSyncJobs.id)
      .notNull(),

    /** Optional mapped entity link. */
    channelEntityLinkId: idRef("channel_entity_link_id").references(
      () => channelEntityLinks.id,
    ),

    /** Object type for this line. */
    objectType: channelObjectTypeEnum("object_type").notNull(),

    /** Optional local reference key for non-FK object types. */
    localReferenceKey: varchar("local_reference_key", { length: 200 }),

    /** Optional provider-side object id. */
    externalObjectId: varchar("external_object_id", { length: 200 }),

    /** Item processing status. */
    status: channelSyncItemStatusEnum("status").default("pending").notNull(),

    /** Optional failure reason. */
    errorMessage: varchar("error_message", { length: 600 }),

    /** Processing timestamp. */
    processedAt: timestamp("processed_at", { withTimezone: true }),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    channelSyncItemsBizIdIdUnique: uniqueIndex("channel_sync_items_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Common job detail path. */
    channelSyncItemsBizJobStatusIdx: index("channel_sync_items_biz_job_status_idx").on(
      table.bizId,
      table.channelSyncJobId,
      table.status,
    ),

    /** Tenant-safe FK to job. */
    channelSyncItemsBizJobFk: foreignKey({
      columns: [table.bizId, table.channelSyncJobId],
      foreignColumns: [channelSyncJobs.bizId, channelSyncJobs.id],
      name: "channel_sync_items_biz_job_fk",
    }),

    /** Tenant-safe FK to entity link. */
    channelSyncItemsBizEntityLinkFk: foreignKey({
      columns: [table.bizId, table.channelEntityLinkId],
      foreignColumns: [channelEntityLinks.bizId, channelEntityLinks.id],
      name: "channel_sync_items_biz_entity_link_fk",
    }),
  }),
);

/**
 * channel_webhook_events
 *
 * ELI5:
 * Append-style inbox of external webhook events for deterministic processing.
 */
export const channelWebhookEvents = pgTable(
  "channel_webhook_events",
  {
    /** Stable primary key. */
    id: idWithTag("channel_webhook"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Channel account that received this event. */
    channelAccountId: idRef("channel_account_id")
      .references(() => channelAccounts.id)
      .notNull(),

    /** Processing status. */
    status: channelWebhookStatusEnum("status").default("received").notNull(),

    /** Provider event type/topic name. */
    eventType: varchar("event_type", { length: 140 }).notNull(),

    /** Provider event id for dedupe/idempotency. */
    externalEventId: varchar("external_event_id", { length: 200 }).notNull(),

    /** Raw receive timestamp. */
    receivedAt: timestamp("received_at", { withTimezone: true }).defaultNow().notNull(),

    /** Final processing timestamp. */
    processedAt: timestamp("processed_at", { withTimezone: true }),

    /** Retry count for resilient processing workers. */
    retryCount: integer("retry_count").default(0).notNull(),

    /** Last processing error message if any. */
    errorMessage: varchar("error_message", { length: 600 }),

    /** Raw webhook payload. */
    payload: jsonb("payload").default({}).notNull(),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    channelWebhookEventsBizIdIdUnique: uniqueIndex("channel_webhook_events_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Ensure provider event id is unique per account. */
    channelWebhookEventsAccountExternalUnique: uniqueIndex(
      "channel_webhook_events_account_external_unique",
    ).on(table.channelAccountId, table.externalEventId),

    /** Common webhook inbox query path. */
    channelWebhookEventsBizStatusReceivedIdx: index(
      "channel_webhook_events_biz_status_received_idx",
    ).on(table.bizId, table.status, table.receivedAt),

    /** Tenant-safe FK to channel account. */
    channelWebhookEventsBizAccountFk: foreignKey({
      columns: [table.bizId, table.channelAccountId],
      foreignColumns: [channelAccounts.bizId, channelAccounts.id],
      name: "channel_webhook_events_biz_account_fk",
    }),

    /** Retry count must be non-negative. */
    channelWebhookEventsRetryCheck: check(
      "channel_webhook_events_retry_check",
      sql`"retry_count" >= 0`,
    ),
  }),
);
