import { index, uniqueIndex } from 'drizzle-orm/pg-core'
import { boolean, date, integer, jsonb, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'
import { createdAt, deletedAt, id, idRef, updatedAt } from './_common'
import { lifecycleStatusEnum, membershipSubscriptionStatusEnum, packageWalletStatusEnum, programEnrollmentStatusEnum } from './enums'
import { bookings } from './bookings'
import { groupAccounts } from './group_accounts'
import { locations } from './locations'
import { bizes } from './bizes'
import { services } from './services'
import { users } from './users'

/**
 * programs
 *
 * Multi-session curriculum product (enroll once, attend many sessions).
 *
 * Relationship map:
 * - `program_sessions.program_id` defines concrete sessions.
 * - `program_enrollments.program_id` tracks participants and progress.
 * - Sessions may optionally link to `bookings` for runtime execution.
 */
export const programs = pgTable('programs', {
  id: id,

  /** Tenant boundary for program catalog ownership. */
  bizId: idRef('biz_id').references(() => bizes.id).notNull(),

  /** Optional service/location anchors for operational reuse. */
  serviceId: idRef('service_id').references(() => services.id),
  locationId: idRef('location_id').references(() => locations.id),

  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 120 }).notNull(),
  description: varchar('description', { length: 2000 }),

  /** Completion expectations used in progress calculations. */
  totalSessions: integer('total_sessions').default(0).notNull(),
  attendanceThresholdPct: integer('attendance_threshold_pct').default(80).notNull(),
  requiresPrerequisites: boolean('requires_prerequisites').default(false).notNull(),

  policy: jsonb('policy').default({}),
  status: lifecycleStatusEnum('status').default('draft').notNull(),
  metadata: jsonb('metadata').default({}),

  createdAt: createdAt,
  updatedAt: updatedAt,
  deletedAt: deletedAt,
}, (table) => ({
  programsOrgSlugUnique: uniqueIndex('programs_org_slug_unique').on(table.bizId, table.slug),
  programsOrgStatusIdx: index('programs_org_status_idx').on(table.bizId, table.status),
}))

/** Program session definitions (may optionally map to booking rows). */
export const programSessions = pgTable('program_sessions', {
  id: id,
  bizId: idRef('biz_id').references(() => bizes.id).notNull(),

  /** Parent program definition this session belongs to. */
  programId: idRef('program_id').references(() => programs.id).notNull(),

  /** Optional runtime booking backing this scheduled session. */
  bookingId: idRef('booking_id').references(() => bookings.id),

  /** Natural ordering within a program journey. */
  sequenceNo: integer('sequence_no').notNull(),
  startTime: timestamp('start_time', { withTimezone: true }).notNull(),
  endTime: timestamp('end_time', { withTimezone: true }).notNull(),
  locationId: idRef('location_id').references(() => locations.id),
  status: lifecycleStatusEnum('status').default('active').notNull(),
  metadata: jsonb('metadata').default({}),
  createdAt: createdAt,
  updatedAt: updatedAt,
}, (table) => ({
  programSessionsUnique: uniqueIndex('program_sessions_unique').on(table.programId, table.sequenceNo),
  programSessionsOrgIdx: index('program_sessions_org_idx').on(table.bizId, table.programId),
}))

/**
 * program_enrollments
 *
 * Tracks learner progress and completion state.
 */
export const programEnrollments = pgTable('program_enrollments', {
  id: id,
  bizId: idRef('biz_id').references(() => bizes.id).notNull(),
  programId: idRef('program_id').references(() => programs.id).notNull(),

  /** One of user or group account is typically populated as enrollment owner. */
  userId: idRef('user_id').references(() => users.id),
  groupAccountId: idRef('group_account_id').references(() => groupAccounts.id),
  enrolledByUserId: idRef('enrolled_by_user_id').references(() => users.id),

  status: programEnrollmentStatusEnum('status').default('active').notNull(),
  attendanceCount: integer('attendance_count').default(0).notNull(),
  completionPct: integer('completion_pct').default(0).notNull(),

  /** Optional installment/deferred payment configuration snapshot. */
  paymentPlan: jsonb('payment_plan').default({}),

  enrolledAt: timestamp('enrolled_at', { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }),

  metadata: jsonb('metadata').default({}),

  createdAt: createdAt,
  updatedAt: updatedAt,
}, (table) => ({
  programEnrollmentsUnique: uniqueIndex('program_enrollments_unique').on(table.programId, table.userId, table.groupAccountId),
  programEnrollmentsOrgStatusIdx: index('program_enrollments_org_status_idx').on(table.bizId, table.status),
}))

