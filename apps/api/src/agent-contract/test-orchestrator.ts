import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { promises as fs } from 'node:fs'
import { z } from 'zod'
import { runLifecycle, type LifecycleRunResult } from './lifecycle-runner.js'
import { runScenarios, type ScenarioRunResult } from './scenario-runner.js'

const defaultPackRoot = path.resolve(process.cwd(), '..', '..', 'mind', 'workspace')

type FailureClass =
  | 'scenario_contract'
  | 'schema_constraint'
  | 'expectation_mismatch'
  | 'execution_error'

const scalarSchema = z.union([z.string(), z.number(), z.boolean(), z.null()])

const pathAssertSchema = z
  .object({
    path: z.string().min(1),
    equals: scalarSchema.optional(),
    exists: z.boolean().optional(),
    contains: z.string().optional(),
  })
  .refine(
    (value) =>
      value.equals !== undefined || value.exists !== undefined || value.contains !== undefined,
    { message: 'api_journey assert requires equals, exists, or contains.' },
  )

const apiJourneyExpectationSchema = z.object({
  status: z.number().int().min(100).max(599).optional(),
  success: z.boolean().optional(),
  bodyContains: z.string().optional(),
  asserts: z.array(pathAssertSchema).default([]),
})

const apiJourneyCaptureSchema = z.object({
  key: z.string().min(1),
  from: z.enum(['body', 'headers', 'status']).default('body'),
  path: z.string().optional(),
  required: z.boolean().default(true),
  defaultValue: z.unknown().optional(),
})

const apiJourneyStepSchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().min(1),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
  path: z.string().min(1),
  query: z.record(z.union([scalarSchema, z.array(scalarSchema)])).optional(),
  headers: z.record(z.string()).optional(),
  body: z.unknown().optional(),
  expect: apiJourneyExpectationSchema.optional(),
  captures: z.array(apiJourneyCaptureSchema).default([]),
})

const apiJourneyPackSchema = z.object({
  defaults: z
    .object({
      baseUrl: z.string().url().default('http://localhost:6129'),
      headers: z.record(z.string()).default({}),
      continueOnFailure: z.boolean().default(true),
    })
    .default({
      baseUrl: 'http://localhost:6129',
      headers: {},
      continueOnFailure: true,
    }),
  variables: z.record(z.unknown()).default({}),
  steps: z.array(apiJourneyStepSchema).min(1),
})

const suiteKindSchema = z.enum(['lifecycle', 'scenario', 'api_journey'])

const suiteSourceSchema = z
  .object({
    filePath: z.string().min(1).optional(),
    inline: z.unknown().optional(),
  })
  .refine((value) => value.filePath || value.inline !== undefined, {
    message: 'Suite source requires either filePath or inline payload.',
  })

const orchestratorSuiteSchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  kind: suiteKindSchema,
  enabled: z.boolean().default(true),
  tags: z.array(z.string().min(1)).default([]),
  source: suiteSourceSchema,
})

const orchestratorRequestSchema = z.object({
  defaults: z
    .object({
      dryRun: z.boolean().default(true),
      continueOnFailure: z.boolean().default(true),
      packRoot: z.string().optional(),
    })
    .default({ dryRun: true, continueOnFailure: true }),
  variables: z.record(z.unknown()).default({}),
  suites: z.array(orchestratorSuiteSchema).min(1),
  output: z
    .object({
      writeJsonPath: z.string().optional(),
      writeMarkdownPath: z.string().optional(),
    })
    .optional(),
})

type OrchestratorRequest = z.infer<typeof orchestratorRequestSchema>
type ApiJourneyPack = z.infer<typeof apiJourneyPackSchema>

type OrchestratorIssue = {
  suiteId: string
  suiteName: string
  classification: FailureClass
  message: string
}

type SuiteResult = {
  id: string
  name: string
  kind: z.infer<typeof suiteKindSchema>
  success: boolean
  total: number
  passed: number
  failed: number
  durationMs: number
  warnings: string[]
  issueCount: number
  details: unknown
}

type OrchestratorSummary = {
  runId: string
  startedAt: string
  endedAt: string
  durationMs: number
  success: boolean
  totals: {
    suites: number
    suitesPassed: number
    suitesFailed: number
    checks: number
    checksPassed: number
    checksFailed: number
  }
}

