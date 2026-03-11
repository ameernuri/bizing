import { and, asc, eq } from 'drizzle-orm'
import dbPackage from '@bizing/db'
import { sanitizeUnknown } from '../lib/sanitize.js'
import { executeAutomationHooks, type LifecycleEffectDraft } from './automation-hook-runtime.js'
import { executeAutomationInternalHandler } from './automation-hook-internal-handlers.js'
import {
  coerceWorkflowSignals,
  materializeAutomationWorkflowSignals,
  type AutomationWorkflowSignal,
} from './automation-hook-workflows.js'

const {
  db,
  checkoutSessions,
  checkoutSessionItems,
  automationHookBindings,
} = dbPackage

type PricingLineMutation = {
  sourceKey: string
  label: string
  amountMinor: number
  description?: string | null
  classification?: 'fee' | 'line'
  metadata?: Record<string, unknown>
}

type BindingExecutionResult = {
  lineMutations: PricingLineMutation[]
  workflowSignals: AutomationWorkflowSignal[]
  outputPayload: Record<string, unknown>
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>
  return {}
}

function toLineMutation(value: unknown): PricingLineMutation | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const row = value as Record<string, unknown>
  const sourceKey = typeof row.sourceKey === 'string' ? row.sourceKey.trim() : ''
  const label = typeof row.label === 'string' ? row.label.trim() : ''
  const amountMinor = typeof row.amountMinor === 'number' && Number.isFinite(row.amountMinor) ? Math.floor(row.amountMinor) : NaN
  if (!sourceKey || !label || !Number.isFinite(amountMinor) || amountMinor < 0) return null
  const classification =
    row.classification === 'line'
      ? 'line'
      : 'fee'
  return {
    sourceKey,
    label,
    amountMinor,
    classification,
    description: typeof row.description === 'string' ? row.description : null,
    metadata: asRecord(row.metadata),
  }
}

function summarizeCheckout(items: Array<typeof checkoutSessionItems.$inferSelect>) {
  return {
    subtotalMinor: items.reduce((sum, row) => sum + row.lineSubtotalMinor, 0),
    taxMinor: items.reduce((sum, row) => sum + row.taxMinor, 0),
    feeMinor: items.reduce((sum, row) => sum + row.feeMinor, 0),
    discountMinor: items.reduce((sum, row) => sum + row.discountMinor, 0),
    totalMinor: items.reduce((sum, row) => sum + row.totalMinor, 0),
  }
}

function computeBaseSubtotal(items: Array<typeof checkoutSessionItems.$inferSelect>) {
  return items
    .filter((row) => !(row.sourceKind === 'extension' && row.itemType === 'custom_fee'))
    .reduce((sum, row) => sum + row.lineSubtotalMinor, 0)
}

