import { randomUUID } from 'node:crypto'
import dbPackage from '@bizing/db'
import {
  type AgentRequestScope,
  type LifecycleStepExpectation,
  type NLTranslationRequest,
  type PseudoApiResponse,
  lifecycleRunRequestSchema,
} from './types.js'
import { executePseudoApiRequestInOpenTransaction } from './executor.js'
import { translateNaturalLanguageRequest } from './translator.js'

const { pool } = dbPackage

type FailureClass =
  | 'scenario_contract'
  | 'schema_constraint'
  | 'expectation_mismatch'
  | 'execution_error'

type LifecycleStepIssue = {
  phaseId: string
  phaseName: string
  stepId: string
  stepName: string
  classification: FailureClass
  message: string
}

type LifecycleStepResult = {
  phaseId: string
  phaseName: string
  stepId: string
  stepName: string
  success: boolean
  startedAt: string
  endedAt: string
  durationMs: number
  prompt?: string
  resolvedPrompt?: string
  translation?: ReturnType<typeof translateNaturalLanguageRequest>
  request?: unknown
  response?: PseudoApiResponse
  expectationFailures: string[]
  captures: Record<string, unknown>
  classification?: FailureClass
  error?: string
}

type LifecyclePhaseSummary = {
  phaseId: string
  phaseName: string
  totalSteps: number
  passedSteps: number
  failedSteps: number
}

export type LifecycleRunResult = {
  success: boolean
  dryRun: boolean
  persisted: boolean
  startedAt: string
  endedAt: string
  durationMs: number
  summary: {
    totalPhases: number
    totalSteps: number
    passedSteps: number
    failedSteps: number
  }
  phaseSummaries: LifecyclePhaseSummary[]
  steps: LifecycleStepResult[]
  issues: LifecycleStepIssue[]
  variables: Record<string, unknown>
  warnings: string[]
  fatalError?: string
}

type TemplateState = {
  tokenCache: Map<string, unknown>
}

function pathSegments(path: string): Array<string | number> {
  const cleaned = path.trim().replace(/^\$\./, '').replace(/^\$/, '')
  if (!cleaned) return []

  const segments: Array<string | number> = []
  const regex = /([^[.\]]+)|\[(\d+)\]/g
  let match: RegExpExecArray | null

  while ((match = regex.exec(cleaned)) !== null) {
    if (match[1]) {
      segments.push(match[1])
    } else if (match[2]) {
      segments.push(Number(match[2]))
    }
  }

  return segments
}

function getByPath(root: unknown, path: string): unknown {
  const segments = pathSegments(path)
  let current: unknown = root

  for (const segment of segments) {
    if (current == null) return undefined

    if (typeof segment === 'number') {
      if (!Array.isArray(current)) return undefined
      current = current[segment]
      continue
    }

    if (typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[segment]
  }

  return current
}

function asMinorId(tag: string): string {
  const safeTag = tag.trim() || 'id'
  const suffix = randomUUID().replace(/-/g, '').slice(0, 27)
  return `${safeTag}_${suffix}`
}

function resolveTemplateExpression(
  expression: string,
  variables: Record<string, unknown>,
  state: TemplateState,
): unknown {
  const expr = expression.trim()
  if (!expr) return ''

  if (state.tokenCache.has(expr)) {
    return state.tokenCache.get(expr)
  }

  if (expr.startsWith('id:')) {
    const tag = expr.split(':')[1] ?? 'id'
    const value = asMinorId(tag)
    state.tokenCache.set(expr, value)
    return value
  }

  if (expr === 'nowIso') {
    const value = new Date().toISOString()
    state.tokenCache.set(expr, value)
    return value
  }

  if (expr.startsWith('nowPlusMinutes:')) {
    const raw = expr.split(':')[1] ?? '0'
    const minutes = Number(raw)
    const safeMinutes = Number.isFinite(minutes) ? minutes : 0
    const value = new Date(Date.now() + safeMinutes * 60_000).toISOString()
    state.tokenCache.set(expr, value)
    return value
  }

  if (Object.prototype.hasOwnProperty.call(variables, expr)) {
    return variables[expr]
  }

  const fromPath = getByPath(variables, expr)
  if (fromPath !== undefined) {
    return fromPath
  }

  throw new Error(`Unresolved template token: "{{${expr}}}"`)
}

function interpolateString(
  input: string,
  variables: Record<string, unknown>,
  state: TemplateState,
): unknown {
  const fullMatch = input.match(/^\{\{\s*([^}]+)\s*\}\}$/)
  if (fullMatch) {
    return resolveTemplateExpression(fullMatch[1], variables, state)
  }

  return input.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_, expression: string) => {
    const value = resolveTemplateExpression(expression, variables, state)
    return typeof value === 'string' ? value : JSON.stringify(value)
  })
}

