import { createHash } from 'node:crypto'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm'
import dbPackage from '@bizing/db'
import { sagaSpecSchema, type SagaSpec } from '../sagas/spec-schema.js'
import type { SnapshotDocument } from '../sagas/snapshot-schema.js'
import { publishSagaRuntimeEvent } from './saga-events.js'

const { db } = dbPackage
const sagaDefinitions = dbPackage.sagaDefinitions
const sagaDefinitionRevisions = dbPackage.sagaDefinitionRevisions
const sagaRuns = dbPackage.sagaRuns
const sagaRunSteps = dbPackage.sagaRunSteps
const sagaRunArtifacts = dbPackage.sagaRunArtifacts
const sagaRunActorProfiles = dbPackage.sagaRunActorProfiles
const sagaRunActorMessages = dbPackage.sagaRunActorMessages
const sagaUseCases = dbPackage.sagaUseCases
const sagaUseCaseVersions = dbPackage.sagaUseCaseVersions
const sagaPersonas = dbPackage.sagaPersonas
const sagaPersonaVersions = dbPackage.sagaPersonaVersions
const sagaDefinitionLinks = dbPackage.sagaDefinitionLinks
const sagaCoverageReports = dbPackage.sagaCoverageReports
const sagaCoverageItems = dbPackage.sagaCoverageItems
const sagaTags = dbPackage.sagaTags
const sagaTagBindings = dbPackage.sagaTagBindings

/**
 * Project root where saga artifacts/specs must live.
 *
 * Important:
 * - This intentionally lives under `/Users/ameer/bizing/code/...` as requested.
 */
const PROJECT_ROOT = path.resolve(process.cwd(), '..', '..')
const DEFAULT_SAGA_BASE_DIR = path.join(PROJECT_ROOT, 'testing', 'sagas')

export const SAGA_BASE_DIR = process.env.SAGA_BASE_DIR || DEFAULT_SAGA_BASE_DIR
export const SAGA_SPECS_DIR = path.join(SAGA_BASE_DIR, 'specs')
export const SAGA_RUNS_DIR = path.join(SAGA_BASE_DIR, 'runs')
export const SAGA_REPORTS_DIR = path.join(SAGA_BASE_DIR, 'reports')
export const SAGA_DOCS_DIR = path.join(SAGA_BASE_DIR, 'docs')

/**
 * Canonical UC/persona source docs used by generator defaults.
 */
export const DEFAULT_USE_CASES_FILE = path.resolve(
  PROJECT_ROOT,
  '..',
  'mind',
  'workspace',
  'documentation',
  'use-cases-comprehensive.md',
)
export const DEFAULT_PERSONAS_FILE = path.resolve(
  PROJECT_ROOT,
  '..',
  'mind',
  'workspace',
  'documentation',
  'tester-personas.md',
)
export const DEFAULT_SCHEMA_COVERAGE_FILE = path.resolve(
  PROJECT_ROOT,
  '..',
  'mind',
  'workspaces',
  'schema coverage report.md',
)

type UseCaseDocEntry = {
  ucRef: string
  title: string
  section?: string
  needs: string[]
  scenario: string
  rawMarkdown: string
}

type PersonaDocEntry = {
  personaRef: string
  name: string
  profile?: string
  goals?: string
  painPoints?: string
  testScenarios: string[]
  rawMarkdown: string
}

type SchemaCoverageUseCaseEntry = {
  ucRef: string
  ucTitle: string
  sourceLink: string
  verdictTag: "#full" | "#strong" | "#partial" | "#gap"
  explanation: string
  nativeToHackyTag:
    | "#native"
    | "#mostly-native"
    | "#mixed-model"
    | "#workaround-heavy"
    | "#hacky"
  coreToExtensionTag:
    | "#core-centric"
    | "#core-first"
    | "#balanced-core-extension"
    | "#extension-heavy"
    | "#extension-driven"
}

type ParsedSchemaCoverageReport = {
  title: string
  markdown: string
  sourceFilePath: string
  sourceChecksum: string
  totalUseCases: number
  summaryCounts: {
    full: number
    strong: number
    partial: number
    gap: number
  }
  scaleSummary: {
    avgN2h?: number
    avgC2e?: number
    n2hDistribution: Record<string, number>
    c2eDistribution: Record<string, number>
    semanticTotals: Record<string, number>
  }
  useCases: SchemaCoverageUseCaseEntry[]
}

type GenerateSagaSpecsOptions = {
  useCaseFile?: string
  personaFile?: string
  useCaseRefs?: string[]
  personaRefs?: string[]
  limitUseCases?: number
  maxPersonasPerUseCase?: number
  overwrite?: boolean
}

type GeneratedSagaFile = {
  sagaKey: string
  title: string
  filePath: string
  useCaseRef?: string
  personaRef?: string
}

type CreateSagaRunInput = {
  sagaKey: string
  requestedByUserId: string
  bizId?: string
  mode?: 'dry_run' | 'live'
  runnerLabel?: string
  runContext?: Record<string, unknown>
}

type UpdateSagaStepInput = {
  status: 'pending' | 'in_progress' | 'passed' | 'failed' | 'skipped' | 'blocked'
  startedAt?: Date
  endedAt?: Date
  failureCode?: string | null
  failureMessage?: string | null
  resultPayload?: Record<string, unknown>
  assertionSummary?: Record<string, unknown>
  metadata?: Record<string, unknown>
  actorUserId: string
}

const STEP_TERMINAL_STATUSES = new Set(['passed', 'failed', 'skipped', 'blocked'])

const STEP_STATUS_TRANSITIONS: Record<
  UpdateSagaStepInput['status'],
  Array<UpdateSagaStepInput['status']>
> = {
  pending: ['in_progress', 'failed', 'skipped', 'blocked'],
  in_progress: ['passed', 'failed', 'skipped', 'blocked'],
  passed: [],
  failed: [],
  skipped: [],
  blocked: [],
}

function canTransitionStepStatus(
  from: UpdateSagaStepInput['status'],
  to: UpdateSagaStepInput['status'],
) {
  if (from === to) return true
  const allowed = STEP_STATUS_TRANSITIONS[from] ?? []
  return allowed.includes(to)
}

type SaveArtifactInput = {
  runId: string
  actorUserId: string
  artifactType: 'report' | 'snapshot' | 'api_trace' | 'step_log' | 'attachment'
  title: string
  stepKey?: string
  fileName: string
  contentType: string
  body: string
  metadata?: Record<string, unknown>
}

type SaveSnapshotInput = {
  runId: string
  actorUserId: string
  stepKey?: string
  format?: 'json' | 'yaml'
  document: SnapshotDocument
  metadata?: Record<string, unknown>
}

type SaveReportInput = {
  runId: string
  actorUserId: string
  markdown: string
  summary?: Record<string, unknown>
  metadata?: Record<string, unknown>
}

type RefreshSagaRunStatusOptions = {
  /**
   * When true, refresh updates `lastHeartbeatAt` to now.
   *
   * Use `false` for read-only refreshes (list/detail views) so merely viewing
   * a run does not keep it alive forever.
   */
  touchHeartbeat?: boolean
  /**
   * When false, suppress websocket runtime events.
   *
   * ELI5:
   * This is for read-only refresh calls (dashboard list/detail fetches).
   * Without this switch, every read would emit "run.updated", the UI would
   * react by reloading again, and we get an infinite refresh loop.
   */
  emitEvent?: boolean
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function checksum(content: string): string {
  return createHash('sha256').update(content).digest('hex')
}

function isMissingRelationError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return /relation\s+".*"\s+does not exist/i.test(message)
}

function toProjectRelative(absPath: string): string {
  return path.relative(PROJECT_ROOT, absPath).replaceAll('\\', '/')
}

function fromProjectRelative(relativePath: string): string {
  return path.resolve(PROJECT_ROOT, relativePath)
}

async function exists(absPath: string): Promise<boolean> {
  try {
    await fs.access(absPath)
    return true
  } catch {
    return false
  }
}

/**
 * Ensure saga directories exist before any read/write operation.
 */
export async function ensureSagaFilesystem() {
  await Promise.all([
    fs.mkdir(SAGA_BASE_DIR, { recursive: true }),
    fs.mkdir(SAGA_SPECS_DIR, { recursive: true }),
    fs.mkdir(SAGA_RUNS_DIR, { recursive: true }),
    fs.mkdir(SAGA_REPORTS_DIR, { recursive: true }),
    fs.mkdir(SAGA_DOCS_DIR, { recursive: true }),
  ])
}

/**
 * Parse use-case headings from markdown.
 */
