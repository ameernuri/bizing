/**
 * Offer + offer version routes (biz-scoped).
 */

import { Hono } from 'hono'
import crypto from 'node:crypto'
import { and, asc, desc, eq, ilike, sql } from 'drizzle-orm'
import { z } from 'zod'
import dbPackage from '@bizing/db'
import {
  getCurrentAuthCredentialId,
  getCurrentAuthSource,
  getCurrentUser,
  requireAclPermission,
  requireAuth,
  requireBizAccess,
} from '../middleware/auth.js'
import {
  ensureCanonicalSellableForOfferVersion,
  persistCanonicalAction,
} from '../services/action-runtime.js'
import { executeCrudRouteAction } from '../services/action-route-bridge.js'
import { fail, ok, parsePositiveInt } from './_api.js'

const { db, bizes, offers, offerVersions, offerVersionAdmissionModes, bookingOrders } = dbPackage

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
  locationId: z.string().optional(),
})

const publicOfferAvailabilityQuerySchema = z.object({
  offerVersionId: z.string().optional(),
  from: z.string().datetime().optional(),
  limit: z.string().optional(),
  viewerTier: z.string().min(1).max(80).optional(),
})

const publicWalkUpQuerySchema = z.object({
  offerVersionId: z.string().optional(),
  locationId: z.string().optional(),
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

const admissionModeBodySchema = z.object({
  mode: z.enum(['slot', 'queue', 'request', 'auction', 'async', 'route_trip', 'open_access', 'itinerary']),
  modeConfigValueId: z.string().optional().nullable(),
  status: z.enum(['draft', 'active', 'inactive', 'suspended', 'archived']).default('active'),
  isPrimary: z.boolean().default(false),
  isCustomerVisible: z.boolean().default(true),
  priority: z.number().int().min(0).default(100),
  effectiveStartAt: z.string().datetime().optional().nullable(),
  effectiveEndAt: z.string().datetime().optional().nullable(),
  policy: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
})

const updateOfferVersionBodySchema = createOfferVersionBodySchema
  .omit({ version: true })
  .partial()

async function executeBizAction(c: Parameters<typeof getCurrentUser>[0], bizId: string, actionKey: string, payload: Record<string, unknown>) {
  const user = getCurrentUser(c)
  if (!user) throw new Error('Authentication required.')
  return persistCanonicalAction({
    bizId,
    input: { actionKey, payload, metadata: {} },
    intentMode: 'execute',
    context: {
      bizId,
      user,
      authSource: getCurrentAuthSource(c),
      authCredentialId: getCurrentAuthCredentialId(c),
      requestId: c.get('requestId'),
      accessMode: 'biz',
    },
  })
}

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
    showAllSlots: tierPolicy.showAllSlots === true || tierPolicy.fullAccess === true,
    defaultVisibleSlotCount,
    defaultAdvanceDays,
    raw: slotVisibility,
  }
}

function clampRatio(value: unknown, fallback: number) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.max(0, Math.min(0.95, value))
}

function hashFraction(input: string) {
  const digest = crypto.createHash('sha256').update(input).digest()
  const integer = digest.readUInt32BE(0)
  return integer / 0xffffffff
}

/**
 * Slot-scarcity policy intentionally hides some real availability.
 *
 * ELI5:
 * Sometimes a business wants to show "some, but not all" of its open time.
 * This helper calculates that rule in one place so the API can stay honest
 * about:
 * - how many slots are truly open,
 * - how many are being hidden on purpose,
 * - which viewers should bypass scarcity.
 */
