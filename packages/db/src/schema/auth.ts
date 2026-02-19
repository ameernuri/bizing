import { index, pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { bizes } from './bizes'
import { users } from './users'

/**
 * Better Auth tables centralized in the DB package.
 *
 * Keep auth persistence in one place (`packages/db/src/schema`) so API/server
 * layers don't own schema definitions.
 */

export const sessions = pgTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    expiresAt: timestamp('expires_at').notNull(),
    token: text('token').notNull().unique(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .$onUpdate(() => new Date())
      .notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    activeOrganizationId: text('active_organization_id'),
    impersonatedBy: text('impersonated_by'),
  },
  (table) => ({
    sessionsUserIdIdx: index('sessions_user_id_idx').on(table.userId),
  }),
)

export const accounts = pgTable(
  'accounts',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at'),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
    scope: text('scope'),
    password: text('password'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => ({
    accountsUserIdIdx: index('accounts_user_id_idx').on(table.userId),
  }),
)

export const verifications = pgTable(
  'verifications',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => ({
    verificationsIdentifierIdx: index('verifications_identifier_idx').on(table.identifier),
  }),
)

export const members = pgTable(
  'members',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => bizes.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: text('role').default('member').notNull(),
    createdAt: timestamp('created_at').notNull(),
  },
  (table) => ({
    membersOrganizationIdIdx: index('members_organization_id_idx').on(table.organizationId),
    membersUserIdIdx: index('members_user_id_idx').on(table.userId),
  }),
)

export const invitations = pgTable(
  'invitations',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => bizes.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    role: text('role'),
    status: text('status').default('pending').notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    inviterId: text('inviter_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
  },
  (table) => ({
    invitationsOrganizationIdIdx: index('invitations_organization_id_idx').on(table.organizationId),
    invitationsEmailIdx: index('invitations_email_idx').on(table.email),
  }),
)

/**
 * Convenience schema object for Better Auth drizzle adapter usage:
 * `schema: { ...authSchema, users, bizes }`
 */
export const authSchema = {
  sessions,
  accounts,
  verifications,
  members,
  invitations,
}

/** @deprecated Use `authSchema`. */
export const betterAuthSchema = authSchema