export async function parseUseCasesFromMarkdown(filePath = DEFAULT_USE_CASES_FILE) {
  const content = await fs.readFile(filePath, 'utf8')
  const lines = content.split(/\r?\n/)
  const headingIndexes: Array<{ index: number; ucRef: string; title: string }> = []

  for (let i = 0; i < lines.length; i += 1) {
    const match = lines[i]?.match(/^###\s+(UC-\d+):\s+(.+)$/)
    if (!match) continue
    headingIndexes.push({
      index: i,
      ucRef: match[1],
      title: match[2].trim(),
    })
  }

  const entries: UseCaseDocEntry[] = []
  for (let i = 0; i < headingIndexes.length; i += 1) {
    const current = headingIndexes[i]
    const nextIndex = headingIndexes[i + 1]?.index ?? lines.length
    const block = lines.slice(current.index, nextIndex)
    const rawMarkdown = block.join('\n').trim()

    const needs: string[] = []
    let scenario = ''
    let inNeeds = false

    for (let j = 0; j < block.length; j += 1) {
      const line = block[j]?.trim() ?? ''
      if (/^\*\*Needs:\*\*/.test(line)) {
        inNeeds = true
        continue
      }
      if (/^\*\*Scenario:\*\*/.test(line)) {
        scenario = line.replace(/^\*\*Scenario:\*\*\s*/, '').trim()
        inNeeds = false
        continue
      }
      if (inNeeds && line.startsWith('- ')) {
        needs.push(line.slice(2).trim())
      }
    }

    entries.push({
      ucRef: current.ucRef,
      title: current.title,
      needs,
      scenario,
      rawMarkdown,
    })
  }

  return entries
}

/**
 * Parse persona headings from markdown.
 */
export async function parsePersonasFromMarkdown(filePath = DEFAULT_PERSONAS_FILE) {
  const content = await fs.readFile(filePath, 'utf8')
  const lines = content.split(/\r?\n/)
  const headingIndexes: Array<{ index: number; personaRef: string; name: string }> = []

  for (let i = 0; i < lines.length; i += 1) {
    const match = lines[i]?.match(/^###\s+(\d+)\.\s+(.+)$/)
    if (!match) continue
    headingIndexes.push({
      index: i,
      personaRef: `P-${match[1]}`,
      name: match[2].trim(),
    })
  }

  const entries: PersonaDocEntry[] = []
  for (let i = 0; i < headingIndexes.length; i += 1) {
    const current = headingIndexes[i]
    const nextIndex = headingIndexes[i + 1]?.index ?? lines.length
    const block = lines.slice(current.index, nextIndex)
    const rawMarkdown = block.join('\n').trim()

    let profile = ''
    let goals = ''
    let painPoints = ''
    const testScenarios: string[] = []
    let inTests = false

    for (const rawLine of block) {
      const line = rawLine.trim()
      if (line.startsWith('**Profile:**')) {
        profile = line.replace('**Profile:**', '').trim()
        inTests = false
        continue
      }
      if (line.startsWith('- **Goals:**')) {
        goals = line.replace('- **Goals:**', '').trim()
        inTests = false
        continue
      }
      if (line.startsWith('- **Pain points:**')) {
        painPoints = line.replace('- **Pain points:**', '').trim()
        inTests = false
        continue
      }
      if (line.startsWith('- **Test scenarios:**')) {
        inTests = true
        continue
      }
      if (inTests && line.startsWith('- ')) {
        testScenarios.push(line.slice(2).trim())
      }
    }

    entries.push({
      personaRef: current.personaRef,
      name: current.name,
      profile,
      goals,
      painPoints,
      testScenarios,
      rawMarkdown,
    })
  }

  return entries
}

const N2H_SCORE_BY_TAG: Record<SchemaCoverageUseCaseEntry["nativeToHackyTag"], number> = {
  "#native": 5,
  "#mostly-native": 4,
  "#mixed-model": 3,
  "#workaround-heavy": 2,
  "#hacky": 1,
}

const C2E_SCORE_BY_TAG: Record<SchemaCoverageUseCaseEntry["coreToExtensionTag"], number> = {
  "#core-centric": 5,
  "#core-first": 4,
  "#balanced-core-extension": 3,
  "#extension-heavy": 2,
  "#extension-driven": 1,
}

function toCoverageVerdictTag(
  value: string,
): SchemaCoverageUseCaseEntry["verdictTag"] | null {
  const normalized = value.trim().toLowerCase()
  if (normalized === "#full") return "#full"
  if (normalized === "#strong") return "#strong"
  if (normalized === "#partial") return "#partial"
  if (normalized === "#gap") return "#gap"
  return null
}

function toNativeToHackyTag(
  value: string,
): SchemaCoverageUseCaseEntry["nativeToHackyTag"] | null {
  const normalized = value.trim().toLowerCase()
  if (
    normalized === "#native" ||
    normalized === "#mostly-native" ||
    normalized === "#mixed-model" ||
    normalized === "#workaround-heavy" ||
    normalized === "#hacky"
  ) {
    return normalized
  }
  return null
}

function toCoreToExtensionTag(
  value: string,
): SchemaCoverageUseCaseEntry["coreToExtensionTag"] | null {
  const normalized = value.trim().toLowerCase()
  if (
    normalized === "#core-centric" ||
    normalized === "#core-first" ||
    normalized === "#balanced-core-extension" ||
    normalized === "#extension-heavy" ||
    normalized === "#extension-driven"
  ) {
    return normalized
  }
  return null
}

/**
 * Parse canonical schema coverage markdown into structured rows.
 *
 * ELI5:
 * This reads the long human report and turns every `UC-x` bullet into one
 * normalized DB item with verdict + N2H + C2E tags.
 */
export async function parseSchemaCoverageReportFromMarkdown(
  filePath = DEFAULT_SCHEMA_COVERAGE_FILE,
): Promise<ParsedSchemaCoverageReport> {
  const markdown = await fs.readFile(filePath, "utf8")
  const lines = markdown.split(/\r?\n/)
  const title =
    lines.find((line) => /^#\s+/.test(line.trim()))?.replace(/^#\s+/, "").trim() ??
    "Schema Coverage Report"

  const useCases: SchemaCoverageUseCaseEntry[] = []
  const summaryCounts: ParsedSchemaCoverageReport["summaryCounts"] = {
    full: 0,
    strong: 0,
    partial: 0,
    gap: 0,
  }
  const n2hDistribution: Record<string, number> = {}
  const c2eDistribution: Record<string, number> = {}
  const semanticTotals: Record<string, number> = {}
  let avgN2h: number | undefined
  let avgC2e: number | undefined
  let totalUseCases = 0

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed.startsWith("- [[") || !trimmed.includes("| #")) continue

    const match = trimmed.match(
      /^-\s+\[\[(?<sourceLink>[^\]|]+)(?:\|(?<alias>UC-\d+))?\]\]\s+(?<verdict>#(?:full|strong|partial|gap))\s+-\s+(?<explanation>.*?)\s+\|\s+(?<n2h>#[a-z0-9-]+)\s+\|\s+(?<c2e>#[a-z0-9-]+)\s*$/i,
    )
    if (!match?.groups) continue

    const sourceLink = match.groups.sourceLink.trim()
    const alias = (match.groups.alias ?? "").trim()
    const verdictTag = toCoverageVerdictTag(match.groups.verdict)
    const n2hTag = toNativeToHackyTag(match.groups.n2h)
    const c2eTag = toCoreToExtensionTag(match.groups.c2e)
    if (!verdictTag || !n2hTag || !c2eTag) continue

    const sourceAnchor = sourceLink.split("#")[1] ?? ""
    const ucRefFromAnchor = sourceAnchor.match(/(UC-\d+)/i)?.[1]?.toUpperCase()
    const ucRef = alias || ucRefFromAnchor || ""
    if (!ucRef) continue

    const ucTitle =
      sourceAnchor.replace(/^UC-\d+:\s*/i, "").trim() ||
      `Use Case ${ucRef}`

    useCases.push({
      ucRef,
      ucTitle,
      sourceLink,
      verdictTag,
      explanation: match.groups.explanation.trim(),
      nativeToHackyTag: n2hTag,
      coreToExtensionTag: c2eTag,
    })
  }

  totalUseCases = useCases.length

  for (const row of useCases) {
    if (row.verdictTag === "#full") summaryCounts.full += 1
    else if (row.verdictTag === "#strong") summaryCounts.strong += 1
    else if (row.verdictTag === "#partial") summaryCounts.partial += 1
    else if (row.verdictTag === "#gap") summaryCounts.gap += 1
    n2hDistribution[String(N2H_SCORE_BY_TAG[row.nativeToHackyTag])] =
      (n2hDistribution[String(N2H_SCORE_BY_TAG[row.nativeToHackyTag])] ?? 0) + 1
    c2eDistribution[String(C2E_SCORE_BY_TAG[row.coreToExtensionTag])] =
      (c2eDistribution[String(C2E_SCORE_BY_TAG[row.coreToExtensionTag])] ?? 0) + 1
    semanticTotals[row.nativeToHackyTag] = (semanticTotals[row.nativeToHackyTag] ?? 0) + 1
    semanticTotals[row.coreToExtensionTag] = (semanticTotals[row.coreToExtensionTag] ?? 0) + 1
    semanticTotals[row.verdictTag] = (semanticTotals[row.verdictTag] ?? 0) + 1
  }

  for (const line of lines) {
    const trimmed = line.trim()
    const avgN2hMatch = trimmed.match(/^-\s+Avg N2H:\s+([0-9]+(?:\.[0-9]+)?)\/5$/i)
    if (avgN2hMatch) {
      avgN2h = Number(avgN2hMatch[1])
      continue
    }
    const avgC2eMatch = trimmed.match(/^-\s+Avg C2E:\s+([0-9]+(?:\.[0-9]+)?)\/5$/i)
    if (avgC2eMatch) {
      avgC2e = Number(avgC2eMatch[1])
      continue
    }
    const summaryMatch = trimmed.match(/^-\s+#(full|strong|partial|gap):\s+(\d+)$/i)
    if (summaryMatch) {
      const key = summaryMatch[1].toLowerCase() as keyof ParsedSchemaCoverageReport["summaryCounts"]
      summaryCounts[key] = Number(summaryMatch[2])
      continue
    }
    const semanticMatch = trimmed.match(/^-\s+`(#[a-z0-9-]+)\s*=\s*(\d+)`$/i)
    if (semanticMatch) {
      semanticTotals[semanticMatch[1].toLowerCase()] = Number(semanticMatch[2])
    }
  }

  const computedAvgN2h =
    totalUseCases > 0
      ? Number(
          (
            useCases.reduce((sum, row) => sum + N2H_SCORE_BY_TAG[row.nativeToHackyTag], 0) /
            totalUseCases
          ).toFixed(2),
        )
      : 0
  const computedAvgC2e =
    totalUseCases > 0
      ? Number(
          (
            useCases.reduce((sum, row) => sum + C2E_SCORE_BY_TAG[row.coreToExtensionTag], 0) /
            totalUseCases
          ).toFixed(2),
        )
      : 0

  return {
    title,
    markdown,
    sourceFilePath: filePath,
    sourceChecksum: checksum(markdown),
    totalUseCases,
    summaryCounts,
    scaleSummary: {
      avgN2h: avgN2h ?? computedAvgN2h,
      avgC2e: avgC2e ?? computedAvgC2e,
      n2hDistribution,
      c2eDistribution,
      semanticTotals,
    },
    useCases,
  }
}

type SyncSagaLoopLibraryOptions = {
  useCaseFile?: string
  personaFile?: string
  actorUserId?: string
  linkSagaDefinitions?: boolean
}

type SyncedUseCaseRef = {
  definitionId: string
  versionId: string
  ucKey: string
  title: string
}

type SyncedPersonaRef = {
  definitionId: string
  versionId: string
  personaKey: string
  name: string
}

function ensureTagHashPrefix(value: string) {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, "-")
  return normalized.startsWith("#") ? normalized : `#${normalized}`
}

async function getMaxVersionNumber(
  table: typeof sagaUseCaseVersions | typeof sagaPersonaVersions,
  column: typeof sagaUseCaseVersions.sagaUseCaseId | typeof sagaPersonaVersions.sagaPersonaId,
  id: string,
) {
  const [row] = await db
    .select({
      max: sql<number>`coalesce(max(${(table as any).versionNumber}), 0)`.mapWith(Number),
    })
    .from(table as any)
    .where(eq(column as any, id))
  return row?.max ?? 0
}

async function upsertSagaUseCaseFromDoc(input: {
  entry: UseCaseDocEntry
  sourceFilePath: string
  actorUserId?: string
}): Promise<SyncedUseCaseRef> {
  const { entry, sourceFilePath, actorUserId } = input
  const [definition] = await db
    .insert(sagaUseCases)
    .values({
      ucKey: entry.ucRef,
      title: entry.title,
      status: "active",
      sourceFilePath: toProjectRelative(sourceFilePath),
      sourceRef: entry.ucRef,
      summary: entry.scenario || null,
      metadata: {
        importedFrom: "markdown",
      },
    })
    .onConflictDoUpdate({
      target: sagaUseCases.ucKey,
      set: {
        title: entry.title,
        status: "active",
        sourceFilePath: toProjectRelative(sourceFilePath),
        sourceRef: entry.ucRef,
        summary: entry.scenario || null,
        metadata: {
          importedFrom: "markdown",
        },
      },
    })
    .returning()

  const contentChecksum = checksum(entry.rawMarkdown)
  const existingCurrent = await db.query.sagaUseCaseVersions.findFirst({
    where: and(
      eq(sagaUseCaseVersions.sagaUseCaseId, definition.id),
      eq(sagaUseCaseVersions.contentChecksum, contentChecksum),
      eq(sagaUseCaseVersions.isCurrent, true),
    ),
    orderBy: [desc(sagaUseCaseVersions.versionNumber)],
  })
  if (existingCurrent) {
    return {
      definitionId: definition.id,
      versionId: existingCurrent.id,
      ucKey: definition.ucKey,
      title: definition.title,
    }
  }

  await db
    .update(sagaUseCaseVersions)
    .set({
      isCurrent: false,
    })
    .where(and(eq(sagaUseCaseVersions.sagaUseCaseId, definition.id), eq(sagaUseCaseVersions.isCurrent, true)))

  const nextVersion = (await getMaxVersionNumber(sagaUseCaseVersions, sagaUseCaseVersions.sagaUseCaseId, definition.id)) + 1
  const [version] = await db
    .insert(sagaUseCaseVersions)
    .values({
      sagaUseCaseId: definition.id,
      versionNumber: nextVersion,
      title: entry.title,
      summary: entry.scenario || null,
      bodyMarkdown: entry.rawMarkdown,
      extractedNeeds: entry.needs,
      extractedScenario: entry.scenario,
      contentChecksum,
      isCurrent: true,
      publishedAt: new Date(),
      metadata: {
        importedFrom: "markdown",
      },
    })
    .returning()

  return {
    definitionId: definition.id,
    versionId: version.id,
    ucKey: definition.ucKey,
    title: definition.title,
  }
}

async function upsertSagaPersonaFromDoc(input: {
  entry: PersonaDocEntry
  sourceFilePath: string
  actorUserId?: string
}): Promise<SyncedPersonaRef> {
  const { entry, sourceFilePath, actorUserId } = input
  const [definition] = await db
    .insert(sagaPersonas)
    .values({
      personaKey: entry.personaRef,
      name: entry.name,
      status: "active",
      sourceFilePath: toProjectRelative(sourceFilePath),
      sourceRef: entry.personaRef,
      profileSummary: entry.profile || null,
      metadata: {
        importedFrom: "markdown",
      },
    })
    .onConflictDoUpdate({
      target: sagaPersonas.personaKey,
      set: {
        name: entry.name,
        status: "active",
        sourceFilePath: toProjectRelative(sourceFilePath),
        sourceRef: entry.personaRef,
        profileSummary: entry.profile || null,
        metadata: {
          importedFrom: "markdown",
        },
      },
    })
    .returning()

  const contentChecksum = checksum(entry.rawMarkdown)
  const existingCurrent = await db.query.sagaPersonaVersions.findFirst({
    where: and(
      eq(sagaPersonaVersions.sagaPersonaId, definition.id),
      eq(sagaPersonaVersions.contentChecksum, contentChecksum),
      eq(sagaPersonaVersions.isCurrent, true),
    ),
    orderBy: [desc(sagaPersonaVersions.versionNumber)],
  })
  if (existingCurrent) {
    return {
      definitionId: definition.id,
      versionId: existingCurrent.id,
      personaKey: definition.personaKey,
      name: definition.name,
    }
  }

  await db
    .update(sagaPersonaVersions)
    .set({
      isCurrent: false,
    })
    .where(and(eq(sagaPersonaVersions.sagaPersonaId, definition.id), eq(sagaPersonaVersions.isCurrent, true)))

  const nextVersion = (await getMaxVersionNumber(sagaPersonaVersions, sagaPersonaVersions.sagaPersonaId, definition.id)) + 1
  const [version] = await db
    .insert(sagaPersonaVersions)
    .values({
      sagaPersonaId: definition.id,
      versionNumber: nextVersion,
      name: entry.name,
      profile: entry.profile || null,
      goals: entry.goals || null,
      painPoints: entry.painPoints || null,
      testScenarios: entry.testScenarios,
      bodyMarkdown: entry.rawMarkdown,
      contentChecksum,
      isCurrent: true,
      publishedAt: new Date(),
      metadata: {
        importedFrom: "markdown",
      },
    })
    .returning()

  return {
    definitionId: definition.id,
    versionId: version.id,
    personaKey: definition.personaKey,
    name: definition.name,
  }
}

/**
 * Sync markdown UC/persona docs into canonical loop tables and map saga defs.
 */
export async function syncSagaLoopLibraryFromDocs(options: SyncSagaLoopLibraryOptions = {}) {
  await ensureSagaFilesystem()
  const useCaseFile = options.useCaseFile || DEFAULT_USE_CASES_FILE
  const personaFile = options.personaFile || DEFAULT_PERSONAS_FILE
  const actorUserId = options.actorUserId
  const linkSagaDefinitions = options.linkSagaDefinitions ?? true

  const useCases = await parseUseCasesFromMarkdown(useCaseFile)
  const personas = await parsePersonasFromMarkdown(personaFile)

  const syncedUseCases: SyncedUseCaseRef[] = []
  for (const entry of useCases) {
    syncedUseCases.push(
      await upsertSagaUseCaseFromDoc({
        entry,
        sourceFilePath: useCaseFile,
        actorUserId,
      }),
    )
  }

  const syncedPersonas: SyncedPersonaRef[] = []
  for (const entry of personas) {
    syncedPersonas.push(
      await upsertSagaPersonaFromDoc({
        entry,
        sourceFilePath: personaFile,
        actorUserId,
      }),
    )
  }

  const useCaseByRef = new Map(syncedUseCases.map((row) => [row.ucKey.toUpperCase(), row]))
  const personaByRef = new Map(syncedPersonas.map((row) => [row.personaKey.toUpperCase(), row]))
  const personaDocByRef = new Map(personas.map((row) => [row.personaRef.toUpperCase(), row]))

  let linkedDefinitions = 0
  if (linkSagaDefinitions) {
    const definitions = await listSagaDefinitions({ limit: 2000 })
    for (const definition of definitions) {
      const ucRef = String(definition.sourceUseCaseRef || "").trim().toUpperCase()
      const personaRef = String(definition.sourcePersonaRef || "").trim().toUpperCase()
      const ucSynced = ucRef ? useCaseByRef.get(ucRef) : undefined
      const personaSynced = personaRef ? personaByRef.get(personaRef) : undefined
      const ucDoc =
        ucRef && useCases.find((row) => row.ucRef.toUpperCase() === ucRef)
          ? useCases.find((row) => row.ucRef.toUpperCase() === ucRef)
          : undefined
      const personaDoc =
        personaRef && personaDocByRef.get(personaRef)
          ? personaDocByRef.get(personaRef)
          : undefined

      await db
        .delete(sagaDefinitionLinks)
        .where(
          and(
            eq(sagaDefinitionLinks.sagaDefinitionId, definition.id),
            eq(sagaDefinitionLinks.relationRole, "primary"),
          ),
        )

      await db
        .insert(sagaDefinitionLinks)
        .values({
          sagaDefinitionId: definition.id,
          sagaUseCaseVersionId: ucSynced?.versionId,
          sagaPersonaVersionId: personaSynced?.versionId,
          relationRole: "primary",
          weight: 1,
          metadata: {
            source: "syncSagaLoopLibraryFromDocs",
            ucRef: ucSynced?.ucKey ?? null,
            personaRef: personaSynced?.personaKey ?? personaDoc?.personaRef ?? null,
          },
        })

      linkedDefinitions += 1
    }
  }

  return {
    useCaseCount: syncedUseCases.length,
    personaCount: syncedPersonas.length,
    linkedDefinitions,
  }
}

function choosePersonaForUseCase(uc: UseCaseDocEntry, personas: PersonaDocEntry[]) {
  const title = uc.title.toLowerCase()

  const findByContains = (needle: string) =>
    personas.find((persona) => persona.name.toLowerCase().includes(needle))

  if (title.includes('multi-location')) return findByContains('multi-location') ?? personas[0]
  if (title.includes('front desk') || title.includes('queue')) {
    return findByContains('front desk') ?? personas[0]
  }
  if (title.includes('mobile') || title.includes('route')) return findByContains('mobile') ?? personas[0]
  if (title.includes('franchise')) return findByContains('franchise') ?? personas[0]
  if (title.includes('medical') || title.includes('clinic')) {
    return findByContains('appointment-heavy') ?? personas[0]
  }
  if (title.includes('security') || title.includes('fraud') || title.includes('breach')) {
    return findByContains('black hat') ?? personas[0]
  }

  return findByContains('solo entrepreneur') ?? personas[0]
}

function rankPersonasForUseCase(
  uc: UseCaseDocEntry,
  personas: PersonaDocEntry[],
  preferredPersonaRef?: string,
) {
  const ucText = [uc.title, uc.scenario, ...uc.needs]
    .join(" ")
    .toLowerCase()
  const keywords = Array.from(
    new Set((ucText.match(/[a-z0-9]{4,}/g) ?? []).filter((word) => word.length >= 4)),
  )
  const preferredRef = preferredPersonaRef?.toUpperCase()

  return [...personas]
    .map((persona) => {
      const personaText = [
        persona.name,
        persona.profile ?? "",
        persona.goals ?? "",
        persona.painPoints ?? "",
        ...(persona.testScenarios ?? []),
      ]
        .join(" ")
        .toLowerCase()
      let score = 0
      for (const keyword of keywords) {
        if (personaText.includes(keyword)) score += 1
      }
      if (preferredRef && persona.personaRef.toUpperCase() === preferredRef) score += 1000
      return { persona, score }
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      return a.persona.name.localeCompare(b.persona.name)
    })
    .map((row) => row.persona)
}

type SagaStepDraft = {
  stepKey: string
  title: string
  actorKey: string
  intent: string
  instruction: string
  expectedResult: string
  toolHints?: string[]
  guardrails?: string[]
  tags?: string[]
}

type UcSpecificStepExtensions = {
  businessConfiguration: SagaStepDraft[]
  catalogPublish: SagaStepDraft[]
  customerLifecycle: SagaStepDraft[]
  securityAbuse: SagaStepDraft[]
  operationsFollowUp: SagaStepDraft[]
  reportingCloseout: SagaStepDraft[]
  coverageTargets: string[]
}

/**
 * Build UC-specific step extensions from the raw UC text.
 *
 * ELI5:
 * The old generator produced one generic saga template for every UC.
 * This function adds explicit UC-driven checks so each generated saga carries
 * scenario-specific requirements from the source UC document.
 */
function buildUcSpecificStepExtensions(uc: UseCaseDocEntry): UcSpecificStepExtensions {
  const text = [uc.title, uc.scenario, ...uc.needs].join(' ').toLowerCase()
  const coverageTargets = new Set<string>()
  const extension: UcSpecificStepExtensions = {
    businessConfiguration: [],
    catalogPublish: [],
    customerLifecycle: [],
    securityAbuse: [],
    operationsFollowUp: [],
    reportingCloseout: [],
    coverageTargets: [],
  }

  const usedKeys = new Set<string>()
  const addStep = (
    bucket: keyof Omit<UcSpecificStepExtensions, 'coverageTargets'>,
    targetKey: string,
    draft: Omit<SagaStepDraft, 'stepKey'>,
  ) => {
    let stepKey = targetKey
    let index = 1
    while (usedKeys.has(stepKey)) {
      index += 1
      stepKey = `${targetKey}_${index}`
    }
    usedKeys.add(stepKey)
    coverageTargets.add(targetKey)
    extension[bucket].push({
      ...draft,
      stepKey,
      tags: Array.from(new Set(['uc-specific', ...(draft.tags ?? [])])),
    })
  }

  if (/(call fee|dispatch fee|visit fee|arrival fee)/i.test(text)) {
    addStep('businessConfiguration', 'owner-configure-call-fee', {
      title: 'Configure call/dispatch fee policy',
      actorKey: 'biz_owner',
      intent: 'Validate non-refundable arrival/call fee handling required by this UC.',
      instruction:
        'Configure call-fee policy so a customer can be charged when provider arrives even if service is not performed.',
      expectedResult:
        'Pricing/policy config stores call-fee behavior and is usable by booking/payment flow.',
      tags: ['pricing', 'call-fee'],
    })
  }

  if (/(surge|high demand|holiday pricing|peak hours|manual demand)/i.test(text)) {
    addStep('businessConfiguration', 'owner-configure-demand-pricing', {
      title: 'Configure demand-driven/manual surge pricing',
      actorKey: 'biz_owner',
      intent: 'Validate high-demand and holiday manual pricing controls from UC.',
      instruction:
        'Set demand pricing rules (for example peak-hour/holiday overrides) and verify they can be applied to bookable offers.',
      expectedResult: 'Demand pricing policy exists and can influence offer/booking totals.',
      tags: ['pricing', 'demand'],
    })
  }

  if (/(waitlist|queue|batch|prepay)/i.test(text)) {
    addStep('customerLifecycle', 'customer-join-waitlist-flow', {
      title: 'Customer enters waitlist/queue flow',
      actorKey: 'customer_1',
      intent: 'Validate queue-based demand flow requested by UC.',
      instruction:
        'Simulate customer joining waitlist/queue or prepaying for limited batch capacity.',
      expectedResult:
        'System records customer demand in queue/waitlist model and exposes deterministic status transitions.',
      tags: ['queue', 'waitlist'],
    })
  }

  if (/(split tender|split payment|tip|pay what you want|gift card|gift|credits|pass)/i.test(text)) {
    addStep('customerLifecycle', 'customer-advanced-payment-flow', {
      title: 'Customer uses advanced payment instruments',
      actorKey: 'customer_1',
      intent: 'Validate mixed payment flows (split tender/tips/gifts/credits) from UC needs.',
      instruction:
        'Execute advanced payment path (split tender and/or tip/gift/credit entitlement usage) and persist allocation evidence.',
      expectedResult:
        'Payment trace clearly links payer, tender mix, and booking/order amounts with no ambiguity.',
      tags: ['payments', 'entitlements'],
    })
  }

  if (/(google|classpass|twilio|hubspot|clickup|external calendar|integration|connector|webhook)/i.test(text)) {
    addStep('operationsFollowUp', 'owner-configure-external-integration', {
      title: 'Configure external channel/integration',
      actorKey: 'biz_owner',
      intent: 'Validate external connector and sync behavior required by UC.',
      instruction:
        'Configure one external integration/channel and verify sync state + external id linkage is persisted.',
      expectedResult:
        'Connector installation/configuration and sync status are queryable for operational debugging.',
      tags: ['integration', 'channels'],
    })
  }

  if (/(hipaa|privacy|compliance|residency|background check|certification|license|id verification)/i.test(text)) {
    addStep('operationsFollowUp', 'owner-validate-compliance-controls', {
      title: 'Validate compliance and credential controls',
      actorKey: 'biz_owner',
      intent: 'Validate compliance-oriented constraints and sensitive data handling from UC.',
      instruction:
        'Run compliance workflow checks (credential sharing/access control/privacy constraints) for this scenario.',
      expectedResult:
        'Access is scoped correctly and compliance workflow state is traceable in operational records.',
      tags: ['compliance', 'privacy'],
    })
  }

  if (/(cross-biz|marketplace|franchise|enterprise|multi-tenant)/i.test(text)) {
    addStep('securityAbuse', 'adversary-marketplace-tenant-isolation', {
      title: 'Cross-biz isolation under marketplace/enterprise flow',
      actorKey: 'adversary',
      intent: 'Validate tenant-isolation behavior in cross-biz contexts.',
      instruction:
        'Attempt unauthorized cross-biz visibility/mutation in marketplace/enterprise scenario context.',
      expectedResult:
        'Unauthorized access is denied and no sensitive tenant data leaks across business boundaries.',
      tags: ['security', 'tenant-isolation'],
    })
  }

  if (/(mobile|route|transport|trip|dispatch)/i.test(text)) {
    addStep('operationsFollowUp', 'owner-review-route-dispatch-state', {
      title: 'Review route/dispatch operational state',
      actorKey: 'biz_owner',
      intent: 'Validate transportation/mobile fulfillment state for this UC.',
      instruction:
        'Inspect route/dispatch state after bookings and verify assignment/ETA/operational telemetry consistency.',
      expectedResult:
        'Route/dispatch records align with bookings and can be used for operations decisions.',
      tags: ['transport', 'operations'],
    })
  }

  if (/(report|analytics|revenue|top selling|kpi|intelligence|forecast)/i.test(text)) {
    addStep('reportingCloseout', 'owner-verify-uc-analytics-outcome', {
      title: 'Verify UC-specific analytics and KPI outcome',
      actorKey: 'biz_owner',
      intent: 'Validate reporting answers this UC expects.',
      instruction:
        'Query reporting endpoints relevant to this UC and confirm metrics answer the UC business question.',
      expectedResult: 'Reports expose reliable KPI data that matches lifecycle actions in this run.',
      tags: ['reporting', 'kpi'],
    })
  }

  extension.coverageTargets = Array.from(coverageTargets)
  return extension
}

function buildSagaSpec(uc: UseCaseDocEntry, persona: PersonaDocEntry): SagaSpec {
  const ucSlug = slugify(uc.ucRef)
  const personaSlug = slugify(persona.name).slice(0, 40)
  const sagaKey = `${ucSlug}-${personaSlug}`

  const needsSummary =
    uc.needs.length > 0
      ? uc.needs.join('; ')
      : 'No explicit needs list found in UC markdown, use scenario narrative.'

  const objectives = [
    `Validate ${uc.ucRef} lifecycle end-to-end using persona ${persona.name}.`,
    'Exercise owner setup, team setup, catalog publishing, and customer journeys.',
    'Stress ACL/security edge cases and verify expected denials are enforced.',
    'Collect snapshots and report artifacts for every critical milestone.',
  ]

  const actors = [
    {
      actorKey: 'biz_owner',
      name: persona.name,
      role: 'owner',
      description:
        persona.profile ||
        'Primary business owner actor responsible for setup/configuration decisions.',
      personaRef: persona.personaRef,
    },
    {
      actorKey: 'biz_member',
      name: 'Operations Team Member',
      role: 'manager',
      description: 'Business member invited by owner to assist with operations and booking flow.',
    },
    {
      actorKey: 'customer_1',
      name: 'Customer One',
      role: 'customer',
      description: 'Primary customer exploring catalog, booking services, and purchasing products.',
    },
    {
      actorKey: 'customer_2',
      name: 'Customer Two',
      role: 'customer',
      description: 'Concurrent customer used to simulate realistic demand and race conditions.',
    },
    {
      actorKey: 'adversary',
      name: 'Adversarial User',
      role: 'malicious_actor',
      description: 'Actor intentionally attempting unauthorized or abusive actions.',
    },
  ] as const
  const ucExtensions = buildUcSpecificStepExtensions(uc)
  const ucNeedValidationSteps = uc.needs.slice(0, 12).map((need, index) => ({
    stepKey: `uc-need-validate-${index + 1}`,
    title: `Validate explicit UC need #${index + 1}`,
    actorKey: "biz_owner",
    intent: `Prove this lifecycle covers explicit requirement: ${need}`,
    instruction:
      `Using concrete API reads and persisted state checks, validate this requirement is satisfied: "${need}". ` +
      "If not satisfied, record exact gap and failing entities/endpoints.",
    expectedResult:
      "Evidence either confirms requirement coverage or captures a precise, reproducible gap.",
    tags: ["uc-need", "validation", "coverage"],
  }))
  const personaScenarioValidationSteps = (persona.testScenarios ?? [])
    .slice(0, 8)
    .map((scenario, index) => ({
      stepKey: `persona-scenario-validate-${index + 1}`,
      title: `Validate persona scenario #${index + 1}`,
      actorKey:
        scenario.toLowerCase().includes("abuse") || scenario.toLowerCase().includes("unauthorized")
          ? "adversary"
          : "customer_1",
      intent: `Exercise persona-specific behavior: ${scenario}`,
      instruction:
        `Simulate this persona scenario and validate outcome deterministically: "${scenario}". ` +
        "Capture traces and snapshots so coverage can be audited later.",
      expectedResult:
        "Scenario behavior is either confirmed as supported or produces a clear, actionable failure report.",
      tags: ["persona-scenario", "validation", "coverage"],
    }))

  let stepOrderCounter = 0
  const nextOrder = () => {
    stepOrderCounter += 1
    return stepOrderCounter
  }

  const phase = (
    phaseKey: string,
    order: number,
    title: string,
    description: string,
    steps: Array<{
      stepKey: string
      title: string
      actorKey: string
      intent: string
      instruction: string
      expectedResult: string
      toolHints?: string[]
      guardrails?: string[]
      tags?: string[]
    }>,
  ) => ({
    phaseKey,
    order,
    title,
    description,
    steps: steps.map((step) => ({
      ...step,
      order: nextOrder(),
      toolHints: step.toolHints ?? [],
      assertions: [
        {
          kind: 'api_response',
          description: 'API call returns success and includes stable ids for created entities.',
        },
        {
          kind: 'acl_guard',
          description: 'Actor permissions are honored for this step context.',
        },
      ],
      evidenceRequired: [
        {
          kind: 'api_trace',
          label: 'Request/response trace for this step',
        },
        {
          kind: 'snapshot',
          label: 'Structured snapshot.v1 screen blocks (what user saw) with real API-backed data',
        },
      ],
      guardrails: step.guardrails ?? [],
      tags: step.tags ?? [],
    })),
  })

  return sagaSpecSchema.parse({
    schemaVersion: 'saga.v0',
    sagaKey,
    title: `${uc.ucRef} • ${uc.title} • ${persona.name}`,
    description: `Comprehensive lifecycle saga derived from ${uc.ucRef} and persona ${persona.personaRef}. Needs summary: ${needsSummary}`,
    tags: ['uc-derived', 'persona-derived', 'lifecycle', 'api-first', 'agents'],
    source: {
      useCaseRef: uc.ucRef,
      personaRef: persona.personaRef,
      useCaseFile: DEFAULT_USE_CASES_FILE,
      personaFile: DEFAULT_PERSONAS_FILE,
      generatedAt: new Date().toISOString(),
    },
    objectives,
    actors,
    defaults: {
      runMode: 'dry_run',
      continueOnFailure: false,
    },
    phases: [
      phase(
        'owner-onboarding',
        1,
        'Owner Onboarding',
        'Business owner signs up, authenticates, and establishes tenant root.',
        [
          {
            stepKey: 'owner-sign-up',
            title: 'Owner signs up and authenticates',
            actorKey: 'biz_owner',
            intent: 'Establish authenticated owner identity for the lifecycle.',
            instruction:
              'Create or login the owner account through Better Auth endpoints, then verify session context can call authenticated API routes.',
            expectedResult:
              'Owner session exists and authenticated routes return success for this user.',
            tags: ['auth', 'setup'],
          },
          {
            stepKey: 'owner-create-biz',
            title: 'Owner creates business tenant',
            actorKey: 'biz_owner',
            intent: 'Create the biz root for all subsequent configuration.',
            instruction:
              `Using agents tools, create a biz representing ${uc.title}. Use name/slug derived from saga context.`,
            expectedResult:
              'Biz is created, owner is auto-added as member with owner role, and biz id is captured.',
            toolHints: ['bizing.bizes.create'],
            tags: ['biz', 'setup'],
          },
          {
            stepKey: 'owner-create-location',
            title: 'Owner creates primary location',
            actorKey: 'biz_owner',
            intent: 'Establish operational location for services/resources.',
            instruction:
              'Create a primary location for the biz and set timezone aligned with scenario context.',
            expectedResult: 'Location exists and is associated with the new biz.',
            toolHints: ['bizing.locations.create'],
            tags: ['location', 'setup'],
          },
        ],
      ),
      phase(
        'business-configuration',
        2,
        'Business Configuration',
        'Owner configures scheduling, pricing baseline, and operational defaults.',
        [
          {
            stepKey: 'owner-configure-hours',
            title: 'Configure default hours and availability mode',
            actorKey: 'biz_owner',
            intent: 'Set baseline availability without forcing advanced complexity.',
            instruction:
              'Create baseline availability and lead-time rules representing the UC default business hours and booking window behavior.',
            expectedResult:
              'Availability defaults and rules are stored and can be referenced by calendars.',
            tags: ['availability', 'policy'],
          },
          {
            stepKey: 'owner-configure-pricing',
            title: 'Configure default pricing rules',
            actorKey: 'biz_owner',
            intent: 'Set base pricing and optional manual demand overrides.',
            instruction:
              'Configure pricing defaults for the offer lifecycle including call fees/manual surge if UC needs imply it.',
            expectedResult:
              'Pricing model persists and future bookings can calculate totals deterministically.',
            tags: ['pricing'],
          },
          ...ucExtensions.businessConfiguration,
        ],
      ),
      phase(
        'supply-and-team-setup',
        3,
        'Supply And Team Setup',
        'Business owner sets up hosts/assets/venues/resources and invites members.',
        [
          {
            stepKey: 'owner-create-resources',
            title: 'Create resources representing hosts/assets/venues',
            actorKey: 'biz_owner',
            intent: 'Model real-world supply that bookings will consume.',
            instruction:
              'Create at least one host resource and one non-host resource (asset or venue) suitable for the UC.',
            expectedResult: 'Resources are created with expected type, location, and buffers.',
            toolHints: ['bizing.resources.create'],
            tags: ['resources'],
          },
          {
            stepKey: 'owner-invite-member',
            title: 'Invite and provision business member',
            actorKey: 'biz_owner',
            intent: 'Validate collaboration and role assignment.',
            instruction:
              'Invite a biz member, assign an operational role, and verify that member can authenticate into the same biz.',
            expectedResult: 'Biz member account/session exists with scoped role permissions.',
            tags: ['team', 'acl'],
          },
        ],
      ),
      phase(
        'catalog-publish',
        4,
        'Catalog And Publish',
        'Owner creates services/offers/products and publishes sellable catalog entries.',
        [
          {
            stepKey: 'owner-create-offer',
            title: 'Create offer shell',
            actorKey: 'biz_owner',
            intent: 'Define sellable service/catalog entry.',
            instruction:
              'Create an offer representing the UC primary service; choose execution mode matching the scenario.',
            expectedResult: 'Offer is created in draft state with captured id.',
            toolHints: ['bizing.offers.create'],
            tags: ['offer', 'catalog'],
          },
          {
            stepKey: 'owner-create-offer-version',
            title: 'Create and publish offer version',
            actorKey: 'biz_owner',
            intent: 'Freeze booking rules, duration, and price for customers.',
            instruction:
              'Create a published offer version with realistic duration and base price for this UC.',
            expectedResult: 'Offer version exists and is ready for booking order references.',
            toolHints: ['bizing.offers.createVersion'],
            tags: ['offer', 'pricing'],
          },
          {
            stepKey: 'owner-publish-catalog',
            title: 'Publish catalog visibility',
            actorKey: 'biz_owner',
            intent: 'Expose offer to customer discovery flow.',
            instruction:
              'Update offer publish/lifecycle flags so customer actors can discover it.',
            expectedResult:
              'Offer appears as published/active and can be returned in customer-facing list queries.',
            toolHints: ['bizing.offers.create', 'bizing.offers.list'],
            tags: ['catalog', 'publish'],
          },
          ...ucExtensions.catalogPublish,
        ],
      ),
      phase(
        'customer-lifecycle',
        5,
        'Customer Lifecycle',
        'Customers sign up, discover offerings, book, and purchase in realistic order.',
        [
          {
            stepKey: 'customer-sign-up',
            title: 'Customer one signs up and logs in',
            actorKey: 'customer_1',
            intent: 'Establish customer identity for purchase/booking traceability.',
            instruction:
              'Create customer account/session and verify customer can browse published offers.',
            expectedResult: 'Customer session established and offer discovery succeeds.',
            toolHints: ['bizing.offers.list'],
            tags: ['auth', 'customer'],
          },
          {
            stepKey: 'customer-book-primary',
            title: 'Customer one books primary offer',
            actorKey: 'customer_1',
            intent: 'Exercise booking order creation under normal path.',
            instruction:
              'Create a booking order using the published offer version with realistic times and monetary totals.',
            expectedResult:
              'Booking order is created and linked to offer/offer version with coherent totals.',
            toolHints: ['bizing.bookingOrders.create'],
            tags: ['booking', 'checkout'],
          },
          {
            stepKey: 'customer-two-concurrent',
            title: 'Customer two performs concurrent booking attempt',
            actorKey: 'customer_2',
            intent: 'Simulate real demand and potential scheduling conflicts.',
            instruction:
              'Customer two attempts booking overlapping demand for the same offer/resource window.',
            expectedResult:
              'System either books correctly under capacity rules or rejects with deterministic conflict response.',
            toolHints: ['bizing.bookingOrders.create'],
            tags: ['concurrency', 'booking'],
          },
          ...ucExtensions.customerLifecycle,
        ],
      ),
      phase(
        'security-and-abuse',
        6,
        'Security And Abuse Checks',
        'Adversarial actor attempts prohibited operations to validate access controls.',
        [
          {
            stepKey: 'adversary-cross-biz-read',
            title: 'Adversary attempts unauthorized cross-biz read',
            actorKey: 'adversary',
            intent: 'Validate tenant isolation against IDOR-like behavior.',
            instruction:
              'Using credentials from another context, attempt to read or mutate booking/order resources for this biz.',
            expectedResult: 'Request is rejected with forbidden/unauthorized error and no data leakage.',
            guardrails: ['Must not bypass membership checks', 'No sensitive payload should be returned'],
            tags: ['security', 'acl', 'idor'],
          },
          {
            stepKey: 'adversary-hold-abuse',
            title: 'Adversary attempts demand/hold abuse',
            actorKey: 'adversary',
            intent: 'Stress anti-abuse controls around booking intent and capacity locks.',
            instruction:
              'Trigger repeated booking/hold-like attempts to validate throttling, expiry, or non-blocking demand visibility behavior.',
            expectedResult:
              'Abusive attempts are rate-limited or isolated without blocking legitimate customer flow.',
            tags: ['security', 'abuse', 'capacity'],
          },
          ...ucExtensions.securityAbuse,
        ],
      ),
      phase(
        'operations-and-follow-up',
        7,
        'Operations And Follow-up',
        'Owner and members handle notifications, confirmations, and operational updates.',
        [
          {
            stepKey: 'member-review-bookings',
            title: 'Biz member reviews and updates booking status',
            actorKey: 'biz_member',
            intent: 'Validate role-based operational workflow.',
            instruction:
              'As biz member, list bookings and progress one booking through operational status updates.',
            expectedResult:
              'Authorized role can update status while preserving auditability and lifecycle consistency.',
            toolHints: ['bizing.bookingOrders.list', 'bizing.bookingOrders.updateStatus'],
            tags: ['operations', 'acl'],
          },
          {
            stepKey: 'owner-calendar-review',
            title: 'Owner reviews consolidated calendar state',
            actorKey: 'biz_owner',
            intent: 'Verify availability, bookings, and resulting schedule are coherent.',
            instruction:
              'Query and compare availability + bookings timeline for the entities involved in this scenario.',
            expectedResult:
              'Calendar state reflects booked slots, blocks, and any conflict outcomes from previous steps.',
            tags: ['calendar', 'validation'],
          },
          ...ucExtensions.operationsFollowUp,
        ],
      ),
      phase(
        'reporting-and-closeout',
        8,
        'Reporting And Closeout',
        'Run collects evidence, computes pass/fail summary, and validates lifecycle traceability.',
        [
          {
            stepKey: 'owner-revenue-sanity',
            title: 'Owner validates financial/reporting outputs',
            actorKey: 'biz_owner',
            intent: 'Ensure lifecycle creates coherent business metrics.',
            instruction:
              'Read reporting endpoints and verify booking totals, counts, and statuses align with saga actions.',
            expectedResult:
              'Reported metrics match booking actions and highlight any discrepancies for schema/API iteration.',
            tags: ['reporting', 'reconciliation'],
          },
          ...ucNeedValidationSteps,
          ...personaScenarioValidationSteps,
          {
            stepKey: 'runner-submit-artifacts',
            title: 'Runner submits snapshots and final report',
            actorKey: 'biz_owner',
            intent: 'Close loop with machine-readable evidence and human-readable findings.',
            instruction:
              'Upload snapshots for critical steps and submit final markdown report summarizing pass/fail and discovered gaps.',
            expectedResult:
              'Run has persisted report + snapshots in project directory and indexed metadata in DB.',
            tags: ['evidence', 'closeout'],
          },
          ...ucExtensions.reportingCloseout,
        ],
      ),
    ],
    metadata: {
      ucScenario: uc.scenario,
      personaGoals: persona.goals,
      personaPainPoints: persona.painPoints,
      personaTestScenarios: persona.testScenarios,
      coverageTargets: ucExtensions.coverageTargets,
    },
  })
}

/**
 * Generate JSON saga specs from use-cases/personas markdown sources.
 */
export async function generateSagaSpecsFromDocs(options: GenerateSagaSpecsOptions = {}) {
  await ensureSagaFilesystem()

  const useCaseFile = options.useCaseFile || DEFAULT_USE_CASES_FILE
  const personaFile = options.personaFile || DEFAULT_PERSONAS_FILE
  const overwrite = options.overwrite ?? true
  const maxPersonasPerUseCase = Math.max(1, options.maxPersonasPerUseCase ?? 1)

  const useCases = await parseUseCasesFromMarkdown(useCaseFile)
  const personas = await parsePersonasFromMarkdown(personaFile)

  let selectedUseCases = useCases
  if (options.useCaseRefs?.length) {
    const refSet = new Set(options.useCaseRefs.map((value) => value.trim().toUpperCase()))
    selectedUseCases = selectedUseCases.filter((uc) => refSet.has(uc.ucRef.toUpperCase()))
  }
  if (options.limitUseCases && options.limitUseCases > 0) {
    selectedUseCases = selectedUseCases.slice(0, options.limitUseCases)
  }

  const filteredPersonas = options.personaRefs?.length
    ? personas.filter((persona) =>
        options.personaRefs?.some(
          (ref) =>
            ref.trim().toUpperCase() === persona.personaRef.toUpperCase() ||
            ref.trim().toLowerCase() === persona.name.toLowerCase(),
        ),
      )
    : personas

  const generated: GeneratedSagaFile[] = []

  for (const uc of selectedUseCases) {
    let personaCandidates: PersonaDocEntry[] = []
    if (options.personaRefs?.length) {
      personaCandidates = filteredPersonas.slice(0, maxPersonasPerUseCase)
    } else {
      const primary = choosePersonaForUseCase(uc, filteredPersonas)
      if (maxPersonasPerUseCase <= 1) {
        personaCandidates = primary ? [primary] : []
      } else {
        personaCandidates = rankPersonasForUseCase(
          uc,
          filteredPersonas,
          primary?.personaRef,
        ).slice(0, maxPersonasPerUseCase)
      }
    }

    for (const persona of personaCandidates.slice(0, maxPersonasPerUseCase)) {
      const spec = buildSagaSpec(uc, persona)
      const filePath = path.join(SAGA_SPECS_DIR, `${spec.sagaKey}.json`)
      if (!overwrite && (await exists(filePath))) {
        continue
      }

      const serialized = `${JSON.stringify(spec, null, 2)}\n`
      await fs.writeFile(filePath, serialized, 'utf8')
      generated.push({
        sagaKey: spec.sagaKey,
        title: spec.title,
        filePath: toProjectRelative(filePath),
        useCaseRef: spec.source.useCaseRef,
        personaRef: spec.source.personaRef,
      })
    }
  }

  return generated
}

async function readSagaSpecFromDiskByRelativePath(specRelativePath: string): Promise<SagaSpec> {
  const absPath = fromProjectRelative(specRelativePath)
  const payload = await fs.readFile(absPath, 'utf8')
  const parsed = JSON.parse(payload) as unknown
  return sagaSpecSchema.parse(parsed)
}

async function readSagaSpecFromDefinition(definition: { id: string; specFilePath: string }) {
  try {
    const revision = await db.query.sagaDefinitionRevisions.findFirst({
      where: and(
        eq(sagaDefinitionRevisions.sagaDefinitionId, definition.id),
        eq(sagaDefinitionRevisions.isCurrent, true),
      ),
      orderBy: [desc(sagaDefinitionRevisions.revisionNumber)],
    })

    if (revision?.specJson) {
      return sagaSpecSchema.parse(revision.specJson as unknown)
    }
  } catch (error) {
    if (!isMissingRelationError(error)) throw error
  }
  return readSagaSpecFromDiskByRelativePath(definition.specFilePath)
}

/**
 * Read all JSON spec files from `testing/sagas/specs`.
 */
export async function listSagaSpecFiles(): Promise<Array<{ absPath: string; relativePath: string }>> {
  await ensureSagaFilesystem()
  const entries = await fs.readdir(SAGA_SPECS_DIR, { withFileTypes: true })
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => {
      const absPath = path.join(SAGA_SPECS_DIR, entry.name)
      return {
        absPath,
        relativePath: toProjectRelative(absPath),
      }
    })
}

