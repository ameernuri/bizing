import { execSync } from 'node:child_process'
import { eq } from 'drizzle-orm'
import dbPackage from '@bizing/db'

const API_BASE = process.env.KNOWLEDGE_SYNC_API_BASE ?? 'http://localhost:6129'
const TRUSTED_ORIGIN = process.env.KNOWLEDGE_SYNC_ORIGIN ?? 'http://localhost:9000'
const REQUEST_TIMEOUT_MS = Number(process.env.KNOWLEDGE_SYNC_REQUEST_TIMEOUT_MS ?? 3_600_000)
const THREAD_ID = '019c6db1-b924-7930-9dc5-18cfb3b4e782'
const RAW_DIR = `/Users/ameer/projects/bizing/.tmp/knowledge-sync/thread-${THREAD_ID}/raw`
const NORM_DIR = `/Users/ameer/projects/bizing/.tmp/knowledge-sync/thread-${THREAD_ID}/normalized`
const MIND_DIR = '/Users/ameer/bizing/mind'

const { db, users } = dbPackage as any

type SourceRow = {
  id: string
  sourceKey: string
  displayName: string
  sourceType: string
  basePath: string | null
  status: string
}

function pickSessionCookie(setCookieHeader: string | null): string {
  if (!setCookieHeader) {
    throw new Error('Missing Set-Cookie header from auth response.')
  }
  const matches = setCookieHeader.match(/(?:^|,\s*)([a-z0-9-]+\.session_token=[^;]+)/gi) ?? []
  const picked =
    matches.find((entry) => entry.includes('bizing-auth.session_token=')) ??
    matches.find((entry) => entry.includes('better-auth.session_token=')) ??
    matches[0]
  if (!picked) throw new Error('Could not extract *.session_token cookie from Set-Cookie.')
  return picked.trim()
}

async function createAdminSession() {
  const email = `knowledge-sync-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`
  const password = `SyncPass!${Date.now()}${Math.random().toString(36).slice(2, 6)}`

  const signUp = await fetch(`${API_BASE}/api/auth/sign-up/email`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: TRUSTED_ORIGIN,
    },
    body: JSON.stringify({
      email,
      password,
      name: 'Knowledge Sync Runner',
    }),
  })

  const signUpText = await signUp.text()
  let signUpPayload: any = null
  try {
    signUpPayload = JSON.parse(signUpText)
  } catch {
    signUpPayload = signUpText
  }

  if (signUp.status !== 200) {
    throw new Error(`Sign-up failed (${signUp.status}): ${JSON.stringify(signUpPayload)}`)
  }

  const cookie = pickSessionCookie(signUp.headers.get('set-cookie'))
  await db.update(users).set({ role: 'admin' }).where(eq(users.email, email))

  return { email, password, cookie }
}

async function api<T>(cookie: string, method: string, path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      cookie,
      origin: TRUSTED_ORIGIN,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })

  const text = await response.text()
  let payload: any = null
  try {
    payload = JSON.parse(text)
  } catch {
    payload = { raw: text }
  }

  if (!response.ok || payload?.success === false) {
    throw new Error(`API ${method} ${path} failed (${response.status}): ${JSON.stringify(payload)}`)
  }

  return payload.data as T
}

async function listAllSources(cookie: string): Promise<SourceRow[]> {
  const rows: SourceRow[] = []
  let page = 1
  while (true) {
    const pageRows = await api<SourceRow[]>(cookie, 'GET', `/api/v1/knowledge/sources?page=${page}&perPage=200`)
    rows.push(...pageRows)
    if (pageRows.length < 200) break
    page += 1
  }
  return rows
}

async function upsertSource(
  cookie: string,
  input: {
    sourceKey: string
    displayName: string
    sourceType: 'mind' | 'chat' | 'other' | 'docs' | 'git' | 'ooda' | 'saga_run' | 'api_contract' | 'decision_log'
    basePath: string
    metadata?: Record<string, unknown>
  },
): Promise<SourceRow> {
  const existing = (await listAllSources(cookie)).find((row) => row.sourceKey === input.sourceKey)
  if (existing) {
    return await api<SourceRow>(cookie, 'PATCH', `/api/v1/knowledge/sources/${encodeURIComponent(existing.id)}`, {
      displayName: input.displayName,
      sourceType: input.sourceType,
      basePath: input.basePath,
      status: 'active',
      metadata: {
        ...(input.metadata ?? {}),
        syncUpdatedAt: new Date().toISOString(),
      },
    })
  }

  return await api<SourceRow>(cookie, 'POST', '/api/v1/knowledge/sources', {
    sourceKey: input.sourceKey,
    displayName: input.displayName,
    sourceType: input.sourceType,
    basePath: input.basePath,
    status: 'active',
    metadata: {
      ...(input.metadata ?? {}),
      syncCreatedAt: new Date().toISOString(),
    },
  })
}

async function ingestSource(
  cookie: string,
  sourceId: string,
  body: {
    rootPath: string
    includeHidden: boolean
    maxFiles: number
    maxFileBytes: number
    autoChunk: boolean
    autoEmbed: boolean
    chunkMaxChars?: number
    chunkOverlapChars?: number
    extensions?: string[]
  },
) {
  return await api<any>(cookie, 'POST', `/api/v1/knowledge/sources/${encodeURIComponent(sourceId)}/ingest-files`, body)
}

