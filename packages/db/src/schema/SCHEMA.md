# Bizing DB Schema (Canonical v0)
tags: #schema #database #drizzle #bizing #canonical

## Intent
This folder contains a single canonical schema design.
There is no parallel legacy schema model.

Design goals:
- Keep primitives generic and composable across many business types.
- Support simple booking setup and complex multi-resource fulfillment.
- Keep tenant boundaries and auditability enforced at DB level.

## Canonical Modules
Active modules in `packages/db/src/schema`:

- Core identity/tenant: `bizes.ts`, `users.ts`, `auth.ts`, `memberships.ts`, `group_accounts.ts`, `locations.ts`, `subjects.ts`
- Core catalog/supply: `services.ts`, `service_products.ts`, `products.ts`, `product_commerce.ts`, `assets.ts`, `venues.ts`, `resources.ts`
- Canonical booking domains: `offers.ts`, `supply.ts`, `time_availability.ts`, `calendar_sync.ts`, `credential_exchange.ts`, `fulfillment.ts`, `payments.ts`, `compensation.ts`, `product_commerce.ts`, `sellable_variants.ts`, `demand_pricing.ts`, `entitlements.ts`, `channels.ts`, `intelligence.ts`, `education.ts`, `progression.ts`, `audit.ts`, `extensions.ts`, `access_rights.ts`, `checkout.ts`, `session_interactions.ts`, `interaction_forms.ts`, `communications.ts`, `surveys.ts`, `promotions.ts`, `work_management.ts`, `notes.ts`, `queue.ts`, `transportation.ts`, `marketplace.ts`, `operations_backbone.ts`, `enterprise.ts`, `governance.ts`, `hipaa.ts`, `workflows.ts`, `ar.ts`, `commitments.ts`, `sla.ts`, `tax_fx.ts`, `leave.ts`, `offline.ts`, `reporting.ts`
- Integration: `stripe.ts`
- Shared primitives: `_common.ts`, `enums.ts`, `canonical.ts`

## Key Architecture Rules
- Tenant-safe modeling: business tables carry `biz_id` and use tenant-safe FK patterns where needed.
- Resource abstraction: `resources` is the schedulable supply pivot (host/company_host/asset/venue).
  - Strict one-wrapper invariant: one active `resources` row per underlying
    host user, group account, asset, and venue (enforced by partial unique
    indexes) so scheduling identity is deterministic.
  - Operational source of truth is centralized on `resources`
    (`status_definition_id`, `capacity`, overlap controls, generic booking
    buffers) so wrappers like `assets` and `venues` stay lean identity/profile
    tables instead of duplicating schedulability state.
- Canonical sellable abstraction:
  - `sellables` is the unified commercial identity across product/service/offer/resource-rate.
  - typed bridges (`sellable_*`) map canonical sellables to source primitives.
  - typed bridges now include fixed `sellable_kind` and composite FK to
    `(biz_id, id, kind)` so DB enforces type-correct mapping (no cross-kind drift).
  - commercial attribution uses `booking_order_line_sellables.sellable_id`.
- Commercial vs execution split:
  - commercial contract = `booking_orders` + `booking_order_lines`
  - execution graph = `fulfillment_units` + dependencies + assignments/checkpoints
  - resource no-overlap enforcement is handled at DB level for active
    `fulfillment_assignments` when conflict policy is `enforce_no_overlap`
- Availability as first-class system:
  - `calendars` + `calendar_bindings` + `calendar_overlays` + `availability_rules`
  - shared capacity via `capacity_pools` + members
  - extensible ownership/membership via `custom_subject` references for future
    plugin domains without adding nullable FK columns every time
  - `subjects` registry provides integrity-checked namespace refs for those
    extensible custom-subject links
- User-owned credential exchange backbone:
  - `user_credential_records` + `user_credential_documents` + `user_credential_facts`
    model one portable, user-scoped credential wallet across all bizes.
  - `biz_credential_share_grants` + selectors model explicit per-biz
    consent/scope/data-level sharing contracts.
  - `biz_credential_requests` + request items model onboarding and gig/opening
    qualification requests even before a user joins a biz.
  - `credential_disclosure_events` provides immutable-style explainability for
    who shared/viewed/downloaded what credential context and when.
