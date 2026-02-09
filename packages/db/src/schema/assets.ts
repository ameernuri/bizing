import { pgTable, uuid, varchar, text, integer, jsonb } from 'drizzle-orm/pg-core'
import { id, createdAt, updatedAt } from './_common'
import { organizations } from './organizations'
import { assetCategories } from './asset_categories'

export const assets = pgTable('assets', {
  id: id,
  orgId: uuid('org_id').references(() => organizations.id).notNull(),
  categoryId: uuid('category_id').references(() => assetCategories.id),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull(),
  description: text('description'),
  status: varchar('status', { length: 20 }).default('active'),
  capacity: integer('capacity'),
  location: text('location'),
  calendarId: varchar('calendar_id', { length: 100 }),
  metadata: jsonb('metadata').default({}),
  createdAt: createdAt,
  updatedAt: updatedAt,
})

export type Asset = typeof assets.$inferSelect
export type NewAsset = typeof assets.$inferInsert
