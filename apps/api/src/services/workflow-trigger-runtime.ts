import { and, asc, eq, inArray } from 'drizzle-orm'
import dbPackage from '@bizing/db'
import { sanitizeUnknown } from '../lib/sanitize.js'

const {
  db,
  workflowDefinitions,
  workflowDefinitionVersions,
  workflowDefinitionTriggers,
  workflowTriggerInvocations,
  workflowInstances,
  workflowSteps,
} = dbPackage

type WorkflowTriggerSource =
  | 'lifecycle_hook_invocation'
  | 'lifecycle_hook_effect'
  | 'domain_event'
  | 'action_request'
  | 'manual'
  | 'schedule'
  | 'system'

type WorkflowTriggerInstanceType = 'manual' | 'policy' | 'webhook' | 'schedule' | 'system_event'

type WorkflowStepStatus = 'pending' | 'running' | 'blocked' | 'completed' | 'failed' | 'skipped'

type StepPlanItem = {
  stepKey: string
  name: string
  sequence: number
  status: WorkflowStepStatus
  dueInMinutes: number | null
  inputPayload: Record<string, unknown>
  metadata: Record<string, unknown>
}

export type DispatchWorkflowTriggersInput = {
  tx: typeof db
  bizId: string
  triggerSource: WorkflowTriggerSource
  triggerRefId: string
  targetType: string
  targetRefId: string
  lifecycleHookContractKey?: string | null
  lifecycleHookInvocationStatus?: 'running' | 'succeeded' | 'failed' | 'skipped' | null
  lifecycleHookEffectType?: string | null
  domainEventKey?: string | null
  actionKey?: string | null
  inputPayload?: Record<string, unknown>
  metadata?: Record<string, unknown>
}

