import { index, uniqueIndex } from 'drizzle-orm/pg-core'
import { boolean, jsonb, pgTable, timestamp, varchar } from 'drizzle-orm/pg-core'
import { createdAt, deletedAt, id, updatedAt } from './_common'
import { lifecycleStatusEnum, orgMembershipRoleEnum } from './enums'

/**
 * users
 *
 * Canonical identity table for the platform.
 *
 * This table is shared by:
 * - Better Auth (authentication + admin lifecycle)
 * - Booking/business domain models (profile + operations metadata)
 */
export const users = pgTable('users', {
  id: id,

  /** Login/contact identity inside tenant context. */
  email: varchar('email', { length: 255 }).notNull(),

  /** Optional local hash if credential auth is ever partially local. */
  passwordHash: varchar('password_hash', { length: 255 }),

  firstName: varchar('first_name', { length: 100 }),
  lastName: varchar('last_name', { length: 100 }),

  /** Denormalized full name for faster read models/search. */
  name: varchar('name', { length: 255 }).default('').notNull(),

  phone: varchar('phone', { length: 50 }),

  /** Coarse default role; fine-grained access is in `org_memberships`. */
  role: orgMembershipRoleEnum('role').default('staff').notNull(),

  /** Active/inactive archive control for user availability. */
  status: lifecycleStatusEnum('status').default('active').notNull(),

  avatarUrl: varchar('avatar_url', { length: 500 }),

  /** Low-risk per-user UI/experience controls. */
  settings: jsonb('settings').default({}),

  /** Timezone/notification preferences used by booking comms. */
  preferences: jsonb('preferences').default({}),

  /** Extensible profile payload for future workflows. */
  metadata: jsonb('metadata').default({}),

  /** Mirrors auth state to support local business rules. */
  emailVerified: boolean('email_verified').default(false).notNull(),
  emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),

  /** Better Auth admin plugin ban controls. */
  banned: boolean('banned').default(false).notNull(),
  banReason: varchar('ban_reason', { length: 500 }),
  banExpires: timestamp('ban_expires', { withTimezone: true }),

  createdAt: createdAt,
  updatedAt: updatedAt,
  deletedAt: deletedAt,
}, (table) => ({
  /** Auth identity must be globally unique for Better Auth account resolution. */
  usersEmailUnique: uniqueIndex('users_email_unique').on(table.email),
  usersStatusIdx: index('users_status_idx').on(table.status),
}))

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
