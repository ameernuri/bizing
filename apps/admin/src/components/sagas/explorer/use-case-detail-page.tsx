'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, GitBranch, PlayCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { sagaApi, type SagaLibraryRelations, type SagaRunSummary, type SagaUseCaseDetail } from '@/lib/sagas-api'
import { EntitySummaryCard, getLatestRun, LifecycleBadge, LoadError, LoadingGrid, PageIntro, RunStatusBadge, summarizeRuns } from './common'

export function SagaUseCaseDetailPage({ ucKey }: { ucKey: string }) {
  const [detail, setDetail] = useState<SagaUseCaseDetail | null>(null)
  const [relations, setRelations] = useState<SagaLibraryRelations | null>(null)
  const [runs, setRuns] = useState<SagaRunSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

  return (
    <div className="flex flex-1 flex-col">
      <PageIntro
        eyebrow="Use Case"
        title={detail ? `${detail.definition.ucKey} · ${detail.definition.title}` : ucKey}
        description={detail?.definition.summary ?? 'Open the linked saga definitions below to inspect the lifecycle scripts and their run history.'}
        actions={
          <Button variant="outline" asChild>
            <Link href="/sagas/use-cases">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to use cases
            </Link>
          </Button>
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
    </div>
  )
}
