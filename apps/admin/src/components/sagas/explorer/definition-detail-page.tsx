'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Play, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { sagaApi, type SagaDefinitionDetail, type SagaDefinitionLinksDetail, type SagaDefinitionRevision, type SagaRunSummary } from '@/lib/sagas-api'
import { EntitySummaryCard, LifecycleBadge, LoadError, LoadingGrid, PageIntro, RunStatusBadge, summarizeRuns } from './common'

export function SagaDefinitionDetailPage({ sagaKey }: { sagaKey: string }) {
  const [detail, setDetail] = useState<SagaDefinitionDetail | null>(null)
  const [links, setLinks] = useState<SagaDefinitionLinksDetail | null>(null)
  const [revisions, setRevisions] = useState<SagaDefinitionRevision[]>([])
  const [runs, setRuns] = useState<SagaRunSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isStartingRun, setIsStartingRun] = useState(false)

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
      window.location.href = `/sagas/runs/${created.run.id}`
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to start saga run.')
      setIsStartingRun(false)
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
            <Button onClick={() => void startRun()} disabled={isStartingRun || isLoading}>
              {isStartingRun ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
              Start dry run
            </Button>
          </>
        }
      />
      <div className="flex-1 p-6">
        {error ? <LoadError message={error} onRetry={() => void load()} /> : null}
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
                    This is the canonical executable shape: actors, phases, and steps that a saga run follows.
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
                    Use this panel to see whether the definition is currently proving itself in the real runner.
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
                <CardTitle>Linked use cases and personas</CardTitle>
                <CardDescription>These links tell you what business need this definition is trying to prove and which persona is used to exercise it.</CardDescription>
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
                      footer={`v${version.versionNumber} linked via ${links.links.find((link) => link.id)?.relationRole ?? 'definition_link'}`}
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
                      footer={`v${version.versionNumber} linked persona version`}
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
                <CardDescription>Open a run to inspect steps, messages, artifacts, and the exact failure point.</CardDescription>
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
    </div>
  )
}
