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
import { and, asc, desc, eq, ilike, inArray, sql } from "drizzle-orm";
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
  calendars,
  calendarBindings,
  capacityHolds,
  calendarTimelineEvents,
  calendarOwnerTimelineEvents,
  availabilityRules,
  availabilityDependencyRules,
  availabilityDependencyRuleTargets,
  bookingOrders,
  resources,
  services,
  serviceProducts,
  offers,
  offerVersions,
  locations,
  scheduleSubjects,
  subjects,
  timeScopes,
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
  priority: z.number().int().min(0).default(100),
  isRequired: z.boolean().default(false),
  isActive: z.boolean().default(true),
  metadata: z.record(z.unknown()).optional(),
});

const updateBindingBodySchema = z.object({
  isPrimary: z.boolean().optional(),
  priority: z.number().int().min(0).optional(),
  isRequired: z.boolean().optional(),
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

const calendarTimelineQuerySchema = z.object({
  startAt: z.string().datetime().optional(),
  endAt: z.string().datetime().optional(),
  includeInactive: z.enum(["true", "false"]).optional(),
  includeRules: z.enum(["true", "false"]).optional(),
  includeBookings: z.enum(["true", "false"]).optional(),
  includeHolds: z.enum(["true", "false"]).optional(),
  includeRaw: z.enum(["true", "false"]).optional(),
});

const listCapacityHoldsQuerySchema = z.object({
  status: z.enum(["active", "released", "consumed", "expired", "cancelled"]).optional(),
  effectMode: z.enum(["blocking", "non_blocking", "advisory"]).optional(),
  startAt: z.string().datetime().optional(),
  endAt: z.string().datetime().optional(),
});

const createCapacityHoldBodySchema = z.object({
  /** Canonical normalized scope pointer. Required for new writes. */
  timeScopeId: z.string().min(1),
  effectMode: z.enum(["blocking", "non_blocking", "advisory"]).default("blocking"),
  quantity: z.number().int().positive().default(1),
  demandWeight: z.number().int().positive().default(1),
  countsTowardDemand: z.boolean().default(true),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  expiresAt: z.string().datetime().optional().nullable(),
  ownerType: z.enum(["user", "group_account", "subject", "guest_fingerprint", "system"]).optional().nullable(),
  ownerUserId: z.string().optional().nullable(),
  ownerGroupAccountId: z.string().optional().nullable(),
  ownerSubjectType: z.string().max(80).optional().nullable(),
  ownerSubjectId: z.string().optional().nullable(),
  ownerFingerprintHash: z.string().max(140).optional().nullable(),
  ownerRefKey: z.string().max(320).optional().nullable(),
  sourceSignalType: z.enum(["manual", "queue_eta", "capacity_pressure", "dependency", "external_event", "plugin", "custom_subject"]).default("manual"),
  sourceRefType: z.string().max(80).optional().nullable(),
  sourceRefId: z.string().optional().nullable(),
  requestKey: z.string().max(140).optional().nullable(),
  reasonCode: z.string().max(120).optional().nullable(),
  policySnapshot: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const updateCapacityHoldBodySchema = z.object({
  status: z.enum(["active", "released", "consumed", "expired", "cancelled"]).optional(),
  expiresAt: z.string().datetime().optional().nullable(),
  releasedAt: z.string().datetime().optional().nullable(),
  consumedAt: z.string().datetime().optional().nullable(),
  cancelledAt: z.string().datetime().optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
});

const createDependencyRuleBodySchema = z.object({
  name: z.string().min(1).max(180),
  description: z.string().max(700).optional().nullable(),
  status: z.enum(["draft", "active", "inactive", "suspended", "archived"]).default("active"),
  enforcementMode: z.enum(["hard_block", "soft_gate", "advisory"]).default("hard_block"),
  evaluationMode: z.enum(["all", "any", "threshold"]).default("all"),
  failureAction: z.enum(["available", "unavailable", "override_hours", "special_pricing", "capacity_adjustment"]).default("unavailable"),
  capacityDelta: z.number().int().optional().nullable(),
  pricingAdjustment: z.record(z.unknown()).optional(),
  timeOffsetBeforeMin: z.number().int().min(0).default(0),
  timeOffsetAfterMin: z.number().int().min(0).default(0),
  minSatisfiedCount: z.number().int().positive().optional().nullable(),
  minSatisfiedPercent: z.number().int().min(1).max(100).optional().nullable(),
  effectiveStartAt: z.string().datetime().optional().nullable(),
  effectiveEndAt: z.string().datetime().optional().nullable(),
  requestKey: z.string().max(140).optional().nullable(),
  policy: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
  targets: z.array(z.object({
    targetType: z.enum(["calendar", "custom_subject"]),
    requiredCalendarId: z.string().optional().nullable(),
    requiredSubjectType: z.string().max(80).optional().nullable(),
    requiredSubjectId: z.string().max(140).optional().nullable(),
    roleKey: z.string().max(80).optional().nullable(),
    weight: z.number().int().positive().default(1),
    sortOrder: z.number().int().min(0).default(100),
    metadata: z.record(z.unknown()).optional(),
  })).default([]),
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

function metadataRefValue(metadata: unknown, key: string) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

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

async function createCalendarRow(
  c: Parameters<typeof executeCrudRouteAction>[0]["c"],
  bizId: string | null | undefined,
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
    bizId: bizId ?? null,
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

async function updateCalendarRow(
  c: Parameters<typeof executeCrudRouteAction>[0]["c"],
  bizId: string | null | undefined,
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
    bizId: bizId ?? null,
    tableKey,
    operation: "update",
    id,
    patch,
    subjectType: options?.subjectType,
    subjectId: options?.subjectId,
    displayName: options?.displayName,
    metadata: options?.metadata,
  });
  if (!result.ok) return fail(c, result.code, result.message, result.httpStatus, result.details);
  return result.row;
}

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

function parseScopeRefKey(scopeRefKey: string) {
  if (scopeRefKey === "biz") return { prefix: "biz", id: null as string | null };
  const parts = scopeRefKey.split(":");
  const prefix = parts[0] ?? "";
  const id = parts.slice(1).join(":") || null;
  return { prefix, id };
}

function holdTargetTypeFromScopeType(
  scopeType: string,
): "calendar" | "capacity_pool" | "resource" | "offer_version" | "custom_subject" | null {
  switch (scopeType) {
    case "calendar":
    case "capacity_pool":
    case "resource":
    case "offer_version":
    case "custom_subject":
      return scopeType;
    default:
      return null;
  }
}

type BindingScheduleSubjectDescriptor = {
  subjectType: string;
  subjectId: string;
  scheduleClass: string;
  displayName?: string | null;
  category?: string | null;
  metadata?: Record<string, unknown>;
};

async function validateBindingOwnerInBiz(
  bizId: string,
  payload: z.infer<typeof createBindingBodySchema>,
) {
  if (payload.ownerType === "biz") return { ok: true as const, scheduleSubject: null };

  if (payload.ownerType === "user") {
    if (!payload.ownerUserId) return { ok: false as const, message: "ownerUserId is required for ownerType=user." };
    return { ok: true as const, scheduleSubject: null };
  }

  if (payload.ownerType === "resource") {
    if (!payload.resourceId) return { ok: false as const, message: "resourceId is required for ownerType=resource." };
    const row = await db.query.resources.findFirst({
      where: and(eq(resources.bizId, bizId), eq(resources.id, payload.resourceId)),
      columns: { id: true, name: true, type: true },
    });
    return row
      ? {
          ok: true as const,
          scheduleSubject: {
            subjectType: "resource",
            subjectId: row.id,
            scheduleClass: "resource",
            displayName: row.name,
            category: row.type,
            metadata: {
              ownerType: "resource",
              resourceType: row.type,
            },
          } satisfies BindingScheduleSubjectDescriptor,
        }
      : { ok: false as const, message: "resourceId is not in this biz." };
  }

  if (payload.ownerType === "service") {
    if (!payload.serviceId) return { ok: false as const, message: "serviceId is required for ownerType=service." };
    const row = await db.query.services.findFirst({
      where: and(eq(services.bizId, bizId), eq(services.id, payload.serviceId)),
      columns: { id: true, name: true, type: true },
    });
    return row
      ? {
          ok: true as const,
          scheduleSubject: {
            subjectType: "service",
            subjectId: row.id,
            scheduleClass: "service",
            displayName: row.name,
            category: row.type,
            metadata: {
              ownerType: "service",
              serviceType: row.type,
            },
          } satisfies BindingScheduleSubjectDescriptor,
        }
      : { ok: false as const, message: "serviceId is not in this biz." };
  }

  if (payload.ownerType === "service_product") {
    if (!payload.serviceProductId) {
      return { ok: false as const, message: "serviceProductId is required for ownerType=service_product." };
    }
    const row = await db.query.serviceProducts.findFirst({
      where: and(eq(serviceProducts.bizId, bizId), eq(serviceProducts.id, payload.serviceProductId)),
      columns: { id: true, name: true },
    });
    return row
      ? {
          ok: true as const,
          scheduleSubject: {
            subjectType: "service_product",
            subjectId: row.id,
            scheduleClass: "service_product",
            displayName: row.name,
            category: "service_product",
            metadata: {
              ownerType: "service_product",
            },
          } satisfies BindingScheduleSubjectDescriptor,
        }
      : { ok: false as const, message: "serviceProductId is not in this biz." };
  }

  if (payload.ownerType === "offer") {
    if (!payload.offerId) return { ok: false as const, message: "offerId is required for ownerType=offer." };
    const row = await db.query.offers.findFirst({
      where: and(eq(offers.bizId, bizId), eq(offers.id, payload.offerId)),
      columns: { id: true, name: true, executionMode: true },
    });
    return row
      ? {
          ok: true as const,
          scheduleSubject: {
            subjectType: "offer",
            subjectId: row.id,
            scheduleClass: "offer",
            displayName: row.name,
            category: row.executionMode,
            metadata: {
              ownerType: "offer",
              executionMode: row.executionMode,
            },
          } satisfies BindingScheduleSubjectDescriptor,
        }
      : { ok: false as const, message: "offerId is not in this biz." };
  }

  if (payload.ownerType === "offer_version") {
    if (!payload.offerVersionId) {
      return { ok: false as const, message: "offerVersionId is required for ownerType=offer_version." };
    }
    const row = await db.query.offerVersions.findFirst({
      where: and(eq(offerVersions.bizId, bizId), eq(offerVersions.id, payload.offerVersionId)),
      columns: { id: true, version: true, offerId: true, status: true },
    });
    if (!row) return { ok: false as const, message: "offerVersionId is not in this biz." };
    const offer = await db.query.offers.findFirst({
      where: and(eq(offers.bizId, bizId), eq(offers.id, row.offerId)),
      columns: { id: true, name: true, executionMode: true },
    });
    return {
      ok: true as const,
      scheduleSubject: {
        subjectType: "offer_version",
        subjectId: row.id,
        scheduleClass: "offer_version",
        displayName: offer ? `${offer.name} v${row.version}` : `Offer version ${row.version}`,
        category: offer?.executionMode ?? row.status,
        metadata: {
          ownerType: "offer_version",
          offerId: row.offerId,
          version: row.version,
          versionStatus: row.status,
          executionMode: offer?.executionMode ?? null,
        },
      } satisfies BindingScheduleSubjectDescriptor,
    };
  }

  if (payload.ownerType === "location") {
    if (!payload.locationId) return { ok: false as const, message: "locationId is required for ownerType=location." };
    const row = await db.query.locations.findFirst({
      where: and(eq(locations.bizId, bizId), eq(locations.id, payload.locationId)),
      columns: { id: true, name: true, type: true },
    });
    return row
      ? {
          ok: true as const,
          scheduleSubject: {
            subjectType: "location",
            subjectId: row.id,
            scheduleClass: "location",
            displayName: row.name,
            category: row.type,
            metadata: {
              ownerType: "location",
              locationType: row.type,
            },
          } satisfies BindingScheduleSubjectDescriptor,
        }
      : { ok: false as const, message: "locationId is not in this biz." };
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
      columns: { id: true, subjectType: true, subjectId: true, displayName: true, category: true },
    });
    return row
      ? {
          ok: true as const,
          scheduleSubject: {
            subjectType: row.subjectType,
            subjectId: row.subjectId,
            scheduleClass: row.category ?? row.subjectType,
            displayName: row.displayName,
            category: row.category ?? row.subjectType,
            metadata: {
              ownerType: "custom_subject",
            },
          } satisfies BindingScheduleSubjectDescriptor,
        }
      : { ok: false as const, message: "custom subject does not exist in this biz." };
  }

  return { ok: false as const, message: "Invalid ownerType." };
}

async function ensureBindingScheduleSubject(
  bizId: string,
  scheduleSubject: BindingScheduleSubjectDescriptor | null,
) {
  if (!scheduleSubject) return null;

  await db
    .insert(subjects)
    .values({
      bizId,
      subjectType: scheduleSubject.subjectType,
      subjectId: scheduleSubject.subjectId,
      displayName: scheduleSubject.displayName ?? null,
      category: scheduleSubject.category ?? scheduleSubject.scheduleClass,
      status: "active",
      isLinkable: true,
      metadata: {
        source: "routes.calendars.schedule-subject",
        ...(scheduleSubject.metadata ?? {}),
      },
    })
    .onConflictDoNothing({
      target: [subjects.bizId, subjects.subjectType, subjects.subjectId],
    });

  const [created] = await db
    .insert(scheduleSubjects)
    .values({
      bizId,
      subjectType: scheduleSubject.subjectType,
      subjectId: scheduleSubject.subjectId,
      scheduleClass: scheduleSubject.scheduleClass,
      displayName: scheduleSubject.displayName ?? null,
      status: "active",
      schedulingMode: "exclusive",
      defaultCapacity: 1,
      defaultLeadTimeMin: 0,
      defaultBufferBeforeMin: 0,
      defaultBufferAfterMin: 0,
      shouldProjectTimeline: true,
      policy: {},
      metadata: {
        source: "routes.calendars.schedule-subject",
        ...(scheduleSubject.metadata ?? {}),
      },
    })
    .onConflictDoNothing({
      target: [scheduleSubjects.bizId, scheduleSubjects.subjectType, scheduleSubjects.subjectId],
    })
    .returning({ id: scheduleSubjects.id });

  if (created?.id) return created.id;

  const existing = await db.query.scheduleSubjects.findFirst({
    where: and(
      eq(scheduleSubjects.bizId, bizId),
      eq(scheduleSubjects.subjectType, scheduleSubject.subjectType),
      eq(scheduleSubjects.subjectId, scheduleSubject.subjectId),
    ),
    columns: { id: true },
  });
  if (!existing?.id) {
    throw new Error("Failed to ensure schedule subject for calendar binding.");
  }
  return existing.id;
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

    const action = await executeBizAction(c, bizId, "calendar.create", parsed.data);
    const createdId = (action.actionRequest as { outputPayload?: Record<string, unknown> }).outputPayload?.calendarId;
    const created = await db.query.calendars.findFirst({
      where: and(eq(calendars.bizId, bizId), eq(calendars.id, String(createdId))),
    });
    if (!created) return fail(c, "INTERNAL_ERROR", "Calendar action succeeded but row could not be reloaded.", 500);

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

    const action = await executeBizAction(c, bizId, "calendar.update", {
      calendarId,
      ...parsed.data,
    });
    const updatedId = (action.actionRequest as { outputPayload?: Record<string, unknown> }).outputPayload?.calendarId;
    const updated = await db.query.calendars.findFirst({
      where: and(eq(calendars.bizId, bizId), eq(calendars.id, String(updatedId))),
    });
    if (!updated) return fail(c, "INTERNAL_ERROR", "Calendar action succeeded but row could not be reloaded.", 500);

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

    const action = await executeBizAction(c, bizId, "calendar.archive", { calendarId });
    const updatedId = (action.actionRequest as { outputPayload?: Record<string, unknown> }).outputPayload?.calendarId;
    const updated = await db.query.calendars.findFirst({
      where: and(eq(calendars.bizId, bizId), eq(calendars.id, String(updatedId))),
    });
    if (!updated) return fail(c, "INTERNAL_ERROR", "Calendar action succeeded but row could not be reloaded.", 500);

    return ok(c, updated);
  },
);

calendarRoutes.get(
  "/bizes/:bizId/calendars/:calendarId/timeline",
  requireAuth,
  requireBizAccess("bizId"),
  requireAclPermission("calendars.read", { bizIdParam: "bizId" }),
  async (c) => {
    const { bizId, calendarId } = c.req.param();
    const parsed = calendarTimelineQuerySchema.safeParse(c.req.query());
    if (!parsed.success) {
      return fail(c, "VALIDATION_ERROR", "Invalid query parameters.", 400, parsed.error.flatten());
    }

    const calendar = await db.query.calendars.findFirst({
      where: and(eq(calendars.bizId, bizId), eq(calendars.id, calendarId)),
    });
    if (!calendar) return fail(c, "NOT_FOUND", "Calendar not found.", 404);

    const startAt = parsed.data.startAt ? new Date(parsed.data.startAt) : new Date(Date.now() - 1000 * 60 * 60 * 24);
    const endAt = parsed.data.endAt ? new Date(parsed.data.endAt) : new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
    if (endAt <= startAt) {
      return fail(c, "VALIDATION_ERROR", "endAt must be after startAt.", 400);
    }

    const includeInactive = parsed.data.includeInactive === "true";
    const includeRules = parsed.data.includeRules !== "false";
    const includeBookings = parsed.data.includeBookings !== "false";
    const includeHolds = parsed.data.includeHolds !== "false";
    const includeRaw = parsed.data.includeRaw === "true";

    /**
     * ELI5:
     * A calendar is not useful if clients must manually stitch together:
     * - which things are attached to it,
     * - which rules are shaping it,
     * - which bookings already occupy it,
     * - which holds are temporarily pressuring it.
     *
     * This endpoint is the "tell me the story of this calendar" read model.
     */
    const bindings = await db.query.calendarBindings.findMany({
      where: and(
        eq(calendarBindings.bizId, bizId),
        eq(calendarBindings.calendarId, calendarId),
        includeInactive ? undefined : eq(calendarBindings.isActive, true),
      ),
      orderBy: [desc(calendarBindings.isPrimary), desc(calendarBindings.id)],
    });

    const bindingSets = {
      offerIds: new Set<string>(),
      offerVersionIds: new Set<string>(),
      resourceIds: new Set<string>(),
      serviceIds: new Set<string>(),
      serviceProductIds: new Set<string>(),
      locationIds: new Set<string>(),
      ownerUserIds: new Set<string>(),
      ownerRefKeys: new Set<string>(),
    };
    for (const binding of bindings) {
      if (binding.offerId) bindingSets.offerIds.add(binding.offerId);
      if (binding.offerVersionId) bindingSets.offerVersionIds.add(binding.offerVersionId);
      if (binding.resourceId) bindingSets.resourceIds.add(binding.resourceId);
      if (binding.serviceId) bindingSets.serviceIds.add(binding.serviceId);
      if (binding.serviceProductId) bindingSets.serviceProductIds.add(binding.serviceProductId);
      if (binding.locationId) bindingSets.locationIds.add(binding.locationId);
      if (binding.ownerUserId) bindingSets.ownerUserIds.add(binding.ownerUserId);
      if (binding.ownerRefKey) bindingSets.ownerRefKeys.add(binding.ownerRefKey);
    }

    /**
     * Projection-first timeline read model.
     *
     * ELI5:
     * We ask the normalized timeline projections first because they are the
     * canonical "calendar story" surface. Raw table fan-out is optional
     * (`includeRaw=true`) for deep debugging and parity checks.
     */
    const ownerRefKeys = Array.from(bindingSets.ownerRefKeys);
    const [ownerTimelineRows, calendarTimelineRows] = await Promise.all([
      ownerRefKeys.length > 0
        ? db.query.calendarOwnerTimelineEvents.findMany({
            where: and(
              eq(calendarOwnerTimelineEvents.bizId, bizId),
              eq(calendarOwnerTimelineEvents.calendarId, calendarId),
              inArray(calendarOwnerTimelineEvents.ownerRefKey, ownerRefKeys),
              includeInactive ? undefined : eq(calendarOwnerTimelineEvents.isActive, true),
              sql`${calendarOwnerTimelineEvents.startAt} <= ${endAt}`,
              sql`${calendarOwnerTimelineEvents.endAt} >= ${startAt}`,
            ),
            orderBy: [asc(calendarOwnerTimelineEvents.startAt), asc(calendarOwnerTimelineEvents.id)],
          })
        : Promise.resolve([]),
      db.query.calendarTimelineEvents.findMany({
        where: and(
          eq(calendarTimelineEvents.bizId, bizId),
          eq(calendarTimelineEvents.calendarId, calendarId),
          includeInactive ? undefined : eq(calendarTimelineEvents.isActive, true),
          sql`${calendarTimelineEvents.startAt} <= ${endAt}`,
          sql`${calendarTimelineEvents.endAt} >= ${startAt}`,
        ),
        orderBy: [asc(calendarTimelineEvents.startAt), asc(calendarTimelineEvents.id)],
      }),
    ]);

    const hasProjection = ownerTimelineRows.length > 0 || calendarTimelineRows.length > 0;

    const [ruleRows, holdRows, bookingRows] = includeRaw || !hasProjection
      ? await Promise.all([
          includeRules
            ? db.query.availabilityRules.findMany({
                where: and(eq(availabilityRules.bizId, bizId), eq(availabilityRules.calendarId, calendarId)),
                orderBy: [asc(availabilityRules.priority), asc(availabilityRules.id)],
              })
            : Promise.resolve([]),
          includeHolds
            ? db.query.capacityHolds.findMany({
                where: and(
                  eq(capacityHolds.bizId, bizId),
                  eq(capacityHolds.calendarId, calendarId),
                  includeInactive ? undefined : eq(capacityHolds.status, "active"),
                ),
                orderBy: [asc(capacityHolds.startsAt), asc(capacityHolds.id)],
              })
            : Promise.resolve([]),
          includeBookings
            ? db.query.bookingOrders.findMany({
                where: eq(bookingOrders.bizId, bizId),
                orderBy: [asc(bookingOrders.confirmedStartAt), asc(bookingOrders.requestedStartAt), asc(bookingOrders.id)],
              })
            : Promise.resolve([]),
        ])
      : [[], [], []];

    const rules = ruleRows.filter((rule) => {
      if (includeInactive) return true;
      if (!rule.isActive) return false;
      const ruleStart =
        rule.startAt ??
        (rule.startDate ? new Date(`${rule.startDate}T00:00:00.000Z`) : null);
      const ruleEnd =
        rule.endAt ??
        (rule.endDate ? new Date(`${rule.endDate}T23:59:59.999Z`) : null);
      if (!ruleStart && !ruleEnd) return true;
      if (!ruleStart) return (ruleEnd as Date) >= startAt;
      if (!ruleEnd) return ruleStart <= endAt;
      return ruleStart <= endAt && ruleEnd >= startAt;
    });

    const holds = holdRows.filter((hold) => hold.startsAt <= endAt && hold.endsAt >= startAt);

    const bookings = bookingRows.filter((booking) => {
      const bookingStart = booking.confirmedStartAt ?? booking.requestedStartAt;
      const bookingEnd = booking.confirmedEndAt ?? booking.requestedEndAt;
      if (bookingStart && bookingEnd && (bookingStart > endAt || bookingEnd < startAt)) return false;

      const bookingLocationId = metadataRefValue(booking.metadata, "locationId");
      const bookingResourceId = metadataRefValue(booking.metadata, "resourceId");
      const bookingServiceId = metadataRefValue(booking.metadata, "serviceId");
      const bookingServiceProductId = metadataRefValue(booking.metadata, "serviceProductId");
      const bookingOwnerRefKey = metadataRefValue(booking.metadata, "calendarOwnerRefKey");

      return (
        bindingSets.offerIds.has(booking.offerId) ||
        bindingSets.offerVersionIds.has(booking.offerVersionId) ||
        (bookingLocationId ? bindingSets.locationIds.has(bookingLocationId) : false) ||
        (bookingResourceId ? bindingSets.resourceIds.has(bookingResourceId) : false) ||
        (bookingServiceId ? bindingSets.serviceIds.has(bookingServiceId) : false) ||
        (bookingServiceProductId ? bindingSets.serviceProductIds.has(bookingServiceProductId) : false) ||
        (booking.customerUserId ? bindingSets.ownerUserIds.has(booking.customerUserId) : false) ||
        (bookingOwnerRefKey ? bindingSets.ownerRefKeys.has(bookingOwnerRefKey) : false)
      );
    });

    const projectionTimeline =
      ownerTimelineRows.length > 0
        ? ownerTimelineRows
        : calendarTimelineRows;
    const projectionRules = includeRules
      ? projectionTimeline.filter((row) => row.sourceType === "availability_rule")
      : [];
    const projectionHolds = includeHolds
      ? projectionTimeline.filter((row) => row.sourceType === "capacity_hold")
      : [];
    const projectionBookings = includeBookings
      ? projectionTimeline.filter((row) => row.sourceType === "fulfillment")
      : [];

    return ok(c, {
      calendar,
      window: {
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
      },
      bindings,
      rules: hasProjection && !includeRaw ? projectionRules : rules,
      holds: hasProjection && !includeRaw ? projectionHolds : holds,
      bookings: hasProjection && !includeRaw ? projectionBookings : bookings,
      timelineEvents: projectionTimeline,
      readModel: hasProjection && !includeRaw ? "projection_first" : "raw_fanout",
      summary: {
        bindingCount: bindings.length,
        ruleCount: hasProjection && !includeRaw ? projectionRules.length : rules.length,
        holdCount: hasProjection && !includeRaw ? projectionHolds.length : holds.length,
        bookingCount: hasProjection && !includeRaw ? projectionBookings.length : bookings.length,
        timelineEventCount: projectionTimeline.length,
      },
    });
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
    const scheduleSubjectId = await ensureBindingScheduleSubject(bizId, ownerValidation.scheduleSubject);

    const ownerRefKey = deriveOwnerRefKey(parsed.data.ownerType, parsed.data);
    if (!ownerRefKey) return fail(c, "BAD_REQUEST", "Owner payload does not match ownerType.", 400);

    const created = (await createCalendarRow(c, bizId, "calendarBindings", {
      bizId,
      calendarId: parsed.data.calendarId,
      scheduleSubjectId,
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
      priority: parsed.data.priority,
      isRequired: parsed.data.isRequired,
      isActive: parsed.data.isActive,
      metadata: parsed.data.metadata ?? {},
    }, {
      subjectType: "calendar_binding",
      subjectId: parsed.data.calendarId,
      displayName: ownerRefKey,
      metadata: { source: "routes.calendars.createBinding" },
    })) as Record<string, unknown> | Response;
    if (created instanceof Response) return created;

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
      columns: {
        id: true,
        ownerType: true,
        resourceId: true,
        serviceId: true,
        serviceProductId: true,
        offerId: true,
        offerVersionId: true,
        locationId: true,
        ownerUserId: true,
        ownerRefType: true,
        ownerRefId: true,
        scheduleSubjectId: true,
      },
    });
    if (!existing) return fail(c, "NOT_FOUND", "Calendar binding not found.", 404);

    let scheduleSubjectPatch: { scheduleSubjectId?: string | null } = {};
    if (!existing.scheduleSubjectId && existing.ownerType !== "biz" && existing.ownerType !== "user") {
      const ownerValidation = await validateBindingOwnerInBiz(bizId, {
        calendarId: "",
        ownerType: existing.ownerType,
        resourceId: existing.resourceId ?? undefined,
        serviceId: existing.serviceId ?? undefined,
        serviceProductId: existing.serviceProductId ?? undefined,
        offerId: existing.offerId ?? undefined,
        offerVersionId: existing.offerVersionId ?? undefined,
        locationId: existing.locationId ?? undefined,
        ownerUserId: existing.ownerUserId ?? undefined,
        ownerRefType: existing.ownerRefType ?? undefined,
        ownerRefId: existing.ownerRefId ?? undefined,
        isPrimary: true,
        priority: 100,
        isRequired: false,
        isActive: true,
        metadata: {},
      });
      if (!ownerValidation.ok) {
        return fail(c, "INTERNAL_ERROR", "Existing binding owner could not be revalidated for schedule-subject healing.", 500, {
          bindingId,
          ownerType: existing.ownerType,
          message: ownerValidation.message,
        });
      }
      scheduleSubjectPatch = {
        scheduleSubjectId: await ensureBindingScheduleSubject(bizId, ownerValidation.scheduleSubject),
      };
    }

    const updated = (await updateCalendarRow(c, bizId, "calendarBindings", bindingId, {
      ...scheduleSubjectPatch,
      ...parsed.data,
    }, {
      subjectType: "calendar_binding",
      subjectId: bindingId,
      displayName: "Update calendar binding",
      metadata: { source: "routes.calendars.updateBinding" },
    })) as Record<string, unknown> | Response;
    if (updated instanceof Response) return updated;

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

    const updated = (await updateCalendarRow(c, bizId, "calendarBindings", bindingId, {
      isActive: false,
    }, {
      subjectType: "calendar_binding",
      subjectId: bindingId,
      displayName: "Deactivate calendar binding",
      metadata: { source: "routes.calendars.deleteBinding" },
    })) as Record<string, unknown> | Response;
    if (updated instanceof Response) return updated;

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

    const created = (await createCalendarRow(c, bizId, "availabilityRules", {
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
    }, {
      subjectType: "availability_rule",
      subjectId: calendarId,
      displayName: parsed.data.name,
      metadata: { source: "routes.calendars.createAvailabilityRule" },
    })) as Record<string, unknown> | Response;
    if (created instanceof Response) return created;

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

    const updated = (await updateCalendarRow(c, bizId, "availabilityRules", ruleId, updatePayload, {
      subjectType: "availability_rule",
      subjectId: ruleId,
      displayName: "Update availability rule",
      metadata: { source: "routes.calendars.updateAvailabilityRule" },
    })) as Record<string, unknown> | Response;
    if (updated instanceof Response) return updated;

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

    const updated = (await updateCalendarRow(c, bizId, "availabilityRules", ruleId, {
      isActive: false,
    }, {
      subjectType: "availability_rule",
      subjectId: ruleId,
      displayName: "Deactivate availability rule",
      metadata: { source: "routes.calendars.deleteAvailabilityRule" },
    })) as Record<string, unknown> | Response;
    if (updated instanceof Response) return updated;

    return ok(c, updated);
  },
);