function buildInternalHandlerResult(input: {
  binding: typeof automationHookBindings.$inferSelect
  items: Array<typeof checkoutSessionItems.$inferSelect>
  checkoutSummary: ReturnType<typeof summarizeCheckout>
  checkoutSessionId: string
}): BindingExecutionResult {
  const config = asRecord(input.binding.configuration)
  const handlerKey = input.binding.internalHandlerKey ?? ''
  const baseSubtotalMinor = computeBaseSubtotal(input.items)

  if (handlerKey === 'pricing.api_fee_percent') {
    const percentRaw = config.percent ?? config.ratePercent
    const percent = typeof percentRaw === 'number' && Number.isFinite(percentRaw) ? percentRaw : 0
    const roundedPercent = Math.max(0, percent)
    const amountMinor = Math.max(0, Math.round((baseSubtotalMinor * roundedPercent) / 100))
    if (amountMinor <= 0) {
      return {
        lineMutations: [],
        workflowSignals: [],
        outputPayload: {
          skipped: true,
          reason: 'fee amount rounded to 0',
          handlerKey,
          baseSubtotalMinor,
          percent: roundedPercent,
        },
      }
    }
    const sourceKey = typeof config.sourceKey === 'string' && config.sourceKey.length > 0
      ? config.sourceKey
      : `api_fee_${roundedPercent.toString().replace('.', '_')}`
    const label = typeof config.label === 'string' && config.label.length > 0
      ? config.label
      : `API fee (${roundedPercent}%)`
    return {
      lineMutations: [
        {
          sourceKey,
          label,
          amountMinor,
          classification: 'fee',
          description:
            typeof config.description === 'string' && config.description.length > 0
              ? config.description
              : null,
          metadata: {
            baseSubtotalMinor,
            percent: roundedPercent,
          },
        },
      ],
      workflowSignals: [],
      outputPayload: {
        handlerKey,
        baseSubtotalMinor,
        percent: roundedPercent,
        amountMinor,
      },
    }
  }

  const generic = executeAutomationInternalHandler({
    handlerKey,
    hookPoint: input.binding.hookPoint,
    targetType: 'checkout_session',
    targetRefId: input.checkoutSessionId,
    configuration: config,
    inputPayload: {
      ...input.checkoutSummary,
      summary: input.checkoutSummary,
      totalMinor: input.checkoutSummary.totalMinor,
      itemCount: input.items.length,
    },
  })
  return {
    lineMutations: [],
    workflowSignals: generic.workflowSignals,
    outputPayload: generic.outputPayload,
  }
}

async function executeWebhookBinding(input: {
  binding: typeof automationHookBindings.$inferSelect
  checkoutSession: typeof checkoutSessions.$inferSelect
  items: Array<typeof checkoutSessionItems.$inferSelect>
  checkoutSummary: ReturnType<typeof summarizeCheckout>
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
        'x-bizing-hook-point': input.binding.hookPoint,
        'x-bizing-hook-binding-id': input.binding.id,
      },
      body: JSON.stringify({
        hookPoint: input.binding.hookPoint,
        bindingId: input.binding.id,
        checkoutSession: input.checkoutSession,
        items: input.items,
        summary: input.checkoutSummary,
        configuration: input.binding.configuration ?? {},
      }),
    })
    const bodyText = await response.text().catch(() => '')
    const parsed = bodyText.length > 0 ? JSON.parse(bodyText) as unknown : {}
    if (!response.ok) {
      throw new Error(`Hook webhook returned HTTP ${response.status}.`)
    }
    const payload = asRecord(parsed)
    const lineMutations = Array.isArray(payload.lineMutations)
      ? payload.lineMutations.map(toLineMutation).filter(Boolean) as PricingLineMutation[]
      : []
    const workflowSignals = coerceWorkflowSignals(payload.workflowSignals)
    return {
      lineMutations,
      workflowSignals,
      outputPayload: sanitizeUnknown({
        httpStatus: response.status,
        lineMutationCount: lineMutations.length,
        workflowSignalCount: workflowSignals.length,
        response: payload,
      }) as Record<string, unknown>,
    } satisfies BindingExecutionResult
  } finally {
    clearTimeout(timeout)
  }
}

