'use client'

import { useEffect, useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { sagaApi, type SagaUseCaseDefinition } from '@/lib/sagas-api'
import { oodaApi } from '@/lib/ooda-api'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { EntitySummaryCard, LifecycleBadge, listSummaryFooter, LoadError, LoadingGrid, PageIntro, SearchToolbar, sortByTitle } from './common'

export function SagaUseCasesPage() {
  const [items, setItems] = useState<SagaUseCaseDefinition[]>([])
  const [query, setQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [form, setForm] = useState({
    ucKey: '',
    title: '',
    summary: '',
  })

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

  async function createUseCase() {
    if (!form.ucKey.trim() || !form.title.trim()) return
    setIsSaving(true)
    try {
      await oodaApi.createUseCase({
        ucKey: form.ucKey.trim(),
        title: form.title.trim(),
        summary: form.summary.trim() || null,
        status: 'active',
      })
      setCreateOpen(false)
      setForm({ ucKey: '', title: '', summary: '' })
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to create use case.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <PageIntro
        eyebrow="Saga Library"
        title="Use cases"
        description="Each use case captures a business reality the platform is expected to model. Open one to inspect its versions, linked saga definitions, and the run history proving or disproving it."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New use case
          </Button>
        }
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

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create use case</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="uc-key">UC Key</Label>
              <Input
                id="uc-key"
                value={form.ucKey}
                onChange={(event) => setForm((prev) => ({ ...prev, ucKey: event.target.value }))}
                placeholder="UC-280"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="uc-title">Title</Label>
              <Input
                id="uc-title"
                value={form.title}
                onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                placeholder="The new business reality to support"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="uc-summary">Summary</Label>
              <Textarea
                id="uc-summary"
                value={form.summary}
                onChange={(event) => setForm((prev) => ({ ...prev, summary: event.target.value }))}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void createUseCase()} disabled={isSaving || !form.ucKey.trim() || !form.title.trim()}>
              {isSaving ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