export type OrchestratorRunResult = {
  summary: OrchestratorSummary
  suites: SuiteResult[]
  issues: OrchestratorIssue[]
  variables: Record<string, unknown>
  report: {
    markdown: string
  }
}

type TemplateState = {
  tokenCache: Map<string, unknown>
}

function parsePathSegments(pathExpr: string): Array<string | number> {
  const cleaned = pathExpr.trim().replace(/^\$\./, '').replace(/^\$/, '')
  if (!cleaned) return []

  const segments: Array<string | number> = []
  const regex = /([^[.\]]+)|\[(\d+)\]/g
  let match: RegExpExecArray | null
  while ((match = regex.exec(cleaned)) !== null) {
    if (match[1]) segments.push(match[1])
    if (match[2]) segments.push(Number(match[2]))
  }
  return segments
}

function getByPath(root: unknown, pathExpr: string): unknown {
  const segments = parsePathSegments(pathExpr)
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

function resolveTemplateToken(
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
    const value = `${tag}_${randomUUID().replace(/-/g, '').slice(0, 27)}`
    state.tokenCache.set(expr, value)
    return value
  }

  if (expr === 'nowIso') {
    const value = new Date().toISOString()
    state.tokenCache.set(expr, value)
    return value
  }

  if (expr.startsWith('nowPlusMinutes:')) {
    const minutes = Number(expr.split(':')[1] ?? '0')
    const safeMinutes = Number.isFinite(minutes) ? minutes : 0
    const value = new Date(Date.now() + safeMinutes * 60_000).toISOString()
    state.tokenCache.set(expr, value)
    return value
  }

  if (Object.prototype.hasOwnProperty.call(variables, expr)) {
    return variables[expr]
  }

  const pathValue = getByPath(variables, expr)
  if (pathValue !== undefined) {
    return pathValue
  }

  throw new Error(`Unresolved template token: "{{${expr}}}"`)
}

function interpolateString(
  value: string,
  variables: Record<string, unknown>,
  state: TemplateState,
): unknown {
  const fullToken = value.match(/^\{\{\s*([^}]+)\s*\}\}$/)
  if (fullToken) {
    return resolveTemplateToken(fullToken[1], variables, state)
  }

  return value.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_, expression: string) => {
    const resolved = resolveTemplateToken(expression, variables, state)
    return typeof resolved === 'string' ? resolved : JSON.stringify(resolved)
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

function classifyMessage(message: string): FailureClass {
  if (/unknown\s+(table|column)|unsafe|template|scope mismatch|translation/i.test(message)) {
    return 'scenario_contract'
  }
  if (/violates|constraint|not-null|check|foreign key|duplicate key|enum/i.test(message)) {
    return 'schema_constraint'
  }
  return 'execution_error'
}

function ensureWithinPackRoot(filePath: string, packRoot: string): string {
  const resolvedRoot = path.resolve(packRoot)
  const absolute = path.isAbsolute(filePath)
    ? path.resolve(filePath)
    : path.resolve(resolvedRoot, filePath)

  if (!absolute.startsWith(resolvedRoot)) {
    throw new Error(`Pack path is outside allowed root: ${filePath}`)
  }
  return absolute
}

async function loadSuiteSource(
  suite: z.infer<typeof orchestratorSuiteSchema>,
  request: OrchestratorRequest,
): Promise<unknown> {
  if (suite.source.inline !== undefined) {
    return suite.source.inline
  }

  const root = request.defaults.packRoot ?? defaultPackRoot
  const safeFile = ensureWithinPackRoot(suite.source.filePath!, root)
  const content = await fs.readFile(safeFile, 'utf-8')
  return JSON.parse(content)
}

type ApiJourneyStepResult = {
  stepId: string
  stepName: string
  success: boolean
  status: number
  url: string
  durationMs: number
  expectationFailures: string[]
  captures: Record<string, unknown>
}

type ApiJourneyResult = {
  success: boolean
  total: number
  passed: number
  failed: number
  steps: ApiJourneyStepResult[]
  issues: Array<{ classification: FailureClass; message: string }>
  variables: Record<string, unknown>
}

function valueAsString(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'string') return value
  const json = JSON.stringify(value)
  return typeof json === 'string' ? json : String(value)
}