async function applyLineMutations(input: {
  tx: typeof db
  bizId: string
  checkoutSession: typeof checkoutSessions.$inferSelect
  binding: typeof automationHookBindings.$inferSelect
  runId: string
  lineMutations: PricingLineMutation[]
}) {
  const seenKeys = new Set<string>()
  for (const mutation of input.lineMutations) {
    const sourceKey = mutation.sourceKey.trim()
    if (sourceKey.length === 0) continue
    seenKeys.add(sourceKey)
    const amountMinor = Math.max(0, mutation.amountMinor)
    const classification = mutation.classification ?? 'fee'
    const unitPriceMinor = classification === 'line' ? amountMinor : 0
    const lineSubtotalMinor = classification === 'line' ? amountMinor : 0
    const feeMinor = classification === 'fee' ? amountMinor : 0
    const totalMinor = lineSubtotalMinor + feeMinor

    const existing = await input.tx.query.checkoutSessionItems.findFirst({
      where: and(
        eq(checkoutSessionItems.bizId, input.bizId),
        eq(checkoutSessionItems.checkoutSessionId, input.checkoutSession.id),
        eq(checkoutSessionItems.sourceKind, 'extension'),
        eq(checkoutSessionItems.sourceRefId, input.binding.id),
        eq(checkoutSessionItems.sourceKey, sourceKey),
      ),
    })

    const basePayload = {
      displayName: mutation.label,
      description: mutation.description ?? null,
      quantity: 1,
      unitPriceMinor,
      lineSubtotalMinor,
      taxMinor: 0,
      feeMinor,
      discountMinor: 0,
      totalMinor,
      currency: input.checkoutSession.currency,
      metadata: sanitizeUnknown({
        source: 'checkout-automation-hooks',
        bindingId: input.binding.id,
        hookRunId: input.runId,
        mutationMetadata: mutation.metadata ?? {},
      }),
      sourceKind: 'extension' as const,
      sourceRefId: input.binding.id,
      sourceKey,
    }

    if (existing) {
      await input.tx
        .update(checkoutSessionItems)
        .set(basePayload)
        .where(and(eq(checkoutSessionItems.bizId, input.bizId), eq(checkoutSessionItems.id, existing.id)))
      continue
    }

    await input.tx.insert(checkoutSessionItems).values({
      bizId: input.bizId,
      checkoutSessionId: input.checkoutSession.id,
      itemType: 'custom_fee',
      sellableId: null,
      customSubjectType: null,
      customSubjectId: null,
      requestedStartAt: null,
      requestedEndAt: null,
      ...basePayload,
    })
  }

  const existingGenerated = await input.tx.query.checkoutSessionItems.findMany({
    where: and(
      eq(checkoutSessionItems.bizId, input.bizId),
      eq(checkoutSessionItems.checkoutSessionId, input.checkoutSession.id),
      eq(checkoutSessionItems.sourceKind, 'extension'),
      eq(checkoutSessionItems.sourceRefId, input.binding.id),
    ),
  })
  for (const row of existingGenerated) {
    const key = row.sourceKey ?? ''
    if (!seenKeys.has(key)) {
      await input.tx
        .delete(checkoutSessionItems)
        .where(and(eq(checkoutSessionItems.bizId, input.bizId), eq(checkoutSessionItems.id, row.id)))
    }
  }
}