calendarRoutes.get(
  "/bizes/:bizId/calendars/:calendarId/capacity-holds",
  requireAuth,
  requireBizAccess("bizId"),
  requireAclPermission("calendars.read", { bizIdParam: "bizId" }),
  async (c) => {
    const { bizId, calendarId } = c.req.param();
    const parsed = listCapacityHoldsQuerySchema.safeParse(c.req.query());
    if (!parsed.success) return fail(c, "VALIDATION_ERROR", "Invalid query parameters.", 400, parsed.error.flatten());
    const startAt = parsed.data.startAt ? new Date(parsed.data.startAt) : null;
    const endAt = parsed.data.endAt ? new Date(parsed.data.endAt) : null;
    const rows = await db.query.capacityHolds.findMany({
      where: and(
        eq(capacityHolds.bizId, bizId),
        eq(capacityHolds.calendarId, calendarId),
        parsed.data.status ? eq(capacityHolds.status, parsed.data.status) : undefined,
        parsed.data.effectMode ? eq(capacityHolds.effectMode, parsed.data.effectMode) : undefined,
      ),
      orderBy: [asc(capacityHolds.startsAt), asc(capacityHolds.id)],
    });
    const filtered = rows.filter((row) => {
      if (startAt && row.endsAt < startAt) return false;
      if (endAt && row.startsAt > endAt) return false;
      return true;
    });
    return ok(c, filtered);
  },
);

