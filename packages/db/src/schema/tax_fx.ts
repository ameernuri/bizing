import { sql } from "drizzle-orm";
import { check, foreignKey, index, uniqueIndex } from "drizzle-orm/pg-core";
import {
  boolean,
  integer,
  jsonb,
  numeric,
  pgTable,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { idRef, idWithTag, withAuditRefs } from "./_common";
import { arInvoices } from "./ar";
import { bizes } from "./bizes";
import { taxCalculationStatusEnum, fxRateSourceEnum, lifecycleStatusEnum } from "./enums";
import { bookingOrders } from "./fulfillment";
import { users } from "./users";

/**
 * fx_rate_snapshots
 *
 * ELI5:
 * One row stores an FX pair rate at a point in time.
 *
 * Why this exists:
 * - checkout totals and invoices must be replayable later,
 * - external providers can change rates; snapshots preserve what was used.
 */
export const fxRateSnapshots = pgTable(
  "fx_rate_snapshots",
  {
    id: idWithTag("fx_rate"),
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    baseCurrency: varchar("base_currency", { length: 3 }).notNull(),
    quoteCurrency: varchar("quote_currency", { length: 3 }).notNull(),

    /**
     * Multiplicative rate from base -> quote.
     * Example: 1 USD * 0.9234567890 = 0.9234567890 EUR.
     */
    rate: numeric("rate", { precision: 24, scale: 10 }).notNull(),

    source: fxRateSourceEnum("source").default("provider").notNull(),
    sourceRef: varchar("source_ref", { length: 200 }),

    effectiveAt: timestamp("effective_at", { withTimezone: true }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),

    metadata: jsonb("metadata").default({}),
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    fxRateSnapshotsBizIdIdUnique: uniqueIndex("fx_rate_snapshots_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),

    fxRateSnapshotsBizPairEffectiveIdx: index("fx_rate_snapshots_biz_pair_effective_idx").on(
      table.bizId,
      table.baseCurrency,
      table.quoteCurrency,
      table.effectiveAt,
    ),

    fxRateSnapshotsBizPairSourceEffectiveUnique: uniqueIndex(
      "fx_rate_snapshots_biz_pair_source_effective_unique",
    ).on(
      table.bizId,
      table.baseCurrency,
      table.quoteCurrency,
      table.source,
      table.effectiveAt,
    ),

    fxRateSnapshotsBoundsCheck: check(
      "fx_rate_snapshots_bounds_check",
      sql`
      "rate" > 0
      AND "base_currency" <> "quote_currency"
      AND ("expires_at" IS NULL OR "expires_at" > "effective_at")
      `,
    ),

    fxRateSnapshotsCurrencyFormatCheck: check(
      "fx_rate_snapshots_currency_format_check",
      sql`"base_currency" ~ '^[A-Z]{3}$' AND "quote_currency" ~ '^[A-Z]{3}$'`,
    ),
  }),
);

/**
 * tax_profiles
 *
 * ELI5:
 * Tax profile is the ruleset identity for one jurisdictional context.
 */
export const taxProfiles = pgTable(
  "tax_profiles",
  {
    id: idWithTag("tax_profile"),
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),
    name: varchar("name", { length: 220 }).notNull(),
    slug: varchar("slug", { length: 140 }).notNull(),
    status: lifecycleStatusEnum("status").default("active").notNull(),

    /** ISO country code used for jurisdiction mapping. */
    countryCode: varchar("country_code", { length: 2 }).notNull(),
    regionCode: varchar("region_code", { length: 80 }),
    cityCode: varchar("city_code", { length: 80 }),
    postalCodePattern: varchar("postal_code_pattern", { length: 120 }),

    /** Whether listed rates are tax-inclusive by default. */
    taxInclusiveDefault: boolean("tax_inclusive_default").default(false).notNull(),

    /** Rounding knobs (precision/method/per-line vs per-total). */
    roundingPolicy: jsonb("rounding_policy").default({}).notNull(),
    metadata: jsonb("metadata").default({}),
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    taxProfilesBizIdIdUnique: uniqueIndex("tax_profiles_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    taxProfilesBizSlugUnique: uniqueIndex("tax_profiles_biz_slug_unique").on(
      table.bizId,
      table.slug,
    ),
    taxProfilesBizStatusGeoIdx: index("tax_profiles_biz_status_geo_idx").on(
      table.bizId,
      table.status,
      table.countryCode,
      table.regionCode,
    ),
    taxProfilesCountryFormatCheck: check(
      "tax_profiles_country_format_check",
      sql`"country_code" ~ '^[A-Z]{2}$'`,
    ),
  }),
);

/**
 * tax_rule_refs
 *
 * ELI5:
 * Atomic tax rule references that can be matched by calculators.
 * A profile can have many rules with priorities and validity windows.
 */
