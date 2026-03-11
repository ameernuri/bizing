'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, BookOpenCheck, FileSearch, FlaskConical, PlayCircle, TrendingUp, AlertCircle, Activity, Target, Settings2, BrainCircuit } from 'lucide-react'
import { PlatformHealthCards } from '@/components/sagas/platform-health-cards'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { sagaApi, type SagaLibraryOverview, type SagaRunSummary, type SchemaCoverageReport } from '@/lib/sagas-api'
import { oodaApi, type KnowledgeStats, type KnowledgeSyncStatus, type OodaOverview } from '@/lib/ooda-api'
import { parseUcCoverageEntry } from '@/lib/uc-coverage'
import { useSagaRealtime } from '@/lib/use-saga-realtime'
import { cn } from '@/lib/utils'
import { ExplorerLinkCards, LoadError, PageIntro, SmallRunList, summarizeRuns } from './common'

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

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
  const [oodaOverview, setOodaOverview] = useState<OodaOverview | null>(null)
  const [libraryOverview, setLibraryOverview] = useState<SagaLibraryOverview | null>(null)
  const [runs, setRuns] = useState<SagaRunSummary[]>([])
  const [coverageReports, setCoverageReports] = useState<SchemaCoverageReport[]>([])
  const [coverageHotspots, setCoverageHotspots] = useState<Array<{ ucKey: string; title: string; verdict: string }>>([])
  const [knowledgeStats, setKnowledgeStats] = useState<KnowledgeStats | null>(null)
  const [knowledgeSync, setKnowledgeSync] = useState<KnowledgeSyncStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const realtimeRefreshRef = useRef<number | null>(null)
  const loadInFlightRef = useRef(false)

  async function load(options?: { background?: boolean }) {
    const background = options?.background === true
    if (loadInFlightRef.current) return
    loadInFlightRef.current = true
    if (!background) {
      setIsLoading(true)
      setError(null)
    }
    try {
      const [overview, ooda, reports, kStats, kSync] = await Promise.all([
        sagaApi.fetchLibraryOverview(),
        oodaApi.fetchOverview(),
        sagaApi.fetchUcCoverageReports(5),
        oodaApi.fetchKnowledgeStats().catch(() => null),
        oodaApi.fetchKnowledgeSyncStatus().catch(() => null),
      ])
      setLibraryOverview(overview)
      setOodaOverview(ooda)
      setRuns(ooda.recentRuns)
      setCoverageReports(reports)
      setKnowledgeStats(kStats)
      setKnowledgeSync(kSync)
      if (reports[0]) {
        const detail = await sagaApi.fetchUcCoverageReportDetail(reports[0].id)
        const hotspots = detail.items
          .filter((item) => item.itemType === 'use_case')
          .map(parseUcCoverageEntry)
          .filter((item) => item.overallVerdict === 'gap' || item.overallVerdict === 'partial')
          .slice(0, 6)
          .map((item) => ({ ucKey: item.ucKey, title: item.title, verdict: item.overallVerdict }))
        setCoverageHotspots(hotspots)
      } else {
        setCoverageHotspots([])
      }
    } catch (cause) {
      if (!background || !libraryOverview) {
        setError(cause instanceof Error ? cause.message : 'Failed to load saga dashboard.')
      }
    } finally {
      loadInFlightRef.current = false
      if (!background) setIsLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const realtime = useSagaRealtime({
    onEvent: () => {
      if (realtimeRefreshRef.current !== null) window.clearTimeout(realtimeRefreshRef.current)
      realtimeRefreshRef.current = window.setTimeout(() => {
        void load({ background: true })
      }, 300)
    },
  })

  useEffect(() => {
    return () => {
      if (realtimeRefreshRef.current !== null) window.clearTimeout(realtimeRefreshRef.current)
    }
  }, [])

  const runSummary = useMemo(() => summarizeRuns(runs), [runs])
  const groupSummary = useMemo(() => buildGroupSummary(runs), [runs])
  const recentRuns = useMemo(
    () => [...runs].sort((a, b) => new Date(b.updatedAt ?? b.createdAt ?? 0).getTime() - new Date(a.updatedAt ?? a.createdAt ?? 0).getTime()).slice(0, 10),
    [runs],
  )
  const latestCoverage = coverageReports[0] ?? null
  const latestCoverageTotals = useMemo(() => {
    const root = asRecord(latestCoverage?.reportData)
    const totals = asRecord(root?.totals)
    const overall = asRecord(totals?.overall)
    return {
      full: typeof overall?.full === 'number' ? overall.full : 0,
      strong: typeof overall?.strong === 'number' ? overall.strong : 0,
      partial: typeof overall?.partial === 'number' ? overall.partial : 0,
      gap: typeof overall?.gap === 'number' ? overall.gap : 0,
    }
  }, [latestCoverage])
  const attentionBlockers = oodaOverview?.attention?.blockers ?? []
  const reorientHints = oodaOverview?.attention?.reorient ?? []
  const knowledgeGroupSummary = useMemo(() => {
    const groups = knowledgeSync?.syncGroups ?? []
    const healthy = groups.filter((group) => group.allSameCommitSha && group.allSameEventCursor).length
    return { total: groups.length, healthy, drifting: Math.max(0, groups.length - healthy) }
  }, [knowledgeSync])

  return (
    <div className="flex flex-1 flex-col">
      <PageIntro
        eyebrow="Overview"
        title="Evolution Control Center"
        description="Mission health, schema/API evidence, current failure clusters, and direct drilldowns into use cases, personas, definitions, and runs."
        actions={
          <>
            <div className={cn(
              "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium shadow-sm",
              realtime.connected 
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700" 
                : "border-amber-500/30 bg-amber-500/10 text-amber-700"
            )}>
              <div className={cn("h-1.5 w-1.5 rounded-full", realtime.connected ? "bg-emerald-500 animate-pulse" : "bg-amber-500")} />
              {realtime.connected ? 'Live' : 'Offline'}
            </div>            
            <Button variant="outline" size="sm" className="gap-2 rounded-lg shadow-sm" asChild>
              <Link href="/ooda/studio">
                <Settings2 className="h-4 w-4" />
                Studio
              </Link>
            </Button>            
            <Button variant="outline" size="sm" className="gap-2 rounded-lg shadow-sm" asChild>
              <Link href="/ooda/lab">
                <FlaskConical className="h-4 w-4" />
                QA Lab
              </Link>
            </Button>            
            <Button size="sm" className="gap-2 rounded-lg shadow-sm" asChild>
              <Link href="/ooda/runs">
                Run History
                <ArrowRight className="h-4 w-4" />
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
                <Card key={index} className="overflow-hidden">
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
              libraryOverview={{ counts: { useCases: oodaOverview?.library.useCases ?? libraryOverview?.counts.useCases ?? 0, personas: oodaOverview?.library.personas ?? libraryOverview?.counts.personas ?? 0 } }}
            />

            <ExplorerLinkCards
              counts={{
                loops: oodaOverview?.health.totalLoops ?? 0,
                useCases: oodaOverview?.library.useCases ?? libraryOverview?.counts.useCases ?? 0,
                personas: oodaOverview?.library.personas ?? libraryOverview?.counts.personas ?? 0,
                definitions:
                  oodaOverview?.library.definitions ?? libraryOverview?.counts.sagaDefinitions ?? 0,
                runs: oodaOverview?.library.runs ?? libraryOverview?.counts.sagaRuns ?? 0,
              }}
            />

            <Card className="overflow-hidden border-border/50 shadow-sm">
              <CardHeader className="border-b border-border/30 bg-muted/30 px-6 py-5">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-500/10">
                      <BrainCircuit className="h-5 w-5 text-cyan-600" />
                    </div>
                    <div>
                      <CardTitle className="text-base font-semibold">Knowledge Sync</CardTitle>
                      <CardDescription className="text-sm">
                        Shared memory health between Codex and OpenClaw runtimes.
                      </CardDescription>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="gap-2 rounded-lg" asChild>
                    <Link href="/ooda/knowledge">
                      Open
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="grid gap-4 p-6 md:grid-cols-4">
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Sources</p>
                  <p className="text-2xl font-semibold">{knowledgeStats?.sources ?? 0}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Documents</p>
                  <p className="text-2xl font-semibold">{knowledgeStats?.documents ?? 0}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Chunks / Embeddings</p>
                  <p className="text-2xl font-semibold">
                    {(knowledgeStats?.chunks ?? 0).toLocaleString()} / {(knowledgeStats?.embeddings ?? 0).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Sync Groups</p>
                  <p className="text-2xl font-semibold">{knowledgeGroupSummary.healthy}/{knowledgeGroupSummary.total}</p>
                  <p className="text-xs text-muted-foreground">{knowledgeGroupSummary.drifting} drifting</p>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">              
              <Card className="overflow-hidden border-border/50 shadow-sm">
                <CardHeader className="border-b border-border/30 bg-muted/30 px-6 py-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                        <TrendingUp className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-base font-semibold">UC Coverage (Schema + API)</CardTitle>
                        <CardDescription className="text-sm">
                          Canonical matrix showing which UCs are proven, weak, or still missing.
                        </CardDescription>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" className="gap-2 rounded-lg" asChild>
                      <Link href="/ooda/coverage">
                        Inspect
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6 p-6">
                  {latestCoverage ? (
                    <>
                      <div className="flex items-start justify-between gap-4 rounded-xl border border-border/50 bg-gradient-to-br from-muted/50 to-muted/20 p-5">
                        <div className="space-y-1">
                          <p className="font-semibold text-foreground">{latestCoverage.title ?? 'Latest schema coverage report'}</p>
                          <p className="text-sm text-muted-foreground">{latestCoverage.summary ?? 'No summary attached.'}</p>
                        </div>
                        <Badge variant="secondary" className="shrink-0">
                          Latest
                        </Badge>
                      </div>
                      
                      <div className="grid gap-4 md:grid-cols-3">
                        <Card className="overflow-hidden border-border/30">
                          <CardHeader className="border-b border-border/20 bg-muted/20 pb-3 pt-4">
                          <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Coverage Full</CardTitle>
                        </CardHeader>                          
                        <CardContent className="flex items-center gap-3 py-4">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                            <BookOpenCheck className="h-5 w-5 text-blue-600" />
                          </div>
                          <div className="text-3xl font-bold tracking-tight">
                              {latestCoverageTotals.full}
                          </div>
                        </CardContent>
                      </Card>
                        
                        <Card className="overflow-hidden border-border/30">
                          <CardHeader className="border-b border-border/20 bg-muted/20 pb-3 pt-4">
                          <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Coverage Strong</CardTitle>
                        </CardHeader>                          
                        <CardContent className="flex items-center gap-3 py-4">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/10">
                            <FileSearch className="h-5 w-5 text-violet-600" />
                          </div>
                          <div className="text-3xl font-bold tracking-tight">
                              {latestCoverageTotals.strong}
                          </div>
                        </CardContent>
                      </Card>
                        
                        <Card className="overflow-hidden border-border/30">
                          <CardHeader className="border-b border-border/20 bg-muted/20 pb-3 pt-4">
                          <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Coverage Gaps</CardTitle>
                        </CardHeader>                          
                        <CardContent className="flex items-center gap-3 py-4">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
                            <PlayCircle className="h-5 w-5 text-emerald-600" />
                          </div>
                          <div className="text-3xl font-bold tracking-tight">
                              {latestCoverageTotals.gap}
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                    {coverageHotspots.length > 0 ? (
                      <div className="space-y-2 rounded-xl border border-border/50 bg-muted/20 p-4">
                        <p className="text-sm font-medium">Most important unresolved UCs</p>
                        <div className="space-y-2">
                          {coverageHotspots.map((hotspot) => (
                            <Link
                              key={hotspot.ucKey}
                              href={`/ooda/use-cases/${encodeURIComponent(hotspot.ucKey)}`}
                              className="flex items-center justify-between gap-3 rounded-md border bg-background p-2 text-sm hover:border-primary/40"
                            >
                              <span className="truncate">{hotspot.ucKey} · {hotspot.title}</span>
                              <Badge variant="outline" className={hotspot.verdict === 'gap' ? 'border-destructive/40 bg-destructive/10 text-destructive' : 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300'}>
                                {hotspot.verdict}
                              </Badge>
                            </Link>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/50 bg-muted/20 py-12 text-center">
                      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                        <FileSearch className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <p className="text-sm font-medium text-muted-foreground">No UC coverage report generated yet.</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="overflow-hidden border-border/50 shadow-sm">
                <CardHeader className="border-b border-border/30 bg-muted/30 px-6 py-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10">
                      <AlertCircle className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                      <CardTitle className="text-base font-semibold">Top Blockers</CardTitle>
                      <CardDescription className="text-sm">
                        Failures first: what broke most recently and what needs action now.
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {attentionBlockers.length === 0 ? (
                    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
                      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10">
                        <Activity className="h-6 w-6 text-emerald-600" />
                      </div>
                      <p className="text-sm font-medium text-muted-foreground">All systems green. No failures detected.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-border/30">
                      {attentionBlockers.slice(0, 8).map((blocker) => (
                        <div key={blocker.id} className="group relative block overflow-hidden p-4 transition-colors hover:bg-muted/30">
                          <div className="relative flex items-center justify-between gap-4">
                            <div className="min-w-0 space-y-1">
                              <p className="truncate font-medium text-foreground group-hover:text-primary">{blocker.title}</p>
                              <p className="text-xs text-muted-foreground">
                                {blocker.summary}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {blocker.failureSignature ?? 'UNKNOWN'} • {blocker.updatedAt ? new Date(blocker.updatedAt).toLocaleString() : 'no timestamp'}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">{blocker.severity}</Badge>
                              {blocker.sagaRunId ? (
                                <Button size="sm" variant="outline" asChild>
                                  <Link href={`/ooda/runs/${blocker.sagaRunId}`}>Open run</Link>
                                </Button>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {reorientHints.length > 0 ? (
              <Card className="overflow-hidden border-border/50 shadow-sm">
                <CardHeader className="border-b border-border/30 bg-muted/30 px-6 py-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                      <Target className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <CardTitle className="text-base font-semibold">Reorient</CardTitle>
                      <CardDescription className="text-sm">
                        Top failure clusters and the next pragmatic move.
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 p-6">
                  {reorientHints.map((hint) => (
                    <div key={hint.signature} className="rounded-lg border p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-medium">{hint.signature}</p>
                        <Badge variant="outline">{hint.count}</Badge>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">{hint.exampleTitle}</p>
                      <p className="mt-1 text-sm">{hint.recommendation}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ) : null}

            <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">              
              <Card className="overflow-hidden border-border/50 shadow-sm">
                <CardHeader className="border-b border-border/30 bg-muted/30 px-6 py-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                      <PlayCircle className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <CardTitle className="text-base font-semibold">Recent Runs</CardTitle>
                      <CardDescription className="text-sm">Latest saga executions across the library</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <SmallRunList runs={recentRuns} emptyLabel="No runs recorded yet." />
                </CardContent>
              </Card>

              <Card className="overflow-hidden border-border/50 shadow-sm">
                <CardHeader className="border-b border-border/30 bg-muted/30 px-6 py-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/10">
                      <Target className="h-5 w-5 text-violet-600" />
                    </div>
                    <div>
                      <CardTitle className="text-base font-semibold">Active OODA Loops</CardTitle>
                      <CardDescription className="text-sm">What matters now — track phase-by-phase progress</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {(oodaOverview?.activeLoops ?? []).slice(0, 6).map((loop, index) => (
                    <Link
                      key={loop.id}
                      href={`/ooda/loops/${loop.id}`}
                      className="group block border-b border-border/20 p-5 transition-colors last:border-b-0 hover:bg-muted/30"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 space-y-2">
                          <p className="truncate font-medium text-foreground group-hover:text-primary">{loop.title}</p>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[10px] uppercase">{loop.currentPhase}</Badge>
                            <span className="text-xs text-muted-foreground">• Priority {loop.priority}</span>
                          </div>
                          
                          <p className="text-sm text-muted-foreground line-clamp-2">{loop.objective ?? 'No objective set.'}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-xs font-medium text-muted-foreground">Open</p>
                          <p className="text-2xl font-bold text-foreground">{loop.openItems}</p>
                        </div>
                      </div>
                    </Link>
                  ))}
                  {(oodaOverview?.activeLoops?.length ?? 0) === 0 ? (
                    <div className="space-y-5 px-6 py-8 text-sm text-muted-foreground">
                      <div className="flex items-start gap-4 rounded-lg border border-border/50 bg-muted/20 p-4">
                        <BookOpenCheck className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
                        <div>
                          <p className="font-medium text-foreground">Use Cases</p>
                          <p>Explain what reality the product is meant to support.</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-4 rounded-lg border border-border/50 bg-muted/20 p-4">
                        <FileSearch className="mt-0.5 h-5 w-5 shrink-0 text-violet-600" />
                        <div>
                          <p className="font-medium text-foreground">Saga Definitions</p>
                          <p>Translate needs into concrete lifecycle scripts.</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-4 rounded-lg border border-border/50 bg-muted/20 p-4">
                        <PlayCircle className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                        <div>
                          <p className="font-medium text-foreground">Runs</p>
                          <p>Show what happened and where the system broke.</p>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
