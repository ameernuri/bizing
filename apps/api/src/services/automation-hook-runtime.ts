import { and, asc, eq } from 'drizzle-orm'
import dbPackage from '@bizing/db'
import { sanitizeUnknown } from '../lib/sanitize.js'
import { dispatchWorkflowTriggers } from './workflow-trigger-runtime.js'
import {
  ensureLifecycleHookContract,
  ensureLifecycleHookContractVersion,
  type LifecycleHookContractResolutionMode,
} from './lifecycle-hook-contracts.js'

type HookRunStatus = 'running' | 'succeeded' | 'failed' | 'skipped'
type HookEffectStatus = 'planned' | 'applied' | 'failed' | 'skipped'
type InvocationTriggerSource = 'api' | 'action' | 'event' | 'workflow' | 'schedule' | 'system'

const lifecycleContractResolutionMode: LifecycleHookContractResolutionMode =
  process.env.LIFECYCLE_HOOK_RESOLUTION_MODE === 'strict' ? 'strict' : 'auto_register'

const {
  db,
  automationHookBindings,
  automationHookRuns,
  lifecycleHookContracts,
  lifecycleHookContractVersions,
  lifecycleHookInvocations,
  lifecycleHookEffectEvents,
} = dbPackage

type FinalizeResult<TAggregate> = {
  status?: Exclude<HookRunStatus, 'running' | 'failed'>
  outputPayload?: Record<string, unknown>
  aggregate?: TAggregate
  effects?: LifecycleEffectDraft[]
}

export type LifecycleEffectDraft = {
  effectType: string
  status?: HookEffectStatus
  payload?: Record<string, unknown>
  outputPayload?: Record<string, unknown>
  errorCode?: string | null
  errorMessage?: string | null
  metadata?: Record<string, unknown>
}

export type ExecuteAutomationHooksInput<TExecutionResult, TAggregate> = {
  tx: typeof db
  bizId: string
  hookPoint: string
  targetType: string
  targetRefId: string
  idempotencyKey?: string | null
  contractId?: string | null
  contractVersion?: number | null
  triggerSource?: InvocationTriggerSource
  triggerRefId?: string | null
  contextPayload?: Record<string, unknown>
  inputPayload?: Record<string, unknown>
  shouldRunBinding?: (binding: typeof automationHookBindings.$inferSelect) => Promise<boolean> | boolean
  executeBinding: (input: {
    binding: typeof automationHookBindings.$inferSelect
    run: typeof automationHookRuns.$inferSelect
    invocation: typeof lifecycleHookInvocations.$inferSelect
    contract: typeof lifecycleHookContracts.$inferSelect
    contractVersion: typeof lifecycleHookContractVersions.$inferSelect
  }) => Promise<TExecutionResult>
  finalizeBinding?: (input: {
    binding: typeof automationHookBindings.$inferSelect
    run: typeof automationHookRuns.$inferSelect
    invocation: typeof lifecycleHookInvocations.$inferSelect
    contract: typeof lifecycleHookContracts.$inferSelect
    contractVersion: typeof lifecycleHookContractVersions.$inferSelect
    executionResult: TExecutionResult
  }) => Promise<FinalizeResult<TAggregate> | void>
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>
  return {}
}

function matchesBindingFilter(input: {
  binding: typeof automationHookBindings.$inferSelect
  targetType: string
  targetRefId: string
}): { matches: boolean; reason?: string } {
  const filter = asRecord(input.binding.filter)
  const targetTypeFilter =
    typeof filter.targetType === 'string' && filter.targetType.trim().length > 0
      ? filter.targetType.trim()
      : null
  if (targetTypeFilter && targetTypeFilter !== input.targetType) {
    return { matches: false, reason: 'targetType mismatch' }
  }
  if (Array.isArray(filter.targetTypes)) {
    const values = filter.targetTypes.filter((entry) => typeof entry === 'string') as string[]
    if (values.length > 0 && !values.includes(input.targetType)) {
      return { matches: false, reason: 'targetTypes mismatch' }
    }
  }
  const targetRefEquals =
    typeof filter.targetRefId === 'string' && filter.targetRefId.trim().length > 0
      ? filter.targetRefId.trim()
      : null
  if (targetRefEquals && targetRefEquals !== input.targetRefId) {
    return { matches: false, reason: 'targetRefId mismatch' }
  }
  const targetRefPrefix =
    typeof filter.targetRefPrefix === 'string' && filter.targetRefPrefix.trim().length > 0
      ? filter.targetRefPrefix.trim()
      : null
  if (targetRefPrefix && !input.targetRefId.startsWith(targetRefPrefix)) {
    return { matches: false, reason: 'targetRefPrefix mismatch' }
  }
  return { matches: true }
}

