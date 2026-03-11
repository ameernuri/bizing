import { and, asc, eq, gte, inArray, lte, sql } from 'drizzle-orm'
import dbPackage from '@bizing/db'
import { sanitizeUnknown } from '../lib/sanitize.js'
import { syncCoverageLaneAssignmentAvailability } from './coverage-lanes.js'
import { dispatchWorkflowTriggers } from './workflow-trigger-runtime.js'

const {
  db,
  coverageLanes,
  coverageLaneAlerts,
  coverageLaneShiftTemplates,
  staffingDemands,
  staffingAssignments,
  workflowDefinitions,
  workflowDefinitionVersions,
  workflowDefinitionTriggers,
} = dbPackage

type DbExecutor = typeof db

const ACTIVE_ASSIGNMENT_STATUSES = new Set(['planned', 'confirmed', 'in_progress', 'completed'])
const COVERAGE_GAP_WORKFLOW_KEY = 'coverage-lane-gap-escalation'

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>
  return {}
}

function asNumberArray(value: unknown) {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => (typeof item === 'number' && Number.isFinite(item) ? Math.floor(item) : Number.NaN))
    .filter((item) => Number.isFinite(item) && item >= 0 && item <= 6)
}

function parseClock(input: string | null | undefined) {
  if (!input) return null
  const match = input.trim().match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return null
  const hours = Number.parseInt(match[1], 10)
  const minutes = Number.parseInt(match[2], 10)
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null
  return { hours, minutes }
}

function buildLocalOccurrence(date: Date, clock: { hours: number; minutes: number }) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    clock.hours,
    clock.minutes,
    0,
    0,
  )
}

