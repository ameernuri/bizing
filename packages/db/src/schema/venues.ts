import { index, pgTable, uniqueIndex, varchar, integer, text, boolean, jsonb } from 'drizzle-orm/pg-core'
import { id, idRef, withAuditRefs } from './_common'
import { lifecycleStatusEnum } from './enums'
import { locations } from './locations'
import { bizes } from './bizes'
import { users } from './users'

/**
 * venue_categories
 *
 * Lightweight taxonomy for venue classification.
 *
 * Relationship map:
 * - Referenced by `venues.category_id`.
 * - Enables category-based filtering/reporting without repeated labels.
 */
export const venueCategories = pgTable('venue_categories', {
  id,
  /** Tenant boundary so categories are private per biz. */
  bizId: idRef('biz_id').references(() => bizes.id).notNull(),
  /** Human-readable category name shown in admin/filters. */
  name: varchar('name', { length: 100 }).notNull(),
  /** Stable API/UI key for routes and integrations. */
  slug: varchar('slug', { length: 100 }).notNull(),
  /** Optional explanation/help text for admins. */
  description: text('description'),
  ...withAuditRefs(() => users.id),
})

/**
 * venue_status_definitions
 *
 * Configurable status dictionary for venues at biz/location scope.
 * This is the canonical status source for `venues.status_definition_id`.
 */
export const venueStatusDefinitions = pgTable(
  'venue_status_definitions',
  {
    id,
    bizId: idRef('biz_id').references(() => bizes.id).notNull(),
    /** Optional branch-level override; null means biz-wide definition. */
    locationId: idRef('location_id').references(() => locations.id),
    name: varchar('name', { length: 100 }).notNull(),
    slug: varchar('slug', { length: 100 }).notNull(),
    description: text('description'),
    /** If false, this status should normally be excluded from slot search. */
    isBookable: boolean('is_bookable').default(true).notNull(),
    isDefault: boolean('is_default').default(false).notNull(),
    sortOrder: integer('sort_order').default(100).notNull(),
    metadata: jsonb('metadata').default({}),
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    venueStatusDefinitionsBizLocationSlugUnique: uniqueIndex(
      'venue_status_definitions_biz_location_slug_unique',
    ).on(table.bizId, table.locationId, table.slug),
    venueStatusDefinitionsBizBookableIdx: index(
      'venue_status_definitions_biz_bookable_idx',
    ).on(table.bizId, table.isBookable),
  }),
)

/**
 * venues
 *
 * Bookable space inventory (rooms, halls, event spaces).
 *
 * Relationship map:
 * - `bookables.venue_id` projects venue rows into the polymorphic scheduler.
 * - `bookings.venue_id` enables direct simple booking assignment.
 * - `services.required_bookable_types` can require a venue assignment.
 * - `venue_tag_assignments` maps configurable tags to venues.
 * - `venue_amenity_assignments` maps configurable amenities to venues.
 */
export const venues = pgTable(
  'venues',
  {
    id,
    /** Tenant boundary for space inventory isolation. */
    bizId: idRef('biz_id').references(() => bizes.id).notNull(),
    /** Optional branch/facility this venue belongs to. */
    locationId: idRef('location_id').references(() => locations.id),
    /** Customer-facing venue name for slot selection screens. */
    name: varchar('name', { length: 255 }).notNull(),
    /** Stable per-org route key used by APIs and admin UIs. */
    slug: varchar('slug', { length: 100 }).notNull(),
    /** Human-readable address or in-building locator text. */
    address: text('address'),
    /** Max occupancy for compliance and booking capacity checks. */
    capacity: integer('capacity'),
    /** Optional taxonomy grouping for reporting/filtering. */
    categoryId: idRef('category_id').references(() => venueCategories.id),
    /** External/legacy calendar linkage where applicable. */
    calendarId: varchar('calendar_id', { length: 100 }),
    /** Whether concurrent bookings are allowed in this space. */
    allowSimultaneousBookings: boolean('allow_simultaneous_bookings').default(false).notNull(),
    /** Upper bound for concurrent reservations if overlap is enabled. */
    maxSimultaneousBookings: integer('max_simultaneous_bookings'),
    /** Prep/setup time before booking starts. */
    setupMinutes: integer('setup_minutes').default(0).notNull(),
    /** Turnover/cleanup time after booking ends. */
    teardownMinutes: integer('teardown_minutes').default(0).notNull(),
    /**
     * Configurable status FK. This is now the only canonical status linkage.
     * Null is allowed during migration/backfill windows.
     */
    statusDefinitionId: idRef('status_definition_id').references(
      () => venueStatusDefinitions.id,
    ),
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    venuesBizSlugUnique: uniqueIndex('venues_biz_slug_unique').on(table.bizId, table.slug),
    venuesBizStatusDefinitionIdx: index('venues_biz_status_definition_idx').on(
      table.bizId,
      table.statusDefinitionId,
    ),
  }),
)

/**
 * venue_tag_templates
 *
 * Biz/location-scoped, reusable venue tags defined during setup.
 */
