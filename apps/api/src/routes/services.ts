/**
 * Service catalog routes (biz-scoped).
 *
 * ELI5:
 * - `service_groups` organize services into logical buckets ("Hair", "Medical", "Consulting").
 * - `services` define the operational service intent (duration/approval/visibility/policies).
 * - commercial packaging is handled by `service_products` in a separate module.
 *
 * Why this route file exists:
 * - Gives agents/API clients first-class CRUD over service intent primitives.
 * - Keeps ACL explicit so each operation can be permissioned by biz admins.
 */

import { Hono } from "hono";
import { and, asc, desc, eq, ilike, sql } from "drizzle-orm";
import { z } from "zod";
import dbPackage from "@bizing/db";
import {
  requireAclPermission,
  requireAuth,
  requireBizAccess,
} from "../middleware/auth.js";
import { fail, ok, parsePositiveInt } from "./_api.js";

const { db, serviceGroups, services } = dbPackage;

const listServiceGroupsQuerySchema = z.object({
  page: z.string().optional(),
  perPage: z.string().optional(),
  status: z.enum(["draft", "active", "inactive", "archived"]).optional(),
  search: z.string().optional(),
  sortBy: z.enum(["name"]).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
});

const createServiceGroupBodySchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(120).regex(/^[a-z0-9-]+$/),
  description: z.string().max(2000).optional(),
  status: z.enum(["draft", "active", "inactive", "archived"]).default("active"),
  statusConfigValueId: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const updateServiceGroupBodySchema = createServiceGroupBodySchema.partial();

const listServicesQuerySchema = z.object({
  page: z.string().optional(),
  perPage: z.string().optional(),
  serviceGroupId: z.string().optional(),
  status: z.enum(["draft", "active", "inactive", "archived"]).optional(),
  type: z.enum(["appointment", "class", "rental", "multi_day", "call"]).optional(),
  visibility: z.enum(["public", "private", "internal"]).optional(),
  requiresApproval: z.enum(["true", "false"]).optional(),
  allowWaitlist: z.enum(["true", "false"]).optional(),
  search: z.string().optional(),
  sortBy: z.enum(["name"]).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
});

const createServiceBodySchema = z.object({
  serviceGroupId: z.string().min(1),
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  description: z.string().max(2000).optional(),
  type: z.enum(["appointment", "class", "rental", "multi_day", "call"]).default("appointment"),
  typeConfigValueId: z.string().optional(),
  visibility: z.enum(["public", "private", "internal"]).default("public"),
  visibilityConfigValueId: z.string().optional(),
  minAdvanceBookingHours: z.number().int().min(0).nullable().optional(),
  maxAdvanceBookingDays: z.number().int().min(0).nullable().optional(),
  bookingCutoffMinutes: z.number().int().min(0).nullable().optional(),
  requiresApproval: z.boolean().default(false),
  allowWaitlist: z.boolean().default(true),
  allowOverbooking: z.boolean().default(false),
  minCancellationNoticeHours: z.number().int().min(0).nullable().optional(),
  minRescheduleNoticeHours: z.number().int().min(0).nullable().optional(),
  bookingPolicy: z.record(z.unknown()).optional(),
  cancellationPolicy: z.record(z.unknown()).optional(),
  depositPolicy: z.record(z.unknown()).optional(),
  eligibilityPolicy: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
  isSelfBookable: z.boolean().optional(),
  status: z.enum(["draft", "active", "inactive", "archived"]).default("active"),
  statusConfigValueId: z.string().optional(),
});

const updateServiceBodySchema = createServiceBodySchema.partial().omit({ serviceGroupId: true });

export const serviceRoutes = new Hono();

