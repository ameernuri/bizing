import { apiUrl } from '@/lib/api'

export type SagaRunStatus = 'pending' | 'running' | 'passed' | 'failed' | 'cancelled'
export type SagaLifecycleStatus = 'draft' | 'active' | 'archived'

export type ApiEnvelope<T> = {
  success: boolean
  data: T
  meta?: Record<string, unknown>
}

export type SagaArtifactContent = {
  artifact: SagaArtifact
  content: string
}

export type SagaLibraryOverview = {
  counts: {
    useCases: number
    personas: number
    sagaDefinitions: number
    sagaRuns: number
    coverageReports: number
    runAssessmentReports?: number
    schemaCoverageReports?: number
  }
  recentCoverage?: unknown[]
  recentSchemaCoverage?: unknown[]
  recentRuns?: SagaRunSummary[]
}

export type SagaUseCaseDefinition = {
  id: string
  ucKey: string
  title: string
  status: SagaLifecycleStatus
  summary?: string | null
  sourceFilePath?: string | null
  sourceRef?: string | null
  metadata?: Record<string, unknown> | null
}

export type SagaUseCaseVersion = {
  id: string
  sagaUseCaseId: string
  versionNumber: number
  title: string
  summary?: string | null
  bodyMarkdown?: string | null
  extractedNeeds?: unknown[] | null
  extractedScenario?: string | null
  isCurrent: boolean
  publishedAt?: string | null
}

export type SagaUseCaseDetail = {
  definition: SagaUseCaseDefinition
  versions: SagaUseCaseVersion[]
}

export type SagaPersonaDefinition = {
  id: string
  personaKey: string
  name: string
  status: SagaLifecycleStatus
  profileSummary?: string | null
  sourceFilePath?: string | null
  sourceRef?: string | null
  metadata?: Record<string, unknown> | null
}

export type SagaPersonaVersion = {
  id: string
  sagaPersonaId: string
  versionNumber: number
  name: string
  profile?: string | null
  goals?: string | null
  painPoints?: string | null
  testScenarios?: unknown[] | null
  bodyMarkdown?: string | null
  isCurrent: boolean
  publishedAt?: string | null
}

export type SagaPersonaDetail = {
  definition: SagaPersonaDefinition
  versions: SagaPersonaVersion[]
}

export type SagaDefinitionSummary = {
  id: string
  sagaKey: string
  title: string
  description?: string | null
  status: SagaLifecycleStatus
  bizId?: string | null
  specFilePath?: string | null
  specVersion: string
  sourceUseCaseRef?: string | null
  sourcePersonaRef?: string | null
  updatedAt?: string | null
}

export type SagaDefinitionSpec = {
  sagaKey: string
  title: string
  description?: string | null
  objectives?: string[]
  actors?: Array<{
    actorKey: string
    name: string
    role: string
    description?: string | null
    personaRef?: string | null
  }>
  phases?: Array<{
    phaseKey: string
    title: string
    description?: string | null
    steps: Array<{
      stepKey: string
      title: string
      actorKey: string
      intent?: string | null
      instruction: string
      expectedResult?: string | null
      tags?: string[]
      toolHints?: string[]
    }>
  }>
  metadata?: Record<string, unknown>
}

export type SagaDefinitionRevision = {
  id: string
  sagaDefinitionId: string
  revisionNumber: number
  specVersion: string
  title?: string | null
  summary?: string | null
  specPayload?: SagaDefinitionSpec | null
  metadata?: Record<string, unknown> | null
  createdAt?: string | null
}

export type SagaDefinitionDetail = {
  definition: SagaDefinitionSummary
  spec: SagaDefinitionSpec
}

export type SagaDefinitionLinksDetail = {
  definition: SagaDefinitionSummary
  links: Array<{
    id: string
    relationRole: string
    weight?: number | null
    metadata?: Record<string, unknown> | null
  }>
  useCaseVersions: Array<SagaUseCaseVersion & { ucKey?: string | null; useCaseTitle?: string | null }>
  personaVersions: Array<SagaPersonaVersion & { personaKey?: string | null; personaName?: string | null }>
}

export type SagaLibraryRelations = {
  kind: 'use_case' | 'persona'
  node: SagaUseCaseDefinition | SagaPersonaDefinition
  versions: Array<SagaUseCaseVersion | SagaPersonaVersion>
  links: Array<{
    id: string
    relationRole: string
    sagaDefinitionId: string
    sagaUseCaseVersionId?: string | null
    sagaPersonaVersionId?: string | null
    metadata?: Record<string, unknown> | null
  }>
  definitions: SagaDefinitionSummary[]
}

export type SagaRunSummary = {
  id: string
  sagaKey: string
  status: SagaRunStatus
  mode: 'dry_run' | 'live'
  totalSteps: number
  passedSteps: number
  failedSteps: number
  skippedSteps: number
  runnerLabel?: string | null
  bizId?: string | null
  createdAt?: string | null
  updatedAt?: string | null
  startedAt?: string | null
  finishedAt?: string | null
  runSummary?: Record<string, unknown> | null
}

