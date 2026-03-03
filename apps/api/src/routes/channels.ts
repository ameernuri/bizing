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
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import dbPackage from "@bizing/db";
import { requireAclPermission, requireAuth, requireBizAccess } from "../middleware/auth.js";
import { executeCrudRouteAction } from "../services/action-route-bridge.js";
import { fail, ok, parsePositiveInt } from "./_api.js";

const { db, channelAccounts, channelSyncStates, channelEntityLinks, bookingOrders, offerVersions } = dbPackage;

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

const channelInsightsQuerySchema = z.object({
  provider: z
    .enum(["google_reserve", "classpass", "instagram", "facebook", "meta_messenger", "custom"])
    .optional(),
})

const createExternalBookingBodySchema = z.object({
  offerId: z.string(),
  offerVersionId: z.string(),
  externalBookingId: z.string().min(1).max(200),
  externalMemberId: z.string().min(1).max(200),
  memberDisplayName: z.string().min(1).max(160),
  confirmedStartAt: z.string().datetime(),
  confirmedEndAt: z.string().datetime(),
  directPriceMinor: z.number().int().min(0),
  channelPriceMinor: z.number().int().min(0),
  currency: z.string().regex(/^[A-Z]{3}$/).default("USD"),
  metadata: z.record(z.unknown()).optional(),
})

const markExternalAttendanceBodySchema = z.object({
  attendanceStatus: z.enum(["attended", "no_show"]),
  reason: z.string().max(240).optional(),
  metadata: z.record(z.unknown()).optional(),
})

const capacityAllocationQuerySchema = z.object({
  offerVersionId: z.string(),
})

const createSocialBookingLinkBodySchema = z.object({
  offerId: z.string(),
  offerVersionId: z.string(),
  surface: z.enum(['instagram_bio', 'instagram_story', 'facebook_page', 'facebook_messenger']),
  mobileOptimized: z.boolean().default(true),
  miniBookingInterface: z.boolean().default(true),
  serviceSelectionEnabled: z.boolean().default(true),
  timePickerEnabled: z.boolean().default(true),
  embedMode: z.enum(['in_app_browser', 'messenger', 'native_redirect']).default('in_app_browser'),
  metadata: z.record(z.unknown()).optional(),
})

const listSocialBookingLinksQuerySchema = z.object({
  provider: z.enum(['instagram', 'facebook', 'meta_messenger']).optional(),
})

export const channelRoutes = new Hono();

async function createChannelRow(
  c: Parameters<typeof executeCrudRouteAction>[0]["c"],
  bizId: string,
  tableKey: string,
  data: Record<string, unknown>,
  options?: {
    subjectType?: string;
    subjectId?: string;
    displayName?: string;
    metadata?: Record<string, unknown>;
  },
) {
  const result = await executeCrudRouteAction({
    c,
    bizId,
    tableKey,
    operation: "create",
    data,
    subjectType: options?.subjectType,
    subjectId: options?.subjectId,
    displayName: options?.displayName,
    metadata: options?.metadata,
  });
  if (!result.ok) return fail(c, result.code, result.message, result.httpStatus, result.details);
  return result.row;
}

