import { and, desc, eq, isNull } from 'drizzle-orm'
import dbPackage from '@bizing/db'
import { sanitizePlainText, sanitizeUnknown } from '../lib/sanitize.js'

const {
  db,
  workItems,
  workItemEvents,
  workCommands,
  actionRequests,
  domainEvents,
  workflowInstances,
  workflowSteps,
  reviewQueueItems,
  operationalDemands,
  operationalAssignments,
  crmTasks,
  supportCases,
  queueEntries,
  dispatchTasks,
  workRuns,
  workEntries,
} = dbPackage

const WORK_ITEM_SOURCE_BY_TABLE = {
  actionRequests: 'action_request',
  domainEvents: 'domain_event',
  workflowInstances: 'workflow_instance',
  workflowSteps: 'workflow_step',
  reviewQueueItems: 'review_item',
  operationalDemands: 'operational_demand',
  operationalAssignments: 'operational_assignment',
  crmTasks: 'crm_task',
  supportCases: 'support_case',
  queueEntries: 'queue_entry',
  dispatchTasks: 'dispatch_task',
  workRuns: 'work_run',
  workEntries: 'work_entry',
} as const

export type WorkItemSourceTable = keyof typeof WORK_ITEM_SOURCE_BY_TABLE
export type WorkItemSourceType = (typeof WORK_ITEM_SOURCE_BY_TABLE)[WorkItemSourceTable]
export const trackedWorkItemSourceTables = Object.keys(
  WORK_ITEM_SOURCE_BY_TABLE,
) as WorkItemSourceTable[]

type CrudOperation = 'create' | 'update' | 'delete'

type WorkItemEventType =
  | 'created'
  | 'synced'
  | 'status_changed'
  | 'priority_changed'
  | 'urgency_changed'
  | 'assigned'
  | 'unassigned'
  | 'snoozed'
  | 'unsnoozed'
  | 'completed'
  | 'reopened'
  | 'cancelled'
  | 'commented'
  | 'command_run_started'
  | 'command_run_finished'

type WorkItemStatus = 'open' | 'in_progress' | 'blocked' | 'snoozed' | 'done' | 'cancelled'
type WorkItemUrgency = 'low' | 'normal' | 'high' | 'critical'

type SyncSourceInput = {
  bizId: string
  tableKey: WorkItemSourceTable
  row: Record<string, unknown>
  actorUserId?: string | null
  sourceLabel?: string | null
}

type BuiltinWorkCommand = {
  commandKey: string
  title: string
  description: string
  commandKind: 'action' | 'workflow' | 'navigation' | 'automation' | 'custom'
  targetScope: 'global' | 'biz' | 'subject' | 'work_item' | 'selection'
  actionKey?: string
  defaultPayload: Record<string, unknown>
  guardPolicy: Record<string, unknown>
}

const BUILTIN_WORK_COMMANDS: BuiltinWorkCommand[] = [
  {
    commandKey: 'work_item.start',
    title: 'Start Work Item',
    description: 'Move a work item to in-progress.',
    commandKind: 'action',
    targetScope: 'work_item',
    actionKey: 'crud.update',
    defaultPayload: {
      tableKey: 'workItems',
      operation: 'update',
      patch: {
        status: 'in_progress',
      },
    },
    guardPolicy: {
      requiresWorkItemId: true,
      allowedStatuses: ['open', 'blocked', 'snoozed'],
    },
  },
  {
    commandKey: 'work_item.complete',
    title: 'Complete Work Item',
    description: 'Mark a work item as done.',
    commandKind: 'action',
    targetScope: 'work_item',
    actionKey: 'crud.update',
    defaultPayload: {
      tableKey: 'workItems',
      operation: 'update',
      patch: {
        status: 'done',
      },
    },
    guardPolicy: {
      requiresWorkItemId: true,
      allowedStatuses: ['open', 'in_progress', 'blocked', 'snoozed'],
      autoStampCompletedAt: true,
    },
  },
  {
    commandKey: 'work_item.snooze',
    title: 'Snooze Work Item',
    description: 'Snooze a work item until later.',
    commandKind: 'action',
    targetScope: 'work_item',
    actionKey: 'crud.update',
    defaultPayload: {
      tableKey: 'workItems',
      operation: 'update',
      patch: {
        status: 'snoozed',
      },
    },
    guardPolicy: {
      requiresWorkItemId: true,
    },
  },
  {
    commandKey: 'work_item.reopen',
    title: 'Reopen Work Item',
    description: 'Reopen a completed/cancelled work item.',
    commandKind: 'action',
    targetScope: 'work_item',
    actionKey: 'crud.update',
    defaultPayload: {
      tableKey: 'workItems',
      operation: 'update',
      patch: {
        status: 'open',
      },
    },
    guardPolicy: {
      requiresWorkItemId: true,
      allowedStatuses: ['done', 'cancelled', 'snoozed'],
      clearCompletedAt: true,
    },
  },
]

