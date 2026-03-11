import { and, eq, inArray } from 'drizzle-orm'
import dbPackage from '@bizing/db'
import { prepareResolverContext } from './availability-binding-runtime.js'
import {
  clampInt,
  evaluateCalendarAvailabilityWithDependencies,
  roundUpToStep,
} from './availability-calendar-runtime.js'
import { findCapacityBlockingConflicts } from './capacity-reservations.js'
import type {
  AvailabilityDecisionEntry,
  AvailabilityDecisionReason,
  OfferAvailabilitySlotInput,
  OfferAvailabilitySlotResult,
  PreparedResolverContext,
  ResolveSlotDecision,
  ResolveSlotInput,
  ResolvedBindingLayer,
} from './availability-types.js'

const { db, calendars } = dbPackage

type LayerDecisionReason = Exclude<AvailabilityDecisionReason, 'booking_conflict' | 'capacity_hold'>

function layerDecision(
  layer: ResolvedBindingLayer,
  reason: LayerDecisionReason,
  calendarId?: string,
  detail?: string,
  explanations?: AvailabilityDecisionEntry['explanations'],
): AvailabilityDecisionEntry {
  return {
    layerType: layer.layerType,
    reason,
    calendarId,
    detail,
    explanations,
  }
}

function resolveSlotBookabilityWithContext(
  input: ResolveSlotInput,
  context: PreparedResolverContext,
): ResolveSlotDecision {
  const { relevantBindings, calendarsById } = context
  const availabilityMemo = new Map<string, ReturnType<typeof evaluateCalendarAvailabilityWithDependencies>>()

  const hardBlocks: ResolveSlotDecision['hardBlocks'] = []
  const advisories: ResolveSlotDecision['advisories'] = []

  if (relevantBindings.length === 0) {
    hardBlocks.push({
      layerType: input.offerVersionId ? 'offer_version' : 'biz',
      reason: 'missing_calendar',
      detail: 'No active calendar bindings apply to this request.',
      explanations: [
        {
          sourceType: 'resolver',
          source: 'missing_calendar',
          message: 'The request did not resolve to any active primary calendar bindings.',
          metadata: { bizId: input.bizId },
        },
      ],
    })
  }

  for (const layer of relevantBindings) {
    const runtime = calendarsById.get(layer.calendarId)
    if (!runtime) {
      const decision = layerDecision(
        layer,
        'missing_calendar',
        layer.calendarId,
        undefined,
        [
          {
            sourceType: 'resolver',
            source: 'missing_calendar',
            message: 'A relevant binding pointed at a calendar runtime that could not be loaded.',
            metadata: { calendarId: layer.calendarId, bindingId: layer.bindingId },
          },
        ],
      )
      if (layer.isRequired) {
        hardBlocks.push(decision)
      } else {
        advisories.push(decision)
      }
      continue
    }

    const outcome = evaluateCalendarAvailabilityWithDependencies(
      layer.calendarId,
      calendarsById,
      input.slotStartAt,
      input.slotEndAt,
      availabilityMemo,
    )
    if (outcome.available) continue

    const decision = layerDecision(
      layer,
      'calendar_unavailable',
      layer.calendarId,
      outcome.source,
      outcome.explanations,
    )
    if (layer.isRequired) {
      hardBlocks.push(decision)
    } else {
      advisories.push(decision)
    }
  }

  return {
    bookable: hardBlocks.length === 0,
    hardBlocks,
    advisories,
  }
}

