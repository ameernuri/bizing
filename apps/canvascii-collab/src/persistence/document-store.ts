import {
  CANVASCII_DEFAULTS,
  toCanvasciiSnapshotObjectKey,
  toCanvasciiStorageBasename,
} from '@bizing/canvascii-core'
import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { collabConfig } from '../config'

type PersistedSnapshotMeta = {
  documentName: string
  objectKey: string
  bytes: number
  storedAt: string
  storedToS3: boolean
}

export class CanvasciiDocumentStore {
  private readonly snapshotDir: string
  private readonly s3: S3Client | null
  private readonly bucket: string | null
  private documentsPersisted = 0
  private lastPersistedAt: string | null = null

  constructor() {
    this.snapshotDir = path.resolve(collabConfig.snapshotDir || CANVASCII_DEFAULTS.localSnapshotDir)
    this.bucket = collabConfig.s3?.bucket ?? null
    this.s3 = collabConfig.s3
      ? new S3Client({
          region: collabConfig.s3.region,
          endpoint: collabConfig.s3.endpoint,
          forcePathStyle: collabConfig.s3.forcePathStyle,
          credentials: {
            accessKeyId: collabConfig.s3.accessKeyId,
            secretAccessKey: collabConfig.s3.secretAccessKey,
          },
        })
      : null
  }

  async ensureReady(): Promise<void> {
    await mkdir(this.snapshotDir, { recursive: true })
  }

  getHealthSummary() {
    return {
      documentsPersisted: this.documentsPersisted,
      lastPersistedAt: this.lastPersistedAt,
      localSnapshotDir: this.snapshotDir,
      s3Enabled: Boolean(this.s3 && this.bucket),
      s3Bucket: this.bucket,
    }
  }

  private resolveSnapshotPath(documentName: string): string {
    return path.join(this.snapshotDir, `${toCanvasciiStorageBasename(documentName)}.bin`)
  }

  private resolveMetaPath(documentName: string): string {
    return path.join(this.snapshotDir, `${toCanvasciiStorageBasename(documentName)}.json`)
  }

  async load(documentName: string): Promise<Uint8Array | null> {
    await this.ensureReady()
    const localPath = this.resolveSnapshotPath(documentName)

    try {
      return new Uint8Array(await readFile(localPath))
    } catch {
      if (!this.s3 || !this.bucket) return null
    }

    try {
      await this.s3.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: toCanvasciiSnapshotObjectKey(documentName),
        }),
      )
      const response = await this.s3.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: toCanvasciiSnapshotObjectKey(documentName),
        }),
      )
      const bytes = await response.Body?.transformToByteArray?.()
      if (!bytes) return null
      await writeFile(localPath, Buffer.from(bytes))
      return new Uint8Array(bytes)
    } catch {
      return null
    }
  }

  async store(documentName: string, update: Uint8Array): Promise<void> {
    await this.ensureReady()

    const storedAt = new Date().toISOString()
    const objectKey = toCanvasciiSnapshotObjectKey(documentName)
    const localPath = this.resolveSnapshotPath(documentName)
    const metaPath = this.resolveMetaPath(documentName)

    await writeFile(localPath, Buffer.from(update))

    let storedToS3 = false
    if (this.s3 && this.bucket) {
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: objectKey,
          Body: Buffer.from(update),
          ContentType: 'application/octet-stream',
        }),
      )
      storedToS3 = true
    }

    const meta: PersistedSnapshotMeta = {
      documentName,
      objectKey,
      bytes: update.byteLength,
      storedAt,
      storedToS3,
    }
    await writeFile(metaPath, JSON.stringify(meta, null, 2))

    this.documentsPersisted += 1
    this.lastPersistedAt = storedAt
  }
}
