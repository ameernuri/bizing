import { sql } from "drizzle-orm";
import { check, foreignKey, index, uniqueIndex } from "drizzle-orm/pg-core";
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { idRef, idWithTag, withAuditRefs } from "./_common";
import { actionRequests } from "./action_backbone";
import { bizes } from "./bizes";
import { bizConfigValues } from "./biz_configs";
import { checkoutSessions } from "./checkout";
import { crmContacts } from "./crm";
import { domainEvents } from "./domain_events";
import { bookingOrders } from "./fulfillment";
import { instrumentRuns } from "./instruments";
import { debugSnapshots, projectionDocuments } from "./projections";
import {
  lifecycleStatusEnum,
  salesQuoteGenerationStatusEnum,
  salesQuoteGeneratorTypeEnum,
  salesQuoteRequestStatusEnum,
} from "./enums";
import { sellables } from "./product_commerce";
import { subjects } from "./subjects";
import { users } from "./users";

/**
 * sales_quotes
 *
 * ELI5:
 * This is the "quote envelope" shared with a buyer.
 *
 * Why this table exists:
 * - order lines are execution facts after commitment,
 * - quotes are pre-commitment proposals that can be revised, sent, signed,
 *   accepted, rejected, and converted later.
 *
 * Design:
 * - one `sales_quotes` row is the stable commercial thread,
 * - immutable-ish revisions live in `sales_quote_versions`.
 */
export const salesQuotes = pgTable(
  "sales_quotes",
  {
    /** Stable primary key for one quote thread. */
    id: idWithTag("sales_quote"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /**
     * Human/business quote number.
     * Example: `Q-2026-000184`.
     */
    quoteNumber: varchar("quote_number", { length: 120 }).notNull(),

    /**
     * Quote lifecycle state.
     * `custom_*` values are allowed for plugin-defined workflows.
     */
    status: varchar("status", { length: 40 }).default("draft").notNull(),
    /**
     * Optional configurable lifecycle pointer for tenant-specific quote wording.
     *
     * Internal logic should continue to use canonical `status` codes.
     */
    statusConfigValueId: idRef("status_config_value_id"),

    /** Optional title shown in buyer/admin UIs. */
    title: varchar("title", { length: 240 }),

    /** Optional plain-language description. */
    description: text("description"),

    /**
     * Shared contact identity for the quote buyer.
     * This centralizes user/group/external contact shape in `crm_contacts`.
     */
    crmContactId: idRef("crm_contact_id")
      .references(() => crmContacts.id)
      .notNull(),

    /** Settlement/display currency for this quote thread. */
    currency: varchar("currency", { length: 3 }).default("USD").notNull(),

    /** Optional validity start. */
    validFrom: timestamp("valid_from", { withTimezone: true }),

    /** Optional expiry deadline. */
    validUntil: timestamp("valid_until", { withTimezone: true }),

    /** Convenience pointer for current version number in this thread. */
    currentVersionNumber: integer("current_version_number").default(1).notNull(),

    /** Optional originating checkout session context. */
    sourceCheckoutSessionId: idRef("source_checkout_session_id").references(
      () => checkoutSessions.id,
    ),

    /** Optional booking order created after accepted conversion. */
    convertedBookingOrderId: idRef("converted_booking_order_id").references(
      () => bookingOrders.id,
    ),

    /** Timestamp when quote converted into booking order. */
    convertedAt: timestamp("converted_at", { withTimezone: true }),

    /**
     * Thread-level terms snapshot.
     * Version rows can override/extend this; this keeps top-level context
     * visible for quick list views.
     */
    termsSnapshot: jsonb("terms_snapshot").default({}).notNull(),

    /** Non-versioned pricing context metadata (tax region, policy ids, etc.). */
    pricingContext: jsonb("pricing_context").default({}).notNull(),

    /** Extensible payload for non-normalized metadata. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    salesQuotesBizIdIdUnique: uniqueIndex("sales_quotes_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Composite key for tenant-safe references from child tables. */

    /** Quote number uniqueness per tenant. */
    salesQuotesBizNumberUnique: uniqueIndex("sales_quotes_biz_number_unique").on(
      table.bizId,
      table.quoteNumber,
    ),

    /** Main quote board path by status and expiry. */
    salesQuotesBizStatusValidUntilIdx: index(
      "sales_quotes_biz_status_valid_until_idx",
    ).on(table.bizId, table.status, table.validUntil),
    /** Configurable lifecycle query path for boards and filters. */
    salesQuotesBizStatusConfigValidUntilIdx: index(
      "sales_quotes_biz_status_config_valid_until_idx",
    ).on(table.bizId, table.statusConfigValueId, table.validUntil),

    /** Buyer history lookup path. */
    salesQuotesBizContactIdx: index("sales_quotes_biz_contact_idx").on(
      table.bizId,
      table.crmContactId,
      table.status,
      table.validUntil,
    ),

    /** Tenant-safe FK to optional checkout source. */
    salesQuotesBizCheckoutSessionFk: foreignKey({
      columns: [table.bizId, table.sourceCheckoutSessionId],
      foreignColumns: [checkoutSessions.bizId, checkoutSessions.id],
      name: "sales_quotes_biz_checkout_session_fk",
    }),

    /** Tenant-safe FK to optional converted booking order. */
    salesQuotesBizBookingOrderFk: foreignKey({
      columns: [table.bizId, table.convertedBookingOrderId],
      foreignColumns: [bookingOrders.bizId, bookingOrders.id],
      name: "sales_quotes_biz_booking_order_fk",
    }),

    /** Tenant-safe FK to shared CRM contact. */
    salesQuotesBizContactFk: foreignKey({
      columns: [table.bizId, table.crmContactId],
      foreignColumns: [crmContacts.bizId, crmContacts.id],
      name: "sales_quotes_biz_contact_fk",
    }),
    /** Tenant-safe FK to optional configured status dictionary value. */
    salesQuotesBizStatusConfigFk: foreignKey({
      columns: [table.bizId, table.statusConfigValueId],
      foreignColumns: [bizConfigValues.bizId, bizConfigValues.id],
      name: "sales_quotes_biz_status_config_fk",
    }),

    /** Lifecycle/status vocabulary remains extensible. */
    salesQuotesStatusCheck: check(
      "sales_quotes_status_check",
      sql`
      "status" IN (
        'draft',
        'sent',
        'accepted',
        'rejected',
        'expired',
        'cancelled',
        'converted'
      )
      OR "status" LIKE 'custom_%'
      `,
    ),

    /** Version and timeline sanity checks. */
    salesQuotesBoundsCheck: check(
      "sales_quotes_bounds_check",
      sql`
      "current_version_number" >= 1
      AND (
        "valid_from" IS NULL
        OR "valid_until" IS NULL
        OR "valid_until" > "valid_from"
      )
      AND ("converted_at" IS NULL OR "converted_booking_order_id" IS NOT NULL)
      `,
    ),

    /** Currency shape should stay uppercase ISO-like. */
    salesQuotesCurrencyFormatCheck: check(
      "sales_quotes_currency_format_check",
      sql`"currency" ~ '^[A-Z]{3}$'`,
    ),
  }),
);

