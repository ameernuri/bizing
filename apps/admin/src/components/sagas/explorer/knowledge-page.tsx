'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import {
  ArrowRight,
  Database,
  FileText,
  GitBranch,
  Pencil,
  PlayCircle,
  Plus,
  RefreshCw,
  Search,
  Workflow,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { LoadError, PageIntro } from './common'
import {
  oodaApi,
  type KnowledgeEventSummary,
  type KnowledgeSourceCreateInput,
  type KnowledgeSourceIngestInput,
  type KnowledgeSourceSummary,
  type KnowledgeStats,
  type KnowledgeSyncStatus,
} from '@/lib/ooda-api'

function formatAgo(value?: string | null) {
  if (!value) return 'unknown'
  const ms = Date.now() - new Date(value).getTime()
  if (!Number.isFinite(ms) || ms < 0) return 'just now'
  const m = Math.floor(ms / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

type KnowledgeSourceType = NonNullable<KnowledgeSourceCreateInput['sourceType']>
type KnowledgeSourceStatus = NonNullable<KnowledgeSourceCreateInput['status']>

type SourceFormState = {
  sourceKey: string
  displayName: string
  sourceType: KnowledgeSourceType
  status: KnowledgeSourceStatus
  basePath: string
  baseUri: string
  gitRepo: string
  gitBranch: string
}

const emptyCreateForm: SourceFormState = {
  sourceKey: '',
  displayName: '',
  sourceType: 'docs',
  status: 'active',
  basePath: '',
  baseUri: '',
  gitRepo: '',
  gitBranch: '',
}

type IngestFormState = {
  rootPath: string
  extensions: string
  includeHidden: boolean
  maxFiles: string
  maxFileBytes: string
  autoChunk: boolean
  autoEmbed: boolean
  chunkMaxChars: string
  chunkOverlapChars: string
}

const defaultIngestForm: IngestFormState = {
  rootPath: '',
  extensions: '.md,.mdx,.txt,.json',
  includeHidden: false,
  maxFiles: '500',
  maxFileBytes: '300000',
  autoChunk: true,
  autoEmbed: false,
  chunkMaxChars: '1400',
  chunkOverlapChars: '200',
}

export function KnowledgePage() {
  const [stats, setStats] = useState<KnowledgeStats | null>(null)
  const [syncStatus, setSyncStatus] = useState<KnowledgeSyncStatus | null>(null)
  const [sources, setSources] = useState<KnowledgeSourceSummary[]>([])
  const [events, setEvents] = useState<KnowledgeEventSummary[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; message: string } | null>(null)

  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [ingestOpen, setIngestOpen] = useState(false)
  const [selectedSource, setSelectedSource] = useState<KnowledgeSourceSummary | null>(null)

  const [createForm, setCreateForm] = useState<SourceFormState>(emptyCreateForm)
  const [editForm, setEditForm] = useState<SourceFormState>(emptyCreateForm)
  const [ingestForm, setIngestForm] = useState(defaultIngestForm)

  const [savingCreate, setSavingCreate] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)
  const [runningIngest, setRunningIngest] = useState(false)
  const [ingestSummaryBySource, setIngestSummaryBySource] = useState<Record<string, string>>({})

  async function load(background = false) {
    if (background) setRefreshing(true)
    else {
      setLoading(true)
      setError(null)
    }
    try {
      const [nextStats, nextSync, nextSources, nextEvents] = await Promise.all([
        oodaApi.fetchKnowledgeStats(),
        oodaApi.fetchKnowledgeSyncStatus(),
        oodaApi.fetchKnowledgeSources({ perPage: 200, page: 1 }),
        oodaApi.fetchKnowledgeEvents({ perPage: 40, page: 1 }),
      ])
      setStats(nextStats)
      setSyncStatus(nextSync)
      setSources(nextSources)
      setEvents(nextEvents)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to load knowledge sync data.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const filteredSources = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return sources
    return sources.filter((source) => {
      const text = `${source.sourceKey} ${source.displayName} ${source.sourceType} ${source.status}`.toLowerCase()
      return text.includes(needle)
    })
  }, [query, sources])

  const syncSummary = useMemo(() => {
    const groups = syncStatus?.syncGroups ?? []
    const healthy = groups.filter((group) => group.allSameCommitSha && group.allSameEventCursor).length
    return {
      total: groups.length,
      healthy,
      drifting: Math.max(0, groups.length - healthy),
    }
  }, [syncStatus?.syncGroups])

  function openEditDialog(source: KnowledgeSourceSummary) {
    setSelectedSource(source)
    setEditForm({
      sourceKey: source.sourceKey,
      displayName: source.displayName,
      sourceType: (source.sourceType as KnowledgeSourceType) ?? 'other',
      status: (source.status as KnowledgeSourceStatus) ?? 'active',
      basePath: source.basePath ?? '',
      baseUri: source.baseUri ?? '',
      gitRepo: '',
      gitBranch: '',
    })
    setEditOpen(true)
  }

  function openIngestDialog(source: KnowledgeSourceSummary) {
    setSelectedSource(source)
    setIngestForm({
      ...defaultIngestForm,
      rootPath: source.basePath ?? '',
    })
    setIngestOpen(true)
  }

  async function handleCreateSource() {
    if (!createForm.sourceKey.trim() || !createForm.displayName.trim()) return
    setSavingCreate(true)
    setNotice(null)
    try {
      await oodaApi.createKnowledgeSource({
        sourceKey: createForm.sourceKey.trim(),
        displayName: createForm.displayName.trim(),
        sourceType: createForm.sourceType,
        status: createForm.status,
        basePath: createForm.basePath?.trim() || null,
        baseUri: createForm.baseUri?.trim() || null,
        gitRepo: createForm.gitRepo?.trim() || null,
        gitBranch: createForm.gitBranch?.trim() || null,
      })
      setCreateOpen(false)
      setCreateForm(emptyCreateForm)
      setNotice({ tone: 'success', message: 'Knowledge source created.' })
      await load(true)
    } catch (cause) {
      setNotice({
        tone: 'error',
        message: cause instanceof Error ? cause.message : 'Failed to create source.',
      })
    } finally {
      setSavingCreate(false)
    }
  }

  async function handleUpdateSource() {
    if (!selectedSource) return
    if (!editForm.sourceKey.trim() || !editForm.displayName.trim()) return
    setSavingEdit(true)
    setNotice(null)
    try {
      await oodaApi.updateKnowledgeSource(selectedSource.id, {
        sourceKey: editForm.sourceKey.trim(),
        displayName: editForm.displayName.trim(),
        sourceType: editForm.sourceType,
        status: editForm.status,
        basePath: editForm.basePath?.trim() || null,
        baseUri: editForm.baseUri?.trim() || null,
        gitRepo: editForm.gitRepo?.trim() || null,
        gitBranch: editForm.gitBranch?.trim() || null,
      })
      setEditOpen(false)
      setSelectedSource(null)
      setNotice({ tone: 'success', message: 'Knowledge source updated.' })
      await load(true)
    } catch (cause) {
      setNotice({
        tone: 'error',
        message: cause instanceof Error ? cause.message : 'Failed to update source.',
      })
    } finally {
      setSavingEdit(false)
    }
  }

  async function handleIngestSource() {
    if (!selectedSource) return
    setRunningIngest(true)
    setNotice(null)
    try {
      const maxFiles = Number.parseInt(ingestForm.maxFiles || '0', 10)
      const maxFileBytes = Number.parseInt(ingestForm.maxFileBytes || '0', 10)
      const chunkMaxChars = Number.parseInt(ingestForm.chunkMaxChars || '0', 10)
      const chunkOverlapChars = Number.parseInt(ingestForm.chunkOverlapChars || '0', 10)
      const payload: KnowledgeSourceIngestInput = {
        rootPath: ingestForm.rootPath.trim() || undefined,
        extensions: ingestForm.extensions
          .split(',')
          .map((part) => part.trim())
          .filter(Boolean),
        includeHidden: ingestForm.includeHidden,
        maxFiles: Number.isFinite(maxFiles) && maxFiles > 0 ? maxFiles : undefined,
        maxFileBytes: Number.isFinite(maxFileBytes) && maxFileBytes > 0 ? maxFileBytes : undefined,
        autoChunk: ingestForm.autoChunk,
        autoEmbed: ingestForm.autoEmbed,
        chunkMaxChars: Number.isFinite(chunkMaxChars) && chunkMaxChars > 0 ? chunkMaxChars : undefined,
        chunkOverlapChars:
          Number.isFinite(chunkOverlapChars) && chunkOverlapChars >= 0 ? chunkOverlapChars : undefined,
      }
      const result = await oodaApi.ingestKnowledgeSourceFiles(selectedSource.id, payload)
      const summaryText = `created ${result.summary.createdDocuments}, unchanged ${result.summary.skippedUnchanged}, failures ${result.summary.failures}`
      setIngestSummaryBySource((prev) => ({ ...prev, [selectedSource.id]: summaryText }))
      setIngestOpen(false)
      setNotice({
        tone: 'success',
        message: `Ingest complete for ${selectedSource.displayName}: ${summaryText}.`,
      })
      await load(true)
    } catch (cause) {
      setNotice({
        tone: 'error',
        message: cause instanceof Error ? cause.message : 'Failed to ingest source files.',
      })
    } finally {
      setRunningIngest(false)
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <PageIntro
        eyebrow="Shared Memory"
        title="Knowledge Sync"
        description="Codex and OpenClaw shared memory status. Sources, ingested docs, retrieval events, and checkpoint drift in one place."
        actions={
          <>
            <Button size="sm" className="gap-2" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              New source
            </Button>
            <Button variant="outline" size="sm" className="gap-2" onClick={() => void load(true)} disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button size="sm" className="gap-2" asChild>
              <Link href="/ooda/api">
                API Explorer
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </>
        }
      />
      <div className="flex flex-1 flex-col gap-6 p-6">
        {error ? <LoadError message={error} onRetry={() => void load()} /> : null}
        {notice ? (
          <div
            className={`rounded-lg border p-3 text-sm ${
              notice.tone === 'success'
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
                : 'border-red-500/40 bg-red-500/10 text-red-200'
            }`}
          >
            {notice.message}
          </div>
        ) : null}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Sources</CardTitle>
              <CardDescription>Configured ingest roots</CardDescription>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{stats?.sources ?? (loading ? '...' : 0)}</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Documents</CardTitle>
              <CardDescription>Versioned knowledge docs</CardDescription>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{stats?.documents ?? (loading ? '...' : 0)}</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Chunks + Embeddings</CardTitle>
              <CardDescription>Retrieval units and vectors</CardDescription>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              {(stats?.chunks ?? 0).toLocaleString()} / {(stats?.embeddings ?? 0).toLocaleString()}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Checkpoint Drift</CardTitle>
              <CardDescription>Group-level sync health</CardDescription>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              {syncSummary.healthy}/{syncSummary.total}
              <p className="mt-1 text-xs text-muted-foreground">{syncSummary.drifting} drifting group(s)</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Sources</CardTitle>
              <CardDescription>Ingest roots feeding the shared knowledge plane.</CardDescription>
              <div className="relative mt-2">
                <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Filter sources..."
                  className="pl-8"
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {filteredSources.slice(0, 30).map((source) => (
                <div key={source.id} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{source.displayName}</p>
                      <p className="text-xs text-muted-foreground">{source.sourceKey}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{source.sourceType}</Badge>
                      <Badge variant={source.status === 'active' ? 'default' : 'secondary'}>{source.status}</Badge>
                      <Button variant="outline" size="sm" className="gap-1" onClick={() => openEditDialog(source)}>
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </Button>
                      <Button size="sm" className="gap-1" onClick={() => openIngestDialog(source)}>
                        <PlayCircle className="h-3.5 w-3.5" />
                        Ingest now
                      </Button>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Database className="h-3.5 w-3.5" />
                      {source.basePath ?? source.baseUri ?? 'no root configured'}
                    </span>
                    {source.latestCommitSha ? (
                      <span className="inline-flex items-center gap-1">
                        <GitBranch className="h-3.5 w-3.5" />
                        {source.latestCommitSha.slice(0, 10)}
                      </span>
                    ) : null}
                    <span>updated {formatAgo(source.sourceUpdatedAt)}</span>
                  </div>
                  {ingestSummaryBySource[source.id] ? (
                    <p className="mt-2 text-xs text-emerald-200">{ingestSummaryBySource[source.id]}</p>
                  ) : null}
                </div>
              ))}
              {filteredSources.length === 0 ? (
                <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                  No sources found.
                </p>
              ) : null}
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Sync Groups</CardTitle>
                <CardDescription>Each group compares cursor + commit across participating runtimes.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {(syncStatus?.syncGroups ?? []).slice(0, 20).map((group) => {
                  const healthy = group.allSameCommitSha && group.allSameEventCursor
                  return (
                    <div key={group.key} className="rounded-lg border p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-medium">{group.checkpointKey ?? 'global'}</p>
                        <Badge variant={healthy ? 'default' : 'destructive'}>{healthy ? 'in sync' : 'drift'}</Badge>
                      </div>
                      <div className="mt-2 space-y-1">
                        {group.participants.map((participant) => (
                          <p key={`${participant.agentKind}:${participant.agentName}`} className="text-xs text-muted-foreground">
                            <span className="font-medium text-foreground">{participant.agentKind}</span>
                            {' · '}
                            {participant.agentName}
                            {' · '}
                            {participant.lastCommitSha ? participant.lastCommitSha.slice(0, 10) : 'no commit'}
                            {' · '}
                            {participant.lastKnowledgeEventId ? participant.lastKnowledgeEventId.slice(0, 14) : 'no cursor'}
                          </p>
                        ))}
                      </div>
                    </div>
                  )
                })}
                {(syncStatus?.syncGroups?.length ?? 0) === 0 ? (
                  <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                    No checkpoint groups yet.
                  </p>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Recent Knowledge Events</CardTitle>
                <CardDescription>Latest ingest/reindex/query/checkpoint actions.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {events.slice(0, 20).map((event) => (
                  <div key={event.id} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Workflow className="h-4 w-4 text-muted-foreground" />
                        <p className="text-sm font-medium">{event.eventType}</p>
                        <Badge variant="outline">{event.status}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{formatAgo(event.occurredAt)}</p>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{event.message ?? 'No message.'}</p>
                    <p className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <FileText className="h-3.5 w-3.5" />
                      {event.id}
                    </p>
                  </div>
                ))}
                {events.length === 0 ? (
                  <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                    No events yet.
                  </p>
                ) : null}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create knowledge source</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="source-key">Source key</Label>
              <Input
                id="source-key"
                value={createForm.sourceKey}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, sourceKey: event.target.value }))}
                placeholder="code-docs"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="source-name">Display name</Label>
              <Input
                id="source-name"
                value={createForm.displayName}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, displayName: event.target.value }))}
                placeholder="Code Docs"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="source-type">Source type</Label>
              <Select
                value={createForm.sourceType ?? 'docs'}
                onValueChange={(value) =>
                  setCreateForm((prev) => ({
                    ...prev,
                    sourceType: value as KnowledgeSourceType,
                  }))
                }
              >
                <SelectTrigger id="source-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="docs">docs</SelectItem>
                  <SelectItem value="mind">mind</SelectItem>
                  <SelectItem value="git">git</SelectItem>
                  <SelectItem value="ooda">ooda</SelectItem>
                  <SelectItem value="saga_run">saga_run</SelectItem>
                  <SelectItem value="api_contract">api_contract</SelectItem>
                  <SelectItem value="decision_log">decision_log</SelectItem>
                  <SelectItem value="chat">chat</SelectItem>
                  <SelectItem value="other">other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="source-status">Status</Label>
              <Select
                value={createForm.status ?? 'active'}
                onValueChange={(value) =>
                  setCreateForm((prev) => ({ ...prev, status: value as KnowledgeSourceStatus }))
                }
              >
                <SelectTrigger id="source-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">active</SelectItem>
                  <SelectItem value="paused">paused</SelectItem>
                  <SelectItem value="archived">archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="source-base-path">Base path</Label>
              <Input
                id="source-base-path"
                value={createForm.basePath ?? ''}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, basePath: event.target.value }))}
                placeholder="/Users/ameer/projects/bizing/docs"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="source-base-uri">Base uri</Label>
              <Input
                id="source-base-uri"
                value={createForm.baseUri ?? ''}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, baseUri: event.target.value }))}
                placeholder="https://github.com/.../blob/main/docs"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => void handleCreateSource()}
              disabled={savingCreate || !createForm.sourceKey.trim() || !createForm.displayName.trim()}
            >
              {savingCreate ? 'Creating...' : 'Create source'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit knowledge source</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="edit-source-key">Source key</Label>
              <Input
                id="edit-source-key"
                value={editForm.sourceKey}
                onChange={(event) => setEditForm((prev) => ({ ...prev, sourceKey: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-source-name">Display name</Label>
              <Input
                id="edit-source-name"
                value={editForm.displayName}
                onChange={(event) => setEditForm((prev) => ({ ...prev, displayName: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-source-type">Source type</Label>
              <Select
                value={editForm.sourceType ?? 'docs'}
                onValueChange={(value) =>
                  setEditForm((prev) => ({
                    ...prev,
                    sourceType: value as KnowledgeSourceType,
                  }))
                }
              >
                <SelectTrigger id="edit-source-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="docs">docs</SelectItem>
                  <SelectItem value="mind">mind</SelectItem>
                  <SelectItem value="git">git</SelectItem>
                  <SelectItem value="ooda">ooda</SelectItem>
                  <SelectItem value="saga_run">saga_run</SelectItem>
                  <SelectItem value="api_contract">api_contract</SelectItem>
                  <SelectItem value="decision_log">decision_log</SelectItem>
                  <SelectItem value="chat">chat</SelectItem>
                  <SelectItem value="other">other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-source-status">Status</Label>
              <Select
                value={editForm.status ?? 'active'}
                onValueChange={(value) =>
                  setEditForm((prev) => ({ ...prev, status: value as KnowledgeSourceStatus }))
                }
              >
                <SelectTrigger id="edit-source-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">active</SelectItem>
                  <SelectItem value="paused">paused</SelectItem>
                  <SelectItem value="archived">archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="edit-source-base-path">Base path</Label>
              <Input
                id="edit-source-base-path"
                value={editForm.basePath ?? ''}
                onChange={(event) => setEditForm((prev) => ({ ...prev, basePath: event.target.value }))}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="edit-source-base-uri">Base uri</Label>
              <Input
                id="edit-source-base-uri"
                value={editForm.baseUri ?? ''}
                onChange={(event) => setEditForm((prev) => ({ ...prev, baseUri: event.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => void handleUpdateSource()}
              disabled={savingEdit || !editForm.sourceKey.trim() || !editForm.displayName.trim()}
            >
              {savingEdit ? 'Saving...' : 'Save changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={ingestOpen} onOpenChange={setIngestOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Ingest source files</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="ingest-root-path">Root path</Label>
              <Input
                id="ingest-root-path"
                value={ingestForm.rootPath}
                onChange={(event) => setIngestForm((prev) => ({ ...prev, rootPath: event.target.value }))}
                placeholder="/Users/ameer/projects/bizing/docs"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="ingest-extensions">Extensions</Label>
              <Input
                id="ingest-extensions"
                value={ingestForm.extensions}
                onChange={(event) => setIngestForm((prev) => ({ ...prev, extensions: event.target.value }))}
                placeholder=".md,.mdx,.txt,.json"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ingest-max-files">Max files</Label>
              <Input
                id="ingest-max-files"
                type="number"
                value={ingestForm.maxFiles}
                onChange={(event) => setIngestForm((prev) => ({ ...prev, maxFiles: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ingest-max-bytes">Max file bytes</Label>
              <Input
                id="ingest-max-bytes"
                type="number"
                value={ingestForm.maxFileBytes}
                onChange={(event) => setIngestForm((prev) => ({ ...prev, maxFileBytes: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ingest-chunk-max">Chunk max chars</Label>
              <Input
                id="ingest-chunk-max"
                type="number"
                value={ingestForm.chunkMaxChars}
                onChange={(event) => setIngestForm((prev) => ({ ...prev, chunkMaxChars: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ingest-chunk-overlap">Chunk overlap chars</Label>
              <Input
                id="ingest-chunk-overlap"
                type="number"
                value={ingestForm.chunkOverlapChars}
                onChange={(event) => setIngestForm((prev) => ({ ...prev, chunkOverlapChars: event.target.value }))}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                className="h-4 w-4"
                type="checkbox"
                checked={ingestForm.includeHidden}
                onChange={(event) => setIngestForm((prev) => ({ ...prev, includeHidden: event.target.checked }))}
              />
              Include hidden files
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                className="h-4 w-4"
                type="checkbox"
                checked={ingestForm.autoChunk}
                onChange={(event) => setIngestForm((prev) => ({ ...prev, autoChunk: event.target.checked }))}
              />
              Auto chunk documents
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                className="h-4 w-4"
                type="checkbox"
                checked={ingestForm.autoEmbed}
                onChange={(event) => setIngestForm((prev) => ({ ...prev, autoEmbed: event.target.checked }))}
              />
              Auto embed chunks
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIngestOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleIngestSource()} disabled={runningIngest}>
              {runningIngest ? 'Ingesting...' : 'Run ingest'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
