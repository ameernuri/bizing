import { and, eq } from 'drizzle-orm'
import dbPackage from '@bizing/db'
import { sanitizeUnknown } from '../lib/sanitize.js'

const {
  db,
  reviewQueues,
  reviewQueueItems,
  workflowInstances,
  workflowSteps,
  workflowDefinitions,
  workflowDefinitionVersions,
  automationHookBindings,
  automationHookRuns,
} = dbPackage

export type AutomationWorkflowSignal = {
  workflowKey?: string | null
  queueSlug?: string | null
  queueName?: string | null
  priority?: number | null
  riskScore?: number | null
  reason?: string | null
  metadata?: Record<string, unknown>
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>
  return {}
}

function clampInt(value: unknown, fallback: number, min: number, max: number) {
  const numeric = typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : fallback
  return Math.max(min, Math.min(max, numeric))
}

type WorkflowStepStatus = 'pending' | 'running' | 'blocked' | 'completed' | 'failed' | 'skipped'

type NormalizedWorkflowStep = {
  stepKey: string
  name: string
  sequence: number
  status: WorkflowStepStatus
  dueInMinutes: number | null
  inputPayload: Record<string, unknown>
  metadata: Record<string, unknown>
}

function coerceStepStatus(value: unknown): WorkflowStepStatus {
  switch (value) {
    case 'running':
    case 'blocked':
    case 'completed':
    case 'failed':
    case 'skipped':
      return value
    default:
      return 'pending'
  }
}

function normalizeStepPlan(stepPlan: unknown): NormalizedWorkflowStep[] {
  if (!Array.isArray(stepPlan)) {
    return [
      {
        stepKey: 'review',
        name: 'Manual review',
        sequence: 0,
        status: 'pending',
        dueInMinutes: null,
        inputPayload: {},
        metadata: {},
      },
    ]
  }
  const rows: NormalizedWorkflowStep[] = []
  let fallbackSequence = 0
  for (const raw of stepPlan) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue
    const row = raw as Record<string, unknown>
    const sequence = typeof row.sequence === 'number' && Number.isFinite(row.sequence)
      ? Math.max(0, Math.floor(row.sequence))
      : fallbackSequence
    fallbackSequence = sequence + 1
    rows.push({
      stepKey:
        typeof row.stepKey === 'string' && row.stepKey.trim().length > 0
          ? row.stepKey.trim()
          : `step_${sequence}`,
      name:
        typeof row.name === 'string' && row.name.trim().length > 0
          ? row.name.trim()
          : `Step ${sequence + 1}`,
      sequence,
      status: coerceStepStatus(row.status),
      dueInMinutes:
        typeof row.dueInMinutes === 'number' && Number.isFinite(row.dueInMinutes)
          ? Math.max(0, Math.floor(row.dueInMinutes))
          : null,
      inputPayload: sanitizeUnknown(asRecord(row.inputPayload)) as Record<string, unknown>,
      metadata: sanitizeUnknown(asRecord(row.metadata)) as Record<string, unknown>,
    })
  }
  if (rows.length === 0) {
    return [
      {
        stepKey: 'review',
        name: 'Manual review',
        sequence: 0,
        status: 'pending',
        dueInMinutes: null,
        inputPayload: {},
        metadata: {},
      },
    ]
  }
  rows.sort((a, b) => a.sequence - b.sequence || a.stepKey.localeCompare(b.stepKey))
  return rows
}

async function ensureReviewQueue(input: {
  tx: typeof db
  bizId: string
  slug: string
  name: string
}) {
  const existing = await input.tx.query.reviewQueues.findFirst({
    where: and(eq(reviewQueues.bizId, input.bizId), eq(reviewQueues.slug, input.slug)),
  })
  if (existing) return existing
  const [created] = await input.tx
    .insert(reviewQueues)
    .values({
      bizId: input.bizId,
      name: input.name,
      slug: input.slug,
      type: 'risk',
      status: 'active',
      policy: {},
      metadata: {
        source: 'automation-hook-workflows',
      },
    })
    .returning()
  return created
}

