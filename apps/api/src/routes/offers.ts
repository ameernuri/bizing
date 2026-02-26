/**
 * Offer + offer version routes (biz-scoped).
 */

import { Hono } from 'hono'
import { and, asc, desc, eq, ilike, sql } from 'drizzle-orm'
import { z } from 'zod'
import dbPackage from '@bizing/db'
import {
  getCurrentUser,
  requireAclPermission,
  requireAuth,
  requireBizAccess,
} from '../middleware/auth.js'
import { fail, ok, parsePositiveInt } from './_api.js'

const { db, bizes, offers, offerVersions, bookingOrders } = dbPackage

const listOffersQuerySchema = z.object({
  page: z.string().optional(),
  perPage: z.string().optional(),
  status: z.enum(['draft', 'active', 'inactive', 'archived']).optional(),
  executionMode: z
    .enum(['slot', 'queue', 'request', 'auction', 'async', 'route_trip', 'open_access', 'itinerary'])
    .optional(),
  isPublished: z.enum(['true', 'false']).optional(),
  search: z.string().optional(),
  sortBy: z.enum(['name']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
})

const listPublicOffersQuerySchema = z.object({
  search: z.string().optional(),
  limit: z.string().optional(),
})

const publicOfferAvailabilityQuerySchema = z.object({
  offerVersionId: z.string().optional(),
  from: z.string().datetime().optional(),
  limit: z.string().optional(),
  viewerTier: z.string().min(1).max(80).optional(),
})

const createOfferBodySchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(140).regex(/^[a-z0-9-]+$/),
  description: z.string().max(4000).optional(),
  executionMode: z
    .enum(['slot', 'queue', 'request', 'auction', 'async', 'route_trip', 'open_access', 'itinerary'])
    .default('slot'),
  status: z.enum(['draft', 'active', 'inactive', 'archived']).default('draft'),
  isPublished: z.boolean().default(false),
  timezone: z.string().min(1).max(50).default('UTC'),
  metadata: z.record(z.unknown()).optional(),
})

const updateOfferBodySchema = createOfferBodySchema.partial()

const createOfferVersionBodySchema = z.object({
  version: z.number().int().positive(),
  status: z.enum(['draft', 'published', 'superseded', 'retired']).default('draft'),
  publishAt: z.string().datetime().optional(),
  retireAt: z.string().datetime().optional(),
  durationMode: z.enum(['fixed', 'flexible', 'multi_day']).default('fixed'),
  defaultDurationMin: z.number().int().positive().default(60),
  minDurationMin: z.number().int().positive().optional(),
  maxDurationMin: z.number().int().positive().optional(),
  durationStepMin: z.number().int().positive().default(15),
  basePriceMinor: z.number().int().min(0).default(0),
  currency: z.string().regex(/^[A-Z]{3}$/).default('USD'),
  pricingModel: z.record(z.unknown()).optional(),
  policyModel: z.record(z.unknown()).optional(),
  capacityModel: z.record(z.unknown()).optional(),
  revisionHash: z.string().max(128).optional(),
  metadata: z.record(z.unknown()).optional(),
})

const updateOfferVersionBodySchema = createOfferVersionBodySchema
  .omit({ version: true })
  .partial()

type WeekdayKey = 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat'

type ParsedWindow = {
  startMin: number
  endMin: number
}

type ParsedWeekWindows = Record<WeekdayKey, ParsedWindow[]>

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}

function clampInt(value: unknown, fallback: number, min: number, max: number) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  const rounded = Math.floor(value)
  return Math.max(min, Math.min(max, rounded))
}

function parseTimeRange(range: string): ParsedWindow | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)-([01]\d|2[0-3]):([0-5]\d)$/.exec(range.trim())
  if (!match) return null
  const startHour = Number(match[1])
  const startMinute = Number(match[2])
  const endHour = Number(match[3])
  const endMinute = Number(match[4])
  const startMin = startHour * 60 + startMinute
  const endMin = endHour * 60 + endMinute
  if (endMin <= startMin) return null
  return { startMin, endMin }
}

