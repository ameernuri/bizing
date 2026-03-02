'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { sagaApi, type SagaLibraryRelations, type SagaLifecycleStatus, type SagaRunSummary, type SagaUseCaseDetail } from '@/lib/sagas-api'
import { EntitySummaryCard, getLatestRun, LifecycleBadge, LoadError, LoadingGrid, PageIntro, RunStatusBadge, summarizeRuns } from './common'

export function SagaUseCaseDetailPage({ ucKey }: { ucKey: string }) {
  const [detail, setDetail] = useState<SagaUseCaseDetail | null>(null)
  const [relations, setRelations] = useState<SagaLibraryRelations | null>(null)
  const [runs, setRuns] = useState<SagaRunSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [editOpen, setEditOpen] = useState(false)
  const [versionOpen, setVersionOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [editForm, setEditForm] = useState({
    title: '',
    summary: '',
    status: 'active' as SagaLifecycleStatus,
    sourceRef: '',
    sourceFilePath: '',
  })
  const [versionForm, setVersionForm] = useState({
    title: '',
    summary: '',
    bodyMarkdown: '',
    extractedScenario: '',
  })

  async function load() {
    setIsLoading(true)
    setError(null)
    try {
      const [nextDetail, nextRelations, allRuns] = await Promise.all([
        sagaApi.fetchUseCaseDetail(ucKey),
        sagaApi.fetchLibraryRelations('use_case', ucKey),
        sagaApi.fetchRuns({ limit: 5000, mineOnly: false, includeArchived: true }),
      ])
      setDetail(nextDetail)
      setRelations(nextRelations)
      const linkedKeys = new Set(nextRelations.definitions.map((definition) => definition.sagaKey))
      setRuns(allRuns.filter((run) => linkedKeys.has(run.sagaKey)))
      setEditForm({
        title: nextDetail.definition.title,
        summary: nextDetail.definition.summary ?? '',
        status: nextDetail.definition.status,
        sourceRef: nextDetail.definition.sourceRef ?? '',
        sourceFilePath: nextDetail.definition.sourceFilePath ?? '',
      })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to load use case detail.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [ucKey])

  const currentVersion = useMemo(
    () => detail?.versions.find((version) => version.isCurrent) ?? detail?.versions[0] ?? null,
    [detail],
  )

  useEffect(() => {
    if (!currentVersion) return
    setVersionForm((prev) => ({
      ...prev,
      title: currentVersion.title ?? detail?.definition.title ?? '',
      summary: currentVersion.summary ?? '',
      bodyMarkdown: currentVersion.bodyMarkdown ?? '',
      extractedScenario: currentVersion.extractedScenario ?? '',
    }))
  }, [currentVersion, detail?.definition.title])

  const definitionSummaries = useMemo(() => {
    return (relations?.definitions ?? []).map((definition) => {
      const definitionRuns = runs.filter((run) => run.sagaKey === definition.sagaKey)
      return {
        definition,
        definitionRuns,
        latestRun: getLatestRun(definitionRuns),
        runSummary: summarizeRuns(definitionRuns),
      }
    })
  }, [relations, runs])

  async function saveDefinitionEdits() {
    if (!detail) return
    setIsSaving(true)
    setError(null)
    try {
      await sagaApi.updateUseCase(detail.definition.ucKey, {
        title: editForm.title.trim(),
        status: editForm.status,
        summary: editForm.summary.trim() || null,
        sourceRef: editForm.sourceRef.trim() || null,
        sourceFilePath: editForm.sourceFilePath.trim() || null,
      })
      setEditOpen(false)
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to update use case.')
    } finally {
      setIsSaving(false)
    }
  }

  async function createVersion() {
    if (!detail || !versionForm.bodyMarkdown.trim()) return
    setIsSaving(true)
    setError(null)
    try {
      await sagaApi.createUseCaseVersion(detail.definition.ucKey, {
        title: versionForm.title.trim() || detail.definition.title,
        summary: versionForm.summary.trim() || null,
        bodyMarkdown: versionForm.bodyMarkdown,
        extractedScenario: versionForm.extractedScenario.trim() || null,
        isCurrent: true,
      })
      setVersionOpen(false)
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to create use case version.')
    } finally {
      setIsSaving(false)
    }
  }

  async function deleteUseCase() {
    if (!detail) return
    setIsDeleting(true)
    setError(null)
    try {
      await sagaApi.deleteUseCase(detail.definition.ucKey)
      window.location.href = '/sagas/use-cases'
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to delete use case.')
      setIsDeleting(false)
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <PageIntro
        eyebrow="Use Case"
        title={detail ? `${detail.definition.ucKey} · ${detail.definition.title}` : ucKey}
        description={detail?.definition.summary ?? 'Open the linked saga definitions below to inspect its executable lifecycle coverage.'}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/sagas/use-cases">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to use cases
              </Link>
            </Button>
            <Button variant="outline" onClick={() => setVersionOpen(true)} disabled={!detail || isLoading}>
              <Plus className="mr-2 h-4 w-4" />
              New version
            </Button>
            <Button variant="outline" onClick={() => setEditOpen(true)} disabled={!detail || isLoading}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
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
                  <AlertDialogTitle>Delete use case?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This archives the use case definition row and removes it from the active library view.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => void deleteUseCase()} disabled={isDeleting}>
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
        {isLoading || !detail || !relations ? (
          <LoadingGrid count={6} />
        ) : (
          <div className="space-y-6">
            <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between gap-3">
                    <CardTitle>Current definition</CardTitle>
                    <LifecycleBadge status={detail.definition.status} />
                  </div>
                  <CardDescription>
                    The current version is the authoritative text that saga definitions are expected to prove.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-lg border p-4 text-sm leading-6 whitespace-pre-wrap">
                    {currentVersion?.bodyMarkdown ?? 'No current use case body is available.'}
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span>Versions: {detail.versions.length}</span>
                    {detail.definition.sourceRef ? <span>Source ref: {detail.definition.sourceRef}</span> : null}
                    {detail.definition.sourceFilePath ? <span>File: {detail.definition.sourceFilePath}</span> : null}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Linked saga coverage</CardTitle>
                  <CardDescription>
                    Every linked saga definition below is one concrete attempt to prove this use case with a persona and a full lifecycle run.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="rounded-lg border p-4">
                    <p className="text-2xl font-semibold">{relations.definitions.length}</p>
                    <p className="text-muted-foreground">linked saga definitions</p>
                  </div>
                  <div className="rounded-lg border p-4">
                    <p className="text-2xl font-semibold">{runs.length}</p>
                    <p className="text-muted-foreground">runs connected to those definitions</p>
                  </div>
                  <div className="rounded-lg border p-4">
                    <p className="text-2xl font-semibold">{definitionSummaries.filter((entry) => entry.latestRun?.status === 'passed').length}</p>
                    <p className="text-muted-foreground">definitions whose latest run is green</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Version history</CardTitle>
                <CardDescription>Older versions remain useful when a saga is still proving an outdated interpretation of the use case.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {detail.versions.map((version, index) => (
                  <div key={version.id} className="space-y-3">
                    {index > 0 ? <Separator /> : null}
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium">v{version.versionNumber} · {version.title}</p>
                        <p className="text-sm text-muted-foreground">{version.summary ?? 'No summary attached.'}</p>
                      </div>
                      {version.isCurrent ? <LifecycleBadge status="active" /> : null}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Linked saga definitions</CardTitle>
                <CardDescription>These saga definitions translate the use case into concrete lifecycles. Open one to see the exact steps and associated run history.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {definitionSummaries.map(({ definition, latestRun, runSummary }) => (
                    <EntitySummaryCard
                      key={definition.id}
                      href={`/sagas/definitions/${encodeURIComponent(definition.sagaKey)}`}
                      title={definition.title}
                      description={definition.description}
                      status={latestRun ? <RunStatusBadge status={latestRun.status} /> : <LifecycleBadge status={definition.status} />}
                      footer={
                        <div className="space-y-1">
                          <p>{definition.sagaKey}</p>
                          <p>{runSummary.passed}/{runSummary.total} runs passed</p>
                        </div>
                      }
                    />
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Connected runs</CardTitle>
                <CardDescription>Use this list when you want to jump directly from the abstract use case to the concrete run evidence.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {runs.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No runs have been recorded for the linked definitions yet.</p>
                ) : (
                  runs
                    .sort((a, b) => new Date(b.updatedAt ?? b.createdAt ?? 0).getTime() - new Date(a.updatedAt ?? a.createdAt ?? 0).getTime())
                    .slice(0, 12)
                    .map((run) => (
                      <Link key={run.id} href={`/sagas/runs/${run.id}`} className="flex items-center justify-between gap-3 rounded-lg border p-3 transition-colors hover:border-primary/40 hover:bg-muted/30">
                        <div className="min-w-0 space-y-1">
                          <p className="truncate font-medium">{run.sagaKey}</p>
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit use case</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh] pr-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="uc-edit-title">Title</Label>
                <Input
                  id="uc-edit-title"
                  value={editForm.title}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, title: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={editForm.status}
                  onValueChange={(value) =>
                    setEditForm((prev) => ({ ...prev, status: value as SagaLifecycleStatus }))
                  }
                >
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
                <Label htmlFor="uc-edit-summary">Summary</Label>
                <Textarea
                  id="uc-edit-summary"
                  value={editForm.summary}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, summary: event.target.value }))}
                  rows={5}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="uc-edit-source-ref">Source Ref</Label>
                <Input
                  id="uc-edit-source-ref"
                  value={editForm.sourceRef}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, sourceRef: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="uc-edit-source-file">Source File Path</Label>
                <Input
                  id="uc-edit-source-file"
                  value={editForm.sourceFilePath}
                  onChange={(event) =>
                    setEditForm((prev) => ({ ...prev, sourceFilePath: event.target.value }))
                  }
                />
              </div>
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void saveDefinitionEdits()} disabled={isSaving || !editForm.title.trim()}>
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={versionOpen} onOpenChange={setVersionOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Create use case version</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh] pr-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="uc-version-title">Version Title</Label>
                <Input
                  id="uc-version-title"
                  value={versionForm.title}
                  onChange={(event) => setVersionForm((prev) => ({ ...prev, title: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="uc-version-summary">Summary</Label>
                <Textarea
                  id="uc-version-summary"
                  value={versionForm.summary}
                  onChange={(event) => setVersionForm((prev) => ({ ...prev, summary: event.target.value }))}
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="uc-version-body">Body Markdown</Label>
                <Textarea
                  id="uc-version-body"
                  value={versionForm.bodyMarkdown}
                  onChange={(event) =>
                    setVersionForm((prev) => ({ ...prev, bodyMarkdown: event.target.value }))
                  }
                  rows={16}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="uc-version-scenario">Extracted Scenario</Label>
                <Input
                  id="uc-version-scenario"
                  value={versionForm.extractedScenario}
                  onChange={(event) =>
                    setVersionForm((prev) => ({ ...prev, extractedScenario: event.target.value }))
                  }
                />
              </div>
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVersionOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void createVersion()} disabled={isSaving || !versionForm.bodyMarkdown.trim()}>
              {isSaving ? 'Creating...' : 'Create version'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