function resolveSlotScarcityPolicy(policyModel: unknown, viewerTier: string, at: Date) {
  const policy = asRecord(policyModel)
  const scarcity = asRecord(policy.slotScarcity)
  const monthlyOverrides = Array.isArray(scarcity.seasonalOverrides) ? scarcity.seasonalOverrides : []
  const month = at.getUTCMonth() + 1
  const seasonalOverride = monthlyOverrides
    .map((value) => asRecord(value))
    .find((row) => Array.isArray(row.months) && row.months.includes(month))
  const seasonalHideRatio =
    seasonalOverride && typeof seasonalOverride.hideRatio === 'number'
      ? clampRatio(seasonalOverride.hideRatio, 0)
      : null
  const hideRatio = seasonalHideRatio ?? clampRatio(scarcity.hideRatio, 0)
  const urgentRevealHours = clampInt(scarcity.urgentRevealHours, 48, 0, 168)
  const randomize = scarcity.randomize !== false
  const emergencyShowAll = scarcity.emergencyShowAll === true
  const preferredViewerTiers = Array.isArray(scarcity.preferredViewerTiers)
    ? scarcity.preferredViewerTiers.filter((value): value is string => typeof value === 'string')
    : []
  const viewerBypassesScarcity = preferredViewerTiers.includes(viewerTier)
  const seed = typeof scarcity.seed === 'string' && scarcity.seed.length > 0 ? scarcity.seed : 'default'

  return {
    enabled: hideRatio > 0,
    hideRatio,
    urgentRevealHours,
    randomize,
    emergencyShowAll,
    viewerBypassesScarcity,
    seasonalRuleApplied: seasonalHideRatio !== null,
    seed,
  }
}

/**
 * Optional date-scope gate layered on top of weekly availability.
 *
 * ELI5:
 * Weekly rules answer "what hours are normal on Mondays/Saturdays/etc."
 * This helper answers "which exact date ranges are actually allowed right now?"
 *
 * That lets the same scheduling engine cover:
 * - pop-up venues that are bookable only on specific weekends,
 * - seasonal inventory,
 * - temporary campaigns or one-off ad-hoc meeting links.
 */
function resolveDateAvailabilityPolicy(policyModel: unknown) {
  const policy = asRecord(policyModel)
  const dateAvailability = asRecord(policy.dateAvailability)
  const rawRanges = Array.isArray(dateAvailability.allowedDateRanges)
    ? dateAvailability.allowedDateRanges
    : []

  const allowedDateRanges = rawRanges
    .map((value) => {
      const row = asRecord(value)
      const startAt = typeof row.startAt === 'string' ? new Date(row.startAt) : null
      const endAt = typeof row.endAt === 'string' ? new Date(row.endAt) : null
      if (!startAt || !endAt) return null
      if (!Number.isFinite(startAt.getTime()) || !Number.isFinite(endAt.getTime())) return null
      if (endAt.getTime() <= startAt.getTime()) return null
      return { startAt, endAt }
    })
    .filter(Boolean) as Array<{ startAt: Date; endAt: Date }>

  return {
    allowedDateRanges,
    hasAllowedDateRanges: allowedDateRanges.length > 0,
  }
}

export const offerRoutes = new Hono()

async function createOfferCrudRow(
  c: Parameters<typeof executeCrudRouteAction>[0]['c'],
  bizId: string,
  tableKey: string,
  data: Record<string, unknown>,
  subjectType: string,
  displayName: string,
) {
  const result = await executeCrudRouteAction({
    c,
    bizId,
    tableKey,
    operation: 'create',
    data,
    subjectType,
    displayName,
  })
  if (!result.ok) return fail(c, result.code, result.message, result.httpStatus, result.details)
  return result.row
}

