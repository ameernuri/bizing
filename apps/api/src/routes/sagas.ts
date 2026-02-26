import { Hono } from 'hono'
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm'
import { z } from 'zod'
import dbPackage from '@bizing/db'
import { getCurrentUser, requireAuth } from '../middleware/auth.js'
import { fail, ok, parsePositiveInt } from './_api.js'
import {
  DEFAULT_PERSONAS_FILE,
  DEFAULT_SCHEMA_COVERAGE_FILE,
  DEFAULT_USE_CASES_FILE,
  SAGA_BASE_DIR,
  SAGA_REPORTS_DIR,
  SAGA_RUNS_DIR,
  SAGA_SPECS_DIR,
  archiveSagaRuns,
  canUserAccessSagaRun,
  createSagaRun,
  deleteSagaDefinitionByKey,
  ensureBizMembership,
  generateSagaSpecsFromDocs,
  getSagaDefinitionByKey,
  getSagaDefinitionWithSpec,
  getSagaRunDetail,
  getSagaTestModeState,
  listSagaDefinitions,
  listSagaRuns,
  readArtifactsContent,
  refreshSagaRunStatus,
  saveSagaArtifact,
  saveSagaSnapshot,
  saveSagaReport,
  syncSagaLoopLibraryFromDocs,
  resetSagaLoopData,
  listSagaUseCases,
  createSagaUseCaseDefinition,
  getSagaUseCaseDetail,
  updateSagaUseCaseDefinition,
  createSagaUseCaseVersion,
  deleteSagaUseCaseDefinition,
  listSagaPersonas,
  createSagaPersonaDefinition,
  getSagaPersonaDetail,
  updateSagaPersonaDefinition,
  createSagaPersonaVersion,
  deleteSagaPersonaDefinition,
  getSagaLibraryRelations,
  listSagaCoverageReports,
  listSagaDefinitionRevisions,
  getSagaCoverageReportDetail,
  importSchemaCoverageReportFromMarkdown,
  listSagaRunActorProfiles,
  listSagaRunActorMessages,
  createSagaRunActorMessage,
  syncSagaDefinitionsFromDisk,
  upsertSagaDefinitionSpec,
  updateSagaRunStep,
} from '../services/sagas.js'
import {
  evaluateExploratorySagaStep,
  getExploratoryEvaluatorHealth,
  type ExploratoryStepFamily,
} from '../services/saga-exploratory-evaluator.js'
import { executeExistingSagaRun } from '../scripts/rerun-sagas.js'
import { sagaSpecSchema } from '../sagas/spec-schema.js'
import { normalizeSnapshotInput, pseudoShotInputSchema } from '../sagas/snapshot-schema.js'

const { db } = dbPackage
const sagaRuns = dbPackage.sagaRuns
const sagaRunArtifacts = dbPackage.sagaRunArtifacts
const sagaDefinitionLinks = dbPackage.sagaDefinitionLinks
const sagaUseCaseVersions = dbPackage.sagaUseCaseVersions
const sagaPersonaVersions = dbPackage.sagaPersonaVersions

const listSpecQuerySchema = z.object({
  status: z.enum(['draft', 'active', 'archived']).optional(),
  sync: z.enum(['true', 'false']).optional(),
  limit: z.string().optional(),
})

const upsertSpecBodySchema = z.object({
  spec: z.unknown(),
  bizId: z.string().optional().nullable(),
  status: z.enum(['draft', 'active', 'archived']).optional(),
  metadata: z.record(z.unknown()).optional(),
  sourceFilePath: z.string().optional().nullable(),
  forceRevision: z.boolean().optional(),
  revisionMetadata: z.record(z.unknown()).optional(),
})

const listSpecRevisionsQuerySchema = z.object({
  limit: z.string().optional(),
})

const generateSpecsBodySchema = z.object({
  useCaseFile: z.string().optional(),
  personaFile: z.string().optional(),
  useCaseRefs: z.array(z.string().min(1)).optional(),
  personaRefs: z.array(z.string().min(1)).optional(),
  limitUseCases: z.number().int().positive().optional(),
  maxPersonasPerUseCase: z.number().int().positive().optional(),
  overwrite: z.boolean().default(true),
  syncDefinitions: z.boolean().default(true),
})

const syncLibraryBodySchema = z.object({
  useCaseFile: z.string().optional(),
  personaFile: z.string().optional(),
  linkSagaDefinitions: z.boolean().default(true),
})

const listLibraryQuerySchema = z.object({
  status: z.enum(['draft', 'active', 'archived']).optional(),
  limit: z.string().optional(),
})

const createUseCaseBodySchema = z.object({
  ucKey: z.string().min(1).max(120),
  title: z.string().min(1).max(255),
  status: z.enum(['draft', 'active', 'archived']).optional(),
  summary: z.string().optional().nullable(),
  sourceFilePath: z.string().optional().nullable(),
  sourceRef: z.string().optional().nullable(),
})

const updateUseCaseBodySchema = z.object({
  title: z.string().min(1).max(255).optional(),
  status: z.enum(['draft', 'active', 'archived']).optional(),
  summary: z.string().optional().nullable(),
  sourceFilePath: z.string().optional().nullable(),
  sourceRef: z.string().optional().nullable(),
})

const createUseCaseVersionBodySchema = z.object({
  title: z.string().min(1).max(255).optional(),
  summary: z.string().optional().nullable(),
  bodyMarkdown: z.string().min(1),
  extractedNeeds: z.array(z.unknown()).optional(),
  extractedScenario: z.string().optional().nullable(),
  isCurrent: z.boolean().optional(),
})

const createPersonaBodySchema = z.object({
  personaKey: z.string().min(1).max(120),
  name: z.string().min(1).max(255),
  status: z.enum(['draft', 'active', 'archived']).optional(),
  profileSummary: z.string().optional().nullable(),
  sourceFilePath: z.string().optional().nullable(),
  sourceRef: z.string().optional().nullable(),
})

const updatePersonaBodySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  status: z.enum(['draft', 'active', 'archived']).optional(),
  profileSummary: z.string().optional().nullable(),
  sourceFilePath: z.string().optional().nullable(),
  sourceRef: z.string().optional().nullable(),
})

const createPersonaVersionBodySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  profile: z.string().optional().nullable(),
  goals: z.string().optional().nullable(),
  painPoints: z.string().optional().nullable(),
  testScenarios: z.array(z.unknown()).optional(),
  bodyMarkdown: z.string().min(1),
  isCurrent: z.boolean().optional(),
})

const libraryRelationsQuerySchema = z.object({
  kind: z.enum(['use_case', 'persona']),
  key: z.string().min(1),
})

const listCoverageReportsQuerySchema = z.object({
  sagaRunId: z.string().optional(),
  sagaDefinitionId: z.string().optional(),
  scopeType: z.string().optional(),
  limit: z.string().optional(),
})

const importSchemaCoverageBodySchema = z.object({
  coverageFile: z.string().optional(),
  replaceExisting: z.boolean().default(true),
})

const resetLoopBodySchema = z.object({
  useCaseFile: z.string().optional(),
  personaFile: z.string().optional(),
  coverageFile: z.string().optional(),
  linkSagaDefinitions: z.boolean().default(true),
  regenerateSpecs: z.boolean().default(true),
  syncDefinitions: z.boolean().default(true),
  importSchemaCoverage: z.boolean().default(true),
  replaceExistingSchemaCoverage: z.boolean().default(true),
})