/**
 * Synchronize file-based saga specs into `saga_definitions` for API querying.
 */
export async function syncSagaDefinitionsFromDisk(actorUserId?: string) {
  await ensureSagaFilesystem()
  const files = await listSagaSpecFiles()
  const synced: Array<{ sagaKey: string; title: string; specFilePath: string }> = []

  for (const file of files) {
    const raw = await fs.readFile(file.absPath, 'utf8')
    const parsed = sagaSpecSchema.parse(JSON.parse(raw))
    const specChecksum = checksum(raw)

    const [definition] = await db
      .insert(sagaDefinitions)
      .values({
        sagaKey: parsed.sagaKey,
        title: parsed.title,
        description: parsed.description,
        status: 'active',
        sourceUseCaseRef: parsed.source.useCaseRef,
        sourcePersonaRef: parsed.source.personaRef,
        sourceUseCaseFile: parsed.source.useCaseFile,
        sourcePersonaFile: parsed.source.personaFile,
        specVersion: parsed.schemaVersion,
        specFilePath: file.relativePath,
        specChecksum,
        metadata: {
          tags: parsed.tags,
          generatedAt: parsed.source.generatedAt,
        },
      })
      .onConflictDoUpdate({
        target: sagaDefinitions.sagaKey,
        set: {
          title: parsed.title,
          description: parsed.description,
          sourceUseCaseRef: parsed.source.useCaseRef,
          sourcePersonaRef: parsed.source.personaRef,
          sourceUseCaseFile: parsed.source.useCaseFile,
          sourcePersonaFile: parsed.source.personaFile,
          specVersion: parsed.schemaVersion,
          specFilePath: file.relativePath,
          specChecksum,
          metadata: {
            tags: parsed.tags,
            generatedAt: parsed.source.generatedAt,
          },
        },
      })
      .returning()

    try {
      const currentRevision = definition
        ? await db.query.sagaDefinitionRevisions.findFirst({
            where: and(
              eq(sagaDefinitionRevisions.sagaDefinitionId, definition.id),
              eq(sagaDefinitionRevisions.isCurrent, true),
            ),
            orderBy: [desc(sagaDefinitionRevisions.revisionNumber)],
          })
        : null

      if (definition && (!currentRevision || currentRevision.specChecksum !== specChecksum)) {
        await db
          .update(sagaDefinitionRevisions)
          .set({
            isCurrent: false,
          })
          .where(
            and(
              eq(sagaDefinitionRevisions.sagaDefinitionId, definition.id),
              eq(sagaDefinitionRevisions.isCurrent, true),
            ),
          )

        const [maxRevisionRow] = await db
          .select({
            max: sql<number>`coalesce(max(${sagaDefinitionRevisions.revisionNumber}), 0)`.mapWith(Number),
          })
          .from(sagaDefinitionRevisions)
          .where(eq(sagaDefinitionRevisions.sagaDefinitionId, definition.id))

        const nextRevision = (maxRevisionRow?.max ?? 0) + 1
        await db.insert(sagaDefinitionRevisions).values({
          sagaDefinitionId: definition.id,
          revisionNumber: nextRevision,
          specVersion: parsed.schemaVersion,
          specChecksum,
          specJson: parsed,
          sourceFilePath: file.relativePath,
          isCurrent: true,
          metadata: {
            source: "syncSagaDefinitionsFromDisk",
          },
        })
      }
    } catch (error) {
      if (!isMissingRelationError(error)) throw error
    }

    synced.push({
      sagaKey: parsed.sagaKey,
      title: parsed.title,
      specFilePath: file.relativePath,
    })
  }

  return synced
}

