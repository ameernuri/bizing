/**
 * Machine authentication routes (API keys + short-lived access tokens).
 *
 * ELI5:
 * - Human in browser: cookie session (Better Auth).
 * - Machine/agent/integration: API key -> exchange -> short token.
 *
 * Design intent:
 * - Keep long-lived secrets rare and tightly managed.
 * - Prefer short-lived bearer tokens for daily API calls.
 * - Never expose stored hashes/secrets in read APIs.
 */

import { Hono, type Context } from "hono";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import dbPackage from "@bizing/db";
import {
  createApiCredential,
  ensureUserCanAccessBiz,
  issueAccessTokenFromCredential,
  markApiCredentialRevoked,
  resolveCredentialFromRawApiKey,
  scopesAreSubset,
} from "../services/machine-auth.js";
import {
  listAuthAccessEvents,
  listAuthPrincipals,
  recordRequestAuthEvent,
} from "../services/auth-observability.js";
import {
  getCurrentAuthCredentialId,
  getCurrentAuthSource,
  getCurrentUser,
  requireAuthAllowApiKey,
  requireSessionAuth,
} from "../middleware/auth.js";
import { fail, ok, parsePositiveInt } from "./_api.js";

const { db, apiCredentials, apiAccessTokens } = dbPackage;

const listApiKeysQuerySchema = z.object({
  includeRevoked: z.enum(["true", "false"]).optional(),
  bizId: z.string().optional(),
  limit: z.string().optional(),
});

const createApiKeyBodySchema = z.object({
  label: z.string().min(1).max(180),
  description: z.string().max(1000).optional(),
  bizId: z.string().optional(),
  scopes: z.array(z.string().min(1).max(180)).optional(),
  expiresAt: z.string().datetime().optional(),
  /**
   * Default true so newly-created keys are immediately usable for API calls.
   * Callers can still set false for "exchange-only" posture.
   */
  allowDirectApiKeyAuth: z.boolean().default(true),
  /**
   * Optional one-shot bootstrap token minting for immediate API use.
   * Useful for local agents/CI setup where users want one request to return
   * both long-lived key and short-lived bearer token.
   */
  issueAccessToken: z
    .object({
      ttlSeconds: z.number().int().min(60).max(60 * 60).default(15 * 60),
      scopes: z.array(z.string().min(1).max(180)).optional(),
      reason: z.string().max(500).optional(),
    })
    .optional(),
  metadata: z.record(z.unknown()).optional(),
});

const revokeApiKeyBodySchema = z.object({
  reason: z.string().max(500).optional(),
});

const exchangeTokenBodySchema = z.object({
  /**
   * For session-authenticated callers:
   * pick which credential to exchange.
   */
  apiCredentialId: z.string().optional(),
  /**
   * Optional raw API key value for explicit exchange in one call.
   * Useful for non-browser automation bootstrap.
   */
  apiKey: z.string().min(1).optional(),
  scopes: z.array(z.string().min(1).max(180)).optional(),
  ttlSeconds: z.number().int().min(60).max(60 * 60).default(15 * 60),
  bizId: z.string().optional(),
  reason: z.string().max(500).optional(),
});

const revokeTokenBodySchema = z.object({
  reason: z.string().max(500).optional(),
});

const listTokensQuerySchema = z.object({
  apiCredentialId: z.string().optional(),
  includeRevoked: z.enum(["true", "false"]).optional(),
  limit: z.string().optional(),
});

const listAuthEventsQuerySchema = z.object({
  bizId: z.string().optional(),
  authSource: z.enum(["session", "api_key", "access_token", "system", "unknown"]).optional(),
  decision: z.enum(["allowed", "denied", "issued", "revoked", "error"]).optional(),
  eventType: z.string().max(80).optional(),
  occurredFrom: z.string().datetime().optional(),
  occurredTo: z.string().datetime().optional(),
  mineOnly: z.enum(["true", "false"]).optional(),
  limit: z.string().optional(),
});

const listAuthPrincipalsQuerySchema = z.object({
  bizId: z.string().optional(),
  mineOnly: z.enum(["true", "false"]).optional(),
  limit: z.string().optional(),
});

