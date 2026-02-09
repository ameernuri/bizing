// Common utilities
export * from './schema/_common'

// Schema exports
export * from './schema/organizations'
export * from './schema/users'
export * from './schema/services'
export * from './schema/products'
export * from './schema/bookings'
export * from './schema/assets'
export * from './schema/asset_categories'
export * from './schema/asset_tags'
export * from './schema/venues'

// Note: Database connection utilities to be added
// when connecting to PostgreSQL. For now, schema is exported
// for use with drizzle-kit and migrations.
