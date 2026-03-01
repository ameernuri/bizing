'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { sagaApi, type SagaDefinitionSummary, type SagaRunSummary } from '@/lib/sagas-api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { EmptyState, LoadError, LoadingGrid, PageIntro, RunProgressBackdrop, RunStatusBadge, SearchToolbar, summarizeRuns } from './common'

function groupRuns(runs: SagaRunSummary[], definitions: SagaDefinitionSummary[]) {
  const definitionBySagaKey = new Map(definitions.map((definition) => [definition.sagaKey, definition]))
  const grouped = new Map<string, SagaRunSummary[]>()
  for (const run of runs) {
    const existing = grouped.get(run.sagaKey) ?? []
    existing.push(run)
    grouped.set(run.sagaKey, existing)
  }
  return Array.from(grouped.entries())
    .map(([sagaKey, entries]) => {
      const sortedRuns = [...entries].sort((a, b) => new Date(b.updatedAt ?? b.createdAt ?? 0).getTime() - new Date(a.updatedAt ?? a.createdAt ?? 0).getTime())
      return {
        sagaKey,
        definition: definitionBySagaKey.get(sagaKey) ?? null,
        latest: sortedRuns[0],
        runs: sortedRuns,
        summary: summarizeRuns(sortedRuns),
      }
    })
    .sort((a, b) => new Date(b.latest.updatedAt ?? b.latest.createdAt ?? 0).getTime() - new Date(a.latest.updatedAt ?? a.latest.createdAt ?? 0).getTime())
}

export function SagaRunsPage() {
  const [runs, setRuns] = useState<SagaRunSummary[]>([])
  const [definitions, setDefinitions] = useState<SagaDefinitionSummary[]>([])
  const [query, setQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setIsLoading(true)
    setError(null)
    try {
      const [nextRuns, nextDefinitions] = await Promise.all([
        sagaApi.fetchRuns({ limit: 5000, mineOnly: false, includeArchived: true }),
        sagaApi.fetchDefinitions(),
      ])
      setRuns(nextRuns)
      setDefinitions(nextDefinitions)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to load saga runs.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const grouped = useMemo(() => groupRuns(runs, definitions), [runs, definitions])
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return grouped
    return grouped.filter((group) =>
      [group.sagaKey, group.definition?.title ?? '', group.definition?.description ?? ''].some((value) => value.toLowerCase().includes(needle)),
    )
  }, [grouped, query])

  return (
    <div className="flex flex-1 flex-col">
      <PageIntro
        eyebrow="Execution History"
        title="Saga runs"
        description="Runs are grouped by saga definition so you can inspect current health first, then drill into the exact attempt that failed or passed."
      />
      <SearchToolbar value={query} onChange={setQuery} placeholder="Search runs by saga key or definition title" meta={`${filtered.length} of ${grouped.length} saga groups`} />
      <div className="flex-1 p-6">
        {error ? <LoadError message={error} onRetry={() => void load()} /> : null}
        {isLoading ? (
          <LoadingGrid count={9} />
        ) : filtered.length === 0 ? (
          <EmptyState title="No saga runs found" description="Create a run from a saga definition page to start building execution history." />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((group) => (
              <Card key={group.sagaKey} className="relative h-full overflow-hidden">
                <RunProgressBackdrop run={group.latest} />
                <CardHeader className="relative space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <CardTitle className="text-base">{group.definition?.title ?? group.sagaKey}</CardTitle>
                      <CardDescription>{group.sagaKey}</CardDescription>
                    </div>
                    <RunStatusBadge status={group.latest.status} />
                  </div>
                  <p className="text-sm text-muted-foreground">{group.definition?.description ?? 'No definition description attached.'}</p>
                </CardHeader>
                <CardContent className="relative space-y-4 text-sm">
                  <div className="grid gap-3 grid-cols-3">
                    <div className="rounded-lg border p-3">
                      <p className="text-lg font-semibold">{group.summary.passRate}%</p>
                      <p className="text-xs text-muted-foreground">pass rate</p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-lg font-semibold">{group.summary.total}</p>
                      <p className="text-xs text-muted-foreground">runs</p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-lg font-semibold">{group.latest.passedSteps}/{group.latest.totalSteps}</p>
                      <p className="text-xs text-muted-foreground">latest steps</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button className="flex-1" asChild>
                      <Link href={`/sagas/runs/${group.latest.id}`}>Open latest run</Link>
                    </Button>
                    <Button variant="outline" className="flex-1" asChild>
                      <Link href={`/sagas/definitions/${encodeURIComponent(group.sagaKey)}`}>Definition</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
