import { foreignKey, index, uniqueIndex } from 'drizzle-orm/pg-core'
import { date, jsonb, pgTable, timestamp, varchar } from 'drizzle-orm/pg-core'
import { id, idRef, withAuditRefs } from './_common'
import { sharedAccountMemberRoleEnum, sharedAccountTypeEnum, lifecycleStatusEnum } from './enums'
import { bizes } from './bizes'
import { users } from './users'

/**
 * group_accounts
 *
 * Shared-account container used in two directions:
 * - customer side: family/group booking permissions and shared packages
 * - host side: company host staff pool and dispatch context
 *
 * Relationship map:
 * - Referenced by `booking_orders.group_account_id` for shared/group bookings.
 * - Referenced by `host_groups.group_account_id` for dispatch teams.
 * - Referenced by package/membership ownership tables for shared entitlements.
 */
export const groupAccounts = pgTable('group_accounts', {
  id,
  /** Tenant boundary for group account ownership/filtering. */
  bizId: idRef('biz_id').references(() => bizes.id).notNull(),

  /** Human-facing group account name. */
  name: varchar('name', { length: 255 }).notNull(),
  /** Group account semantic mode (family/company/group). */
  type: sharedAccountTypeEnum('type').default('family').notNull(),

  /** Primary contact anchor for notifications/escalations. */
  primaryContactUserId: idRef('primary_contact_user_id').references(() => users.id),

  /**
   * Optional structured profile payload for account-type-specific fields.
   * Example: family preferences, company legal/contact metadata, or group notes.
   */
  profile: jsonb('profile').default({}),

  /** Active/inactive status for eligibility in booking and billing workflows. */
  status: lifecycleStatusEnum('status').default('active').notNull(),

  /** Group-account-level notification and delegation defaults. */
  settings: jsonb('settings').default({}),

  /** Full audit timestamps + actor references. */
  ...withAuditRefs(() => users.id),
}, (table) => ({
  /** Composite key used by tenant-safe foreign keys from child tables. */
  groupAccountsBizIdIdUnique: uniqueIndex('group_accounts_biz_id_id_unique').on(
    table.bizId,
    table.id,
  ),
  groupAccountsOrgStatusIdx: index('group_accounts_org_status_idx').on(table.bizId, table.status),
  groupAccountsOrgNameIdx: index('group_accounts_org_name_idx').on(table.bizId, table.name),
}))

/**
 * group_account_members
 *
 * Membership + delegation model for group account actions.
 *
 * Key behavior:
 * - `permissions` controls who can book/edit on behalf of others.
 * - `managed_by` stores manager user ids for dependent/minor profiles.
 */
export const groupAccountMembers = pgTable('group_account_members', {
  id,
  /** Tenant boundary for membership records. */
  bizId: idRef('biz_id').references(() => bizes.id).notNull(),
  /** Parent group account this membership belongs to. */
  groupAccountId: idRef('group_account_id').references(() => groupAccounts.id).notNull(),
  /** User identity represented by this member row. */
  userId: idRef('user_id').references(() => users.id).notNull(),

  /** Role shapes booking delegation and visibility defaults. */
  role: sharedAccountMemberRoleEnum('role').default('adult').notNull(),

  /** Human relationship label for UI/context (spouse, child, employee, etc.). */
  relationship: varchar('relationship', { length: 50 }),

  /** Fine-grained delegation and approval policy blob. */
  permissions: jsonb('permissions').default({}),

  /** Array of user ids who can manage this member's bookings/profile. */
  managedBy: jsonb('managed_by').default([]),

  /** Optional DOB for eligibility, guardian, and age-gated policies. */
  dateOfBirth: date('date_of_birth'),
  /** Lifecycle status for delegation/eligibility checks. */
  status: lifecycleStatusEnum('status').default('active').notNull(),
  /** Timestamp when the user joined this group account. */
  joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow().notNull(),

  /** Full audit timestamps + actor references. */
  ...withAuditRefs(() => users.id),
}, (table) => ({
  groupAccountMembersUnique: uniqueIndex('group_account_members_unique').on(table.bizId, table.groupAccountId, table.userId),
  groupAccountMembersOrgIdx: index('group_account_members_org_idx').on(table.bizId, table.groupAccountId),
  /** Enforces membership rows stay inside the same tenant as the group account. */
  groupAccountMembersBizGroupAccountFk: foreignKey({
    columns: [table.bizId, table.groupAccountId],
    foreignColumns: [groupAccounts.bizId, groupAccounts.id],
    name: 'group_account_members_biz_group_account_fk',
  }),
}))

export type GroupAccount = typeof groupAccounts.$inferSelect
export type NewGroupAccount = typeof groupAccounts.$inferInsert

export type GroupAccountMember = typeof groupAccountMembers.$inferSelect
export type NewGroupAccountMember = typeof groupAccountMembers.$inferInsert