function parseWeeklyWindows(raw: unknown): ParsedWeekWindows {
  const defaults: ParsedWeekWindows = {
    sun: [],
    mon: [],
    tue: [],
    wed: [],
    thu: [],
    fri: [],
    sat: [],
  }
  const weekly = asRecord(raw)
  const keys: WeekdayKey[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
  for (const day of keys) {
    const ranges = weekly[day]
    if (!Array.isArray(ranges)) continue
    for (const value of ranges) {
      if (typeof value !== 'string') continue
      const parsed = parseTimeRange(value)
      if (parsed) defaults[day].push(parsed)
    }
  }
  return defaults
}

function weekdayUtc(date: Date): WeekdayKey {
  const keys: WeekdayKey[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
  return keys[date.getUTCDay()] ?? 'sun'
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

function addUtcDays(date: Date, days: number): Date {
  const result = new Date(date.getTime())
  result.setUTCDate(result.getUTCDate() + days)
  return result
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000)
}

function resolveSlotVisibilityPolicy(policyModel: unknown, viewerTier: string) {
  const policy = asRecord(policyModel)
  const slotVisibility = asRecord(policy.slotVisibility)
  const tierOverrides = asRecord(slotVisibility.tierOverrides)
  const tierPolicy = asRecord(tierOverrides[viewerTier])
  const maxVisibleSlots = 100

  const defaultVisibleSlotCount = clampInt(slotVisibility.defaultVisibleSlotCount, 20, 1, 50)
  const defaultAdvanceDays = clampInt(slotVisibility.defaultAdvanceDays, 30, 1, 120)

  const visibleSlotCount = clampInt(
    tierPolicy.visibleSlotCount,
    defaultVisibleSlotCount,
    1,
    maxVisibleSlots,
  )
  const advanceDays = clampInt(
    tierPolicy.advanceDays,
    defaultAdvanceDays,
    1,
    120,
  )

  return {
    visibleSlotCount,
    advanceDays,
    defaultVisibleSlotCount,
    defaultAdvanceDays,
    raw: slotVisibility,
  }
}

export const offerRoutes = new Hono()

/**
 * Public catalog surface.
 *
 * This is intentionally membership-free so customers can discover published
 * offers before joining a biz as an internal member.
 */
offerRoutes.get('/public/bizes/:bizId/offers', async (c) => {
  const bizId = c.req.param('bizId')
  const parsed = listPublicOffersQuerySchema.safeParse(c.req.query())
  if (!parsed.success) {
    return fail(c, 'VALIDATION_ERROR', 'Invalid query parameters.', 400, parsed.error.flatten())
  }

  const where = and(
    eq(offers.bizId, bizId),
    eq(offers.isPublished, true),
    eq(offers.status, 'active'),
    parsed.data.search ? ilike(offers.name, `%${parsed.data.search}%`) : undefined,
  )

  const limit = Math.min(parsePositiveInt(parsed.data.limit, 50), 200)
  const rows = await db.query.offers.findMany({
    where,
    orderBy: asc(offers.name),
    limit,
  })

  return ok(c, rows)
})

/**
 * Public availability read model for one offer.
 *
 * ELI5:
 * - Customers should see the "bookable times" list, not raw schedule internals.
 * - This endpoint applies lead time + advance window + visibility caps so the
 *   UI can render exactly what this viewer is allowed to see.
 */
offerRoutes.get('/public/bizes/:bizId/offers/:offerId/availability', async (c) => {
  const { bizId, offerId } = c.req.param()
  const parsed = publicOfferAvailabilityQuerySchema.safeParse(c.req.query())
  if (!parsed.success) {
    return fail(c, 'VALIDATION_ERROR', 'Invalid query parameters.', 400, parsed.error.flatten())
  }

  const offer = await db.query.offers.findFirst({
    where: and(eq(offers.bizId, bizId), eq(offers.id, offerId)),
  })
  if (!offer || !offer.isPublished || offer.status !== 'active') {
    return fail(c, 'NOT_BOOKABLE', 'Offer is not publicly bookable.', 409)
  }

  const offerVersion = parsed.data.offerVersionId
    ? await db.query.offerVersions.findFirst({
        where: and(
          eq(offerVersions.bizId, bizId),
          eq(offerVersions.offerId, offerId),
          eq(offerVersions.id, parsed.data.offerVersionId),
        ),
      })
    : await db.query.offerVersions.findFirst({
        where: and(
          eq(offerVersions.bizId, bizId),
          eq(offerVersions.offerId, offerId),
          eq(offerVersions.status, 'published'),
        ),
        orderBy: desc(offerVersions.version),
      })

  if (!offerVersion || offerVersion.status !== 'published') {
    return fail(c, 'NOT_BOOKABLE', 'No published offer version available.', 409)
  }

  const biz = await db.query.bizes.findFirst({ where: eq(bizes.id, bizId) })
  if (!biz) return fail(c, 'NOT_FOUND', 'Biz not found.', 404)

  const metadata = asRecord(biz.metadata)
  const availability = asRecord(metadata.availability)
  const weekly = parseWeeklyWindows(availability.weekly)
  const leadTimeHours = clampInt(availability.leadTimeHours, 0, 0, 168)
  const maxAdvanceDays = clampInt(availability.maxAdvanceDays, 30, 1, 120)

  const viewerTier = (parsed.data.viewerTier ?? 'default').toLowerCase()
  const visibilityPolicy = resolveSlotVisibilityPolicy(offerVersion.policyModel, viewerTier)
  const policyVisibleLimit = visibilityPolicy.visibleSlotCount
  const requestedLimit = Math.max(parsePositiveInt(parsed.data.limit, policyVisibleLimit), 1)
  const effectiveVisibleLimit = Math.min(requestedLimit, policyVisibleLimit)
  const effectiveAdvanceDays = Math.min(visibilityPolicy.advanceDays, maxAdvanceDays)

  const now = new Date()
  const fromAt = parsed.data.from ? new Date(parsed.data.from) : now
  const leadTimeStartAt = addMinutes(fromAt, leadTimeHours * 60)
  const searchEndAt = addUtcDays(fromAt, effectiveAdvanceDays)

  const allBookings = await db.query.bookingOrders.findMany({
    where: and(
      eq(bookingOrders.bizId, bizId),
      eq(bookingOrders.offerId, offerId),
      eq(bookingOrders.offerVersionId, offerVersion.id),
    ),
  })
  const blockedStatuses = new Set(['confirmed', 'checked_in', 'in_progress'])
  const blockedWindows = allBookings
    .filter((row) => blockedStatuses.has(row.status))
    .filter((row) => row.confirmedStartAt && row.confirmedEndAt)
    .map((row) => ({
      startAt: (row.confirmedStartAt as Date).getTime(),
      endAt: (row.confirmedEndAt as Date).getTime(),
    }))

  const durationMin = Math.max(Number(offerVersion.defaultDurationMin ?? 60), 1)
  const stepMin = Math.max(Number(offerVersion.durationStepMin ?? durationMin), 1)
  const fromDay = startOfUtcDay(fromAt)

  const slots: Array<{ startAt: string; endAt: string }> = []
  const stopAfter = effectiveVisibleLimit + 1

  for (let dayOffset = 0; dayOffset <= effectiveAdvanceDays; dayOffset += 1) {
    const dayStart = addUtcDays(fromDay, dayOffset)
    const dayKey = weekdayUtc(dayStart)
    const windows = weekly[dayKey]
    if (!windows.length) continue

    for (const window of windows) {
      const latestStartMin = window.endMin - durationMin
      if (latestStartMin < window.startMin) continue
      for (let minute = window.startMin; minute <= latestStartMin; minute += stepMin) {
        const slotStart = addMinutes(dayStart, minute)
        if (slotStart < fromAt || slotStart < leadTimeStartAt) continue
        if (slotStart > searchEndAt) continue

        const slotEnd = addMinutes(slotStart, durationMin)
        const slotStartMs = slotStart.getTime()
        const slotEndMs = slotEnd.getTime()
        const hasConflict = blockedWindows.some(
          (windowRange) => windowRange.startAt < slotEndMs && windowRange.endAt > slotStartMs,
        )
        if (hasConflict) continue

        slots.push({
          startAt: slotStart.toISOString(),
          endAt: slotEnd.toISOString(),
        })
        if (slots.length >= stopAfter) break
      }
      if (slots.length >= stopAfter) break
    }
    if (slots.length >= stopAfter) break
  }

  const hasMore = slots.length > effectiveVisibleLimit
  const visibleSlots = slots.slice(0, effectiveVisibleLimit)
  const nextHiddenSlot = hasMore ? slots[effectiveVisibleLimit] : null

  return ok(c, {
    offerId,
    offerVersionId: offerVersion.id,
    timezone: offer.timezone || biz.timezone || 'UTC',
    generatedAt: new Date().toISOString(),
    visibility: {
      viewerTier,
      requestedLimit,
      effectiveVisibleSlotCount: effectiveVisibleLimit,
      effectiveAdvanceDays,
      leadTimeHours,
      hasMore,
      nextHiddenSlotStartAt: nextHiddenSlot?.startAt ?? null,
    },
    slots: visibleSlots,
  })
})

offerRoutes.get(
  '/bizes/:bizId/offers',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('offers.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
  const parsed = listOffersQuerySchema.safeParse(c.req.query())
  if (!parsed.success) {
    return fail(c, 'VALIDATION_ERROR', 'Invalid query parameters.', 400, parsed.error.flatten())
  }

  const {
    page,
    perPage,
    status,
    executionMode,
    isPublished,
    search,
    sortBy = 'name',
    sortOrder = 'desc',
  } = parsed.data

  const pageNum = parsePositiveInt(page, 1)
  const perPageNum = Math.min(parsePositiveInt(perPage, 20), 100)

  const where = and(
    eq(offers.bizId, bizId),
    status ? eq(offers.status, status) : undefined,
    executionMode ? eq(offers.executionMode, executionMode) : undefined,
    isPublished ? eq(offers.isPublished, isPublished === 'true') : undefined,
    search ? ilike(offers.name, `%${search}%`) : undefined,
  )

  const sortColumn = sortBy === 'name' ? offers.name : offers.name
  const orderByExpr = sortOrder === 'asc' ? asc(sortColumn) : desc(sortColumn)

  const [rows, countRows] = await Promise.all([
    db.query.offers.findMany({
      where,
      orderBy: orderByExpr,
      limit: perPageNum,
      offset: (pageNum - 1) * perPageNum,
    }),
    db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(offers).where(where),
  ])

  const total = countRows[0]?.count ?? 0
    return ok(c, rows, 200, {
    pagination: {
      page: pageNum,
      perPage: perPageNum,
      total,
      hasMore: pageNum * perPageNum < total,
    },
  })
  },
)

offerRoutes.post(
  '/bizes/:bizId/offers',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('offers.create', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const _user = getCurrentUser(c)

    const body = await c.req.json().catch(() => null)
    const parsed = createOfferBodySchema.safeParse(body)
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    }

    const [created] = await db
      .insert(offers)
      .values({
        bizId,
        name: parsed.data.name,
        slug: parsed.data.slug,
        description: parsed.data.description,
        executionMode: parsed.data.executionMode,
        status: parsed.data.status,
        isPublished: parsed.data.isPublished,
        timezone: parsed.data.timezone,
        metadata: parsed.data.metadata ?? {},
      })
      .returning()

    return ok(c, created, 201)
  },
)

offerRoutes.patch(
  '/bizes/:bizId/offers/:offerId/versions/:offerVersionId',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('offers.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, offerId, offerVersionId } = c.req.param()

    const body = await c.req.json().catch(() => null)
    const parsed = updateOfferVersionBodySchema.safeParse(body)
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    }

    const existing = await db.query.offerVersions.findFirst({
      where: and(
        eq(offerVersions.bizId, bizId),
        eq(offerVersions.offerId, offerId),
        eq(offerVersions.id, offerVersionId),
      ),
    })
    if (!existing) return fail(c, 'NOT_FOUND', 'Offer version not found.', 404)

    const [updated] = await db
      .update(offerVersions)
      .set({
        status: parsed.data.status,
        publishAt: parsed.data.publishAt ? new Date(parsed.data.publishAt) : undefined,
        retireAt: parsed.data.retireAt ? new Date(parsed.data.retireAt) : undefined,
        durationMode: parsed.data.durationMode,
        defaultDurationMin: parsed.data.defaultDurationMin,
        minDurationMin: parsed.data.minDurationMin,
        maxDurationMin: parsed.data.maxDurationMin,
        durationStepMin: parsed.data.durationStepMin,
        basePriceMinor: parsed.data.basePriceMinor,
        currency: parsed.data.currency,
        pricingModel: parsed.data.pricingModel,
        policyModel: parsed.data.policyModel,
        capacityModel: parsed.data.capacityModel,
        revisionHash: parsed.data.revisionHash,
        metadata: parsed.data.metadata,
      })
      .where(
        and(
          eq(offerVersions.bizId, bizId),
          eq(offerVersions.offerId, offerId),
          eq(offerVersions.id, offerVersionId),
        ),
      )
      .returning()

    return ok(c, updated)
  },
)