async function main() {
  const auth = await createAdminSession()
  const gitSha = execSync('git -C /Users/ameer/projects/bizing rev-parse HEAD').toString().trim()

  const rawSource = await upsertSource(auth.cookie, {
    sourceKey: `codex-thread-${THREAD_ID}-raw`,
    displayName: `Codex Thread ${THREAD_ID} (Raw Parts)`,
    sourceType: 'chat',
    basePath: RAW_DIR,
    metadata: {
      threadId: THREAD_ID,
      format: 'raw-jsonl-split',
      sourcePath: `/Users/ameer/.codex/sessions/2026/02/17/rollout-2026-02-17T14-21-29-${THREAD_ID}.jsonl`,
    },
  })

  const normalizedSource = await upsertSource(auth.cookie, {
    sourceKey: `codex-thread-${THREAD_ID}-normalized`,
    displayName: `Codex Thread ${THREAD_ID} (Normalized Transcript)`,
    sourceType: 'chat',
    basePath: NORM_DIR,
    metadata: {
      threadId: THREAD_ID,
      format: 'normalized-ndjson',
    },
  })

  const mindSource = await upsertSource(auth.cookie, {
    sourceKey: 'bizing-mind-workspace',
    displayName: 'Bizing Mind Workspace',
    sourceType: 'mind',
    basePath: MIND_DIR,
    metadata: {
      workspace: 'mind',
    },
  })

  const rawIngest = await ingestSource(auth.cookie, rawSource.id, {
    rootPath: RAW_DIR,
    extensions: ['jsonl'],
    includeHidden: false,
    maxFiles: 5000,
    maxFileBytes: 10_000_000,
    autoChunk: false,
    autoEmbed: false,
  })

  const normalizedIngest = await ingestSource(auth.cookie, normalizedSource.id, {
    rootPath: NORM_DIR,
    extensions: ['ndjson'],
    includeHidden: false,
    maxFiles: 5000,
    maxFileBytes: 10_000_000,
    autoChunk: true,
    autoEmbed: false,
    chunkMaxChars: 2400,
    chunkOverlapChars: 220,
  })

  const mindIngest = await ingestSource(auth.cookie, mindSource.id, {
    rootPath: MIND_DIR,
    includeHidden: false,
    maxFiles: 5000,
    maxFileBytes: 10_000_000,
    autoChunk: true,
    autoEmbed: false,
    chunkMaxChars: 2400,
    chunkOverlapChars: 220,
  })

  const syncStatus = await api<any>(auth.cookie, 'GET', '/api/v1/knowledge/sync-status')
  const stats = await api<any>(auth.cookie, 'GET', '/api/v1/knowledge/stats')
  const latestEventId = syncStatus?.latestEvent?.id ?? null

  if (latestEventId) {
    await api<any>(auth.cookie, 'PUT', '/api/v1/knowledge/checkpoints/codex/bizing-codex-desktop', {
      checkpointKey: 'global',
      lastKnowledgeEventId: latestEventId,
      lastCommitSha: gitSha,
      lastIngestedAt: new Date().toISOString(),
      status: 'healthy',
      metadata: {
        syncMode: 'thread+mind',
        threadId: THREAD_ID,
      },
    })

    await api<any>(auth.cookie, 'POST', '/api/v1/knowledge/agent-runs', {
      agentKind: 'codex',
      agentName: 'bizing-codex-desktop',
      runKey: `knowledge-sync-${Date.now()}`,
      objective: 'Sync recovered Codex thread and full Bizing mind workspace into shared knowledge plane.',
      inputSummary: `thread=${THREAD_ID}; roots=[${RAW_DIR}, ${NORM_DIR}, ${MIND_DIR}]`,
      outputSummary: 'Ingest completed for thread raw parts, thread normalized transcript, and mind workspace.',
      decisions: [
        { key: 'thread_raw_chunking', value: 'disabled' },
        { key: 'thread_normalized_chunking', value: 'enabled' },
        { key: 'mind_chunking', value: 'enabled' },
      ],
      unresolvedItems: [],
      knowledgeCursor: latestEventId,
      status: 'succeeded',
      endedAt: new Date().toISOString(),
      metadata: {
        threadId: THREAD_ID,
        gitSha,
      },
    })
  }

  const syncStatusAfter = await api<any>(auth.cookie, 'GET', '/api/v1/knowledge/sync-status')

  const result = {
    authEmail: auth.email,
    sources: {
      raw: { id: rawSource.id, key: rawSource.sourceKey },
      normalized: { id: normalizedSource.id, key: normalizedSource.sourceKey },
      mind: { id: mindSource.id, key: mindSource.sourceKey },
    },
    ingest: {
      raw: rawIngest,
      normalized: normalizedIngest,
      mind: mindIngest,
    },
    latestEventIdBeforeCheckpoint: latestEventId,
    stats,
    syncStatusAfter,
  }

  console.log(JSON.stringify(result, null, 2))
}

await main()
