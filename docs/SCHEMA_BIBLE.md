---
tags:
  - bizing
  - schema
  - docs
---

# Schema Bible (Code Hub)

This note maps where canonical schema truth lives in the codebase.

## Canonical Schema Sources

- Master schema explainer: `/Users/ameer/bizing/code/packages/db/SCHEMA_BIBLE.md`
- Extended schema guide: `/Users/ameer/bizing/code/packages/db/THE_ULTIMATE_SCHEMA_BIBLE.md`
- Canonical module index: `/Users/ameer/bizing/code/packages/db/src/schema/SCHEMA.md`
- Actual Drizzle modules: `/Users/ameer/bizing/code/packages/db/src/schema/*.ts`

## Core Principles (v0)

- One canonical evolving schema, no legacy parallel branches.
- Tenant-safe modeling with `biz_id` boundaries.
- Resource-centric scheduling and fulfillment primitives.
- API-first and saga-validated evolution.
- Extensibility via plugins/hooks/custom fields/event streams, not hardcoded per vertical.

## Backbone Redesign Direction

The current schema redesign is intentionally moving the platform toward a
stronger canonical spine. The important idea is:

- state tables tell us what exists now
- action tables tell us what someone tried to do
- event tables tell us what business facts happened
- workflow tables tell us how long-running processes moved
- projection tables tell us what humans/agents should read quickly
- audit/debug tables tell us why something failed or how a decision was made

This matters because Bizing is no longer being treated as "a bag of booking
tables". It is being treated as an operating system for selling and managing:

- time
- services
- resources
- products
- approvals
- integrations
- agent-driven operations

### New Canonical Backbone Modules

- `action_backbone.ts`
  - request-level truth for important business writes
  - idempotency is a platform concern, not only a payments concern
  - action failures are first-class debug records
- `domain_events.ts`
  - reusable business-event stream for automation, integrations, and replay
- `external_installations.ts`
  - first-class model for WordPress/widgets/partner apps
  - progressive customer identity resolution
  - shadow customer profiles and verification tiers
- `schedule_subjects.ts`
  - reusable scheduling identity for anything that participates in time/capacity
  - `calendar_bindings` is now explicitly beginning to pivot toward this layer
    through `schedule_subject_id`
- `time_scopes.ts`
  - normalized scope dictionary for scheduling/capacity/policy rows
  - gives one canonical scope key (`scope_ref_key`) across modules
  - reduces polymorphic nullable-column fan-out in downstream runtime tables
  - API/runtime writes for `capacity_holds`, `capacity_hold_policies`, and
    `capacity_hold_demand_alerts` now require `time_scope_id` and derive
    `target_ref_key` from this table to prevent scope drift
- `projections.ts`
  - formal rebuildable read models
  - structured debug snapshots for "what did the system see?" analysis
- `ooda.ts`
  - Observe/Orient/Decide/Act loops as first-class records
  - links, entries, and actions to connect UC coverage, saga evidence, and
    execution history in one canonical timeline
  - loop rows keep workflow-gate state in `metadata.workflowContract`:
    - `designGateStatus`
    - `behaviorGateStatus`
  - loop-entry rows keep primary owner in evidence:
    - `evidence.owningLayer` paired with `gap_type` by API contract validation

### Canonical Consolidation Updates (Current)

- Membership identity is now unified on Better Auth `members` (biz membership)
  plus ACL mappings. The legacy parallel `org_memberships` schema module was removed.
- Event storage is unified on `domain_events`. Lifecycle hook APIs/tables still
  exist for subscription/delivery orchestration, but they reference the same
  canonical event rows instead of a second event table.
- Canonical event writes are single-rail only:
  - no mirror-write path back into legacy lifecycle event tables
  - domain event rows are the source of truth for hooks, reporting, and replay

### Canonical Consolidation Guardrail

The schema no longer keeps separate parallel families for:

- forms
- surveys
- assessments

Those old split modules were retired in favor of one canonical module:

- `instruments.ts`

ELI5:
- one definition model
- one binding model
- one run/response/event model
- many behaviors configured by type and policy

Why this matters:
- fewer duplicate tables
- fewer chances for one feature to evolve while the others drift
- cleaner API design later because "collect input / evaluate it / store the
  result" follows one shared backbone

### New Traceability Rule

When possible, workflow, audit, and saga evidence rows should point back to the
canonical action/event/projection/debug tables instead of only storing free-form
JSON. This makes it much easier to answer:

