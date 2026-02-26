import { createHmac, randomBytes } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import dbPackage from "@bizing/db";

const { db, apiAccessTokens, apiCredentials, users, members } = dbPackage;

type AuthSource = "api_key" | "access_token";

export type MachineAuthPrincipal = {
  authSource: AuthSource;
  user: {
    id: string;
    email?: string;
    role?: string | null;
  };
  session: {
    id: string;
    activeOrganizationId?: string | null;
  };
  authScopes: string[];
  credentialId: string;
  credentialBizId?: string | null;
};

type ResolveMachineAuthOptions = {
  /**
   * When false, raw API keys are accepted only if credential explicitly allows
   * direct API-key usage (`allow_direct_api_key_auth=true`).
   *
   * ELI5:
   * - false = "use key only to exchange for short-lived token"
   * - true  = "allow key itself to call API endpoints"
   */
  allowDirectApiKey?: boolean;
};

type CreateApiCredentialInput = {
  ownerUserId: string;
  bizId?: string | null;
  label: string;
  description?: string | null;
  scopes?: string[];
  expiresAt?: Date | null;
  allowDirectApiKeyAuth?: boolean;
  metadata?: Record<string, unknown>;
};

type IssueAccessTokenInput = {
  apiCredentialId: string;
  ownerUserId: string;
  bizId?: string | null;
  scopes: string[];
  ttlSeconds: number;
  metadata?: Record<string, unknown>;
};

function getAuthPepper() {
  return (
    process.env.AUTH_TOKEN_PEPPER ||
    process.env.BETTER_AUTH_SECRET ||
    "dev-auth-pepper-change-me"
  );
}

/**
 * Hash secret/token material with HMAC-SHA256 + server-side pepper.
 *
 * ELI5:
 * - If DB leaks, attacker sees only hashes, not raw secrets.
 * - Pepper means the hash is not useful without server secret.
 */
export function hashSecretMaterial(rawSecret: string): string {
  return createHmac("sha256", getAuthPepper()).update(rawSecret).digest("hex");
}

function randomToken(prefix: "sk" | "at") {
  return `bizing_${prefix}_${randomBytes(32).toString("base64url")}`;
}

function tokenPreview(raw: string) {
  if (raw.length <= 10) return raw;
  return `${raw.slice(0, 8)}...${raw.slice(-4)}`;
}

function normalizeScopes(input?: string[]) {
  const values = (input ?? [])
    .map((value) => String(value || "").trim())
    .filter(Boolean);
  const unique = Array.from(new Set(values));
  return unique.length > 0 ? unique : ["*"];
}

function parseAuthHeaders(headers: Headers) {
  const authorization = headers.get("authorization") ?? "";
  const apiKeyHeader = headers.get("x-api-key") ?? "";

  let bearerToken: string | null = null;
  let apiKey: string | null = null;

  if (/^Bearer\s+/i.test(authorization)) {
    bearerToken = authorization.replace(/^Bearer\s+/i, "").trim();
  } else if (/^ApiKey\s+/i.test(authorization)) {
    apiKey = authorization.replace(/^ApiKey\s+/i, "").trim();
  }

  if (!apiKey && apiKeyHeader.trim()) {
    apiKey = apiKeyHeader.trim();
  }

  return {
    bearerToken: bearerToken || null,
    apiKey: apiKey || null,
  };
}

/**
 * Check if requested scopes are subset of allowed scopes.
 */
export function scopesAreSubset(requested: string[], allowed: string[]) {
  const requestedSet = normalizeScopes(requested);
  const allowedSet = normalizeScopes(allowed);
  if (allowedSet.includes("*")) return true;

  return requestedSet.every((scope) => {
    if (allowedSet.includes(scope)) return true;
    const wildcardMatches = allowedSet.some((allowedScope) => {
      if (!allowedScope.endsWith(".*")) return false;
      const prefix = allowedScope.slice(0, -1);
      return scope.startsWith(prefix);
    });
    return wildcardMatches;
  });
}

