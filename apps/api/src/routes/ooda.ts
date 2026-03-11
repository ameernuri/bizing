import { createHash } from 'crypto'
import { Hono } from 'hono'
import { and, asc, count, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm'
import { z } from 'zod'
import dbPackage from '@bizing/db'
import { getCurrentUser, requireAuth } from '../middleware/auth.js'
import { executeCrudRouteAction } from '../services/action-route-bridge.js'
import { fail, ok, parsePositiveInt } from './_api.js'
import { createSagaRun, getSagaRunDetail } from '../services/sagas.js'
import { chatWithLLM } from '../services/llm.js'
import { publishSagaRuntimeEvent } from '../services/saga-events.js'
import { executeExistingSagaRun } from '../scripts/rerun-sagas.js'

const {
  db,
  oodaLoops,
  oodaLoopLinks,
  oodaLoopEntries,
  oodaLoopActions,
  oodaAsciipDocuments,
  sagaRuns,
  sagaRunSteps,
  sagaUseCases,
  sagaPersonas,
  sagaDefinitions,
} = dbPackage

const listLoopsQuerySchema = z.object({
  status: z.enum(['draft', 'active', 'paused', 'completed', 'archived']).optional(),
  query: z.string().optional(),
  limit: z.string().optional(),
})

const createLoopBodySchema = z.object({
  loopKey: z.string().min(1).max(160).optional(),
  title: z.string().min(1).max(255),
  objective: z.string().optional().nullable(),
  status: z.enum(['draft', 'active', 'paused', 'completed', 'archived']).optional(),
  currentPhase: z.enum(['observe', 'orient', 'decide', 'act']).optional(),
  designGateStatus: z.enum(['pending', 'passed', 'failed']).optional(),
  behaviorGateStatus: z.enum(['pending', 'passed', 'failed']).optional(),
  priority: z.number().int().min(1).max(100).optional(),
  bizId: z.string().optional().nullable(),
  ownerUserId: z.string().optional().nullable(),
  healthScore: z.number().int().min(0).max(100).optional(),
  nextReviewAt: z.string().datetime().optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
})

const updateLoopBodySchema = createLoopBodySchema.partial()

const createLoopLinkBodySchema = z.object({
  targetType: z.enum([
    'use_case',
    'persona',
    'saga_definition',
    'saga_run',
    'saga_step',
    'coverage_report',
    'coverage_item',
    'note',
  ]),
  targetId: z.string().min(1),
  relationRole: z.enum(['focus', 'input', 'output', 'dependency', 'evidence']).default('focus'),
  metadata: z.record(z.unknown()).optional(),
})

const listEntriesQuerySchema = z.object({
  phase: z.enum(['observe', 'orient', 'decide', 'act']).optional(),
  limit: z.string().optional(),
})

const listBlockersQuerySchema = z.object({
  limit: z.string().optional(),
})

const createEntryBodySchema = z.object({
  phase: z.enum(['observe', 'orient', 'decide', 'act']),
  entryType: z.enum(['signal', 'hypothesis', 'decision', 'action_plan', 'result', 'postmortem']),
  title: z.string().min(1).max(255),
  bodyMarkdown: z.string().optional().nullable(),
  severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  status: z.enum(['open', 'accepted', 'rejected', 'resolved', 'blocked']).optional(),
  gapType: z
    .enum([
      'pnp_gap',
      'uc_gap',
      'persona_gap',
      'schema_gap',
      'api_gap',
      'workflow_gap',
      'policy_gap',
      'event_gap',
      'audit_gap',
      'test_pack_gap',
      'docs_gap',
    ])
    .optional()
    .nullable(),
  owningLayer: z
    .enum([
      'pnp',
      'uc',
      'persona',
      'schema',
      'api',
      'workflow',
      'policy',
      'event',
      'audit',
      'test_pack',
      'docs',
      'ops',
    ])
    .optional()
    .nullable(),
  sourceType: z.enum(['manual', 'saga_run', 'api', 'system', 'llm']).optional(),
  sourceRefId: z.string().optional().nullable(),
  linkedUseCaseId: z.string().optional().nullable(),
  linkedSagaDefinitionId: z.string().optional().nullable(),
  linkedSagaRunId: z.string().optional().nullable(),
  linkedSagaRunStepId: z.string().optional().nullable(),
  linkedCoverageItemId: z.string().optional().nullable(),
  evidence: z.record(z.unknown()).optional(),
  sortOrder: z.number().int().optional(),
})

const updateEntryBodySchema = createEntryBodySchema.partial()

const createActionBodySchema = z.object({
  oodaLoopEntryId: z.string().optional().nullable(),
  actionKey: z.string().min(1).max(160),
  actionTitle: z.string().min(1).max(255),
  status: z.enum(['queued', 'running', 'succeeded', 'failed', 'cancelled']).optional(),
  dryRun: z.boolean().optional(),
  assignedToUserId: z.string().optional().nullable(),
  linkedSagaRunId: z.string().optional().nullable(),
  requestPayload: z.record(z.unknown()).optional(),
  resultPayload: z.record(z.unknown()).optional(),
  errorMessage: z.string().optional().nullable(),
})

const updateActionBodySchema = createActionBodySchema.partial()

const createLoopRunBodySchema = z.object({
  sagaKey: z.string().min(1),
  mode: z.enum(['dry_run', 'live']).default('dry_run'),
  runnerLabel: z.string().max(160).optional(),
  autoExecute: z.boolean().default(true),
  bizId: z.string().optional(),
  oodaLoopEntryId: z.string().optional().nullable(),
  actionTitle: z.string().max(255).optional(),
  requestPayload: z.record(z.unknown()).optional(),
})

const generateBodySchema = z.object({
  kind: z.enum(['use_case', 'persona', 'saga_definition']),
  prompt: z.string().min(1),
  model: z.string().optional(),
  context: z.string().optional(),
})

const listAsciipFilesQuerySchema = z.object({
  query: z.string().optional(),
  limit: z.string().optional(),
  directory: z.string().optional(),
})

const asciipFilePathQuerySchema = z.object({
  path: z.string().min(1).max(600),
})

const createAsciipFileBodySchema = z
  .object({
    path: z.string().max(600).optional(),
    name: z.string().max(180).optional(),
    directory: z.string().max(420).optional(),
    title: z.string().max(180).optional(),
    editorState: z.record(z.unknown()).optional(),
    overwrite: z.boolean().default(false),
  })
  .superRefine((value, ctx) => {
    if (!value.path && !value.name) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['path'],
        message: 'Either path or name is required.',
      })
    }
  })

const updateAsciipFileBodySchema = z.object({
  path: z.string().min(1).max(600),
  editorState: z.record(z.unknown()),
  ifMatchEtag: z.string().optional(),
  changeType: z.enum(['autosave', 'commit']).default('commit'),
})

const renameAsciipFileBodySchema = z
  .object({
    path: z.string().min(1).max(600),
    newPath: z.string().min(1).max(600).optional(),
    title: z.string().max(180).optional(),
    ifMatchEtag: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    const titleProvided = typeof value.title === 'string' && value.title.trim().length > 0
    if (!value.newPath && !titleProvided) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['newPath'],
        message: 'Provide newPath and/or title.',
      })
    }
  })

type EntryEvidence = Record<string, unknown>
type OodaEntryType = z.infer<typeof createEntryBodySchema>['entryType']
type OodaEntryStatus = z.infer<typeof createEntryBodySchema>['status']

type AsciipFileSummary = {
  id: string
  path: string
  name: string
  title: string
  sizeBytes: number
  revision: number
  updatedAt: string
  etag: string
}

type AsciipFileDetail = AsciipFileSummary & {
  editorState: Record<string, unknown>
}

const CANVASCII_EXTENSION = '.canvascii'
const LEGACY_ASCIIP_EXTENSION = '.asciip'
const ASCIIP_NAME_REGEX = /^[a-zA-Z0-9._ -]+$/
const ASCIIP_PATH_SEGMENT_REGEX = /^[a-zA-Z0-9._ -]+$/

function hasSupportedCanvasciiExtension(value: string) {
  const normalized = value.toLowerCase()
  return normalized.endsWith(CANVASCII_EXTENSION) || normalized.endsWith(LEGACY_ASCIIP_EXTENSION)
}

