import { index, uniqueIndex } from 'drizzle-orm/pg-core'
import { boolean, jsonb, pgTable, varchar } from 'drizzle-orm/pg-core'
import { createdAt, deletedAt, id, idRef, updatedAt } from './_common'
import { lifecycleStatusEnum, locationTypeEnum } from './enums'
import { bizes } from './bizes'

/**
 * locations
 *
 * Physical/virtual/mobile execution contexts under an biz.
 *
 * Relation notes:
 * - Services, offers, resources, and calendars can all scope to a location
 *   for per-branch behavior.
 */
export const locations = pgTable('locations', {
  id: id,
  bizId: idRef('biz_id').references(() => bizes.id).notNull(),

  name: varchar('name', { length: 255 }).notNull(),

  /** Stable path/key within an org. */
  slug: varchar('slug', { length: 120 }).notNull(),

  /** Determines which scheduling/presence fields are relevant. */
  type: locationTypeEnum('type').default('physical').notNull(),

  timezone: varchar('timezone', { length: 50 }).default('UTC').notNull(),

  /** Structured address payload (country, lat/lng, etc.) when applicable. */
  address: jsonb('address').default({}),

  /** Weekly operating-hour blocks (UI-friendly JSON shape). */
  operatingHours: jsonb('operating_hours').default({}),

  /** Optional location-only override of org-level defaults. */
  configOverride: jsonb('config_override').default({}),

  /** Service radius / geofence data for mobile operations. */
  serviceArea: jsonb('service_area').default({}),

  status: lifecycleStatusEnum('status').default('active').notNull(),

  /** Exactly one location can be marked default in app logic. */
  isDefault: boolean('is_default').default(false).notNull(),

  metadata: jsonb('metadata').default({}),

  createdAt: createdAt,
  updatedAt: updatedAt,
  deletedAt: deletedAt,
}, (table) => ({
  locationsOrgIdUnique: uniqueIndex('locations_org_id_unique').on(table.bizId, table.id),
  locationsOrgSlugUnique: uniqueIndex('locations_org_slug_unique').on(table.bizId, table.slug),
  locationsOrgStatusIdx: index('locations_org_status_idx').on(table.bizId, table.status),
}))

export type Location = typeof locations.$inferSelect
export type NewLocation = typeof locations.$inferInsert