const rotateApiKeyBodySchema = z.object({
  label: z.string().min(1).max(180).optional(),
  description: z.string().max(1000).optional(),
  scopes: z.array(z.string().min(1).max(180)).optional(),
  expiresAt: z.string().datetime().optional(),
  allowDirectApiKeyAuth: z.boolean().optional(),
  revokePrevious: z.boolean().default(true),
  revokeReason: z.string().max(500).optional(),
  issueAccessToken: z
    .object({
      ttlSeconds: z.number().int().min(60).max(60 * 60).default(15 * 60),
      scopes: z.array(z.string().min(1).max(180)).optional(),
      reason: z.string().max(500).optional(),
    })
    .optional(),
});

export const authMachineRoutes = new Hono();

function isPlatformAdmin(user: { role?: string | null } | undefined) {
  return user?.role === "admin" || user?.role === "owner";
}

function normalizeScopesForResponse(scopes: unknown): string[] {
  if (!Array.isArray(scopes)) return ["*"];
  return scopes.map((value) => String(value || "")).filter(Boolean);
}

function emitAuthEvent(c: Context, input: Parameters<typeof recordRequestAuthEvent>[1]) {
  void recordRequestAuthEvent(c.req.raw.headers, {
    ...input,
    httpMethod: input.httpMethod ?? c.req.method,
    httpPath: input.httpPath ?? c.req.path,
    requestId: input.requestId ?? c.get("requestId"),
  }).catch(() => undefined);
}

/**
 * List API credentials owned by the current user.
 */
authMachineRoutes.get("/auth/api-keys", requireSessionAuth, async (c) => {
  const user = getCurrentUser(c);
  if (!user) return fail(c, "UNAUTHORIZED", "Authentication required.", 401);

  const parsed = listApiKeysQuerySchema.safeParse(c.req.query());
  if (!parsed.success) {
    return fail(c, "VALIDATION_ERROR", "Invalid query parameters.", 400, parsed.error.flatten());
  }

  const includeRevoked = parsed.data.includeRevoked === "true";
  const limit = Math.min(parsePositiveInt(parsed.data.limit, 100), 500);

  const rows = await db.query.apiCredentials.findMany({
    where: and(
      eq(apiCredentials.ownerUserId, user.id),
      parsed.data.bizId ? eq(apiCredentials.bizId, parsed.data.bizId) : undefined,
      includeRevoked ? undefined : sql`"status" <> 'revoked'`,
      sql`"deleted_at" IS NULL`,
    ),
    orderBy: [desc(apiCredentials.id)],
    limit,
  });

  const safe = rows.map((row) => ({
    id: row.id,
    ownerUserId: row.ownerUserId,
    bizId: row.bizId,
    label: row.label,
    description: row.description,
    keyPreview: row.keyPreview,
    status: row.status,
    scopes: normalizeScopesForResponse(row.scopes),
    allowDirectApiKeyAuth: row.allowDirectApiKeyAuth,
    lastUsedAt: row.lastUsedAt,
    expiresAt: row.expiresAt,
    revokedAt: row.revokedAt,
    revokedReason: row.revokedReason,
    metadata: row.metadata,
  }));

  return ok(c, safe);
});

/**
 * Create one API key credential.
 *
 * Returns raw API key once; caller must store it immediately.
 */
