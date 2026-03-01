'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, BookOpenCheck, FileSearch, PlayCircle } from 'lucide-react'
import { PlatformHealthCards } from '@/components/sagas/platform-health-cards'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { sagaApi, type SagaLibraryOverview, type SagaRunSummary, type SchemaCoverageReport } from '@/lib/sagas-api'
import { ExplorerLinkCards, LoadError, PageIntro, RunProgressBackdrop, RunStatusBadge, SmallRunList, summarizeRuns } from './common'

function buildGroupSummary(runs: SagaRunSummary[]) {
  const groups = new Map<string, SagaRunSummary[]>()
  for (const run of runs) {
    const existing = groups.get(run.sagaKey) ?? []
    existing.push(run)
    groups.set(run.sagaKey, existing)
  }
  const latestRuns = Array.from(groups.values()).map((group) =>
    [...group].sort((a, b) => new Date(b.updatedAt ?? b.createdAt ?? 0).getTime() - new Date(a.updatedAt ?? a.createdAt ?? 0).getTime())[0],
  )
  const healthy = latestRuns.filter((run) => run.status === 'passed').length
  const active = latestRuns.filter((run) => run.status === 'running' || run.status === 'pending').length
  const bad = latestRuns.filter((run) => run.status === 'failed' || run.status === 'cancelled').length
  return {
    totalSagas: latestRuns.length,
    healthy,
    active,
    bad,
    currentCoveragePct: latestRuns.length ? Math.round((healthy / latestRuns.length) * 100) : 0,
  }
}

