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
- `projections.ts`
  - formal rebuildable read models
  - structured debug snapshots for "what did the system see?" analysis

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
- Marketplace/runtime partner commerce:

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
  - `staffing_demands`
  - `staffing_responses`
  - `staffing_assignments`

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

## Bootstrap Integrity

The current v0 local bootstrap path is:
- `bun run --cwd /Users/ameer/projects/bizing/packages/db db:push`
- `bun run --cwd /Users/ameer/projects/bizing/packages/db db:seed`

Why this matters:
- the canonical schema uses partial unique indexes for "only one active/default row under these conditions" rules.
- fresh `drizzle-kit push` runs were flattening some of those indexes into plain unique indexes.
- that produced false saga failures in setup flows even when the route payload asked for `isDefault: false`.

To keep fresh databases truthful, `packages/db/scripts/repair-canonical-indexes.ts` now replays the canonical partial index definitions from the baseline SQL after schema application.

Current known v0 rule:
- for fresh local environments, treat `db:migrate` and `db:push` as the same bootstrap contract: apply schema with Drizzle push, then repair canonical partial indexes.
- the giant baseline SQL migration file is still under active redesign and is not yet the trustworthy empty-db bootstrap path on this machine.