export type SagaRunStep = {
  id: string
  phaseTitle: string
  stepKey: string
  title?: string
  actorKey: string
  status: string
  instruction: string
  expectedResult?: string | null
  failureMessage?: string | null
  resultPayload?: Record<string, unknown> | null
  assertionSummary?: Record<string, unknown> | null
  metadata?: Record<string, unknown> | null
  durationMs?: number | null
}

export type SagaArtifact = {
  id: string
  sagaRunStepId?: string | null
  artifactType: string
  title: string
  contentType: string
  storagePath: string
  capturedAt?: string | null
}

export type SagaActorProfile = {
  id: string
  actorKey: string
  actorName: string
  actorRole: string
  personaRef?: string | null
  linkedUserId?: string | null
  virtualEmail: string
  virtualPhone: string
}

export type SagaActorMessage = {
  id: string
  sagaRunStepId?: string | null
  channel: 'email' | 'sms' | 'push' | 'in_app'
  status: 'queued' | 'sent' | 'delivered' | 'read' | 'failed' | 'cancelled'
  fromActorKey?: string | null
  toActorKey?: string | null
  subject?: string | null
  bodyText: string
  queuedAt?: string | null
  deliveredAt?: string | null
}

export type SagaRunDetail = {
  run: SagaRunSummary
  definition: SagaDefinitionSummary | null
  spec?: SagaDefinitionSpec | null
  steps: SagaRunStep[]
  artifacts: SagaArtifact[]
  actorProfiles?: SagaActorProfile[]
  actorMessages?: SagaActorMessage[]
}

export type SagaCoverageDetail = {
  report: {
    id: string
    title?: string | null
    coveragePct?: number | null
    summary?: string | null
    reportData?: Record<string, unknown> | null
  }
  items: Array<{
    id: string
    itemType: string
    itemRefKey: string
    itemTitle?: string | null
    verdict: string
    nativeToHacky?: string | null
    coreToExtension?: string | null
    explanation?: string | null
    tags?: string[]
  }>
  tags: Array<{ id: string; tagKey: string }>
}

export type SchemaCoverageReport = {
  id: string
  title?: string | null
  summary?: string | null
  reportData?: Record<string, unknown> | null
}

async function fetchApi<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(apiUrl(path), {
    ...init,
    credentials: 'include',
    headers: {
      'content-type': 'application/json',
      ...(init?.headers ?? {}),
    },
    cache: 'no-store',
  })

  const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | null
  if (!response.ok || !payload?.success) {
    const message =
      (payload as { error?: { message?: string } } | null)?.error?.message ||
      `Request failed (${response.status})`
    throw new Error(message)
  }
  return payload.data
}

