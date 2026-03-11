import { and, asc, eq, inArray, or, sql } from 'drizzle-orm'
import dbPackage from '@bizing/db'
import type {
  AvailabilityExplanation,
  CalendarBookabilityOutcome,
  CalendarDependencyRuntime,
  CalendarRuntimeContext,
} from './availability-types.js'

const {
  db,
  calendars,
  calendarBindings,
  availabilityRules,
  availabilityRuleExclusionDates,
  availabilityGates,
  availabilityDependencyRules,
  availabilityDependencyRuleTargets,
} = dbPackage

type CalendarRuleRow = typeof availabilityRules.$inferSelect
type CalendarDependencyRuleRow = typeof availabilityDependencyRules.$inferSelect
type CalendarDependencyTargetRow = typeof availabilityDependencyRuleTargets.$inferSelect

const localPartFormatterCache = new Map<string, Intl.DateTimeFormat>()

function parseTimeMinutes(value: unknown): number | null {
  if (typeof value !== 'string') return null
  const match = /^(\d{2}):(\d{2})(?::\d{2})?$/.exec(value)
  if (!match) return null
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null
  return hour * 60 + minute
}

function toIsoDateParts(parts: { year: number; month: number; day: number }) {
  return `${String(parts.year).padStart(4, '0')}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`
}

function getLocalDateParts(date: Date, timezone: string) {
  const key = timezone || 'UTC'
  let formatter = localPartFormatterCache.get(key)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: key,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      weekday: 'short',
    })
    localPartFormatterCache.set(key, formatter)
  }

  const parts = formatter.formatToParts(date)
  const lookup = new Map(parts.map((part) => [part.type, part.value]))
  const weekdayRaw = (lookup.get('weekday') ?? 'Sun').toLowerCase()
  const weekdayMap: Record<string, number> = {
    sun: 0,
    mon: 1,
    tue: 2,
    wed: 3,
    thu: 4,
    fri: 5,
    sat: 6,
  }

  const hour = Number(lookup.get('hour') ?? '0')
  const minute = Number(lookup.get('minute') ?? '0')
  const year = Number(lookup.get('year') ?? '1970')
  const month = Number(lookup.get('month') ?? '1')
  const day = Number(lookup.get('day') ?? '1')

  const weekday = weekdayMap[weekdayRaw.slice(0, 3)] ?? 0
  return {
    year,
    month,
    day,
    weekday,
    minutesSinceMidnight: hour * 60 + minute,
    isoDate: toIsoDateParts({ year, month, day }),
  }
}

function compareRulePriority(
  a: { priority: number; specificity: number },
  b: { priority: number; specificity: number },
  order: 'priority_asc' | 'priority_desc' | 'specificity_then_priority',
) {
  if (order === 'priority_asc') return a.priority - b.priority || b.specificity - a.specificity
  if (order === 'priority_desc') return b.priority - a.priority || b.specificity - a.specificity
  return b.specificity - a.specificity || a.priority - b.priority
}

function computeRuleSpecificity(rule: CalendarRuleRow) {
  if (rule.mode === 'timestamp_range') return 300
  if (rule.mode === 'date_range') return 200
  if (rule.mode === 'recurring') {
    if (rule.frequency === 'weekly') return 150
    if (rule.frequency === 'daily') return 130
    if (rule.frequency === 'monthly' || rule.frequency === 'yearly') return 140
    return 120
  }
  return 100
}

function slotFitsLocalWindow(
  slotStartLocalMinutes: number,
  slotEndLocalMinutes: number,
  startTime: unknown,
  endTime: unknown,
) {
  const start = parseTimeMinutes(startTime)
  const end = parseTimeMinutes(endTime)
  if (start === null || end === null) return true
  return slotStartLocalMinutes >= start && slotEndLocalMinutes <= end
}