async function updateChannelRow(
  c: Parameters<typeof executeCrudRouteAction>[0]["c"],
  bizId: string,
  tableKey: string,
  id: string,
  patch: Record<string, unknown>,
  options?: {
    subjectType?: string;
    subjectId?: string;
    displayName?: string;
    metadata?: Record<string, unknown>;
  },
) {
  const result = await executeCrudRouteAction({
    c,
    bizId,
    tableKey,
    operation: "update",
    id,
    patch,
    subjectType: options?.subjectType,
    subjectId: options?.subjectId ?? id,
    displayName: options?.displayName,
    metadata: options?.metadata,
  });
  if (!result.ok) return fail(c, result.code, result.message, result.httpStatus, result.details);
  return result.row;
}

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

    const created = await createChannelRow(c, bizId, "channelAccounts", {
        bizId,
        provider: parsed.data.provider,
        name: parsed.data.name,
        status: parsed.data.status,
        providerAccountRef: parsed.data.providerAccountRef,
        scopes: parsed.data.scopes ?? [],
        authConfig: parsed.data.authConfig ?? {},
        metadata: parsed.data.metadata ?? {},
      }, {
      subjectType: "channel_account",
      displayName: parsed.data.name,
    });
    if (created instanceof Response) return created;

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

    const existingSyncState = await db.query.channelSyncStates.findFirst({
      where: and(
        eq(channelSyncStates.bizId, bizId),
        eq(channelSyncStates.channelAccountId, parsed.data.channelAccountId),
        eq(channelSyncStates.objectType, parsed.data.objectType),
        eq(channelSyncStates.direction, parsed.data.direction),
      ),
    });

    const syncPatch = {
      inboundCursor: parsed.data.inboundCursor,
      outboundCursor: parsed.data.outboundCursor,
      lastFailure: parsed.data.lastFailure,
      lastAttemptAt: parsed.data.lastAttemptAt ? new Date(parsed.data.lastAttemptAt) : undefined,
      lastSuccessAt: parsed.data.lastSuccessAt ? new Date(parsed.data.lastSuccessAt) : undefined,
      metadata: parsed.data.metadata ?? {},
    };

    let row: Record<string, unknown> | Response | null = null;
    if (existingSyncState) {
      row = await updateChannelRow(c, bizId, "channelSyncStates", existingSyncState.id, syncPatch, {
        subjectType: "channel_sync_state",
        displayName: `${parsed.data.objectType}:${parsed.data.direction}`,
      });
    } else {
      row = await createChannelRow(c, bizId, "channelSyncStates", {
        bizId,
        channelAccountId: parsed.data.channelAccountId,
        objectType: parsed.data.objectType,
        direction: parsed.data.direction,
        ...syncPatch,
      }, {
        subjectType: "channel_sync_state",
        displayName: `${parsed.data.objectType}:${parsed.data.direction}`,
      });
    }
    if (row instanceof Response) return row;

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

    const created = await createChannelRow(c, bizId, "channelEntityLinks", {
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
      }, {
      subjectType: "channel_entity_link",
      displayName: parsed.data.externalObjectId,
    });
    if (created instanceof Response) return created;

    return ok(c, created, 201);
  },
);

/**
 * Create one external-partner booking anchored to a channel account.
 *
 * ELI5:
 * A partner app like ClassPass books "through" us, but the booking still
 * belongs in our canonical booking table. This route records:
 * - the local booking,
 * - the external member/booking ids,
 * - the partner-vs-direct pricing delta,
 * - the local/external id mapping.
 */
channelRoutes.post(
  "/bizes/:bizId/channel-accounts/:channelAccountId/external-bookings",
  requireAuth,
  requireBizAccess("bizId"),
  requireAclPermission("booking_orders.update", { bizIdParam: "bizId" }),
  async (c) => {
    const { bizId, channelAccountId } = c.req.param();
    const parsed = createExternalBookingBodySchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return fail(c, "VALIDATION_ERROR", "Invalid request body.", 400, parsed.error.flatten());
    }

    const [account, offerVersion] = await Promise.all([
      db.query.channelAccounts.findFirst({
        where: and(eq(channelAccounts.bizId, bizId), eq(channelAccounts.id, channelAccountId)),
      }),
      db.query.offerVersions.findFirst({
        where: and(eq(offerVersions.bizId, bizId), eq(offerVersions.id, parsed.data.offerVersionId)),
      }),
    ]);
    if (!account) return fail(c, "NOT_FOUND", "Channel account not found.", 404);
    if (!offerVersion || offerVersion.offerId !== parsed.data.offerId) {
      return fail(c, "NOT_FOUND", "Offer version not found.", 404);
    }

    const booking = await createChannelRow(c, bizId, "bookingOrders", {
        bizId,
        offerId: parsed.data.offerId,
        offerVersionId: parsed.data.offerVersionId,
        status: "confirmed",
        currency: parsed.data.currency,
        subtotalMinor: parsed.data.channelPriceMinor,
        taxMinor: 0,
        feeMinor: 0,
        discountMinor: 0,
        totalMinor: parsed.data.channelPriceMinor,
        confirmedStartAt: new Date(parsed.data.confirmedStartAt),
        confirmedEndAt: new Date(parsed.data.confirmedEndAt),
        pricingSnapshot: {
          directPriceMinor: parsed.data.directPriceMinor,
          channelPriceMinor: parsed.data.channelPriceMinor,
          provider: account.provider,
        },
        metadata: {
          sourceChannel: account.provider,
          channelAccountId: account.id,
          externalBookingId: parsed.data.externalBookingId,
          externalMemberId: parsed.data.externalMemberId,
          memberDisplayName: parsed.data.memberDisplayName,
          channelBookingState: "validated",
          channelAttendanceStatus: "pending",
          ...parsed.data.metadata,
        },
      }, {
      subjectType: "booking_order",
      displayName: parsed.data.externalBookingId,
    });
    if (booking instanceof Response) return booking;

    const linkedBooking = booking as Record<string, unknown>;

    const bookingLink = await createChannelRow(c, bizId, "channelEntityLinks", {
      bizId,
      channelAccountId,
      objectType: "booking_order",
      bookingOrderId: linkedBooking.id as string,
      externalObjectId: parsed.data.externalBookingId,
      externalParentId: parsed.data.externalMemberId,
      syncHash: `${parsed.data.externalBookingId}:${parsed.data.externalMemberId}`,
      isActive: true,
      metadata: {
        memberDisplayName: parsed.data.memberDisplayName,
      },
    }, {
      subjectType: "channel_entity_link",
      displayName: parsed.data.externalBookingId,
    });
    if (bookingLink instanceof Response) return bookingLink;

    return ok(c, {
      booking,
      validated: true,
      externalMemberId: parsed.data.externalMemberId,
      payoutExpectedMinor: parsed.data.channelPriceMinor,
    }, 201);
  },
);

