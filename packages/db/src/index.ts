import { drizzle } from 'drizzle-orm/node-postgres'
import { config } from 'dotenv'
import { dirname, resolve } from 'node:path'
import { Pool } from 'pg'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dirname, '../../../.env') })

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

import * as organizationsSchema from './schema/organizations'
import * as usersSchema from './schema/users'
import * as servicesSchema from './schema/services'
import * as productsSchema from './schema/products'
import * as bookingsSchema from './schema/bookings'
import * as assetsSchema from './schema/assets'
import * as assetCategoriesSchema from './schema/asset_categories'
import * as assetTagsSchema from './schema/asset_tags'
import * as venuesSchema from './schema/venues'

const schema = {
  ...organizationsSchema,
  ...usersSchema,
  ...servicesSchema,
  ...productsSchema,
  ...bookingsSchema,
  ...assetsSchema,
  ...assetCategoriesSchema,
  ...assetTagsSchema,
  ...venuesSchema,
}

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error('DATABASE_URL is required to initialize @biz.ing/db')
}

export const pool = new Pool({ connectionString })
export const db = drizzle(pool, { schema })

export async function checkDatabaseConnection(): Promise<boolean> {
  const client = await pool.connect()
  try {
    await client.query('SELECT 1')
    return true
  } finally {
    client.release()
  }
}

const dbPackage = {
  db,
  pool,
  checkDatabaseConnection,
  bookings: bookingsSchema.bookings,
  services: servicesSchema.services,
  users: usersSchema.users,
}

export default dbPackage
