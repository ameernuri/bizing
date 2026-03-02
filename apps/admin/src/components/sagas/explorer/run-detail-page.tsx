'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { ArrowLeft, ChevronDown, ChevronRight, FileJson2, Loader2, MessageSquareText, PlayCircle, UserCircle2 } from 'lucide-react'
import { sagaApi, type SagaArtifact, type SagaArtifactContent, type SagaCoverageDetail, type SagaDefinitionLinksDetail, type SagaRunDetail, type SagaRunStep } from '@/lib/sagas-api'
import { SnapshotRenderer, type SnapshotDocument } from '@/components/sagas/snapshot-renderer'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { EmptyState, LoadError, LoadingGrid, PageIntro, RunStatusBadge } from './common'
import { useSagaRealtime } from '@/lib/use-saga-realtime'

const ReactJson = dynamic(() => import('react-json-view'), { ssr: false })

function groupSteps(steps: SagaRunStep[]) {
  const grouped = new Map<string, SagaRunStep[]>()
  for (const step of steps) {
    const existing = grouped.get(step.phaseTitle) ?? []
    existing.push(step)
    grouped.set(step.phaseTitle, existing)
  }
  return Array.from(grouped.entries())
}

function stepTone(status: string) {
  const normalized = status.toLowerCase()
  if (normalized === 'passed') return 'border-emerald-500/40 bg-emerald-500/5'
  if (normalized === 'failed' || normalized === 'blocked') return 'border-destructive/40 bg-destructive/5'
  if (normalized === 'running' || normalized === 'in_progress') return 'border-blue-500/40 bg-blue-500/5'
  return 'border-border bg-muted/20'
}

function stepBackdropTone(status: string) {
  const normalized = status.toLowerCase()
  if (normalized === 'passed') return 'bg-emerald-500'
  if (normalized === 'failed' || normalized === 'blocked') return 'bg-red-500'
  if (normalized === 'running' || normalized === 'in_progress') return 'bg-blue-500'
  if (normalized === 'skipped' || normalized === 'cancelled') return 'bg-slate-400'
  return 'bg-amber-500'
}

function phaseSegments(steps: SagaRunStep[]) {
  const counts = {
    failed: 0,
    passed: 0,
    running: 0,
    skipped: 0,
    pending: 0,
  }

  for (const step of steps) {
    const normalized = step.status.toLowerCase()
    if (normalized === 'failed' || normalized === 'blocked') counts.failed += 1
    else if (normalized === 'passed') counts.passed += 1
    else if (normalized === 'running' || normalized === 'in_progress') counts.running += 1
    else if (normalized === 'skipped' || normalized === 'cancelled') counts.skipped += 1
    else counts.pending += 1
  }

  return [
    { key: 'failed', label: 'Failed', count: counts.failed, className: 'bg-red-500' },
    { key: 'passed', label: 'Passed', count: counts.passed, className: 'bg-emerald-500' },
    { key: 'running', label: 'Running', count: counts.running, className: 'bg-blue-500' },
    { key: 'pending', label: 'Pending', count: counts.pending, className: 'bg-amber-500' },
    { key: 'skipped', label: 'Skipped', count: counts.skipped, className: 'bg-slate-400' },
  ].filter((segment) => segment.count > 0)
}

