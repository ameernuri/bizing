import { pgTable, uuid, varchar, text, timestamp, decimal } from 'drizzle-orm/pg-core'
import { id, createdAt, updatedAt } from './_common'
import { organizations } from './organizations'

export const products = pgTable('products', {
  id: id,
  orgId: uuid('org_id').references(() => organizations.id).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull(),
  description: text('description'),
  price: decimal('price', { precision: 10, scale: 2 }).notNull(),
  currency: varchar('currency', { length: 3 }).default('USD'),
  type: varchar('type', { length: 50 }).default('digital'),
  status: varchar('status', { length: 20 }).default('draft'),
  downloadUrl: varchar('download_url', { length: 500 }),
  createdAt: createdAt,
  updatedAt: updatedAt,
})

export type Product = typeof products.$inferSelect
export type NewProduct = typeof products.$inferInsert