const createRunBodySchema = z.object({
  sagaKey: z.string().min(1),
  bizId: z.string().optional(),
  mode: z.enum(['dry_run', 'live']).optional(),
  runnerLabel: z.string().max(160).optional(),
  runContext: z.record(z.unknown()).optional(),
})

const updateStepBodySchema = z.object({
  status: z.enum(['pending', 'in_progress', 'passed', 'failed', 'skipped', 'blocked']),
  startedAt: z.string().datetime().optional(),
  endedAt: z.string().datetime().optional(),
  failureCode: z.string().max(120).optional().nullable(),
  failureMessage: z.string().optional().nullable(),
  resultPayload: z.record(z.unknown()).optional(),
  assertionSummary: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
})

const saveReportBodySchema = z.object({
  markdown: z.string().min(1),
  summary: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
})

const saveTraceBodySchema = z.object({
  stepKey: z.string().optional(),
  title: z.string().max(255).optional(),
  trace: z.unknown(),
  metadata: z.record(z.unknown()).optional(),
})

const listRunsQuerySchema = z.object({
  sagaKey: z.string().optional(),
  status: z.enum(['pending', 'running', 'passed', 'failed', 'cancelled']).optional(),
  limit: z.string().optional(),
  mineOnly: z.enum(['true', 'false']).optional(),
  includeArchived: z.enum(['true', 'false']).optional(),
})

const archiveRunBodySchema = z.object({
  runIds: z.array(z.string().min(1)).min(1).max(1000),
})

const testModeQuerySchema = z.object({
  runId: z.string().optional(),
  sagaKey: z.string().optional(),
  bizId: z.string().optional(),
})

const listRunMessagesQuerySchema = z.object({
  actorKey: z.string().optional(),
})

const createRunMessageBodySchema = z.object({
  stepKey: z.string().optional(),
  fromActorKey: z.string().optional().nullable(),
  toActorKey: z.string().min(1),
  channel: z.enum(['email', 'sms', 'push', 'in_app']),
  subject: z.string().max(255).optional().nullable(),
  bodyText: z.string().min(1),
  status: z.enum(['queued', 'sent', 'delivered', 'read', 'failed', 'cancelled']).optional(),
  metadata: z.record(z.unknown()).optional(),
})

const exploratoryEvaluateBodySchema = z.object({
  stepFamily: z.enum(['uc-need-validation', 'persona-scenario-validation']).optional(),
})

function isPlatformAdmin(user: { role?: string | null }) {
  return user.role === 'admin' || user.role === 'owner'
}

async function canAccessRun(user: { id: string; role?: string | null }, runId: string) {
  const access = await canUserAccessSagaRun({
    userId: user.id,
    platformRole: user.role ?? null,
    runId,
  })
  return access
}

export const sagaRoutes = new Hono()
/**
 * Access model for saga routes:
 * - require authenticated session for all endpoints,
 * - enforce per-run visibility/mutation with `canAccessRun`,
 * - enforce per-biz checks at run creation when `bizId` is provided.
 *
 * We intentionally avoid global ACL middleware on this surface because saga
 * runners often use fresh test identities that have no platform-scoped ACL
 * bindings yet. Run ownership + biz membership checks are the canonical guard
 * rails for lifecycle test infrastructure.
 */

sagaRoutes.get('/sagas/docs', requireAuth, async (c) => {
  const user = getCurrentUser(c)
  if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)

  return ok(c, {
    description:
      'Saga lifecycle testing contract. Use spec generation + run APIs for full business lifecycle simulations.',
    filesystem: {
      baseDir: SAGA_BASE_DIR,
      specsDir: SAGA_SPECS_DIR,
      runsDir: SAGA_RUNS_DIR,
      reportsDir: SAGA_REPORTS_DIR,
      defaultUseCasesFile: DEFAULT_USE_CASES_FILE,
      defaultPersonasFile: DEFAULT_PERSONAS_FILE,
      defaultSchemaCoverageFile: DEFAULT_SCHEMA_COVERAGE_FILE,
    },
    workflow: [
      'Create/replace DB-native saga specs via POST/PUT /api/v1/sagas/specs.',
      'List revisions via GET /api/v1/sagas/specs/:sagaKey/revisions.',
      'Optional: import file specs with POST /api/v1/sagas/specs/sync.',
      'Create run with POST /api/v1/sagas/runs.',
      'Archive runs with POST /api/v1/sagas/runs/:runId/archive or /api/v1/sagas/runs/archive.',
      'Use agents tools and report each step via /steps/:stepKey/result.',
      'Attach snapshots and final report to complete evidence trail.',
      'Use /api/v1/sagas/test-mode/next for agent-driven next-step execution.',
    ],
    realtime: {
      websocket: '/api/v1/ws/sagas',
      subscribeCommands: [
        { type: 'subscribe_list' },
        { type: 'subscribe_run', runId: '<runId>' },
      ],
    },
  })
})

sagaRoutes.get('/sagas/llm/health', requireAuth, async (c) => {
  const user = getCurrentUser(c)
  if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)

  const health = await getExploratoryEvaluatorHealth()
  return ok(c, health)
})

sagaRoutes.post('/sagas/library/sync-docs', requireAuth, async (c) => {
  const user = getCurrentUser(c)
  if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)

  const body = await c.req.json().catch(() => null)
  const parsed = syncLibraryBodySchema.safeParse(body)
  if (!parsed.success) {
    return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  }

  const synced = await syncSagaLoopLibraryFromDocs({
    useCaseFile: parsed.data.useCaseFile,
    personaFile: parsed.data.personaFile,
    actorUserId: user.id,
    linkSagaDefinitions: parsed.data.linkSagaDefinitions,
  })

  return ok(c, synced, 201)
})

sagaRoutes.post('/sagas/library/reset-reseed', requireAuth, async (c) => {
  const user = getCurrentUser(c)
  if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)
  if (!isPlatformAdmin(user)) {
    return fail(c, 'FORBIDDEN', 'Only platform admins can reset saga loop data.', 403)
  }

  const body = await c.req.json().catch(() => null)
  const parsed = resetLoopBodySchema.safeParse(body)
  if (!parsed.success) {
    return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  }

  await resetSagaLoopData()

  if (parsed.data.regenerateSpecs) {
    await generateSagaSpecsFromDocs({
      useCaseFile: parsed.data.useCaseFile,
      personaFile: parsed.data.personaFile,
      overwrite: true,
    })
  }

  const syncedDefinitions = parsed.data.syncDefinitions
    ? await syncSagaDefinitionsFromDisk(user.id)
    : []

  const loopSynced = await syncSagaLoopLibraryFromDocs({
    useCaseFile: parsed.data.useCaseFile,
    personaFile: parsed.data.personaFile,
    actorUserId: user.id,
    linkSagaDefinitions: parsed.data.linkSagaDefinitions,
  })

  const schemaCoverage = parsed.data.importSchemaCoverage
    ? await importSchemaCoverageReportFromMarkdown({
        coverageFile: parsed.data.coverageFile,
        replaceExisting: parsed.data.replaceExistingSchemaCoverage,
        actorUserId: user.id,
      })
    : null

  return ok(
    c,
    {
      reset: true,
      syncedDefinitionsCount: syncedDefinitions.length,
      loopSynced,
      schemaCoverage,
    },
    201,
  )
})