export function isTrackedWorkItemSourceTable(tableKey: string): tableKey is WorkItemSourceTable {
  return tableKey in WORK_ITEM_SOURCE_BY_TABLE
}

function asString(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

function asDate(value: unknown) {
  if (!value) return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }
  return null
}

function asNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function safeRecord(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}

function mapSourceStatusToWorkItemStatus(sourceStatusRaw: string | null): WorkItemStatus {
  const sourceStatus = (sourceStatusRaw ?? '').toLowerCase()
  if (!sourceStatus) return 'open'

  if (
    sourceStatus.includes('done') ||
    sourceStatus.includes('completed') ||
    sourceStatus.includes('approved') ||
    sourceStatus.includes('resolved') ||
    sourceStatus.includes('closed') ||
    sourceStatus.includes('delivered') ||
    sourceStatus.includes('succeeded')
  ) {
    return 'done'
  }

  if (
    sourceStatus.includes('cancel') ||
    sourceStatus.includes('void') ||
    sourceStatus.includes('expired') ||
    sourceStatus.includes('archived') ||
    sourceStatus.includes('rejected')
  ) {
    return 'cancelled'
  }

  if (sourceStatus.includes('snooz') || sourceStatus.includes('defer')) return 'snoozed'

  if (
    sourceStatus.includes('block') ||
    sourceStatus.includes('failed') ||
    sourceStatus.includes('timed_out') ||
    sourceStatus.includes('waiting_input') ||
    sourceStatus.includes('escalated')
  ) {
    return 'blocked'
  }

  if (
    sourceStatus.includes('in_progress') ||
    sourceStatus.includes('running') ||
    sourceStatus.includes('processing') ||
    sourceStatus.includes('active') ||
    sourceStatus.includes('claimed') ||
    sourceStatus.includes('submitted')
  ) {
    return 'in_progress'
  }

  return 'open'
}

function mapPriorityToUrgency(priorityRaw: string | number | null): WorkItemUrgency {
  if (typeof priorityRaw === 'number') {
    if (priorityRaw <= 20) return 'critical'
    if (priorityRaw <= 50) return 'high'
    if (priorityRaw <= 100) return 'normal'
    return 'low'
  }

  const priority = (priorityRaw ?? '').toString().toLowerCase()
  if (priority.includes('critical') || priority.includes('urgent')) return 'critical'
  if (priority.includes('high')) return 'high'
  if (priority.includes('low')) return 'low'
  return 'normal'
}

function mapPriorityToScore(priorityRaw: string | number | null) {
  if (typeof priorityRaw === 'number' && Number.isFinite(priorityRaw)) return Math.max(0, Math.floor(priorityRaw))
  const priority = (priorityRaw ?? '').toString().toLowerCase()
  if (priority.includes('critical') || priority.includes('urgent')) return 10
  if (priority.includes('high')) return 40
  if (priority.includes('low')) return 180
  return 100
}

function titleForSource(tableKey: WorkItemSourceTable, row: Record<string, unknown>) {
  const directTitle =
    asString(row.title) ??
    asString(row.name) ??
    asString(row.itemType) ??
    asString(row.workflowKey) ??
    asString(row.sourceRefLabel)

  if (directTitle) return sanitizePlainText(directTitle)

  const fallbackId = asString(row.id) ?? 'unknown'
  return `${tableKey}:${fallbackId}`
}