/**
 * Enforce tenant access for optional biz-scoped runs.
 */
export async function ensureBizMembership(userId: string, bizId: string) {
  const membership = await db.query.members.findFirst({
    where: (table, { and, eq }) => and(eq(table.userId, userId), eq(table.organizationId, bizId)),
  })
  return membership
}

type SagaRunAccessResult = {
  allowed: boolean
  reason?: string
  code?: 'NOT_FOUND' | 'FORBIDDEN'
  run?: {
    id: string
    bizId: string | null
    requestedByUserId: string
    sagaKey: string
    status: 'pending' | 'running' | 'passed' | 'failed' | 'cancelled'
  } | null
}

/**
 * Shared access check for saga run visibility/mutation.
 *
 * Why this is in service layer:
 * - Route handlers, websocket streams, and background workers all need the same
 *   authorization rule. Keeping it centralized prevents drift.
 */
export async function canUserAccessSagaRun(input: {
  userId: string
  platformRole?: string | null
  runId: string
}): Promise<SagaRunAccessResult> {
  const run = await db.query.sagaRuns.findFirst({
    where: eq(sagaRuns.id, input.runId),
    columns: {
      id: true,
      bizId: true,
      requestedByUserId: true,
      sagaKey: true,
      status: true,
    },
  })

  if (!run) {
    return { allowed: false, reason: 'Run not found', code: 'NOT_FOUND', run: null }
  }
  if (input.platformRole === 'admin' || input.platformRole === 'owner') {
    return { allowed: true, run }
  }
  if (run.requestedByUserId === input.userId) {
    return { allowed: true, run }
  }
  if (!run.bizId) {
    return { allowed: false, reason: 'Only run owner can access this run', code: 'FORBIDDEN', run }
  }

  const membership = await ensureBizMembership(input.userId, run.bizId)
  if (!membership) {
    return {
      allowed: false,
      reason: 'You are not a member of this run biz scope',
      code: 'FORBIDDEN',
      run,
    }
  }

  return { allowed: true, run }
}

export async function getSagaDefinitionByKey(sagaKey: string) {
  return db.query.sagaDefinitions.findFirst({
    where: eq(sagaDefinitions.sagaKey, sagaKey),
  })
}

/**
 * Resolve one saga definition and parse its JSON spec payload.
 */
export async function getSagaDefinitionWithSpec(sagaKey: string) {
  const definition = await getSagaDefinitionByKey(sagaKey)
  if (!definition) return null
  const spec = await readSagaSpecFromDefinition(definition)
  return { definition, spec }
}

type SagaDefinitionRevisionRow = {
  id: string
  sagaDefinitionId: string
  revisionNumber: number
  specVersion: string
  specChecksum: string
  specJson: unknown
  sourceFilePath: string | null
  isCurrent: boolean
  metadata: unknown
  createdAt: Date
  updatedAt: Date
}

function defaultDbSpecPath(sagaKey: string) {
  return `db://sagas/specs/${sagaKey}.json`
}

async function getCurrentSagaDefinitionRevision(definitionId: string) {
  try {
    return await db.query.sagaDefinitionRevisions.findFirst({
      where: and(
        eq(sagaDefinitionRevisions.sagaDefinitionId, definitionId),
        eq(sagaDefinitionRevisions.isCurrent, true),
      ),
      orderBy: [desc(sagaDefinitionRevisions.revisionNumber)],
    })
  } catch (error) {
    if (!isMissingRelationError(error)) throw error
    return null
  }
}

async function insertSagaDefinitionRevision(input: {
  definitionId: string
  actorUserId: string
  spec: SagaSpec
  specChecksum: string
  sourceFilePath: string | null
  metadata?: Record<string, unknown>
}) {
  const revisionTableMissing = await (async () => {
    try {
      await db
        .update(sagaDefinitionRevisions)
        .set({ isCurrent: false })
        .where(
          and(
            eq(sagaDefinitionRevisions.sagaDefinitionId, input.definitionId),
            eq(sagaDefinitionRevisions.isCurrent, true),
          ),
        )
      return false
    } catch (error) {
      if (!isMissingRelationError(error)) throw error
      return true
    }
  })()

  if (revisionTableMissing) return null

  const [maxRevisionRow] = await db
    .select({
      max: sql<number>`coalesce(max(${sagaDefinitionRevisions.revisionNumber}), 0)`.mapWith(Number),
    })
    .from(sagaDefinitionRevisions)
    .where(eq(sagaDefinitionRevisions.sagaDefinitionId, input.definitionId))

  const nextRevision = (maxRevisionRow?.max ?? 0) + 1
  const [created] = await db
    .insert(sagaDefinitionRevisions)
    .values({
      sagaDefinitionId: input.definitionId,
      revisionNumber: nextRevision,
      specVersion: input.spec.schemaVersion,
      specChecksum: input.specChecksum,
      specJson: input.spec,
      sourceFilePath: input.sourceFilePath,
      isCurrent: true,
      metadata: input.metadata ?? {},
    })
    .returning()

  return created
}

/**
 * Upsert one saga definition + canonical DB revision.
 *
 * ELI5:
 * - saga_definitions = "header row" (key/title/status/refs).
 * - saga_definition_revisions = full JSON snapshots over time.
 * - this function keeps both in sync so DB is canonical for CRUD.
 */
export async function upsertSagaDefinitionSpec(input: {
  sagaKey?: string
  spec: SagaSpec
  actorUserId: string
  bizId?: string | null
  status?: 'draft' | 'active' | 'archived'
  metadata?: Record<string, unknown>
  sourceFilePath?: string | null
  forceRevision?: boolean
  revisionMetadata?: Record<string, unknown>
}) {
  const parsed = sagaSpecSchema.parse(input.spec)
  if (input.sagaKey && input.sagaKey !== parsed.sagaKey) {
    throw new Error(`sagaKey mismatch: path=${input.sagaKey} body=${parsed.sagaKey}`)
  }

  const serialized = JSON.stringify(parsed)
  const specChecksum = checksum(serialized)
  const sourceFilePath = input.sourceFilePath ?? defaultDbSpecPath(parsed.sagaKey)
  const existing = await getSagaDefinitionByKey(parsed.sagaKey)
  const mergedMetadata =
    input.metadata ??
    (existing?.metadata && typeof existing.metadata === 'object'
      ? (existing.metadata as Record<string, unknown>)
      : {
          tags: parsed.tags,
          generatedAt: parsed.source.generatedAt,
        })

  const [definition] = await db
    .insert(sagaDefinitions)
    .values({
      sagaKey: parsed.sagaKey,
      bizId: input.bizId ?? null,
      title: parsed.title,
      description: parsed.description,
      status: input.status ?? existing?.status ?? 'active',
      sourceUseCaseRef: parsed.source.useCaseRef ?? null,
      sourcePersonaRef: parsed.source.personaRef ?? null,
      sourceUseCaseFile: parsed.source.useCaseFile ?? null,
      sourcePersonaFile: parsed.source.personaFile ?? null,
      specVersion: parsed.schemaVersion,
      specFilePath: sourceFilePath,
      specChecksum,
      metadata: mergedMetadata,
    })
    .onConflictDoUpdate({
      target: sagaDefinitions.sagaKey,
      set: {
        bizId: input.bizId ?? existing?.bizId ?? null,
        title: parsed.title,
        description: parsed.description,
        status: input.status ?? existing?.status ?? 'active',
        sourceUseCaseRef: parsed.source.useCaseRef ?? null,
        sourcePersonaRef: parsed.source.personaRef ?? null,
        sourceUseCaseFile: parsed.source.useCaseFile ?? null,
        sourcePersonaFile: parsed.source.personaFile ?? null,
        specVersion: parsed.schemaVersion,
        specFilePath: sourceFilePath,
        specChecksum,
        metadata: mergedMetadata,
      },
    })
    .returning()

  const currentRevision = await getCurrentSagaDefinitionRevision(definition.id)
  let createdRevision: SagaDefinitionRevisionRow | null = null
  if (
    input.forceRevision ||
    !currentRevision ||
    currentRevision.specChecksum !== specChecksum
  ) {
    createdRevision = (await insertSagaDefinitionRevision({
      definitionId: definition.id,
      actorUserId: input.actorUserId,
      spec: parsed,
      specChecksum,
      sourceFilePath,
      metadata: {
        source: 'api.upsertSagaDefinitionSpec',
        ...(input.revisionMetadata ?? {}),
      },
    })) as SagaDefinitionRevisionRow | null
  }

  const effectiveRevision = createdRevision ?? (currentRevision as SagaDefinitionRevisionRow | null)
  return {
    definition,
    revision: effectiveRevision,
    spec: parsed,
    createdRevision: Boolean(createdRevision),
  }
}