authMachineRoutes.post("/auth/api-keys", requireSessionAuth, async (c) => {
  const user = getCurrentUser(c);
  if (!user) return fail(c, "UNAUTHORIZED", "Authentication required.", 401);

  const body = await c.req.json().catch(() => null);
  const parsed = createApiKeyBodySchema.safeParse(body);
  if (!parsed.success) {
    return fail(c, "VALIDATION_ERROR", "Invalid request body.", 400, parsed.error.flatten());
  }

  const bizId = parsed.data.bizId ?? null;
  if (bizId && !isPlatformAdmin(user)) {
    const member = await ensureUserCanAccessBiz(user.id, bizId);
    if (!member) {
      return fail(c, "FORBIDDEN", "You are not a member of this biz.", 403);
    }
  }

  const created = await createApiCredential({
    ownerUserId: user.id,
    bizId,
    label: parsed.data.label,
    description: parsed.data.description ?? null,
    scopes: parsed.data.scopes,
    expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
    allowDirectApiKeyAuth: parsed.data.allowDirectApiKeyAuth,
    metadata: parsed.data.metadata,
  });

  let bootstrapAccessToken:
    | {
        tokenType: "Bearer";
        accessToken: string;
        expiresAt: string;
        expiresInSeconds: number;
        scopes: string[];
      }
    | undefined;
  if (parsed.data.issueAccessToken) {
    const allowedScopes = normalizeScopesForResponse(created.credential.scopes);
    const requestedScopes = parsed.data.issueAccessToken.scopes ?? allowedScopes;
    if (!scopesAreSubset(requestedScopes, allowedScopes)) {
      return fail(c, "FORBIDDEN", "Requested bootstrap token scopes exceed credential scope.", 403, {
        requestedScopes,
        allowedScopes,
      });
    }
    const issued = await issueAccessTokenFromCredential({
      apiCredentialId: created.credential.id,
      ownerUserId: created.credential.ownerUserId,
      bizId: created.credential.bizId ?? null,
      scopes: requestedScopes,
      ttlSeconds: parsed.data.issueAccessToken.ttlSeconds,
      metadata: {
        reason: parsed.data.issueAccessToken.reason ?? "api_key_create_bootstrap",
        issuedVia: "session",
      },
    });
    bootstrapAccessToken = {
      tokenType: "Bearer",
      accessToken: issued.accessToken,
      expiresAt: issued.expiresAt.toISOString(),
      expiresInSeconds: issued.expiresInSeconds,
      scopes: requestedScopes,
    };
  }

  emitAuthEvent(c, {
    authSource: "session",
    eventType: "api_key_created",
    decision: "issued",
    ownerUserId: created.credential.ownerUserId,
    bizId: created.credential.bizId ?? null,
    apiCredentialId: created.credential.id,
    actorUserId: user.id,
    eventData: {
      allowDirectApiKeyAuth: created.credential.allowDirectApiKeyAuth,
      hasBootstrapAccessToken: Boolean(bootstrapAccessToken),
    },
  });

  return ok(
    c,
    {
      apiKey: created.apiKey,
      credential: {
        id: created.credential.id,
        ownerUserId: created.credential.ownerUserId,
        bizId: created.credential.bizId,
        label: created.credential.label,
        keyPreview: created.credential.keyPreview,
        status: created.credential.status,
        scopes: normalizeScopesForResponse(created.credential.scopes),
        allowDirectApiKeyAuth: created.credential.allowDirectApiKeyAuth,
        expiresAt: created.credential.expiresAt,
      },
      warning:
        "Store apiKey now. It will never be returned again, only hash/preview is stored.",
      bootstrapAccessToken,
    },
    201,
  );
});

/**
 * Revoke one API key and all child access tokens.
 */
authMachineRoutes.post("/auth/api-keys/:apiCredentialId/revoke", requireSessionAuth, async (c) => {
  const user = getCurrentUser(c);
  if (!user) return fail(c, "UNAUTHORIZED", "Authentication required.", 401);

  const apiCredentialId = c.req.param("apiCredentialId");
  const body = await c.req.json().catch(() => null);
  const parsed = revokeApiKeyBodySchema.safeParse(body ?? {});
  if (!parsed.success) {
    return fail(c, "VALIDATION_ERROR", "Invalid request body.", 400, parsed.error.flatten());
  }

  const credential = await db.query.apiCredentials.findFirst({
    where: and(eq(apiCredentials.id, apiCredentialId), sql`"deleted_at" IS NULL`),
  });
  if (!credential) {
    return fail(c, "NOT_FOUND", "API credential not found.", 404);
  }

  const canManage = credential.ownerUserId === user.id || isPlatformAdmin(user);
  if (!canManage) {
    return fail(c, "FORBIDDEN", "Only credential owner or platform admin can revoke.", 403);
  }

  await markApiCredentialRevoked({
    apiCredentialId,
    reason: parsed.data.reason ?? null,
  });

  emitAuthEvent(c, {
    authSource: "session",
    eventType: "api_key_revoked",
    decision: "revoked",
    ownerUserId: credential.ownerUserId,
    bizId: credential.bizId ?? null,
    apiCredentialId: credential.id,
    actorUserId: user.id,
    reasonMessage: parsed.data.reason ?? null,
  });

  return ok(c, {
    id: apiCredentialId,
    status: "revoked",
    revokedAt: new Date().toISOString(),
  });
});