sagaRoutes.post('/sagas/schema-coverage/import', requireAuth, async (c) => {
  const user = getCurrentUser(c)
  if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)
  if (!isPlatformAdmin(user)) {
    return fail(c, 'FORBIDDEN', 'Only platform admins can import schema coverage.', 403)
  }

  const body = await c.req.json().catch(() => null)
  const parsed = importSchemaCoverageBodySchema.safeParse(body)
  if (!parsed.success) {
    return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  }

  const imported = await importSchemaCoverageReportFromMarkdown({
    coverageFile: parsed.data.coverageFile,
    replaceExisting: parsed.data.replaceExisting,
    actorUserId: user.id,
  })
  return ok(c, imported, 201)
})

sagaRoutes.get('/sagas/library/overview', requireAuth, async (c) => {
  const user = getCurrentUser(c)
  if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)

  const [
    ucCountRow,
    personaCountRow,
    definitionCountRow,
    runCountRow,
    coverageCountRow,
    runAssessmentCountRow,
    schemaCoverageCountRow,
  ] =
    await Promise.all([
      db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(dbPackage.sagaUseCases),
      db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(dbPackage.sagaPersonas),
      db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(dbPackage.sagaDefinitions),
      db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(dbPackage.sagaRuns),
      db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(dbPackage.sagaCoverageReports),
      db
        .select({ count: sql<number>`count(*)`.mapWith(Number) })
        .from(dbPackage.sagaCoverageReports)
        .where(eq(dbPackage.sagaCoverageReports.scopeType, 'run')),
      db
        .select({ count: sql<number>`count(*)`.mapWith(Number) })
        .from(dbPackage.sagaCoverageReports)
        .where(eq(dbPackage.sagaCoverageReports.scopeType, 'schema_baseline')),
    ])

  const recentCoverage = await listSagaCoverageReports({ limit: 10, scopeType: 'run' })
  const recentSchemaCoverage = await listSagaCoverageReports({
    limit: 10,
    scopeType: 'schema_baseline',
  })
  const recentRuns = await listSagaRuns({
    limit: 10,
    requestedByUserId: isPlatformAdmin(user) ? undefined : user.id,
  })

  return ok(c, {
    counts: {
      useCases: ucCountRow[0]?.count ?? 0,
      personas: personaCountRow[0]?.count ?? 0,
      sagaDefinitions: definitionCountRow[0]?.count ?? 0,
      sagaRuns: runCountRow[0]?.count ?? 0,
      coverageReports: coverageCountRow[0]?.count ?? 0,
      runAssessmentReports: runAssessmentCountRow[0]?.count ?? 0,
      schemaCoverageReports: schemaCoverageCountRow[0]?.count ?? 0,
    },
    recentCoverage,
    recentSchemaCoverage,
    recentRuns,
  })
})

sagaRoutes.get('/sagas/use-cases', requireAuth, async (c) => {
  const user = getCurrentUser(c)
  if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)
  const parsed = listLibraryQuerySchema.safeParse(c.req.query())
  if (!parsed.success) {
    return fail(c, 'VALIDATION_ERROR', 'Invalid query parameters.', 400, parsed.error.flatten())
  }
  const limit = Math.min(parsePositiveInt(parsed.data.limit, 500), 20000)
  const rows = await listSagaUseCases({
    status: parsed.data.status,
    limit,
  })
  return ok(c, rows)
})

sagaRoutes.post('/sagas/use-cases', requireAuth, async (c) => {
  const user = getCurrentUser(c)
  if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)
  const body = await c.req.json().catch(() => null)
  const parsed = createUseCaseBodySchema.safeParse(body)
  if (!parsed.success) {
    return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  }
  try {
    const created = await createSagaUseCaseDefinition({
      actorUserId: user.id,
      ...parsed.data,
    })
    return ok(c, created, 201)
  } catch (error) {
    return fail(c, 'CONFLICT', error instanceof Error ? error.message : 'Failed to create use case.', 409)
  }
})

sagaRoutes.get('/sagas/use-cases/:ucKey', requireAuth, async (c) => {
  const user = getCurrentUser(c)
  if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)
  const detail = await getSagaUseCaseDetail(c.req.param('ucKey'))
  if (!detail) return fail(c, 'NOT_FOUND', 'Use case not found.', 404)
  return ok(c, detail)
})

sagaRoutes.patch('/sagas/use-cases/:ucKey', requireAuth, async (c) => {
  const user = getCurrentUser(c)
  if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)
  const body = await c.req.json().catch(() => null)
  const parsed = updateUseCaseBodySchema.safeParse(body)
  if (!parsed.success) {
    return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  }
  const updated = await updateSagaUseCaseDefinition({
    ucKey: c.req.param('ucKey'),
    actorUserId: user.id,
    ...parsed.data,
  })
  if (!updated) return fail(c, 'NOT_FOUND', 'Use case not found.', 404)
  return ok(c, updated)
})

sagaRoutes.post('/sagas/use-cases/:ucKey/versions', requireAuth, async (c) => {
  const user = getCurrentUser(c)
  if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)
  const body = await c.req.json().catch(() => null)
  const parsed = createUseCaseVersionBodySchema.safeParse(body)
  if (!parsed.success) {
    return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  }
  const created = await createSagaUseCaseVersion({
    ucKey: c.req.param('ucKey'),
    actorUserId: user.id,
    ...parsed.data,
  })
  if (!created) return fail(c, 'NOT_FOUND', 'Use case not found.', 404)
  return ok(c, created, 201)
})

sagaRoutes.delete('/sagas/use-cases/:ucKey', requireAuth, async (c) => {
  const user = getCurrentUser(c)
  if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)
  const deleted = await deleteSagaUseCaseDefinition({
    ucKey: c.req.param('ucKey'),
    actorUserId: user.id,
  })
  if (!deleted) return fail(c, 'NOT_FOUND', 'Use case not found.', 404)
  return ok(c, { deleted: true })
})

sagaRoutes.get('/sagas/personas', requireAuth, async (c) => {
  const user = getCurrentUser(c)
  if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)
  const parsed = listLibraryQuerySchema.safeParse(c.req.query())
  if (!parsed.success) {
    return fail(c, 'VALIDATION_ERROR', 'Invalid query parameters.', 400, parsed.error.flatten())
  }
  const limit = Math.min(parsePositiveInt(parsed.data.limit, 500), 20000)
  const rows = await listSagaPersonas({
    status: parsed.data.status,
    limit,
  })
  return ok(c, rows)
})

sagaRoutes.post('/sagas/personas', requireAuth, async (c) => {
  const user = getCurrentUser(c)
  if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)
  const body = await c.req.json().catch(() => null)
  const parsed = createPersonaBodySchema.safeParse(body)
  if (!parsed.success) {
    return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  }
  try {
    const created = await createSagaPersonaDefinition({
      actorUserId: user.id,
      ...parsed.data,
    })
    return ok(c, created, 201)
  } catch (error) {
    return fail(c, 'CONFLICT', error instanceof Error ? error.message : 'Failed to create persona.', 409)
  }
})

sagaRoutes.get('/sagas/personas/:personaKey', requireAuth, async (c) => {
  const user = getCurrentUser(c)
  if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)
  const detail = await getSagaPersonaDetail(c.req.param('personaKey'))
  if (!detail) return fail(c, 'NOT_FOUND', 'Persona not found.', 404)
  return ok(c, detail)
})

