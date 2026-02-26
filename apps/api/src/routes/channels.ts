/**
 * Channel integration routes (biz-scoped).
 *
 * ELI5:
 * - Channel account: one external connector account (Google/ClassPass/custom).
 * - Sync state: last known sync cursor + health for an object type.
 * - Entity link: mapping between local object and external provider object id.
 *
 * Why these routes exist:
 * - Saga lifecycle checks must verify external integration setup through API,
 *   not by writing metadata directly.
 * - These endpoints provide the minimal canonical integration backbone needed by
 *   current use-cases while staying generic for future connectors.
 */

import { Hono } from "hono";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import dbPackage from "@bizing/db";
import { requireAclPermission, requireAuth, requireBizAccess } from "../middleware/auth.js";
import { fail, ok, parsePositiveInt } from "./_api.js";

const { db, channelAccounts, channelSyncStates, channelEntityLinks } = dbPackage;

const listAccountsQuerySchema = z.object({
  page: z.string().optional(),
  perPage: z.string().optional(),
  provider: z
    .enum([
      "google_reserve",
      "classpass",
      "instagram",
      "facebook",
      "meta_messenger",
      "custom",
    ])
    .optional(),
  status: z.enum(["active", "inactive", "error", "revoked"]).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
});

const createAccountBodySchema = z.object({
  provider: z.enum([
    "google_reserve",
    "classpass",
    "instagram",
    "facebook",
    "meta_messenger",
    "custom",
  ]),
  name: z.string().min(1).max(180),
  status: z.enum(["active", "inactive", "error", "revoked"]).default("active"),
  providerAccountRef: z.string().max(200).optional(),
  scopes: z.array(z.string()).optional(),
  authConfig: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const listSyncStatesQuerySchema = z.object({
  channelAccountId: z.string().optional(),
  objectType: z
    .enum([
      "offer_version",
      "availability",
      "booking_order",
      "customer",
      "resource",
      "class_session",
      "custom",
    ])
    .optional(),
});

const upsertSyncStateBodySchema = z.object({
  channelAccountId: z.string().min(1),
  objectType: z.enum([
    "offer_version",
    "availability",
    "booking_order",
    "customer",
    "resource",
    "class_session",
    "custom",
  ]),
  direction: z.enum(["inbound", "outbound", "bidirectional"]),
  inboundCursor: z.string().max(500).optional(),
  outboundCursor: z.string().max(500).optional(),
  lastFailure: z.string().max(600).optional(),
  lastAttemptAt: z.string().datetime().optional(),
  lastSuccessAt: z.string().datetime().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const listEntityLinksQuerySchema = z.object({
  channelAccountId: z.string().optional(),
  objectType: z
    .enum([
      "offer_version",
      "availability",
      "booking_order",
      "customer",
      "resource",
      "class_session",
      "custom",
    ])
    .optional(),
  isActive: z.enum(["true", "false"]).optional(),
  page: z.string().optional(),
  perPage: z.string().optional(),
});

const createEntityLinkBodySchema = z
  .object({
    channelAccountId: z.string().min(1),
    objectType: z.enum([
      "offer_version",
      "availability",
      "booking_order",
      "customer",
      "resource",
      "class_session",
      "custom",
    ]),
    offerVersionId: z.string().optional(),
    bookingOrderId: z.string().optional(),
    resourceId: z.string().optional(),
    customerUserId: z.string().optional(),
    localReferenceKey: z.string().max(200).optional(),
    externalObjectId: z.string().min(1).max(200),
    externalParentId: z.string().max(200).optional(),
    syncHash: z.string().max(140).optional(),
    isActive: z.boolean().default(true),
    metadata: z.record(z.unknown()).optional(),
  })
  .superRefine((value, ctx) => {
    const hasOffer = Boolean(value.offerVersionId);
    const hasBooking = Boolean(value.bookingOrderId);
    const hasResource = Boolean(value.resourceId);
    const hasCustomer = Boolean(value.customerUserId);
    const hasLocalRef = Boolean(value.localReferenceKey);

    const refsCount = [hasOffer, hasBooking, hasResource, hasCustomer].filter(Boolean).length;

    if (value.objectType === "offer_version" && !hasOffer) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "offerVersionId is required when objectType is offer_version.",
      });
    }
    if (value.objectType === "booking_order" && !hasBooking) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "bookingOrderId is required when objectType is booking_order.",
      });
    }
    if (value.objectType === "resource" && !hasResource) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "resourceId is required when objectType is resource.",
      });
    }
    if (value.objectType === "customer" && !hasCustomer) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "customerUserId is required when objectType is customer.",
      });
    }
    if (
      (value.objectType === "availability" ||
        value.objectType === "class_session" ||
        value.objectType === "custom") &&
      !hasLocalRef
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "localReferenceKey is required for availability/class_session/custom object types.",
      });
    }
    if (
      value.objectType === "offer_version" ||
      value.objectType === "booking_order" ||
      value.objectType === "resource" ||
      value.objectType === "customer"
    ) {
      if (refsCount !== 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Exactly one local id field must be set for this objectType.",
        });
      }
    }
  });

