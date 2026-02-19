import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'

// Common utilities
export * from './schema/_common'
export * from './schema/enums'

// Schema exports
export * from './schema/bizes'
export * from './schema/users'
export * from './schema/locations'
export * from './schema/group_accounts'
export * from './schema/memberships'
export * from './schema/services'
export * from './schema/products'
export * from './schema/auth'
export * from './schema/assets'
export * from './schema/venues'
export * from './schema/bookables'
export * from './schema/scheduling'
export * from './schema/pricing'
export * from './schema/bookings'
export * from './schema/booking_flows'
export * from './schema/offerings'
export * from './schema/commerce'
export * from './schema/payments'
export * from './schema/stripe'
export * from './schema/operations'

import * as enumsSchema from './schema/enums'
import * as bizesSchema from './schema/bizes'
import * as usersSchema from './schema/users'
import * as locationsSchema from './schema/locations'
import * as groupAccountsSchema from './schema/group_accounts'
import * as membershipsSchema from './schema/memberships'
import * as servicesSchema from './schema/services'
import * as productsSchema from './schema/products'
import * as authSchema from './schema/auth'
import * as assetsSchema from './schema/assets'
import * as venuesSchema from './schema/venues'
import * as bookablesSchema from './schema/bookables'
import * as schedulingSchema from './schema/scheduling'
import * as pricingSchema from './schema/pricing'
import * as bookingsSchema from './schema/bookings'
import * as bookingFlowsSchema from './schema/booking_flows'
import * as offeringsSchema from './schema/offerings'
import * as commerceSchema from './schema/commerce'
import * as paymentsSchema from './schema/payments'
import * as stripeSchema from './schema/stripe'
import * as operationsSchema from './schema/operations'

const schema = {
  ...enumsSchema,
  ...bizesSchema,
  ...usersSchema,
  ...locationsSchema,
  ...groupAccountsSchema,
  ...membershipsSchema,
  ...servicesSchema,
  ...productsSchema,
  ...authSchema,
  ...assetsSchema,
  ...venuesSchema,
  ...bookablesSchema,
  ...schedulingSchema,
  ...pricingSchema,
  ...bookingsSchema,
  ...bookingFlowsSchema,
  ...offeringsSchema,
  ...commerceSchema,
  ...paymentsSchema,
  ...stripeSchema,
  ...operationsSchema,
}

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error('DATABASE_URL is required to initialize @bizing/db')
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
