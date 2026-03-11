import { requestEnvelopedApi } from '@/lib/enveloped-api'
import type {
  SagaDefinitionDetail,
  SagaDefinitionSummary,
  SagaPersonaDefinition,
  SagaRunDetail,
  SagaRunSummary,
  SagaUseCaseDefinition,
} from '@/lib/sagas-api'

const fetchApi = requestEnvelopedApi

export type OodaLoopStatus = 'draft' | 'active' | 'paused' | 'completed' | 'archived'
export type OodaLoopPhase = 'observe' | 'orient' | 'decide' | 'act'
export type OodaGapType =
  | 'pnp_gap'
  | 'uc_gap'
  | 'persona_gap'
  | 'schema_gap'
  | 'api_gap'
  | 'workflow_gap'
  | 'policy_gap'
  | 'event_gap'
  | 'audit_gap'
  | 'test_pack_gap'
  | 'docs_gap'

export type OodaOwningLayer =
  | 'pnp'
  | 'uc'
  | 'persona'
  | 'schema'
  | 'api'
  | 'workflow'
  | 'policy'
  | 'event'
  | 'audit'
  | 'test_pack'
  | 'docs'
  | 'ops'

export type OodaLoop = {
  id: string
  loopKey: string
  title: string
  objective?: string | null
  status: OodaLoopStatus
  currentPhase: OodaLoopPhase
  priority: number
  healthScore: number
  bizId?: string | null
  ownerUserId?: string | null
  lastSignalAt?: string | null
  nextReviewAt?: string | null
  metadata?: Record<string, unknown>
  createdAt?: string
  updatedAt?: string
}

export type OodaLoopLink = {
  id: string
  oodaLoopId: string
  targetType:
    | 'use_case'
    | 'persona'
    | 'saga_definition'
    | 'saga_run'
    | 'saga_step'
    | 'coverage_report'
    | 'coverage_item'
    | 'note'
  targetId: string
  relationRole: 'focus' | 'input' | 'output' | 'dependency' | 'evidence'
  metadata?: Record<string, unknown>
}

export type OodaLoopEntry = {
  id: string
  oodaLoopId: string
  phase: OodaLoopPhase
  entryType: 'signal' | 'hypothesis' | 'decision' | 'action_plan' | 'result' | 'postmortem'
  title: string
  bodyMarkdown?: string | null
  severity: 'low' | 'medium' | 'high' | 'critical'
  status: 'open' | 'accepted' | 'rejected' | 'resolved' | 'blocked'
  gapType?: OodaGapType | null
  sourceType: 'manual' | 'saga_run' | 'api' | 'system' | 'llm'
  sourceRefId?: string | null
  linkedUseCaseId?: string | null
  linkedSagaDefinitionId?: string | null
  linkedSagaRunId?: string | null
  linkedSagaRunStepId?: string | null
  linkedCoverageItemId?: string | null
  evidence?: Record<string, unknown>
  sortOrder: number
  createdAt?: string
  updatedAt?: string
}

export type OodaLoopAction = {
  id: string
  oodaLoopId: string
  oodaLoopEntryId?: string | null
  actionKey: string
  actionTitle: string
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled'
  dryRun: boolean
  linkedSagaRunId?: string | null
  requestPayload?: Record<string, unknown>
  resultPayload?: Record<string, unknown>
  errorMessage?: string | null
  startedAt?: string | null
  endedAt?: string | null
}

export type OodaOverview = {
  health: {
    totalLoops: number
    activeLoops: number
    completedLoops: number
    archivedLoops: number
    sagaCoveragePct: number
  }
  library: {
    useCases: number
    personas: number
    definitions: number
    runs: number
  }
  recentRuns: SagaRunSummary[]
  activeLoops: Array<OodaLoop & { openItems: number }>
  attention: {
    blockers: OodaBlocker[]
    reorient: OodaReorientItem[]
  }
}

export type KnowledgeStats = {
  sources: number
  documents: number
  chunks: number
  embeddings: number
  agentRuns: number
}

export type KnowledgeSyncCheckpoint = {
  id: string
  bizId?: string | null
  checkpointKey?: string | null
  agentKind: string
  agentName: string
  status: string
  lastKnowledgeEventId?: string | null
  lastKnowledgeEventOccurredAt?: string | null
  lastCommitSha?: string | null
  lastDocumentHash?: string | null
  lastIngestedAt?: string | null
  lastObservedAt?: string | null
  lagMs?: number | null
  inSyncWithLatestEvent: boolean
}