function evaluatePathAssertion(
  assertion: z.infer<typeof pathAssertSchema>,
  body: unknown,
): string[] {
  const failures: string[] = []
  const actual = getByPath(body, assertion.path)

  if (assertion.exists !== undefined) {
    const exists = actual !== undefined && actual !== null
    if (exists !== assertion.exists) {
      failures.push(
        `Assert "${assertion.path}" exists expected ${assertion.exists}, got ${exists}.`,
      )
    }
  }

  if (assertion.equals !== undefined && actual !== assertion.equals) {
    failures.push(
      `Assert "${assertion.path}" equals ${valueAsString(assertion.equals)}, got ${valueAsString(actual)}.`,
    )
  }

  if (assertion.contains !== undefined) {
    const text = valueAsString(actual)
    if (!text.includes(assertion.contains)) {
      failures.push(
        `Assert "${assertion.path}" contains "${assertion.contains}", got "${text}".`,
      )
    }
  }

  return failures
}

async function runApiJourney(
  rawPack: unknown,
  globalVariables: Record<string, unknown>,
  requestDefaults: OrchestratorRequest['defaults'],
): Promise<ApiJourneyResult> {
  const parsed = apiJourneyPackSchema.parse(rawPack)
  const templateState: TemplateState = { tokenCache: new Map<string, unknown>() }
  const variables: Record<string, unknown> = {
    ...globalVariables,
    ...(interpolateValue(parsed.variables, globalVariables, templateState) as Record<string, unknown>),
  }

  const steps: ApiJourneyStepResult[] = []
  const issues: Array<{ classification: FailureClass; message: string }> = []

  for (let index = 0; index < parsed.steps.length; index += 1) {
    const step = parsed.steps[index]
    const stepId = step.id ?? `api-step-${index + 1}`
    const stepStart = Date.now()
    const captures: Record<string, unknown> = {}
    const expectationFailures: string[] = []

    try {
      const pathValue = interpolateString(step.path, variables, templateState)
      const resolvedPath = String(pathValue)
      const query = step.query
        ? (interpolateValue(step.query, variables, templateState) as Record<
            string,
            unknown
          >)
        : undefined
      const headers = {
        ...parsed.defaults.headers,
        ...(step.headers
          ? (interpolateValue(step.headers, variables, templateState) as Record<string, string>)
          : {}),
      }
      const body = step.body !== undefined ? interpolateValue(step.body, variables, templateState) : undefined

      const url = new URL(resolvedPath, parsed.defaults.baseUrl)
      if (query) {
        for (const [key, rawValue] of Object.entries(query)) {
          if (Array.isArray(rawValue)) {
            for (const entry of rawValue) {
              url.searchParams.append(key, String(entry))
            }
          } else if (rawValue !== undefined && rawValue !== null) {
            url.searchParams.set(key, String(rawValue))
          }
        }
      }

      const response = await fetch(url.toString(), {
        method: step.method,
        headers: body === undefined ? headers : { 'content-type': 'application/json', ...headers },
        body: body === undefined ? undefined : JSON.stringify(body),
      })

      const contentType = response.headers.get('content-type') ?? ''
      const parsedBody =
        contentType.includes('application/json') ? await response.json() : await response.text()

      const expected = step.expect
      if (expected?.status !== undefined && response.status !== expected.status) {
        expectationFailures.push(
          `Expected status ${expected.status} but got ${response.status}.`,
        )
      }
      if (expected?.success !== undefined) {
        const actualSuccess = response.ok
        if (actualSuccess !== expected.success) {
          expectationFailures.push(
            `Expected success=${expected.success} but got success=${actualSuccess}.`,
          )
        }
      }
      if (expected?.bodyContains !== undefined) {
        const text = valueAsString(parsedBody)
        if (!text.includes(expected.bodyContains)) {
          expectationFailures.push(`Expected body to include "${expected.bodyContains}".`)
        }
      }
      for (const assertion of expected?.asserts ?? []) {
        expectationFailures.push(...evaluatePathAssertion(assertion, parsedBody))
      }

      const captureSource = {
        body: parsedBody,
        headers: Object.fromEntries(response.headers.entries()),
        status: response.status,
      }
      for (const capture of step.captures) {
        let capturedValue: unknown
        if (capture.from === 'status') {
          capturedValue = response.status
        } else if (capture.path) {
          capturedValue = getByPath(captureSource[capture.from], capture.path)
        } else {
          capturedValue = captureSource[capture.from]
        }

        if (capturedValue === undefined && capture.defaultValue !== undefined) {
          capturedValue = capture.defaultValue
        }
        if (capturedValue === undefined) {
          if (capture.required) {
            expectationFailures.push(
              `Capture "${capture.key}" from ${capture.from}${capture.path ? `.${capture.path}` : ''} missing.`,
            )
          }
          continue
        }
        variables[capture.key] = capturedValue
        captures[capture.key] = capturedValue
      }

      const success = expectationFailures.length === 0
      if (!success) {
        issues.push({
          classification: 'expectation_mismatch',
          message: `${step.name}: ${expectationFailures[0]}`,
        })
      }

      steps.push({
        stepId,
        stepName: step.name,
        success,
        status: response.status,
        url: url.toString(),
        durationMs: Date.now() - stepStart,
        expectationFailures,
        captures,
      })

      if (!success && !parsed.defaults.continueOnFailure) {
        break
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown_api_journey_error'
      steps.push({
        stepId,
        stepName: step.name,
        success: false,
        status: 0,
        url: '',
        durationMs: Date.now() - stepStart,
        expectationFailures: [message],
        captures,
      })
      issues.push({ classification: classifyMessage(message), message: `${step.name}: ${message}` })
      if (!parsed.defaults.continueOnFailure || !requestDefaults.continueOnFailure) {
        break
      }
    }
  }

  const passed = steps.filter((step) => step.success).length
  const failed = steps.length - passed

  return {
    success: failed === 0,
    total: steps.length,
    passed,
    failed,
    steps,
    issues,
    variables,
  }
}

function collectScenarioIssues(
  suiteId: string,
  suiteName: string,
  result: ScenarioRunResult,
): OrchestratorIssue[] {
  const issues: OrchestratorIssue[] = []
  for (const step of result.results) {
    if (step.success) continue
    const message = step.error ?? 'scenario_failed'
    const classification = step.translation && !step.translation.success
      ? 'scenario_contract'
      : classifyMessage(message)
    issues.push({
      suiteId,
      suiteName,
      classification,
      message: `${step.name}: ${message}`,
    })
  }
  return issues
}

function collectLifecycleIssues(
  suiteId: string,
  suiteName: string,
  result: LifecycleRunResult,
): OrchestratorIssue[] {
  return result.issues.map((issue) => ({
    suiteId,
    suiteName,
    classification: issue.classification,
    message: `${issue.phaseName} / ${issue.stepName}: ${issue.message}`,
  }))
}

function buildMarkdownReport(
  summary: OrchestratorSummary,
  suites: SuiteResult[],
  issues: OrchestratorIssue[],
): string {
  const lines: string[] = []
  lines.push('# Agent Fitness Report')
  lines.push('')
  lines.push(`- Run ID: \`${summary.runId}\``)
  lines.push(`- Started: \`${summary.startedAt}\``)
  lines.push(`- Ended: \`${summary.endedAt}\``)
  lines.push(`- Duration: \`${summary.durationMs}ms\``)
  lines.push(`- Success: \`${summary.success}\``)
  lines.push('')
  lines.push('## Totals')
  lines.push('')
  lines.push(
    `- Suites: ${summary.totals.suites} (${summary.totals.suitesPassed} passed, ${summary.totals.suitesFailed} failed)`,
  )
  lines.push(
    `- Checks: ${summary.totals.checks} (${summary.totals.checksPassed} passed, ${summary.totals.checksFailed} failed)`,
  )
  lines.push('')
  lines.push('## Suite Results')
  lines.push('')
  lines.push('| Suite | Kind | Passed | Failed | Duration (ms) | Success |')
  lines.push('|---|---|---:|---:|---:|---|')
  for (const suite of suites) {
    lines.push(
      `| ${suite.name} | ${suite.kind} | ${suite.passed}/${suite.total} | ${suite.failed} | ${suite.durationMs} | ${suite.success ? 'yes' : 'no'} |`,
    )
  }
  lines.push('')
  lines.push('## Issues')
  lines.push('')
  if (issues.length === 0) {
    lines.push('- No issues detected.')
  } else {
    for (const issue of issues) {
      lines.push(`- [${issue.classification}] ${issue.suiteName}: ${issue.message}`)
    }
  }

  return `${lines.join('\n')}\n`
}

/**
 * Runs a combined test loop over lifecycle packs, scenario packs, and API journeys.
 *
 * This is the "combo" validation layer for schema + API evolution:
 * - use lifecycle packs for domain behavior fitness,
 * - use scenario packs for broad table/column coverage,
 * - use API journeys for real endpoint interaction checks.
 */
export async function runAgentFitnessLoop(rawInput: unknown): Promise<OrchestratorRunResult> {
  const parsed = orchestratorRequestSchema.parse(rawInput)
  const runId = randomUUID()
  const startedAtMs = Date.now()
  const startedAt = new Date(startedAtMs).toISOString()

  const suites: SuiteResult[] = []
  const issues: OrchestratorIssue[] = []
  const sharedVariables: Record<string, unknown> = {
    ...parsed.variables,
    runId,
    runStartedAt: startedAt,
  }

  for (let index = 0; index < parsed.suites.length; index += 1) {
    const suiteConfig = parsed.suites[index]
    if (!suiteConfig.enabled) continue

    const suiteId = suiteConfig.id ?? `suite-${index + 1}`
    const suiteName = suiteConfig.name ?? suiteId
    const suiteStartedMs = Date.now()

    try {
      const rawSource = await loadSuiteSource(suiteConfig, parsed)
      const suiteTemplateState: TemplateState = { tokenCache: new Map<string, unknown>() }

      if (suiteConfig.kind === 'lifecycle') {
        const lifecycleInput =
          typeof rawSource === 'object' && rawSource !== null
            ? {
                ...(rawSource as Record<string, unknown>),
                defaults: {
                  ...((rawSource as Record<string, unknown>).defaults as Record<string, unknown>),
                  dryRun: parsed.defaults.dryRun,
                },
              }
            : rawSource
        const result = await runLifecycle(lifecycleInput)
        sharedVariables[`${suiteId}_variables`] = result.variables
        issues.push(...collectLifecycleIssues(suiteId, suiteName, result))

        suites.push({
          id: suiteId,
          name: suiteName,
          kind: suiteConfig.kind,
          success: result.success,
          total: result.summary.totalSteps,
          passed: result.summary.passedSteps,
          failed: result.summary.failedSteps,
          durationMs: Date.now() - suiteStartedMs,
          warnings: result.warnings,
          issueCount: result.issues.length,
          details: result,
        })
      } else if (suiteConfig.kind === 'scenario') {
        const interpolatedSource = interpolateValue(rawSource, sharedVariables, suiteTemplateState)
        const scenarioInput =
          typeof interpolatedSource === 'object' && interpolatedSource !== null
            ? {
                ...(interpolatedSource as Record<string, unknown>),
                defaults: {
                  ...((interpolatedSource as Record<string, unknown>).defaults as Record<string, unknown>),
                  dryRun: parsed.defaults.dryRun,
                },
              }
            : interpolatedSource
        const result = await runScenarios(scenarioInput)
        const scenarioIssues = collectScenarioIssues(suiteId, suiteName, result)
        issues.push(...scenarioIssues)

        suites.push({
          id: suiteId,
          name: suiteName,
          kind: suiteConfig.kind,
          success: result.success,
          total: result.total,
          passed: result.succeeded,
          failed: result.failed,
          durationMs: Date.now() - suiteStartedMs,
          warnings: [],
          issueCount: scenarioIssues.length,
          details: result,
        })
      } else {
        const result = await runApiJourney(rawSource, sharedVariables, parsed.defaults)
        sharedVariables[`${suiteId}_variables`] = result.variables
        issues.push(
          ...result.issues.map((issue) => ({
            suiteId,
            suiteName,
            classification: issue.classification,
            message: issue.message,
          })),
        )

        suites.push({
          id: suiteId,
          name: suiteName,
          kind: suiteConfig.kind,
          success: result.success,
          total: result.total,
          passed: result.passed,
          failed: result.failed,
          durationMs: Date.now() - suiteStartedMs,
          warnings: [],
          issueCount: result.issues.length,
          details: result,
        })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown_suite_error'
      issues.push({
        suiteId,
        suiteName,
        classification: classifyMessage(message),
        message,
      })
      suites.push({
        id: suiteId,
        name: suiteName,
        kind: suiteConfig.kind,
        success: false,
        total: 1,
        passed: 0,
        failed: 1,
        durationMs: Date.now() - suiteStartedMs,
        warnings: [],
        issueCount: 1,
        details: { error: message },
      })
    }

    const last = suites[suites.length - 1]
    if (!last.success && !parsed.defaults.continueOnFailure) {
      break
    }
  }

  const suitesPassed = suites.filter((suite) => suite.success).length
  const suitesFailed = suites.length - suitesPassed
  const checks = suites.reduce((sum, suite) => sum + suite.total, 0)
  const checksPassed = suites.reduce((sum, suite) => sum + suite.passed, 0)
  const checksFailed = checks - checksPassed
  const endedAtMs = Date.now()
  const summary: OrchestratorSummary = {
    runId,
    startedAt,
    endedAt: new Date(endedAtMs).toISOString(),
    durationMs: endedAtMs - startedAtMs,
    success: suitesFailed === 0 && issues.length === 0,
    totals: {
      suites: suites.length,
      suitesPassed,
      suitesFailed,
      checks,
      checksPassed,
      checksFailed,
    },
  }
  const markdown = buildMarkdownReport(summary, suites, issues)

  if (parsed.output?.writeJsonPath) {
    const outputPath = path.isAbsolute(parsed.output.writeJsonPath)
      ? parsed.output.writeJsonPath
      : path.resolve(defaultPackRoot, parsed.output.writeJsonPath)
    await fs.mkdir(path.dirname(outputPath), { recursive: true })
    await fs.writeFile(
      outputPath,
      JSON.stringify({ summary, suites, issues, variables: sharedVariables }, null, 2),
      'utf-8',
    )
  }
  if (parsed.output?.writeMarkdownPath) {
    const outputPath = path.isAbsolute(parsed.output.writeMarkdownPath)
      ? parsed.output.writeMarkdownPath
      : path.resolve(defaultPackRoot, parsed.output.writeMarkdownPath)
    await fs.mkdir(path.dirname(outputPath), { recursive: true })
    await fs.writeFile(outputPath, markdown, 'utf-8')
  }

  return {
    summary,
    suites,
    issues,
    variables: sharedVariables,
    report: { markdown },
  }
}

const packKindFromName = (fileName: string): z.infer<typeof suiteKindSchema> | null => {
  if (!fileName.endsWith('.json')) return null
  if (fileName.includes('lifecycle')) return 'lifecycle'
  if (fileName.includes('api-journey')) return 'api_journey'
  if (fileName.includes('agent-api-')) return 'scenario'
  return null
}

export async function listAgentTestPacks(packRoot = defaultPackRoot): Promise<{
  packRoot: string
  packs: Array<{ id: string; kind: z.infer<typeof suiteKindSchema>; filePath: string; fileName: string }>
}> {
  const root = path.resolve(packRoot)
  const entries = await fs.readdir(root, { withFileTypes: true })
  const packs: Array<{ id: string; kind: z.infer<typeof suiteKindSchema>; filePath: string; fileName: string }> = []

  for (const entry of entries) {
    if (!entry.isFile()) continue
    const kind = packKindFromName(entry.name)
    if (!kind) continue
    const filePath = path.resolve(root, entry.name)
    packs.push({
      id: entry.name.replace(/\.json$/, ''),
      kind,
      filePath,
      fileName: entry.name,
    })
  }

  packs.sort((a, b) => a.fileName.localeCompare(b.fileName))
  return { packRoot: root, packs }
}
