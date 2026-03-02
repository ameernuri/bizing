'use client'

import Link from 'next/link'
import { ArrowRight, BookOpen, FileStack, Orbit, PlayCircle, UserCircle2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import type {
  SagaDefinitionSummary,
  SagaPersonaDefinition,
  SagaRunStatus,
  SagaRunSummary,
  SagaUseCaseDefinition,
} from '@/lib/sagas-api'

type ProgressSegment = {
  key: string
  label: string
  count: number
  className: string
}

export function PageIntro({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string
  title: string
  description?: string
  actions?: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-4 border-b px-6 py-5 md:flex-row md:items-start md:justify-between">
      <div className="space-y-2">
        {eyebrow ? <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">{eyebrow}</p> : null}
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {description ? <p className="max-w-4xl text-sm text-muted-foreground">{description}</p> : null}
        </div>
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  )
}

export function SearchToolbar({
  value,
  onChange,
  placeholder,
  meta,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
  meta?: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-3 border-b px-6 py-4 md:flex-row md:items-center md:justify-between">
      <div className="w-full md:max-w-sm">
        <Input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
      </div>
      {meta ? <div className="text-sm text-muted-foreground">{meta}</div> : null}
    </div>
  )
}

export function LoadError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle>Unable to load saga data</CardTitle>
        <CardDescription>{message}</CardDescription>
      </CardHeader>
      {onRetry ? (
        <CardContent>
          <Button variant="outline" onClick={onRetry}>
            Retry
          </Button>
        </CardContent>
      ) : null}
    </Card>
  )
}

export function EmptyState({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
    </Card>
  )
}

export function LoadingGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: count }).map((_, index) => (
        <Card key={index}>
          <CardHeader className="space-y-3">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-6 w-4/5" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </CardHeader>
        </Card>
      ))}
    </div>
  )
}

export function LifecycleBadge({ status }: { status: string }) {
  const tone =
    status === 'active'
      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
      : status === 'archived'
        ? 'border-slate-500/40 bg-slate-500/10 text-slate-700 dark:text-slate-300'
        : 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300'
  return <Badge variant="outline" className={tone}>{status}</Badge>
}

export function RunStatusBadge({ status }: { status: SagaRunStatus }) {
  const tone =
    status === 'passed'
      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
      : status === 'failed'
        ? 'border-destructive/40 bg-destructive/10 text-destructive'
        : status === 'running'
          ? 'border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300'
          : status === 'cancelled'
            ? 'border-slate-500/40 bg-slate-500/10 text-slate-700 dark:text-slate-300'
            : 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300'
  return <Badge variant="outline" className={tone}>{status}</Badge>
}

export function buildRunStepSegments(run: Pick<SagaRunSummary, 'totalSteps' | 'passedSteps' | 'failedSteps' | 'skippedSteps'>): ProgressSegment[] {
  const pending = Math.max(run.totalSteps - run.passedSteps - run.failedSteps - run.skippedSteps, 0)
  return [
    { key: 'failed', label: 'Failed', count: run.failedSteps, className: 'bg-red-500' },
    { key: 'passed', label: 'Passed', count: run.passedSteps, className: 'bg-emerald-500' },
    { key: 'pending', label: 'Pending', count: pending, className: 'bg-amber-500' },
    { key: 'skipped', label: 'Skipped', count: run.skippedSteps, className: 'bg-slate-400' },
  ]
}

export function RunProgressBackdrop({
  run,
  className,
}: {
  run: Pick<SagaRunSummary, 'totalSteps' | 'passedSteps' | 'failedSteps' | 'skippedSteps'>
  className?: string
}) {
  const segments = buildRunStepSegments(run).filter((segment) => segment.count > 0)

  return (
    <div className={cn('pointer-events-none absolute inset-0 opacity-[0.12]', className)} aria-hidden="true">
      <div className="flex h-full w-full">
        {segments.map((segment) => (
          <div
            key={segment.key}
            className={segment.className}
            style={{ width: `${(segment.count / Math.max(run.totalSteps, 1)) * 100}%` }}
            title={`${segment.label}: ${segment.count}`}
          />
        ))}
      </div>
    </div>
  )
}