export type KnowledgeSyncGroup = {
  key: string
  bizId?: string | null
  checkpointKey?: string | null
  participants: Array<{
    agentKind: string
    agentName: string
    status: string
    lastCommitSha?: string | null
    lastKnowledgeEventId?: string | null
    lagMs?: number | null
  }>
  allSameCommitSha: boolean
  allSameEventCursor: boolean
}

export type KnowledgeSyncStatus = {
  latestEvent?: {
    id: string
    eventType: string
    status: string
    occurredAt: string
  } | null
  checkpoints: KnowledgeSyncCheckpoint[]
  syncGroups: KnowledgeSyncGroup[]
}

export type KnowledgeSourceSummary = {
  id: string
  sourceKey: string
  displayName: string
  sourceType: string
  status: string
  basePath?: string | null
  baseUri?: string | null
  latestCommitSha?: string | null
  sourceUpdatedAt?: string | null
}

export type KnowledgeEventSummary = {
  id: string
  eventType: string
  status: string
  message?: string | null
  sourceId?: string | null
  documentId?: string | null
  agentRunId?: string | null
  occurredAt?: string
}

export type KnowledgeSourceCreateInput = {
  bizId?: string | null
  sourceKey: string
  displayName: string
  sourceType?: 'git' | 'docs' | 'mind' | 'ooda' | 'saga_run' | 'api_contract' | 'decision_log' | 'chat' | 'other'
  basePath?: string | null
  baseUri?: string | null
  gitRepo?: string | null
  gitBranch?: string | null
  latestCommitSha?: string | null
  sourceUpdatedAt?: string | null
  status?: 'active' | 'paused' | 'archived'
  metadata?: Record<string, unknown>
}

export type KnowledgeSourcePatchInput = Partial<KnowledgeSourceCreateInput>

export type KnowledgeSourceIngestInput = {
  rootPath?: string
  extensions?: string[]
  includeHidden?: boolean
  maxFiles?: number
  maxFileBytes?: number
  autoChunk?: boolean
  autoEmbed?: boolean
  chunkMaxChars?: number
  chunkOverlapChars?: number
}

export type KnowledgeSourceIngestResult = {
  sourceId: string
  summary: {
    rootPath: string
    scannedFiles: number
    createdDocuments: number
    skippedUnchanged: number
    skippedUnreadable: number
    archivedSuperseded: number
    chunkedDocuments: number
    embeddedChunks: number
    embedErrors: number
    failures: number
  }
  createdDocumentIdsSample: string[]
  failureSamples: Array<{ file: string; error: string }>
}

export type AsciipFileSummary = {
  id: string
  path: string
  name: string
  title: string
  sizeBytes: number
  revision: number
  updatedAt: string
  etag: string
}

export type AsciipFileDetail = AsciipFileSummary & {
  editorState: Record<string, unknown>
}

export type AsciipFileListResult = {
  rootPath: string
  files: AsciipFileSummary[]
}