- Payments as ledger/event model:
  - intents, tenders, transactions, disputes, settlement, payouts
- Commitments + secured settlements:
  - generic assurance contracts, obligations, release milestones, secured-balance
    accounts, immutable secured ledgers, allocation lineage, and dispute/claim
    timelines.
- Compensation as payroll-grade model:
  - role templates, versioned payout plans/rules, immutable compensation ledger, pay runs
- Product bundles + inventory/physical fulfillment:
  - bundle composition, line-level sellable attribution, stock locations/items, stock movement ledger, reservations, shipment/pickup records
- Unified access-right backbone:
  - `access_artifacts` + links/events/logs/usage windows/delivery links unify license/download/ticket/content access rights into one auditable model
- Checkout session + recovery backbone:
  - `checkout_sessions` + items/events/recovery links normalize abandonment detection and conversion-recovery flows across service/product checkout
- Requirement graph / progression backbone:
  - `requirement_sets` + nodes/edges/evaluations/evidence links provide a reusable prerequisite/eligibility model across education/compliance/access gating
- Session engagement backbone:
  - `session_interaction_events` + aggregate read-model rows normalize chat/Q&A/poll/replay participation telemetry for virtual/live sessions
- Sellable variant backbone:
  - dimension/value/variant/selection tables model variant matrices without cloning rigid vertical-specific schemas
- Demand-driven automated pricing:
  - signal definitions + observations, scoped policies, weighted signal bindings, score tiers, evaluation/apply ledgers
- Immutable/append-oriented operational records where traceability matters:
  - audit events, queue events, workflow decisions, etc.
- Extensibility backbone:
  - extension catalog + tenant installs, normalized extension permission
    definitions/grants, scoped extension state documents, lifecycle event bus +
    hook deliveries, shared idempotency keys, and reusable custom field
    definitions/values.
  - selector normalization favors generic capability dictionaries over
    vertical-specific tag fields in matching tables.
- Subject graph backbone:
  - `subjects` is the canonical extensible identity registry.
  - `subject_location_bindings` is the reusable rollout map for
    service/service-product/offer-version and future plugin entities, replacing
    one-off per-domain location join tables.
  - `subject_relationships` provides one reusable, tenant-safe graph layer
    instead of many one-off join tables for cross-domain or plugin use cases.
- Enterprise control-plane backbone:
  - `enterprise_scopes` is the shared "where does this apply?" primitive for
    network/biz/location/subject targeting across all enterprise modules.
  - enterprise relationship graph (`enterprise_relationship_templates`,
    `enterprise_relationships`) models parent/franchise/region/shared-service
    topology without hardcoding one org-tree shape.
  - inheritance control-plane (`enterprise_inheritance_strategies`,
    `enterprise_inheritance_resolutions`) models deterministic global->local
    override evaluation with replayable snapshots on normalized scopes.
  - delegated administration and authority caps
    (`enterprise_admin_delegations`, `enterprise_approval_authority_limits`)
    keep enterprise governance auditable and non-rigid with one scope FK model.
  - intercompany accounting primitives
    (`enterprise_intercompany_accounts`, `enterprise_intercompany_entries`,
    `enterprise_intercompany_settlement_runs`) provide finance-grade
    cross-biz transfer traces.
  - enterprise contract-pack versioning and scoped rollout
    (`enterprise_contract_pack_templates`, `enterprise_contract_pack_versions`,
    `enterprise_contract_pack_bindings`) support policy/commercial
    standardization with scoped exceptions without duplicating scope columns.
  - SSO/SCIM control-plane + external directory links
    (`enterprise_identity_providers`, `enterprise_scim_sync_states`,
    `enterprise_external_directory_links`) supports enterprise identity
    lifecycle integration.
  - staged rollout control-plane and enterprise read-model facts
    (`enterprise_change_rollout_*`, `fact_enterprise_*`) support safe
    large-network changes and fast executive reporting.
- HIPAA-grade governance backbone:
  - BAA lifecycle: `business_associate_agreements`
  - minimum-necessary policy + PHI access logs: `phi_access_policies`,
    `phi_access_events`
  - emergency override and review: `break_glass_reviews`
  - disclosure accounting: `phi_disclosure_events`
  - incident + breach workflow: `security_incidents`, `breach_notifications`
  - patient authorization ledger: `hipaa_authorizations`
