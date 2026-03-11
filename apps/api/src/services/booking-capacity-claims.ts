import { and, eq, inArray, ne, sql } from 'drizzle-orm'
import dbPackage from '@bizing/db'
import { syncBookingCapacityReservationMirror } from './capacity-reservation-ledger.js'

const {
  db,
  bookingCapacityClaims,
  timeScopes,
} = dbPackage

type BookingCapacityExecutor = typeof db

const CAPACITY_BLOCKING_BOOKING_STATUSES = new Set([
  'confirmed',
  'checked_in',
  'in_progress',
])

type BookingCapacityScope = {
  scopeType: 'user' | 'resource'
  scopeRefKey: string
}

type BookingCapacityClaimRow = {
  timeScopeId: string | null
  scopeType: 'user' | 'resource'
  scopeRefKey: string
  quantity: number
  startsAt: Date
  endsAt: Date
}

type EnsureTimeScopeInput = {
  bizId: string
  scopeType: 'user' | 'resource'
  scopeRefKey: string
}

export type SyncBookingCapacityClaimsInput = {
  bizId: string
  bookingOrderId: string
  bookingStatus: string | null | undefined
  startsAt: Date | null
  endsAt: Date | null
  providerUserId?: string | null
  resourceId?: string | null
  actorUserId?: string | null
  executor?: BookingCapacityExecutor
}

export type BookingCapacityConflictInput = {
  bizId: string
  slotStartAt: Date
  slotEndAt: Date
  providerUserId?: string | null
  resourceId?: string | null
  ignoreBookingOrderId?: string | null
  executor?: BookingCapacityExecutor
}

export function resolveBookingCapacityWindow(input: {
  startsAt?: Date | null
  endsAt?: Date | null
  durationMinutes?: number | null
}) {
  if (!input.startsAt) return { startsAt: null, endsAt: null }
  if (input.endsAt && input.endsAt.getTime() > input.startsAt.getTime()) {
    return { startsAt: input.startsAt, endsAt: input.endsAt }
  }

  const durationMinutes = Math.max(Number(input.durationMinutes ?? 0), 1)
  return {
    startsAt: input.startsAt,
    endsAt: new Date(input.startsAt.getTime() + durationMinutes * 60 * 1000),
  }
}

function normalizeId(value: string | null | undefined) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export function bookingStatusBlocksCapacity(status: string | null | undefined) {
  return status ? CAPACITY_BLOCKING_BOOKING_STATUSES.has(status) : false
}

export function deriveBookingCapacityScopes(input: {
  providerUserId?: string | null
  resourceId?: string | null
}) {
  const scopes: BookingCapacityScope[] = []
  const seen = new Set<string>()

  const providerUserId = normalizeId(input.providerUserId)
  if (providerUserId) {
    const scopeRefKey = `user:${providerUserId}`
    seen.add(scopeRefKey)
    scopes.push({ scopeType: 'user', scopeRefKey })
  }

  const resourceId = normalizeId(input.resourceId)
  if (resourceId) {
    const scopeRefKey = `resource:${resourceId}`
    if (!seen.has(scopeRefKey)) {
      scopes.push({ scopeType: 'resource', scopeRefKey })
    }
  }

  return scopes
}

async function ensureTimeScopeRows(input: {
  bizId: string
  scopes: BookingCapacityScope[]
  actorUserId?: string | null
  executor?: BookingCapacityExecutor
}) {
  const executor = input.executor ?? db
  if (input.scopes.length === 0) return new Map<string, string>()

  const scopeRefKeys = input.scopes.map((scope) => scope.scopeRefKey)
  const existing = await executor.query.timeScopes.findMany({
    where: and(
      eq(timeScopes.bizId, input.bizId),
      inArray(timeScopes.scopeRefKey, scopeRefKeys),
    ),
    columns: {
      id: true,
      scopeRefKey: true,
    },
  })

  const byRefKey = new Map(existing.map((row) => [row.scopeRefKey, row.id]))
  const missing = input.scopes.filter((scope) => !byRefKey.has(scope.scopeRefKey))

  if (missing.length > 0) {
    const created = await executor
      .insert(timeScopes)
      .values(
        missing.map((scope) => ({
          bizId: input.bizId,
          scopeType: scope.scopeType,
          scopeRefKey: scope.scopeRefKey,
          displayName: scope.scopeRefKey,
          createdBy: input.actorUserId ?? null,
          updatedBy: input.actorUserId ?? null,
        })),
      )
      .onConflictDoNothing({
        target: [timeScopes.bizId, timeScopes.scopeRefKey],
      })
      .returning({
        id: timeScopes.id,
        scopeRefKey: timeScopes.scopeRefKey,
      })

    for (const row of created) {
      byRefKey.set(row.scopeRefKey, row.id)
    }

    if (missing.some((scope) => !byRefKey.has(scope.scopeRefKey))) {
      const refreshed = await executor.query.timeScopes.findMany({
        where: and(
          eq(timeScopes.bizId, input.bizId),
          inArray(timeScopes.scopeRefKey, scopeRefKeys),
        ),
        columns: {
          id: true,
          scopeRefKey: true,
        },
      })
      for (const row of refreshed) {
        byRefKey.set(row.scopeRefKey, row.id)
      }
    }
  }

  return byRefKey
}

