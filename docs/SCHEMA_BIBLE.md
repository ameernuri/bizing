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