sagaRoutes.patch('/sagas/personas/:personaKey', requireAuth, async (c) => {
  const user = getCurrentUser(c)
  if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)
  const body = await c.req.json().catch(() => null)
  const parsed = updatePersonaBodySchema.safeParse(body)
  if (!parsed.success) {
    return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  }
  const updated = await updateSagaPersonaDefinition({
    personaKey: c.req.param('personaKey'),
    actorUserId: user.id,
    ...parsed.data,
  })
  if (!updated) return fail(c, 'NOT_FOUND', 'Persona not found.', 404)
  return ok(c, updated)
})

sagaRoutes.post('/sagas/personas/:personaKey/versions', requireAuth, async (c) => {
  const user = getCurrentUser(c)
  if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)
  const body = await c.req.json().catch(() => null)
  const parsed = createPersonaVersionBodySchema.safeParse(body)
  if (!parsed.success) {
    return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  }
  const created = await createSagaPersonaVersion({
    personaKey: c.req.param('personaKey'),
    actorUserId: user.id,
    ...parsed.data,
  })
  if (!created) return fail(c, 'NOT_FOUND', 'Persona not found.', 404)
  return ok(c, created, 201)
})

sagaRoutes.delete('/sagas/personas/:personaKey', requireAuth, async (c) => {
  const user = getCurrentUser(c)
  if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)
  const deleted = await deleteSagaPersonaDefinition({
    personaKey: c.req.param('personaKey'),
    actorUserId: user.id,
  })
  if (!deleted) return fail(c, 'NOT_FOUND', 'Persona not found.', 404)
  return ok(c, { deleted: true })
})

sagaRoutes.get('/sagas/library/related', requireAuth, async (c) => {
  const user = getCurrentUser(c)
  if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)
  const parsed = libraryRelationsQuerySchema.safeParse(c.req.query())
  if (!parsed.success) {
    return fail(c, 'VALIDATION_ERROR', 'Invalid query parameters.', 400, parsed.error.flatten())
  }

  const detail = await getSagaLibraryRelations({
    kind: parsed.data.kind,
    key: parsed.data.key.trim(),
  })
  if (!detail) return fail(c, 'NOT_FOUND', 'Library item not found.', 404)
  return ok(c, detail)
})

sagaRoutes.get('/sagas/definitions/:sagaKey/links', requireAuth, async (c) => {
  const user = getCurrentUser(c)
  if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)
  const sagaKey = c.req.param('sagaKey')

  const definition = await db.query.sagaDefinitions.findFirst({
    where: eq(dbPackage.sagaDefinitions.sagaKey, sagaKey),
  })
  if (!definition) return fail(c, 'NOT_FOUND', 'Saga definition not found.', 404)

  const links = await db.query.sagaDefinitionLinks.findMany({
    where: eq(sagaDefinitionLinks.sagaDefinitionId, definition.id),
    orderBy: [asc(sagaDefinitionLinks.relationRole)],
  })

  const useCaseVersionIds = links
    .map((link) => link.sagaUseCaseVersionId)
    .filter((id): id is string => Boolean(id))
  const personaVersionIds = links
    .map((link) => link.sagaPersonaVersionId)
    .filter((id): id is string => Boolean(id))

  const [useCaseVersions, personaVersions] = await Promise.all([
    useCaseVersionIds.length
      ? db.query.sagaUseCaseVersions.findMany({
          where: inArray(sagaUseCaseVersions.id, useCaseVersionIds),
        })
      : [],
    personaVersionIds.length
      ? db.query.sagaPersonaVersions.findMany({
          where: inArray(sagaPersonaVersions.id, personaVersionIds),
        })
      : [],
  ])

  const useCaseIds = Array.from(
    new Set(useCaseVersions.map((row) => row.sagaUseCaseId).filter(Boolean)),
  )
  const personaIds = Array.from(
    new Set(personaVersions.map((row) => row.sagaPersonaId).filter(Boolean)),
  )

  const [useCaseDefs, personaDefs] = await Promise.all([
    useCaseIds.length
      ? db.query.sagaUseCases.findMany({
          where: inArray(dbPackage.sagaUseCases.id, useCaseIds),
        })
      : [],
    personaIds.length
      ? db.query.sagaPersonas.findMany({
          where: inArray(dbPackage.sagaPersonas.id, personaIds),
        })
      : [],
  ])

  const useCaseById = new Map(useCaseDefs.map((row) => [row.id, row]))
  const personaById = new Map(personaDefs.map((row) => [row.id, row]))

  const enrichedUseCaseVersions = useCaseVersions.map((row) => ({
    ...row,
    ucKey: useCaseById.get(row.sagaUseCaseId)?.ucKey ?? null,
    useCaseTitle: useCaseById.get(row.sagaUseCaseId)?.title ?? null,
  }))
  const enrichedPersonaVersions = personaVersions.map((row) => ({
    ...row,
    personaKey: personaById.get(row.sagaPersonaId)?.personaKey ?? null,
    personaName: personaById.get(row.sagaPersonaId)?.name ?? null,
  }))

  return ok(c, {
    definition,
    links,
    useCaseVersions: enrichedUseCaseVersions,
    personaVersions: enrichedPersonaVersions,
  })
})

/**
 * Canonical run-assessment coverage endpoints.
 *
 * ELI5:
 * These are coverage reports derived from saga executions (pass/fail runs),
 * not the schema baseline markdown matrix.
 */
sagaRoutes.get('/sagas/run-assessments/reports', requireAuth, async (c) => {
  const user = getCurrentUser(c)
  if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)
  const parsed = listCoverageReportsQuerySchema.safeParse(c.req.query())
  if (!parsed.success) {
    return fail(c, 'VALIDATION_ERROR', 'Invalid query parameters.', 400, parsed.error.flatten())
  }
  const rows = await listSagaCoverageReports({
    sagaRunId: parsed.data.sagaRunId,
    sagaDefinitionId: parsed.data.sagaDefinitionId,
    scopeType: 'run',
    limit: Math.min(parsePositiveInt(parsed.data.limit, 100), 1000),
  })
  return ok(c, rows)
})

sagaRoutes.get('/sagas/run-assessments/reports/:reportId', requireAuth, async (c) => {
  const user = getCurrentUser(c)
  if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)
  const reportId = c.req.param('reportId')
  const detail = await getSagaCoverageReportDetail(reportId)
  if (!detail) return fail(c, 'NOT_FOUND', 'Coverage report not found.', 404)
  if (detail.report.scopeType !== 'run') {
    return fail(c, 'NOT_FOUND', 'Run assessment report not found.', 404)
  }
  return ok(c, detail)
})

/**
 * Canonical schema-baseline coverage endpoints.
 *
 * ELI5:
 * These rows come from the markdown schema coverage matrix and are independent
 * from saga run execution status.
 */
sagaRoutes.get('/sagas/schema-coverage/reports', requireAuth, async (c) => {
  const user = getCurrentUser(c)
  if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)
  const parsed = listCoverageReportsQuerySchema.safeParse(c.req.query())
  if (!parsed.success) {
    return fail(c, 'VALIDATION_ERROR', 'Invalid query parameters.', 400, parsed.error.flatten())
  }
  const rows = await listSagaCoverageReports({
    scopeType: 'schema_baseline',
    limit: Math.min(parsePositiveInt(parsed.data.limit, 100), 1000),
  })
  return ok(c, rows)
})