export const channelRoutes = new Hono();

channelRoutes.get(
  "/bizes/:bizId/channel-accounts",
  requireAuth,
  requireBizAccess("bizId"),
  requireAclPermission("bizes.read", { bizIdParam: "bizId" }),
  async (c) => {
    const bizId = c.req.param("bizId");
    const parsed = listAccountsQuerySchema.safeParse(c.req.query());
    if (!parsed.success) {
      return fail(c, "VALIDATION_ERROR", "Invalid query parameters.", 400, parsed.error.flatten());
    }

    const pageNum = parsePositiveInt(parsed.data.page, 1);
    const perPageNum = Math.min(parsePositiveInt(parsed.data.perPage, 20), 100);
    const where = and(
      eq(channelAccounts.bizId, bizId),
      parsed.data.provider ? eq(channelAccounts.provider, parsed.data.provider) : undefined,
      parsed.data.status ? eq(channelAccounts.status, parsed.data.status) : undefined,
    );
    const orderByExpr =
      parsed.data.sortOrder === "asc" ? asc(channelAccounts.id) : desc(channelAccounts.id);

    const [rows, countRows] = await Promise.all([
      db.query.channelAccounts.findMany({
        where,
        orderBy: orderByExpr,
        limit: perPageNum,
        offset: (pageNum - 1) * perPageNum,
      }),
      db
        .select({ count: sql<number>`count(*)`.mapWith(Number) })
        .from(channelAccounts)
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

channelRoutes.post(
  "/bizes/:bizId/channel-accounts",
  requireAuth,
  requireBizAccess("bizId"),
  requireAclPermission("bizes.update", { bizIdParam: "bizId" }),
  async (c) => {
    const bizId = c.req.param("bizId");
    const body = await c.req.json().catch(() => null);
    const parsed = createAccountBodySchema.safeParse(body);
    if (!parsed.success) {
      return fail(c, "VALIDATION_ERROR", "Invalid request body.", 400, parsed.error.flatten());
    }

    const [created] = await db
      .insert(channelAccounts)
      .values({
        bizId,
        provider: parsed.data.provider,
        name: parsed.data.name,
        status: parsed.data.status,
        providerAccountRef: parsed.data.providerAccountRef,
        scopes: parsed.data.scopes ?? [],
        authConfig: parsed.data.authConfig ?? {},
        metadata: parsed.data.metadata ?? {},
      })
      .returning();

    return ok(c, created, 201);
  },
);

channelRoutes.get(
  "/bizes/:bizId/channel-sync-states",
  requireAuth,
  requireBizAccess("bizId"),
  requireAclPermission("bizes.read", { bizIdParam: "bizId" }),
  async (c) => {
    const bizId = c.req.param("bizId");
    const parsed = listSyncStatesQuerySchema.safeParse(c.req.query());
    if (!parsed.success) {
      return fail(c, "VALIDATION_ERROR", "Invalid query parameters.", 400, parsed.error.flatten());
    }

    const rows = await db.query.channelSyncStates.findMany({
      where: and(
        eq(channelSyncStates.bizId, bizId),
        parsed.data.channelAccountId
          ? eq(channelSyncStates.channelAccountId, parsed.data.channelAccountId)
          : undefined,
        parsed.data.objectType ? eq(channelSyncStates.objectType, parsed.data.objectType) : undefined,
      ),
      orderBy: desc(channelSyncStates.id),
      limit: 200,
    });

    return ok(c, rows);
  },
);

channelRoutes.post(
  "/bizes/:bizId/channel-sync-states",
  requireAuth,
  requireBizAccess("bizId"),
  requireAclPermission("bizes.update", { bizIdParam: "bizId" }),
  async (c) => {
    const bizId = c.req.param("bizId");
    const body = await c.req.json().catch(() => null);
    const parsed = upsertSyncStateBodySchema.safeParse(body);
    if (!parsed.success) {
      return fail(c, "VALIDATION_ERROR", "Invalid request body.", 400, parsed.error.flatten());
    }

    const account = await db.query.channelAccounts.findFirst({
      where: and(
        eq(channelAccounts.bizId, bizId),
        eq(channelAccounts.id, parsed.data.channelAccountId),
      ),
    });
    if (!account) return fail(c, "NOT_FOUND", "Channel account not found.", 404);

    const [row] = await db
      .insert(channelSyncStates)
      .values({
        bizId,
        channelAccountId: parsed.data.channelAccountId,
        objectType: parsed.data.objectType,
        direction: parsed.data.direction,
        inboundCursor: parsed.data.inboundCursor,
        outboundCursor: parsed.data.outboundCursor,
        lastFailure: parsed.data.lastFailure,
        lastAttemptAt: parsed.data.lastAttemptAt ? new Date(parsed.data.lastAttemptAt) : undefined,
        lastSuccessAt: parsed.data.lastSuccessAt ? new Date(parsed.data.lastSuccessAt) : undefined,
        metadata: parsed.data.metadata ?? {},
      })
      .onConflictDoUpdate({
        target: [
          channelSyncStates.channelAccountId,
          channelSyncStates.objectType,
          channelSyncStates.direction,
        ],
        set: {
          inboundCursor: parsed.data.inboundCursor,
          outboundCursor: parsed.data.outboundCursor,
          lastFailure: parsed.data.lastFailure,
          lastAttemptAt: parsed.data.lastAttemptAt
            ? new Date(parsed.data.lastAttemptAt)
            : undefined,
          lastSuccessAt: parsed.data.lastSuccessAt
            ? new Date(parsed.data.lastSuccessAt)
            : undefined,
          metadata: parsed.data.metadata ?? {},
        },
      })
      .returning();

    return ok(c, row, 201);
  },
);

channelRoutes.get(
  "/bizes/:bizId/channel-entity-links",
  requireAuth,
  requireBizAccess("bizId"),
  requireAclPermission("bizes.read", { bizIdParam: "bizId" }),
  async (c) => {
    const bizId = c.req.param("bizId");
    const parsed = listEntityLinksQuerySchema.safeParse(c.req.query());
    if (!parsed.success) {
      return fail(c, "VALIDATION_ERROR", "Invalid query parameters.", 400, parsed.error.flatten());
    }

    const pageNum = parsePositiveInt(parsed.data.page, 1);
    const perPageNum = Math.min(parsePositiveInt(parsed.data.perPage, 20), 100);

    const where = and(
      eq(channelEntityLinks.bizId, bizId),
      parsed.data.channelAccountId
        ? eq(channelEntityLinks.channelAccountId, parsed.data.channelAccountId)
        : undefined,
      parsed.data.objectType ? eq(channelEntityLinks.objectType, parsed.data.objectType) : undefined,
      parsed.data.isActive
        ? eq(channelEntityLinks.isActive, parsed.data.isActive === "true")
        : undefined,
    );

    const [rows, countRows] = await Promise.all([
      db.query.channelEntityLinks.findMany({
        where,
        orderBy: desc(channelEntityLinks.id),
        limit: perPageNum,
        offset: (pageNum - 1) * perPageNum,
      }),
      db
        .select({ count: sql<number>`count(*)`.mapWith(Number) })
        .from(channelEntityLinks)
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

channelRoutes.post(
  "/bizes/:bizId/channel-entity-links",
  requireAuth,
  requireBizAccess("bizId"),
  requireAclPermission("bizes.update", { bizIdParam: "bizId" }),
  async (c) => {
    const bizId = c.req.param("bizId");
    const body = await c.req.json().catch(() => null);
    const parsed = createEntityLinkBodySchema.safeParse(body);
    if (!parsed.success) {
      return fail(c, "VALIDATION_ERROR", "Invalid request body.", 400, parsed.error.flatten());
    }

    const account = await db.query.channelAccounts.findFirst({
      where: and(
        eq(channelAccounts.bizId, bizId),
        eq(channelAccounts.id, parsed.data.channelAccountId),
      ),
    });
    if (!account) return fail(c, "NOT_FOUND", "Channel account not found.", 404);

    const [created] = await db
      .insert(channelEntityLinks)
      .values({
        bizId,
        channelAccountId: parsed.data.channelAccountId,
        objectType: parsed.data.objectType,
        offerVersionId: parsed.data.offerVersionId,
        bookingOrderId: parsed.data.bookingOrderId,
        resourceId: parsed.data.resourceId,
        customerUserId: parsed.data.customerUserId,
        localReferenceKey: parsed.data.localReferenceKey,
        externalObjectId: parsed.data.externalObjectId,
        externalParentId: parsed.data.externalParentId,
        syncHash: parsed.data.syncHash,
        isActive: parsed.data.isActive,
        metadata: parsed.data.metadata ?? {},
      })
      .returning();

    return ok(c, created, 201);
  },
);