export type OodaBlocker = {
  id: string
  source: 'saga_step' | 'loop_entry' | 'loop_action'
  severity: 'low' | 'medium' | 'high' | 'critical'
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

export type OodaReorientItem = {
  signature: string
  count: number
  latestAt?: string | null
  exampleTitle: string
  recommendation: string
}

const defaultSpecForDefinition = (input: {
  sagaKey: string
  title: string
  description: string
  useCaseRef?: string | null
  personaRef?: string | null
}) => ({
  schemaVersion: 'saga.v1' as const,
  sagaKey: input.sagaKey,
  title: input.title,
  description: input.description,
  depth: 'medium' as const,
  tags: ['ooda', 'manual'],
  defaults: {
    runMode: 'dry_run' as const,
    continueOnFailure: false,
  },
  source: {
    useCaseRef: input.useCaseRef ?? undefined,
    personaRef: input.personaRef ?? undefined,
  },
  simulation: {
    clock: {
      mode: 'virtual' as const,
      timezone: 'UTC',
      autoAdvance: true,
    },
    scheduler: {
      mode: 'deterministic' as const,
      defaultPollMs: 1000,
      defaultTimeoutMs: 30000,
      maxTicksPerStep: 500,
    },
  },
  objectives: ['Validate lifecycle behavior from OODA dashboard draft.'],
  actors: [
    {
      actorKey: 'biz_owner',
      name: 'Biz Owner',
      role: 'owner',
      description: 'Default actor created from OODA dashboard.',
    },
  ],
  phases: [
    {
      phaseKey: 'initial-check',
      order: 1,
      title: 'Initial Check',
      description: 'Basic scaffold phase created by OODA dashboard.',
      steps: [
        {
          stepKey: 'step-1',
          order: 1,
          title: 'Validate baseline flow',
          actorKey: 'biz_owner',
          intent: 'Ensure core flow is executable.',
          instruction: 'Execute baseline lifecycle step and confirm API response.',
          expectedResult: 'Step succeeds and evidence artifacts are attached.',
          toolHints: [],
          assertions: [],
          evidenceRequired: [
            { kind: 'api_trace', label: 'API trace' },
            { kind: 'snapshot', label: 'Snapshot' },
          ],
          guardrails: [],
          tags: ['ooda'],
          delay: { mode: 'none', jitterMs: 0 },
        },
      ],
    },
  ],
  metadata: {
    source: 'ooda-dashboard',
  },
})

export const oodaApi = {
  fetchOverview: () => fetchApi<OodaOverview>('/api/v1/ooda/overview'),
  fetchKnowledgeStats: () => fetchApi<KnowledgeStats>('/api/v1/knowledge/stats'),
  fetchKnowledgeSyncStatus: (params?: { bizId?: string; checkpointKey?: string }) => {
    const search = new URLSearchParams()
    if (params?.bizId) search.set('bizId', params.bizId)
    if (params?.checkpointKey) search.set('checkpointKey', params.checkpointKey)
    return fetchApi<KnowledgeSyncStatus>(`/api/v1/knowledge/sync-status${search.size ? `?${search.toString()}` : ''}`)
  },
  fetchKnowledgeSources: (params?: {
    bizId?: string
    sourceType?: string
    status?: string
    page?: number
    perPage?: number
  }) => {
    const search = new URLSearchParams()
    if (params?.bizId) search.set('bizId', params.bizId)
    if (params?.sourceType) search.set('sourceType', params.sourceType)
    if (params?.status) search.set('status', params.status)
    if (params?.page) search.set('page', String(params.page))
    if (params?.perPage) search.set('perPage', String(params.perPage))
    return fetchApi<KnowledgeSourceSummary[]>(`/api/v1/knowledge/sources${search.size ? `?${search.toString()}` : ''}`)
  },
  fetchKnowledgeEvents: (params?: {
    bizId?: string
    sourceId?: string
    eventType?: string
    status?: string
    page?: number
    perPage?: number
  }) => {
    const search = new URLSearchParams()
    if (params?.bizId) search.set('bizId', params.bizId)
    if (params?.sourceId) search.set('sourceId', params.sourceId)
    if (params?.eventType) search.set('eventType', params.eventType)
    if (params?.status) search.set('status', params.status)
    if (params?.page) search.set('page', String(params.page))
    if (params?.perPage) search.set('perPage', String(params.perPage))
    return fetchApi<KnowledgeEventSummary[]>(`/api/v1/knowledge/events${search.size ? `?${search.toString()}` : ''}`)
  },
  createKnowledgeSource: (input: KnowledgeSourceCreateInput) =>
    fetchApi<KnowledgeSourceSummary>('/api/v1/knowledge/sources', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  updateKnowledgeSource: (sourceId: string, patch: KnowledgeSourcePatchInput) =>
    fetchApi<KnowledgeSourceSummary>(`/api/v1/knowledge/sources/${encodeURIComponent(sourceId)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  ingestKnowledgeSourceFiles: (sourceId: string, input: KnowledgeSourceIngestInput) =>
    fetchApi<KnowledgeSourceIngestResult>(`/api/v1/knowledge/sources/${encodeURIComponent(sourceId)}/ingest-files`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  fetchAsciipFiles: (params?: { query?: string; directory?: string; limit?: number }) => {
    const search = new URLSearchParams()
    if (params?.query) search.set('query', params.query)
    if (params?.directory) search.set('directory', params.directory)
    if (params?.limit) search.set('limit', String(params.limit))
    return fetchApi<AsciipFileListResult>(`/api/v1/ooda/asciip/files${search.size ? `?${search.toString()}` : ''}`)
  },
  getAsciipFile: (filePath: string) => {
    const search = new URLSearchParams({ path: filePath })
    return fetchApi<AsciipFileDetail>(`/api/v1/ooda/asciip/file?${search.toString()}`)
  },
  createAsciipFile: (input: {
    path?: string
    name?: string
    directory?: string
    title?: string
    editorState?: Record<string, unknown>
    overwrite?: boolean
  }) =>
    fetchApi<AsciipFileDetail>('/api/v1/ooda/asciip/file', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  updateAsciipFile: (input: {
    path: string
    editorState: Record<string, unknown>
    ifMatchEtag?: string
    changeType?: 'autosave' | 'commit'
  }) =>
    fetchApi<AsciipFileDetail>('/api/v1/ooda/asciip/file', {
      method: 'PUT',
      body: JSON.stringify(input),
    }),
  renameAsciipFile: (input: {
    path: string
    newPath?: string
    title?: string
    ifMatchEtag?: string
  }) =>
    fetchApi<AsciipFileDetail>('/api/v1/ooda/asciip/file', {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),
  deleteAsciipFile: (filePath: string) =>
    fetchApi<{ deleted: true; path: string }>(`/api/v1/ooda/asciip/file?path=${encodeURIComponent(filePath)}`, {
      method: 'DELETE',
    }),
  fetchLoops: (params?: { status?: OodaLoopStatus; query?: string; limit?: number }) => {
    const search = new URLSearchParams()
    if (params?.status) search.set('status', params.status)
    if (params?.query) search.set('query', params.query)
    if (params?.limit) search.set('limit', String(params.limit))
    return fetchApi<OodaLoop[]>(`/api/v1/ooda/loops${search.size ? `?${search.toString()}` : ''}`)
  },
  createLoop: (input: {
    loopKey?: string
    title: string
    objective?: string | null
    status?: OodaLoopStatus
    currentPhase?: OodaLoopPhase
    priority?: number
    healthScore?: number
    nextReviewAt?: string | null
    metadata?: Record<string, unknown>
  }) =>
    fetchApi<OodaLoop>('/api/v1/ooda/loops', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  fetchLoopDetail: (loopId: string) =>
    fetchApi<{
      loop: OodaLoop
      links: OodaLoopLink[]
      entries: OodaLoopEntry[]
      actions: OodaLoopAction[]
    }>(`/api/v1/ooda/loops/${encodeURIComponent(loopId)}`),
  fetchLoopBlockers: (loopId: string, params?: { limit?: number }) => {
    const search = new URLSearchParams()
    if (params?.limit) search.set('limit', String(params.limit))
    const query = search.size ? `?${search.toString()}` : ''
    return fetchApi<{
      loopId: string
      summary: {
        total: number
        strongEvidence: number
        weakEvidence: number
        replayable: number
      }
      blockers: OodaBlocker[]
      reorient: OodaReorientItem[]
    }>(`/api/v1/ooda/loops/${encodeURIComponent(loopId)}/blockers${query}`)
  },
  updateLoop: (loopId: string, patch: Partial<OodaLoop>) =>
    fetchApi<OodaLoop>(`/api/v1/ooda/loops/${encodeURIComponent(loopId)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  archiveLoop: (loopId: string) =>
    fetchApi<{ archived: true }>(`/api/v1/ooda/loops/${encodeURIComponent(loopId)}`, {
      method: 'DELETE',
    }),
  addLoopLink: (
    loopId: string,
    input: {
      targetType: OodaLoopLink['targetType']
      targetId: string
      relationRole?: OodaLoopLink['relationRole']
      metadata?: Record<string, unknown>
    },
  ) =>
    fetchApi<OodaLoopLink>(`/api/v1/ooda/loops/${encodeURIComponent(loopId)}/links`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  deleteLoopLink: (loopId: string, linkId: string) =>
    fetchApi<{ deleted: true }>(
      `/api/v1/ooda/loops/${encodeURIComponent(loopId)}/links/${encodeURIComponent(linkId)}`,
      { method: 'DELETE' },
    ),
  addLoopEntry: (
    loopId: string,
    input: {
      phase: OodaLoopPhase
      entryType: OodaLoopEntry['entryType']
      title: string
      bodyMarkdown?: string | null
      severity?: OodaLoopEntry['severity']
      status?: OodaLoopEntry['status']
      gapType?: OodaGapType | null
      owningLayer?: OodaOwningLayer | null
      sourceType?: OodaLoopEntry['sourceType']
      sourceRefId?: string | null
      linkedUseCaseId?: string | null
      linkedSagaDefinitionId?: string | null
      linkedSagaRunId?: string | null
      linkedSagaRunStepId?: string | null
      linkedCoverageItemId?: string | null
      evidence?: Record<string, unknown>
      sortOrder?: number
    },
  ) =>
    fetchApi<OodaLoopEntry>(`/api/v1/ooda/loops/${encodeURIComponent(loopId)}/entries`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  updateLoopEntry: (loopId: string, entryId: string, patch: Partial<OodaLoopEntry>) =>
    fetchApi<OodaLoopEntry>(
      `/api/v1/ooda/loops/${encodeURIComponent(loopId)}/entries/${encodeURIComponent(entryId)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(patch),
      },
    ),
  addLoopAction: (
    loopId: string,
    input: {
      oodaLoopEntryId?: string | null
      actionKey: string
      actionTitle: string
      status?: OodaLoopAction['status']
      dryRun?: boolean
      linkedSagaRunId?: string | null
      requestPayload?: Record<string, unknown>
      resultPayload?: Record<string, unknown>
      errorMessage?: string | null
    },
  ) =>
    fetchApi<OodaLoopAction>(`/api/v1/ooda/loops/${encodeURIComponent(loopId)}/actions`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  updateLoopAction: (loopId: string, actionId: string, patch: Partial<OodaLoopAction>) =>
    fetchApi<OodaLoopAction>(
      `/api/v1/ooda/loops/${encodeURIComponent(loopId)}/actions/${encodeURIComponent(actionId)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(patch),
      },
    ),
  createLoopRun: (
    loopId: string,
    input: {
      sagaKey: string
      mode?: 'dry_run' | 'live'
      runnerLabel?: string
      oodaLoopEntryId?: string | null
      actionTitle?: string
      requestPayload?: Record<string, unknown>
    },
  ) =>
    fetchApi<{ run: SagaRunDetail; action: OodaLoopAction }>(
      `/api/v1/ooda/loops/${encodeURIComponent(loopId)}/saga-runs`,
      {
        method: 'POST',
        body: JSON.stringify(input),
      },
    ),
  generateDraft: (input: {
    kind: 'use_case' | 'persona' | 'saga_definition'
    prompt: string
    context?: string
    model?: string
  }) =>
    fetchApi<{ kind: string; draft: unknown; raw: string }>('/api/v1/ooda/generate/draft', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  createUseCase: (input: {
    ucKey: string
    title: string
    summary?: string | null
    status?: 'draft' | 'active' | 'archived'
    sourceRef?: string | null
    sourceFilePath?: string | null
  }) =>
    fetchApi<SagaUseCaseDefinition>('/api/v1/ooda/sagas/use-cases', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  updateUseCase: (ucKey: string, patch: Partial<SagaUseCaseDefinition>) =>
    fetchApi<SagaUseCaseDefinition>(`/api/v1/ooda/sagas/use-cases/${encodeURIComponent(ucKey)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  deleteUseCase: (ucKey: string) =>
    fetchApi<{ deleted: true }>(`/api/v1/ooda/sagas/use-cases/${encodeURIComponent(ucKey)}`, {
      method: 'DELETE',
    }),
  createPersona: (input: {
    personaKey: string
    name: string
    profileSummary?: string | null
    status?: 'draft' | 'active' | 'archived'
    sourceRef?: string | null
    sourceFilePath?: string | null
  }) =>
    fetchApi<SagaPersonaDefinition>('/api/v1/ooda/sagas/personas', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  updatePersona: (personaKey: string, patch: Partial<SagaPersonaDefinition>) =>
    fetchApi<SagaPersonaDefinition>(`/api/v1/ooda/sagas/personas/${encodeURIComponent(personaKey)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  deletePersona: (personaKey: string) =>
    fetchApi<{ deleted: true }>(`/api/v1/ooda/sagas/personas/${encodeURIComponent(personaKey)}`, {
      method: 'DELETE',
    }),
  createDefinitionFromDraft: (input: {
    sagaKey: string
    title: string
    description: string
    sourceUseCaseRef?: string | null
    sourcePersonaRef?: string | null
    status?: 'draft' | 'active' | 'archived'
  }) =>
    fetchApi<SagaDefinitionDetail>('/api/v1/ooda/sagas/specs', {
      method: 'POST',
      body: JSON.stringify({
        status: input.status ?? 'draft',
        spec: defaultSpecForDefinition({
          sagaKey: input.sagaKey,
          title: input.title,
          description: input.description,
          useCaseRef: input.sourceUseCaseRef,
          personaRef: input.sourcePersonaRef,
        }),
      }),
    }),
  deleteDefinition: (sagaKey: string) =>
    fetchApi<{ archived: true }>(`/api/v1/ooda/sagas/specs/${encodeURIComponent(sagaKey)}`, {
      method: 'DELETE',
    }),
}
