import { sql } from "drizzle-orm";
import { check, foreignKey, index, pgTable, uniqueIndex } from "drizzle-orm/pg-core";
import { boolean, jsonb, timestamp, varchar } from "drizzle-orm/pg-core";
import { idRef, idWithTag, withAuditRefs } from "./_common";
import { bizes } from "./bizes";
import {
  calendarAccessGrantStatusEnum,
  calendarAccessLevelEnum,
  calendarGrantScopeEnum,
  calendarGrantSourceTypeEnum,
  calendarSyncConnectionStatusEnum,
  calendarSyncProviderEnum,
  externalCalendarEventBusyStatusEnum,
  externalCalendarEventStatusEnum,
  externalCalendarSyncStateEnum,
} from "./enums";
import { calendarBindings } from "./time_availability";
import { users } from "./users";

/**
 * calendar_sync_connections
 *
 * ELI5:
 * This is "user connected Google/Outlook/etc account X".
 *
 * Why this table is user-owned (not biz-owned):
 * - one person can belong to multiple bizes,
 * - the person should connect their calendar once,
 * - then explicitly decide which bizes can see it using `calendar_access_grants`.
 *
 * Security note:
 * - token secrets should live in a secure vault.
 * - this table stores secret references/pointers, not plaintext tokens.
 */
export const calendarSyncConnections = pgTable(
  "calendar_sync_connections",
  {
    /** Stable primary key for one linked provider account. */
    id: idWithTag("calendar_sync_conn"),

    /** Owner user who connected this external account. */
    ownerUserId: idRef("owner_user_id")
      .references(() => users.id)
      .notNull(),

    /** Provider key (google/microsoft/apple/ical/other). */
    provider: calendarSyncProviderEnum("provider").notNull(),

    /**
     * Stable provider-side account id.
     * Example: Google account sub, Microsoft oid, or normalized feed key.
     */
    providerAccountRef: varchar("provider_account_ref", { length: 255 }).notNull(),

    /** Optional display label for account picker UIs. */
    displayName: varchar("display_name", { length: 255 }),

    /** Current auth/sync state for this account link. */
    status: calendarSyncConnectionStatusEnum("status").default("active").notNull(),

    /**
     * Secret reference used to resolve access credentials from vault.
     * Keep this as opaque reference text, not token material.
     */
    authSecretRef: varchar("auth_secret_ref", { length: 255 }).notNull(),

    /** Optional separate secret ref for refresh credential if provider requires it. */
    refreshSecretRef: varchar("refresh_secret_ref", { length: 255 }),

    /** Granted provider scopes at connection time (least-privilege auditing). */
    grantedScopes: jsonb("granted_scopes").default([]).notNull(),

    /** Optional timezone hint from provider profile/account metadata. */
    providerTimezone: varchar("provider_timezone", { length: 50 }),

    /** Cursor/token payload used for incremental sync APIs. */
    syncCursor: jsonb("sync_cursor").default({}).notNull(),

    /** Last successful full/incremental sync timestamp. */
    lastSuccessfulSyncAt: timestamp("last_successful_sync_at", { withTimezone: true }),

    /** Last failed sync timestamp for alerting and retry backoff logic. */
    lastFailedSyncAt: timestamp("last_failed_sync_at", { withTimezone: true }),

    /** Optional failure summary for operator debugging. */
    lastFailureReason: varchar("last_failure_reason", { length: 1000 }),

    /** Optional webhook/subscription reference issued by provider. */
    webhookChannelRef: varchar("webhook_channel_ref", { length: 255 }),

    /** Non-indexed extension payload. */
    metadata: jsonb("metadata").default({}).notNull(),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite unique key for tenant-safe owner+connection FKs. */
    calendarSyncConnectionsOwnerIdUnique: uniqueIndex(
      "calendar_sync_connections_owner_id_unique",
    ).on(table.ownerUserId, table.id),

    /** Avoid duplicate links of the same provider account by one user. */
    calendarSyncConnectionsOwnerProviderAccountUnique: uniqueIndex(
      "calendar_sync_connections_owner_provider_account_unique",
    ).on(table.ownerUserId, table.provider, table.providerAccountRef),

    /** Common list path for "show my connected calendar accounts". */
    calendarSyncConnectionsOwnerStatusIdx: index(
      "calendar_sync_connections_owner_status_idx",
    ).on(table.ownerUserId, table.status, table.provider),

    /** Failure timestamp should only exist when a failure reason is present. */
    calendarSyncConnectionsFailureShapeCheck: check(
      "calendar_sync_connections_failure_shape_check",
      sql`
      (
        "last_failed_sync_at" IS NULL
        AND "last_failure_reason" IS NULL
      ) OR (
        "last_failed_sync_at" IS NOT NULL
        AND "last_failure_reason" IS NOT NULL
      )
      `,
    ),
  }),
);

