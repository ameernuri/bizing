'use client'

import { useEffect, useMemo, useState } from 'react'
import { sagaApi, type SagaUseCaseDefinition } from '@/lib/sagas-api'
import { EntitySummaryCard, LifecycleBadge, listSummaryFooter, LoadError, LoadingGrid, PageIntro, SearchToolbar, sortByTitle } from './common'

export function SagaUseCasesPage() {
  const [items, setItems] = useState<SagaUseCaseDefinition[]>([])
  const [query, setQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setIsLoading(true)
    setError(null)
    try {
      setItems(sortByTitle(await sagaApi.fetchUseCases(), (item) => `${item.ucKey} ${item.title}`))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to load use cases.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return items
    return items.filter((item) =>
      [item.ucKey, item.title, item.summary ?? '', item.sourceRef ?? ''].some((value) => value.toLowerCase().includes(needle)),
    )
  }, [items, query])

  return (
    <div className="flex flex-1 flex-col">
      <PageIntro
        eyebrow="Saga Library"
        title="Use cases"
        description="Each use case captures a business reality the platform is expected to model. Open one to inspect its versions, linked saga definitions, and the run history proving or disproving it."
      />
      <SearchToolbar value={query} onChange={setQuery} placeholder="Search use cases by key, title, summary, or source ref" meta={`${filtered.length} of ${items.length} use cases`} />
      <div className="flex-1 p-6">
        {error ? <LoadError message={error} onRetry={() => void load()} /> : null}
        {isLoading ? (
          <LoadingGrid count={9} />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((item) => (
              <EntitySummaryCard
                key={item.id}
                href={`/sagas/use-cases/${encodeURIComponent(item.ucKey)}`}
                title={`${item.ucKey} · ${item.title}`}
                description={item.summary}
                status={<LifecycleBadge status={item.status} />}
                footer={listSummaryFooter(item)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
