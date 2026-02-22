import { sql } from "drizzle-orm";
import { check, foreignKey, index, uniqueIndex } from "drizzle-orm/pg-core";
import {
  AnyPgColumn,
  boolean,
  date,
  integer,
  jsonb,
  numeric,
  pgTable,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { createdAt, idRef, idWithTag, withAuditRefs } from "./_common";
import { bizes } from "./bizes";
import { locations } from "./locations";
import { users } from "./users";
import {
  customFieldDataTypeEnum,
  customFieldScopeEnum,
  customFieldTargetTypeEnum,
  customFieldValueSourceEnum,
  customFieldVisibilityEnum,
  extensionPermissionEffectEnum,
  extensionScopeEnum,
  extensionHookDeliveryModeEnum,
  extensionInstallStatusEnum,
  extensionRuntimeTypeEnum,
  extensionSourceTypeEnum,
  idempotencyStatusEnum,
  lifecycleEventPhaseEnum,
  lifecycleEventSourceEnum,
  lifecycleStatusEnum,
  outboxStatusEnum,
} from "./enums";
import { subjects } from "./subjects";

/**
 * extension_definitions
 *
 * ELI5:
 * This is the "app store catalog" row for an integration/plugin package.
 *
 * Why it exists:
 * - decouples extension identity/versioning from any one business install,
 * - allows multiple businesses to install the same extension definition,
 * - keeps extension capabilities discoverable and queryable.
 *
 * Tenant-boundary note:
 * - this table intentionally has no `biz_id` because it is a global catalog,
 * - tenant isolation starts at `biz_extension_installs`.
 */
export const extensionDefinitions = pgTable(
  "extension_definitions",
  {
    /** Stable primary key for one extension package definition. */
    id: idWithTag("extension"),

    /**
     * Stable machine key (for code/config lookups).
     * Example: `classpass_sync`, `google_reserve`, `acme_custom_policy`.
     */
    key: varchar("key", { length: 140 }).notNull(),

    /** Human readable label shown in admin catalogs. */
    name: varchar("name", { length: 200 }).notNull(),

    /** Publisher display name for trust and support routing. */
    publisher: varchar("publisher", { length: 200 }),

    /** Where this extension comes from (first party vs partner vs 3rd party). */
    sourceType: extensionSourceTypeEnum("source_type").notNull(),

    /**
     * Primary runtime model used by this extension.
     * Internal runtime means hooks run inside Bizing workers.
     */
    runtimeType: extensionRuntimeTypeEnum("runtime_type").notNull(),

    /** Lifecycle for this definition in the global catalog. */
    status: lifecycleStatusEnum("status").default("active").notNull(),

    /** Current package version string (semver or publisher-specific). */
    currentVersion: varchar("current_version", { length: 80 }),

    /** Optional support/docs URL for operators. */
    docsUrl: varchar("docs_url", { length: 1000 }),

    /** Optional homepage/landing page for this extension. */
    homepageUrl: varchar("homepage_url", { length: 1000 }),

    /** Short explanation of what this extension does. */
    description: varchar("description", { length: 2000 }),

    /**
     * Manifest payload (declared hook points, permission scopes, setup schema).
     * Kept as JSON so extension contract can evolve without table churn.
     */
    manifest: jsonb("manifest").default({}).notNull(),

    /** Capability hints used by setup UIs and policy engines. */
    capabilities: jsonb("capabilities").default({}).notNull(),

    /** Extension-defined non-indexed metadata. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata for catalog governance changes. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Fast lookup by machine key. */
    extensionDefinitionsKeyUnique: uniqueIndex("extension_definitions_key_unique").on(
      table.key,
    ),

    /** Common catalog listing path. */
    extensionDefinitionsStatusSourceIdx: index(
      "extension_definitions_status_source_idx",
    ).on(table.status, table.sourceType),
  }),
);

/**
 * biz_extension_installs
 *
 * ELI5:
 * One row says "this business installed this extension with this config".
 *
 * Why separate from `extension_definitions`:
 * - definition is the reusable template,
 * - install row is tenant-specific state/config/health.
 */
export const bizExtensionInstalls = pgTable(
  "biz_extension_installs",
  {
    /** Stable primary key for this tenant install. */
    id: idWithTag("ext_install"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Pointer to the installed catalog definition. */
    extensionDefinitionId: idRef("extension_definition_id")
      .references(() => extensionDefinitions.id)
      .notNull(),

    /** Installation state at tenant level. */
    status: extensionInstallStatusEnum("status").default("active").notNull(),

    /** Installed/pinned extension version for deterministic behavior. */
    installedVersion: varchar("installed_version", { length: 80 }).notNull(),

    /** Tenant-level public configuration payload (non-secret). */
    configuration: jsonb("configuration").default({}).notNull(),

    /**
     * Reference to secret material in external secret manager.
     * Keep secrets out of app DB rows.
     */
    secretRef: varchar("secret_ref", { length: 255 }),

    /** Operational health timestamp from periodic extension probes. */
    lastHealthcheckAt: timestamp("last_healthcheck_at", { withTimezone: true }),

    /** Last health probe result summary. */
    lastHealthStatus: varchar("last_health_status", { length: 80 }),

    /** Business-meaningful installation timestamp. */
    installedAt: timestamp("installed_at", { withTimezone: true })
      .defaultNow()
      .notNull(),

    /** Extension-specific metadata and diagnostics pointers. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata for install lifecycle changes. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite unique key used by tenant-safe extension FKs. */
    bizExtensionInstallsBizIdIdUnique: uniqueIndex(
      "biz_extension_installs_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** Prevent duplicate install rows for same extension in one tenant. */
    bizExtensionInstallsBizExtensionUnique: uniqueIndex(
      "biz_extension_installs_biz_extension_unique",
    ).on(table.bizId, table.extensionDefinitionId),

    /** Common admin query path (installed/disabled/suspended lists). */
    bizExtensionInstallsBizStatusIdx: index("biz_extension_installs_biz_status_idx").on(
      table.bizId,
      table.status,
    ),
  }),
);

/**
 * extension_permission_definitions
 *
 * ELI5:
 * This table is the explicit permission contract published by an extension.
 *
 * Why this exists:
 * - `manifest` JSON is flexible, but hard to enforce in SQL.
 * - Permission definitions give us normalized, queryable policy contracts.
 * - Admin UI can show clear "what this extension can do" rows.
 *
 * Design:
 * - global catalog-level table (no `biz_id`) because permission definitions are
 *   part of extension package metadata, not tenant runtime state.
 */
export const extensionPermissionDefinitions = pgTable(
  "extension_permission_definitions",
  {
    /** Stable primary key for one permission definition. */
    id: idWithTag("ext_perm"),

    /** Parent extension definition that owns this permission. */
    extensionDefinitionId: idRef("extension_definition_id")
      .references(() => extensionDefinitions.id)
      .notNull(),

    /**
     * Stable machine key inside the extension namespace.
     *
     * Examples:
     * - `read.calendar`
     * - `write.availability`
     * - `post.webhook`
     */
    permissionKey: varchar("permission_key", { length: 160 }).notNull(),

    /** Human-readable permission name shown in admin consent UI. */
    name: varchar("name", { length: 220 }).notNull(),

    /** Optional plain-language explanation of what this permission allows. */
    description: varchar("description", { length: 2000 }),

    /** Scope this permission can be granted at. */
    scope: extensionScopeEnum("scope").default("biz").notNull(),

    /**
     * Required means install cannot run safely without an explicit grant.
     * Optional permissions can remain denied and extension still works partially.
     */
    isRequired: boolean("is_required").default(false).notNull(),

    /** Default consent effect suggested to installers. */
    defaultEffect: extensionPermissionEffectEnum("default_effect")
      .default("deny")
      .notNull(),

    /**
     * Relative risk level used by policy/approval flows (1 low .. 5 high).
     * This is intentionally generic and not tied to one industry.
     */
    riskLevel: integer("risk_level").default(2).notNull(),

    /** Lifecycle status of the permission definition itself. */
    status: lifecycleStatusEnum("status").default("active").notNull(),

    /** Extension payload for future contract details (data classes, etc.). */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** One permission key per extension definition. */
    extensionPermissionDefinitionsUnique: uniqueIndex(
      "extension_permission_definitions_unique",
    ).on(table.extensionDefinitionId, table.permissionKey),

    /** Listing/filter path used by consent and review tooling. */
    extensionPermissionDefinitionsStatusScopeIdx: index(
      "extension_permission_definitions_status_scope_idx",
    ).on(table.status, table.scope, table.isRequired),

    /** Risk level sanity range. */
    extensionPermissionDefinitionsRiskCheck: check(
      "extension_permission_definitions_risk_check",
      sql`"risk_level" >= 1 AND "risk_level" <= 5`,
    ),
  }),
);

/**
 * biz_extension_permission_grants
 *
 * ELI5:
 * One row says "this tenant granted/denied this permission for this scope".
 *
 * Why this exists:
 * - Separates extension install lifecycle from runtime permission policy.
 * - Supports granular grants (whole biz, one location, or one custom subject).
 * - Creates a stable policy backbone for plugins and third-party apps.
 */
