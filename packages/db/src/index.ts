// Common utilities
export * from './schema/_common'

// Schema exports
export * from './schema/organizations'
export * from './schema/users'
export * from './schema/services'
export * from './schema/bookings'
export * from './schema/products'

// Note: Database connection utilities to be added
// when connecting to PostgreSQL. For now, schema is exported
// for use with drizzle-kit and migrations.
