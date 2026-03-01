/**
 * Group account routes.
 *
 * ELI5:
 * A group account is one shared container for people who act together.
 *
 * Examples:
 * - a parent managing bookings for a child,
 * - a family sharing credits or memberships,
 * - a company contact booking for employees.
 *
 * Why this exists:
 * - the schema already had `group_accounts` and `group_account_members`
 * - the API needed a clean surface so real UIs, plugins, and sagas can use
 *   those rows directly instead of hiding the relationship inside loose JSON
 * - guardian/minor and household scenarios become much easier to prove when
 *   the relationship is explicit and queryable
 */

import { Hono } from 'hono'
import { and, asc, eq } from 'drizzle-orm'
import { z } from 'zod'
import dbPackage from '@bizing/db'
import { requireAclPermission, requireAuth, requireBizAccess } from '../middleware/auth.js'
import { fail, ok } from './_api.js'
import { sanitizePlainText, sanitizeUnknown } from '../lib/sanitize.js'

const { db, groupAccounts, groupAccountMembers, users } = dbPackage

const groupAccountTypes = ['family', 'company', 'group'] as const
const lifecycleStatuses = ['draft', 'active', 'inactive', 'archived'] as const
const memberRoles = ['primary', 'adult', 'minor', 'dependent', 'employee'] as const

const createGroupAccountBodySchema = z.object({
  name: z.string().min(1).max(255),
  type: z.enum(groupAccountTypes).default('family'),
  primaryContactUserId: z.string().min(1).optional().nullable(),
  profile: z.record(z.unknown()).optional(),
  status: z.enum(lifecycleStatuses).default('active'),
  settings: z.record(z.unknown()).optional(),
})

const patchGroupAccountBodySchema = createGroupAccountBodySchema.partial()

const createGroupAccountMemberBodySchema = z.object({
  userId: z.string().min(1),
  role: z.enum(memberRoles).default('adult'),
  relationship: z.string().max(50).optional().nullable(),
  permissions: z.record(z.unknown()).optional(),
  managedBy: z.array(z.string().min(1)).optional(),
  dateOfBirth: z.string().date().optional().nullable(),
  status: z.enum(lifecycleStatuses).default('active'),
})

export const groupAccountRoutes = new Hono()

groupAccountRoutes.get(
  '/bizes/:bizId/group-accounts',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('group_accounts.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const rows = await db.query.groupAccounts.findMany({
      where: eq(groupAccounts.bizId, bizId),
      orderBy: [asc(groupAccounts.type), asc(groupAccounts.name)],
    })
    return ok(c, rows)
  },
)

groupAccountRoutes.post(
  '/bizes/:bizId/group-accounts',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('group_accounts.write', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = createGroupAccountBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())

    const [created] = await db.insert(groupAccounts).values({
      bizId,
      name: sanitizePlainText(parsed.data.name),
      type: parsed.data.type,
      primaryContactUserId: parsed.data.primaryContactUserId ?? null,
      profile: sanitizeUnknown(parsed.data.profile ?? {}),
      status: parsed.data.status,
      settings: sanitizeUnknown(parsed.data.settings ?? {}),
    }).returning()

    return ok(c, created, 201)
  },
)

groupAccountRoutes.patch(
  '/bizes/:bizId/group-accounts/:groupAccountId',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('group_accounts.write', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, groupAccountId } = c.req.param()
    const parsed = patchGroupAccountBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())

    const [updated] = await db.update(groupAccounts).set({
      name: parsed.data.name !== undefined ? sanitizePlainText(parsed.data.name) : undefined,
      type: parsed.data.type,
      primaryContactUserId: parsed.data.primaryContactUserId === undefined ? undefined : parsed.data.primaryContactUserId ?? null,
      profile: parsed.data.profile === undefined ? undefined : sanitizeUnknown(parsed.data.profile),
      status: parsed.data.status,
      settings: parsed.data.settings === undefined ? undefined : sanitizeUnknown(parsed.data.settings),
    }).where(and(eq(groupAccounts.bizId, bizId), eq(groupAccounts.id, groupAccountId))).returning()

    if (!updated) return fail(c, 'NOT_FOUND', 'Group account not found.', 404)
    return ok(c, updated)
  },
)

groupAccountRoutes.get(
  '/bizes/:bizId/group-accounts/:groupAccountId/members',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('group_accounts.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, groupAccountId } = c.req.param()
    const rows = await db.query.groupAccountMembers.findMany({
      where: and(eq(groupAccountMembers.bizId, bizId), eq(groupAccountMembers.groupAccountId, groupAccountId)),
      orderBy: [asc(groupAccountMembers.role), asc(groupAccountMembers.joinedAt)],
    })
    return ok(c, rows)
  },
)

groupAccountRoutes.post(
  '/bizes/:bizId/group-accounts/:groupAccountId/members',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('group_accounts.write', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, groupAccountId } = c.req.param()
    const parsed = createGroupAccountMemberBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())

    const user = await db.query.users.findFirst({
      where: eq(users.id, parsed.data.userId),
      columns: { id: true },
    })
    if (!user) return fail(c, 'NOT_FOUND', 'User not found.', 404)

    const [created] = await db.insert(groupAccountMembers).values({
      bizId,
      groupAccountId,
      userId: parsed.data.userId,
      role: parsed.data.role,
      relationship: parsed.data.relationship ? sanitizePlainText(parsed.data.relationship) : null,
      permissions: sanitizeUnknown(parsed.data.permissions ?? {}),
      managedBy: sanitizeUnknown(parsed.data.managedBy ?? []),
      dateOfBirth: parsed.data.dateOfBirth ?? null,
      status: parsed.data.status,
    }).returning()

    return ok(c, created, 201)
  },
)