/**
 * Rotate one API key credential.
 *
 * ELI5:
 * - creates a brand new key row (new secret),
 * - optionally revokes old key immediately,
 * - optionally returns a short-lived bootstrap bearer token for the new key.
 */
authMachineRoutes.post("/auth/api-keys/:apiCredentialId/rotate", requireSessionAuth, async (c) => {
  const user = getCurrentUser(c);
  if (!user) return fail(c, "UNAUTHORIZED", "Authentication required.", 401);

  const apiCredentialId = c.req.param("apiCredentialId");
  const body = await c.req.json().catch(() => null);
  const parsed = rotateApiKeyBodySchema.safeParse(body ?? {});
  if (!parsed.success) {
    return fail(c, "VALIDATION_ERROR", "Invalid request body.", 400, parsed.error.flatten());
  }

  const existing = await db.query.apiCredentials.findFirst({
    where: and(eq(apiCredentials.id, apiCredentialId), sql`"deleted_at" IS NULL`),
  });
  if (!existing) return fail(c, "NOT_FOUND", "API credential not found.", 404);

  const canManage = existing.ownerUserId === user.id || isPlatformAdmin(user);
  if (!canManage) {
    return fail(c, "FORBIDDEN", "Only credential owner or platform admin can rotate.", 403);
  }

  const replacement = await createApiCredential({
    ownerUserId: existing.ownerUserId,
    bizId: existing.bizId ?? null,
    label: parsed.data.label ?? `${existing.label} (rotated)`,
    description: parsed.data.description ?? existing.description ?? null,
    scopes: parsed.data.scopes ?? normalizeScopesForResponse(existing.scopes),
    expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : existing.expiresAt ?? null,
    allowDirectApiKeyAuth:
      typeof parsed.data.allowDirectApiKeyAuth === "boolean"
        ? parsed.data.allowDirectApiKeyAuth
        : existing.allowDirectApiKeyAuth,
    metadata: {
      ...(existing.metadata as Record<string, unknown>),
      rotatedFromCredentialId: existing.id,
    },
  });

  if (parsed.data.revokePrevious) {
    await markApiCredentialRevoked({
      apiCredentialId: existing.id,
      reason: parsed.data.revokeReason ?? "rotated",
    });
    emitAuthEvent(c, {
      authSource: "session",
      eventType: "api_key_revoked",
      decision: "revoked",
      ownerUserId: existing.ownerUserId,
      bizId: existing.bizId ?? null,
      apiCredentialId: existing.id,
      actorUserId: user.id,
      reasonMessage: parsed.data.revokeReason ?? "rotated",
      eventData: {
        rotateFlow: true,
      },
    });
  }

  let bootstrapAccessToken:
    | {
        tokenType: "Bearer";
        accessToken: string;
        expiresAt: string;
        expiresInSeconds: number;
        scopes: string[];
      }
    | undefined;
  if (parsed.data.issueAccessToken) {
    const allowedScopes = normalizeScopesForResponse(replacement.credential.scopes);
    const requestedScopes = parsed.data.issueAccessToken.scopes ?? allowedScopes;
    if (!scopesAreSubset(requestedScopes, allowedScopes)) {
      return fail(c, "FORBIDDEN", "Requested bootstrap token scopes exceed credential scope.", 403, {
        requestedScopes,
        allowedScopes,
      });
    }
    const issued = await issueAccessTokenFromCredential({
      apiCredentialId: replacement.credential.id,
      ownerUserId: replacement.credential.ownerUserId,
      bizId: replacement.credential.bizId ?? null,
      scopes: requestedScopes,
      ttlSeconds: parsed.data.issueAccessToken.ttlSeconds,
      metadata: {
        reason: parsed.data.issueAccessToken.reason ?? "api_key_rotate_bootstrap",
        issuedVia: "session",
      },
    });
    bootstrapAccessToken = {
      tokenType: "Bearer",
      accessToken: issued.accessToken,
      expiresAt: issued.expiresAt.toISOString(),
      expiresInSeconds: issued.expiresInSeconds,
      scopes: requestedScopes,
    };
  }

  emitAuthEvent(c, {
    authSource: "session",
    eventType: "api_key_rotated",
    decision: "issued",
    ownerUserId: replacement.credential.ownerUserId,
    bizId: replacement.credential.bizId ?? null,
    apiCredentialId: replacement.credential.id,
    actorUserId: user.id,
    eventData: {
      previousCredentialId: existing.id,
      revokedPrevious: parsed.data.revokePrevious,
      hasBootstrapAccessToken: Boolean(bootstrapAccessToken),
    },
  });

  return ok(c, {
    apiKey: replacement.apiKey,
    revokedPrevious: parsed.data.revokePrevious,
    previousCredentialId: existing.id,
    credential: {
      id: replacement.credential.id,
      ownerUserId: replacement.credential.ownerUserId,
      bizId: replacement.credential.bizId,
      label: replacement.credential.label,
      keyPreview: replacement.credential.keyPreview,
      status: replacement.credential.status,
      scopes: normalizeScopesForResponse(replacement.credential.scopes),
      allowDirectApiKeyAuth: replacement.credential.allowDirectApiKeyAuth,
      expiresAt: replacement.credential.expiresAt,
    },
    warning:
      "Store apiKey now. It will never be returned again, only hash/preview is stored.",
    bootstrapAccessToken,
  });
});

