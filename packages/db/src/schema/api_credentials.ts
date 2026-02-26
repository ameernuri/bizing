import { sql } from "drizzle-orm";
import { check, foreignKey, index, pgTable, uniqueIndex } from "drizzle-orm/pg-core";
import { boolean, jsonb, timestamp, varchar } from "drizzle-orm/pg-core";
import { bizes } from "./bizes";
import { idRef, idWithTag, withAuditRefs } from "./_common";
import { users } from "./users";

/**
 * api_credentials
 *
 * ELI5:
 * This table stores long-lived "machine login keys" (API keys).
 *
 * Why this exists:
 * - Browser users log in with Better Auth sessions (cookies).
 * - Bots/agents/integrations usually cannot use browser cookies.
 * - API keys are a safe machine identity anchor that we can rotate/revoke.
 *
 * Security model:
 * - We NEVER store raw API key text.
 * - We store only a hash (`key_hash`) + tiny preview (`key_preview`) for UI.
 * - Raw key is shown once at creation time, then it is gone forever.
 */
export const apiCredentials = pgTable(
  "api_credentials",
  {
    /** Stable primary key for one API credential row. */
    id: idWithTag("api_credential"),

    /** Human user who owns/manages this credential. */
    ownerUserId: idRef("owner_user_id")
      .references(() => users.id)
      .notNull(),

    /**
     * Optional biz scope anchor.
     *
     * If set, this key is intended for one tenant context by default.
     * If null, the key can still be used across memberships of the owner.
     */
    bizId: idRef("biz_id").references(() => bizes.id),

    /** Friendly label shown in credential management UI. */
    label: varchar("label", { length: 180 }).notNull(),

    /** Optional longer description/help text for operators. */
    description: varchar("description", { length: 1000 }),

    /**
     * Hash of the raw key material.
     *
     * Important:
     * - this is the lookup key used for auth verification,
     * - unique so we can deterministically resolve exactly one credential.
     */
    keyHash: varchar("key_hash", { length: 128 }).notNull(),

    /**
     * Small non-sensitive preview for support screens.
     * Example: `...8fd2`.
     */
    keyPreview: varchar("key_preview", { length: 32 }).notNull(),

    /**
     * Scope allow-list for this key.
     *
     * Convention:
     * - `*` means all scopes,
     * - `offers.*` means any permission key prefixed with `offers.`,
     * - `offers.read` means one exact permission key.
     */
    scopes: jsonb("scopes").default(["*"]).notNull(),

    /**
     * If false, this key cannot call business endpoints directly.
     *
     * Intended flow when false:
     * - key can be used to exchange for short-lived access token,
     * - short-lived token is then used for API calls.
     */
    allowDirectApiKeyAuth: boolean("allow_direct_api_key_auth").default(false).notNull(),

    /**
     * Credential lifecycle status.
     *
     * Values:
     * - `active`
     * - `revoked`
     * - `expired`
     */
    status: varchar("status", { length: 60 }).default("active").notNull(),

    /** Last successful auth usage timestamp. */
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),

    /** Optional hard expiry for this credential. */
    expiresAt: timestamp("expires_at", { withTimezone: true }),

    /** Revocation timestamp when status transitions to revoked. */
    revokedAt: timestamp("revoked_at", { withTimezone: true }),

    /** Optional operator note for why key was revoked. */
    revokedReason: varchar("revoked_reason", { length: 500 }),

    /** Extension payload for future auth policy knobs. */
    metadata: jsonb("metadata").default({}).notNull(),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite key used by tenant-safe child FKs. */
    apiCredentialsBizIdIdUnique: uniqueIndex("api_credentials_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),

    /** Fast deterministic lookup during API key verification. */
    apiCredentialsKeyHashUnique: uniqueIndex("api_credentials_key_hash_unique").on(table.keyHash),

    /** Listing path for one owner's credentials dashboard. */
    apiCredentialsOwnerStatusIdx: index("api_credentials_owner_status_idx").on(
      table.ownerUserId,
      table.status,
      table.lastUsedAt,
    ),

    /** Listing path for tenant-scoped credential governance. */
    apiCredentialsBizStatusIdx: index("api_credentials_biz_status_idx").on(
      table.bizId,
      table.status,
      table.lastUsedAt,
    ),

    /** Keep status vocabulary explicit and extensible. */
    apiCredentialsStatusCheck: check(
      "api_credentials_status_check",
      sql`
      "status" IN ('active', 'revoked', 'expired')
      OR "status" LIKE 'custom_%'
      `,
    ),

    /** Timeline sanity constraints. */
    apiCredentialsTimelineCheck: check(
      "api_credentials_timeline_check",
      sql`
      ("expires_at" IS NULL OR "expires_at" > "created_at")
      AND ("revoked_at" IS NULL OR "revoked_at" >= "created_at")
      `,
    ),

    /** Status must align with revocation fields. */
    apiCredentialsRevocationShapeCheck: check(
      "api_credentials_revocation_shape_check",
      sql`
      (
        "status" = 'active'
        AND "revoked_at" IS NULL
      ) OR (
        "status" = 'revoked'
        AND "revoked_at" IS NOT NULL
      ) OR (
        "status" = 'expired'
      ) OR (
        "status" LIKE 'custom_%'
      )
      `,
    ),
  }),
);