export async function listSagaDefinitionRevisions(input: {
  sagaKey: string
  limit?: number
}) {
  const definition = await getSagaDefinitionByKey(input.sagaKey)
  if (!definition) return null
  const limit = Math.min(Math.max(input.limit ?? 100, 1), 500)
  try {
    const revisions = await db.query.sagaDefinitionRevisions.findMany({
      where: eq(sagaDefinitionRevisions.sagaDefinitionId, definition.id),
      orderBy: [desc(sagaDefinitionRevisions.revisionNumber)],
      limit,
    })
    return { definition, revisions }
  } catch (error) {
    if (!isMissingRelationError(error)) throw error
    return { definition, revisions: [] as SagaDefinitionRevisionRow[] }
  }
}

export async function deleteSagaDefinitionByKey(input: {
  sagaKey: string
  actorUserId: string
}) {
  const definition = await getSagaDefinitionByKey(input.sagaKey)
  if (!definition) return null
  const metadata = definition.metadata && typeof definition.metadata === 'object'
    ? (definition.metadata as Record<string, unknown>)
    : {}
  const [updated] = await db
    .update(sagaDefinitions)
    .set({
      status: 'archived',
      metadata: {
        ...metadata,
        archivedBy: input.actorUserId,
        archivedAt: new Date().toISOString(),
      },
    })
    .where(eq(sagaDefinitions.id, definition.id))
    .returning()
  return updated
}

/**
 * List synced saga definitions.
 */
export async function listSagaDefinitions(params?: {
  status?: 'draft' | 'active' | 'archived'
  search?: string
  limit?: number
}) {
  const limit = Math.min(Math.max(params?.limit ?? 200, 1), 1000)
  return db.query.sagaDefinitions.findMany({
    where: params?.status ? eq(sagaDefinitions.status, params.status) : undefined,
    orderBy: [asc(sagaDefinitions.sagaKey)],
    limit,
  })
}

/**
 * List canonical UC library rows.
 */
export async function listSagaUseCases(params?: {
  status?: "draft" | "active" | "archived"
  limit?: number
}) {
  const limit = Math.min(Math.max(params?.limit ?? 500, 1), 20000)
  return db.query.sagaUseCases.findMany({
    where: params?.status ? eq(sagaUseCases.status, params.status) : undefined,
    orderBy: [asc(sagaUseCases.ucKey)],
    limit,
  })
}

/**
 * List canonical persona library rows.
 */
export async function listSagaPersonas(params?: {
  status?: "draft" | "active" | "archived"
  limit?: number
}) {
  const limit = Math.min(Math.max(params?.limit ?? 500, 1), 20000)
  return db.query.sagaPersonas.findMany({
    where: params?.status ? eq(sagaPersonas.status, params.status) : undefined,
    orderBy: [asc(sagaPersonas.personaKey)],
    limit,
  })
}

/**
 * Get one use-case family with version history.
 */
export async function getSagaUseCaseDetail(ucKey: string) {
  const definition = await db.query.sagaUseCases.findFirst({
    where: eq(sagaUseCases.ucKey, ucKey),
  })
  if (!definition) return null
  const versions = await db.query.sagaUseCaseVersions.findMany({
    where: eq(sagaUseCaseVersions.sagaUseCaseId, definition.id),
    orderBy: [desc(sagaUseCaseVersions.versionNumber)],
    limit: 500,
  })
  return { definition, versions }
}

/**
 * Create one top-level UC definition.
 */
export async function createSagaUseCaseDefinition(input: {
  ucKey: string
  title: string
  actorUserId: string
  status?: "draft" | "active" | "archived"
  summary?: string | null
  sourceFilePath?: string | null
  sourceRef?: string | null
}) {
  const normalizedKey = input.ucKey.trim().toUpperCase()
  if (!normalizedKey) throw new Error("Use case key is required.")
  const existing = await db.query.sagaUseCases.findFirst({
    where: eq(sagaUseCases.ucKey, normalizedKey),
  })
  if (existing) throw new Error(`Use case already exists: ${normalizedKey}`)

  const [created] = await db
    .insert(sagaUseCases)
    .values({
      ucKey: normalizedKey,
      title: input.title.trim(),
      status: input.status ?? "draft",
      summary: input.summary ?? null,
      sourceFilePath: input.sourceFilePath ?? null,
      sourceRef: input.sourceRef ?? null,
      metadata: {},
    })
    .returning()
  return created
}

/**
 * Delete one UC definition and its versions.
 */
export async function deleteSagaUseCaseDefinition(input: {
  ucKey: string
  actorUserId: string
}) {
  const detail = await getSagaUseCaseDetail(input.ucKey)
  if (!detail) return false

  const versionIds = detail.versions.map((row) => row.id)
  if (versionIds.length > 0) {
    await db
      .delete(sagaDefinitionLinks)
      .where(inArray(sagaDefinitionLinks.sagaUseCaseVersionId, versionIds))
    await db
      .delete(sagaTagBindings)
      .where(
        and(
          eq(sagaTagBindings.targetType, "use_case_version"),
          inArray(sagaTagBindings.targetId, versionIds),
        ),
      )
  }
  await db
    .delete(sagaTagBindings)
    .where(
      and(
        eq(sagaTagBindings.targetType, "use_case"),
        eq(sagaTagBindings.targetId, detail.definition.id),
      ),
    )
  await db.delete(sagaUseCases).where(eq(sagaUseCases.id, detail.definition.id))
  return true
}

/**
 * Update top-level use-case definition metadata (not immutable version body).
 */
export async function updateSagaUseCaseDefinition(input: {
  ucKey: string
  actorUserId: string
  title?: string
  status?: "draft" | "active" | "archived"
  summary?: string | null
  sourceFilePath?: string | null
  sourceRef?: string | null
}) {
  const row = await db.query.sagaUseCases.findFirst({
    where: eq(sagaUseCases.ucKey, input.ucKey),
  })
  if (!row) return null

  const [updated] = await db
    .update(sagaUseCases)
    .set({
      title: input.title ?? row.title,
      status: input.status ?? row.status,
      summary: input.summary === undefined ? row.summary : input.summary,
      sourceFilePath:
        input.sourceFilePath === undefined ? row.sourceFilePath : input.sourceFilePath,
      sourceRef: input.sourceRef === undefined ? row.sourceRef : input.sourceRef,
    })
    .where(eq(sagaUseCases.id, row.id))
    .returning()

  return updated
}

/**
 * Create one new immutable UC version.
 */
export async function createSagaUseCaseVersion(input: {
  ucKey: string
  actorUserId: string
  title?: string
  summary?: string | null
  bodyMarkdown: string
  extractedNeeds?: unknown[]
  extractedScenario?: string | null
  isCurrent?: boolean
}) {
  const detail = await getSagaUseCaseDetail(input.ucKey)
  if (!detail) return null

  const nextVersion = (detail.versions[0]?.versionNumber ?? 0) + 1
  const makeCurrent = input.isCurrent ?? true

  if (makeCurrent) {
    await db
      .update(sagaUseCaseVersions)
      .set({ isCurrent: false })
      .where(eq(sagaUseCaseVersions.sagaUseCaseId, detail.definition.id))
  }

  const [version] = await db
    .insert(sagaUseCaseVersions)
    .values({
      sagaUseCaseId: detail.definition.id,
      versionNumber: nextVersion,
      title: input.title ?? detail.definition.title,
      summary: input.summary ?? detail.definition.summary,
      bodyMarkdown: input.bodyMarkdown,
      extractedNeeds: input.extractedNeeds ?? [],
      extractedScenario: input.extractedScenario ?? null,
      contentChecksum: checksum(input.bodyMarkdown),
      isCurrent: makeCurrent,
      publishedAt: new Date(),
      metadata: {},
    })
    .returning()

  return version
}

/**
 * Get one persona family with version history.
 */
export async function getSagaPersonaDetail(personaKey: string) {
  const definition = await db.query.sagaPersonas.findFirst({
    where: eq(sagaPersonas.personaKey, personaKey),
  })
  if (!definition) return null
  const versions = await db.query.sagaPersonaVersions.findMany({
    where: eq(sagaPersonaVersions.sagaPersonaId, definition.id),
    orderBy: [desc(sagaPersonaVersions.versionNumber)],
    limit: 500,
  })
  return { definition, versions }
}

/**
 * Create one top-level persona definition.
 */
export async function createSagaPersonaDefinition(input: {
  personaKey: string
  name: string
  actorUserId: string
  status?: "draft" | "active" | "archived"
  profileSummary?: string | null
  sourceFilePath?: string | null
  sourceRef?: string | null
}) {
  const normalizedKey = input.personaKey.trim().toUpperCase()
  if (!normalizedKey) throw new Error("Persona key is required.")
  const existing = await db.query.sagaPersonas.findFirst({
    where: eq(sagaPersonas.personaKey, normalizedKey),
  })
  if (existing) throw new Error(`Persona already exists: ${normalizedKey}`)

  const [created] = await db
    .insert(sagaPersonas)
    .values({
      personaKey: normalizedKey,
      name: input.name.trim(),
      status: input.status ?? "draft",
      profileSummary: input.profileSummary ?? null,
      sourceFilePath: input.sourceFilePath ?? null,
      sourceRef: input.sourceRef ?? null,
      metadata: {},
    })
    .returning()
  return created
}

/**
 * Delete one persona definition and its versions.
 */
export async function deleteSagaPersonaDefinition(input: {
  personaKey: string
  actorUserId: string
}) {
  const detail = await getSagaPersonaDetail(input.personaKey)
  if (!detail) return false

  const versionIds = detail.versions.map((row) => row.id)
  if (versionIds.length > 0) {
    await db
      .delete(sagaDefinitionLinks)
      .where(inArray(sagaDefinitionLinks.sagaPersonaVersionId, versionIds))
    await db
      .delete(sagaTagBindings)
      .where(
        and(
          eq(sagaTagBindings.targetType, "persona_version"),
          inArray(sagaTagBindings.targetId, versionIds),
        ),
      )
  }
  await db
    .delete(sagaTagBindings)
    .where(
      and(
        eq(sagaTagBindings.targetType, "persona"),
        eq(sagaTagBindings.targetId, detail.definition.id),
      ),
    )
  await db.delete(sagaPersonas).where(eq(sagaPersonas.id, detail.definition.id))
  return true
}

export async function updateSagaPersonaDefinition(input: {
  personaKey: string
  actorUserId: string
  name?: string
  status?: "draft" | "active" | "archived"
  profileSummary?: string | null
  sourceFilePath?: string | null
  sourceRef?: string | null
}) {
  const row = await db.query.sagaPersonas.findFirst({
    where: eq(sagaPersonas.personaKey, input.personaKey),
  })
  if (!row) return null

  const [updated] = await db
    .update(sagaPersonas)
    .set({
      name: input.name ?? row.name,
      status: input.status ?? row.status,
      profileSummary:
        input.profileSummary === undefined ? row.profileSummary : input.profileSummary,
      sourceFilePath:
        input.sourceFilePath === undefined ? row.sourceFilePath : input.sourceFilePath,
      sourceRef: input.sourceRef === undefined ? row.sourceRef : input.sourceRef,
    })
    .where(eq(sagaPersonas.id, row.id))
    .returning()

  return updated
}

export async function createSagaPersonaVersion(input: {
  personaKey: string
  actorUserId: string
  name?: string
  profile?: string | null
  goals?: string | null
  painPoints?: string | null
  testScenarios?: unknown[]
  bodyMarkdown: string
  isCurrent?: boolean
}) {
  const detail = await getSagaPersonaDetail(input.personaKey)
  if (!detail) return null

  const nextVersion = (detail.versions[0]?.versionNumber ?? 0) + 1
  const makeCurrent = input.isCurrent ?? true

  if (makeCurrent) {
    await db
      .update(sagaPersonaVersions)
      .set({ isCurrent: false })
      .where(eq(sagaPersonaVersions.sagaPersonaId, detail.definition.id))
  }

  const [version] = await db
    .insert(sagaPersonaVersions)
    .values({
      sagaPersonaId: detail.definition.id,
      versionNumber: nextVersion,
      name: input.name ?? detail.definition.name,
      profile: input.profile ?? null,
      goals: input.goals ?? null,
      painPoints: input.painPoints ?? null,
      testScenarios: input.testScenarios ?? [],
      bodyMarkdown: input.bodyMarkdown,
      contentChecksum: checksum(input.bodyMarkdown),
      isCurrent: makeCurrent,
      publishedAt: new Date(),
      metadata: {},
    })
    .returning()

  return version
}

/**
 * List run actor virtual identities for one run.
 */
export async function listSagaRunActorProfiles(runId: string) {
  return db.query.sagaRunActorProfiles.findMany({
    where: eq(sagaRunActorProfiles.sagaRunId, runId),
    orderBy: [asc(sagaRunActorProfiles.actorKey)],
  })
}

/**
 * List simulated messages for one run (optionally filter by actor key).
 */
export async function listSagaRunActorMessages(runId: string, actorKey?: string) {
  const profiles = await listSagaRunActorProfiles(runId)
  const profileById = new Map(profiles.map((row) => [row.id, row]))
  const actorFilteredIds = actorKey
    ? profiles.filter((row) => row.actorKey === actorKey).map((row) => row.id)
    : []
  if (actorKey && actorFilteredIds.length === 0) {
    return []
  }

  const messages = await db.query.sagaRunActorMessages.findMany({
    where:
      actorKey && actorFilteredIds.length > 0
        ? inArray(sagaRunActorMessages.toActorProfileId, actorFilteredIds)
        : eq(sagaRunActorMessages.sagaRunId, runId),
    orderBy: [asc(sagaRunActorMessages.queuedAt)],
    limit: 5000,
  })

  return messages.map((message) => ({
    ...message,
    fromActorKey: message.fromActorProfileId
      ? (profileById.get(message.fromActorProfileId)?.actorKey ?? null)
      : null,
    toActorKey: profileById.get(message.toActorProfileId)?.actorKey ?? null,
  }))
}

/**
 * Simulate sending one virtual message to a run actor.
 */
export async function createSagaRunActorMessage(input: {
  runId: string
  actorUserId: string
  stepKey?: string
  fromActorKey?: string | null
  toActorKey: string
  channel: "email" | "sms" | "push" | "in_app"
  subject?: string | null
  bodyText: string
  status?: "queued" | "sent" | "delivered" | "read" | "failed" | "cancelled"
  metadata?: Record<string, unknown>
}) {
  const run = await db.query.sagaRuns.findFirst({
    where: eq(sagaRuns.id, input.runId),
  })
  if (!run) throw new Error(`Saga run not found: ${input.runId}`)

  const profiles = await listSagaRunActorProfiles(input.runId)
  const toProfile = profiles.find((row) => row.actorKey === input.toActorKey)
  if (!toProfile) {
    throw new Error(`Target actor profile not found for actorKey=${input.toActorKey}`)
  }
  const fromProfile = input.fromActorKey
    ? profiles.find((row) => row.actorKey === input.fromActorKey) ?? null
    : null

  const stepId = input.stepKey
    ? (
        await db.query.sagaRunSteps.findFirst({
          where: and(
            eq(sagaRunSteps.sagaRunId, input.runId),
            eq(sagaRunSteps.stepKey, input.stepKey),
          ),
        })
      )?.id
    : null

  const now = new Date()
  const nextStatus = input.status ?? "delivered"
  const [row] = await db
    .insert(sagaRunActorMessages)
    .values({
      sagaRunId: input.runId,
      sagaRunStepId: stepId ?? null,
      channel: input.channel,
      status: nextStatus,
      fromActorProfileId: fromProfile?.id ?? null,
      toActorProfileId: toProfile.id,
      subject: input.subject ?? null,
      bodyText: input.bodyText,
      providerMessageRef: `${input.channel}:${input.runId.slice(-8)}:${Date.now()}`,
      queuedAt: now,
      sentAt: nextStatus === "queued" ? null : now,
      deliveredAt: nextStatus === "delivered" || nextStatus === "read" ? now : null,
      readAt: nextStatus === "read" ? now : null,
      failedAt: nextStatus === "failed" ? now : null,
      metadata: input.metadata ?? {},
    })
    .returning()

  return row
}

type SagaLibraryRelationKind = "use_case" | "persona"

/**
 * Resolve one library node and all linked saga definitions.
 *
 * ELI5:
 * Given a UC/persona key, return:
 * 1) the canonical library row,
 * 2) its versions,
 * 3) every saga definition currently linked to those versions.
 *
 * This powers dashboard exploration so humans can answer:
 * "Which runnable sagas are attached to this design artifact?"
 */