/** Attendance ledger at the session level for each enrollment. */
export const programAttendance = pgTable('program_attendance', {
  id: id,
  bizId: idRef('biz_id').references(() => bizes.id).notNull(),

  /** Enrollment and session linkage for one attendance event. */
  enrollmentId: idRef('enrollment_id').references(() => programEnrollments.id).notNull(),
  programSessionId: idRef('program_session_id').references(() => programSessions.id).notNull(),
  present: boolean('present').default(false).notNull(),
  attendedAt: timestamp('attended_at', { withTimezone: true }),
  notes: varchar('notes', { length: 500 }),
  createdAt: createdAt,
}, (table) => ({
  programAttendanceUnique: uniqueIndex('program_attendance_unique').on(table.enrollmentId, table.programSessionId),
  programAttendanceOrgIdx: index('program_attendance_org_idx').on(table.bizId, table.programSessionId),
}))

/**
 * packages
 *
 * Prepaid entitlement bundles.
 *
 * Relationship map:
 * - `package_items` defines included service entitlements.
 * - `package_wallets` are purchased instances owned by user/group account.
 * - `package_ledger_entries` tracks immutable usage/refunds.
 */
export const packages = pgTable('packages', {
  id: id,
  bizId: idRef('biz_id').references(() => bizes.id).notNull(),
  locationId: idRef('location_id').references(() => locations.id),

  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 120 }).notNull(),
  description: varchar('description', { length: 2000 }),

  /** Up-front purchase amount for the package product. */
  priceAmount: integer('price_amount').default(0).notNull(),
  currency: varchar('currency', { length: 3 }).default('USD').notNull(),

  expiresAfterDays: integer('expires_after_days'),
  /** Shareability and transfer rules for group-account/business usage. */
  isTransferable: boolean('is_transferable').default(false).notNull(),
  isShareableWithinParty: boolean('is_shareable_within_party').default(false).notNull(),

  refundPolicy: jsonb('refund_policy').default({}),

  status: lifecycleStatusEnum('status').default('active').notNull(),
  metadata: jsonb('metadata').default({}),

  createdAt: createdAt,
  updatedAt: updatedAt,
  deletedAt: deletedAt,
}, (table) => ({
  packagesOrgSlugUnique: uniqueIndex('packages_org_slug_unique').on(table.bizId, table.slug),
  packagesOrgStatusIdx: index('packages_org_status_idx').on(table.bizId, table.status),
}))

/** Service entitlements included in a package product. */
export const packageItems = pgTable('package_items', {
  id: id,
  bizId: idRef('biz_id').references(() => bizes.id).notNull(),

  /** Parent package and included service definition. */
  packageId: idRef('package_id').references(() => packages.id).notNull(),
  serviceId: idRef('service_id').references(() => services.id).notNull(),

  /** Number of uses granted for this service in the package. */
  quantity: integer('quantity').notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
  createdAt: createdAt,
}, (table) => ({
  packageItemsUnique: uniqueIndex('package_items_unique').on(table.packageId, table.serviceId),
  packageItemsOrgIdx: index('package_items_org_idx').on(table.bizId, table.packageId),
}))

/**
 * package_wallets
 *
 * Purchased package instance owned by user or group account.
 *
 * Wallet balance is the authoritative source for remaining entitlement units.
 */
export const packageWallets = pgTable('package_wallets', {
  id: id,
  bizId: idRef('biz_id').references(() => bizes.id).notNull(),
  packageId: idRef('package_id').references(() => packages.id).notNull(),
  userId: idRef('user_id').references(() => users.id),
  groupAccountId: idRef('group_account_id').references(() => groupAccounts.id),
  purchasedByUserId: idRef('purchased_by_user_id').references(() => users.id),

  /** Purchased entitlement totals and current remaining balance. */
  totalUnits: integer('total_units').default(0).notNull(),
  remainingUnits: integer('remaining_units').default(0).notNull(),
  status: packageWalletStatusEnum('status').default('active').notNull(),

  purchasedAt: timestamp('purchased_at', { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),

  metadata: jsonb('metadata').default({}),

  createdAt: createdAt,
  updatedAt: updatedAt,
}, (table) => ({
  packageWalletsOrgOwnerIdx: index('package_wallets_org_owner_idx').on(table.bizId, table.userId, table.groupAccountId),
  packageWalletsStatusIdx: index('package_wallets_status_idx').on(table.status, table.expiresAt),
}))

/** Immutable usage/refund adjustment ledger for package wallets. */
export const packageLedgerEntries = pgTable('package_ledger_entries', {
  id: id,
  bizId: idRef('biz_id').references(() => bizes.id).notNull(),

  /** Wallet this adjustment belongs to. */
  walletId: idRef('wallet_id').references(() => packageWallets.id).notNull(),

  /** Optional operational links for why entitlement moved. */
  bookingId: idRef('booking_id').references(() => bookings.id),
  serviceId: idRef('service_id').references(() => services.id),
  entryType: varchar('entry_type', { length: 50 }).notNull(),
  unitsDelta: integer('units_delta').notNull(),
  reason: varchar('reason', { length: 500 }),
  metadata: jsonb('metadata').default({}),
  createdAt: createdAt,
}, (table) => ({
  packageLedgerOrgWalletIdx: index('package_ledger_org_wallet_idx').on(table.bizId, table.walletId, table.createdAt),
}))

/** Membership product definition (recurring allowance/benefits). */
export const memberships = pgTable('memberships', {
  id: id,
  bizId: idRef('biz_id').references(() => bizes.id).notNull(),
  locationId: idRef('location_id').references(() => locations.id),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 120 }).notNull(),
  description: varchar('description', { length: 2000 }),
  /** Recurring billing amount and currency for this plan. */
  priceAmount: integer('price_amount').default(0).notNull(),
  currency: varchar('currency', { length: 3 }).default('USD').notNull(),

  /** Monthly/yearly cadence and allowance semantics. */
  billingInterval: varchar('billing_interval', { length: 20 }).default('monthly').notNull(),
  allowanceMinutesPerCycle: integer('allowance_minutes_per_cycle'),
  rolloverEnabled: boolean('rollover_enabled').default(false).notNull(),
  benefits: jsonb('benefits').default({}),
  status: lifecycleStatusEnum('status').default('active').notNull(),
  metadata: jsonb('metadata').default({}),
  createdAt: createdAt,
  updatedAt: updatedAt,
  deletedAt: deletedAt,
}, (table) => ({
  membershipsOrgSlugUnique: uniqueIndex('memberships_org_slug_unique').on(table.bizId, table.slug),
  membershipsOrgStatusIdx: index('memberships_org_status_idx').on(table.bizId, table.status),
}))

