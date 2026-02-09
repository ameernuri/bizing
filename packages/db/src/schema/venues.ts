import { pgTable, uuid, varchar, text, integer, jsonb } from 'drizzle-orm/pg-core'
import { id, createdAt, updatedAt } from './_common'
import { organizations } from './organizations'

export const venues = pgTable('venues', {
  id: id,
  orgId: uuid('org_id').references(() => organizations.id).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  address: text('address'),
  capacity: integer('capacity'),
  calendarId: varchar('calendar_id', { length: 100 }),
  amenities: jsonb('amenities').default([]),
  createdAt: createdAt,
  updatedAt: updatedAt,
})

export type Venue = typeof venues.$inferSelect
export type NewVenue = typeof venues.$inferInsert
