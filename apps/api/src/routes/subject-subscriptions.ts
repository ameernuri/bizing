/**
 * Subject-subscription routes (biz-scoped).
 *
 * ELI5:
 * - A "subject subscription" means "this identity wants updates about that subject".
 * - Subject can be anything in the shared `subjects` registry (offer, resource,
 *   custom plugin entity, etc.).
 * - These endpoints provide first-class API support for:
 *   - subscriber identity linkage,
 *   - lifecycle status (active/muted/unsubscribed),
 *   - delivery mode/channel preferences,
 *   - delivery throttling controls,
 *   - tenant-safe target binding.
 */

import { Hono } from "hono";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import dbPackage from "@bizing/db";
import {
  getCurrentUser,
  requireAclPermission,
  requireAuth,
  requireBizAccess,
} from "../middleware/auth.js";
import { fail, ok, parsePositiveInt } from "./_api.js";

const {
  db,
  graphIdentities,
  graphSubjectSubscriptions,
  subjects,
} = dbPackage;

function isKnownOrCustom(value: string, known: readonly string[]) {
  return known.includes(value) || value.startsWith("custom_");
}

function sanitizeHandle(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 100);
}

function randomHandleSuffix() {
  return Math.random().toString(36).slice(2, 8);
}

type GraphIdentityRow = typeof graphIdentities.$inferSelect;

async function ensureUserGraphIdentity(input: {
  userId: string;
  email?: string;
}): Promise<GraphIdentityRow> {
  const existing = await db.query.graphIdentities.findFirst({
    where: and(
      eq(graphIdentities.ownerType, "user"),
      eq(graphIdentities.ownerUserId, input.userId),
      sql`"deleted_at" IS NULL`,
    ),
  });
  if (existing) return existing;

  const base = sanitizeHandle((input.email ?? "").split("@")[0] || `user_${input.userId.slice(-8)}`) || `user_${input.userId.slice(-8)}`;
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const handle = attempt === 0 ? base : `${base}_${randomHandleSuffix()}`.slice(0, 140);
    try {
      const [created] = await db
        .insert(graphIdentities)
        .values({
          ownerType: "user",
          ownerUserId: input.userId,
          handle,
          displayName: input.email ?? `User ${input.userId.slice(-6)}`,
          status: "active",
          isDiscoverable: true,
          metadata: {
            source: "subject-subscriptions-api",
          },
        })
        .returning();
      if (created) return created;
    } catch (error) {
      lastError = error;
    }
  }

  const afterConflict = await db.query.graphIdentities.findFirst({
    where: and(
      eq(graphIdentities.ownerType, "user"),
      eq(graphIdentities.ownerUserId, input.userId),
      sql`"deleted_at" IS NULL`,
    ),
  });
  if (afterConflict) return afterConflict;

  throw lastError instanceof Error
    ? lastError
    : new Error("Could not create or resolve graph identity for user.");
}

const listQuerySchema = z.object({
  page: z.string().optional(),
  perPage: z.string().optional(),
  subscriberIdentityId: z.string().optional(),
  status: z.string().optional(),
  subscriptionType: z.string().optional(),
  deliveryMode: z.string().optional(),
  preferredChannel: z.string().optional(),
  targetSubjectType: z.string().optional(),
  targetSubjectId: z.string().optional(),
});

const createBodySchema = z.object({
  targetSubjectBizId: z.string().optional(),
  targetSubjectType: z.string().min(1).max(80),
  targetSubjectId: z.string().min(1).max(140),
  targetDisplayName: z.string().max(240).optional(),
  targetCategory: z.string().max(80).optional(),
  subscriptionType: z.string().default("watch"),
  status: z.string().default("active"),
  deliveryMode: z.string().default("instant"),
  preferredChannel: z.string().default("in_app"),
  minDeliveryIntervalMinutes: z.number().int().min(0).default(0),
  filterPolicy: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
  autoRegisterTargetSubject: z.boolean().default(true),
});