/** Subscriber instances for membership products. */
export const membershipSubscriptions = pgTable('membership_subscriptions', {
  id: id,
  bizId: idRef('biz_id').references(() => bizes.id).notNull(),

  /** Linked membership plan and owner identity. */
  membershipId: idRef('membership_id').references(() => memberships.id).notNull(),
  userId: idRef('user_id').references(() => users.id),
  groupAccountId: idRef('group_account_id').references(() => groupAccounts.id),
  status: membershipSubscriptionStatusEnum('status').default('active').notNull(),
  /** Current billing cycle window; key for allowance reset logic. */
  currentPeriodStart: date('current_period_start').notNull(),
  currentPeriodEnd: date('current_period_end').notNull(),
  pausedAt: timestamp('paused_at', { withTimezone: true }),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
  metadata: jsonb('metadata').default({}),
  createdAt: createdAt,
  updatedAt: updatedAt,
}, (table) => ({
  membershipSubscriptionsOrgOwnerIdx: index('membership_subscriptions_org_owner_idx').on(table.bizId, table.userId, table.groupAccountId, table.status),
}))

/** Usage ledger for allowance-based memberships. */
export const membershipUsageEntries = pgTable('membership_usage_entries', {
  id: id,
  bizId: idRef('biz_id').references(() => bizes.id).notNull(),

  /** Subscription this usage debit belongs to. */
  subscriptionId: idRef('subscription_id').references(() => membershipSubscriptions.id).notNull(),

  /** Optional booking that consumed membership allowance. */
  bookingId: idRef('booking_id').references(() => bookings.id),
  minutesUsed: integer('minutes_used').default(0).notNull(),
  usageDate: date('usage_date').notNull(),
  metadata: jsonb('metadata').default({}),
  createdAt: createdAt,
}, (table) => ({
  membershipUsageOrgSubIdx: index('membership_usage_org_sub_idx').on(table.bizId, table.subscriptionId, table.usageDate),
}))

export type Program = typeof programs.$inferSelect
export type NewProgram = typeof programs.$inferInsert

export type ProgramSession = typeof programSessions.$inferSelect
export type NewProgramSession = typeof programSessions.$inferInsert

export type ProgramEnrollment = typeof programEnrollments.$inferSelect
export type NewProgramEnrollment = typeof programEnrollments.$inferInsert

export type ProgramAttendance = typeof programAttendance.$inferSelect
export type NewProgramAttendance = typeof programAttendance.$inferInsert

export type Package = typeof packages.$inferSelect
export type NewPackage = typeof packages.$inferInsert

export type PackageItem = typeof packageItems.$inferSelect
export type NewPackageItem = typeof packageItems.$inferInsert

export type PackageWallet = typeof packageWallets.$inferSelect
export type NewPackageWallet = typeof packageWallets.$inferInsert

export type PackageLedgerEntry = typeof packageLedgerEntries.$inferSelect
export type NewPackageLedgerEntry = typeof packageLedgerEntries.$inferInsert

export type Membership = typeof memberships.$inferSelect
export type NewMembership = typeof memberships.$inferInsert

export type MembershipSubscription = typeof membershipSubscriptions.$inferSelect
export type NewMembershipSubscription = typeof membershipSubscriptions.$inferInsert

export type MembershipUsageEntry = typeof membershipUsageEntries.$inferSelect
export type NewMembershipUsageEntry = typeof membershipUsageEntries.$inferInsert