channelRoutes.post(
  "/bizes/:bizId/channel-accounts/:channelAccountId/external-bookings/:bookingOrderId/attendance",
  requireAuth,
  requireBizAccess("bizId"),
  requireAclPermission("booking_orders.update", { bizIdParam: "bizId" }),
  async (c) => {
    const { bizId, channelAccountId, bookingOrderId } = c.req.param();
    const parsed = markExternalAttendanceBodySchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return fail(c, "VALIDATION_ERROR", "Invalid request body.", 400, parsed.error.flatten());
    }

    const booking = await db.query.bookingOrders.findFirst({
      where: and(eq(bookingOrders.bizId, bizId), eq(bookingOrders.id, bookingOrderId)),
    });
    if (!booking) return fail(c, "NOT_FOUND", "Booking order not found.", 404);

    const metadata =
      booking.metadata && typeof booking.metadata === "object" && !Array.isArray(booking.metadata)
        ? (booking.metadata as Record<string, unknown>)
        : {};
    if (metadata.channelAccountId !== channelAccountId) {
      return fail(c, "CHANNEL_MISMATCH", "Booking is not linked to this channel account.", 409);
    }

    const attendanceUpdate = await updateChannelRow(c, bizId, "bookingOrders", bookingOrderId, {
        metadata: {
          ...metadata,
          channelAttendanceStatus: parsed.data.attendanceStatus,
          channelAttendanceUpdatedAt: new Date().toISOString(),
          channelNoShowPolicy: parsed.data.attendanceStatus === "no_show" ? "partner_defined" : undefined,
          ...parsed.data.metadata,
        },
      }, {
      subjectType: "booking_order",
      displayName: bookingOrderId,
    });
    if (attendanceUpdate instanceof Response) return attendanceUpdate;

    return ok(c, {
      bookingOrderId,
      attendanceStatus: parsed.data.attendanceStatus,
      noShowPolicy: parsed.data.attendanceStatus === "no_show" ? "partner_defined" : null,
      reason: parsed.data.reason ?? null,
    });
  },
);

channelRoutes.get(
  "/bizes/:bizId/channel-accounts/:channelAccountId/reconciliation",
  requireAuth,
  requireBizAccess("bizId"),
  requireAclPermission("payments.read", { bizIdParam: "bizId" }),
  async (c) => {
    const { bizId, channelAccountId } = c.req.param();
    const links = await db.query.channelEntityLinks.findMany({
      where: and(
        eq(channelEntityLinks.bizId, bizId),
        eq(channelEntityLinks.channelAccountId, channelAccountId),
        eq(channelEntityLinks.objectType, "booking_order"),
        eq(channelEntityLinks.isActive, true),
      ),
      orderBy: [desc(channelEntityLinks.id)],
    });
    const bookingIds = links.map((row) => row.bookingOrderId).filter(Boolean) as string[];
    const bookings = bookingIds.length
      ? await db.query.bookingOrders.findMany({
          where: and(eq(bookingOrders.bizId, bizId), inArray(bookingOrders.id, bookingIds)),
        })
      : [];

    const rows = bookings.map((booking) => {
      const metadata =
        booking.metadata && typeof booking.metadata === "object" && !Array.isArray(booking.metadata)
          ? (booking.metadata as Record<string, unknown>)
          : {};
      const pricing =
        booking.pricingSnapshot && typeof booking.pricingSnapshot === "object" && !Array.isArray(booking.pricingSnapshot)
          ? (booking.pricingSnapshot as Record<string, unknown>)
          : {};
      return {
        bookingOrderId: booking.id,
        externalBookingId: metadata.externalBookingId ?? null,
        externalMemberId: metadata.externalMemberId ?? null,
        attendanceStatus: metadata.channelAttendanceStatus ?? "pending",
        directPriceMinor: typeof pricing.directPriceMinor === "number" ? pricing.directPriceMinor : null,
        channelPriceMinor: typeof pricing.channelPriceMinor === "number" ? pricing.channelPriceMinor : booking.totalMinor,
      };
    });

    return ok(c, {
      bookingCount: rows.length,
      payoutTotalMinor: rows.reduce((sum, row) => sum + (row.channelPriceMinor ?? 0), 0),
      rows,
    });
  },
);