export type DispatchWorkflowTriggersResult = {
  matchedTriggers: number
  launchedCount: number
  reusedCount: number
  skippedCount: number
  invocations: Array<typeof workflowTriggerInvocations.$inferSelect>
  workflowInstances: Array<{ id: string; workflowKey: string; workflowDefinitionId: string; workflowDefinitionVersion: number }>
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>
  return {}
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function wildcardMatch(pattern: string, value: string) {
  const normalizedPattern = pattern.trim()
  if (!normalizedPattern) return false
  const source = `^${normalizedPattern.split('*').map(escapeRegex).join('.*')}$`
  const regex = new RegExp(source, 'i')
  return regex.test(value)
}

function toTriggerType(source: WorkflowTriggerSource): WorkflowTriggerInstanceType {
  if (source === 'manual') return 'manual'
  if (source === 'schedule') return 'schedule'
  if (source === 'system') return 'system_event'
  return 'policy'
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

function normalizeStepPlan(stepPlan: unknown): StepPlanItem[] {
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

  const rows: StepPlanItem[] = []
  let fallbackSequence = 0
  for (const raw of stepPlan) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue
    const row = raw as Record<string, unknown>
    const sequenceRaw = typeof row.sequence === 'number' && Number.isFinite(row.sequence)
      ? Math.max(0, Math.floor(row.sequence))
      : fallbackSequence
    fallbackSequence = sequenceRaw + 1
    rows.push({
      stepKey:
        typeof row.stepKey === 'string' && row.stepKey.trim().length > 0
          ? row.stepKey.trim()
          : `step_${sequenceRaw}`,
      name:
        typeof row.name === 'string' && row.name.trim().length > 0
          ? row.name.trim()
          : `Step ${sequenceRaw + 1}`,
      sequence: sequenceRaw,
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

function selectorMatches(input: {
  trigger: typeof workflowDefinitionTriggers.$inferSelect
  dispatch: DispatchWorkflowTriggersInput
}) {
  const { trigger, dispatch } = input

  if (trigger.targetType && trigger.targetType !== dispatch.targetType) return false

  if (trigger.triggerSource !== dispatch.triggerSource) return false

  if (trigger.triggerSource === 'lifecycle_hook_invocation') {
    if (!dispatch.lifecycleHookContractKey) return false
    if (trigger.lifecycleHookContractKey !== dispatch.lifecycleHookContractKey) return false
    if (
      trigger.lifecycleHookInvocationStatus &&
      trigger.lifecycleHookInvocationStatus !== dispatch.lifecycleHookInvocationStatus
    ) {
      return false
    }
    return true
  }

  if (trigger.triggerSource === 'lifecycle_hook_effect') {
    if (trigger.lifecycleHookContractKey && trigger.lifecycleHookContractKey !== dispatch.lifecycleHookContractKey) {
      return false
    }
    if (trigger.lifecycleHookEffectType && trigger.lifecycleHookEffectType !== dispatch.lifecycleHookEffectType) {
      return false
    }
    return Boolean(trigger.lifecycleHookContractKey || trigger.lifecycleHookEffectType)
  }

  if (trigger.triggerSource === 'domain_event') {
    if (!dispatch.domainEventKey || !trigger.domainEventPattern) return false
    return wildcardMatch(trigger.domainEventPattern, dispatch.domainEventKey)
  }

  if (trigger.triggerSource === 'action_request') {
    if (!dispatch.actionKey || !trigger.actionKey) return false
    return trigger.actionKey === dispatch.actionKey
  }

  return true
}

function computeIdempotencyKey(input: {
  trigger: typeof workflowDefinitionTriggers.$inferSelect
  dispatch: DispatchWorkflowTriggersInput
}) {
  const mode = input.trigger.idempotencyMode
  if (mode === 'none') return null
  if (mode === 'trigger') {
    return `${input.trigger.id}:${input.dispatch.triggerRefId}`
  }
  return `${input.trigger.id}:${input.dispatch.triggerRefId}:${input.dispatch.targetType}:${input.dispatch.targetRefId}`
}

export async function dispatchWorkflowTriggers(
  input: DispatchWorkflowTriggersInput,
): Promise<DispatchWorkflowTriggersResult> {
  const triggers = await input.tx.query.workflowDefinitionTriggers.findMany({
    where: and(
      eq(workflowDefinitionTriggers.bizId, input.bizId),
      eq(workflowDefinitionTriggers.status, 'active'),
      eq(workflowDefinitionTriggers.triggerSource, input.triggerSource),
    ),
    orderBy: [asc(workflowDefinitionTriggers.priority), asc(workflowDefinitionTriggers.id)],
  })

  const candidateTriggers = triggers.filter((trigger) => selectorMatches({ trigger, dispatch: input }))
  const invocations: Array<typeof workflowTriggerInvocations.$inferSelect> = []
  const launched: Array<{ id: string; workflowKey: string; workflowDefinitionId: string; workflowDefinitionVersion: number }> = []
  let reusedCount = 0
  let skippedCount = triggers.length - candidateTriggers.length

  if (candidateTriggers.length === 0) {
    return {
      matchedTriggers: 0,
      launchedCount: 0,
      reusedCount: 0,
      skippedCount,
      invocations: [],
      workflowInstances: [],
    }
  }

  const definitionIds = Array.from(new Set(candidateTriggers.map((trigger) => trigger.workflowDefinitionId)))
  const definitions = definitionIds.length
    ? await input.tx.query.workflowDefinitions.findMany({
        where: and(
          eq(workflowDefinitions.bizId, input.bizId),
          inArray(workflowDefinitions.id, definitionIds),
          eq(workflowDefinitions.status, 'active'),
        ),
      })
    : []
  const definitionById = new Map(definitions.map((row) => [row.id, row]))

  const requestedVersionByTriggerId = new Map<string, number>()
  for (const trigger of candidateTriggers) {
    const definition = definitionById.get(trigger.workflowDefinitionId)
    if (!definition) continue
    requestedVersionByTriggerId.set(
      trigger.id,
      Math.max(1, Math.floor(trigger.workflowDefinitionVersion ?? definition.currentVersion ?? 1)),
    )
  }

  const versionDefinitionIds = Array.from(new Set(candidateTriggers.map((trigger) => trigger.workflowDefinitionId)))
  const versionNumbers = Array.from(new Set(Array.from(requestedVersionByTriggerId.values())))
  const definitionVersions =
    versionDefinitionIds.length && versionNumbers.length
      ? await input.tx.query.workflowDefinitionVersions.findMany({
          where: and(
            eq(workflowDefinitionVersions.bizId, input.bizId),
            inArray(workflowDefinitionVersions.workflowDefinitionId, versionDefinitionIds),
            inArray(workflowDefinitionVersions.version, versionNumbers),
          ),
        })
      : []
  const definitionVersionByKey = new Map(
    definitionVersions.map((row) => [`${row.workflowDefinitionId}:${row.version}`, row]),
  )

  const idempotencyByTriggerId = new Map<string, string | null>()
  const idempotencyKeys: string[] = []
  for (const trigger of candidateTriggers) {
    const key = computeIdempotencyKey({ trigger, dispatch: input })
    idempotencyByTriggerId.set(trigger.id, key)
    if (key) idempotencyKeys.push(key)
  }
  const existingInvocations = idempotencyKeys.length
    ? await input.tx.query.workflowTriggerInvocations.findMany({
        where: and(
          eq(workflowTriggerInvocations.bizId, input.bizId),
          inArray(workflowTriggerInvocations.idempotencyKey, idempotencyKeys),
        ),
      })
    : []
  const existingInvocationByIdempotency = new Map(
    existingInvocations
      .filter((row): row is typeof row & { idempotencyKey: string } => typeof row.idempotencyKey === 'string')
      .map((row) => [row.idempotencyKey, row]),
  )

  for (const trigger of candidateTriggers) {
    const definition = definitionById.get(trigger.workflowDefinitionId)
    if (!definition) {
      skippedCount += 1
      continue
    }

    const idempotencyKey = idempotencyByTriggerId.get(trigger.id) ?? null
    if (idempotencyKey) {
      const existing = existingInvocationByIdempotency.get(idempotencyKey)
      if (existing) {
        invocations.push(existing)
        reusedCount += 1
        continue
      }
    }

    const requestedVersion = requestedVersionByTriggerId.get(trigger.id)
    const version =
      typeof requestedVersion === 'number'
        ? definitionVersionByKey.get(`${trigger.workflowDefinitionId}:${requestedVersion}`) ?? null
        : null
    if (!version) {
      skippedCount += 1
      continue
    }

    const [invocation] = await input.tx
      .insert(workflowTriggerInvocations)
      .values({
        bizId: input.bizId,
        workflowDefinitionTriggerId: trigger.id,
        workflowDefinitionId: definition.id,
        workflowDefinitionVersion: version.version,
        triggerSource: input.triggerSource,
        triggerRefId: input.triggerRefId,
        targetType: input.targetType,
        targetRefId: input.targetRefId,
        idempotencyKey,
        status: 'running',
        inputPayload: sanitizeUnknown({
          trigger: {
            triggerId: trigger.id,
            triggerSource: trigger.triggerSource,
            triggerRefId: input.triggerRefId,
          },
          selectors: {
            lifecycleHookContractKey: input.lifecycleHookContractKey ?? null,
            lifecycleHookInvocationStatus: input.lifecycleHookInvocationStatus ?? null,
            lifecycleHookEffectType: input.lifecycleHookEffectType ?? null,
            domainEventKey: input.domainEventKey ?? null,
            actionKey: input.actionKey ?? null,
          },
          inputPayload: input.inputPayload ?? {},
        }) as Record<string, unknown>,
        outputPayload: {},
        metadata: sanitizeUnknown({
          source: 'workflow-trigger-runtime',
          ...(input.metadata ?? {}),
        }) as Record<string, unknown>,
      })
      .returning()

    try {
      const stepPlan = normalizeStepPlan(version.stepPlan)
      const [instance] = await input.tx
        .insert(workflowInstances)
        .values({
          bizId: input.bizId,
          workflowKey: definition.key,
          workflowDefinitionId: definition.id,
          workflowDefinitionVersion: version.version,
          triggerType: toTriggerType(input.triggerSource),
          actionRequestId: input.triggerSource === 'action_request' ? input.triggerRefId : null,
          triggeringDomainEventId: input.triggerSource === 'domain_event' ? input.triggerRefId : null,
          status: 'pending',
          targetType: input.targetType,
          targetRefId: input.targetRefId,
          startedAt: new Date(),
          completedAt: null,
          currentStepKey: stepPlan[0]?.stepKey ?? null,
          errorCode: null,
          inputPayload: sanitizeUnknown({
            triggerInvocationId: invocation.id,
            triggerId: trigger.id,
            triggerSource: trigger.triggerSource,
            triggerRefId: input.triggerRefId,
            targetType: input.targetType,
            targetRefId: input.targetRefId,
            payload: input.inputPayload ?? {},
          }) as Record<string, unknown>,
          outputPayload: {},
          metadata: sanitizeUnknown({
            source: 'workflow-trigger-runtime',
            triggerInvocationId: invocation.id,
            triggerId: trigger.id,
            ...(input.metadata ?? {}),
          }) as Record<string, unknown>,
        })
        .returning()

      if (stepPlan.length > 0) {
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
              source: 'workflow-trigger-runtime',
              triggerInvocationId: invocation.id,
              ...(step.metadata ?? {}),
            }) as Record<string, unknown>,
          })),
        )
      }

      const [updatedInvocation] = await input.tx
        .update(workflowTriggerInvocations)
        .set({
          workflowInstanceId: instance.id,
          status: 'succeeded',
          completedAt: new Date(),
          durationMs: Math.max(0, Date.now() - invocation.startedAt.getTime()),
          outputPayload: sanitizeUnknown({
            workflowInstanceId: instance.id,
            workflowKey: instance.workflowKey,
            stepCount: stepPlan.length,
          }) as Record<string, unknown>,
          errorCode: null,
          errorMessage: null,
        })
        .where(
          and(
            eq(workflowTriggerInvocations.bizId, input.bizId),
            eq(workflowTriggerInvocations.id, invocation.id),
          ),
        )
        .returning()

      invocations.push(updatedInvocation)
      launched.push({
        id: instance.id,
        workflowKey: instance.workflowKey,
        workflowDefinitionId: definition.id,
        workflowDefinitionVersion: version.version,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const [failedInvocation] = await input.tx
        .update(workflowTriggerInvocations)
        .set({
          status: 'failed',
          completedAt: new Date(),
          durationMs: Math.max(0, Date.now() - invocation.startedAt.getTime()),
          outputPayload: sanitizeUnknown({ error: message }) as Record<string, unknown>,
          errorCode: 'WORKFLOW_TRIGGER_FAILED',
          errorMessage: message,
        })
        .where(
          and(
            eq(workflowTriggerInvocations.bizId, input.bizId),
            eq(workflowTriggerInvocations.id, invocation.id),
          ),
        )
        .returning()
      invocations.push(failedInvocation)
    }
  }

  return {
    matchedTriggers: candidateTriggers.length,
    launchedCount: launched.length,
    reusedCount,
    skippedCount,
    invocations,
    workflowInstances: launched,
  }
}
