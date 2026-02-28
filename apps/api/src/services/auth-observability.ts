import { createHash } from "node:crypto";
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import dbPackage from "@bizing/db";

const { db, authPrincipals, authAccessEvents } = dbPackage;

export type ObservabilityAuthSource =
  | "session"
  | "api_key"
  | "access_token"
  | "system"
  | "unknown";

export type ObservabilityDecision = "allowed" | "denied" | "issued" | "revoked" | "error";

type EnsureAuthPrincipalInput = {
  authSource: ObservabilityAuthSource;
  ownerUserId?: string | null;
  bizId?: string | null;
  sessionId?: string | null;
  apiCredentialId?: string | null;
  apiAccessTokenId?: string | null;
  externalSubjectRef?: string | null;
  displayLabel?: string | null;
  metadata?: Record<string, unknown>;
};

type RecordAuthAccessEventInput = {
  authSource: ObservabilityAuthSource;
  eventType: string;
  decision: ObservabilityDecision;
  reasonCode?: string | null;
  reasonMessage?: string | null;
  ownerUserId?: string | null;
  bizId?: string | null;
  apiCredentialId?: string | null;
  apiAccessTokenId?: string | null;
  sessionId?: string | null;
  principalHint?: string | null;
  httpMethod?: string | null;
  httpPath?: string | null;
  httpStatus?: number | null;
  requestId?: string | null;
  sourceIp?: string | null;
  userAgent?: string | null;
  eventData?: Record<string, unknown>;
  actorUserId?: string | null;
};

type ListAuthAccessEventsInput = {
  ownerUserId?: string | null;
  bizId?: string | null;
  authSource?: ObservabilityAuthSource;
  decision?: ObservabilityDecision;
  eventType?: string;
  occurredFrom?: Date;
  occurredTo?: Date;
  limit?: number;
};

let observabilityAvailable: boolean | null = null;

function isMissingRelationError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /relation\s+".*"\s+does not exist/i.test(message);
}

async function runIfObservabilityAvailable<T>(task: () => Promise<T>): Promise<T | null> {
  if (observabilityAvailable === false) return null;
  try {
    const result = await task();
    observabilityAvailable = true;
    return result;
  } catch (error) {
    if (isMissingRelationError(error)) {
      observabilityAvailable = false;
      return null;
    }
    throw error;
  }
}

function principalTypeForSource(source: ObservabilityAuthSource) {
  if (source === "session") return "session_user";
  if (source === "api_key") return "api_credential";
  if (source === "access_token") return "api_access_token";
  return "system_actor";
}

function principalKeyFromInput(input: EnsureAuthPrincipalInput) {
  if (input.authSource === "session" && input.sessionId) {
    return `session:${input.sessionId}`;
  }
  if (input.authSource === "api_key" && input.apiCredentialId) {
    return `api_credential:${input.apiCredentialId}`;
  }
  if (input.authSource === "access_token" && input.apiAccessTokenId) {
    return `api_access_token:${input.apiAccessTokenId}`;
  }
  if (input.externalSubjectRef) {
    return `system:${input.externalSubjectRef}`;
  }
  if (input.ownerUserId) {
    return `user:${input.ownerUserId}`;
  }
  return null;
}

function hashHint(raw: string) {
  return createHash("sha256").update(raw).digest("hex").slice(0, 20);
}

/**
 * Parse auth-attempt hints from incoming headers without storing secrets.
 *
 * ELI5:
 * - Detects whether request attempted session/api-key/access-token auth.
 * - Returns only non-sensitive hint (hashed fragment), never raw token/key.
 */