channelRoutes.get(
  "/bizes/:bizId/channel-accounts/:channelAccountId/capacity-allocation",
  requireAuth,
  requireBizAccess("bizId"),
  requireAclPermission("offers.read", { bizIdParam: "bizId" }),
  async (c) => {
    const { bizId, channelAccountId } = c.req.param();
    const parsed = capacityAllocationQuerySchema.safeParse(c.req.query());
    if (!parsed.success) {
      return fail(c, "VALIDATION_ERROR", "Invalid query parameters.", 400, parsed.error.flatten());
    }

    const [account, offerVersion] = await Promise.all([
      db.query.channelAccounts.findFirst({
        where: and(eq(channelAccounts.bizId, bizId), eq(channelAccounts.id, channelAccountId)),
      }),
      db.query.offerVersions.findFirst({
        where: and(eq(offerVersions.bizId, bizId), eq(offerVersions.id, parsed.data.offerVersionId)),
      }),
    ]);
    if (!account) return fail(c, "NOT_FOUND", "Channel account not found.", 404);
    if (!offerVersion) return fail(c, "NOT_FOUND", "Offer version not found.", 404);

    const capacityModel =
      offerVersion.capacityModel && typeof offerVersion.capacityModel === "object" && !Array.isArray(offerVersion.capacityModel)
        ? (offerVersion.capacityModel as Record<string, unknown>)
        : {};
    const channelAllocations =
      capacityModel.channelAllocations && typeof capacityModel.channelAllocations === "object" && !Array.isArray(capacityModel.channelAllocations)
        ? (capacityModel.channelAllocations as Record<string, unknown>)
        : {};
    const allocation =
      channelAllocations[account.provider] && typeof channelAllocations[account.provider] === "object"
        ? (channelAllocations[account.provider] as Record<string, unknown>)
        : {};

    return ok(c, {
      provider: account.provider,
      reservedCount: typeof allocation.reservedCount === "number" ? allocation.reservedCount : 0,
      metadata: allocation,
    });
  },
);

channelRoutes.post(
  '/bizes/:bizId/channel-accounts/:channelAccountId/social-booking-links',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('offers.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, channelAccountId } = c.req.param()
    const parsed = createSocialBookingLinkBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    }

    const account = await db.query.channelAccounts.findFirst({
      where: and(eq(channelAccounts.bizId, bizId), eq(channelAccounts.id, channelAccountId)),
    })
    if (!account) return fail(c, 'NOT_FOUND', 'Channel account not found.', 404)

    const sourceTag = account.provider === 'meta_messenger' ? 'facebook' : account.provider
    const externalObjectId = `${parsed.data.surface}-${parsed.data.offerVersionId}`
    const link = await createChannelRow(c, bizId, "channelEntityLinks", {
        bizId,
        channelAccountId,
        objectType: 'custom',
        offerVersionId: parsed.data.offerVersionId,
        localReferenceKey: `social_booking:${parsed.data.surface}:${parsed.data.offerVersionId}`,
        externalObjectId,
        externalParentId: parsed.data.offerId,
        syncHash: `${account.provider}:${externalObjectId}`,
        isActive: true,
        metadata: {
          sourceTag,
          provider: account.provider,
          surface: parsed.data.surface,
          mobileOptimized: parsed.data.mobileOptimized,
          miniBookingInterface: parsed.data.miniBookingInterface,
          serviceSelectionEnabled: parsed.data.serviceSelectionEnabled,
          timePickerEnabled: parsed.data.timePickerEnabled,
          embedMode: parsed.data.embedMode,
          bookingUrl: `https://social.example.test/${sourceTag}/${externalObjectId}`,
          storyStickerUrl: parsed.data.surface === 'instagram_story' ? `https://social.example.test/sticker/${externalObjectId}` : null,
          messengerEntryPoint: parsed.data.surface === 'facebook_messenger' ? `messenger:${externalObjectId}` : null,
          ...parsed.data.metadata,
        },
      }, {
      subjectType: "channel_entity_link",
      displayName: externalObjectId,
    })
    if (link instanceof Response) return link

    return ok(c, link, 201)
  },
)