export async function syncBookingCapacityClaims(input: SyncBookingCapacityClaimsInput) {
  const executor = input.executor ?? db
  const scopes = deriveBookingCapacityScopes(input)
  const shouldHoldCapacity =
    bookingStatusBlocksCapacity(input.bookingStatus) &&
    Boolean(input.startsAt) &&
    Boolean(input.endsAt) &&
    scopes.length > 0

  await executor
    .delete(bookingCapacityClaims)
    .where(and(
      eq(bookingCapacityClaims.bizId, input.bizId),
      eq(bookingCapacityClaims.bookingOrderId, input.bookingOrderId),
    ))

  if (!shouldHoldCapacity || !input.startsAt || !input.endsAt) {
    await syncBookingCapacityReservationMirror({
      bizId: input.bizId,
      bookingOrderId: input.bookingOrderId,
      bookingStatus: input.bookingStatus,
      claimRows: [],
      actorUserId: input.actorUserId,
      executor,
    })
    return
  }

  const timeScopeIds = await ensureTimeScopeRows({
    bizId: input.bizId,
    scopes,
    actorUserId: input.actorUserId,
    executor,
  })

  const createdClaims = (await executor
    .insert(bookingCapacityClaims)
    .values(
      scopes.map((scope) => ({
        bizId: input.bizId,
        bookingOrderId: input.bookingOrderId,
        timeScopeId: timeScopeIds.get(scope.scopeRefKey) ?? null,
        scopeType: scope.scopeType,
        scopeRefKey: scope.scopeRefKey,
        quantity: 1,
        startsAt: input.startsAt!,
        endsAt: input.endsAt!,
        metadata: {},
        createdBy: input.actorUserId ?? null,
        updatedBy: input.actorUserId ?? null,
      })),
    )
    .returning({
      timeScopeId: bookingCapacityClaims.timeScopeId,
      scopeType: bookingCapacityClaims.scopeType,
      scopeRefKey: bookingCapacityClaims.scopeRefKey,
      quantity: bookingCapacityClaims.quantity,
      startsAt: bookingCapacityClaims.startsAt,
      endsAt: bookingCapacityClaims.endsAt,
    })) as BookingCapacityClaimRow[]

  await syncBookingCapacityReservationMirror({
    bizId: input.bizId,
    bookingOrderId: input.bookingOrderId,
    bookingStatus: input.bookingStatus,
    claimRows: createdClaims,
    actorUserId: input.actorUserId,
    executor,
  })
}

export async function findBookingCapacityConflicts(input: BookingCapacityConflictInput) {
  const executor = input.executor ?? db
  const scopes = deriveBookingCapacityScopes(input)
  if (scopes.length === 0) return []

  const scopeRefKeys = scopes.map((scope) => scope.scopeRefKey)
  return executor.query.bookingCapacityClaims.findMany({
    where: and(
      eq(bookingCapacityClaims.bizId, input.bizId),
      inArray(bookingCapacityClaims.scopeRefKey, scopeRefKeys),
      sql`${bookingCapacityClaims.startsAt} < ${input.slotEndAt}`,
      sql`${bookingCapacityClaims.endsAt} > ${input.slotStartAt}`,
      input.ignoreBookingOrderId
        ? ne(bookingCapacityClaims.bookingOrderId, input.ignoreBookingOrderId)
        : undefined,
    ),
    columns: {
      scopeType: true,
      scopeRefKey: true,
      bookingOrderId: true,
      startsAt: true,
      endsAt: true,
    },
  })
}

export async function hasBookingCapacityConflict(input: BookingCapacityConflictInput) {
  const rows = await findBookingCapacityConflicts(input)
  return rows.length > 0
}
