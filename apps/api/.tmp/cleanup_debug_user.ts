import dbPackage from '@bizing/db'
import { eq } from 'drizzle-orm'

const { db, users, sessions, accounts, members, invitations, verifications } = dbPackage as any
const email = 'debug.22107@example.com'
const user = await db.query.users.findFirst({ where: eq(users.email, email) })
if (!user) {
  console.log('no debug user found')
  process.exit(0)
}
await db.delete(sessions).where(eq(sessions.userId, user.id))
await db.delete(accounts).where(eq(accounts.userId, user.id))
await db.delete(members).where(eq(members.userId, user.id))
await db.delete(invitations).where(eq(invitations.inviterId, user.id))
await db.delete(invitations).where(eq(invitations.email, email))
await db.delete(verifications).where(eq(verifications.identifier, email))
await db.delete(users).where(eq(users.id, user.id))
console.log('deleted debug user', user.id)
