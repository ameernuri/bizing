import { and, asc, eq, inArray, or } from 'drizzle-orm'
import dbPackage from '@bizing/db'
import type { PreparedResolverContext, ResolvedBindingLayer, ResolverInput, LayerType } from './availability-types.js'
import { buildCalendarRuntimeContexts } from './availability-calendar-runtime.js'

const { db, calendarBindings, scheduleSubjects } = dbPackage

type CalendarBindingRow = typeof calendarBindings.$inferSelect
type SubjectPair = { subjectType: string; subjectId: string }
type PreparedResolverContextCacheEntry = {
  expiresAt: number
  context: PreparedResolverContext
}

const PREPARED_CONTEXT_TTL_MS = 15_000
const MAX_PREPARED_CONTEXT_CACHE_ENTRIES = 200
const preparedResolverContextCache = new Map<string, PreparedResolverContextCacheEntry>()

function bindingLayerType(binding: CalendarBindingRow): LayerType | null {
  switch (binding.ownerType) {
    case 'biz':
      return 'biz'
    case 'location':
      return 'location'
    case 'offer':
      return 'offer'
    case 'offer_version':
      return 'offer_version'
    case 'service':
      return 'service'
    case 'service_product':
      return 'service_product'
    case 'user':
      return 'provider_user'
    case 'resource':
      return 'resource'
    case 'custom_subject':
      return 'custom_subject'
    default:
      return null
  }
}

function bindingAppliesToInput(
  binding: CalendarBindingRow,
  input: ResolverInput,
  requestedScheduleSubjectIds: Set<string>,
) {
  if (binding.scheduleSubjectId && requestedScheduleSubjectIds.has(binding.scheduleSubjectId)) {
    return true
  }

  switch (binding.ownerType) {
    case 'biz':
      return true
    case 'user':
      return Boolean(input.providerUserId && binding.ownerUserId === input.providerUserId)
    default:
      return false
  }
}

function toResolvedBindingLayer(binding: CalendarBindingRow): ResolvedBindingLayer | null {
  const layerType = bindingLayerType(binding)
  if (!layerType) return null
  return {
    layerType,
    bindingId: binding.id,
    calendarId: binding.calendarId,
    priority: Number(binding.priority ?? 100),
    isRequired: binding.isRequired === true,
  }
}

function requestedSubjectPairs(input: ResolverInput): SubjectPair[] {
  const pairs: SubjectPair[] = []
  const push = (subjectType: string | null | undefined, subjectId: string | null | undefined) => {
    if (!subjectType || !subjectId) return
    if (pairs.some((row) => row.subjectType === subjectType && row.subjectId === subjectId)) return
    pairs.push({ subjectType, subjectId })
  }

  push('location', input.locationId ?? null)
  push('offer', input.offerId ?? null)
  push('offer_version', input.offerVersionId ?? null)
  push('service', input.serviceId ?? null)
  push('service_product', input.serviceProductId ?? null)
  push('resource', input.resourceId ?? null)
  push(input.customSubjectType ?? null, input.customSubjectId ?? null)

  return pairs
}

async function resolveRequestedScheduleSubjectIds(input: ResolverInput) {
  const pairs = requestedSubjectPairs(input)
  if (pairs.length === 0) return new Set<string>()

  const rows = await db.query.scheduleSubjects.findMany({
    where: and(
      eq(scheduleSubjects.bizId, input.bizId),
      eq(scheduleSubjects.status, 'active'),
      or(
        ...pairs.map((pair) =>
          and(eq(scheduleSubjects.subjectType, pair.subjectType), eq(scheduleSubjects.subjectId, pair.subjectId)),
        ),
      ),
    ),
    columns: { id: true },
  })

  return new Set(rows.map((row) => row.id))
}

async function loadCandidateBindings(input: ResolverInput, requestedScheduleSubjectIds: Set<string>) {
  const clauses = [eq(calendarBindings.ownerType, 'biz')]
  const providerUserId = input.providerUserId ?? null

  if (providerUserId) {
    const userClause = and(eq(calendarBindings.ownerType, 'user'), eq(calendarBindings.ownerUserId, providerUserId))
    if (userClause) clauses.push(userClause)
  }
  if (requestedScheduleSubjectIds.size > 0) {
    const subjectClause = inArray(calendarBindings.scheduleSubjectId, Array.from(requestedScheduleSubjectIds))
    if (subjectClause) clauses.push(subjectClause)
  }

  return db.query.calendarBindings.findMany({
    where: and(
      eq(calendarBindings.bizId, input.bizId),
      eq(calendarBindings.isActive, true),
      eq(calendarBindings.isPrimary, true),
      clauses.length === 1 ? clauses[0]! : or(...clauses),
    ),
    orderBy: [asc(calendarBindings.priority), asc(calendarBindings.id)],
  })
}

function preparedResolverContextCacheKey(
  input: ResolverInput,
  windowStartAt: Date,
  windowEndAt: Date,
) {
  return JSON.stringify({
    bizId: input.bizId,
    offerId: input.offerId ?? null,
    offerVersionId: input.offerVersionId ?? null,
    serviceId: input.serviceId ?? null,
    serviceProductId: input.serviceProductId ?? null,
    locationId: input.locationId ?? null,
    providerUserId: input.providerUserId ?? null,
    resourceId: input.resourceId ?? null,
    customSubjectType: input.customSubjectType ?? null,
    customSubjectId: input.customSubjectId ?? null,
    windowStartAt: windowStartAt.toISOString(),
    windowEndAt: windowEndAt.toISOString(),
  })
}

function getCachedPreparedResolverContext(cacheKey: string) {
  const cached = preparedResolverContextCache.get(cacheKey)
  if (!cached) return null
  if (cached.expiresAt <= Date.now()) {
    preparedResolverContextCache.delete(cacheKey)
    return null
  }
  return cached.context
}

function setCachedPreparedResolverContext(cacheKey: string, context: PreparedResolverContext) {
  const now = Date.now()
  for (const [key, entry] of preparedResolverContextCache) {
    if (entry.expiresAt <= now) preparedResolverContextCache.delete(key)
  }
  preparedResolverContextCache.set(cacheKey, {
    expiresAt: now + PREPARED_CONTEXT_TTL_MS,
    context,
  })
  while (preparedResolverContextCache.size > MAX_PREPARED_CONTEXT_CACHE_ENTRIES) {
    const oldestKey = preparedResolverContextCache.keys().next().value
    if (!oldestKey) break
    preparedResolverContextCache.delete(oldestKey)
  }
}

export async function prepareResolverContext(
  input: ResolverInput,
  windowStartAt: Date,
  windowEndAt: Date,
): Promise<PreparedResolverContext> {
  const cacheKey = preparedResolverContextCacheKey(input, windowStartAt, windowEndAt)
  const cached = getCachedPreparedResolverContext(cacheKey)
  if (cached) return cached

  const requestedScheduleSubjectIds = await resolveRequestedScheduleSubjectIds(input)
  const bindings = await loadCandidateBindings(input, requestedScheduleSubjectIds)
  const relevantBindings = bindings
    .filter((binding) => bindingAppliesToInput(binding, input, requestedScheduleSubjectIds))
    .map((binding) => toResolvedBindingLayer(binding))
    .filter((binding): binding is ResolvedBindingLayer => Boolean(binding))

  const calendarsById = await buildCalendarRuntimeContexts(
    input.bizId,
    relevantBindings.map((binding) => binding.calendarId),
    windowStartAt,
    windowEndAt,
  )

  const context = {
    relevantBindings,
    calendarsById,
  }
  setCachedPreparedResolverContext(cacheKey, context)
  return context
}