export async function getSagaLibraryRelations(input: {
  kind: SagaLibraryRelationKind
  key: string
}) {
  const key = input.key.trim()
  if (!key) return null

  if (input.kind === "use_case") {
    const node = await db.query.sagaUseCases.findFirst({
      where: eq(sagaUseCases.ucKey, key),
    })
    if (!node) return null

    const versions = await db.query.sagaUseCaseVersions.findMany({
      where: eq(sagaUseCaseVersions.sagaUseCaseId, node.id),
      orderBy: [desc(sagaUseCaseVersions.versionNumber)],
      limit: 200,
    })
    const versionIds = versions.map((row) => row.id)
    const links = versionIds.length
      ? await db.query.sagaDefinitionLinks.findMany({
          where: inArray(sagaDefinitionLinks.sagaUseCaseVersionId, versionIds),
          orderBy: [asc(sagaDefinitionLinks.relationRole)],
          limit: 5000,
        })
      : []

    const definitionIds = Array.from(new Set(links.map((row) => row.sagaDefinitionId)))
    const definitions = definitionIds.length
      ? await db.query.sagaDefinitions.findMany({
          where: inArray(sagaDefinitions.id, definitionIds),
          orderBy: [asc(sagaDefinitions.sagaKey)],
          limit: 5000,
        })
      : []

    return {
      kind: input.kind,
      node,
      versions,
      links,
      definitions,
    }
  }

  if (input.kind === "persona") {
    const node = await db.query.sagaPersonas.findFirst({
      where: eq(sagaPersonas.personaKey, key),
    })
    if (!node) return null

    const versions = await db.query.sagaPersonaVersions.findMany({
      where: eq(sagaPersonaVersions.sagaPersonaId, node.id),
      orderBy: [desc(sagaPersonaVersions.versionNumber)],
      limit: 200,
    })
    const versionIds = versions.map((row) => row.id)
    const links = versionIds.length
      ? await db.query.sagaDefinitionLinks.findMany({
          where: inArray(sagaDefinitionLinks.sagaPersonaVersionId, versionIds),
          orderBy: [asc(sagaDefinitionLinks.relationRole)],
          limit: 5000,
        })
      : []

    const definitionIds = Array.from(new Set(links.map((row) => row.sagaDefinitionId)))
    const definitions = definitionIds.length
      ? await db.query.sagaDefinitions.findMany({
          where: inArray(sagaDefinitions.id, definitionIds),
          orderBy: [asc(sagaDefinitions.sagaKey)],
          limit: 5000,
        })
      : []

    return {
      kind: input.kind,
      node,
      versions,
      links,
      definitions,
    }
  }

  return null
}

/**
 * List coverage reports with optional run/definition filters.
 */
export async function listSagaCoverageReports(params?: {
  sagaRunId?: string
  sagaDefinitionId?: string
  scopeType?: string
  limit?: number
}) {
  const limit = Math.min(Math.max(params?.limit ?? 200, 1), 1000)
  return db.query.sagaCoverageReports.findMany({
    where: and(
      params?.sagaRunId ? eq(sagaCoverageReports.sagaRunId, params.sagaRunId) : undefined,
      params?.sagaDefinitionId
        ? eq(sagaCoverageReports.sagaDefinitionId, params.sagaDefinitionId)
        : undefined,
      params?.scopeType ? eq(sagaCoverageReports.scopeType, params.scopeType) : undefined,
    ),
    orderBy: [desc(sagaCoverageReports.id)],
    limit,
  })
}

/**
 * Get full coverage report with items and tag bindings.
 */
export async function getSagaCoverageReportDetail(reportId: string) {
  const report = await db.query.sagaCoverageReports.findFirst({
    where: eq(sagaCoverageReports.id, reportId),
  })
  if (!report) return null

  const [items, bindings, tags] = await Promise.all([
    db.query.sagaCoverageItems.findMany({
      where: eq(sagaCoverageItems.sagaCoverageReportId, reportId),
      orderBy: [asc(sagaCoverageItems.itemType), asc(sagaCoverageItems.itemRefKey)],
    }),
    db.query.sagaTagBindings.findMany({
      where: and(
        eq(sagaTagBindings.targetType, "coverage_report"),
        eq(sagaTagBindings.targetId, reportId),
      ),
    }),
    db.query.sagaTags.findMany({
      orderBy: [asc(sagaTags.tagKey)],
      limit: 5000,
    }),
  ])

  const tagsById = new Map(tags.map((tag) => [tag.id, tag]))
  const reportTags = bindings
    .map((binding) => tagsById.get(binding.sagaTagId))
    .filter(Boolean)

  const itemIds = items.map((item) => item.id)
  const itemBindings = itemIds.length
    ? await db.query.sagaTagBindings.findMany({
        where: and(
          eq(sagaTagBindings.targetType, "coverage_item"),
          inArray(sagaTagBindings.targetId, itemIds),
        ),
      })
    : []
  const itemBindingsByItemId = new Map<string, string[]>()
  for (const binding of itemBindings) {
    const list = itemBindingsByItemId.get(binding.targetId) ?? []
    list.push(binding.sagaTagId)
    itemBindingsByItemId.set(binding.targetId, list)
  }

  const enrichedItems = items.map((item) => ({
    ...item,
    tags: (itemBindingsByItemId.get(item.id) ?? [])
      .map((tagId) => tagsById.get(tagId)?.tagKey)
      .filter(Boolean),
  }))

  return {
    report,
    items: enrichedItems,
    tags: reportTags,
  }
}

/**
 * Hard-reset all saga loop data.
 *
 * ELI5:
 * This wipes UCs/personas/definitions/runs/coverage/tags so you can
 * rebuild from canonical docs with zero leftover state.
 */
export async function resetSagaLoopData() {
  await db.execute(sql`
    TRUNCATE TABLE
      "saga_run_actor_messages",
      "saga_run_actor_profiles",
      "saga_run_artifacts",
      "saga_run_steps",
      "saga_runs",
      "saga_definition_revisions",
      "saga_definition_links",
      "saga_definitions",
      "saga_use_case_versions",
      "saga_use_cases",
      "saga_persona_versions",
      "saga_personas",
      "saga_coverage_items",
      "saga_coverage_reports",
      "saga_tag_bindings",
      "saga_tags"
    RESTART IDENTITY CASCADE
  `)
}

/**
 * Import one schema coverage markdown into normalized coverage tables.
 *
 * Important:
 * - scope_type is `schema_baseline` so it never mixes with run-based coverage.
 * - report/item tags are persisted for filter-first dashboards.
 */