async function updateOfferCrudRow(
  c: Parameters<typeof executeCrudRouteAction>[0]['c'],
  bizId: string,
  tableKey: string,
  id: string,
  patch: Record<string, unknown>,
  subjectType: string,
  displayName: string,
) {
  const result = await executeCrudRouteAction({
    c,
    bizId,
    tableKey,
    operation: 'update',
    id,
    patch,
    subjectType,
    subjectId: id,
    displayName,
  })
  if (!result.ok) return fail(c, result.code, result.message, result.httpStatus, result.details)
  return result.row
}

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

  const filteredRows = parsed.data.locationId
    ? rows.filter((row) => {
        const metadata =
          row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
            ? (row.metadata as Record<string, unknown>)
            : {}
        const locationIds = Array.isArray(metadata.locationIds) ? metadata.locationIds : []
        return locationIds.includes(parsed.data.locationId)
      })
    : rows

  return ok(c, filteredRows)
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

  /**
   * Manual blocked windows come from biz availability metadata.
   *
   * ELI5:
   * Business can say "even if the normal weekly schedule is open, hide this
   * exact window from bookable availability". That covers emergency holds,
   * lunch closures, maintenance, and similar exceptions without changing the
   * weekly template.
   */
  const blockedWindowRows = Array.isArray(availability.blockedWindows)
    ? availability.blockedWindows
    : []
  for (const row of blockedWindowRows) {
    const asRecordRow = asRecord(row)
    const startAt = asRecordRow.startAt
    const endAt = asRecordRow.endAt
    if (typeof startAt !== 'string' || typeof endAt !== 'string') continue
    const startMs = new Date(startAt).getTime()
    const endMs = new Date(endAt).getTime()
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) continue
    blockedWindows.push({ startAt: startMs, endAt: endMs })
  }

  const durationMin = Math.max(Number(offerVersion.defaultDurationMin ?? 60), 1)
  const stepMin = Math.max(Number(offerVersion.durationStepMin ?? durationMin), 1)
  const dateAvailabilityPolicy = resolveDateAvailabilityPolicy(offerVersion.policyModel)
  const fromDay = startOfUtcDay(fromAt)

  const slots: Array<{ startAt: string; endAt: string }> = []
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
        if (
          dateAvailabilityPolicy.hasAllowedDateRanges &&
          !dateAvailabilityPolicy.allowedDateRanges.some(
            /**
             * A slot should fit entirely inside an allowed date range.
             *
             * ELI5:
             * If the biz says "only this exact window is bookable", we should
             * not leak a slot that starts before the window or ends after it.
             */
            (range) => range.startAt.getTime() <= slotStartMs && range.endAt.getTime() >= slotEndMs,
          )
        ) {
          continue
        }
        const hasConflict = blockedWindows.some(
          (windowRange) => windowRange.startAt < slotEndMs && windowRange.endAt > slotStartMs,
        )
        if (hasConflict) continue

        slots.push({
          startAt: slotStart.toISOString(),
          endAt: slotEnd.toISOString(),
        })
      }
    }
  }

  const scarcityPolicy = resolveSlotScarcityPolicy(offerVersion.policyModel, viewerTier, fromAt)
  const visibleBeforeLimit = scarcityPolicy.enabled && !scarcityPolicy.emergencyShowAll && !visibilityPolicy.showAllSlots && !scarcityPolicy.viewerBypassesScarcity
    ? slots.filter((slot, index) => {
        const slotStart = new Date(slot.startAt)
        const hoursFromNow = (slotStart.getTime() - now.getTime()) / (60 * 60 * 1000)
        if (hoursFromNow <= scarcityPolicy.urgentRevealHours) return true
        if (!scarcityPolicy.randomize) {
          return index % Math.max(Math.round(1 / Math.max(0.01, 1 - scarcityPolicy.hideRatio)), 1) === 0
        }
        return hashFraction(`${scarcityPolicy.seed}:${slot.startAt}`) >= scarcityPolicy.hideRatio
      })
    : slots

  const hasMore = visibleBeforeLimit.length > effectiveVisibleLimit
  const visibleSlots = visibleBeforeLimit.slice(0, effectiveVisibleLimit)
  const nextHiddenSlot = hasMore ? visibleBeforeLimit[effectiveVisibleLimit] : null

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
      actualOpenSlotCount: slots.length,
      visibleBeforeLimitCount: visibleBeforeLimit.length,
      hiddenByScarcityCount: Math.max(0, slots.length - visibleBeforeLimit.length),
      hasMore,
      nextHiddenSlotStartAt: nextHiddenSlot?.startAt ?? null,
      scarcity: {
        enabled: scarcityPolicy.enabled,
        hideRatio: scarcityPolicy.hideRatio,
        urgentRevealHours: scarcityPolicy.urgentRevealHours,
        emergencyShowAll: scarcityPolicy.emergencyShowAll,
        viewerBypassesScarcity: scarcityPolicy.viewerBypassesScarcity || visibilityPolicy.showAllSlots,
        seasonalRuleApplied: scarcityPolicy.seasonalRuleApplied,
      },
    },
    slots: visibleSlots,
  })
})

