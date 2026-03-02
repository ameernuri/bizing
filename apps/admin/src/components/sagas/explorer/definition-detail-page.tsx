'use client'

import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, GitCommitHorizontal, Pencil, Play, RefreshCw, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { sagaApi, type SagaDefinitionDetail, type SagaDefinitionLinksDetail, type SagaDefinitionRevision, type SagaLifecycleStatus, type SagaRunSummary } from '@/lib/sagas-api'
import { EntitySummaryCard, LifecycleBadge, LoadError, LoadingGrid, PageIntro, RunStatusBadge, summarizeRuns } from './common'

const ReactJson = dynamic(() => import('react-json-view'), { ssr: false })

export function SagaDefinitionDetailPage({ sagaKey }: { sagaKey: string }) {
  const [detail, setDetail] = useState<SagaDefinitionDetail | null>(null)
  const [links, setLinks] = useState<SagaDefinitionLinksDetail | null>(null)
  const [revisions, setRevisions] = useState<SagaDefinitionRevision[]>([])
  const [runs, setRuns] = useState<SagaRunSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isStartingRun, setIsStartingRun] = useState(false)

  const [editOpen, setEditOpen] = useState(false)
  const [revisionOpen, setRevisionOpen] = useState(false)
  const [isSavingSpec, setIsSavingSpec] = useState(false)
  const [isSavingRevision, setIsSavingRevision] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [jsonError, setJsonError] = useState<string | null>(null)

  const [editStatus, setEditStatus] = useState<SagaLifecycleStatus>('active')
  const [editBizId, setEditBizId] = useState('')
  const [editSourceFilePath, setEditSourceFilePath] = useState('')
  const [editSpecText, setEditSpecText] = useState('{}')

  const [revisionNote, setRevisionNote] = useState('')
  const [revisionSpecText, setRevisionSpecText] = useState('{}')

  async function load() {
    setIsLoading(true)
    setError(null)
    try {
      const [nextDetail, nextLinks, nextRevisions, nextRuns] = await Promise.all([
        sagaApi.fetchDefinitionDetail(sagaKey),
        sagaApi.fetchDefinitionLinks(sagaKey),
        sagaApi.fetchDefinitionRevisions(sagaKey),
        sagaApi.fetchRuns({ sagaKey, limit: 5000, mineOnly: false, includeArchived: true }),
      ])
      setDetail(nextDetail)
      setLinks(nextLinks)
      setRevisions(nextRevisions.revisions)
      setRuns(nextRuns)
      setEditStatus(nextDetail.definition.status)
      setEditBizId(nextDetail.definition.bizId ?? '')
      setEditSourceFilePath(nextDetail.definition.specFilePath ?? '')
      const pretty = JSON.stringify(nextDetail.spec, null, 2)
      setEditSpecText(pretty)
      setRevisionSpecText(pretty)
      setJsonError(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to load saga definition.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [sagaKey])

  async function startRun() {
    setIsStartingRun(true)
    try {
      const created = await sagaApi.createRun({ sagaKey, mode: 'dry_run', runnerLabel: 'dashboard-rerun' })
      try {
        await sagaApi.executeRun(created.run.id)
      } catch {
        // The detail page has an execute control and realtime refresh fallback.
      }
      window.location.href = `/sagas/runs/${created.run.id}`
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to start saga run.')
      setIsStartingRun(false)
    }
  }

  function parseJsonText(raw: string) {
    try {
      const value = JSON.parse(raw)
      setJsonError(null)
      return value
    } catch (cause) {
      setJsonError(cause instanceof Error ? cause.message : 'Invalid JSON payload.')
      return null
    }
  }

  async function saveSpecEdits() {
    if (!detail) return
    const parsed = parseJsonText(editSpecText)
    if (!parsed) return
    setIsSavingSpec(true)
    setError(null)
    try {
      await sagaApi.updateDefinitionSpec(detail.definition.sagaKey, {
        spec: parsed,
        status: editStatus,
        bizId: editBizId.trim() || null,
        sourceFilePath: editSourceFilePath.trim() || null,
        forceRevision: false,
      })
      setEditOpen(false)
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to save saga definition spec.')
    } finally {
      setIsSavingSpec(false)
    }
  }

  async function createRevision() {
    if (!detail) return
    const parsed = parseJsonText(revisionSpecText)
    if (!parsed) return
    setIsSavingRevision(true)
    setError(null)
    try {
      await sagaApi.createDefinitionRevision(detail.definition.sagaKey, {
        spec: parsed,
        status: editStatus,
        bizId: editBizId.trim() || null,
        sourceFilePath: editSourceFilePath.trim() || null,
        revisionMetadata: {
          note: revisionNote.trim() || null,
          source: 'dashboard.revision',
        },
      })
      setRevisionOpen(false)
      setRevisionNote('')
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to create spec revision.')
    } finally {
      setIsSavingRevision(false)
    }
  }

  async function deleteDefinition() {
    if (!detail) return
    setIsDeleting(true)
    setError(null)
    try {
      await sagaApi.deleteDefinition(detail.definition.sagaKey)
      window.location.href = '/sagas/definitions'
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to delete saga definition.')
      setIsDeleting(false)
    }
  }

  const summary = useMemo(() => summarizeRuns(runs), [runs])
  const latestRun = runs[0] ?? null

  return (
    <div className="flex flex-1 flex-col">
      <PageIntro
        eyebrow="Saga Definition"
        title={detail ? `${detail.definition.sagaKey} · ${detail.definition.title}` : sagaKey}
        description={detail?.definition.description ?? 'This definition is the executable lifecycle contract used by the saga runner.'}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/sagas/definitions">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to definitions
              </Link>
            </Button>
            <Button variant="outline" onClick={() => setRevisionOpen(true)} disabled={!detail || isLoading}>
              <GitCommitHorizontal className="mr-2 h-4 w-4" />
              New revision
            </Button>
            <Button variant="outline" onClick={() => setEditOpen(true)} disabled={!detail || isLoading}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit spec
            </Button>
            <Button onClick={() => void startRun()} disabled={isStartingRun || isLoading}>
              {isStartingRun ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
              Start dry run
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={!detail || isLoading}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete saga definition?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This archives the saga definition. Existing run history stays, but new runs for this key are blocked unless reactivated.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => void deleteDefinition()} disabled={isDeleting}>
                    {isDeleting ? 'Deleting...' : 'Delete'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        }
      />
      <div className="flex-1 p-6">
        {error ? <LoadError message={error} onRetry={() => void load()} /> : null}
        {jsonError ? <LoadError message={`Spec JSON error: ${jsonError}`} /> : null}
        {isLoading || !detail || !links ? (
          <LoadingGrid count={6} />
        ) : (
          <div className="space-y-6">
            <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between gap-3">
                    <CardTitle>Spec overview</CardTitle>
                    <LifecycleBadge status={detail.definition.status} />
                  </div>
                  <CardDescription>
                    Canonical executable shape: actors, phases, and lifecycle steps that this definition runs.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="rounded-lg border p-4">
                      <p className="text-2xl font-semibold">{detail.spec.actors?.length ?? 0}</p>
                      <p className="text-muted-foreground">actors</p>
                    </div>
                    <div className="rounded-lg border p-4">
                      <p className="text-2xl font-semibold">{detail.spec.phases?.length ?? 0}</p>
                      <p className="text-muted-foreground">phases</p>
                    </div>
                    <div className="rounded-lg border p-4">
                      <p className="text-2xl font-semibold">{detail.spec.phases?.reduce((count, phase) => count + phase.steps.length, 0) ?? 0}</p>
                      <p className="text-muted-foreground">steps</p>
                    </div>
                  </div>

                  {detail.spec.objectives?.length ? (
                    <div className="rounded-lg border p-4">
                      <p className="mb-2 font-medium">Objectives</p>
                      <ul className="list-disc space-y-1 pl-5">
                        {detail.spec.objectives.map((objective) => (
                          <li key={objective}>{objective}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  <div className="rounded-lg border p-4">
                    <p className="mb-2 font-medium">Actors</p>
                    <div className="space-y-3">
                      {(detail.spec.actors ?? []).map((actor) => (
                        <div key={actor.actorKey} className="rounded-md border p-3">
                          <p className="font-medium">{actor.name} <span className="text-muted-foreground">({actor.actorKey})</span></p>
                          <p className="text-muted-foreground">{actor.role}</p>
                          {actor.description ? <p className="mt-1">{actor.description}</p> : null}
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Run health</CardTitle>
                  <CardDescription>
                    This panel shows whether the definition is currently proving itself in runner reality.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="rounded-lg border p-4">
                    <p className="text-2xl font-semibold">{summary.passRate}%</p>
                    <p className="text-muted-foreground">historical pass rate</p>
                  </div>
                  <div className="rounded-lg border p-4">
                    <p className="text-2xl font-semibold">{runs.length}</p>
                    <p className="text-muted-foreground">recorded runs</p>
                  </div>
                  <div className="rounded-lg border p-4">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <p className="font-medium">Latest run</p>
                      {latestRun ? <RunStatusBadge status={latestRun.status} /> : null}
                    </div>
                    <p className="text-muted-foreground">{latestRun ? `${latestRun.passedSteps}/${latestRun.totalSteps} steps passed` : 'No runs recorded yet.'}</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Spec JSON inspector</CardTitle>
                <CardDescription>
                  Live read-only view of the current canonical spec payload stored in DB.
                </CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <ReactJson
                  src={detail.spec as Record<string, unknown>}
                  theme="monokai"
                  name={false}
                  enableClipboard
                  displayObjectSize={false}
                  displayDataTypes={false}
                  collapsed={2}
                  style={{ borderRadius: 8, padding: 12 }}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Linked use cases and personas</CardTitle>
                <CardDescription>These links show what business needs and personas this spec currently aims to prove.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-6 xl:grid-cols-2">
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-medium">Use cases</h3>
                    <span className="text-xs text-muted-foreground">{links.useCaseVersions.length}</span>
                  </div>
                  {links.useCaseVersions.map((version) => (
                    <EntitySummaryCard
                      key={version.id}
                      href={`/sagas/use-cases/${encodeURIComponent(version.ucKey ?? '')}`}
                      title={`${version.ucKey ?? 'unknown'} · ${version.useCaseTitle ?? version.title}`}
                      description={version.summary}
                      footer={`v${version.versionNumber} linked`}
                    />
                  ))}
                </div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-medium">Personas</h3>
                    <span className="text-xs text-muted-foreground">{links.personaVersions.length}</span>
                  </div>
                  {links.personaVersions.map((version) => (
                    <EntitySummaryCard
                      key={version.id}
                      href={`/sagas/personas/${encodeURIComponent(version.personaKey ?? '')}`}
                      title={`${version.personaKey ?? 'unknown'} · ${version.personaName ?? version.name}`}
                      description={version.profile ?? version.goals}
                      footer={`v${version.versionNumber} linked`}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Revision history</CardTitle>
                <CardDescription>Revisions explain how the executable definition evolved over time.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {revisions.map((revision, index) => (
                  <div key={revision.id} className="space-y-3">
                    {index > 0 ? <Separator /> : null}
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">Revision {revision.revisionNumber} · spec {revision.specVersion}</p>
                        <p className="text-sm text-muted-foreground">{revision.summary ?? revision.title ?? 'No summary attached.'}</p>
                      </div>
                      <p className="text-xs text-muted-foreground">{revision.createdAt ? new Date(revision.createdAt).toLocaleString() : ''}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent runs</CardTitle>
                <CardDescription>Open a run to inspect steps, messages, artifacts, and exact failure points.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {runs.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No runs have been recorded yet.</p>
                ) : (
                  runs.map((run) => (
                    <Link key={run.id} href={`/sagas/runs/${run.id}`} className="flex items-center justify-between gap-3 rounded-lg border p-3 transition-colors hover:border-primary/40 hover:bg-muted/30">
                      <div className="min-w-0 space-y-1">
                        <p className="truncate font-medium">{run.id}</p>
                        <p className="text-sm text-muted-foreground">{run.passedSteps}/{run.totalSteps} passed • {new Date(run.updatedAt ?? run.createdAt ?? Date.now()).toLocaleString()}</p>
                      </div>
                      <RunStatusBadge status={run.status} />
                    </Link>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Edit saga spec</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[72vh] pr-4">
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={editStatus} onValueChange={(value) => setEditStatus(value as SagaLifecycleStatus)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">draft</SelectItem>
                      <SelectItem value="active">active</SelectItem>
                      <SelectItem value="archived">archived</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-biz-id">Biz ID (optional)</Label>
                  <Input id="edit-biz-id" value={editBizId} onChange={(event) => setEditBizId(event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-source-path">Source File Path (optional)</Label>
                  <Input id="edit-source-path" value={editSourceFilePath} onChange={(event) => setEditSourceFilePath(event.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-spec-json">Spec JSON</Label>
                <Textarea
                  id="edit-spec-json"
                  className="min-h-[460px] font-mono text-xs"
                  value={editSpecText}
                  onChange={(event) => setEditSpecText(event.target.value)}
                />
              </div>
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void saveSpecEdits()} disabled={isSavingSpec}>
              {isSavingSpec ? 'Saving...' : 'Save spec'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={revisionOpen} onOpenChange={setRevisionOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Create saga revision</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[72vh] pr-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="revision-note">Revision note</Label>
                <Input
                  id="revision-note"
                  value={revisionNote}
                  onChange={(event) => setRevisionNote(event.target.value)}
                  placeholder="What changed and why"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="revision-spec-json">Spec JSON for revision</Label>
                <Textarea
                  id="revision-spec-json"
                  className="min-h-[460px] font-mono text-xs"
                  value={revisionSpecText}
                  onChange={(event) => setRevisionSpecText(event.target.value)}
                />
              </div>
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevisionOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void createRevision()} disabled={isSavingRevision}>
              {isSavingRevision ? 'Creating...' : 'Create revision'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