sagaRoutes.get('/sagas/schema-coverage/reports/:reportId', requireAuth, async (c) => {
  const user = getCurrentUser(c)
  if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)
  const reportId = c.req.param('reportId')
  const detail = await getSagaCoverageReportDetail(reportId)
  if (!detail) return fail(c, 'NOT_FOUND', 'Coverage report not found.', 404)
  if (detail.report.scopeType !== 'schema_baseline') {
    return fail(c, 'NOT_FOUND', 'Schema coverage report not found.', 404)
  }
  return ok(c, detail)
})

/**
 * Backward-compat alias:
 * `/sagas/coverage/reports*` now maps to run-assessment coverage.
 */
sagaRoutes.get('/sagas/coverage/reports', requireAuth, async (c) => {
  const user = getCurrentUser(c)
  if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)
  const parsed = listCoverageReportsQuerySchema.safeParse(c.req.query())
  if (!parsed.success) {
    return fail(c, 'VALIDATION_ERROR', 'Invalid query parameters.', 400, parsed.error.flatten())
  }
  const rows = await listSagaCoverageReports({
    sagaRunId: parsed.data.sagaRunId,
    sagaDefinitionId: parsed.data.sagaDefinitionId,
    scopeType: parsed.data.scopeType || 'run',
    limit: Math.min(parsePositiveInt(parsed.data.limit, 100), 1000),
  })
  return ok(c, rows)
})

sagaRoutes.get('/sagas/coverage/reports/:reportId', requireAuth, async (c) => {
  const user = getCurrentUser(c)
  if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)
  const reportId = c.req.param('reportId')
  const detail = await getSagaCoverageReportDetail(reportId)
  if (!detail) return fail(c, 'NOT_FOUND', 'Coverage report not found.', 404)
  return ok(c, detail)
})

sagaRoutes.get('/sagas/specs', requireAuth, async (c) => {
  const user = getCurrentUser(c)
  if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)

  const parsed = listSpecQuerySchema.safeParse(c.req.query())
  if (!parsed.success) {
    return fail(c, 'VALIDATION_ERROR', 'Invalid query parameters.', 400, parsed.error.flatten())
  }

  if (parsed.data.sync === 'true') {
    await syncSagaDefinitionsFromDisk(user.id)
  }

  const definitions = await listSagaDefinitions({
    status: parsed.data.status,
    limit: Math.min(parsePositiveInt(parsed.data.limit, 200), 1000),
  })

  return ok(c, definitions)
})

/**
 * Create one DB-native saga definition + current revision.
 *
 * This is canonical CRUD creation path (not file-sync).
 */
sagaRoutes.post('/sagas/specs', requireAuth, async (c) => {
  const user = getCurrentUser(c)
  if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)

  const body = await c.req.json().catch(() => null)
  const parsed = upsertSpecBodySchema.safeParse(body)
  if (!parsed.success) {
    return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  }

  const specParsed = sagaSpecSchema.safeParse(parsed.data.spec)
  if (!specParsed.success) {
    return fail(c, 'VALIDATION_ERROR', 'Invalid saga spec payload.', 400, specParsed.error.flatten())
  }

  const existing = await getSagaDefinitionByKey(specParsed.data.sagaKey)
  if (existing) {
    return fail(c, 'CONFLICT', 'Saga definition already exists for this sagaKey.', 409)
  }

  const saved = await upsertSagaDefinitionSpec({
    spec: specParsed.data,
    actorUserId: user.id,
    bizId: parsed.data.bizId ?? null,
    status: parsed.data.status,
    metadata: parsed.data.metadata,
    sourceFilePath: parsed.data.sourceFilePath ?? undefined,
    forceRevision: parsed.data.forceRevision ?? true,
    revisionMetadata: parsed.data.revisionMetadata,
  })

  return ok(c, saved, 201)
})

sagaRoutes.post('/sagas/specs/generate', requireAuth, async (c) => {
  const user = getCurrentUser(c)
  if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)

  const body = await c.req.json().catch(() => null)
  const parsed = generateSpecsBodySchema.safeParse(body)
  if (!parsed.success) {
    return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  }

  const generated = await generateSagaSpecsFromDocs(parsed.data)
  const synced = parsed.data.syncDefinitions ? await syncSagaDefinitionsFromDisk(user.id) : []
  const loopSynced = await syncSagaLoopLibraryFromDocs({
    useCaseFile: parsed.data.useCaseFile,
    personaFile: parsed.data.personaFile,
    actorUserId: user.id,
    linkSagaDefinitions: true,
  })

  return ok(c, {
    generatedCount: generated.length,
    syncedCount: synced.length,
    loopSynced,
    generated,
  })
})

sagaRoutes.post('/sagas/specs/sync', requireAuth, async (c) => {
  const user = getCurrentUser(c)
  if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)
  const synced = await syncSagaDefinitionsFromDisk(user.id)
  const loopSynced = await syncSagaLoopLibraryFromDocs({
    actorUserId: user.id,
    linkSagaDefinitions: true,
  })
  return ok(c, {
    syncedCount: synced.length,
    loopSynced,
    synced,
  })
})

/**
 * Replace/update one saga definition's canonical DB spec payload.
 */
sagaRoutes.put('/sagas/specs/:sagaKey', requireAuth, async (c) => {
  const user = getCurrentUser(c)
  if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)

  const sagaKey = c.req.param('sagaKey')
  const existing = await getSagaDefinitionByKey(sagaKey)
  if (!existing) return fail(c, 'NOT_FOUND', 'Saga definition not found.', 404)

  const body = await c.req.json().catch(() => null)
  const parsed = upsertSpecBodySchema.safeParse(body)
  if (!parsed.success) {
    return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  }

  const specParsed = sagaSpecSchema.safeParse(parsed.data.spec)
  if (!specParsed.success) {
    return fail(c, 'VALIDATION_ERROR', 'Invalid saga spec payload.', 400, specParsed.error.flatten())
  }

  const saved = await upsertSagaDefinitionSpec({
    sagaKey,
    spec: specParsed.data,
    actorUserId: user.id,
    bizId: parsed.data.bizId ?? existing.bizId ?? null,
    status: parsed.data.status ?? existing.status,
    metadata: parsed.data.metadata,
    sourceFilePath: parsed.data.sourceFilePath ?? existing.specFilePath,
    forceRevision: parsed.data.forceRevision ?? false,
    revisionMetadata: parsed.data.revisionMetadata,
  })

  return ok(c, saved)
})

/**
 * Force-create one new revision for an existing saga definition.
 */
sagaRoutes.post('/sagas/specs/:sagaKey/revisions', requireAuth, async (c) => {
  const user = getCurrentUser(c)
  if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)

  const sagaKey = c.req.param('sagaKey')
  const existing = await getSagaDefinitionByKey(sagaKey)
  if (!existing) return fail(c, 'NOT_FOUND', 'Saga definition not found.', 404)

  const body = await c.req.json().catch(() => null)
  const parsed = upsertSpecBodySchema.safeParse(body)
  if (!parsed.success) {
    return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  }

  const specParsed = sagaSpecSchema.safeParse(parsed.data.spec)
  if (!specParsed.success) {
    return fail(c, 'VALIDATION_ERROR', 'Invalid saga spec payload.', 400, specParsed.error.flatten())
  }

  const saved = await upsertSagaDefinitionSpec({
    sagaKey,
    spec: specParsed.data,
    actorUserId: user.id,
    bizId: parsed.data.bizId ?? existing.bizId ?? null,
    status: parsed.data.status ?? existing.status,
    metadata: parsed.data.metadata,
    sourceFilePath: parsed.data.sourceFilePath ?? existing.specFilePath,
    forceRevision: true,
    revisionMetadata: {
      ...(parsed.data.revisionMetadata ?? {}),
      source: 'api.createSagaSpecRevision',
    },
  })

  return ok(c, saved, 201)
})

