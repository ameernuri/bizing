import { index, uniqueIndex } from "drizzle-orm/pg-core";
import {
  boolean,
  date,
  integer,
  jsonb,
  pgTable,
  time,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { createdAt, deletedAt, id, idRef, updatedAt } from "./_common";
import {
  availabilityRuleEffectEnum,
  availabilityRuleFrequencyEnum,
  availabilityRuleModeEnum,
  calendarStatusEnum,
  lifecycleStatusEnum,
} from "./enums";
import { bookables } from "./bookables";
import { locations } from "./locations";
import { bizes } from "./bizes";
import { services } from "./services";

/**
 * schedules
 *
 * Reusable schedule payload table. Any domain-specific schedule table can
 * reference this row instead of storing a duplicate JSON structure.
 */
export const schedules = pgTable(
  "schedules",
  {
    id,
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Human label for admin UX when multiple schedules exist. */
    name: varchar("name", { length: 255 }),

    /** Optional classifier (`maintenance`, `operating_hours`, `policy`, etc.). */
    kind: varchar("kind", { length: 50 }).default("generic").notNull(),

    /** Generic schedule document (intervals, rules, exclusions, checklist data). */
    config: jsonb("config").default({}).notNull(),

    status: lifecycleStatusEnum("status").default("active").notNull(),
    createdAt: createdAt,
    updatedAt: updatedAt,
    deletedAt: deletedAt,
  },
  (table) => ({
    schedulesBizKindIdx: index("schedules_biz_kind_idx").on(
      table.bizId,
      table.kind,
    ),
    schedulesBizStatusIdx: index("schedules_biz_status_idx").on(
      table.bizId,
      table.status,
    ),
  }),
);

/**
 * calendars
 *
 * Calendar container for either a bookable or location-level schedule.
 *
 * Typical flow:
 * - Recurring defaults in `availability_rules` (`mode=recurring`)
 * - Date overrides in `availability_rules` (`mode=date_range`)
 * - Hard blocks in `availability_rules` (`mode=timestamp_range`)
 */
export const calendars = pgTable(
  "calendars",
  {
    id: id,
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),
    bookableId: idRef("bookable_id").references(() => bookables.id),
    locationId: idRef("location_id").references(() => locations.id),

    name: varchar("name", { length: 255 }).notNull(),
    timezone: varchar("timezone", { length: 50 }).default("UTC").notNull(),

    /** Default slot model used by slot-finding APIs. */
    slotDurationMin: integer("slot_duration_min").default(30).notNull(),
    slotIntervalMin: integer("slot_interval_min").default(15).notNull(),

    /** Operational prep/cleanup buffers. */
    preBufferMin: integer("pre_buffer_min").default(0).notNull(),
    postBufferMin: integer("post_buffer_min").default(0).notNull(),

    /** Booking window controls (lead-time and horizon). */
    minAdvanceBookingHours: integer("min_advance_booking_hours")
      .default(0)
      .notNull(),
    maxAdvanceBookingDays: integer("max_advance_booking_days")
      .default(365)
      .notNull(),

    /** Supports staged visibility/cascading release use cases. */
    cascadingConfig: jsonb("cascading_config").default({}),
    metadata: jsonb("metadata").default({}),

    status: calendarStatusEnum("status").default("active").notNull(),

    createdAt: createdAt,
    updatedAt: updatedAt,
    deletedAt: deletedAt,
  },
  (table) => ({
    calendarsOrgNameUnique: uniqueIndex("calendars_org_name_unique").on(
      table.bizId,
      table.name,
    ),
    calendarsOrgStatusIdx: index("calendars_org_status_idx").on(
      table.bizId,
      table.status,
    ),
    calendarsBookableIdx: index("calendars_bookable_idx").on(table.bookableId),
  }),
);

/**
 * availability_rules
 *
 * Unified availability model that replaces:
 * - `weekly_rules`
 * - `availability_exceptions`
 * - `blocked_times`
 *
 * Design goals:
 * - One extensible rule table for simple and advanced scheduling APIs.
 * - Keep recurring, date-based, and exact timestamp windows in one model.
 * - Preserve service-scoped rules, special pricing context, and override flags.
 */
