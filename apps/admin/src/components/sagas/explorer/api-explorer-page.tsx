'use client'

import dynamic from 'next/dynamic'
import { useEffect, useMemo, useState } from 'react'
import { Bot, Loader2, RefreshCcw, Send, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { apiUrl } from '@/lib/api'
import { LoadError, PageIntro } from './common'

const ReactJson = dynamic(() => import('react-json-view'), { ssr: false })

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

type ExplorerEndpoint = {
  method: HttpMethod
  path: string
  domain: string
  sourceFile: string
  authClass: 'public' | 'session_or_machine' | 'session_only' | 'internal_or_policy'
  summary: string
  codeModeTools: string[]
}

type CodeModeTool = {
  name: string
  description: string
  method: HttpMethod
  path: string
  tags: string[]
  parameters: {
    type: 'object'
    properties: Record<string, unknown>
    required?: string[]
  }
}

type ExplorerCatalog = {
  generatedAt: string
  endpointCount: number
  codeModeToolCount: number
  endpoints: ExplorerEndpoint[]
  codeMode: {
    manifestPath: string
    toolsPath: string
    searchPath: string
    executePath: string
    tools: CodeModeTool[]
  }
  openapi: {
    openapi: '3.1.0'
    info: {
      title: string
      version: string
      description: string
    }
    servers: Array<{ url: string }>
    paths: Record<string, unknown>
  }
}

type RequestResult = {
  ok: boolean
  status: number
  durationMs: number
  parsedJson: unknown | null
  rawBody: string
  errorMessage?: string
}

const methodTone: Record<HttpMethod, string> = {
  GET: 'text-blue-600 dark:text-blue-400',
  POST: 'text-emerald-600 dark:text-emerald-400',
  PUT: 'text-amber-600 dark:text-amber-400',
  PATCH: 'text-purple-600 dark:text-purple-400',
  DELETE: 'text-red-600 dark:text-red-400',
}

const defaultHeaders = '{\n  "accept": "application/json"\n}'

function prettyJson(value: unknown) {
  return JSON.stringify(value ?? {}, null, 2)
}

async function requestJson<T>(url: string): Promise<T> {
  const response = await fetch(apiUrl(url), {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok || !payload?.success) {
    throw new Error(payload?.error?.message ?? `Request failed with status ${response.status}`)
  }
  return payload.data as T
}

export function ApiExplorerPage() {
  const [catalog, setCatalog] = useState<ExplorerCatalog | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [query, setQuery] = useState('')
  const [methodFilter, setMethodFilter] = useState<'all' | HttpMethod>('all')
  const [selectedEndpoint, setSelectedEndpoint] = useState<ExplorerEndpoint | null>(null)

  const [reqMethod, setReqMethod] = useState<HttpMethod>('GET')
  const [reqPath, setReqPath] = useState('/api/v1/health/db')
  const [reqHeaders, setReqHeaders] = useState(defaultHeaders)
  const [reqBody, setReqBody] = useState('{\n}')
  const [reqBusy, setReqBusy] = useState(false)
  const [reqResult, setReqResult] = useState<RequestResult | null>(null)

  const [toolQuery, setToolQuery] = useState('')
  const [selectedToolName, setSelectedToolName] = useState<string>('')
  const [toolParamsText, setToolParamsText] = useState('{\n}')
  const [toolBusy, setToolBusy] = useState(false)
  const [toolResult, setToolResult] = useState<RequestResult | null>(null)

  async function loadCatalog() {
    setLoading(true)
    setError(null)
    try {
      const next = await requestJson<ExplorerCatalog>('/api/v1/agents/openapi/catalog')
      setCatalog(next)
      if (!selectedEndpoint && next.endpoints.length > 0) {
        const first = next.endpoints[0]
        setSelectedEndpoint(first)
        setReqMethod(first.method)
        setReqPath(first.path)
      }
      if (!selectedToolName && next.codeMode.tools.length > 0) {
        const firstTool = next.codeMode.tools[0]
        setSelectedToolName(firstTool.name)
        setToolParamsText(prettyJson({}))
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to load OpenAPI explorer catalog.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadCatalog()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filteredEndpoints = useMemo(() => {
    const all = catalog?.endpoints ?? []
    const needle = query.trim().toLowerCase()
    return all.filter((endpoint) => {
      if (methodFilter !== 'all' && endpoint.method !== methodFilter) return false
      if (!needle) return true
      return [endpoint.path, endpoint.domain, endpoint.summary, endpoint.sourceFile, endpoint.authClass]
        .join(' ')
        .toLowerCase()
        .includes(needle)
    })
  }, [catalog, methodFilter, query])

  const filteredTools = useMemo(() => {
    const all = catalog?.codeMode.tools ?? []
    const needle = toolQuery.trim().toLowerCase()
    if (!needle) return all
    return all.filter((tool) => [tool.name, tool.description, tool.path, tool.tags.join(' ')].join(' ').toLowerCase().includes(needle))
  }, [catalog, toolQuery])

  async function executeEndpoint() {
    setReqBusy(true)
    const startedAt = performance.now()

    try {
      const headersCandidate = reqHeaders.trim() ? JSON.parse(reqHeaders) : {}
      if (!headersCandidate || typeof headersCandidate !== 'object' || Array.isArray(headersCandidate)) {
        throw new Error('Headers must be a JSON object.')
      }
      const headers: Record<string, string> = {}
      for (const [key, value] of Object.entries(headersCandidate)) {
        if (typeof value === 'string') headers[key] = value
      }

      const isGet = reqMethod === 'GET'
      const bodyText = reqBody.trim()
      const parsedBody = !isGet && bodyText ? JSON.parse(bodyText) : undefined

      const response = await fetch(apiUrl(reqPath), {
        method: reqMethod,
        credentials: 'include',
        headers: {
          ...(parsedBody !== undefined ? { 'content-type': 'application/json' } : {}),
          ...headers,
        },
        body: parsedBody !== undefined ? JSON.stringify(parsedBody) : undefined,
        cache: 'no-store',
      })
      const rawBody = await response.text()

      let parsedJson: unknown | null = null
      try {
        parsedJson = rawBody ? JSON.parse(rawBody) : null
      } catch {
        parsedJson = null
      }

      setReqResult({
        ok: response.ok,
        status: response.status,
        durationMs: Math.round(performance.now() - startedAt),
        parsedJson,
        rawBody,
      })
    } catch (cause) {
      setReqResult({
        ok: false,
        status: 0,
        durationMs: Math.round(performance.now() - startedAt),
        parsedJson: null,
        rawBody: '',
        errorMessage: cause instanceof Error ? cause.message : 'Endpoint request failed.',
      })
    } finally {
      setReqBusy(false)
    }
  }

  async function executeTool() {
    if (!selectedToolName) return
    setToolBusy(true)
    const startedAt = performance.now()

    try {
      const params = toolParamsText.trim() ? JSON.parse(toolParamsText) : {}
      const response = await fetch(apiUrl('/api/v1/agents/execute'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tool: selectedToolName, params }),
        cache: 'no-store',
      })
      const rawBody = await response.text()
      let parsedJson: unknown | null = null
      try {
        parsedJson = rawBody ? JSON.parse(rawBody) : null
      } catch {
        parsedJson = null
      }
      setToolResult({
        ok: response.ok,
        status: response.status,
        durationMs: Math.round(performance.now() - startedAt),
        parsedJson,
        rawBody,
      })
    } catch (cause) {
      setToolResult({
        ok: false,
        status: 0,
        durationMs: Math.round(performance.now() - startedAt),
        parsedJson: null,
        rawBody: '',
        errorMessage: cause instanceof Error ? cause.message : 'Tool execution failed.',
      })
    } finally {
      setToolBusy(false)
    }
  }

  const selectedTool = (catalog?.codeMode.tools ?? []).find((tool) => tool.name === selectedToolName) ?? null

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="OODash API Explorer"
        title="OpenAPI + Code-Mode Explorer"
        description="Browse every API endpoint, inspect generated OpenAPI paths, and execute code-mode tools from one interactive operator surface."
        actions={
          <Button variant="outline" size="sm" onClick={() => void loadCatalog()}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            Refresh catalog
          </Button>
        }
      />

      <div className="px-6 pb-6 space-y-6">
        {error ? <LoadError message={error} onRetry={() => void loadCatalog()} /> : null}
        {loading ? (
          <Card>
            <CardContent className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading API explorer catalog...
            </CardContent>
          </Card>
        ) : null}

        {catalog ? (
          <>
            <div className="grid gap-4 md:grid-cols-4">
              <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Endpoints</CardTitle></CardHeader><CardContent><p className="text-2xl font-semibold">{catalog.endpointCount}</p></CardContent></Card>
              <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Code-mode tools</CardTitle></CardHeader><CardContent><p className="text-2xl font-semibold">{catalog.codeModeToolCount}</p></CardContent></Card>
              <Card><CardHeader className="pb-2"><CardTitle className="text-sm">OpenAPI</CardTitle></CardHeader><CardContent><p className="text-sm font-medium">{catalog.openapi.info.version}</p></CardContent></Card>
              <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Generated</CardTitle></CardHeader><CardContent><p className="text-sm">{new Date(catalog.generatedAt).toLocaleString()}</p></CardContent></Card>
            </div>

            <Tabs defaultValue="endpoints" className="space-y-4">
              <TabsList>
                <TabsTrigger value="endpoints">Endpoints</TabsTrigger>
                <TabsTrigger value="tools">Code-mode</TabsTrigger>
                <TabsTrigger value="openapi">OpenAPI JSON</TabsTrigger>
              </TabsList>

              <TabsContent value="endpoints" className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
                <Card>
                  <CardHeader>
                    <CardTitle>Route Catalog</CardTitle>
                    <CardDescription>Every discovered API endpoint with auth posture, source, and code-mode mapping.</CardDescription>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-1">
                        <Label htmlFor="endpoint-search">Search</Label>
                        <div className="relative">
                          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                          <Input id="endpoint-search" className="pl-8" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="path, domain, auth class" />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="method-filter">Method</Label>
                        <Select value={methodFilter} onValueChange={(value) => setMethodFilter(value as typeof methodFilter)}>
                          <SelectTrigger id="method-filter"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">all</SelectItem>
                            <SelectItem value="GET">GET</SelectItem>
                            <SelectItem value="POST">POST</SelectItem>
                            <SelectItem value="PUT">PUT</SelectItem>
                            <SelectItem value="PATCH">PATCH</SelectItem>
                            <SelectItem value="DELETE">DELETE</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[560px] rounded border">
                      <div className="divide-y">
                        {filteredEndpoints.map((endpoint) => {
                          const selected = selectedEndpoint?.method === endpoint.method && selectedEndpoint?.path === endpoint.path
                          return (
                            <button
                              key={`${endpoint.method}-${endpoint.path}`}
                              type="button"
                              className={`w-full text-left p-3 hover:bg-muted/50 ${selected ? 'bg-muted' : ''}`}
                              onClick={() => {
                                setSelectedEndpoint(endpoint)
                                setReqMethod(endpoint.method)
                                setReqPath(endpoint.path)
                                setReqBody('{\n}')
                                setReqResult(null)
                              }}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className={`text-xs font-semibold ${methodTone[endpoint.method]}`}>{endpoint.method}</span>
                                <span className="text-[11px] text-muted-foreground">{endpoint.authClass}</span>
                              </div>
                              <p className="font-mono text-xs mt-1 break-all">{endpoint.path}</p>
                              <p className="text-xs text-muted-foreground mt-1">{endpoint.domain} · {endpoint.sourceFile}</p>
                              {endpoint.codeModeTools.length > 0 ? (
                                <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1">tool: {endpoint.codeModeTools.join(', ')}</p>
                              ) : null}
                            </button>
                          )
                        })}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Request Runner</CardTitle>
                    <CardDescription>Execute the selected endpoint with full request and response inspection.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-1">
                      <Label htmlFor="req-method">Method</Label>
                      <Select value={reqMethod} onValueChange={(value) => setReqMethod(value as HttpMethod)}>
                        <SelectTrigger id="req-method"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="GET">GET</SelectItem>
                          <SelectItem value="POST">POST</SelectItem>
                          <SelectItem value="PUT">PUT</SelectItem>
                          <SelectItem value="PATCH">PATCH</SelectItem>
                          <SelectItem value="DELETE">DELETE</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="req-path">Path</Label>
                      <Input id="req-path" value={reqPath} onChange={(e) => setReqPath(e.target.value)} placeholder="/api/v1/..." />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="req-headers">Headers JSON</Label>
                      <Textarea id="req-headers" value={reqHeaders} onChange={(e) => setReqHeaders(e.target.value)} className="font-mono text-xs min-h-[90px]" />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="req-body">Body JSON</Label>
                      <Textarea id="req-body" value={reqBody} onChange={(e) => setReqBody(e.target.value)} className="font-mono text-xs min-h-[140px]" />
                    </div>
                    <Button className="w-full" onClick={() => void executeEndpoint()} disabled={reqBusy}>
                      {reqBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}Send request
                    </Button>
                    {reqResult ? (
                      <>
                        <Separator />
                        <div className="flex items-center justify-between text-sm">
                          <span>Status {reqResult.status}</span>
                          <span className="text-muted-foreground">{reqResult.durationMs} ms</span>
                        </div>
                        {reqResult.errorMessage ? <p className="text-sm text-destructive">{reqResult.errorMessage}</p> : null}
                        <div className="rounded border p-2">
                          {reqResult.parsedJson ? (
                            <ReactJson src={reqResult.parsedJson as Record<string, unknown>} name={false} collapsed={2} displayDataTypes={false} enableClipboard={false} theme="ocean" />
                          ) : (
                            <pre className="text-xs whitespace-pre-wrap break-all">{reqResult.rawBody || 'No response body.'}</pre>
                          )}
                        </div>
                      </>
                    ) : null}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="tools" className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
                <Card>
                  <CardHeader>
                    <CardTitle>Code-mode tool catalog</CardTitle>
                    <CardDescription>Agent-facing interfaces exposed by `/api/v1/agents/*`.</CardDescription>
                    <div className="space-y-1">
                      <Label htmlFor="tool-search">Search tools</Label>
                      <Input id="tool-search" value={toolQuery} onChange={(e) => setToolQuery(e.target.value)} placeholder="tool name, tag, path" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[560px] rounded border">
                      <div className="divide-y">
                        {filteredTools.map((tool) => {
                          const selected = selectedToolName === tool.name
                          return (
                            <button
                              key={tool.name}
                              type="button"
                              className={`w-full text-left p-3 hover:bg-muted/50 ${selected ? 'bg-muted' : ''}`}
                              onClick={() => {
                                setSelectedToolName(tool.name)
                                setToolParamsText(prettyJson({}))
                                setToolResult(null)
                              }}
                            >
                              <div className="flex items-center gap-2">
                                <Bot className="h-4 w-4 text-muted-foreground" />
                                <p className="font-medium text-sm">{tool.name}</p>
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">{tool.description}</p>
                              <p className="font-mono text-xs mt-1"><span className={methodTone[tool.method]}>{tool.method}</span> {tool.path}</p>
                            </button>
                          )
                        })}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Tool executor</CardTitle>
                    <CardDescription>Execute one code-mode tool call via `/api/v1/agents/execute`.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-1">
                      <Label htmlFor="tool-name">Tool</Label>
                      <Select value={selectedToolName} onValueChange={(value) => setSelectedToolName(value)}>
                        <SelectTrigger id="tool-name"><SelectValue placeholder="Select tool" /></SelectTrigger>
                        <SelectContent>
                          {(catalog.codeMode.tools ?? []).map((tool) => (
                            <SelectItem key={tool.name} value={tool.name}>{tool.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {selectedTool ? (
                      <div className="rounded border p-2 text-xs text-muted-foreground">
                        <p className="font-medium text-foreground mb-1">{selectedTool.description}</p>
                        <p className="font-mono"><span className={methodTone[selectedTool.method]}>{selectedTool.method}</span> {selectedTool.path}</p>
                      </div>
                    ) : null}
                    <div className="space-y-1">
                      <Label htmlFor="tool-params">Params JSON</Label>
                      <Textarea id="tool-params" value={toolParamsText} onChange={(e) => setToolParamsText(e.target.value)} className="font-mono text-xs min-h-[180px]" />
                    </div>
                    <Button className="w-full" onClick={() => void executeTool()} disabled={toolBusy || !selectedToolName}>
                      {toolBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}Execute tool
                    </Button>
                    {toolResult ? (
                      <>
                        <Separator />
                        <div className="flex items-center justify-between text-sm">
                          <span>Status {toolResult.status}</span>
                          <span className="text-muted-foreground">{toolResult.durationMs} ms</span>
                        </div>
                        {toolResult.errorMessage ? <p className="text-sm text-destructive">{toolResult.errorMessage}</p> : null}
                        <div className="rounded border p-2">
                          {toolResult.parsedJson ? (
                            <ReactJson src={toolResult.parsedJson as Record<string, unknown>} name={false} collapsed={2} displayDataTypes={false} enableClipboard={false} theme="ocean" />
                          ) : (
                            <pre className="text-xs whitespace-pre-wrap break-all">{toolResult.rawBody || 'No response body.'}</pre>
                          )}
                        </div>
                      </>
                    ) : null}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="openapi">
                <Card>
                  <CardHeader>
                    <CardTitle>Generated OpenAPI document</CardTitle>
                    <CardDescription>OpenAPI-style output synthesized from all current routes and server-level endpoints.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded border p-2">
                      <ReactJson src={catalog.openapi as Record<string, unknown>} name={false} collapsed={2} displayDataTypes={false} enableClipboard={false} theme="ocean" />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        ) : null}
      </div>
    </div>
  )
}