- what happened?
- why did it happen?
- what was the system trying to do?
- what event or policy triggered it?
- what did the UI/agent probably see?
- where did it fail?

This rule is no longer limited to workflows/audit/sagas.
The redesign now applies the same expectation to:

- instruments
- compliance programs/checks/evidence
- sales quotes and quote generation
- auth observability
- external installations + customer identity resolution
- bizings
- checkout, booking, payments, and entitlements
- ooda loops (observe/orient/decide/act) and their linked saga evidence

## Terminology Guardrails

- `intake form`: pre-service data collection/questionnaire workflow.
- `check-in`: operational arrival/attendance/ticket-scan workflow.
- Do not use `check-in form` for intake workflows in docs or code comments.

## Update Protocol

When schema changes:
1. Update module-level comments/JSDoc in affected schema files.
2. Update `packages/db/src/schema/SCHEMA.md` when architecture shifts.
3. Update `packages/db/SCHEMA_BIBLE.md` for major conceptual changes.
4. Add a concise note to `docs/CHANGE_NOTES.md` summarizing impact.
5. Update mind memory docs with rationale + implications.

## Related Docs

- [[API]]
- [[DOC_SYNC]]
- [[CHANGE_NOTES]]
- [Mind Schema Mirror](/Users/ameer/bizing/mind/workspace/body/SCHEMA_BIBLE.md)

## Backbone Expansion (Current Redesign Slice)

The canonical action/event/projection/debug spine is now expected in most runtime-heavy tables, not just the first wave of workflow/audit/saga tables.

### Newly folded into the backbone

- Operations backbone:
  - `operational_demands`
  - `operational_assignments`
- Work management:
  - `work_runs`
  - `work_run_steps`
  - `work_entries`
  - `work_time_segments`
  - `work_artifacts`
  - `work_approvals`
- Queue runtime:
  - `queue_counter_assignments`
  - `queue_ticket_calls`
- Compensation runtime:
  - `compensation_ledger_entries`
  - `compensation_pay_runs`
  - `compensation_pay_run_items`
- CRM runtime:
  - `crm_leads`
  - `crm_lead_events`
  - `crm_opportunities`
  - `crm_conversations`
  - `crm_conversation_messages`
  - `crm_merge_decisions`
- Customer ops runtime (hard-cut first-class CRM/support/marketing):
  - `customer_profile_crm_links`
  - `customer_timeline_events`
  - `crm_activities`
  - `crm_tasks`
  - `support_cases`
  - `support_case_participants`
  - `support_case_events`
  - `support_case_links`
  - `customer_journeys`
  - `customer_journey_steps`
  - `customer_journey_enrollments`
  - `customer_journey_events`
  - `customer_playbooks`
  - `customer_playbook_bindings`
  - `customer_playbook_runs`
- Marketplace/runtime partner commerce:
  - `bids`
  - `cross_biz_contracts`
  - `cross_biz_orders`
  - `referral_events`
  - `reward_grants`
- Commercial shells / sellable roots:
  - `products`
  - `offers`
  - `offer_versions`
  - `service_products`
  - `sellables`
- Communication + calendar + staffing execution:
  - `outbound_messages`
  - `outbound_message_events`
  - `calendar_sync_connections`
  - `calendar_timeline_events`
  - `calendar_owner_timeline_events`
  - `availability_resolution_runs`
  - `time_scopes`
  - `staffing_demands`
  - `staffing_responses`
  - `staffing_assignments`
- Inventory procurement + replenishment execution:
  - `supply_partners`
  - `supply_partner_catalog_items`
  - `inventory_replenishment_policies`
  - `inventory_replenishment_runs`
  - `inventory_replenishment_suggestions`
  - `inventory_procurement_orders`
  - `inventory_procurement_order_lines`
  - `inventory_receipt_batches`
  - `inventory_receipt_items`
  - `inventory_lot_units`
- Value/loyalty accounting:
  - `value_programs`
  - `value_program_tiers`
  - `value_program_accounts`
  - `value_ledger_entries`
  - `value_transfers`
  - `value_rules`
  - `value_rule_evaluations`
- Workforce core (HRIS + hiring + performance + benefits):
  - `workforce_departments`
  - `workforce_positions`
  - `workforce_assignments`
  - `workforce_requisitions`
  - `workforce_candidates`
  - `workforce_applications`
  - `workforce_candidate_events`
  - `workforce_performance_cycles`
  - `workforce_performance_reviews`
  - `workforce_benefit_plans`
  - `workforce_benefit_enrollments`

## Shared Knowledge Plane (Codex + OpenClaw)