function ruleApplies(
  rule: CalendarRuleRow,
  slotStartAt: Date,
  slotEndAt: Date,
  timezone: string,
  exclusionDates?: Set<string>,
) {
  if (!rule.isActive) return false

  const slotStartMs = slotStartAt.getTime()
  const slotEndMs = slotEndAt.getTime()
  const localStart = getLocalDateParts(slotStartAt, timezone)
  const localEnd = getLocalDateParts(slotEndAt, timezone)

  if (exclusionDates && exclusionDates.has(localStart.isoDate)) return false

  if (rule.mode === 'timestamp_range') {
    if (!rule.startAt || !rule.endAt) return false
    return (rule.startAt as Date).getTime() <= slotStartMs && (rule.endAt as Date).getTime() >= slotEndMs
  }

  if (rule.mode === 'date_range') {
    if (!rule.startDate || !rule.endDate) return false
    const startDate = String(rule.startDate)
    const endDate = String(rule.endDate)
    if (localStart.isoDate < startDate || localEnd.isoDate > endDate) return false
    return slotFitsLocalWindow(
      localStart.minutesSinceMidnight,
      localEnd.minutesSinceMidnight,
      rule.startTime,
      rule.endTime,
    )
  }

  if (rule.mode !== 'recurring') return false
  if (rule.startDate && localStart.isoDate < String(rule.startDate)) return false
  if (rule.endDate && localStart.isoDate > String(rule.endDate)) return false

  if (rule.frequency === 'weekly' && rule.dayOfWeek !== null && rule.dayOfWeek !== undefined) {
    if (localStart.weekday !== Number(rule.dayOfWeek)) return false
  }

  if (rule.frequency === 'monthly' && rule.dayOfMonth !== null && rule.dayOfMonth !== undefined) {
    if (localStart.day !== Number(rule.dayOfMonth)) return false
  }

  if (rule.frequency === 'yearly' && rule.dayOfMonth !== null && rule.dayOfMonth !== undefined) {
    if (localStart.day !== Number(rule.dayOfMonth)) return false
  }

  if (rule.frequency === 'recurrence_rule') {
    if (!rule.dayOfWeek && !rule.dayOfMonth) return false
  }

  return slotFitsLocalWindow(
    localStart.minutesSinceMidnight,
    localEnd.minutesSinceMidnight,
    rule.startTime,
    rule.endTime,
  )
}

function resolveRuleOutcome(
  calendar: typeof calendars.$inferSelect,
  actions: Array<{ action: string; priority: number; specificity: number }>,
): CalendarBookabilityOutcome {
  if (actions.length === 0) {
    const available = calendar.defaultMode === 'available_by_default'
    return {
      available,
      source: 'default_mode',
      explanations: [
        {
          sourceType: 'calendar',
          source: 'default_mode',
          message: available ? 'No rule matched; calendar default allows booking.' : 'No rule matched; calendar default blocks booking.',
          metadata: { calendarId: calendar.id, defaultMode: calendar.defaultMode },
        },
      ],
    }
  }

  const sorted = [...actions].sort((a, b) =>
    compareRulePriority(
      a,
      b,
      calendar.ruleEvaluationOrder as 'priority_asc' | 'priority_desc' | 'specificity_then_priority',
    ),
  )

  const hasUnavailable = sorted.some((row) => row.action === 'unavailable')
  const hasAvailable = sorted.some((row) => row.action === 'available' || row.action === 'override_hours')
  const conflictMode = calendar.conflictResolutionMode

  if (conflictMode === 'priority_wins') {
    const winner = sorted[0]
    const available = winner ? winner.action !== 'unavailable' : calendar.defaultMode === 'available_by_default'
    return {
      available,
      source: 'priority_wins',
      explanations: [
        {
          sourceType: 'calendar',
          source: 'priority_wins',
          message: 'Calendar rule priority determined the slot outcome.',
          metadata: { calendarId: calendar.id, winnerAction: winner?.action ?? null },
        },
      ],
    }
  }

  if (conflictMode === 'available_wins') {
    const available = hasAvailable ? true : hasUnavailable ? false : calendar.defaultMode === 'available_by_default'
    return {
      available,
      source: 'available_wins',
      explanations: [
        {
          sourceType: 'calendar',
          source: 'available_wins',
          message: 'Conflicting availability rules resolved in favor of availability.',
          metadata: { calendarId: calendar.id },
        },
      ],
    }
  }

  const available = hasUnavailable ? false : hasAvailable ? true : calendar.defaultMode === 'available_by_default'
  return {
    available,
    source: 'unavailable_wins',
    explanations: [
      {
        sourceType: 'calendar',
        source: 'unavailable_wins',
        message: 'Conflicting availability rules resolved in favor of the more restrictive outcome.',
        metadata: { calendarId: calendar.id },
      },
    ],
  }
}

