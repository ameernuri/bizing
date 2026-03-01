'use client'

import { useEffect, useMemo, useState } from 'react'
import { sagaApi, type SagaDefinitionSummary, type SagaRunSummary } from '@/lib/sagas-api'
import { EntitySummaryCard, getLatestRun, LifecycleBadge, LoadError, LoadingGrid, PageIntro, RunStatusBadge, SearchToolbar, summarizeRuns } from './common'

export function SagaDefinitionsPage() {
  const [definitions, setDefinitions] = useState<SagaDefinitionSummary[]>([])
  const [runs, setRuns] = useState<SagaRunSummary[]>([])
  const [query, setQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setIsLoading(true)
    setError(null)
    try {
      const [nextDefinitions, allRuns] = await Promise.all([
        sagaApi.fetchDefinitions(),
        sagaApi.fetchRuns({ limit: 5000, mineOnly: false, includeArchived: true }),
      ])
      setDefinitions([...nextDefinitions].sort((a, b) => a.sagaKey.localeCompare(b.sagaKey)))
      setRuns(allRuns)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to load saga definitions.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return definitions
    return definitions.filter((item) =>
      [item.sagaKey, item.title, item.description ?? '', item.sourceUseCaseRef ?? '', item.sourcePersonaRef ?? ''].some((value) => value.toLowerCase().includes(needle)),
    )
  }, [definitions, query])

  return (
    <div className="flex flex-1 flex-col">
      <PageIntro
        eyebrow="Saga Library"
        title="Saga definitions"
        description="Definitions are the executable bridge between use cases and personas. Open one to see the canonical spec, linked library items, revision history, and run evidence."
      />
      <SearchToolbar value={query} onChange={setQuery} placeholder="Search definitions by key, title, description, use case, or persona" meta={`${filtered.length} of ${definitions.length} definitions`} />
      <div className="flex-1 p-6">
        {error ? <LoadError message={error} onRetry={() => void load()} /> : null}
        {isLoading ? (
          <LoadingGrid count={9} />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((definition) => {
              const definitionRuns = runs.filter((run) => run.sagaKey === definition.sagaKey)
              const latestRun = getLatestRun(definitionRuns)
              const summary = summarizeRuns(definitionRuns)
              return (
                <EntitySummaryCard
                  key={definition.id}
                  href={`/sagas/definitions/${encodeURIComponent(definition.sagaKey)}`}
                  title={`${definition.sagaKey} · ${definition.title}`}
                  description={definition.description}
                  status={latestRun ? <RunStatusBadge status={latestRun.status} /> : <LifecycleBadge status={definition.status} />}
                  footer={
                    <div className="space-y-1">
                      <p>{summary.passed}/{summary.total} runs passed</p>
                      <p>Use case: {definition.sourceUseCaseRef ?? 'not linked'}</p>
                      <p>Persona: {definition.sourcePersonaRef ?? 'not linked'}</p>
                    </div>
                  }
                />
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
