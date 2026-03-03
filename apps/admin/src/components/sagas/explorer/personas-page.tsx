'use client'

import { useEffect, useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { sagaApi, type SagaPersonaDefinition } from '@/lib/sagas-api'
import { oodaApi } from '@/lib/ooda-api'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { EntitySummaryCard, LifecycleBadge, listSummaryFooter, LoadError, LoadingGrid, PageIntro, SearchToolbar, sortByTitle } from './common'

export function SagaPersonasPage() {
  const [items, setItems] = useState<SagaPersonaDefinition[]>([])
  const [query, setQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [form, setForm] = useState({
    personaKey: '',
    name: '',
    profileSummary: '',
  })

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

  async function createPersona() {
    if (!form.personaKey.trim() || !form.name.trim()) return
    setIsSaving(true)
    try {
      await oodaApi.createPersona({
        personaKey: form.personaKey.trim(),
        name: form.name.trim(),
        profileSummary: form.profileSummary.trim() || null,
        status: 'active',
      })
      setCreateOpen(false)
      setForm({ personaKey: '', name: '', profileSummary: '' })
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to create persona.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <PageIntro
        eyebrow="Saga Library"
        title="Personas"
        description="Personas make the loop realistic. They define how different users interact with the same use case, what they care about, and what kinds of failures they are likely to expose."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New persona
          </Button>
        }
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
                href={`/ooda/personas/${encodeURIComponent(item.personaKey)}`}
                title={`${item.personaKey} · ${item.name}`}
                description={item.profileSummary}
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
            <DialogTitle>Create persona</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="persona-key">Persona Key</Label>
              <Input
                id="persona-key"
                value={form.personaKey}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, personaKey: event.target.value }))
                }
                placeholder="P-50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="persona-name">Name</Label>
              <Input
                id="persona-name"
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="The Solo Entrepreneur (Sarah)"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="persona-summary">Profile summary</Label>
              <Textarea
                id="persona-summary"
                value={form.profileSummary}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, profileSummary: event.target.value }))
                }
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void createPersona()} disabled={isSaving || !form.personaKey.trim() || !form.name.trim()}>
              {isSaving ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
