import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { admin } from 'better-auth/plugins/admin'
import { organization } from 'better-auth/plugins/organization'
import dbPackage from '@bizing/db'

const { db, authSchema, bizes, users } = dbPackage

const trustedOrigins = (process.env.BETTER_AUTH_TRUSTED_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

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
  emailAndPassword: {
    enabled: true,
  },
  user: {
    modelName: 'users',
    fields: {
      image: 'avatarUrl',
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