This schema slice is the canonical shared-memory backbone for agent sync.

ELI5:
- we now store machine memory as real rows, not hidden process state.
- the same memory system can be read by Codex, OpenClaw, and future in-product
  Bizing agents.
- every retrieval and checkpoint move is auditable.

Canonical tables:
- Source registry and ingest roots:
  - `knowledge_sources`
- Versioned documents:
  - `knowledge_documents`
- Retrieval chunks:
  - `knowledge_chunks`
- Embedding vectors and model metadata:
  - `knowledge_embeddings`
- Graph links between documents:
  - `knowledge_edges`
- Agent run ledger:
  - `knowledge_agent_runs`
- Retrieval audit traces:
  - `knowledge_retrieval_traces`
- Append-only operational event rail:
  - `knowledge_events`
- Agent checkpoint cursors:
  - `knowledge_checkpoints`

Key uniqueness contracts:
- `knowledge_sources`:
  - global uniqueness: `source_key` where `biz_id IS NULL`
  - tenant uniqueness: `(biz_id, source_key)` where `biz_id IS NOT NULL`
- `knowledge_checkpoints`:
  - global uniqueness: `(agent_kind, agent_name, checkpoint_key)` where `biz_id IS NULL`
  - tenant uniqueness: `(biz_id, agent_kind, agent_name, checkpoint_key)` where `biz_id IS NOT NULL`

Why this matters:
- `knowledge_events` + `knowledge_checkpoints` let us answer:
  - are codex and openclaw at the same cursor?
  - are they reading the same commit/document snapshot?
- `knowledge_retrieval_traces` lets us answer:
  - what query was asked?
  - what chunks were returned?
  - what scores were used?
- `knowledge_agent_runs` lets us persist run goals/decisions/unresolved items
  for deterministic handoff between runtimes.

Design note:
- vectors are currently stored as JSON numeric arrays in
  `knowledge_embeddings.embedding` for portability in v0.
- this keeps provider choice flexible (OpenAI or Ollama today) and can be
  migrated later to pgvector without changing the higher-level memory contract.

## Clean Bootstrap Fixes (Canonical)

The empty-database rebuild surfaced real schema inconsistencies that a warm dev
database could hide.

These are now part of the canonical design:

- Event-consumer cursor progress and projection-health control-plane state are
  separate concepts with separate physical tables:
  - `event_projection_consumers`
  - `projection_checkpoints`
- Any table referenced through a tenant-safe composite foreign key must publish
  the matching composite uniqueness contract.
  Examples fixed in this pass:
  - `bizing_agent_profiles (bizing_id, id)`
  - `instrument_runs (biz_id, id)`

ELI5:
- if one table points at `(tenant_id, row_id)`
- the target table must promise that `(tenant_id, row_id)` is unique
- otherwise the schema is only "working by accident" on a dirty local DB

### Design rule clarified

Not every table needs the full four-link runtime spine.

Use the canonical runtime links primarily on rows that answer questions like:
- what did someone try to do?
- what happened next?
- what is the current visible projection?
- what structured debug context explains failure or inconsistency?

That means:
- dictionary/config/template tables can stay lighter
- runtime facts, state transitions, payouts, staffing, messaging, and catalog publication rows should usually carry these links

This keeps the schema robust and explainable without turning every lookup table into ceremony.

## Growth Backbone (Localization + Experimentation + Activation)

Growth is now a canonical schema module, not a cross-domain side effect.

Module:
- `packages/db/src/schema/growth.ts`

Canonical tables:
- `growth_localization_resources`
- `growth_localization_values`
- `growth_experiments`
- `growth_experiment_variants`
- `growth_experiment_assignments`
- `growth_experiment_measurements`
- `growth_marketing_activations`
- `growth_marketing_activation_runs`
- `growth_marketing_activation_run_items`

Design role:
- localization keeps tenant-owned copy/resources and deterministic locale resolution.
- experimentation keeps assignment/measurement rails auditable and replay-safe.
- marketing activation keeps channel-push lifecycle runs/items explicit instead of hidden in integrations.

Backbone integration:
- growth writes can emit canonical action/event/projection links.
- growth assignment and activation records are workflow/plugin-friendly for lifecycle hook and automation dispatch.

## Domain Ownership Contract

The route-domain manifest now requires explicit schema ownership for every
domain entry (`schemaModule` is mandatory).

Why:
- generated domain docs are only trustworthy when route -> schema ownership is explicit.
- null ownership allows API surfaces to drift into undocumented/ambiguous schema territory.