function summaryForSource(row: Record<string, unknown>) {
  const summary =
    asString(row.summary) ??
    asString(row.description) ??
    asString(row.instructions) ??
    asString(row.note)
  return summary ? sanitizePlainText(summary) : null
}

function dueAtForSource(row: Record<string, unknown>) {
  return (
    asDate(row.dueAt) ??
    asDate(row.nextResponseDueAt) ??
    asDate(row.resolutionDueAt) ??
    asDate(row.endsAt) ??
    asDate(row.completedAt)
  )
}

function startsAtForSource(row: Record<string, unknown>) {
  return (
    asDate(row.startedAt) ??
    asDate(row.startsAt) ??
    asDate(row.openedAt) ??
    asDate(row.requestedAt) ??
    asDate(row.createdAt)
  )
}

function assigneeForSource(row: Record<string, unknown>) {
  return (
    asString(row.assignedUserId) ??
    asString(row.assigneeUserId) ??
    asString(row.ownerUserId) ??
    asString(row.createdByUserId)
  )
}

function sourceStatusForRow(row: Record<string, unknown>) {
  return asString(row.status) ?? asString(row.sourceStatus) ?? 'unknown'
}

function sourcePriorityForRow(row: Record<string, unknown>) {
  const numeric = asNumber(row.priority)
  if (numeric !== null) return numeric
  return asString(row.priority)
}

function subjectForSource(tableKey: WorkItemSourceTable, row: Record<string, unknown>) {
  const customType = asString(row.customSubjectType)
  const customId = asString(row.customSubjectId)
  if (customType && customId) {
    return {
      subjectType: customType,
      subjectId: customId,
    }
  }

  const explicitType = asString(row.subjectType)
  const explicitId = asString(row.subjectId)
  if (explicitType && explicitId) {
    return {
      subjectType: explicitType,
      subjectId: explicitId,
    }
  }

  const sourceId = asString(row.id)
  if (!sourceId) return { subjectType: null, subjectId: null }

  return {
    subjectType: WORK_ITEM_SOURCE_BY_TABLE[tableKey],
    subjectId: sourceId,
  }
}

async function recordWorkItemEvent(input: {
  bizId: string
  workItemId: string
  eventType: WorkItemEventType
  actorUserId?: string | null
  fromStatus?: WorkItemStatus | null
  toStatus?: WorkItemStatus | null
  note?: string | null
  payload?: Record<string, unknown>
}) {
  await db.insert(workItemEvents).values({
    bizId: input.bizId,
    workItemId: input.workItemId,
    eventType: input.eventType,
    actorType: input.actorUserId ? 'user' : 'system',
    actorUserId: input.actorUserId ?? null,
    fromStatus: input.fromStatus ?? null,
    toStatus: input.toStatus ?? null,
    note: input.note ?? null,
    payload: sanitizeUnknown(input.payload ?? {}),
  })
}

function deriveStatusEventType(fromStatus: WorkItemStatus | null, toStatus: WorkItemStatus): WorkItemEventType {
  if (toStatus === 'done') return 'completed'
  if (toStatus === 'cancelled') return 'cancelled'
  if (toStatus === 'snoozed') return 'snoozed'
  if (fromStatus === 'snoozed') return 'unsnoozed'
  if (fromStatus && (fromStatus === 'done' || fromStatus === 'cancelled') && toStatus === 'open') return 'reopened'
  return 'status_changed'
}