- Generic policy + consequence backbone:
  - reusable rulebooks: `policy_templates`, `policy_rules`, `policy_bindings`
  - immutable violation ledger: `policy_breach_events`
  - consequence/remediation ledger: `policy_consequence_events`
  - optional deep links into finance and workflow artifacts preserve
    traceability without hardcoding industry-specific penalty tables.
- Customer experience + growth backbone:
  - reusable interaction templates/assignments/submissions/signatures,
  - checklist templates/instances with item-level status,
  - communication consent + quiet-hour policies + template/send telemetry,
  - campaign journey primitives, survey templates/responses, and discount ledgers.
- Unified operations backbone:
  - generic work templates/runs/steps/entries/artifacts/approvals/time-segments
    to model field ops, inspections, timesheets, and multi-party sign-offs
    without adding industry-specific table families.
  - `operational_demands` + `operational_assignments` provide one canonical
    identity layer over fulfillment/staffing/custom sources so dispatch,
    analytics, and plugins can query one assignment graph.

## Plugin Execution / Read Model

This is the normalized plugin flow. It is intentionally explicit so third-party
extensions can plug in without schema rewrites.

1. Install and capability contract
- Catalog definition: `extension_definitions`
- Tenant install: `biz_extension_installs`
- Permission contract (global): `extension_permission_definitions`
- Tenant grants/denies (scoped): `biz_extension_permission_grants`

2. Event production and subscription
- Domain events are appended to: `lifecycle_events`
- Subscribers are configured in: `lifecycle_event_subscriptions`
- Per-subscription delivery state is tracked in: `lifecycle_event_deliveries`

3. Reliable execution semantics
- Delivery retries and dead-lettering are driven by `status`, `attempt_count`,
  `next_attempt_at`, and `max_attempts`.
- Cross-domain idempotency is centralized in: `idempotency_keys`
- Extensions can use event correlation/causation ids for deterministic tracing.

4. Extension-owned read models/state
- Durable extension state lives in: `extension_state_documents`
- Documents are namespaced (`namespace`, `document_key`) and scoped
  (`biz`/`location`/`custom_subject`) for safe multi-tenant usage.
- Optimistic revisioning (`revision`) + checkpoint pointer
  (`last_lifecycle_event_id`) supports replay/rebuild behavior.
- Platform projection control-plane state lives in: `projection_checkpoints`
  for internal + extension projection lag/health visibility.

5. Generic relationship and custom modeling
- Extensible identities register in: `subjects`
- Cross-domain/plugin relationships store in: `subject_relationships`
- Extra structured fields use: `custom_field_definitions` +
  `custom_field_values`

6. Execution example (ELI5)
- "Booking created" event is written to `lifecycle_events`.
- Matching subscription row is found in `lifecycle_event_subscriptions`.
- A delivery row is queued in `lifecycle_event_deliveries`.
- Worker executes handler/webhook with retry/idempotency policy.
- Extension updates its projection in `extension_state_documents`.
- Platform updates checkpoint/health in `projection_checkpoints`.
- If extension models extra entities, it registers them in `subjects` and links
  with `subject_relationships`.

## Stripe Integration Shape
`stripe.ts` mirrors selected provider objects for webhook idempotency and reconciliation.
Stripe linkage now references canonical commercial entities:
- `booking_order_id`
- `cross_biz_order_id`
- canonical payment refs (`payment_intent_ref_id`, `payment_transaction_ref_id`)

## Removed Legacy Modules
These modules were intentionally removed to keep one canonical design:
- `bookings.ts`
- `booking_flows.ts`
- `commerce.ts`
- `offerings.ts`
- `operations.ts`
- `pricing.ts`
- `scheduling.ts`

If a new use case appears, extend canonical modules instead of reintroducing parallel legacy tables.

## Source of Truth
- Runtime registry: `packages/db/src/index.ts`
- Canonical barrel: `packages/db/src/schema/canonical.ts`
- Migration input list: `packages/db/drizzle.config.ts`
- Schema conventions: `packages/db/src/schema/SCHEMA_STYLE_GUIDE.md`
- Automated guard checks: `packages/db/scripts/schema-guard.ts` (`bun run db:guard`)