export async function repriceCheckoutSessionWithAutomation(input: {
  bizId: string
  checkoutSessionId: string
  idempotencyKey?: string | null
}) {
  return await db.transaction(async (tx) => {
    const checkoutSession = await tx.query.checkoutSessions.findFirst({
      where: and(eq(checkoutSessions.bizId, input.bizId), eq(checkoutSessions.id, input.checkoutSessionId)),
    })
    if (!checkoutSession) {
      throw new Error('Checkout session not found.')
    }

    const execution = await executeAutomationHooks<
      BindingExecutionResult,
      { createdReviewItems: Array<{ id: string }>; createdWorkflowInstances: Array<{ id: string; workflowKey: string }> }
    >({
      tx,
      bizId: input.bizId,
      hookPoint: 'checkout.pricing.before_commit',
      targetType: 'checkout_session',
      targetRefId: checkoutSession.id,
      idempotencyKey: input.idempotencyKey ?? null,
      inputPayload: {
        checkoutSessionId: checkoutSession.id,
      },
      executeBinding: async ({ binding, run }) => {
        const bindingInputItems = await tx.query.checkoutSessionItems.findMany({
          where: and(
            eq(checkoutSessionItems.bizId, input.bizId),
            eq(checkoutSessionItems.checkoutSessionId, checkoutSession.id),
          ),
        })
        const checkoutSummary = summarizeCheckout(bindingInputItems)
        const baseResult =
          binding.deliveryMode === 'internal_handler'
            ? buildInternalHandlerResult({
                binding,
                items: bindingInputItems,
                checkoutSummary,
                checkoutSessionId: checkoutSession.id,
              })
            : await executeWebhookBinding({
                binding,
                checkoutSession,
                items: bindingInputItems,
                checkoutSummary,
              })
        return {
          ...baseResult,
          outputPayload: sanitizeUnknown({
            checkoutSummary,
            itemCount: bindingInputItems.length,
            ...(baseResult.outputPayload ?? {}),
            runId: run.id,
          }) as Record<string, unknown>,
        }
      },
      finalizeBinding: async ({ binding, run, executionResult }) => {
        await applyLineMutations({
          tx,
          bizId: input.bizId,
          checkoutSession,
          binding,
          runId: run.id,
          lineMutations: executionResult.lineMutations,
        })
        const materialized = await materializeAutomationWorkflowSignals({
          tx,
          bizId: input.bizId,
          targetType: 'checkout_session',
          targetRefId: checkoutSession.id,
          binding,
          run,
          signals: executionResult.workflowSignals,
        })
        const effects: LifecycleEffectDraft[] = [
          ...executionResult.lineMutations.map((mutation) => ({
            effectType: 'checkout.price_line_delta',
            status: 'applied' as const,
            payload: sanitizeUnknown({
              sourceKey: mutation.sourceKey,
              label: mutation.label,
              amountMinor: mutation.amountMinor,
              classification: mutation.classification ?? 'fee',
              description: mutation.description ?? null,
              metadata: mutation.metadata ?? {},
            }) as Record<string, unknown>,
            metadata: {
              bindingId: binding.id,
              runId: run.id,
            },
          })),
          ...executionResult.workflowSignals.map((signal) => ({
            effectType: 'workflow.signal_emit',
            status: 'applied' as const,
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
              bindingId: binding.id,
              runId: run.id,
            },
          })),
        ]
        return {
          status:
            executionResult.lineMutations.length === 0 && executionResult.workflowSignals.length === 0
              ? 'skipped'
              : 'succeeded',
          outputPayload: sanitizeUnknown({
            ...executionResult.outputPayload,
            lineMutationCount: executionResult.lineMutations.length,
            workflowSignalCount: executionResult.workflowSignals.length,
            createdReviewItemIds: materialized.createdReviewItems.map((row) => row.id),
            createdWorkflowInstanceIds: materialized.createdWorkflowInstances.map((row) => row.id),
          }) as Record<string, unknown>,
          aggregate: materialized,
          effects,
        }
      },
    })

    const runRows = execution.runs
    const createdReviewItems = execution.aggregates.flatMap((row) => row.createdReviewItems)
    const createdWorkflowInstances = execution.aggregates.flatMap(
      (row) => row.createdWorkflowInstances,
    )

    const pricedItems = await tx.query.checkoutSessionItems.findMany({
      where: and(eq(checkoutSessionItems.bizId, input.bizId), eq(checkoutSessionItems.checkoutSessionId, checkoutSession.id)),
      orderBy: [asc(checkoutSessionItems.id)],
    })
    const totals = summarizeCheckout(pricedItems)

    const [updatedSession] = await tx
      .update(checkoutSessions)
      .set({
        subtotalMinor: totals.subtotalMinor,
        taxMinor: totals.taxMinor,
        feeMinor: totals.feeMinor,
        discountMinor: totals.discountMinor,
        totalMinor: totals.totalMinor,
        lastActivityAt: new Date(),
        metadata: sanitizeUnknown({
          ...(asRecord(checkoutSession.metadata) ?? {}),
          pricing: {
            lastRepricedAt: new Date().toISOString(),
            hookRunCount: runRows.length,
          },
        }),
      })
      .where(and(eq(checkoutSessions.bizId, input.bizId), eq(checkoutSessions.id, checkoutSession.id)))
      .returning()

    return {
      checkoutSession: updatedSession,
      items: pricedItems,
      totals,
      hookRuns: runRows,
      createdReviewItems,
      createdWorkflowInstances,
    }
  })
}