const updateBodySchema = z.object({
  subscriptionType: z.string().optional(),
  status: z.string().optional(),
  deliveryMode: z.string().optional(),
  preferredChannel: z.string().optional(),
  minDeliveryIntervalMinutes: z.number().int().min(0).optional(),
  filterPolicy: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const subjectSubscriptionRoutes = new Hono();

subjectSubscriptionRoutes.get(
  "/bizes/:bizId/subject-subscriptions",
  requireAuth,
  requireBizAccess("bizId"),
  requireAclPermission("bizes.read", { bizIdParam: "bizId" }),
  async (c) => {
    const bizId = c.req.param("bizId");
    const parsed = listQuerySchema.safeParse(c.req.query());
    if (!parsed.success) {
      return fail(c, "VALIDATION_ERROR", "Invalid query parameters.", 400, parsed.error.flatten());
    }

    const pageNum = parsePositiveInt(parsed.data.page, 1);
    const perPageNum = Math.min(parsePositiveInt(parsed.data.perPage, 20), 100);

    const where = and(
      eq(graphSubjectSubscriptions.targetSubjectBizId, bizId),
      sql`"deleted_at" IS NULL`,
      parsed.data.subscriberIdentityId
        ? eq(graphSubjectSubscriptions.subscriberIdentityId, parsed.data.subscriberIdentityId)
        : undefined,
      parsed.data.status ? eq(graphSubjectSubscriptions.status, parsed.data.status) : undefined,
      parsed.data.subscriptionType
        ? eq(graphSubjectSubscriptions.subscriptionType, parsed.data.subscriptionType)
        : undefined,
      parsed.data.deliveryMode
        ? eq(graphSubjectSubscriptions.deliveryMode, parsed.data.deliveryMode)
        : undefined,
      parsed.data.preferredChannel
        ? eq(graphSubjectSubscriptions.preferredChannel, parsed.data.preferredChannel)
        : undefined,
      parsed.data.targetSubjectType
        ? eq(graphSubjectSubscriptions.targetSubjectType, parsed.data.targetSubjectType)
        : undefined,
      parsed.data.targetSubjectId
        ? eq(graphSubjectSubscriptions.targetSubjectId, parsed.data.targetSubjectId)
        : undefined,
    );

    const [rows, countRows] = await Promise.all([
      db.query.graphSubjectSubscriptions.findMany({
        where,
        orderBy: desc(graphSubjectSubscriptions.id),
        limit: perPageNum,
        offset: (pageNum - 1) * perPageNum,
      }),
      db
        .select({ count: sql<number>`count(*)`.mapWith(Number) })
        .from(graphSubjectSubscriptions)
        .where(where),
    ]);

    const total = countRows[0]?.count ?? 0;
    return ok(c, rows, 200, {
      pagination: {
        page: pageNum,
        perPage: perPageNum,
        total,
        hasMore: pageNum * perPageNum < total,
      },
    });
  },
);

subjectSubscriptionRoutes.post(
  "/bizes/:bizId/subject-subscriptions",
  requireAuth,
  requireBizAccess("bizId"),
  requireAclPermission("bizes.update", { bizIdParam: "bizId" }),
  async (c) => {
    const bizId = c.req.param("bizId");
    const user = getCurrentUser(c);
    if (!user) return fail(c, "UNAUTHORIZED", "Authentication required.", 401);

    const body = await c.req.json().catch(() => null);
    const parsed = createBodySchema.safeParse(body);
    if (!parsed.success) {
      return fail(c, "VALIDATION_ERROR", "Invalid request body.", 400, parsed.error.flatten());
    }

    const targetSubjectBizId = parsed.data.targetSubjectBizId ?? bizId;
    if (targetSubjectBizId !== bizId) {
      return fail(
        c,
        "VALIDATION_ERROR",
        "Cross-biz target linkage is not allowed on this endpoint.",
        400,
      );
    }

    if (!isKnownOrCustom(parsed.data.subscriptionType, ["watch", "follow", "favorite", "notify"])) {
      return fail(c, "VALIDATION_ERROR", "Unsupported subscriptionType.", 400);
    }
    if (!isKnownOrCustom(parsed.data.status, ["active", "muted", "unsubscribed"])) {
      return fail(c, "VALIDATION_ERROR", "Unsupported status.", 400);
    }
    if (!isKnownOrCustom(parsed.data.deliveryMode, ["off", "instant", "digest"])) {
      return fail(c, "VALIDATION_ERROR", "Unsupported deliveryMode.", 400);
    }
    if (!isKnownOrCustom(parsed.data.preferredChannel, ["in_app", "email", "sms", "push", "webhook"])) {
      return fail(c, "VALIDATION_ERROR", "Unsupported preferredChannel.", 400);
    }

    const identity = await ensureUserGraphIdentity({
      userId: user.id,
      email: user.email,
    });

    const targetSubjectWhere = and(
      eq(subjects.bizId, targetSubjectBizId),
      eq(subjects.subjectType, parsed.data.targetSubjectType),
      eq(subjects.subjectId, parsed.data.targetSubjectId),
      sql`"deleted_at" IS NULL`,
    );
    let targetSubject = await db.query.subjects.findFirst({ where: targetSubjectWhere });

    if (!targetSubject && parsed.data.autoRegisterTargetSubject) {
      await db
        .insert(subjects)
        .values({
          bizId: targetSubjectBizId,
          subjectType: parsed.data.targetSubjectType,
          subjectId: parsed.data.targetSubjectId,
          displayName: parsed.data.targetDisplayName ?? parsed.data.targetSubjectId,
          category: parsed.data.targetCategory ?? "subscription_target",
          status: "active",
          isLinkable: true,
          metadata: {
            source: "subject-subscriptions-api",
          },
        })
        .onConflictDoNothing();
      targetSubject = await db.query.subjects.findFirst({ where: targetSubjectWhere });
    }

    if (!targetSubject) {
      return fail(
        c,
        "NOT_FOUND",
        "Target subject does not exist and auto registration is disabled.",
        404,
      );
    }

    const existing = await db.query.graphSubjectSubscriptions.findFirst({
      where: and(
        eq(graphSubjectSubscriptions.subscriberIdentityId, identity.id),
        eq(graphSubjectSubscriptions.targetSubjectBizId, targetSubjectBizId),
        eq(graphSubjectSubscriptions.targetSubjectType, parsed.data.targetSubjectType),
        eq(graphSubjectSubscriptions.targetSubjectId, parsed.data.targetSubjectId),
        eq(graphSubjectSubscriptions.subscriptionType, parsed.data.subscriptionType),
        sql`"deleted_at" IS NULL`,
      ),
    });
    if (existing) return ok(c, existing);

    const [created] = await db
      .insert(graphSubjectSubscriptions)
      .values({
        subscriberIdentityId: identity.id,
        targetSubjectBizId,
        targetSubjectType: parsed.data.targetSubjectType,
        targetSubjectId: parsed.data.targetSubjectId,
        subscriptionType: parsed.data.subscriptionType,
        status: parsed.data.status,
        deliveryMode: parsed.data.deliveryMode,
        preferredChannel: parsed.data.preferredChannel,
        minDeliveryIntervalMinutes: parsed.data.minDeliveryIntervalMinutes,
        filterPolicy: parsed.data.filterPolicy ?? {},
        metadata: parsed.data.metadata ?? {},
      })
      .returning();

    return ok(c, created, 201);
  },
);

subjectSubscriptionRoutes.patch(
  "/bizes/:bizId/subject-subscriptions/:subscriptionId",
  requireAuth,
  requireBizAccess("bizId"),
  requireAclPermission("bizes.update", { bizIdParam: "bizId" }),
  async (c) => {
    const bizId = c.req.param("bizId");
    const subscriptionId = c.req.param("subscriptionId");

    const body = await c.req.json().catch(() => null);
    const parsed = updateBodySchema.safeParse(body);
    if (!parsed.success) {
      return fail(c, "VALIDATION_ERROR", "Invalid request body.", 400, parsed.error.flatten());
    }

    const existing = await db.query.graphSubjectSubscriptions.findFirst({
      where: and(
        eq(graphSubjectSubscriptions.id, subscriptionId),
        eq(graphSubjectSubscriptions.targetSubjectBizId, bizId),
        sql`"deleted_at" IS NULL`,
      ),
    });
    if (!existing) return fail(c, "NOT_FOUND", "Subscription not found.", 404);

    if (
      parsed.data.subscriptionType &&
      !isKnownOrCustom(parsed.data.subscriptionType, ["watch", "follow", "favorite", "notify"])
    ) {
      return fail(c, "VALIDATION_ERROR", "Unsupported subscriptionType.", 400);
    }
    if (
      parsed.data.status &&
      !isKnownOrCustom(parsed.data.status, ["active", "muted", "unsubscribed"])
    ) {
      return fail(c, "VALIDATION_ERROR", "Unsupported status.", 400);
    }
    if (
      parsed.data.deliveryMode &&
      !isKnownOrCustom(parsed.data.deliveryMode, ["off", "instant", "digest"])
    ) {
      return fail(c, "VALIDATION_ERROR", "Unsupported deliveryMode.", 400);
    }
    if (
      parsed.data.preferredChannel &&
      !isKnownOrCustom(parsed.data.preferredChannel, ["in_app", "email", "sms", "push", "webhook"])
    ) {
      return fail(c, "VALIDATION_ERROR", "Unsupported preferredChannel.", 400);
    }

    const now = new Date();
    const nextMutedAt =
      parsed.data.status === "muted"
        ? now
        : parsed.data.status === "active"
          ? null
          : existing.mutedAt;
    const nextUnsubscribedAt =
      parsed.data.status === "unsubscribed"
        ? now
        : parsed.data.status === "active"
          ? null
          : existing.unsubscribedAt;

    const [updated] = await db
      .update(graphSubjectSubscriptions)
      .set({
        subscriptionType: parsed.data.subscriptionType,
        status: parsed.data.status,
        deliveryMode: parsed.data.deliveryMode,
        preferredChannel: parsed.data.preferredChannel,
        minDeliveryIntervalMinutes: parsed.data.minDeliveryIntervalMinutes,
        filterPolicy: parsed.data.filterPolicy,
        metadata: parsed.data.metadata,
        mutedAt: nextMutedAt,
        unsubscribedAt: nextUnsubscribedAt,
      })
      .where(
        and(
          eq(graphSubjectSubscriptions.id, subscriptionId),
          eq(graphSubjectSubscriptions.targetSubjectBizId, bizId),
        ),
      )
      .returning();

    return ok(c, updated);
  },
);
