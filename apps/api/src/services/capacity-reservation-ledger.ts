import { and, eq } from 'drizzle-orm'
import dbPackage from '@bizing/db'
import { bookingStatusBlocksCapacity } from './booking-capacity-claims.js'

const {
  db,
  capacityHolds,
  capacityReservations,
  timeScopes,
} = dbPackage

type CapacityReservationExecutor = typeof db

type BookingCapacityReservationMirrorRow = {
  timeScopeId: string | null
  scopeType: 'user' | 'resource'
  scopeRefKey: string
  quantity: number
  startsAt: Date
  endsAt: Date
}

type SyncBookingCapacityReservationMirrorInput = {
  bizId: string
  bookingOrderId: string
  bookingStatus: string | null | undefined
  claimRows: BookingCapacityReservationMirrorRow[]
  actorUserId?: string | null
  executor?: CapacityReservationExecutor
}

function holdScopeTypeFromTargetType(targetType: string | null | undefined) {
  switch (targetType) {
    case 'calendar':
    case 'capacity_pool':
    case 'resource':
    case 'offer_version':
    case 'custom_subject':
      return targetType
    default:
      return null
  }
}

export async function syncBookingCapacityReservationMirror(
  input: SyncBookingCapacityReservationMirrorInput,
) {
  const executor = input.executor ?? db

  await executor
    .delete(capacityReservations)
    .where(and(
      eq(capacityReservations.bizId, input.bizId),
      eq(capacityReservations.reservationKind, 'booking_claim'),
      eq(capacityReservations.sourceRefType, 'booking_order'),
      eq(capacityReservations.sourceRefId, input.bookingOrderId),
    ))

  const shouldMirror =
    bookingStatusBlocksCapacity(input.bookingStatus) &&
    input.claimRows.length > 0

  if (!shouldMirror) return

  await executor
    .insert(capacityReservations)
    .values(
      input.claimRows.map((claim) => ({
        bizId: input.bizId,
        reservationKind: 'booking_claim' as const,
        timeScopeId: claim.timeScopeId,
        scopeType: claim.scopeType,
        scopeRefKey: claim.scopeRefKey,
        effectMode: 'blocking' as const,
        status: 'active' as const,
        quantity: claim.quantity,
        startsAt: claim.startsAt,
        endsAt: claim.endsAt,
        sourceRefType: 'booking_order',
        sourceRefId: input.bookingOrderId,
        ownerRefKey: null,
        metadata: {},
      })),
    )
}

export async function syncCapacityHoldReservationMirror(input: {
  bizId: string
  holdId: string
  actorUserId?: string | null
  executor?: CapacityReservationExecutor
}) {
  const executor = input.executor ?? db

  const hold = await executor.query.capacityHolds.findFirst({
    where: and(eq(capacityHolds.bizId, input.bizId), eq(capacityHolds.id, input.holdId)),
    columns: {
      id: true,
      bizId: true,
      timeScopeId: true,
      targetType: true,
      targetRefKey: true,
      effectMode: true,
      status: true,
      quantity: true,
      startsAt: true,
      endsAt: true,
      ownerRefKey: true,
      sourceSignalType: true,
      sourceRefType: true,
      sourceRefId: true,
      requestKey: true,
      reasonCode: true,
      metadata: true,
      policySnapshot: true,
    },
  })

  await executor
    .delete(capacityReservations)
    .where(and(
      eq(capacityReservations.bizId, input.bizId),
      eq(capacityReservations.reservationKind, 'capacity_hold'),
      eq(capacityReservations.sourceRefType, 'capacity_hold'),
      eq(capacityReservations.sourceRefId, input.holdId),
    ))

  if (!hold) return

  const timeScope = hold.timeScopeId
    ? await executor.query.timeScopes.findFirst({
        where: and(eq(timeScopes.bizId, input.bizId), eq(timeScopes.id, hold.timeScopeId)),
        columns: { id: true, scopeType: true, scopeRefKey: true },
      })
    : null

  const scopeType = timeScope?.scopeType ?? holdScopeTypeFromTargetType(hold.targetType)
  const scopeRefKey = timeScope?.scopeRefKey ?? hold.targetRefKey
  if (!scopeType || !scopeRefKey) return

  await executor
    .insert(capacityReservations)
    .values({
      bizId: hold.bizId,
      reservationKind: 'capacity_hold' as const,
      timeScopeId: timeScope?.id ?? hold.timeScopeId ?? null,
      scopeType,
      scopeRefKey,
      effectMode: hold.effectMode,
      status: hold.status,
      quantity: hold.quantity,
      startsAt: hold.startsAt,
      endsAt: hold.endsAt,
      sourceRefType: 'capacity_hold',
      sourceRefId: hold.id,
      ownerRefKey: hold.ownerRefKey,
      metadata: {
        targetType: hold.targetType,
        targetRefKey: hold.targetRefKey,
        sourceSignalType: hold.sourceSignalType,
        holdSourceRefType: hold.sourceRefType,
        holdSourceRefId: hold.sourceRefId,
        requestKey: hold.requestKey,
        reasonCode: hold.reasonCode,
        policySnapshot: hold.policySnapshot,
        holdMetadata: hold.metadata,
      },
    })
}