export function detectAuthAttemptFromHeaders(headers: Headers): {
  authSource?: ObservabilityAuthSource;
  principalHint?: string;
} {
  const authorization = headers.get("authorization") ?? "";
  const apiKeyHeader = (headers.get("x-api-key") ?? "").trim();
  const cookie = headers.get("cookie") ?? "";

  if (apiKeyHeader) {
    return {
      authSource: "api_key",
      principalHint: `api_key:${hashHint(apiKeyHeader)}`,
    };
  }

  if (/^ApiKey\s+/i.test(authorization)) {
    const apiKey = authorization.replace(/^ApiKey\s+/i, "").trim();
    return {
      authSource: "api_key",
      principalHint: `api_key:${hashHint(apiKey)}`,
    };
  }

  if (/^Bearer\s+/i.test(authorization)) {
    const bearer = authorization.replace(/^Bearer\s+/i, "").trim();
    if (bearer.toLowerCase().startsWith("bizing_sk_") || bearer.toLowerCase().startsWith("sk_")) {
      return {
        authSource: "api_key",
        principalHint: `api_key:${hashHint(bearer)}`,
      };
    }
    return {
      authSource: "access_token",
      principalHint: `access_token:${hashHint(bearer)}`,
    };
  }

  const sessionMatch = cookie.match(/better-auth\.session_token=([^;]+)/i);
  if (sessionMatch?.[1]) {
    return {
      authSource: "session",
      principalHint: `session:${hashHint(sessionMatch[1])}`,
    };
  }

  return {};
}

function sourceIpFromHeaders(headers: Headers) {
  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0]?.trim() ?? null;
  return headers.get("x-real-ip") ?? null;
}

/**
 * Upsert normalized auth principal row.
 */
export async function ensureAuthPrincipal(input: EnsureAuthPrincipalInput) {
  const principalKey = principalKeyFromInput(input);
  if (!principalKey) return null;

  return runIfObservabilityAvailable(async () => {
    const now = new Date();
    const [row] = await db
      .insert(authPrincipals)
      .values({
        principalKey,
        bizId: input.bizId ?? null,
        ownerUserId: input.ownerUserId ?? null,
        principalType: principalTypeForSource(input.authSource),
        authSource: input.authSource === "unknown" ? "system" : input.authSource,
        apiCredentialId: input.apiCredentialId ?? null,
        apiAccessTokenId: input.apiAccessTokenId ?? null,
        externalSubjectRef: input.externalSubjectRef ?? input.sessionId ?? null,
        displayLabel: input.displayLabel ?? null,
        status: "active",
        isAuthenticatable: true,
        lastSeenAt: now,
        lastAuthenticatedAt:
          input.authSource === "session" ||
          input.authSource === "api_key" ||
          input.authSource === "access_token"
            ? now
            : null,
        metadata: input.metadata ?? {},
      })
      .onConflictDoUpdate({
        target: authPrincipals.principalKey,
        set: {
          bizId: input.bizId ?? null,
          ownerUserId: input.ownerUserId ?? null,
          principalType: principalTypeForSource(input.authSource),
          authSource: input.authSource === "unknown" ? "system" : input.authSource,
          apiCredentialId: input.apiCredentialId ?? null,
          apiAccessTokenId: input.apiAccessTokenId ?? null,
          externalSubjectRef: input.externalSubjectRef ?? input.sessionId ?? null,
          displayLabel: input.displayLabel ?? null,
          lastSeenAt: now,
          lastAuthenticatedAt:
            input.authSource === "session" ||
            input.authSource === "api_key" ||
            input.authSource === "access_token"
              ? now
              : undefined,
          metadata: input.metadata ?? {},
        },
      })
      .returning();

    return row ?? null;
  });
}

/**
 * Append one auth access event.
 *
 * This function is intentionally resilient:
 * - if auth-observability tables are not migrated yet, it no-ops,
 * - if tables exist, it appends one structured row for forensic/ops analysis.
 */
