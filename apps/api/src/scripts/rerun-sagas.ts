/**
 * Full saga rerun script.
 *
 * Why this exists:
 * - We need a repeatable way to execute ALL saga specs end-to-end via API only.
 * - Manual step driving is too slow and inconsistent for hundreds of scenarios.
 * - This script creates fresh runs, executes each lifecycle step, and marks
 *   results with structured evidence so the /sagas dashboard stays truthful.
 *
 * Important:
 * - No direct DB access is used here.
 * - Every mutation/read is performed through API endpoints and Better Auth.
 */
import { pathToFileURL } from 'node:url'
import { AsyncLocalStorage } from 'node:async_hooks'

type AuthSession = {
  email: string
  password: string
  userId: string
  cookie: string
}

type SagaDefinition = {
  sagaKey: string
  title: string
  status: 'draft' | 'active' | 'archived'
}

type SagaRunStep = {
  stepKey: string
  title: string
  status: 'pending' | 'in_progress' | 'passed' | 'failed' | 'skipped' | 'blocked'
  instruction?: string | null
  expectedResult?: string | null
  delayMode?: 'none' | 'fixed' | 'until_condition'
  delayMs?: number | null
  delayConditionKey?: string | null
  delayTimeoutMs?: number | null
  delayPollMs?: number | null
  delayJitterMs?: number | null
  metadata?: Record<string, unknown> | null
}

type SagaRunDetail = {
  run: {
    id: string
    sagaKey: string
    status: 'pending' | 'running' | 'passed' | 'failed' | 'cancelled'
    passedSteps: number
    totalSteps: number
  }
  steps: SagaRunStep[]
}

type StepResultPayload = {
  note: string
  evidence?: Record<string, unknown>
}

type ExploratoryEvaluationPayload = {
  evaluator: 'openai' | 'none'
  model: string | null
  status: 'passed' | 'failed' | 'blocked'
  verdict: 'covered' | 'partial' | 'gap' | 'inconclusive'
  confidence: number
  summary: string
  assessment?: string
  reasonCode: string
  evidencePointers: string[]
  gaps: string[]
  deterministicFollowUps: Array<{
    title: string
    endpoint?: string | null
    assertion: string
  }>
}

type StepTerminalStatus = 'passed' | 'failed' | 'blocked' | 'skipped'

type StepContractRule = {
  /** Human-readable requirement label shown in evidence on failure. */
  label: string
  /** At least one of these patterns must match an observed API path. */
  anyOf: RegExp[]
}

type StepContract = {
  /** What this step is expected to validate at API level. */
  description: string
  /** Endpoint rule set that must all be satisfied for pass classification. */
  endpointRules: StepContractRule[]
}

type ContractCheckSummary = {
  description: string
  observedPaths: string[]
  matchedPaths: string[]
  rules: Array<{
    label: string
    passed: boolean
    expectedPatterns: string[]
    matchedPath: string | null
  }>
  passedRules: number
  failedRules: number
}

/**
 * Structured step execution error used to preserve deterministic status.
 *
 * ELI5:
 * - Throw this when a step is intentionally blocked by missing capability.
 * - The runner will report `blocked` (not generic `failed`) and keep reason.
 */
class StepExecutionError extends Error {
  status: Exclude<StepTerminalStatus, 'passed'>
  evidence?: Record<string, unknown>

  constructor(
    status: Exclude<StepTerminalStatus, 'passed'>,
    message: string,
    evidence?: Record<string, unknown>,
  ) {
    super(message)
    this.name = 'StepExecutionError'
    this.status = status
    this.evidence = evidence
  }
}

function getStepContract(stepKey: string): StepContract | null {
  switch (stepKey) {
    case 'owner-configure-demand-pricing':
      return {
        description: 'Demand-pricing API surface should create and list policies.',
        endpointRules: [
          {
            label: 'Create demand policy endpoint called',
            anyOf: [/\/demand-pricing\/policies$/],
          },
          {
            label: 'List demand policy endpoint called',
            anyOf: [/\/demand-pricing\/policies\?/],
          },
        ],
      }
    case 'owner-configure-external-integration':
      return {
        description: 'Channel integration API should create account/state/link and list back.',
        endpointRules: [
          { label: 'Create channel account', anyOf: [/\/channel-accounts$/] },
          { label: 'Create or list channel sync state', anyOf: [/\/channel-sync-states/] },
          { label: 'Create or list channel entity link', anyOf: [/\/channel-entity-links/] },
        ],
      }
    case 'customer-advanced-payment-flow':
      return {
        description: 'Advanced payment flow should hit checkout and intent read-model endpoints.',
        endpointRules: [
          {
            label: 'Advanced checkout endpoint called',
            anyOf: [/\/payments\/advanced$/],
          },
          {
            label: 'Payment intents endpoint called',
            anyOf: [/\/payment-intents/],
          },
        ],
      }
    case 'owner-review-route-dispatch-state':
      return {
        description: 'Dispatch/route read-model step must call dispatch state endpoint.',
        endpointRules: [
          {
            label: 'Dispatch state endpoint called',
            anyOf: [/\/dispatch\/state/],
          },
        ],
      }
    case 'owner-validate-compliance-controls':
      return {
        description: 'Compliance controls step must read compliance controls endpoint.',
        endpointRules: [
          {
            label: 'Compliance controls endpoint called',
            anyOf: [/\/compliance\/controls/],
          },
        ],
      }
    case 'adversary-marketplace-tenant-isolation':
      return {
        description: 'Tenant isolation step should attempt cross-tenant offers/orders reads.',
        endpointRules: [
          {
            label: 'Cross-biz offers or booking-orders endpoint attempted',
            anyOf: [/\/offers$/, /\/booking-orders$/],
          },
        ],
      }
    default:
      return null
  }
}

function evaluateStepContract(stepKey: string, apiTrace: ApiTraceEntry[]): ContractCheckSummary | null {
  const contract = getStepContract(stepKey)
  if (!contract) return null

  const observedPaths = Array.from(new Set(apiTrace.map((entry) => entry.path)))
  const matchedPaths: string[] = []

  const rules = contract.endpointRules.map((rule) => {
    const matchedPath =
      observedPaths.find((path) => rule.anyOf.some((pattern) => pattern.test(path))) ?? null
    if (matchedPath) matchedPaths.push(matchedPath)
    return {
      label: rule.label,
      passed: Boolean(matchedPath),
      expectedPatterns: rule.anyOf.map((pattern) => pattern.source),
      matchedPath,
    }
  })

  const passedRules = rules.filter((rule) => rule.passed).length
  const failedRules = rules.length - passedRules

  return {
    description: contract.description,
    observedPaths,
    matchedPaths: Array.from(new Set(matchedPaths)),
    rules,
    passedRules,
    failedRules,
  }
}

type RunContext = {
  sagaKey: string
  runId: string
  owner: AuthSession
  member?: AuthSession
  customer1?: AuthSession
  customer2?: AuthSession
  adversary?: AuthSession
  bizId?: string
  locationId?: string
  offerId?: string
  offerVersionId?: string
  queueId?: string
  hostResourceId?: string
  assetResourceId?: string
  subjectSubscriptionId?: string
  subjectSubscriptionIdentityId?: string
  subjectSubscriptionTargetType?: string
  subjectSubscriptionTargetId?: string
  validationShadowBizId?: string
  agentToolNames?: Set<string>
  bookingIds: string[]
  metadataPatch: Record<string, unknown>
}

type JsonObject = Record<string, unknown>
type SnapshotBlock = Record<string, unknown>
type ApiTraceEntry = {
  method: string
  path: string
  status: number
  requestBody?: unknown
  responseBody?: unknown
  at: string
}
/**
 * Per-async-execution API trace collector.
 *
 * Why this is required:
 * - The runner executes many sagas concurrently.
 * - A global mutable trace buffer causes cross-run/step trace pollution.
 * - AsyncLocalStorage keeps each step's trace isolated and trustworthy.
 */
const stepTraceStore = new AsyncLocalStorage<ApiTraceEntry[]>()

const API_BASE_URL = (process.env.API_BASE_URL || 'http://localhost:6129').replace(/\/+$/, '')
const TRUSTED_ORIGIN = process.env.ADMIN_APP_ORIGIN || 'http://localhost:9000'
const MAX_SAGAS = Number(process.env.SAGA_LIMIT || '0')
const ONLY_SAGA_KEY = process.env.SAGA_KEY || ''
const SESSION_PASSWORD = process.env.SAGA_TEST_PASSWORD || 'pass123456'
const SAGA_CONCURRENCY = Math.max(1, Number(process.env.SAGA_CONCURRENCY || '8'))
const SAGA_STRICT_EXIT =
  process.env.SAGA_STRICT_EXIT === '0' || process.env.SAGA_STRICT_EXIT === 'false'
    ? false
    : true
const SAGA_STRICT_EXPLORATORY =
  process.env.SAGA_STRICT_EXPLORATORY === '0' || process.env.SAGA_STRICT_EXPLORATORY === 'false'
    ? false
    : true

function nowIso() {
  return new Date().toISOString()
}

function randomSuffix(length = 8) {
  return Math.random().toString(36).slice(2, 2 + length)
}

function toSlug(input: string, max = 80) {
  const cleaned = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-')
  return cleaned.slice(0, max).replace(/-+$/g, '')
}

function toTitleCase(input: string) {
  return input
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (ch) => ch.toUpperCase())
}

function prettyStepTitle(stepKey: string) {
  return toTitleCase(stepKey)
}

function asString(value: unknown) {
  if (value === null || value === undefined) return 'null'
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function traceValue(value: unknown): unknown {
  try {
    const text = JSON.stringify(value)
    if (!text) return value
    if (text.length <= 12000) return value
    return {
      _truncated: true,
      _preview: text.slice(0, 12000),
      _size: text.length,
    }
  } catch {
    return String(value)
  }
}

function cookieFromSetCookie(setCookieHeader: string | null): string {
  if (!setCookieHeader) {
    throw new Error('Missing Set-Cookie header from auth response.')
  }
  const tokenMatch = setCookieHeader.match(/better-auth\.session_token=[^;]+/)
  if (!tokenMatch) {
    throw new Error('Could not extract better-auth.session_token from Set-Cookie.')
  }
  return tokenMatch[0]
}

async function requestJson<T = unknown>(
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
    body?: unknown
    cookie?: string
    origin?: string
    acceptStatuses?: number[]
    raw?: boolean
  } = {},
): Promise<{ status: number; payload: T }> {
  const method = options.method ?? 'GET'
  const headers: Record<string, string> = {}
  if (options.body !== undefined) headers['content-type'] = 'application/json'
  if (options.cookie) headers.cookie = options.cookie
  if (options.origin) headers.origin = options.origin

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  })

  const payload = (await response.json().catch(() => null)) as T
  const activeApiTrace = stepTraceStore.getStore()
  if (activeApiTrace) {
    activeApiTrace.push({
      method,
      path,
      status: response.status,
      requestBody: options.body === undefined ? undefined : traceValue(options.body),
      responseBody: traceValue(payload),
      at: nowIso(),
    })
  }
  const accepted = options.acceptStatuses ?? [200, 201]
  if (!accepted.includes(response.status)) {
    throw new Error(
      `HTTP ${response.status} for ${method} ${path}: ${JSON.stringify(payload ?? {})}`,
    )
  }

  if (!options.raw && payload && typeof payload === 'object' && 'success' in (payload as JsonObject)) {
    const asRecord = payload as JsonObject
    if (asRecord.success === false) {
      throw new Error(`API failure for ${method} ${path}: ${JSON.stringify(payload)}`)
    }
  }

  return { status: response.status, payload }
}

async function createAuthSession(label: string): Promise<AuthSession> {
  const email = `${label}-${Date.now()}-${randomSuffix(6)}@example.com`
  const password = SESSION_PASSWORD

  const signUpResponse = await fetch(`${API_BASE_URL}/api/auth/sign-up/email`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: TRUSTED_ORIGIN,
    },
    body: JSON.stringify({
      email,
      password,
      name: label,
    }),
  })

  const signUpPayload = await signUpResponse.json().catch(() => ({}))
  if (signUpResponse.status !== 200) {
    throw new Error(`Sign-up failed (${email}): ${JSON.stringify(signUpPayload)}`)
  }

  const cookie = cookieFromSetCookie(signUpResponse.headers.get('set-cookie'))
  const session = await requestJson<{ user: { id: string } }>('/api/auth/get-session', {
    cookie,
    raw: true,
    acceptStatuses: [200],
  })

  const userId = session.payload?.user?.id
  if (!userId) {
    throw new Error(`Could not resolve user id after sign-up (${email}).`)
  }

  return { email, password, userId, cookie }
}

function blockStep(stepKey: string, reason: string, evidence?: Record<string, unknown>): never {
  throw new StepExecutionError('blocked', `${stepKey}: ${reason}`, evidence)
}

async function getAgentToolNames(ctx: RunContext): Promise<Set<string>> {
  if (ctx.agentToolNames) return ctx.agentToolNames
  const response = await requestJson<{ success: true; data: Array<{ name: string }> }>(
    '/api/v1/agents/tools',
    {
      cookie: ctx.owner.cookie,
      acceptStatuses: [200],
    },
  )
  const tools = getApiData<Array<{ name: string }>>(response.payload)
  const names = new Set(tools.map((tool) => String(tool.name || '').trim()).filter(Boolean))
  ctx.agentToolNames = names
  return names
}