channelRoutes.get('/public/bizes/:bizId/social-booking-links', async (c) => {
  const bizId = c.req.param('bizId')
  const parsed = listSocialBookingLinksQuerySchema.safeParse(c.req.query())
  if (!parsed.success) {
    return fail(c, 'VALIDATION_ERROR', 'Invalid query parameters.', 400, parsed.error.flatten())
  }

  const accounts = await db.query.channelAccounts.findMany({
    where: and(
      eq(channelAccounts.bizId, bizId),
      parsed.data.provider ? eq(channelAccounts.provider, parsed.data.provider) : undefined,
    ),
    limit: 200,
  })
  const accountIds = accounts.map((row) => row.id)
  const links = accountIds.length === 0
    ? []
    : await db.query.channelEntityLinks.findMany({
        where: and(
          eq(channelEntityLinks.bizId, bizId),
          inArray(channelEntityLinks.channelAccountId, accountIds),
          eq(channelEntityLinks.objectType, 'custom'),
          eq(channelEntityLinks.isActive, true),
        ),
        orderBy: [desc(channelEntityLinks.id)],
        limit: 200,
      })

  const rows = links.filter((row) => String(row.localReferenceKey ?? '').startsWith('social_booking:')).map((row) => ({
    id: row.id,
    channelAccountId: row.channelAccountId,
    offerVersionId: row.offerVersionId,
    localReferenceKey: row.localReferenceKey,
    metadata: row.metadata,
  }))

  return ok(c, rows)
})

channelRoutes.get(
  "/bizes/:bizId/channel-insights",
  requireAuth,
  requireBizAccess("bizId"),
  requireAclPermission("bizes.read", { bizIdParam: "bizId" }),
  async (c) => {
    const bizId = c.req.param("bizId");
    const parsed = channelInsightsQuerySchema.safeParse(c.req.query());
    if (!parsed.success) {
      return fail(c, "VALIDATION_ERROR", "Invalid query parameters.", 400, parsed.error.flatten());
    }

    const accounts = await db.query.channelAccounts.findMany({
      where: and(
        eq(channelAccounts.bizId, bizId),
        parsed.data.provider ? eq(channelAccounts.provider, parsed.data.provider) : undefined,
      ),
      orderBy: [asc(channelAccounts.provider), asc(channelAccounts.name)],
    });
    const accountIds = accounts.map((row) => row.id);
    if (accountIds.length === 0) {
      return ok(c, {
        provider: parsed.data.provider ?? null,
        accountCount: 0,
        bookingLinkCount: 0,
        offerLinkCount: 0,
        customLinkCount: 0,
        syncStates: [],
        accounts: [],
      });
    }

    const [syncStates, entityLinks] = await Promise.all([
      db.query.channelSyncStates.findMany({
        where: and(eq(channelSyncStates.bizId, bizId), inArray(channelSyncStates.channelAccountId, accountIds)),
        orderBy: [desc(channelSyncStates.lastSuccessAt), desc(channelSyncStates.id)],
      }),
      db.query.channelEntityLinks.findMany({
        where: and(eq(channelEntityLinks.bizId, bizId), inArray(channelEntityLinks.channelAccountId, accountIds)),
        orderBy: [desc(channelEntityLinks.id)],
        limit: 500,
      }),
    ]);

    return ok(c, {
      provider: parsed.data.provider ?? null,
      accountCount: accounts.length,
      bookingLinkCount: entityLinks.filter((row) => row.objectType === "booking_order" && row.isActive).length,
      offerLinkCount: entityLinks.filter((row) => row.objectType === "offer_version" && row.isActive).length,
      customLinkCount: entityLinks.filter((row) => row.objectType === "custom" && row.isActive).length,
      syncStates: syncStates.map((row) => ({
        id: row.id,
        channelAccountId: row.channelAccountId,
        objectType: row.objectType,
        direction: row.direction,
        lastSuccessAt: row.lastSuccessAt,
        lastFailure: row.lastFailure,
        metadata: row.metadata,
      })),
      accounts: accounts.map((row) => ({
        id: row.id,
        provider: row.provider,
        status: row.status,
        name: row.name,
        providerAccountRef: row.providerAccountRef,
        metadata: row.metadata,
      })),
    });
  },
);