/**
 * api_access_tokens
 *
 * ELI5:
 * One row = one short-lived bearer token minted from an API key.
 *
 * Why separate from api_credentials:
 * - API key is long-lived identity anchor.
 * - Access token is short-lived working credential.
 * - This lets us rotate/revoke quickly without touching root key.
 */
export const apiAccessTokens = pgTable(
  "api_access_tokens",
  {
    /** Stable primary key for one access token row. */
    id: idWithTag("api_access_token"),

    /** Parent API credential used to mint this token. */
    apiCredentialId: idRef("api_credential_id")
      .references(() => apiCredentials.id)
      .notNull(),

    /** Owner user resolved from parent credential at mint time. */
    ownerUserId: idRef("owner_user_id")
      .references(() => users.id)
      .notNull(),

    /** Optional biz context bound into this token at mint time. */
    bizId: idRef("biz_id").references(() => bizes.id),

    /** Hash of raw bearer token text (raw token is never stored). */
    tokenHash: varchar("token_hash", { length: 128 }).notNull(),

    /** Small non-sensitive preview for operator UI. */
    tokenPreview: varchar("token_preview", { length: 32 }).notNull(),

    /** Effective scope list copied/derived from parent credential. */
    scopes: jsonb("scopes").default(["*"]).notNull(),

    /**
     * Token status lifecycle.
     *
     * Values:
     * - `active`
     * - `revoked`
     * - `expired`
     */
    status: varchar("status", { length: 60 }).default("active").notNull(),

    /** Mint timestamp. */
    issuedAt: timestamp("issued_at", { withTimezone: true }).defaultNow().notNull(),

    /** Required expiry timestamp (short-lived by design). */
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),

    /** Last successful token usage timestamp. */
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),

    /** Revocation timestamp. */
    revokedAt: timestamp("revoked_at", { withTimezone: true }),

    /** Optional revocation reason message. */
    revokedReason: varchar("revoked_reason", { length: 500 }),

    /** Extensible token metadata (issuer trace, reason, runner id, etc.). */
    metadata: jsonb("metadata").default({}).notNull(),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Fast deterministic bearer token lookup by hash. */
    apiAccessTokensTokenHashUnique: uniqueIndex("api_access_tokens_token_hash_unique").on(
      table.tokenHash,
    ),

    /** Main list path for one parent credential token inventory. */
    apiAccessTokensCredentialStatusIdx: index("api_access_tokens_credential_status_idx").on(
      table.apiCredentialId,
      table.status,
      table.issuedAt,
    ),

    /** Owner-level audit path for token timeline and incident response. */
    apiAccessTokensOwnerIssuedIdx: index("api_access_tokens_owner_issued_idx").on(
      table.ownerUserId,
      table.issuedAt,
    ),

    /** Status vocabulary guard. */
    apiAccessTokensStatusCheck: check(
      "api_access_tokens_status_check",
      sql`
      "status" IN ('active', 'revoked', 'expired')
      OR "status" LIKE 'custom_%'
      `,
    ),

    /** Expiry and revocation timeline sanity. */
    apiAccessTokensTimelineCheck: check(
      "api_access_tokens_timeline_check",
      sql`
      "expires_at" > "issued_at"
      AND ("revoked_at" IS NULL OR "revoked_at" >= "issued_at")
      `,
    ),

    /** Status/field shape consistency. */
    apiAccessTokensRevocationShapeCheck: check(
      "api_access_tokens_revocation_shape_check",
      sql`
      (
        "status" = 'active'
        AND "revoked_at" IS NULL
      ) OR (
        "status" = 'revoked'
        AND "revoked_at" IS NOT NULL
      ) OR (
        "status" = 'expired'
      ) OR (
        "status" LIKE 'custom_%'
      )
      `,
    ),

    /** Tenant-safe optional FK alignment for biz-scoped token rows. */
    apiAccessTokensBizCredentialFk: foreignKey({
      columns: [table.bizId, table.apiCredentialId],
      foreignColumns: [apiCredentials.bizId, apiCredentials.id],
      name: "api_access_tokens_biz_credential_fk",
    }),
  }),
);
