import { and, eq, inArray, sql } from 'drizzle-orm'
import dbPackage from '@bizing/db'
import type { AvailabilityExplanation, LayerType } from './availability-types.js'

const { db, capacityReservations } = dbPackage

export type CapacityBlockingConflict = {
  kind: 'booking_claim' | 'capacity_hold'
  layerType: LayerType
  reason: 'booking_conflict' | 'capacity_hold'
  detail: string
  explanations: AvailabilityExplanation[]
}

type FindCapacityBlockingConflictsInput = {
  bizId: string
  slotStartAt: Date
  slotEndAt: Date
  providerUserId?: string | null
  resourceId?: string | null
  offerVersionId?: string | null
  customSubjectType?: string | null
  customSubjectId?: string | null
  calendarIds?: string[]
  ignoreBookingOrderId?: string | null
}

function pushUnique(values: string[], value: string | null | undefined) {
  if (!value) return
  if (!values.includes(value)) values.push(value)
}

function buildTargetRefKey(input:
  | { targetType: 'calendar'; calendarId: string }
  | { targetType: 'resource'; resourceId: string }
  | { targetType: 'offer_version'; offerVersionId: string }
  | { targetType: 'custom_subject'; targetRefType: string; targetRefId: string }) {
  switch (input.targetType) {
    case 'calendar':
      return `calendar:${input.calendarId}`
    case 'resource':
      return `resource:${input.resourceId}`
    case 'offer_version':
      return `offer_version:${input.offerVersionId}`
    case 'custom_subject':
      return `custom_subject:${input.targetRefType}:${input.targetRefId}`
  }
}

function reservationScopeRefKeysForInput(input: FindCapacityBlockingConflictsInput) {
  const targetRefKeys: string[] = []
  const calendarIds = Array.from(new Set(input.calendarIds ?? []))

  for (const calendarId of calendarIds) {
    pushUnique(targetRefKeys, buildTargetRefKey({ targetType: 'calendar', calendarId }))
  }
  if (input.providerUserId) {
    pushUnique(targetRefKeys, `user:${input.providerUserId}`)
  }
  if (input.resourceId) {
    pushUnique(targetRefKeys, buildTargetRefKey({ targetType: 'resource', resourceId: input.resourceId }))
  }
  if (input.offerVersionId) {
    pushUnique(targetRefKeys, buildTargetRefKey({ targetType: 'offer_version', offerVersionId: input.offerVersionId }))
  }
  if (input.customSubjectType && input.customSubjectId) {
    pushUnique(
      targetRefKeys,
      buildTargetRefKey({
        targetType: 'custom_subject',
        targetRefType: input.customSubjectType,
        targetRefId: input.customSubjectId,
      }),
    )
  }

  return targetRefKeys
}

function layerTypeForReservation(row: {
  reservationKind: 'booking_claim' | 'capacity_hold'
  scopeType: string
}) {
  if (row.reservationKind === 'booking_claim') {
    return row.scopeType === 'user' ? 'provider_user' : 'resource'
  }

  if (row.scopeType === 'resource') return 'resource'
  if (row.scopeType === 'offer_version') return 'offer_version'
  return 'custom_subject'
}

export async function findCapacityBlockingConflicts(
  input: FindCapacityBlockingConflictsInput,
): Promise<CapacityBlockingConflict[]> {
  const targetRefKeys = reservationScopeRefKeysForInput(input)
  const conflicts: CapacityBlockingConflict[] = []
  if (targetRefKeys.length === 0) return conflicts

  const reservationRows = await db.query.capacityReservations.findMany({
    where: and(
      eq(capacityReservations.bizId, input.bizId),
      eq(capacityReservations.status, 'active'),
      eq(capacityReservations.effectMode, 'blocking'),
      inArray(capacityReservations.scopeRefKey, targetRefKeys),
      sql`${capacityReservations.startsAt} < ${input.slotEndAt}`,
      sql`${capacityReservations.endsAt} > ${input.slotStartAt}`,
      input.ignoreBookingOrderId
        ? sql`NOT (${capacityReservations.reservationKind} = 'booking_claim' AND ${capacityReservations.sourceRefType} = 'booking_order' AND ${capacityReservations.sourceRefId} = ${input.ignoreBookingOrderId})`
        : undefined,
    ),
    columns: {
      id: true,
      reservationKind: true,
      scopeType: true,
      scopeRefKey: true,
      quantity: true,
      ownerRefKey: true,
      sourceRefType: true,
      sourceRefId: true,
    },
  })

  for (const row of reservationRows) {
    const kind = row.reservationKind
    const layerType = layerTypeForReservation(row)
    conflicts.push({
      kind,
      layerType,
      reason: kind === 'booking_claim' ? 'booking_conflict' : 'capacity_hold',
      detail:
        kind === 'booking_claim'
          ? 'Overlaps an existing claimed capacity window.'
          : 'Overlaps an active blocking hold.',
      explanations: [
        {
          sourceType: kind === 'booking_claim' ? 'capacity_claim' : 'capacity_hold',
          source: row.id,
          message:
            kind === 'booking_claim'
              ? 'An existing booking already claims the same concrete capacity for this time window.'
              : 'A blocking capacity hold is reserving this target during the requested window.',
          metadata: {
            scopeType: row.scopeType,
            scopeRefKey: row.scopeRefKey,
            quantity: row.quantity,
            ownerRefKey: row.ownerRefKey,
            sourceRefType: row.sourceRefType,
            sourceRefId: row.sourceRefId,
          },
        },
      ],
    })
  }

  return conflicts
}