export const availabilityRules = pgTable(
  "availability_rules",
  {
    id: id,
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),
    calendarId: idRef("calendar_id")
      .references(() => calendars.id)
      .notNull(),
    serviceId: idRef("service_id").references(() => services.id),

    /**
     * Which time-selector columns are populated for this row.
     * - recurring: use `frequency` + `day*` + local `start_time/end_time`
     * - date_range: use `start_date/end_date` (+ optional local times)
     * - timestamp_range: use exact `start_at/end_at`
     */
    mode: availabilityRuleModeEnum("mode").default("recurring").notNull(),

    /**
     * Recurrence cadence. For non-recurring rules use `none`.
     * If cadence/day columns are not expressive enough, use `recurrenceRule`.
     */
    frequency: availabilityRuleFrequencyEnum("frequency")
      .default("weekly")
      .notNull(),
    /**
     * Advanced recurrence expression in iCalendar RRULE format.
     *
     * Purpose:
     * - Handles complex schedules not representable with `frequency` + day fields.
     * - Keeps the model flexible without adding many one-off columns.
     *
     * Examples:
     * - `FREQ=WEEKLY;BYDAY=MO,WE,FR`
     * - `FREQ=MONTHLY;BYDAY=2TU`
     */
    recurrenceRule: varchar("recurrence_rule", { length: 500 }),

    /** 0-6 convention when using weekly-style recurrence logic. */
    dayOfWeek: integer("day_of_week"),

    /** Optional month-day for monthly recurrence patterns (1-31). */
    dayOfMonth: integer("day_of_month"),

    /** Calendar-date boundaries for date range and recurring effective windows. */
    startDate: date("start_date"),
    endDate: date("end_date"),

    /** Local-time window; commonly used with recurring/date-range modes. */
    startTime: time("start_time"),
    endTime: time("end_time"),

    /** Exact timestamp boundaries for one-off hard blocks/events. */
    startAt: timestamp("start_at", { withTimezone: true }),
    endAt: timestamp("end_at", { withTimezone: true }),

    /**
     * Rule effect applied when this row matches a slot.
     * `available` and `unavailable` are the default include/exclude behaviors.
     */
    effect: availabilityRuleEffectEnum("effect").default("available").notNull(),

    /** Backward-compatible shortcut for include/exclude logic. */
    isAvailable: boolean("is_available").default(true).notNull(),

    /** Lower priority executes first when rules overlap. */
    priority: integer("priority").default(100).notNull(),

    reason: varchar("reason", { length: 500 }),

    /** For `override_hours` style exceptions with custom interval payloads. */
    replacementHours: jsonb("replacement_hours").default([]),

    /** Optional pricing context consumed by pricing layer. */
    pricingContext: jsonb("pricing_context").default({}),

    /** If true, privileged APIs may override this matched rule. */
    allowOverride: boolean("allow_override").default(false).notNull(),

    metadata: jsonb("metadata").default({}),
    status: lifecycleStatusEnum("status").default("active").notNull(),

    createdAt: createdAt,
    updatedAt: updatedAt,
    deletedAt: deletedAt,
  },
  (table) => ({
    availabilityRulesBizCalendarModeIdx: index(
      "availability_rules_biz_calendar_mode_idx",
    ).on(table.bizId, table.calendarId, table.mode),
    availabilityRulesBizCalendarDateIdx: index(
      "availability_rules_biz_calendar_date_idx",
    ).on(table.bizId, table.calendarId, table.startDate),
    availabilityRulesBizCalendarStartAtIdx: index(
      "availability_rules_biz_calendar_start_at_idx",
    ).on(table.bizId, table.calendarId, table.startAt),
    availabilityRulesServiceIdx: index("availability_rules_service_idx").on(
      table.serviceId,
    ),
    availabilityRulesEffectIdx: index("availability_rules_effect_idx").on(
      table.effect,
    ),
    availabilityRulesStatusIdx: index("availability_rules_status_idx").on(
      table.status,
    ),
  }),
);

export type Calendar = typeof calendars.$inferSelect;
export type NewCalendar = typeof calendars.$inferInsert;

export type Schedule = typeof schedules.$inferSelect;
export type NewSchedule = typeof schedules.$inferInsert;

export type AvailabilityRule = typeof availabilityRules.$inferSelect;
export type NewAvailabilityRule = typeof availabilityRules.$inferInsert;

/** @deprecated Use `AvailabilityRule`. */
export type WeeklyRule = AvailabilityRule;
/** @deprecated Use `AvailabilityRule`. */
export type AvailabilityException = AvailabilityRule;
/** @deprecated Use `AvailabilityRule`. */
export type BlockedTime = AvailabilityRule;

/** @deprecated Use `NewAvailabilityRule`. */
export type NewWeeklyRule = NewAvailabilityRule;
/** @deprecated Use `NewAvailabilityRule`. */
export type NewAvailabilityException = NewAvailabilityRule;
/** @deprecated Use `NewAvailabilityRule`. */
export type NewBlockedTime = NewAvailabilityRule;
