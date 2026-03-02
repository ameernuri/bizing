'use client'

import { useEffect, useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { sagaApi, type SagaDefinitionSummary, type SagaRunSummary } from '@/lib/sagas-api'
import { oodaApi } from '@/lib/ooda-api'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { EntitySummaryCard, getLatestRun, LifecycleBadge, LoadError, LoadingGrid, PageIntro, RunStatusBadge, SearchToolbar, summarizeRuns } from './common'

export function SagaDefinitionsPage() {
  const [definitions, setDefinitions] = useState<SagaDefinitionSummary[]>([])
  const [runs, setRuns] = useState<SagaRunSummary[]>([])
  const [query, setQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [form, setForm] = useState({
    sagaKey: '',
    title: '',
    description: '',
  })

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

  async function createDefinition() {
    if (!form.sagaKey.trim() || !form.title.trim() || !form.description.trim()) return
    setIsSaving(true)
    try {
      await oodaApi.createDefinitionFromDraft({
        sagaKey: form.sagaKey.trim(),
        title: form.title.trim(),
        description: form.description.trim(),
        status: 'draft',
      })
      setCreateOpen(false)
      setForm({ sagaKey: '', title: '', description: '' })
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to create saga definition.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <PageIntro
        eyebrow="Saga Library"
        title="Saga definitions"
        description="Definitions are the executable bridge between use cases and personas. Open one to see the canonical spec, linked library items, revision history, and run evidence."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New definition
          </Button>
        }
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

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create saga definition</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="saga-key">Saga Key</Label>
              <Input
                id="saga-key"
                value={form.sagaKey}
                onChange={(event) => setForm((prev) => ({ ...prev, sagaKey: event.target.value }))}
                placeholder="uc-280-the-solo-entrepreneur-sarah"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="saga-title">Title</Label>
              <Input
                id="saga-title"
                value={form.title}
                onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                placeholder="UC-280 • Example"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="saga-desc">Description</Label>
              <Textarea
                id="saga-desc"
                value={form.description}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, description: event.target.value }))
                }
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void createDefinition()} disabled={isSaving || !form.sagaKey.trim() || !form.title.trim() || !form.description.trim()}>
              {isSaving ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