export const sagaApi = {
  fetchLibraryOverview: () => fetchApi<SagaLibraryOverview>('/api/v1/sagas/library/overview'),
  fetchUseCases: () => fetchApi<SagaUseCaseDefinition[]>('/api/v1/sagas/use-cases?limit=5000'),
  fetchUseCaseDetail: (ucKey: string) =>
    fetchApi<SagaUseCaseDetail>(`/api/v1/sagas/use-cases/${encodeURIComponent(ucKey)}`),
  updateUseCase: (
    ucKey: string,
    patch: Partial<{
      title: string
      status: SagaLifecycleStatus
      summary: string | null
      sourceFilePath: string | null
      sourceRef: string | null
    }>,
  ) =>
    fetchApi<SagaUseCaseDefinition>(`/api/v1/sagas/use-cases/${encodeURIComponent(ucKey)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  createUseCaseVersion: (
    ucKey: string,
    input: {
      title?: string
      summary?: string | null
      bodyMarkdown: string
      extractedNeeds?: unknown[]
      extractedScenario?: string | null
      isCurrent?: boolean
    },
  ) =>
    fetchApi<SagaUseCaseVersion>(
      `/api/v1/sagas/use-cases/${encodeURIComponent(ucKey)}/versions`,
      {
        method: 'POST',
        body: JSON.stringify(input),
      },
    ),
  deleteUseCase: (ucKey: string) =>
    fetchApi<{ deleted: true }>(`/api/v1/sagas/use-cases/${encodeURIComponent(ucKey)}`, {
      method: 'DELETE',
    }),
  fetchPersonas: () => fetchApi<SagaPersonaDefinition[]>('/api/v1/sagas/personas?limit=5000'),
  fetchPersonaDetail: (personaKey: string) =>
    fetchApi<SagaPersonaDetail>(`/api/v1/sagas/personas/${encodeURIComponent(personaKey)}`),
  updatePersona: (
    personaKey: string,
    patch: Partial<{
      name: string
      status: SagaLifecycleStatus
      profileSummary: string | null
      sourceFilePath: string | null
      sourceRef: string | null
    }>,
  ) =>
    fetchApi<SagaPersonaDefinition>(
      `/api/v1/sagas/personas/${encodeURIComponent(personaKey)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(patch),
      },
    ),
  createPersonaVersion: (
    personaKey: string,
    input: {
      name?: string
      profile?: string | null
      goals?: string | null
      painPoints?: string | null
      testScenarios?: unknown[]
      bodyMarkdown: string
      isCurrent?: boolean
    },
  ) =>
    fetchApi<SagaPersonaVersion>(
      `/api/v1/sagas/personas/${encodeURIComponent(personaKey)}/versions`,
      {
        method: 'POST',
        body: JSON.stringify(input),
      },
    ),
  deletePersona: (personaKey: string) =>
    fetchApi<{ deleted: true }>(`/api/v1/sagas/personas/${encodeURIComponent(personaKey)}`, {
      method: 'DELETE',
    }),
  fetchDefinitions: () => fetchApi<SagaDefinitionSummary[]>('/api/v1/sagas/specs?limit=5000'),
  fetchDefinitionDetail: (sagaKey: string) =>
    fetchApi<SagaDefinitionDetail>(`/api/v1/sagas/specs/${encodeURIComponent(sagaKey)}`),
  fetchDefinitionRevisions: (sagaKey: string) =>
    fetchApi<{ definition: SagaDefinitionSummary; revisions: SagaDefinitionRevision[] }>(`/api/v1/sagas/specs/${encodeURIComponent(sagaKey)}/revisions?limit=100`),
  fetchDefinitionLinks: (sagaKey: string) =>
    fetchApi<SagaDefinitionLinksDetail>(`/api/v1/sagas/definitions/${encodeURIComponent(sagaKey)}/links`),
  fetchLibraryRelations: (kind: 'use_case' | 'persona', key: string) =>
    fetchApi<SagaLibraryRelations>(
      `/api/v1/sagas/library/related?kind=${encodeURIComponent(kind)}&key=${encodeURIComponent(key)}`,
    ),
  updateDefinitionSpec: (
    sagaKey: string,
    input: {
      spec: unknown
      status?: SagaLifecycleStatus
      bizId?: string | null
      metadata?: Record<string, unknown>
      sourceFilePath?: string | null
      forceRevision?: boolean
      revisionMetadata?: Record<string, unknown>
    },
  ) =>
    fetchApi<SagaDefinitionDetail>(`/api/v1/sagas/specs/${encodeURIComponent(sagaKey)}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    }),
  createDefinitionRevision: (
    sagaKey: string,
    input: {
      spec: unknown
      status?: SagaLifecycleStatus
      bizId?: string | null
      metadata?: Record<string, unknown>
      sourceFilePath?: string | null
      revisionMetadata?: Record<string, unknown>
    },
  ) =>
    fetchApi<SagaDefinitionDetail>(
      `/api/v1/sagas/specs/${encodeURIComponent(sagaKey)}/revisions`,
      {
        method: 'POST',
        body: JSON.stringify(input),
      },
    ),
  deleteDefinition: (sagaKey: string) =>
    fetchApi<{ archived: true }>(`/api/v1/sagas/specs/${encodeURIComponent(sagaKey)}`, {
      method: 'DELETE',
    }),
  fetchRuns: (params?: { sagaKey?: string; limit?: number; includeArchived?: boolean; mineOnly?: boolean }) => {
    const search = new URLSearchParams()
    if (params?.sagaKey) search.set('sagaKey', params.sagaKey)
    if (params?.limit) search.set('limit', String(params.limit))
    if (params?.includeArchived) search.set('includeArchived', 'true')
    if (params?.mineOnly === false) search.set('mineOnly', 'false')
    return fetchApi<SagaRunSummary[]>(`/api/v1/sagas/runs${search.size ? `?${search.toString()}` : ''}`)
  },
  fetchRunDetail: (runId: string) => fetchApi<SagaRunDetail>(`/api/v1/sagas/runs/${encodeURIComponent(runId)}`),
  fetchRunCoverage: (runId: string) => fetchApi<SagaCoverageDetail>(`/api/v1/sagas/runs/${encodeURIComponent(runId)}/coverage`),
  fetchArtifactContent: (runId: string, artifactId: string) =>
    fetchApi<SagaArtifactContent>(`/api/v1/sagas/runs/${encodeURIComponent(runId)}/artifacts/${encodeURIComponent(artifactId)}/content`),
  createRun: (input: { sagaKey: string; mode?: 'dry_run' | 'live'; bizId?: string; runnerLabel?: string }) =>
    fetchApi<SagaRunDetail>('/api/v1/sagas/runs', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  fetchSchemaCoverageReports: () =>
    fetchApi<SchemaCoverageReport[]>('/api/v1/sagas/schema-coverage/reports?limit=5'),
  fetchSchemaCoverageReportDetail: (reportId: string) =>
    fetchApi<SagaCoverageDetail>(`/api/v1/sagas/schema-coverage/reports/${encodeURIComponent(reportId)}`),
  executeRun: (runId: string) =>
    fetchApi<{ runId: string; status: string }>(`/api/v1/sagas/runs/${encodeURIComponent(runId)}/execute`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),
}