/**
 * external_calendars
 *
 * ELI5:
 * One connection can expose many calendars ("Work", "Personal", "Family").
 * This table stores those individual calendars.
 */
export const externalCalendars = pgTable(
  "external_calendars",
  {
    /** Stable primary key for one external calendar feed. */
    id: idWithTag("external_calendar"),

    /** Owner user (denormalized for fast ownership lookups and safe composite FKs). */
    ownerUserId: idRef("owner_user_id")
      .references(() => users.id)
      .notNull(),

    /** Parent provider account connection. */
    calendarSyncConnectionId: idRef("calendar_sync_connection_id")
      .references(() => calendarSyncConnections.id)
      .notNull(),

    /** Stable provider-side calendar id/key. */
    providerCalendarRef: varchar("provider_calendar_ref", { length: 255 }).notNull(),

    /** Human label from provider or local override. */
    name: varchar("name", { length: 255 }).notNull(),

    /** Optional freeform description from provider metadata. */
    description: varchar("description", { length: 600 }),

    /** Provider/native timezone for local-day expansion and all-day events. */
    timezone: varchar("timezone", { length: 50 }).default("UTC").notNull(),

    /** UI color token if provided by source (for calendar views). */
    color: varchar("color", { length: 32 }),

    /** Provider reports this as the account default calendar. */
    isPrimary: boolean("is_primary").default(false).notNull(),

    /**
     * User-level toggle: include this calendar in sync/conflict detection.
     * Turning this off keeps connection alive but ignores this feed.
     */
    isSelectedForSync: boolean("is_selected_for_sync").default(true).notNull(),

    /** Provider write capability hint. */
    isReadOnly: boolean("is_read_only").default(false).notNull(),

    /** Sync state of this specific feed. */
    syncState: externalCalendarSyncStateEnum("sync_state").default("pending").notNull(),

    /** Last successful sync timestamp for this feed. */
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),

    /** Last sync error timestamp for this feed. */
    lastSyncErrorAt: timestamp("last_sync_error_at", { withTimezone: true }),

    /** Optional last sync error summary for debugging. */
    lastSyncErrorReason: varchar("last_sync_error_reason", { length: 1000 }),

    /** Non-indexed extension payload. */
    metadata: jsonb("metadata").default({}).notNull(),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite unique key for owner-safe event/grant child FKs. */
    externalCalendarsOwnerIdUnique: uniqueIndex("external_calendars_owner_id_unique").on(
      table.ownerUserId,
      table.id,
    ),

    /** Prevent duplicate feed rows for one provider connection. */
    externalCalendarsConnectionProviderCalendarUnique: uniqueIndex(
      "external_calendars_connection_provider_calendar_unique",
    ).on(table.calendarSyncConnectionId, table.providerCalendarRef),

    /** Common list path for selected/active calendar feeds. */
    externalCalendarsOwnerSyncIdx: index("external_calendars_owner_sync_idx").on(
      table.ownerUserId,
      table.isSelectedForSync,
      table.syncState,
    ),

    /** Tenant-safe owner+connection integrity. */
    externalCalendarsOwnerConnectionFk: foreignKey({
      columns: [table.ownerUserId, table.calendarSyncConnectionId],
      foreignColumns: [calendarSyncConnections.ownerUserId, calendarSyncConnections.id],
      name: "external_calendars_owner_connection_fk",
    }),

    /** Sync error payload shape should be all-null or all-set. */
    externalCalendarsSyncErrorShapeCheck: check(
      "external_calendars_sync_error_shape_check",
      sql`
      (
        "last_sync_error_at" IS NULL
        AND "last_sync_error_reason" IS NULL
      ) OR (
        "last_sync_error_at" IS NOT NULL
        AND "last_sync_error_reason" IS NOT NULL
      )
      `,
    ),
  }),
);

