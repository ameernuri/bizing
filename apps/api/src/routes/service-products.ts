/**
 * Service-product routes (biz-scoped).
 *
 * ELI5:
 * - `services` = "what kind of work is this?"
 * - `service_products` = "how do we sell/schedule that work?"
 * - `service_product_services` = links a sellable service-product to one or
 *   many service intents (direct service or service group).
 *
 * This route module exposes first-class API control for those models.
 */

import { Hono } from "hono";
import { and, asc, desc, eq, ilike, sql } from "drizzle-orm";
import { z } from "zod";
import dbPackage from "@bizing/db";
import {
  getCurrentAuthCredentialId,
  getCurrentAuthSource,
  getCurrentUser,
  requireAclPermission,
  requireAuth,
  requireBizAccess,
} from "../middleware/auth.js";
import { persistCanonicalAction } from "../services/action-runtime.js";
import { executeCrudRouteAction } from "../services/action-route-bridge.js";
import { fail, ok, parsePositiveInt } from "./_api.js";

const {
  db,
  serviceProducts,
  serviceProductServices,
  services,
  serviceGroups,
} = dbPackage;

const listServiceProductsQuerySchema = z.object({
  page: z.string().optional(),
  perPage: z.string().optional(),
  status: z.enum(["draft", "active", "inactive", "archived"]).optional(),
  kind: z.enum(["booking", "rental", "hybrid"]).optional(),
  durationMode: z.enum(["fixed", "flexible", "multi_day"]).optional(),
  isPublished: z.enum(["true", "false"]).optional(),
  search: z.string().optional(),
  sortBy: z.enum(["name"]).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
});