export async function materializeAutomationWorkflowSignals(input: {
  tx: typeof db
  bizId: string
  targetType: string
  targetRefId: string
  binding: typeof automationHookBindings.$inferSelect
  run: typeof automationHookRuns.$inferSelect
  signals: AutomationWorkflowSignal[]
}) {
  const createdReviewItems: Array<{ id: string }> = []
  const createdWorkflowInstances: Array<{ id: string; workflowKey: string }> = []

  for (const signal of input.signals) {
    const queueSlug =
      signal.queueSlug && signal.queueSlug.trim().length > 0
        ? signal.queueSlug.trim()
        : 'automation-risk-review'
    const queueName =
      signal.queueName && signal.queueName.trim().length > 0
        ? signal.queueName.trim()
        : 'Automation Risk Review'
    const queue = await ensureReviewQueue({
      tx: input.tx,
      bizId: input.bizId,
      slug: queueSlug,
      name: queueName,
    })
    const [reviewItem] = await input.tx
      .insert(reviewQueueItems)
      .values({
        bizId: input.bizId,
        reviewQueueId: queue.id,
        status: 'pending',
        itemType: input.targetType,
        itemRefId: input.targetRefId,
        priority: clampInt(signal.priority, 100, 0, 100000),
        riskScore: clampInt(signal.riskScore, 70, 0, 100),
        resolutionPayload: {},
        metadata: sanitizeUnknown({
          source: 'automation-hook-workflows',
          bindingId: input.binding.id,
          hookRunId: input.run.id,
          reason: signal.reason ?? null,
          ...(signal.metadata ?? {}),
        }),
      })
      .returning()

    createdReviewItems.push({ id: reviewItem.id })

    const workflowKey =
      (signal.workflowKey && signal.workflowKey.trim().length > 0
        ? signal.workflowKey.trim()
        : null) ??
      input.binding.workflowKey ??
      'automation_hook_review_v1'

    const definition = await input.tx.query.workflowDefinitions.findFirst({
      where: and(
        eq(workflowDefinitions.bizId, input.bizId),
        eq(workflowDefinitions.key, workflowKey),
        eq(workflowDefinitions.status, 'active'),
      ),
    })
    const definitionVersionNumber = definition ? Math.max(1, definition.currentVersion ?? 1) : null
    const definitionVersion = definition
      ? await input.tx.query.workflowDefinitionVersions.findFirst({
          where: and(
            eq(workflowDefinitionVersions.bizId, input.bizId),
            eq(workflowDefinitionVersions.workflowDefinitionId, definition.id),
            eq(workflowDefinitionVersions.version, definitionVersionNumber ?? 1),
          ),
        })
      : null
    const stepPlan = normalizeStepPlan(definitionVersion?.stepPlan ?? null)

    const [instance] = await input.tx
      .insert(workflowInstances)
      .values({
        bizId: input.bizId,
        workflowKey,
        workflowDefinitionId: definition?.id ?? null,
        workflowDefinitionVersion: definitionVersion?.version ?? null,
        triggerType: 'policy',
        status: 'pending',
        targetType: input.targetType,
        targetRefId: input.targetRefId,
        reviewQueueItemId: reviewItem.id,
        startedAt: new Date(),
        currentStepKey: stepPlan[0]?.stepKey ?? null,
        inputPayload: sanitizeUnknown({
          source: 'automation-hook-workflows',
          bindingId: input.binding.id,
          hookRunId: input.run.id,
          queueId: queue.id,
          reason: signal.reason ?? null,
          ...(signal.metadata ?? {}),
        }),
        outputPayload: {},
        metadata: sanitizeUnknown({
          source: 'automation-hook-workflows',
          hookRunId: input.run.id,
        }),
      })
      .returning()

    createdWorkflowInstances.push({ id: instance.id, workflowKey: instance.workflowKey })
    const nowMs = Date.now()
    await input.tx.insert(workflowSteps).values(
      stepPlan.map((step) => ({
        bizId: input.bizId,
        workflowInstanceId: instance.id,
        stepKey: step.stepKey,
        name: step.name,
        sequence: step.sequence,
        status: step.status,
        assignedToUserId: null,
        startedAt: null,
        completedAt: null,
        dueAt: step.dueInMinutes == null ? null : new Date(nowMs + step.dueInMinutes * 60 * 1000),
        inputPayload: sanitizeUnknown(step.inputPayload) as Record<string, unknown>,
        outputPayload: {},
        metadata: sanitizeUnknown({
          source: 'automation-hook-workflows',
          hookRunId: input.run.id,
          ...(step.metadata ?? {}),
        }) as Record<string, unknown>,
      })),
    )
  }

  return {
    createdReviewItems,
    createdWorkflowInstances,
  }
}

export function coerceWorkflowSignals(value: unknown): AutomationWorkflowSignal[] {
  if (!Array.isArray(value)) return []
  return value
    .map((entry) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null
      const row = entry as Record<string, unknown>
      return {
        workflowKey: typeof row.workflowKey === 'string' ? row.workflowKey : null,
        queueSlug: typeof row.queueSlug === 'string' ? row.queueSlug : null,
        queueName: typeof row.queueName === 'string' ? row.queueName : null,
        priority: typeof row.priority === 'number' && Number.isFinite(row.priority) ? Math.floor(row.priority) : null,
        riskScore: typeof row.riskScore === 'number' && Number.isFinite(row.riskScore) ? Math.floor(row.riskScore) : null,
        reason: typeof row.reason === 'string' ? row.reason : null,
        metadata: asRecord(row.metadata),
      } satisfies AutomationWorkflowSignal
    })
    .filter(Boolean) as AutomationWorkflowSignal[]
}
