'use client'

import { useEffect, useMemo, useState } from 'react'
import { sagaApi, type SagaPersonaDefinition } from '@/lib/sagas-api'
import { EntitySummaryCard, LifecycleBadge, listSummaryFooter, LoadError, LoadingGrid, PageIntro, SearchToolbar, sortByTitle } from './common'

export function SagaPersonasPage() {
  const [items, setItems] = useState<SagaPersonaDefinition[]>([])
  const [query, setQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setIsLoading(true)
    setError(null)
    try {
      setItems(sortByTitle(await sagaApi.fetchPersonas(), (item) => `${item.personaKey} ${item.name}`))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to load personas.')
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
      [item.personaKey, item.name, item.profileSummary ?? '', item.sourceRef ?? ''].some((value) => value.toLowerCase().includes(needle)),
    )
  }, [items, query])

  return (
    <div className="flex flex-1 flex-col">
      <PageIntro
        eyebrow="Saga Library"
        title="Personas"
        description="Personas make the loop realistic. They define how different users interact with the same use case, what they care about, and what kinds of failures they are likely to expose."
      />
      <SearchToolbar value={query} onChange={setQuery} placeholder="Search personas by key, name, profile, or source ref" meta={`${filtered.length} of ${items.length} personas`} />
      <div className="flex-1 p-6">
        {error ? <LoadError message={error} onRetry={() => void load()} /> : null}
        {isLoading ? (
          <LoadingGrid count={9} />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((item) => (
              <EntitySummaryCard
                key={item.id}
                href={`/sagas/personas/${encodeURIComponent(item.personaKey)}`}
                title={`${item.personaKey} · ${item.name}`}
                description={item.profileSummary}
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