function interpolateValue(
  value: unknown,
  variables: Record<string, unknown>,
  state: TemplateState,
): unknown {
  if (typeof value === 'string') {
    return interpolateString(value, variables, state)
  }

  if (Array.isArray(value)) {
    return value.map((entry) => interpolateValue(entry, variables, state))
  }

  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [key, entry] of Object.entries(value)) {
      out[key] = interpolateValue(entry, variables, state)
    }
    return out
  }

  return value
}

function deriveRowCount(response: PseudoApiResponse | undefined): number | null {
  if (!response?.result || typeof response.result !== 'object') return null
  const result = response.result as Record<string, unknown>
  if (typeof result.rowCount === 'number') return result.rowCount
  return null
}

function toErrorContainsArray(value: LifecycleStepExpectation['errorContains']): string[] {
  if (!value) return []
  return Array.isArray(value) ? value : [value]
}

function asComparable(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'string') return value
  const asJson = JSON.stringify(value)
  if (typeof asJson === 'string') return asJson
  return String(value)
}

function evaluateExpectations(
  expectation: LifecycleStepExpectation | undefined,
  context: {
    translation?: ReturnType<typeof translateNaturalLanguageRequest>
    request?: unknown
    response?: PseudoApiResponse
    result?: unknown
    error?: unknown
    captures: Record<string, unknown>
    prompt?: string
  },
): string[] {
  const failures: string[] = []
  const expectedSuccess = expectation?.success ?? true
  const actualSuccess = Boolean(context.response?.success ?? context.translation?.success)

  if (actualSuccess !== expectedSuccess) {
    failures.push(`Expected success=${expectedSuccess} but got success=${actualSuccess}.`)
  }

  const rowCount = deriveRowCount(context.response)
  if (expectation?.rowCountEq !== undefined) {
    if (rowCount === null || rowCount !== expectation.rowCountEq) {
      failures.push(`Expected rowCount=${expectation.rowCountEq} but got ${rowCount}.`)
    }
  }
  if (expectation?.rowCountGte !== undefined) {
    if (rowCount === null || rowCount < expectation.rowCountGte) {
      failures.push(`Expected rowCount >= ${expectation.rowCountGte} but got ${rowCount}.`)
    }
  }
  if (expectation?.rowCountLte !== undefined) {
    if (rowCount === null || rowCount > expectation.rowCountLte) {
      failures.push(`Expected rowCount <= ${expectation.rowCountLte} but got ${rowCount}.`)
    }
  }

  const errorMessage =
    context.response?.error?.message ?? context.translation?.error?.message ?? asComparable(context.error)

  for (const needle of toErrorContainsArray(expectation?.errorContains)) {
    if (!errorMessage.includes(needle)) {
      failures.push(`Expected error to include "${needle}" but got "${errorMessage}".`)
    }
  }

  for (const assertion of expectation?.asserts ?? []) {
    const root = {
      prompt: context.prompt,
      translation: context.translation,
      request: context.request,
      response: context.response,
      result: context.result,
      error: context.error,
      captures: context.captures,
    }

    const actual = getByPath(root, assertion.path)

    if (assertion.exists !== undefined) {
      const exists = actual !== undefined && actual !== null
      if (exists !== assertion.exists) {
        failures.push(
          `Assert path "${assertion.path}" exists expected ${assertion.exists} but got ${exists}.`,
        )
      }
    }

    if (assertion.equals !== undefined) {
      if (actual !== assertion.equals) {
        failures.push(
          `Assert path "${assertion.path}" equals ${asComparable(assertion.equals)} but got ${asComparable(actual)}.`,
        )
      }
    }

    if (assertion.contains !== undefined) {
      const asText = actual == null ? '' : String(actual)
      if (!asText.includes(assertion.contains)) {
        failures.push(
          `Assert path "${assertion.path}" should contain "${assertion.contains}" but got "${asText}".`,
        )
      }
    }
  }

  return failures
}

