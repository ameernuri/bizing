import { pgTable, uuid, varchar, text, integer, jsonb } from 'drizzle-orm/pg-core'
import { id, createdAt, updatedAt } from './_common'
import { organizations } from './organizations'

export const assetCategories = pgTable('asset_categories', {
  id: id,
  orgId: uuid('org_id').references(() => organizations.id).notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull(),
  description: text('description'),
  createdAt: createdAt,
  updatedAt: updatedAt,
})

export type AssetCategory = typeof assetCategories.$inferSelect
export type NewAssetCategory = typeof assetCategories.$inferInsert
