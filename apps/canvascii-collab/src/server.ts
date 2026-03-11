import { canvasciiHealthSchema } from '@bizing/canvascii-core'
import { Server } from '@hocuspocus/server'
import { createServer } from 'node:http'
import * as Y from 'yjs'
import { collabConfig } from './config'
import { resolvePrincipalFromHeaders } from './auth/resolve-principal'
import { CanvasciiDocumentStore } from './persistence/document-store'

const documentStore = new CanvasciiDocumentStore()
const pendingWrites = new Map<string, ReturnType<typeof setTimeout>>()

function schedulePersist(documentName: string, document: Y.Doc): void {
  const existing = pendingWrites.get(documentName)
  if (existing) clearTimeout(existing)

  const timeout = setTimeout(() => {
    pendingWrites.delete(documentName)
    void documentStore.store(documentName, Y.encodeStateAsUpdate(document))
  }, 750)

  pendingWrites.set(documentName, timeout)
}

async function start(): Promise<void> {
  await documentStore.ensureReady()

  const collabServer = Server.configure({
    port: collabConfig.port,
    async onAuthenticate(data) {
      const principal = await resolvePrincipalFromHeaders(data.requestHeaders ?? {})
      return {
        principal,
      }
    },
    async onLoadDocument(data) {
      const update = await documentStore.load(data.documentName)
      if (update && update.byteLength > 0) {
        Y.applyUpdate(data.document, update)
      }
    },
    async onChange(data) {
      schedulePersist(data.documentName, data.document)
    },
    async onDisconnect(data) {
      await documentStore.store(data.documentName, Y.encodeStateAsUpdate(data.document))
    },
  })

  await collabServer.listen()

  const healthServer = createServer((request, response) => {
    if (!request.url?.startsWith('/health')) {
      response.statusCode = 404
      response.end('Not found')
      return
    }

    const summary = documentStore.getHealthSummary()
    const payload = canvasciiHealthSchema.parse({
      status: 'ok',
      service: 'canvascii-collab',
      authMode: collabConfig.allowDevAuthBypass ? 'better-auth-with-dev-bypass' : 'better-auth',
      documentsPersisted: summary.documentsPersisted,
      lastPersistedAt: summary.lastPersistedAt,
      localSnapshotDir: summary.localSnapshotDir,
      s3Enabled: summary.s3Enabled,
      s3Bucket: summary.s3Bucket,
    })

    response.setHeader('content-type', 'application/json')
    response.end(JSON.stringify(payload, null, 2))
  })

  healthServer.listen(collabConfig.healthPort, () => {
    console.log(
      `[canvascii-collab] ws=:${collabConfig.port} health=:${collabConfig.healthPort} auth=${collabConfig.allowDevAuthBypass ? 'better-auth+dev-bypass' : 'better-auth'}`,
    )
  })
}

void start().catch((error) => {
  console.error('[canvascii-collab] failed to start', error)
  process.exitCode = 1
})