export async function computeCoverageLaneSummary(input: {
  bizId: string
  from?: Date
  to?: Date
  locationId?: string | null
  executor?: DbExecutor
}) {
  const executor = input.executor ?? db
  const from = input.from ?? new Date(Date.now() - 24 * 60 * 60 * 1000)
  const to = input.to ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  const now = new Date()

  const [laneRows, demandRows, assignmentRows] = await Promise.all([
    executor.query.coverageLanes.findMany({
      where: and(
        eq(coverageLanes.bizId, input.bizId),
        input.locationId ? eq(coverageLanes.locationId, input.locationId) : undefined,
      ),
      orderBy: [asc(coverageLanes.name)],
    }),
    executor.query.staffingDemands.findMany({
      where: and(
        eq(staffingDemands.bizId, input.bizId),
        gte(staffingDemands.endsAt, from),
        lte(staffingDemands.startsAt, to),
      ),
      orderBy: [asc(staffingDemands.startsAt)],
    }),
    executor.query.staffingAssignments.findMany({
      where: and(
        eq(staffingAssignments.bizId, input.bizId),
        gte(staffingAssignments.endsAt, from),
        lte(staffingAssignments.startsAt, to),
      ),
      orderBy: [asc(staffingAssignments.startsAt)],
    }),
  ])

  const demandRowsByLane = new Map<string, typeof demandRows>()
  for (const row of demandRows) {
    if (!row.coverageLaneId) continue
    const bucket = demandRowsByLane.get(row.coverageLaneId) ?? []
    bucket.push(row)
    demandRowsByLane.set(row.coverageLaneId, bucket)
  }

  const assignmentRowsByLane = new Map<string, typeof assignmentRows>()
  for (const row of assignmentRows) {
    if (!row.coverageLaneId) continue
    const bucket = assignmentRowsByLane.get(row.coverageLaneId) ?? []
    bucket.push(row)
    assignmentRowsByLane.set(row.coverageLaneId, bucket)
  }

  const laneSummaries = laneRows.map((lane) => {
    const laneDemandRows = demandRowsByLane.get(lane.id) ?? []
    const laneAssignmentRows = (assignmentRowsByLane.get(lane.id) ?? []).filter((row) =>
      ACTIVE_ASSIGNMENT_STATUSES.has(String(row.status)),
    )
    const coveredNowAssignments = laneAssignmentRows.filter(
      (row) => row.startsAt.getTime() <= now.getTime() && row.endsAt.getTime() > now.getTime(),
    )
    const openDemandRows = laneDemandRows.filter((row) => row.status === 'open' || (row.requiredCount ?? 0) > (row.filledCount ?? 0))
    const upcomingGapRows = laneDemandRows.filter(
      (row) => row.endsAt.getTime() >= now.getTime() && (row.requiredCount ?? 0) > (row.filledCount ?? 0),
    )
    const staffedMinutes = laneAssignmentRows.reduce((sum, row) => {
      const startAt = Math.max(row.startsAt.getTime(), from.getTime())
      const endAt = Math.min(row.endsAt.getTime(), to.getTime())
      if (endAt <= startAt) return sum
      return sum + Math.round((endAt - startAt) / (60 * 1000))
    }, 0)
    const uncoveredDemandMinutes = laneDemandRows.reduce((sum, row) => {
      const missingHeadcount = Math.max((row.requiredCount ?? 0) - (row.filledCount ?? 0), 0)
      if (missingHeadcount <= 0) return sum
      const startAt = Math.max(row.startsAt.getTime(), from.getTime())
      const endAt = Math.min(row.endsAt.getTime(), to.getTime())
      if (endAt <= startAt) return sum
      return sum + Math.round((endAt - startAt) / (60 * 1000)) * missingHeadcount
    }, 0)

    return {
      lane,
      stats: {
        demandCount: laneDemandRows.length,
        openDemandCount: openDemandRows.length,
        filledDemandCount: laneDemandRows.filter((row) => row.status === 'filled').length,
        assignmentCount: laneAssignmentRows.length,
        staffedMinutes,
        uncoveredDemandMinutes,
        currentCoverageCount: coveredNowAssignments.length,
        currentCovered: coveredNowAssignments.length >= Math.max(Number(lane.requiredHeadcount ?? 1), 1),
        upcomingGapCount: upcomingGapRows.length,
        nextGapStartAt: upcomingGapRows[0]?.startsAt?.toISOString() ?? null,
        nextGapEndAt: upcomingGapRows[0]?.endsAt?.toISOString() ?? null,
      },
      currentAssignments: coveredNowAssignments.map((row) => ({
        id: row.id,
        resourceId: row.resourceId,
        startsAt: row.startsAt.toISOString(),
        endsAt: row.endsAt.toISOString(),
        status: row.status,
      })),
    }
  })

  return {
    from: from.toISOString(),
    to: to.toISOString(),
    summary: {
      laneCount: laneSummaries.length,
      currentCoveredCount: laneSummaries.filter((row) => row.stats.currentCovered).length,
      currentGapCount: laneSummaries.filter((row) => !row.stats.currentCovered).length,
      openDemandCount: laneSummaries.reduce((sum, row) => sum + row.stats.openDemandCount, 0),
      staffedMinutes: laneSummaries.reduce((sum, row) => sum + row.stats.staffedMinutes, 0),
      uncoveredDemandMinutes: laneSummaries.reduce((sum, row) => sum + row.stats.uncoveredDemandMinutes, 0),
    },
    lanes: laneSummaries,
  }
}

