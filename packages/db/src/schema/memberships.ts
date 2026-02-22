import { foreignKey, index, uniqueIndex } from 'drizzle-orm/pg-core'
import { jsonb, pgTable, timestamp, varchar } from 'drizzle-orm/pg-core'
import { createdAt, deletedAt, id, idRef, updatedAt } from './_common'
import { lifecycleStatusEnum, orgMembershipRoleEnum } from './enums'
import { locations } from './locations'
import { bizes } from './bizes'
import { users } from './users'

/**
 * org_memberships
 *
 * Authorization membership records for users in tenant orgs.
 *
 * Better Auth relation:
 * - `better_auth_member_id` links to Better Auth membership identity.
 *
 * Why this exists in booking DB:
 * - Booking APIs need local role/scope joins without depending on auth schema.
 */
export const orgMemberships = pgTable('org_memberships', {
  id: id,
  bizId: idRef('biz_id').references(() => bizes.id).notNull(),
  userId: idRef('user_id').references(() => users.id).notNull(),

  role: orgMembershipRoleEnum('role').default('staff').notNull(),
  status: lifecycleStatusEnum('status').default('active').notNull(),

  betterAuthMemberId: varchar('better_auth_member_id', { length: 255 }),

  /** Optional JSON allow-list of location ids for this member. */
  locationScope: jsonb('location_scope').default([]),

  /** Additional claims not represented by role enum. */
  permissions: jsonb('permissions').default({}),

  invitedByUserId: idRef('invited_by_user_id').references(() => users.id),
  joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow().notNull(),
  metadata: jsonb('metadata').default({}),

  createdAt: createdAt,
  updatedAt: updatedAt,
  deletedAt: deletedAt,
}, (table) => ({
    orgMembershipsBizIdIdUnique: uniqueIndex("org_memberships_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
  orgMembershipsUnique: uniqueIndex('org_memberships_unique').on(table.bizId, table.userId),
  orgMembershipsBetterAuthUnique: uniqueIndex('org_memberships_better_auth_unique').on(table.bizId, table.betterAuthMemberId),
  orgMembershipsOrgRoleIdx: index('org_memberships_org_role_idx').on(table.bizId, table.role),
  orgMembershipsOrgStatusIdx: index('org_memberships_org_status_idx').on(table.bizId, table.status),
}))

/**
 * org_membership_locations
 *
 * Normalized location scope for members when JSON scope is insufficient.
 * Useful for explicit joins and policy checks in SQL.
 */
export const orgMembershipLocations = pgTable('org_membership_locations', {
  id: id,
  bizId: idRef('biz_id').references(() => bizes.id).notNull(),
  membershipId: idRef('membership_id').references(() => orgMemberships.id).notNull(),
  locationId: idRef('location_id').references(() => locations.id).notNull(),
  createdAt: createdAt,
}, (table) => ({
    orgMembershipLocationsBizIdIdUnique: uniqueIndex("org_membership_locations_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
  orgMembershipLocationsUnique: uniqueIndex('org_membership_locations_unique').on(table.membershipId, table.locationId),
  orgMembershipLocationsOrgIdx: index('org_membership_locations_org_idx').on(table.bizId, table.locationId),
  orgMembershipLocationsBizMembershipFk: foreignKey({
    columns: [table.bizId, table.membershipId],
    foreignColumns: [orgMemberships.bizId, orgMemberships.id],
    name: 'org_membership_locations_biz_membership_fk',
  }),
  orgMembershipLocationsBizLocationFk: foreignKey({
    columns: [table.bizId, table.locationId],
    foreignColumns: [locations.bizId, locations.id],
    name: 'org_membership_locations_biz_location_fk',
  }),
}))

export type OrgMembership = typeof orgMemberships.$inferSelect
export type NewOrgMembership = typeof orgMemberships.$inferInsert

export type OrgMembershipLocation = typeof orgMembershipLocations.$inferSelect
export type NewOrgMembershipLocation = typeof orgMembershipLocations.$inferInsert