/**
 * Exchange API key for short-lived bearer token.
 *
 * Auth entry points:
 * - session auth + apiCredentialId/apiKey in body
 * - direct API key auth (x-api-key / Authorization: ApiKey ...) for bootstrap
 */
authMachineRoutes.post("/auth/tokens/exchange", requireAuthAllowApiKey, async (c) => {
  const user = getCurrentUser(c);
  if (!user) return fail(c, "UNAUTHORIZED", "Authentication required.", 401);

  const body = await c.req.json().catch(() => null);
  const parsed = exchangeTokenBodySchema.safeParse(body ?? {});
  if (!parsed.success) {
    return fail(c, "VALIDATION_ERROR", "Invalid request body.", 400, parsed.error.flatten());
  }

  const authSource = getCurrentAuthSource(c) ?? "session";
  if (authSource === "access_token") {
    return fail(
      c,
      "FORBIDDEN",
      "Access tokens cannot mint more access tokens. Use API key or interactive session.",
      403,
    );
  }

  let credential = null as Awaited<ReturnType<typeof db.query.apiCredentials.findFirst>> | null;

  if (authSource === "api_key") {
    const currentCredentialId = getCurrentAuthCredentialId(c);
    if (!currentCredentialId) {
      return fail(c, "FORBIDDEN", "Missing API credential context.", 403);
    }
    credential = await db.query.apiCredentials.findFirst({
      where: and(eq(apiCredentials.id, currentCredentialId), sql`"deleted_at" IS NULL`),
    });
  } else {
    if (parsed.data.apiKey) {
      credential = await resolveCredentialFromRawApiKey(parsed.data.apiKey);
    } else if (parsed.data.apiCredentialId) {
      credential = await db.query.apiCredentials.findFirst({
        where: and(
          eq(apiCredentials.id, parsed.data.apiCredentialId),
          sql`"deleted_at" IS NULL`,
        ),
      });
    } else {
      return fail(
        c,
        "VALIDATION_ERROR",
        "Provide apiCredentialId or apiKey when exchanging from session auth.",
        400,
      );
    }
  }

  if (!credential) {
    return fail(c, "NOT_FOUND", "API credential not found.", 404);
  }

  if (credential.status !== "active" || credential.revokedAt) {
    return fail(c, "FORBIDDEN", "API credential is not active.", 403);
  }

  const isOwner = credential.ownerUserId === user.id;
  if (!isOwner && !isPlatformAdmin(user)) {
    return fail(c, "FORBIDDEN", "Credential owner mismatch.", 403);
  }

  const allowedScopes = normalizeScopesForResponse(credential.scopes);
  const requestedScopes = parsed.data.scopes ?? allowedScopes;
  if (!scopesAreSubset(requestedScopes, allowedScopes)) {
    return fail(c, "FORBIDDEN", "Requested scopes exceed credential scope.", 403, {
      requestedScopes,
      allowedScopes,
    });
  }

  const resolvedBizId = parsed.data.bizId ?? credential.bizId ?? null;
  if (credential.bizId && resolvedBizId && credential.bizId !== resolvedBizId) {
    return fail(c, "FORBIDDEN", "Requested biz scope does not match credential biz scope.", 403);
  }

  if (resolvedBizId && !isPlatformAdmin(user)) {
    const member = await ensureUserCanAccessBiz(user.id, resolvedBizId);
    if (!member) {
      return fail(c, "FORBIDDEN", "You are not a member of requested biz scope.", 403);
    }
  }

  const issued = await issueAccessTokenFromCredential({
    apiCredentialId: credential.id,
    ownerUserId: credential.ownerUserId,
    bizId: resolvedBizId,
    scopes: requestedScopes,
    ttlSeconds: parsed.data.ttlSeconds,
    metadata: {
      reason: parsed.data.reason ?? null,
      issuedVia: authSource,
    },
  });

  emitAuthEvent(c, {
    authSource: authSource === "api_key" ? "api_key" : "session",
    eventType: "access_token_issued",
    decision: "issued",
    ownerUserId: credential.ownerUserId,
    bizId: resolvedBizId,
    apiCredentialId: credential.id,
    apiAccessTokenId: issued.token.id,
    actorUserId: user.id,
    eventData: {
      issuedVia: authSource,
      scopes: requestedScopes,
      ttlSeconds: parsed.data.ttlSeconds,
    },
  });

  return ok(c, {
    tokenType: "Bearer",
    accessToken: issued.accessToken,
    expiresAt: issued.expiresAt.toISOString(),
    expiresInSeconds: issued.expiresInSeconds,
    scopes: requestedScopes,
    credentialId: credential.id,
    bizId: resolvedBizId,
  });
});

