'use client'

import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft,
  Link2,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  Unlink2,
} from 'lucide-react'
import {
  oodaApi,
  type OodaGapType,
  type OodaLoop,
  type OodaLoopAction,
  type OodaLoopEntry,
  type OodaLoopLink,
} from '@/lib/ooda-api'
import {
  sagaApi,
  type SagaDefinitionSummary,
  type SagaPersonaDefinition,
  type SagaRunSummary,
  type SagaUseCaseDefinition,
} from '@/lib/sagas-api'
import { useSagaRealtime } from '@/lib/use-saga-realtime'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { LoadError, LoadingGrid, PageIntro, RunProgressBackdrop, RunStatusBadge } from './common'

const ReactJson = dynamic(() => import('react-json-view'), { ssr: false })

type LoopDetailState = {
  loop: OodaLoop
  links: OodaLoopLink[]
  entries: OodaLoopEntry[]
  actions: OodaLoopAction[]
}

const GAP_TYPES: OodaGapType[] = [
  'pnp_gap',
  'uc_gap',
  'persona_gap',
  'schema_gap',
  'api_gap',
  'workflow_gap',
  'policy_gap',
  'event_gap',
  'audit_gap',
  'test_pack_gap',
  'docs_gap',
]

const ENTRY_STATUS_OPTIONS: OodaLoopEntry['status'][] = [
  'open',
  'accepted',
  'blocked',
  'resolved',
  'rejected',
]

function toneForSeverity(severity: OodaLoopEntry['severity']) {
  if (severity === 'critical') return 'border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300'
  if (severity === 'high') return 'border-orange-500/40 bg-orange-500/10 text-orange-700 dark:text-orange-300'
  if (severity === 'medium') return 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300'
  return 'border-slate-500/40 bg-slate-500/10 text-slate-700 dark:text-slate-300'
}

function toneForActionStatus(status: OodaLoopAction['status']) {
  if (status === 'succeeded') return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
  if (status === 'failed') return 'border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300'
  if (status === 'running') return 'border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300'
  if (status === 'cancelled') return 'border-slate-500/40 bg-slate-500/10 text-slate-700 dark:text-slate-300'
  return 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300'
}

function toneForEntryStatus(status: OodaLoopEntry['status']) {
  if (status === 'resolved' || status === 'accepted') return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
  if (status === 'blocked') return 'border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300'
  if (status === 'rejected') return 'border-slate-500/40 bg-slate-500/10 text-slate-700 dark:text-slate-300'
  return 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300'
}

function isEntryUnresolved(status: OodaLoopEntry['status']) {
  return status === 'open' || status === 'blocked'
}

type EntryLaneKey = 'signals' | 'decisions' | 'outcomes'

const ENTRY_LANES: Array<{
  key: EntryLaneKey
  title: string
  description: string
  entryTypes: OodaLoopEntry['entryType'][]
}> = [
  {
    key: 'signals',
    title: 'Signals & Gaps',
    description: 'What we observed and what looks broken or risky.',
    entryTypes: ['signal', 'hypothesis'],
  },
  {
    key: 'decisions',
    title: 'Decisions & Plans',
    description: 'What we decided to change and what we plan to run next.',
    entryTypes: ['decision', 'action_plan'],
  },
  {
    key: 'outcomes',
    title: 'Execution Outcomes',
    description: 'What happened after execution and what we learned.',
    entryTypes: ['result', 'postmortem'],
  },
]

function phaseForEntryType(entryType: OodaLoopEntry['entryType']): OodaLoopEntry['phase'] {
  if (entryType === 'signal' || entryType === 'hypothesis') return 'observe'
  if (entryType === 'decision' || entryType === 'action_plan') return 'decide'
  return 'act'
}

function owningLayerForGapType(gapType?: OodaGapType | '' | null) {
  if (!gapType) return null
  if (gapType === 'pnp_gap') return 'pnp'
  if (gapType === 'uc_gap') return 'uc'
  if (gapType === 'persona_gap') return 'persona'
  if (gapType === 'schema_gap') return 'schema'
  if (gapType === 'api_gap') return 'api'
  if (gapType === 'workflow_gap') return 'workflow'
  if (gapType === 'policy_gap') return 'policy'
  if (gapType === 'event_gap') return 'event'
  if (gapType === 'audit_gap') return 'audit'
  if (gapType === 'test_pack_gap') return 'test_pack'
  if (gapType === 'docs_gap') return 'docs'
  return null
}

type ResolvedLink = {
  title: string
  subtitle: string
  href: string | null
}

