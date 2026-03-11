import type { Context } from 'hono'
import { and, eq } from 'drizzle-orm'
import dbPackage from '@bizing/db'
import { getCurrentUser, getSession, type CurrentUser } from '../middleware/auth.js'
import { fail } from './_api.js'

const { db, bizes, members } = dbPackage

type PublicBizVisibility = 'published' | 'unpublished' | 'private'

type PublicBizRow = {
  id: string
  name: string
  status: string
  visibility: PublicBizVisibility
  timezone: string
  currency: string
  metadata: unknown
}

export type PublicBizAccessContext = {
  biz: PublicBizRow
  access: 'public' | 'member'
  user: CurrentUser | null
}

async function resolveSessionUser(c: Context): Promise<CurrentUser | null> {
  const current = getCurrentUser(c)
  if (current?.id) return current

  const session = await getSession(c)
  if (!session?.user || !session?.session) return null

  return {
    id: String(session.user.id),
    email: session.user.email,
    role: (session.user as { role?: string | null }).role ?? null,
  }
}

/**
 * Enforces customer-facing biz visibility policy in one place.
 *
 * - `published`: available on public surfaces.
 * - `unpublished`: hidden from public surfaces.
 * - `private`: invite-only; requires authenticated member (or platform admin).
 */
export async function requirePublicBizAccess(
  c: Context,
  bizId: string,
): Promise<PublicBizAccessContext | Response> {
  const biz = await db.query.bizes.findFirst({
    where: eq(bizes.id, bizId),
    columns: {
      id: true,
      name: true,
      status: true,
      visibility: true,
      timezone: true,
      currency: true,
      metadata: true,
    },
  })

  if (!biz || biz.status !== 'active') {
    return fail(c, 'NOT_FOUND', 'Business not found.', 404)
  }

  if (biz.visibility === 'published') {
    return { biz, access: 'public', user: null }
  }

  if (biz.visibility === 'unpublished') {
    return fail(c, 'NOT_FOUND', 'Business not found.', 404)
  }

  const user = await resolveSessionUser(c)
  if (!user?.id) {
    return fail(c, 'PRIVATE_BIZ_LOGIN_REQUIRED', 'Sign in to access this private business.', 401)
  }

  if (user.role === 'admin' || user.role === 'owner') {
    return { biz, access: 'member', user }
  }

  const membership = await db.query.members.findFirst({
    where: and(eq(members.organizationId, bizId), eq(members.userId, user.id)),
    columns: { id: true },
  })
  if (!membership) {
    return fail(c, 'PRIVATE_BIZ_INVITE_REQUIRED', 'This business is invite-only.', 403)
  }

  return { biz, access: 'member', user }
}
