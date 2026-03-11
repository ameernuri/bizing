import { canvasciiHealthSchema, toCanvasciiSnapshotObjectKey } from '@bizing/canvascii-core'
import { ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3'
import { HocuspocusProvider, HocuspocusProviderWebsocket } from '@hocuspocus/provider'
import * as assert from 'node:assert/strict'
import { setTimeout as delay } from 'node:timers/promises'
import WebSocket from 'ws'
import * as Y from 'yjs'

const NodeWebSocketPolyfill = WebSocket as unknown as typeof globalThis.WebSocket

async function waitForProviderSync(provider: HocuspocusProvider): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timed out waiting for websocket sync.')), 10_000)
    provider.on('synced', () => {
      clearTimeout(timeout)
      resolve()
    })
    provider.on('disconnect', () => {
      clearTimeout(timeout)
      reject(new Error('Websocket disconnected before sync completed.'))
    })
  })
}

async function main(): Promise<void> {
  const wsUrl = process.env.CANVASCII_STACK_TEST_WS_URL || 'ws://127.0.0.1:3131'
  const healthUrl = process.env.CANVASCII_STACK_TEST_HEALTH_URL || 'http://127.0.0.1:3132/health'
  const s3Endpoint = process.env.CANVASCII_STACK_TEST_S3_ENDPOINT || 'http://127.0.0.1:9010'
  const s3Bucket = process.env.CANVASCII_STACK_TEST_S3_BUCKET || 'canvascii-dev'
  const s3AccessKeyId = process.env.CANVASCII_STACK_TEST_S3_ACCESS_KEY || 'minioadmin'
  const s3SecretAccessKey = process.env.CANVASCII_STACK_TEST_S3_SECRET_KEY || 'minioadmin'
  const room = `canvascii-smoke-${Date.now()}`

  const healthResponse = await fetch(healthUrl)
  assert.equal(healthResponse.ok, true, `Health endpoint failed with HTTP ${healthResponse.status}`)
  const healthPayload = canvasciiHealthSchema.parse(await healthResponse.json())
  assert.equal(healthPayload.status, 'ok')

  const docOne = new Y.Doc()
  const websocketOne = new HocuspocusProviderWebsocket({
    url: wsUrl,
    WebSocketPolyfill: NodeWebSocketPolyfill,
  })
  const providerOne = new HocuspocusProvider({
    name: room,
    document: docOne,
    websocketProvider: websocketOne,
    token: 'dev-bypass',
  })
  await waitForProviderSync(providerOne)
  docOne.getMap('meta').set('title', 'Canvascii smoke test')
  await delay(1500)
  providerOne.disconnect()
  websocketOne.disconnect()
  docOne.destroy()

  const docTwo = new Y.Doc()
  const websocketTwo = new HocuspocusProviderWebsocket({
    url: wsUrl,
    WebSocketPolyfill: NodeWebSocketPolyfill,
  })
  const providerTwo = new HocuspocusProvider({
    name: room,
    document: docTwo,
    websocketProvider: websocketTwo,
    token: 'dev-bypass',
  })
  await waitForProviderSync(providerTwo)
  assert.equal(docTwo.getMap('meta').get('title'), 'Canvascii smoke test')
  providerTwo.disconnect()
  websocketTwo.disconnect()
  docTwo.destroy()

  const s3Client = new S3Client({
    region: 'us-east-1',
    endpoint: s3Endpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId: s3AccessKeyId,
      secretAccessKey: s3SecretAccessKey,
    },
  })

  const listed = await s3Client.send(
    new ListObjectsV2Command({
      Bucket: s3Bucket,
      Prefix: toCanvasciiSnapshotObjectKey(room),
    }),
  )
  assert.ok((listed.Contents ?? []).length > 0, 'Expected MinIO backup object to exist after document sync.')

  console.log(`Canvascii stack smoke test passed for room ${room}.`)
}

void main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