calendarRoutes.post(
  "/bizes/:bizId/calendars/:calendarId/capacity-holds",
  requireAuth,
  requireBizAccess("bizId"),
  requireAclPermission("calendars.write", { bizIdParam: "bizId" }),
  async (c) => {
    const { bizId, calendarId } = c.req.param();
    const parsed = createCapacityHoldBodySchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return fail(c, "VALIDATION_ERROR", "Invalid request body.", 400, parsed.error.flatten());

    const timeScope = await db.query.timeScopes.findFirst({
      where: and(eq(timeScopes.bizId, bizId), eq(timeScopes.id, parsed.data.timeScopeId)),
      columns: { id: true, scopeType: true, scopeRefKey: true, isActive: true },
    });
    if (!timeScope) return fail(c, "VALIDATION_ERROR", "timeScopeId does not exist in this biz.", 400);
    if (!timeScope.isActive) return fail(c, "VALIDATION_ERROR", "timeScopeId is inactive.", 400);
    const expectedTargetType = holdTargetTypeFromScopeType(timeScope.scopeType);
    if (!expectedTargetType) {
      return fail(
        c,
        "VALIDATION_ERROR",
        `timeScope scopeType '${timeScope.scopeType}' cannot be used for capacity holds.`,
        400,
      );
    }
    if (expectedTargetType === "calendar") {
      const parsedScope = parseScopeRefKey(timeScope.scopeRefKey);
      if (parsedScope.prefix !== "calendar" || !parsedScope.id) {
        return fail(c, "VALIDATION_ERROR", "Calendar time scope has invalid scopeRefKey format.", 400);
      }
      if (parsedScope.id !== calendarId) {
        return fail(
          c,
          "VALIDATION_ERROR",
          "calendarId in route must match calendar encoded by timeScopeId.",
          400,
          { calendarId, scopeCalendarId: parsedScope.id },
        );
      }
    }

    const created = (await createCalendarRow(c, bizId, "capacityHolds", {
      bizId,
      calendarId,
      timeScopeId: parsed.data.timeScopeId,
      effectMode: parsed.data.effectMode,
      status: "active",
      quantity: parsed.data.quantity,
      demandWeight: parsed.data.demandWeight,
      countsTowardDemand: parsed.data.countsTowardDemand,
      ownerType: parsed.data.ownerType ?? null,
      ownerUserId: parsed.data.ownerUserId ?? null,
      ownerGroupAccountId: parsed.data.ownerGroupAccountId ?? null,
      ownerSubjectType: parsed.data.ownerSubjectType ?? null,
      ownerSubjectId: parsed.data.ownerSubjectId ?? null,
      ownerFingerprintHash: parsed.data.ownerFingerprintHash ?? null,
      ownerRefKey: parsed.data.ownerRefKey ?? null,
      startsAt: new Date(parsed.data.startsAt),
      endsAt: new Date(parsed.data.endsAt),
      expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
      sourceSignalType: parsed.data.sourceSignalType,
      sourceRefType: parsed.data.sourceRefType ?? null,
      sourceRefId: parsed.data.sourceRefId ?? null,
      requestKey: parsed.data.requestKey ?? null,
      reasonCode: parsed.data.reasonCode ?? null,
      policySnapshot: parsed.data.policySnapshot ?? {},
      metadata: parsed.data.metadata ?? {},
    }, {
      subjectType: "capacity_hold",
      subjectId: timeScope.scopeRefKey,
      displayName: `Capacity hold ${parsed.data.effectMode}`,
      metadata: { source: "routes.calendars.createCapacityHold" },
    })) as Record<string, unknown> | Response;
    if (created instanceof Response) return created;
    return ok(c, created, 201);
  },
);

