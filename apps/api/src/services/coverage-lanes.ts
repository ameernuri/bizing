import { and, eq } from 'drizzle-orm'
import dbPackage from '@bizing/db'

const {
  db,
  subjects,
  scheduleSubjects,
  calendars,
  calendarBindings,
  availabilityRules,
  coverageLanes,
  staffingAssignments,
} = dbPackage

type DbExecutor = typeof db

const ACTIVE_COVERAGE_ASSIGNMENT_STATUSES = new Set([
  'planned',
  'confirmed',
  'in_progress',
  'completed',
])

export async function ensureCoverageLaneArtifacts(input: {
  bizId: string
  coverageLaneId: string
  name: string
  locationId?: string | null
  requiredHeadcount?: number | null
  actorUserId?: string | null
  executor?: DbExecutor
}) {
  const executor = input.executor ?? db
  const lane = await executor.query.coverageLanes.findFirst({
    where: and(eq(coverageLanes.bizId, input.bizId), eq(coverageLanes.id, input.coverageLaneId)),
    columns: {
      id: true,
      scheduleSubjectId: true,
      primaryCalendarId: true,
      locationId: true,
      policy: true,
      metadata: true,
    },
  })
  if (!lane) throw new Error('Coverage lane not found while ensuring artifacts.')

  await executor
    .insert(subjects)
    .values({
      bizId: input.bizId,
      subjectType: 'coverage_lane',
      subjectId: input.coverageLaneId,
      displayName: input.name,
      category: 'coverage_lane',
      status: 'active',
      isLinkable: true,
      metadata: {
        coverageLaneId: input.coverageLaneId,
      },
    })
    .onConflictDoNothing({
      target: [subjects.bizId, subjects.subjectType, subjects.subjectId],
    })

  let scheduleSubjectId = lane.scheduleSubjectId ?? null
  if (!scheduleSubjectId) {
    const [createdSubject] = await executor
      .insert(scheduleSubjects)
      .values({
        bizId: input.bizId,
        subjectType: 'coverage_lane',
        subjectId: input.coverageLaneId,
        scheduleClass: 'coverage_lane',
        displayName: input.name,
        status: 'active',
        schedulingMode: 'exclusive',
        defaultCapacity: Math.max(Number(input.requiredHeadcount ?? 1), 1),
        defaultLeadTimeMin: 0,
        defaultBufferBeforeMin: 0,
        defaultBufferAfterMin: 0,
        shouldProjectTimeline: true,
        policy: {},
        metadata: {
          coverageLaneId: input.coverageLaneId,
        },
      })
      .onConflictDoNothing({
        target: [scheduleSubjects.bizId, scheduleSubjects.subjectType, scheduleSubjects.subjectId],
      })
      .returning({ id: scheduleSubjects.id })

    if (createdSubject?.id) {
      scheduleSubjectId = createdSubject.id
    } else {
      const existing = await executor.query.scheduleSubjects.findFirst({
        where: and(
          eq(scheduleSubjects.bizId, input.bizId),
          eq(scheduleSubjects.subjectType, 'coverage_lane'),
          eq(scheduleSubjects.subjectId, input.coverageLaneId),
        ),
        columns: { id: true },
      })
      scheduleSubjectId = existing?.id ?? null
    }
  }

  let primaryCalendarId = lane.primaryCalendarId ?? null
  if (!primaryCalendarId) {
    const [createdCalendar] = await executor
      .insert(calendars)
      .values({
        bizId: input.bizId,
        name: `${input.name} Coverage`,
        timezone: 'UTC',
        slotDurationMin: 30,
        slotIntervalMin: 15,
        minAdvanceBookingHours: 0,
        maxAdvanceBookingDays: 365,
        defaultMode: 'unavailable_by_default',
        ruleEvaluationOrder: 'specificity_then_priority',
        conflictResolutionMode: 'unavailable_wins',
        enforceStrictNonOverlap: false,
        emitTimelineFacts: true,
        status: 'active',
        policy: { coverageLaneId: input.coverageLaneId },
        metadata: { coverageLaneId: input.coverageLaneId },
      })
      .returning({ id: calendars.id })
    primaryCalendarId = createdCalendar?.id ?? null
  }

  if (primaryCalendarId) {
    await executor
      .insert(calendarBindings)
      .values({
        bizId: input.bizId,
        calendarId: primaryCalendarId,
        scheduleSubjectId,
        ownerType: 'custom_subject',
        ownerRefType: 'coverage_lane',
        ownerRefId: input.coverageLaneId,
        ownerRefKey: `custom_subject:coverage_lane:${input.coverageLaneId}`,
        isPrimary: true,
        priority: 100,
        isRequired: true,
        isActive: true,
        metadata: {
          coverageLaneId: input.coverageLaneId,
        },
      })
      .onConflictDoNothing()
  }

  if (scheduleSubjectId !== lane.scheduleSubjectId || primaryCalendarId !== lane.primaryCalendarId) {
    await executor
      .update(coverageLanes)
      .set({
        scheduleSubjectId,
        primaryCalendarId,
      })
      .where(and(eq(coverageLanes.bizId, input.bizId), eq(coverageLanes.id, input.coverageLaneId)))
  }

  return {
    scheduleSubjectId,
    primaryCalendarId,
  }
}