sagaRoutes.get('/sagas/specs/:sagaKey/revisions', requireAuth, async (c) => {
  const user = getCurrentUser(c)
  if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)

  const sagaKey = c.req.param('sagaKey')
  const parsed = listSpecRevisionsQuerySchema.safeParse(c.req.query())
  if (!parsed.success) {
    return fail(c, 'VALIDATION_ERROR', 'Invalid query parameters.', 400, parsed.error.flatten())
  }

  const detail = await listSagaDefinitionRevisions({
    sagaKey,
    limit: Math.min(parsePositiveInt(parsed.data.limit, 100), 500),
  })
  if (!detail) return fail(c, 'NOT_FOUND', 'Saga definition not found.', 404)
  return ok(c, detail)
})

sagaRoutes.delete('/sagas/specs/:sagaKey', requireAuth, async (c) => {
  const user = getCurrentUser(c)
  if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)
  const sagaKey = c.req.param('sagaKey')
  const archived = await deleteSagaDefinitionByKey({
    sagaKey,
    actorUserId: user.id,
  })
  if (!archived) return fail(c, 'NOT_FOUND', 'Saga definition not found.', 404)
  return ok(c, archived)
})

sagaRoutes.get('/sagas/specs/:sagaKey', requireAuth, async (c) => {
  const user = getCurrentUser(c)
  if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)

  const sagaKey = c.req.param('sagaKey')
  const resolved = await getSagaDefinitionWithSpec(sagaKey)
  if (!resolved) return fail(c, 'NOT_FOUND', 'Saga definition not found.', 404)

  return ok(c, resolved)
})

sagaRoutes.post('/sagas/runs', requireAuth, async (c) => {
  const user = getCurrentUser(c)
  if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)

  const body = await c.req.json().catch(() => null)
  const parsed = createRunBodySchema.safeParse(body)
  if (!parsed.success) {
    return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  }

  if (parsed.data.bizId) {
    const membership = await ensureBizMembership(user.id, parsed.data.bizId)
    if (!membership) {
      return fail(c, 'FORBIDDEN', 'You are not a member of this biz.', 403)
    }
  }

  const created = await createSagaRun({
    sagaKey: parsed.data.sagaKey,
    requestedByUserId: user.id,
    bizId: parsed.data.bizId,
    mode: parsed.data.mode,
    runnerLabel: parsed.data.runnerLabel,
    runContext: parsed.data.runContext,
  })
  return ok(c, created, 201)
})

sagaRoutes.get('/sagas/runs', requireAuth, async (c) => {
  const user = getCurrentUser(c)
  if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)

  const parsed = listRunsQuerySchema.safeParse(c.req.query())
  if (!parsed.success) {
    return fail(c, 'VALIDATION_ERROR', 'Invalid query parameters.', 400, parsed.error.flatten())
  }

  const wantsAllRuns = parsed.data.mineOnly === 'false'
  if (wantsAllRuns && !isPlatformAdmin(user)) {
    return fail(c, 'FORBIDDEN', 'Platform admin role required for mineOnly=false.', 403)
  }

  const runs = await listSagaRuns({
    sagaKey: parsed.data.sagaKey,
    status: parsed.data.status,
    limit: Math.min(parsePositiveInt(parsed.data.limit, 50), 200),
    requestedByUserId: wantsAllRuns ? undefined : user.id,
    includeArchived: parsed.data.includeArchived === 'true',
  })

  const openRunIds = runs
    .filter((run) => run.status === 'pending' || run.status === 'running')
    .map((run) => run.id)

  if (openRunIds.length > 0) {
    await Promise.all(
      openRunIds.map((runId) =>
        refreshSagaRunStatus(runId, user.id, { touchHeartbeat: false, emitEvent: false }),
      ),
    )
  }

  const refreshedRuns = openRunIds.length
    ? await listSagaRuns({
        sagaKey: parsed.data.sagaKey,
        status: parsed.data.status,
        limit: Math.min(parsePositiveInt(parsed.data.limit, 50), 200),
        requestedByUserId: wantsAllRuns ? undefined : user.id,
        includeArchived: parsed.data.includeArchived === 'true',
      })
    : runs

  return ok(c, refreshedRuns)
})

sagaRoutes.get('/sagas/runs/:runId', requireAuth, async (c) => {
  const user = getCurrentUser(c)
  if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)

  const runId = c.req.param('runId')
  const access = await canAccessRun(user, runId)
  if (!access.allowed) {
    return fail(
      c,
      access.code ?? 'FORBIDDEN',
      access.reason ?? 'Forbidden',
      access.code === 'NOT_FOUND' ? 404 : 403,
    )
  }

  const detail = await getSagaRunDetail(runId)
  if (!detail) return fail(c, 'NOT_FOUND', 'Run not found.', 404)

  if (detail.run.status === 'pending' || detail.run.status === 'running') {
    await refreshSagaRunStatus(runId, user.id, { touchHeartbeat: false, emitEvent: false })
  }

  const refreshedDetail = await getSagaRunDetail(runId)
  if (!refreshedDetail) return fail(c, 'NOT_FOUND', 'Run not found.', 404)
  return ok(c, refreshedDetail)
})

/**
 * Execute one already-created run immediately using deterministic runner logic.
 *
 * Why this exists:
 * - Dashboard "rerun" used to only create pending rows.
 * - This endpoint runs steps server-side so reruns transition out of pending.
 */
sagaRoutes.post('/sagas/runs/:runId/execute', requireAuth, async (c) => {
  const user = getCurrentUser(c)
  if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)

  const runId = c.req.param('runId')
  const access = await canAccessRun(user, runId)
  if (!access.allowed) {
    return fail(
      c,
      access.code ?? 'FORBIDDEN',
      access.reason ?? 'Forbidden',
      access.code === 'NOT_FOUND' ? 404 : 403,
    )
  }

  const detail = await getSagaRunDetail(runId)
  if (!detail) return fail(c, 'NOT_FOUND', 'Run not found.', 404)
  if (detail.run.status === 'passed' || detail.run.status === 'failed' || detail.run.status === 'cancelled') {
    return fail(c, 'CONFLICT', `Run is already terminal (${detail.run.status}).`, 409)
  }

  const cookie = c.req.header('cookie')
  if (!cookie) {
    return fail(c, 'UNAUTHORIZED', 'Session cookie is required to execute run.', 401)
  }

  const ownerSession = {
    email: user.email ?? `user-${user.id}@session.local`,
    password: '',
    userId: user.id,
    cookie,
  }

  const execution = await executeExistingSagaRun({
    runId,
    sagaKey: detail.run.sagaKey,
    bizId: detail.run.bizId,
    owner: ownerSession,
  })

  const refreshed = await getSagaRunDetail(runId)
  if (!refreshed) return fail(c, 'NOT_FOUND', 'Run not found after execution.', 404)

  return ok(c, {
    runId,
    success: execution.ok,
    failures: execution.failures,
    run: refreshed.run,
  })
})

