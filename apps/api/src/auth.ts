import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { admin } from 'better-auth/plugins/admin'
import { organization } from 'better-auth/plugins/organization'
import dbPackage from '@bizing/db'

const { db, authSchema, bizes, users } = dbPackage

function normalizeOrigin(origin: string): string {
  return origin.trim().replace(/\/+$/, '')
}

/**
 * Better Auth validates request `Origin` for some state-changing endpoints
 * (for example sign-out).
 *
 * In local development, the admin client runs on `localhost:9000` while API
 * runs on `localhost:6129`. We include both by default so auth flows work
 * without requiring manual env edits each time.
 */
const trustedOrigins = Array.from(
  new Set(
    [
      ...(process.env.BETTER_AUTH_TRUSTED_ORIGINS || '').split(','),
      process.env.BETTER_AUTH_URL || '',
      process.env.BETTER_AUTH_BASE_URL || '',
      process.env.ADMIN_APP_ORIGIN || '',
      process.env.CANVASCII_APP_ORIGIN || '',
      'http://localhost:9000',
      'http://127.0.0.1:9000',
      'http://localhost:9101',
      'http://127.0.0.1:9101',
      'http://localhost:6129',
      'http://127.0.0.1:6129',
    ]
      .map((origin) => origin.trim())
      .filter(Boolean)
      .map(normalizeOrigin),
  ),
)

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      ...authSchema,
      bizes,
      users,
    },
  }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL || process.env.BETTER_AUTH_BASE_URL,
  basePath: '/api/auth',
  trustedOrigins,
  /**
   * ELI5:
   * Browsers scope cookies by domain/path, not by port.
   * That means `localhost:3000` and `localhost:9000` can collide if both apps
   * use Better Auth's default cookie names.
   *
   * We force a Bizing-specific cookie prefix so this API's session cookies do
   * not overwrite sessions from other local Better Auth apps.
   */
  advanced: {
    cookiePrefix: process.env.BETTER_AUTH_COOKIE_PREFIX || 'bizing-auth',
  },
  emailAndPassword: {
    enabled: true,
  },
  user: {
    modelName: 'users',
    fields: {
      image: 'avatarUrl',
    },
    additionalFields: {
      firstName: {
        type: 'string',
        required: false,
        fieldName: 'firstName',
      },
      lastName: {
        type: 'string',
        required: false,
        fieldName: 'lastName',
      },
    },
  },
  session: {
    modelName: 'sessions',
  },
  account: {
    modelName: 'accounts',
  },
  verification: {
    modelName: 'verifications',
  },
  plugins: [
    organization({
      schema: {
        organization: {
          modelName: 'bizes',
          fields: {
            logo: 'logoUrl',
            metadata: 'metadata',
          },
        },
        member: {
          modelName: 'members',
        },
        invitation: {
          modelName: 'invitations',
        },
      },
    }),
    admin(),
  ],
})

export type Auth = typeof auth