calendarRoutes.patch(
  "/bizes/:bizId/calendars/:calendarId/capacity-holds/:holdId",
  requireAuth,
  requireBizAccess("bizId"),
  requireAclPermission("calendars.write", { bizIdParam: "bizId" }),
  async (c) => {
    const { bizId, calendarId, holdId } = c.req.param();
    const parsed = updateCapacityHoldBodySchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return fail(c, "VALIDATION_ERROR", "Invalid request body.", 400, parsed.error.flatten());
    const existing = await db.query.capacityHolds.findFirst({
      where: and(eq(capacityHolds.bizId, bizId), eq(capacityHolds.calendarId, calendarId), eq(capacityHolds.id, holdId)),
      columns: { id: true },
    });
    if (!existing) return fail(c, "NOT_FOUND", "Capacity hold not found.", 404);
    const updated = (await updateCalendarRow(c, bizId, "capacityHolds", holdId, {
      status: parsed.data.status,
      expiresAt: parsed.data.expiresAt === undefined ? undefined : parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
      releasedAt: parsed.data.releasedAt === undefined ? undefined : parsed.data.releasedAt ? new Date(parsed.data.releasedAt) : null,
      consumedAt: parsed.data.consumedAt === undefined ? undefined : parsed.data.consumedAt ? new Date(parsed.data.consumedAt) : null,
      cancelledAt: parsed.data.cancelledAt === undefined ? undefined : parsed.data.cancelledAt ? new Date(parsed.data.cancelledAt) : null,
      metadata: parsed.data.metadata,
    }, {
      subjectType: "capacity_hold",
      subjectId: holdId,
      displayName: "Update capacity hold",
      metadata: { source: "routes.calendars.updateCapacityHold" },
    })) as Record<string, unknown> | Response;
    if (updated instanceof Response) return updated;
    return ok(c, updated);
  },
);