sagaRoutes.get('/sagas/runs/:runId/actors', requireAuth, async (c) => {
  const user = getCurrentUser(c)
  if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)

  const runId = c.req.param('runId')
  const access = await canAccessRun(user, runId)
  if (!access.allowed) {
    return fail(
      c,
      access.code ?? 'FORBIDDEN',
      access.reason ?? 'Forbidden',
      access.code === 'NOT_FOUND' ? 404 : 403,
    )
  }

  const rows = await listSagaRunActorProfiles(runId)
  return ok(c, rows)
})

sagaRoutes.get('/sagas/runs/:runId/messages', requireAuth, async (c) => {
  const user = getCurrentUser(c)
  if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)

  const runId = c.req.param('runId')
  const access = await canAccessRun(user, runId)
  if (!access.allowed) {
    return fail(
      c,
      access.code ?? 'FORBIDDEN',
      access.reason ?? 'Forbidden',
      access.code === 'NOT_FOUND' ? 404 : 403,
    )
  }

  const parsed = listRunMessagesQuerySchema.safeParse(c.req.query())
  if (!parsed.success) {
    return fail(c, 'VALIDATION_ERROR', 'Invalid query parameters.', 400, parsed.error.flatten())
  }

  const rows = await listSagaRunActorMessages(runId, parsed.data.actorKey)
  return ok(c, rows)
})

sagaRoutes.post('/sagas/runs/:runId/messages', requireAuth, async (c) => {
  const user = getCurrentUser(c)
  if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)

  const runId = c.req.param('runId')
  const access = await canAccessRun(user, runId)
  if (!access.allowed) {
    return fail(
      c,
      access.code ?? 'FORBIDDEN',
      access.reason ?? 'Forbidden',
      access.code === 'NOT_FOUND' ? 404 : 403,
    )
  }

  const body = await c.req.json().catch(() => null)
  const parsed = createRunMessageBodySchema.safeParse(body)
  if (!parsed.success) {
    return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  }

  const row = await createSagaRunActorMessage({
    runId,
    actorUserId: user.id,
    ...parsed.data,
  })
  return ok(c, row, 201)
})

sagaRoutes.get('/sagas/runs/:runId/coverage', requireAuth, async (c) => {
  const user = getCurrentUser(c)
  if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)

  const runId = c.req.param('runId')
  const access = await canAccessRun(user, runId)
  if (!access.allowed) {
    return fail(
      c,
      access.code ?? 'FORBIDDEN',
      access.reason ?? 'Forbidden',
      access.code === 'NOT_FOUND' ? 404 : 403,
    )
  }

  await refreshSagaRunStatus(runId, user.id, { touchHeartbeat: false, emitEvent: false })
  const detail = await getSagaRunDetail(runId)
  if (!detail) return fail(c, 'NOT_FOUND', 'Run not found.', 404)

  const runSummary =
    typeof detail.run.runSummary === 'object' && detail.run.runSummary
      ? (detail.run.runSummary as Record<string, unknown>)
      : {}

  return ok(c, {
    runId: detail.run.id,
    sagaKey: detail.run.sagaKey,
    status: detail.run.status,
    coverage: runSummary.coverage ?? null,
    failures: runSummary.failures ?? [],
    missingEvidence: runSummary.missingEvidence ?? [],
  })
})

sagaRoutes.post('/sagas/runs/:runId/archive', requireAuth, async (c) => {
  const user = getCurrentUser(c)
  if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)

  const runId = c.req.param('runId')
  const access = await canAccessRun(user, runId)
  if (!access.allowed) {
    return fail(
      c,
      access.code ?? 'FORBIDDEN',
      access.reason ?? 'Forbidden',
      access.code === 'NOT_FOUND' ? 404 : 403,
    )
  }

  const archivedRunIds = await archiveSagaRuns({
    runIds: [runId],
    actorUserId: user.id,
  })

  return ok(c, {
    runId,
    archived: archivedRunIds.includes(runId),
  })
})

sagaRoutes.post('/sagas/runs/archive', requireAuth, async (c) => {
  const user = getCurrentUser(c)
  if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)

  const body = await c.req.json().catch(() => null)
  const parsed = archiveRunBodySchema.safeParse(body)
  if (!parsed.success) {
    return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  }

  const runIds = Array.from(new Set(parsed.data.runIds))
  const allowedRunIds: string[] = []
  const blocked: Array<{ runId: string; reason: string }> = []

  for (const runId of runIds) {
    const access = await canAccessRun(user, runId)
    if (!access.allowed) {
      blocked.push({ runId, reason: access.reason ?? access.code ?? 'FORBIDDEN' })
      continue
    }
    allowedRunIds.push(runId)
  }

  if (allowedRunIds.length === 0) {
    return fail(c, 'FORBIDDEN', 'No requested runs are accessible for archive.', 403, {
      blocked,
    })
  }

  const archivedRunIds = await archiveSagaRuns({
    runIds: allowedRunIds,
    actorUserId: user.id,
  })

  return ok(c, {
    requestedCount: runIds.length,
    accessibleCount: allowedRunIds.length,
    archivedCount: archivedRunIds.length,
    alreadyArchivedCount: allowedRunIds.length - archivedRunIds.length,
    archivedRunIds,
    blocked,
  })
})

sagaRoutes.post('/sagas/runs/:runId/steps/:stepKey/result', requireAuth, async (c) => {
  const user = getCurrentUser(c)
  if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)

  const runId = c.req.param('runId')
  const stepKey = c.req.param('stepKey')
  const access = await canAccessRun(user, runId)
  if (!access.allowed) {
    return fail(
      c,
      access.code ?? 'FORBIDDEN',
      access.reason ?? 'Forbidden',
      access.code === 'NOT_FOUND' ? 404 : 403,
    )
  }

  const body = await c.req.json().catch(() => null)
  const parsed = updateStepBodySchema.safeParse(body)
  if (!parsed.success) {
    return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  }

  try {
    const updated = await updateSagaRunStep(runId, stepKey, {
      ...parsed.data,
      startedAt: parsed.data.startedAt ? new Date(parsed.data.startedAt) : undefined,
      endedAt: parsed.data.endedAt ? new Date(parsed.data.endedAt) : undefined,
      actorUserId: user.id,
    })

    return ok(c, updated)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update saga step.'
    const notFound = message.includes('not found')
    return fail(
      c,
      notFound ? 'NOT_FOUND' : 'VALIDATION_ERROR',
      message,
      notFound ? 404 : 400,
    )
  }
})

sagaRoutes.post('/sagas/runs/:runId/steps/:stepKey/exploratory-evaluate', requireAuth, async (c) => {
  const user = getCurrentUser(c)
  if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)

  const runId = c.req.param('runId')
  const stepKey = c.req.param('stepKey')
  const access = await canAccessRun(user, runId)
  if (!access.allowed) {
    return fail(
      c,
      access.code ?? 'FORBIDDEN',
      access.reason ?? 'Forbidden',
      access.code === 'NOT_FOUND' ? 404 : 403,
    )
  }

  const body = await c.req.json().catch(() => null)
  const parsed = exploratoryEvaluateBodySchema.safeParse(body ?? {})
  if (!parsed.success) {
    return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  }

  const inferredFamily: ExploratoryStepFamily = stepKey.startsWith('persona-scenario-validate-')
    ? 'persona-scenario-validation'
    : 'uc-need-validation'

  const evaluation = await evaluateExploratorySagaStep({
    runId,
    stepKey,
    stepFamily: parsed.data.stepFamily ?? inferredFamily,
  })

  return ok(c, evaluation)
})