export async function upsertWorkItemFromSource(input: SyncSourceInput) {
  const sourceType = WORK_ITEM_SOURCE_BY_TABLE[input.tableKey]
  const sourceId = asString(input.row.id)
  if (!sourceId) return null

  const sourceStatus = sourceStatusForRow(input.row)
  const sourcePriority = sourcePriorityForRow(input.row)
  const status = mapSourceStatusToWorkItemStatus(sourceStatus)
  const priority = mapPriorityToScore(sourcePriority)
  const urgency = mapPriorityToUrgency(sourcePriority)

  const startsAt = startsAtForSource(input.row)
  const dueAt = dueAtForSource(input.row)
  const completedAt = asDate(input.row.completedAt)
  const assigneeUserId = assigneeForSource(input.row)

  const subject = subjectForSource(input.tableKey, input.row)

  const existing = await db.query.workItems.findFirst({
    where: and(
      eq(workItems.bizId, input.bizId),
      eq(workItems.sourceType, sourceType),
      eq(workItems.sourceRefId, sourceId),
    ),
  })

  const title = titleForSource(input.tableKey, input.row)
  const summary = summaryForSource(input.row)
  const sourceRefLabel = input.sourceLabel ? sanitizePlainText(input.sourceLabel) : null

  const normalizedMetadata = sanitizeUnknown({
    sourceStatus,
    sourcePayload: safeRecord(input.row),
  })

  if (!existing) {
    const [created] = await db
      .insert(workItems)
      .values({
        bizId: input.bizId,
        sourceType,
        sourceRefId: sourceId,
        sourceRefLabel,
        subjectType: subject.subjectType,
        subjectId: subject.subjectId,
        title,
        summary,
        status,
        urgency,
        priority,
        startsAt,
        dueAt,
        completedAt:
          completedAt ?? (status === 'done' || status === 'cancelled' ? new Date() : null),
        assigneeUserId,
        actionRequestId: asString(input.row.actionRequestId),
        domainEventId: asString(input.row.domainEventId) ?? asString(input.row.sourceDomainEventId),
        workflowInstanceId: asString(input.row.workflowInstanceId),
        workflowStepId: asString(input.row.workflowStepId),
        reviewQueueItemId: asString(input.row.reviewQueueItemId),
        operationalDemandId: asString(input.row.operationalDemandId),
        operationalAssignmentId: asString(input.row.operationalAssignmentId),
        projectionDocumentId: asString(input.row.projectionDocumentId),
        lastActivityAt: new Date(),
        metadata: normalizedMetadata,
      })
      .returning()

    await recordWorkItemEvent({
      bizId: input.bizId,
      workItemId: created.id,
      eventType: 'created',
      actorUserId: input.actorUserId,
      toStatus: created.status,
      payload: {
        sourceType,
        sourceRefId: sourceId,
      },
    })

    return created
  }

  const changedStatus = existing.status !== status
  const changedPriority = existing.priority !== priority
  const changedUrgency = existing.urgency !== urgency
  const changedAssignee = (existing.assigneeUserId ?? null) !== (assigneeUserId ?? null)
  const changedTitle = existing.title !== title
  const changedSummary = (existing.summary ?? null) !== (summary ?? null)
  const changedDueAt = (existing.dueAt?.toISOString() ?? null) !== (dueAt?.toISOString() ?? null)

  if (!changedStatus && !changedPriority && !changedUrgency && !changedAssignee && !changedTitle && !changedSummary && !changedDueAt) {
    return existing
  }

  const [updated] = await db
    .update(workItems)
    .set({
      sourceRefLabel,
      subjectType: subject.subjectType,
      subjectId: subject.subjectId,
      title,
      summary,
      status,
      urgency,
      priority,
      startsAt,
      dueAt,
      assigneeUserId,
      completedAt:
        completedAt ?? (status === 'done' || status === 'cancelled' ? (existing.completedAt ?? new Date()) : null),
      lastActivityAt: new Date(),
      actionRequestId: asString(input.row.actionRequestId) ?? existing.actionRequestId,
      domainEventId:
        asString(input.row.domainEventId) ??
        asString(input.row.sourceDomainEventId) ??
        existing.domainEventId,
      workflowInstanceId: asString(input.row.workflowInstanceId) ?? existing.workflowInstanceId,
      workflowStepId: asString(input.row.workflowStepId) ?? existing.workflowStepId,
      reviewQueueItemId: asString(input.row.reviewQueueItemId) ?? existing.reviewQueueItemId,
      operationalDemandId: asString(input.row.operationalDemandId) ?? existing.operationalDemandId,
      operationalAssignmentId:
        asString(input.row.operationalAssignmentId) ?? existing.operationalAssignmentId,
      projectionDocumentId: asString(input.row.projectionDocumentId) ?? existing.projectionDocumentId,
      metadata: normalizedMetadata,
      updatedAt: new Date(),
    })
    .where(eq(workItems.id, existing.id))
    .returning()

  if (changedStatus) {
    await recordWorkItemEvent({
      bizId: input.bizId,
      workItemId: updated.id,
      eventType: deriveStatusEventType(existing.status, updated.status),
      actorUserId: input.actorUserId,
      fromStatus: existing.status,
      toStatus: updated.status,
      payload: {
        sourceStatus,
      },
    })
  }

  if (changedPriority) {
    await recordWorkItemEvent({
      bizId: input.bizId,
      workItemId: updated.id,
      eventType: 'priority_changed',
      actorUserId: input.actorUserId,
      note: `Priority ${existing.priority} -> ${updated.priority}`,
      payload: {
        fromPriority: existing.priority,
        toPriority: updated.priority,
      },
    })
  }

  if (changedUrgency) {
    await recordWorkItemEvent({
      bizId: input.bizId,
      workItemId: updated.id,
      eventType: 'urgency_changed',
      actorUserId: input.actorUserId,
      note: `Urgency ${existing.urgency} -> ${updated.urgency}`,
      payload: {
        fromUrgency: existing.urgency,
        toUrgency: updated.urgency,
      },
    })
  }

  if (changedAssignee) {
    await recordWorkItemEvent({
      bizId: input.bizId,
      workItemId: updated.id,
      eventType: updated.assigneeUserId ? 'assigned' : 'unassigned',
      actorUserId: input.actorUserId,
      payload: {
        fromAssigneeUserId: existing.assigneeUserId,
        toAssigneeUserId: updated.assigneeUserId,
      },
    })
  }

  return updated
}

