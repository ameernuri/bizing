import { pgTable, uuid, varchar, text, timestamp, boolean, integer, decimal } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { id, createdAt, updatedAt } from './_common'
import { organizations } from './organizations'

export const services = pgTable('services', {
  id: id,
  orgId: uuid('org_id').references(() => organizations.id).notNull(),
  categoryId: uuid('category_id'),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull(),
  description: text('description'),
  durationMinutes: integer('duration_minutes').default(60),
  price: decimal('price', { precision: 10, scale: 2 }).default(sql`0`),
  currency: varchar('currency', { length: 3 }).default('USD'),
  isActive: boolean('is_active').default(true),
  isOnlineBookable: boolean('is_online_bookable').default(true),
  createdAt: createdAt,
  updatedAt: updatedAt,
})

export type Service = typeof services.$inferSelect
export type NewService = typeof services.$inferInsert
