import { CANVASCII_DEFAULTS } from '@bizing/canvascii-core'
import { config as loadDotEnv } from 'dotenv'
import { z } from 'zod'

loadDotEnv()

const envSchema = z.object({
  CANVASCII_COLLAB_PORT: z.coerce.number().int().positive().default(CANVASCII_DEFAULTS.collabPort),
  CANVASCII_COLLAB_HEALTH_PORT: z.coerce.number().int().positive().default(CANVASCII_DEFAULTS.collabHealthPort),
  CANVASCII_COLLAB_API_ORIGIN: z.string().url().default('http://localhost:6129'),
  CANVASCII_COLLAB_TRUSTED_ORIGINS: z
    .string()
    .default('http://localhost:9101,http://127.0.0.1:9101')
    .transform((value) =>
      value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  CANVASCII_COLLAB_SNAPSHOT_DIR: z.string().default(CANVASCII_DEFAULTS.localSnapshotDir),
  CANVASCII_COLLAB_S3_ENDPOINT: z.string().url().optional(),
  CANVASCII_COLLAB_S3_REGION: z.string().default('us-east-1'),
  CANVASCII_COLLAB_S3_BUCKET: z.string().optional(),
  CANVASCII_COLLAB_S3_ACCESS_KEY: z.string().optional(),
  CANVASCII_COLLAB_S3_SECRET_KEY: z.string().optional(),
  CANVASCII_COLLAB_S3_FORCE_PATH_STYLE: z
    .string()
    .optional()
    .transform((value) => value === 'true'),
  CANVASCII_COLLAB_ALLOW_DEV_AUTH_BYPASS: z
    .string()
    .optional()
    .transform((value) => value === 'true'),
  CANVASCII_COLLAB_DEV_BYPASS_USER_ID: z.string().default('canvascii-dev-user'),
})

const parsed = envSchema.parse(process.env)

export const collabConfig = {
  port: parsed.CANVASCII_COLLAB_PORT,
  healthPort: parsed.CANVASCII_COLLAB_HEALTH_PORT,
  apiOrigin: parsed.CANVASCII_COLLAB_API_ORIGIN.replace(/\/+$/, ''),
  trustedOrigins: parsed.CANVASCII_COLLAB_TRUSTED_ORIGINS,
  snapshotDir: parsed.CANVASCII_COLLAB_SNAPSHOT_DIR,
  s3: parsed.CANVASCII_COLLAB_S3_ENDPOINT &&
    parsed.CANVASCII_COLLAB_S3_BUCKET &&
    parsed.CANVASCII_COLLAB_S3_ACCESS_KEY &&
    parsed.CANVASCII_COLLAB_S3_SECRET_KEY
      ? {
          endpoint: parsed.CANVASCII_COLLAB_S3_ENDPOINT,
          region: parsed.CANVASCII_COLLAB_S3_REGION,
          bucket: parsed.CANVASCII_COLLAB_S3_BUCKET,
          accessKeyId: parsed.CANVASCII_COLLAB_S3_ACCESS_KEY,
          secretAccessKey: parsed.CANVASCII_COLLAB_S3_SECRET_KEY,
          forcePathStyle: parsed.CANVASCII_COLLAB_S3_FORCE_PATH_STYLE,
        }
      : null,
  allowDevAuthBypass: parsed.CANVASCII_COLLAB_ALLOW_DEV_AUTH_BYPASS,
  devBypassUserId: parsed.CANVASCII_COLLAB_DEV_BYPASS_USER_ID,
} as const