async function ensureCoverageGapEscalationWorkflow(input: { bizId: string; executor?: DbExecutor }) {
  const executor = input.executor ?? db
  let definition = await executor.query.workflowDefinitions.findFirst({
    where: and(eq(workflowDefinitions.bizId, input.bizId), eq(workflowDefinitions.key, COVERAGE_GAP_WORKFLOW_KEY)),
  })

  if (!definition) {
    const [created] = await executor
      .insert(workflowDefinitions)
      .values({
        bizId: input.bizId,
        key: COVERAGE_GAP_WORKFLOW_KEY,
        name: 'Coverage Lane Gap Escalation',
        status: 'active',
        triggerMode: 'system',
        targetType: 'coverage_lane_alert',
        currentVersion: 1,
        description: 'Triggered when a coverage lane remains uncovered beyond its escalation threshold.',
        metadata: { source: 'coverage_lane_alerts' },
      })
      .returning()
    definition = created
  }

  const existingVersion = await executor.query.workflowDefinitionVersions.findFirst({
    where: and(
      eq(workflowDefinitionVersions.bizId, input.bizId),
      eq(workflowDefinitionVersions.workflowDefinitionId, definition.id),
      eq(workflowDefinitionVersions.version, definition.currentVersion),
    ),
  })
  if (!existingVersion) {
    await executor.insert(workflowDefinitionVersions).values({
      bizId: input.bizId,
      workflowDefinitionId: definition.id,
      version: definition.currentVersion,
      status: 'active',
      stepPlan: [
        {
          stepKey: 'triage_gap',
          name: 'Review uncovered lane',
          sequence: 0,
          status: 'pending',
          dueInMinutes: 5,
          metadata: { source: 'coverage_lane_alerts' },
        },
        {
          stepKey: 'dispatch_followup',
          name: 'Assign or escalate coverage',
          sequence: 1,
          status: 'blocked',
          dueInMinutes: 15,
          metadata: { source: 'coverage_lane_alerts' },
        },
      ],
      inputSchema: {
        type: 'object',
        properties: {
          coverageLaneId: { type: 'string' },
          alertType: { type: 'string' },
          requiredHeadcount: { type: 'number' },
        },
      },
      metadata: { source: 'coverage_lane_alerts' },
    })
  }

  const existingTrigger = await executor.query.workflowDefinitionTriggers.findFirst({
    where: and(
      eq(workflowDefinitionTriggers.bizId, input.bizId),
      eq(workflowDefinitionTriggers.workflowDefinitionId, definition.id),
      eq(workflowDefinitionTriggers.triggerSource, 'system'),
      eq(workflowDefinitionTriggers.targetType, 'coverage_lane_alert'),
      eq(workflowDefinitionTriggers.status, 'active'),
    ),
  })
  if (!existingTrigger) {
    await executor.insert(workflowDefinitionTriggers).values({
      bizId: input.bizId,
      workflowDefinitionId: definition.id,
      status: 'active',
      triggerSource: 'system',
      targetType: 'coverage_lane_alert',
      priority: 100,
      workflowDefinitionVersion: definition.currentVersion,
      idempotencyMode: 'trigger_target',
      configuration: { source: 'coverage_lane_alerts' },
      metadata: { source: 'coverage_lane_alerts' },
    })
  }

  return definition
}

export async function listCoverageLaneAlerts(input: {
  bizId: string
  laneId?: string | null
  status?: 'active' | 'acknowledged' | 'resolved' | null
  executor?: DbExecutor
}) {
  const executor = input.executor ?? db
  return executor.query.coverageLaneAlerts.findMany({
    where: and(
      eq(coverageLaneAlerts.bizId, input.bizId),
      input.laneId ? eq(coverageLaneAlerts.coverageLaneId, input.laneId) : undefined,
      input.status
        ? input.status === 'resolved'
          ? eq(coverageLaneAlerts.status, 'resolved')
          : eq(coverageLaneAlerts.status, input.status)
        : undefined,
    ),
    orderBy: [asc(coverageLaneAlerts.coverageLaneId), asc(coverageLaneAlerts.firstTriggeredAt)],
  })
}