async function touchCredentialUsage(credentialId: string) {
  await db
    .update(apiCredentials)
    .set({
      lastUsedAt: new Date(),
    })
    .where(eq(apiCredentials.id, credentialId));
}

async function touchAccessTokenUsage(accessTokenId: string) {
  await db
    .update(apiAccessTokens)
    .set({
      lastUsedAt: new Date(),
    })
    .where(eq(apiAccessTokens.id, accessTokenId));
}

function scopesFromRowValue(value: unknown): string[] {
  if (!Array.isArray(value)) return ["*"];
  const scopes = value.map((item) => String(item));
  return normalizeScopes(scopes);
}

async function hydratePrincipalFromCredentialRow(input: {
  authSource: AuthSource;
  credentialId: string;
  ownerUserId: string;
  credentialBizId?: string | null;
  scopes: string[];
  sessionId: string;
}) {
  const user = await db.query.users.findFirst({
    where: eq(users.id, input.ownerUserId),
  });
  if (!user) return null;

  return {
    authSource: input.authSource,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
    },
    session: {
      id: input.sessionId,
      activeOrganizationId: input.credentialBizId ?? null,
    },
    authScopes: normalizeScopes(input.scopes),
    credentialId: input.credentialId,
    credentialBizId: input.credentialBizId ?? null,
  } satisfies MachineAuthPrincipal;
}

/**
 * Resolve machine principal from headers:
 * 1) Bearer short-lived access token
 * 2) API key (x-api-key or Authorization: ApiKey ...)
 */
export async function resolveMachineAuthFromHeaders(
  headers: Headers,
  options: ResolveMachineAuthOptions = {},
) {
  const { bearerToken, apiKey } = parseAuthHeaders(headers);
  const now = new Date();

  if (bearerToken) {
    const bearerHash = hashSecretMaterial(bearerToken);
    const accessToken = await db.query.apiAccessTokens.findFirst({
      where: and(eq(apiAccessTokens.tokenHash, bearerHash), sql`"deleted_at" IS NULL`),
    });
    if (accessToken) {
      const credential = await db.query.apiCredentials.findFirst({
        where: and(eq(apiCredentials.id, accessToken.apiCredentialId), sql`"deleted_at" IS NULL`),
      });
      if (!credential) return null;

      const accessTokenExpired = accessToken.expiresAt <= now;
      const credentialExpired = Boolean(credential.expiresAt && credential.expiresAt <= now);
      const accessTokenRevoked = accessToken.status === "revoked" || Boolean(accessToken.revokedAt);
      const credentialRevoked = credential.status === "revoked" || Boolean(credential.revokedAt);

      if (accessTokenExpired || accessTokenRevoked || credentialExpired || credentialRevoked) {
        return null;
      }

      await Promise.all([
        touchCredentialUsage(credential.id),
        touchAccessTokenUsage(accessToken.id),
      ]);

      return hydratePrincipalFromCredentialRow({
        authSource: "access_token",
        credentialId: credential.id,
        ownerUserId: credential.ownerUserId,
        credentialBizId: accessToken.bizId ?? credential.bizId ?? null,
        scopes: scopesFromRowValue(accessToken.scopes),
        sessionId: `machine-token:${accessToken.id}`,
      });
    }
  }

  if (apiKey) {
    const apiKeyHash = hashSecretMaterial(apiKey);
    const credential = await db.query.apiCredentials.findFirst({
      where: and(eq(apiCredentials.keyHash, apiKeyHash), sql`"deleted_at" IS NULL`),
    });
    if (!credential) return null;

    const isExpired = Boolean(credential.expiresAt && credential.expiresAt <= now);
    const isRevoked = credential.status === "revoked" || Boolean(credential.revokedAt);
    if (isExpired || isRevoked) return null;

    const directAllowed = options.allowDirectApiKey || credential.allowDirectApiKeyAuth;
    if (!directAllowed) return null;

    await touchCredentialUsage(credential.id);

    return hydratePrincipalFromCredentialRow({
      authSource: "api_key",
      credentialId: credential.id,
      ownerUserId: credential.ownerUserId,
      credentialBizId: credential.bizId ?? null,
      scopes: scopesFromRowValue(credential.scopes),
      sessionId: `machine-key:${credential.id}`,
    });
  }

  return null;
}