export function SagaDashboardPage() {
  const [libraryOverview, setLibraryOverview] = useState<SagaLibraryOverview | null>(null)
  const [runs, setRuns] = useState<SagaRunSummary[]>([])
  const [schemaReports, setSchemaReports] = useState<SchemaCoverageReport[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setIsLoading(true)
    setError(null)
    try {
      const [overview, allRuns, reports] = await Promise.all([
        sagaApi.fetchLibraryOverview(),
        sagaApi.fetchRuns({ limit: 5000, mineOnly: false, includeArchived: true }),
        sagaApi.fetchSchemaCoverageReports(),
      ])
      setLibraryOverview(overview)
      setRuns(allRuns)
      setSchemaReports(reports)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to load saga dashboard.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const runSummary = useMemo(() => summarizeRuns(runs), [runs])
  const groupSummary = useMemo(() => buildGroupSummary(runs), [runs])
  const recentRuns = useMemo(
    () => [...runs].sort((a, b) => new Date(b.updatedAt ?? b.createdAt ?? 0).getTime() - new Date(a.updatedAt ?? a.createdAt ?? 0).getTime()).slice(0, 8),
    [runs],
  )
  const latestCoverage = schemaReports[0] ?? null
  const attentionRuns = useMemo(
    () => recentRuns.filter((run) => run.status !== 'passed').slice(0, 6),
    [recentRuns],
  )

  return (
    <div className="flex flex-1 flex-col">
      <PageIntro
        eyebrow="Saga Loop"
        title="Schema and API validation control center"
        description="Use the explorer to inspect use cases, personas, saga definitions, and run history as separate first-class views. The dashboard answers one question quickly: what is healthy right now and where is the next failure cluster?"
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/sagas/definitions">
                Definition library
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild>
              <Link href="/sagas/runs">
                Run history
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </>
        }
      />

      <div className="flex flex-1 flex-col gap-6 p-6">
        {error ? <LoadError message={error} onRetry={() => void load()} /> : null}

        {isLoading ? (
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <Card key={index}>
                  <CardHeader className="pb-2">
                    <Skeleton className="h-4 w-28" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-8 w-20" />
                    <Skeleton className="mt-2 h-4 w-32" />
                  </CardContent>
                </Card>
              ))}
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <Card key={index}>
                  <CardHeader>
                    <Skeleton className="h-5 w-28" />
                    <Skeleton className="h-4 w-full" />
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>
        ) : (
          <>
            <PlatformHealthCards
              summary={{
                totalSagas: groupSummary.totalSagas,
                healthy: groupSummary.healthy,
                bad: groupSummary.bad,
                active: groupSummary.active,
                currentCoveragePct: groupSummary.currentCoveragePct,
                historicalCoveragePct: runSummary.passRate,
                historicalPassed: runSummary.passed,
                historicalTotal: runSummary.total,
              }}
              libraryOverview={{ counts: { useCases: libraryOverview?.counts.useCases ?? 0, personas: libraryOverview?.counts.personas ?? 0 } }}
            />

            <ExplorerLinkCards
              counts={{
                useCases: libraryOverview?.counts.useCases ?? 0,
                personas: libraryOverview?.counts.personas ?? 0,
                definitions: libraryOverview?.counts.sagaDefinitions ?? 0,
                runs: libraryOverview?.counts.sagaRuns ?? 0,
              }}
            />

            <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
              <Card>
                <CardHeader>
                  <CardTitle>Current schema coverage baseline</CardTitle>
                  <CardDescription>
                    The latest imported schema coverage report is the canonical reference for what the schema claims to support before runtime testing starts.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {latestCoverage ? (
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-3 rounded-lg border p-4">
                        <div className="space-y-1">
                          <p className="font-medium">{latestCoverage.title ?? 'Latest schema coverage report'}</p>
                          <p className="text-sm text-muted-foreground">{latestCoverage.summary ?? 'No summary attached.'}</p>
                        </div>
                        <Button variant="outline" size="sm" asChild>
                          <Link href="/sagas/definitions">
                            Inspect library
                            <ArrowRight className="ml-2 h-4 w-4" />
                          </Link>
                        </Button>
                      </div>
                      <div className="grid gap-3 md:grid-cols-3">
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm">Use cases</CardTitle>
                          </CardHeader>
                          <CardContent className="text-2xl font-semibold">{libraryOverview?.counts.useCases ?? 0}</CardContent>
                        </Card>
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm">Definitions</CardTitle>
                          </CardHeader>
                          <CardContent className="text-2xl font-semibold">{libraryOverview?.counts.sagaDefinitions ?? 0}</CardContent>
                        </Card>
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm">Runs recorded</CardTitle>
                          </CardHeader>
                          <CardContent className="text-2xl font-semibold">{libraryOverview?.counts.sagaRuns ?? 0}</CardContent>
                        </Card>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No schema coverage report has been imported yet.</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Attention queue</CardTitle>
                  <CardDescription>
                    These are the most recent runs that did not finish green. Use them as the next debugging queue.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {attentionRuns.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No failing or active runs are visible right now.</p>
                  ) : (
                    <div className="space-y-3">
                      {attentionRuns.map((run) => (
                        <Link href={`/sagas/runs/${run.id}`} key={run.id} className="relative block overflow-hidden rounded-lg border p-3 transition-colors hover:border-primary/40 hover:bg-muted/30">
                          <RunProgressBackdrop run={run} />
                          <div className="relative flex items-start justify-between gap-3">
                            <div className="space-y-1">
                              <p className="font-medium">{run.sagaKey}</p>
                              <p className="text-sm text-muted-foreground">
                                {run.passedSteps}/{run.totalSteps} passed • updated {new Date(run.updatedAt ?? run.createdAt ?? Date.now()).toLocaleString()}
                              </p>
                            </div>
                            <RunStatusBadge status={run.status} />
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
              <Card>
                <CardHeader>
                  <CardTitle>Recent runs</CardTitle>
                  <CardDescription>Latest saga executions across the whole library.</CardDescription>
                </CardHeader>
                <CardContent>
                  <SmallRunList runs={recentRuns} emptyLabel="No runs recorded yet." />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>What this workspace is for</CardTitle>
                  <CardDescription>The explorer separates the loop into durable layers so you can inspect one thing at a time without losing the connections.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-sm text-muted-foreground">
                  <div className="flex items-start gap-3">
                    <BookOpenCheck className="mt-0.5 h-4 w-4 shrink-0" />
                    <p><span className="font-medium text-foreground">Use cases</span> explain what reality the product is meant to support.</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <FileSearch className="mt-0.5 h-4 w-4 shrink-0" />
                    <p><span className="font-medium text-foreground">Saga definitions</span> translate those needs into concrete lifecycle scripts.</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <PlayCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <p><span className="font-medium text-foreground">Runs</span> show what actually happened, who saw what, and where the API or schema broke.</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
