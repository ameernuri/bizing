import { index, uniqueIndex } from 'drizzle-orm/pg-core'
import { boolean, date, integer, jsonb, pgTable, time, uuid, varchar } from 'drizzle-orm/pg-core'
import { createdAt, deletedAt, id, idRef, updatedAt } from './_common'
import { feeTriggerEnum, feeTypeEnum, lifecycleStatusEnum, pricingAdjustmentTypeEnum, pricingApplyAsEnum, pricingRuleTypeEnum } from './enums'
import { locations } from './locations'
import { bizes } from './bizes'
import { services } from './services'
import { users } from './users'

/**
 * pricing_rules
 *
 * Manual pricing engine with explicit precedence and condition scopes.
 *
 * Covers:
 * - day/time pricing
 * - holiday/date overrides
 * - manual fee-like surcharges/discounts
 */
export const pricingRules = pgTable('pricing_rules', {
  id: id,
  bizId: idRef('biz_id').references(() => bizes.id).notNull(),
  serviceId: idRef('service_id').references(() => services.id),
  locationId: idRef('location_id').references(() => locations.id),

  name: varchar('name', { length: 255 }).notNull(),
  description: varchar('description', { length: 500 }),

  /** Matching dimension (day/time/date/holiday/manual). */
  ruleType: pricingRuleTypeEnum('rule_type').notNull(),

  /** Classification of result for invoice and reporting semantics. */
  applyAs: pricingApplyAsEnum('apply_as').default('base_price').notNull(),

  /** How `amount` should be interpreted. */
  adjustmentType: pricingAdjustmentTypeEnum('adjustment_type').notNull(),

  /**
   * Minor-unit amount for deterministic arithmetic.
   * - set_price: absolute final value
   * - fixed_amount: +/- delta
   * - percentage: percent * 100 or raw percent by app contract
   */
  amount: integer('amount').default(0).notNull(),
  currency: varchar('currency', { length: 3 }).default('USD').notNull(),

  /** Optional temporal scopes; used according to ruleType. */
  dayOfWeek: integer('day_of_week'),
  startTime: time('start_time'),
  endTime: time('end_time'),
  startDate: date('start_date'),
  endDate: date('end_date'),

  /** Optional symbolic holiday key (e.g., US_THANKSGIVING). */
  holidayCode: varchar('holiday_code', { length: 100 }),

  /** Lower number means higher precedence in rule evaluation. */
  priority: integer('priority').default(100).notNull(),

  /** Whether this rule can stack with other matched rules. */
  isStackable: boolean('is_stackable').default(false).notNull(),
  maxApplications: integer('max_applications'),

  /** Additional runtime conditions (customer tier, channel, etc.). */
  conditions: jsonb('conditions').default({}),
  metadata: jsonb('metadata').default({}),

  status: lifecycleStatusEnum('status').default('active').notNull(),

  createdByUserId: idRef('created_by_user_id').references(() => users.id),

  createdAt: createdAt,
  updatedAt: updatedAt,
  deletedAt: deletedAt,
}, (table) => ({
  pricingRulesOrgServiceIdx: index('pricing_rules_org_service_idx').on(table.bizId, table.serviceId, table.status),
  pricingRulesOrgLocationIdx: index('pricing_rules_org_location_idx').on(table.bizId, table.locationId, table.priority),
  pricingRulesDateIdx: index('pricing_rules_date_idx').on(table.startDate, table.endDate),
}))

/**
 * fee_policies
 *
 * Declarative rules for booking fees.
 * This is where call fees, after-hours fees, on-site visit fees, etc. are defined.
 */
export const feePolicies = pgTable('fee_policies', {
  id: id,
  bizId: idRef('biz_id').references(() => bizes.id).notNull(),
  serviceId: idRef('service_id').references(() => services.id),
  locationId: idRef('location_id').references(() => locations.id),

  name: varchar('name', { length: 255 }).notNull(),
  feeType: feeTypeEnum('fee_type').notNull(),
  trigger: feeTriggerEnum('trigger').notNull(),

  amount: integer('amount').default(0).notNull(),
  currency: varchar('currency', { length: 3 }).default('USD').notNull(),

  /** Percent-based fee vs fixed amount. */
  isPercentage: boolean('is_percentage').default(false).notNull(),
  minAmount: integer('min_amount'),
  maxAmount: integer('max_amount'),

  /** If true, fee can be credited into final invoice total. */
  creditTowardInvoice: boolean('credit_toward_invoice').default(false).notNull(),

  /** Membership/exception waiver rules. */
  waiveRules: jsonb('waive_rules').default({}),

  /** Customer-facing disclosure text required for legal clarity. */
  disclosureText: varchar('disclosure_text', { length: 1000 }),

  conditions: jsonb('conditions').default({}),
  metadata: jsonb('metadata').default({}),
  status: lifecycleStatusEnum('status').default('active').notNull(),

  createdAt: createdAt,
  updatedAt: updatedAt,
  deletedAt: deletedAt,
}, (table) => ({
  feePoliciesOrgServiceIdx: index('fee_policies_org_service_idx').on(table.bizId, table.serviceId, table.status),
  feePoliciesTypeTriggerIdx: index('fee_policies_type_trigger_idx').on(table.feeType, table.trigger),
}))

/**
 * holiday_calendars
 *
 * Tenant/location holiday registry consumed by availability + pricing.
 */
export const holidayCalendars = pgTable('holiday_calendars', {
  id: id,
  bizId: idRef('biz_id').references(() => bizes.id).notNull(),
  locationId: idRef('location_id').references(() => locations.id),

  name: varchar('name', { length: 255 }).notNull(),
  holidayDate: date('holiday_date').notNull(),
  holidayCode: varchar('holiday_code', { length: 100 }),
  label: varchar('label', { length: 255 }).notNull(),

  /** Whether booking should be fully blocked for this date. */
  isClosed: boolean('is_closed').default(false).notNull(),

  metadata: jsonb('metadata').default({}),

  createdAt: createdAt,
  updatedAt: updatedAt,
}, (table) => ({
  holidayCalendarsUnique: uniqueIndex('holiday_calendars_unique').on(table.bizId, table.locationId, table.holidayDate, table.label),
  holidayCalendarsOrgDateIdx: index('holiday_calendars_org_date_idx').on(table.bizId, table.holidayDate),
}))

export type PricingRule = typeof pricingRules.$inferSelect
export type NewPricingRule = typeof pricingRules.$inferInsert

export type FeePolicy = typeof feePolicies.$inferSelect
export type NewFeePolicy = typeof feePolicies.$inferInsert

export type HolidayCalendar = typeof holidayCalendars.$inferSelect
export type NewHolidayCalendar = typeof holidayCalendars.$inferInsert