Current guardrail:
- `scripts/generate-domain-docs.mjs` fails if any manifest entry is missing `schemaModule`.

## Bootstrap Integrity

The current v0 local bootstrap path is:
- `bun run --cwd /Users/ameer/bizing/code/packages/db db:push`
- `bun run --cwd /Users/ameer/bizing/code/packages/db db:seed`

Bootstrap guard scripts in canonical order:
- `bootstrap-time-scopes.ts`
- `bootstrap-saga-depth.ts`
- `bootstrap-knowledge.ts`
- `repair-canonical-indexes.ts`
- `verify-bootstrap.ts`

Why `bootstrap-knowledge.ts` exists:
- shared-memory tables are now core runtime infrastructure for Codex/OpenClaw sync
- drifted local DBs can stall interactive Drizzle flows
- the script applies only the `knowledge_*` module invariants deterministically.

Why this matters:
- the canonical schema uses partial unique indexes for "only one active/default row under these conditions" rules.
- fresh `drizzle-kit push` runs were flattening some of those indexes into plain unique indexes.
- that produced false saga failures in setup flows even when the route payload asked for `isDefault: false`.

To keep fresh databases truthful, `packages/db/scripts/repair-canonical-indexes.ts` now replays the canonical partial index definitions from the baseline SQL after schema application.

Time-scope bootstrap guard (2026-03-03):
- `packages/db/scripts/bootstrap-time-scopes.ts` now runs in `db:migrate` / `db:push`.
- it idempotently ensures:
  - enum: `time_scope_type`
  - table: `time_scopes`
  - hold-domain bridge columns:
    - `capacity_hold_policies.time_scope_id`
    - `capacity_holds.time_scope_id`
    - `capacity_hold_demand_alerts.time_scope_id`
  - tenant-safe FKs and indexes for those new scope pointers.

Why this is required:
- older local DB states predated canonical time-scope modeling, so saga/API
  writes failed even when schema files were correct.
- this guard keeps bootstrap deterministic while baseline migration generation
  catches up.

Current known v0 rule:
- for fresh local environments, treat `db:migrate` and `db:push` as the same bootstrap contract: apply schema with Drizzle push, then repair canonical partial indexes.
- the giant baseline SQL migration file is still under active redesign and is not yet the trustworthy empty-db bootstrap path on this machine.

## Saga Runtime Simulation Backbone (v1)

Saga simulations now have first-class runtime state in schema, not only step rows.

New canonical tables:
- `saga_run_simulation_clocks`
  - one row per run
  - stores simulation `current_time_at`, mode (`virtual`/`realtime`), and advance counters
- `saga_run_scheduler_jobs`
  - explicit queue of delayed/conditional runtime jobs per run/step
  - stores due time, condition key, poll cadence, attempts, status, and result payload

Why this matters:
- delay behavior is observable and debuggable in DB
- test runs can simulate time passage without wall-clock sleeps
- OODash and agents can inspect "what was waiting, why, and when it resolved"

## Saga Depth Lane Backbone (v1)

Saga library rows and run rows now carry an explicit depth lane:

- enum: `saga_depth` (`shallow`, `medium`, `deep`)
- `saga_definitions.depth`
- `saga_runs.depth`

Why this matters:
- the runner can execute lane-specific suites deterministically (`SAGA_DEPTH`)
- OODash can filter health by depth lane instead of inferring from tags
- pre-merge deep checks and fast shallow checks use the same canonical model
- historical runs preserve which lane they were executed under even if a
  definition is later reclassified

## Status Model Hardening (2026-03-02)

Core lifecycle status columns in the action/projection/external-installation/saga coverage backbone are now enum-backed instead of primitive text.

Tables normalized in this pass:
- `action_requests`
- `action_idempotency_keys`
- `action_executions`
- `projections`
- `projection_documents`
- `schedule_subjects`
- `event_projection_consumers`
- `client_installations`
- `client_installation_credentials`
- `customer_profiles`
- `customer_identity_handles`
- `client_external_subjects`
- `customer_verification_challenges`
- `customer_visibility_policies`
- `saga_coverage_reports`

Why this is canonical:
- prevents status vocabulary drift between schema and API contracts
- turns invalid status writes into deterministic validation failures
- keeps lifecycle semantics explicit for coverage, audit, and OODash reporting

Guardrail result after this change:
- `db:guard` moved from `15` hard errors to `0` hard errors (warnings remain for broader tenant-safe composite FK cleanup work).