sagaRoutes.post('/sagas/runs/:runId/snapshots', requireAuth, async (c) => {
  const user = getCurrentUser(c)
  if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)

  const runId = c.req.param('runId')
  const access = await canAccessRun(user, runId)
  if (!access.allowed) {
    return fail(
      c,
      access.code ?? 'FORBIDDEN',
      access.reason ?? 'Forbidden',
      access.code === 'NOT_FOUND' ? 404 : 403,
    )
  }

  const body = await c.req.json().catch(() => null)
  const parsed = pseudoShotInputSchema.safeParse(body)
  if (!parsed.success) {
    return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  }

  const normalized = normalizeSnapshotInput(parsed.data)

  const artifact = await saveSagaSnapshot({
    runId,
    actorUserId: user.id,
    stepKey: normalized.stepKey,
    format: parsed.data.format,
    document: normalized,
    metadata: {
      sourceFormat: parsed.data.view ? 'v1' : 'legacy',
      ...(parsed.data.metadata ?? {}),
    },
  })

  await refreshSagaRunStatus(runId, user.id, { touchHeartbeat: true })

  return ok(c, artifact, 201)
})

sagaRoutes.post('/sagas/runs/:runId/report', requireAuth, async (c) => {
  const user = getCurrentUser(c)
  if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)

  const runId = c.req.param('runId')
  const access = await canAccessRun(user, runId)
  if (!access.allowed) {
    return fail(
      c,
      access.code ?? 'FORBIDDEN',
      access.reason ?? 'Forbidden',
      access.code === 'NOT_FOUND' ? 404 : 403,
    )
  }

  const body = await c.req.json().catch(() => null)
  const parsed = saveReportBodySchema.safeParse(body)
  if (!parsed.success) {
    return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  }

  const artifact = await saveSagaReport({
    runId,
    actorUserId: user.id,
    markdown: parsed.data.markdown,
    summary: parsed.data.summary,
    metadata: parsed.data.metadata,
  })

  await refreshSagaRunStatus(runId, user.id)
  return ok(c, artifact, 201)
})

sagaRoutes.post('/sagas/runs/:runId/traces', requireAuth, async (c) => {
  const user = getCurrentUser(c)
  if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)

  const runId = c.req.param('runId')
  const access = await canAccessRun(user, runId)
  if (!access.allowed) {
    return fail(
      c,
      access.code ?? 'FORBIDDEN',
      access.reason ?? 'Forbidden',
      access.code === 'NOT_FOUND' ? 404 : 403,
    )
  }

  const body = await c.req.json().catch(() => null)
  const parsed = saveTraceBodySchema.safeParse(body)
  if (!parsed.success) {
    return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  }

  const serializedTrace = `${JSON.stringify(parsed.data.trace ?? {}, null, 2)}\n`
  const title = parsed.data.title ?? 'API Trace'
  const artifact = await saveSagaArtifact({
    runId,
    actorUserId: user.id,
    artifactType: 'api_trace',
    title,
    stepKey: parsed.data.stepKey,
    fileName: `artifacts/${Date.now()}-${title.replace(/[^a-zA-Z0-9_.-]/g, '_')}.json`,
    contentType: 'application/json',
    body: serializedTrace,
    metadata: parsed.data.metadata ?? {},
  })

  await refreshSagaRunStatus(runId, user.id, { touchHeartbeat: true })

  return ok(c, artifact, 201)
})

sagaRoutes.get('/sagas/runs/:runId/artifacts/:artifactId/content', requireAuth, async (c) => {
  const user = getCurrentUser(c)
  if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)

  const runId = c.req.param('runId')
  const artifactId = c.req.param('artifactId')
  const access = await canAccessRun(user, runId)
  if (!access.allowed) {
    return fail(
      c,
      access.code ?? 'FORBIDDEN',
      access.reason ?? 'Forbidden',
      access.code === 'NOT_FOUND' ? 404 : 403,
    )
  }

  const artifact = await db.query.sagaRunArtifacts.findFirst({
    where: and(eq(sagaRunArtifacts.id, artifactId), eq(sagaRunArtifacts.sagaRunId, runId)),
  })
  if (!artifact) return fail(c, 'NOT_FOUND', 'Artifact not found.', 404)

  const [payload] = await readArtifactsContent([artifact.id])
  return ok(c, payload ?? null)
})

sagaRoutes.get('/sagas/runs/:runId/test-mode', requireAuth, async (c) => {
  const user = getCurrentUser(c)
  if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)

  const runId = c.req.param('runId')
  const access = await canAccessRun(user, runId)
  if (!access.allowed) {
    return fail(
      c,
      access.code ?? 'FORBIDDEN',
      access.reason ?? 'Forbidden',
      access.code === 'NOT_FOUND' ? 404 : 403,
    )
  }

  const state = await getSagaTestModeState(runId)
  if (!state) return fail(c, 'NOT_FOUND', 'Run not found.', 404)

  if (state.run.status === 'pending' || state.run.status === 'running') {
    await refreshSagaRunStatus(runId, user.id, { touchHeartbeat: false, emitEvent: false })
  }

  const refreshedState = await getSagaTestModeState(runId)
  if (!refreshedState) return fail(c, 'NOT_FOUND', 'Run not found.', 404)
  return ok(c, refreshedState)
})

sagaRoutes.get('/sagas/test-mode/next', requireAuth, async (c) => {
  const user = getCurrentUser(c)
  if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)

  const parsed = testModeQuerySchema.safeParse(c.req.query())
  if (!parsed.success) {
    return fail(c, 'VALIDATION_ERROR', 'Invalid query parameters.', 400, parsed.error.flatten())
  }

  let runId = parsed.data.runId
  if (!runId) {
    if (!parsed.data.sagaKey) {
      return fail(c, 'BAD_REQUEST', 'Provide runId or sagaKey.', 400)
    }

    const existingRun = await db.query.sagaRuns.findFirst({
      where: and(
        eq(sagaRuns.sagaKey, parsed.data.sagaKey),
        eq(sagaRuns.requestedByUserId, user.id),
        sql`deleted_at IS NULL`,
      ),
      orderBy: [desc(sagaRuns.id)],
    })

    if (existingRun && (existingRun.status === 'pending' || existingRun.status === 'running')) {
      runId = existingRun.id
    } else {
      if (parsed.data.bizId) {
        const membership = await ensureBizMembership(user.id, parsed.data.bizId)
        if (!membership) return fail(c, 'FORBIDDEN', 'You are not a member of this biz.', 403)
      }

      const created = await createSagaRun({
        sagaKey: parsed.data.sagaKey,
        requestedByUserId: user.id,
        bizId: parsed.data.bizId,
        mode: 'dry_run',
        runnerLabel: 'test-mode-auto-run',
        runContext: {
          createdFrom: 'test-mode-next',
        },
      })
      runId = created?.run?.id
    }
  }

  if (!runId) {
    return fail(c, 'NOT_FOUND', 'No run resolved for test mode.', 404)
  }

  const access = await canAccessRun(user, runId)
  if (!access.allowed) {
    return fail(
      c,
      access.code ?? 'FORBIDDEN',
      access.reason ?? 'Forbidden',
      access.code === 'NOT_FOUND' ? 404 : 403,
    )
  }

  const state = await getSagaTestModeState(runId)
  if (!state) return fail(c, 'NOT_FOUND', 'Run not found.', 404)
  return ok(c, state)
})