offerRoutes.get(
  '/bizes/:bizId/offers/:offerId',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('offers.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, offerId } = c.req.param()
    const row = await db.query.offers.findFirst({
      where: and(eq(offers.bizId, bizId), eq(offers.id, offerId)),
    })

    if (!row) return fail(c, 'NOT_FOUND', 'Offer not found.', 404)
    return ok(c, row)
  },
)

offerRoutes.patch(
  '/bizes/:bizId/offers/:offerId',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('offers.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, offerId } = c.req.param()
    const _user = getCurrentUser(c)

    const body = await c.req.json().catch(() => null)
    const parsed = updateOfferBodySchema.safeParse(body)
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    }

    const existing = await db.query.offers.findFirst({
      where: and(eq(offers.bizId, bizId), eq(offers.id, offerId)),
    })
    if (!existing) return fail(c, 'NOT_FOUND', 'Offer not found.', 404)

    const [updated] = await db
      .update(offers)
      .set({
        ...parsed.data,
      })
      .where(and(eq(offers.bizId, bizId), eq(offers.id, offerId)))
      .returning()

    return ok(c, updated)
  },
)

offerRoutes.delete(
  '/bizes/:bizId/offers/:offerId',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('offers.archive', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, offerId } = c.req.param()
    const _user = getCurrentUser(c)

    const existing = await db.query.offers.findFirst({
      where: and(eq(offers.bizId, bizId), eq(offers.id, offerId)),
    })
    if (!existing) return fail(c, 'NOT_FOUND', 'Offer not found.', 404)

    await db
      .update(offers)
      .set({
        status: 'archived',
      })
      .where(and(eq(offers.bizId, bizId), eq(offers.id, offerId)))

    return ok(c, { id: offerId })
  },
)