export async function syncCoverageLaneAssignmentAvailability(input: {
  bizId: string
  staffingAssignmentId: string
  actorUserId?: string | null
  executor?: DbExecutor
}) {
  const executor = input.executor ?? db
  const assignment = await executor.query.staffingAssignments.findFirst({
    where: and(
      eq(staffingAssignments.bizId, input.bizId),
      eq(staffingAssignments.id, input.staffingAssignmentId),
    ),
    columns: {
      id: true,
      coverageLaneId: true,
      status: true,
      startsAt: true,
      endsAt: true,
    },
  })
  if (!assignment?.coverageLaneId) return

  const lane = await executor.query.coverageLanes.findFirst({
    where: and(eq(coverageLanes.bizId, input.bizId), eq(coverageLanes.id, assignment.coverageLaneId)),
    columns: {
      id: true,
      name: true,
      primaryCalendarId: true,
    },
  })
  if (!lane?.primaryCalendarId) return

  const existing = await executor.query.availabilityRules.findFirst({
    where: and(
      eq(availabilityRules.bizId, input.bizId),
      eq(availabilityRules.calendarId, lane.primaryCalendarId),
      eq(availabilityRules.name, `coverage-assignment:${assignment.id}`),
    ),
    columns: { id: true },
  })

  const shouldBeActive =
    ACTIVE_COVERAGE_ASSIGNMENT_STATUSES.has(String(assignment.status)) &&
    assignment.startsAt instanceof Date &&
    assignment.endsAt instanceof Date &&
    assignment.endsAt.getTime() > assignment.startsAt.getTime()

  if (!shouldBeActive) {
    if (existing?.id) {
      await executor
        .update(availabilityRules)
        .set({
          isActive: false,
        })
        .where(and(eq(availabilityRules.bizId, input.bizId), eq(availabilityRules.id, existing.id)))
    }
    return
  }

  const payload = {
    bizId: input.bizId,
    calendarId: lane.primaryCalendarId,
    name: `coverage-assignment:${assignment.id}`,
    mode: 'timestamp_range' as const,
    frequency: 'none' as const,
    startAt: assignment.startsAt,
    endAt: assignment.endsAt,
    action: 'available' as const,
    priority: 50,
    isActive: true,
    metadata: {
      sourceType: 'coverage_lane_assignment',
      coverageLaneId: assignment.coverageLaneId,
      staffingAssignmentId: assignment.id,
      laneName: lane.name,
    },
  }

  if (existing?.id) {
    await executor
      .update(availabilityRules)
      .set(payload)
      .where(and(eq(availabilityRules.bizId, input.bizId), eq(availabilityRules.id, existing.id)))
    return
  }

  await executor.insert(availabilityRules).values(payload)
}
