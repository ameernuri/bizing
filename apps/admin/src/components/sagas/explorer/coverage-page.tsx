'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { BarChart3, Database, RefreshCw, Route, Search } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { sagaApi, type SagaCoverageDetail, type SchemaCoverageReport } from '@/lib/sagas-api'
import { LoadError, LoadingGrid, PageIntro } from './common'

type Verdict = 'full' | 'strong' | 'partial' | 'gap'

type CoverageEvidenceSchema = {
  verdict?: Verdict
  explanation?: string
  tables?: string[]
  connections?: string[]
}

type CoverageEvidenceApi = {
  verdict?: Verdict
  passRatePct?: number
  definitionsCount?: number
  latestRunsCount?: number
  passedLatestRuns?: number
  totalRunsCount?: number
  endpoints?: Array<{
    method: string
    normalizedPath: string
    path: string
    callCount: number
    latestStatus?: number | null
    statusBuckets?: {
      '2xx'?: number
      '3xx'?: number
      '4xx'?: number
      '5xx'?: number
      other?: number
    }
  }>
}

type EndpointCoverageAggregate = {
  signature: string
  method: string
  normalizedPath: string
  totalCalls: number
  total2xx: number
  total3xx: number
  total4xx: number
  total5xx: number
  totalOther: number
  ucTotal: number
  ucSupported: number
  ucMissed: number
  ucRows: Array<{
    ucRef: string
    ucTitle: string
    overallVerdict: string
    apiVerdict: string
    passRatePct: number
    latestRunsCount: number
  }>
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function verdictTone(value: string | null | undefined) {
  const verdict = (value ?? '').toLowerCase()
  if (verdict === 'full') return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
  if (verdict === 'strong') return 'border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300'
  if (verdict === 'partial') return 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300'
  return 'border-destructive/40 bg-destructive/10 text-destructive'
}

function scoreFromVerdict(value: string | null | undefined) {
  const verdict = (value ?? '').toLowerCase()
  if (verdict === 'full') return 4
  if (verdict === 'strong') return 3
  if (verdict === 'partial') return 2
  return 1
}

function parseSchemaEvidence(item: SagaCoverageDetail['items'][number]): CoverageEvidenceSchema {
  const root = asRecord(item.evidence)
  const schema = asRecord(root?.schema) ?? {}
  return {
    verdict:
      typeof schema.verdict === 'string'
        ? (schema.verdict.toLowerCase() as Verdict)
        : undefined,
    explanation:
      typeof schema.explanation === 'string' ? schema.explanation : item.explanation ?? undefined,
    tables: Array.isArray(schema.tables)
      ? schema.tables.filter((row): row is string => typeof row === 'string')
      : [],
    connections: Array.isArray(schema.connections)
      ? schema.connections.filter((row): row is string => typeof row === 'string')
      : [],
  }
}

function parseApiEvidence(item: SagaCoverageDetail['items'][number]): CoverageEvidenceApi {
  const root = asRecord(item.evidence)
  const api = asRecord(root?.api) ?? {}
  return {
    verdict:
      typeof api.verdict === 'string' ? (api.verdict.toLowerCase() as Verdict) : undefined,
    passRatePct:
      typeof api.passRatePct === 'number' ? api.passRatePct : undefined,
    definitionsCount:
      typeof api.definitionsCount === 'number' ? api.definitionsCount : undefined,
    latestRunsCount:
      typeof api.latestRunsCount === 'number' ? api.latestRunsCount : undefined,
    passedLatestRuns:
      typeof api.passedLatestRuns === 'number' ? api.passedLatestRuns : undefined,
    totalRunsCount:
      typeof api.totalRunsCount === 'number' ? api.totalRunsCount : undefined,
    endpoints: Array.isArray(api.endpoints)
      ? api.endpoints
          .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === 'object')
          .map((row) => ({
            method: typeof row.method === 'string' ? row.method : 'GET',
            normalizedPath:
              typeof row.normalizedPath === 'string'
                ? row.normalizedPath
                : typeof row.path === 'string'
                  ? row.path
                  : '',
            path: typeof row.path === 'string' ? row.path : '',
            callCount: typeof row.callCount === 'number' ? row.callCount : 0,
            latestStatus:
              typeof row.latestStatus === 'number' ? row.latestStatus : null,
            statusBuckets: (() => {
              const buckets = asRecord(row.statusBuckets)
              if (!buckets) return undefined
              return {
                '2xx': typeof buckets['2xx'] === 'number' ? buckets['2xx'] : 0,
                '3xx': typeof buckets['3xx'] === 'number' ? buckets['3xx'] : 0,
                '4xx': typeof buckets['4xx'] === 'number' ? buckets['4xx'] : 0,
                '5xx': typeof buckets['5xx'] === 'number' ? buckets['5xx'] : 0,
                other: typeof buckets.other === 'number' ? buckets.other : 0,
              }
            })(),
          }))
      : [],
  }
}