export const bizExtensionPermissionGrants = pgTable(
  "biz_extension_permission_grants",
  {
    /** Stable primary key for one grant decision row. */
    id: idWithTag("ext_grant"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Tenant extension install that this grant applies to. */
    bizExtensionInstallId: idRef("biz_extension_install_id")
      .references(() => bizExtensionInstalls.id)
      .notNull(),

    /** Permission definition being granted/denied. */
    extensionPermissionDefinitionId: idRef("extension_permission_definition_id")
      .references(() => extensionPermissionDefinitions.id)
      .notNull(),

    /** Scope snapshot for deterministic grant resolution. */
    scope: extensionScopeEnum("scope").default("biz").notNull(),

    /**
     * Canonical scope key used for deterministic uniqueness.
     *
     * Shape by scope:
     * - `biz`
     * - `location:{location_id}`
     * - `subject:{subject_ref_type}:{subject_ref_id}`
     */
    scopeRefKey: varchar("scope_ref_key", { length: 300 }).notNull(),

    /** Location payload for `scope=location`. */
    locationId: idRef("location_id").references(() => locations.id),

    /** Custom-subject payload for `scope=custom_subject`. */
    subjectRefType: varchar("subject_ref_type", { length: 80 }),
    subjectRefId: idRef("subject_ref_id"),

    /** Allow or deny decision at the given scope. */
    effect: extensionPermissionEffectEnum("effect").notNull(),

    /** Lifecycle state for revocation/suspension flows. */
    status: lifecycleStatusEnum("status").default("active").notNull(),

    /** Optional actor who made this policy decision. */
    grantedByUserId: idRef("granted_by_user_id").references(() => users.id),

    /** Business timestamp for when grant was decided. */
    grantedAt: timestamp("granted_at", { withTimezone: true }).defaultNow().notNull(),

    /** Optional expiry timestamp for temporary grants. */
    expiresAt: timestamp("expires_at", { withTimezone: true }),

    /** Optional reason text for audit and policy review tooling. */
    reason: varchar("reason", { length: 1200 }),

    /** Extension payload for policy engine details. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite key for tenant-safe references. */
    bizExtensionPermissionGrantsBizIdIdUnique: uniqueIndex(
      "biz_extension_permission_grants_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** One active grant decision per (install, permission, scope key). */
    bizExtensionPermissionGrantsUnique: uniqueIndex(
      "biz_extension_permission_grants_unique",
    )
      .on(
        table.bizId,
        table.bizExtensionInstallId,
        table.extensionPermissionDefinitionId,
        table.scopeRefKey,
      )
      .where(sql`"deleted_at" IS NULL`),

    /** Policy lookup path used by permission evaluators. */
    bizExtensionPermissionGrantsBizInstallStatusIdx: index(
      "biz_extension_permission_grants_biz_install_status_idx",
    ).on(table.bizId, table.bizExtensionInstallId, table.status, table.scope),

    /** Grant expiry sweep path. */
    bizExtensionPermissionGrantsBizExpiryIdx: index(
      "biz_extension_permission_grants_biz_expiry_idx",
    ).on(table.bizId, table.expiresAt),

    /** Tenant-safe FK to extension install owner. */
    bizExtensionPermissionGrantsBizInstallFk: foreignKey({
      columns: [table.bizId, table.bizExtensionInstallId],
      foreignColumns: [bizExtensionInstalls.bizId, bizExtensionInstalls.id],
      name: "biz_extension_permission_grants_biz_install_fk",
    }),

    /** Tenant-safe FK to optional location scope anchor. */
    bizExtensionPermissionGrantsBizLocationFk: foreignKey({
      columns: [table.bizId, table.locationId],
      foreignColumns: [locations.bizId, locations.id],
      name: "biz_extension_permission_grants_biz_location_fk",
    }),

    /** Tenant-safe FK to optional custom subject scope anchor. */
    bizExtensionPermissionGrantsBizSubjectFk: foreignKey({
      columns: [table.bizId, table.subjectRefType, table.subjectRefId],
      foreignColumns: [subjects.bizId, subjects.subjectType, subjects.subjectId],
      name: "biz_extension_permission_grants_biz_subject_fk",
    }),

    /** Scope payload must match scope mode exactly. */
    bizExtensionPermissionGrantsScopeShapeCheck: check(
      "biz_extension_permission_grants_scope_shape_check",
      sql`
      (
        "scope" = 'biz'
        AND "location_id" IS NULL
        AND "subject_ref_type" IS NULL
        AND "subject_ref_id" IS NULL
        AND "scope_ref_key" = 'biz'
      ) OR (
        "scope" = 'location'
        AND "location_id" IS NOT NULL
        AND "subject_ref_type" IS NULL
        AND "subject_ref_id" IS NULL
        AND "scope_ref_key" = ('location:' || "location_id")
      ) OR (
        "scope" = 'custom_subject'
        AND "location_id" IS NULL
        AND "subject_ref_type" IS NOT NULL
        AND "subject_ref_id" IS NOT NULL
        AND "scope_ref_key" = ('subject:' || "subject_ref_type" || ':' || "subject_ref_id")
      )
      `,
    ),

    /** Expiry must not be before grant creation. */
    bizExtensionPermissionGrantsExpiryCheck: check(
      "biz_extension_permission_grants_expiry_check",
      sql`"expires_at" IS NULL OR "expires_at" >= "granted_at"`,
    ),
  }),
);

/**
 * extension_state_documents
 *
 * ELI5:
 * This is the extension-owned state store with deterministic scoping.
 *
 * Why this exists:
 * - plugins often need durable state/checkpoints/caches,
 * - storing that state in many ad-hoc per-plugin tables adds migration churn,
 * - storing everything in one unscoped JSON blob is unsafe and hard to govern.
 *
 * This table gives:
 * - explicit tenant + install ownership,
 * - explicit scope (biz/location/custom subject),
 * - optimistic versioning,
 * - optional linkage to lifecycle events for replay/checkpoint logic.
 */
export const extensionStateDocuments = pgTable(
  "extension_state_documents",
  {
    /** Stable primary key for one state document. */
    id: idWithTag("ext_state"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Owning extension install for this state record. */
    bizExtensionInstallId: idRef("biz_extension_install_id")
      .references(() => bizExtensionInstalls.id)
      .notNull(),

    /** Logical namespace inside extension (example: `sync_cursor`). */
    namespace: varchar("namespace", { length: 120 }).notNull(),

    /** Stable key within namespace (example: `google_calendar_primary`). */
    documentKey: varchar("document_key", { length: 180 }).notNull(),

    /** Scope model for this document. */
    scope: extensionScopeEnum("scope").default("biz").notNull(),

    /** Canonical scope key, same shape rules as grants. */
    scopeRefKey: varchar("scope_ref_key", { length: 300 }).notNull(),

    /** Location payload when `scope=location`. */
    locationId: idRef("location_id").references(() => locations.id),

    /** Custom-subject payload when `scope=custom_subject`. */
    subjectRefType: varchar("subject_ref_type", { length: 80 }),
    subjectRefId: idRef("subject_ref_id"),

    /** Lifecycle state of this state document. */
    status: lifecycleStatusEnum("status").default("active").notNull(),

    /** Optimistic revision counter for deterministic updates. */
    revision: integer("revision").default(1).notNull(),

    /** Extension-managed schema version of payload. */
    schemaVersion: integer("schema_version").default(1).notNull(),

    /** Optional last lifecycle event processed into this state. */
    lastLifecycleEventId: idRef("last_lifecycle_event_id").references(
      () => lifecycleEvents.id,
    ),

    /** Optional timestamp of last successful materialization/update. */
    lastMaterializedAt: timestamp("last_materialized_at", { withTimezone: true }),

    /** Canonical extension state payload. */
    payload: jsonb("payload").default({}).notNull(),

    /** Optional checksum/hash for external integrity validation. */
    payloadChecksum: varchar("payload_checksum", { length: 128 }),

    /** Extension payload for non-core state metadata. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite key for tenant-safe references. */
    extensionStateDocumentsBizIdIdUnique: uniqueIndex(
      "extension_state_documents_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** One document identity per (install, namespace, key, scope key). */
    extensionStateDocumentsUnique: uniqueIndex("extension_state_documents_unique").on(
      table.bizId,
      table.bizExtensionInstallId,
      table.namespace,
      table.documentKey,
      table.scopeRefKey,
    )
      .where(sql`"deleted_at" IS NULL`),

    /** Sync/checkpoint read path by install namespace. */
    extensionStateDocumentsBizInstallNamespaceIdx: index(
      "extension_state_documents_biz_install_namespace_idx",
    ).on(table.bizId, table.bizExtensionInstallId, table.namespace, table.status),

    /** Scope-focused lookup path for extension policy/state resolution. */
    extensionStateDocumentsBizScopeIdx: index("extension_state_documents_biz_scope_idx").on(
      table.bizId,
      table.scope,
      table.scopeRefKey,
      table.status,
    ),

    /** Tenant-safe FK to extension install owner. */
    extensionStateDocumentsBizInstallFk: foreignKey({
      columns: [table.bizId, table.bizExtensionInstallId],
      foreignColumns: [bizExtensionInstalls.bizId, bizExtensionInstalls.id],
      name: "extension_state_documents_biz_install_fk",
    }),

    /** Tenant-safe FK to optional location scope anchor. */
    extensionStateDocumentsBizLocationFk: foreignKey({
      columns: [table.bizId, table.locationId],
      foreignColumns: [locations.bizId, locations.id],
      name: "extension_state_documents_biz_location_fk",
    }),

    /** Tenant-safe FK to optional custom subject scope anchor. */
    extensionStateDocumentsBizSubjectFk: foreignKey({
      columns: [table.bizId, table.subjectRefType, table.subjectRefId],
      foreignColumns: [subjects.bizId, subjects.subjectType, subjects.subjectId],
      name: "extension_state_documents_biz_subject_fk",
    }),

    /** Tenant-safe FK to optional lifecycle event checkpoint. */
    extensionStateDocumentsBizLifecycleEventFk: foreignKey({
      columns: [table.bizId, table.lastLifecycleEventId],
      foreignColumns: [lifecycleEvents.bizId, lifecycleEvents.id],
      name: "extension_state_documents_biz_lifecycle_event_fk",
    }),

    /** Scope payload must match scope mode exactly. */
    extensionStateDocumentsScopeShapeCheck: check(
      "extension_state_documents_scope_shape_check",
      sql`
      (
        "scope" = 'biz'
        AND "location_id" IS NULL
        AND "subject_ref_type" IS NULL
        AND "subject_ref_id" IS NULL
        AND "scope_ref_key" = 'biz'
      ) OR (
        "scope" = 'location'
        AND "location_id" IS NOT NULL
        AND "subject_ref_type" IS NULL
        AND "subject_ref_id" IS NULL
        AND "scope_ref_key" = ('location:' || "location_id")
      ) OR (
        "scope" = 'custom_subject'
        AND "location_id" IS NULL
        AND "subject_ref_type" IS NOT NULL
        AND "subject_ref_id" IS NOT NULL
        AND "scope_ref_key" = ('subject:' || "subject_ref_type" || ':' || "subject_ref_id")
      )
      `,
    ),

    /** Non-empty keys and positive revision counters. */
    extensionStateDocumentsKeysAndRevisionCheck: check(
      "extension_state_documents_keys_and_revision_check",
      sql`
      length("namespace") > 0
      AND length("document_key") > 0
      AND "revision" >= 1
      AND "schema_version" >= 1
      `,
    ),
  }),
);

/**
 * lifecycle_events
 *
 * ELI5:
 * This is the append-only timeline of "important business events happened".
 *
 * Important distinction:
 * - `audit_events` answers "who changed what for compliance".
 * - `lifecycle_events` answers "what domain event happened for automation/hooks".
 *
 * Examples:
 * - `booking_order.created`
 * - `payment_intent.succeeded`
 * - `fulfillment_unit.checked_in`
 */
export const lifecycleEvents = pgTable(
  "lifecycle_events",
  {
    /** Stable primary key for one event message. */
    id: idWithTag("lifecycle_event"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Source category for debugging pipelines. */
    sourceType: lifecycleEventSourceEnum("source_type").notNull(),

    /** Versioned event name used by subscriptions and consumers. */
    eventName: varchar("event_name", { length: 200 }).notNull(),

    /** Event contract version (starts at 1). */
    eventVersion: integer("event_version").default(1).notNull(),

    /** Primary entity class this event describes. */
    entityType: varchar("entity_type", { length: 120 }).notNull(),

    /** Primary entity id this event describes. */
    entityId: varchar("entity_id", { length: 140 }).notNull(),

    /** Optional aggregate/parent root type for grouped workflows. */
    aggregateType: varchar("aggregate_type", { length: 120 }),

    /** Optional aggregate/parent root id for grouped workflows. */
    aggregateId: varchar("aggregate_id", { length: 140 }),

    /** Event occurrence timestamp from business perspective. */
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .defaultNow()
      .notNull(),

    /** Optional actor user pointer when triggered by a user action. */
    actorUserId: idRef("actor_user_id").references(() => users.id),

    /** Correlation id to stitch all events from one request or workflow run. */
    correlationId: varchar("correlation_id", { length: 200 }),

    /** Optional previous/causing lifecycle event id. */
    causationEventId: idRef("causation_event_id").references(
      (): AnyPgColumn => lifecycleEvents.id,
    ),

    /** Optional caller-provided dedupe key. */
    idempotencyKey: varchar("idempotency_key", { length: 200 }),

    /** Event payload consumed by hooks/automations/integrations. */
    payload: jsonb("payload").default({}).notNull(),

    /** Event metadata (trace ids, schema fingerprints, etc.). */
    metadata: jsonb("metadata").default({}),

    /**
     * Event row write timestamp.
     *
     * This intentionally uses one-way created time because lifecycle events are
     * designed to be append-only operational facts.
     */
    recordedAt: createdAt,
  },
  (table) => ({
    lifecycleEventsBizIdIdUnique: uniqueIndex("lifecycle_events_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Composite unique key used by tenant-safe delivery FKs. */

    /** Fast event feed query by topic. */
    lifecycleEventsBizEventOccurredIdx: index("lifecycle_events_biz_event_occurred_idx").on(
      table.bizId,
      table.eventName,
      table.occurredAt,
    ),

    /** Fast event lookup by primary entity. */
    lifecycleEventsBizEntityOccurredIdx: index("lifecycle_events_biz_entity_occurred_idx").on(
      table.bizId,
      table.entityType,
      table.entityId,
      table.occurredAt,
    ),

    /** Optional dedupe key guard for publishers that retry event writes. */
    lifecycleEventsBizIdempotencyUnique: uniqueIndex(
      "lifecycle_events_biz_idempotency_unique",
    )
      .on(table.bizId, table.idempotencyKey)
      .where(sql`"idempotency_key" IS NOT NULL`),

    /** Event version must be positive. */
    lifecycleEventsVersionCheck: check(
      "lifecycle_events_version_check",
      sql`"event_version" >= 1`,
    ),
  }),
);

/**
 * lifecycle_event_subscriptions
 *
 * ELI5:
 * This table is the "listen for these events" rulebook.
 *
 * A subscription can point to:
 * - internal handler key (same app/plugin runtime),
 * - webhook URL (external service runtime).
 */
export const lifecycleEventSubscriptions = pgTable(
  "lifecycle_event_subscriptions",
  {
    /** Stable primary key for one subscription rule. */
    id: idWithTag("event_sub"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /**
     * Optional tenant extension owner.
     * Null allows first-party/internal platform subscriptions.
     */
    bizExtensionInstallId: idRef("biz_extension_install_id").references(
      () => bizExtensionInstalls.id,
    ),

    /** Human-readable name in ops/admin UI. */
    name: varchar("name", { length: 200 }).notNull(),

    /** Lifecycle status of this subscription rule. */
    status: lifecycleStatusEnum("status").default("active").notNull(),

    /** Event pattern selector (exact topic or wildcard convention). */
    eventPattern: varchar("event_pattern", { length: 200 }).notNull(),

    /** Run before or after the main domain commit action. */
    phase: lifecycleEventPhaseEnum("phase").default("after").notNull(),

    /** Internal handler vs external webhook delivery. */
    deliveryMode: extensionHookDeliveryModeEnum("delivery_mode").notNull(),

    /** Internal handler key, required when `delivery_mode=internal_handler`. */
    internalHandlerKey: varchar("internal_handler_key", { length: 200 }),

    /** HTTPS endpoint, required when `delivery_mode=webhook`. */
    webhookUrl: varchar("webhook_url", { length: 1000 }),

    /** Secret reference used for signing outbound webhook payloads. */
    signingSecretRef: varchar("signing_secret_ref", { length: 255 }),

    /** Max handler runtime before considering attempt failed. */
    timeoutMs: integer("timeout_ms").default(10000).notNull(),

    /** Max delivery attempts before dead-lettering. */
    maxAttempts: integer("max_attempts").default(8).notNull(),

    /** Structured retry settings (backoff curve, jitter, etc.). */
    retryPolicy: jsonb("retry_policy").default({}).notNull(),

    /** Structured filter predicate payload evaluated before dispatch. */
    filter: jsonb("filter").default({}).notNull(),

    /** Extension payload for future routing features. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata for subscription lifecycle management. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite unique key used by tenant-safe delivery FKs. */
    lifecycleEventSubscriptionsBizIdIdUnique: uniqueIndex(
      "lifecycle_event_subscriptions_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** Prevent duplicate subscription names in same tenant. */
    lifecycleEventSubscriptionsBizNameUnique: uniqueIndex(
      "lifecycle_event_subscriptions_biz_name_unique",
    ).on(table.bizId, table.name),

    /** Event router lookup path. */
    lifecycleEventSubscriptionsBizStatusPatternIdx: index(
      "lifecycle_event_subscriptions_biz_status_pattern_idx",
    ).on(table.bizId, table.status, table.eventPattern, table.phase),

    /** Tenant-safe FK to optional extension install owner. */
    lifecycleEventSubscriptionsBizInstallFk: foreignKey({
      columns: [table.bizId, table.bizExtensionInstallId],
      foreignColumns: [bizExtensionInstalls.bizId, bizExtensionInstalls.id],
      name: "lifecycle_event_subscriptions_biz_install_fk",
    }),

    /** Timeout bounds to avoid runaway workers. */
    lifecycleEventSubscriptionsTimeoutBoundsCheck: check(
      "lifecycle_event_subscriptions_timeout_bounds_check",
      sql`"timeout_ms" >= 100 AND "timeout_ms" <= 300000`,
    ),

    /** Retry attempt bounds for sane scheduler behavior. */
    lifecycleEventSubscriptionsMaxAttemptsCheck: check(
      "lifecycle_event_subscriptions_max_attempts_check",
      sql`"max_attempts" >= 1 AND "max_attempts" <= 100`,
    ),

    /**
     * Delivery target shape by mode.
     * Ensures only valid routing fields are filled for each mode.
     */
    lifecycleEventSubscriptionsDeliveryShapeCheck: check(
      "lifecycle_event_subscriptions_delivery_shape_check",
      sql`
      (
        "delivery_mode" = 'internal_handler'
        AND "internal_handler_key" IS NOT NULL
        AND "webhook_url" IS NULL
        AND "signing_secret_ref" IS NULL
      ) OR (
        "delivery_mode" = 'webhook'
        AND "internal_handler_key" IS NULL
        AND "webhook_url" IS NOT NULL
      )
      `,
    ),
  }),
);

/**
 * lifecycle_event_deliveries
 *
 * ELI5:
 * One row tracks delivery state of one event to one subscription.
 *
 * This is the normalized outbox spine for hook delivery:
 * - pending/processing/retry/dead-letter,
 * - retry counters and errors,
 * - transport payload snapshots.
 */
export const lifecycleEventDeliveries = pgTable(
  "lifecycle_event_deliveries",
  {
    /** Stable primary key for this delivery state row. */
    id: idWithTag("event_delivery"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Event being delivered. */
    lifecycleEventId: idRef("lifecycle_event_id")
      .references(() => lifecycleEvents.id)
      .notNull(),

    /** Subscription receiving this event. */
    lifecycleEventSubscriptionId: idRef("lifecycle_event_subscription_id")
      .references(() => lifecycleEventSubscriptions.id)
      .notNull(),

    /** Delivery state machine for retry workers and monitors. */
    status: outboxStatusEnum("status").default("pending").notNull(),

    /** Number of attempts already made. */
    attemptCount: integer("attempt_count").default(0).notNull(),

    /** Earliest next execution time for retry scheduler. */
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true })
      .defaultNow()
      .notNull(),

    /** Lease timestamp when a worker claims this row. */
    lockedAt: timestamp("locked_at", { withTimezone: true }),

    /** Success publish timestamp. */
    publishedAt: timestamp("published_at", { withTimezone: true }),

    /** Dead-letter timestamp for terminal failures. */
    deadLetteredAt: timestamp("dead_lettered_at", { withTimezone: true }),

    /** Optional HTTP status code for webhook mode. */
    httpStatus: integer("http_status"),

    /** Normalized error code for dashboarding and alerting. */
    lastErrorCode: varchar("last_error_code", { length: 120 }),

    /** Human-readable latest error summary. */
    lastErrorMessage: varchar("last_error_message", { length: 2000 }),

    /** Outgoing payload snapshot (after filtering/transforms). */
    requestPayload: jsonb("request_payload").default({}).notNull(),

    /** Optional response payload snapshot for debugging. */
    responsePayload: jsonb("response_payload"),

    /** Optional dedupe key for downstream connectors. */
    idempotencyKey: varchar("idempotency_key", { length: 200 }),

    /** Extension payload for transport-specific state. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata for retry operations and manual interventions. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    lifecycleEventDeliveriesBizIdIdUnique: uniqueIndex("lifecycle_event_deliveries_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Prevent duplicate delivery rows per (event, subscription) pair. */
    lifecycleEventDeliveriesBizEventSubscriptionUnique: uniqueIndex(
      "lifecycle_event_deliveries_biz_event_subscription_unique",
    ).on(table.bizId, table.lifecycleEventId, table.lifecycleEventSubscriptionId),

    /** Optional dedupe key for connectors that require idempotent publish ids. */
    lifecycleEventDeliveriesBizIdempotencyUnique: uniqueIndex(
      "lifecycle_event_deliveries_biz_idempotency_unique",
    )
      .on(table.bizId, table.idempotencyKey)
      .where(sql`"idempotency_key" IS NOT NULL`),

    /** Worker pickup path for due deliveries. */
    lifecycleEventDeliveriesBizStatusNextAttemptIdx: index(
      "lifecycle_event_deliveries_biz_status_next_attempt_idx",
    ).on(table.bizId, table.status, table.nextAttemptAt),

    /** Subscription-level troubleshooting path. */
    lifecycleEventDeliveriesBizSubscriptionStatusIdx: index(
      "lifecycle_event_deliveries_biz_subscription_status_idx",
    ).on(table.bizId, table.lifecycleEventSubscriptionId, table.status),

    /** Tenant-safe FK to lifecycle event. */
    lifecycleEventDeliveriesBizEventFk: foreignKey({
      columns: [table.bizId, table.lifecycleEventId],
      foreignColumns: [lifecycleEvents.bizId, lifecycleEvents.id],
      name: "lifecycle_event_deliveries_biz_event_fk",
    }),

    /** Tenant-safe FK to lifecycle subscription. */
    lifecycleEventDeliveriesBizSubscriptionFk: foreignKey({
      columns: [table.bizId, table.lifecycleEventSubscriptionId],
      foreignColumns: [lifecycleEventSubscriptions.bizId, lifecycleEventSubscriptions.id],
      name: "lifecycle_event_deliveries_biz_subscription_fk",
    }),

    /** Attempt counters must remain non-negative. */
    lifecycleEventDeliveriesAttemptCountCheck: check(
      "lifecycle_event_deliveries_attempt_count_check",
      sql`"attempt_count" >= 0`,
    ),

    /** HTTP status, when present, should be a valid HTTP code range. */
    lifecycleEventDeliveriesHttpStatusCheck: check(
      "lifecycle_event_deliveries_http_status_check",
      sql`"http_status" IS NULL OR ("http_status" >= 100 AND "http_status" <= 599)`,
    ),
  }),
);

/**
 * idempotency_keys
 *
 * ELI5:
 * Shared "did we already process this request?" table across all APIs/workers.
 *
 * Why global:
 * - removes one-off idempotency implementations scattered across domains,
 * - enables consistent retry behavior for API + async job flows.
 */
export const idempotencyKeys = pgTable(
  "idempotency_keys",
  {
    /** Stable primary key for internal references. */
    id: idWithTag("idempotency"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Logical namespace (route/job/worker keyspace) to avoid collisions. */
    scope: varchar("scope", { length: 160 }).notNull(),

    /** Client/producer-provided idempotency key. */
    idempotencyKey: varchar("idempotency_key", { length: 200 }).notNull(),

    /** Processing state for this key. */
    status: idempotencyStatusEnum("status").default("processing").notNull(),

    /** Optional deterministic request hash for mismatch detection. */
    requestHash: varchar("request_hash", { length: 128 }),

    /** Optional stable response status code on completion. */
    responseCode: integer("response_code"),

    /** Optional stable response snapshot for replaying exact response. */
    responseBody: jsonb("response_body"),

    /** Optional normalized error code for failed runs. */
    errorCode: varchar("error_code", { length: 120 }),

    /** Optional error summary for observability. */
    errorMessage: varchar("error_message", { length: 2000 }),

    /** Short lock lease for worker coordination. */
    lockedUntil: timestamp("locked_until", { withTimezone: true }),

    /** First time this key was observed. */
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true })
      .defaultNow()
      .notNull(),

    /** Completion timestamp for successful/failed terminal states. */
    completedAt: timestamp("completed_at", { withTimezone: true }),

    /** Extra diagnostics/context payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata for recovery/admin overrides. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    idempotencyKeysBizIdIdUnique: uniqueIndex("idempotency_keys_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Composite key for tenant-safe references to this idempotency row. */

    /** One key per scope inside one tenant. */
    idempotencyKeysBizScopeKeyUnique: uniqueIndex(
      "idempotency_keys_biz_scope_key_unique",
    ).on(table.bizId, table.scope, table.idempotencyKey),

    /** Worker/API lookup path. */
    idempotencyKeysBizScopeStatusIdx: index("idempotency_keys_biz_scope_status_idx").on(
      table.bizId,
      table.scope,
      table.status,
    ),

    /** Optional response code sanity range. */
    idempotencyKeysResponseCodeCheck: check(
      "idempotency_keys_response_code_check",
      sql`
      "response_code" IS NULL OR ("response_code" >= 100 AND "response_code" <= 599)
      `,
    ),
  }),
);

/**
 * extension_service_connections
 *
 * ELI5:
 * This is the generic "connected external service account" table for extensions.
 *
 * Why this exists:
 * - Twilio/HubSpot/ClickUp/custom internal APIs share the same connection shape,
 * - keeps external-account wiring reusable across all plugin domains,
 * - avoids creating one-off connection tables for every new integration.
 */
export const extensionServiceConnections = pgTable(
  "extension_service_connections",
  {
    /** Stable primary key. */
    id: idWithTag("ext_service_conn"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Owning extension install. */
    bizExtensionInstallId: idRef("biz_extension_install_id")
      .references(() => bizExtensionInstalls.id)
      .notNull(),

    /** Stable connection key inside one extension install. */
    connectionKey: varchar("connection_key", { length: 140 }).notNull(),

    /** Human display name shown in integration UIs. */
    name: varchar("name", { length: 200 }).notNull(),

    /** Provider/service key (twilio, hubspot, clickup, custom_internal_api, etc.). */
    providerKey: varchar("provider_key", { length: 120 }).notNull(),

    /** High-level service family for filtering and policy grouping. */
    serviceCategory: varchar("service_category", { length: 80 }).default("api").notNull(),

    /** Lifecycle state of this connection. */
    status: lifecycleStatusEnum("status").default("active").notNull(),

    /** Auth strategy used by integration runtime. */
    authMode: varchar("auth_mode", { length: 60 }).default("oauth2").notNull(),

    /** Provider-side account/workspace id when available. */
    externalAccountRef: varchar("external_account_ref", { length: 255 }),

    /** Secret reference to credentials stored outside DB. */
    secretRef: varchar("secret_ref", { length: 255 }),

    /** Granted permission scopes (OAuth scopes, API scopes, etc.). */
    scopes: jsonb("scopes").default([]).notNull(),

    /** Provider/runtime capability mirrors. */
    capabilities: jsonb("capabilities").default({}).notNull(),

    /** Sync cursor/checkpoint payload for incremental sync integrations. */
    syncCursor: jsonb("sync_cursor").default({}).notNull(),

    /** Last successful API/sync operation timestamp. */
    lastSuccessfulAt: timestamp("last_successful_at", { withTimezone: true }),

    /** Last failed API/sync operation timestamp. */
    lastFailedAt: timestamp("last_failed_at", { withTimezone: true }),

    /** Optional latest failure summary. */
    lastFailureReason: varchar("last_failure_reason", { length: 1000 }),

    /** Extensible metadata payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite key for tenant-safe references from child integration tables. */
    extensionServiceConnectionsBizIdIdUnique: uniqueIndex(
      "extension_service_connections_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /**
     * One active connection key per extension install in one tenant.
     *
     * Soft-deleted rows are excluded so operators can archive/disconnect and
     * recreate the same logical connection key later without manual cleanup.
     */
    extensionServiceConnectionsBizInstallKeyUnique: uniqueIndex(
      "extension_service_connections_biz_install_key_unique",
    )
      .on(table.bizId, table.bizExtensionInstallId, table.connectionKey)
      .where(sql`"deleted_at" IS NULL`),

    /**
     * Dedupe active external account references inside one tenant/provider namespace.
     *
     * Soft-deleted rows are excluded to allow clean reconnect/re-authorize flows.
     */
    extensionServiceConnectionsBizProviderAccountUnique: uniqueIndex(
      "extension_service_connections_biz_provider_account_unique",
    )
      .on(table.bizId, table.providerKey, table.externalAccountRef)
      .where(sql`"external_account_ref" IS NOT NULL AND "deleted_at" IS NULL`),

    /** Common list/ops path. */
    extensionServiceConnectionsBizStatusProviderIdx: index(
      "extension_service_connections_biz_status_provider_idx",
    ).on(table.bizId, table.status, table.providerKey, table.serviceCategory),

    /** Tenant-safe FK to owning extension install. */
    extensionServiceConnectionsBizInstallFk: foreignKey({
      columns: [table.bizId, table.bizExtensionInstallId],
      foreignColumns: [bizExtensionInstalls.bizId, bizExtensionInstalls.id],
      name: "extension_service_connections_biz_install_fk",
    }),

    /** Basic provider/connection key quality checks. */
    extensionServiceConnectionsKeysCheck: check(
      "extension_service_connections_keys_check",
      sql`length("provider_key") > 0 AND length("connection_key") > 0`,
    ),

    /** Category vocabulary with custom_* escape hatch. */
    extensionServiceConnectionsCategoryCheck: check(
      "extension_service_connections_category_check",
      sql`
      "service_category" IN (
        'api',
        'messaging',
        'crm',
        'project_management',
        'calendar',
        'payments',
        'storage',
        'other'
      )
      OR "service_category" LIKE 'custom_%'
      `,
    ),

    /** Auth mode vocabulary with custom_* escape hatch. */
    extensionServiceConnectionsAuthModeCheck: check(
      "extension_service_connections_auth_mode_check",
      sql`
      "auth_mode" IN ('oauth2', 'api_key', 'bearer_token', 'basic', 'webhook_signature', 'none')
      OR "auth_mode" LIKE 'custom_%'
      `,
    ),
  }),
);

/**
 * extension_service_object_links
 *
 * ELI5:
 * Generic local<->external object mapping rows for extension integrations.
 *
 * Why this exists:
 * - one reusable mapping model for all connectors,
 * - supports either canonical subject anchors or local reference keys,
 * - keeps sync and webhook processors deterministic.
 */
export const extensionServiceObjectLinks = pgTable(
  "extension_service_object_links",
  {
    /** Stable primary key. */
    id: idWithTag("ext_object_link"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent integration connection. */
    extensionServiceConnectionId: idRef("extension_service_connection_id")
      .references(() => extensionServiceConnections.id)
      .notNull(),

    /** Optional canonical local subject anchor type. */
    subjectType: varchar("subject_type", { length: 80 }),

    /** Optional canonical local subject anchor id. */
    subjectId: varchar("subject_id", { length: 140 }),

    /** Optional local non-subject key for plugin-defined payloads. */
    localReferenceKey: varchar("local_reference_key", { length: 200 }),

    /** External object class in provider namespace. */
    externalObjectType: varchar("external_object_type", { length: 120 }).notNull(),

    /** External object id/reference in provider namespace. */
    externalObjectRef: varchar("external_object_ref", { length: 255 }).notNull(),

    /** Link lifecycle state. */
    status: lifecycleStatusEnum("status").default("active").notNull(),

    /** Optional hash/version for delta-sync optimization. */
    syncHash: varchar("sync_hash", { length: 140 }),

    /** Last sync success timestamp for this link. */
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),

    /** Extensible metadata payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite key for tenant-safe references from sync item/event rows. */
    extensionServiceObjectLinksBizIdIdUnique: uniqueIndex(
      "extension_service_object_links_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /**
     * One active external object map per connection/type/ref.
     *
     * Soft-deleted rows are excluded so stale mappings can be retired and
     * recreated deterministically without uniqueness deadlocks.
     */
    extensionServiceObjectLinksExternalUnique: uniqueIndex(
      "extension_service_object_links_external_unique",
    ).on(
      table.extensionServiceConnectionId,
      table.externalObjectType,
      table.externalObjectRef,
    )
      .where(sql`"deleted_at" IS NULL`),

    /** Subject-anchored local map uniqueness. */
    extensionServiceObjectLinksLocalSubjectUnique: uniqueIndex(
      "extension_service_object_links_local_subject_unique",
    )
      .on(
        table.extensionServiceConnectionId,
        table.subjectType,
        table.subjectId,
        table.externalObjectType,
      )
      .where(
        sql`"subject_type" IS NOT NULL AND "subject_id" IS NOT NULL AND "deleted_at" IS NULL`,
      ),

    /** Local-reference-key map uniqueness for non-subject payloads. */
    extensionServiceObjectLinksLocalRefKeyUnique: uniqueIndex(
      "extension_service_object_links_local_ref_key_unique",
    )
      .on(
        table.extensionServiceConnectionId,
        table.localReferenceKey,
        table.externalObjectType,
      )
      .where(sql`"local_reference_key" IS NOT NULL AND "deleted_at" IS NULL`),

    /** Common sync lookup path by connection/status/type. */
    extensionServiceObjectLinksBizConnectionStatusTypeIdx: index(
      "extension_service_object_links_biz_connection_status_type_idx",
    ).on(
      table.bizId,
      table.extensionServiceConnectionId,
      table.status,
      table.externalObjectType,
    ),

    /** Tenant-safe FK to integration connection. */
    extensionServiceObjectLinksBizConnectionFk: foreignKey({
      columns: [table.bizId, table.extensionServiceConnectionId],
      foreignColumns: [extensionServiceConnections.bizId, extensionServiceConnections.id],
      name: "extension_service_object_links_biz_connection_fk",
    }),

    /** Tenant-safe FK to optional canonical subject anchor. */
    extensionServiceObjectLinksBizSubjectFk: foreignKey({
      columns: [table.bizId, table.subjectType, table.subjectId],
      foreignColumns: [subjects.bizId, subjects.subjectType, subjects.subjectId],
      name: "extension_service_object_links_biz_subject_fk",
    }),

    /** Subject anchor must be fully null or fully populated. */
    extensionServiceObjectLinksSubjectPairCheck: check(
      "extension_service_object_links_subject_pair_check",
      sql`
      (
        "subject_type" IS NULL
        AND "subject_id" IS NULL
      ) OR (
        "subject_type" IS NOT NULL
        AND "subject_id" IS NOT NULL
      )
      `,
    ),

    /** At least one local anchor path must exist. */
    extensionServiceObjectLinksAnchorCheck: check(
      "extension_service_object_links_anchor_check",
      sql`
      "local_reference_key" IS NOT NULL
      OR "subject_type" IS NOT NULL
      `,
    ),
  }),
);

/**
 * extension_service_sync_jobs
 *
 * ELI5:
 * One row tracks one synchronization run for one extension service connection.
 */
export const extensionServiceSyncJobs = pgTable(
  "extension_service_sync_jobs",
  {
    /** Stable primary key. */
    id: idWithTag("ext_sync_job"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent service connection. */
    extensionServiceConnectionId: idRef("extension_service_connection_id")
      .references(() => extensionServiceConnections.id)
      .notNull(),

    /** Sync lifecycle state. */
    status: varchar("status", { length: 40 }).default("queued").notNull(),

    /** Sync direction. */
    direction: varchar("direction", { length: 40 }).default("bidirectional").notNull(),

    /** Object type handled in this run. */
    objectType: varchar("object_type", { length: 120 }).notNull(),

    /** Job request timestamp. */
    requestedAt: timestamp("requested_at", { withTimezone: true }).defaultNow().notNull(),

    /** Job start timestamp. */
    startedAt: timestamp("started_at", { withTimezone: true }),

    /** Job completion timestamp. */
    completedAt: timestamp("completed_at", { withTimezone: true }),

    /** Processed item count. */
    processedCount: integer("processed_count").default(0).notNull(),

    /** Failed item count. */
    failedCount: integer("failed_count").default(0).notNull(),

    /** Cursor/checkpoint snapshot used to seed this run. */
    cursorSnapshot: jsonb("cursor_snapshot").default({}).notNull(),

    /** Optional summary text. */
    summary: varchar("summary", { length: 800 }),

    /** Optional structured error payload. */
    errorPayload: jsonb("error_payload").default({}),

    /** Extensible metadata payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite key for tenant-safe references from sync item rows. */
    extensionServiceSyncJobsBizIdIdUnique: uniqueIndex(
      "extension_service_sync_jobs_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** Common queue path by connection/state/time. */
    extensionServiceSyncJobsBizConnectionStatusIdx: index(
      "extension_service_sync_jobs_biz_connection_status_idx",
    ).on(table.bizId, table.extensionServiceConnectionId, table.status, table.requestedAt),

    /** Tenant-safe FK to service connection. */
    extensionServiceSyncJobsBizConnectionFk: foreignKey({
      columns: [table.bizId, table.extensionServiceConnectionId],
      foreignColumns: [extensionServiceConnections.bizId, extensionServiceConnections.id],
      name: "extension_service_sync_jobs_biz_connection_fk",
    }),

    /** Status vocabulary with custom_* escape hatch. */
    extensionServiceSyncJobsStatusCheck: check(
      "extension_service_sync_jobs_status_check",
      sql`
      "status" IN ('queued', 'running', 'succeeded', 'partial', 'failed', 'cancelled')
      OR "status" LIKE 'custom_%'
      `,
    ),

    /** Direction vocabulary with custom_* escape hatch. */
    extensionServiceSyncJobsDirectionCheck: check(
      "extension_service_sync_jobs_direction_check",
      sql`
      "direction" IN ('inbound', 'outbound', 'bidirectional')
      OR "direction" LIKE 'custom_%'
      `,
    ),

    /** Counters and timeline sanity checks. */
    extensionServiceSyncJobsBoundsCheck: check(
      "extension_service_sync_jobs_bounds_check",
      sql`
      "processed_count" >= 0
      AND "failed_count" >= 0
      AND ("started_at" IS NULL OR "completed_at" IS NULL OR "completed_at" >= "started_at")
      `,
    ),
  }),
);

/**
 * extension_service_sync_items
 *
 * ELI5:
 * Row-level execution log for one object inside one extension sync job.
 */
export const extensionServiceSyncItems = pgTable(
  "extension_service_sync_items",
  {
    /** Stable primary key. */
    id: idWithTag("ext_sync_item"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent sync job. */
    extensionServiceSyncJobId: idRef("extension_service_sync_job_id")
      .references(() => extensionServiceSyncJobs.id)
      .notNull(),

    /** Optional mapped object link for this item. */
    extensionServiceObjectLinkId: idRef("extension_service_object_link_id").references(
      () => extensionServiceObjectLinks.id,
    ),

    /** Item-level status. */
    status: varchar("status", { length: 40 }).default("pending").notNull(),

    /** Object type for this item row. */
    objectType: varchar("object_type", { length: 120 }).notNull(),

    /** Optional local key for non-subject objects. */
    localReferenceKey: varchar("local_reference_key", { length: 200 }),

    /** Optional external object reference for this item. */
    externalObjectRef: varchar("external_object_ref", { length: 255 }),

    /** Optional failure message. */
    errorMessage: varchar("error_message", { length: 1000 }),

    /** Processing timestamp for this row. */
    processedAt: timestamp("processed_at", { withTimezone: true }),

    /** Per-item payload snapshot (request/response/context). */
    payload: jsonb("payload").default({}).notNull(),

    /** Extensible metadata payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    extensionServiceSyncItemsBizIdIdUnique: uniqueIndex("extension_service_sync_items_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Common detail path for one sync job. */
    extensionServiceSyncItemsBizJobStatusIdx: index(
      "extension_service_sync_items_biz_job_status_idx",
    ).on(table.bizId, table.extensionServiceSyncJobId, table.status),

    /** Tenant-safe FK to sync job. */
    extensionServiceSyncItemsBizJobFk: foreignKey({
      columns: [table.bizId, table.extensionServiceSyncJobId],
      foreignColumns: [extensionServiceSyncJobs.bizId, extensionServiceSyncJobs.id],
      name: "extension_service_sync_items_biz_job_fk",
    }),

    /** Tenant-safe FK to optional object link. */
    extensionServiceSyncItemsBizObjectLinkFk: foreignKey({
      columns: [table.bizId, table.extensionServiceObjectLinkId],
      foreignColumns: [extensionServiceObjectLinks.bizId, extensionServiceObjectLinks.id],
      name: "extension_service_sync_items_biz_object_link_fk",
    }),

    /** Status vocabulary with custom_* escape hatch. */
    extensionServiceSyncItemsStatusCheck: check(
      "extension_service_sync_items_status_check",
      sql`
      "status" IN ('pending', 'succeeded', 'failed', 'skipped', 'retried')
      OR "status" LIKE 'custom_%'
      `,
    ),
  }),
);

/**
 * extension_webhook_ingress_events
 *
 * ELI5:
 * Generic webhook inbox for extension-managed external services.
 *
 * Why this exists:
 * - keeps inbound event handling/idempotency uniform across integrations,
 * - provides one auditable replay-safe ingestion backbone.
 */
export const extensionWebhookIngressEvents = pgTable(
  "extension_webhook_ingress_events",
  {
    /** Stable primary key. */
    id: idWithTag("ext_webhook"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent extension service connection receiving this event. */
    extensionServiceConnectionId: idRef("extension_service_connection_id")
      .references(() => extensionServiceConnections.id)
      .notNull(),

    /** Processing status for ingestion workers. */
    status: varchar("status", { length: 40 }).default("received").notNull(),

    /** Provider event topic/type name. */
    eventType: varchar("event_type", { length: 160 }).notNull(),

    /** Provider event id for idempotent ingestion. */
    externalEventId: varchar("external_event_id", { length: 255 }).notNull(),

    /** Receive timestamp. */
    receivedAt: timestamp("received_at", { withTimezone: true }).defaultNow().notNull(),

    /** Processing completion timestamp. */
    processedAt: timestamp("processed_at", { withTimezone: true }),

    /** Retry count. */
    retryCount: integer("retry_count").default(0).notNull(),

    /** Signature verification result for secure webhook setups. */
    signatureVerified: boolean("signature_verified").default(false).notNull(),

    /** Optional latest error summary. */
    errorMessage: varchar("error_message", { length: 2000 }),

    /** Raw/normalized webhook payload. */
    payload: jsonb("payload").default({}).notNull(),

    /** Extensible metadata payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    extensionWebhookIngressEventsBizIdIdUnique: uniqueIndex("extension_webhook_ingress_events_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** One provider event id per connection. */
    extensionWebhookIngressEventsConnectionEventUnique: uniqueIndex(
      "extension_webhook_ingress_events_connection_event_unique",
    ).on(table.extensionServiceConnectionId, table.externalEventId),

    /** Common inbox worker path. */
    extensionWebhookIngressEventsBizStatusReceivedIdx: index(
      "extension_webhook_ingress_events_biz_status_received_idx",
    ).on(table.bizId, table.status, table.receivedAt),

    /** Tenant-safe FK to service connection. */
    extensionWebhookIngressEventsBizConnectionFk: foreignKey({
      columns: [table.bizId, table.extensionServiceConnectionId],
      foreignColumns: [extensionServiceConnections.bizId, extensionServiceConnections.id],
      name: "extension_webhook_ingress_events_biz_connection_fk",
    }),

    /** Status vocabulary with custom_* escape hatch. */
    extensionWebhookIngressEventsStatusCheck: check(
      "extension_webhook_ingress_events_status_check",
      sql`
      "status" IN ('received', 'processed', 'failed', 'ignored')
      OR "status" LIKE 'custom_%'
      `,
    ),

    /** Retry count must remain non-negative. */
    extensionWebhookIngressEventsRetryCountCheck: check(
      "extension_webhook_ingress_events_retry_count_check",
      sql`"retry_count" >= 0`,
    ),
  }),
);

/**
 * extension_api_call_runs
 *
 * ELI5:
 * Outbound API call execution ledger for extension integrations.
 *
 * This table gives one generic way to trace:
 * - retries/backoff,
 * - request/response payload snapshots,
 * - idempotent outbound calls to external APIs.
 */
export const extensionApiCallRuns = pgTable(
  "extension_api_call_runs",
  {
    /** Stable primary key. */
    id: idWithTag("ext_api_call"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent extension service connection. */
    extensionServiceConnectionId: idRef("extension_service_connection_id")
      .references(() => extensionServiceConnections.id)
      .notNull(),

    /** Logical operation key from integration runtime. */
    operationKey: varchar("operation_key", { length: 160 }).notNull(),

    /** HTTP method used for this call. */
    httpMethod: varchar("http_method", { length: 16 }).notNull(),

    /** Endpoint key or URL template identifier. */
    endpointKey: varchar("endpoint_key", { length: 220 }).notNull(),

    /** Shared outbox-style status for retry workers. */
    status: outboxStatusEnum("status").default("pending").notNull(),

    /** Attempt count. */
    attemptCount: integer("attempt_count").default(0).notNull(),

    /** Earliest retry time for scheduler workers. */
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true })
      .defaultNow()
      .notNull(),

    /** Execution start timestamp. */
    startedAt: timestamp("started_at", { withTimezone: true }),

    /** Execution completion timestamp. */
    completedAt: timestamp("completed_at", { withTimezone: true }),

    /** Response HTTP status when available. */
    httpStatus: integer("http_status"),

    /** Optional outbound idempotency key for downstream API dedupe. */
    idempotencyKey: varchar("idempotency_key", { length: 200 }),

    /** Optional normalized error code. */
    errorCode: varchar("error_code", { length: 120 }),

    /** Optional error summary. */
    errorMessage: varchar("error_message", { length: 2000 }),

    /** Request payload snapshot (after transforms). */
    requestPayload: jsonb("request_payload").default({}).notNull(),

    /** Response payload snapshot when available. */
    responsePayload: jsonb("response_payload"),

    /** Extensible metadata payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    extensionApiCallRunsBizIdIdUnique: uniqueIndex("extension_api_call_runs_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Optional dedupe key for idempotent outbound API operations. */
    extensionApiCallRunsBizIdempotencyUnique: uniqueIndex(
      "extension_api_call_runs_biz_idempotency_unique",
    )
      .on(table.bizId, table.idempotencyKey)
      .where(sql`"idempotency_key" IS NOT NULL`),

    /** Common scheduler path by connection/status/retry time. */
    extensionApiCallRunsBizConnectionStatusNextAttemptIdx: index(
      "extension_api_call_runs_biz_connection_status_next_attempt_idx",
    ).on(table.bizId, table.extensionServiceConnectionId, table.status, table.nextAttemptAt),

    /** Tenant-safe FK to service connection. */
    extensionApiCallRunsBizConnectionFk: foreignKey({
      columns: [table.bizId, table.extensionServiceConnectionId],
      foreignColumns: [extensionServiceConnections.bizId, extensionServiceConnections.id],
      name: "extension_api_call_runs_biz_connection_fk",
    }),

    /** Attempt count must remain non-negative. */
    extensionApiCallRunsAttemptCountCheck: check(
      "extension_api_call_runs_attempt_count_check",
      sql`"attempt_count" >= 0`,
    ),

    /** Optional HTTP status should be valid range. */
    extensionApiCallRunsHttpStatusCheck: check(
      "extension_api_call_runs_http_status_check",
      sql`"http_status" IS NULL OR ("http_status" >= 100 AND "http_status" <= 599)`,
    ),

    /** Endpoint and operation keys should not be empty. */
    extensionApiCallRunsKeysCheck: check(
      "extension_api_call_runs_keys_check",
      sql`length("operation_key") > 0 AND length("endpoint_key") > 0`,
    ),
  }),
);

/**
 * custom_field_definitions
 *
 * ELI5:
 * Admins (or extensions) define reusable field templates here.
 *
 * Example:
 * - target type: `resource`
 * - key: `license_number`
 * - type: `short_text`
 * - required: true
 */
export const customFieldDefinitions = pgTable(
  "custom_field_definitions",
  {
    /** Stable primary key for one custom field definition. */
    id: idWithTag("custom_field"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Optional owning extension install when field is plugin-provisioned. */
    bizExtensionInstallId: idRef("biz_extension_install_id").references(
      () => bizExtensionInstalls.id,
    ),

    /** Entity class this field can attach to. */
    targetType: customFieldTargetTypeEnum("target_type").notNull(),

    /** Scope of this definition (whole biz or one location). */
    scope: customFieldScopeEnum("scope").default("biz").notNull(),

    /** Location payload when `scope=location`. */
    locationId: idRef("location_id").references(() => locations.id),

    /** Stable machine key used by APIs and integrations. */
    fieldKey: varchar("field_key", { length: 120 }).notNull(),

    /** Human-readable label shown in admin/client forms. */
    label: varchar("label", { length: 200 }).notNull(),

    /** Optional help description for form builders. */
    description: varchar("description", { length: 2000 }),

    /** Storage + validation family. */
    dataType: customFieldDataTypeEnum("data_type").notNull(),

    /** Visibility class for API/UI policy layers. */
    visibility: customFieldVisibilityEnum("visibility")
      .default("internal")
      .notNull(),

    /** Lifecycle state of this definition. */
    status: lifecycleStatusEnum("status").default("active").notNull(),

    /** Whether this field must be filled when target is created/updated. */
    isRequired: boolean("is_required").default(false).notNull(),

    /** UI ordering hint inside one target form. */
    sortOrder: integer("sort_order").default(100).notNull(),

    /**
     * Validation payload (min/max/regex/allowed values/dependency rules).
     * Kept JSON for forward-compatible validation engines.
     */
    validationSchema: jsonb("validation_schema").default({}).notNull(),

    /** Optional default value seed. */
    defaultValue: jsonb("default_value"),

    /** Optional short inline help text for form UIs. */
    helpText: varchar("help_text", { length: 500 }),

    /** Extension payload for future schema capabilities. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata for schema-level definition changes. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite unique key for tenant-safe child FKs. */
    customFieldDefinitionsBizIdIdUnique: uniqueIndex(
      "custom_field_definitions_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /**
     * Biz-wide uniqueness:
     * same target type cannot have duplicate field key at biz scope.
     */
    customFieldDefinitionsBizScopeUnique: uniqueIndex(
      "custom_field_definitions_biz_scope_unique",
    )
      .on(table.bizId, table.targetType, table.fieldKey)
      .where(sql`"scope" = 'biz'`),

    /**
     * Location-scoped uniqueness:
     * same target type + location cannot duplicate key.
     */
    customFieldDefinitionsLocationScopeUnique: uniqueIndex(
      "custom_field_definitions_location_scope_unique",
    )
      .on(table.bizId, table.targetType, table.locationId, table.fieldKey)
      .where(sql`"scope" = 'location'`),

    /** Common admin listing path. */
    customFieldDefinitionsBizTargetStatusIdx: index(
      "custom_field_definitions_biz_target_status_idx",
    ).on(table.bizId, table.targetType, table.status, table.scope),

    /** Tenant-safe FK to optional extension owner. */
    customFieldDefinitionsBizInstallFk: foreignKey({
      columns: [table.bizId, table.bizExtensionInstallId],
      foreignColumns: [bizExtensionInstalls.bizId, bizExtensionInstalls.id],
      name: "custom_field_definitions_biz_install_fk",
    }),

    /** Tenant-safe FK to optional location scope payload. */
    customFieldDefinitionsBizLocationFk: foreignKey({
      columns: [table.bizId, table.locationId],
      foreignColumns: [locations.bizId, locations.id],
      name: "custom_field_definitions_biz_location_fk",
    }),

    /** Scope payload must match selected scope mode. */
    customFieldDefinitionsScopeShapeCheck: check(
      "custom_field_definitions_scope_shape_check",
      sql`
      (
        "scope" = 'biz'
        AND "location_id" IS NULL
      ) OR (
        "scope" = 'location'
        AND "location_id" IS NOT NULL
      )
      `,
    ),

    /** Sort order must stay non-negative for deterministic form layouts. */
    customFieldDefinitionsSortOrderCheck: check(
      "custom_field_definitions_sort_order_check",
      sql`"sort_order" >= 0`,
    ),
  }),
);

/**
 * custom_field_definition_options
 *
 * ELI5:
 * Select-type custom fields need option dictionaries.
 * One row here = one allowed option value for one field definition.
 */
export const customFieldDefinitionOptions = pgTable(
  "custom_field_definition_options",
  {
    /** Stable primary key for option row. */
    id: idWithTag("custom_field_opt"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent custom field definition. */
    customFieldDefinitionId: idRef("custom_field_definition_id")
      .references(() => customFieldDefinitions.id)
      .notNull(),

    /** Stable machine value stored in records. */
    optionKey: varchar("option_key", { length: 120 }).notNull(),

    /** Human label shown in forms. */
    label: varchar("label", { length: 200 }).notNull(),

    /** Optional explanation/help for this option. */
    description: varchar("description", { length: 800 }),

    /** UI ordering hint among sibling options. */
    sortOrder: integer("sort_order").default(100).notNull(),

    /** Option lifecycle for gradual rollout/deprecation. */
    status: lifecycleStatusEnum("status").default("active").notNull(),

    /** Non-indexed extension metadata. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    customFieldDefinitionOptionsBizIdIdUnique: uniqueIndex("custom_field_definition_options_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Prevent duplicate option key for same definition. */
    customFieldDefinitionOptionsUnique: uniqueIndex(
      "custom_field_definition_options_unique",
    ).on(table.bizId, table.customFieldDefinitionId, table.optionKey),

    /** Option listing path per field. */
    customFieldDefinitionOptionsBizFieldStatusIdx: index(
      "custom_field_definition_options_biz_field_status_idx",
    ).on(table.bizId, table.customFieldDefinitionId, table.status, table.sortOrder),

    /** Tenant-safe FK to parent definition. */
    customFieldDefinitionOptionsBizDefinitionFk: foreignKey({
      columns: [table.bizId, table.customFieldDefinitionId],
      foreignColumns: [customFieldDefinitions.bizId, customFieldDefinitions.id],
      name: "custom_field_definition_options_biz_definition_fk",
    }),

    /** Sort order must remain non-negative. */
    customFieldDefinitionOptionsSortOrderCheck: check(
      "custom_field_definition_options_sort_order_check",
      sql`"sort_order" >= 0`,
    ),
  }),
);

/**
 * custom_field_values
 *
 * ELI5:
 * This stores actual values for targets using custom field definitions.
 *
 * Design notes:
 * - Canonical value lives in JSON (`value`) for max flexibility.
 * - Optional projection columns provide fast filters/indexing.
 * - One target gets at most one current row per custom field definition.
 */
export const customFieldValues = pgTable(
  "custom_field_values",
  {
    /** Stable primary key for one target+field value row. */
    id: idWithTag("custom_val"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Field definition this value belongs to. */
    customFieldDefinitionId: idRef("custom_field_definition_id")
      .references(() => customFieldDefinitions.id)
      .notNull(),

    /** Target class receiving the value. */
    targetType: customFieldTargetTypeEnum("target_type").notNull(),

    /** Target id receiving the value. */
    targetRefId: varchar("target_ref_id", { length: 140 }).notNull(),

    /** Canonical stored value payload. */
    value: jsonb("value").notNull(),

    /** Optional text projection for search/filter acceleration. */
    valueTextSearch: varchar("value_text_search", { length: 500 }),

    /**
     * Optional numeric projection for analytics/range queries.
     *
     * Fixed precision avoids floating-point drift in range/filter semantics.
     */
    valueNumberSearch: numeric("value_number_search", {
      precision: 24,
      scale: 8,
    }),

    /** Optional boolean projection for filtering. */
    valueBooleanSearch: boolean("value_boolean_search"),

    /** Optional date projection for date-only filters. */
    valueDateSearch: date("value_date_search"),

    /** Optional timestamp projection for datetime filters. */
    valueTimestampSearch: timestamp("value_timestamp_search", {
      withTimezone: true,
    }),

    /** Who wrote the latest value. */
    source: customFieldValueSourceEnum("source").default("user").notNull(),

    /** Optional user pointer when source is user-driven. */
    setByUserId: idRef("set_by_user_id").references(() => users.id),

    /** Business timestamp for when value was set. */
    setAt: timestamp("set_at", { withTimezone: true }).defaultNow().notNull(),

    /** Extra payload for source-specific diagnostics. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata for value lifecycle traceability. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    customFieldValuesBizIdIdUnique: uniqueIndex("custom_field_values_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** One current value row per (target, field) inside one tenant. */
    customFieldValuesTargetFieldUnique: uniqueIndex(
      "custom_field_values_target_field_unique",
    ).on(
      table.bizId,
      table.customFieldDefinitionId,
      table.targetType,
      table.targetRefId,
    ),

    /** Common fetch path for rendering target custom fields. */
    customFieldValuesBizTargetIdx: index("custom_field_values_biz_target_idx").on(
      table.bizId,
      table.targetType,
      table.targetRefId,
    ),

    /** Common admin query path by definition. */
    customFieldValuesBizDefinitionIdx: index(
      "custom_field_values_biz_definition_idx",
    ).on(table.bizId, table.customFieldDefinitionId),

    /** Tenant-safe FK to field definition. */
    customFieldValuesBizDefinitionFk: foreignKey({
      columns: [table.bizId, table.customFieldDefinitionId],
      foreignColumns: [customFieldDefinitions.bizId, customFieldDefinitions.id],
      name: "custom_field_values_biz_definition_fk",
    }),
  }),
);

export type ExtensionDefinition = typeof extensionDefinitions.$inferSelect;
export type NewExtensionDefinition = typeof extensionDefinitions.$inferInsert;

export type BizExtensionInstall = typeof bizExtensionInstalls.$inferSelect;
export type NewBizExtensionInstall = typeof bizExtensionInstalls.$inferInsert;

export type ExtensionPermissionDefinition =
  typeof extensionPermissionDefinitions.$inferSelect;
export type NewExtensionPermissionDefinition =
  typeof extensionPermissionDefinitions.$inferInsert;

export type BizExtensionPermissionGrant =
  typeof bizExtensionPermissionGrants.$inferSelect;
export type NewBizExtensionPermissionGrant =
  typeof bizExtensionPermissionGrants.$inferInsert;

export type ExtensionStateDocument = typeof extensionStateDocuments.$inferSelect;
export type NewExtensionStateDocument = typeof extensionStateDocuments.$inferInsert;

export type LifecycleEvent = typeof lifecycleEvents.$inferSelect;
export type NewLifecycleEvent = typeof lifecycleEvents.$inferInsert;

export type LifecycleEventSubscription =
  typeof lifecycleEventSubscriptions.$inferSelect;
export type NewLifecycleEventSubscription =
  typeof lifecycleEventSubscriptions.$inferInsert;

export type LifecycleEventDelivery = typeof lifecycleEventDeliveries.$inferSelect;
export type NewLifecycleEventDelivery = typeof lifecycleEventDeliveries.$inferInsert;

export type IdempotencyKey = typeof idempotencyKeys.$inferSelect;
export type NewIdempotencyKey = typeof idempotencyKeys.$inferInsert;

export type ExtensionServiceConnection =
  typeof extensionServiceConnections.$inferSelect;
export type NewExtensionServiceConnection =
  typeof extensionServiceConnections.$inferInsert;

export type ExtensionServiceObjectLink =
  typeof extensionServiceObjectLinks.$inferSelect;
export type NewExtensionServiceObjectLink =
  typeof extensionServiceObjectLinks.$inferInsert;

export type ExtensionServiceSyncJob = typeof extensionServiceSyncJobs.$inferSelect;
export type NewExtensionServiceSyncJob = typeof extensionServiceSyncJobs.$inferInsert;

export type ExtensionServiceSyncItem = typeof extensionServiceSyncItems.$inferSelect;
export type NewExtensionServiceSyncItem = typeof extensionServiceSyncItems.$inferInsert;

export type ExtensionWebhookIngressEvent =
  typeof extensionWebhookIngressEvents.$inferSelect;
export type NewExtensionWebhookIngressEvent =
  typeof extensionWebhookIngressEvents.$inferInsert;

export type ExtensionApiCallRun = typeof extensionApiCallRuns.$inferSelect;
export type NewExtensionApiCallRun = typeof extensionApiCallRuns.$inferInsert;

export type CustomFieldDefinition = typeof customFieldDefinitions.$inferSelect;
export type NewCustomFieldDefinition = typeof customFieldDefinitions.$inferInsert;

export type CustomFieldDefinitionOption =
  typeof customFieldDefinitionOptions.$inferSelect;
export type NewCustomFieldDefinitionOption =
  typeof customFieldDefinitionOptions.$inferInsert;

export type CustomFieldValue = typeof customFieldValues.$inferSelect;
export type NewCustomFieldValue = typeof customFieldValues.$inferInsert;
