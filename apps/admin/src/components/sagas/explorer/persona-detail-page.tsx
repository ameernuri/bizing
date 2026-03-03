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
import { sagaApi, type SagaLibraryRelations, type SagaLifecycleStatus, type SagaPersonaDetail, type SagaRunSummary } from '@/lib/sagas-api'
import { EntitySummaryCard, getLatestRun, LifecycleBadge, LoadError, LoadingGrid, PageIntro, RunStatusBadge, summarizeRuns } from './common'

export function SagaPersonaDetailPage({ personaKey }: { personaKey: string }) {
  const [detail, setDetail] = useState<SagaPersonaDetail | null>(null)
  const [relations, setRelations] = useState<SagaLibraryRelations | null>(null)
  const [runs, setRuns] = useState<SagaRunSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [editOpen, setEditOpen] = useState(false)
  const [versionOpen, setVersionOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [editForm, setEditForm] = useState({
    name: '',
    profileSummary: '',
    status: 'active' as SagaLifecycleStatus,
    sourceRef: '',
    sourceFilePath: '',
  })
  const [versionForm, setVersionForm] = useState({
    name: '',
    profile: '',
    goals: '',
    painPoints: '',
    bodyMarkdown: '',
  })

  async function load() {
    setIsLoading(true)
    setError(null)
    try {
      const [nextDetail, nextRelations, allRuns] = await Promise.all([
        sagaApi.fetchPersonaDetail(personaKey),
        sagaApi.fetchLibraryRelations('persona', personaKey),
        sagaApi.fetchRuns({ limit: 5000, mineOnly: false, includeArchived: true }),
      ])
      setDetail(nextDetail)
      setRelations(nextRelations)
      const linkedKeys = new Set(nextRelations.definitions.map((definition) => definition.sagaKey))
      setRuns(allRuns.filter((run) => linkedKeys.has(run.sagaKey)))
      setEditForm({
        name: nextDetail.definition.name,
        profileSummary: nextDetail.definition.profileSummary ?? '',
        status: nextDetail.definition.status,
        sourceRef: nextDetail.definition.sourceRef ?? '',
        sourceFilePath: nextDetail.definition.sourceFilePath ?? '',
      })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to load persona detail.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [personaKey])

  const currentVersion = useMemo(
    () => detail?.versions.find((version) => version.isCurrent) ?? detail?.versions[0] ?? null,
    [detail],
  )

  useEffect(() => {
    if (!currentVersion) return
    setVersionForm((prev) => ({
      ...prev,
      name: currentVersion.name ?? detail?.definition.name ?? '',
      profile: currentVersion.profile ?? '',
      goals: currentVersion.goals ?? '',
      painPoints: currentVersion.painPoints ?? '',
      bodyMarkdown: currentVersion.bodyMarkdown ?? currentVersion.profile ?? '',
    }))
  }, [currentVersion, detail?.definition.name])

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
      await sagaApi.updatePersona(detail.definition.personaKey, {
        name: editForm.name.trim(),
        status: editForm.status,
        profileSummary: editForm.profileSummary.trim() || null,
        sourceRef: editForm.sourceRef.trim() || null,
        sourceFilePath: editForm.sourceFilePath.trim() || null,
      })
      setEditOpen(false)
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to update persona.')
    } finally {
      setIsSaving(false)
    }
  }

  async function createVersion() {
    if (!detail || !versionForm.bodyMarkdown.trim()) return
    setIsSaving(true)
    setError(null)
    try {
      await sagaApi.createPersonaVersion(detail.definition.personaKey, {
        name: versionForm.name.trim() || detail.definition.name,
        profile: versionForm.profile.trim() || null,
        goals: versionForm.goals.trim() || null,
        painPoints: versionForm.painPoints.trim() || null,
        bodyMarkdown: versionForm.bodyMarkdown,
        isCurrent: true,
      })
      setVersionOpen(false)
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to create persona version.')
    } finally {
      setIsSaving(false)
    }
  }

  async function deletePersona() {
    if (!detail) return
    setIsDeleting(true)
    setError(null)
    try {
      await sagaApi.deletePersona(detail.definition.personaKey)
      window.location.href = '/ooda/personas'
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to delete persona.')
      setIsDeleting(false)
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <PageIntro
        eyebrow="Persona"
        title={detail ? `${detail.definition.personaKey} · ${detail.definition.name}` : personaKey}
        description={detail?.definition.profileSummary ?? 'Open linked saga definitions to inspect how this persona pressures platform behavior.'}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/ooda/personas">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to personas
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
                  <AlertDialogTitle>Delete persona?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This archives the persona definition row and removes it from the active library view.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => void deletePersona()} disabled={isDeleting}>
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
                    <CardTitle>Current persona profile</CardTitle>
                    <LifecycleBadge status={detail.definition.status} />
                  </div>
                  <CardDescription>
                    The current persona describes behavior and pressure points used by saga definitions.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-sm leading-6">
                  <div className="rounded-lg border p-4 whitespace-pre-wrap">{currentVersion?.bodyMarkdown ?? currentVersion?.profile ?? 'No current persona body is available.'}</div>
                  {currentVersion?.goals ? (
                    <div className="rounded-lg border p-4 whitespace-pre-wrap">
                      <p className="mb-2 font-medium">Goals</p>
                      <p>{currentVersion.goals}</p>
                    </div>
                  ) : null}
                  {currentVersion?.painPoints ? (
                    <div className="rounded-lg border p-4 whitespace-pre-wrap">
                      <p className="mb-2 font-medium">Pain points</p>
                      <p>{currentVersion.painPoints}</p>
                    </div>
                  ) : null}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Linked saga coverage</CardTitle>
                  <CardDescription>
                    These numbers show how many definitions and runs currently use this persona to test the platform.
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
                <CardDescription>Old persona versions matter when earlier saga definitions still reflect a previous testing style.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {detail.versions.map((version, index) => (
                  <div key={version.id} className="space-y-3">
                    {index > 0 ? <Separator /> : null}
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium">v{version.versionNumber} · {version.name}</p>
                        <p className="text-sm text-muted-foreground">{version.profile ?? 'No profile summary attached.'}</p>
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
                <CardDescription>Open a linked definition to see the exact lifecycle steps this persona participates in.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {definitionSummaries.map(({ definition, latestRun, runSummary }) => (
                    <EntitySummaryCard
                      key={definition.id}
                      href={`/ooda/definitions/${encodeURIComponent(definition.sagaKey)}`}
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
          </div>
        )}
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit persona</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh] pr-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="persona-edit-name">Name</Label>
                <Input
                  id="persona-edit-name"
                  value={editForm.name}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, name: event.target.value }))}
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
                <Label htmlFor="persona-edit-summary">Profile Summary</Label>
                <Textarea
                  id="persona-edit-summary"
                  value={editForm.profileSummary}
                  onChange={(event) =>
                    setEditForm((prev) => ({ ...prev, profileSummary: event.target.value }))
                  }
                  rows={4}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="persona-edit-source-ref">Source Ref</Label>
                <Input
                  id="persona-edit-source-ref"
                  value={editForm.sourceRef}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, sourceRef: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="persona-edit-source-file">Source File Path</Label>
                <Input
                  id="persona-edit-source-file"
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
            <Button onClick={() => void saveDefinitionEdits()} disabled={isSaving || !editForm.name.trim()}>
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={versionOpen} onOpenChange={setVersionOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Create persona version</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh] pr-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="persona-version-name">Version Name</Label>
                <Input
                  id="persona-version-name"
                  value={versionForm.name}
                  onChange={(event) => setVersionForm((prev) => ({ ...prev, name: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="persona-version-profile">Profile</Label>
                <Textarea
                  id="persona-version-profile"
                  value={versionForm.profile}
                  onChange={(event) => setVersionForm((prev) => ({ ...prev, profile: event.target.value }))}
                  rows={4}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="persona-version-goals">Goals</Label>
                <Textarea
                  id="persona-version-goals"
                  value={versionForm.goals}
                  onChange={(event) => setVersionForm((prev) => ({ ...prev, goals: event.target.value }))}
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="persona-version-pain">Pain Points</Label>
                <Textarea
                  id="persona-version-pain"
                  value={versionForm.painPoints}
                  onChange={(event) =>
                    setVersionForm((prev) => ({ ...prev, painPoints: event.target.value }))
                  }
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="persona-version-body">Body Markdown</Label>
                <Textarea
                  id="persona-version-body"
                  value={versionForm.bodyMarkdown}
                  onChange={(event) =>
                    setVersionForm((prev) => ({ ...prev, bodyMarkdown: event.target.value }))
                  }
                  rows={14}
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