export async function evaluateCoverageLaneAlerts(input: {
  bizId: string
  locationId?: string | null
  executor?: DbExecutor
}) {
  const executor = input.executor ?? db
  const snapshot = await computeCoverageLaneSummary({
    bizId: input.bizId,
    locationId: input.locationId,
    executor,
  })
  const activeLaneIds = snapshot.lanes.map((row) => row.lane.id)
  const existingAlerts = activeLaneIds.length
    ? await executor.query.coverageLaneAlerts.findMany({
        where: and(
          eq(coverageLaneAlerts.bizId, input.bizId),
          inArray(coverageLaneAlerts.coverageLaneId, activeLaneIds),
          sql`"resolved_at" IS NULL`,
        ),
      })
    : []
  const existingByKey = new Map(existingAlerts.map((row) => [`${row.coverageLaneId}:${row.alertType}`, row]))
  const seenKeys = new Set<string>()
  const now = new Date()
  const triggeredAlerts: typeof coverageLaneAlerts.$inferSelect[] = []

  for (const row of snapshot.lanes) {
    const lanePolicy = asRecord(row.lane.policy)
    const escalationPolicy = asRecord(lanePolicy.escalation)
    const escalationEnabled = escalationPolicy.enabled === true
    const escalationAfterMinutes = Math.max(
      1,
      typeof escalationPolicy.afterMinutes === 'number' && Number.isFinite(escalationPolicy.afterMinutes)
        ? Math.floor(escalationPolicy.afterMinutes)
        : 15,
    )

    const desiredAlerts = [
      !row.stats.currentCovered
        ? {
            alertType: 'uncovered_now',
            severity: 'critical',
            title: `${row.lane.name} is uncovered`,
            summary: `This lane currently has ${row.stats.currentCoverageCount} of ${Math.max(Number(row.lane.requiredHeadcount ?? 1), 1)} required responders.`,
            escalate: escalationEnabled,
            thresholdMinutes: escalationAfterMinutes,
          }
        : null,
      row.stats.upcomingGapCount > 0
        ? {
            alertType: 'upcoming_gap',
            severity: 'warning',
            title: `${row.lane.name} has an upcoming gap`,
            summary: row.stats.nextGapStartAt
              ? `Coverage is projected to gap at ${row.stats.nextGapStartAt}.`
              : 'Coverage is projected to gap soon.',
            escalate: false,
            thresholdMinutes: 0,
          }
        : null,
      row.stats.openDemandCount > 0
        ? {
            alertType: 'open_demand',
            severity: 'notice',
            title: `${row.lane.name} still has open staffing demand`,
            summary: `${row.stats.openDemandCount} staffing demand item(s) remain open for this lane.`,
            escalate: false,
            thresholdMinutes: 0,
          }
        : null,
    ].filter(Boolean) as Array<{
      alertType: string
      severity: string
      title: string
      summary: string
      escalate: boolean
      thresholdMinutes: number
    }>

    for (const desired of desiredAlerts) {
      const key = `${row.lane.id}:${desired.alertType}`
      seenKeys.add(key)
      const existing = existingByKey.get(key)
      let activeAlert = existing
      if (existing) {
        const [updated] = await executor
          .update(coverageLaneAlerts)
          .set({
            severity: desired.severity,
            title: desired.title,
            summary: desired.summary,
            lastObservedAt: now,
            metadata: sanitizeUnknown({
              ...(asRecord(existing.metadata)),
              snapshot: row.stats,
              escalation: {
                enabled: desired.escalate,
                thresholdMinutes: desired.thresholdMinutes,
              },
            }),
          })
          .where(and(eq(coverageLaneAlerts.bizId, input.bizId), eq(coverageLaneAlerts.id, existing.id)))
          .returning()
        activeAlert = updated
      } else {
        const [created] = await executor
          .insert(coverageLaneAlerts)
          .values({
            bizId: input.bizId,
            coverageLaneId: row.lane.id,
            alertType: desired.alertType,
            severity: desired.severity,
            status: 'active',
            title: desired.title,
            summary: desired.summary,
            firstTriggeredAt: now,
            lastObservedAt: now,
            metadata: sanitizeUnknown({
              snapshot: row.stats,
              escalation: {
                enabled: desired.escalate,
                thresholdMinutes: desired.thresholdMinutes,
              },
            }),
          })
          .returning()
        activeAlert = created
      }

      if (activeAlert) {
        triggeredAlerts.push(activeAlert)
        const elapsedMinutes = Math.floor((now.getTime() - activeAlert.firstTriggeredAt.getTime()) / (60 * 1000))
        if (
          desired.alertType === 'uncovered_now' &&
          desired.escalate &&
          elapsedMinutes >= desired.thresholdMinutes &&
          !activeAlert.workflowInstanceId
        ) {
          await ensureCoverageGapEscalationWorkflow({ bizId: input.bizId, executor })
          const dispatched = await dispatchWorkflowTriggers({
            tx: executor,
            bizId: input.bizId,
            triggerSource: 'system',
            triggerRefId: `coverage_lane_alert:${activeAlert.id}:${activeAlert.firstTriggeredAt.toISOString()}`,
            targetType: 'coverage_lane_alert',
            targetRefId: activeAlert.id,
            inputPayload: {
              alertType: desired.alertType,
              coverageLaneId: row.lane.id,
              coverageLaneName: row.lane.name,
              requiredHeadcount: row.lane.requiredHeadcount,
              thresholdMinutes: desired.thresholdMinutes,
              snapshot: row.stats,
            },
            metadata: {
              source: 'coverage_lane_alerts',
              coverageLaneId: row.lane.id,
            },
          })
          const workflowInstanceId = dispatched.workflowInstances[0]?.id ?? null
          if (workflowInstanceId) {
            const [updated] = await executor
              .update(coverageLaneAlerts)
              .set({
                workflowInstanceId,
                metadata: sanitizeUnknown({
                  ...(asRecord(activeAlert.metadata)),
                  workflowEscalatedAt: now.toISOString(),
                  workflowKey: COVERAGE_GAP_WORKFLOW_KEY,
                }),
              })
              .where(and(eq(coverageLaneAlerts.bizId, input.bizId), eq(coverageLaneAlerts.id, activeAlert.id)))
              .returning()
            triggeredAlerts[triggeredAlerts.length - 1] = updated
          }
        }
      }
    }
  }

  for (const row of existingAlerts) {
    const key = `${row.coverageLaneId}:${row.alertType}`
    if (seenKeys.has(key)) continue
    await executor
      .update(coverageLaneAlerts)
      .set({
        status: 'resolved',
        resolvedAt: now,
        lastObservedAt: now,
      })
      .where(and(eq(coverageLaneAlerts.bizId, input.bizId), eq(coverageLaneAlerts.id, row.id)))
  }

  return {
    snapshot,
    alerts: await listCoverageLaneAlerts({ bizId: input.bizId, executor }),
  }
}

