'use client'

import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useEffect, useMemo, useState } from 'react'
import { FlaskConical, Loader2, PlayCircle, Send, Sparkles, Wand2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { apiUrl } from '@/lib/api'
import { sagaApi, type SagaDefinitionSummary, type SagaRunSummary } from '@/lib/sagas-api'
import { LoadError, PageIntro, RunProgressBackdrop, RunStatusBadge } from './common'

const ReactJson = dynamic(() => import('react-json-view'), { ssr: false })

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

type RequestDraft = {
  method: HttpMethod
  path: string
  headersText: string
  bodyText: string
}

type RequestResult = {
  ok: boolean
  status: number
  durationMs: number
  responseHeaders: Record<string, string>
  parsedJson: unknown | null
  rawBody: string
  errorMessage?: string
}

type SmokeCheck = {
  key: string
  label: string
  description: string
  method: HttpMethod
  path: string
  body?: unknown
}

type SmokeResult = RequestResult & {
  key: string
  label: string
}

const requestTemplates: Array<{
  key: string
  title: string
  description: string
  method: HttpMethod
  path: string
  body?: unknown
}> = [
  {
    key: 'auth-me',
    title: 'Auth context',
    description: 'Validate session/API auth context and role scopes.',
    method: 'GET',
    path: '/api/v1/auth/me',
  },
  {
    key: 'saga-library-overview',
    title: 'Saga library overview',
    description: 'Fast signal for UC/persona/definition/run inventory.',
    method: 'GET',
    path: '/api/v1/sagas/library/overview',
  },
  {
    key: 'agents-manifest',
    title: 'Agents manifest',
    description: 'Verify agent/tool registry endpoint health.',
    method: 'GET',
    path: '/api/v1/agents/manifest',
  },
  {
    key: 'ooda-overview',
    title: 'OODA overview',
    description: 'Validate mission-level runtime health feed.',
    method: 'GET',
    path: '/api/v1/ooda/overview',
  },
  {
    key: 'sagas-list',
    title: 'Saga definitions list',
    description: 'Read definitions for run planning.',
    method: 'GET',
    path: '/api/v1/sagas/specs?limit=10',
  },
  {
    key: 'sagas-runs-list',
    title: 'Saga runs list',
    description: 'Read latest execution history.',
    method: 'GET',
    path: '/api/v1/sagas/runs?limit=10&mineOnly=false',
  },
]

const smokeChecks: SmokeCheck[] = [
  {
    key: 'smoke-auth-me',
    label: 'auth/me',
    description: 'Session and role context',
    method: 'GET',
    path: '/api/v1/auth/me',
  },
  {
    key: 'smoke-sagas-overview',
    label: 'sagas/library/overview',
    description: 'Saga inventory baseline',
    method: 'GET',
    path: '/api/v1/sagas/library/overview',
  },
  {
    key: 'smoke-sagas-use-cases',
    label: 'sagas/use-cases',
    description: 'UC listing',
    method: 'GET',
    path: '/api/v1/sagas/use-cases?limit=5',
  },
  {
    key: 'smoke-sagas-personas',
    label: 'sagas/personas',
    description: 'Persona listing',
    method: 'GET',
    path: '/api/v1/sagas/personas?limit=5',
  },
  {
    key: 'smoke-sagas-defs',
    label: 'sagas/specs',
    description: 'Definition listing',
    method: 'GET',
    path: '/api/v1/sagas/specs?limit=5',
  },
  {
    key: 'smoke-sagas-runs',
    label: 'sagas/runs',
    description: 'Run listing',
    method: 'GET',
    path: '/api/v1/sagas/runs?limit=5&mineOnly=false',
  },
  {
    key: 'smoke-ooda-overview',
    label: 'ooda/overview',
    description: 'Mission loop health',
    method: 'GET',
    path: '/api/v1/ooda/overview',
  },
  {
    key: 'smoke-agents-manifest',
    label: 'agents/manifest',
    description: 'Agents API discovery',
    method: 'GET',
    path: '/api/v1/agents/manifest',
  },
]

const defaultDraft: RequestDraft = {
  method: 'GET',
  path: '/api/v1/sagas/library/overview',
  headersText: '',
  bodyText: '',
}

/**
 * Internal operator-focused UI for manually proving API and UC behavior.
 *
 * ELI5:
 * - Endpoint Workbench: "hit any endpoint now and inspect exact response".
 * - UC Runner: "launch saga runs and immediately open evidence pages".
 * - Smoke Pack: "quick multi-endpoint health check before deeper debugging".
 */
export function SagaLabPage() {
  const [definitions, setDefinitions] = useState<SagaDefinitionSummary[]>([])
  const [runs, setRuns] = useState<SagaRunSummary[]>([])
  const [query, setQuery] = useState('')
  const [runMode, setRunMode] = useState<'dry_run' | 'live'>('dry_run')
  const [runBusyKey, setRunBusyKey] = useState<string | null>(null)
  const [batchBusy, setBatchBusy] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [draft, setDraft] = useState<RequestDraft>(defaultDraft)
  const [requestBusy, setRequestBusy] = useState(false)
  const [requestResult, setRequestResult] = useState<RequestResult | null>(null)
  const [smokeBusy, setSmokeBusy] = useState(false)
  const [smokeResults, setSmokeResults] = useState<SmokeResult[]>([])

  async function loadLibrary() {
    setIsLoading(true)
    setLoadError(null)
    try {
      const [nextDefinitions, nextRuns] = await Promise.all([
        sagaApi.fetchDefinitions(),
        sagaApi.fetchRuns({ limit: 200, mineOnly: false, includeArchived: false }),
      ])
      setDefinitions(nextDefinitions.filter((definition) => definition.status !== 'archived'))
      setRuns(nextRuns)
    } catch (cause) {
      setLoadError(cause instanceof Error ? cause.message : 'Failed to load QA Lab data.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadLibrary()
  }, [])

  const latestRunBySagaKey = useMemo(() => {
    const map = new Map<string, SagaRunSummary>()
    for (const run of [...runs].sort((a, b) => new Date(b.updatedAt ?? b.createdAt ?? 0).getTime() - new Date(a.updatedAt ?? a.createdAt ?? 0).getTime())) {
      if (!map.has(run.sagaKey)) map.set(run.sagaKey, run)
    }
    return map
  }, [runs])

  const filteredDefinitions = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return definitions
    return definitions.filter((definition) =>
      [definition.sagaKey, definition.title, definition.description ?? '', definition.sourceUseCaseRef ?? '']
        .join(' ')
        .toLowerCase()
        .includes(needle),
    )
  }, [definitions, query])

  const smokePassCount = smokeResults.filter((result) => result.ok).length

  async function executeRequest(input: {
    method: HttpMethod
    path: string
    headersText?: string
    bodyText?: string
  }): Promise<RequestResult> {
    const startedAt = performance.now()
    try {
      const headers: Record<string, string> = {}
      if (input.headersText?.trim()) {
        let parsedHeaders: unknown
        try {
          parsedHeaders = JSON.parse(input.headersText)
        } catch {
          return {
            ok: false,
            status: 0,
            durationMs: Math.round(performance.now() - startedAt),
            responseHeaders: {},
            parsedJson: null,
            rawBody: '',
            errorMessage: 'Headers must be valid JSON.',
          }
        }
        if (!parsedHeaders || typeof parsedHeaders !== 'object' || Array.isArray(parsedHeaders)) {
          return {
            ok: false,
            status: 0,
            durationMs: Math.round(performance.now() - startedAt),
            responseHeaders: {},
            parsedJson: null,
            rawBody: '',
            errorMessage: 'Headers JSON must be an object.',
          }
        }
        for (const [key, value] of Object.entries(parsedHeaders)) {
          if (typeof value === 'string') headers[key] = value
        }
      }

      let bodyValue: string | undefined
      if (input.bodyText?.trim() && input.method !== 'GET') {
        let parsedBody: unknown
        try {
          parsedBody = JSON.parse(input.bodyText)
        } catch {
          return {
            ok: false,
            status: 0,
            durationMs: Math.round(performance.now() - startedAt),
            responseHeaders: {},
            parsedJson: null,
            rawBody: '',
            errorMessage: 'Body must be valid JSON.',
          }
        }
        bodyValue = JSON.stringify(parsedBody)
      }

      const isAbsolute = /^https?:\/\//i.test(input.path)
      const requestPath = isAbsolute ? input.path : apiUrl(input.path.startsWith('/') ? input.path : `/${input.path}`)

      const response = await fetch(requestPath, {
        method: input.method,
        credentials: 'include',
        headers: {
          accept: 'application/json',
          ...(bodyValue ? { 'content-type': 'application/json' } : {}),
          ...headers,
        },
        body: bodyValue,
        cache: 'no-store',
      })

      const rawBody = await response.text()
      let parsedJson: unknown | null = null
      try {
        parsedJson = rawBody ? JSON.parse(rawBody) : null
      } catch {
        parsedJson = null
      }

      const responseHeaders: Record<string, string> = {}
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value
      })

      return {
        ok: response.ok,
        status: response.status,
        durationMs: Math.round(performance.now() - startedAt),
        responseHeaders,
        parsedJson,
        rawBody,
      }
    } catch (cause) {
      return {
        ok: false,
        status: 0,
        durationMs: Math.round(performance.now() - startedAt),
        responseHeaders: {},
        parsedJson: null,
        rawBody: '',
        errorMessage: cause instanceof Error ? cause.message : 'Request failed unexpectedly.',
      }
    }
  }

  async function handleSendRequest() {
    setRequestBusy(true)
    const result = await executeRequest(draft)
    setRequestResult(result)
    setRequestBusy(false)
  }

  async function handleRunSmokePack() {
    setSmokeBusy(true)
    setSmokeResults([])
    const next: SmokeResult[] = []
    for (const check of smokeChecks) {
      const result = await executeRequest({
        method: check.method,
        path: check.path,
        bodyText: check.body ? JSON.stringify(check.body, null, 2) : '',
      })
      next.push({ ...result, key: check.key, label: check.label })
      setSmokeResults([...next])
    }
    setSmokeBusy(false)
  }

  async function handleRunSaga(sagaKey: string) {
    setRunBusyKey(sagaKey)
    try {
      const created = await sagaApi.createRun({
        sagaKey,
        mode: runMode,
        runnerLabel: 'qa-lab-manual',
      })
      await sagaApi.executeRun(created.run.id)
      await loadLibrary()
    } catch (cause) {
      setLoadError(cause instanceof Error ? cause.message : 'Failed to start saga run.')
    } finally {
      setRunBusyKey(null)
    }
  }

  async function handleRunTopFiltered() {
    setBatchBusy(true)
    try {
      const top = filteredDefinitions.slice(0, 10)
      for (const definition of top) {
        const created = await sagaApi.createRun({
          sagaKey: definition.sagaKey,
          mode: runMode,
          runnerLabel: 'qa-lab-batch',
        })
        await sagaApi.executeRun(created.run.id)
      }
      await loadLibrary()
    } catch (cause) {
      setLoadError(cause instanceof Error ? cause.message : 'Failed to run the selected saga batch.')
    } finally {
      setBatchBusy(false)
    }
  }

  function applyTemplate(templateKey: string) {
    const template = requestTemplates.find((candidate) => candidate.key === templateKey)
    if (!template) return
    setDraft({
      method: template.method,
      path: template.path,
      headersText: '',
      bodyText: template.body ? JSON.stringify(template.body, null, 2) : '',
    })
  }

  return (
    <div className="flex flex-1 flex-col">
      <PageIntro
        eyebrow="Operator QA Lab"
        title="Endpoint + UC proving station"
        description="Run raw API calls, execute smoke checks, and launch saga definitions with one-click links into evidence pages."
      />
      <div className="flex flex-1 flex-col gap-6 p-6">
        {loadError ? <LoadError message={loadError} onRetry={() => void loadLibrary()} /> : null}

        <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FlaskConical className="h-4 w-4" />
                Endpoint workbench
              </CardTitle>
              <CardDescription>
                Use request templates or compose your own call. This always runs against authenticated API routes with session cookies.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-[1fr_220px]">
                <div className="space-y-2">
                  <Label>Request template</Label>
                  <Select onValueChange={applyTemplate}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pick a high-value endpoint preset" />
                    </SelectTrigger>
                    <SelectContent>
                      {requestTemplates.map((template) => (
                        <SelectItem key={template.key} value={template.key}>
                          {template.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Presets are shortcuts only. You can edit method/path/body before sending.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Method</Label>
                  <Select value={draft.method} onValueChange={(value) => setDraft((previous) => ({ ...previous, method: value as HttpMethod }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as HttpMethod[]).map((method) => (
                        <SelectItem key={method} value={method}>
                          {method}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Path</Label>
                <Input
                  value={draft.path}
                  onChange={(event) => setDraft((previous) => ({ ...previous, path: event.target.value }))}
                  placeholder="/api/v1/..."
                />
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Headers (JSON)</Label>
                  <Textarea
                    className="min-h-28 font-mono text-xs"
                    value={draft.headersText}
                    onChange={(event) => setDraft((previous) => ({ ...previous, headersText: event.target.value }))}
                    placeholder='{"x-api-key":"..."}'
                  />
                </div>
                <div className="space-y-2">
                  <Label>Body (JSON)</Label>
                  <Textarea
                    className="min-h-28 font-mono text-xs"
                    value={draft.bodyText}
                    onChange={(event) => setDraft((previous) => ({ ...previous, bodyText: event.target.value }))}
                    placeholder='{"example":"value"}'
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button onClick={() => void handleSendRequest()} disabled={requestBusy}>
                  {requestBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                  Send request
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setDraft(defaultDraft)
                    setRequestResult(null)
                  }}
                >
                  Reset
                </Button>
              </div>

              {requestResult ? (
                <div className="space-y-3 rounded-lg border p-3">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className={requestResult.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}>
                      {requestResult.ok ? 'success' : 'failed'}
                    </span>
                    <span className="text-muted-foreground">status {requestResult.status}</span>
                    <span className="text-muted-foreground">{requestResult.durationMs}ms</span>
                    {requestResult.errorMessage ? (
                      <span className="text-destructive">{requestResult.errorMessage}</span>
                    ) : null}
                  </div>
                  <Tabs defaultValue="json" className="w-full">
                    <TabsList>
                      <TabsTrigger value="json">JSON</TabsTrigger>
                      <TabsTrigger value="raw">Raw</TabsTrigger>
                      <TabsTrigger value="headers">Headers</TabsTrigger>
                    </TabsList>
                    <TabsContent value="json" className="mt-3">
                      {requestResult.parsedJson !== null ? (
                        <div className="overflow-auto rounded-md border p-2">
                          <ReactJson
                            src={
                              typeof requestResult.parsedJson === 'object' && requestResult.parsedJson !== null
                                ? (requestResult.parsedJson as Record<string, unknown>)
                                : { value: requestResult.parsedJson }
                            }
                            name={null}
                            collapsed={1}
                            displayDataTypes={false}
                            displayObjectSize={false}
                            enableClipboard={false}
                            theme="ashes"
                          />
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">Response is not valid JSON.</p>
                      )}
                    </TabsContent>
                    <TabsContent value="raw" className="mt-3">
                      <pre className="max-h-72 overflow-auto rounded-md border p-3 text-xs">{requestResult.rawBody || 'No response body.'}</pre>
                    </TabsContent>
                    <TabsContent value="headers" className="mt-3">
                      <pre className="max-h-72 overflow-auto rounded-md border p-3 text-xs">
                        {JSON.stringify(requestResult.responseHeaders, null, 2)}
                      </pre>
                    </TabsContent>
                  </Tabs>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                Smoke pack
              </CardTitle>
              <CardDescription>Run a quick baseline against critical read endpoints before deep UC debugging.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border p-3 text-sm">
                <p className="font-medium">
                  {smokeResults.length === 0
                    ? 'No smoke run yet.'
                    : `${smokePassCount}/${smokeResults.length} checks passed`}
                </p>
                <p className="text-muted-foreground">
                  Fast signal for auth, saga inventory, loop health, and agents API discoverability.
                </p>
              </div>
              <Button onClick={() => void handleRunSmokePack()} disabled={smokeBusy} className="w-full">
                {smokeBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                Run smoke pack
              </Button>
              <Separator />
              <div className="space-y-2">
                {smokeChecks.map((check) => {
                  const result = smokeResults.find((candidate) => candidate.key === check.key)
                  return (
                    <div key={check.key} className="rounded-lg border p-3 text-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium">{check.label}</p>
                          <p className="text-xs text-muted-foreground">{check.description}</p>
                        </div>
                        <div className="text-right text-xs">
                          {result ? (
                            <>
                              <p className={result.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}>
                                {result.ok ? 'pass' : 'fail'}
                              </p>
                              <p className="text-muted-foreground">
                                {result.status} • {result.durationMs}ms
                              </p>
                            </>
                          ) : (
                            <p className="text-muted-foreground">pending</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PlayCircle className="h-4 w-4" />
              UC runner control plane
            </CardTitle>
            <CardDescription>
              Filter saga definitions, launch runs immediately, and jump straight to run evidence. This is tuned for manual endpoint/UC proving.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-[1fr_170px_220px_auto]">
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by saga key/title/use-case ref"
              />
              <Select value={runMode} onValueChange={(value) => setRunMode(value as 'dry_run' | 'live')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dry_run">dry_run</SelectItem>
                  <SelectItem value="live">live</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={() => void loadLibrary()} disabled={isLoading}>
                Reload data
              </Button>
              <Button onClick={() => void handleRunTopFiltered()} disabled={batchBusy || filteredDefinitions.length === 0}>
                {batchBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Run top 10
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Showing {Math.min(filteredDefinitions.length, 50)} of {filteredDefinitions.length} filtered definitions.
            </p>

            <div className="space-y-3">
              {isLoading ? (
                <p className="text-sm text-muted-foreground">Loading definition inventory...</p>
              ) : filteredDefinitions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No matching definitions.</p>
              ) : (
                filteredDefinitions.slice(0, 50).map((definition) => {
                  const latest = latestRunBySagaKey.get(definition.sagaKey)
                  const busy = runBusyKey === definition.sagaKey
                  return (
                    <div key={definition.id} className="relative overflow-hidden rounded-lg border p-3">
                      {latest ? <RunProgressBackdrop run={latest} /> : null}
                      <div className="relative flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div className="min-w-0 space-y-1">
                          <p className="truncate font-medium">{definition.title}</p>
                          <p className="truncate text-xs text-muted-foreground">{definition.sagaKey}</p>
                          <p className="text-xs text-muted-foreground">
                            UC ref: {definition.sourceUseCaseRef ?? 'none'} · status: {definition.status}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {latest ? <RunStatusBadge status={latest.status} /> : <span className="text-xs text-muted-foreground">no runs</span>}
                          <Button size="sm" onClick={() => void handleRunSaga(definition.sagaKey)} disabled={busy || batchBusy}>
                            {busy ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
                            Run
                          </Button>
                          <Button size="sm" variant="outline" asChild>
                            <Link href={`/ooda/definitions/${encodeURIComponent(definition.sagaKey)}`}>Definition</Link>
                          </Button>
                          {latest ? (
                            <Button size="sm" variant="outline" asChild>
                              <Link href={`/ooda/runs/${latest.id}`}>Latest run</Link>
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
