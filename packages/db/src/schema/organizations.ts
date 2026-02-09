import { pgTable, uuid, varchar, text, timestamp, boolean, jsonb } from 'drizzle-orm/pg-core'
import { id, createdAt, updatedAt } from './_common'

export const organizations = pgTable('organizations', {
  id: id,
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 100 }).unique().notNull(),
  logoUrl: varchar('logo_url', { length: 500 }),
  timezone: varchar('timezone', { length: 50 }).default('UTC'),
  currency: varchar('currency', { length: 3 }).default('USD'),
  status: varchar('status', { length: 20 }).default('active'),
  settings: jsonb('settings').default({}),
  createdAt: createdAt,
  updatedAt: updatedAt,
})

export type Organization = typeof organizations.$inferSelect
export type NewOrganization = typeof organizations.$inferInsert
