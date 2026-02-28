/**
 * Calendar + availability routes (biz-scoped).
 *
 * Why this route module matters:
 * - Calendars are the time-control backbone for resources, services, offers,
 *   service-products, locations, and user-level sharing flows.
 * - Availability rules and bindings need explicit API support so agents can
 *   configure scenarios directly without SQL.
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

const {
  db,
  calendars,
  calendarBindings,
  availabilityRules,
  resources,
  services,
  serviceProducts,
  offers,
  offerVersions,
  locations,
  subjects,
} = dbPackage;

const listCalendarsQuerySchema = z.object({
  page: z.string().optional(),
  perPage: z.string().optional(),
  status: z.enum(["active", "inactive"]).optional(),
  defaultMode: z.enum(["available_by_default", "unavailable_by_default"]).optional(),
  search: z.string().optional(),
  sortBy: z.enum(["name"]).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
});

const createCalendarBodySchema = z.object({
  name: z.string().min(1).max(200),
  timezone: z.string().min(1).max(50).default("UTC"),
  slotDurationMin: z.number().int().positive().default(30),
  slotIntervalMin: z.number().int().positive().default(15),
  preBufferMin: z.number().int().min(0).default(0),
  postBufferMin: z.number().int().min(0).default(0),
  minAdvanceBookingHours: z.number().int().min(0).default(0),
  maxAdvanceBookingDays: z.number().int().min(0).default(365),
  defaultMode: z.enum(["available_by_default", "unavailable_by_default"]).default("available_by_default"),
  ruleEvaluationOrder: z
    .enum(["priority_asc", "priority_desc", "specificity_then_priority"])
    .default("specificity_then_priority"),
  conflictResolutionMode: z
    .enum(["priority_wins", "unavailable_wins", "available_wins", "most_restrictive_wins"])
    .default("unavailable_wins"),
  enforceStrictNonOverlap: z.boolean().default(false),
  emitTimelineFacts: z.boolean().default(true),
  status: z.enum(["active", "inactive"]).default("active"),
  policy: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const updateCalendarBodySchema = createCalendarBodySchema.partial();

const listBindingsQuerySchema = z.object({
  page: z.string().optional(),
  perPage: z.string().optional(),
  ownerType: z
    .enum(["biz", "user", "resource", "service", "service_product", "offer", "offer_version", "location", "custom_subject"])
    .optional(),
  calendarId: z.string().optional(),
  ownerRefKey: z.string().optional(),
  isPrimary: z.enum(["true", "false"]).optional(),
  isActive: z.enum(["true", "false"]).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
});

const createBindingBodySchema = z.object({
  calendarId: z.string().min(1),
  ownerType: z.enum([
    "biz",
    "user",
    "resource",
    "service",
    "service_product",
    "offer",
    "offer_version",
    "location",
    "custom_subject",
  ]),
  resourceId: z.string().optional(),
  serviceId: z.string().optional(),
  serviceProductId: z.string().optional(),
  offerId: z.string().optional(),
  offerVersionId: z.string().optional(),
  locationId: z.string().optional(),
  ownerUserId: z.string().optional(),
  ownerRefType: z.string().max(80).optional(),
  ownerRefId: z.string().optional(),
  isPrimary: z.boolean().default(true),
  isActive: z.boolean().default(true),
  metadata: z.record(z.unknown()).optional(),
});

const updateBindingBodySchema = z.object({
  isPrimary: z.boolean().optional(),
  isActive: z.boolean().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const listAvailabilityRulesQuerySchema = z.object({
  page: z.string().optional(),
  perPage: z.string().optional(),
  mode: z.enum(["recurring", "date_range", "timestamp_range"]).optional(),
  action: z.enum(["available", "unavailable", "override_hours", "special_pricing", "capacity_adjustment"]).optional(),
  isActive: z.enum(["true", "false"]).optional(),
  sortBy: z.enum(["priority"]).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
});

const createAvailabilityRuleBodySchema = z.object({
  overlayId: z.string().optional(),
  name: z.string().min(1).max(200),
  mode: z.enum(["recurring", "date_range", "timestamp_range"]),
  frequency: z.enum(["none", "daily", "weekly", "monthly", "yearly", "recurrence_rule"]).default("none"),
  recurrenceRule: z.string().max(500).optional(),
  dayOfWeek: z.number().int().min(0).max(6).nullable().optional(),
  dayOfMonth: z.number().int().min(1).max(31).nullable().optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  startTime: z.string().nullable().optional(),
  endTime: z.string().nullable().optional(),
  startAt: z.string().datetime().nullable().optional(),
  endAt: z.string().datetime().nullable().optional(),
  action: z.enum(["available", "unavailable", "override_hours", "special_pricing", "capacity_adjustment"]),
  capacityDelta: z.number().int().nullable().optional(),
  pricingAdjustment: z.record(z.unknown()).optional(),
  priority: z.number().int().default(100),
  isActive: z.boolean().default(true),
  metadata: z.record(z.unknown()).optional(),
});

const updateAvailabilityRuleBodySchema = createAvailabilityRuleBodySchema.partial();

function deriveOwnerRefKey(
  ownerType: z.infer<typeof createBindingBodySchema>["ownerType"],
  input: z.infer<typeof createBindingBodySchema>,
) {
  switch (ownerType) {
    case "biz":
      return "biz";
    case "user":
      return input.ownerUserId ? `user:${input.ownerUserId}` : null;
    case "resource":
      return input.resourceId ? `resource:${input.resourceId}` : null;
    case "service":
      return input.serviceId ? `service:${input.serviceId}` : null;
    case "service_product":
      return input.serviceProductId ? `service_product:${input.serviceProductId}` : null;
    case "offer":
      return input.offerId ? `offer:${input.offerId}` : null;
    case "offer_version":
      return input.offerVersionId ? `offer_version:${input.offerVersionId}` : null;
    case "location":
      return input.locationId ? `location:${input.locationId}` : null;
    case "custom_subject":
      return input.ownerRefType && input.ownerRefId ? `custom_subject:${input.ownerRefType}:${input.ownerRefId}` : null;
    default:
      return null;
  }
}

async function validateBindingOwnerInBiz(
  bizId: string,
  payload: z.infer<typeof createBindingBodySchema>,
) {
  if (payload.ownerType === "biz") return { ok: true as const };

  if (payload.ownerType === "user") {
    if (!payload.ownerUserId) return { ok: false as const, message: "ownerUserId is required for ownerType=user." };
    return { ok: true as const };
  }

  if (payload.ownerType === "resource") {
    if (!payload.resourceId) return { ok: false as const, message: "resourceId is required for ownerType=resource." };
    const row = await db.query.resources.findFirst({
      where: and(eq(resources.bizId, bizId), eq(resources.id, payload.resourceId)),
      columns: { id: true },
    });
    return row ? { ok: true as const } : { ok: false as const, message: "resourceId is not in this biz." };
  }

  if (payload.ownerType === "service") {
    if (!payload.serviceId) return { ok: false as const, message: "serviceId is required for ownerType=service." };
    const row = await db.query.services.findFirst({
      where: and(eq(services.bizId, bizId), eq(services.id, payload.serviceId)),
      columns: { id: true },
    });
    return row ? { ok: true as const } : { ok: false as const, message: "serviceId is not in this biz." };
  }

  if (payload.ownerType === "service_product") {
    if (!payload.serviceProductId) {
      return { ok: false as const, message: "serviceProductId is required for ownerType=service_product." };
    }
    const row = await db.query.serviceProducts.findFirst({
      where: and(eq(serviceProducts.bizId, bizId), eq(serviceProducts.id, payload.serviceProductId)),
      columns: { id: true },
    });
    return row ? { ok: true as const } : { ok: false as const, message: "serviceProductId is not in this biz." };
  }

  if (payload.ownerType === "offer") {
    if (!payload.offerId) return { ok: false as const, message: "offerId is required for ownerType=offer." };
    const row = await db.query.offers.findFirst({
      where: and(eq(offers.bizId, bizId), eq(offers.id, payload.offerId)),
      columns: { id: true },
    });
    return row ? { ok: true as const } : { ok: false as const, message: "offerId is not in this biz." };
  }

  if (payload.ownerType === "offer_version") {
    if (!payload.offerVersionId) {
      return { ok: false as const, message: "offerVersionId is required for ownerType=offer_version." };
    }
    const row = await db.query.offerVersions.findFirst({
      where: and(eq(offerVersions.bizId, bizId), eq(offerVersions.id, payload.offerVersionId)),
      columns: { id: true },
    });
    return row ? { ok: true as const } : { ok: false as const, message: "offerVersionId is not in this biz." };
  }

  if (payload.ownerType === "location") {
    if (!payload.locationId) return { ok: false as const, message: "locationId is required for ownerType=location." };
    const row = await db.query.locations.findFirst({
      where: and(eq(locations.bizId, bizId), eq(locations.id, payload.locationId)),
      columns: { id: true },
    });
    return row ? { ok: true as const } : { ok: false as const, message: "locationId is not in this biz." };
  }

  if (payload.ownerType === "custom_subject") {
    if (!payload.ownerRefType || !payload.ownerRefId) {
      return { ok: false as const, message: "ownerRefType + ownerRefId are required for ownerType=custom_subject." };
    }
    const row = await db.query.subjects.findFirst({
      where: and(
        eq(subjects.bizId, bizId),
        eq(subjects.subjectType, payload.ownerRefType),
        eq(subjects.subjectId, payload.ownerRefId),
      ),
      columns: { id: true },
    });
    return row ? { ok: true as const } : { ok: false as const, message: "custom subject does not exist in this biz." };
  }

  return { ok: false as const, message: "Invalid ownerType." };
}

export const calendarRoutes = new Hono();

calendarRoutes.get(
  "/bizes/:bizId/calendars",
  requireAuth,
  requireBizAccess("bizId"),
  requireAclPermission("calendars.read", { bizIdParam: "bizId" }),
  async (c) => {
    const bizId = c.req.param("bizId");
    const parsed = listCalendarsQuerySchema.safeParse(c.req.query());
    if (!parsed.success) {
      return fail(c, "VALIDATION_ERROR", "Invalid query parameters.", 400, parsed.error.flatten());
    }

    const { page, perPage, status, defaultMode, search, sortBy = "name", sortOrder = "desc" } = parsed.data;
    const pageNum = parsePositiveInt(page, 1);
    const perPageNum = Math.min(parsePositiveInt(perPage, 20), 100);

    const where = and(
      eq(calendars.bizId, bizId),
      status ? eq(calendars.status, status) : undefined,
      defaultMode ? eq(calendars.defaultMode, defaultMode) : undefined,
      search ? ilike(calendars.name, `%${search}%`) : undefined,
    );

    const sortColumn = sortBy === "name" ? calendars.name : calendars.name;
    const orderByExpr = sortOrder === "asc" ? asc(sortColumn) : desc(sortColumn);

    const [rows, countRows] = await Promise.all([
      db.query.calendars.findMany({
        where,
        orderBy: orderByExpr,
        limit: perPageNum,
        offset: (pageNum - 1) * perPageNum,
      }),
      db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(calendars).where(where),
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

calendarRoutes.post(
  "/bizes/:bizId/calendars",
  requireAuth,
  requireBizAccess("bizId"),
  requireAclPermission("calendars.write", { bizIdParam: "bizId" }),
  async (c) => {
    const bizId = c.req.param("bizId");
    const body = await c.req.json().catch(() => null);
    const parsed = createCalendarBodySchema.safeParse(body);
    if (!parsed.success) {
      return fail(c, "VALIDATION_ERROR", "Invalid request body.", 400, parsed.error.flatten());
    }

    const [created] = await db
      .insert(calendars)
      .values({
        bizId,
        name: parsed.data.name,
        timezone: parsed.data.timezone,
        slotDurationMin: parsed.data.slotDurationMin,
        slotIntervalMin: parsed.data.slotIntervalMin,
        preBufferMin: parsed.data.preBufferMin,
        postBufferMin: parsed.data.postBufferMin,
        minAdvanceBookingHours: parsed.data.minAdvanceBookingHours,
        maxAdvanceBookingDays: parsed.data.maxAdvanceBookingDays,
        defaultMode: parsed.data.defaultMode,
        ruleEvaluationOrder: parsed.data.ruleEvaluationOrder,
        conflictResolutionMode: parsed.data.conflictResolutionMode,
        enforceStrictNonOverlap: parsed.data.enforceStrictNonOverlap,
        emitTimelineFacts: parsed.data.emitTimelineFacts,
        status: parsed.data.status,
        policy: parsed.data.policy ?? {},
        metadata: parsed.data.metadata ?? {},
      })
      .returning();

    return ok(c, created, 201);
  },
);

calendarRoutes.get(
  "/bizes/:bizId/calendars/:calendarId",
  requireAuth,
  requireBizAccess("bizId"),
  requireAclPermission("calendars.read", { bizIdParam: "bizId" }),
  async (c) => {
    const { bizId, calendarId } = c.req.param();
    const row = await db.query.calendars.findFirst({
      where: and(eq(calendars.bizId, bizId), eq(calendars.id, calendarId)),
    });
    if (!row) return fail(c, "NOT_FOUND", "Calendar not found.", 404);
    return ok(c, row);
  },
);

calendarRoutes.patch(
  "/bizes/:bizId/calendars/:calendarId",
  requireAuth,
  requireBizAccess("bizId"),
  requireAclPermission("calendars.write", { bizIdParam: "bizId" }),
  async (c) => {
    const { bizId, calendarId } = c.req.param();
    const body = await c.req.json().catch(() => null);
    const parsed = updateCalendarBodySchema.safeParse(body);
    if (!parsed.success) {
      return fail(c, "VALIDATION_ERROR", "Invalid request body.", 400, parsed.error.flatten());
    }

    const existing = await db.query.calendars.findFirst({
      where: and(eq(calendars.bizId, bizId), eq(calendars.id, calendarId)),
      columns: { id: true },
    });
    if (!existing) return fail(c, "NOT_FOUND", "Calendar not found.", 404);

    const [updated] = await db
      .update(calendars)
      .set({
        ...parsed.data,
      })
      .where(and(eq(calendars.bizId, bizId), eq(calendars.id, calendarId)))
      .returning();

    return ok(c, updated);
  },
);

calendarRoutes.delete(
  "/bizes/:bizId/calendars/:calendarId",
  requireAuth,
  requireBizAccess("bizId"),
  requireAclPermission("calendars.write", { bizIdParam: "bizId" }),
  async (c) => {
    const { bizId, calendarId } = c.req.param();
    const existing = await db.query.calendars.findFirst({
      where: and(eq(calendars.bizId, bizId), eq(calendars.id, calendarId)),
      columns: { id: true },
    });
    if (!existing) return fail(c, "NOT_FOUND", "Calendar not found.", 404);

    const [updated] = await db
      .update(calendars)
      .set({
        status: "inactive",
      })
      .where(and(eq(calendars.bizId, bizId), eq(calendars.id, calendarId)))
      .returning();

    return ok(c, updated);
  },
);

calendarRoutes.get(
  "/bizes/:bizId/calendar-bindings",
  requireAuth,
  requireBizAccess("bizId"),
  requireAclPermission("calendars.read", { bizIdParam: "bizId" }),
  async (c) => {
    const bizId = c.req.param("bizId");
    const parsed = listBindingsQuerySchema.safeParse(c.req.query());
    if (!parsed.success) {
      return fail(c, "VALIDATION_ERROR", "Invalid query parameters.", 400, parsed.error.flatten());
    }

    const { page, perPage, ownerType, calendarId, ownerRefKey, isPrimary, isActive, sortOrder = "desc" } = parsed.data;
    const pageNum = parsePositiveInt(page, 1);
    const perPageNum = Math.min(parsePositiveInt(perPage, 20), 100);
    const orderByExpr = sortOrder === "asc" ? asc(calendarBindings.id) : desc(calendarBindings.id);

    const where = and(
      eq(calendarBindings.bizId, bizId),
      ownerType ? eq(calendarBindings.ownerType, ownerType) : undefined,
      calendarId ? eq(calendarBindings.calendarId, calendarId) : undefined,
      ownerRefKey ? eq(calendarBindings.ownerRefKey, ownerRefKey) : undefined,
      isPrimary ? eq(calendarBindings.isPrimary, isPrimary === "true") : undefined,
      isActive ? eq(calendarBindings.isActive, isActive === "true") : undefined,
    );

    const [rows, countRows] = await Promise.all([
      db.query.calendarBindings.findMany({
        where,
        orderBy: orderByExpr,
        limit: perPageNum,
        offset: (pageNum - 1) * perPageNum,
      }),
      db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(calendarBindings).where(where),
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

calendarRoutes.post(
  "/bizes/:bizId/calendar-bindings",
  requireAuth,
  requireBizAccess("bizId"),
  requireAclPermission("calendars.write", { bizIdParam: "bizId" }),
  async (c) => {
    const bizId = c.req.param("bizId");
    const body = await c.req.json().catch(() => null);
    const parsed = createBindingBodySchema.safeParse(body);
    if (!parsed.success) {
      return fail(c, "VALIDATION_ERROR", "Invalid request body.", 400, parsed.error.flatten());
    }

    const calendar = await db.query.calendars.findFirst({
      where: and(eq(calendars.bizId, bizId), eq(calendars.id, parsed.data.calendarId)),
      columns: { id: true },
    });
    if (!calendar) return fail(c, "BAD_REQUEST", "calendarId is not in this biz.", 400);

    const ownerValidation = await validateBindingOwnerInBiz(bizId, parsed.data);
    if (!ownerValidation.ok) return fail(c, "BAD_REQUEST", ownerValidation.message, 400);

    const ownerRefKey = deriveOwnerRefKey(parsed.data.ownerType, parsed.data);
    if (!ownerRefKey) return fail(c, "BAD_REQUEST", "Owner payload does not match ownerType.", 400);

    const [created] = await db
      .insert(calendarBindings)
      .values({
        bizId,
        calendarId: parsed.data.calendarId,
        ownerType: parsed.data.ownerType,
        resourceId: parsed.data.resourceId,
        serviceId: parsed.data.serviceId,
        serviceProductId: parsed.data.serviceProductId,
        offerId: parsed.data.offerId,
        offerVersionId: parsed.data.offerVersionId,
        locationId: parsed.data.locationId,
        ownerUserId: parsed.data.ownerUserId,
        ownerRefType: parsed.data.ownerRefType,
        ownerRefId: parsed.data.ownerRefId,
        ownerRefKey,
        isPrimary: parsed.data.isPrimary,
        isActive: parsed.data.isActive,
        metadata: parsed.data.metadata ?? {},
      })
      .returning();

    return ok(c, created, 201);
  },
);

calendarRoutes.patch(
  "/bizes/:bizId/calendar-bindings/:bindingId",
  requireAuth,
  requireBizAccess("bizId"),
  requireAclPermission("calendars.write", { bizIdParam: "bizId" }),
  async (c) => {
    const { bizId, bindingId } = c.req.param();
    const body = await c.req.json().catch(() => null);
    const parsed = updateBindingBodySchema.safeParse(body);
    if (!parsed.success) {
      return fail(c, "VALIDATION_ERROR", "Invalid request body.", 400, parsed.error.flatten());
    }

    const existing = await db.query.calendarBindings.findFirst({
      where: and(eq(calendarBindings.bizId, bizId), eq(calendarBindings.id, bindingId)),
      columns: { id: true },
    });
    if (!existing) return fail(c, "NOT_FOUND", "Calendar binding not found.", 404);

    const [updated] = await db
      .update(calendarBindings)
      .set({
        ...parsed.data,
      })
      .where(and(eq(calendarBindings.bizId, bizId), eq(calendarBindings.id, bindingId)))
      .returning();

    return ok(c, updated);
  },
);

calendarRoutes.delete(
  "/bizes/:bizId/calendar-bindings/:bindingId",
  requireAuth,
  requireBizAccess("bizId"),
  requireAclPermission("calendars.write", { bizIdParam: "bizId" }),
  async (c) => {
    const { bizId, bindingId } = c.req.param();
    const existing = await db.query.calendarBindings.findFirst({
      where: and(eq(calendarBindings.bizId, bizId), eq(calendarBindings.id, bindingId)),
      columns: { id: true },
    });
    if (!existing) return fail(c, "NOT_FOUND", "Calendar binding not found.", 404);

    const [updated] = await db
      .update(calendarBindings)
      .set({
        isActive: false,
      })
      .where(and(eq(calendarBindings.bizId, bizId), eq(calendarBindings.id, bindingId)))
      .returning();

    return ok(c, updated);
  },
);

calendarRoutes.get(
  "/bizes/:bizId/calendars/:calendarId/availability-rules",
  requireAuth,
  requireBizAccess("bizId"),
  requireAclPermission("availability_rules.read", { bizIdParam: "bizId" }),
  async (c) => {
    const { bizId, calendarId } = c.req.param();
    const parsed = listAvailabilityRulesQuerySchema.safeParse(c.req.query());
    if (!parsed.success) {
      return fail(c, "VALIDATION_ERROR", "Invalid query parameters.", 400, parsed.error.flatten());
    }

    const { page, perPage, mode, action, isActive, sortBy = "priority", sortOrder = "asc" } = parsed.data;
    const pageNum = parsePositiveInt(page, 1);
    const perPageNum = Math.min(parsePositiveInt(perPage, 50), 100);

    const sortColumn = sortBy === "priority" ? availabilityRules.priority : availabilityRules.priority;
    const orderByExpr = sortOrder === "asc" ? asc(sortColumn) : desc(sortColumn);

    const where = and(
      eq(availabilityRules.bizId, bizId),
      eq(availabilityRules.calendarId, calendarId),
      mode ? eq(availabilityRules.mode, mode) : undefined,
      action ? eq(availabilityRules.action, action) : undefined,
      isActive ? eq(availabilityRules.isActive, isActive === "true") : undefined,
    );

    const [rows, countRows] = await Promise.all([
      db.query.availabilityRules.findMany({
        where,
        orderBy: [orderByExpr, asc(availabilityRules.id)],
        limit: perPageNum,
        offset: (pageNum - 1) * perPageNum,
      }),
      db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(availabilityRules).where(where),
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

calendarRoutes.post(
  "/bizes/:bizId/calendars/:calendarId/availability-rules",
  requireAuth,
  requireBizAccess("bizId"),
  requireAclPermission("availability_rules.write", { bizIdParam: "bizId" }),
  async (c) => {
    const { bizId, calendarId } = c.req.param();
    const body = await c.req.json().catch(() => null);
    const parsed = createAvailabilityRuleBodySchema.safeParse(body);
    if (!parsed.success) {
      return fail(c, "VALIDATION_ERROR", "Invalid request body.", 400, parsed.error.flatten());
    }

    const calendar = await db.query.calendars.findFirst({
      where: and(eq(calendars.bizId, bizId), eq(calendars.id, calendarId)),
      columns: { id: true },
    });
    if (!calendar) return fail(c, "NOT_FOUND", "Calendar not found.", 404);

    const [created] = await db
      .insert(availabilityRules)
      .values({
        bizId,
        calendarId,
        overlayId: parsed.data.overlayId,
        name: parsed.data.name,
        mode: parsed.data.mode,
        frequency: parsed.data.frequency,
        recurrenceRule: parsed.data.recurrenceRule,
        dayOfWeek: parsed.data.dayOfWeek ?? null,
        dayOfMonth: parsed.data.dayOfMonth ?? null,
        startDate: parsed.data.startDate ?? null,
        endDate: parsed.data.endDate ?? null,
        startTime: parsed.data.startTime ?? null,
        endTime: parsed.data.endTime ?? null,
        startAt: parsed.data.startAt ? new Date(parsed.data.startAt) : null,
        endAt: parsed.data.endAt ? new Date(parsed.data.endAt) : null,
        action: parsed.data.action,
        capacityDelta: parsed.data.capacityDelta ?? null,
        pricingAdjustment: parsed.data.pricingAdjustment,
        priority: parsed.data.priority,
        isActive: parsed.data.isActive,
        metadata: parsed.data.metadata ?? {},
      })
      .returning();

    return ok(c, created, 201);
  },
);

calendarRoutes.patch(
  "/bizes/:bizId/calendars/:calendarId/availability-rules/:ruleId",
  requireAuth,
  requireBizAccess("bizId"),
  requireAclPermission("availability_rules.write", { bizIdParam: "bizId" }),
  async (c) => {
    const { bizId, calendarId, ruleId } = c.req.param();
    const body = await c.req.json().catch(() => null);
    const parsed = updateAvailabilityRuleBodySchema.safeParse(body);
    if (!parsed.success) {
      return fail(c, "VALIDATION_ERROR", "Invalid request body.", 400, parsed.error.flatten());
    }

    const existing = await db.query.availabilityRules.findFirst({
      where: and(
        eq(availabilityRules.bizId, bizId),
        eq(availabilityRules.calendarId, calendarId),
        eq(availabilityRules.id, ruleId),
      ),
      columns: { id: true },
    });
    if (!existing) return fail(c, "NOT_FOUND", "Availability rule not found.", 404);

    const updatePayload: Record<string, unknown> = { ...parsed.data }
    if (Object.prototype.hasOwnProperty.call(parsed.data, "startAt")) {
      updatePayload.startAt = parsed.data.startAt ? new Date(parsed.data.startAt) : null
    }
    if (Object.prototype.hasOwnProperty.call(parsed.data, "endAt")) {
      updatePayload.endAt = parsed.data.endAt ? new Date(parsed.data.endAt) : null
    }

    const [updated] = await db
      .update(availabilityRules)
      .set(updatePayload as never)
      .where(
        and(
          eq(availabilityRules.bizId, bizId),
          eq(availabilityRules.calendarId, calendarId),
          eq(availabilityRules.id, ruleId),
        ),
      )
      .returning();

    return ok(c, updated);
  },
);

calendarRoutes.delete(
  "/bizes/:bizId/calendars/:calendarId/availability-rules/:ruleId",
  requireAuth,
  requireBizAccess("bizId"),
  requireAclPermission("availability_rules.write", { bizIdParam: "bizId" }),
  async (c) => {
    const { bizId, calendarId, ruleId } = c.req.param();
    const existing = await db.query.availabilityRules.findFirst({
      where: and(
        eq(availabilityRules.bizId, bizId),
        eq(availabilityRules.calendarId, calendarId),
        eq(availabilityRules.id, ruleId),
      ),
      columns: { id: true },
    });
    if (!existing) return fail(c, "NOT_FOUND", "Availability rule not found.", 404);

    const [updated] = await db
      .update(availabilityRules)
      .set({
        isActive: false,
      })
      .where(
        and(
          eq(availabilityRules.bizId, bizId),
          eq(availabilityRules.calendarId, calendarId),
          eq(availabilityRules.id, ruleId),
        ),
      )
      .returning();

    return ok(c, updated);
  },
);
