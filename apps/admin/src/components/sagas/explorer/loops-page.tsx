'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Plus, RefreshCw } from 'lucide-react'
import { oodaApi, type OodaLoop } from '@/lib/ooda-api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useSagaRealtime } from '@/lib/use-saga-realtime'
import { LoadError, LoadingGrid, PageIntro, SearchToolbar } from './common'

function loopStatusTone(status: string) {
  if (status === 'active') return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
  if (status === 'paused') return 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300'
  if (status === 'completed') return 'border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300'
  if (status === 'archived') return 'border-slate-500/40 bg-slate-500/10 text-slate-700 dark:text-slate-300'
  return 'border-muted bg-muted text-muted-foreground'
}

export function OodaLoopsPage() {
  const [loops, setLoops] = useState<OodaLoop[]>([])
  const [query, setQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const loadInFlightRef = useRef(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [form, setForm] = useState({
    title: '',
    objective: '',
  })

  async function load(options?: { background?: boolean }) {
    const background = options?.background === true
    if (loadInFlightRef.current) return
    loadInFlightRef.current = true
    if (!background) {
      setIsLoading(true)
      setError(null)
    }
    try {
      const rows = await oodaApi.fetchLoops({ limit: 2000 })
      setLoops(rows)
    } catch (cause) {
      if (!background || loops.length === 0) {
        setError(cause instanceof Error ? cause.message : 'Failed to load OODA loops.')
      }
    } finally {
      loadInFlightRef.current = false
      if (!background) setIsLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  useSagaRealtime({
    onEvent: () => {
      void load({ background: true })
    },
  })

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return loops
    return loops.filter((loop) =>
      [loop.loopKey, loop.title, loop.objective ?? ''].some((value) =>
        value.toLowerCase().includes(needle),
      ),
    )
  }, [loops, query])

  async function createLoop() {
    if (!form.title.trim()) return
    setIsSaving(true)
    try {
      const created = await oodaApi.createLoop({
        title: form.title.trim(),
        objective: form.objective.trim() || null,
        status: 'active',
      })
      setCreateOpen(false)
      setForm({ title: '', objective: '' })
      window.location.href = `/ooda/loops/${created.id}`
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to create OODA loop.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <PageIntro
        eyebrow="Mission Control"
        title="Missions"
        description="Each mission tracks one objective, the connected evidence, and the run history used to validate progress."
        actions={
          <>
            <Button variant="outline" onClick={() => void load()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              New mission
            </Button>
          </>
        }
      />
      <SearchToolbar
        value={query}
        onChange={setQuery}
        placeholder="Search missions by key, title, or objective"
        meta={`${filtered.length} of ${loops.length} missions`}
      />
      <div className="flex-1 p-6">
        {error ? <LoadError message={error} onRetry={() => void load()} /> : null}
        {isLoading ? (
          <LoadingGrid count={9} />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((loop) => (
              <Link key={loop.id} href={`/ooda/loops/${loop.id}`} className="block">
                <Card className="h-full transition-colors hover:border-primary/40 hover:bg-muted/30">
                  <CardHeader className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <CardTitle className="text-base">{loop.title}</CardTitle>
                        <CardDescription>{loop.loopKey}</CardDescription>
                      </div>
                      <span
                        className={`rounded-md border px-2 py-1 text-xs ${loopStatusTone(loop.status)}`}
                      >
                        {loop.status}
                      </span>
                    </div>
                    <p className="line-clamp-3 text-sm text-muted-foreground">
                      {loop.objective ?? 'No objective yet.'}
                    </p>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">
                    <div className="grid grid-cols-3 gap-2">
                      <div className="rounded-lg border p-2">
                        <p className="text-lg font-semibold text-foreground">{loop.priority}</p>
                        <p className="text-xs">priority</p>
                      </div>
                      <div className="rounded-lg border p-2">
                        <p className="text-lg font-semibold text-foreground">{loop.healthScore}</p>
                        <p className="text-xs">health</p>
                      </div>
                      <div className="rounded-lg border p-2">
                        <p className="text-lg font-semibold text-foreground">
                          {loop.lastSignalAt ? new Date(loop.lastSignalAt).toLocaleDateString() : '—'}
                        </p>
                        <p className="text-xs">last signal</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create mission</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="loop-title">Title</Label>
              <Input
                id="loop-title"
                value={form.title}
                onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                placeholder="Stabilize booking double-booking prevention"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="loop-objective">Objective</Label>
              <Textarea
                id="loop-objective"
                value={form.objective}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, objective: event.target.value }))
                }
                placeholder="What exactly are we trying to prove and improve?"
                rows={5}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void createLoop()} disabled={isSaving || !form.title.trim()}>
              {isSaving ? 'Creating...' : 'Create mission'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