export const taxRuleRefs = pgTable(
  "tax_rule_refs",
  {
    id: idWithTag("tax_rule"),
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),
    taxProfileId: idRef("tax_profile_id")
      .references(() => taxProfiles.id)
      .notNull(),
    ruleKey: varchar("rule_key", { length: 140 }).notNull(),
    status: lifecycleStatusEnum("status").default("active").notNull(),
    priority: integer("priority").default(100).notNull(),

    /** Percent rate (bps) and/or flat tax amount can be used. */
    rateBps: integer("rate_bps"),
    flatAmountMinor: integer("flat_amount_minor"),

    /** Selector payload (product class, geo match, exemption tags, etc.). */
    appliesTo: jsonb("applies_to").default({}).notNull(),

    validFrom: timestamp("valid_from", { withTimezone: true }),
    validTo: timestamp("valid_to", { withTimezone: true }),
    metadata: jsonb("metadata").default({}),
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    taxRuleRefsBizIdIdUnique: uniqueIndex("tax_rule_refs_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    taxRuleRefsProfileRuleUnique: uniqueIndex("tax_rule_refs_profile_rule_unique").on(
      table.taxProfileId,
      table.ruleKey,
    ),
    taxRuleRefsBizProfileStatusPriorityIdx: index(
      "tax_rule_refs_biz_profile_status_priority_idx",
    ).on(table.bizId, table.taxProfileId, table.status, table.priority),

    taxRuleRefsBizProfileFk: foreignKey({
      columns: [table.bizId, table.taxProfileId],
      foreignColumns: [taxProfiles.bizId, taxProfiles.id],
      name: "tax_rule_refs_biz_profile_fk",
    }),

    taxRuleRefsShapeCheck: check(
      "tax_rule_refs_shape_check",
      sql`
      ("rate_bps" IS NOT NULL OR "flat_amount_minor" IS NOT NULL)
      AND ("rate_bps" IS NULL OR ("rate_bps" > 0 AND "rate_bps" <= 100000))
      AND ("flat_amount_minor" IS NULL OR "flat_amount_minor" >= 0)
      AND ("valid_from" IS NULL OR "valid_to" IS NULL OR "valid_to" > "valid_from")
      AND "priority" >= 0
      `,
    ),
  }),
);

/**
 * tax_calculations
 *
 * ELI5:
 * Deterministic tax calculation snapshot used by checkout/invoice workflows.
 * This captures both inputs and outputs so totals can be replayed exactly.
 */
export const taxCalculations = pgTable(
  "tax_calculations",
  {
    id: idWithTag("tax_calc"),
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),
    taxProfileId: idRef("tax_profile_id").references(() => taxProfiles.id),
    taxRuleRefId: idRef("tax_rule_ref_id").references(() => taxRuleRefs.id),
    fxRateSnapshotId: idRef("fx_rate_snapshot_id").references(() => fxRateSnapshots.id),

    bookingOrderId: idRef("booking_order_id").references(() => bookingOrders.id),
    arInvoiceId: idRef("ar_invoice_id").references(() => arInvoices.id),

    status: taxCalculationStatusEnum("status").default("calculated").notNull(),

    taxableSubtotalMinor: integer("taxable_subtotal_minor").default(0).notNull(),
    taxMinor: integer("tax_minor").default(0).notNull(),
    totalMinor: integer("total_minor").default(0).notNull(),
    currency: varchar("currency", { length: 3 }).default("USD").notNull(),

    calculatedAt: timestamp("calculated_at", { withTimezone: true }).defaultNow().notNull(),
    finalizedAt: timestamp("finalized_at", { withTimezone: true }),

    /** Canonical input payload used by calculator. */
    inputSnapshot: jsonb("input_snapshot").default({}).notNull(),

    /** Canonical output payload (per-rule amounts, exemption details, etc.). */
    outputBreakdown: jsonb("output_breakdown").default({}).notNull(),

    metadata: jsonb("metadata").default({}),
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    taxCalculationsBizIdIdUnique: uniqueIndex("tax_calculations_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    taxCalculationsBizStatusCalculatedIdx: index("tax_calculations_biz_status_calculated_idx").on(
      table.bizId,
      table.status,
      table.calculatedAt,
    ),

    taxCalculationsBizBookingOrderIdx: index("tax_calculations_biz_booking_order_idx").on(
      table.bizId,
      table.bookingOrderId,
    ),

    taxCalculationsBizArInvoiceIdx: index("tax_calculations_biz_ar_invoice_idx").on(
      table.bizId,
      table.arInvoiceId,
    ),

    taxCalculationsBizProfileFk: foreignKey({
      columns: [table.bizId, table.taxProfileId],
      foreignColumns: [taxProfiles.bizId, taxProfiles.id],
      name: "tax_calculations_biz_profile_fk",
    }),

    taxCalculationsBizRuleFk: foreignKey({
      columns: [table.bizId, table.taxRuleRefId],
      foreignColumns: [taxRuleRefs.bizId, taxRuleRefs.id],
      name: "tax_calculations_biz_rule_fk",
    }),

    taxCalculationsBizFxRateFk: foreignKey({
      columns: [table.bizId, table.fxRateSnapshotId],
      foreignColumns: [fxRateSnapshots.bizId, fxRateSnapshots.id],
      name: "tax_calculations_biz_fx_rate_fk",
    }),

    taxCalculationsBizBookingOrderFk: foreignKey({
      columns: [table.bizId, table.bookingOrderId],
      foreignColumns: [bookingOrders.bizId, bookingOrders.id],
      name: "tax_calculations_biz_booking_order_fk",
    }),

    taxCalculationsBizArInvoiceFk: foreignKey({
      columns: [table.bizId, table.arInvoiceId],
      foreignColumns: [arInvoices.bizId, arInvoices.id],
      name: "tax_calculations_biz_ar_invoice_fk",
    }),

    taxCalculationsAnchorCheck: check(
      "tax_calculations_anchor_check",
      sql`"booking_order_id" IS NOT NULL OR "ar_invoice_id" IS NOT NULL`,
    ),

    taxCalculationsMoneyCheck: check(
      "tax_calculations_money_check",
      sql`
      "taxable_subtotal_minor" >= 0
      AND "tax_minor" >= 0
      AND "total_minor" = ("taxable_subtotal_minor" + "tax_minor")
      `,
    ),

    taxCalculationsTimelineCheck: check(
      "tax_calculations_timeline_check",
      sql`"finalized_at" IS NULL OR "finalized_at" >= "calculated_at"`,
    ),

    taxCalculationsCurrencyFormatCheck: check(
      "tax_calculations_currency_format_check",
      sql`"currency" ~ '^[A-Z]{3}$'`,
    ),
  }),
);
