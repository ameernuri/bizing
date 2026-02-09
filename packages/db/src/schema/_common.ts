import { uuid, timestamp } from 'drizzle-orm/pg-core'

// Common timestamp columns
export const createdAt = timestamp('created_at', { withTimezone: true })
export const updatedAt = timestamp('updated_at', { withTimezone: true })
export const deletedAt = timestamp('deleted_at', { withTimezone: true })

// Common id column
export const id = uuid('id').primaryKey().defaultRandom()