export function roundUpToStep(date: Date, stepMinutes: number) {
  const ms = date.getTime()
  const stepMs = Math.max(stepMinutes, 1) * 60 * 1000
  const rounded = Math.ceil(ms / stepMs) * stepMs
  return new Date(rounded)
}

export function clampInt(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min
  return Math.max(min, Math.min(max, Math.floor(value)))
}

export async function buildCalendarRuntimeContexts(
  bizId: string,
  calendarIds: string[],
  slotStartAt: Date,
  slotEndAt: Date,
) {
  const uniqueCalendarIds = Array.from(new Set(calendarIds))
  if (uniqueCalendarIds.length === 0) return new Map<string, CalendarRuntimeContext>()

  const discoveredCalendarIds = new Set(uniqueCalendarIds)
  const processedCalendarIds = new Set<string>()
  const dependencyRuleById = new Map<string, CalendarDependencyRuleRow>()
  const dependencyTargetsByRuleId = new Map<string, CalendarDependencyTargetRow[]>()

  while (true) {
    const pendingCalendarIds = Array.from(discoveredCalendarIds).filter((id) => !processedCalendarIds.has(id))
    if (pendingCalendarIds.length === 0) break
    pendingCalendarIds.forEach((id) => processedCalendarIds.add(id))

    const batchRules = await db.query.availabilityDependencyRules.findMany({
      where: and(
        eq(availabilityDependencyRules.bizId, bizId),
        inArray(availabilityDependencyRules.dependentCalendarId, pendingCalendarIds),
        eq(availabilityDependencyRules.status, 'active'),
        sql`coalesce(${availabilityDependencyRules.effectiveStartAt}, '-infinity'::timestamptz) <= ${slotEndAt}`,
        sql`coalesce(${availabilityDependencyRules.effectiveEndAt}, 'infinity'::timestamptz) >= ${slotStartAt}`,
      ),
    })
    if (batchRules.length === 0) continue

    for (const rule of batchRules) dependencyRuleById.set(rule.id, rule)

    const ruleIds = batchRules.map((row) => row.id)
    const batchTargets = await db.query.availabilityDependencyRuleTargets.findMany({
      where: and(
        eq(availabilityDependencyRuleTargets.bizId, bizId),
        inArray(availabilityDependencyRuleTargets.availabilityDependencyRuleId, ruleIds),
      ),
      orderBy: [asc(availabilityDependencyRuleTargets.sortOrder), asc(availabilityDependencyRuleTargets.id)],
    })

    for (const target of batchTargets) {
      const bucket = dependencyTargetsByRuleId.get(target.availabilityDependencyRuleId) ?? []
      bucket.push(target)
      dependencyTargetsByRuleId.set(target.availabilityDependencyRuleId, bucket)
      if (target.requiredCalendarId) discoveredCalendarIds.add(target.requiredCalendarId)
    }

    const subjectTargets = batchTargets.filter(
      (target) =>
        target.targetType === 'custom_subject' && Boolean(target.requiredSubjectType) && Boolean(target.requiredSubjectId),
    )
    if (subjectTargets.length > 0) {
      const subjectBindings = await db.query.calendarBindings.findMany({
        where: and(
          eq(calendarBindings.bizId, bizId),
          eq(calendarBindings.ownerType, 'custom_subject'),
          eq(calendarBindings.isActive, true),
          eq(calendarBindings.isPrimary, true),
          or(
            ...subjectTargets.map((target) =>
              and(
                eq(calendarBindings.ownerRefType, target.requiredSubjectType!),
                eq(calendarBindings.ownerRefId, target.requiredSubjectId!),
              ),
            ),
          ),
        ),
      })
      subjectBindings.forEach((binding) => discoveredCalendarIds.add(binding.calendarId))
    }
  }

  const discoveredIds = Array.from(discoveredCalendarIds)
  const [calendarRows, ruleRows, exclusionRows, gateRows] = await Promise.all([
    db.query.calendars.findMany({
      where: and(eq(calendars.bizId, bizId), inArray(calendars.id, discoveredIds), eq(calendars.status, 'active')),
    }),
    db.query.availabilityRules.findMany({
      where: and(eq(availabilityRules.bizId, bizId), inArray(availabilityRules.calendarId, discoveredIds), eq(availabilityRules.isActive, true)),
    }),
    db.query.availabilityRuleExclusionDates.findMany({
      where: eq(availabilityRuleExclusionDates.bizId, bizId),
    }),
    db.query.availabilityGates.findMany({
      where: and(
        eq(availabilityGates.bizId, bizId),
        inArray(availabilityGates.calendarId, discoveredIds),
        eq(availabilityGates.status, 'active'),
        sql`${availabilityGates.windowStartAt} < ${slotEndAt}`,
        sql`coalesce(${availabilityGates.windowEndAt}, 'infinity'::timestamptz) > ${slotStartAt}`,
      ),
    }),
  ])

  const ruleByCalendar = new Map<string, CalendarRuleRow[]>()
  for (const row of ruleRows) {
    const bucket = ruleByCalendar.get(row.calendarId) ?? []
    bucket.push(row)
    ruleByCalendar.set(row.calendarId, bucket)
  }

  const exclusionByRuleId = new Map<string, Set<string>>()
  for (const row of exclusionRows) {
    const bucket = exclusionByRuleId.get(row.availabilityRuleId) ?? new Set<string>()
    bucket.add(String(row.exclusionDate))
    exclusionByRuleId.set(row.availabilityRuleId, bucket)
  }

  const gatesByCalendar = new Map<string, Array<typeof availabilityGates.$inferSelect>>()
  for (const row of gateRows) {
    const bucket = gatesByCalendar.get(row.calendarId) ?? []
    bucket.push(row)
    gatesByCalendar.set(row.calendarId, bucket)
  }

  const subjectPrimaryBindings = await db.query.calendarBindings.findMany({
    where: and(
      eq(calendarBindings.bizId, bizId),
      eq(calendarBindings.ownerType, 'custom_subject'),
      eq(calendarBindings.isActive, true),
      eq(calendarBindings.isPrimary, true),
    ),
  })

  const subjectBindingCalendarIds = new Map<string, string[]>()
  for (const binding of subjectPrimaryBindings) {
    if (!binding.ownerRefType || !binding.ownerRefId) continue
    const key = `${binding.ownerRefType}:${binding.ownerRefId}`
    const bucket = subjectBindingCalendarIds.get(key) ?? []
    bucket.push(binding.calendarId)
    subjectBindingCalendarIds.set(key, bucket)
  }

  const dependencyRulesByCalendar = new Map<string, CalendarDependencyRuntime[]>()
  for (const rule of dependencyRuleById.values()) {
    const targets = (dependencyTargetsByRuleId.get(rule.id) ?? []).map((target) => {
      const resolvedCalendarIds =
        target.targetType === 'calendar'
          ? target.requiredCalendarId ? [target.requiredCalendarId] : []
          : target.requiredSubjectType && target.requiredSubjectId
            ? subjectBindingCalendarIds.get(`${target.requiredSubjectType}:${target.requiredSubjectId}`) ?? []
            : []
      return {
        ...target,
        resolvedCalendarIds,
      }
    })
    const bucket = dependencyRulesByCalendar.get(rule.dependentCalendarId) ?? []
    bucket.push({ rule, targets })
    dependencyRulesByCalendar.set(rule.dependentCalendarId, bucket)
  }

  const contexts = new Map<string, CalendarRuntimeContext>()
  for (const calendar of calendarRows) {
    contexts.set(calendar.id, {
      calendar,
      rules: ruleByCalendar.get(calendar.id) ?? [],
      exclusionByRuleId,
      gates: gatesByCalendar.get(calendar.id) ?? [],
      dependencyRules: dependencyRulesByCalendar.get(calendar.id) ?? [],
    })
  }
  return contexts
}