export async function markWorkItemCancelledBySource(input: {
  bizId: string
  tableKey: WorkItemSourceTable
  sourceRefId: string
  actorUserId?: string | null
}) {
  const sourceType = WORK_ITEM_SOURCE_BY_TABLE[input.tableKey]
  const existing = await db.query.workItems.findFirst({
    where: and(
      eq(workItems.bizId, input.bizId),
      eq(workItems.sourceType, sourceType),
      eq(workItems.sourceRefId, input.sourceRefId),
    ),
  })
  if (!existing || existing.status === 'cancelled') return existing

  const [updated] = await db
    .update(workItems)
    .set({
      status: 'cancelled',
      completedAt: existing.completedAt ?? new Date(),
      lastActivityAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(workItems.id, existing.id))
    .returning()

  await recordWorkItemEvent({
    bizId: input.bizId,
    workItemId: updated.id,
    eventType: 'cancelled',
    actorUserId: input.actorUserId,
    fromStatus: existing.status,
    toStatus: 'cancelled',
    payload: {
      sourceType,
      sourceRefId: input.sourceRefId,
    },
  })

  return updated
}

export async function syncWorkItemFromCrudMutation(input: {
  bizId: string
  tableKey: string
  operation: CrudOperation
  row?: Record<string, unknown> | null
  id?: string | null
  actorUserId?: string | null
}) {
  if (!isTrackedWorkItemSourceTable(input.tableKey)) return null

  if (input.operation === 'delete') {
    const sourceRefId = input.id ?? asString(input.row?.id) ?? null
    if (!sourceRefId) return null
    return markWorkItemCancelledBySource({
      bizId: input.bizId,
      tableKey: input.tableKey,
      sourceRefId,
      actorUserId: input.actorUserId,
    })
  }

  if (!input.row) return null

  return upsertWorkItemFromSource({
    bizId: input.bizId,
    tableKey: input.tableKey,
    row: input.row,
    actorUserId: input.actorUserId,
  })
}

async function syncRowsByTable(input: {
  bizId: string
  tableKey: WorkItemSourceTable
  limitPerSource: number
  actorUserId?: string | null
}) {
  let rows: Array<Record<string, unknown>> = []

  switch (input.tableKey) {
    case 'actionRequests':
      rows = await db.query.actionRequests.findMany({
        where: eq(actionRequests.bizId, input.bizId),
        orderBy: [desc(actionRequests.requestedAt)],
        limit: input.limitPerSource,
      })
      break
    case 'domainEvents':
      rows = await db.query.domainEvents.findMany({
        where: eq(domainEvents.bizId, input.bizId),
        orderBy: [desc(domainEvents.occurredAt)],
        limit: input.limitPerSource,
      })
      break
    case 'workflowInstances':
      rows = await db.query.workflowInstances.findMany({
        where: eq(workflowInstances.bizId, input.bizId),
        orderBy: [desc(workflowInstances.startedAt)],
        limit: input.limitPerSource,
      })
      break
    case 'workflowSteps':
      rows = await db.query.workflowSteps.findMany({
        where: eq(workflowSteps.bizId, input.bizId),
        orderBy: [desc(workflowSteps.startedAt)],
        limit: input.limitPerSource,
      })
      break
    case 'reviewQueueItems':
      rows = await db.query.reviewQueueItems.findMany({
        where: eq(reviewQueueItems.bizId, input.bizId),
        orderBy: [desc(reviewQueueItems.dueAt)],
        limit: input.limitPerSource,
      })
      break
    case 'operationalDemands':
      rows = await db.query.operationalDemands.findMany({
        where: eq(operationalDemands.bizId, input.bizId),
        orderBy: [desc(operationalDemands.startsAt)],
        limit: input.limitPerSource,
      })
      break
    case 'operationalAssignments':
      rows = await db.query.operationalAssignments.findMany({
        where: eq(operationalAssignments.bizId, input.bizId),
        orderBy: [desc(operationalAssignments.startsAt)],
        limit: input.limitPerSource,
      })
      break
    case 'crmTasks':
      rows = await db.query.crmTasks.findMany({
        where: eq(crmTasks.bizId, input.bizId),
        orderBy: [desc(crmTasks.dueAt)],
        limit: input.limitPerSource,
      })
      break
    case 'supportCases':
      rows = await db.query.supportCases.findMany({
        where: eq(supportCases.bizId, input.bizId),
        orderBy: [desc(supportCases.nextResponseDueAt)],
        limit: input.limitPerSource,
      })
      break
    case 'queueEntries':
      rows = await db.query.queueEntries.findMany({
        where: eq(queueEntries.bizId, input.bizId),
        orderBy: [desc(queueEntries.joinedAt)],
        limit: input.limitPerSource,
      })
      break
    case 'dispatchTasks':
      rows = await db.query.dispatchTasks.findMany({
        where: eq(dispatchTasks.bizId, input.bizId),
        orderBy: [desc(dispatchTasks.dueAt)],
        limit: input.limitPerSource,
      })
      break
    case 'workRuns':
      rows = await db.query.workRuns.findMany({
        where: eq(workRuns.bizId, input.bizId),
        orderBy: [desc(workRuns.dueAt)],
        limit: input.limitPerSource,
      })
      break
    case 'workEntries':
      rows = await db.query.workEntries.findMany({
        where: eq(workEntries.bizId, input.bizId),
        orderBy: [desc(workEntries.occurredAt)],
        limit: input.limitPerSource,
      })
      break
    default:
      rows = []
      break
  }

  let upserted = 0
  for (const row of rows) {
    const result = await upsertWorkItemFromSource({
      bizId: input.bizId,
      tableKey: input.tableKey,
      row,
      actorUserId: input.actorUserId,
    })
    if (result) upserted += 1
  }

  return {
    tableKey: input.tableKey,
    scanned: rows.length,
    upserted,
  }
}

export async function syncWorkItemsForBiz(input: {
  bizId: string
  actorUserId?: string | null
  sourceTables?: WorkItemSourceTable[]
  limitPerSource?: number
}) {
  const sourceTables =
    input.sourceTables && input.sourceTables.length > 0
      ? input.sourceTables
      : trackedWorkItemSourceTables

  const limitPerSource = Math.max(1, Math.min(input.limitPerSource ?? 250, 1000))

  const results = [] as Array<{
    tableKey: WorkItemSourceTable
    scanned: number
    upserted: number
  }>

  for (const tableKey of sourceTables) {
    results.push(
      await syncRowsByTable({
        bizId: input.bizId,
        tableKey,
        limitPerSource,
        actorUserId: input.actorUserId,
      }),
    )
  }

  return {
    sourceTables,
    limitPerSource,
    totals: {
      scanned: results.reduce((sum, item) => sum + item.scanned, 0),
      upserted: results.reduce((sum, item) => sum + item.upserted, 0),
    },
    results,
  }
}

export async function ensureBuiltinWorkCommands(input: {
  bizId: string
  actorUserId?: string | null
}) {
  const actorUserId = input.actorUserId ?? null

  for (const command of BUILTIN_WORK_COMMANDS) {
    await db
      .insert(workCommands)
      .values({
        bizId: input.bizId,
        commandKey: command.commandKey,
        title: command.title,
        description: command.description,
        status: 'active',
        commandKind: command.commandKind,
        targetScope: command.targetScope,
        actionKey: command.actionKey ?? null,
        defaultPayload: sanitizeUnknown(command.defaultPayload),
        guardPolicy: sanitizeUnknown(command.guardPolicy),
        metadata: {
          builtin: true,
        },
        createdBy: actorUserId,
        updatedBy: actorUserId,
      })
      .onConflictDoUpdate({
        target: [workCommands.bizId, workCommands.commandKey],
        set: {
          title: command.title,
          description: command.description,
          status: 'active',
          commandKind: command.commandKind,
          targetScope: command.targetScope,
          actionKey: command.actionKey ?? null,
          defaultPayload: sanitizeUnknown(command.defaultPayload),
          guardPolicy: sanitizeUnknown(command.guardPolicy),
          metadata: {
            builtin: true,
          },
          updatedAt: new Date(),
          updatedBy: actorUserId,
        },
      })
  }
}

export async function listActiveWorkCommands(bizId: string) {
  return db.query.workCommands.findMany({
    where: and(eq(workCommands.bizId, bizId), eq(workCommands.status, 'active'), isNull(workCommands.deletedAt)),
    orderBy: [desc(workCommands.updatedAt), desc(workCommands.createdAt)],
  })
}

export async function createManualWorkItem(input: {
  bizId: string
  actorUserId?: string | null
  title: string
  summary?: string | null
  status?: WorkItemStatus
  urgency?: WorkItemUrgency
  priority?: number
  dueAt?: Date | null
  startsAt?: Date | null
  snoozedUntil?: Date | null
  assigneeUserId?: string | null
  ownerUserId?: string | null
  metadata?: Record<string, unknown>
}) {
  const [created] = await db
    .insert(workItems)
    .values({
      bizId: input.bizId,
      sourceType: 'manual',
      sourceRefId: crypto.randomUUID(),
      title: sanitizePlainText(input.title),
      summary: input.summary ? sanitizePlainText(input.summary) : null,
      status: input.status ?? 'open',
      urgency: input.urgency ?? 'normal',
      priority: input.priority ?? 100,
      dueAt: input.dueAt ?? null,
      startsAt: input.startsAt ?? null,
      snoozedUntil: input.snoozedUntil ?? null,
      completedAt:
        (input.status ?? 'open') === 'done' || (input.status ?? 'open') === 'cancelled'
          ? new Date()
          : null,
      assigneeUserId: input.assigneeUserId ?? null,
      ownerUserId: input.ownerUserId ?? null,
      lastActivityAt: new Date(),
      metadata: sanitizeUnknown(input.metadata ?? {}),
      createdBy: input.actorUserId ?? null,
      updatedBy: input.actorUserId ?? null,
    })
    .returning()

  await recordWorkItemEvent({
    bizId: input.bizId,
    workItemId: created.id,
    eventType: 'created',
    actorUserId: input.actorUserId,
    toStatus: created.status,
    payload: {
      sourceType: 'manual',
    },
  })

  return created
}

export async function updateWorkItem(input: {
  bizId: string
  workItemId: string
  actorUserId?: string | null
  patch: Partial<{
    title: string
    summary: string | null
    status: WorkItemStatus
    urgency: WorkItemUrgency
    priority: number
    rank: number | null
    startsAt: Date | null
    dueAt: Date | null
    snoozedUntil: Date | null
    assigneeUserId: string | null
    ownerUserId: string | null
    metadata: Record<string, unknown>
  }>
}) {
  const existing = await db.query.workItems.findFirst({
    where: and(eq(workItems.bizId, input.bizId), eq(workItems.id, input.workItemId)),
  })
  if (!existing) return null

  const patch = input.patch
  const nextStatus = patch.status ?? existing.status
  const nextPriority = patch.priority ?? existing.priority
  const nextUrgency = patch.urgency ?? existing.urgency
  const nextAssignee = patch.assigneeUserId === undefined ? existing.assigneeUserId : patch.assigneeUserId

  const [updated] = await db
    .update(workItems)
    .set({
      title: patch.title ? sanitizePlainText(patch.title) : existing.title,
      summary:
        patch.summary === undefined
          ? existing.summary
          : patch.summary === null
            ? null
            : sanitizePlainText(patch.summary),
      status: nextStatus,
      urgency: nextUrgency,
      priority: nextPriority,
      rank: patch.rank === undefined ? existing.rank : patch.rank,
      startsAt: patch.startsAt === undefined ? existing.startsAt : patch.startsAt,
      dueAt: patch.dueAt === undefined ? existing.dueAt : patch.dueAt,
      snoozedUntil:
        patch.snoozedUntil === undefined ? existing.snoozedUntil : patch.snoozedUntil,
      assigneeUserId: nextAssignee,
      ownerUserId: patch.ownerUserId === undefined ? existing.ownerUserId : patch.ownerUserId,
      completedAt:
        nextStatus === 'done' || nextStatus === 'cancelled'
          ? existing.completedAt ?? new Date()
          : nextStatus === 'open' && existing.completedAt
            ? null
            : existing.completedAt,
      lastActivityAt: new Date(),
      metadata:
        patch.metadata === undefined
          ? existing.metadata
          : (sanitizeUnknown({
              ...(safeRecord(existing.metadata)),
              ...(safeRecord(patch.metadata)),
            }) as Record<string, unknown>),
      updatedAt: new Date(),
      updatedBy: input.actorUserId ?? null,
    })
    .where(eq(workItems.id, existing.id))
    .returning()

  if (existing.status !== updated.status) {
    await recordWorkItemEvent({
      bizId: input.bizId,
      workItemId: updated.id,
      eventType: deriveStatusEventType(existing.status, updated.status),
      actorUserId: input.actorUserId,
      fromStatus: existing.status,
      toStatus: updated.status,
    })
  }
  if (existing.priority !== updated.priority) {
    await recordWorkItemEvent({
      bizId: input.bizId,
      workItemId: updated.id,
      eventType: 'priority_changed',
      actorUserId: input.actorUserId,
      note: `Priority ${existing.priority} -> ${updated.priority}`,
      payload: { fromPriority: existing.priority, toPriority: updated.priority },
    })
  }
  if (existing.urgency !== updated.urgency) {
    await recordWorkItemEvent({
      bizId: input.bizId,
      workItemId: updated.id,
      eventType: 'urgency_changed',
      actorUserId: input.actorUserId,
      note: `Urgency ${existing.urgency} -> ${updated.urgency}`,
      payload: { fromUrgency: existing.urgency, toUrgency: updated.urgency },
    })
  }
  if ((existing.assigneeUserId ?? null) !== (updated.assigneeUserId ?? null)) {
    await recordWorkItemEvent({
      bizId: input.bizId,
      workItemId: updated.id,
      eventType: updated.assigneeUserId ? 'assigned' : 'unassigned',
      actorUserId: input.actorUserId,
      payload: {
        fromAssigneeUserId: existing.assigneeUserId,
        toAssigneeUserId: updated.assigneeUserId,
      },
    })
  }

  return updated
}

export function buildCommandPayload(input: {
  commandDefaultPayload: unknown
  runtimePayload?: Record<string, unknown>
  workItemId?: string | null
}) {
  const defaultPayload = safeRecord(input.commandDefaultPayload)
  const runtimePayload = safeRecord(input.runtimePayload)

  const merged = {
    ...defaultPayload,
    ...runtimePayload,
  } as Record<string, unknown>

  if (merged.patch && typeof merged.patch === 'object' && !Array.isArray(merged.patch)) {
    merged.patch = {
      ...(safeRecord(defaultPayload.patch)),
      ...(safeRecord(runtimePayload.patch)),
    }
  }

  if ((merged.operation === 'update' || merged.operation === 'delete') && input.workItemId) {
    merged.id = input.workItemId
  }

  return sanitizeUnknown(merged) as Record<string, unknown>
}