offerRoutes.get(
  '/bizes/:bizId/offers/:offerId/versions',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('offers.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, offerId } = c.req.param()

    const rows = await db.query.offerVersions.findMany({
      where: and(eq(offerVersions.bizId, bizId), eq(offerVersions.offerId, offerId)),
      orderBy: desc(offerVersions.version),
    })

    return ok(c, rows)
  },
)

offerRoutes.post(
  '/bizes/:bizId/offers/:offerId/versions',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('offers.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, offerId } = c.req.param()
    const _user = getCurrentUser(c)

    const body = await c.req.json().catch(() => null)
    const parsed = createOfferVersionBodySchema.safeParse(body)
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    }

    const parent = await db.query.offers.findFirst({
      where: and(eq(offers.bizId, bizId), eq(offers.id, offerId)),
    })
    if (!parent) return fail(c, 'NOT_FOUND', 'Offer not found.', 404)

    const [created] = await db
      .insert(offerVersions)
      .values({
        bizId,
        offerId,
        version: parsed.data.version,
        status: parsed.data.status,
        publishAt: parsed.data.publishAt ? new Date(parsed.data.publishAt) : undefined,
        retireAt: parsed.data.retireAt ? new Date(parsed.data.retireAt) : undefined,
        durationMode: parsed.data.durationMode,
        defaultDurationMin: parsed.data.defaultDurationMin,
        minDurationMin: parsed.data.minDurationMin,
        maxDurationMin: parsed.data.maxDurationMin,
        durationStepMin: parsed.data.durationStepMin,
        basePriceMinor: parsed.data.basePriceMinor,
        currency: parsed.data.currency,
        pricingModel: parsed.data.pricingModel ?? {},
        policyModel: parsed.data.policyModel ?? {},
        capacityModel: parsed.data.capacityModel ?? {},
        revisionHash: parsed.data.revisionHash,
        metadata: parsed.data.metadata ?? {},
      })
      .returning()

    return ok(c, created, 201)
  },
)