/**
 * Revoke one access token by id.
 */
authMachineRoutes.post("/auth/tokens/:tokenId/revoke", requireSessionAuth, async (c) => {
  const user = getCurrentUser(c);
  if (!user) return fail(c, "UNAUTHORIZED", "Authentication required.", 401);

  const tokenId = c.req.param("tokenId");
  const body = await c.req.json().catch(() => null);
  const parsed = revokeTokenBodySchema.safeParse(body ?? {});
  if (!parsed.success) {
    return fail(c, "VALIDATION_ERROR", "Invalid request body.", 400, parsed.error.flatten());
  }

  const token = await db.query.apiAccessTokens.findFirst({
    where: and(eq(apiAccessTokens.id, tokenId), sql`"deleted_at" IS NULL`),
  });
  if (!token) return fail(c, "NOT_FOUND", "Access token not found.", 404);

  const canManage = token.ownerUserId === user.id || isPlatformAdmin(user);
  if (!canManage) {
    return fail(c, "FORBIDDEN", "Only token owner or platform admin can revoke.", 403);
  }

  await db
    .update(apiAccessTokens)
    .set({
      status: "revoked",
      revokedAt: new Date(),
      revokedReason: parsed.data.reason ?? null,
    })
    .where(eq(apiAccessTokens.id, tokenId));

  emitAuthEvent(c, {
    authSource: "session",
    eventType: "access_token_revoked",
    decision: "revoked",
    ownerUserId: token.ownerUserId,
    bizId: token.bizId ?? null,
    apiCredentialId: token.apiCredentialId,
    apiAccessTokenId: token.id,
    actorUserId: user.id,
    reasonMessage: parsed.data.reason ?? null,
  });

  return ok(c, {
    id: tokenId,
    status: "revoked",
  });
});

/**
 * List issued access tokens for operational visibility.
 */