export function EntitySummaryCard({
  href,
  title,
  description,
  status,
  footer,
}: {
  href: string
  title: string
  description?: string | null
  status?: React.ReactNode
  footer?: React.ReactNode
}) {
  return (
    <Link href={href} className="block">
      <Card className="h-full transition-colors hover:border-primary/40 hover:bg-muted/30">
        <CardHeader className="gap-3">
          <div className="flex items-start justify-between gap-3">
            <CardTitle className="text-base leading-6">{title}</CardTitle>
            {status}
          </div>
          {description ? <CardDescription className="line-clamp-3 text-sm">{description}</CardDescription> : null}
        </CardHeader>
        {footer ? <CardContent className="text-sm text-muted-foreground">{footer}</CardContent> : null}
      </Card>
    </Link>
  )
}

export function ExplorerLinkCards({
  counts,
}: {
  counts: {
    useCases: number
    personas: number
    definitions: number
    runs: number
    loops?: number
  }
}) {
  const items = [
    {
      href: '/sagas/loops',
      label: 'Missions',
      value: counts.loops ?? 0,
      description: 'Active objectives currently being tracked and validated.',
      icon: Orbit,
    },
    {
      href: '/sagas/use-cases',
      label: 'Use Cases',
      value: counts.useCases,
      description: 'Business needs the platform is supposed to prove.',
      icon: BookOpen,
    },
    {
      href: '/sagas/personas',
      label: 'Personas',
      value: counts.personas,
      description: 'Actors used to exercise the same use cases from different angles.',
      icon: UserCircle2,
    },
    {
      href: '/sagas/definitions',
      label: 'Saga Definitions',
      value: counts.definitions,
      description: 'Concrete lifecycle scripts that connect use cases and personas.',
      icon: FileStack,
    },
    {
      href: '/sagas/runs',
      label: 'Saga Runs',
      value: counts.runs,
      description: 'Execution history showing what actually passed, failed, or stalled.',
      icon: PlayCircle,
    },
  ]

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => {
        const Icon = item.icon
        return (
          <Link href={item.href} key={item.href} className="block">
            <Card className="h-full transition-colors hover:border-primary/40 hover:bg-muted/30">
              <CardHeader className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="rounded-md border p-2 text-muted-foreground">
                    <Icon className="h-4 w-4" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="space-y-1">
                  <CardTitle className="text-base">{item.label}</CardTitle>
                  <CardDescription>{item.description}</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">{item.value}</div>
              </CardContent>
            </Card>
          </Link>
        )
      })}
    </div>
  )
}

export function SmallRunList({
  runs,
  emptyLabel,
}: {
  runs: SagaRunSummary[]
  emptyLabel: string
}) {
  if (runs.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>
  }

  return (
    <div className="space-y-3">
      {runs.map((run) => (
        <Link href={`/sagas/runs/${run.id}`} key={run.id} className="block">
          <div className="relative overflow-hidden rounded-lg border p-3 transition-colors hover:border-primary/40 hover:bg-muted/30">
            <RunProgressBackdrop run={run} />
            <div className="relative flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <p className="truncate text-sm font-medium">{run.sagaKey}</p>
                <p className="text-xs text-muted-foreground">
                  {run.passedSteps}/{run.totalSteps} passed • {run.mode}
                </p>
              </div>
              <RunStatusBadge status={run.status} />
            </div>
          </div>
        </Link>
      ))}
    </div>
  )
}

export function summarizeRuns(runs: SagaRunSummary[]) {
  const total = runs.length
  const passed = runs.filter((run) => run.status === 'passed').length
  const failed = runs.filter((run) => run.status === 'failed').length
  const active = runs.filter((run) => run.status === 'running' || run.status === 'pending').length
  return {
    total,
    passed,
    failed,
    active,
    passRate: total ? Math.round((passed / total) * 100) : 0,
  }
}

export function getLatestRun(runs: SagaRunSummary[]) {
  return [...runs].sort((a, b) => {
    const aTime = new Date(a.updatedAt ?? a.createdAt ?? 0).getTime()
    const bTime = new Date(b.updatedAt ?? b.createdAt ?? 0).getTime()
    return bTime - aTime
  })[0] ?? null
}

export function listSummaryFooter(entity: {
  sourceRef?: string | null
  sourceFilePath?: string | null
  metadata?: Record<string, unknown> | null
}) {
  const parts = [entity.sourceRef, entity.sourceFilePath].filter(Boolean)
  if (parts.length === 0) return null
  return parts.join(' • ')
}

export function sortByTitle<T extends SagaUseCaseDefinition | SagaPersonaDefinition | SagaDefinitionSummary>(items: T[], selector: (item: T) => string) {
  return [...items].sort((a, b) => selector(a).localeCompare(selector(b)))
}

export function panelClassName(extra?: string) {
  return cn('rounded-xl border bg-card text-card-foreground shadow-sm', extra)
}
