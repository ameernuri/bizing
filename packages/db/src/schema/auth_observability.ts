import { sql } from "drizzle-orm";
import { check, index, pgTable, uniqueIndex } from "drizzle-orm/pg-core";
import { boolean, integer, jsonb, timestamp, varchar } from "drizzle-orm/pg-core";
import { idRef, idWithTag, withAuditRefs } from "./_common";
import { bizes } from "./bizes";
import { users } from "./users";
import { apiAccessTokens, apiCredentials } from "./api_credentials";

/**
 * auth_principals
 *
 * ELI5:
 * A principal is "who is acting" in auth terms.
 *
 * Why this table exists:
 * - `users` alone is not enough for machine auth because API keys/tokens are
 *   also first-class actors.
 * - A single normalized principal row lets us reason about activity across:
 *   - browser sessions,
 *   - API keys,
 *   - short-lived bearer tokens,
 *   - system/service actors.
 *
 * Design choice:
 * - `principal_key` is deterministic and unique, so callers can upsert
 *   principals cheaply without race-prone lookup chains.
 */
export const authPrincipals = pgTable(
  "auth_principals",
  {
    /** Stable primary key for one principal row. */
    id: idWithTag("auth_principal"),

    /**
     * Deterministic identity key.
     *
     * Examples:
     * - `session:<session-id>`
     * - `api_credential:<credential-id>`
     * - `api_access_token:<token-id>`
     * - `system:<external-ref>`
     */
    principalKey: varchar("principal_key", { length: 320 }).notNull(),

    /** Tenant anchor when principal is scoped to one biz. */
    bizId: idRef("biz_id").references(() => bizes.id),

    /** Human owner for session/user-bound principals. */
    ownerUserId: idRef("owner_user_id").references(() => users.id),

    /**
     * Principal type classification.
     *
     * Values:
     * - `session_user`
     * - `api_credential`
     * - `api_access_token`
     * - `system_actor`
     */
    principalType: varchar("principal_type", { length: 40 }).notNull(),

    /**
     * Default auth source used by this principal.
     *
     * Values:
     * - `session`
     * - `api_key`
     * - `access_token`
     * - `system`
     */
    authSource: varchar("auth_source", { length: 30 }).notNull(),

    /** Optional API credential pointer when principal is key-based. */
    apiCredentialId: idRef("api_credential_id").references(() => apiCredentials.id),

    /** Optional short-lived token pointer when principal is token-based. */
    apiAccessTokenId: idRef("api_access_token_id").references(() => apiAccessTokens.id),

    /** Optional external subject ref (session id, service account id, etc.). */
    externalSubjectRef: varchar("external_subject_ref", { length: 320 }),

    /** UI-friendly label to help ops understand what this principal is. */
    displayLabel: varchar("display_label", { length: 220 }),

    /**
     * Principal lifecycle.
     *
     * Values:
     * - `active`
     * - `inactive`
     * - `revoked`
     * - `expired`
     */
    status: varchar("status", { length: 30 }).default("active").notNull(),

    /** Whether principal is currently allowed to authenticate. */
    isAuthenticatable: boolean("is_authenticatable").default(true).notNull(),

    /** Last successful authentication timestamp. */
    lastAuthenticatedAt: timestamp("last_authenticated_at", { withTimezone: true }),

    /** Last seen request timestamp (success or failure). */
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),

    /** Optional hard expiry for principal validity. */
    expiresAt: timestamp("expires_at", { withTimezone: true }),

    /** Extensible metadata for auth policy and operational context. */
    metadata: jsonb("metadata").default({}).notNull(),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    authPrincipalsPrincipalKeyUnique: uniqueIndex("auth_principals_principal_key_unique").on(
      table.principalKey,
    ),
    authPrincipalsBizTypeStatusIdx: index("auth_principals_biz_type_status_idx").on(
      table.bizId,
      table.principalType,
      table.status,
    ),
    authPrincipalsOwnerStatusIdx: index("auth_principals_owner_status_idx").on(
      table.ownerUserId,
      table.status,
      table.lastAuthenticatedAt,
    ),
    authPrincipalsCredentialIdx: index("auth_principals_credential_idx").on(
      table.apiCredentialId,
      table.apiAccessTokenId,
    ),
    authPrincipalsTypeCheck: check(
      "auth_principals_type_check",
      sql`"principal_type" IN ('session_user', 'api_credential', 'api_access_token', 'system_actor')`,
    ),
    authPrincipalsSourceCheck: check(
      "auth_principals_source_check",
      sql`"auth_source" IN ('session', 'api_key', 'access_token', 'system')`,
    ),
    authPrincipalsStatusCheck: check(
      "auth_principals_status_check",
      sql`"status" IN ('active', 'inactive', 'revoked', 'expired')`,
    ),
    /**
     * Enforce predictable shape so principal rows remain unambiguous.
     */
    authPrincipalsShapeCheck: check(
      "auth_principals_shape_check",
      sql`
      (
        "principal_type" = 'session_user'
        AND "owner_user_id" IS NOT NULL
        AND "api_credential_id" IS NULL
        AND "api_access_token_id" IS NULL
      ) OR (
        "principal_type" = 'api_credential'
        AND "api_credential_id" IS NOT NULL
      ) OR (
        "principal_type" = 'api_access_token'
        AND "api_access_token_id" IS NOT NULL
      ) OR (
        "principal_type" = 'system_actor'
      )
      `,
    ),
    authPrincipalsTimelineCheck: check(
      "auth_principals_timeline_check",
      sql`("expires_at" IS NULL OR "expires_at" > "created_at")`,
    ),
  }),
);