export function SagaCoveragePage() {
  const searchParams = useSearchParams()
  const [reports, setReports] = useState<SchemaCoverageReport[]>([])
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null)
  const [detail, setDetail] = useState<SagaCoverageDetail | null>(null)
  const [query, setQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isRebuilding, setIsRebuilding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [endpointQuery, setEndpointQuery] = useState('')
  const [selectedEndpointSignature, setSelectedEndpointSignature] = useState<string | null>(null)

  async function load(initial = false) {
    if (initial) setIsLoading(true)
    setError(null)
    try {
      const nextReports = await sagaApi.fetchUcCoverageReports(25)
      setReports(nextReports)
      const reportId = selectedReportId ?? nextReports[0]?.id ?? null
      setSelectedReportId(reportId)
      if (reportId) {
        const nextDetail = await sagaApi.fetchUcCoverageReportDetail(reportId)
        setDetail(nextDetail)
      } else {
        setDetail(null)
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to load UC coverage.')
    } finally {
      if (initial) setIsLoading(false)
    }
  }

  useEffect(() => {
    void load(true)
  }, [])

  async function rebuildCoverage() {
    setIsRebuilding(true)
    setError(null)
    try {
      await sagaApi.rebuildUcCoverageReport({
        replaceExisting: true,
      })
      await load(false)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to rebuild UC coverage.')
    } finally {
      setIsRebuilding(false)
    }
  }

  async function openReport(reportId: string) {
    setSelectedReportId(reportId)
    setError(null)
    try {
      const nextDetail = await sagaApi.fetchUcCoverageReportDetail(reportId)
      setDetail(nextDetail)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to open selected coverage report.')
    }
  }

  const rows = useMemo(() => {
    const source = detail?.items ?? []
    const needle = query.trim().toLowerCase()
    const withEvidence = source.map((item) => {
      const schema = parseSchemaEvidence(item)
      const api = parseApiEvidence(item)
      return {
        item,
        schema,
        api,
      }
    })
    if (!needle) return withEvidence
    return withEvidence.filter(({ item, schema, api }) => {
      const tableText = (schema.tables ?? []).join(' ')
      const endpointText = (api.endpoints ?? [])
        .map((endpoint) => `${endpoint.method} ${endpoint.normalizedPath}`)
        .join(' ')
      return [
        item.itemRefKey,
        item.itemTitle ?? '',
        item.explanation ?? '',
        tableText,
        endpointText,
      ]
        .join(' ')
        .toLowerCase()
        .includes(needle)
    })
  }, [detail?.items, query])

  const selectedRow = useMemo(
    () => rows.find((row) => row.item.id === selectedItemId) ?? null,
    [rows, selectedItemId],
  )

  const endpointRows = useMemo(() => {
    const aggregate = new Map<string, EndpointCoverageAggregate>()
    for (const row of rows) {
      for (const endpoint of row.api.endpoints ?? []) {
        const signature = `${endpoint.method} ${endpoint.normalizedPath}`
        const existing = aggregate.get(signature)
        const entry = existing ?? {
          signature,
          method: endpoint.method,
          normalizedPath: endpoint.normalizedPath,
          totalCalls: 0,
          total2xx: 0,
          total3xx: 0,
          total4xx: 0,
          total5xx: 0,
          totalOther: 0,
          ucTotal: 0,
          ucSupported: 0,
          ucMissed: 0,
          ucRows: [],
        }
        entry.totalCalls += endpoint.callCount
        entry.total2xx += endpoint.statusBuckets?.['2xx'] ?? 0
        entry.total3xx += endpoint.statusBuckets?.['3xx'] ?? 0
        entry.total4xx += endpoint.statusBuckets?.['4xx'] ?? 0
        entry.total5xx += endpoint.statusBuckets?.['5xx'] ?? 0
        entry.totalOther += endpoint.statusBuckets?.other ?? 0
        const apiVerdict = row.api.verdict ?? 'gap'
        entry.ucRows.push({
          ucRef: row.item.itemRefKey,
          ucTitle: row.item.itemTitle ?? 'Untitled UC',
          overallVerdict: row.item.verdict,
          apiVerdict,
          passRatePct: row.api.passRatePct ?? 0,
          latestRunsCount: row.api.latestRunsCount ?? 0,
        })
        aggregate.set(signature, entry)
      }
    }

    const filtered = Array.from(aggregate.values())
      .map((entry) => {
        const uniqueUcRows = Array.from(
          new Map(
            entry.ucRows
              .sort((a, b) => a.ucRef.localeCompare(b.ucRef))
              .map((uc) => [uc.ucRef, uc]),
          ).values(),
        )
        const ucSupported = uniqueUcRows.filter((uc) => scoreFromVerdict(uc.apiVerdict) >= 3).length
        const ucMissed = uniqueUcRows.length - ucSupported
        return {
          ...entry,
          ucRows: uniqueUcRows,
          ucTotal: uniqueUcRows.length,
          ucSupported,
          ucMissed,
        }
      })
      .sort((a, b) => {
        if (b.ucTotal !== a.ucTotal) return b.ucTotal - a.ucTotal
        if (b.totalCalls !== a.totalCalls) return b.totalCalls - a.totalCalls
        return a.signature.localeCompare(b.signature)
      })

    const needle = endpointQuery.trim().toLowerCase()
    if (!needle) return filtered
    return filtered.filter((row) =>
      `${row.method} ${row.normalizedPath}`.toLowerCase().includes(needle),
    )
  }, [rows, endpointQuery])

  const selectedEndpoint = useMemo(
    () => endpointRows.find((row) => row.signature === selectedEndpointSignature) ?? null,
    [endpointRows, selectedEndpointSignature],
  )

  const summary = useMemo(() => {
    const counts = {
      total: rows.length,
      schemaStrongOrBetter: 0,
      apiStrongOrBetter: 0,
      overallStrongOrBetter: 0,
    }
    for (const row of rows) {
      if (scoreFromVerdict(row.schema.verdict) >= 3) counts.schemaStrongOrBetter += 1
      if (scoreFromVerdict(row.api.verdict) >= 3) counts.apiStrongOrBetter += 1
      if (scoreFromVerdict(row.item.verdict) >= 3) counts.overallStrongOrBetter += 1
    }
    return counts
  }, [rows])

  useEffect(() => {
    const ucRef = searchParams.get('uc')?.trim().toUpperCase()
    if (!ucRef || !rows.length) return
    const match = rows.find((row) => row.item.itemRefKey.toUpperCase() === ucRef)
    if (!match) return
    setQuery((prev) => (prev ? prev : ucRef))
    setSelectedItemId(match.item.id)
  }, [rows, searchParams])

  return (
    <div className="flex flex-1 flex-col">
      <PageIntro
        eyebrow="Coverage"
        title="UC Coverage Matrix"
        description="DB/API-native coverage matrix for all current use cases: schema support, API endpoint evidence, and combined verdict in one place."
        actions={
          <Button onClick={() => void rebuildCoverage()} disabled={isRebuilding} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${isRebuilding ? 'animate-spin' : ''}`} />
            {isRebuilding ? 'Rebuilding...' : 'Rebuild from DB + API'}
          </Button>
        }
      />
      <div className="flex-1 p-6 space-y-6">
        {error ? <LoadError message={error} onRetry={() => void load(true)} /> : null}

        {isLoading ? (
          <LoadingGrid count={6} />
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm text-muted-foreground">Current UCs</CardTitle>
                </CardHeader>
                <CardContent className="text-3xl font-semibold">{summary.total}</CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm text-muted-foreground">Schema strong+</CardTitle>
                </CardHeader>
                <CardContent className="text-3xl font-semibold">{summary.schemaStrongOrBetter}</CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm text-muted-foreground">API strong+</CardTitle>
                </CardHeader>
                <CardContent className="text-3xl font-semibold">{summary.apiStrongOrBetter}</CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm text-muted-foreground">Overall strong+</CardTitle>
                </CardHeader>
                <CardContent className="text-3xl font-semibold">{summary.overallStrongOrBetter}</CardContent>
              </Card>
            </div>

            <div className="grid gap-6 xl:grid-cols-[0.34fr_0.66fr]">
              <Card>
                <CardHeader>
                  <CardTitle>Coverage reports</CardTitle>
                  <CardDescription>Generated snapshots stored in DB.</CardDescription>
                </CardHeader>
                <CardContent>
                  {reports.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No UC coverage matrix exists yet. Rebuild to generate one.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {reports.map((report) => (
                        <button
                          key={report.id}
                          type="button"
                          onClick={() => void openReport(report.id)}
                          className={`w-full rounded-lg border p-3 text-left transition-colors ${
                            report.id === selectedReportId
                              ? 'border-primary bg-muted/40'
                              : 'hover:border-primary/40 hover:bg-muted/20'
                          }`}
                        >
                          <p className="text-sm font-medium">{report.title ?? report.id}</p>
                          <p className="text-xs text-muted-foreground">
                            {report.summary ?? 'No summary'}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Per-UC matrix</CardTitle>
                  <CardDescription>
                    Each row shows schema verdict, API verdict, and concrete table/endpoint evidence.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Search by UC, table, endpoint, or explanation"
                      className="pl-9"
                    />
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Use case</TableHead>
                        <TableHead>Overall</TableHead>
                        <TableHead>Schema</TableHead>
                        <TableHead>API</TableHead>
                        <TableHead>Tables</TableHead>
                        <TableHead>Endpoints</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map(({ item, schema, api }) => (
                        <TableRow
                          key={item.id}
                          className="cursor-pointer"
                          onClick={() => setSelectedItemId(item.id)}
                        >
                          <TableCell>
                            <Link
                              href={`/ooda/use-cases/${encodeURIComponent(item.itemRefKey)}`}
                              className="inline-block hover:underline"
                              onClick={(event) => event.stopPropagation()}
                            >
                              <p className="font-medium">{item.itemRefKey}</p>
                              <p className="text-xs text-muted-foreground line-clamp-1">
                                {item.itemTitle ?? 'Untitled UC'}
                              </p>
                            </Link>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={verdictTone(item.verdict)}>
                              {item.verdict}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={verdictTone(schema.verdict)}>
                              {schema.verdict ?? 'gap'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={verdictTone(api.verdict)}>
                              {api.verdict ?? 'gap'}
                            </Badge>
                          </TableCell>
                          <TableCell>{schema.tables?.length ?? 0}</TableCell>
                          <TableCell>{api.endpoints?.length ?? 0}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Endpoint coverage drill-down</CardTitle>
                <CardDescription>
                  Endpoint to UC map. Open any endpoint to see which use cases it currently supports or misses.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={endpointQuery}
                    onChange={(event) => setEndpointQuery(event.target.value)}
                    placeholder="Search endpoint by method or path"
                    className="pl-9"
                  />
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Endpoint</TableHead>
                      <TableHead>UCs</TableHead>
                      <TableHead>Supported</TableHead>
                      <TableHead>Missed</TableHead>
                      <TableHead>Calls</TableHead>
                      <TableHead>Status buckets</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {endpointRows.map((row) => (
                      <TableRow
                        key={row.signature}
                        className="cursor-pointer"
                        onClick={() => setSelectedEndpointSignature(row.signature)}
                      >
                        <TableCell className="font-mono text-xs">{row.signature}</TableCell>
                        <TableCell>{row.ucTotal}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={verdictTone('full')}>
                            {row.ucSupported}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={verdictTone(row.ucMissed > 0 ? 'gap' : 'strong')}>
                            {row.ucMissed}
                          </Badge>
                        </TableCell>
                        <TableCell>{row.totalCalls}</TableCell>
                        <TableCell className="text-xs">
                          2xx {row.total2xx} · 4xx {row.total4xx} · 5xx {row.total5xx}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <Dialog open={Boolean(selectedRow)} onOpenChange={(open) => (!open ? setSelectedItemId(null) : undefined)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              {selectedRow?.item.itemRefKey} · {selectedRow?.item.itemTitle ?? 'Coverage detail'}
            </DialogTitle>
          </DialogHeader>
          {selectedRow ? (
            <ScrollArea className="max-h-[70vh] pr-4">
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Database className="h-4 w-4" />
                      Schema support
                    </CardTitle>
                    <CardDescription>{selectedRow.schema.explanation ?? 'No schema explanation.'}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={verdictTone(selectedRow.schema.verdict)}>
                        {selectedRow.schema.verdict ?? 'gap'}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {selectedRow.schema.tables?.length ?? 0} tables • {selectedRow.schema.connections?.length ?? 0} inferred connections
                      </span>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Tables</p>
                      <div className="flex flex-wrap gap-2">
                        {(selectedRow.schema.tables ?? []).map((table) => (
                          <Badge key={table} variant="secondary">{table}</Badge>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Connections</p>
                      <div className="flex flex-wrap gap-2">
                        {(selectedRow.schema.connections ?? []).map((connection) => (
                          <Badge key={connection} variant="outline">{connection}</Badge>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Route className="h-4 w-4" />
                      API execution evidence
                    </CardTitle>
                    <CardDescription>
                      Latest saga runs linked to this UC and the endpoints they actually exercised.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className={verdictTone(selectedRow.api.verdict)}>
                        {selectedRow.api.verdict ?? 'gap'}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        pass rate {selectedRow.api.passRatePct ?? 0}% • latest runs {selectedRow.api.passedLatestRuns ?? 0}/{selectedRow.api.latestRunsCount ?? 0}
                      </span>
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Method</TableHead>
                          <TableHead>Path</TableHead>
                          <TableHead>Calls</TableHead>
                          <TableHead>Latest status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(selectedRow.api.endpoints ?? []).map((endpoint) => (
                          <TableRow key={`${endpoint.method}:${endpoint.normalizedPath}`}>
                            <TableCell>{endpoint.method}</TableCell>
                            <TableCell className="font-mono text-xs">{endpoint.normalizedPath}</TableCell>
                            <TableCell>{endpoint.callCount}</TableCell>
                            <TableCell>{endpoint.latestStatus ?? '-'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Overall verdict</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Badge variant="outline" className={verdictTone(selectedRow.item.verdict)}>
                      {selectedRow.item.verdict}
                    </Badge>
                  </CardContent>
                </Card>
              </div>
            </ScrollArea>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(selectedEndpoint)}
        onOpenChange={(open) => (!open ? setSelectedEndpointSignature(null) : undefined)}
      >
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>{selectedEndpoint?.signature ?? 'Endpoint detail'}</DialogTitle>
          </DialogHeader>
          {selectedEndpoint ? (
            <ScrollArea className="max-h-[70vh] pr-4">
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Endpoint health</CardTitle>
                    <CardDescription>
                      This endpoint appears in {selectedEndpoint.ucTotal} use cases.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-3 md:grid-cols-4">
                    <div className="rounded-md border p-3">
                      <p className="text-xs text-muted-foreground">Supported UCs</p>
                      <p className="text-2xl font-semibold">{selectedEndpoint.ucSupported}</p>
                    </div>
                    <div className="rounded-md border p-3">
                      <p className="text-xs text-muted-foreground">Missed UCs</p>
                      <p className="text-2xl font-semibold">{selectedEndpoint.ucMissed}</p>
                    </div>
                    <div className="rounded-md border p-3">
                      <p className="text-xs text-muted-foreground">Total calls</p>
                      <p className="text-2xl font-semibold">{selectedEndpoint.totalCalls}</p>
                    </div>
                    <div className="rounded-md border p-3">
                      <p className="text-xs text-muted-foreground">Status buckets</p>
                      <p className="text-sm">
                        2xx {selectedEndpoint.total2xx} · 3xx {selectedEndpoint.total3xx} · 4xx{' '}
                        {selectedEndpoint.total4xx} · 5xx {selectedEndpoint.total5xx}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">UC coverage for this endpoint</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Use case</TableHead>
                          <TableHead>Overall</TableHead>
                          <TableHead>API</TableHead>
                          <TableHead>Pass rate</TableHead>
                          <TableHead>Latest runs</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedEndpoint.ucRows.map((uc) => (
                          <TableRow key={uc.ucRef}>
                            <TableCell>
                              <Link
                                href={`/ooda/use-cases/${encodeURIComponent(uc.ucRef)}`}
                                className="inline-block hover:underline"
                              >
                                <p className="font-medium">{uc.ucRef}</p>
                                <p className="text-xs text-muted-foreground line-clamp-1">{uc.ucTitle}</p>
                              </Link>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={verdictTone(uc.overallVerdict)}>
                                {uc.overallVerdict}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={verdictTone(uc.apiVerdict)}>
                                {uc.apiVerdict}
                              </Badge>
                            </TableCell>
                            <TableCell>{uc.passRatePct}%</TableCell>
                            <TableCell>{uc.latestRunsCount}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>
            </ScrollArea>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