function evaluateCalendarBookability(
  context: CalendarRuntimeContext,
  slotStartAt: Date,
  slotEndAt: Date,
): CalendarBookabilityOutcome {
  const matchedActions: Array<{ action: string; priority: number; specificity: number }> = []

  for (const rule of context.rules as CalendarRuleRow[]) {
    const exclusions = context.exclusionByRuleId.get(rule.id)
    if (!ruleApplies(rule, slotStartAt, slotEndAt, context.calendar.timezone || 'UTC', exclusions)) continue
    if (rule.action !== 'available' && rule.action !== 'unavailable' && rule.action !== 'override_hours') continue
    matchedActions.push({
      action: rule.action,
      priority: Number(rule.priority ?? 100),
      specificity: computeRuleSpecificity(rule),
    })
  }

  for (const gate of context.gates) {
    const gateStart = (gate.windowStartAt as Date).getTime()
    const gateEnd = gate.windowEndAt ? (gate.windowEndAt as Date).getTime() : Number.POSITIVE_INFINITY
    if (gateStart >= slotEndAt.getTime() || gateEnd <= slotStartAt.getTime()) continue
    if (gate.action !== 'available' && gate.action !== 'unavailable' && gate.action !== 'override_hours') continue
    matchedActions.push({
      action: gate.action,
      priority: Number(gate.priority ?? 100),
      specificity: 1000,
    })
  }

  return resolveRuleOutcome(context.calendar, matchedActions)
}