authMachineRoutes.get("/auth/tokens", requireSessionAuth, async (c) => {
  const user = getCurrentUser(c);
  if (!user) return fail(c, "UNAUTHORIZED", "Authentication required.", 401);

  const parsed = listTokensQuerySchema.safeParse(c.req.query());
  if (!parsed.success) {
    return fail(c, "VALIDATION_ERROR", "Invalid query parameters.", 400, parsed.error.flatten());
  }

  const includeRevoked = parsed.data.includeRevoked === "true";
  const limit = Math.min(parsePositiveInt(parsed.data.limit, 100), 500);
  const rows = await db
    .select({
      id: apiAccessTokens.id,
      apiCredentialId: apiAccessTokens.apiCredentialId,
      ownerUserId: apiAccessTokens.ownerUserId,
      bizId: apiAccessTokens.bizId,
      tokenPreview: apiAccessTokens.tokenPreview,
      scopes: apiAccessTokens.scopes,
      status: apiAccessTokens.status,
      issuedAt: apiAccessTokens.issuedAt,
      expiresAt: apiAccessTokens.expiresAt,
      lastUsedAt: apiAccessTokens.lastUsedAt,
      revokedAt: apiAccessTokens.revokedAt,
      revokedReason: apiAccessTokens.revokedReason,
    })
    .from(apiAccessTokens)
    .where(
      and(
        eq(apiAccessTokens.ownerUserId, user.id),
        parsed.data.apiCredentialId
          ? eq(apiAccessTokens.apiCredentialId, parsed.data.apiCredentialId)
          : undefined,
        includeRevoked ? undefined : sql`"status" <> 'revoked'`,
        sql`"deleted_at" IS NULL`,
      ),
    )
    .orderBy(desc(apiAccessTokens.id))
    .limit(limit);

  return ok(
    c,
    rows.map((row) => ({
      ...row,
      scopes: normalizeScopesForResponse(row.scopes),
    })),
  );
});

/**
 * List auth decision events for observability/incident triage.
 */
authMachineRoutes.get("/auth/events", requireSessionAuth, async (c) => {
  const user = getCurrentUser(c);
  if (!user) return fail(c, "UNAUTHORIZED", "Authentication required.", 401);

  const parsed = listAuthEventsQuerySchema.safeParse(c.req.query());
  if (!parsed.success) {
    return fail(c, "VALIDATION_ERROR", "Invalid query parameters.", 400, parsed.error.flatten());
  }

  const mineOnly = parsed.data.mineOnly !== "false";
  if (!mineOnly && !isPlatformAdmin(user)) {
    return fail(c, "FORBIDDEN", "Platform admin role required for mineOnly=false.", 403);
  }

  if (parsed.data.bizId && !isPlatformAdmin(user)) {
    const member = await ensureUserCanAccessBiz(user.id, parsed.data.bizId);
    if (!member) {
      return fail(c, "FORBIDDEN", "You are not a member of requested biz scope.", 403);
    }
  }

  const rows =
    (await listAuthAccessEvents({
      ownerUserId: mineOnly ? user.id : null,
      bizId: parsed.data.bizId ?? null,
      authSource: parsed.data.authSource,
      decision: parsed.data.decision,
      eventType: parsed.data.eventType,
      occurredFrom: parsed.data.occurredFrom ? new Date(parsed.data.occurredFrom) : undefined,
      occurredTo: parsed.data.occurredTo ? new Date(parsed.data.occurredTo) : undefined,
      limit: Math.min(parsePositiveInt(parsed.data.limit, 200), 1000),
    })) ?? [];

  return ok(c, rows);
});

/**
 * List normalized auth principals inventory.
 */
authMachineRoutes.get("/auth/principals", requireSessionAuth, async (c) => {
  const user = getCurrentUser(c);
  if (!user) return fail(c, "UNAUTHORIZED", "Authentication required.", 401);

  const parsed = listAuthPrincipalsQuerySchema.safeParse(c.req.query());
  if (!parsed.success) {
    return fail(c, "VALIDATION_ERROR", "Invalid query parameters.", 400, parsed.error.flatten());
  }

  const mineOnly = parsed.data.mineOnly !== "false";
  if (!mineOnly && !isPlatformAdmin(user)) {
    return fail(c, "FORBIDDEN", "Platform admin role required for mineOnly=false.", 403);
  }

  if (parsed.data.bizId && !isPlatformAdmin(user)) {
    const member = await ensureUserCanAccessBiz(user.id, parsed.data.bizId);
    if (!member) {
      return fail(c, "FORBIDDEN", "You are not a member of requested biz scope.", 403);
    }
  }

  const rows =
    (await listAuthPrincipals({
      ownerUserId: mineOnly ? user.id : null,
      bizId: parsed.data.bizId ?? null,
      limit: Math.min(parsePositiveInt(parsed.data.limit, 200), 1000),
    })) ?? [];

  return ok(c, rows);
});