export const venueTagTemplates = pgTable(
  'venue_tag_templates',
  {
    id,
    bizId: idRef('biz_id').references(() => bizes.id).notNull(),
    /** Optional branch-specific template; null means available biz-wide. */
    locationId: idRef('location_id').references(() => locations.id),
    name: varchar('name', { length: 100 }).notNull(),
    slug: varchar('slug', { length: 100 }).notNull(),
    description: varchar('description', { length: 500 }),
    status: lifecycleStatusEnum('status').default('active').notNull(),
    metadata: jsonb('metadata').default({}),
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    venueTagTemplatesBizLocationSlugUnique: uniqueIndex(
      'venue_tag_templates_biz_location_slug_unique',
    ).on(table.bizId, table.locationId, table.slug),
    venueTagTemplatesBizStatusIdx: index('venue_tag_templates_biz_status_idx').on(
      table.bizId,
      table.status,
    ),
  }),
)

/**
 * venue_tag_assignments
 *
 * Joins venues to predefined tag templates.
 */
export const venueTagAssignments = pgTable(
  'venue_tag_assignments',
  {
    id,
    bizId: idRef('biz_id').references(() => bizes.id).notNull(),
    venueId: idRef('venue_id').references(() => venues.id).notNull(),
    templateId: idRef('template_id').references(() => venueTagTemplates.id).notNull(),
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    venueTagAssignmentsUnique: uniqueIndex('venue_tag_assignments_unique').on(
      table.venueId,
      table.templateId,
    ),
    venueTagAssignmentsBizTemplateIdx: index('venue_tag_assignments_biz_template_idx').on(
      table.bizId,
      table.templateId,
    ),
    venueTagAssignmentsBizVenueIdx: index('venue_tag_assignments_biz_venue_idx').on(
      table.bizId,
      table.venueId,
    ),
  }),
)

/**
 * venue_amenity_templates
 *
 * Configurable amenity dictionary at biz/location scope.
 * Replaces freeform amenity arrays on `venues`.
 */
export const venueAmenityTemplates = pgTable(
  'venue_amenity_templates',
  {
    id,
    bizId: idRef('biz_id').references(() => bizes.id).notNull(),
    /** Optional branch-specific template; null means available biz-wide. */
    locationId: idRef('location_id').references(() => locations.id),
    name: varchar('name', { length: 120 }).notNull(),
    slug: varchar('slug', { length: 120 }).notNull(),
    description: varchar('description', { length: 600 }),
    status: lifecycleStatusEnum('status').default('active').notNull(),
    metadata: jsonb('metadata').default({}),
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    venueAmenityTemplatesBizLocationSlugUnique: uniqueIndex(
      'venue_amenity_templates_biz_location_slug_unique',
    ).on(table.bizId, table.locationId, table.slug),
    venueAmenityTemplatesBizStatusIdx: index(
      'venue_amenity_templates_biz_status_idx',
    ).on(table.bizId, table.status),
  }),
)

/**
 * venue_amenity_assignments
 *
 * Joins venues to configured amenity templates.
 */
export const venueAmenityAssignments = pgTable(
  'venue_amenity_assignments',
  {
    id,
    bizId: idRef('biz_id').references(() => bizes.id).notNull(),
    venueId: idRef('venue_id').references(() => venues.id).notNull(),
    templateId: idRef('template_id').references(() => venueAmenityTemplates.id).notNull(),
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    venueAmenityAssignmentsUnique: uniqueIndex('venue_amenity_assignments_unique').on(
      table.venueId,
      table.templateId,
    ),
    venueAmenityAssignmentsBizTemplateIdx: index(
      'venue_amenity_assignments_biz_template_idx',
    ).on(table.bizId, table.templateId),
    venueAmenityAssignmentsBizVenueIdx: index('venue_amenity_assignments_biz_venue_idx').on(
      table.bizId,
      table.venueId,
    ),
  }),
)

export type VenueStatusDefinition = typeof venueStatusDefinitions.$inferSelect
export type NewVenueStatusDefinition = typeof venueStatusDefinitions.$inferInsert

export type VenueCategory = typeof venueCategories.$inferSelect
export type NewVenueCategory = typeof venueCategories.$inferInsert

export type Venue = typeof venues.$inferSelect
export type NewVenue = typeof venues.$inferInsert

export type VenueTagTemplate = typeof venueTagTemplates.$inferSelect
export type NewVenueTagTemplate = typeof venueTagTemplates.$inferInsert

export type VenueTagAssignment = typeof venueTagAssignments.$inferSelect
export type NewVenueTagAssignment = typeof venueTagAssignments.$inferInsert

export type VenueAmenityTemplate = typeof venueAmenityTemplates.$inferSelect
export type NewVenueAmenityTemplate = typeof venueAmenityTemplates.$inferInsert

export type VenueAmenityAssignment = typeof venueAmenityAssignments.$inferSelect
export type NewVenueAmenityAssignment = typeof venueAmenityAssignments.$inferInsert
