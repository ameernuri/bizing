import { z } from 'zod'

export const CANVASCII_DEFAULTS = {
  appPort: 9101,
  collabPort: 3131,
  collabHealthPort: 3132,
  minioApiPort: 9010,
  minioConsolePort: 9011,
  s3Bucket: 'canvascii-dev',
  localSnapshotDir: './.canvascii-collab-data',
} as const

export const canvasciiPrincipalSchema = z.object({
  userId: z.string(),
  email: z.string().nullable().optional(),
  name: z.string().nullable().optional(),
  role: z.string().nullable().optional(),
  source: z.enum(['better-auth', 'dev-bypass']),
})

export type CanvasciiPrincipal = z.infer<typeof canvasciiPrincipalSchema>

export const canvasciiHealthSchema = z.object({
  status: z.enum(['ok']),
  service: z.literal('canvascii-collab'),
  authMode: z.enum(['better-auth', 'better-auth-with-dev-bypass']),
  documentsPersisted: z.number().int().nonnegative(),
  lastPersistedAt: z.string().nullable(),
  localSnapshotDir: z.string(),
  s3Enabled: z.boolean(),
  s3Bucket: z.string().nullable(),
})

export type CanvasciiCollabHealth = z.infer<typeof canvasciiHealthSchema>

export function toCanvasciiStorageBasename(documentName: string): string {
  return encodeURIComponent(documentName).replace(/%/g, '_')
}

export function toCanvasciiSnapshotObjectKey(documentName: string): string {
  return `documents/${toCanvasciiStorageBasename(documentName)}.bin`
}