function safeParseSnapshot(content: string): SnapshotDocument | null {
  try {
    const parsed = JSON.parse(content) as SnapshotDocument
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

export function SagaRunDetailPage({ runId }: { runId: string }) {
  const [detail, setDetail] = useState<SagaRunDetail | null>(null)
  const [coverage, setCoverage] = useState<SagaCoverageDetail | null>(null)
  const [links, setLinks] = useState<SagaDefinitionLinksDetail | null>(null)
  const [artifactContent, setArtifactContent] = useState<SagaArtifactContent | null>(null)
  const [artifactOpen, setArtifactOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isExecuting, setIsExecuting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const realtimeRefreshRef = useRef<number | null>(null)
  const autoExecuteRunRef = useRef<string | null>(null)
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
      const nextDetail = await sagaApi.fetchRunDetail(runId)
      const [nextCoverage, nextLinks] = await Promise.all([
        sagaApi.fetchRunCoverage(runId).catch(() => null),
        nextDetail.definition?.sagaKey ? sagaApi.fetchDefinitionLinks(nextDetail.definition.sagaKey).catch(() => null) : Promise.resolve(null),
      ])
      setDetail(nextDetail)
      setCoverage(nextCoverage)
      setLinks(nextLinks)
    } catch (cause) {
      if (!background || !detail) {
        setError(cause instanceof Error ? cause.message : 'Failed to load saga run detail.')
      }
    } finally {
      loadInFlightRef.current = false
      if (!background) setIsLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [runId])

  useSagaRealtime({
    runId,
    onEvent: () => {
      if (realtimeRefreshRef.current !== null) window.clearTimeout(realtimeRefreshRef.current)
      realtimeRefreshRef.current = window.setTimeout(() => void load({ background: true }), 250)
    },
  })

  useEffect(() => {
    return () => {
      if (realtimeRefreshRef.current !== null) window.clearTimeout(realtimeRefreshRef.current)
    }
  }, [])

  async function executeRun(options?: { silent?: boolean }) {
    if (!detail || isExecuting) return
    const silent = options?.silent === true
    if (!silent) setError(null)
    setIsExecuting(true)
    try {
      await sagaApi.executeRun(detail.run.id)
      await load()
    } catch (cause) {
      if (!silent) {
        setError(cause instanceof Error ? cause.message : 'Failed to execute saga run.')
      }
    } finally {
      setIsExecuting(false)
    }
  }

  useEffect(() => {
    if (!detail) return
    const run = detail.run
    if (run.status !== 'pending' || run.startedAt) return
    if (autoExecuteRunRef.current === run.id) return
    autoExecuteRunRef.current = run.id
    void executeRun({ silent: true })
  }, [detail, isExecuting])

  async function openArtifact(artifact: SagaArtifact) {
    if (!detail) return
    try {
      const payload = await sagaApi.fetchArtifactContent(detail.run.id, artifact.id)
      setArtifactContent(payload)
      setArtifactOpen(true)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to load artifact content.')
    }
  }

  const phaseGroups = useMemo(() => groupSteps(detail?.steps ?? []), [detail?.steps])
  const firstFailure = useMemo(
    () => detail?.steps.find((step) => ['failed', 'blocked'].includes(step.status.toLowerCase())) ?? null,
    [detail?.steps],
  )
  const actorProfiles = detail?.actorProfiles ?? []
  const actorMessages = detail?.actorMessages ?? []
  const artifactsByStep = useMemo(() => {
    const grouped = new Map<string, SagaArtifact[]>()
    for (const artifact of detail?.artifacts ?? []) {
      const key = artifact.sagaRunStepId ?? 'run'
      const existing = grouped.get(key) ?? []
      existing.push(artifact)
      grouped.set(key, existing)
    }
    return grouped
  }, [detail?.artifacts])
  const snapshotDocument = artifactContent ? safeParseSnapshot(artifactContent.content) : null

  return (
    <div className="flex flex-1 flex-col">
      <PageIntro
        eyebrow="Saga Run"
        title={detail ? `${detail.definition?.title ?? detail.run.sagaKey}` : runId}
        description={detail?.definition ? `${detail.run.sagaKey} · ${detail.run.mode} run` : 'Run detail view for one concrete lifecycle execution.'}
        actions={
          <div className="flex items-center gap-2">
            {detail?.run.status === 'pending' ? (
              <Button onClick={() => void executeRun()} disabled={isExecuting}>
                {isExecuting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlayCircle className="mr-2 h-4 w-4" />}
                {isExecuting ? 'Executing' : 'Execute run'}
              </Button>
            ) : null}
            {detail?.definition?.sagaKey ? (
              <Button variant="outline" asChild>
                <Link href={`/sagas/definitions/${encodeURIComponent(detail.definition.sagaKey)}`}>Open definition</Link>
              </Button>
            ) : null}
            <Button variant="outline" asChild>
              <Link href="/sagas/runs">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to runs
              </Link>
            </Button>
          </div>
        }
      />
      <div className="flex-1 p-6">
        {error ? <LoadError message={error} onRetry={() => void load()} /> : null}
        {isLoading || !detail ? (
          <LoadingGrid count={6} />
        ) : (
          <div className="space-y-6">
            <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between gap-3">
                    <CardTitle>Run summary</CardTitle>
                    <RunStatusBadge status={detail.run.status} />
                  </div>
                  <CardDescription>
                    This page tells the story of one run: what it tried to do, what the system returned, what the user would have seen, and where the run broke.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <div className="grid gap-3 md:grid-cols-4">
                    <div className="rounded-lg border p-4"><p className="text-2xl font-semibold">{detail.run.passedSteps}</p><p className="text-muted-foreground">passed steps</p></div>
                    <div className="rounded-lg border p-4"><p className="text-2xl font-semibold">{detail.run.failedSteps}</p><p className="text-muted-foreground">failed steps</p></div>
                    <div className="rounded-lg border p-4"><p className="text-2xl font-semibold">{detail.run.totalSteps}</p><p className="text-muted-foreground">total steps</p></div>
                    <div className="rounded-lg border p-4"><p className="text-2xl font-semibold">{coverage?.report?.coveragePct ?? 0}%</p><p className="text-muted-foreground">coverage</p></div>
                  </div>
                  <div className="rounded-lg border p-4">
                    <p className="font-medium">First break</p>
                    <p className="mt-1 text-muted-foreground">
                      {firstFailure ? `${firstFailure.title ?? firstFailure.stepKey}: ${firstFailure.failureMessage ?? 'No failure message recorded.'}` : 'No broken step recorded in this run.'}
                    </p>
                  </div>
                  {coverage?.report?.summary ? (
                    <div className="rounded-lg border p-4">
                      <p className="font-medium">Coverage assessment</p>
                      <p className="mt-1 text-muted-foreground">{coverage.report.summary}</p>
                    </div>
                  ) : null}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Connections</CardTitle>
                  <CardDescription>Use these links to move from this run to the underlying use case, persona, and saga definition.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  {links?.useCaseVersions.map((version) => (
                    <Link key={version.id} href={`/sagas/use-cases/${encodeURIComponent(version.ucKey ?? '')}`} className="block rounded-lg border p-3 transition-colors hover:border-primary/40 hover:bg-muted/30">
                      <p className="font-medium">Use case</p>
                      <p className="text-muted-foreground">{version.ucKey ?? 'unknown'} · {version.useCaseTitle ?? version.title}</p>
                    </Link>
                  ))}
                  {links?.personaVersions.map((version) => (
                    <Link key={version.id} href={`/sagas/personas/${encodeURIComponent(version.personaKey ?? '')}`} className="block rounded-lg border p-3 transition-colors hover:border-primary/40 hover:bg-muted/30">
                      <p className="font-medium">Persona</p>
                      <p className="text-muted-foreground">{version.personaKey ?? 'unknown'} · {version.personaName ?? version.name}</p>
                    </Link>
                  ))}
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><UserCircle2 className="h-4 w-4" /> Actor profiles</CardTitle>
                  <CardDescription>These are the virtual identities used by this run for messages, bookings, and permissions.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {actorProfiles.length === 0 ? (
                    <p className="text-muted-foreground">No actor profiles were attached.</p>
                  ) : (
                    actorProfiles.map((profile) => (
                      <div key={profile.id} className="rounded-lg border p-3">
                        <p className="font-medium">{profile.actorName}</p>
                        <p className="text-muted-foreground">{profile.actorKey} · {profile.actorRole}</p>
                        <p className="mt-2">{profile.virtualEmail}</p>
                        <p>{profile.virtualPhone}</p>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><MessageSquareText className="h-4 w-4" /> Actor messages</CardTitle>
                  <CardDescription>These are the notifications and communications the run says users received.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {actorMessages.length === 0 ? (
                    <p className="text-muted-foreground">No messages were recorded for this run.</p>
                  ) : (
                    actorMessages.map((message) => (
                      <div key={message.id} className="rounded-lg border p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-medium">{message.channel.toUpperCase()} · {message.status}</p>
                            <p className="text-muted-foreground">{message.fromActorKey ?? 'system'} → {message.toActorKey ?? 'unknown'}</p>
                          </div>
                          <p className="text-xs text-muted-foreground">{message.deliveredAt ?? message.queuedAt ?? ''}</p>
                        </div>
                        {message.subject ? <p className="mt-2 font-medium">{message.subject}</p> : null}
                        <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{message.bodyText}</p>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Step timeline</CardTitle>
                <CardDescription>Steps are grouped by phase so you can read the run like a story instead of a raw log dump.</CardDescription>
              </CardHeader>
              <CardContent>
                {phaseGroups.length === 0 ? (
                  <EmptyState title="No steps recorded" description="This run does not have any step records yet." />
                ) : (
                  <Accordion type="multiple" className="space-y-4">
                    {phaseGroups.map(([phaseTitle, steps]) => (
                      <AccordionItem key={phaseTitle} value={phaseTitle} className="relative overflow-hidden rounded-xl border px-4">
                        <div className="pointer-events-none absolute inset-0 opacity-[0.12]" aria-hidden="true">
                          <div className="flex h-full w-full">
                            {phaseSegments(steps).map((segment) => (
                              <div
                                key={segment.key}
                                className={segment.className}
                                style={{ width: `${(segment.count / Math.max(steps.length, 1)) * 100}%` }}
                                title={`${segment.label}: ${segment.count}`}
                              />
                            ))}
                          </div>
                        </div>
                        <AccordionTrigger className="relative text-left hover:no-underline">
                          <div>
                            <p className="font-medium">{phaseTitle}</p>
                            <p className="text-sm text-muted-foreground">{steps.length} steps</p>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="relative space-y-4 pb-4">
                          {steps.map((step) => {
                            const artifacts = artifactsByStep.get(step.id) ?? []
                            return (
                              <div key={step.id} className={cn('relative overflow-hidden rounded-xl border p-4 space-y-4', stepTone(step.status))}>
                                <div className="pointer-events-none absolute inset-0 opacity-[0.12]" aria-hidden="true">
                                  <div className={cn('h-full w-full', stepBackdropTone(step.status))} />
                                </div>
                                <div className="relative flex items-start justify-between gap-3">
                                  <div>
                                    <p className="font-medium">{step.title ?? step.stepKey}</p>
                                    <p className="text-sm text-muted-foreground">{step.actorKey} · {step.status}</p>
                                  </div>
                                  <RunStatusBadge status={(step.status.toLowerCase() === 'in_progress' ? 'running' : step.status.toLowerCase()) as any} />
                                </div>
                                <div className="relative grid gap-4 xl:grid-cols-2">
                                  <div className="rounded-lg border bg-background p-3">
                                    <p className="mb-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">What happened</p>
                                    <p className="whitespace-pre-wrap text-sm">{step.instruction}</p>
                                  </div>
                                  <div className="rounded-lg border bg-background p-3">
                                    <p className="mb-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">Expected</p>
                                    <p className="whitespace-pre-wrap text-sm">{step.expectedResult ?? 'No explicit expected result recorded.'}</p>
                                  </div>
                                </div>
                                {step.failureMessage ? (
                                  <div className="relative rounded-lg border border-destructive/40 bg-background p-3 text-sm text-destructive">
                                    {step.failureMessage}
                                  </div>
                                ) : null}
                                {(step.resultPayload || step.assertionSummary) ? (
                                  <div className="relative rounded-lg border bg-background p-3">
                                    <p className="mb-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">Structured result</p>
                                    <ReactJson
                                      src={{ resultPayload: step.resultPayload, assertionSummary: step.assertionSummary }}
                                      name={false}
                                      collapsed={2}
                                      displayDataTypes={false}
                                      enableClipboard={false}
                                      theme="monokai"
                                      style={{ background: 'transparent', fontSize: '12px' }}
                                    />
                                  </div>
                                ) : null}
                                {artifacts.length ? (
                                  <div className="relative space-y-2">
                                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Artifacts</p>
                                    <div className="flex flex-wrap gap-2">
                                      {artifacts.map((artifact) => (
                                        <Button key={artifact.id} variant="outline" size="sm" onClick={() => void openArtifact(artifact)}>
                                          <FileJson2 className="mr-2 h-4 w-4" />
                                          {artifact.title}
                                        </Button>
                                      ))}
                                    </div>
                                  </div>
                                ) : null}
                              </div>
                            )
                          })}
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      <Dialog open={artifactOpen} onOpenChange={setArtifactOpen}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>{artifactContent?.artifact.title ?? 'Artifact'}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[75vh] pr-4">
            {snapshotDocument ? (
              <div className="space-y-4">
                <SnapshotRenderer doc={snapshotDocument} />
                <Separator />
                <ReactJson
                  src={JSON.parse(artifactContent?.content ?? '{}')}
                  name={false}
                  collapsed={2}
                  displayDataTypes={false}
                  enableClipboard={false}
                  theme="monokai"
                  style={{ background: 'transparent', fontSize: '12px' }}
                />
              </div>
            ) : artifactContent?.content ? (
              artifactContent.artifact.contentType.includes('json') ? (
                <ReactJson
                  src={JSON.parse(artifactContent.content)}
                  name={false}
                  collapsed={2}
                  displayDataTypes={false}
                  enableClipboard={false}
                  theme="monokai"
                  style={{ background: 'transparent', fontSize: '12px' }}
                />
              ) : (
                <pre className="whitespace-pre-wrap rounded-lg border p-4 text-sm">{artifactContent.content}</pre>
              )
            ) : null}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  )
}
