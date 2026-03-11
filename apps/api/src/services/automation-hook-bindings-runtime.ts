import dbPackage from '@bizing/db'
import { sanitizeUnknown } from '../lib/sanitize.js'
import {
  coerceGenericAutomationHookResult,
  executeAutomationInternalHandler,
} from './automation-hook-internal-handlers.js'
import {
  materializeAutomationWorkflowSignals,
  type AutomationWorkflowSignal,
} from './automation-hook-workflows.js'

const { db, automationHookBindings, automationHookRuns } = dbPackage

export type GenericAutomationHookExecutionResult = {
  skipped: boolean
  workflowSignals: AutomationWorkflowSignal[]
  outputPayload: Record<string, unknown>
}

export type GenericLifecycleEffectDraft = {
  effectType: string
  status?: 'planned' | 'applied' | 'failed' | 'skipped'
  payload?: Record<string, unknown>
  outputPayload?: Record<string, unknown>
  errorCode?: string | null
  errorMessage?: string | null
  metadata?: Record<string, unknown>
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>
  return {}
}

async function executeAutomationHookWebhookBinding(input: {
  binding: typeof automationHookBindings.$inferSelect
  hookPoint: string
  targetType: string
  targetRefId: string
  inputPayload: Record<string, unknown>
}) {
  if (!input.binding.webhookUrl) {
    throw new Error('Webhook binding is missing webhookUrl.')
  }
  const timeoutMs = Math.max(100, Math.min(input.binding.timeoutMs ?? 5000, 300000))
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(input.binding.webhookUrl, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        'x-bizing-hook-point': input.hookPoint,
        'x-bizing-hook-binding-id': input.binding.id,
      },
      body: JSON.stringify({
        hookPoint: input.hookPoint,
        bindingId: input.binding.id,
        targetType: input.targetType,
        targetRefId: input.targetRefId,
        inputPayload: input.inputPayload,
        configuration: input.binding.configuration ?? {},
      }),
    })
    const bodyText = await response.text().catch(() => '')
    const parsed = bodyText.length > 0 ? (JSON.parse(bodyText) as unknown) : {}
    if (!response.ok) {
      throw new Error(`Hook webhook returned HTTP ${response.status}.`)
    }
    return parsed
  } finally {
    clearTimeout(timeout)
  }
}

export async function executeGenericAutomationHookBinding(input: {
  binding: typeof automationHookBindings.$inferSelect
  hookPoint: string
  targetType: string
  targetRefId: string
  inputPayload: Record<string, unknown>
}): Promise<GenericAutomationHookExecutionResult> {
  if (input.binding.deliveryMode === 'internal_handler') {
    if (!input.binding.internalHandlerKey) {
      throw new Error(`Binding ${input.binding.id} is missing internalHandlerKey.`)
    }
    const resolved = executeAutomationInternalHandler({
      handlerKey: input.binding.internalHandlerKey,
      hookPoint: input.hookPoint,
      targetType: input.targetType,
      targetRefId: input.targetRefId,
      configuration: sanitizeUnknown(asRecord(input.binding.configuration)) as Record<string, unknown>,
      inputPayload: sanitizeUnknown(input.inputPayload) as Record<string, unknown>,
    })
    return {
      skipped: resolved.skipped,
      workflowSignals: resolved.workflowSignals,
      outputPayload: sanitizeUnknown(resolved.outputPayload) as Record<string, unknown>,
    }
  }

  const webhookPayload = await executeAutomationHookWebhookBinding({
    binding: input.binding,
    hookPoint: input.hookPoint,
    targetType: input.targetType,
    targetRefId: input.targetRefId,
    inputPayload: input.inputPayload,
  })
  const resolved = coerceGenericAutomationHookResult(webhookPayload)
  return {
    skipped: resolved.skipped,
    workflowSignals: resolved.workflowSignals,
    outputPayload: sanitizeUnknown(resolved.outputPayload) as Record<string, unknown>,
  }
}

export function buildWorkflowSignalEffectDrafts(input: {
  bindingId: string
  runId: string
  signals: AutomationWorkflowSignal[]
}): GenericLifecycleEffectDraft[] {
  return input.signals.map((signal) => ({
    effectType: 'workflow.signal_emit',
    status: 'applied',
    payload: sanitizeUnknown({
      workflowKey: signal.workflowKey ?? null,
      queueSlug: signal.queueSlug ?? null,
      queueName: signal.queueName ?? null,
      priority: signal.priority ?? null,
      riskScore: signal.riskScore ?? null,
      reason: signal.reason ?? null,
      metadata: signal.metadata ?? {},
    }) as Record<string, unknown>,
    metadata: {
      bindingId: input.bindingId,
      runId: input.runId,
    },
  }))
}

export async function finalizeGenericAutomationHookBinding(input: {
  tx: typeof db
  bizId: string
  targetType: string
  targetRefId: string
  binding: typeof automationHookBindings.$inferSelect
  run: typeof automationHookRuns.$inferSelect
  executionResult: GenericAutomationHookExecutionResult
}) {
  const materialized = await materializeAutomationWorkflowSignals({
    tx: input.tx,
    bizId: input.bizId,
    targetType: input.targetType,
    targetRefId: input.targetRefId,
    binding: input.binding,
    run: input.run,
    signals: input.executionResult.workflowSignals,
  })
  return {
    status:
      input.executionResult.skipped || input.executionResult.workflowSignals.length === 0
        ? ('skipped' as const)
        : ('succeeded' as const),
    outputPayload: sanitizeUnknown({
      ...input.executionResult.outputPayload,
      workflowSignalCount: input.executionResult.workflowSignals.length,
      createdReviewItemIds: materialized.createdReviewItems.map((row) => row.id),
      createdWorkflowInstanceIds: materialized.createdWorkflowInstances.map((row) => row.id),
    }) as Record<string, unknown>,
    aggregate: materialized,
    effects: buildWorkflowSignalEffectDrafts({
      bindingId: input.binding.id,
      runId: input.run.id,
      signals: input.executionResult.workflowSignals,
    }),
  }
}
