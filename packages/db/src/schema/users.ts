import { pgTable, uuid, varchar, timestamp, text, boolean, jsonb } from 'drizzle-orm/pg-core'
import { id, createdAt, updatedAt } from './_common'
import { organizations } from './organizations'

export const users = pgTable('users', {
  id: id,
  orgId: uuid('org_id').references(() => organizations.id).notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  passwordHash: varchar('password_hash', { length: 255 }),
  firstName: varchar('first_name', { length: 100 }),
  lastName: varchar('last_name', { length: 100 }),
  phone: varchar('phone', { length: 50 }),
  role: varchar('role', { length: 20 }).default('staff'),
  status: varchar('status', { length: 20 }).default('active'),
  avatarUrl: varchar('avatar_url', { length: 500 }),
  settings: jsonb('settings').default({}),
  emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
  createdAt: createdAt,
  updatedAt: updatedAt,
})

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
