import { sanitizeUnknown } from '../lib/sanitize.js'
import type { AutomationWorkflowSignal } from './automation-hook-workflows.js'
import { coerceWorkflowSignals } from './automation-hook-workflows.js'

type HandlerCatalogEntry = {
  handlerKey: string
  kind: 'workflow' | 'pricing' | 'utility'
  description: string
  configurationShape: Record<string, string>
}

export const AUTOMATION_INTERNAL_HANDLER_CATALOG: HandlerCatalogEntry[] = [
  {
    handlerKey: 'workflow.risk_threshold',
    kind: 'workflow',
    description: 'Emit a workflow/review signal when a numeric metric crosses a threshold.',
    configurationShape: {
      metricPath: 'JSON path in input payload (default: totalMinor)',
      thresholdMinor: 'numeric threshold',
      comparator: 'gte|gt|lte|lt|eq (default: gte)',
      queueSlug: 'optional review queue slug',
      queueName: 'optional review queue name',
      workflowKey: 'optional workflow key override',
      priority: 'optional review queue priority',
      riskScore: 'optional risk score',
    },
  },
  {
    handlerKey: 'workflow.enqueue_review',
    kind: 'workflow',
    description: 'Always emit one workflow/review signal for the target.',
    configurationShape: {
      queueSlug: 'optional review queue slug',
      queueName: 'optional review queue name',
      workflowKey: 'optional workflow key override',
      priority: 'optional review queue priority',
      riskScore: 'optional risk score',
      reason: 'optional reviewer message',
    },
  },
  {
    handlerKey: 'workflow.noop',
    kind: 'utility',
    description: 'No-op handler used for staged rollout/testing.',
    configurationShape: {},
  },
]

export type GenericAutomationHookExecutionResult = {
  skipped: boolean
  workflowSignals: AutomationWorkflowSignal[]
  outputPayload: Record<string, unknown>
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>
  return {}
}

function valueByPath(input: Record<string, unknown>, path: string) {
  const normalized = path.trim()
  if (!normalized) return undefined
  const parts = normalized.split('.').filter(Boolean)
  let cursor: unknown = input
  for (const part of parts) {
    if (!cursor || typeof cursor !== 'object' || Array.isArray(cursor)) return undefined
    cursor = (cursor as Record<string, unknown>)[part]
  }
  return cursor
}

function toComparableNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return fallback
}

function compareMetric(metric: number, threshold: number, comparator: string) {
  switch (comparator) {
    case 'gt':
      return metric > threshold
    case 'gte':
      return metric >= threshold
    case 'lt':
      return metric < threshold
    case 'lte':
      return metric <= threshold
    case 'eq':
      return metric === threshold
    default:
      return metric >= threshold
  }
}

export function coerceGenericAutomationHookResult(value: unknown): GenericAutomationHookExecutionResult {
  const row = asRecord(value)
  const workflowSignals = coerceWorkflowSignals(row.workflowSignals)
  const skipped = row.skipped === true || workflowSignals.length === 0
  return {
    skipped,
    workflowSignals,
    outputPayload: sanitizeUnknown(asRecord(row.outputPayload)) as Record<string, unknown>,
  }
}

export function executeAutomationInternalHandler(input: {
  handlerKey: string
  hookPoint: string
  targetType: string
  targetRefId: string
  configuration: Record<string, unknown>
  inputPayload: Record<string, unknown>
}): GenericAutomationHookExecutionResult {
  if (input.handlerKey === 'workflow.noop') {
    return {
      skipped: true,
      workflowSignals: [],
      outputPayload: {
        handlerKey: input.handlerKey,
        skipped: true,
      },
    }
  }

  if (input.handlerKey === 'workflow.enqueue_review') {
    const signal: AutomationWorkflowSignal = {
      workflowKey:
        typeof input.configuration.workflowKey === 'string' ? input.configuration.workflowKey : null,
      queueSlug:
        typeof input.configuration.queueSlug === 'string'
          ? input.configuration.queueSlug
          : 'automation-review',
      queueName:
        typeof input.configuration.queueName === 'string'
          ? input.configuration.queueName
          : 'Automation Review',
      priority: toComparableNumber(input.configuration.priority, 100),
      riskScore: toComparableNumber(input.configuration.riskScore, 70),
      reason:
        typeof input.configuration.reason === 'string'
          ? input.configuration.reason
          : `Automation handler ${input.handlerKey} emitted review signal.`,
      metadata: {
        hookPoint: input.hookPoint,
        targetType: input.targetType,
        targetRefId: input.targetRefId,
      },
    }
    return {
      skipped: false,
      workflowSignals: [signal],
      outputPayload: {
        handlerKey: input.handlerKey,
        emittedSignals: 1,
      },
    }
  }

  if (input.handlerKey === 'workflow.risk_threshold') {
    const metricPath =
      typeof input.configuration.metricPath === 'string' && input.configuration.metricPath.trim().length > 0
        ? input.configuration.metricPath
        : 'totalMinor'
    const threshold = toComparableNumber(input.configuration.thresholdMinor, 0)
    const comparator =
      typeof input.configuration.comparator === 'string' ? input.configuration.comparator : 'gte'
    const metric = toComparableNumber(valueByPath(input.inputPayload, metricPath), 0)
    const triggered = compareMetric(metric, threshold, comparator)
    if (!triggered) {
      return {
        skipped: true,
        workflowSignals: [],
        outputPayload: {
          handlerKey: input.handlerKey,
          triggered: false,
          metricPath,
          comparator,
          threshold,
          metric,
        },
      }
    }
    const signal: AutomationWorkflowSignal = {
      workflowKey:
        typeof input.configuration.workflowKey === 'string' ? input.configuration.workflowKey : null,
      queueSlug:
        typeof input.configuration.queueSlug === 'string'
          ? input.configuration.queueSlug
          : 'automation-risk-review',
      queueName:
        typeof input.configuration.queueName === 'string'
          ? input.configuration.queueName
          : 'Automation Risk Review',
      priority: toComparableNumber(input.configuration.priority, 100),
      riskScore: toComparableNumber(input.configuration.riskScore, 80),
      reason:
        typeof input.configuration.reason === 'string'
          ? input.configuration.reason
          : `Risk threshold triggered at ${metricPath}: ${metric} ${comparator} ${threshold}`,
      metadata: {
        hookPoint: input.hookPoint,
        metricPath,
        comparator,
        threshold,
        metric,
        targetType: input.targetType,
        targetRefId: input.targetRefId,
      },
    }
    return {
      skipped: false,
      workflowSignals: [signal],
      outputPayload: {
        handlerKey: input.handlerKey,
        triggered: true,
        metricPath,
        comparator,
        threshold,
        metric,
        emittedSignals: 1,
      },
    }
  }

  throw new Error(`Unknown internal handler key: ${input.handlerKey}`)
}