/**
 * Public walk-up entrypoint for "scan a QR and book on the spot".
 *
 * ELI5:
 * The QR code can point at this route. It gives the mobile UI just enough
 * information to render "what is this offer?" and "where do I fetch
 * availability + submit the booking?" without forcing the scanner to know
 * internal API topology ahead of time.
 *
 * Why this matters:
 * - QR booking should be one stable public contract,
 * - the route stays dynamic because it resolves the current published offer
 *   state at read time,
 * - sagas can prove walk-up flows through API-only reads.
 */
offerRoutes.get('/public/bizes/:bizId/offers/:offerId/walk-up', async (c) => {
  const { bizId, offerId } = c.req.param()
  const parsed = publicWalkUpQuerySchema.safeParse(c.req.query())
  if (!parsed.success) {
    return fail(c, 'VALIDATION_ERROR', 'Invalid query parameters.', 400, parsed.error.flatten())
  }

  const offer = await db.query.offers.findFirst({
    where: and(eq(offers.bizId, bizId), eq(offers.id, offerId)),
  })
  if (!offer || !offer.isPublished || offer.status !== 'active') {
    return fail(c, 'NOT_BOOKABLE', 'Offer is not publicly walk-up bookable.', 409)
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

  const locationId = parsed.data.locationId ?? null
  const availabilityPath = `/api/v1/public/bizes/${bizId}/offers/${offerId}/availability?offerVersionId=${offerVersion.id}`
  const bookingCreatePath = `/api/v1/public/bizes/${bizId}/booking-orders`

  return ok(c, {
    mode: 'walk_up_booking',
    offer: {
      id: offer.id,
      name: offer.name,
      slug: offer.slug,
      executionMode: offer.executionMode,
      timezone: offer.timezone,
    },
    offerVersion: {
      id: offerVersion.id,
      durationMode: offerVersion.durationMode,
      defaultDurationMin: offerVersion.defaultDurationMin,
      basePriceMinor: offerVersion.basePriceMinor,
      currency: offerVersion.currency,
    },
    locationId,
    availabilityPath,
    bookingCreatePath,
    bookingTemplate: {
      offerId,
      offerVersionId: offerVersion.id,
      locationId,
    },
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

    const body = await c.req.json().catch(() => null)
    const parsed = createOfferBodySchema.safeParse(body)
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    }

    const action = await executeBizAction(c, bizId, 'offer.create', parsed.data)
    const createdId = (action.actionRequest as { outputPayload?: Record<string, unknown> }).outputPayload?.offerId
    const created = await db.query.offers.findFirst({
      where: and(eq(offers.bizId, bizId), eq(offers.id, String(createdId))),
    })
    if (!created) return fail(c, 'INTERNAL_ERROR', 'Offer action succeeded but row could not be reloaded.', 500)

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

    const updated = await updateOfferCrudRow(c, bizId, 'offerVersions', offerVersionId, {
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
      }, 'offer_version', `${offerId}:${offerVersionId}`)
    if (updated instanceof Response) return updated

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

    const body = await c.req.json().catch(() => null)
    const parsed = updateOfferBodySchema.safeParse(body)
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    }

    const existing = await db.query.offers.findFirst({
      where: and(eq(offers.bizId, bizId), eq(offers.id, offerId)),
    })
    if (!existing) return fail(c, 'NOT_FOUND', 'Offer not found.', 404)

    const action = await executeBizAction(c, bizId, 'offer.update', {
      offerId,
      ...parsed.data,
    })
    const updatedId = (action.actionRequest as { outputPayload?: Record<string, unknown> }).outputPayload?.offerId
    const updated = await db.query.offers.findFirst({
      where: and(eq(offers.bizId, bizId), eq(offers.id, String(updatedId))),
    })
    if (!updated) return fail(c, 'INTERNAL_ERROR', 'Offer action succeeded but row could not be reloaded.', 500)

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

    const existing = await db.query.offers.findFirst({
      where: and(eq(offers.bizId, bizId), eq(offers.id, offerId)),
    })
    if (!existing) return fail(c, 'NOT_FOUND', 'Offer not found.', 404)

    await executeBizAction(c, bizId, 'offer.archive', { offerId })

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

offerRoutes.get(
  '/bizes/:bizId/offers/:offerId/versions/:offerVersionId/admission-modes',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('offers.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, offerId, offerVersionId } = c.req.param()
    const version = await db.query.offerVersions.findFirst({
      where: and(eq(offerVersions.bizId, bizId), eq(offerVersions.offerId, offerId), eq(offerVersions.id, offerVersionId)),
      columns: { id: true },
    })
    if (!version) return fail(c, 'NOT_FOUND', 'Offer version not found.', 404)
    const rows = await db.query.offerVersionAdmissionModes.findMany({
      where: and(eq(offerVersionAdmissionModes.bizId, bizId), eq(offerVersionAdmissionModes.offerVersionId, offerVersionId)),
      orderBy: [asc(offerVersionAdmissionModes.priority), desc(offerVersionAdmissionModes.isPrimary)],
    })
    return ok(c, rows)
  },
)

offerRoutes.post(
  '/bizes/:bizId/offers/:offerId/versions/:offerVersionId/admission-modes',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('offers.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, offerId, offerVersionId } = c.req.param()
    const parsed = admissionModeBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())

    const version = await db.query.offerVersions.findFirst({
      where: and(eq(offerVersions.bizId, bizId), eq(offerVersions.offerId, offerId), eq(offerVersions.id, offerVersionId)),
      columns: { id: true },
    })
    if (!version) return fail(c, 'NOT_FOUND', 'Offer version not found.', 404)

    const existing = await db.query.offerVersionAdmissionModes.findFirst({
      where: and(
        eq(offerVersionAdmissionModes.bizId, bizId),
        eq(offerVersionAdmissionModes.offerVersionId, offerVersionId),
        eq(offerVersionAdmissionModes.mode, parsed.data.mode),
      ),
    })

    if (parsed.data.isPrimary) {
      const existingPrimary = await db.query.offerVersionAdmissionModes.findMany({
        where: and(
          eq(offerVersionAdmissionModes.bizId, bizId),
          eq(offerVersionAdmissionModes.offerVersionId, offerVersionId),
        ),
      })
      for (const modeRow of existingPrimary) {
        const cleared = await updateOfferCrudRow(
          c,
          bizId,
          'offerVersionAdmissionModes',
          modeRow.id,
          { isPrimary: false },
          'offer_admission_mode',
          modeRow.mode,
        )
        if (cleared instanceof Response) return cleared
      }
    }

    const values = {
      modeConfigValueId: parsed.data.modeConfigValueId ?? null,
      status: parsed.data.status,
      isPrimary: parsed.data.isPrimary,
      isCustomerVisible: parsed.data.isCustomerVisible,
      priority: parsed.data.priority,
      effectiveStartAt: parsed.data.effectiveStartAt ? new Date(parsed.data.effectiveStartAt) : null,
      effectiveEndAt: parsed.data.effectiveEndAt ? new Date(parsed.data.effectiveEndAt) : null,
      policy: parsed.data.policy ?? {},
      metadata: parsed.data.metadata ?? {},
    }

    const saved = existing
      ? await updateOfferCrudRow(
          c,
          bizId,
          'offerVersionAdmissionModes',
          existing.id,
          values,
          'offer_admission_mode',
          parsed.data.mode,
        )
      : await createOfferCrudRow(
          c,
          bizId,
          'offerVersionAdmissionModes',
          {
            bizId,
            offerVersionId,
            mode: parsed.data.mode,
            ...values,
          },
          'offer_admission_mode',
          parsed.data.mode,
        )
    if (saved instanceof Response) return saved

    return ok(c, saved, 201)
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

    const created = await createOfferCrudRow(
      c,
      bizId,
      'offerVersions',
      {
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
      },
      'offer_version',
      `${offerId}:v${parsed.data.version}`,
    )
    if (created instanceof Response) return created

    await ensureCanonicalSellableForOfferVersion({
      bizId,
      offerVersionId: String((created as Record<string, unknown>).id),
      displayName: `${parent.name} v${String((created as Record<string, unknown>).version)}`,
      slug: `${parent.slug}-v${String((created as Record<string, unknown>).version)}`,
      currency: String((created as Record<string, unknown>).currency),
      status: String((created as Record<string, unknown>).status),
    })

    return ok(c, created, 201)
  },
)