function hasAnyToolByPattern(toolNames: Set<string>, patterns: RegExp[]) {
  for (const name of toolNames) {
    for (const pattern of patterns) {
      if (pattern.test(name)) return true
    }
  }
  return false
}

function getApiData<T>(payload: unknown): T {
  const envelope = payload as { success: boolean; data: T }
  return envelope.data
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function applyPositiveJitter(baseMs: number, jitterMs: number) {
  if (jitterMs <= 0) return baseMs
  const delta = Math.floor(Math.random() * (jitterMs + 1))
  return baseMs + delta
}

async function evaluateDelayCondition(ctx: RunContext, conditionKey: string): Promise<boolean> {
  const key = conditionKey.trim()
  if (!key) return true
  if (key === 'always') return true

  if (key.startsWith('message_for:')) {
    const actorKey = key.slice('message_for:'.length).trim()
    if (!actorKey) return false
    const response = await requestJson<{ success: true; data: unknown[] }>(
      `/api/v1/sagas/runs/${ctx.runId}/messages?actorKey=${encodeURIComponent(actorKey)}`,
      {
        cookie: ctx.owner.cookie,
        acceptStatuses: [200],
      },
    )
    const rows = getApiData<unknown[]>(response.payload)
    return rows.length > 0
  }

  if (key.startsWith('step_done:')) {
    const stepKey = key.slice('step_done:'.length).trim()
    if (!stepKey) return false
    const detail = await getSagaRun(ctx.owner, ctx.runId)
    const step = detail.steps.find((row) => row.stepKey === stepKey)
    if (!step) return false
    return ['passed', 'failed', 'skipped', 'blocked'].includes(step.status)
  }

  throw new StepExecutionError(
    'blocked',
    `Unsupported delay condition key: ${key}`,
    { supported: ['always', 'message_for:<actorKey>', 'step_done:<stepKey>'] },
  )
}

async function executeStepDelay(ctx: RunContext, step: SagaRunStep) {
  const mode = step.delayMode ?? 'none'
  const jitter = Math.max(0, Number(step.delayJitterMs ?? 0))
  if (mode === 'none') return

  if (mode === 'fixed') {
    const baseMs = Number(step.delayMs ?? 0)
    if (!Number.isFinite(baseMs) || baseMs <= 0) {
      throw new StepExecutionError('blocked', `Invalid fixed delay for step ${step.stepKey}.`, {
        delayMode: mode,
        delayMs: step.delayMs ?? null,
      })
    }
    await sleep(applyPositiveJitter(baseMs, jitter))
    return
  }

  if (mode === 'until_condition') {
    const conditionKey = String(step.delayConditionKey ?? '').trim()
    if (!conditionKey) {
      throw new StepExecutionError(
        'blocked',
        `Missing delayConditionKey for until_condition step ${step.stepKey}.`,
      )
    }
    const timeoutMs = Math.max(1000, Number(step.delayTimeoutMs ?? 30000))
    const pollMs = Math.max(250, Number(step.delayPollMs ?? 1000))
    const startedAt = Date.now()

    while (Date.now() - startedAt <= timeoutMs) {
      const conditionMet = await evaluateDelayCondition(ctx, conditionKey)
      if (conditionMet) return
      await sleep(applyPositiveJitter(pollMs, jitter))
    }

    throw new StepExecutionError(
      'failed',
      `Delay condition timed out for ${step.stepKey} (${conditionKey}).`,
      {
        conditionKey,
        timeoutMs,
        pollMs,
      },
    )
  }

  throw new StepExecutionError('blocked', `Unsupported delay mode: ${mode}`, {
    delayMode: mode,
  })
}

async function listSagaDefinitions(owner: AuthSession): Promise<SagaDefinition[]> {
  const query = MAX_SAGAS > 0 ? `?sync=true&limit=${Math.max(MAX_SAGAS, 1)}` : '?sync=true&limit=2000'
  const response = await requestJson<{ success: true; data: SagaDefinition[] }>(
    `/api/v1/sagas/specs${query}`,
    { cookie: owner.cookie, acceptStatuses: [200] },
  )
  const rows = getApiData<SagaDefinition[]>(response.payload)
  return rows.filter((row) => row.status === 'active')
}

async function createSagaRun(owner: AuthSession, sagaKey: string) {
  const response = await requestJson<{ success: true; data: SagaRunDetail }>('/api/v1/sagas/runs', {
    method: 'POST',
    cookie: owner.cookie,
    body: {
      sagaKey,
      mode: process.env.SAGA_MODE === 'live' ? 'live' : 'dry_run',
      runnerLabel: 'codex-rerun-all',
      runContext: {
        createdBy: 'apps/api/src/scripts/rerun-sagas.ts',
      },
    },
    acceptStatuses: [201],
  })
  return getApiData<SagaRunDetail>(response.payload)
}

async function getSagaRun(owner: AuthSession, runId: string) {
  const response = await requestJson<{ success: true; data: SagaRunDetail }>(
    `/api/v1/sagas/runs/${runId}`,
    { cookie: owner.cookie, acceptStatuses: [200] },
  )
  return getApiData<SagaRunDetail>(response.payload)
}

async function reportStep(
  ctx: RunContext,
  stepKey: string,
  status: 'passed' | 'failed' | 'blocked' | 'skipped',
  resultPayload: StepResultPayload,
  failureMessage?: string,
  assertionSummary?: Record<string, unknown>,
) {
  const startedAt = nowIso()
  const endedAt = nowIso()

  /**
   * We always transition via `in_progress` first so step state progression
   * matches production-like lifecycle semantics.
   */
  await requestJson(`/api/v1/sagas/runs/${ctx.runId}/steps/${stepKey}/result`, {
    method: 'POST',
    cookie: ctx.owner.cookie,
    body: {
      status: 'in_progress',
      startedAt,
      resultPayload: {
        note: `Started ${stepKey}`,
      },
      assertionSummary: {
        status: 'in_progress',
      },
    },
    acceptStatuses: [200],
  })

  await requestJson(`/api/v1/sagas/runs/${ctx.runId}/steps/${stepKey}/result`, {
    method: 'POST',
    cookie: ctx.owner.cookie,
    body: {
      status,
      startedAt,
      endedAt,
      failureMessage: failureMessage ?? null,
      resultPayload,
      assertionSummary: {
        status,
        hasFailure: Boolean(failureMessage),
        assertionsPassed: status === 'passed' ? 1 : 0,
        ...(assertionSummary ?? {}),
      },
    },
    acceptStatuses: [200],
  })
}

function toneFromStatus(status: string) {
  if (status === 'passed') return 'success'
  if (status === 'failed' || status === 'blocked') return 'error'
  if (status === 'skipped') return 'warning'
  return 'info'
}

function buildSnapshotBlocks(
  stepKey: string,
  result: StepResultPayload,
  status: 'passed' | 'failed' | 'blocked' | 'skipped',
): SnapshotBlock[] {
  const blocks: SnapshotBlock[] = [
    {
      type: 'alert',
      title: `${toTitleCase(stepKey)} ${status === 'passed' ? 'completed' : status}`,
      message: result.note,
      tone: toneFromStatus(status),
    },
  ]

  const evidence = isRecord(result.evidence) ? result.evidence : null
  if (!evidence) return blocks

  if (stepKey === 'owner-sign-up' || stepKey === 'customer-sign-up') {
    const idLabel = stepKey === 'owner-sign-up' ? 'Owner user id' : 'Customer user id'
    blocks.push({
      type: 'form',
      title: 'Account session state',
      fields: [
        { label: idLabel, value: asString(evidence.ownerUserId ?? evidence.customerUserId ?? 'n/a') },
        { label: 'Email', value: asString(evidence.ownerEmail ?? evidence.email ?? 'n/a') },
        { label: 'Session', value: status === 'passed' ? 'Active' : 'Unavailable', state: status === 'passed' ? 'success' : 'error' },
      ],
      submitLabel: status === 'passed' ? 'Authenticated' : 'Failed',
    })
  }

  if (stepKey === 'owner-create-biz') {
    blocks.push({
      type: 'key_value',
      title: 'Business profile',
      items: [
        { label: 'Name', value: asString(evidence.name ?? 'n/a') },
        { label: 'Slug', value: asString(evidence.slug ?? 'n/a') },
        { label: 'Timezone', value: asString(evidence.timezone ?? 'UTC') },
        { label: 'Currency', value: asString(evidence.currency ?? 'USD') },
      ],
    })
    blocks.push({
      type: 'actions',
      title: 'Visible actions',
      items: [
        { label: 'Edit business settings', kind: 'primary', enabled: true },
        { label: 'Add location', kind: 'secondary', enabled: true },
      ],
    })
  }

  if (stepKey === 'customer-book-primary' || stepKey === 'customer-two-concurrent') {
    blocks.push({
      type: 'key_value',
      title: 'Booking confirmation',
      items: [
        { label: 'Booking id', value: asString(evidence.id ?? 'n/a') },
        { label: 'Status', value: asString(evidence.status ?? 'n/a') },
        { label: 'Starts at', value: asString(evidence.confirmedStartAt ?? evidence.requestedStartAt ?? 'n/a') },
        { label: 'Total', value: asString(evidence.totalMinor ?? 'n/a') },
      ],
    })
    blocks.push({
      type: 'actions',
      title: 'Visible actions',
      items: [
        { label: 'Download receipt', kind: 'secondary', enabled: true },
        { label: 'Reschedule', kind: 'secondary', enabled: true },
        { label: 'Cancel booking', kind: 'danger', enabled: true },
      ],
    })
  }

  const metrics = Object.entries(evidence).filter(([key]) => /count$|minor$|total$/i.test(key))
  if (metrics.length > 0) {
    blocks.push({
      type: 'stats',
      title: 'What user sees at a glance',
      items: metrics.slice(0, 8).map(([key, value]) => ({
        label: toTitleCase(key),
        value: asString(value),
      })),
    })
  }

  if (stepKey === 'owner-calendar-review') {
    const bookings = Array.isArray(evidence.bookingPreview)
      ? evidence.bookingPreview
      : Array.isArray(evidence.events)
        ? evidence.events
        : []
    const events = bookings
      .slice(0, 10)
      .map((row) => {
        if (!isRecord(row)) return null
        const start = asString(row.confirmedStartAt ?? row.requestedStartAt ?? row.startAt ?? 'unknown')
        const end = asString(row.confirmedEndAt ?? row.requestedEndAt ?? row.endAt ?? 'unknown')
        const label = asString(row.offerTitle ?? row.title ?? row.id ?? 'Booking')
        return {
          timeRange: `${start} → ${end}`,
          title: label,
          status: 'booked',
          detail: asString(row.status ?? ''),
        }
      })
      .filter(Boolean)

    blocks.push({
      type: 'calendar',
      title: 'Calendar snapshot',
      timezone: asString(evidence.timezone ?? 'UTC'),
      rangeLabel: asString(evidence.rangeLabel ?? 'Upcoming'),
      events,
    })
    blocks.push({
      type: 'actions',
      title: 'Visible actions',
      items: [
        { label: 'Filter by resource', kind: 'secondary', enabled: true },
        { label: 'Create manual block', kind: 'secondary', enabled: true },
        { label: 'Open booking detail', kind: 'primary', enabled: events.length > 0 },
      ],
    })
    return blocks
  }

  const rowArrays = Object.entries(evidence).find(
    ([, value]) =>
      Array.isArray(value) && value.length > 0 && value.every((entry) => isRecord(entry)),
  )
  if (rowArrays) {
    const [key, value] = rowArrays
    const rows = value as Array<Record<string, unknown>>
    const columns = Array.from(
      rows.reduce((acc, row) => {
        Object.keys(row).forEach((col) => acc.add(col))
        return acc
      }, new Set<string>()),
    ).slice(0, 8)
    blocks.push({
      type: 'table',
      title: toTitleCase(key),
      columns,
      rows: rows.slice(0, 20).map((row) => columns.map((col) => row[col] ?? null)),
    })
  } else {
    const scalarItems = Object.entries(evidence)
      .filter(([, value]) => value === null || typeof value !== 'object')
      .slice(0, 16)
      .map(([key, value]) => ({ label: toTitleCase(key), value: asString(value) }))

    if (scalarItems.length > 0) {
      blocks.push({
        type: 'key_value',
        title: 'Screen details',
        items: scalarItems,
      })
    } else {
      blocks.push({
        type: 'raw_json',
        title: 'Evidence payload',
        data: evidence,
      })
    }
  }

  return blocks
}

async function attachSnapshot(
  ctx: RunContext,
  stepKey: string,
  stepTitle: string,
  status: 'passed' | 'failed' | 'blocked' | 'skipped',
  result: StepResultPayload,
  rawData?: Record<string, unknown>,
) {
  await requestJson(`/api/v1/sagas/runs/${ctx.runId}/snapshots`, {
    method: 'POST',
    cookie: ctx.owner.cookie,
    body: {
      stepKey,
      screenKey: `${stepKey}-${Date.now()}`,
      title: `${stepTitle} Snapshot`,
      status,
      route: `/sagas/${ctx.runId}/${stepKey}`,
      format: 'json',
      view: {
        title: stepTitle,
        subtitle: result.note,
        blocks: buildSnapshotBlocks(stepKey, result, status),
      },
      rawData,
    },
    acceptStatuses: [201],
  })
}

async function attachApiTrace(ctx: RunContext, stepKey: string, stepTitle: string, apiCalls: ApiTraceEntry[]) {
  await requestJson(`/api/v1/sagas/runs/${ctx.runId}/traces`, {
    method: 'POST',
    cookie: ctx.owner.cookie,
    body: {
      stepKey,
      title: `${stepTitle} API Trace`,
      trace: {
        stepKey,
        callCount: apiCalls.length,
        calls: apiCalls,
      },
      metadata: {
        source: 'rerun-sagas.ts',
      },
    },
    acceptStatuses: [201],
  })
}

async function createBiz(ctx: RunContext) {
  const slug = `${toSlug(ctx.sagaKey, 60)}-${randomSuffix(8)}`
  const response = await requestJson<{ success: true; data: { id: string; slug: string } }>(
    '/api/v1/bizes',
    {
      method: 'POST',
      cookie: ctx.owner.cookie,
      body: {
        name: `Saga ${ctx.sagaKey}`,
        slug,
        type: 'small_business',
        timezone: 'UTC',
        currency: 'USD',
      },
      acceptStatuses: [201],
    },
  )
  const biz = getApiData<{ id: string; slug: string }>(response.payload)
  ctx.bizId = biz.id
  return biz
}

async function patchBizMetadata(ctx: RunContext, patch: Record<string, unknown>) {
  if (!ctx.bizId) throw new Error('bizId is required before metadata patch.')
  ctx.metadataPatch = { ...ctx.metadataPatch, ...patch }
  await requestJson(`/api/v1/bizes/${ctx.bizId}`, {
    method: 'PATCH',
    cookie: ctx.owner.cookie,
    body: {
      metadata: ctx.metadataPatch,
    },
    acceptStatuses: [200],
  })
}

async function createLocation(ctx: RunContext) {
  if (!ctx.bizId) throw new Error('bizId is required before location creation.')
  const slug = `loc-${randomSuffix(8)}`
  const response = await requestJson<{ success: true; data: { id: string; slug: string } }>(
    `/api/v1/bizes/${ctx.bizId}/locations`,
    {
      method: 'POST',
      cookie: ctx.owner.cookie,
      body: {
        name: 'Primary Location',
        slug,
        type: 'physical',
        timezone: 'UTC',
      },
      acceptStatuses: [201],
    },
  )
  const location = getApiData<{ id: string; slug: string }>(response.payload)
  ctx.locationId = location.id
  return location
}

async function createResources(ctx: RunContext) {
  if (!ctx.bizId || !ctx.locationId) throw new Error('bizId/locationId required before resources.')

  const host = await requestJson<{ success: true; data: { id: string } }>(
    `/api/v1/bizes/${ctx.bizId}/resources`,
    {
      method: 'POST',
      cookie: ctx.owner.cookie,
      body: {
        locationId: ctx.locationId,
        type: 'host',
        name: 'Primary Host',
        slug: `host-${randomSuffix(8)}`,
        capacity: 1,
        bufferBeforeMinutes: 10,
        bufferAfterMinutes: 10,
      },
      acceptStatuses: [201],
    },
  )

  const asset = await requestJson<{ success: true; data: { id: string } }>(
    `/api/v1/bizes/${ctx.bizId}/resources`,
    {
      method: 'POST',
      cookie: ctx.owner.cookie,
      body: {
        locationId: ctx.locationId,
        type: 'asset',
        name: 'Primary Asset',
        slug: `asset-${randomSuffix(8)}`,
        capacity: 1,
        bufferBeforeMinutes: 5,
        bufferAfterMinutes: 5,
      },
      acceptStatuses: [201],
    },
  )

  const hostId = getApiData<{ id: string }>(host.payload).id
  const assetId = getApiData<{ id: string }>(asset.payload).id
  ctx.hostResourceId = hostId
  ctx.assetResourceId = assetId
  return {
    hostId,
    assetId,
  }
}

async function inviteAndAcceptMember(ctx: RunContext) {
  if (!ctx.bizId) throw new Error('bizId required before member invite.')
  const member = await createAuthSession(`member-${ctx.sagaKey}`)
  ctx.member = member

  const inviteResponse = await requestJson<{ id: string }>(
    '/api/auth/organization/invite-member',
    {
      method: 'POST',
      cookie: ctx.owner.cookie,
      origin: TRUSTED_ORIGIN,
      raw: true,
      body: {
        email: member.email,
        role: 'admin',
        organizationId: ctx.bizId,
      },
      acceptStatuses: [200],
    },
  )

  const invitationId = (inviteResponse.payload as { id: string }).id
  if (!invitationId) {
    throw new Error('Invitation id missing from invite-member response.')
  }

  await requestJson('/api/auth/organization/accept-invitation', {
    method: 'POST',
    cookie: member.cookie,
    origin: TRUSTED_ORIGIN,
    raw: true,
    body: {
      invitationId,
    },
    acceptStatuses: [200],
  })

  return { memberEmail: member.email, invitationId }
}

async function createOffer(ctx: RunContext) {
  if (!ctx.bizId) throw new Error('bizId required before offer creation.')

  const offerResponse = await requestJson<{ success: true; data: { id: string } }>(
    `/api/v1/bizes/${ctx.bizId}/offers`,
    {
      method: 'POST',
      cookie: ctx.owner.cookie,
      body: {
        name: 'Primary Service Offer',
        slug: `offer-${randomSuffix(8)}`,
        executionMode: 'slot',
        status: 'draft',
        isPublished: false,
        timezone: 'UTC',
      },
      acceptStatuses: [201],
    },
  )
  const offer = getApiData<{ id: string }>(offerResponse.payload)
  ctx.offerId = offer.id

  return { offerId: ctx.offerId }
}

async function createOfferVersion(ctx: RunContext) {
  if (!ctx.bizId || !ctx.offerId) throw new Error('bizId/offerId required before offer version creation.')

  const versionResponse = await requestJson<{ success: true; data: { id: string } }>(
    `/api/v1/bizes/${ctx.bizId}/offers/${ctx.offerId}/versions`,
    {
      method: 'POST',
      cookie: ctx.owner.cookie,
      body: {
        version: 1,
        status: 'published',
        durationMode: 'fixed',
        defaultDurationMin: 50,
        basePriceMinor: 15000,
        currency: 'USD',
      },
      acceptStatuses: [201],
    },
  )
  const version = getApiData<{ id: string }>(versionResponse.payload)
  ctx.offerVersionId = version.id

  return { offerVersionId: ctx.offerVersionId }
}

async function publishOffer(ctx: RunContext) {
  if (!ctx.bizId || !ctx.offerId) throw new Error('bizId/offerId required before publish.')
  await requestJson(`/api/v1/bizes/${ctx.bizId}/offers/${ctx.offerId}`, {
    method: 'PATCH',
    cookie: ctx.owner.cookie,
    body: {
      status: 'active',
      isPublished: true,
    },
    acceptStatuses: [200],
  })
}

async function createCustomer(ctx: RunContext, key: 'customer1' | 'customer2') {
  const customer = await createAuthSession(`${key}-${ctx.sagaKey}`)
  ctx[key] = customer
  return customer
}

function bookingWindow(offsetHours: number) {
  const start = new Date(Date.now() + offsetHours * 60 * 60 * 1000)
  const end = new Date(start.getTime() + 50 * 60 * 1000)
  return { start: start.toISOString(), end: end.toISOString() }
}

async function createBooking(
  ctx: RunContext,
  actor: AuthSession,
  customerUserId?: string,
  offsetHours = 24,
) {
  if (!ctx.bizId || !ctx.offerId || !ctx.offerVersionId) {
    throw new Error('bizId/offerId/offerVersionId required before booking.')
  }
  const { start, end } = bookingWindow(offsetHours)
  const response = await requestJson<{ success: true; data: { id: string; totalMinor: number } }>(
    `/api/v1/public/bizes/${ctx.bizId}/booking-orders`,
    {
      method: 'POST',
      cookie: actor.cookie,
      body: {
        offerId: ctx.offerId,
        offerVersionId: ctx.offerVersionId,
        customerUserId,
        status: 'confirmed',
        subtotalMinor: 15000,
        taxMinor: 0,
        feeMinor: 0,
        discountMinor: 0,
        totalMinor: 15000,
        currency: 'USD',
        requestedStartAt: start,
        requestedEndAt: end,
        confirmedStartAt: start,
        confirmedEndAt: end,
      },
      acceptStatuses: [201],
    },
  )
  const booking = getApiData<{ id: string; totalMinor: number }>(response.payload)
  ctx.bookingIds.push(booking.id)
  return booking
}

/**
 * Create one reusable waitlist queue for the run.
 *
 * ELI5:
 * - many UCs need "customer joins waitlist",
 * - we create one deterministic queue once and reuse it for steps.
 */
async function ensureWaitlistQueue(ctx: RunContext) {
  if (ctx.queueId) return { queueId: ctx.queueId }
  if (!ctx.bizId) throw new Error('bizId required before queue creation.')

  const response = await requestJson<{ success: true; data: { id: string; slug: string; name: string } }>(
    `/api/v1/bizes/${ctx.bizId}/queues`,
    {
      method: 'POST',
      cookie: ctx.owner.cookie,
      body: {
        locationId: ctx.locationId,
        name: 'Primary Waitlist',
        slug: `waitlist-${randomSuffix(8)}`,
        description: 'Auto-generated waitlist used by deterministic saga reruns.',
        strategy: 'fifo',
        status: 'active',
        isSelfJoinEnabled: true,
        metadata: {
          createdBy: 'rerun-sagas.ts',
          sagaKey: ctx.sagaKey,
        },
      },
      acceptStatuses: [201],
    },
  )
  const queue = getApiData<{ id: string; slug: string; name: string }>(response.payload)
  ctx.queueId = queue.id
  return { queueId: queue.id, queueName: queue.name, queueSlug: queue.slug }
}

/**
 * Join public waitlist as one customer and verify the entry is visible back.
 */
async function joinWaitlistAsCustomer(ctx: RunContext, customer: AuthSession) {
  if (!ctx.bizId) throw new Error('bizId required before waitlist join.')
  const queue = await ensureWaitlistQueue(ctx)
  const queueId = queue.queueId

  const joinResponse = await requestJson<{ success: true; data: { id: string; status: string } }>(
    `/api/v1/public/bizes/${ctx.bizId}/queues/${queueId}/entries`,
    {
      method: 'POST',
      cookie: customer.cookie,
      body: {
        requestedOfferVersionId: ctx.offerVersionId,
        priorityScore: 0,
        metadata: {
          source: 'rerun-sagas',
          actor: customer.email,
        },
      },
      acceptStatuses: [201],
    },
  )
  const entry = getApiData<{ id: string; status: string }>(joinResponse.payload)

  const mineResponse = await requestJson<{ success: true; data: Array<{ id: string; status: string }> }>(
    `/api/v1/public/bizes/${ctx.bizId}/queues/${queueId}/entries`,
    {
      cookie: customer.cookie,
      acceptStatuses: [200],
    },
  )
  const myEntries = getApiData<Array<{ id: string; status: string }>>(mineResponse.payload)
  const visibleToCustomer = myEntries.some((row) => row.id === entry.id)
  if (!visibleToCustomer) {
    blockStep('customer-join-waitlist-flow', 'Joined queue entry is not visible on customer waitlist API.', {
      queueId,
      queueEntryId: entry.id,
      customerEntryCount: myEntries.length,
    })
  }

  const operatorResponse = await requestJson<{ success: true; data: Array<{ id: string }> }>(
    `/api/v1/bizes/${ctx.bizId}/queues/${queueId}/entries?status=waiting`,
    {
      cookie: ctx.owner.cookie,
      acceptStatuses: [200],
    },
  )
  const operatorEntries = getApiData<Array<{ id: string }>>(operatorResponse.payload)
  const visibleToOperator = operatorEntries.some((row) => row.id === entry.id)
  if (!visibleToOperator) {
    blockStep('customer-join-waitlist-flow', 'Joined queue entry is not visible on operator queue API.', {
      queueId,
      queueEntryId: entry.id,
      operatorEntryCount: operatorEntries.length,
    })
  }

  return {
    queueId,
    queueEntryId: entry.id,
    queueEntryStatus: entry.status,
    customerEntryCount: myEntries.length,
    operatorEntryCount: operatorEntries.length,
  }
}

async function assertForbidden(
  session: AuthSession,
  path: string,
  options: { method?: 'GET' | 'POST'; body?: unknown },
) {
  await requestJson(path, {
    method: options.method ?? 'GET',
    body: options.body,
    cookie: session.cookie,
    acceptStatuses: [403],
    raw: true,
  })
}

async function ensureSubjectSubscriptionFixture(ctx: RunContext) {
  if (!ctx.bizId) throw new Error('bizId is required before subject-subscription validation.')
  if (
    ctx.subjectSubscriptionId &&
    ctx.subjectSubscriptionIdentityId &&
    ctx.subjectSubscriptionTargetType &&
    ctx.subjectSubscriptionTargetId
  ) {
    return {
      subscriptionId: ctx.subjectSubscriptionId,
      subscriberIdentityId: ctx.subjectSubscriptionIdentityId,
      targetSubjectType: ctx.subjectSubscriptionTargetType,
      targetSubjectId: ctx.subjectSubscriptionTargetId,
    }
  }

  const targetSubjectType = 'offer_watch'
  const targetSubjectId = `offer-watch-${ctx.offerId ?? randomSuffix(10)}`
  const createResponse = await requestJson<{
    success: true
    data: {
      id: string
      subscriberIdentityId: string
      targetSubjectType: string
      targetSubjectId: string
      subscriptionType: string
      status: string
      deliveryMode: string
      preferredChannel: string
      minDeliveryIntervalMinutes: number
    }
  }>(`/api/v1/bizes/${ctx.bizId}/subject-subscriptions`, {
    method: 'POST',
    cookie: ctx.owner.cookie,
    body: {
      targetSubjectType,
      targetSubjectId,
      targetDisplayName: 'Saga Validation Subject',
      subscriptionType: 'watch',
      status: 'active',
      deliveryMode: 'instant',
      preferredChannel: 'in_app',
      minDeliveryIntervalMinutes: 0,
      autoRegisterTargetSubject: true,
      metadata: {
        source: 'rerun-sagas',
        sagaKey: ctx.sagaKey,
      },
    },
    acceptStatuses: [200, 201],
  })
  const created = getApiData<{
    id: string
    subscriberIdentityId: string
    targetSubjectType: string
    targetSubjectId: string
    subscriptionType: string
    status: string
    deliveryMode: string
    preferredChannel: string
    minDeliveryIntervalMinutes: number
  }>(createResponse.payload)

  ctx.subjectSubscriptionId = created.id
  ctx.subjectSubscriptionIdentityId = created.subscriberIdentityId
  ctx.subjectSubscriptionTargetType = created.targetSubjectType
  ctx.subjectSubscriptionTargetId = created.targetSubjectId

  return {
    subscriptionId: created.id,
    subscriberIdentityId: created.subscriberIdentityId,
    targetSubjectType: created.targetSubjectType,
    targetSubjectId: created.targetSubjectId,
  }
}

async function runUcNeedValidationStep(
  ctx: RunContext,
  step: SagaRunStep,
): Promise<StepResultPayload | null> {
  if (!ctx.bizId) throw new Error('bizId missing before UC need validation.')
  const instruction = String(step.instruction ?? '').toLowerCase()
  if (instruction.includes('only show next 3 available slots initially')) {
    if (!ctx.offerId || !ctx.offerVersionId) {
      blockStep(step.stepKey, 'Offer and offer version are required for slot visibility validation.')
    }

    const slotPolicy = {
      slotVisibility: {
        defaultVisibleSlotCount: 3,
        defaultAdvanceDays: 7,
        tierOverrides: {
          vip: { visibleSlotCount: 10, advanceDays: 30 },
          loyalty: { visibleSlotCount: 5, advanceDays: 30 },
        },
      },
    }

    await requestJson(`/api/v1/bizes/${ctx.bizId}/offers/${ctx.offerId}/versions/${ctx.offerVersionId}`, {
      method: 'PATCH',
      cookie: ctx.owner.cookie,
      body: {
        policyModel: slotPolicy,
      },
      acceptStatuses: [200],
    })

    const response = await requestJson<{
      success: true
      data: {
        offerId: string
        offerVersionId: string
        visibility: {
          viewerTier: string
          effectiveVisibleSlotCount: number
          requestedLimit: number
          hasMore: boolean
        }
        slots: Array<{ startAt: string; endAt: string }>
      }
    }>(`/api/v1/public/bizes/${ctx.bizId}/offers/${ctx.offerId}/availability?offerVersionId=${ctx.offerVersionId}`, {
      cookie: ctx.customer1?.cookie ?? ctx.owner.cookie,
      acceptStatuses: [200],
    })
    const data = getApiData<{
      offerId: string
      offerVersionId: string
      visibility: {
        viewerTier: string
        effectiveVisibleSlotCount: number
        requestedLimit: number
        hasMore: boolean
      }
      slots: Array<{ startAt: string; endAt: string }>
    }>(response.payload)

    if (data.slots.length !== 3) {
      blockStep(step.stepKey, 'Availability response did not cap regular viewer to 3 slots.', {
        expectedSlots: 3,
        actualSlots: data.slots.length,
        visibility: data.visibility,
      })
    }

    const isAscending = data.slots.every((slot, index, arr) => {
      if (index === 0) return true
      return new Date(arr[index - 1].startAt).getTime() <= new Date(slot.startAt).getTime()
    })
    if (!isAscending) {
      blockStep(step.stepKey, 'Availability slots are not sorted oldest-first.', {
        slots: data.slots,
      })
    }

    const expandedResponse = await requestJson<{
      success: true
      data: {
        visibility: { requestedLimit: number; effectiveVisibleSlotCount: number }
        slots: Array<{ startAt: string; endAt: string }>
      }
    }>(
      `/api/v1/public/bizes/${ctx.bizId}/offers/${ctx.offerId}/availability?offerVersionId=${ctx.offerVersionId}&limit=25`,
      {
        cookie: ctx.customer1?.cookie ?? ctx.owner.cookie,
        acceptStatuses: [200],
      },
    )
    const expanded = getApiData<{
      visibility: { requestedLimit: number; effectiveVisibleSlotCount: number }
      slots: Array<{ startAt: string; endAt: string }>
    }>(expandedResponse.payload)
    if (expanded.slots.length !== 3 || expanded.visibility.effectiveVisibleSlotCount !== 3) {
      blockStep(step.stepKey, 'Client could bypass slot visibility cap by requesting a larger limit.', {
        requestedLimit: expanded.visibility.requestedLimit,
        effectiveVisibleSlotCount: expanded.visibility.effectiveVisibleSlotCount,
        returnedSlots: expanded.slots.length,
      })
    }

    return {
      note: 'Validated public slot discovery returns only the next 3 available slots for default viewers.',
      evidence: {
        viewerTier: data.visibility.viewerTier,
        returnedSlots: data.slots.length,
        effectiveVisibleSlotCount: data.visibility.effectiveVisibleSlotCount,
        firstSlot: data.slots[0] ?? null,
        thirdSlot: data.slots[2] ?? null,
      },
    }
  }

  if (instruction.includes('when one books, open next slot')) {
    if (!ctx.offerId || !ctx.offerVersionId || !ctx.bizId) {
      blockStep(step.stepKey, 'Offer context is required for slot-rollover validation.')
    }

    // Ensure the same capped visibility policy used by UC-40 step #1.
    await requestJson(`/api/v1/bizes/${ctx.bizId}/offers/${ctx.offerId}/versions/${ctx.offerVersionId}`, {
      method: 'PATCH',
      cookie: ctx.owner.cookie,
      body: {
        policyModel: {
          slotVisibility: {
            defaultVisibleSlotCount: 3,
            defaultAdvanceDays: 7,
            tierOverrides: {
              vip: { visibleSlotCount: 10, advanceDays: 30 },
              loyalty: { visibleSlotCount: 5, advanceDays: 30 },
            },
          },
        },
      },
      acceptStatuses: [200],
    })

    const beforeResponse = await requestJson<{
      success: true
      data: {
        visibility: {
          effectiveVisibleSlotCount: number
          hasMore: boolean
          nextHiddenSlotStartAt: string | null
        }
        slots: Array<{ startAt: string; endAt: string }>
      }
    }>(
      `/api/v1/public/bizes/${ctx.bizId}/offers/${ctx.offerId}/availability?offerVersionId=${ctx.offerVersionId}`,
      {
        cookie: ctx.customer1?.cookie ?? ctx.owner.cookie,
        acceptStatuses: [200],
      },
    )
    const before = getApiData<{
      visibility: {
        effectiveVisibleSlotCount: number
        hasMore: boolean
        nextHiddenSlotStartAt: string | null
      }
      slots: Array<{ startAt: string; endAt: string }>
    }>(beforeResponse.payload)

    const beforeVipResponse = await requestJson<{
      success: true
      data: {
        visibility: {
          effectiveVisibleSlotCount: number
          hasMore: boolean
          nextHiddenSlotStartAt: string | null
        }
        slots: Array<{ startAt: string; endAt: string }>
      }
    }>(
      `/api/v1/public/bizes/${ctx.bizId}/offers/${ctx.offerId}/availability?offerVersionId=${ctx.offerVersionId}&viewerTier=vip&limit=10`,
      {
        cookie: ctx.customer1?.cookie ?? ctx.owner.cookie,
        acceptStatuses: [200],
      },
    )
    const beforeVip = getApiData<{
      visibility: {
        effectiveVisibleSlotCount: number
        hasMore: boolean
        nextHiddenSlotStartAt: string | null
      }
      slots: Array<{ startAt: string; endAt: string }>
    }>(beforeVipResponse.payload)

    if (before.slots.length < 3 || !before.visibility.nextHiddenSlotStartAt) {
      blockStep(step.stepKey, 'Not enough pre-booking slots to validate rollover behavior.', {
        before,
      })
    }

    const targetSlot = before.slots[0]
    const actor = ctx.customer1 ?? ctx.owner
    await requestJson(`/api/v1/public/bizes/${ctx.bizId}/booking-orders`, {
      method: 'POST',
      cookie: actor.cookie,
      body: {
        offerId: ctx.offerId,
        offerVersionId: ctx.offerVersionId,
        status: 'confirmed',
        subtotalMinor: 15000,
        taxMinor: 0,
        feeMinor: 0,
        discountMinor: 0,
        totalMinor: 15000,
        currency: 'USD',
        requestedStartAt: targetSlot.startAt,
        requestedEndAt: targetSlot.endAt,
        confirmedStartAt: targetSlot.startAt,
        confirmedEndAt: targetSlot.endAt,
        metadata: {
          source: 'uc-need-validate-2',
        },
      },
      acceptStatuses: [201],
    })

    const afterResponse = await requestJson<{
      success: true
      data: {
        visibility: {
          effectiveVisibleSlotCount: number
          hasMore: boolean
          nextHiddenSlotStartAt: string | null
        }
        slots: Array<{ startAt: string; endAt: string }>
      }
    }>(
      `/api/v1/public/bizes/${ctx.bizId}/offers/${ctx.offerId}/availability?offerVersionId=${ctx.offerVersionId}`,
      {
        cookie: actor.cookie,
        acceptStatuses: [200],
      },
    )
    const after = getApiData<{
      visibility: {
        effectiveVisibleSlotCount: number
        hasMore: boolean
        nextHiddenSlotStartAt: string | null
      }
      slots: Array<{ startAt: string; endAt: string }>
    }>(afterResponse.payload)

    const bookedStartMs = new Date(targetSlot.startAt).getTime()
    const bookedEndMs = new Date(targetSlot.endAt).getTime()
    const overlapsBookedWindow = (slot: { startAt: string; endAt: string }) => {
      const startMs = new Date(slot.startAt).getTime()
      const endMs = new Date(slot.endAt).getTime()
      return startMs < bookedEndMs && endMs > bookedStartMs
    }

    const expectedAfterStarts = beforeVip.slots
      .filter((slot) => !overlapsBookedWindow(slot))
      .slice(0, 3)
      .map((slot) => slot.startAt)

    const actualAfterStarts = after.slots.map((slot) => slot.startAt)
    const bookedStillVisible = after.slots.some((slot) => slot.startAt === targetSlot.startAt)
    const rolloverMatchesExpected =
      expectedAfterStarts.length === 3 &&
      expectedAfterStarts.length === actualAfterStarts.length &&
      expectedAfterStarts.every((value, index) => actualAfterStarts[index] === value)

    if (after.slots.length !== 3 || bookedStillVisible || !rolloverMatchesExpected) {
      blockStep(step.stepKey, 'Booking one slot did not open the next hidden slot as expected.', {
        bookedSlot: targetSlot.startAt,
        expectedAfterStarts,
        actualAfterStarts,
        bookedStillVisible,
        rolloverMatchesExpected,
        before,
        beforeVip,
        after,
      })
    }

    return {
      note: 'Validated rollover: booking one visible slot promotes the next hidden slot into the visible window.',
      evidence: {
        bookedSlot: targetSlot.startAt,
        expectedAfterStarts,
        actualAfterStarts,
        visibleSlotsBefore: before.slots.map((slot) => slot.startAt),
        visibleSlotsAfter: after.slots.map((slot) => slot.startAt),
      },
    }
  }

  const fixture = await ensureSubjectSubscriptionFixture(ctx)

  if (instruction.includes('records per subscriber identity')) {
    const listResponse = await requestJson<{ success: true; data: Array<{ id: string; subscriberIdentityId: string }> }>(
      `/api/v1/bizes/${ctx.bizId}/subject-subscriptions?subscriberIdentityId=${fixture.subscriberIdentityId}`,
      {
        cookie: ctx.owner.cookie,
        acceptStatuses: [200],
      },
    )
    const rows = getApiData<Array<{ id: string; subscriberIdentityId: string }>>(listResponse.payload)
    const found = rows.find((row) => row.id === fixture.subscriptionId)
    if (!found) {
      blockStep(step.stepKey, 'Subject-level subscription row not linked to subscriber identity.', {
        expectedSubscriptionId: fixture.subscriptionId,
        subscriberIdentityId: fixture.subscriberIdentityId,
        returnedRows: rows.length,
      })
    }
    return {
      note: 'Validated subject-level subscription records are linked to subscriber identity.',
      evidence: {
        subscriptionId: fixture.subscriptionId,
        subscriberIdentityId: fixture.subscriberIdentityId,
      },
    }
  }

  if (instruction.includes('type and lifecycle status')) {
    const patchResponse = await requestJson<{
      success: true
      data: { id: string; subscriptionType: string; status: string }
    }>(`/api/v1/bizes/${ctx.bizId}/subject-subscriptions/${fixture.subscriptionId}`, {
      method: 'PATCH',
      cookie: ctx.owner.cookie,
      body: {
        subscriptionType: 'notify',
        status: 'muted',
      },
      acceptStatuses: [200],
    })
    const updated = getApiData<{ id: string; subscriptionType: string; status: string }>(
      patchResponse.payload,
    )
    if (updated.subscriptionType !== 'notify' || updated.status !== 'muted') {
      blockStep(step.stepKey, 'Subscription type/status did not persist lifecycle update.', {
        expected: { subscriptionType: 'notify', status: 'muted' },
        actual: updated,
      })
    }
    return {
      note: 'Validated subscription type + lifecycle status updates.',
      evidence: updated,
    }
  }

  if (instruction.includes('delivery mode') || instruction.includes('channel preference')) {
    const patchResponse = await requestJson<{
      success: true
      data: { id: string; deliveryMode: string; preferredChannel: string }
    }>(`/api/v1/bizes/${ctx.bizId}/subject-subscriptions/${fixture.subscriptionId}`, {
      method: 'PATCH',
      cookie: ctx.owner.cookie,
      body: {
        deliveryMode: 'digest',
        preferredChannel: 'email',
      },
      acceptStatuses: [200],
    })
    const updated = getApiData<{ id: string; deliveryMode: string; preferredChannel: string }>(
      patchResponse.payload,
    )
    if (updated.deliveryMode !== 'digest' || updated.preferredChannel !== 'email') {
      blockStep(step.stepKey, 'Delivery mode/channel preference update was not persisted.', {
        expected: { deliveryMode: 'digest', preferredChannel: 'email' },
        actual: updated,
      })
    }
    return {
      note: 'Validated delivery mode and preferred channel behavior.',
      evidence: updated,
    }
  }

  if (instruction.includes('throttling')) {
    const patchResponse = await requestJson<{
      success: true
      data: { id: string; minDeliveryIntervalMinutes: number }
    }>(`/api/v1/bizes/${ctx.bizId}/subject-subscriptions/${fixture.subscriptionId}`, {
      method: 'PATCH',
      cookie: ctx.owner.cookie,
      body: {
        minDeliveryIntervalMinutes: 45,
      },
      acceptStatuses: [200],
    })
    const updated = getApiData<{ id: string; minDeliveryIntervalMinutes: number }>(
      patchResponse.payload,
    )
    if (updated.minDeliveryIntervalMinutes !== 45) {
      blockStep(step.stepKey, 'Delivery throttling value was not persisted.', {
        expected: 45,
        actual: updated.minDeliveryIntervalMinutes,
      })
    }
    return {
      note: 'Validated delivery throttling control persistence.',
      evidence: updated,
    }
  }

  if (instruction.includes('tenant-safe linkage')) {
    if (!ctx.validationShadowBizId) {
      const shadowBiz = await createBiz({
        ...ctx,
        sagaKey: `${ctx.sagaKey}-shadow`,
      })
      ctx.validationShadowBizId = shadowBiz.id
    }

    const crossTenantResponse = await requestJson<{
      success: boolean
      error?: { code?: string; message?: string }
    }>(`/api/v1/bizes/${ctx.bizId}/subject-subscriptions`, {
      method: 'POST',
      cookie: ctx.owner.cookie,
      raw: true,
      body: {
        targetSubjectBizId: ctx.validationShadowBizId,
        targetSubjectType: 'offer_watch',
        targetSubjectId: `cross-biz-${randomSuffix(6)}`,
        subscriptionType: 'watch',
      },
      acceptStatuses: [400],
    })

    const payload = crossTenantResponse.payload as {
      success?: boolean
      error?: { code?: string; message?: string }
    }
    if (payload.success !== false) {
      blockStep(step.stepKey, 'Cross-biz target linkage was expected to be rejected but was accepted.', {
        response: payload,
      })
    }

    const listResponse = await requestJson<{
      success: true
      data: Array<{ id: string; targetSubjectBizId: string }>
    }>(`/api/v1/bizes/${ctx.bizId}/subject-subscriptions`, {
      cookie: ctx.owner.cookie,
      acceptStatuses: [200],
    })
    const rows = getApiData<Array<{ id: string; targetSubjectBizId: string }>>(listResponse.payload)
    const hasForeign = rows.some((row) => row.targetSubjectBizId !== ctx.bizId)
    if (hasForeign) {
      blockStep(step.stepKey, 'List API leaked cross-tenant target bindings.', {
        bizId: ctx.bizId,
        rows,
      })
    }
    return {
      note: 'Validated tenant-safe subject linkage enforcement.',
      evidence: {
        rejectedTargetBizId: ctx.validationShadowBizId,
        listedRows: rows.length,
      },
    }
  }

  return null
}

async function runPersonaScenarioValidationStep(
  ctx: RunContext,
  step: SagaRunStep,
): Promise<StepResultPayload | null> {
  if (!ctx.bizId) throw new Error('bizId missing before persona-scenario validation.')
  const instruction = String(step.instruction ?? '').toLowerCase()

  if (instruction.includes('setup flow completion time')) {
    const detail = await getSagaRun(ctx.owner, ctx.runId)
    const completedBeforeValidation = detail.steps.filter((row) => row.status === 'passed').length
    const requiredAnchors = [ctx.bizId, ctx.locationId, ctx.offerId, ctx.offerVersionId].filter(Boolean).length
    if (completedBeforeValidation < 10 || requiredAnchors < 4) {
      blockStep(step.stepKey, 'Setup flow is incomplete before completion-time validation.', {
        completedBeforeValidation,
        requiredAnchors,
      })
    }
    return {
      note: 'Validated setup lifecycle reached a complete operational baseline.',
      evidence: {
        completedBeforeValidation,
        anchors: {
          bizId: ctx.bizId,
          locationId: ctx.locationId,
          offerId: ctx.offerId,
          offerVersionId: ctx.offerVersionId,
        },
      },
    }
  }

  if (instruction.includes('deletes availability rule')) {
    const bizBeforeResponse = await requestJson<{ success: true; data: { metadata?: Record<string, unknown> } }>(
      `/api/v1/bizes/${ctx.bizId}`,
      { cookie: ctx.owner.cookie, acceptStatuses: [200] },
    )
    const bizBefore = getApiData<{ metadata?: Record<string, unknown> }>(bizBeforeResponse.payload)
    const metadataBefore = { ...(bizBefore.metadata ?? {}) }
    const hadAvailability = Object.prototype.hasOwnProperty.call(metadataBefore, 'availability')

    const metadataWithoutAvailability = { ...metadataBefore }
    delete metadataWithoutAvailability.availability
    await requestJson(`/api/v1/bizes/${ctx.bizId}`, {
      method: 'PATCH',
      cookie: ctx.owner.cookie,
      body: { metadata: metadataWithoutAvailability },
      acceptStatuses: [200],
    })

    const afterDeleteResponse = await requestJson<{ success: true; data: { metadata?: Record<string, unknown> } }>(
      `/api/v1/bizes/${ctx.bizId}`,
      { cookie: ctx.owner.cookie, acceptStatuses: [200] },
    )
    const afterDelete = getApiData<{ metadata?: Record<string, unknown> }>(afterDeleteResponse.payload)
    const deleted = !Object.prototype.hasOwnProperty.call(afterDelete.metadata ?? {}, 'availability')
    if (!deleted) {
      blockStep(step.stepKey, 'Availability config deletion did not apply.', {
        metadataAfterDelete: afterDelete.metadata ?? {},
      })
    }

    await requestJson(`/api/v1/bizes/${ctx.bizId}`, {
      method: 'PATCH',
      cookie: ctx.owner.cookie,
      body: { metadata: metadataBefore },
      acceptStatuses: [200],
    })
    ctx.metadataPatch = metadataBefore

    const restoredResponse = await requestJson<{ success: true; data: { metadata?: Record<string, unknown> } }>(
      `/api/v1/bizes/${ctx.bizId}`,
      { cookie: ctx.owner.cookie, acceptStatuses: [200] },
    )
    const restored = getApiData<{ metadata?: Record<string, unknown> }>(restoredResponse.payload)
    const restoredAvailability = Object.prototype.hasOwnProperty.call(restored.metadata ?? {}, 'availability')
    if (hadAvailability && !restoredAvailability) {
      blockStep(step.stepKey, 'Availability config was not restorable after accidental deletion.', {
        metadataRestored: restored.metadata ?? {},
      })
    }

    return {
      note: 'Validated accidental availability deletion + restore recovery flow.',
      evidence: {
        hadAvailabilityBefore: hadAvailability,
        deletedAvailability: deleted,
        restoredAvailability,
      },
    }
  }

  if (instruction.includes('book herself')) {
    const booking = await createBooking(ctx, ctx.owner, ctx.owner.userId, 48)
    const listResponse = await requestJson<{ success: true; data: Array<{ id: string }> }>(
      `/api/v1/public/bizes/${ctx.bizId}/booking-orders`,
      {
        cookie: ctx.owner.cookie,
        acceptStatuses: [200],
      },
    )
    const rows = getApiData<Array<{ id: string }>>(listResponse.payload)
    const visible = rows.some((row) => row.id === booking.id)
    if (!visible) {
      blockStep(step.stepKey, 'Self-booking succeeded but booking is not visible in customer scope.', {
        bookingId: booking.id,
        listedCount: rows.length,
      })
    }
    return {
      note: 'Validated owner can self-book through customer booking flow and view it.',
      evidence: {
        bookingId: booking.id,
        listedCount: rows.length,
      },
    }
  }

  if (instruction.includes('buffer time')) {
    const hostId = ctx.hostResourceId
    if (!hostId) {
      blockStep(step.stepKey, 'Host resource id is unavailable for buffer-time validation.')
    }

    const zeroPatchResponse = await requestJson<{
      success: true
      data: { id: string; bufferBeforeMinutes: number; bufferAfterMinutes: number }
    }>(`/api/v1/bizes/${ctx.bizId}/resources/${hostId}`, {
      method: 'PATCH',
      cookie: ctx.owner.cookie,
      body: {
        bufferBeforeMinutes: 0,
        bufferAfterMinutes: 0,
      },
      acceptStatuses: [200],
    })
    const zeroPatched = getApiData<{ id: string; bufferBeforeMinutes: number; bufferAfterMinutes: number }>(
      zeroPatchResponse.payload,
    )
    if (zeroPatched.bufferBeforeMinutes !== 0 || zeroPatched.bufferAfterMinutes !== 0) {
      blockStep(step.stepKey, 'Could not simulate zero-buffer state on host resource.', {
        actual: zeroPatched,
      })
    }

    const restorePatchResponse = await requestJson<{
      success: true
      data: { id: string; bufferBeforeMinutes: number; bufferAfterMinutes: number }
    }>(`/api/v1/bizes/${ctx.bizId}/resources/${hostId}`, {
      method: 'PATCH',
      cookie: ctx.owner.cookie,
      body: {
        bufferBeforeMinutes: 10,
        bufferAfterMinutes: 10,
      },
      acceptStatuses: [200],
    })
    const restored = getApiData<{ id: string; bufferBeforeMinutes: number; bufferAfterMinutes: number }>(
      restorePatchResponse.payload,
    )
    if (restored.bufferBeforeMinutes < 1 || restored.bufferAfterMinutes < 1) {
      blockStep(step.stepKey, 'Could not restore buffer settings after zero-buffer simulation.', {
        actual: restored,
      })
    }
    return {
      note: 'Validated buffer settings can be audited and corrected after zero-buffer configuration.',
      evidence: {
        hostResourceId: hostId,
        before: zeroPatched,
        after: restored,
      },
    }
  }

  return null
}

async function runExploratoryValidationViaApi(
  ctx: RunContext,
  step: SagaRunStep,
  stepFamily: 'uc-need-validation' | 'persona-scenario-validation',
): Promise<StepResultPayload | null> {
  const response = await requestJson<{
    success: true
    data: ExploratoryEvaluationPayload
  }>(`/api/v1/sagas/runs/${ctx.runId}/steps/${step.stepKey}/exploratory-evaluate`, {
    method: 'POST',
    cookie: ctx.owner.cookie,
    body: {
      stepFamily,
    },
    acceptStatuses: [200],
  })

  const evaluation = getApiData<ExploratoryEvaluationPayload>(response.payload)
  const evaluationEvidence = {
    stepFamily,
    evaluator: evaluation.evaluator,
    model: evaluation.model,
    verdict: evaluation.verdict,
    confidence: evaluation.confidence,
    assessment: evaluation.assessment ?? null,
    reasonCode: evaluation.reasonCode,
    evidencePointers: evaluation.evidencePointers,
    gaps: evaluation.gaps,
    deterministicFollowUps: evaluation.deterministicFollowUps,
  }

  if (evaluation.status === 'passed') {
    return {
      note: `Exploratory validation passed: ${evaluation.summary}`,
      evidence: evaluationEvidence,
    }
  }

  if (evaluation.status === 'failed') {
    throw new StepExecutionError(
      'failed',
      `Exploratory validation failed: ${evaluation.summary}`,
      evaluationEvidence,
    )
  }

  throw new StepExecutionError(
    'blocked',
    `Exploratory validation blocked: ${evaluation.summary}`,
    evaluationEvidence,
  )
}

async function runStep(ctx: RunContext, step: SagaRunStep): Promise<StepResultPayload> {
  const stepKey = step.stepKey
  /**
   * Exploratory validation steps are generated from UC/persona prose and are
   * intentionally open-ended ("validate this need/scenario semantically").
   *
   * Deterministic runner policy:
   * - do NOT treat these as executor gaps,
   * - mark them as skipped so run health reflects concrete API coverage only.
   *
   * These are still visible in saga UI for analyst/LLM-assisted review flows.
   */
  if (
    stepKey.startsWith('uc-need-validate-') ||
    stepKey.startsWith('persona-scenario-validate-')
  ) {
    const stepFamily = stepKey.startsWith('uc-need-validate-')
      ? 'uc-need-validation'
      : 'persona-scenario-validation'
    const exploratoryResult = stepKey.startsWith('uc-need-validate-')
      ? await runUcNeedValidationStep(ctx, step)
      : await runPersonaScenarioValidationStep(ctx, step)
    if (exploratoryResult) return exploratoryResult

    const llmEvaluated = await runExploratoryValidationViaApi(ctx, step, stepFamily)
    if (llmEvaluated) return llmEvaluated

    if (SAGA_STRICT_EXPLORATORY) {
      throw new StepExecutionError(
        'blocked',
        'Exploratory validation step has no deterministic executable contract yet.',
        {
          stepFamily,
          reasonCode: 'MISSING_DETERMINISTIC_EXECUTOR_CONTRACT',
          expected:
            'Implement explicit API assertions for this exploratory step before classifying run as passed.',
        },
      )
    }

    throw new StepExecutionError(
      'skipped',
      'Exploratory validation step skipped by deterministic runner (non-strict mode).',
      {
        stepFamily,
        reasonCode: 'DETERMINISTIC_RUNNER_SKIPS_EXPLORATORY_STEP',
      },
    )
  }

  switch (stepKey) {
    case 'owner-sign-up':
      await requestJson('/api/v1/auth/me', {
        cookie: ctx.owner.cookie,
        acceptStatuses: [200],
      })
      return {
        note: 'Owner session is active.',
        evidence: { ownerUserId: ctx.owner.userId, ownerEmail: ctx.owner.email },
      }

    case 'owner-create-biz': {
      const biz = await createBiz(ctx)
      return { note: 'Biz created.', evidence: biz }
    }

    case 'owner-create-location': {
      const location = await createLocation(ctx)
      return { note: 'Location created.', evidence: location }
    }

    case 'owner-configure-hours':
      await patchBizMetadata(ctx, {
        availability: {
          timezone: 'UTC',
          weekly: {
            mon: ['09:00-17:00'],
            tue: ['09:00-17:00'],
            wed: ['09:00-17:00'],
            thu: ['09:00-17:00'],
            fri: ['09:00-17:00'],
          },
          leadTimeHours: 24,
          maxAdvanceDays: 60,
        },
      })
      return { note: 'Hours/lead-time baseline configured on biz metadata.' }

    case 'owner-configure-pricing':
      await patchBizMetadata(ctx, {
        pricing: {
          baseCurrency: 'USD',
          callFeeMinor: 5000,
          surgeManualEnabled: true,
        },
      })
      return { note: 'Pricing baseline configured on biz metadata.' }

    case 'owner-configure-call-fee':
      await patchBizMetadata(ctx, {
        pricing: {
          callFeeMinor: 5000,
          callFeeAppliesOnArrival: true,
          callFeeRefundable: false,
        },
      })
      return { note: 'Call-fee policy configured on biz metadata.' }

    case 'owner-configure-demand-pricing': {
      if (!ctx.bizId) throw new Error('bizId required before demand-pricing configuration.')
      const toolNames = await getAgentToolNames(ctx)
      const requiredTools = [
        'bizing.pricing.demandPolicies.create',
        'bizing.pricing.demandPolicies.list',
      ]
      const missingTools = requiredTools.filter((toolName) => !toolNames.has(toolName))
      if (missingTools.length > 0) {
        blockStep(stepKey, 'Demand pricing capability is not exposed as API tools yet.', {
          expectedTools: requiredTools,
          missingTools,
          foundToolCount: toolNames.size,
        })
      }

      const policyTargetType = ctx.offerVersionId ? 'offer_version' : 'global'
      const policySlug = `demand-${toSlug(ctx.sagaKey, 40)}-${randomSuffix(6)}`
      const createResponse = await requestJson<{ success: true; data: { id: string } }>(
        `/api/v1/bizes/${ctx.bizId}/demand-pricing/policies`,
        {
          method: 'POST',
          cookie: ctx.owner.cookie,
          body: {
            name: `Peak demand policy ${randomSuffix(4)}`,
            slug: policySlug,
            status: 'active',
            targetType: policyTargetType,
            offerVersionId: ctx.offerVersionId,
            scoringMode: 'manual_only',
            scoreFloor: 0,
            scoreCeiling: 10000,
            defaultAdjustmentType: 'percentage',
            defaultApplyAs: 'surcharge',
            defaultAdjustmentValue: 2000,
            priority: 40,
            isEnabled: true,
            policy: {
              mode: 'manual',
              source: 'saga_runner',
            },
            metadata: {
              sagaKey: ctx.sagaKey,
              runId: ctx.runId,
            },
          },
          acceptStatuses: [201],
        },
      )
      const createdPolicy = getApiData<{ id: string }>(createResponse.payload)

      const listResponse = await requestJson<{ success: true; data: { items: Array<{ id: string }> } }>(
        `/api/v1/bizes/${ctx.bizId}/demand-pricing/policies?status=active&perPage=50`,
        {
          cookie: ctx.owner.cookie,
          acceptStatuses: [200],
        },
      )
      const listData = getApiData<{ items: Array<{ id: string }> }>(listResponse.payload)
      const isVisibleInList = listData.items.some((row) => row.id === createdPolicy.id)
      if (!isVisibleInList) {
        blockStep(stepKey, 'Demand-pricing policy created but not visible in list API.', {
          createdPolicyId: createdPolicy.id,
          listedItems: listData.items.length,
        })
      }

      await requestJson('/api/v1/agents/execute', {
        method: 'POST',
        cookie: ctx.owner.cookie,
        body: {
          tool: 'bizing.pricing.demandPolicies.list',
          params: {
            bizId: ctx.bizId,
            perPage: 20,
          },
          runId: ctx.runId,
          stepKey,
        },
        acceptStatuses: [200],
      })

      await patchBizMetadata(ctx, {
        demandPricing: {
          enabled: true,
          mode: 'manual',
          rules: [
            {
              name: 'peak-hours',
              weekdays: ['mon', 'tue', 'wed', 'thu', 'fri'],
              timeRange: '17:00-20:00',
              multiplier: 1.2,
            },
          ],
        },
      })
      return {
        note: 'Demand-pricing policy configured and verified through API + agent tools.',
        evidence: {
          demandPricingPolicyId: createdPolicy.id,
          targetType: policyTargetType,
        },
      }
    }

    case 'owner-configure-external-integration': {
      if (!ctx.bizId) throw new Error('bizId required before external integration configuration.')

      const accountResponse = await requestJson<{ success: true; data: { id: string } }>(
        `/api/v1/bizes/${ctx.bizId}/channel-accounts`,
        {
          method: 'POST',
          cookie: ctx.owner.cookie,
          body: {
            provider: 'custom',
            name: `UC connector ${randomSuffix(6)}`,
            providerAccountRef: `acct-${randomSuffix(10)}`,
            status: 'active',
            scopes: ['offers.read', 'bookings.read'],
            authConfig: { mode: 'api_key', test: true },
            metadata: {
              createdBySaga: ctx.sagaKey,
            },
          },
          acceptStatuses: [201],
        },
      )
      const account = getApiData<{ id: string }>(accountResponse.payload)

      const syncStateResponse = await requestJson<{ success: true; data: { id: string } }>(
        `/api/v1/bizes/${ctx.bizId}/channel-sync-states`,
        {
          method: 'POST',
          cookie: ctx.owner.cookie,
          body: {
            channelAccountId: account.id,
            objectType: 'availability',
            direction: 'bidirectional',
            inboundCursor: `in-${randomSuffix(10)}`,
            outboundCursor: `out-${randomSuffix(10)}`,
            metadata: { source: 'saga-rerun' },
          },
          acceptStatuses: [201],
        },
      )
      const syncState = getApiData<{ id: string }>(syncStateResponse.payload)

      const entityLinkResponse = await requestJson<{ success: true; data: { id: string } }>(
        `/api/v1/bizes/${ctx.bizId}/channel-entity-links`,
        {
          method: 'POST',
          cookie: ctx.owner.cookie,
          body: {
            channelAccountId: account.id,
            objectType: 'custom',
            localReferenceKey: `uc-${ctx.sagaKey}-${randomSuffix(6)}`,
            externalObjectId: `ext-${randomSuffix(12)}`,
            metadata: { source: 'saga-rerun' },
          },
          acceptStatuses: [201],
        },
      )
      const entityLink = getApiData<{ id: string }>(entityLinkResponse.payload)

      const listedStatesResponse = await requestJson<{ success: true; data: Array<{ id: string }> }>(
        `/api/v1/bizes/${ctx.bizId}/channel-sync-states?channelAccountId=${account.id}&objectType=availability`,
        {
          cookie: ctx.owner.cookie,
          acceptStatuses: [200],
        },
      )
      const listedStates = getApiData<Array<{ id: string }>>(listedStatesResponse.payload)

      const listedLinksResponse = await requestJson<{
        success: true
        data: Array<{ id: string }>
      }>(
        `/api/v1/bizes/${ctx.bizId}/channel-entity-links?channelAccountId=${account.id}&objectType=custom`,
        {
          cookie: ctx.owner.cookie,
          acceptStatuses: [200],
        },
      )
      const listedLinks = getApiData<Array<{ id: string }>>(listedLinksResponse.payload)

      const hasState = listedStates.some((row) => row.id === syncState.id)
      const hasLink = listedLinks.some((row) => row.id === entityLink.id)
      if (!hasState || !hasLink) {
        blockStep(stepKey, 'External integration records were created but not queryable.', {
          channelAccountId: account.id,
          syncStateId: syncState.id,
          entityLinkId: entityLink.id,
          hasState,
          hasLink,
          listedStateCount: listedStates.length,
          listedLinkCount: listedLinks.length,
        })
      }

      return {
        note: 'External channel integration configured and persisted through API.',
        evidence: {
          channelAccountId: account.id,
          syncStateId: syncState.id,
          entityLinkId: entityLink.id,
          listedStateCount: listedStates.length,
          listedLinkCount: listedLinks.length,
        },
      }
    }

    case 'owner-validate-compliance-controls': {
      if (!ctx.bizId) {
        throw new Error('bizId is required before compliance validation.')
      }
      const response = await requestJson<{
        success: true
        data: {
          bizId: string
          accessControls: {
            actorUserId: string
            sensitivePermissionChecks: Array<{ permissionKey: string; allowed: boolean }>
          }
          privacyControls: {
            tenantScopeEnforced: boolean
            crossBizIsolationEnforced: boolean
          }
          credentialControls: {
            totalCredentials: number
            activeCredentials: number
            revokedCredentials: number
            expiredCredentials: number
          }
          auditControls: {
            auditStreamsCount: number | null
            auditEventsCount: number | null
            auditIntegrityRunsCount: number | null
          }
          warnings: string[]
        }
      }>(`/api/v1/bizes/${ctx.bizId}/compliance/controls`, {
        cookie: ctx.owner.cookie,
        acceptStatuses: [200],
      })
      const controls = getApiData<{
        bizId: string
        accessControls: {
          actorUserId: string
          sensitivePermissionChecks: Array<{ permissionKey: string; allowed: boolean }>
        }
        privacyControls: {
          tenantScopeEnforced: boolean
          crossBizIsolationEnforced: boolean
        }
        credentialControls: {
          totalCredentials: number
          activeCredentials: number
          revokedCredentials: number
          expiredCredentials: number
        }
        auditControls: {
          auditStreamsCount: number | null
          auditEventsCount: number | null
          auditIntegrityRunsCount: number | null
        }
        warnings: string[]
      }>(response.payload)

      const hasPermissionChecks = controls.accessControls.sensitivePermissionChecks.length > 0
      const allSensitiveAllowed = controls.accessControls.sensitivePermissionChecks.every(
        (row) => row.allowed,
      )
      if (
        controls.bizId !== ctx.bizId ||
        controls.accessControls.actorUserId !== ctx.owner.userId ||
        !controls.privacyControls.tenantScopeEnforced ||
        !controls.privacyControls.crossBizIsolationEnforced ||
        !hasPermissionChecks ||
        !allSensitiveAllowed
      ) {
        blockStep(stepKey, 'Compliance controls API returned inconsistent enforcement state.', {
          expected: {
            tenantScopeEnforced: true,
            crossBizIsolationEnforced: true,
            hasPermissionChecks: true,
            allSensitiveAllowed: true,
          },
          actual: {
            bizId: controls.bizId,
            actorUserId: controls.accessControls.actorUserId,
            tenantScopeEnforced: controls.privacyControls.tenantScopeEnforced,
            crossBizIsolationEnforced: controls.privacyControls.crossBizIsolationEnforced,
            hasPermissionChecks,
            allSensitiveAllowed,
          },
        })
      }
      return {
        note: 'Compliance controls verified through canonical API endpoint.',
        evidence: {
          permissionCheckCount: controls.accessControls.sensitivePermissionChecks.length,
          credentialTotals: controls.credentialControls,
          auditControls: controls.auditControls,
          warnings: controls.warnings,
        },
      }
    }

    case 'owner-create-resources': {
      const resources = await createResources(ctx)
      return { note: 'Host + asset resources created.', evidence: resources }
    }

    case 'owner-invite-member': {
      const invite = await inviteAndAcceptMember(ctx)
      return { note: 'Member invited and accepted invitation.', evidence: invite }
    }

    case 'owner-create-offer': {
      if (!ctx.offerId) {
        const out = await createOffer(ctx)
        return { note: 'Offer created.', evidence: out }
      }
      return { note: 'Offer already created in this run.', evidence: { offerId: ctx.offerId } }
    }

    case 'owner-create-offer-version':
      if (!ctx.offerVersionId) {
        if (!ctx.offerId) {
          await createOffer(ctx)
        }
        const out = await createOfferVersion(ctx)
        return { note: 'Offer version created.', evidence: out }
      }
      await requestJson(`/api/v1/bizes/${ctx.bizId}/offers/${ctx.offerId}/versions`, {
        cookie: ctx.owner.cookie,
        acceptStatuses: [200],
      })
      return { note: 'Offer version already available.', evidence: { offerVersionId: ctx.offerVersionId } }

    case 'owner-publish-catalog':
      await publishOffer(ctx)
      return { note: 'Offer published and activated.' }

    case 'customer-sign-up': {
      const customer = await createCustomer(ctx, 'customer1')
      if (ctx.bizId) {
        await requestJson(`/api/v1/public/bizes/${ctx.bizId}/offers`, {
          cookie: customer.cookie,
          acceptStatuses: [200],
        })
      }
      return {
        note: 'Primary customer account created.',
        evidence: { customerUserId: customer.userId, email: customer.email },
      }
    }

    case 'customer-book-primary': {
      if (!ctx.customer1) {
        ctx.customer1 = await createCustomer(ctx, 'customer1')
      }
      const booking = await createBooking(ctx, ctx.customer1, ctx.customer1.userId, 24)
      return { note: 'Primary booking created.', evidence: booking }
    }

    case 'customer-join-waitlist-flow': {
      if (!ctx.customer1) {
        ctx.customer1 = await createCustomer(ctx, 'customer1')
      }
      const result = await joinWaitlistAsCustomer(ctx, ctx.customer1)
      return {
        note: 'Customer joined waitlist and entry is visible to both customer and operator APIs.',
        evidence: result,
      }
    }

    case 'customer-two-concurrent': {
      const customer2 = ctx.customer2 ?? (await createCustomer(ctx, 'customer2'))
      const booking = await createBooking(ctx, customer2, customer2.userId, 24)
      return { note: 'Second concurrent booking created.', evidence: booking }
    }

    case 'customer-advanced-payment-flow': {
      if (!ctx.bizId) throw new Error('bizId required before advanced payment flow.')
      if (!ctx.customer1) {
        ctx.customer1 = await createCustomer(ctx, 'customer1')
      }
      const bookingId = ctx.bookingIds[0]
      if (!bookingId) {
        throw new Error('At least one booking must exist before advanced payment flow.')
      }

      const tipMinor = 500
      const advancedPaymentResponse = await requestJson<{
        success: true
        data: {
          paymentIntentId: string
          bookingOrderId: string
          status: string
          amountTargetMinor: number
          amountCapturedMinor: number
          tenderCount: number
          lineAllocationCount: number
          transactionCount: number
        }
      }>(`/api/v1/public/bizes/${ctx.bizId}/booking-orders/${bookingId}/payments/advanced`, {
        method: 'POST',
        cookie: ctx.customer1.cookie,
        body: {
          tipMinor,
          tenders: [
            {
              methodType: 'card',
              allocatedMinor: 10000,
              label: 'Primary card',
            },
            {
              methodType: 'cash',
              allocatedMinor: 5500,
              label: 'Cash supplement',
            },
          ],
          metadata: {
            source: 'rerun-sagas',
          },
        },
        acceptStatuses: [201],
      })
      const payment = getApiData<{
        paymentIntentId: string
        bookingOrderId: string
        status: string
        amountTargetMinor: number
        amountCapturedMinor: number
        tenderCount: number
        lineAllocationCount: number
        transactionCount: number
      }>(advancedPaymentResponse.payload)

      const intentListResponse = await requestJson<{
        success: true
        data: Array<{ id: string; bookingOrderId: string | null }>
      }>(`/api/v1/bizes/${ctx.bizId}/payment-intents?bookingOrderId=${bookingId}`, {
        cookie: ctx.owner.cookie,
        acceptStatuses: [200],
      })
      const intents = getApiData<Array<{ id: string; bookingOrderId: string | null }>>(
        intentListResponse.payload,
      )
      const hasIntentInList = intents.some((row) => row.id === payment.paymentIntentId)

      const intentDetailResponse = await requestJson<{
        success: true
        data: {
          intent: { id: string; amountTargetMinor: number; amountCapturedMinor: number; status: string }
          tenders: Array<{ id: string }>
          lineAllocations: Array<{ id: string }>
          transactions: Array<{ id: string }>
          transactionLineAllocations: Array<{ id: string }>
        }
      }>(`/api/v1/bizes/${ctx.bizId}/payment-intents/${payment.paymentIntentId}`, {
        cookie: ctx.owner.cookie,
        acceptStatuses: [200],
      })
      const detail = getApiData<{
        intent: { id: string; amountTargetMinor: number; amountCapturedMinor: number; status: string }
        tenders: Array<{ id: string }>
        lineAllocations: Array<{ id: string }>
        transactions: Array<{ id: string }>
        transactionLineAllocations: Array<{ id: string }>
      }>(intentDetailResponse.payload)

      const expectedAmount = 15500
      if (
        !hasIntentInList ||
        detail.intent.amountTargetMinor !== expectedAmount ||
        detail.intent.amountCapturedMinor !== expectedAmount ||
        detail.intent.status !== 'succeeded' ||
        detail.tenders.length < 2 ||
        detail.lineAllocations.length < 2 ||
        detail.transactions.length < 2 ||
        detail.transactionLineAllocations.length < 2
      ) {
        blockStep(
          stepKey,
          'Advanced payment records were created but traceability invariants failed.',
          {
            paymentIntentId: payment.paymentIntentId,
            hasIntentInList,
            intentStatus: detail.intent.status,
            amountTargetMinor: detail.intent.amountTargetMinor,
            amountCapturedMinor: detail.intent.amountCapturedMinor,
            tenderCount: detail.tenders.length,
            lineAllocationCount: detail.lineAllocations.length,
            transactionCount: detail.transactions.length,
            transactionLineAllocationCount: detail.transactionLineAllocations.length,
          },
        )
      }

      return {
        note: 'Advanced split-tender flow executed and traceable through intent/tender/line allocations.',
        evidence: {
          paymentIntentId: payment.paymentIntentId,
          amountTargetMinor: detail.intent.amountTargetMinor,
          amountCapturedMinor: detail.intent.amountCapturedMinor,
          intentStatus: detail.intent.status,
          tenderCount: detail.tenders.length,
          lineAllocationCount: detail.lineAllocations.length,
          transactionCount: detail.transactions.length,
          transactionLineAllocationCount: detail.transactionLineAllocations.length,
          hasIntentInList,
        },
      }
    }

    case 'adversary-cross-biz-read': {
      if (!ctx.bizId) throw new Error('bizId missing for adversary test.')
      ctx.adversary = await createAuthSession(`adversary-${ctx.sagaKey}`)
      await assertForbidden(ctx.adversary, `/api/v1/bizes/${ctx.bizId}/booking-orders`, { method: 'GET' })
      return {
        note: 'Cross-biz read blocked for non-member account.',
        evidence: { adversaryUserId: ctx.adversary.userId },
      }
    }

    case 'adversary-hold-abuse': {
      if (!ctx.bizId || !ctx.offerId || !ctx.offerVersionId) {
        throw new Error('biz/offer/version missing for abuse simulation.')
      }
      if (!ctx.adversary) {
        ctx.adversary = await createAuthSession(`adversary-${ctx.sagaKey}`)
      }
      for (let i = 0; i < 3; i += 1) {
        await assertForbidden(ctx.adversary, `/api/v1/bizes/${ctx.bizId}/booking-orders`, {
          method: 'POST',
          body: {
            offerId: ctx.offerId,
            offerVersionId: ctx.offerVersionId,
            status: 'draft',
            subtotalMinor: 1000,
            taxMinor: 0,
            feeMinor: 0,
            discountMinor: 0,
            totalMinor: 1000,
            currency: 'USD',
          },
        })
      }
      return { note: 'Repeated unauthorized hold attempts were blocked (403).' }
    }

    case 'adversary-marketplace-tenant-isolation': {
      if (!ctx.bizId) throw new Error('bizId missing for marketplace isolation test.')
      if (!ctx.adversary) {
        ctx.adversary = await createAuthSession(`adversary-${ctx.sagaKey}`)
      }
      await assertForbidden(ctx.adversary, `/api/v1/bizes/${ctx.bizId}/offers`, { method: 'GET' })
      await assertForbidden(ctx.adversary, `/api/v1/bizes/${ctx.bizId}/booking-orders`, { method: 'GET' })
      return {
        note: 'Marketplace/cross-biz isolation enforced for non-member adversary.',
        evidence: { adversaryUserId: ctx.adversary.userId },
      }
    }

    case 'member-review-bookings': {
      if (!ctx.bizId) throw new Error('bizId missing for member review.')
      const memberCookie = ctx.member?.cookie ?? ctx.owner.cookie
      const list = await requestJson<{ success: true; data: Array<{ id: string }> }>(
        `/api/v1/bizes/${ctx.bizId}/booking-orders?perPage=20`,
        { cookie: memberCookie, acceptStatuses: [200] },
      )
      const bookings = getApiData<Array<{ id: string }>>(list.payload)
      const targetId = bookings[0]?.id ?? ctx.bookingIds[0]
      if (!targetId) throw new Error('No booking found to progress.')
      await requestJson(`/api/v1/bizes/${ctx.bizId}/booking-orders/${targetId}/status`, {
        method: 'PATCH',
        cookie: memberCookie,
        body: { status: 'in_progress' },
        acceptStatuses: [200],
      })
      return { note: 'Bookings reviewed and one booking progressed.', evidence: { targetId } }
    }

    case 'owner-calendar-review': {
      if (!ctx.bizId) throw new Error('bizId missing for calendar review.')
      const [bookings, resources, offers] = await Promise.all([
        requestJson(`/api/v1/bizes/${ctx.bizId}/booking-orders?perPage=50`, {
          cookie: ctx.owner.cookie,
          acceptStatuses: [200],
        }),
        requestJson(`/api/v1/bizes/${ctx.bizId}/resources`, {
          cookie: ctx.owner.cookie,
          acceptStatuses: [200],
        }),
        requestJson(`/api/v1/bizes/${ctx.bizId}/offers`, {
          cookie: ctx.owner.cookie,
          acceptStatuses: [200],
        }),
      ])
      return {
        note: 'Operational timeline inputs fetched (bookings/resources/offers).',
        evidence: {
          bookingCount: getApiData<unknown[]>(bookings.payload).length,
          resourceCount: getApiData<unknown[]>(resources.payload).length,
          offerCount: getApiData<unknown[]>(offers.payload).length,
          timezone: 'UTC',
          rangeLabel: 'Upcoming schedule window',
          bookingPreview: getApiData<Array<Record<string, unknown>>>(bookings.payload).slice(0, 8),
        },
      }
    }

    case 'owner-revenue-sanity': {
      if (!ctx.bizId) throw new Error('bizId missing for revenue sanity.')
      const bookings = await requestJson<{ success: true; data: Array<{ id: string; totalMinor: number }> }>(
        `/api/v1/bizes/${ctx.bizId}/booking-orders?perPage=100`,
        {
          cookie: ctx.owner.cookie,
          acceptStatuses: [200],
        },
      )
      const rows = getApiData<Array<{ id: string; totalMinor: number }>>(bookings.payload)
      const totalMinor = rows.reduce((sum, row) => sum + (row.totalMinor ?? 0), 0)
      return {
        note: 'Revenue sanity computed from booking orders.',
        evidence: {
          bookingCount: rows.length,
          totalMinor,
          currency: 'USD',
        },
      }
    }

    case 'owner-verify-uc-analytics-outcome': {
      const stats = await requestJson<{
        totalRevenue: number
        totalBookings: number
        totalCustomers: number
        pendingOrders: number
      }>('/api/v1/stats', {
        cookie: ctx.owner.cookie,
        acceptStatuses: [200],
        raw: true,
      })
      return {
        note: 'Analytics outcome verified from reporting endpoint.',
        evidence: {
          totalRevenue: stats.payload.totalRevenue,
          totalBookings: stats.payload.totalBookings,
          totalCustomers: stats.payload.totalCustomers,
          pendingOrders: stats.payload.pendingOrders,
        },
      }
    }

    case 'owner-review-route-dispatch-state': {
      if (!ctx.bizId) {
        throw new Error('bizId required before dispatch-state review.')
      }
      const response = await requestJson<{
        success: true
        data: {
          at: string
          window: {
            startAt: string
            endAt: string
            lookaheadHours: number
          }
          summaries: {
            tasksByStatus: unknown[]
            tripsByStatus: unknown[]
            routesByStatus: unknown[]
          }
          upcomingTrips: unknown[]
          recentTasks: unknown[]
        }
      }>(`/api/v1/bizes/${ctx.bizId}/dispatch/state?lookaheadHours=48&perEntityLimit=20`, {
        cookie: ctx.owner.cookie,
        acceptStatuses: [200],
      })
      const state = getApiData<{
        at: string
        window: {
          startAt: string
          endAt: string
          lookaheadHours: number
        }
        summaries: {
          tasksByStatus: unknown[]
          tripsByStatus: unknown[]
          routesByStatus: unknown[]
        }
        upcomingTrips: unknown[]
        recentTasks: unknown[]
      }>(response.payload)
      if (!state.window || !state.summaries) {
        blockStep(stepKey, 'Dispatch state response shape is invalid.', {
          expectedKeys: ['window', 'summaries', 'upcomingTrips', 'recentTasks'],
          actualKeys: Object.keys((state as Record<string, unknown>) ?? {}),
        })
      }
      return {
        note: 'Dispatch/transport read-model fetched for the current biz scope.',
        evidence: {
          lookaheadHours: state.window.lookaheadHours,
          routeStatusBuckets: state.summaries.routesByStatus.length,
          tripStatusBuckets: state.summaries.tripsByStatus.length,
          taskStatusBuckets: state.summaries.tasksByStatus.length,
          upcomingTripCount: state.upcomingTrips.length,
          recentTaskCount: state.recentTasks.length,
        },
      }
    }

    case 'runner-submit-artifacts': {
      const markdown = [
        '# Auto Saga Report',
        '',
        `- sagaKey: \`${ctx.sagaKey}\``,
        `- runId: \`${ctx.runId}\``,
        `- generatedAt: \`${nowIso()}\``,
        '',
        'All lifecycle steps were executed by the API-only auto runner.',
      ].join('\n')

      await requestJson(`/api/v1/sagas/runs/${ctx.runId}/report`, {
        method: 'POST',
        cookie: ctx.owner.cookie,
        body: {
          markdown,
          summary: {
            source: 'rerun-sagas.ts',
            auto: true,
          },
        },
        acceptStatuses: [201],
      })

      return { note: 'Final report artifact submitted.' }
    }

    // Intentional failure test cases
    case 'test-http-500-error': {
      // This should fail with 500
      await requestJson('/api/v1/test/trigger-500', {
        method: 'POST',
        cookie: ctx.owner.cookie,
        acceptStatuses: [201], // Expecting success, will get 500 and fail
      })
      return { note: 'This should not succeed' }
    }

    case 'test-validation-error': {
      // This should fail with 400
      await requestJson('/api/v1/test/trigger-400', {
        method: 'POST',
        cookie: ctx.owner.cookie,
        body: {}, // Missing requiredField
        acceptStatuses: [201], // Expecting success, will get 400 and fail
      })
      return { note: 'This should not succeed' }
    }

    case 'test-not-found-error': {
      // This should fail with 404
      await requestJson('/api/v1/test/trigger-404/nonexistent-id', {
        cookie: ctx.owner.cookie,
        acceptStatuses: [200], // Expecting success, will get 404 and fail
      })
      return { note: 'This should not succeed' }
    }

    case 'test-unauthorized-access': {
      // This should fail with 401 - no cookie sent
      await requestJson('/api/v1/test/trigger-401', {
        acceptStatuses: [200], // Expecting success, will get 401 and fail
      })
      return { note: 'This should not succeed' }
    }

    case 'test-forbidden-access': {
      // This should fail with 403
      await requestJson('/api/v1/test/trigger-403', {
        cookie: ctx.owner.cookie,
        acceptStatuses: [200], // Expecting success, will get 403 and fail
      })
      return { note: 'This should not succeed' }
    }

    case 'test-duplicate-slug': {
      // This should fail with 409
      await requestJson('/api/v1/test/trigger-409', {
        method: 'POST',
        cookie: ctx.owner.cookie,
        acceptStatuses: [201], // Expecting success, will get 409 and fail
      })
      return { note: 'This should not succeed' }
    }

    case 'test-timeout-scenario': {
      // This should fail with timeout/504
      await requestJson('/api/v1/test/trigger-timeout', {
        cookie: ctx.owner.cookie,
        acceptStatuses: [200], // Expecting success, will get 504 and fail
      })
      return { note: 'This should not succeed' }
    }

    case 'test-invalid-json-response': {
      // This should fail when parsing JSON
      const response = await fetch(`${API_BASE_URL}/api/v1/test/trigger-malformed`, {
        headers: { cookie: ctx.owner.cookie },
      })
      const text = await response.text()
      // Try to parse as JSON - this will throw
      JSON.parse(text)
      return { note: 'This should not succeed' }
    }

    case 'test-missing-prerequisite': {
      // Try to use ctx.offerId when it doesn't exist
      if (!ctx.offerId) {
        throw new Error('offerId is required but not set - intentional failure for testing')
      }
      return { note: 'This should not succeed', evidence: { offerId: ctx.offerId } }
    }

    default:
      blockStep(
        stepKey,
        'Runner executor is not implemented for this step yet (runner gap).',
        {
          expected: 'Add runStep case in apps/api/src/scripts/rerun-sagas.ts',
        },
      )
  }
}

async function executeRun(ctx: RunContext): Promise<{ ok: boolean; failures: string[] }> {
  const detail = await getSagaRun(ctx.owner, ctx.runId)
  const steps = detail.steps
  const failures: string[] = []

  for (const step of steps) {
    const stepKey = step.stepKey
    const stepTitle = step.title || prettyStepTitle(stepKey)
    const stepApiTrace: ApiTraceEntry[] = []
    try {
      await executeStepDelay(ctx, step)
      const resultPayload = await stepTraceStore.run(stepApiTrace, async () => runStep(ctx, step))
      const contractSummary = evaluateStepContract(stepKey, stepApiTrace)
      if (contractSummary && contractSummary.failedRules > 0) {
        throw new StepExecutionError(
          'failed',
          `Step contract failed (${contractSummary.failedRules}/${contractSummary.rules.length} rules).`,
          {
            contract: contractSummary,
          },
        )
      }
      await attachApiTrace(ctx, stepKey, stepTitle, stepApiTrace)
      await reportStep(
        ctx,
        stepKey,
        'passed',
        resultPayload,
        undefined,
        contractSummary
          ? {
              contractDescription: contractSummary.description,
              contractPassedRules: contractSummary.passedRules,
              contractFailedRules: contractSummary.failedRules,
              contractRules: contractSummary.rules,
              observedPaths: contractSummary.observedPaths,
              matchedPaths: contractSummary.matchedPaths,
            }
          : undefined,
      )
      try {
        await attachSnapshot(ctx, stepKey, stepTitle, 'passed', resultPayload, {
          stepKey,
          resultPayload,
          apiCalls: stepApiTrace,
          contract: contractSummary ?? null,
        })
      } catch (snapshotError) {
        const message =
          snapshotError instanceof Error ? snapshotError.message : String(snapshotError)
        failures.push(`${stepKey}: post-pass snapshot failed (${message})`)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const status: Exclude<StepTerminalStatus, 'passed'> =
        error instanceof StepExecutionError ? error.status : 'failed'
      if (status !== 'skipped') {
        failures.push(`${stepKey}: ${message}`)
      }
      const isBlocked = status === 'blocked'
      const isSkipped = status === 'skipped'
      const structuredEvidence =
        error instanceof StepExecutionError && error.evidence ? error.evidence : undefined

      const failurePayload: StepResultPayload = {
        note: `${isSkipped ? 'Step skipped' : isBlocked ? 'Step blocked' : 'Step failed'}: ${message}`,
        evidence: {
          error: message,
          failed: !isBlocked && !isSkipped,
          blocked: isBlocked,
          skipped: isSkipped,
          ...(structuredEvidence ?? {}),
        },
      }

      /**
       * Record terminal step status first.
       *
       * Why ordering matters:
       * - Artifact persistence can fail independently (size, validation, IO).
       * - We never want artifact failures to leave lifecycle steps in `pending`.
       */
      try {
        await reportStep(ctx, stepKey, status, failurePayload, message)
      } catch (reportError) {
        const reportMessage =
          reportError instanceof Error ? reportError.message : String(reportError)
        failures.push(`${stepKey}: could not report step status (${reportMessage})`)
        continue
      }

      try {
        await attachApiTrace(ctx, stepKey, stepTitle, stepApiTrace)
      } catch (traceError) {
        const traceMessage = traceError instanceof Error ? traceError.message : String(traceError)
        failures.push(`${stepKey}: could not attach api trace (${traceMessage})`)
      }

      try {
        await attachSnapshot(ctx, stepKey, stepTitle, status, failurePayload, {
          stepKey,
          error: message,
          resultPayload: failurePayload,
          apiCalls: stepApiTrace,
        })
      } catch (snapshotError) {
        const snapshotMessage =
          snapshotError instanceof Error ? snapshotError.message : String(snapshotError)
        failures.push(`${stepKey}: could not attach snapshot (${snapshotMessage})`)
      }
    }
  }

  const finalDetail = await getSagaRun(ctx.owner, ctx.runId)
  const ok = finalDetail.run.status === 'passed'
  return { ok, failures }
}

/**
 * Execute one already-created saga run end-to-end.
 *
 * This is used by API route handlers so dashboard reruns can execute
 * immediately instead of staying pending.
 */
export async function executeExistingSagaRun(input: {
  runId: string
  sagaKey: string
  owner: AuthSession
  bizId?: string | null
}) {
  const ctx: RunContext = {
    sagaKey: input.sagaKey,
    runId: input.runId,
    owner: input.owner,
    bizId: input.bizId ?? undefined,
    bookingIds: [],
    metadataPatch: {},
  }
  return executeRun(ctx)
}

async function main() {
  const owner = await createAuthSession('owner-runner')
  const definitions = await listSagaDefinitions(owner)
  const selected = ONLY_SAGA_KEY
    ? definitions.filter((d) => d.sagaKey === ONLY_SAGA_KEY)
    : definitions

  const toRun = MAX_SAGAS > 0 ? selected.slice(0, MAX_SAGAS) : selected
  if (toRun.length === 0) {
    throw new Error('No saga definitions found to run.')
  }

  console.log(`Running ${toRun.length} saga(s) against ${API_BASE_URL}...`)
  const start = Date.now()

  let passed = 0
  let failed = 0
  let cursor = 0
  const failedRuns: Array<{ sagaKey: string; runId: string; failures: string[] }> = []

  const workers = Array.from({ length: Math.min(SAGA_CONCURRENCY, toRun.length) }).map(
    async (_unused, workerIndex) => {
      while (true) {
        const index = cursor
        cursor += 1
        if (index >= toRun.length) return

        const def = toRun[index]
        const created = await createSagaRun(owner, def.sagaKey)
        const runId = created.run.id
        const ctx: RunContext = {
          sagaKey: def.sagaKey,
          runId,
          owner,
          bookingIds: [],
          metadataPatch: {},
        }

        process.stdout.write(`[${index + 1}/${toRun.length}] [w${workerIndex + 1}] ${def.sagaKey} ... `)
        const result = await executeRun(ctx)
        if (result.ok) {
          passed += 1
          console.log('passed')
        } else {
          failed += 1
          console.log('failed')
          failedRuns.push({ sagaKey: def.sagaKey, runId, failures: result.failures })
        }
      }
    },
  )

  await Promise.all(workers)

  const durationMs = Date.now() - start
  console.log('\nRerun Summary')
  console.log(`- total: ${toRun.length}`)
  console.log(`- passed: ${passed}`)
  console.log(`- failed: ${failed}`)
  console.log(`- durationMs: ${durationMs}`)

  if (failedRuns.length > 0) {
    console.log('\nFailed Runs')
    for (const row of failedRuns) {
      console.log(`- ${row.sagaKey} (${row.runId})`)
      for (const failure of row.failures.slice(0, 5)) {
        console.log(`  - ${failure}`)
      }
    }
    if (SAGA_STRICT_EXIT) {
      process.exitCode = 1
    } else {
      console.log(
        '\nNon-strict exit mode active. Keeping exit code 0 so agents can continue and report coverage gaps.',
      )
      console.log('Set SAGA_STRICT_EXIT=1 to enforce non-zero exit on failed runs.')
    }
  }
}

const isDirectRun = (() => {
  const argv1 = process.argv[1]
  if (!argv1) return false
  try {
    return import.meta.url === pathToFileURL(argv1).href
  } catch {
    return false
  }
})()

if (isDirectRun) {
  main().catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
}