function normalizeAsciipRelativePath(input: string): string | null {
  const raw = input.trim().replaceAll('\\', '/')
  if (!raw || raw.includes('\0') || raw.startsWith('/') || /^[a-zA-Z]:\//.test(raw)) return null
  const segments = raw.split('/').filter(Boolean)
  if (segments.length === 0) return null
  if (!segments.every((segment) => segment !== '.' && segment !== '..' && ASCIIP_PATH_SEGMENT_REGEX.test(segment))) {
    return null
  }
  const normalized = segments.join('/')
  return hasSupportedCanvasciiExtension(normalized) ? normalized : null
}

function normalizeAsciipDirectory(input: string): string | null {
  const raw = input.trim().replaceAll('\\', '/')
  if (!raw) return ''
  if (raw.startsWith('/') || /^[a-zA-Z]:\//.test(raw) || raw.includes('\0')) return null
  const segments = raw.split('/').filter(Boolean)
  if (
    segments.length === 0 ||
    !segments.every((segment) => segment !== '.' && segment !== '..' && ASCIIP_PATH_SEGMENT_REGEX.test(segment))
  ) {
    return null
  }
  return segments.join('/')
}

function buildStrongAsciipEtag(input: { revision: number; state: Record<string, unknown> }): string {
  const serialized = JSON.stringify(input.state ?? {})
  const hash = createHash('sha1').update(serialized).digest('hex').slice(0, 12)
  return `"r${input.revision}-${hash}"`
}

function computeAsciipCreatePath(input: z.infer<typeof createAsciipFileBodySchema>): string | null {
  if (input.path) return normalizeAsciipRelativePath(input.path)

  const normalizedDirectory = normalizeAsciipDirectory(input.directory ?? '')
  if (normalizedDirectory === null) return null

  const rawName = (input.name ?? '').trim()
  if (!rawName || rawName.includes('/') || rawName.includes('\\') || !ASCIIP_NAME_REGEX.test(rawName)) {
    return null
  }
  const fileName = hasSupportedCanvasciiExtension(rawName) ? rawName : `${rawName}${CANVASCII_EXTENSION}`
  const combined = normalizedDirectory ? `${normalizedDirectory}/${fileName}` : fileName
  return normalizeAsciipRelativePath(combined)
}

function computeAsciipSizeBytes(editorState: Record<string, unknown>): number {
  return Buffer.byteLength(JSON.stringify(editorState ?? {}), 'utf8')
}

function toAsciipSummary(row: typeof oodaAsciipDocuments.$inferSelect): AsciipFileSummary {
  const editorState =
    row.editorState && typeof row.editorState === 'object' && !Array.isArray(row.editorState)
      ? (row.editorState as Record<string, unknown>)
      : {}
  const revision = Number(row.revision ?? 1)
  const updatedAt = (row.updatedAt ?? row.createdAt ?? new Date()).toISOString()
  const path = row.documentPath

  return {
    id: row.id,
    path,
    name: path.split('/').pop() ?? path,
    title: row.title,
    sizeBytes: computeAsciipSizeBytes(editorState),
    revision,
    updatedAt,
    etag: buildStrongAsciipEtag({ revision, state: editorState }),
  }
}

function toAsciipDetail(row: typeof oodaAsciipDocuments.$inferSelect): AsciipFileDetail {
  const summary = toAsciipSummary(row)
  return {
    ...summary,
    editorState:
      row.editorState && typeof row.editorState === 'object' && !Array.isArray(row.editorState)
        ? (row.editorState as Record<string, unknown>)
        : {},
  }
}

let asciipTableReady = false
let asciipTableReadyPromise: Promise<void> | null = null

async function ensureAsciipDocumentsTableReady() {
  if (asciipTableReady) return
  if (asciipTableReadyPromise) return asciipTableReadyPromise

  asciipTableReadyPromise = (async () => {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "ooda_asciip_documents" (
        "id" text PRIMARY KEY NOT NULL,
        "biz_id" text,
        "document_path" varchar(600) NOT NULL,
        "title" varchar(180) NOT NULL,
        "editor_state" jsonb DEFAULT '{}'::jsonb NOT NULL,
        "revision" integer DEFAULT 1 NOT NULL,
        "status" varchar(24) DEFAULT 'active' NOT NULL,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
        "deleted_at" timestamp with time zone,
        "created_by" text,
        "updated_by" text,
        "deleted_by" text,
        CONSTRAINT "ooda_asciip_documents_revision_check" CHECK ("revision" >= 1),
        CONSTRAINT "ooda_asciip_documents_status_check" CHECK ("status" IN ('active', 'archived'))
      )
    `)
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS "ooda_asciip_documents_path_unique"
      ON "ooda_asciip_documents" ("document_path")
    `)
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "ooda_asciip_documents_biz_status_idx"
      ON "ooda_asciip_documents" ("biz_id", "status", "updated_at")
    `)
    await db.execute(sql`
      DO $$ BEGIN
        ALTER TABLE "ooda_asciip_documents"
          ADD CONSTRAINT "ooda_asciip_documents_biz_id_bizes_id_fk"
          FOREIGN KEY ("biz_id") REFERENCES "bizes"("id")
          ON DELETE NO ACTION ON UPDATE NO ACTION;
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `)
    await db.execute(sql`
      DO $$ BEGIN
        ALTER TABLE "ooda_asciip_documents"
          ADD CONSTRAINT "ooda_asciip_documents_created_by_users_id_fk"
          FOREIGN KEY ("created_by") REFERENCES "users"("id")
          ON DELETE NO ACTION ON UPDATE NO ACTION;
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `)
    await db.execute(sql`
      DO $$ BEGIN
        ALTER TABLE "ooda_asciip_documents"
          ADD CONSTRAINT "ooda_asciip_documents_updated_by_users_id_fk"
          FOREIGN KEY ("updated_by") REFERENCES "users"("id")
          ON DELETE NO ACTION ON UPDATE NO ACTION;
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `)
    await db.execute(sql`
      DO $$ BEGIN
        ALTER TABLE "ooda_asciip_documents"
          ADD CONSTRAINT "ooda_asciip_documents_deleted_by_users_id_fk"
          FOREIGN KEY ("deleted_by") REFERENCES "users"("id")
          ON DELETE NO ACTION ON UPDATE NO ACTION;
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `)
    asciipTableReady = true
  })()

  try {
    await asciipTableReadyPromise
  } finally {
    asciipTableReadyPromise = null
  }
}

function hasAtLeastOneEvidenceAnchor(evidence: EntryEvidence): boolean {
  const anchorKeys = [
    'apiTraceRef',
    'apiTraceRefs',
    'snapshotRef',
    'snapshotRefs',
    'eventRef',
    'eventRefs',
    'auditRef',
    'auditRefs',
    'reportNote',
  ]
  return anchorKeys.some((key) => {
    const value = evidence[key]
    if (value === null || value === undefined) return false
    if (Array.isArray(value)) return value.length > 0
    if (typeof value === 'string') return value.trim().length > 0
    return true
  })
}

function hasApiTraceEvidence(evidence: EntryEvidence): boolean {
  const single = evidence.apiTraceRef
  if (typeof single === 'string' && single.trim().length > 0) return true
  const many = evidence.apiTraceRefs
  return Array.isArray(many) && many.length > 0
}

/**
 * Enforce the workflow's gap/evidence quality bar at OODA-entry write time.
 *
 * ELI5:
 * - gaps must have an owner layer
 * - important entries must carry concrete evidence pointers
 * - resolved result entries must include API-trace proof
 */
function validateLoopEntryContract(input: {
  gapType?: string | null
  owningLayer?: string | null
  entryType?: OodaEntryType
  status?: OodaEntryStatus
  evidence?: EntryEvidence
}) {
  if (input.gapType && !input.owningLayer) {
    return {
      ok: false as const,
      reason: 'Gap entries must include owningLayer (one primary owner per gap).',
      code: 'ENTRY_GAP_OWNER_REQUIRED',
    }
  }

  const evidence = input.evidence ?? {}
  const meaningfulEntryTypes = new Set(['signal', 'result', 'postmortem'])
  if (input.entryType && meaningfulEntryTypes.has(input.entryType)) {
    if (!hasAtLeastOneEvidenceAnchor(evidence)) {
      return {
        ok: false as const,
        reason:
          'Meaningful OODA entries require evidence anchors (api/snapshot/event/audit/report note).',
        code: 'ENTRY_EVIDENCE_REQUIRED',
      }
    }
  }

  if (input.entryType === 'result' && input.status === 'resolved') {
    if (!hasApiTraceEvidence(evidence)) {
      return {
        ok: false as const,
        reason: 'Resolved result entries must include API trace evidence references.',
        code: 'ENTRY_RESULT_TRACE_REQUIRED',
      }
    }
  }

  return { ok: true as const }
}

function normalizeLoopWorkflowMetadata(input: {
  existing?: Record<string, unknown> | null
  designGateStatus?: 'pending' | 'passed' | 'failed'
  behaviorGateStatus?: 'pending' | 'passed' | 'failed'
}) {
  const base = (input.existing ?? {}) as Record<string, unknown>
  const workflow =
    (base.workflowContract as Record<string, unknown> | undefined) ?? {}
  return {
    ...base,
    workflowContract: {
      ...workflow,
      designGateStatus: input.designGateStatus ?? workflow.designGateStatus ?? 'pending',
      behaviorGateStatus: input.behaviorGateStatus ?? workflow.behaviorGateStatus ?? 'pending',
    },
  }
}

function toLoopKey(title: string) {
  const base = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120)
  const suffix = crypto.randomUUID().slice(0, 8)
  return `loop-${base || 'untitled'}-${suffix}`
}

type OodaBlockerSeverity = 'low' | 'medium' | 'high' | 'critical'
type OodaBlockerSource = 'saga_step' | 'loop_entry' | 'loop_action'

type OodaBlockerRow = {
  id: string
  source: OodaBlockerSource
  severity: OodaBlockerSeverity
  status: string
  title: string
  summary: string
  sagaKey?: string | null
  sagaRunId?: string | null
  sagaRunStepId?: string | null
  phaseTitle?: string | null
  stepKey?: string | null
  expectedResult?: string | null
  actualResult?: string | null
  failureCode?: string | null
  failureSignature?: string | null
  updatedAt?: string | null
  repro?: {
    method: string
    path: string
    status?: number | null
    requestBody?: unknown
    responseBody?: unknown
  } | null
  evidenceQuality: 'strong' | 'weak'
}

const OODA_BLOCKER_SEVERITIES = ['low', 'medium', 'high', 'critical'] as const

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function toIsoOrNull(value: unknown): string | null {
  if (!value) return null
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'string') {
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
  }
  return null
}

function normalizeBlockerSeverity(value: unknown): OodaBlockerSeverity {
  if (typeof value === 'string' && (OODA_BLOCKER_SEVERITIES as readonly string[]).includes(value)) {
    return value as OodaBlockerSeverity
  }
  return 'medium'
}

function normalizeFailureSignature(input: {
  failureCode?: string | null
  failureMessage?: string | null
  stepKey?: string | null
}) {
  if (input.failureCode && input.failureCode.trim()) return input.failureCode.trim().toUpperCase()
  const message = (input.failureMessage ?? '').trim().toLowerCase()
  if (!message) return (input.stepKey ?? 'UNKNOWN_STEP').toUpperCase()
  if (message.includes('unauthorized') || message.includes('forbidden')) return 'AUTHZ_OR_ROLE_MISMATCH'
  if (message.includes('timeout') || message.includes('timed out')) return 'TIMEOUT_OR_ASYNC_WAIT'
  if (message.includes('validation') || message.includes('invalid')) return 'VALIDATION_CONTRACT_MISMATCH'
  if (message.includes('not found')) return 'MISSING_ENTITY_OR_REFERENCE'
  if (message.includes('constraint') || message.includes('unique')) return 'DB_CONSTRAINT_OR_IDEMPOTENCY'
  if (message.includes('drift') || message.includes('schema')) return 'SCHEMA_OR_CONTRACT_DRIFT'
  return `${(input.stepKey ?? 'step').toUpperCase()}_ASSERTION_GAP`
}

function parseReplayableApiCall(resultPayload: unknown) {
  const root = asRecord(resultPayload)
  const apiCalls = asArray(root?.apiCalls)
  const candidate = asRecord(apiCalls[apiCalls.length - 1] ?? apiCalls[0])
  if (!candidate) return null
  const method = typeof candidate.method === 'string' ? candidate.method.toUpperCase() : null
  const path = typeof candidate.path === 'string' ? candidate.path : null
  if (!method || !path || !path.startsWith('/api/')) return null
  const status = typeof candidate.status === 'number' ? candidate.status : null
  return {
    method,
    path,
    status,
    requestBody: candidate.requestBody,
    responseBody: candidate.responseBody,
  }
}

function blockerSeverityRank(severity: OodaBlockerSeverity) {
  if (severity === 'critical') return 4
  if (severity === 'high') return 3
  if (severity === 'medium') return 2
  return 1
}

function blockerStatusRank(status: string) {
  const normalized = status.toLowerCase()
  if (normalized === 'blocked' || normalized === 'failed') return 3
  if (normalized === 'open' || normalized === 'running') return 2
  return 1
}

function sortBlockers(rows: OodaBlockerRow[]) {
  return [...rows].sort((a, b) => {
    const severityDiff = blockerSeverityRank(b.severity) - blockerSeverityRank(a.severity)
    if (severityDiff !== 0) return severityDiff
    const statusDiff = blockerStatusRank(b.status) - blockerStatusRank(a.status)
    if (statusDiff !== 0) return statusDiff
    const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0
    const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0
    return timeB - timeA
  })
}

function recommendationForFailureSignature(signature: string) {
  if (signature.includes('AUTHZ')) return 'Check permissions/role mapping first, then rerun one affected saga.'
  if (signature.includes('TIMEOUT')) return 'Reduce async uncertainty: verify scheduler/heartbeat and retry with deterministic waits.'
  if (signature.includes('VALIDATION')) return 'Align request/response contract with endpoint schema, then replay failing call.'
  if (signature.includes('NOT_FOUND') || signature.includes('MISSING_ENTITY'))
    return 'Rebuild prerequisites for this flow and confirm ids are linked in the same biz scope.'
  if (signature.includes('CONSTRAINT') || signature.includes('IDEMPOTENCY'))
    return 'Verify idempotency key strategy and duplicate-write handling for this action.'
  return 'Run focused repro on this blocker and capture expected vs actual payloads.'
}

function buildReorient(rows: OodaBlockerRow[]) {
  const grouped = new Map<string, { count: number; latestAt: string | null; sample: OodaBlockerRow }>()
  for (const row of rows) {
    const signature = row.failureSignature ?? 'UNKNOWN'
    const current = grouped.get(signature)
    if (!current) {
      grouped.set(signature, {
        count: 1,
        latestAt: row.updatedAt ?? null,
        sample: row,
      })
      continue
    }
    const prevTime = current.latestAt ? new Date(current.latestAt).getTime() : 0
    const nextTime = row.updatedAt ? new Date(row.updatedAt).getTime() : 0
    current.count += 1
    if (nextTime > prevTime) {
      current.latestAt = row.updatedAt ?? null
      current.sample = row
    }
  }
  return Array.from(grouped.entries())
    .map(([signature, value]) => ({
      signature,
      count: value.count,
      latestAt: value.latestAt,
      exampleTitle: value.sample.title,
      recommendation: recommendationForFailureSignature(signature),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
}

async function fetchGlobalBlockers(limit: number): Promise<OodaBlockerRow[]> {
  const rows = await db
    .select({
      stepId: sagaRunSteps.id,
      sagaRunId: sagaRunSteps.sagaRunId,
      sagaKey: sagaRuns.sagaKey,
      phaseTitle: sagaRunSteps.phaseTitle,
      stepKey: sagaRunSteps.stepKey,
      expectedResult: sagaRunSteps.expectedResult,
      failureCode: sagaRunSteps.failureCode,
      failureMessage: sagaRunSteps.failureMessage,
      resultPayload: sagaRunSteps.resultPayload,
      status: sagaRunSteps.status,
      stepUpdatedAt: sql<Date | null>`"saga_run_steps"."updated_at"`,
    })
    .from(sagaRunSteps)
    .innerJoin(sagaRuns, eq(sagaRunSteps.sagaRunId, sagaRuns.id))
    .where(
      and(
        sql`"saga_run_steps"."deleted_at" IS NULL`,
        sql`"saga_runs"."deleted_at" IS NULL`,
        inArray(sagaRunSteps.status, ['failed', 'blocked']),
      ),
    )
    .orderBy(
      desc(sql`"saga_run_steps"."updated_at"`),
      desc(sql`"saga_runs"."updated_at"`),
    )
    .limit(Math.max(limit * 6, 30))

  const blockers: OodaBlockerRow[] = rows.map((row) => {
    const replay = parseReplayableApiCall(row.resultPayload)
    const signature = normalizeFailureSignature({
      failureCode: row.failureCode,
      failureMessage: row.failureMessage,
      stepKey: row.stepKey,
    })
    return {
      id: row.stepId,
      source: 'saga_step',
      severity: 'high',
      status: row.status,
      title: `${row.sagaKey} · ${row.stepKey}`,
      summary: row.failureMessage ?? 'Step failed without failure message.',
      sagaKey: row.sagaKey,
      sagaRunId: row.sagaRunId,
      sagaRunStepId: row.stepId,
      phaseTitle: row.phaseTitle,
      stepKey: row.stepKey,
      expectedResult: row.expectedResult,
      actualResult: row.failureMessage,
      failureCode: row.failureCode,
      failureSignature: signature,
      updatedAt: toIsoOrNull(row.stepUpdatedAt),
      repro: replay,
      evidenceQuality: replay ? 'strong' : 'weak',
    }
  })

  return sortBlockers(blockers).slice(0, limit)
}

async function fetchLoopBlockers(loopId: string, limit: number): Promise<OodaBlockerRow[]> {
  const [runLinks, runIdsFromEntries, runIdsFromActions, unresolvedEntries, failedActions] =
    await Promise.all([
      db
        .select({ runId: oodaLoopLinks.targetId })
        .from(oodaLoopLinks)
        .where(
          and(
            eq(oodaLoopLinks.oodaLoopId, loopId),
            eq(oodaLoopLinks.targetType, 'saga_run'),
            sql`${oodaLoopLinks.deletedAt} IS NULL`,
          ),
        ),
      db
        .select({ runId: oodaLoopEntries.linkedSagaRunId })
        .from(oodaLoopEntries)
        .where(
          and(
            eq(oodaLoopEntries.oodaLoopId, loopId),
            sql`${oodaLoopEntries.deletedAt} IS NULL`,
            sql`${oodaLoopEntries.linkedSagaRunId} IS NOT NULL`,
          ),
        ),
      db
        .select({ runId: oodaLoopActions.linkedSagaRunId })
        .from(oodaLoopActions)
        .where(
          and(
            eq(oodaLoopActions.oodaLoopId, loopId),
            sql`${oodaLoopActions.deletedAt} IS NULL`,
            sql`${oodaLoopActions.linkedSagaRunId} IS NOT NULL`,
          ),
        ),
      db
        .select()
        .from(oodaLoopEntries)
        .where(
          and(
            eq(oodaLoopEntries.oodaLoopId, loopId),
            inArray(oodaLoopEntries.status, ['open', 'blocked']),
            sql`${oodaLoopEntries.deletedAt} IS NULL`,
          ),
        )
        .orderBy(desc(oodaLoopEntries.updatedAt))
        .limit(Math.max(limit, 20)),
      db
        .select()
        .from(oodaLoopActions)
        .where(
          and(
            eq(oodaLoopActions.oodaLoopId, loopId),
            eq(oodaLoopActions.status, 'failed'),
            sql`${oodaLoopActions.deletedAt} IS NULL`,
          ),
        )
        .orderBy(desc(oodaLoopActions.updatedAt))
        .limit(Math.max(limit, 20)),
    ])

  const runIds = Array.from(
    new Set(
      [...runLinks, ...runIdsFromEntries, ...runIdsFromActions]
        .map((row) => row.runId)
        .filter((runId): runId is string => typeof runId === 'string' && runId.length > 0),
    ),
  )

  const stepRows =
    runIds.length > 0
      ? await db
          .select({
            stepId: sagaRunSteps.id,
            sagaRunId: sagaRunSteps.sagaRunId,
            sagaKey: sagaRuns.sagaKey,
            phaseTitle: sagaRunSteps.phaseTitle,
            stepKey: sagaRunSteps.stepKey,
            expectedResult: sagaRunSteps.expectedResult,
            failureCode: sagaRunSteps.failureCode,
            failureMessage: sagaRunSteps.failureMessage,
            resultPayload: sagaRunSteps.resultPayload,
            status: sagaRunSteps.status,
            stepUpdatedAt: sql<Date | null>`"saga_run_steps"."updated_at"`,
          })
          .from(sagaRunSteps)
          .innerJoin(sagaRuns, eq(sagaRunSteps.sagaRunId, sagaRuns.id))
          .where(
            and(
              sql`"saga_run_steps"."deleted_at" IS NULL`,
              sql`"saga_runs"."deleted_at" IS NULL`,
              inArray(sagaRunSteps.sagaRunId, runIds),
              inArray(sagaRunSteps.status, ['failed', 'blocked']),
            ),
          )
          .orderBy(desc(sql`"saga_run_steps"."updated_at"`))
          .limit(Math.max(limit * 4, 20))
      : []

  const stepBlockers: OodaBlockerRow[] = stepRows.map((row) => {
    const replay = parseReplayableApiCall(row.resultPayload)
    const signature = normalizeFailureSignature({
      failureCode: row.failureCode,
      failureMessage: row.failureMessage,
      stepKey: row.stepKey,
    })
    return {
      id: row.stepId,
      source: 'saga_step',
      severity: 'high',
      status: row.status,
      title: `${row.sagaKey} · ${row.stepKey}`,
      summary: row.failureMessage ?? 'Step failed without failure message.',
      sagaKey: row.sagaKey,
      sagaRunId: row.sagaRunId,
      sagaRunStepId: row.stepId,
      phaseTitle: row.phaseTitle,
      stepKey: row.stepKey,
      expectedResult: row.expectedResult,
      actualResult: row.failureMessage,
      failureCode: row.failureCode,
      failureSignature: signature,
      updatedAt: toIsoOrNull(row.stepUpdatedAt),
      repro: replay,
      evidenceQuality: replay ? 'strong' : 'weak',
    }
  })

  const entryBlockers: OodaBlockerRow[] = unresolvedEntries.map((entry) => ({
    id: entry.id,
    source: 'loop_entry',
    severity: normalizeBlockerSeverity(entry.severity),
    status: entry.status,
    title: entry.title,
    summary: entry.bodyMarkdown ?? 'Open loop entry without additional notes.',
    sagaRunId: entry.linkedSagaRunId ?? null,
    sagaRunStepId: entry.linkedSagaRunStepId ?? null,
    failureSignature: normalizeFailureSignature({
      failureCode: null,
      failureMessage: entry.title,
      stepKey: entry.entryType,
    }),
    updatedAt: entry.updatedAt ? entry.updatedAt.toISOString() : null,
    repro: null,
    evidenceQuality: 'weak',
  }))

  const actionBlockers: OodaBlockerRow[] = failedActions.map((action) => ({
    id: action.id,
    source: 'loop_action',
    severity: 'high',
    status: action.status,
    title: action.actionTitle,
    summary: action.errorMessage ?? 'Action failed without explicit error message.',
    sagaRunId: action.linkedSagaRunId ?? null,
    failureSignature: normalizeFailureSignature({
      failureCode: null,
      failureMessage: action.errorMessage ?? action.actionKey,
      stepKey: action.actionKey,
    }),
    updatedAt: action.updatedAt ? action.updatedAt.toISOString() : null,
    repro: null,
    evidenceQuality: 'weak',
  }))

  return sortBlockers([...stepBlockers, ...entryBlockers, ...actionBlockers]).slice(0, limit)
}

async function createOodaRow(
  c: Parameters<typeof executeCrudRouteAction>[0]['c'],
  bizId: string | null | undefined,
  tableKey: string,
  data: Record<string, unknown>,
  options?: {
    subjectType?: string
    subjectId?: string
    displayName?: string
    metadata?: Record<string, unknown>
  },
) {
  const result = await executeCrudRouteAction({
    c,
    bizId: bizId ?? null,
    tableKey,
    operation: 'create',
    data,
    subjectType: options?.subjectType,
    subjectId: options?.subjectId,
    displayName: options?.displayName,
    metadata: options?.metadata,
  })
  if (!result.ok) {
    return fail(c, result.code, result.message, result.httpStatus, result.details)
  }
  return result.row
}

async function updateOodaRow(
  c: Parameters<typeof executeCrudRouteAction>[0]['c'],
  bizId: string | null | undefined,
  tableKey: string,
  id: string,
  patch: Record<string, unknown>,
  options?: {
    subjectType?: string
    subjectId?: string
    displayName?: string
    metadata?: Record<string, unknown>
  },
) {
  const result = await executeCrudRouteAction({
    c,
    bizId: bizId ?? null,
    tableKey,
    operation: 'update',
    id,
    patch,
    subjectType: options?.subjectType,
    subjectId: options?.subjectId,
    displayName: options?.displayName,
    metadata: options?.metadata,
  })
  if (!result.ok) {
    return fail(c, result.code, result.message, result.httpStatus, result.details)
  }
  return result.row
}

/**
 * Safely extract a `runId` string from an action result payload.
 *
 * ELI5:
 * Some older rows were saved with `resultPayload.runId` but without
 * `linkedSagaRunId`. This helper lets us recover that linkage.
 */
function extractRunIdFromResultPayload(resultPayload: unknown): string | null {
  if (!resultPayload || typeof resultPayload !== 'object') return null
  const candidate = (resultPayload as Record<string, unknown>).runId
  return typeof candidate === 'string' && candidate.length > 0 ? candidate : null
}

/**
 * Ensure one canonical loop->run link exists.
 */
async function ensureLoopRunOutputLink(input: {
  c: Parameters<typeof executeCrudRouteAction>[0]['c']
  bizId?: string | null
  loopId: string
  runId: string
  actorUserId: string
}) {
  const existing = await db.query.oodaLoopLinks.findFirst({
    where: and(
      eq(oodaLoopLinks.oodaLoopId, input.loopId),
      eq(oodaLoopLinks.targetType, 'saga_run'),
      eq(oodaLoopLinks.targetId, input.runId),
      eq(oodaLoopLinks.relationRole, 'output'),
      sql`deleted_at IS NULL`,
    ),
  })
  if (existing) return existing

  const created = (await createOodaRow(
    input.c,
    input.bizId ?? null,
    'oodaLoopLinks',
    {
      oodaLoopId: input.loopId,
      targetType: 'saga_run',
      targetId: input.runId,
      relationRole: 'output',
      metadata: { source: 'ooda.loop.run' },
      createdBy: input.actorUserId,
      updatedBy: input.actorUserId,
    },
    {
      subjectType: 'ooda_loop_link',
      subjectId: input.runId,
      displayName: 'OODA Loop Output Link',
      metadata: { source: 'routes.ooda.ensureLoopRunOutputLink' },
    },
  )) as Record<string, unknown> | Response
  if (created instanceof Response) throw new Error('Failed to create OODA loop output link.')
  return created
}

/**
 * Repair legacy/broken loop records where run ids were stored only inside
 * payload JSON but not in canonical FK/link fields.
 *
 * ELI5:
 * This auto-heals old loop data so dashboards stop showing "stuck" state.
 */
async function reconcileLoopRunLinkage(input: {
  c: Parameters<typeof executeCrudRouteAction>[0]['c']
  bizId?: string | null
  loopId: string
  actorUserId: string
}) {
  const staleActions = await db
    .select()
    .from(oodaLoopActions)
    .where(
      and(
        eq(oodaLoopActions.oodaLoopId, input.loopId),
        sql`deleted_at IS NULL`,
        sql`${oodaLoopActions.linkedSagaRunId} IS NULL`,
      ),
    )
  for (const action of staleActions) {
    const runId = extractRunIdFromResultPayload(action.resultPayload)
    if (!runId) {
      const updated = await updateOodaRow(input.c, input.bizId ?? null, 'oodaLoopActions', action.id, {
        status: action.status === 'running' ? 'failed' : action.status,
        errorMessage:
          action.errorMessage ??
          'Action is missing run reference payload. Create a fresh run from this loop.',
        endedAt:
          action.status === 'running' && !action.endedAt ? new Date() : action.endedAt,
        updatedBy: input.actorUserId,
        updatedAt: new Date(),
      })
      if (updated instanceof Response) throw new Error('Failed to reconcile missing run id action.')
      continue
    }

    const run = await db.query.sagaRuns.findFirst({
      where: and(eq(sagaRuns.id, runId), sql`deleted_at IS NULL`),
    })
    if (!run) {
      const updated = await updateOodaRow(input.c, input.bizId ?? null, 'oodaLoopActions', action.id, {
        status: 'failed',
        errorMessage:
          'Linked saga run no longer exists (likely pruned during reset). Create a new run from this loop.',
        endedAt: action.endedAt ?? new Date(),
        updatedBy: input.actorUserId,
        updatedAt: new Date(),
        resultPayload: {
          ...(action.resultPayload as Record<string, unknown>),
          runId,
          staleRunReference: true,
        },
      })
      if (updated instanceof Response) throw new Error('Failed to mark stale run reference action.')
      continue
    }

    const updated = await updateOodaRow(input.c, input.bizId ?? null, 'oodaLoopActions', action.id, {
      linkedSagaRunId: runId,
      updatedBy: input.actorUserId,
      updatedAt: new Date(),
    })
    if (updated instanceof Response) throw new Error('Failed to update action linked saga run id.')

    await ensureLoopRunOutputLink({
      c: input.c,
      bizId: input.bizId,
      loopId: input.loopId,
      runId,
      actorUserId: input.actorUserId,
    })
  }

  const staleEntries = await db
    .select()
    .from(oodaLoopEntries)
    .where(
      and(
        eq(oodaLoopEntries.oodaLoopId, input.loopId),
        sql`deleted_at IS NULL`,
        eq(oodaLoopEntries.sourceType, 'saga_run'),
        sql`${oodaLoopEntries.linkedSagaRunId} IS NULL`,
      ),
    )
  for (const entry of staleEntries) {
    const runId = entry.sourceRefId
    if (!runId) continue
    const run = await db.query.sagaRuns.findFirst({
      where: and(eq(sagaRuns.id, runId), sql`deleted_at IS NULL`),
    })
    if (!run) continue

    const updated = await updateOodaRow(input.c, input.bizId ?? null, 'oodaLoopEntries', entry.id, {
      linkedSagaRunId: runId,
      updatedBy: input.actorUserId,
      updatedAt: new Date(),
    })
    if (updated instanceof Response) throw new Error('Failed to update entry linked saga run id.')

    await ensureLoopRunOutputLink({
      c: input.c,
      bizId: input.bizId,
      loopId: input.loopId,
      runId,
      actorUserId: input.actorUserId,
    })
  }
}

/**
 * OODA events piggyback on the existing saga websocket transport so dashboards
 * refresh in realtime without introducing a second socket protocol yet.
 */
function emitOodaRealtime(input: {
  loopId: string
  requestedByUserId: string
  eventType: 'run.created' | 'run.updated' | 'run.archived'
  payload?: Record<string, unknown>
}) {
  publishSagaRuntimeEvent({
    eventType: input.eventType,
    runId: `ooda:${input.loopId}`,
    requestedByUserId: input.requestedByUserId,
    status: 'ooda',
    payload: {
      domain: 'ooda',
      loopId: input.loopId,
      ...(input.payload ?? {}),
    },
  })
}

async function ensureLoopAccessible(loopId: string) {
  return db.query.oodaLoops.findFirst({
    where: and(eq(oodaLoops.id, loopId), sql`deleted_at IS NULL`),
  })
}

export const oodaRoutes = new Hono()

oodaRoutes.get('/ooda/asciip/files', requireAuth, async (c) => {
  const user = getCurrentUser(c)
  if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)

  const parsed = listAsciipFilesQuerySchema.safeParse(c.req.query())
  if (!parsed.success) {
    return fail(c, 'VALIDATION_ERROR', 'Invalid query parameters.', 400, parsed.error.flatten())
  }

  const limit = Math.min(parsePositiveInt(parsed.data.limit, 200), 2000)
  const normalizedDirectory = parsed.data.directory
    ? normalizeAsciipDirectory(parsed.data.directory)
    : ''
  if (normalizedDirectory === null) {
    return fail(c, 'VALIDATION_ERROR', 'Invalid directory path.', 400)
  }
  await ensureAsciipDocumentsTableReady()

  const filters = [sql`deleted_at IS NULL`, eq(oodaAsciipDocuments.status, 'active')]
  if (normalizedDirectory) {
    filters.push(ilike(oodaAsciipDocuments.documentPath, `${normalizedDirectory}/%`))
  }
  if (parsed.data.query?.trim()) {
    const pattern = `%${parsed.data.query.trim()}%`
    filters.push(
      or(
        ilike(oodaAsciipDocuments.documentPath, pattern),
        ilike(oodaAsciipDocuments.title, pattern),
      )!,
    )
  }

  const rows = await db
    .select()
    .from(oodaAsciipDocuments)
    .where(and(...filters))
    .orderBy(desc(oodaAsciipDocuments.updatedAt))
    .limit(limit)

  const files = rows.map((row) => toAsciipSummary(row))

  return ok(c, {
    rootPath: 'db://ooda_asciip_documents',
    files,
  })
})

oodaRoutes.get('/ooda/asciip/file', requireAuth, async (c) => {
  const user = getCurrentUser(c)
  if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)

  const parsed = asciipFilePathQuerySchema.safeParse(c.req.query())
  if (!parsed.success) {
    return fail(c, 'VALIDATION_ERROR', 'Invalid query parameters.', 400, parsed.error.flatten())
  }

  const relativePath = normalizeAsciipRelativePath(parsed.data.path)
  if (!relativePath) return fail(c, 'VALIDATION_ERROR', 'Invalid Canvascii file path.', 400)
  await ensureAsciipDocumentsTableReady()
  const row = await db.query.oodaAsciipDocuments.findFirst({
    where: and(
      eq(oodaAsciipDocuments.documentPath, relativePath),
      eq(oodaAsciipDocuments.status, 'active'),
      sql`deleted_at IS NULL`,
    ),
  })
  if (!row) return fail(c, 'NOT_FOUND', 'Canvascii file not found.', 404)
  const detail = toAsciipDetail(row)

  c.header('etag', detail.etag)
  return ok(c, detail)
})

oodaRoutes.post('/ooda/asciip/file', requireAuth, async (c) => {
  const user = getCurrentUser(c)
  if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)

  const body = await c.req.json().catch(() => null)
  const parsed = createAsciipFileBodySchema.safeParse(body)
  if (!parsed.success) {
    return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  }

  const relativePath = computeAsciipCreatePath(parsed.data)
  if (!relativePath) {
    return fail(c, 'VALIDATION_ERROR', 'Invalid file name/path. Use .canvascii or legacy .asciip files.', 400)
  }
  await ensureAsciipDocumentsTableReady()
  const existing = await db.query.oodaAsciipDocuments.findFirst({
    where: and(
      eq(oodaAsciipDocuments.documentPath, relativePath),
      eq(oodaAsciipDocuments.status, 'active'),
      sql`deleted_at IS NULL`,
    ),
  })

  if (existing && !parsed.data.overwrite) {
    return fail(c, 'CONFLICT', 'Canvascii file already exists. Use overwrite=true to replace it.', 409)
  }

  const editorState = parsed.data.editorState ?? {}
  let row: typeof oodaAsciipDocuments.$inferSelect | undefined
  if (existing) {
    const updatedRows = await db
      .update(oodaAsciipDocuments)
      .set({
        title: parsed.data.title?.trim() || existing.title,
        editorState,
        revision: (existing.revision ?? 1) + 1,
        updatedAt: new Date(),
        updatedBy: user.id,
      })
      .where(eq(oodaAsciipDocuments.id, existing.id))
      .returning()
    row = updatedRows[0]
  } else {
    const title =
      parsed.data.title?.trim() ||
      (parsed.data.name?.trim() || relativePath).replace(/\.(canvascii|asciip)$/i, '')
    const createdRows = await db
      .insert(oodaAsciipDocuments)
      .values({
        bizId: null,
        documentPath: relativePath,
        title,
        editorState,
        revision: 1,
        status: 'active',
        createdBy: user.id,
        updatedBy: user.id,
      })
      .returning()
    row = createdRows[0]
  }
  if (!row) return fail(c, 'INTERNAL_ERROR', 'Failed to persist Canvascii document.', 500)
  const detail = toAsciipDetail(row)

  c.header('etag', detail.etag)
  return ok(c, detail, existing ? 200 : 201)
})

oodaRoutes.put('/ooda/asciip/file', requireAuth, async (c) => {
  const user = getCurrentUser(c)
  if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)

  const body = await c.req.json().catch(() => null)
  const parsed = updateAsciipFileBodySchema.safeParse(body)
  if (!parsed.success) {
    return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  }

  const relativePath = normalizeAsciipRelativePath(parsed.data.path)
  if (!relativePath) return fail(c, 'VALIDATION_ERROR', 'Invalid Canvascii file path.', 400)
  await ensureAsciipDocumentsTableReady()
  const current = await db.query.oodaAsciipDocuments.findFirst({
    where: and(
      eq(oodaAsciipDocuments.documentPath, relativePath),
      eq(oodaAsciipDocuments.status, 'active'),
      sql`deleted_at IS NULL`,
    ),
  })
  if (!current) return fail(c, 'NOT_FOUND', 'Canvascii file not found.', 404)

  const currentState =
    current.editorState && typeof current.editorState === 'object' && !Array.isArray(current.editorState)
      ? (current.editorState as Record<string, unknown>)
      : {}
  const currentRevision = Number(current.revision ?? 1)
  const currentEtag = buildStrongAsciipEtag({ revision: currentRevision, state: currentState })
  if (parsed.data.ifMatchEtag && parsed.data.ifMatchEtag !== currentEtag) {
    return fail(c, 'CONFLICT', 'Canvascii file changed since last load. Reload before saving.', 409, {
      currentEtag,
    })
  }

  const updatedRows = await db
    .update(oodaAsciipDocuments)
    .set({
      editorState: parsed.data.editorState,
      revision: parsed.data.changeType === 'autosave' ? currentRevision : currentRevision + 1,
      updatedAt: new Date(),
      updatedBy: user.id,
    })
    .where(eq(oodaAsciipDocuments.id, current.id))
    .returning()
  const updated = updatedRows[0]
  if (!updated) return fail(c, 'INTERNAL_ERROR', 'Failed to update Canvascii document.', 500)
  const detail = toAsciipDetail(updated)

  c.header('etag', detail.etag)
  return ok(c, detail)
})

oodaRoutes.patch('/ooda/asciip/file', requireAuth, async (c) => {
  const user = getCurrentUser(c)
  if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)

  const body = await c.req.json().catch(() => null)
  const parsed = renameAsciipFileBodySchema.safeParse(body)
  if (!parsed.success) {
    return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  }

  const currentPath = normalizeAsciipRelativePath(parsed.data.path)
  if (!currentPath) return fail(c, 'VALIDATION_ERROR', 'Invalid Canvascii file path.', 400)

  const targetPath = parsed.data.newPath ? normalizeAsciipRelativePath(parsed.data.newPath) : currentPath
  if (!targetPath) {
    return fail(c, 'VALIDATION_ERROR', 'Invalid target path. Use .canvascii or legacy .asciip files.', 400)
  }

  const nextTitle = parsed.data.title?.trim()
  if (parsed.data.title !== undefined && !nextTitle) {
    return fail(c, 'VALIDATION_ERROR', 'Title cannot be empty.', 400)
  }

  await ensureAsciipDocumentsTableReady()

  const current = await db.query.oodaAsciipDocuments.findFirst({
    where: and(
      eq(oodaAsciipDocuments.documentPath, currentPath),
      eq(oodaAsciipDocuments.status, 'active'),
      sql`deleted_at IS NULL`,
    ),
  })
  if (!current) return fail(c, 'NOT_FOUND', 'Canvascii file not found.', 404)

  const currentState =
    current.editorState && typeof current.editorState === 'object' && !Array.isArray(current.editorState)
      ? (current.editorState as Record<string, unknown>)
      : {}
  const currentRevision = Number(current.revision ?? 1)
  const currentEtag = buildStrongAsciipEtag({ revision: currentRevision, state: currentState })
  if (parsed.data.ifMatchEtag && parsed.data.ifMatchEtag !== currentEtag) {
    return fail(c, 'CONFLICT', 'Canvascii file changed since last load. Reload before renaming.', 409, {
      currentEtag,
    })
  }

  if (targetPath !== currentPath) {
    const collision = await db.query.oodaAsciipDocuments.findFirst({
      where: and(
        eq(oodaAsciipDocuments.documentPath, targetPath),
        eq(oodaAsciipDocuments.status, 'active'),
        sql`deleted_at IS NULL`,
      ),
    })
    if (collision) {
      return fail(c, 'CONFLICT', 'Target Canvascii file path already exists.', 409)
    }
  }

  const updatedRows = await db
    .update(oodaAsciipDocuments)
    .set({
      documentPath: targetPath,
      title: nextTitle || current.title,
      revision: currentRevision + 1,
      updatedAt: new Date(),
      updatedBy: user.id,
    })
    .where(eq(oodaAsciipDocuments.id, current.id))
    .returning()
  const updated = updatedRows[0]
  if (!updated) return fail(c, 'INTERNAL_ERROR', 'Failed to rename Canvascii document.', 500)
  const detail = toAsciipDetail(updated)

  c.header('etag', detail.etag)
  return ok(c, detail)
})

oodaRoutes.delete('/ooda/asciip/file', requireAuth, async (c) => {
  const user = getCurrentUser(c)
  if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)

  const parsed = asciipFilePathQuerySchema.safeParse(c.req.query())
  if (!parsed.success) {
    return fail(c, 'VALIDATION_ERROR', 'Invalid query parameters.', 400, parsed.error.flatten())
  }

  const relativePath = normalizeAsciipRelativePath(parsed.data.path)
  if (!relativePath) return fail(c, 'VALIDATION_ERROR', 'Invalid Canvascii file path.', 400)
  await ensureAsciipDocumentsTableReady()
  const target = await db.query.oodaAsciipDocuments.findFirst({
    where: and(
      eq(oodaAsciipDocuments.documentPath, relativePath),
      eq(oodaAsciipDocuments.status, 'active'),
      sql`deleted_at IS NULL`,
    ),
  })
  if (!target) return fail(c, 'NOT_FOUND', 'Canvascii file not found.', 404)

  await db
    .update(oodaAsciipDocuments)
    .set({
      status: 'archived',
      deletedAt: new Date(),
      deletedBy: user.id,
      updatedAt: new Date(),
      updatedBy: user.id,
    })
    .where(eq(oodaAsciipDocuments.id, target.id))

  return ok(c, { deleted: true, path: relativePath })
})

/**
 * OODA dashboard overview.
 *
 * ELI5:
 * Returns one compact payload that the dashboard can render immediately:
 * health, attention queue, and the latest active loops.
 */
oodaRoutes.get('/ooda/overview', requireAuth, async (c) => {
  const user = getCurrentUser(c)
  if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)

  const [loopCounts, sagaCounts, latestRuns, latestLoops, openEntryCounts, attention] = await Promise.all([
    db
      .select({
        status: oodaLoops.status,
        count: count(),
      })
      .from(oodaLoops)
      .where(sql`deleted_at IS NULL`)
      .groupBy(oodaLoops.status),
    Promise.all([
      db.select({ count: count() }).from(sagaUseCases).where(sql`deleted_at IS NULL`),
      db.select({ count: count() }).from(sagaPersonas).where(sql`deleted_at IS NULL`),
      db.select({ count: count() }).from(sagaDefinitions).where(sql`deleted_at IS NULL`),
      db.select({ count: count() }).from(sagaRuns).where(sql`deleted_at IS NULL`),
    ]),
    db
      .select()
      .from(sagaRuns)
      .where(sql`deleted_at IS NULL`)
      .orderBy(
        desc(sql`COALESCE(${sagaRuns.lastHeartbeatAt}, ${sagaRuns.endedAt}, ${sagaRuns.startedAt})`),
        desc(sagaRuns.startedAt),
      )
      .limit(20),
    db
      .select()
      .from(oodaLoops)
      .where(sql`deleted_at IS NULL`)
      .orderBy(desc(oodaLoops.priority), desc(oodaLoops.updatedAt))
      .limit(20),
    db
      .select({ loopId: oodaLoopEntries.oodaLoopId, openCount: count() })
      .from(oodaLoopEntries)
      .where(
        and(
          sql`deleted_at IS NULL`,
          inArray(oodaLoopEntries.status, ['open', 'blocked']),
        ),
      )
      .groupBy(oodaLoopEntries.oodaLoopId),
    fetchGlobalBlockers(10),
  ])

  const byStatus = Object.fromEntries(loopCounts.map((row) => [row.status, row.count])) as Record<
    string,
    number
  >
  const openByLoop = new Map(openEntryCounts.map((row) => [row.loopId, row.openCount]))
  const totalLoops = loopCounts.reduce((sum, row) => sum + row.count, 0)
  const activeLoops = (byStatus.active ?? 0) + (byStatus.draft ?? 0) + (byStatus.paused ?? 0)
  const healthyRunCount = latestRuns.filter((run) => run.status === 'passed').length
  const coveragePct = latestRuns.length > 0 ? Math.round((healthyRunCount / latestRuns.length) * 100) : 0

  return ok(c, {
    health: {
      totalLoops,
      activeLoops,
      completedLoops: byStatus.completed ?? 0,
      archivedLoops: byStatus.archived ?? 0,
      sagaCoveragePct: coveragePct,
    },
    library: {
      useCases: sagaCounts[0][0]?.count ?? 0,
      personas: sagaCounts[1][0]?.count ?? 0,
      definitions: sagaCounts[2][0]?.count ?? 0,
      runs: sagaCounts[3][0]?.count ?? 0,
    },
    recentRuns: latestRuns,
    activeLoops: latestLoops.map((loop) => ({
      ...loop,
      openItems: openByLoop.get(loop.id) ?? 0,
    })),
    attention: {
      blockers: attention,
      reorient: buildReorient(attention),
    },
  })
})

oodaRoutes.get('/ooda/loops', requireAuth, async (c) => {
  const user = getCurrentUser(c)
  if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)
  const parsed = listLoopsQuerySchema.safeParse(c.req.query())
  if (!parsed.success) {
    return fail(c, 'VALIDATION_ERROR', 'Invalid query parameters.', 400, parsed.error.flatten())
  }
  const limit = Math.min(parsePositiveInt(parsed.data.limit, 200), 2000)
  const rows = await db
    .select()
    .from(oodaLoops)
    .where(
      and(
        sql`deleted_at IS NULL`,
        parsed.data.status ? eq(oodaLoops.status, parsed.data.status) : undefined,
        parsed.data.query
          ? sql`${oodaLoops.title} ILIKE ${`%${parsed.data.query}%`} OR ${oodaLoops.loopKey} ILIKE ${`%${parsed.data.query}%`}`
          : undefined,
      ),
    )
    .orderBy(desc(oodaLoops.priority), desc(oodaLoops.updatedAt), asc(oodaLoops.title))
    .limit(limit)
  return ok(c, rows)
})

oodaRoutes.post('/ooda/loops', requireAuth, async (c) => {
  const user = getCurrentUser(c)
  if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)
  const body = await c.req.json().catch(() => null)
  const parsed = createLoopBodySchema.safeParse(body)
  if (!parsed.success) {
    return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  }

  const created = (await createOodaRow(
    c,
    parsed.data.bizId ?? null,
    'oodaLoops',
    {
      loopKey: parsed.data.loopKey ?? toLoopKey(parsed.data.title),
      title: parsed.data.title,
      objective: parsed.data.objective ?? null,
      status: parsed.data.status ?? 'active',
      currentPhase: parsed.data.currentPhase ?? 'observe',
      priority: parsed.data.priority ?? 50,
      bizId: parsed.data.bizId ?? null,
      ownerUserId: parsed.data.ownerUserId ?? user.id,
      healthScore: parsed.data.healthScore ?? 0,
      nextReviewAt: parsed.data.nextReviewAt ? new Date(parsed.data.nextReviewAt) : null,
      metadata: normalizeLoopWorkflowMetadata({
        existing: parsed.data.metadata ?? {},
        designGateStatus: parsed.data.designGateStatus,
        behaviorGateStatus: parsed.data.behaviorGateStatus,
      }),
      createdBy: user.id,
      updatedBy: user.id,
    },
    {
      subjectType: 'ooda_loop',
      displayName: parsed.data.title,
      metadata: { source: 'routes.ooda.createLoop' },
    },
  )) as Record<string, unknown> | Response
  if (created instanceof Response) return created
  emitOodaRealtime({
    loopId: String(created.id),
    requestedByUserId: user.id,
    eventType: 'run.created',
    payload: { entity: 'loop' },
  })

  return ok(c, created, 201)
})

oodaRoutes.get('/ooda/loops/:loopId', requireAuth, async (c) => {
  const user = getCurrentUser(c)
  if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)
  const loopId = c.req.param('loopId')
  const loop = await ensureLoopAccessible(loopId)
  if (!loop) return fail(c, 'NOT_FOUND', 'OODA loop not found.', 404)

  await reconcileLoopRunLinkage({
    c,
    bizId: loop.bizId ?? null,
    loopId,
    actorUserId: user.id,
  })

  const [links, entries, actions] = await Promise.all([
    db.select().from(oodaLoopLinks).where(and(eq(oodaLoopLinks.oodaLoopId, loopId), sql`deleted_at IS NULL`)),
    db
      .select()
      .from(oodaLoopEntries)
      .where(and(eq(oodaLoopEntries.oodaLoopId, loopId), sql`deleted_at IS NULL`))
      .orderBy(asc(oodaLoopEntries.sortOrder), asc(oodaLoopEntries.createdAt)),
    db
      .select()
      .from(oodaLoopActions)
      .where(and(eq(oodaLoopActions.oodaLoopId, loopId), sql`deleted_at IS NULL`))
      .orderBy(desc(oodaLoopActions.createdAt)),
  ])

  return ok(c, { loop, links, entries, actions })
})

/**
 * Loop blockers view.
 *
 * ELI5:
 * Gives a failure-first list for one loop so humans/agents can immediately see
 * what broke, why it broke, and what can be replayed right now.
 */
oodaRoutes.get('/ooda/loops/:loopId/blockers', requireAuth, async (c) => {
  const user = getCurrentUser(c)
  if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)
  const loopId = c.req.param('loopId')
  const loop = await ensureLoopAccessible(loopId)
  if (!loop) return fail(c, 'NOT_FOUND', 'OODA loop not found.', 404)

  const parsed = listBlockersQuerySchema.safeParse(c.req.query())
  if (!parsed.success) {
    return fail(c, 'VALIDATION_ERROR', 'Invalid query parameters.', 400, parsed.error.flatten())
  }
  const limit = Math.min(parsePositiveInt(parsed.data.limit, 30), 100)

  const blockers = await fetchLoopBlockers(loopId, limit)
  const reorient = buildReorient(blockers)

  return ok(c, {
    loopId,
    summary: {
      total: blockers.length,
      strongEvidence: blockers.filter((item) => item.evidenceQuality === 'strong').length,
      weakEvidence: blockers.filter((item) => item.evidenceQuality === 'weak').length,
      replayable: blockers.filter((item) => Boolean(item.repro)).length,
    },
    blockers,
    reorient,
  })
})

oodaRoutes.patch('/ooda/loops/:loopId', requireAuth, async (c) => {
  const user = getCurrentUser(c)
  if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)
  const body = await c.req.json().catch(() => null)
  const parsed = updateLoopBodySchema.safeParse(body)
  if (!parsed.success) {
    return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  }
  const loopId = c.req.param('loopId')
  const existing = await ensureLoopAccessible(loopId)
  if (!existing) return fail(c, 'NOT_FOUND', 'OODA loop not found.', 404)

  const updated = (await updateOodaRow(
    c,
    existing.bizId ?? null,
    'oodaLoops',
    loopId,
    {
      loopKey: parsed.data.loopKey ?? undefined,
      title: parsed.data.title ?? undefined,
      objective: parsed.data.objective ?? undefined,
      status: parsed.data.status ?? undefined,
      currentPhase: parsed.data.currentPhase ?? undefined,
      priority: parsed.data.priority ?? undefined,
      bizId: parsed.data.bizId ?? undefined,
      ownerUserId: parsed.data.ownerUserId ?? undefined,
      healthScore: parsed.data.healthScore ?? undefined,
      nextReviewAt:
        parsed.data.nextReviewAt === undefined
          ? undefined
          : parsed.data.nextReviewAt
            ? new Date(parsed.data.nextReviewAt)
            : null,
      metadata:
        parsed.data.metadata !== undefined ||
        parsed.data.designGateStatus !== undefined ||
        parsed.data.behaviorGateStatus !== undefined
          ? normalizeLoopWorkflowMetadata({
              existing:
                (parsed.data.metadata as Record<string, unknown> | undefined) ??
                ((existing.metadata as Record<string, unknown> | undefined) ?? {}),
              designGateStatus: parsed.data.designGateStatus,
              behaviorGateStatus: parsed.data.behaviorGateStatus,
            })
          : undefined,
      updatedBy: user.id,
      updatedAt: new Date(),
    },
    {
      subjectType: 'ooda_loop',
      subjectId: loopId,
      displayName: parsed.data.title ?? existing.title,
      metadata: { source: 'routes.ooda.updateLoop' },
    },
  )) as Record<string, unknown> | Response
  if (updated instanceof Response) return updated
  emitOodaRealtime({
    loopId,
    requestedByUserId: user.id,
    eventType: 'run.updated',
    payload: { entity: 'loop' },
  })

  return ok(c, updated)
})

oodaRoutes.delete('/ooda/loops/:loopId', requireAuth, async (c) => {
  const user = getCurrentUser(c)
  if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)
  const loopId = c.req.param('loopId')
  const loop = await ensureLoopAccessible(loopId)
  if (!loop) return fail(c, 'NOT_FOUND', 'OODA loop not found.', 404)

  const archived = await updateOodaRow(c, loop.bizId ?? null, 'oodaLoops', loopId, {
    status: 'archived',
    deletedAt: new Date(),
    deletedBy: user.id,
    updatedBy: user.id,
    updatedAt: new Date(),
  }, {
    subjectType: 'ooda_loop',
    subjectId: loopId,
    displayName: loop.title,
    metadata: { source: 'routes.ooda.archiveLoop' },
  })
  if (archived instanceof Response) return archived
  emitOodaRealtime({
    loopId,
    requestedByUserId: user.id,
    eventType: 'run.archived',
    payload: { entity: 'loop' },
  })

  return ok(c, { archived: true })
})

oodaRoutes.get('/ooda/loops/:loopId/links', requireAuth, async (c) => {
  const user = getCurrentUser(c)
  if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)
  const loopId = c.req.param('loopId')
  const loop = await ensureLoopAccessible(loopId)
  if (!loop) return fail(c, 'NOT_FOUND', 'OODA loop not found.', 404)

  const rows = await db
    .select()
    .from(oodaLoopLinks)
    .where(and(eq(oodaLoopLinks.oodaLoopId, loopId), sql`deleted_at IS NULL`))
    .orderBy(asc(oodaLoopLinks.relationRole), asc(oodaLoopLinks.createdAt))

  return ok(c, rows)
})

oodaRoutes.post('/ooda/loops/:loopId/links', requireAuth, async (c) => {
  const user = getCurrentUser(c)
  if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)
  const loopId = c.req.param('loopId')
  const loop = await ensureLoopAccessible(loopId)
  if (!loop) return fail(c, 'NOT_FOUND', 'OODA loop not found.', 404)

  const body = await c.req.json().catch(() => null)
  const parsed = createLoopLinkBodySchema.safeParse(body)
  if (!parsed.success) {
    return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  }

  // Idempotent behavior: if the same logical link already exists, return it.
  // This keeps repeated caller retries (human clicks, agent retries, saga replay)
  // deterministic and prevents duplicate-key failures from surfacing as hard errors.
  const existing = await db.query.oodaLoopLinks.findFirst({
    where: and(
      eq(oodaLoopLinks.oodaLoopId, loopId),
      eq(oodaLoopLinks.targetType, parsed.data.targetType),
      eq(oodaLoopLinks.targetId, parsed.data.targetId),
      eq(oodaLoopLinks.relationRole, parsed.data.relationRole),
      sql`deleted_at IS NULL`,
    ),
  })
  if (existing) {
    return ok(c, existing, 200)
  }

  const created = (await createOodaRow(
    c,
    loop.bizId ?? null,
    'oodaLoopLinks',
    {
      oodaLoopId: loopId,
      targetType: parsed.data.targetType,
      targetId: parsed.data.targetId,
      relationRole: parsed.data.relationRole,
      metadata: parsed.data.metadata ?? {},
      createdBy: user.id,
      updatedBy: user.id,
    },
    {
      subjectType: 'ooda_loop_link',
      subjectId: parsed.data.targetId,
      displayName: 'OODA Loop Link',
      metadata: { source: 'routes.ooda.createLink' },
    },
  )) as Record<string, unknown> | Response
  if (created instanceof Response) {
    // Generic CUD can still race into a duplicate key under concurrent retries.
    // If that happened, re-read and return the canonical existing row.
    const raced = await db.query.oodaLoopLinks.findFirst({
      where: and(
        eq(oodaLoopLinks.oodaLoopId, loopId),
        eq(oodaLoopLinks.targetType, parsed.data.targetType),
        eq(oodaLoopLinks.targetId, parsed.data.targetId),
        eq(oodaLoopLinks.relationRole, parsed.data.relationRole),
        sql`deleted_at IS NULL`,
      ),
    })
    if (raced) return ok(c, raced, 200)
    return created
  }
  emitOodaRealtime({
    loopId,
    requestedByUserId: user.id,
    eventType: 'run.updated',
    payload: { entity: 'link' },
  })

  return ok(c, created, 201)
})

oodaRoutes.delete('/ooda/loops/:loopId/links/:linkId', requireAuth, async (c) => {
  const user = getCurrentUser(c)
  if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)
  const loopId = c.req.param('loopId')
  const linkId = c.req.param('linkId')
  const loop = await ensureLoopAccessible(loopId)
  if (!loop) return fail(c, 'NOT_FOUND', 'OODA loop not found.', 404)

  const target = await db.query.oodaLoopLinks.findFirst({
    where: and(eq(oodaLoopLinks.id, linkId), eq(oodaLoopLinks.oodaLoopId, loopId), sql`deleted_at IS NULL`),
  })
  if (!target) return fail(c, 'NOT_FOUND', 'OODA link not found.', 404)
  const updated = await updateOodaRow(
    c,
    loop.bizId ?? null,
    'oodaLoopLinks',
    linkId,
    {
      deletedAt: new Date(),
      deletedBy: user.id,
      updatedBy: user.id,
      updatedAt: new Date(),
    },
    {
      subjectType: 'ooda_loop_link',
      subjectId: String(target.targetId),
      displayName: 'OODA Loop Link',
      metadata: { source: 'routes.ooda.deleteLink' },
    },
  )

  if (updated instanceof Response) return updated
  emitOodaRealtime({
    loopId,
    requestedByUserId: user.id,
    eventType: 'run.updated',
    payload: { entity: 'link', deleted: true },
  })
  return ok(c, { deleted: true })
})

oodaRoutes.get('/ooda/loops/:loopId/entries', requireAuth, async (c) => {
  const user = getCurrentUser(c)
  if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)
  const loopId = c.req.param('loopId')
  const loop = await ensureLoopAccessible(loopId)
  if (!loop) return fail(c, 'NOT_FOUND', 'OODA loop not found.', 404)
  const parsed = listEntriesQuerySchema.safeParse(c.req.query())
  if (!parsed.success) {
    return fail(c, 'VALIDATION_ERROR', 'Invalid query parameters.', 400, parsed.error.flatten())
  }
  const limit = Math.min(parsePositiveInt(parsed.data.limit, 400), 2000)
  const rows = await db
    .select()
    .from(oodaLoopEntries)
    .where(
      and(
        eq(oodaLoopEntries.oodaLoopId, loopId),
        sql`deleted_at IS NULL`,
        parsed.data.phase ? eq(oodaLoopEntries.phase, parsed.data.phase) : undefined,
      ),
    )
    .orderBy(asc(oodaLoopEntries.sortOrder), asc(oodaLoopEntries.createdAt))
    .limit(limit)
  return ok(c, rows)
})

oodaRoutes.post('/ooda/loops/:loopId/entries', requireAuth, async (c) => {
  const user = getCurrentUser(c)
  if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)
  const loopId = c.req.param('loopId')
  const loop = await ensureLoopAccessible(loopId)
  if (!loop) return fail(c, 'NOT_FOUND', 'OODA loop not found.', 404)
  const body = await c.req.json().catch(() => null)
  const parsed = createEntryBodySchema.safeParse(body)
  if (!parsed.success) {
    return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  }

  {
    const contract = validateLoopEntryContract({
      gapType: parsed.data.gapType ?? null,
      owningLayer: parsed.data.owningLayer ?? null,
      entryType: parsed.data.entryType,
      status: parsed.data.status ?? 'open',
      evidence: parsed.data.evidence ?? {},
    })
    if (!contract.ok) {
      return fail(c, 'VALIDATION_ERROR', contract.reason, 400, { code: contract.code })
    }
  }

  const created = (await createOodaRow(
    c,
    loop.bizId ?? null,
    'oodaLoopEntries',
    {
      oodaLoopId: loopId,
      phase: parsed.data.phase,
      entryType: parsed.data.entryType,
      title: parsed.data.title,
      bodyMarkdown: parsed.data.bodyMarkdown ?? null,
      severity: parsed.data.severity ?? 'medium',
      status: parsed.data.status ?? 'open',
      gapType: parsed.data.gapType ?? null,
      sourceType: parsed.data.sourceType ?? 'manual',
      sourceRefId: parsed.data.sourceRefId ?? null,
      linkedUseCaseId: parsed.data.linkedUseCaseId ?? null,
      linkedSagaDefinitionId: parsed.data.linkedSagaDefinitionId ?? null,
      linkedSagaRunId: parsed.data.linkedSagaRunId ?? null,
      linkedSagaRunStepId: parsed.data.linkedSagaRunStepId ?? null,
      linkedCoverageItemId: parsed.data.linkedCoverageItemId ?? null,
      evidence: {
        ...(parsed.data.evidence ?? {}),
        owningLayer: parsed.data.owningLayer ?? null,
      },
      sortOrder: parsed.data.sortOrder ?? 0,
      createdBy: user.id,
      updatedBy: user.id,
    },
    {
      subjectType: 'ooda_loop_entry',
      displayName: parsed.data.title,
      metadata: { source: 'routes.ooda.createEntry' },
    },
  )) as Record<string, unknown> | Response
  if (created instanceof Response) return created

  const loopTouched = await updateOodaRow(c, loop.bizId ?? null, 'oodaLoops', loopId, {
    lastSignalAt: new Date(),
    updatedAt: new Date(),
    updatedBy: user.id,
  }, {
    subjectType: 'ooda_loop',
    subjectId: loopId,
    displayName: loop.title,
    metadata: { source: 'routes.ooda.touchLoopAfterEntry' },
  })
  if (loopTouched instanceof Response) return loopTouched
  emitOodaRealtime({
    loopId,
    requestedByUserId: user.id,
    eventType: 'run.updated',
    payload: { entity: 'entry' },
  })

  return ok(c, created, 201)
})

oodaRoutes.patch('/ooda/loops/:loopId/entries/:entryId', requireAuth, async (c) => {
  const user = getCurrentUser(c)
  if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)
  const loopId = c.req.param('loopId')
  const entryId = c.req.param('entryId')
  const loop = await ensureLoopAccessible(loopId)
  if (!loop) return fail(c, 'NOT_FOUND', 'OODA loop not found.', 404)
  const body = await c.req.json().catch(() => null)
  const parsed = updateEntryBodySchema.safeParse(body)
  if (!parsed.success) {
    return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  }
  const current = await db.query.oodaLoopEntries.findFirst({
    where: and(
      eq(oodaLoopEntries.id, entryId),
      eq(oodaLoopEntries.oodaLoopId, loopId),
      sql`deleted_at IS NULL`,
    ),
  })
  if (!current) return fail(c, 'NOT_FOUND', 'OODA entry not found.', 404)

  const nextGapType = parsed.data.gapType === undefined ? current.gapType : parsed.data.gapType
  const nextOwningLayer =
    parsed.data.owningLayer === undefined
      ? ((current.evidence as Record<string, unknown> | null)?.owningLayer as string | null) ?? null
      : parsed.data.owningLayer
  const nextEntryType = (parsed.data.entryType ?? current.entryType) as OodaEntryType
  const nextStatus = (parsed.data.status ?? current.status) as OodaEntryStatus
  const nextEvidence = (parsed.data.evidence ?? current.evidence ?? {}) as Record<string, unknown>

  {
    const contract = validateLoopEntryContract({
      gapType: nextGapType ?? null,
      owningLayer: nextOwningLayer ?? null,
      entryType: nextEntryType,
      status: nextStatus,
      evidence: nextEvidence,
    })
    if (!contract.ok) {
      return fail(c, 'VALIDATION_ERROR', contract.reason, 400, { code: contract.code })
    }
  }

  const updated = (await updateOodaRow(
    c,
    loop.bizId ?? null,
    'oodaLoopEntries',
    entryId,
    {
      phase: parsed.data.phase ?? undefined,
      entryType: parsed.data.entryType ?? undefined,
      title: parsed.data.title ?? undefined,
      bodyMarkdown: parsed.data.bodyMarkdown ?? undefined,
      severity: parsed.data.severity ?? undefined,
      status: parsed.data.status ?? undefined,
      gapType: parsed.data.gapType ?? undefined,
      sourceType: parsed.data.sourceType ?? undefined,
      sourceRefId: parsed.data.sourceRefId ?? undefined,
      linkedUseCaseId: parsed.data.linkedUseCaseId ?? undefined,
      linkedSagaDefinitionId: parsed.data.linkedSagaDefinitionId ?? undefined,
      linkedSagaRunId: parsed.data.linkedSagaRunId ?? undefined,
      linkedSagaRunStepId: parsed.data.linkedSagaRunStepId ?? undefined,
      linkedCoverageItemId: parsed.data.linkedCoverageItemId ?? undefined,
      evidence:
        parsed.data.evidence !== undefined || parsed.data.owningLayer !== undefined
          ? {
              ...((parsed.data.evidence ?? current.evidence ?? {}) as Record<string, unknown>),
              owningLayer: parsed.data.owningLayer ?? nextOwningLayer ?? null,
            }
          : undefined,
      sortOrder: parsed.data.sortOrder ?? undefined,
      updatedBy: user.id,
      updatedAt: new Date(),
    },
    {
      subjectType: 'ooda_loop_entry',
      subjectId: entryId,
      displayName: parsed.data.title ?? current.title,
      metadata: { source: 'routes.ooda.updateEntry' },
    },
  )) as Record<string, unknown> | Response
  if (updated instanceof Response) return updated
  emitOodaRealtime({
    loopId,
    requestedByUserId: user.id,
    eventType: 'run.updated',
    payload: { entity: 'entry' },
  })
  return ok(c, updated)
})

oodaRoutes.get('/ooda/loops/:loopId/actions', requireAuth, async (c) => {
  const user = getCurrentUser(c)
  if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)
  const loopId = c.req.param('loopId')
  const loop = await ensureLoopAccessible(loopId)
  if (!loop) return fail(c, 'NOT_FOUND', 'OODA loop not found.', 404)
  const rows = await db
    .select()
    .from(oodaLoopActions)
    .where(and(eq(oodaLoopActions.oodaLoopId, loopId), sql`deleted_at IS NULL`))
    .orderBy(desc(oodaLoopActions.createdAt))
  return ok(c, rows)
})

oodaRoutes.post('/ooda/loops/:loopId/actions', requireAuth, async (c) => {
  const user = getCurrentUser(c)
  if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)
  const loopId = c.req.param('loopId')
  const loop = await ensureLoopAccessible(loopId)
  if (!loop) return fail(c, 'NOT_FOUND', 'OODA loop not found.', 404)
  const body = await c.req.json().catch(() => null)
  const parsed = createActionBodySchema.safeParse(body)
  if (!parsed.success) {
    return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  }
  const created = (await createOodaRow(
    c,
    loop.bizId ?? null,
    'oodaLoopActions',
    {
      oodaLoopId: loopId,
      oodaLoopEntryId: parsed.data.oodaLoopEntryId ?? null,
      actionKey: parsed.data.actionKey,
      actionTitle: parsed.data.actionTitle,
      status: parsed.data.status ?? 'queued',
      dryRun: parsed.data.dryRun ?? true,
      requestedByUserId: user.id,
      assignedToUserId: parsed.data.assignedToUserId ?? null,
      linkedSagaRunId: parsed.data.linkedSagaRunId ?? null,
      requestPayload: parsed.data.requestPayload ?? {},
      resultPayload: parsed.data.resultPayload ?? {},
      errorMessage: parsed.data.errorMessage ?? null,
      createdBy: user.id,
      updatedBy: user.id,
    },
    {
      subjectType: 'ooda_loop_action',
      displayName: parsed.data.actionTitle,
      metadata: { source: 'routes.ooda.createAction' },
    },
  )) as Record<string, unknown> | Response
  if (created instanceof Response) return created
  emitOodaRealtime({
    loopId,
    requestedByUserId: user.id,
    eventType: 'run.updated',
    payload: { entity: 'action' },
  })
  return ok(c, created, 201)
})

oodaRoutes.patch('/ooda/loops/:loopId/actions/:actionId', requireAuth, async (c) => {
  const user = getCurrentUser(c)
  if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)
  const loopId = c.req.param('loopId')
  const actionId = c.req.param('actionId')
  const loop = await ensureLoopAccessible(loopId)
  if (!loop) return fail(c, 'NOT_FOUND', 'OODA loop not found.', 404)
  const body = await c.req.json().catch(() => null)
  const parsed = updateActionBodySchema.safeParse(body)
  if (!parsed.success) {
    return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  }
  const currentAction = await db.query.oodaLoopActions.findFirst({
    where: and(eq(oodaLoopActions.id, actionId), eq(oodaLoopActions.oodaLoopId, loopId), sql`deleted_at IS NULL`),
  })
  if (!currentAction) return fail(c, 'NOT_FOUND', 'OODA action not found.', 404)
  const updated = (await updateOodaRow(
    c,
    loop.bizId ?? null,
    'oodaLoopActions',
    actionId,
    {
      oodaLoopEntryId: parsed.data.oodaLoopEntryId ?? undefined,
      actionKey: parsed.data.actionKey ?? undefined,
      actionTitle: parsed.data.actionTitle ?? undefined,
      status: parsed.data.status ?? undefined,
      dryRun: parsed.data.dryRun ?? undefined,
      assignedToUserId: parsed.data.assignedToUserId ?? undefined,
      linkedSagaRunId: parsed.data.linkedSagaRunId ?? undefined,
      requestPayload: parsed.data.requestPayload ?? undefined,
      resultPayload: parsed.data.resultPayload ?? undefined,
      errorMessage: parsed.data.errorMessage ?? undefined,
      startedAt:
        parsed.data.status && parsed.data.status === 'running'
          ? new Date()
          : undefined,
      endedAt:
        parsed.data.status &&
        ['succeeded', 'failed', 'cancelled'].includes(parsed.data.status)
          ? new Date()
          : undefined,
      updatedBy: user.id,
      updatedAt: new Date(),
    },
    {
      subjectType: 'ooda_loop_action',
      subjectId: actionId,
      displayName: parsed.data.actionTitle ?? currentAction.actionTitle,
      metadata: { source: 'routes.ooda.updateAction' },
    },
  )) as Record<string, unknown> | Response
  if (updated instanceof Response) return updated
  emitOodaRealtime({
    loopId,
    requestedByUserId: user.id,
    eventType: 'run.updated',
    payload: { entity: 'action' },
  })
  return ok(c, updated)
})

/**
 * Create one saga run directly from OODA dashboard and attach it to loop action trail.
 */
oodaRoutes.post('/ooda/loops/:loopId/saga-runs', requireAuth, async (c) => {
  const user = getCurrentUser(c)
  if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)
  const loopId = c.req.param('loopId')
  const loop = await ensureLoopAccessible(loopId)
  if (!loop) return fail(c, 'NOT_FOUND', 'OODA loop not found.', 404)
  const body = await c.req.json().catch(() => null)
  const parsed = createLoopRunBodySchema.safeParse(body)
  if (!parsed.success) {
    return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  }

  let run = await createSagaRun({
    sagaKey: parsed.data.sagaKey,
    mode: parsed.data.mode,
    bizId: parsed.data.bizId,
    requestedByUserId: user.id,
    runnerLabel: parsed.data.runnerLabel ?? 'ooda-dashboard',
    runContext: {
      source: 'ooda-dashboard',
      loopId,
      loopKey: loop.loopKey,
    },
  })
  if (!run?.run) {
    return fail(c, 'INTERNAL_ERROR', 'Saga run was not created successfully.', 500)
  }
  let runDetail = run
  const runId = run.run.id

  await ensureLoopRunOutputLink({
    c,
    bizId: loop.bizId ?? null,
    loopId,
    runId,
    actorUserId: user.id,
  })

  const createdAction = (await createOodaRow(
    c,
    loop.bizId ?? null,
    'oodaLoopActions',
    {
      oodaLoopId: loopId,
      oodaLoopEntryId: parsed.data.oodaLoopEntryId ?? null,
      actionKey: 'saga.run.create',
      actionTitle: parsed.data.actionTitle ?? `Run ${parsed.data.sagaKey}`,
      status: parsed.data.autoExecute ? 'running' : 'queued',
      dryRun: parsed.data.mode === 'dry_run',
      requestedByUserId: user.id,
      linkedSagaRunId: runId,
      requestPayload: parsed.data.requestPayload ?? {
        sagaKey: parsed.data.sagaKey,
        mode: parsed.data.mode,
      },
      resultPayload: {
        runId,
        status: runDetail.run.status,
      },
      startedAt: new Date(),
      endedAt: parsed.data.autoExecute ? null : undefined,
      createdBy: user.id,
      updatedBy: user.id,
    },
    {
      subjectType: 'ooda_loop_action',
      subjectId: runId,
      displayName: parsed.data.actionTitle ?? `Run ${parsed.data.sagaKey}`,
      metadata: { source: 'routes.ooda.createSagaRunAction' },
    },
  )) as Record<string, unknown> | Response
  if (createdAction instanceof Response) return createdAction

  let action = createdAction as Record<string, unknown>
  if (parsed.data.autoExecute) {
    const cookie = c.req.header('cookie')
    if (!cookie) {
      const blockedAction = await updateOodaRow(
        c,
        loop.bizId ?? null,
        'oodaLoopActions',
        String(createdAction.id),
        {
          status: 'failed',
          errorMessage:
            'Run created, but execution could not start because session cookie was missing.',
          endedAt: new Date(),
          updatedAt: new Date(),
          updatedBy: user.id,
        },
        {
          subjectType: 'ooda_loop_action',
          subjectId: String(createdAction.id),
          displayName: 'Run Saga',
          metadata: { source: 'routes.ooda.blockedSagaRunAction' },
        },
      )
      if (blockedAction instanceof Response) return blockedAction
      action = blockedAction ?? createdAction
    } else {
      const execution = await executeExistingSagaRun({
        runId,
        sagaKey: runDetail.run.sagaKey,
        bizId: runDetail.run.bizId,
        owner: {
          email: user.email ?? `user-${user.id}@session.local`,
          password: '',
          userId: user.id,
          cookie,
        },
      })
      const refreshedRunRow = await db.query.sagaRuns.findFirst({
        where: eq(sagaRuns.id, runId),
      })
      const updatedAction = await updateOodaRow(
        c,
        loop.bizId ?? null,
        'oodaLoopActions',
        String(createdAction.id),
        {
          status: execution.ok ? 'succeeded' : 'failed',
          endedAt: new Date(),
          updatedAt: new Date(),
          updatedBy: user.id,
          errorMessage: execution.ok
            ? null
            : execution.failures.slice(0, 3).join(' | ') || 'Saga execution failed.',
          resultPayload: {
            runId,
            status: refreshedRunRow?.status ?? runDetail.run.status,
            ok: execution.ok,
            failureCount: execution.failures.length,
            failures: execution.failures.slice(0, 10),
          },
        },
        {
          subjectType: 'ooda_loop_action',
          subjectId: String(createdAction.id),
          displayName: 'Run Saga',
          metadata: { source: 'routes.ooda.finalizeSagaRunAction' },
        },
      )
      if (updatedAction instanceof Response) return updatedAction
      action = updatedAction ?? createdAction
      const refreshedRunDetail = await getSagaRunDetail(runId)
      if (refreshedRunDetail) runDetail = refreshedRunDetail
    }
  }

  emitOodaRealtime({
    loopId,
    requestedByUserId: user.id,
    eventType: 'run.updated',
    payload: {
      entity: 'action',
      linkedSagaRunId: runId,
      actionStatus: action.status,
    },
  })

  return ok(
    c,
    {
      run: runDetail,
      action,
    },
    201,
  )
})

/**
 * LLM helper that drafts UC/persona/saga-definition JSON payloads.
 *
 * Important:
 * This endpoint only drafts text/data.
 * Persisting the draft is always explicit through the regular CRUD routes.
 */
oodaRoutes.post('/ooda/generate/draft', requireAuth, async (c) => {
  const user = getCurrentUser(c)
  if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)
  const body = await c.req.json().catch(() => null)
  const parsed = generateBodySchema.safeParse(body)
  if (!parsed.success) {
    return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  }

  const systemPrompt = [
    'You are generating drafts for the Bizing OODA dashboard.',
    'Return only valid JSON. No markdown fences.',
    'Keep fields practical and concise.',
    'Do not invent IDs.',
    parsed.data.kind === 'use_case'
      ? 'Schema: {"title":string,"summary":string,"bodyMarkdown":string,"extractedNeeds":array}'
      : parsed.data.kind === 'persona'
        ? 'Schema: {"name":string,"profileSummary":string,"bodyMarkdown":string,"goals":string,"painPoints":string}'
        : 'Schema: {"sagaTitle":string,"description":string,"objectives":string[],"actors":array,"phases":array}',
  ].join('\n')

  const userPrompt = [
    `Kind: ${parsed.data.kind}`,
    `Prompt: ${parsed.data.prompt}`,
    parsed.data.context ? `Context: ${parsed.data.context}` : '',
  ]
    .filter(Boolean)
    .join('\n')

  const response = await chatWithLLM(
    {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.2,
      maxTokens: 1400,
      enableFunctions: false,
    },
    parsed.data.model as any,
  )

  let draft: unknown = null
  try {
    draft = JSON.parse(response)
  } catch {
    return fail(c, 'LLM_INVALID_JSON', 'Model did not return valid JSON draft.', 422, {
      raw: response,
    })
  }

  return ok(c, {
    kind: parsed.data.kind,
    draft,
    raw: response,
  })
})