export async function importSchemaCoverageReportFromMarkdown(input?: {
  coverageFile?: string
  replaceExisting?: boolean
  actorUserId?: string
}) {
  const coverageFile = input?.coverageFile || DEFAULT_SCHEMA_COVERAGE_FILE
  const replaceExisting = input?.replaceExisting ?? true
  const parsed = await parseSchemaCoverageReportFromMarkdown(coverageFile)

  if (replaceExisting) {
    const existingReports = await db.query.sagaCoverageReports.findMany({
      where: eq(sagaCoverageReports.scopeType, "schema_baseline"),
      columns: { id: true },
      limit: 1000,
    })
    const reportIds = existingReports.map((row) => row.id)
    if (reportIds.length > 0) {
      const existingItems = await db.query.sagaCoverageItems.findMany({
        where: inArray(sagaCoverageItems.sagaCoverageReportId, reportIds),
        columns: { id: true },
        limit: 20000,
      })
      const itemIds = existingItems.map((row) => row.id)
      if (itemIds.length > 0) {
        await db
          .delete(sagaTagBindings)
          .where(
            and(
              eq(sagaTagBindings.targetType, "coverage_item"),
              inArray(sagaTagBindings.targetId, itemIds),
            ),
          )
      }
      await db
        .delete(sagaTagBindings)
        .where(
          and(
            eq(sagaTagBindings.targetType, "coverage_report"),
            inArray(sagaTagBindings.targetId, reportIds),
          ),
        )
      await db
        .delete(sagaCoverageItems)
        .where(inArray(sagaCoverageItems.sagaCoverageReportId, reportIds))
      await db
        .delete(sagaCoverageReports)
        .where(inArray(sagaCoverageReports.id, reportIds))
    }
  }

  const fullPct =
    parsed.totalUseCases > 0
      ? Math.round((parsed.summaryCounts.full / parsed.totalUseCases) * 100)
      : 0
  const strongOrBetterPct =
    parsed.totalUseCases > 0
      ? Math.round(
          ((parsed.summaryCounts.full + parsed.summaryCounts.strong) / parsed.totalUseCases) * 100,
        )
      : 0

  const [report] = await db
    .insert(sagaCoverageReports)
    .values({
      sagaRunId: null,
      sagaDefinitionId: null,
      scopeType: "schema_baseline",
      status: "published",
      title: parsed.title,
      summary: `Schema baseline coverage imported from markdown (${parsed.totalUseCases} UCs).`,
      reportMarkdown: parsed.markdown,
      coveragePct: strongOrBetterPct,
      strongPct: strongOrBetterPct,
      fullPct,
      reportData: {
        sourceFilePath: parsed.sourceFilePath,
        sourceChecksum: parsed.sourceChecksum,
        totals: {
          totalUseCases: parsed.totalUseCases,
          full: parsed.summaryCounts.full,
          strong: parsed.summaryCounts.strong,
          partial: parsed.summaryCounts.partial,
          gap: parsed.summaryCounts.gap,
        },
        scaleSummary: parsed.scaleSummary,
      },
      metadata: {
        source: "schema_coverage_markdown_import",
      },
    })
    .returning()

  const itemRows = parsed.useCases.map((row) => ({
    sagaCoverageReportId: report.id,
    sagaRunStepId: null,
    itemType: "use_case",
    itemRefKey: row.ucRef,
    itemTitle: row.ucTitle,
    verdict: row.verdictTag.replace(/^#/, ""),
    nativeToHacky: row.nativeToHackyTag.replace(/^#/, ""),
    coreToExtension: row.coreToExtensionTag.replace(/^#/, ""),
    explanation: row.explanation,
    evidence: {
      sourceLink: row.sourceLink,
    },
    metadata: {},
  }))

  const insertedItems =
    itemRows.length > 0
      ? await db.insert(sagaCoverageItems).values(itemRows).returning()
      : []

  const reportTags = new Set<string>([
    "#schema-coverage",
    "#schema-baseline",
    "#full",
    "#strong",
    "#partial",
    "#gap",
  ])
  for (const row of parsed.useCases) {
    reportTags.add(row.verdictTag)
    reportTags.add(row.nativeToHackyTag)
    reportTags.add(row.coreToExtensionTag)
  }

  const tagsByKey = new Map<string, string>()
  for (const tagKey of reportTags) {
    const tag = await ensureSagaTag(tagKey, input?.actorUserId)
    tagsByKey.set(tag.tagKey, tag.id)
    await bindSagaTag({
      tagId: tag.id,
      targetType: "coverage_report",
      targetId: report.id,
      actorUserId: input?.actorUserId,
    })
  }

  const rowByUc = new Map(parsed.useCases.map((row) => [row.ucRef, row]))
  for (const item of insertedItems) {
    const source = rowByUc.get(item.itemRefKey)
    if (!source) continue
    const itemTagKeys = [source.verdictTag, source.nativeToHackyTag, source.coreToExtensionTag]
    for (const key of itemTagKeys) {
      const tag = await ensureSagaTag(key, input?.actorUserId)
      await bindSagaTag({
        tagId: tag.id,
        targetType: "coverage_item",
        targetId: item.id,
        actorUserId: input?.actorUserId,
      })
    }
  }

  return {
    reportId: report.id,
    scopeType: report.scopeType,
    totalUseCases: parsed.totalUseCases,
    summaryCounts: parsed.summaryCounts,
    avgN2h: parsed.scaleSummary.avgN2h,
    avgC2e: parsed.scaleSummary.avgC2e,
  }
}

/**
 * Create one run and materialize all phase/step rows from the spec file.
 */
export async function createSagaRun(input: CreateSagaRunInput) {
  const definition = await getSagaDefinitionByKey(input.sagaKey)
  if (!definition) {
    throw new Error(`Saga definition not found for key: ${input.sagaKey}`)
  }

  const spec = await readSagaSpecFromDefinition(definition)
  const steps = spec.phases.flatMap((phase) =>
    phase.steps.map((step) => ({
      phaseKey: phase.phaseKey,
      phaseOrder: phase.order,
      phaseTitle: phase.title,
      stepKey: step.stepKey,
      stepOrder: step.order,
      actorKey: step.actorKey,
      stepTitle: step.title,
      stepIntent: step.intent,
      instruction: step.instruction,
      expectedResult: step.expectedResult,
      delayMode: step.delay?.mode ?? "none",
      delayMs: step.delay?.mode === "fixed" ? (step.delay.delayMs ?? null) : null,
      delayConditionKey:
        step.delay?.mode === "until_condition" ? (step.delay.conditionKey ?? null) : null,
      delayTimeoutMs:
        step.delay?.mode === "until_condition" ? (step.delay.timeoutMs ?? null) : null,
      delayPollMs: step.delay?.mode === "until_condition" ? (step.delay.pollMs ?? null) : null,
      delayJitterMs: step.delay?.jitterMs ?? 0,
      stepToolHints: step.toolHints,
      stepTags: step.tags,
      stepDelay: step.delay ?? { mode: "none", jitterMs: 0 },
    })),
  )

  const [createdRun] = await db
    .insert(sagaRuns)
    .values({
      sagaDefinitionId: definition.id,
      sagaKey: definition.sagaKey,
      bizId: input.bizId,
      status: 'pending',
      mode: input.mode ?? spec.defaults.runMode,
      requestedByUserId: input.requestedByUserId,
      runnerLabel: input.runnerLabel,
      definitionChecksum: definition.specChecksum,
      totalSteps: steps.length,
      passedSteps: 0,
      failedSteps: 0,
      skippedSteps: 0,
      runContext: input.runContext ?? {},
      runSummary: {},
      metadata: {
        title: spec.title,
        tags: spec.tags,
      },
    })
    .returning()

  if (steps.length > 0) {
    await db.insert(sagaRunSteps).values(
      steps.map((step) => ({
        sagaRunId: createdRun.id,
        ...step,
        status: 'pending' as const,
        attemptCount: 0,
        resultPayload: {},
        assertionSummary: {},
        metadata: {
          title: step.stepTitle,
          intent: step.stepIntent,
          toolHints: step.stepToolHints,
          tags: step.stepTags,
          delay: step.stepDelay,
        },
      })),
    )
  }

  if (spec.actors.length > 0) {
    const actorUsers = (input.runContext?.actorUsers as Record<string, unknown> | undefined) ?? {}
    await db.insert(sagaRunActorProfiles).values(
      spec.actors.map((actor) => ({
        sagaRunId: createdRun.id,
        actorKey: actor.actorKey,
        actorName: actor.name,
        actorRole: actor.role,
        personaRef: actor.personaRef ?? null,
        linkedUserId:
          typeof actorUsers[actor.actorKey] === "string"
            ? String(actorUsers[actor.actorKey])
            : null,
        virtualEmail: virtualEmailForActor(createdRun.id, actor.actorKey),
        virtualPhone: virtualPhoneForActor(createdRun.id, actor.actorKey),
        channelPreferences: {},
        metadata: {
          description: actor.description ?? null,
        },
      })),
    )
  }

  await ensureSagaRunDirectories(createdRun.id)
  publishSagaRuntimeEvent({
    eventType: 'run.created',
    runId: createdRun.id,
    sagaKey: createdRun.sagaKey,
    bizId: createdRun.bizId,
    requestedByUserId: createdRun.requestedByUserId,
    status: createdRun.status,
    payload: {
      totalSteps: steps.length,
      mode: createdRun.mode,
      runnerLabel: createdRun.runnerLabel,
    },
  })
  return getSagaRunDetail(createdRun.id)
}

async function ensureSagaRunDirectories(runId: string) {
  await ensureSagaFilesystem()
  await Promise.all([
    fs.mkdir(path.join(SAGA_RUNS_DIR, runId), { recursive: true }),
    fs.mkdir(path.join(SAGA_RUNS_DIR, runId, 'snapshots'), { recursive: true }),
    fs.mkdir(path.join(SAGA_RUNS_DIR, runId, 'artifacts'), { recursive: true }),
  ])
}

type SagaRunCoverageClassification = 'full' | 'partial' | 'gap'

type SagaRunIntegrity = {
  classification: SagaRunCoverageClassification
  stepFailures: Array<{ stepKey: string; reason: string }>
  missingEvidence: Array<{ stepKey: string; missingKinds: string[] }>
  notImplementedStepCount: number
  apiFailureStepCount: number
}

function deriveCoverageVerdict(input: {
  classification: SagaRunCoverageClassification
  completionPct: number
  stepFailuresCount: number
}) {
  if (input.classification === "full") return "full"
  if (input.completionPct >= 70 && input.stepFailuresCount <= 2) return "strong"
  if (input.classification === "partial") return "partial"
  return "gap"
}

function deriveNativeToHacky(input: {
  verdict: "full" | "strong" | "partial" | "gap"
  notImplementedStepCount: number
  missingEvidenceStepCount: number
}) {
  if (input.notImplementedStepCount > 3) return "hacky"
  if (input.notImplementedStepCount > 0) return "workaround-heavy"
  if (input.verdict === "full") return "native"
  if (input.verdict === "strong") return "mostly-native"
  if (input.missingEvidenceStepCount > 0) return "mixed-model"
  return "mixed-model"
}

function deriveCoreToExtension(input: {
  verdict: "full" | "strong" | "partial" | "gap"
  apiFailureStepCount: number
  notImplementedStepCount: number
}) {
  if (input.notImplementedStepCount > 4) return "extension-driven"
  if (input.notImplementedStepCount > 0 || input.apiFailureStepCount > 2) return "extension-heavy"
  if (input.verdict === "full") return "core-native"
  if (input.verdict === "strong") return "core-first"
  return "balanced-core-extension"
}

function virtualEmailForActor(runId: string, actorKey: string) {
  const safeActor = slugify(actorKey) || "actor"
  return `${safeActor}.${runId.slice(-10)}@saga.virtual.bizing.test`
}

function virtualPhoneForActor(runId: string, actorKey: string) {
  const hex = createHash("sha256").update(`${runId}:${actorKey}`).digest("hex")
  let digits = ""
  for (const char of hex) {
    digits += String(parseInt(char, 16) % 10)
  }
  // +1 plus 10 pseudo-random deterministic digits.
  const local = digits.slice(0, 10).padEnd(10, "0")
  return `+1${local}`
}

async function ensureSagaTag(tagKey: string, actorUserId?: string) {
  const normalized = ensureTagHashPrefix(tagKey)
  const existing = await db.query.sagaTags.findFirst({
    where: eq(sagaTags.tagKey, normalized),
  })
  if (existing) return existing

  const [created] = await db
    .insert(sagaTags)
    .values({
      tagKey: normalized,
      label: normalized,
      category: "coverage",
      metadata: {},
    })
    .onConflictDoNothing()
    .returning()

  if (created) return created
  const fallback = await db.query.sagaTags.findFirst({
    where: eq(sagaTags.tagKey, normalized),
  })
  if (!fallback) throw new Error(`Failed to create or fetch saga tag: ${normalized}`)
  return fallback
}

async function bindSagaTag(input: {
  tagId: string
  targetType:
    | "use_case"
    | "use_case_version"
    | "persona"
    | "persona_version"
    | "saga_definition"
    | "saga_run"
    | "coverage_report"
    | "coverage_item"
  targetId: string
  actorUserId?: string
}) {
  await db
    .insert(sagaTagBindings)
    .values({
      sagaTagId: input.tagId,
      targetType: input.targetType,
      targetId: input.targetId,
      metadata: {},
    })
    .onConflictDoNothing()
}

async function upsertCoverageForRun(input: {
  run: Awaited<ReturnType<typeof db.query.sagaRuns.findFirst>>
  integrity: SagaRunIntegrity
  completionPct: number
  totalSteps: number
  passedSteps: number
  failedSteps: number
  skippedSteps: number
  pendingSteps: number
  inProgressSteps: number
  actorUserId?: string
}) {
  if (!input.run) return
  const run = input.run
  const verdict = deriveCoverageVerdict({
    classification: input.integrity.classification,
    completionPct: input.completionPct,
    stepFailuresCount: input.integrity.stepFailures.length,
  })
  const nativeToHacky = deriveNativeToHacky({
    verdict,
    notImplementedStepCount: input.integrity.notImplementedStepCount,
    missingEvidenceStepCount: input.integrity.missingEvidence.length,
  })
  const coreToExtension = deriveCoreToExtension({
    verdict,
    apiFailureStepCount: input.integrity.apiFailureStepCount,
    notImplementedStepCount: input.integrity.notImplementedStepCount,
  })

  const [report] = await db
    .insert(sagaCoverageReports)
    .values({
      bizId: run.bizId,
      sagaRunId: run.id,
      sagaDefinitionId: run.sagaDefinitionId,
      scopeType: "run",
      status: "published",
      title: `Coverage • ${run.sagaKey} • ${run.id}`,
      summary: `Run coverage verdict: ${verdict}`,
      reportMarkdown: [
        `# Coverage Report`,
        ``,
        `- Run: \`${run.id}\``,
        `- Saga: \`${run.sagaKey}\``,
        `- Verdict: \`${verdict}\``,
        `- Completion: \`${input.completionPct}%\``,
      ].join("\n"),
      coveragePct: input.completionPct,
      strongPct: verdict === "full" || verdict === "strong" ? input.completionPct : 0,
      fullPct: verdict === "full" ? 100 : 0,
      reportData: {
        verdict,
        nativeToHacky,
        coreToExtension,
        totals: {
          totalSteps: input.totalSteps,
          passedSteps: input.passedSteps,
          failedSteps: input.failedSteps,
          skippedSteps: input.skippedSteps,
          pendingSteps: input.pendingSteps,
          inProgressSteps: input.inProgressSteps,
        },
      },
      metadata: {
        source: "refreshSagaRunStatus",
      },
    })
    .onConflictDoUpdate({
      target: sagaCoverageReports.sagaRunId,
      set: {
        sagaDefinitionId: run.sagaDefinitionId,
        scopeType: "run",
        status: "published",
        title: `Coverage • ${run.sagaKey} • ${run.id}`,
        summary: `Run coverage verdict: ${verdict}`,
        coveragePct: input.completionPct,
        strongPct: verdict === "full" || verdict === "strong" ? input.completionPct : 0,
        fullPct: verdict === "full" ? 100 : 0,
        reportData: {
          verdict,
          nativeToHacky,
          coreToExtension,
          totals: {
            totalSteps: input.totalSteps,
            passedSteps: input.passedSteps,
            failedSteps: input.failedSteps,
            skippedSteps: input.skippedSteps,
            pendingSteps: input.pendingSteps,
            inProgressSteps: input.inProgressSteps,
          },
        },
        metadata: {
          source: "refreshSagaRunStatus",
        },
      },
    })
    .returning()

  if (!report) return

  await db.delete(sagaCoverageItems).where(eq(sagaCoverageItems.sagaCoverageReportId, report.id))

  const overallItem = {
    sagaCoverageReportId: report.id,
    sagaRunStepId: null,
    itemType: "saga_run",
    itemRefKey: run.id,
    itemTitle: run.sagaKey,
    verdict,
    nativeToHacky,
    coreToExtension,
    explanation: `Coverage summary for run ${run.id}.`,
    evidence: {
      stepFailures: input.integrity.stepFailures,
      missingEvidence: input.integrity.missingEvidence,
      notImplementedStepCount: input.integrity.notImplementedStepCount,
      apiFailureStepCount: input.integrity.apiFailureStepCount,
    },
    metadata: {},
  }

  const failureStepRows = await db.query.sagaRunSteps.findMany({
    where: and(eq(sagaRunSteps.sagaRunId, run.id), sql`${sagaRunSteps.status} IN ('failed', 'blocked')`),
    columns: {
      id: true,
      stepKey: true,
      failureMessage: true,
      status: true,
    },
  })
  const failureItems = failureStepRows.map((step) => ({
    sagaCoverageReportId: report.id,
    sagaRunStepId: step.id,
    itemType: "saga_step",
    itemRefKey: step.stepKey,
    itemTitle: step.stepKey,
    verdict: "gap" as const,
    nativeToHacky: input.integrity.notImplementedStepCount > 0 ? "workaround-heavy" : "mixed-model",
    coreToExtension: "extension-heavy",
    explanation: step.failureMessage || `Step status is ${step.status}.`,
    evidence: {
      status: step.status,
      failureMessage: step.failureMessage,
    },
    metadata: {},
  }))

  const defLinks = await db.query.sagaDefinitionLinks.findMany({
    where: eq(sagaDefinitionLinks.sagaDefinitionId, run.sagaDefinitionId),
  })
  const scopeItems = defLinks.flatMap((link) => {
    const rows: Array<{
      sagaCoverageReportId: string
      sagaRunStepId: string | null
      itemType: string
      itemRefKey: string
      itemTitle: string | null
      verdict: "full" | "strong" | "partial" | "gap"
      nativeToHacky: string
      coreToExtension: string
      explanation: string
      evidence: Record<string, unknown>
      metadata: Record<string, unknown>
    }> = []
    if (link.sagaUseCaseVersionId) {
      rows.push({
        sagaCoverageReportId: report.id,
        sagaRunStepId: null,
        itemType: "use_case",
        itemRefKey: link.sagaUseCaseVersionId,
        itemTitle: null,
        verdict,
        nativeToHacky,
        coreToExtension,
        explanation: "Use case coverage inferred from linked saga execution.",
        evidence: {},
        metadata: {},
      })
    }
    if (link.sagaPersonaVersionId) {
      rows.push({
        sagaCoverageReportId: report.id,
        sagaRunStepId: null,
        itemType: "persona",
        itemRefKey: link.sagaPersonaVersionId,
        itemTitle: null,
        verdict,
        nativeToHacky,
        coreToExtension,
        explanation: "Persona coverage inferred from linked saga execution.",
        evidence: {},
        metadata: {},
      })
    }
    return rows
  })

  const coverageItemsSeed = [overallItem, ...failureItems, ...scopeItems]
  const dedupedCoverageItems = Array.from(
    coverageItemsSeed.reduce((map, item) => {
      const key = `${item.itemType}:${item.itemRefKey}`
      if (!map.has(key)) {
        map.set(key, item)
      } else {
        const existing = map.get(key)!
        // Prefer the most severe verdict when duplicate links map to same item.
        const rank = (value: string) => {
          if (value === "gap") return 4
          if (value === "partial") return 3
          if (value === "strong") return 2
          if (value === "full") return 1
          return 0
        }
        if (rank(item.verdict) >= rank(existing.verdict)) {
          map.set(key, item)
        }
      }
      return map
    }, new Map<string, (typeof coverageItemsSeed)[number]>()),
  ).map((entry) => entry[1])

  const insertedItems = await db
    .insert(sagaCoverageItems)
    .values(dedupedCoverageItems)
    .onConflictDoUpdate({
      target: [
        sagaCoverageItems.sagaCoverageReportId,
        sagaCoverageItems.itemType,
        sagaCoverageItems.itemRefKey,
      ],
      set: {
        sagaRunStepId: sql`excluded.saga_run_step_id`,
        itemTitle: sql`excluded.item_title`,
        verdict: sql`excluded.verdict`,
        nativeToHacky: sql`excluded.native_to_hacky`,
        coreToExtension: sql`excluded.core_to_extension`,
        explanation: sql`excluded.explanation`,
        evidence: sql`excluded.evidence`,
        metadata: sql`excluded.metadata`,
      },
    })
    .returning()

  const tagKeys = [
    `#${verdict}`,
    `#${nativeToHacky}`,
    `#${coreToExtension}`,
  ]
  for (const tagKey of tagKeys) {
    const tag = await ensureSagaTag(tagKey, input.actorUserId)
    await bindSagaTag({
      tagId: tag.id,
      targetType: "coverage_report",
      targetId: report.id,
      actorUserId: input.actorUserId,
    })
    for (const item of insertedItems) {
      await bindSagaTag({
        tagId: tag.id,
        targetType: "coverage_item",
        targetId: item.id,
        actorUserId: input.actorUserId,
      })
    }
  }
}

async function computeRunIntegrity(runId: string): Promise<SagaRunIntegrity> {
  const detail = await getSagaRunDetail(runId)
  if (!detail) {
    return {
      classification: 'gap',
      stepFailures: [],
      missingEvidence: [],
      notImplementedStepCount: 0,
      apiFailureStepCount: 0,
    }
  }

  const specStepByKey = new Map(
    (detail.spec?.phases ?? []).flatMap((phase) =>
      phase.steps.map((step) => [step.stepKey, step] as const),
    ),
  )
  const artifactKindsByStepId = new Map<string, Set<string>>()
  for (const artifact of detail.artifacts) {
    if (!artifact.sagaRunStepId) continue
    const bucket = artifactKindsByStepId.get(artifact.sagaRunStepId) ?? new Set<string>()
    bucket.add(artifact.artifactType)
    artifactKindsByStepId.set(artifact.sagaRunStepId, bucket)
  }

  const stepFailures: Array<{ stepKey: string; reason: string }> = []
  const missingEvidence: Array<{ stepKey: string; missingKinds: string[] }> = []
  let notImplementedStepCount = 0
  let apiFailureStepCount = 0
  let passedSteps = 0

  for (const step of detail.steps) {
    if (step.status === 'passed') passedSteps += 1

    const lowerFailure = String(step.failureMessage ?? '').toLowerCase()
    if (lowerFailure.includes('no executor mapping') || lowerFailure.includes('not implemented')) {
      notImplementedStepCount += 1
    }
    if (lowerFailure.includes('http 4') || lowerFailure.includes('http 5')) {
      apiFailureStepCount += 1
    }

    if (step.status === 'failed' || step.status === 'blocked') {
      stepFailures.push({
        stepKey: step.stepKey,
        reason: step.failureMessage || step.failureCode || step.status,
      })
    }

    if (step.status !== 'passed') continue
    const specStep = specStepByKey.get(step.stepKey)
    const requiredKinds = (specStep?.evidenceRequired ?? []).map((item) => item.kind)
    if (requiredKinds.length === 0) continue

    const presentKinds = artifactKindsByStepId.get(step.id) ?? new Set<string>()
    const missingKinds = requiredKinds.filter((kind) => {
      if (kind === 'report_note') {
        const note = (step.resultPayload as Record<string, unknown> | null | undefined)?.note
        return !(typeof note === 'string' && note.trim().length > 0)
      }
      if (kind === 'event_ref') {
        const eventRef =
          (step.assertionSummary as Record<string, unknown> | null | undefined)?.eventRef ??
          (step.resultPayload as Record<string, unknown> | null | undefined)?.eventRef
        return !(typeof eventRef === 'string' && eventRef.trim().length > 0)
      }
      if (kind === 'snapshot') return !presentKinds.has('snapshot')
      if (kind === 'api_trace') return !presentKinds.has('api_trace')
      return false
    })

    if (missingKinds.length > 0) {
      missingEvidence.push({ stepKey: step.stepKey, missingKinds })
      stepFailures.push({
        stepKey: step.stepKey,
        reason: `Missing required evidence: ${missingKinds.join(', ')}`,
      })
    }
  }

  const totalSteps = detail.steps.length
  const classification: SagaRunCoverageClassification =
    stepFailures.length === 0 && passedSteps === totalSteps
      ? 'full'
      : passedSteps > 0
        ? 'partial'
        : 'gap'

  return {
    classification,
    stepFailures,
    missingEvidence,
    notImplementedStepCount,
    apiFailureStepCount,
  }
}

/**
 * Recompute run counters/status from step rows to keep summary trustworthy.
 */
export async function refreshSagaRunStatus(
  runId: string,
  actorUserId: string,
  options: RefreshSagaRunStatusOptions = {},
) {
  const [stats] = await db
    .select({
      total: sql<number>`count(*)`.mapWith(Number),
      passed: sql<number>`count(*) filter (where ${sagaRunSteps.status} = 'passed')`.mapWith(Number),
      failed: sql<number>`count(*) filter (where ${sagaRunSteps.status} = 'failed')`.mapWith(Number),
      skipped: sql<number>`count(*) filter (where ${sagaRunSteps.status} = 'skipped')`.mapWith(Number),
      inProgress: sql<number>`count(*) filter (where ${sagaRunSteps.status} = 'in_progress')`.mapWith(Number),
      pending: sql<number>`count(*) filter (where ${sagaRunSteps.status} = 'pending')`.mapWith(Number),
      blocked: sql<number>`count(*) filter (where ${sagaRunSteps.status} = 'blocked')`.mapWith(Number),
    })
    .from(sagaRunSteps)
    .where(eq(sagaRunSteps.sagaRunId, runId))

  const run = await db.query.sagaRuns.findFirst({
    where: eq(sagaRuns.id, runId),
  })
  if (!run) {
    throw new Error(`Saga run not found: ${runId}`)
  }

  const now = new Date()
  const integrity = await computeRunIntegrity(runId)
  const staleMinutes = Number(process.env.SAGA_RUN_STALE_MINUTES ?? '45')
  const staleMs = Number.isFinite(staleMinutes) && staleMinutes > 0 ? staleMinutes * 60_000 : 0
  const lastTouch = run.lastHeartbeatAt ?? run.startedAt ?? now
  const isStaleOpenRun =
    staleMs > 0 &&
    (run.status === 'pending' || run.status === 'running') &&
    (stats?.pending ?? 0) > 0 &&
    (stats?.inProgress ?? 0) === 0 &&
    now.getTime() - lastTouch.getTime() > staleMs

  let nextStatus: 'pending' | 'running' | 'passed' | 'failed' | 'cancelled' = run.status
  if (run.status !== 'cancelled') {
    if (isStaleOpenRun) {
      nextStatus = 'failed'
    } else if (
      (stats?.failed ?? 0) > 0 ||
      (stats?.blocked ?? 0) > 0 ||
      integrity.missingEvidence.length > 0
    ) {
      nextStatus = 'failed'
    } else if ((stats?.pending ?? 0) === (stats?.total ?? 0)) {
      nextStatus = 'pending'
    } else if ((stats?.pending ?? 0) === 0 && (stats?.inProgress ?? 0) === 0) {
      nextStatus = 'passed'
    } else {
      nextStatus = 'running'
    }
  }

  const shouldSetStartedAt = nextStatus === 'running' && !run.startedAt
  const isTerminal = nextStatus === 'passed' || nextStatus === 'failed' || nextStatus === 'cancelled'
  const shouldSetEndedAt = isTerminal ? now : null
  const shouldTouchHeartbeat = options.touchHeartbeat ?? true
  const shouldEmitEvent = options.emitEvent ?? true

  const totalSteps = stats?.total ?? 0
  const passedSteps = stats?.passed ?? 0
  const failedSteps = (stats?.failed ?? 0) + (stats?.blocked ?? 0)
  const skippedSteps = stats?.skipped ?? 0
  const completionPct = totalSteps > 0 ? Math.round((passedSteps / totalSteps) * 100) : 0

  const mergedRunSummary = isStaleOpenRun
    ? {
        ...(typeof run.runSummary === 'object' && run.runSummary ? run.runSummary : {}),
        autoClosed: {
          reason: 'stale_timeout',
          staleMinutes,
          closedAt: now.toISOString(),
        },
        coverage: {
          classification: integrity.classification,
          completionPct,
          totalSteps,
          passedSteps,
          failedSteps,
          skippedSteps,
          pendingSteps: stats?.pending ?? 0,
          inProgressSteps: stats?.inProgress ?? 0,
          notImplementedStepCount: integrity.notImplementedStepCount,
          apiFailureStepCount: integrity.apiFailureStepCount,
          missingEvidenceStepCount: integrity.missingEvidence.length,
        },
        failures: integrity.stepFailures.slice(0, 100),
        missingEvidence: integrity.missingEvidence.slice(0, 100),
      }
    : {
        ...(typeof run.runSummary === 'object' && run.runSummary ? run.runSummary : {}),
        coverage: {
          classification: integrity.classification,
          completionPct,
          totalSteps,
          passedSteps,
          failedSteps,
          skippedSteps,
          pendingSteps: stats?.pending ?? 0,
          inProgressSteps: stats?.inProgress ?? 0,
          notImplementedStepCount: integrity.notImplementedStepCount,
          apiFailureStepCount: integrity.apiFailureStepCount,
          missingEvidenceStepCount: integrity.missingEvidence.length,
        },
        failures: integrity.stepFailures.slice(0, 100),
        missingEvidence: integrity.missingEvidence.slice(0, 100),
      }

  await db
    .update(sagaRuns)
    .set({
      status: nextStatus,
      totalSteps,
      passedSteps,
      failedSteps,
      skippedSteps,
      startedAt: shouldSetStartedAt ? now : run.startedAt,
      endedAt: shouldSetEndedAt,
      runSummary: mergedRunSummary,
      lastHeartbeatAt: shouldTouchHeartbeat ? now : run.lastHeartbeatAt,
    })
    .where(eq(sagaRuns.id, runId))

  try {
    await upsertCoverageForRun({
      run,
      integrity,
      completionPct,
      totalSteps,
      passedSteps,
      failedSteps,
      skippedSteps,
      pendingSteps: stats?.pending ?? 0,
      inProgressSteps: stats?.inProgress ?? 0,
      actorUserId,
    })
  } catch (error) {
    if (!isMissingRelationError(error)) throw error
  }

  if (shouldEmitEvent) {
    publishSagaRuntimeEvent({
      eventType: nextStatus === 'passed' || nextStatus === 'failed' || nextStatus === 'cancelled'
        ? 'run.completed'
        : 'run.updated',
      runId,
      sagaKey: run.sagaKey,
      bizId: run.bizId,
      requestedByUserId: run.requestedByUserId,
      status: nextStatus,
      payload: {
        totalSteps,
        passedSteps,
        failedSteps,
        skippedSteps,
        completionPct,
        coverage: integrity.classification,
        missingEvidenceStepCount: integrity.missingEvidence.length,
        notImplementedStepCount: integrity.notImplementedStepCount,
        apiFailureStepCount: integrity.apiFailureStepCount,
      },
    })
  }
}

/**
 * Update one step result and refresh parent run summary status.
 */
export async function updateSagaRunStep(runId: string, stepKey: string, input: UpdateSagaStepInput) {
  const existing = await db.query.sagaRunSteps.findFirst({
    where: and(eq(sagaRunSteps.sagaRunId, runId), eq(sagaRunSteps.stepKey, stepKey)),
  })
  if (!existing) {
    throw new Error(`Saga run step not found: ${runId}/${stepKey}`)
  }

  if (!canTransitionStepStatus(existing.status, input.status)) {
    throw new Error(
      `Invalid step status transition for ${runId}/${stepKey}: ${existing.status} -> ${input.status}`,
    )
  }

  /**
   * Strong pass gate:
   * A step cannot be marked as passed unless we have at least one API trace.
   * This prevents false-positive lifecycle runs where status is set manually
   * without real endpoint execution evidence.
   */
  if (input.status === 'passed') {
    const traces = await db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(sagaRunArtifacts)
      .where(
        and(
          eq(sagaRunArtifacts.sagaRunId, runId),
          eq(sagaRunArtifacts.sagaRunStepId, existing.id),
          eq(sagaRunArtifacts.artifactType, 'api_trace'),
        ),
      )
    const traceCount = traces[0]?.count ?? 0
    if (traceCount <= 0) {
      throw new Error(
        `Cannot mark step as passed without API trace evidence (${runId}/${stepKey}).`,
      )
    }
  }

  const now = new Date()
  const nextStartedAt =
    input.startedAt ??
    (input.status === 'in_progress' ? existing.startedAt ?? now : existing.startedAt ?? undefined)
  const nextEndedAt =
    input.endedAt ??
    (STEP_TERMINAL_STATUSES.has(input.status) ? now : undefined)

  const [updated] = await db
    .update(sagaRunSteps)
    .set({
      status: input.status,
      startedAt: nextStartedAt,
      endedAt: nextEndedAt,
      failureCode: input.failureCode ?? null,
      failureMessage: input.failureMessage ?? null,
      resultPayload: input.resultPayload ?? {},
      assertionSummary: input.assertionSummary ?? {},
      metadata: input.metadata ?? {},
      attemptCount:
        input.status === 'in_progress'
          ? sql<number>`${sagaRunSteps.attemptCount} + 1`
          : undefined,
    })
    .where(and(eq(sagaRunSteps.sagaRunId, runId), eq(sagaRunSteps.stepKey, stepKey)))
    .returning()

  await refreshSagaRunStatus(runId, input.actorUserId, { touchHeartbeat: true })
  const run = await db.query.sagaRuns.findFirst({
    where: eq(sagaRuns.id, runId),
    columns: {
      sagaKey: true,
      bizId: true,
      requestedByUserId: true,
      status: true,
    },
  })
  publishSagaRuntimeEvent({
    eventType: 'step.updated',
    runId,
    sagaKey: run?.sagaKey,
    bizId: run?.bizId,
    requestedByUserId: run?.requestedByUserId,
    stepKey,
    status: input.status,
    payload: {
      failureCode: input.failureCode ?? null,
      failureMessage: input.failureMessage ?? null,
    },
  })
  return updated
}

async function resolveStepId(runId: string, stepKey?: string) {
  if (!stepKey) return null
  const row = await db.query.sagaRunSteps.findFirst({
    where: and(eq(sagaRunSteps.sagaRunId, runId), eq(sagaRunSteps.stepKey, stepKey)),
  })
  return row?.id ?? null
}

function yamlScalar(value: unknown) {
  if (value === null) return 'null'
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  const textValue = String(value)
  if (/^[a-zA-Z0-9_.-]+$/.test(textValue)) return textValue
  return JSON.stringify(textValue)
}

function jsonToYaml(value: unknown, depth = 0): string {
  const indent = '  '.repeat(depth)
  if (value === null || typeof value !== 'object') {
    return `${indent}${yamlScalar(value)}`
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return `${indent}[]`
    return value
      .map((item) => {
        if (item !== null && typeof item === 'object') {
          return `${indent}-\n${jsonToYaml(item, depth + 1)}`
        }
        return `${indent}- ${yamlScalar(item)}`
      })
      .join('\n')
  }

  const entries = Object.entries(value as Record<string, unknown>)
  if (entries.length === 0) return `${indent}{}`
  return entries
    .map(([key, item]) => {
      if (item !== null && typeof item === 'object') {
        return `${indent}${key}:\n${jsonToYaml(item, depth + 1)}`
      }
      return `${indent}${key}: ${yamlScalar(item)}`
    })
    .join('\n')
}

/**
 * Save one run artifact file and index it in DB.
 */
export async function saveSagaArtifact(input: SaveArtifactInput) {
  await ensureSagaRunDirectories(input.runId)

  const stepId = await resolveStepId(input.runId, input.stepKey)
  const safeRelativePath = input.fileName
    .split(/[\\/]+/)
    .filter((segment) => segment && segment !== '.' && segment !== '..')
    .map((segment) => segment.replace(/[^a-zA-Z0-9._-]/g, '_'))
    .join('/')

  const fallbackFileName = `artifact-${Date.now()}.txt`
  const storageRelativePath = safeRelativePath || fallbackFileName
  const absPath = path.join(SAGA_RUNS_DIR, input.runId, storageRelativePath)
  await fs.mkdir(path.dirname(absPath), { recursive: true })
  await fs.writeFile(absPath, input.body, 'utf8')

  const size = Buffer.byteLength(input.body, 'utf8')
  const digest = checksum(input.body)
  const relativePath = toProjectRelative(absPath)

  const [artifact] = await db
    .insert(sagaRunArtifacts)
    .values({
      sagaRunId: input.runId,
      sagaRunStepId: stepId,
      artifactType: input.artifactType,
      title: input.title,
      storagePath: relativePath,
      contentType: input.contentType,
      byteSize: size,
      checksum: digest,
      bodyText: input.body,
      metadata: input.metadata ?? {},
    })
    .returning()

  const run = await db.query.sagaRuns.findFirst({
    where: eq(sagaRuns.id, input.runId),
    columns: {
      sagaKey: true,
      bizId: true,
      requestedByUserId: true,
      status: true,
    },
  })
  publishSagaRuntimeEvent({
    eventType: 'artifact.created',
    runId: input.runId,
    sagaKey: run?.sagaKey,
    bizId: run?.bizId,
    requestedByUserId: run?.requestedByUserId,
    status: run?.status,
    artifactType: input.artifactType,
    stepKey: input.stepKey,
    payload: {
      artifactId: artifact.id,
      title: artifact.title,
      contentType: artifact.contentType,
      byteSize: artifact.byteSize,
    },
  })

  return artifact
}

/**
 * Save a snapshot (structured UI snapshot) as JSON or YAML text.
 */
export async function saveSagaSnapshot(input: SaveSnapshotInput) {
  await ensureSagaRunDirectories(input.runId)
  const ext = input.format === 'yaml' ? 'yaml' : 'json'
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const fileName = `${timestamp}-${slugify(input.document.screenKey) || 'screen'}.${ext}`
  const payload = input.document
  const body = ext === 'yaml' ? jsonToYaml(payload) : `${JSON.stringify(payload, null, 2)}\n`

  return saveSagaArtifact({
    runId: input.runId,
    actorUserId: input.actorUserId,
    artifactType: 'snapshot',
    title: input.document.title,
    stepKey: input.stepKey,
    fileName: `snapshots/${fileName}`,
    contentType: ext === 'yaml' ? 'application/yaml' : 'application/json',
    body,
    metadata: {
      schemaVersion: input.document.schemaVersion,
      screenKey: input.document.screenKey,
      format: ext,
      stepKey: input.document.stepKey,
      ...(input.metadata ?? {}),
    },
  })
}

/**
 * Save the final run report as markdown and index it as artifact.
 */
export async function saveSagaReport(input: SaveReportInput) {
  await ensureSagaFilesystem()
  const reportFileName = `${input.runId}.md`
  const reportAbsPath = path.join(SAGA_REPORTS_DIR, reportFileName)
  await fs.writeFile(reportAbsPath, input.markdown, 'utf8')

  await db
    .update(sagaRuns)
    .set({
      runSummary: input.summary ?? {},
    })
    .where(eq(sagaRuns.id, input.runId))

  return saveSagaArtifact({
    runId: input.runId,
    actorUserId: input.actorUserId,
    artifactType: 'report',
    title: 'Saga Run Report',
    fileName: `report-${input.runId}.md`,
    contentType: 'text/markdown',
    body: input.markdown,
    metadata: input.metadata ?? {},
  })
}

/**
 * List saga runs for dashboard usage.
 */
export async function listSagaRuns(params?: {
  sagaKey?: string
  status?: 'pending' | 'running' | 'passed' | 'failed' | 'cancelled'
  limit?: number
  requestedByUserId?: string
  includeArchived?: boolean
}) {
  const limit = Math.min(Math.max(params?.limit ?? 50, 1), 500)
  const where = and(
    params?.includeArchived ? undefined : sql`deleted_at IS NULL`,
    params?.sagaKey ? eq(sagaRuns.sagaKey, params.sagaKey) : undefined,
    params?.status ? eq(sagaRuns.status, params.status) : undefined,
    params?.requestedByUserId ? eq(sagaRuns.requestedByUserId, params.requestedByUserId) : undefined,
  )

  return db.query.sagaRuns.findMany({
    where,
    orderBy: [desc(sagaRuns.id)],
    limit,
  })
}

type ArchiveSagaRunsInput = {
  runIds: string[]
  actorUserId: string
}

/**
 * Soft-archive saga runs.
 *
 * ELI5:
 * We do not hard-delete runs because we still want evidence and history.
 * "Archiving" marks runs with `deleted_at/deleted_by`, so default lists hide
 * them while full traceability remains available for audits/reviews.
 */
export async function archiveSagaRuns(input: ArchiveSagaRunsInput) {
  const uniqueRunIds = Array.from(new Set(input.runIds.filter(Boolean)))
  if (uniqueRunIds.length === 0) return []

  const candidates = await db
    .select({ id: sagaRuns.id })
    .from(sagaRuns)
    .where(and(inArray(sagaRuns.id, uniqueRunIds), sql`deleted_at IS NULL`))

  const candidateIds = candidates.map((row) => row.id)
  if (candidateIds.length === 0) return []

  const now = new Date()
  for (const runId of candidateIds) {
    await db.execute(sql`
      UPDATE "saga_runs"
      SET
        "deleted_at" = ${now},
        "deleted_by" = ${input.actorUserId},
        "updated_at" = ${now},
        "updated_by" = ${input.actorUserId}
      WHERE "id" = ${runId}
    `)
    publishSagaRuntimeEvent({
      eventType: 'run.archived',
      runId,
      requestedByUserId: input.actorUserId,
      status: 'cancelled',
    })
  }

  return candidateIds
}

/**
 * Fetch full run detail including step rows, artifacts, and resolved spec.
 */
export async function getSagaRunDetail(runId: string) {
  const run = await db.query.sagaRuns.findFirst({
    where: eq(sagaRuns.id, runId),
  })
  if (!run) return null

  const [definition, steps, artifacts, actorProfiles, actorMessages] = await Promise.all([
    db.query.sagaDefinitions.findFirst({
      where: eq(sagaDefinitions.id, run.sagaDefinitionId),
    }),
    db.query.sagaRunSteps.findMany({
      where: eq(sagaRunSteps.sagaRunId, run.id),
      orderBy: [asc(sagaRunSteps.phaseOrder), asc(sagaRunSteps.stepOrder)],
    }),
    db.query.sagaRunArtifacts.findMany({
      where: eq(sagaRunArtifacts.sagaRunId, run.id),
      orderBy: [asc(sagaRunArtifacts.capturedAt)],
    }),
    db.query.sagaRunActorProfiles.findMany({
      where: eq(sagaRunActorProfiles.sagaRunId, run.id),
      orderBy: [asc(sagaRunActorProfiles.actorKey)],
    }),
    db.query.sagaRunActorMessages.findMany({
      where: eq(sagaRunActorMessages.sagaRunId, run.id),
      orderBy: [asc(sagaRunActorMessages.queuedAt)],
    }),
  ])

  const spec = definition
    ? await readSagaSpecFromDefinition(definition).catch(() => null)
    : null

  const stepSpecByKey = new Map(
    (spec?.phases ?? []).flatMap((phase) =>
      phase.steps.map((step) => [
        step.stepKey,
        {
          title: step.title,
          intent: step.intent,
          toolHints: step.toolHints,
          tags: step.tags,
        },
      ]),
    ),
  )

  const enrichedSteps = steps.map((step) => {
    const specStep = stepSpecByKey.get(step.stepKey)
    const metadata = ((step.metadata as Record<string, unknown> | null) ?? {}) as Record<string, unknown>
    return {
      ...step,
      title:
        specStep?.title ??
        (typeof metadata.title === 'string' ? metadata.title : undefined) ??
        step.stepKey,
      intent:
        specStep?.intent ??
        (typeof metadata.intent === 'string' ? metadata.intent : undefined) ??
        null,
      toolHints: specStep?.toolHints ?? [],
      tags: specStep?.tags ?? [],
    }
  })

  return {
    run,
    definition,
    spec,
    steps: enrichedSteps,
    artifacts,
    actorProfiles,
    actorMessages,
  }
}

/**
 * Returns the next actionable step for test-mode agents.
 */
export async function getSagaTestModeState(runId: string) {
  const detail = await getSagaRunDetail(runId)
  if (!detail) return null

  const nextStep =
    detail.steps.find((step) => step.status === 'pending') ??
    detail.steps.find((step) => step.status === 'in_progress') ??
    null

  return {
    run: detail.run,
    definition: detail.definition,
    nextStep,
    stepSummary: {
      total: detail.steps.length,
      pending: detail.steps.filter((step) => step.status === 'pending').length,
      inProgress: detail.steps.filter((step) => step.status === 'in_progress').length,
      passed: detail.steps.filter((step) => step.status === 'passed').length,
      failed: detail.steps.filter((step) => step.status === 'failed').length,
      skipped: detail.steps.filter((step) => step.status === 'skipped').length,
      blocked: detail.steps.filter((step) => step.status === 'blocked').length,
    },
    steps: detail.steps,
    artifacts: detail.artifacts,
    spec: detail.spec,
  }
}

/**
 * Reads artifact payload text for UI/report viewers.
 */
export async function readArtifactsContent(artifactIds: string[]) {
  if (artifactIds.length === 0) return []
  const rows = await db.query.sagaRunArtifacts.findMany({
    where: inArray(sagaRunArtifacts.id, artifactIds),
  })

  return Promise.all(
    rows.map(async (row) => {
      const contentFromDb = typeof row.bodyText === 'string' ? row.bodyText : ''
      const content =
        contentFromDb.length > 0
          ? contentFromDb
          : await fs
              .readFile(fromProjectRelative(row.storagePath), 'utf8')
              .catch(() => '')
      return {
        artifact: row,
        content,
      }
    }),
  )
}