export async function ensureUserCanAccessBiz(userId: string, bizId: string) {
  const member = await db.query.members.findFirst({
    where: and(eq(members.userId, userId), eq(members.organizationId, bizId)),
  });
  return Boolean(member);
}

/**
 * Create one long-lived API key credential.
 *
 * Returns:
 * - credential row (without secret),
 * - raw secret key (show once to caller).
 */
export async function createApiCredential(input: CreateApiCredentialInput) {
  const rawKey = randomToken("sk");
  const keyHash = hashSecretMaterial(rawKey);
  const preview = tokenPreview(rawKey);

  const [created] = await db
    .insert(apiCredentials)
    .values({
      ownerUserId: input.ownerUserId,
      bizId: input.bizId ?? null,
      label: input.label,
      description: input.description ?? null,
      keyHash,
      keyPreview: preview,
      scopes: normalizeScopes(input.scopes),
      allowDirectApiKeyAuth: input.allowDirectApiKeyAuth ?? false,
      status: "active",
      expiresAt: input.expiresAt ?? null,
      metadata: input.metadata ?? {},
    })
    .returning();

  return {
    apiKey: rawKey,
    credential: created,
  };
}

/**
 * Issue one short-lived bearer token from an API credential.
 */
export async function issueAccessTokenFromCredential(input: IssueAccessTokenInput) {
  const now = new Date();
  const ttlSeconds = Math.max(60, Math.min(input.ttlSeconds, 60 * 60));
  const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);

  const rawAccessToken = randomToken("at");
  const tokenHash = hashSecretMaterial(rawAccessToken);
  const preview = tokenPreview(rawAccessToken);

  const [created] = await db
    .insert(apiAccessTokens)
    .values({
      apiCredentialId: input.apiCredentialId,
      ownerUserId: input.ownerUserId,
      bizId: input.bizId ?? null,
      tokenHash,
      tokenPreview: preview,
      scopes: normalizeScopes(input.scopes),
      status: "active",
      issuedAt: now,
      expiresAt,
      metadata: input.metadata ?? {},
    })
    .returning();

  return {
    accessToken: rawAccessToken,
    expiresAt,
    expiresInSeconds: ttlSeconds,
    token: created,
  };
}

/**
 * Resolve credential by raw API key material (hash lookup).
 */
export async function resolveCredentialFromRawApiKey(rawApiKey: string) {
  const keyHash = hashSecretMaterial(rawApiKey);
  return db.query.apiCredentials.findFirst({
    where: and(eq(apiCredentials.keyHash, keyHash), sql`"deleted_at" IS NULL`),
  });
}

export async function markApiCredentialRevoked(input: {
  apiCredentialId: string;
  reason?: string | null;
}) {
  const now = new Date();

  await db
    .update(apiCredentials)
    .set({
      status: "revoked",
      revokedAt: now,
      revokedReason: input.reason ?? null,
    })
    .where(eq(apiCredentials.id, input.apiCredentialId));

  // Revoke any still-active child access tokens immediately.
  await db
    .update(apiAccessTokens)
    .set({
      status: "revoked",
      revokedAt: now,
      revokedReason: input.reason ?? "parent_credential_revoked",
    })
    .where(
      and(
        eq(apiAccessTokens.apiCredentialId, input.apiCredentialId),
        sql`"deleted_at" IS NULL`,
        sql`"status" = 'active'`,
      ),
    );
}