function classifyFailure(
  translation: ReturnType<typeof translateNaturalLanguageRequest> | undefined,
  response: PseudoApiResponse | undefined,
  expectationFailures: string[],
): FailureClass {
  if (expectationFailures.length > 0) {
    return 'expectation_mismatch'
  }

  if (translation && !translation.success) {
    return 'scenario_contract'
  }

  const message = response?.error?.message ?? ''

  if (
    /unknown\s+(table|column)|unsafe|tenant scope mismatch|unresolved template token/i.test(message)
  ) {
    return 'scenario_contract'
  }

  if (/violates|constraint|not-null|check|foreign key|duplicate key/i.test(message)) {
    return 'schema_constraint'
  }

  return 'execution_error'
}

function mergeScope(
  base: AgentRequestScope,
  requestScope: AgentRequestScope | undefined,
  stepScope: AgentRequestScope | undefined,
): AgentRequestScope {
  return {
    ...base,
    ...(requestScope ?? {}),
    ...(stepScope ?? {}),
  }
}

/**
 * Runs a phase-based lifecycle test pack in one SQL transaction.
 *
 * ELI5:
 * Think of this as a "movie test" instead of a "single-scene test":
 * setup -> publish -> browse -> booking -> edge cases -> verification.
 * The whole movie runs against real tables with assertions and captures.
 */
