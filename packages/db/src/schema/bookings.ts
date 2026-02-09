import { pgTable, uuid, varchar, text, timestamp, decimal } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { id, createdAt, updatedAt } from './_common'
import { organizations } from './organizations'
import { services } from './services'
import { users } from './users'
import { assets } from './assets'
import { venues } from './venues'

export const bookings = pgTable('bookings', {
  id: id,
  orgId: uuid('org_id').references(() => organizations.id).notNull(),
  serviceId: uuid('service_id').references(() => services.id),
  assetId: uuid('asset_id').references(() => assets.id),
  venueId: uuid('venue_id').references(() => venues.id),
  customerId: uuid('customer_id').references(() => users.id),
  customerName: varchar('customer_name', { length: 255 }),
  customerEmail: varchar('customer_email', { length: 255 }),
  customerPhone: varchar('customer_phone', { length: 50 }),
  startTime: timestamp('start_time', { withTimezone: true }).notNull(),
  endTime: timestamp('end_time', { withTimezone: true }).notNull(),
  status: varchar('status', { length: 20 }).default('pending'),
  notes: text('notes'),
  price: decimal('price', { precision: 10, scale: 2 }).default(sql`0`),
  source: varchar('source', { length: 50 }).default('website'),
  confirmationCode: varchar('confirmation_code', { length: 20 }),
  createdAt: createdAt,
  updatedAt: updatedAt,
})

export type Booking = typeof bookings.$inferSelect
export type NewBooking = typeof bookings.$inferInsert