calendarRoutes.get(
  "/bizes/:bizId/calendars/:calendarId/dependency-rules",
  requireAuth,
  requireBizAccess("bizId"),
  requireAclPermission("calendars.read", { bizIdParam: "bizId" }),
  async (c) => {
    const { bizId, calendarId } = c.req.param();
    const rules = await db.query.availabilityDependencyRules.findMany({
      where: and(eq(availabilityDependencyRules.bizId, bizId), eq(availabilityDependencyRules.dependentCalendarId, calendarId)),
      orderBy: [asc(availabilityDependencyRules.name)],
    });
    const ruleIds = rules.map((row) => row.id);
    const targets = ruleIds.length === 0 ? [] : await db.query.availabilityDependencyRuleTargets.findMany({
      where: and(eq(availabilityDependencyRuleTargets.bizId, bizId), inArray(availabilityDependencyRuleTargets.availabilityDependencyRuleId, ruleIds)),
      orderBy: [asc(availabilityDependencyRuleTargets.sortOrder)],
    });
    return ok(c, { rules, targets });
  },
);

calendarRoutes.post(
  "/bizes/:bizId/calendars/:calendarId/dependency-rules",
  requireAuth,
  requireBizAccess("bizId"),
  requireAclPermission("calendars.write", { bizIdParam: "bizId" }),
  async (c) => {
    const { bizId, calendarId } = c.req.param();
    const parsed = createDependencyRuleBodySchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return fail(c, "VALIDATION_ERROR", "Invalid request body.", 400, parsed.error.flatten());

    const result = await db.transaction(async (tx) => {
      const [rule] = await tx.insert(availabilityDependencyRules).values({
        bizId,
        dependentCalendarId: calendarId,
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        status: parsed.data.status,
        enforcementMode: parsed.data.enforcementMode,
        evaluationMode: parsed.data.evaluationMode,
        failureAction: parsed.data.failureAction,
        capacityDelta: parsed.data.capacityDelta ?? null,
        pricingAdjustment: parsed.data.pricingAdjustment ?? null,
        timeOffsetBeforeMin: parsed.data.timeOffsetBeforeMin,
        timeOffsetAfterMin: parsed.data.timeOffsetAfterMin,
        minSatisfiedCount: parsed.data.minSatisfiedCount ?? null,
        minSatisfiedPercent: parsed.data.minSatisfiedPercent ?? null,
        effectiveStartAt: parsed.data.effectiveStartAt ? new Date(parsed.data.effectiveStartAt) : null,
        effectiveEndAt: parsed.data.effectiveEndAt ? new Date(parsed.data.effectiveEndAt) : null,
        requestKey: parsed.data.requestKey ?? null,
        policy: parsed.data.policy ?? {},
        metadata: parsed.data.metadata ?? {},
      }).returning();

      const targets = parsed.data.targets.length === 0 ? [] : await tx.insert(availabilityDependencyRuleTargets).values(
        parsed.data.targets.map((target) => ({
          bizId,
          availabilityDependencyRuleId: rule.id,
          targetType: target.targetType,
          requiredCalendarId: target.requiredCalendarId ?? null,
          requiredSubjectType: target.requiredSubjectType ?? null,
          requiredSubjectId: target.requiredSubjectId ?? null,
          roleKey: target.roleKey ?? null,
          weight: target.weight,
          sortOrder: target.sortOrder,
          metadata: target.metadata ?? {},
        })),
      ).returning();

      return { rule, targets };
    });

    return ok(c, result, 201);
  },
);