function summarizeInvocationStatus(runs: Array<typeof automationHookRuns.$inferSelect>): Exclude<HookRunStatus, 'running'> {
  if (runs.some((row) => row.status === 'failed')) return 'failed'
  if (runs.some((row) => row.status === 'succeeded')) return 'succeeded'
  return 'skipped'
}

export async function executeAutomationHooks<TExecutionResult, TAggregate = unknown>(
  input: ExecuteAutomationHooksInput<TExecutionResult, TAggregate>,
) {
  const contract = await ensureLifecycleHookContract({
    tx: input.tx,
    bizId: input.bizId,
    hookPoint: input.hookPoint,
    targetType: input.targetType,
    contractId: input.contractId,
    mode: lifecycleContractResolutionMode,
    source: 'automation-hook-runtime',
  })
  if (!contract) {
    throw new Error(`Lifecycle hook contract '${input.hookPoint}' is not registered.`)
  }
  const contractVersion = await ensureLifecycleHookContractVersion({
    tx: input.tx,
    bizId: input.bizId,
    contract,
    requestedVersion: input.contractVersion,
    mode: lifecycleContractResolutionMode,
    source: 'automation-hook-runtime',
  })
  if (!contractVersion) {
    throw new Error(
      `Lifecycle hook contract version ${input.contractVersion ?? contract.currentVersion ?? 1} is not registered for '${contract.key}'.`,
    )
  }

  const invocationIdempotencyKey =
    input.idempotencyKey && input.idempotencyKey.length > 0
      ? `${contract.key}:${input.targetType}:${input.targetRefId}:${input.idempotencyKey}`
      : null

  const existingInvocation = invocationIdempotencyKey
    ? await input.tx.query.lifecycleHookInvocations.findFirst({
        where: and(
          eq(lifecycleHookInvocations.bizId, input.bizId),
          eq(lifecycleHookInvocations.idempotencyKey, invocationIdempotencyKey),
        ),
      })
    : null

  if (existingInvocation) {
    const [existingRuns, existingEffects] = await Promise.all([
      input.tx.query.automationHookRuns.findMany({
        where: and(
          eq(automationHookRuns.bizId, input.bizId),
          eq(automationHookRuns.lifecycleHookInvocationId, existingInvocation.id),
        ),
        orderBy: [asc(automationHookRuns.startedAt), asc(automationHookRuns.id)],
      }),
      input.tx.query.lifecycleHookEffectEvents.findMany({
        where: and(
          eq(lifecycleHookEffectEvents.bizId, input.bizId),
          eq(lifecycleHookEffectEvents.lifecycleHookInvocationId, existingInvocation.id),
        ),
        orderBy: [asc(lifecycleHookEffectEvents.appliedAt), asc(lifecycleHookEffectEvents.id)],
      }),
    ])

    const bindings = await input.tx.query.automationHookBindings.findMany({
      where: and(
        eq(automationHookBindings.bizId, input.bizId),
        eq(automationHookBindings.status, 'active'),
        eq(automationHookBindings.lifecycleHookContractId, contract.id),
      ),
      orderBy: [asc(automationHookBindings.priority), asc(automationHookBindings.id)],
    })

    return {
      contract,
      contractVersion,
      invocation: existingInvocation,
      bindings,
      runs: existingRuns,
      effects: existingEffects,
      aggregates: [] as TAggregate[],
      workflowDispatches: [],
      reused: true,
    }
  }

  const [invocation] = await input.tx
    .insert(lifecycleHookInvocations)
    .values({
      bizId: input.bizId,
      lifecycleHookContractId: contract.id,
      contractKey: contract.key,
      contractVersion: contractVersion.version,
      triggerSource: input.triggerSource ?? 'api',
      triggerRefId: input.triggerRefId ?? null,
      targetType: input.targetType,
      targetRefId: input.targetRefId,
      status: 'running',
      inputPayload: sanitizeUnknown(input.inputPayload ?? {}),
      contextPayload: sanitizeUnknown(input.contextPayload ?? {}),
      outputPayload: {},
      idempotencyKey: invocationIdempotencyKey,
      metadata: {
        source: 'automation-hook-runtime',
      },
    })
    .returning()

  const bindings = await input.tx.query.automationHookBindings.findMany({
    where: and(
      eq(automationHookBindings.bizId, input.bizId),
      eq(automationHookBindings.status, 'active'),
      eq(automationHookBindings.lifecycleHookContractId, contract.id),
    ),
    orderBy: [asc(automationHookBindings.priority), asc(automationHookBindings.id)],
  })

  const runs: Array<typeof automationHookRuns.$inferSelect> = []
  const effects: Array<typeof lifecycleHookEffectEvents.$inferSelect> = []
  const aggregates: TAggregate[] = []

  for (const binding of bindings) {
    const runIdempotencyKey =
      input.idempotencyKey && input.idempotencyKey.length > 0
        ? `${invocation.id}:${binding.id}:${input.idempotencyKey}`
        : null

    if (runIdempotencyKey) {
      const existingRun = await input.tx.query.automationHookRuns.findFirst({
        where: and(
          eq(automationHookRuns.bizId, input.bizId),
          eq(automationHookRuns.idempotencyKey, runIdempotencyKey),
        ),
      })
      if (existingRun) {
        runs.push(existingRun)
        if (binding.failureMode === 'fail_closed' && existingRun.status === 'failed') {
          throw new Error(
            `Automation hook binding ${binding.id} previously failed in fail_closed mode: ${existingRun.errorMessage ?? 'unknown error'}`,
          )
        }
        continue
      }
    }

    const filterMatch = matchesBindingFilter({
      binding,
      targetType: input.targetType,
      targetRefId: input.targetRefId,
    })
    const shouldRunByCallback = input.shouldRunBinding ? await input.shouldRunBinding(binding) : true
    const shouldRun = filterMatch.matches && shouldRunByCallback

    const [run] = await input.tx
      .insert(automationHookRuns)
      .values({
        bizId: input.bizId,
        automationHookBindingId: binding.id,
        lifecycleHookInvocationId: invocation.id,
        hookPoint: contract.key,
        targetType: input.targetType,
        targetRefId: input.targetRefId,
        status: shouldRun ? 'running' : 'skipped',
        inputPayload: sanitizeUnknown({
          hookInput: input.inputPayload ?? {},
          hookPoint: contract.key,
          targetType: input.targetType,
          targetRefId: input.targetRefId,
          idempotencyKey: input.idempotencyKey ?? null,
          contractId: contract.id,
          contractVersion: contractVersion.version,
          invocationId: invocation.id,
        }),
        outputPayload: shouldRun
          ? {}
          : sanitizeUnknown({
              skipped: true,
              reason: filterMatch.matches ? 'binding filtered by resolver' : (filterMatch.reason ?? 'binding filter mismatch'),
            }),
        idempotencyKey: runIdempotencyKey,
        metadata: {
          source: 'automation-hook-runtime',
          invocationId: invocation.id,
        },
      })
      .returning()

    if (!shouldRun) {
      runs.push(run)
      continue
    }

    const startedAtMs = run.startedAt.getTime()
    try {
      const executionResult = await input.executeBinding({
        binding,
        run,
        invocation,
        contract,
        contractVersion,
      })
      const finalized = (await input.finalizeBinding?.({
        binding,
        run,
        invocation,
        contract,
        contractVersion,
        executionResult,
      })) ?? {}
      const status = finalized.status ?? 'succeeded'
      const [updated] = await input.tx
        .update(automationHookRuns)
        .set({
          status,
          completedAt: new Date(),
          durationMs: Math.max(0, Date.now() - startedAtMs),
          outputPayload: sanitizeUnknown(finalized.outputPayload ?? {}),
          errorCode: null,
          errorMessage: null,
        })
        .where(and(eq(automationHookRuns.bizId, input.bizId), eq(automationHookRuns.id, run.id)))
        .returning()
      runs.push(updated)

      if (Array.isArray(finalized.effects)) {
        for (const effect of finalized.effects) {
          const [createdEffect] = await input.tx
            .insert(lifecycleHookEffectEvents)
            .values({
              bizId: input.bizId,
              lifecycleHookInvocationId: invocation.id,
              automationHookRunId: updated.id,
              effectType: effect.effectType.trim(),
              status: effect.status ?? 'applied',
              payload: sanitizeUnknown(effect.payload ?? {}),
              outputPayload: sanitizeUnknown(effect.outputPayload ?? {}),
              errorCode: effect.errorCode ?? null,
              errorMessage: effect.errorMessage ?? null,
              metadata: sanitizeUnknown({
                source: 'automation-hook-runtime',
                bindingId: binding.id,
                ...(effect.metadata ?? {}),
              }),
            })
            .returning()
          effects.push(createdEffect)
        }
      }

      if (finalized.aggregate !== undefined) {
        aggregates.push(finalized.aggregate)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const [failed] = await input.tx
        .update(automationHookRuns)
        .set({
          status: 'failed',
          completedAt: new Date(),
          durationMs: Math.max(0, Date.now() - startedAtMs),
          errorCode: 'HOOK_EXECUTION_FAILED',
          errorMessage: message,
          outputPayload: sanitizeUnknown({
            error: message,
          }),
        })
        .where(and(eq(automationHookRuns.bizId, input.bizId), eq(automationHookRuns.id, run.id)))
        .returning()
      runs.push(failed)
      if (binding.failureMode === 'fail_closed') {
        throw new Error(`Automation hook binding ${binding.id} failed in fail_closed mode: ${message}`)
      }
    }
  }

  const invocationStatus = summarizeInvocationStatus(runs)
  const [updatedInvocation] = await input.tx
    .update(lifecycleHookInvocations)
    .set({
      status: invocationStatus,
      completedAt: new Date(),
      durationMs: Math.max(0, Date.now() - invocation.startedAt.getTime()),
      outputPayload: sanitizeUnknown({
        bindingCount: bindings.length,
        runCount: runs.length,
        effectCount: effects.length,
        aggregateCount: aggregates.length,
      }),
      errorCode: invocationStatus === 'failed' ? 'HOOK_INVOCATION_FAILED' : null,
      errorMessage: invocationStatus === 'failed'
        ? runs.find((row) => row.status === 'failed')?.errorMessage ?? 'Invocation failed.'
        : null,
    })
    .where(and(eq(lifecycleHookInvocations.bizId, input.bizId), eq(lifecycleHookInvocations.id, invocation.id)))
    .returning()

  const workflowDispatches: Array<Awaited<ReturnType<typeof dispatchWorkflowTriggers>>> = []
  workflowDispatches.push(
    await dispatchWorkflowTriggers({
      tx: input.tx,
      bizId: input.bizId,
      triggerSource: 'lifecycle_hook_invocation',
      triggerRefId: updatedInvocation.id,
      targetType: input.targetType,
      targetRefId: input.targetRefId,
      lifecycleHookContractKey: contract.key,
      lifecycleHookInvocationStatus: invocationStatus,
      inputPayload: sanitizeUnknown({
        invocationId: updatedInvocation.id,
        contractId: contract.id,
        contractKey: contract.key,
        contractVersion: contractVersion.version,
        status: invocationStatus,
        runCount: runs.length,
        effectCount: effects.length,
      }) as Record<string, unknown>,
      metadata: {
        source: 'automation-hook-runtime',
      },
    }),
  )

  for (const effect of effects) {
    workflowDispatches.push(
      await dispatchWorkflowTriggers({
        tx: input.tx,
        bizId: input.bizId,
        triggerSource: 'lifecycle_hook_effect',
        triggerRefId: effect.id,
        targetType: input.targetType,
        targetRefId: input.targetRefId,
        lifecycleHookContractKey: contract.key,
        lifecycleHookInvocationStatus: invocationStatus,
        lifecycleHookEffectType: effect.effectType,
        inputPayload: sanitizeUnknown({
          effectId: effect.id,
          effectType: effect.effectType,
          effectStatus: effect.status,
          payload: asRecord(effect.payload),
          outputPayload: asRecord(effect.outputPayload),
          invocationId: updatedInvocation.id,
        }) as Record<string, unknown>,
        metadata: {
          source: 'automation-hook-runtime',
        },
      }),
    )
  }

  return {
    contract,
    contractVersion,
    invocation: updatedInvocation,
    bindings,
    runs,
    effects,
    aggregates,
    workflowDispatches,
    reused: false,
  }
}
