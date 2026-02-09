import { pgTable, uuid, varchar } from 'drizzle-orm/pg-core'
import { id, createdAt } from './_common'
import { assets } from './assets'

export const assetTags = pgTable('asset_tags', {
  id: id,
  assetId: uuid('asset_id').references(() => assets.id).notNull(),
  name: varchar('name', { length: 50 }).notNull(),
  createdAt: createdAt,
})

export type AssetTag = typeof assetTags.$inferSelect
export type NewAssetTag = typeof assetTags.$inferInsert
