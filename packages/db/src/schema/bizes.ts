import { sql } from "drizzle-orm";
import { check, index, uniqueIndex } from "drizzle-orm/pg-core";
import { jsonb, pgTable, varchar } from "drizzle-orm/pg-core";
import { id, withAudit } from "./_common";
import { lifecycleStatusEnum, bizTypeEnum } from "./enums";

/**
 * bizes
 *
 * Tenant root for strict data isolation.
 * Every business-domain row in this package is scoped by `biz_id`.
 */
export const bizes = pgTable(
  "bizes",
  {
    id,

    /** Human-facing business name. */
    name: varchar("name", { length: 255 }).notNull(),

    /** Stable URL/API slug; globally unique in this deployment. */
    slug: varchar("slug", { length: 100 }).notNull(),

    /** Macro org shape (can drive defaults/plans/features). */
    type: bizTypeEnum("type").default("small_business").notNull(),

    logoUrl: varchar("logo_url", { length: 500 }),

    /** Default timezone for scheduling/pricing if child entities do not override. */
    timezone: varchar("timezone", { length: 50 }).default("UTC").notNull(),

    /** Default settlement/presentation currency. */
    currency: varchar("currency", { length: 3 }).default("USD").notNull(),

    /** Lifecycle switch for tenant availability and admin controls. */
    status: lifecycleStatusEnum("status").default("active").notNull(),

    /** Extensible org metadata consumed by Better Auth organization plugin. */
    metadata: jsonb("metadata").default({}).notNull(),

    /**
     * Mutation actors for admin/audit traceability.
     * Kept as ids without FK to avoid circular type/bootstrap coupling between
     * tenant and user root tables.
     */
    ...withAudit(),
  },
  (table) => ({
    bizesSlugUnique: uniqueIndex("bizes_slug_unique").on(table.slug),
    bizesStatusIdx: index("bizes_status_idx").on(table.status),
    /** Enforce ISO-4217-like uppercase format (e.g., USD, EUR). */
    bizesCurrencyFormatCheck: check(
      "bizes_currency_format_check",
      sql`"currency" ~ '^[A-Z]{3}$'`,
    ),
  }),
);

export type Biz = typeof bizes.$inferSelect;
export type NewBiz = typeof bizes.$inferInsert;
