import dbPackage from '@bizing/db'
import { eq } from 'drizzle-orm'
const { db, users } = dbPackage as any
const email = process.argv[2]
if (!email) throw new Error('email arg required')
await db.update(users).set({ role: 'admin' }).where(eq(users.email, email))
console.log('updated role to admin for', email)