export async function publishCoverageLaneShiftTemplate(input: {
  bizId: string
  templateId: string
  through?: Date
  executor?: DbExecutor
  actorUserId?: string | null
}) {
  const executor = input.executor ?? db
  const template = await executor.query.coverageLaneShiftTemplates.findFirst({
    where: and(eq(coverageLaneShiftTemplates.bizId, input.bizId), eq(coverageLaneShiftTemplates.id, input.templateId)),
  })
  if (!template) throw new Error('Coverage shift template not found.')
  const lane = await executor.query.coverageLanes.findFirst({
    where: and(eq(coverageLanes.bizId, input.bizId), eq(coverageLanes.id, template.coverageLaneId)),
  })
  if (!lane) throw new Error('Coverage lane not found for shift template.')

  const recurrenceRule = asRecord(template.recurrenceRule)
  const dayOfWeeks = asNumberArray(recurrenceRule.dayOfWeeks)
  const startClock = parseClock(typeof recurrenceRule.startTime === 'string' ? recurrenceRule.startTime : null)
  const endClock = parseClock(typeof recurrenceRule.endTime === 'string' ? recurrenceRule.endTime : null)
  if (dayOfWeeks.length === 0 || !startClock || !endClock) {
    throw new Error('Coverage shift template requires dayOfWeeks, startTime, and endTime.')
  }

  const now = new Date()
  const through = input.through ?? new Date(now.getTime() + Math.max(template.publishWindowDays, 1) * 24 * 60 * 60 * 1000)
  const startAnchor = template.lastPublishedThrough && template.lastPublishedThrough.getTime() > now.getTime()
    ? new Date(template.lastPublishedThrough.getTime())
    : now
  const cursor = new Date(startAnchor.getFullYear(), startAnchor.getMonth(), startAnchor.getDate(), 0, 0, 0, 0)
  const endCursor = new Date(through.getFullYear(), through.getMonth(), through.getDate(), 0, 0, 0, 0)

  let demandCount = 0
  let assignmentCount = 0

  while (cursor.getTime() <= endCursor.getTime()) {
    if (dayOfWeeks.includes(cursor.getDay())) {
      const startsAt = buildLocalOccurrence(cursor, startClock)
      const endsAt = buildLocalOccurrence(cursor, endClock)
      if (endsAt.getTime() > startsAt.getTime() && startsAt.getTime() > (template.lastPublishedThrough?.getTime() ?? 0)) {
        const sourceRefId = `${template.id}:${startsAt.toISOString()}`
        const existingDemand = await executor.query.staffingDemands.findFirst({
          where: and(
            eq(staffingDemands.bizId, input.bizId),
            eq(staffingDemands.sourceType, 'coverage_shift_template'),
            eq(staffingDemands.sourceRefId, sourceRefId),
          ),
        })

        if (!existingDemand) {
          const assignedCount = template.defaultResourceId ? 1 : 0
          const [demand] = await executor.insert(staffingDemands).values({
            bizId: input.bizId,
            demandType: 'on_call',
            fillMode: template.fillMode as any,
            status: assignedCount >= template.requiredCount ? 'filled' : 'open',
            title: template.name,
            description: `Published from coverage shift template for ${lane.name}.`,
            locationId: template.locationId ?? lane.locationId,
            requiredCount: template.requiredCount,
            filledCount: assignedCount,
            startsAt,
            endsAt,
            requestedByUserId: input.actorUserId ?? null,
            coverageLaneId: template.coverageLaneId,
            assignedResourceId: template.defaultResourceId ?? null,
            sourceType: 'coverage_shift_template',
            sourceRefId,
            policy: sanitizeUnknown(template.policy),
            metadata: sanitizeUnknown({
              ...(asRecord(template.metadata)),
              coverageShiftTemplateId: template.id,
              sourceOccurrenceStartAt: startsAt.toISOString(),
              timezone: template.timezone,
            }),
          }).returning()
          demandCount += 1

          if (template.defaultResourceId) {
            const [assignment] = await executor.insert(staffingAssignments).values({
              bizId: input.bizId,
              staffingDemandId: demand.id,
              resourceId: template.defaultResourceId,
              coverageLaneId: template.coverageLaneId,
              status: 'confirmed',
              startsAt,
              endsAt,
              isPrimary: true,
              assignedByUserId: input.actorUserId ?? null,
              assignedAt: new Date(),
              metadata: sanitizeUnknown({
                coverageShiftTemplateId: template.id,
                sourceOccurrenceStartAt: startsAt.toISOString(),
              }),
            }).returning()
            assignmentCount += 1
            await syncCoverageLaneAssignmentAvailability({
              bizId: input.bizId,
              staffingAssignmentId: assignment.id,
              actorUserId: input.actorUserId ?? null,
              executor,
            })
          }
        }
      }
    }
    cursor.setDate(cursor.getDate() + 1)
  }

  await executor
    .update(coverageLaneShiftTemplates)
    .set({
      lastPublishedThrough: through,
    })
    .where(and(eq(coverageLaneShiftTemplates.bizId, input.bizId), eq(coverageLaneShiftTemplates.id, template.id)))

  return {
    through: through.toISOString(),
    createdDemandCount: demandCount,
    createdAssignmentCount: assignmentCount,
  }
}