serviceRoutes.get(
  "/bizes/:bizId/service-groups",
  requireAuth,
  requireBizAccess("bizId"),
  requireAclPermission("services.read", { bizIdParam: "bizId" }),
  async (c) => {
    const bizId = c.req.param("bizId");
    const parsed = listServiceGroupsQuerySchema.safeParse(c.req.query());
    if (!parsed.success) {
      return fail(c, "VALIDATION_ERROR", "Invalid query parameters.", 400, parsed.error.flatten());
    }

    const { page, perPage, status, search, sortBy = "name", sortOrder = "desc" } = parsed.data;
    const pageNum = parsePositiveInt(page, 1);
    const perPageNum = Math.min(parsePositiveInt(perPage, 20), 100);

    const where = and(
      eq(serviceGroups.bizId, bizId),
      status ? eq(serviceGroups.status, status) : undefined,
      search ? ilike(serviceGroups.name, `%${search}%`) : undefined,
    );

    const sortColumn = sortBy === "name" ? serviceGroups.name : serviceGroups.name;
    const orderByExpr = sortOrder === "asc" ? asc(sortColumn) : desc(sortColumn);

    const [rows, countRows] = await Promise.all([
      db.query.serviceGroups.findMany({
        where,
        orderBy: orderByExpr,
        limit: perPageNum,
        offset: (pageNum - 1) * perPageNum,
      }),
      db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(serviceGroups).where(where),
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

serviceRoutes.post(
  "/bizes/:bizId/service-groups",
  requireAuth,
  requireBizAccess("bizId"),
  requireAclPermission("services.create", { bizIdParam: "bizId" }),
  async (c) => {
    const bizId = c.req.param("bizId");
    const body = await c.req.json().catch(() => null);
    const parsed = createServiceGroupBodySchema.safeParse(body);
    if (!parsed.success) {
      return fail(c, "VALIDATION_ERROR", "Invalid request body.", 400, parsed.error.flatten());
    }

    const [created] = await db
      .insert(serviceGroups)
      .values({
        bizId,
        name: parsed.data.name,
        slug: parsed.data.slug,
        description: parsed.data.description,
        status: parsed.data.status,
        statusConfigValueId: parsed.data.statusConfigValueId,
        metadata: parsed.data.metadata ?? {},
      })
      .returning();

    return ok(c, created, 201);
  },
);

serviceRoutes.get(
  "/bizes/:bizId/service-groups/:serviceGroupId",
  requireAuth,
  requireBizAccess("bizId"),
  requireAclPermission("services.read", { bizIdParam: "bizId" }),
  async (c) => {
    const { bizId, serviceGroupId } = c.req.param();
    const row = await db.query.serviceGroups.findFirst({
      where: and(eq(serviceGroups.bizId, bizId), eq(serviceGroups.id, serviceGroupId)),
    });
    if (!row) return fail(c, "NOT_FOUND", "Service group not found.", 404);
    return ok(c, row);
  },
);

serviceRoutes.patch(
  "/bizes/:bizId/service-groups/:serviceGroupId",
  requireAuth,
  requireBizAccess("bizId"),
  requireAclPermission("services.update", { bizIdParam: "bizId" }),
  async (c) => {
    const { bizId, serviceGroupId } = c.req.param();
    const body = await c.req.json().catch(() => null);
    const parsed = updateServiceGroupBodySchema.safeParse(body);
    if (!parsed.success) {
      return fail(c, "VALIDATION_ERROR", "Invalid request body.", 400, parsed.error.flatten());
    }

    const existing = await db.query.serviceGroups.findFirst({
      where: and(eq(serviceGroups.bizId, bizId), eq(serviceGroups.id, serviceGroupId)),
    });
    if (!existing) return fail(c, "NOT_FOUND", "Service group not found.", 404);

    const [updated] = await db
      .update(serviceGroups)
      .set({
        ...parsed.data,
      })
      .where(and(eq(serviceGroups.bizId, bizId), eq(serviceGroups.id, serviceGroupId)))
      .returning();

    return ok(c, updated);
  },
);

serviceRoutes.delete(
  "/bizes/:bizId/service-groups/:serviceGroupId",
  requireAuth,
  requireBizAccess("bizId"),
  requireAclPermission("services.archive", { bizIdParam: "bizId" }),
  async (c) => {
    const { bizId, serviceGroupId } = c.req.param();
    const existing = await db.query.serviceGroups.findFirst({
      where: and(eq(serviceGroups.bizId, bizId), eq(serviceGroups.id, serviceGroupId)),
    });
    if (!existing) return fail(c, "NOT_FOUND", "Service group not found.", 404);

    const [updated] = await db
      .update(serviceGroups)
      .set({
        status: "archived",
      })
      .where(and(eq(serviceGroups.bizId, bizId), eq(serviceGroups.id, serviceGroupId)))
      .returning();

    return ok(c, updated);
  },
);

serviceRoutes.get(
  "/bizes/:bizId/services",
  requireAuth,
  requireBizAccess("bizId"),
  requireAclPermission("services.read", { bizIdParam: "bizId" }),
  async (c) => {
    const bizId = c.req.param("bizId");
    const parsed = listServicesQuerySchema.safeParse(c.req.query());
    if (!parsed.success) {
      return fail(c, "VALIDATION_ERROR", "Invalid query parameters.", 400, parsed.error.flatten());
    }

    const {
      page,
      perPage,
      serviceGroupId,
      status,
      type,
      visibility,
      requiresApproval,
      allowWaitlist,
      search,
      sortBy = "name",
      sortOrder = "desc",
    } = parsed.data;

    const pageNum = parsePositiveInt(page, 1);
    const perPageNum = Math.min(parsePositiveInt(perPage, 20), 100);

    const where = and(
      eq(services.bizId, bizId),
      serviceGroupId ? eq(services.serviceGroupId, serviceGroupId) : undefined,
      status ? eq(services.status, status) : undefined,
      type ? eq(services.type, type) : undefined,
      visibility ? eq(services.visibility, visibility) : undefined,
      requiresApproval ? eq(services.requiresApproval, requiresApproval === "true") : undefined,
      allowWaitlist ? eq(services.allowWaitlist, allowWaitlist === "true") : undefined,
      search ? ilike(services.name, `%${search}%`) : undefined,
    );

    const sortColumn = sortBy === "name" ? services.name : services.name;
    const orderByExpr = sortOrder === "asc" ? asc(sortColumn) : desc(sortColumn);

    const [rows, countRows] = await Promise.all([
      db.query.services.findMany({
        where,
        orderBy: orderByExpr,
        limit: perPageNum,
        offset: (pageNum - 1) * perPageNum,
      }),
      db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(services).where(where),
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

serviceRoutes.post(
  "/bizes/:bizId/services",
  requireAuth,
  requireBizAccess("bizId"),
  requireAclPermission("services.create", { bizIdParam: "bizId" }),
  async (c) => {
    const bizId = c.req.param("bizId");
    const body = await c.req.json().catch(() => null);
    const parsed = createServiceBodySchema.safeParse(body);
    if (!parsed.success) {
      return fail(c, "VALIDATION_ERROR", "Invalid request body.", 400, parsed.error.flatten());
    }

    const parentGroup = await db.query.serviceGroups.findFirst({
      where: and(eq(serviceGroups.bizId, bizId), eq(serviceGroups.id, parsed.data.serviceGroupId)),
      columns: { id: true },
    });
    if (!parentGroup) {
      return fail(c, "BAD_REQUEST", "serviceGroupId is not in this biz.", 400);
    }

    const [created] = await db
      .insert(services)
      .values({
        bizId,
        serviceGroupId: parsed.data.serviceGroupId,
        name: parsed.data.name,
        slug: parsed.data.slug,
        description: parsed.data.description,
        type: parsed.data.type,
        typeConfigValueId: parsed.data.typeConfigValueId,
        visibility: parsed.data.visibility,
        visibilityConfigValueId: parsed.data.visibilityConfigValueId,
        minAdvanceBookingHours: parsed.data.minAdvanceBookingHours ?? null,
        maxAdvanceBookingDays: parsed.data.maxAdvanceBookingDays ?? null,
        bookingCutoffMinutes: parsed.data.bookingCutoffMinutes ?? null,
        requiresApproval: parsed.data.requiresApproval,
        allowWaitlist: parsed.data.allowWaitlist,
        allowOverbooking: parsed.data.allowOverbooking,
        minCancellationNoticeHours: parsed.data.minCancellationNoticeHours ?? null,
        minRescheduleNoticeHours: parsed.data.minRescheduleNoticeHours ?? null,
        bookingPolicy: parsed.data.bookingPolicy ?? {},
        cancellationPolicy: parsed.data.cancellationPolicy ?? {},
        depositPolicy: parsed.data.depositPolicy ?? {},
        eligibilityPolicy: parsed.data.eligibilityPolicy ?? {},
        metadata: parsed.data.metadata ?? {},
        isSelfBookable: parsed.data.isSelfBookable ?? true,
        status: parsed.data.status,
        statusConfigValueId: parsed.data.statusConfigValueId,
      })
      .returning();

    return ok(c, created, 201);
  },
);

serviceRoutes.get(
  "/bizes/:bizId/services/:serviceId",
  requireAuth,
  requireBizAccess("bizId"),
  requireAclPermission("services.read", { bizIdParam: "bizId" }),
  async (c) => {
    const { bizId, serviceId } = c.req.param();
    const row = await db.query.services.findFirst({
      where: and(eq(services.bizId, bizId), eq(services.id, serviceId)),
    });
    if (!row) return fail(c, "NOT_FOUND", "Service not found.", 404);
    return ok(c, row);
  },
);

serviceRoutes.patch(
  "/bizes/:bizId/services/:serviceId",
  requireAuth,
  requireBizAccess("bizId"),
  requireAclPermission("services.update", { bizIdParam: "bizId" }),
  async (c) => {
    const { bizId, serviceId } = c.req.param();
    const body = await c.req.json().catch(() => null);
    const parsed = updateServiceBodySchema.safeParse(body);
    if (!parsed.success) {
      return fail(c, "VALIDATION_ERROR", "Invalid request body.", 400, parsed.error.flatten());
    }

    const existing = await db.query.services.findFirst({
      where: and(eq(services.bizId, bizId), eq(services.id, serviceId)),
    });
    if (!existing) return fail(c, "NOT_FOUND", "Service not found.", 404);

    const [updated] = await db
      .update(services)
      .set({
        ...parsed.data,
      })
      .where(and(eq(services.bizId, bizId), eq(services.id, serviceId)))
      .returning();

    return ok(c, updated);
  },
);

serviceRoutes.delete(
  "/bizes/:bizId/services/:serviceId",
  requireAuth,
  requireBizAccess("bizId"),
  requireAclPermission("services.archive", { bizIdParam: "bizId" }),
  async (c) => {
    const { bizId, serviceId } = c.req.param();
    const existing = await db.query.services.findFirst({
      where: and(eq(services.bizId, bizId), eq(services.id, serviceId)),
    });
    if (!existing) return fail(c, "NOT_FOUND", "Service not found.", 404);

    const [updated] = await db
      .update(services)
      .set({
        status: "archived",
      })
      .where(and(eq(services.bizId, bizId), eq(services.id, serviceId)))
      .returning();

    return ok(c, updated);
  },
);
