import { sagaApi, type SagaCoverageDetail, type SchemaCoverageReport } from '@/lib/sagas-api'

export type UcCoverageEntry = {
  itemId: string
  ucKey: string
  title: string
  overallVerdict: string
  schemaVerdict: string
  apiVerdict: string
  apiPassRatePct: number
  apiLatestRunsCount: number
  tablesCount: number
  endpointsCount: number
}

export type UcCoverageSnapshot = {
  report: SchemaCoverageReport | null
  detail: SagaCoverageDetail | null
  byUc: Map<string, UcCoverageEntry>
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

export function parseUcCoverageEntry(item: SagaCoverageDetail['items'][number]): UcCoverageEntry {
  const root = asRecord(item.evidence)
  const schema = asRecord(root?.schema)
  const api = asRecord(root?.api)
  const tables = Array.isArray(schema?.tables)
    ? schema.tables.filter((row): row is string => typeof row === 'string')
    : []
  const endpoints = Array.isArray(api?.endpoints)
    ? api.endpoints.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === 'object')
    : []

  return {
    itemId: item.id,
    ucKey: item.itemRefKey,
    title: item.itemTitle ?? item.itemRefKey,
    overallVerdict: (item.verdict ?? 'gap').toLowerCase(),
    schemaVerdict:
      typeof schema?.verdict === 'string' ? schema.verdict.toLowerCase() : 'gap',
    apiVerdict:
      typeof api?.verdict === 'string' ? api.verdict.toLowerCase() : 'gap',
    apiPassRatePct:
      typeof api?.passRatePct === 'number' ? Math.round(api.passRatePct) : 0,
    apiLatestRunsCount:
      typeof api?.latestRunsCount === 'number' ? api.latestRunsCount : 0,
    tablesCount: tables.length,
    endpointsCount: endpoints.length,
  }
}

/**
 * Fetch latest UC coverage matrix snapshot for cross-page linking.
 *
 * ELI5:
 * - one latest matrix report
 * - one report detail payload
 * - one map keyed by UC key for fast lookups in list/detail pages
 */
export async function fetchLatestUcCoverageSnapshot(): Promise<UcCoverageSnapshot> {
  const reports = await sagaApi.fetchUcCoverageReports(1)
  const report = reports[0] ?? null
  if (!report) {
    return {
      report: null,
      detail: null,
      byUc: new Map<string, UcCoverageEntry>(),
    }
  }
  const detail = await sagaApi.fetchUcCoverageReportDetail(report.id)
  const byUc = new Map<string, UcCoverageEntry>()
  for (const item of detail.items) {
    if (item.itemType !== 'use_case') continue
    const parsed = parseUcCoverageEntry(item)
    byUc.set(parsed.ucKey.toUpperCase(), parsed)
  }
  return {
    report,
    detail,
    byUc,
  }
}