function isDependencyRuleEffective(
  rule: CalendarDependencyRuleRow,
  slotStartAt: Date,
  slotEndAt: Date,
) {
  if (rule.status !== 'active') return false
  if (rule.effectiveStartAt && (rule.effectiveStartAt as Date).getTime() > slotEndAt.getTime()) return false
  if (rule.effectiveEndAt && (rule.effectiveEndAt as Date).getTime() < slotStartAt.getTime()) return false
  return true
}

function dependencyRuleSatisfied(
  dependency: CalendarDependencyRuntime<CalendarDependencyRuleRow, CalendarDependencyTargetRow>,
  targetSatisfiedRows: boolean[],
  targetWeightRows: number[],
) {
  const satisfiedCount = targetSatisfiedRows.filter(Boolean).length
  const totalCount = targetSatisfiedRows.length
  const satisfiedWeight = targetSatisfiedRows.reduce(
    (sum, satisfied, index) => sum + (satisfied ? targetWeightRows[index] ?? 1 : 0),
    0,
  )
  const totalWeight = targetWeightRows.reduce((sum, value) => sum + value, 0)

  if (dependency.rule.evaluationMode === 'any') return satisfiedCount > 0
  if (dependency.rule.evaluationMode === 'threshold') {
    const meetsCount =
      dependency.rule.minSatisfiedCount === null ||
      dependency.rule.minSatisfiedCount === undefined ||
      satisfiedCount >= Number(dependency.rule.minSatisfiedCount)
    const percent = totalWeight > 0 ? Math.round((satisfiedWeight / totalWeight) * 100) : 0
    const meetsPercent =
      dependency.rule.minSatisfiedPercent === null ||
      dependency.rule.minSatisfiedPercent === undefined ||
      percent >= Number(dependency.rule.minSatisfiedPercent)
    return meetsCount && meetsPercent
  }
  return totalCount > 0 && satisfiedCount === totalCount
}