export function OodaLoopDetailPage({ loopId }: { loopId: string }) {
  const [detail, setDetail] = useState<LoopDetailState | null>(null)
  const [definitions, setDefinitions] = useState<SagaDefinitionSummary[]>([])
  const [useCases, setUseCases] = useState<SagaUseCaseDefinition[]>([])
  const [personas, setPersonas] = useState<SagaPersonaDefinition[]>([])
  const [runs, setRuns] = useState<SagaRunSummary[]>([])

  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const loadInFlightRef = useRef(false)
  const realtimeRefreshRef = useRef<number | null>(null)

  const [entryOpen, setEntryOpen] = useState(false)
  const [editLoopOpen, setEditLoopOpen] = useState(false)
  const [linkOpen, setLinkOpen] = useState(false)
  const [actionInspectOpen, setActionInspectOpen] = useState(false)

  const [isSavingEntry, setIsSavingEntry] = useState(false)
  const [isSavingLoop, setIsSavingLoop] = useState(false)
  const [isSavingLink, setIsSavingLink] = useState(false)
  const [isRunning, setIsRunning] = useState(false)

  const [draftOpen, setDraftOpen] = useState(false)
  const [draftOutput, setDraftOutput] = useState<string>('')
  const [isGenerating, setIsGenerating] = useState(false)

  const [onlyUnresolved, setOnlyUnresolved] = useState(true)

  const [selectedAction, setSelectedAction] = useState<OodaLoopAction | null>(null)

  const [entryForm, setEntryForm] = useState({
    entryType: 'signal' as OodaLoopEntry['entryType'],
    title: '',
    bodyMarkdown: '',
    severity: 'medium' as OodaLoopEntry['severity'],
    status: 'open' as OodaLoopEntry['status'],
    gapType: '' as '' | OodaGapType,
  })

  const [editLoopForm, setEditLoopForm] = useState({
    title: '',
    objective: '',
    status: 'active' as OodaLoop['status'],
    priority: 50,
    healthScore: 0,
    nextReviewAt: '',
  })

  const [linkForm, setLinkForm] = useState({
    targetType: 'saga_definition' as OodaLoopLink['targetType'],
    targetId: '',
    relationRole: 'focus' as OodaLoopLink['relationRole'],
  })

  const [runForm, setRunForm] = useState({
    sagaKey: '',
    mode: 'dry_run' as 'dry_run' | 'live',
  })

  const [draftForm, setDraftForm] = useState({
    kind: 'use_case' as 'use_case' | 'persona' | 'saga_definition',
    prompt: '',
    context: '',
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
      const [loopDetail, defs, ucRows, personaRows, runRows] = await Promise.all([
        oodaApi.fetchLoopDetail(loopId),
        sagaApi.fetchDefinitions(),
        sagaApi.fetchUseCases(),
        sagaApi.fetchPersonas(),
        sagaApi.fetchRuns({ limit: 5000, mineOnly: false, includeArchived: true }),
      ])

      setDetail(loopDetail)
      setDefinitions(defs)
      setUseCases(ucRows)
      setPersonas(personaRows)
      setRuns(runRows)

      setEditLoopForm({
        title: loopDetail.loop.title,
        objective: loopDetail.loop.objective ?? '',
        status: loopDetail.loop.status,
        priority: loopDetail.loop.priority,
        healthScore: loopDetail.loop.healthScore,
        nextReviewAt: loopDetail.loop.nextReviewAt
          ? new Date(loopDetail.loop.nextReviewAt).toISOString().slice(0, 16)
          : '',
      })

      if (!runForm.sagaKey) {
        const linkedDefinition = loopDetail.links.find((item) => item.targetType === 'saga_definition')
        if (linkedDefinition) {
          setRunForm((prev) => ({ ...prev, sagaKey: linkedDefinition.targetId }))
        }
      }
    } catch (cause) {
      if (!background || !detail) {
        setError(cause instanceof Error ? cause.message : 'Failed to load mission detail.')
      }
    } finally {
      loadInFlightRef.current = false
      if (!background) setIsLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [loopId])

  useSagaRealtime({
    onEvent: (event) => {
      if (event.runId && detail?.links.some((link) => link.targetType === 'saga_run' && link.targetId === event.runId)) {
        if (realtimeRefreshRef.current !== null) window.clearTimeout(realtimeRefreshRef.current)
        realtimeRefreshRef.current = window.setTimeout(() => void load({ background: true }), 250)
      }
    },
  })

  useEffect(() => {
    return () => {
      if (realtimeRefreshRef.current !== null) window.clearTimeout(realtimeRefreshRef.current)
    }
  }, [])

  const runById = useMemo(() => new Map(runs.map((run) => [run.id, run])), [runs])
  const definitionByKey = useMemo(() => new Map(definitions.map((definition) => [definition.sagaKey, definition])), [definitions])
  const useCaseById = useMemo(() => new Map(useCases.map((uc) => [uc.id, uc])), [useCases])
  const useCaseByKey = useMemo(() => new Map(useCases.map((uc) => [uc.ucKey, uc])), [useCases])
  const personaById = useMemo(() => new Map(personas.map((persona) => [persona.id, persona])), [personas])
  const personaByKey = useMemo(() => new Map(personas.map((persona) => [persona.personaKey, persona])), [personas])

  function resolveLoopLink(link: OodaLoopLink): ResolvedLink {
    if (link.targetType === 'saga_definition') {
      const found = definitionByKey.get(link.targetId)
      return {
        title: found?.title ?? link.targetId,
        subtitle: found ? `definition · ${found.sagaKey}` : 'definition',
        href: `/sagas/definitions/${encodeURIComponent(link.targetId)}`,
      }
    }

    if (link.targetType === 'saga_run') {
      const found = runById.get(link.targetId)
      return {
        title: found?.sagaKey ?? link.targetId,
        subtitle: found
          ? `run · ${found.status} · ${found.passedSteps}/${found.totalSteps}`
          : 'run',
        href: `/sagas/runs/${encodeURIComponent(link.targetId)}`,
      }
    }

    if (link.targetType === 'use_case') {
      const byKey = useCaseByKey.get(link.targetId)
      const byId = useCaseById.get(link.targetId)
      const uc = byKey ?? byId
      const ucKey = uc?.ucKey ?? link.targetId
      return {
        title: uc?.title ?? ucKey,
        subtitle: `use case · ${ucKey}`,
        href: `/sagas/use-cases/${encodeURIComponent(ucKey)}`,
      }
    }

    if (link.targetType === 'persona') {
      const byKey = personaByKey.get(link.targetId)
      const byId = personaById.get(link.targetId)
      const persona = byKey ?? byId
      const personaKey = persona?.personaKey ?? link.targetId
      return {
        title: persona?.name ?? personaKey,
        subtitle: `persona · ${personaKey}`,
        href: `/sagas/personas/${encodeURIComponent(personaKey)}`,
      }
    }

    return {
      title: link.targetId,
      subtitle: link.targetType,
      href: null,
    }
  }

  const entryStats = useMemo(() => {
    const all = detail?.entries ?? []
    return {
      total: all.length,
      open: all.filter((entry) => entry.status === 'open').length,
      blocked: all.filter((entry) => entry.status === 'blocked').length,
      resolved: all.filter((entry) => entry.status === 'resolved' || entry.status === 'accepted').length,
    }
  }, [detail?.entries])

  const linkedRuns = useMemo(() => {
    const ids = new Set(
      (detail?.links ?? [])
        .filter((link) => link.targetType === 'saga_run')
        .map((link) => link.targetId),
    )
    return Array.from(ids)
      .map((id) => runById.get(id))
      .filter((row): row is SagaRunSummary => Boolean(row))
      .sort((a, b) => new Date(b.updatedAt ?? b.createdAt ?? 0).getTime() - new Date(a.updatedAt ?? a.createdAt ?? 0).getTime())
  }, [detail?.links, runById])

  const linkedRunPassRate = useMemo(() => {
    if (linkedRuns.length === 0) return 0
    const passed = linkedRuns.filter((run) => run.status === 'passed').length
    return Math.round((passed / linkedRuns.length) * 100)
  }, [linkedRuns])

  const actionsSummary = useMemo(() => {
    const rows = detail?.actions ?? []
    return {
      total: rows.length,
      running: rows.filter((row) => row.status === 'running').length,
      failed: rows.filter((row) => row.status === 'failed').length,
      succeeded: rows.filter((row) => row.status === 'succeeded').length,
    }
  }, [detail?.actions])

  const groupedEntries = useMemo(() => {
    const rows = detail?.entries ?? []
    return ENTRY_LANES.map((lane) => {
      const allForLane = rows.filter((entry) => lane.entryTypes.includes(entry.entryType))
      const visible = onlyUnresolved ? allForLane.filter((entry) => isEntryUnresolved(entry.status)) : allForLane
      return {
        lane,
        total: allForLane.length,
        visible,
      }
    })
  }, [detail?.entries, onlyUnresolved])

  async function saveLoopEdits() {
    if (!detail) return
    setIsSavingLoop(true)
    try {
      await oodaApi.updateLoop(detail.loop.id, {
        title: editLoopForm.title.trim(),
        objective: editLoopForm.objective.trim() || null,
        status: editLoopForm.status,
        priority: Math.max(1, Math.min(100, Number(editLoopForm.priority) || 50)),
        healthScore: Math.max(0, Math.min(100, Number(editLoopForm.healthScore) || 0)),
        nextReviewAt: editLoopForm.nextReviewAt ? new Date(editLoopForm.nextReviewAt).toISOString() : null,
      })
      setEditLoopOpen(false)
      await load({ background: true })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to update loop.')
    } finally {
      setIsSavingLoop(false)
    }
  }

  async function addLink() {
    if (!detail || !linkForm.targetId.trim()) return
    setIsSavingLink(true)
    try {
      await oodaApi.addLoopLink(detail.loop.id, {
        targetType: linkForm.targetType,
        targetId: linkForm.targetId.trim(),
        relationRole: linkForm.relationRole,
      })
      setLinkOpen(false)
      await load({ background: true })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to create link.')
    } finally {
      setIsSavingLink(false)
    }
  }

  async function deleteLink(linkId: string) {
    if (!detail) return
    try {
      await oodaApi.deleteLoopLink(detail.loop.id, linkId)
      await load({ background: true })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to remove link.')
    }
  }

  async function updateEntryStatus(entry: OodaLoopEntry, status: OodaLoopEntry['status']) {
    if (!detail || entry.status === status) return
    try {
      await oodaApi.updateLoopEntry(detail.loop.id, entry.id, { status })
      await load({ background: true })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to update entry status.')
    }
  }

  async function addEntry() {
    if (!entryForm.title.trim()) return
    if (!detail) return

    setIsSavingEntry(true)
    try {
      const inferredOwningLayer = owningLayerForGapType(entryForm.gapType)
      const inferredEvidence =
        entryForm.bodyMarkdown.trim().length > 0
          ? { reportNote: entryForm.bodyMarkdown.trim() }
          : { reportNote: entryForm.title.trim() }

      await oodaApi.addLoopEntry(detail.loop.id, {
        phase: phaseForEntryType(entryForm.entryType),
        entryType: entryForm.entryType,
        title: entryForm.title.trim(),
        bodyMarkdown: entryForm.bodyMarkdown.trim() || null,
        severity: entryForm.severity,
        status: entryForm.status,
        gapType: entryForm.gapType || null,
        ...(inferredOwningLayer ? { owningLayer: inferredOwningLayer } : {}),
        evidence: inferredEvidence,
      })
      setEntryOpen(false)
      setEntryForm({
        entryType: 'signal',
        title: '',
        bodyMarkdown: '',
        severity: 'medium',
        status: 'open',
        gapType: '',
      })
      await load({ background: true })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to create loop entry.')
    } finally {
      setIsSavingEntry(false)
    }
  }

  async function runSagaFromLoop() {
    if (!detail || !runForm.sagaKey.trim()) return
    setIsRunning(true)
    try {
      const created = await oodaApi.createLoopRun(detail.loop.id, {
        sagaKey: runForm.sagaKey.trim(),
        mode: runForm.mode,
        actionTitle: `Execute ${runForm.sagaKey.trim()} from mission`,
      })
      window.location.href = `/sagas/runs/${created.run.run.id}`
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to start run from mission.')
      setIsRunning(false)
    }
  }

  async function generateDraft() {
    if (!draftForm.prompt.trim()) return
    setIsGenerating(true)
    try {
      const generated = await oodaApi.generateDraft({
        kind: draftForm.kind,
        prompt: draftForm.prompt.trim(),
        context: draftForm.context.trim() || undefined,
      })
      setDraftOutput(JSON.stringify(generated.draft, null, 2))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to generate draft.')
    } finally {
      setIsGenerating(false)
    }
  }

  async function archiveLoop() {
    if (!detail) return
    try {
      await oodaApi.archiveLoop(detail.loop.id)
      window.location.href = '/sagas/loops'
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to archive loop.')
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <PageIntro
        eyebrow="Mission Control"
        title={detail ? detail.loop.title : loopId}
        description={detail?.loop.objective ?? 'Mission detail view for evolution workflow.'}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/sagas/loops">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to missions
              </Link>
            </Button>
            <Button variant="outline" onClick={() => setEditLoopOpen(true)}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit mission
            </Button>
            <Button variant="outline" onClick={() => setLinkOpen(true)}>
              <Link2 className="mr-2 h-4 w-4" />
              Link entity
            </Button>
            <Button variant="outline" onClick={() => setEntryOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add entry
            </Button>
            <Button variant="outline" onClick={() => setDraftOpen(true)}>
              <Sparkles className="mr-2 h-4 w-4" />
              LLM draft
            </Button>
            <Button variant="outline" onClick={() => void load({ background: true })}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <Button variant="destructive" onClick={() => void archiveLoop()}>
              <Trash2 className="mr-2 h-4 w-4" />
              Archive
            </Button>
          </>
        }
      />

      <div className="flex-1 p-6">
        {error ? <LoadError message={error} onRetry={() => void load()} /> : null}
        {isLoading || !detail ? (
          <LoadingGrid count={6} />
        ) : (
          <div className="space-y-6">
            <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
              <Card>
                <CardHeader>
                  <CardTitle>Current state</CardTitle>
                  <CardDescription>
                    Live operational snapshot: priority, blockers, execution health, and closure progress.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  <div className="rounded-lg border p-4">
                    <p className="text-2xl font-semibold">{detail.loop.status}</p>
                    <p className="text-muted-foreground">mission status</p>
                  </div>
                  <div className="rounded-lg border p-4">
                    <p className="text-2xl font-semibold">{detail.loop.priority}</p>
                    <p className="text-muted-foreground">priority</p>
                  </div>
                  <div className="rounded-lg border p-4">
                    <p className="text-2xl font-semibold">{detail.loop.healthScore}</p>
                    <p className="text-muted-foreground">health score</p>
                  </div>
                  <div className="rounded-lg border p-4">
                    <p className="text-2xl font-semibold">{entryStats.open}</p>
                    <p className="text-muted-foreground">open entries</p>
                  </div>
                  <div className="rounded-lg border p-4">
                    <p className="text-2xl font-semibold">{entryStats.blocked}</p>
                    <p className="text-muted-foreground">blocked entries</p>
                  </div>
                  <div className="rounded-lg border p-4">
                    <p className="text-2xl font-semibold">{linkedRunPassRate}%</p>
                    <p className="text-muted-foreground">linked run pass rate</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Execute from this mission</CardTitle>
                  <CardDescription>
                    Start a saga run from this mission and keep the run/action trail linked automatically.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <Label>Saga definition</Label>
                    <Select
                      value={runForm.sagaKey}
                      onValueChange={(value) => setRunForm((prev) => ({ ...prev, sagaKey: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select saga definition key" />
                      </SelectTrigger>
                      <SelectContent>
                        {definitions.map((definition) => (
                          <SelectItem key={definition.id} value={definition.sagaKey}>
                            {definition.sagaKey}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Mode</Label>
                    <Select
                      value={runForm.mode}
                      onValueChange={(value) =>
                        setRunForm((prev) => ({ ...prev, mode: value as 'dry_run' | 'live' }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="dry_run">dry_run</SelectItem>
                        <SelectItem value="live">live</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={() => void runSagaFromLoop()} disabled={isRunning || !runForm.sagaKey}>
                    <Play className="mr-2 h-4 w-4" />
                    {isRunning ? 'Starting run...' : 'Start run'}
                  </Button>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <CardTitle>Scope map</CardTitle>
                      <CardDescription>
                        Scope links define what this mission is proving (inputs, focus, dependencies, outputs, evidence).
                      </CardDescription>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setLinkOpen(true)}>
                      <Plus className="mr-2 h-4 w-4" />
                      Add link
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {detail.links.length === 0 ? (
                    <p className="rounded-lg border p-3 text-sm text-muted-foreground">No links yet.</p>
                  ) : (
                    detail.links.map((link) => {
                      const resolved = resolveLoopLink(link)
                      return (
                        <div key={link.id} className="rounded-lg border p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 space-y-1">
                              <p className="truncate font-medium">{resolved.title}</p>
                              <p className="text-xs text-muted-foreground">
                                {resolved.subtitle} · {link.relationRole}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              {resolved.href ? (
                                <Button size="sm" variant="outline" asChild>
                                  <Link href={resolved.href}>Open</Link>
                                </Button>
                              ) : null}
                              <Button size="icon" variant="ghost" onClick={() => void deleteLink(link.id)}>
                                <Unlink2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      )
                    })
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Action log</CardTitle>
                  <CardDescription>
                    Every operation executed from this mission is recorded here with status and payload-level details.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-4 gap-2 text-center text-xs text-muted-foreground">
                    <div className="rounded-lg border p-2">
                      <p className="text-base font-semibold text-foreground">{actionsSummary.total}</p>
                      <p>total</p>
                    </div>
                    <div className="rounded-lg border p-2">
                      <p className="text-base font-semibold text-foreground">{actionsSummary.running}</p>
                      <p>running</p>
                    </div>
                    <div className="rounded-lg border p-2">
                      <p className="text-base font-semibold text-foreground">{actionsSummary.succeeded}</p>
                      <p>succeeded</p>
                    </div>
                    <div className="rounded-lg border p-2">
                      <p className="text-base font-semibold text-foreground">{actionsSummary.failed}</p>
                      <p>failed</p>
                    </div>
                  </div>

                  {detail.actions.length === 0 ? (
                    <p className="rounded-lg border p-3 text-sm text-muted-foreground">No actions yet.</p>
                  ) : (
                    detail.actions.slice(0, 14).map((action) => (
                      <div key={action.id} className="rounded-lg border p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 space-y-1">
                            <p className="truncate font-medium">{action.actionTitle}</p>
                            <p className="text-xs text-muted-foreground">{action.actionKey}</p>
                          </div>
                          <Badge variant="outline" className={toneForActionStatus(action.status)}>
                            {action.status}
                          </Badge>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedAction(action)
                              setActionInspectOpen(true)
                            }}
                          >
                            Inspect
                          </Button>
                          {action.linkedSagaRunId ? (
                            <Button size="sm" variant="outline" asChild>
                              <Link href={`/sagas/runs/${action.linkedSagaRunId}`}>Open run</Link>
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <CardTitle>Loop journal</CardTitle>
                    <CardDescription>
                      Read this as a story: detected signals, chosen decisions, and execution outcomes.
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                    <Switch checked={onlyUnresolved} onCheckedChange={setOnlyUnresolved} />
                    <span>Only unresolved</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {groupedEntries.map((group) => (
                    <div key={group.lane.key} className="space-y-3 rounded-xl border p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="font-medium">{group.lane.title}</p>
                          <p className="text-xs text-muted-foreground">{group.lane.description}</p>
                          <p className="text-xs text-muted-foreground">
                            {group.visible.length}/{group.total} visible
                          </p>
                        </div>
                        <Badge variant="outline">{group.total}</Badge>
                      </div>

                      <div className="space-y-2">
                        {group.visible.length === 0 ? (
                          <p className="rounded-lg border p-2 text-xs text-muted-foreground">No entries.</p>
                        ) : (
                          group.visible.map((entry) => (
                            <div key={entry.id} className="rounded-lg border p-2.5">
                              <div className="flex items-start justify-between gap-2">
                                <p className="text-sm font-medium leading-5">{entry.title}</p>
                                <Badge variant="outline" className={toneForSeverity(entry.severity)}>
                                  {entry.severity}
                                </Badge>
                              </div>

                              {entry.bodyMarkdown ? (
                                <p className="mt-2 line-clamp-4 whitespace-pre-wrap text-xs text-muted-foreground">
                                  {entry.bodyMarkdown}
                                </p>
                              ) : null}

                              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                <Badge variant="outline" className={toneForEntryStatus(entry.status)}>
                                  {entry.status}
                                </Badge>
                                <Badge variant="outline">{entry.entryType}</Badge>
                                {entry.gapType ? <Badge variant="outline">{entry.gapType}</Badge> : null}
                              </div>

                              <div className="mt-2 flex items-center gap-2">
                                <Select
                                  value={entry.status}
                                  onValueChange={(value) => void updateEntryStatus(entry, value as OodaLoopEntry['status'])}
                                >
                                  <SelectTrigger className="h-8 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {ENTRY_STATUS_OPTIONS.map((status) => (
                                      <SelectItem key={status} value={status}>
                                        {status}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                {entry.linkedSagaRunId ? (
                                  <Button size="sm" variant="outline" asChild>
                                    <Link href={`/sagas/runs/${entry.linkedSagaRunId}`}>Run</Link>
                                  </Button>
                                ) : null}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {linkedRuns.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle>Linked saga runs</CardTitle>
                  <CardDescription>
                    These runs are explicitly part of this mission. Use this section to jump from decisions to execution evidence.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {linkedRuns.slice(0, 9).map((run) => (
                    <Link key={run.id} href={`/sagas/runs/${run.id}`} className="block">
                      <div className="relative overflow-hidden rounded-lg border p-3 transition-colors hover:border-primary/40 hover:bg-muted/30">
                        <RunProgressBackdrop run={run} />
                        <div className="relative space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <p className="truncate font-medium">{run.sagaKey}</p>
                            <RunStatusBadge status={run.status} />
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {run.passedSteps}/{run.totalSteps} passed
                          </p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </CardContent>
              </Card>
            ) : null}
          </div>
        )}
      </div>

      <Dialog open={editLoopOpen} onOpenChange={setEditLoopOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit mission</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh] pr-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input
                  value={editLoopForm.title}
                  onChange={(event) => setEditLoopForm((prev) => ({ ...prev, title: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Objective</Label>
                <Textarea
                  rows={6}
                  value={editLoopForm.objective}
                  onChange={(event) =>
                    setEditLoopForm((prev) => ({ ...prev, objective: event.target.value }))
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={editLoopForm.status}
                    onValueChange={(value) => setEditLoopForm((prev) => ({ ...prev, status: value as OodaLoop['status'] }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">draft</SelectItem>
                      <SelectItem value="active">active</SelectItem>
                      <SelectItem value="paused">paused</SelectItem>
                      <SelectItem value="completed">completed</SelectItem>
                      <SelectItem value="archived">archived</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label>Priority (1-100)</Label>
                  <Input
                    type="number"
                    value={String(editLoopForm.priority)}
                    onChange={(event) =>
                      setEditLoopForm((prev) => ({ ...prev, priority: Number(event.target.value) || 50 }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Health score (0-100)</Label>
                  <Input
                    type="number"
                    value={String(editLoopForm.healthScore)}
                    onChange={(event) =>
                      setEditLoopForm((prev) => ({ ...prev, healthScore: Number(event.target.value) || 0 }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Next review</Label>
                  <Input
                    type="datetime-local"
                    value={editLoopForm.nextReviewAt}
                    onChange={(event) =>
                      setEditLoopForm((prev) => ({ ...prev, nextReviewAt: event.target.value }))
                    }
                  />
                </div>
              </div>
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditLoopOpen(false)}>Cancel</Button>
            <Button onClick={() => void saveLoopEdits()} disabled={isSavingLoop || !editLoopForm.title.trim()}>
              {isSavingLoop ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Link entity to mission</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Target type</Label>
                <Select
                  value={linkForm.targetType}
                  onValueChange={(value) =>
                    setLinkForm((prev) => ({ ...prev, targetType: value as OodaLoopLink['targetType'], targetId: '' }))
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="use_case">use_case</SelectItem>
                    <SelectItem value="persona">persona</SelectItem>
                    <SelectItem value="saga_definition">saga_definition</SelectItem>
                    <SelectItem value="saga_run">saga_run</SelectItem>
                    <SelectItem value="saga_step">saga_step</SelectItem>
                    <SelectItem value="coverage_report">coverage_report</SelectItem>
                    <SelectItem value="coverage_item">coverage_item</SelectItem>
                    <SelectItem value="note">note</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select
                  value={linkForm.relationRole}
                  onValueChange={(value) =>
                    setLinkForm((prev) => ({ ...prev, relationRole: value as OodaLoopLink['relationRole'] }))
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="focus">focus</SelectItem>
                    <SelectItem value="input">input</SelectItem>
                    <SelectItem value="output">output</SelectItem>
                    <SelectItem value="dependency">dependency</SelectItem>
                    <SelectItem value="evidence">evidence</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {linkForm.targetType === 'saga_definition' ? (
              <div className="space-y-2">
                <Label>Definition key</Label>
                <Select
                  value={linkForm.targetId}
                  onValueChange={(value) => setLinkForm((prev) => ({ ...prev, targetId: value }))}
                >
                  <SelectTrigger><SelectValue placeholder="Select definition" /></SelectTrigger>
                  <SelectContent>
                    {definitions.map((definition) => (
                      <SelectItem key={definition.id} value={definition.sagaKey}>
                        {definition.sagaKey}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            {linkForm.targetType === 'use_case' ? (
              <div className="space-y-2">
                <Label>Use case key</Label>
                <Select
                  value={linkForm.targetId}
                  onValueChange={(value) => setLinkForm((prev) => ({ ...prev, targetId: value }))}
                >
                  <SelectTrigger><SelectValue placeholder="Select use case" /></SelectTrigger>
                  <SelectContent>
                    {useCases.map((uc) => (
                      <SelectItem key={uc.id} value={uc.ucKey}>{uc.ucKey} · {uc.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            {linkForm.targetType === 'persona' ? (
              <div className="space-y-2">
                <Label>Persona key</Label>
                <Select
                  value={linkForm.targetId}
                  onValueChange={(value) => setLinkForm((prev) => ({ ...prev, targetId: value }))}
                >
                  <SelectTrigger><SelectValue placeholder="Select persona" /></SelectTrigger>
                  <SelectContent>
                    {personas.map((persona) => (
                      <SelectItem key={persona.id} value={persona.personaKey}>{persona.personaKey} · {persona.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            {linkForm.targetType === 'saga_run' ? (
              <div className="space-y-2">
                <Label>Saga run id</Label>
                <Select
                  value={linkForm.targetId}
                  onValueChange={(value) => setLinkForm((prev) => ({ ...prev, targetId: value }))}
                >
                  <SelectTrigger><SelectValue placeholder="Select recent run" /></SelectTrigger>
                  <SelectContent>
                    {runs.slice(0, 300).map((run) => (
                      <SelectItem key={run.id} value={run.id}>
                        {run.sagaKey} · {run.status} · {run.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            {!['saga_definition', 'use_case', 'persona', 'saga_run'].includes(linkForm.targetType) ? (
              <div className="space-y-2">
                <Label>Target id</Label>
                <Input
                  value={linkForm.targetId}
                  onChange={(event) => setLinkForm((prev) => ({ ...prev, targetId: event.target.value }))}
                  placeholder="Paste canonical id/key"
                />
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkOpen(false)}>Cancel</Button>
            <Button onClick={() => void addLink()} disabled={isSavingLink || !linkForm.targetId.trim()}>
              {isSavingLink ? 'Linking...' : 'Create link'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={entryOpen} onOpenChange={setEntryOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add mission entry</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select
                  value={entryForm.entryType}
                  onValueChange={(value) =>
                    setEntryForm((prev) => ({ ...prev, entryType: value as OodaLoopEntry['entryType'] }))
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="signal">signal</SelectItem>
                    <SelectItem value="hypothesis">hypothesis</SelectItem>
                    <SelectItem value="decision">decision</SelectItem>
                    <SelectItem value="action_plan">action_plan</SelectItem>
                    <SelectItem value="result">result</SelectItem>
                    <SelectItem value="postmortem">postmortem</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={entryForm.status}
                  onValueChange={(value) =>
                    setEntryForm((prev) => ({ ...prev, status: value as OodaLoopEntry['status'] }))
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ENTRY_STATUS_OPTIONS.map((status) => (
                      <SelectItem key={status} value={status}>{status}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                value={entryForm.title}
                onChange={(event) => setEntryForm((prev) => ({ ...prev, title: event.target.value }))}
                placeholder="Availability sync probe failed at source-provider adapter"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Severity</Label>
                <Select
                  value={entryForm.severity}
                  onValueChange={(value) =>
                    setEntryForm((prev) => ({ ...prev, severity: value as OodaLoopEntry['severity'] }))
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">low</SelectItem>
                    <SelectItem value="medium">medium</SelectItem>
                    <SelectItem value="high">high</SelectItem>
                    <SelectItem value="critical">critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Gap type</Label>
                <Select
                  value={entryForm.gapType || '__none__'}
                  onValueChange={(value) =>
                    setEntryForm((prev) => ({ ...prev, gapType: value === '__none__' ? '' : (value as OodaGapType) }))
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">none</SelectItem>
                    {GAP_TYPES.map((gap) => (
                      <SelectItem key={gap} value={gap}>{gap}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Body</Label>
              <Textarea
                rows={8}
                value={entryForm.bodyMarkdown}
                onChange={(event) =>
                  setEntryForm((prev) => ({ ...prev, bodyMarkdown: event.target.value }))
                }
                placeholder="What happened, what was expected, what evidence was collected, and what we should do next."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEntryOpen(false)}>Cancel</Button>
            <Button onClick={() => void addEntry()} disabled={isSavingEntry || !entryForm.title.trim()}>
              {isSavingEntry ? 'Saving...' : 'Save entry'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={actionInspectOpen} onOpenChange={setActionInspectOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Action inspector</DialogTitle>
          </DialogHeader>
          {selectedAction ? (
            <ScrollArea className="max-h-[72vh] pr-3">
              <div className="space-y-4">
                <div className="rounded-lg border p-4">
                  <p className="font-medium">{selectedAction.actionTitle}</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedAction.actionKey} · {selectedAction.status}
                  </p>
                  {selectedAction.errorMessage ? (
                    <div className="mt-3 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
                      {selectedAction.errorMessage}
                    </div>
                  ) : null}
                </div>
                <div>
                  <p className="mb-2 text-sm font-medium">Request payload</p>
                  <ReactJson
                    src={(selectedAction.requestPayload ?? {}) as Record<string, unknown>}
                    theme="monokai"
                    name={false}
                    displayDataTypes={false}
                    displayObjectSize={false}
                    collapsed={2}
                    style={{ borderRadius: 8, padding: 12 }}
                  />
                </div>
                <div>
                  <p className="mb-2 text-sm font-medium">Result payload</p>
                  <ReactJson
                    src={(selectedAction.resultPayload ?? {}) as Record<string, unknown>}
                    theme="monokai"
                    name={false}
                    displayDataTypes={false}
                    displayObjectSize={false}
                    collapsed={2}
                    style={{ borderRadius: 8, padding: 12 }}
                  />
                </div>
              </div>
            </ScrollArea>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionInspectOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={draftOpen} onOpenChange={setDraftOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Generate draft</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Kind</Label>
                <Select
                  value={draftForm.kind}
                  onValueChange={(value) =>
                    setDraftForm((prev) => ({ ...prev, kind: value as 'use_case' | 'persona' | 'saga_definition' }))
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="use_case">use_case</SelectItem>
                    <SelectItem value="persona">persona</SelectItem>
                    <SelectItem value="saga_definition">saga_definition</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Context (optional)</Label>
                <Input
                  value={draftForm.context}
                  onChange={(event) => setDraftForm((prev) => ({ ...prev, context: event.target.value }))}
                  placeholder="extra context"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Prompt</Label>
              <Textarea
                rows={6}
                value={draftForm.prompt}
                onChange={(event) => setDraftForm((prev) => ({ ...prev, prompt: event.target.value }))}
                placeholder="Describe what to generate and why"
              />
            </div>
            <Button onClick={() => void generateDraft()} disabled={isGenerating || !draftForm.prompt.trim()}>
              {isGenerating ? 'Generating...' : 'Generate'}
            </Button>
            {draftOutput ? (
              <div className="space-y-2">
                <Label>Draft output</Label>
                <Textarea className="min-h-[240px] font-mono text-xs" value={draftOutput} readOnly />
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraftOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