export async function resolveSlotBookability(input: ResolveSlotInput): Promise<ResolveSlotDecision> {
  const context = await prepareResolverContext(input, input.slotStartAt, input.slotEndAt)
  const baseDecision = resolveSlotBookabilityWithContext(input, context)
  if (!baseDecision.bookable) return baseDecision

  const conflicts = await findCapacityBlockingConflicts({
    bizId: input.bizId,
    slotStartAt: input.slotStartAt,
    slotEndAt: input.slotEndAt,
    providerUserId: input.providerUserId,
    resourceId: input.resourceId,
    offerVersionId: input.offerVersionId,
    customSubjectType: input.customSubjectType,
    customSubjectId: input.customSubjectId,
    calendarIds: context.relevantBindings.map((binding) => binding.calendarId),
    ignoreBookingOrderId: input.ignoreBookingOrderId,
  })
  if (conflicts.length === 0) return baseDecision

  return {
    bookable: false,
    hardBlocks: [
      ...baseDecision.hardBlocks,
      ...conflicts.map((conflict) => ({
        layerType: conflict.layerType,
        reason: conflict.reason,
        detail: conflict.detail,
        explanations: conflict.explanations,
      })),
    ],
    advisories: baseDecision.advisories,
  }
}

export async function resolveOfferBookableSlots(
  input: OfferAvailabilitySlotInput,
): Promise<OfferAvailabilitySlotResult> {
  const context = await prepareResolverContext(input, input.fromAt, input.toAt)
  const { relevantBindings } = context

  const relevantCalendarIds = new Set(relevantBindings.map((binding) => binding.calendarId))
  const relevantCalendars = relevantCalendarIds.size
    ? await db.query.calendars.findMany({
        where: and(
          eq(calendars.bizId, input.bizId),
          inArray(calendars.id, Array.from(relevantCalendarIds)),
          eq(calendars.status, 'active'),
        ),
      })
    : []

  const leadTimeHours = relevantCalendars.length
    ? Math.max(...relevantCalendars.map((row) => Number(row.minAdvanceBookingHours ?? 0)))
    : 0
  const maxAdvanceDays = relevantCalendars.length
    ? Math.min(...relevantCalendars.map((row) => Number(row.maxAdvanceBookingDays ?? 30)))
    : 30

  const scanEndAt = new Date(
    Math.min(input.toAt.getTime(), input.fromAt.getTime() + maxAdvanceDays * 24 * 60 * 60 * 1000),
  )
  const leadTimeFloorAt = new Date(Date.now() + leadTimeHours * 60 * 60 * 1000)
  const earliestStartAt = new Date(Math.max(input.fromAt.getTime(), leadTimeFloorAt.getTime()))
  const cursorStart = roundUpToStep(earliestStartAt, Math.max(input.stepMinutes, 1))

  const maxSlots = Math.max(input.maxSlots ?? 500, 1)
  const slots: Array<{ startAt: string; endAt: string }> = []
  let truncated = false

  for (
    let slotStartAt = new Date(cursorStart.getTime());
    slotStartAt < scanEndAt;
    slotStartAt = new Date(slotStartAt.getTime() + Math.max(input.stepMinutes, 1) * 60 * 1000)
  ) {
    const slotEndAt = new Date(slotStartAt.getTime() + Math.max(input.durationMinutes, 1) * 60 * 1000)
    if (slotEndAt > scanEndAt) break

    const baseDecision = resolveSlotBookabilityWithContext(
      {
        ...input,
        slotStartAt,
        slotEndAt,
      },
      context,
    )
    if (!baseDecision.bookable) continue

    const conflicts = await findCapacityBlockingConflicts({
      ...input,
      slotStartAt,
      slotEndAt,
      calendarIds: relevantBindings.map((binding) => binding.calendarId),
    })
    if (conflicts.length > 0) continue

    slots.push({
      startAt: slotStartAt.toISOString(),
      endAt: slotEndAt.toISOString(),
    })

    if (slots.length >= maxSlots) {
      truncated = true
      break
    }
  }

  return {
    slots,
    evaluatedBindings: relevantBindings,
    computedLeadTimeHours: clampInt(leadTimeHours, 0, 24 * 365),
    computedMaxAdvanceDays: clampInt(maxAdvanceDays, 1, 365),
    truncated,
  }
}

export async function validateBookingWindow(input: ResolveSlotInput) {
  return resolveSlotBookability(input)
}