export async function runLifecycle(rawInput: unknown): Promise<LifecycleRunResult> {
  const parsed = lifecycleRunRequestSchema.parse(rawInput)
  const startedAtMs = Date.now()
  const startedAt = new Date(startedAtMs).toISOString()

  const templateState: TemplateState = {
    tokenCache: new Map<string, unknown>(),
  }
  const variables: Record<string, unknown> = {
    runId: randomUUID(),
    runStartedAt: startedAt,
  }
  const seedVariables = interpolateValue(parsed.variables, variables, templateState) as Record<
    string,
    unknown
  >
  Object.assign(variables, seedVariables)
  const defaultScope = interpolateValue(
    parsed.defaults.scope,
    variables,
    templateState,
  ) as AgentRequestScope

  const stepResults: LifecycleStepResult[] = []
  const phaseSummaries: LifecyclePhaseSummary[] = []
  const issues: LifecycleStepIssue[] = []
  const warnings: string[] = []

  const client = await pool.connect()
  let persisted = false
  let fatalError: string | undefined

  try {
    await client.query('BEGIN')

    let stopAll = false

    for (let phaseIndex = 0; phaseIndex < parsed.phases.length; phaseIndex += 1) {
      const phase = parsed.phases[phaseIndex]
      const phaseId = phase.id ?? `phase-${phaseIndex + 1}`
      const phaseName = phase.name
      let phasePassed = 0
      let phaseFailed = 0

      for (let stepIndex = 0; stepIndex < phase.steps.length; stepIndex += 1) {
        const step = phase.steps[stepIndex]
        const stepId = step.id ?? `${phaseId}-step-${stepIndex + 1}`
        const stepStartedMs = Date.now()
        const stepStartedAt = new Date(stepStartedMs).toISOString()

        const stepCaptures: Record<string, unknown> = {}
        let translation: ReturnType<typeof translateNaturalLanguageRequest> | undefined
        let request: unknown
        let response: PseudoApiResponse | undefined
        let error: string | undefined
        let resolvedPrompt: string | undefined

        try {
          const interpolatedStepScope = step.scope
            ? (interpolateValue(step.scope, variables, templateState) as AgentRequestScope)
            : undefined

          if (step.request) {
            const interpolatedRequest = interpolateValue(
              step.request,
              variables,
              templateState,
            ) as Record<string, unknown>
            const mergedScope = mergeScope(
              defaultScope,
              interpolatedRequest.scope as AgentRequestScope | undefined,
              interpolatedStepScope,
            )

            request = {
              ...interpolatedRequest,
              dryRun: false,
              scope: mergedScope,
            }
          } else if (step.prompt) {
            resolvedPrompt = interpolateString(
              step.prompt,
              variables,
              templateState,
            ) as string
            const translationInput: NLTranslationRequest = {
              input: resolvedPrompt,
              dryRun: false,
              scope: mergeScope(defaultScope, undefined, interpolatedStepScope),
            }
            translation = translateNaturalLanguageRequest(translationInput)

            if (!translation.success || !translation.pseudoRequest) {
              error = translation.error?.message ?? 'translation_failed'
            } else {
              request = {
                ...translation.pseudoRequest,
                dryRun: false,
              }
            }
          }

          if (!error && step.execute && request) {
            response = await executePseudoApiRequestInOpenTransaction(request, client)
            if (!response.success) {
              error = response.error?.message ?? 'execution_failed'
            }
          }
        } catch (stepError) {
          error = stepError instanceof Error ? stepError.message : 'unknown_lifecycle_step_error'
        }

        const captureSources = {
          translation,
          request,
          response,
          result: response?.result,
          error,
        }

        const captureFailures: string[] = []
        for (const capture of step.captures) {
          let value = getByPath(captureSources[capture.from], capture.path)
          if (value === undefined && capture.defaultValue !== undefined) {
            value = capture.defaultValue
          }

          if (value === undefined) {
            if (capture.required) {
              captureFailures.push(
                `Capture "${capture.key}" from ${capture.from}.${capture.path} could not be resolved.`,
              )
            }
            continue
          }

          variables[capture.key] = value
          stepCaptures[capture.key] = value
        }

        const expectationFailures = evaluateExpectations(step.expect, {
          translation,
          request,
          response,
          result: response?.result,
          error,
          captures: stepCaptures,
          prompt: resolvedPrompt ?? step.prompt,
        })
        expectationFailures.push(...captureFailures)

        const stepSuccess = expectationFailures.length === 0
        const classification = stepSuccess
          ? undefined
          : classifyFailure(translation, response, expectationFailures)

        const stepEndedMs = Date.now()
        const stepResult: LifecycleStepResult = {
          phaseId,
          phaseName,
          stepId,
          stepName: step.name,
          success: stepSuccess,
          startedAt: stepStartedAt,
          endedAt: new Date(stepEndedMs).toISOString(),
          durationMs: stepEndedMs - stepStartedMs,
          prompt: step.prompt,
          resolvedPrompt,
          translation: parsed.options.includeStepTrace ? translation : undefined,
          request: parsed.options.includeStepTrace ? request : undefined,
          response: parsed.options.includeStepTrace ? response : undefined,
          expectationFailures,
          captures: stepCaptures,
          classification,
          error,
        }

        stepResults.push(stepResult)

        if (stepSuccess) {
          phasePassed += 1
        } else {
          phaseFailed += 1
          issues.push({
            phaseId,
            phaseName,
            stepId,
            stepName: step.name,
            classification: classification ?? 'execution_error',
            message: expectationFailures[0] ?? error ?? 'lifecycle_step_failed',
          })
        }

        if (!stepSuccess && !phase.continueOnFailure) {
          break
        }

        if (!stepSuccess && !parsed.defaults.continueOnFailure) {
          stopAll = true
          break
        }
      }

      phaseSummaries.push({
        phaseId,
        phaseName,
        totalSteps: phase.steps.length,
        passedSteps: phasePassed,
        failedSteps: phaseFailed,
      })

      if (stopAll) {
        break
      }
    }

    const failedSteps = stepResults.filter((step) => !step.success).length
    const shouldRollback =
      parsed.defaults.dryRun || (failedSteps > 0 && parsed.options.rollbackOnFailure)

    if (shouldRollback) {
      await client.query('ROLLBACK')
      persisted = false
      if (parsed.defaults.dryRun) {
        warnings.push('Lifecycle executed in dry-run mode; transaction rolled back.')
      }
      if (!parsed.defaults.dryRun && failedSteps > 0 && parsed.options.rollbackOnFailure) {
        warnings.push('Lifecycle failed and rollbackOnFailure=true; transaction rolled back.')
      }
    } else {
      await client.query('COMMIT')
      persisted = true
    }
  } catch (runError) {
    fatalError = runError instanceof Error ? runError.message : 'unknown_lifecycle_run_error'
    try {
      await client.query('ROLLBACK')
    } catch {
      // ignore rollback failure and surface original error
    }
  } finally {
    client.release()
  }

  const endedAtMs = Date.now()
  const endedAt = new Date(endedAtMs).toISOString()
  const passedSteps = stepResults.filter((step) => step.success).length
  const failedSteps = stepResults.length - passedSteps

  return {
    success: !fatalError && failedSteps === 0,
    dryRun: parsed.defaults.dryRun,
    persisted,
    startedAt,
    endedAt,
    durationMs: endedAtMs - startedAtMs,
    summary: {
      totalPhases: parsed.phases.length,
      totalSteps: stepResults.length,
      passedSteps,
      failedSteps,
    },
    phaseSummaries,
    steps: stepResults,
    issues,
    variables,
    warnings,
    fatalError,
  }
}
