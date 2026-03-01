# AGENTS.md - Bizing Codebase Rules

This file defines how agents should operate in `/Users/ameer/bizing/code`.

## Core Concept

- Codebase (`/Users/ameer/bizing/code`) is the **body**.
- Mind workspace (`/Users/ameer/bizing/mind`) is the **mind**.
- Every meaningful change should update both behavior and explanation.

## Mandatory Read Order (Before Non-Trivial Work)

1. `docs/INDEX.md`
2. `docs/API.md` and/or `docs/SCHEMA_BIBLE.md` based on task scope
3. `/Users/ameer/bizing/mind/INDEX.md`
4. `/Users/ameer/bizing/mind/memory/RAM.md`

## Skill Usage Rule

Skills live under `/Users/ameer/bizing/mind/skills`.

If a task clearly matches a skill workflow, load and follow that skill.
Do not invent a parallel workflow when a matching skill already exists.

## Documentation Sync Rule (Required)

When code behavior changes (API, schema, auth, saga, integrations):

1. Update the relevant code and tests.
2. Update at least one canonical doc in `docs/`:
  - `docs/API.md` for API contract changes.
  - `docs/SCHEMA_BIBLE.md` for schema/relationship changes.
  - `docs/INDEX.md` if documentation topology changes.
3. Append a concise note in `docs/CHANGE_NOTES.md`.
4. Update mind memory:
  - `/Users/ameer/bizing/mind/memory/RAM.md` (active context)
  - `/Users/ameer/bizing/mind/memory/YYYY-MM-DD.md` (session log)
  - `/Users/ameer/bizing/mind/MEMORY.md` only for durable decisions.

## Obsidian-Native Linking

- Prefer wiki-links for internal docs (e.g., `[[API]]`, `[[SCHEMA_BIBLE]]`).
- Maintain bridge notes in mind workspace so body and mind stay navigable together.

## Done Criteria

A change is complete only when:

- behavior is implemented and validated
- docs are updated
- mind context is updated