export async function recordAuthAccessEvent(input: RecordAuthAccessEventInput) {
  return runIfObservabilityAvailable(async () => {
    const principal = await ensureAuthPrincipal({
      authSource: input.authSource,
      ownerUserId: input.ownerUserId ?? null,
      bizId: input.bizId ?? null,
      sessionId: input.sessionId ?? null,
      apiCredentialId: input.apiCredentialId ?? null,
      apiAccessTokenId: input.apiAccessTokenId ?? null,
      externalSubjectRef: null,
      metadata: {},
    });

    const [event] = await db
      .insert(authAccessEvents)
      .values({
        bizId: input.bizId ?? null,
        authPrincipalId: principal?.id ?? null,
        ownerUserId: input.ownerUserId ?? null,
        apiCredentialId: input.apiCredentialId ?? null,
        apiAccessTokenId: input.apiAccessTokenId ?? null,
        authSource: input.authSource,
        eventType: input.eventType,
        decision: input.decision,
        reasonCode: input.reasonCode ?? null,
        reasonMessage: input.reasonMessage ?? null,
        httpMethod: input.httpMethod ?? null,
        httpPath: input.httpPath ?? null,
        httpStatus: input.httpStatus ?? null,
        requestId: input.requestId ?? null,
        sourceIp: input.sourceIp ?? null,
        userAgent: input.userAgent ?? null,
        principalHint: input.principalHint ?? null,
        eventData: input.eventData ?? {},
      })
      .returning();
    return event ?? null;
  });
}

/**
 * Convenience helper for request-bound auth logging.
 */
export async function recordRequestAuthEvent(
  headers: Headers,
  input: Omit<RecordAuthAccessEventInput, "sourceIp" | "userAgent"> & {
    sourceIp?: string | null;
    userAgent?: string | null;
  },
) {
  const attempted = detectAuthAttemptFromHeaders(headers);
  return recordAuthAccessEvent({
    ...input,
    principalHint: input.principalHint ?? attempted.principalHint ?? null,
    sourceIp: input.sourceIp ?? sourceIpFromHeaders(headers),
    userAgent: input.userAgent ?? headers.get("user-agent"),
  });
}

/**
 * Read auth events with simple filters.
 */
export async function listAuthAccessEvents(input: ListAuthAccessEventsInput = {}) {
  return runIfObservabilityAvailable(async () => {
    const limit = Math.min(Math.max(input.limit ?? 100, 1), 1000);
    return db.query.authAccessEvents.findMany({
      where: and(
        input.ownerUserId ? eq(authAccessEvents.ownerUserId, input.ownerUserId) : undefined,
        input.bizId ? eq(authAccessEvents.bizId, input.bizId) : undefined,
        input.authSource ? eq(authAccessEvents.authSource, input.authSource) : undefined,
        input.decision ? eq(authAccessEvents.decision, input.decision) : undefined,
        input.eventType ? eq(authAccessEvents.eventType, input.eventType) : undefined,
        input.occurredFrom ? gte(authAccessEvents.occurredAt, input.occurredFrom) : undefined,
        input.occurredTo ? lte(authAccessEvents.occurredAt, input.occurredTo) : undefined,
      ),
      orderBy: [desc(authAccessEvents.occurredAt), desc(authAccessEvents.id)],
      limit,
    });
  });
}

/**
 * Return auth principal inventory rows.
 */
export async function listAuthPrincipals(input: {
  ownerUserId?: string | null;
  bizId?: string | null;
  limit?: number;
} = {}) {
  return runIfObservabilityAvailable(async () => {
    const limit = Math.min(Math.max(input.limit ?? 100, 1), 1000);
    return db.query.authPrincipals.findMany({
      where: and(
        input.ownerUserId ? eq(authPrincipals.ownerUserId, input.ownerUserId) : undefined,
        input.bizId ? eq(authPrincipals.bizId, input.bizId) : undefined,
        sql`"deleted_at" IS NULL`,
      ),
      orderBy: [desc(authPrincipals.lastSeenAt), desc(authPrincipals.id)],
      limit,
    });
  });
}