const createServiceProductBodySchema = z.object({
  productId: z.string().optional(),
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(120).regex(/^[a-z0-9-]+$/),
  description: z.string().max(4000).optional(),
  kind: z.enum(["booking", "rental", "hybrid"]).default("booking"),
  kindConfigValueId: z.string().optional(),
  durationMode: z.enum(["fixed", "flexible", "multi_day"]).default("fixed"),
  durationModeConfigValueId: z.string().optional(),
  defaultDurationMinutes: z.number().int().positive().default(60),
  minDurationMinutes: z.number().int().positive().nullable().optional(),
  maxDurationMinutes: z.number().int().positive().nullable().optional(),
  durationStepMinutes: z.number().int().positive().default(15),
  timezone: z.string().min(1).max(50).default("UTC"),
  basePriceAmountMinorUnits: z.number().int().min(0).default(0),
  currency: z.string().regex(/^[A-Z]{3}$/).default("USD"),
  pricingPolicy: z.record(z.unknown()).optional(),
  availabilityPolicy: z.record(z.unknown()).optional(),
  isPublished: z.boolean().default(false),
  status: z.enum(["draft", "active", "inactive", "archived"]).default("draft"),
  statusConfigValueId: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const updateServiceProductBodySchema = createServiceProductBodySchema.partial();

const listBindingsQuerySchema = z.object({
  page: z.string().optional(),
  perPage: z.string().optional(),
  requirementMode: z.enum(["required", "optional"]).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
});

const createBindingBodySchema = z
  .object({
    serviceId: z.string().optional(),
    serviceGroupId: z.string().optional(),
    requirementMode: z.enum(["required", "optional"]).default("required"),
    minQuantity: z.number().int().min(0).default(1),
    maxQuantity: z.number().int().min(0).nullable().optional(),
    sortOrder: z.number().int().default(100),
    description: z.string().max(800).optional(),
    metadata: z.record(z.unknown()).optional(),
  })
  .refine((value) => Boolean(value.serviceId) !== Boolean(value.serviceGroupId), {
    message: "Provide exactly one of serviceId or serviceGroupId.",
    path: ["serviceId"],
  });

async function executeBizAction(c: Parameters<typeof getCurrentUser>[0], bizId: string, actionKey: string, payload: Record<string, unknown>) {
  const user = getCurrentUser(c);
  if (!user) throw new Error("Authentication required.");
  return persistCanonicalAction({
    bizId,
    input: { actionKey, payload, metadata: {} },
    intentMode: "execute",
    context: {
      bizId,
      user,
      authSource: getCurrentAuthSource(c),
      authCredentialId: getCurrentAuthCredentialId(c),
      requestId: c.get("requestId"),
      accessMode: "biz",
    },
  });
}

export const serviceProductRoutes = new Hono();

serviceProductRoutes.get(
  "/bizes/:bizId/service-products",
  requireAuth,
  requireBizAccess("bizId"),
  requireAclPermission("service_products.read", { bizIdParam: "bizId" }),
  async (c) => {
    const bizId = c.req.param("bizId");
    const parsed = listServiceProductsQuerySchema.safeParse(c.req.query());
    if (!parsed.success) {
      return fail(c, "VALIDATION_ERROR", "Invalid query parameters.", 400, parsed.error.flatten());
    }

    const {
      page,
      perPage,
      status,
      kind,
      durationMode,
      isPublished,
      search,
      sortBy = "name",
      sortOrder = "desc",
    } = parsed.data;
    const pageNum = parsePositiveInt(page, 1);
    const perPageNum = Math.min(parsePositiveInt(perPage, 20), 100);

    const where = and(
      eq(serviceProducts.bizId, bizId),
      status ? eq(serviceProducts.status, status) : undefined,
      kind ? eq(serviceProducts.kind, kind) : undefined,
      durationMode ? eq(serviceProducts.durationMode, durationMode) : undefined,
      isPublished ? eq(serviceProducts.isPublished, isPublished === "true") : undefined,
      search ? ilike(serviceProducts.name, `%${search}%`) : undefined,
    );

    const sortColumn = sortBy === "name" ? serviceProducts.name : serviceProducts.name;
    const orderByExpr = sortOrder === "asc" ? asc(sortColumn) : desc(sortColumn);

    const [rows, countRows] = await Promise.all([
      db.query.serviceProducts.findMany({
        where,
        orderBy: orderByExpr,
        limit: perPageNum,
        offset: (pageNum - 1) * perPageNum,
      }),
      db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(serviceProducts).where(where),
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

serviceProductRoutes.post(
  "/bizes/:bizId/service-products",
  requireAuth,
  requireBizAccess("bizId"),
  requireAclPermission("service_products.create", { bizIdParam: "bizId" }),
  async (c) => {
    const bizId = c.req.param("bizId");
    const body = await c.req.json().catch(() => null);
    const parsed = createServiceProductBodySchema.safeParse(body);
    if (!parsed.success) {
      return fail(c, "VALIDATION_ERROR", "Invalid request body.", 400, parsed.error.flatten());
    }

    const action = await executeBizAction(c, bizId, "service_product.create", parsed.data);
    const createdId = (action.actionRequest as { outputPayload?: Record<string, unknown> }).outputPayload?.serviceProductId;
    const created = await db.query.serviceProducts.findFirst({
      where: and(eq(serviceProducts.bizId, bizId), eq(serviceProducts.id, String(createdId))),
    });
    if (!created) return fail(c, "INTERNAL_ERROR", "Service product action succeeded but row could not be reloaded.", 500);

    return ok(c, created, 201);
  },
);

serviceProductRoutes.get(
  "/bizes/:bizId/service-products/:serviceProductId",
  requireAuth,
  requireBizAccess("bizId"),
  requireAclPermission("service_products.read", { bizIdParam: "bizId" }),
  async (c) => {
    const { bizId, serviceProductId } = c.req.param();
    const row = await db.query.serviceProducts.findFirst({
      where: and(eq(serviceProducts.bizId, bizId), eq(serviceProducts.id, serviceProductId)),
    });
    if (!row) return fail(c, "NOT_FOUND", "Service product not found.", 404);
    return ok(c, row);
  },
);

serviceProductRoutes.patch(
  "/bizes/:bizId/service-products/:serviceProductId",
  requireAuth,
  requireBizAccess("bizId"),
  requireAclPermission("service_products.update", { bizIdParam: "bizId" }),
  async (c) => {
    const { bizId, serviceProductId } = c.req.param();
    const body = await c.req.json().catch(() => null);
    const parsed = updateServiceProductBodySchema.safeParse(body);
    if (!parsed.success) {
      return fail(c, "VALIDATION_ERROR", "Invalid request body.", 400, parsed.error.flatten());
    }

    const existing = await db.query.serviceProducts.findFirst({
      where: and(eq(serviceProducts.bizId, bizId), eq(serviceProducts.id, serviceProductId)),
      columns: { id: true },
    });
    if (!existing) return fail(c, "NOT_FOUND", "Service product not found.", 404);

    const action = await executeBizAction(c, bizId, "service_product.update", {
      serviceProductId,
      ...parsed.data,
    });
    const updatedId = (action.actionRequest as { outputPayload?: Record<string, unknown> }).outputPayload?.serviceProductId;
    const updated = await db.query.serviceProducts.findFirst({
      where: and(eq(serviceProducts.bizId, bizId), eq(serviceProducts.id, String(updatedId))),
    });
    if (!updated) return fail(c, "INTERNAL_ERROR", "Service product action succeeded but row could not be reloaded.", 500);

    return ok(c, updated);
  },
);

serviceProductRoutes.delete(
  "/bizes/:bizId/service-products/:serviceProductId",
  requireAuth,
  requireBizAccess("bizId"),
  requireAclPermission("service_products.archive", { bizIdParam: "bizId" }),
  async (c) => {
    const { bizId, serviceProductId } = c.req.param();
    const existing = await db.query.serviceProducts.findFirst({
      where: and(eq(serviceProducts.bizId, bizId), eq(serviceProducts.id, serviceProductId)),
      columns: { id: true },
    });
    if (!existing) return fail(c, "NOT_FOUND", "Service product not found.", 404);

    const action = await executeBizAction(c, bizId, "service_product.archive", { serviceProductId });
    const updatedId = (action.actionRequest as { outputPayload?: Record<string, unknown> }).outputPayload?.serviceProductId;
    const updated = await db.query.serviceProducts.findFirst({
      where: and(eq(serviceProducts.bizId, bizId), eq(serviceProducts.id, String(updatedId))),
    });
    if (!updated) return fail(c, "INTERNAL_ERROR", "Service product action succeeded but row could not be reloaded.", 500);

    return ok(c, updated);
  },
);

serviceProductRoutes.get(
  "/bizes/:bizId/service-products/:serviceProductId/services",
  requireAuth,
  requireBizAccess("bizId"),
  requireAclPermission("service_products.read", { bizIdParam: "bizId" }),
  async (c) => {
    const { bizId, serviceProductId } = c.req.param();
    const parsed = listBindingsQuerySchema.safeParse(c.req.query());
    if (!parsed.success) {
      return fail(c, "VALIDATION_ERROR", "Invalid query parameters.", 400, parsed.error.flatten());
    }

    const { page, perPage, requirementMode, sortOrder = "asc" } = parsed.data;
    const pageNum = parsePositiveInt(page, 1);
    const perPageNum = Math.min(parsePositiveInt(perPage, 50), 100);
    const orderByExpr =
      sortOrder === "desc" ? desc(serviceProductServices.sortOrder) : asc(serviceProductServices.sortOrder);

    const where = and(
      eq(serviceProductServices.bizId, bizId),
      eq(serviceProductServices.serviceProductId, serviceProductId),
      requirementMode ? eq(serviceProductServices.requirementMode, requirementMode) : undefined,
    );

    const [rows, countRows] = await Promise.all([
      db.query.serviceProductServices.findMany({
        where,
        orderBy: [orderByExpr, asc(serviceProductServices.id)],
        limit: perPageNum,
        offset: (pageNum - 1) * perPageNum,
      }),
      db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(serviceProductServices).where(where),
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

serviceProductRoutes.post(
  "/bizes/:bizId/service-products/:serviceProductId/services",
  requireAuth,
  requireBizAccess("bizId"),
  requireAclPermission("service_products.update", { bizIdParam: "bizId" }),
  async (c) => {
    const { bizId, serviceProductId } = c.req.param();
    const body = await c.req.json().catch(() => null);
    const parsed = createBindingBodySchema.safeParse(body);
    if (!parsed.success) {
      return fail(c, "VALIDATION_ERROR", "Invalid request body.", 400, parsed.error.flatten());
    }

    const serviceProduct = await db.query.serviceProducts.findFirst({
      where: and(eq(serviceProducts.bizId, bizId), eq(serviceProducts.id, serviceProductId)),
      columns: { id: true },
    });
    if (!serviceProduct) return fail(c, "NOT_FOUND", "Service product not found.", 404);

    if (parsed.data.serviceId) {
      const service = await db.query.services.findFirst({
        where: and(eq(services.bizId, bizId), eq(services.id, parsed.data.serviceId)),
        columns: { id: true },
      });
      if (!service) return fail(c, "BAD_REQUEST", "serviceId is not in this biz.", 400);
    }
    if (parsed.data.serviceGroupId) {
      const serviceGroup = await db.query.serviceGroups.findFirst({
        where: and(eq(serviceGroups.bizId, bizId), eq(serviceGroups.id, parsed.data.serviceGroupId)),
        columns: { id: true },
      });
      if (!serviceGroup) return fail(c, "BAD_REQUEST", "serviceGroupId is not in this biz.", 400);
    }

    const delegated = await executeCrudRouteAction({
      c,
      bizId,
      tableKey: "serviceProductServices",
      operation: "create",
      subjectType: "service_product_service_binding",
      subjectId: serviceProductId,
      displayName: "create service binding",
      data: {
        bizId,
        serviceProductId,
        serviceId: parsed.data.serviceId,
        serviceGroupId: parsed.data.serviceGroupId,
        requirementMode: parsed.data.requirementMode,
        minQuantity: parsed.data.minQuantity,
        maxQuantity: parsed.data.maxQuantity ?? null,
        sortOrder: parsed.data.sortOrder,
        description: parsed.data.description,
        metadata: parsed.data.metadata ?? {},
      },
      metadata: { routeFamily: "service-products" },
    });
    if (!delegated.ok) {
      return fail(c, delegated.code, delegated.message, delegated.httpStatus, delegated.details);
    }
    if (!delegated.row) {
      return fail(c, "ACTION_EXECUTION_FAILED", "Service binding create returned no row.", 500);
    }
    const created = delegated.row;

    return ok(c, created, 201);
  },
);

serviceProductRoutes.delete(
  "/bizes/:bizId/service-products/:serviceProductId/services/:bindingId",
  requireAuth,
  requireBizAccess("bizId"),
  requireAclPermission("service_products.update", { bizIdParam: "bizId" }),
  async (c) => {
    const { bizId, serviceProductId, bindingId } = c.req.param();
    const existing = await db.query.serviceProductServices.findFirst({
      where: and(
        eq(serviceProductServices.bizId, bizId),
        eq(serviceProductServices.serviceProductId, serviceProductId),
        eq(serviceProductServices.id, bindingId),
      ),
      columns: { id: true },
    });
    if (!existing) return fail(c, "NOT_FOUND", "Service-product service binding not found.", 404);

    const delegated = await executeCrudRouteAction({
      c,
      bizId,
      tableKey: "serviceProductServices",
      operation: "delete",
      id: bindingId,
      subjectType: "service_product_service_binding",
      subjectId: bindingId,
      displayName: "delete service binding",
      metadata: { routeFamily: "service-products" },
    });
    if (!delegated.ok) {
      if (delegated.code === "CRUD_TARGET_NOT_FOUND") {
        return fail(c, "NOT_FOUND", "Service-product service binding not found.", 404);
      }
      return fail(c, delegated.code, delegated.message, delegated.httpStatus, delegated.details);
    }

    return ok(c, { id: bindingId });
  },
);