/**
 * calendar_access_grants
 *
 * ELI5:
 * This is the consent/permission contract:
 * "User U allows Biz B to read calendar availability at level X".
 *
 * This is the core table that answers your requirement:
 * users can decide which businesses can see their calendars and how much detail.
 */
export const calendarAccessGrants = pgTable(
  "calendar_access_grants",
  {
    /** Stable primary key for one user->biz permission contract. */
    id: idWithTag("calendar_grant"),

    /** Calendar owner user granting access. */
    ownerUserId: idRef("owner_user_id")
      .references(() => users.id)
      .notNull(),

    /** Biz receiving permission to read this user's calendar availability. */
    granteeBizId: idRef("grantee_biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Lifecycle of this grant contract. */
    status: calendarAccessGrantStatusEnum("status").default("granted").notNull(),

    /** Data-detail level granted to the biz. */
    accessLevel: calendarAccessLevelEnum("access_level").default("free_busy").notNull(),

    /**
     * Scope mode for which sources are visible:
     * - all_sources: all eligible user-owned sources (internal + external)
     * - selected_sources: only rows in `calendar_access_grant_sources`
     */
    scope: calendarGrantScopeEnum("scope").default("all_sources").notNull(),

    /** Whether this biz may compute slot availability from these events. */
    allowAvailabilityComputation: boolean("allow_availability_computation")
      .default(true)
      .notNull(),

    /** Whether this biz may run conflict-check decisions against these events. */
    allowConflictDetection: boolean("allow_conflict_detection").default(true).notNull(),

    /**
     * Whether biz is allowed to write "busy hold" blocks back to provider
     * through this connection, when/if write-back is enabled in product logic.
     */
    allowWriteBackBusyBlocks: boolean("allow_write_back_busy_blocks")
      .default(false)
      .notNull(),

    /** Actor who granted this permission (usually same as owner_user_id). */
    grantedByUserId: idRef("granted_by_user_id").references(() => users.id),

    /** Business timestamp of grant decision. */
    grantedAt: timestamp("granted_at", { withTimezone: true }).defaultNow().notNull(),

    /** Revocation timestamp when status transitions to revoked. */
    revokedAt: timestamp("revoked_at", { withTimezone: true }),

    /** Optional expiration timestamp for time-boxed grants. */
    expiresAt: timestamp("expires_at", { withTimezone: true }),

    /** Optional plain-language reason/context. */
    reason: varchar("reason", { length: 1000 }),

    /** Non-indexed extension payload. */
    metadata: jsonb("metadata").default({}).notNull(),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite unique key for safe child references by owner. */
    calendarAccessGrantsOwnerIdUnique: uniqueIndex("calendar_access_grants_owner_id_unique").on(
      table.ownerUserId,
      table.id,
    ),

    /** Composite unique key for safe child references by biz scope. */
    calendarAccessGrantsBizIdUnique: uniqueIndex("calendar_access_grants_biz_id_unique").on(
      table.granteeBizId,
      table.id,
    ),

    /**
     * At most one active grant between a user and biz.
     * Historical revoked/expired rows can still exist.
     */
    calendarAccessGrantsActivePairUnique: uniqueIndex(
      "calendar_access_grants_active_pair_unique",
    )
      .on(table.ownerUserId, table.granteeBizId)
      .where(sql`"status" = 'granted' AND "deleted_at" IS NULL`),

    /** Common policy lookup path during availability resolution calls. */
    calendarAccessGrantsBizLookupIdx: index("calendar_access_grants_biz_lookup_idx").on(
      table.granteeBizId,
      table.status,
      table.accessLevel,
      table.scope,
    ),

    /** Status/timeline payload consistency. */
    calendarAccessGrantsStatusShapeCheck: check(
      "calendar_access_grants_status_shape_check",
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
      )
      `,
    ),

    /** Expiry/revocation should never happen before original grant timestamp. */
    calendarAccessGrantsTimelineCheck: check(
      "calendar_access_grants_timeline_check",
      sql`
      ("revoked_at" IS NULL OR "revoked_at" >= "granted_at")
      AND ("expires_at" IS NULL OR "expires_at" >= "granted_at")
      `,
    ),
  }),
);

/**
 * calendar_access_grant_sources
 *
 * ELI5:
 * This table is only used when grant scope is `selected_sources`.
 * Each row says one specific source is included in this user->biz grant.
 *
 * Supported source kinds:
 * - external calendar feed
 * - internal user-owned calendar binding (in any source biz)
 */
export const calendarAccessGrantSources = pgTable(
  "calendar_access_grant_sources",
  {
    /** Stable id for one selected-source row. */
    id: idWithTag("calendar_grant_source"),

    /** Owner user boundary for safe joins and ownership integrity. */
    ownerUserId: idRef("owner_user_id")
      .references(() => users.id)
      .notNull(),

    /** Grantee biz boundary for safe joins and policy lookup. */
    granteeBizId: idRef("grantee_biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent user->biz grant contract. */
    calendarAccessGrantId: idRef("calendar_access_grant_id")
      .references(() => calendarAccessGrants.id)
      .notNull(),

    /** Source discriminator for exact payload shape. */
    sourceType: calendarGrantSourceTypeEnum("source_type").notNull(),

    /**
     * External source payload:
     * when `source_type=external_calendar`, this points to one external feed.
     */
    externalCalendarId: idRef("external_calendar_id").references(() => externalCalendars.id),

    /**
     * Internal source payload (part 1):
     * source biz where the user-owned internal binding lives.
     */
    sourceBizId: idRef("source_biz_id").references(() => bizes.id),

    /**
     * Internal source payload (part 2):
     * points to one user-owned calendar binding inside `source_biz_id`.
     */
    calendarBindingId: idRef("calendar_binding_id").references(() => calendarBindings.id),

    /** Future-proof include toggle while default remains explicit-allowlist. */
    isIncluded: boolean("is_included").default(true).notNull(),

    /** Non-indexed extension payload. */
    metadata: jsonb("metadata").default({}).notNull(),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /**
     * Prevent duplicate external-calendar rows under one grant.
     * Applies only to `source_type=external_calendar`.
     */
    calendarAccessGrantSourcesUniqueExternal: uniqueIndex(
      "calendar_access_grant_sources_unique_external",
    )
      .on(table.calendarAccessGrantId, table.externalCalendarId)
      .where(sql`"source_type" = 'external_calendar' AND "deleted_at" IS NULL`),

    /**
     * Prevent duplicate internal-binding rows under one grant.
     * Applies only to `source_type=internal_user_calendar_binding`.
     */
    calendarAccessGrantSourcesUniqueInternalBinding: uniqueIndex(
      "calendar_access_grant_sources_unique_internal_binding",
    )
      .on(table.calendarAccessGrantId, table.sourceBizId, table.calendarBindingId)
      .where(
        sql`"source_type" = 'internal_user_calendar_binding' AND "deleted_at" IS NULL`,
      ),

    /** Common query path for "which sources are visible for this grant?". */
    calendarAccessGrantSourcesGrantIdx: index("calendar_access_grant_sources_grant_idx").on(
      table.calendarAccessGrantId,
      table.sourceType,
      table.isIncluded,
    ),

    /** Owner-safe FK to grant contract. */
    calendarAccessGrantSourcesOwnerGrantFk: foreignKey({
      columns: [table.ownerUserId, table.calendarAccessGrantId],
      foreignColumns: [calendarAccessGrants.ownerUserId, calendarAccessGrants.id],
      name: "calendar_access_grant_sources_owner_grant_fk",
    }),

    /** Biz-safe FK to grant contract. */
    calendarAccessGrantSourcesBizGrantFk: foreignKey({
      columns: [table.granteeBizId, table.calendarAccessGrantId],
      foreignColumns: [calendarAccessGrants.granteeBizId, calendarAccessGrants.id],
      name: "calendar_access_grant_sources_biz_grant_fk",
    }),

    /** Owner-safe FK to external calendar feed source. */
    calendarAccessGrantSourcesOwnerExternalCalendarFk: foreignKey({
      columns: [table.ownerUserId, table.externalCalendarId],
      foreignColumns: [externalCalendars.ownerUserId, externalCalendars.id],
      name: "calendar_access_grant_sources_owner_external_calendar_fk",
    }),

    /**
     * Tenant-safe FK to internal binding source.
     * Enforces the binding exists in declared `source_biz_id`.
     */
    calendarAccessGrantSourcesSourceBizBindingFk: foreignKey({
      columns: [table.sourceBizId, table.calendarBindingId],
      foreignColumns: [calendarBindings.bizId, calendarBindings.id],
      name: "calendar_access_grant_sources_source_biz_binding_fk",
    }),

    /**
     * Ownership-safe FK to internal binding source.
     * Enforces the selected internal binding belongs to the same `owner_user_id`
     * who granted access.
     */
    calendarAccessGrantSourcesOwnerBindingFk: foreignKey({
      columns: [table.sourceBizId, table.calendarBindingId, table.ownerUserId],
      foreignColumns: [
        calendarBindings.bizId,
        calendarBindings.id,
        calendarBindings.ownerUserId,
      ],
      name: "calendar_access_grant_sources_owner_binding_fk",
    }),

    /** Source payload must match `source_type` exactly. */
    calendarAccessGrantSourcesShapeCheck: check(
      "calendar_access_grant_sources_shape_check",
      sql`
      (
        "source_type" = 'external_calendar'
        AND "external_calendar_id" IS NOT NULL
        AND "source_biz_id" IS NULL
        AND "calendar_binding_id" IS NULL
      ) OR (
        "source_type" = 'internal_user_calendar_binding'
        AND "external_calendar_id" IS NULL
        AND "source_biz_id" IS NOT NULL
        AND "calendar_binding_id" IS NOT NULL
      )
      `,
    ),
  }),
);

/**
 * external_calendar_events
 *
 * ELI5:
 * Normalized copy of external events for fast conflict checks and availability.
 *
 * Privacy model:
 * - raw/full event payload lives here only once per owner.
 * - biz-facing queries must pass through `calendar_access_grants` to determine
 *   what detail level can be returned.
 */
export const externalCalendarEvents = pgTable(
  "external_calendar_events",
  {
    /** Stable primary key for one normalized external event row. */
    id: idWithTag("external_event"),

    /** Owner user boundary for access checks and tenant-safe joins. */
    ownerUserId: idRef("owner_user_id")
      .references(() => users.id)
      .notNull(),

    /** Parent external calendar feed. */
    externalCalendarId: idRef("external_calendar_id")
      .references(() => externalCalendars.id)
      .notNull(),

    /** Provider-side event id (per calendar feed). */
    providerEventRef: varchar("provider_event_ref", { length: 255 }).notNull(),

    /** Optional iCalendar UID for dedup across mirrored provider feeds. */
    iCalUid: varchar("ical_uid", { length: 255 }),

    /** Provider event lifecycle status. */
    eventStatus: externalCalendarEventStatusEnum("event_status")
      .default("confirmed")
      .notNull(),

    /** Normalized busy-state used by conflict engine. */
    busyStatus: externalCalendarEventBusyStatusEnum("busy_status")
      .default("busy")
      .notNull(),

    /** Optional title (redaction at read-time depends on grant access level). */
    title: varchar("title", { length: 500 }),

    /** Normalized absolute start timestamp of this event. */
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),

    /** Normalized absolute end timestamp of this event. */
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),

    /** True when provider marks this as all-day semantics. */
    isAllDay: boolean("is_all_day").default(false).notNull(),

    /** Provider-side event creation timestamp, if available. */
    sourceCreatedAt: timestamp("source_created_at", { withTimezone: true }),

    /** Provider-side event update timestamp, if available. */
    sourceUpdatedAt: timestamp("source_updated_at", { withTimezone: true }),

    /** Last timestamp this row was confirmed/present in provider sync. */
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
      .defaultNow()
      .notNull(),

    /** Normalized provider payload snapshot used by sync engine/debug tooling. */
    payload: jsonb("payload").default({}).notNull(),

    /** Non-indexed extension payload. */
    metadata: jsonb("metadata").default({}).notNull(),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite unique key for owner-safe link table FKs. */
    externalCalendarEventsOwnerIdUnique: uniqueIndex(
      "external_calendar_events_owner_id_unique",
    ).on(table.ownerUserId, table.id),

    /** Prevent duplicate event rows for one feed. */
    externalCalendarEventsFeedProviderRefUnique: uniqueIndex(
      "external_calendar_events_feed_provider_ref_unique",
    ).on(table.externalCalendarId, table.providerEventRef),

    /** Fast path for event-window conflict scans. */
    externalCalendarEventsOwnerWindowIdx: index("external_calendar_events_owner_window_idx").on(
      table.ownerUserId,
      table.startsAt,
      table.endsAt,
      table.busyStatus,
    ),

    /** Owner-safe FK to external calendar feed. */
    externalCalendarEventsOwnerExternalCalendarFk: foreignKey({
      columns: [table.ownerUserId, table.externalCalendarId],
      foreignColumns: [externalCalendars.ownerUserId, externalCalendars.id],
      name: "external_calendar_events_owner_external_calendar_fk",
    }),

    /** End must be strictly after start for deterministic slot overlap logic. */
    externalCalendarEventsWindowCheck: check(
      "external_calendar_events_window_check",
      sql`"ends_at" > "starts_at"`,
    ),

    /** Source updated timestamp cannot be before source created timestamp. */
    externalCalendarEventsSourceTimelineCheck: check(
      "external_calendar_events_source_timeline_check",
      sql`"source_created_at" IS NULL OR "source_updated_at" IS NULL OR "source_updated_at" >= "source_created_at"`,
    ),
  }),
);

export type CalendarSyncConnection = typeof calendarSyncConnections.$inferSelect;
export type NewCalendarSyncConnection = typeof calendarSyncConnections.$inferInsert;

export type ExternalCalendar = typeof externalCalendars.$inferSelect;
export type NewExternalCalendar = typeof externalCalendars.$inferInsert;

export type CalendarAccessGrant = typeof calendarAccessGrants.$inferSelect;
export type NewCalendarAccessGrant = typeof calendarAccessGrants.$inferInsert;

export type CalendarAccessGrantSource = typeof calendarAccessGrantSources.$inferSelect;
export type NewCalendarAccessGrantSource = typeof calendarAccessGrantSources.$inferInsert;

export type ExternalCalendarEvent = typeof externalCalendarEvents.$inferSelect;
export type NewExternalCalendarEvent = typeof externalCalendarEvents.$inferInsert;