export function evaluateCalendarAvailabilityWithDependencies(
  calendarId: string,
  contexts: Map<string, CalendarRuntimeContext>,
  slotStartAt: Date,
  slotEndAt: Date,
  memo: Map<string, CalendarBookabilityOutcome>,
  stack: Set<string> = new Set(),
): CalendarBookabilityOutcome {
  const memoKey = `${calendarId}:${slotStartAt.toISOString()}:${slotEndAt.toISOString()}`
  const cached = memo.get(memoKey)
  if (cached) return cached

  if (stack.has(calendarId)) {
    const cycleResult: CalendarBookabilityOutcome = {
      available: false,
      source: 'dependency_cycle',
      explanations: [
        {
          sourceType: 'dependency',
          source: 'dependency_cycle',
          message: 'Calendar dependency evaluation found a cycle and blocked the slot conservatively.',
          metadata: { calendarId },
        },
      ],
    }
    memo.set(memoKey, cycleResult)
    return cycleResult
  }

  const context = contexts.get(calendarId)
  if (!context) {
    const missingResult: CalendarBookabilityOutcome = {
      available: false,
      source: 'missing_calendar',
      explanations: [
        {
          sourceType: 'resolver',
          source: 'missing_calendar',
          message: 'A required calendar runtime could not be loaded.',
          metadata: { calendarId },
        },
      ],
    }
    memo.set(memoKey, missingResult)
    return missingResult
  }

  const nextStack = new Set(stack)
  nextStack.add(calendarId)

  const baseOutcome = evaluateCalendarBookability(context, slotStartAt, slotEndAt)
  if (!baseOutcome.available) {
    memo.set(memoKey, baseOutcome)
    return baseOutcome
  }

  for (const dependency of context.dependencyRules as CalendarDependencyRuntime<CalendarDependencyRuleRow, CalendarDependencyTargetRow>[]) {
    if (!isDependencyRuleEffective(dependency.rule, slotStartAt, slotEndAt)) continue

    const dependencySlotStartAt = new Date(
      slotStartAt.getTime() - Number(dependency.rule.timeOffsetBeforeMin ?? 0) * 60 * 1000,
    )
    const dependencySlotEndAt = new Date(
      slotEndAt.getTime() + Number(dependency.rule.timeOffsetAfterMin ?? 0) * 60 * 1000,
    )

    const targetSatisfiedRows = dependency.targets.map((target) => {
      if (target.resolvedCalendarIds.length === 0) return false
      return target.resolvedCalendarIds.some((targetCalendarId) =>
        evaluateCalendarAvailabilityWithDependencies(
          targetCalendarId,
          contexts,
          dependencySlotStartAt,
          dependencySlotEndAt,
          memo,
          nextStack,
        ).available,
      )
    })
    const targetWeightRows = dependency.targets.map((target) => Math.max(Number(target.weight ?? 1), 1))
    const satisfied = dependencyRuleSatisfied(dependency, targetSatisfiedRows, targetWeightRows)

    if (!satisfied && dependency.rule.enforcementMode === 'hard_block' && dependency.rule.failureAction === 'unavailable') {
      const dependencyBlocked: CalendarBookabilityOutcome = {
        available: false,
        source: `dependency:${dependency.rule.id}`,
        explanations: [
          ...baseOutcome.explanations,
          {
            sourceType: 'dependency',
            source: `dependency:${dependency.rule.id}`,
            message: 'A required dependency calendar was not sufficiently available for this slot.',
            metadata: {
              calendarId,
              dependencyRuleId: dependency.rule.id,
              evaluationMode: dependency.rule.evaluationMode,
              enforcementMode: dependency.rule.enforcementMode,
            },
          },
        ],
      }
      memo.set(memoKey, dependencyBlocked)
      return dependencyBlocked
    }
  }

  memo.set(memoKey, baseOutcome)
  return baseOutcome
}