/**
 * auth_access_events
 *
 * ELI5:
 * One row = one auth-related decision/event observed by the API.
 *
 * Why separate from generic `audit_events`:
 * - auth needs high-cardinality operational queries (by source/decision/path),
 * - auth events often happen before entity/business context is known,
 * - this table is optimized for auth telemetry + incident response.
 *
 * How it fits with the bigger picture:
 * - `auth_principals` tells us WHO the actor identity is.
 * - `auth_access_events` tells us WHAT happened for each auth check/action.
 * - `audit_events` remains the immutable domain-event chain for business data.
 */
export const authAccessEvents = pgTable(
  "auth_access_events",
  {
    /** Stable primary key for one auth event. */
    id: idWithTag("auth_access_event"),

    /** Optional tenant boundary when resolved at event time. */
    bizId: idRef("biz_id").references(() => bizes.id),

    /**
     * Optional normalized principal pointer.
     *
     * Nullable so we can still capture denied attempts before principal resolve.
     */
    authPrincipalId: idRef("auth_principal_id").references(() => authPrincipals.id),

    /** Snapshot of user id known at event time (if any). */
    ownerUserId: idRef("owner_user_id").references(() => users.id),

    /** Snapshot of credential context (if any). */
    apiCredentialId: idRef("api_credential_id").references(() => apiCredentials.id),

    /** Snapshot of access-token context (if any). */
    apiAccessTokenId: idRef("api_access_token_id").references(() => apiAccessTokens.id),

    /**
     * Auth source for this event.
     *
     * Values:
     * - `session`
     * - `api_key`
     * - `access_token`
     * - `system`
     * - `unknown`
     */
    authSource: varchar("auth_source", { length: 30 }).default("unknown").notNull(),

    /**
     * Event type key.
     *
     * Examples:
     * - `auth_check`
     * - `api_key_created`
     * - `api_key_rotated`
     * - `api_key_revoked`
     * - `access_token_issued`
     * - `access_token_revoked`
     */
    eventType: varchar("event_type", { length: 80 }).notNull(),

    /**
     * Decision outcome.
     *
     * Values:
     * - `allowed`
     * - `denied`
     * - `issued`
     * - `revoked`
     * - `error`
     */
    decision: varchar("decision", { length: 20 }).notNull(),

    /** Optional machine-readable reason code. */
    reasonCode: varchar("reason_code", { length: 120 }),

    /** Optional human-readable reason message. */
    reasonMessage: varchar("reason_message", { length: 1200 }),

    /** HTTP method observed at event time (if request-bound). */
    httpMethod: varchar("http_method", { length: 12 }),

    /** HTTP route/path observed at event time (if request-bound). */
    httpPath: varchar("http_path", { length: 500 }),

    /** Optional HTTP response status code. */
    httpStatus: integer("http_status"),

    /** Request correlation id for end-to-end tracing. */
    requestId: varchar("request_id", { length: 120 }),

    /** Optional IP snapshot. */
    sourceIp: varchar("source_ip", { length: 80 }),

    /** Optional user-agent snapshot. */
    userAgent: varchar("user_agent", { length: 500 }),

    /**
     * Non-sensitive principal hint when principal is unresolved.
     *
     * Example:
     * - hashed key prefix,
     * - session id hash fragment.
     */
    principalHint: varchar("principal_hint", { length: 220 }),

    /** Exact occurrence timestamp for this auth event. */
    occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),

    /** Extensible details payload. */
    eventData: jsonb("event_data").default({}).notNull(),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    authAccessEventsBizOccurredIdx: index("auth_access_events_biz_occurred_idx").on(
      table.bizId,
      table.occurredAt,
    ),
    authAccessEventsPrincipalOccurredIdx: index("auth_access_events_principal_occurred_idx").on(
      table.authPrincipalId,
      table.occurredAt,
    ),
    authAccessEventsSourceDecisionOccurredIdx: index(
      "auth_access_events_source_decision_occurred_idx",
    ).on(table.authSource, table.decision, table.occurredAt),
    authAccessEventsTypeOccurredIdx: index("auth_access_events_type_occurred_idx").on(
      table.eventType,
      table.occurredAt,
    ),
    authAccessEventsRequestIdIdx: index("auth_access_events_request_id_idx").on(table.requestId),
    authAccessEventsDecisionCheck: check(
      "auth_access_events_decision_check",
      sql`"decision" IN ('allowed', 'denied', 'issued', 'revoked', 'error')`,
    ),
    authAccessEventsSourceCheck: check(
      "auth_access_events_source_check",
      sql`"auth_source" IN ('session', 'api_key', 'access_token', 'system', 'unknown')`,
    ),
    authAccessEventsHttpStatusCheck: check(
      "auth_access_events_http_status_check",
      sql`("http_status" IS NULL OR ("http_status" >= 100 AND "http_status" <= 599))`,
    ),
  }),
);