/**
 * sales_quote_versions
 *
 * ELI5:
 * Each row is one immutable-ish revision of a quote.
 *
 * Why version rows matter:
 * - legal/commercial clarity ("what exactly did we send/accept?"),
 * - allows iterative negotiation without mutating history,
 * - clean conversion lineage to final order.
 */
export const salesQuoteVersions = pgTable(
  "sales_quote_versions",
  {
    /** Stable primary key for one quote revision. */
    id: idWithTag("sales_quote_version"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent quote thread. */
    salesQuoteId: idRef("sales_quote_id")
      .references(() => salesQuotes.id)
      .notNull(),

    /** Immutable revision number within one quote thread. */
    versionNumber: integer("version_number").notNull(),

    /** Version lifecycle state. */
    status: lifecycleStatusEnum("status").default("draft").notNull(),

    /** Current version marker for fast reads. */
    isCurrent: boolean("is_current").default(false).notNull(),

    /** When this version was issued/sent to buyer. */
    issuedAt: timestamp("issued_at", { withTimezone: true }),

    /** Version-specific expiry. */
    validUntil: timestamp("valid_until", { withTimezone: true }),

    /** Currency for money columns in this version row. */
    currency: varchar("currency", { length: 3 }).default("USD").notNull(),

    /** Subtotal in minor units across line rows. */
    subtotalMinor: integer("subtotal_minor").default(0).notNull(),

    /** Tax total in minor units. */
    taxMinor: integer("tax_minor").default(0).notNull(),

    /** Fee total in minor units. */
    feeMinor: integer("fee_minor").default(0).notNull(),

    /** Discount total in minor units. */
    discountMinor: integer("discount_minor").default(0).notNull(),

    /** Final total in minor units. */
    totalMinor: integer("total_minor").default(0).notNull(),

    /** Optional note shown with this version. */
    notes: text("notes"),

    /** Immutable pricing snapshot used for reconciliation/audit. */
    pricingSnapshot: jsonb("pricing_snapshot").default({}).notNull(),

    /** Immutable legal/terms snapshot for this revision. */
    termsSnapshot: jsonb("terms_snapshot").default({}).notNull(),

    /** Extensible payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite key for tenant-safe line/acceptance references. */
    salesQuoteVersionsBizIdIdUnique: uniqueIndex(
      "sales_quote_versions_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** One row per quote/version pair. */
    salesQuoteVersionsUnique: uniqueIndex("sales_quote_versions_unique").on(
      table.salesQuoteId,
      table.versionNumber,
    ),

    /** One current version at a time per quote thread. */
    salesQuoteVersionsCurrentUnique: uniqueIndex(
      "sales_quote_versions_current_unique",
    )
      .on(table.salesQuoteId)
      .where(sql`"is_current" = true AND "deleted_at" IS NULL`),

    /** Operational listing path by quote and version state. */
    salesQuoteVersionsBizQuoteStatusIdx: index(
      "sales_quote_versions_biz_quote_status_idx",
    ).on(table.bizId, table.salesQuoteId, table.status, table.versionNumber),

    /** Tenant-safe FK to parent quote thread. */
    salesQuoteVersionsBizQuoteFk: foreignKey({
      columns: [table.bizId, table.salesQuoteId],
      foreignColumns: [salesQuotes.bizId, salesQuotes.id],
      name: "sales_quote_versions_biz_quote_fk",
    }),

    /** Money and timeline invariants. */
    salesQuoteVersionsMoneyCheck: check(
      "sales_quote_versions_money_check",
      sql`
      "version_number" >= 1
      AND "subtotal_minor" >= 0
      AND "tax_minor" >= 0
      AND "fee_minor" >= 0
      AND "discount_minor" >= 0
      AND "total_minor" >= 0
      AND "total_minor" = ("subtotal_minor" + "tax_minor" + "fee_minor" - "discount_minor")
      AND ("issued_at" IS NULL OR "valid_until" IS NULL OR "valid_until" >= "issued_at")
      `,
    ),

    /** Currency shape should stay uppercase ISO-like. */
    salesQuoteVersionsCurrencyFormatCheck: check(
      "sales_quote_versions_currency_format_check",
      sql`"currency" ~ '^[A-Z]{3}$'`,
    ),
  }),
);

/**
 * sales_quote_lines
 *
 * ELI5:
 * This is the itemized breakdown for one quote version.
 *
 * It supports:
 * - canonical sellable rows,
 * - ad-hoc custom lines,
 * - fee/tax/discount lines with deterministic totals.
 */
export const salesQuoteLines = pgTable(
  "sales_quote_lines",
  {
    /** Stable primary key for one quote line. */
    id: idWithTag("sales_quote_line"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent quote version. */
    salesQuoteVersionId: idRef("sales_quote_version_id")
      .references(() => salesQuoteVersions.id)
      .notNull(),

    /** Stable ordering position inside the quote version. */
    sortOrder: integer("sort_order").default(100).notNull(),

    /**
     * Line semantic class.
     * `custom_*` allows plugin-defined line semantics.
     */
    lineType: varchar("line_type", { length: 40 }).default("sellable").notNull(),

    /** Canonical sellable pointer when `line_type='sellable'`. */
    sellableId: idRef("sellable_id").references(() => sellables.id),

    /** Buyer-facing description for this line. */
    description: text("description"),

    /** Quantity in base units for this line. */
    quantity: integer("quantity").default(1).notNull(),

    /** Unit price in minor units. */
    unitPriceMinor: integer("unit_price_minor").default(0).notNull(),

    /** Subtotal (quantity * unit price) in minor units. */
    lineSubtotalMinor: integer("line_subtotal_minor").default(0).notNull(),

    /** Tax amount in minor units. */
    taxMinor: integer("tax_minor").default(0).notNull(),

    /** Fee amount in minor units. */
    feeMinor: integer("fee_minor").default(0).notNull(),

    /** Discount amount in minor units. */
    discountMinor: integer("discount_minor").default(0).notNull(),

    /** Final line total in minor units. */
    totalMinor: integer("total_minor").default(0).notNull(),

    /** Currency for money columns in this line row. */
    currency: varchar("currency", { length: 3 }).default("USD").notNull(),

    /** Extensible line payload for custom pricing metadata. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    salesQuoteLinesBizIdIdUnique: uniqueIndex("sales_quote_lines_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Composite key for tenant-safe references. */

    /** Prevent duplicate ordering positions in one quote version. */
    salesQuoteLinesVersionSortUnique: uniqueIndex(
      "sales_quote_lines_version_sort_unique",
    ).on(table.salesQuoteVersionId, table.sortOrder),

    /** Render path for one quote revision. */
    salesQuoteLinesBizVersionSortIdx: index("sales_quote_lines_biz_version_sort_idx").on(
      table.bizId,
      table.salesQuoteVersionId,
      table.sortOrder,
    ),

    /** Sellable-driven analytics path. */
    salesQuoteLinesBizSellableIdx: index("sales_quote_lines_biz_sellable_idx").on(
      table.bizId,
      table.sellableId,
    ),

    /** Tenant-safe FK to parent quote version. */
    salesQuoteLinesBizVersionFk: foreignKey({
      columns: [table.bizId, table.salesQuoteVersionId],
      foreignColumns: [salesQuoteVersions.bizId, salesQuoteVersions.id],
      name: "sales_quote_lines_biz_version_fk",
    }),

    /** Tenant-safe FK to optional canonical sellable. */
    salesQuoteLinesBizSellableFk: foreignKey({
      columns: [table.bizId, table.sellableId],
      foreignColumns: [sellables.bizId, sellables.id],
      name: "sales_quote_lines_biz_sellable_fk",
    }),

    /** Money and quantity invariants for deterministic totals. */
    salesQuoteLinesMoneyCheck: check(
      "sales_quote_lines_money_check",
      sql`
      "sort_order" >= 0
      AND "quantity" > 0
      AND "unit_price_minor" >= 0
      AND "line_subtotal_minor" >= 0
      AND "tax_minor" >= 0
      AND "fee_minor" >= 0
      AND "discount_minor" >= 0
      AND "total_minor" >= 0
      AND "line_subtotal_minor" = ("quantity" * "unit_price_minor")
      AND "total_minor" = ("line_subtotal_minor" + "tax_minor" + "fee_minor" - "discount_minor")
      `,
    ),

    /** Sellable rows must carry sellable id; non-sellable rows must not. */
    salesQuoteLinesShapeCheck: check(
      "sales_quote_lines_shape_check",
      sql`
      (
        "line_type" = 'sellable'
        AND "sellable_id" IS NOT NULL
      ) OR (
        "line_type" <> 'sellable'
        AND "sellable_id" IS NULL
      )
      `,
    ),

    /** Line-type vocabulary remains extensible. */
    salesQuoteLinesTypeCheck: check(
      "sales_quote_lines_type_check",
      sql`
      "line_type" IN ('sellable', 'custom', 'fee', 'tax', 'discount')
      OR "line_type" LIKE 'custom_%'
      `,
    ),

    /** Currency shape should stay uppercase ISO-like. */
    salesQuoteLinesCurrencyFormatCheck: check(
      "sales_quote_lines_currency_format_check",
      sql`"currency" ~ '^[A-Z]{3}$'`,
    ),
  }),
);

/**
 * sales_quote_acceptances
 *
 * ELI5:
 * Every decision event on a quote version (accept/reject/withdraw/etc.) is
 * recorded here with signer evidence.
 *
 * This powers:
 * - e-sign evidence linkage,
 * - quote conversion audit trail,
 * - legal/commercial traceability.
 */
export const salesQuoteAcceptances = pgTable(
  "sales_quote_acceptances",
  {
    /** Stable primary key for one decision event. */
    id: idWithTag("sales_quote_acceptance"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Target quote version being decided. */
    salesQuoteVersionId: idRef("sales_quote_version_id")
      .references(() => salesQuoteVersions.id)
      .notNull(),

    /**
     * Decision type.
     * `custom_*` allows policy/plugin extensions.
     */
    decisionType: varchar("decision_type", { length: 40 })
      .default("accepted")
      .notNull(),

    /** Business timestamp when decision was taken. */
    decidedAt: timestamp("decided_at", { withTimezone: true }).defaultNow().notNull(),

    /**
     * Preferred decision-maker anchor as shared CRM contact.
     *
     * Why this is the preferred path:
     * - quote/buyer lifecycle already uses `crm_contacts`,
     * - this keeps actor identity reusable across sales, CRM, and messaging,
     * - it avoids duplicating user/group-specific columns in each domain table.
     */
    decidedByCrmContactId: idRef("decided_by_crm_contact_id").references(
      () => crmContacts.id,
    ),

    /**
     * Optional fallback actor anchor as generic subject.
     *
     * Use this when decision actor is not represented as a CRM contact
     * (for example plugin/system actors with custom namespaces).
     */
    decidedBySubjectType: varchar("decided_by_subject_type", { length: 80 }),
    decidedBySubjectId: varchar("decided_by_subject_id", { length: 140 }),

    /** Guest/manual signer name when no authenticated principal exists. */
    signerName: varchar("signer_name", { length: 220 }),

    /** Guest/manual signer email when no authenticated principal exists. */
    signerEmail: varchar("signer_email", { length: 320 }),

    /**
     * Optional pointer to the unified instrument run that captured
     * intake/quiz/assessment evidence used during acceptance.
     */
    instrumentRunId: idRef("instrument_run_id").references(() => instrumentRuns.id),

    /** Optional booking order produced by this acceptance decision. */
    bookingOrderId: idRef("booking_order_id").references(() => bookingOrders.id),

    /** Optional plain-language decision note. */
    decisionNote: text("decision_note"),

    /** Optional source IP for legal evidence trails. */
    sourceIp: varchar("source_ip", { length: 80 }),

    /** Optional user agent for legal evidence trails. */
    sourceUserAgent: varchar("source_user_agent", { length: 800 }),

    /** Structured evidence payload (hashes, signer workflow refs, etc.). */
    signatureEvidence: jsonb("signature_evidence").default({}).notNull(),

    /** Extensible payload for integration-specific fields. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite key for tenant-safe references. */
    salesQuoteAcceptancesBizIdIdUnique: uniqueIndex(
      "sales_quote_acceptances_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** At most one active accepted decision per quote version. */
    salesQuoteAcceptancesAcceptedUnique: uniqueIndex(
      "sales_quote_acceptances_accepted_unique",
    )
      .on(table.salesQuoteVersionId)
      .where(sql`"decision_type" = 'accepted' AND "deleted_at" IS NULL`),

    /** Timeline path per quote version. */
    salesQuoteAcceptancesBizVersionDecidedIdx: index(
      "sales_quote_acceptances_biz_version_decided_idx",
    ).on(table.bizId, table.salesQuoteVersionId, table.decidedAt),

    /** Reverse lookup path by final booking order. */
    salesQuoteAcceptancesBizBookingOrderIdx: index(
      "sales_quote_acceptances_biz_booking_order_idx",
    ).on(table.bizId, table.bookingOrderId, table.decidedAt),

    /** Reverse lookup path by shared contact actor. */
    salesQuoteAcceptancesBizActorContactIdx: index(
      "sales_quote_acceptances_biz_actor_contact_idx",
    ).on(table.bizId, table.decidedByCrmContactId, table.decidedAt),

    /** Tenant-safe FK to quote version. */
    salesQuoteAcceptancesBizVersionFk: foreignKey({
      columns: [table.bizId, table.salesQuoteVersionId],
      foreignColumns: [salesQuoteVersions.bizId, salesQuoteVersions.id],
      name: "sales_quote_acceptances_biz_version_fk",
    }),

    /** Tenant-safe FK to optional instrument run evidence row. */
    salesQuoteAcceptancesBizInstrumentRunFk: foreignKey({
      columns: [table.bizId, table.instrumentRunId],
      foreignColumns: [instrumentRuns.bizId, instrumentRuns.id],
      name: "sales_quote_acceptances_biz_instrument_run_fk",
    }),

    /** Tenant-safe FK to optional converted booking order. */
    salesQuoteAcceptancesBizBookingOrderFk: foreignKey({
      columns: [table.bizId, table.bookingOrderId],
      foreignColumns: [bookingOrders.bizId, bookingOrders.id],
      name: "sales_quote_acceptances_biz_booking_order_fk",
    }),

    /** Tenant-safe FK to optional CRM contact actor anchor. */
    salesQuoteAcceptancesBizActorContactFk: foreignKey({
      columns: [table.bizId, table.decidedByCrmContactId],
      foreignColumns: [crmContacts.bizId, crmContacts.id],
      name: "sales_quote_acceptances_biz_actor_contact_fk",
    }),

    /** Tenant-safe FK to optional subject actor anchor. */
    salesQuoteAcceptancesBizActorSubjectFk: foreignKey({
      columns: [table.bizId, table.decidedBySubjectType, table.decidedBySubjectId],
      foreignColumns: [subjects.bizId, subjects.subjectType, subjects.subjectId],
      name: "sales_quote_acceptances_biz_actor_subject_fk",
    }),

    /** Subject anchor must be fully null or fully populated. */
    salesQuoteAcceptancesActorSubjectPairCheck: check(
      "sales_quote_acceptances_actor_subject_pair_check",
      sql`
      (
        "decided_by_subject_type" IS NULL
        AND "decided_by_subject_id" IS NULL
      ) OR (
        "decided_by_subject_type" IS NOT NULL
        AND "decided_by_subject_id" IS NOT NULL
      )
      `,
    ),

    /** Decision actor must be explicit through principal or signer identity. */
    salesQuoteAcceptancesActorShapeCheck: check(
      "sales_quote_acceptances_actor_shape_check",
      sql`
      (
        ("decided_by_crm_contact_id" IS NOT NULL)::int
        + ("decided_by_subject_type" IS NOT NULL)::int
        + ("signer_email" IS NOT NULL)::int
      ) >= 1
      AND (
        ("decided_by_crm_contact_id" IS NOT NULL)::int
        + ("decided_by_subject_type" IS NOT NULL)::int
      ) <= 1
      `,
    ),

    /** Decision vocabulary remains extensible. */
    salesQuoteAcceptancesDecisionTypeCheck: check(
      "sales_quote_acceptances_decision_type_check",
      sql`
      "decision_type" IN ('accepted', 'rejected', 'withdrawn', 'expired')
      OR "decision_type" LIKE 'custom_%'
      `,
    ),
  }),
);

/**
 * sales_quote_requests
 *
 * ELI5:
 * A quote request is the pre-quote intake thread.
 *
 * It captures "what the buyer wants" before any quote version exists.
 * This supports:
 * - services, packages, products (through generic target pointers),
 * - intake-form driven requirements,
 * - repeatable quote generation pipelines.
 */
export const salesQuoteRequests = pgTable(
  "sales_quote_requests",
  {
    /** Stable primary key for one quote request thread. */
    id: idWithTag("sales_quote_request"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Human/business request number for support and operations. */
    requestNumber: varchar("request_number", { length: 120 }).notNull(),

    /** Request lifecycle status. */
    status: salesQuoteRequestStatusEnum("status").default("submitted").notNull(),

    /** Shared contact identity for requestor. */
    crmContactId: idRef("crm_contact_id")
      .references(() => crmContacts.id)
      .notNull(),

    /**
     * Optional target context class.
     * Example: service_product, offer, product, custom_subject.
     */
    targetType: varchar("target_type", { length: 80 }),

    /** Optional target context id. */
    targetRefId: varchar("target_ref_id", { length: 140 }),

    /** Optional requested service window start. */
    requestedStartAt: timestamp("requested_start_at", { withTimezone: true }),

    /** Optional requested service window end. */
    requestedEndAt: timestamp("requested_end_at", { withTimezone: true }),

    /** Requested settlement/display currency. */
    currency: varchar("currency", { length: 3 }).default("USD").notNull(),

    /**
     * Optional pointer to intake/assessment run that produced request data.
     *
     * This is the canonical way to connect quote requests to structured forms.
     */
    intakeInstrumentRunId: idRef("intake_instrument_run_id").references(
      () => instrumentRuns.id,
    ),

    /** Structured requested line/items payload (pre-normalization). */
    requestPayload: jsonb("request_payload").default({}).notNull(),

    /** Optional request summary for fast list UIs. */
    summary: text("summary"),

    /** Optional link to final generated quote thread. */
    salesQuoteId: idRef("sales_quote_id").references(() => salesQuotes.id),

    /**
     * Optional canonical request/action link.
     *
     * ELI5:
     * Quote requests often start because of one business action or API call.
     * This stores that breadcrumb explicitly.
     */
    actionRequestId: idRef("action_request_id").references(() => actionRequests.id),

    /** Conversion timestamp once quote thread created. */
    convertedAt: timestamp("converted_at", { withTimezone: true }),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    salesQuoteRequestsBizIdIdUnique: uniqueIndex("sales_quote_requests_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),

    /** Unique request number per tenant. */
    salesQuoteRequestsBizNumberUnique: uniqueIndex("sales_quote_requests_biz_number_unique").on(
      table.bizId,
      table.requestNumber,
    ),

    /** Main quote-request queue path. */
    salesQuoteRequestsBizStatusIdx: index("sales_quote_requests_biz_status_idx").on(
      table.bizId,
      table.status,
      table.requestedStartAt,
    ),

    /** Contact-centric request history path. */
    salesQuoteRequestsBizContactIdx: index("sales_quote_requests_biz_contact_idx").on(
      table.bizId,
      table.crmContactId,
      table.status,
    ),

    /** Trace path from action backbone into quote requests. */
    salesQuoteRequestsActionRequestIdx: index("sales_quote_requests_action_request_idx").on(
      table.actionRequestId,
    ),

    /** Tenant-safe FK to requestor contact. */
    salesQuoteRequestsBizContactFk: foreignKey({
      columns: [table.bizId, table.crmContactId],
      foreignColumns: [crmContacts.bizId, crmContacts.id],
      name: "sales_quote_requests_biz_contact_fk",
    }),

    /** Tenant-safe FK to optional intake instrument run. */
    salesQuoteRequestsBizIntakeRunFk: foreignKey({
      columns: [table.bizId, table.intakeInstrumentRunId],
      foreignColumns: [instrumentRuns.bizId, instrumentRuns.id],
      name: "sales_quote_requests_biz_intake_run_fk",
    }),

    /** Tenant-safe FK to optional created quote thread. */
    salesQuoteRequestsBizQuoteFk: foreignKey({
      columns: [table.bizId, table.salesQuoteId],
      foreignColumns: [salesQuotes.bizId, salesQuotes.id],
      name: "sales_quote_requests_biz_quote_fk",
    }),

    /** Timeline and status consistency checks. */
    salesQuoteRequestsTimelineCheck: check(
      "sales_quote_requests_timeline_check",
      sql`
      ("requested_start_at" IS NULL OR "requested_end_at" IS NULL OR "requested_end_at" >= "requested_start_at")
      AND ("converted_at" IS NULL OR "sales_quote_id" IS NOT NULL)
      `,
    ),

    /** Currency shape should stay uppercase ISO-like. */
    salesQuoteRequestsCurrencyFormatCheck: check(
      "sales_quote_requests_currency_format_check",
      sql`"currency" ~ '^[A-Z]{3}$'`,
    ),
  }),
);

/**
 * sales_quote_generation_runs
 *
 * ELI5:
 * One row = one quote generation execution.
 *
 * This supports:
 * - manual quote assembly,
 * - rules-engine quote assembly,
 * - AI/agent-assisted quote assembly,
 * - external pricer integrations.
 *
 * Why separate from quote tables:
 * - generation pipelines can retry/fail independently,
 * - observability/debugging needs run-level inputs/outputs,
 * - keeps quote commercial tables clean and deterministic.
 */
export const salesQuoteGenerationRuns = pgTable(
  "sales_quote_generation_runs",
  {
    /** Stable primary key. */
    id: idWithTag("sales_quote_gen"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Optional parent request thread. */
    salesQuoteRequestId: idRef("sales_quote_request_id").references(
      () => salesQuoteRequests.id,
    ),

    /** Optional target quote thread. */
    salesQuoteId: idRef("sales_quote_id").references(() => salesQuotes.id),

    /** Optional generated quote version row. */
    salesQuoteVersionId: idRef("sales_quote_version_id").references(
      () => salesQuoteVersions.id,
    ),

    /** Generator strategy used for this run. */
    generatorType: salesQuoteGeneratorTypeEnum("generator_type")
      .default("manual")
      .notNull(),

    /** Run lifecycle status. */
    status: salesQuoteGenerationStatusEnum("status").default("queued").notNull(),

    /** Optional actor subject pointer for the generator/executor. */
    generatorSubjectBizId: idRef("generator_subject_biz_id").references(
      () => bizes.id,
    ),
    generatorSubjectType: varchar("generator_subject_type", { length: 80 }),
    generatorSubjectId: idRef("generator_subject_id"),

    /**
     * Optional canonical traceability links.
     *
     * ELI5:
     * Quote generation may be manual, rule-driven, or agent-driven.
     * These links make the run explainable regardless of who or what did it.
     */
    actionRequestId: idRef("action_request_id").references(() => actionRequests.id),
    resultingDomainEventId: idRef("resulting_domain_event_id").references(
      () => domainEvents.id,
    ),
    projectionDocumentId: idRef("projection_document_id").references(
      () => projectionDocuments.id,
    ),
    debugSnapshotId: idRef("debug_snapshot_id").references(() => debugSnapshots.id),

    /** Run start/end timestamps. */
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),

    /** Deterministic generation input snapshot. */
    inputSnapshot: jsonb("input_snapshot").default({}).notNull(),

    /** Deterministic generation output snapshot. */
    outputSnapshot: jsonb("output_snapshot").default({}).notNull(),

    /** Pricing trace used for explainability/debugging. */
    pricingTrace: jsonb("pricing_trace").default({}).notNull(),

    /** Optional error summary when failed/cancelled. */
    errorSummary: text("error_summary"),

    /** Extensible payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    salesQuoteGenerationRunsBizIdIdUnique: uniqueIndex(
      "sales_quote_generation_runs_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** Main generator operations queue path. */
    salesQuoteGenerationRunsBizStatusStartedIdx: index(
      "sales_quote_generation_runs_biz_status_started_idx",
    ).on(table.bizId, table.status, table.startedAt),

    /** Parent request timeline path. */
    salesQuoteGenerationRunsBizRequestIdx: index(
      "sales_quote_generation_runs_biz_request_idx",
    ).on(table.bizId, table.salesQuoteRequestId, table.startedAt),

    /** Trace path from action backbone into quote generation. */
    salesQuoteGenerationRunsActionRequestIdx: index(
      "sales_quote_generation_runs_action_request_idx",
    ).on(table.actionRequestId),

    /** Tenant-safe FK to request thread. */
    salesQuoteGenerationRunsBizRequestFk: foreignKey({
      columns: [table.bizId, table.salesQuoteRequestId],
      foreignColumns: [salesQuoteRequests.bizId, salesQuoteRequests.id],
      name: "sales_quote_generation_runs_biz_request_fk",
    }),

    /** Tenant-safe FK to quote thread. */
    salesQuoteGenerationRunsBizQuoteFk: foreignKey({
      columns: [table.bizId, table.salesQuoteId],
      foreignColumns: [salesQuotes.bizId, salesQuotes.id],
      name: "sales_quote_generation_runs_biz_quote_fk",
    }),

    /** Tenant-safe FK to quote version. */
    salesQuoteGenerationRunsBizQuoteVersionFk: foreignKey({
      columns: [table.bizId, table.salesQuoteVersionId],
      foreignColumns: [salesQuoteVersions.bizId, salesQuoteVersions.id],
      name: "sales_quote_generation_runs_biz_quote_version_fk",
    }),

    /** Tenant-safe FK to generator subject. */
    salesQuoteGenerationRunsGeneratorSubjectFk: foreignKey({
      columns: [table.generatorSubjectBizId, table.generatorSubjectType, table.generatorSubjectId],
      foreignColumns: [subjects.bizId, subjects.subjectType, subjects.subjectId],
      name: "sales_quote_generation_runs_generator_subject_fk",
    }),

    /** Generator subject pointer should be all-null or all-populated. */
    salesQuoteGenerationRunsGeneratorSubjectPairCheck: check(
      "sales_quote_generation_runs_generator_subject_pair_check",
      sql`
      (
        "generator_subject_biz_id" IS NULL
        AND "generator_subject_type" IS NULL
        AND "generator_subject_id" IS NULL
      ) OR (
        "generator_subject_biz_id" IS NOT NULL
        AND "generator_subject_type" IS NOT NULL
        AND "generator_subject_id" IS NOT NULL
      )
      `,
    ),

    /** Timeline sanity. */
    salesQuoteGenerationRunsTimelineCheck: check(
      "sales_quote_generation_runs_timeline_check",
      sql`"started_at" IS NULL OR "completed_at" IS NULL OR "completed_at" >= "started_at"`,
    ),
  }),
);

export type SalesQuote = typeof salesQuotes.$inferSelect;
export type NewSalesQuote = typeof salesQuotes.$inferInsert;

export type SalesQuoteVersion = typeof salesQuoteVersions.$inferSelect;
export type NewSalesQuoteVersion = typeof salesQuoteVersions.$inferInsert;

export type SalesQuoteLine = typeof salesQuoteLines.$inferSelect;
export type NewSalesQuoteLine = typeof salesQuoteLines.$inferInsert;

export type SalesQuoteAcceptance = typeof salesQuoteAcceptances.$inferSelect;
export type NewSalesQuoteAcceptance = typeof salesQuoteAcceptances.$inferInsert;

export type SalesQuoteRequest = typeof salesQuoteRequests.$inferSelect;
export type NewSalesQuoteRequest = typeof salesQuoteRequests.$inferInsert;

export type SalesQuoteGenerationRun = typeof salesQuoteGenerationRuns.$inferSelect;
export type NewSalesQuoteGenerationRun = typeof salesQuoteGenerationRuns.$inferInsert;
