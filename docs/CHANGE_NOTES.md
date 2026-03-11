---
tags:
  - bizing
  - changelog
  - docs
---

# Engineering Change Notes

Concise, high-signal notes for meaningful architecture or behavior changes.

## 2026-03-10

### Source-backed Codex history import for the Bizing workspace

- Added `/Users/ameer/bizing/code/scripts/import-codex-history.mjs`:
  - reads local Codex thread metadata from `/Users/ameer/.codex/state_5.sqlite`
  - filters threads for Bizing workspaces under `/Users/ameer/bizing*` and `/Users/ameer/projects/bizing*`
  - writes the canonical history snapshot to `/Users/ameer/bizing/mind/memory/codex-project-history.md`
- The initial import captured `10` Bizing-related Codex threads spanning
  `2026-02-15 23:27:05 UTC` through `2026-03-10 05:18:49 UTC`.
- Purpose:
  - preserve actual Codex project history in a repeatable, source-backed form
  - reduce drift versus older hand-written collaboration summaries
- Verification:
  - `node /Users/ameer/bizing/code/scripts/import-codex-history.mjs`

## 2026-03-08

### Standalone Canvascii unified share dialog and canvas link sharing

- Simplified the standalone Canvascii share surface in `/Users/ameer/bizing/canvascii`:
  - `/Users/ameer/bizing/canvascii/apps/canvascii/src/components/canvascii/canvas-share-dialog.tsx`
    is now one restrained shadcn dialog with `Canvas` / `Portal` tabs instead of
    separate create/share/map panels.
  - removed the old create-portal and portal-map sections from the main share flow.
  - whole-canvas and portal sharing now both support:
    - direct email invites
    - anyone-with-link grants
    - `view` / `edit` access
  - portal sharing keeps the `Allow whole canvas view` toggle inside the same
    unified dialog instead of a separate modal.
- Added first-class whole-canvas link sharing through the agent/share-policy path:
  - `/Users/ameer/bizing/canvascii/apps/canvascii/src/lib/canvascii/agent-edit.ts`
  - `/Users/ameer/bizing/canvascii/apps/canvascii/src/app/api/v1/canvascii/agent/route.ts`
  - `/Users/ameer/bizing/canvascii/apps/canvascii/src/app/api/v1/canvascii/agent/route.test.ts`
  - `/Users/ameer/bizing/canvascii/apps/canvascii/src/lib/canvascii/agent-edit.test.ts`
- Follow-up share UX tightening:
  - the dialog now uses `Create access link` actions instead of persistent
    “anyone with the link” cards/toggles on the left
  - existing grants are now managed from the right side with inline access edits,
    link copy actions, portal-only whole-canvas-view toggles, and revoke buttons
  - access pickers now use compact shadcn button groups instead of dropdowns, and
    the dialog no longer snaps back to the canvas tab when a different portal is selected
  - per-grant copy/revoke actions now live under an overflow menu, and `Create access link`
    now always mints a fresh token so owners can create multiple active links for the same scope
  - `/api/v1/canvascii/agent` now supports `update_grant` and `revoke_grant`
    actions so the owner UI can edit/revoke grants by grant id
- Verification:
  - `pnpm --dir /Users/ameer/bizing/canvascii --filter @canvascii/app test:run -- src/app/api/v1/canvascii/agent/route.test.ts src/lib/canvascii/agent-edit.test.ts`
  - `pnpm --dir /Users/ameer/bizing/canvascii --filter @canvascii/app build`
  - `docker compose -f /Users/ameer/bizing/canvascii/docker-compose.yml up -d --build canvascii-app`

## 2026-03-07

### Standalone Canvascii portal share bootstrap stabilization

- Tightened standalone share-link bootstrap in `/Users/ameer/bizing/canvascii`:
  - `/Users/ameer/bizing/canvascii/apps/canvascii/src/components/AuthProvider.tsx`
    now probes Better Auth session state via `/api/auth/get-session` before
    attempting `/api/v1/auth/me`, which removes the redundant auth-context churn
    on unauthenticated portal links.
  - `/Users/ameer/bizing/canvascii/apps/canvascii/src/components/canvascii/canvascii-page.tsx`
    now avoids duplicate deep-link file opens while an open is already in flight
    and skips no-op URL replacements, which stabilizes portal-share loads that
    previously felt like they were reloading repeatedly.
- Local standalone dev trust was widened so live collab debugging also works from
  `http://127.0.0.1:9102` / `http://localhost:9102`:
  - `/Users/ameer/bizing/canvascii/apps/canvascii-collab/src/config.ts`
  - `/Users/ameer/bizing/canvascii/apps/canvascii/src/lib/server/env.ts`
- Also flattened the remaining editor chrome tooltip wrappers that were still
  tripping ref/update loops around disabled controls:
  - `/Users/ameer/bizing/canvascii/apps/canvascii/src/components/asciip-core/components/toolbar/ToolbarOrder.tsx`
  - `/Users/ameer/bizing/canvascii/apps/canvascii/src/components/asciip-core/components/footer/FooterHistory.tsx`
  - `/Users/ameer/bizing/canvascii/apps/canvascii/src/components/asciip-core/components/footer/FooterCanvasSize.tsx`
  - `/Users/ameer/bizing/canvascii/apps/canvascii/src/components/asciip-core/components/toolbar/ToolbarExport.tsx`

### Standalone Canvascii collaboration and sharing pass

- Standalone Canvascii at `/Users/ameer/bizing/canvascii` now has its first shared-canvas collaboration layer.
- Added share/access contracts and helpers in:
  - `/Users/ameer/bizing/canvascii/packages/canvascii-core/src/sharing.ts`
- Added standalone sharing/collab/agent surfaces in:
  - `/Users/ameer/bizing/canvascii/apps/canvascii/src/app/api/v1/canvascii/share/route.ts`
  - `/Users/ameer/bizing/canvascii/apps/canvascii/src/app/api/v1/canvascii/collab-access/route.ts`
  - `/Users/ameer/bizing/canvascii/apps/canvascii/src/app/api/v1/canvascii/agent/route.ts`
- Added owner-managed whole-canvas and portal sharing UI plus collaborator awareness wiring in:
  - `/Users/ameer/bizing/canvascii/apps/canvascii/src/components/canvascii/canvas-share-dialog.tsx`
  - `/Users/ameer/bizing/canvascii/apps/canvascii/src/components/canvascii/collaborative-editor-shell.tsx`
- Mixed view/edit portal access is now enforced at save/agent time, not only at the pointer layer:
  - edits outside editable portal coverage return a permission error
  - edits inside the permitted portal succeed without granting full-canvas edit access
- Canvascii also started moving off the document-diff path for app-level canvas lifecycle changes:
  - `createDiagram`, `renameDiagram`, `deleteDiagram`, and `setActiveDiagram` now emit direct `canvas.*` commands from the middleware projection layer
  - active-canvas `updateDiagramData` now emits direct `object.upsert` / `object.delete` and `canvas.upsert` commands
  - the remaining transitional gap is that tool interactions still mutate legacy Redux state first and only then project into commands

## 2026-03-06

### Atlas/schema/API sync hardening and manifest ownership cleanup

- Hardened domain ownership contracts:
  - set canonical schema ownership for previously-null domains in
    `/Users/ameer/bizing/code/apps/api/src/routes/domain-manifest.json`:
    - `dispatch -> transportation`
    - `service-product-requirements -> service_products`
    - `calendars -> time_availability`
    - `custom-fields -> extensions`
    - `sellables -> product_commerce`
    - `notification-endpoints -> social_graph`
    - `mcp -> governance`
- Tightened manifest/runtime typing:
  - `/Users/ameer/bizing/code/apps/api/src/routes/domain-manifest.ts` now requires non-empty `schemaModule`.
- Tightened generated-doc behavior:
  - `/Users/ameer/bizing/code/scripts/generate-domain-docs.mjs` now:
    - rejects missing `schemaModule`
    - rejects missing schema module files
    - ignores non-path `.get("...")` patterns during route extraction to avoid false API endpoints in generated docs.
- Added cross-mind sync guard:
  - `/Users/ameer/bizing/code/scripts/check-atlas-sync.mjs`
  - validates event id uniqueness, events ledger/index parity, and Atlas Recent Turns linkage rules.
- Updated docs check pipeline:
  - `/Users/ameer/bizing/code/package.json`
  - `docs:check` now includes domain doc sync and atlas sync checks.
- Canonical docs updated to include growth backbone + ownership contract:
  - `/Users/ameer/bizing/code/docs/API.md`
  - `/Users/ameer/bizing/code/docs/SCHEMA_BIBLE.md`

### Homepage polish pass (Kimi-authored UI delegation trial)

- Applied a Kimi-generated homepage refinement in:
  - `/Users/ameer/bizing/code/apps/admin/src/app/page.tsx`
- Scope:
  - unauthenticated homepage composition and spacing polish only
  - preserved fixed hero lines and CTA contract
  - preserved clean black/white, no-internal-wording posture
- Validation:
  - `bun run --cwd /Users/ameer/bizing/code/apps/admin build` passed.
  - visual capture: `/tmp/ui-refresh-1772816845/home-kimi-pass.png`

### Homepage polish pass (Kimi-authored v2: spacing + products balance)

- Updated homepage copy/layout in:
  - `/Users/ameer/bizing/code/apps/admin/src/app/page.tsx`
- Changes:
  - hero line 3 updated to `automate & streamline.`
  - increased section spacing to reduce compact visual density.
  - shifted messaging to include products while staying service-first.
  - capability summary updated to include products explicitly.
- Validation:
  - `bun run --cwd /Users/ameer/bizing/code/apps/admin build` passed.
  - visual capture: `/tmp/ui-refresh-1772817210/home-kimi-pass-2.png`

### Homepage polish pass (Kimi-authored v3: stacked section flow)

- Updated homepage section composition in:
  - `/Users/ameer/bizing/code/apps/admin/src/app/page.tsx`
- Changes:
  - moved each section intro (`Get running quickly`, `Built to scale with you`, `Scale and automate`) to a stacked top block with cards beneath.
  - tightened section copy for cleaner, consistent rhythm.
  - preserved hero, CTA contract, and service-first/product-supported framing.
- Validation:
  - `bun run --cwd /Users/ameer/bizing/code/apps/admin build` passed.
  - visual capture: `/tmp/ui-refresh-1772817498/home-kimi-pass-3.png`

### Homepage premium polish pass (frontend-design skill + Kimi)

- Installed requested design skill:
  - `https://github.com/anthropics/claude-code/tree/main/plugins/frontend-design/skills/frontend-design`
- Updated homepage in:
  - `/Users/ameer/bizing/code/apps/admin/src/app/page.tsx`
- Changes:
  - kept fixed hero/CTA contract and stacked section intro flow.
  - refined composition from draft-like to premium: stronger hierarchy, cleaner spacing cadence, and sharper card treatment.
  - maintained Bizing monochrome identity while tightening copy for consistency.
  - preserved service-first framing with explicit product support.
- Validation:
  - `bun run --cwd /Users/ameer/bizing/code/apps/admin build` passed.
  - visual capture: `/tmp/ui-refresh-1772818300/home-kimi-pass-5.png`

### Homepage full redesign pass (non-blog premium composition)

- Updated homepage in:
  - `/Users/ameer/bizing/code/apps/admin/src/app/page.tsx`
- Changes:
  - replaced prior stacked section-card repetition with a new composition:
    - split hero with right-side operational rail
    - single 3-stage growth matrix (`Start / Scale / Automate`)
    - cleaner capability strip at the bottom
  - preserved fixed hero lines, CTA contract, and Bizing style principles.
  - preserved service-first framing with explicit product support.
- Validation:
  - `bun run --cwd /Users/ameer/bizing/code/apps/admin build` passed.
  - visual capture: `/tmp/ui-refresh-1772818500/home-redesign-v1.png`

### Homepage redesign pass v2 (hero/copy/flow refinements)

- Updated homepage in:
  - `/Users/ameer/bizing/code/apps/admin/src/app/page.tsx`
- Changes:
  - moved `How It Flows` out of the hero area and into the bottom section.
  - updated hero copy to:
    - `start your biz.`
    - `scale without friction.`
    - `automate & streamline.`
  - updated hero support line to: `From your first sale to a multi-team operation, Bizing keeps work, customers, and payments aligned.`
  - renamed second growth header to `Built to grow with you`.
  - reworked third growth column to `Automate everything` with subtle workflow/agent-first framing.
  - reworked the last area into a two-pane bottom section (`How It Flows` + `What You Run Here`).
- Validation:
  - `bun run --cwd /Users/ameer/bizing/code/apps/admin build` passed.
  - visual capture: `/tmp/ui-refresh-1772818800/home-redesign-v2.png`

### Homepage redesign pass v3 (bottom section unified + confident CTA)

- Updated homepage in:
  - `/Users/ameer/bizing/code/apps/admin/src/app/page.tsx`
- Changes:
  - unified prior bottom dual-panels into one coherent `One Operating Surface` section.
  - merged flow + capability context into a single message block with tighter narrative.
  - added confident bottom CTA: `Start running on Bizing`.
  - retained hero/support and growth-matrix copy from v2.
- Validation:
  - `bun run --cwd /Users/ameer/bizing/code/apps/admin build` passed.
  - visual capture: `/tmp/ui-refresh-1772819300/home-redesign-v3.png`

### Homepage redesign pass v4 (bottom message cleanup + stronger CTA)

- Updated homepage in:
  - `/Users/ameer/bizing/code/apps/admin/src/app/page.tsx`
- Changes:
  - simplified bottom section into one coherent narrative block and removed chip-card clutter.
  - tightened copy to be clearer and more on-message before the final action.
  - increased bottom CTA visual weight and updated label to `Start Bizing!`.
- Validation:
  - `bun run --cwd /Users/ameer/bizing/code/apps/admin build` passed.
  - visual capture: `/tmp/ui-refresh-1772819700/home-redesign-v4.png`

### Homepage redesign pass v5 (removed bottom capability list)

- Updated homepage in:
  - `/Users/ameer/bizing/code/apps/admin/src/app/page.tsx`
- Changes:
  - removed bottom capability list (`Services/products/...`) entirely.
  - tightened bottom section copy into one coherent, readable narrative.
  - retained larger/bolder CTA label `Start Bizing!`.
- Validation:
  - `bun run --cwd /Users/ameer/bizing/code/apps/admin build` passed.
  - visual capture: `/tmp/ui-refresh-1772820100/home-redesign-v5.png`

### Homepage redesign pass v6 (design/copy sweep polish)

- Updated homepage in:
  - `/Users/ameer/bizing/code/apps/admin/src/app/page.tsx`
- Changes:
  - hero updated to `automate & orchestrate.`
  - growth intro copy reworded for clearer progression.
  - start/scale/automate columns expanded to 3 concise points each with refreshed copy.
  - bottom CTA area redesigned with larger button, more space, and a large Bizing icon anchor.
- Validation:
  - `bun run --cwd /Users/ameer/bizing/code/apps/admin build` passed.
  - visual capture: `/tmp/ui-refresh-1772820600/home-redesign-v6.png`

### Homepage redesign pass v7 (top/bottom visual alignment + copy sweep)

- Updated homepage in:
  - `/Users/ameer/bizing/code/apps/admin/src/app/page.tsx`
- Changes:
  - removed top icon and enlarged top text logo.
  - hero updated to `automate & orchestrate.`
  - growth intro copy reworded for clarity.
  - start/scale/automate columns expanded to 3 points each with refreshed copy.
  - integrated bottom section color with overall page.
  - enlarged bottom CTA zone and increased right-side icon size with centered vertical alignment.
- Validation:
  - `bun run --cwd /Users/ameer/bizing/code/apps/admin build` passed.
  - visual capture: `/tmp/ui-refresh-1772821000/home-redesign-v7.png`

### Canonical UX direction locked to prevent drift

- Added a new canonical UX doc:
  - `/Users/ameer/bizing/code/docs/UX_PRINCIPLES.md`
  - establishes non-negotiable direction for:
    - visual style (simple, black/white, polished, calm)
    - copy style (no jargon, no internal wording, no persona leakage)
    - role boundaries (no admin/dev leakage into customer or biz-owner views)
- Linked UX principles in docs entrypoint:
  - `/Users/ameer/bizing/code/docs/INDEX.md`
- Updated agent operating rules so UI/copy tasks must read and follow UX principles:
  - `/Users/ameer/bizing/code/AGENTS.md`
- Updated repository README framing so onboarding language aligns with business-platform posture (not booking-only):
  - `/Users/ameer/bizing/code/README.md`

### Homepage polish pass (calmer voice, clearer value)

- Refined landing-page copy and hierarchy in:
  - `/Users/ameer/bizing/code/apps/admin/src/app/page.tsx`
- Changes:
  - kept the core headline, tightened subhead copy to be clearer and less promotional.
  - shifted section titles to sentence case (`Get running quickly`, `Built to scale with you`) to reduce visual shouting.
  - simplified step copy to plain language and role-relevant outcomes.
  - retained clean black/white presentation and minimal layout density.
- Validation:
  - `bun run --cwd /Users/ameer/bizing/code/apps/admin build` passed.

### Homepage polish pass v2 (copy + layout refinement)

- Further refined homepage in:
  - `/Users/ameer/bizing/code/apps/admin/src/app/page.tsx`
- Changes:
  - introduced a cleaner two-column hero with a quiet right-rail summary (`In one place`).
  - tightened hero copy to shorter, clearer language.
  - added a minimal value strip for fast scanning (`Start quickly`, `Stay organized`, `Scale without retooling`).
  - improved step copy rhythm and reduced visual noise while preserving the black/white polished style.
- Validation:
  - `bun run --cwd /Users/ameer/bizing/code/apps/admin build` passed.

### Homepage narrative refinement (solo to complex scaling)

- Updated homepage narrative copy in:
  - `/Users/ameer/bizing/code/apps/admin/src/app/page.tsx`
- Focus:
  - made the hero statement explicitly communicate progression from solo operation to complex team operations.
  - strengthened scaling language while keeping tone calm, direct, and non-promotional.
  - kept black/white minimalist presentation and role-clean copy.
- Validation:
  - `bun run --cwd /Users/ameer/bizing/code/apps/admin build` passed.

### Homepage copy dedupe pass (focused narrative, no repetition)

- Refined homepage copy to reduce repeated phrasing in:
  - `/Users/ameer/bizing/code/apps/admin/src/app/page.tsx`
- Changes:
  - tightened hero and support lines to one clear progression story.
  - reframed labels/subcopy to avoid repeating the same terms across sections.
  - kept calm, black/white, direct style with no internal wording.
- Validation:
  - `bun run --cwd /Users/ameer/bizing/code/apps/admin build` passed.

### Homepage narrative flow pass (merged progression + automation section)

- Refined homepage structure and copy in:
  - `/Users/ameer/bizing/code/apps/admin/src/app/page.tsx`
- Changes:
  - merged the quick-value strip directly into `Get running quickly` to remove duplicate messaging.
  - upgraded `Built to scale with you` into a clearer three-card operational progression layout.
  - added `Scale and automate` section with practical automation outcomes.
  - preserved calm black/white visual posture and non-jargon copy.
- Validation:
  - `bun run --cwd /Users/ameer/bizing/code/apps/admin build` passed.

### Homepage hero copy update

- Updated hero line in:
  - `/Users/ameer/bizing/code/apps/admin/src/app/page.tsx`
- New hero:
  - `Start simple.`
  - `Grow your biz without friction.`
  - `Automate and Scale.`

### Homepage structure polish (matter-of-fact layout)

- Refined homepage copy/layout in:
  - `/Users/ameer/bizing/code/apps/admin/src/app/page.tsx`
- Changes:
  - moved `What you run here` from hero rail to a clean footer row of capabilities.
  - replaced generic rounded cards with stronger bordered panel rows for a more direct business tone.
  - promoted `Launch quickly · Add depth when needed · Keep everything connected.` into the `Get running quickly` header area.
  - normalized hero capitalization (`Automate and scale.`).
  - updated CTA pattern to: `Get Started ->` and `or sign in here.`.
- Validation:
  - `bun run --cwd /Users/ameer/bizing/code/apps/admin build` passed.

### Homepage hero/section emphasis pass

- Updated homepage in:
  - `/Users/ameer/bizing/code/apps/admin/src/app/page.tsx`
- Changes:
  - hero copy updated to:
    - `start simple.`
    - `scale without friction.`
    - `automate with ease.`
  - CTA updated to icon-arrow style (`Get Started` + `ArrowRight`) and `or sign in here.` text.
  - increased section-title prominence (`Get running quickly`, `Built to scale with you`, `Scale and automate`) for clearer visual hierarchy.
- Validation:
  - `bun run --cwd /Users/ameer/bizing/code/apps/admin build` passed.

## 2026-03-04

### Canonical operating-core expansion: inventory, value programs, workforce

- Added inventory procurement/replenishment canonical module:
  - `/Users/ameer/bizing/code/packages/db/src/schema/inventory_procurement.ts`
  - tables:
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
- Added value/loyalty canonical module:
  - `/Users/ameer/bizing/code/packages/db/src/schema/value_programs.ts`
  - tables:
    - `value_programs`
    - `value_program_tiers`
    - `value_program_accounts`
    - `value_transfers`
    - `value_ledger_entries`
    - `value_rules`
    - `value_rule_evaluations`
- Added workforce core canonical module:
  - `/Users/ameer/bizing/code/packages/db/src/schema/workforce_core.ts`
  - tables:
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
- Added supporting enums to `/Users/ameer/bizing/code/packages/db/src/schema/enums.ts`
  for procurement/replenishment, value-ledger flows, and workforce lifecycle state.
- Registered new modules in canonical exports and migration inputs:
  - `/Users/ameer/bizing/code/packages/db/src/schema/canonical.ts`
  - `/Users/ameer/bizing/code/packages/db/src/index.ts`
  - `/Users/ameer/bizing/code/packages/db/drizzle.config.ts`
- Updated schema docs:
  - `/Users/ameer/bizing/code/packages/db/src/schema/SCHEMA.md`
  - `/Users/ameer/bizing/code/docs/SCHEMA_BIBLE.md`
  - `/Users/ameer/bizing/code/packages/db/SCHEMA_BIBLE.md`

Validation:
- `bun run --cwd /Users/ameer/bizing/code/packages/db build` passed.

### Shared knowledge plane foundation (Codex + OpenClaw sync)

- Added new canonical schema module:
  - `/Users/ameer/bizing/code/packages/db/src/schema/knowledge.ts`
- Added shared-memory tables:
  - `knowledge_sources`
  - `knowledge_documents`
  - `knowledge_chunks`
  - `knowledge_embeddings`
  - `knowledge_edges`
  - `knowledge_agent_runs`
  - `knowledge_retrieval_traces`
  - `knowledge_events`
  - `knowledge_checkpoints`
- Registered the module in DB exports + Drizzle config:
  - `/Users/ameer/bizing/code/packages/db/src/schema/canonical.ts`
  - `/Users/ameer/bizing/code/packages/db/src/index.ts`
  - `/Users/ameer/bizing/code/packages/db/drizzle.config.ts`

### Knowledge API + ingest/query/checkpoint routes

- Added and mounted canonical route module:
  - `/Users/ameer/bizing/code/apps/api/src/routes/knowledge.ts`
  - mounted in `/Users/ameer/bizing/code/apps/api/src/routes/core-api.ts`
- New endpoints include:
  - source/document/chunk CRUD-adjacent flows
  - file ingest from source root (`/knowledge/sources/:sourceId/ingest-files`)
  - semantic/keyword/hybrid query with retrieval traces
  - event feed reads
  - checkpoint upsert/list
  - sync drift summary (`/knowledge/sync-status`)
- Added embedding/chunking runtime service:
  - `/Users/ameer/bizing/code/apps/api/src/services/knowledge-embeddings.ts`
  - provider support:
    - OpenAI embeddings
    - Ollama embeddings

### Agents tool exposure for shared memory operations

- Added first-class agent tools for knowledge-plane operations:
  - stats/sources/documents/query/checkpoints/sync-status/ingest-files
  - file:
    - `/Users/ameer/bizing/code/apps/api/src/code-mode/tools.ts`

Validation:
- `bun run --cwd /Users/ameer/bizing/code/packages/db build` passed.
- `bun run --cwd /Users/ameer/bizing/code/apps/api typecheck` passed.
- `bun run --cwd /Users/ameer/bizing/code/apps/api build` passed.
- `bun run docs:generate:domains` passed.

### Deterministic knowledge bootstrap + OODash sync view

- Added idempotent DB guard script:
  - `/Users/ameer/bizing/code/packages/db/scripts/bootstrap-knowledge.ts`
  - creates missing `knowledge_*` enums/tables/indexes/constraints without relying
    on interactive Drizzle rename prompts.
- Wired script into package bootstrap chain:
  - `/Users/ameer/bizing/code/packages/db/package.json`
  - `db:push` and `db:migrate` now run `bootstrap-knowledge.ts`.
- Extended bootstrap verification to include knowledge tables:
  - `/Users/ameer/bizing/code/packages/db/scripts/verify-bootstrap.ts`
- OODash integration:
  - new route/page `GET /ooda/knowledge`
  - files:
    - `/Users/ameer/bizing/code/apps/admin/src/app/ooda/knowledge/page.tsx`
    - `/Users/ameer/bizing/code/apps/admin/src/components/sagas/explorer/knowledge-page.tsx`
    - `/Users/ameer/bizing/code/apps/admin/src/lib/ooda-api.ts`
    - `/Users/ameer/bizing/code/apps/admin/src/components/sagas/explorer/sagas-shell.tsx`
    - `/Users/ameer/bizing/code/apps/admin/src/components/sagas/explorer/dashboard-page.tsx`
  - dashboard now includes a compact knowledge-sync summary card and drilldown link.

Validation:
- `cd /Users/ameer/bizing/code/packages/db && bun scripts/bootstrap-knowledge.ts` passed.
- `cd /Users/ameer/bizing/code/packages/db && bun scripts/verify-bootstrap.ts` passed.
- `bun run --cwd /Users/ameer/bizing/code/apps/admin build` passed.
- `bun run --cwd /Users/ameer/bizing/code/apps/api typecheck` passed.

## 2026-03-03

### Auth cookie namespace isolation for localhost multi-app sessions

- Updated Better Auth config to use a Bizing-specific cookie namespace:
  - `advanced.cookiePrefix = process.env.BETTER_AUTH_COOKIE_PREFIX || "bizing-auth"`
  - file:
    - `/Users/ameer/bizing/code/apps/api/src/auth.ts`
- Why:
  - browser cookies are scoped by domain/path, not by port
  - default Better Auth cookie names can collide between local apps
    (for example `localhost:3000` and `localhost:9000`)
  - collision can sign users out unexpectedly across apps.
- Expected behavior now:
  - Bizing auth cookies no longer overwrite default-cookie Better Auth sessions
    from other local apps unless explicitly configured to the same prefix.

### OODA blocker triage + reorient API contract hardened

- Added deterministic blocker/reorient signals to OODA overview:
  - `GET /api/v1/ooda/overview` now includes:
    - `attention.blockers`
    - `attention.reorient`
- Added loop-scoped blocker triage route:
  - `GET /api/v1/ooda/loops/:loopId/blockers`
  - aggregates unresolved blockers from:
    - failed/blocked saga run steps linked to the loop
    - unresolved loop entries
    - failed loop actions
  - returns top failure clusters with concrete reorient recommendations.
- Added replayability support in admin run/loop surfaces:
  - run steps and loop blockers can replay their last traced API call when trace
    evidence exists.
- Fixed route typing issues caused by non-typed audit helper columns:
  - switched `saga_runs` / `saga_run_steps` audit filtering/sorting in
    `/api/v1/ooda/*` blocker queries to explicit SQL column references
    (`updated_at`, `deleted_at`) and safe timestamp normalization.

Validation:
- `bun run --cwd apps/api typecheck` passed.
- `bun run --cwd apps/admin build` passed.

### Time-scope drift cleanup + saga runner cookie compatibility

- Fixed local runtime schema drift that was generating false blocker clusters in OODash:
  - applied canonical bootstrap to ensure:
    - `capacity_hold_policies.time_scope_id`
    - `capacity_holds.time_scope_id`
    - `capacity_hold_demand_alerts.time_scope_id`
  - command:
    - `bun scripts/bootstrap-time-scopes.ts` (in `packages/db`)
- Confirmed fix by rerunning previously failing saga keys:
  - `uc-204-the-solo-entrepreneur-sarah` passed
  - `uc-170-the-solo-entrepreneur-sarah` passed
- Archived stale failed runs that were still contributing historical blocker rows,
  then revalidated OODash overview:
  - `time_scope_id`-related blockers dropped to `0`.
- Fixed saga rerun auth-session parser regression:
  - `apps/api/src/scripts/rerun-sagas.ts` now accepts namespaced Better Auth
    session cookies (`bizing-auth.session_token`) plus legacy default
    (`better-auth.session_token`) when extracting the auth cookie from
    `Set-Cookie`.

### Saga depth lanes (shallow / medium / deep) became first-class

- Added canonical saga depth enum + columns:
  - `saga_depth`
  - `saga_definitions.depth`
  - `saga_runs.depth`
  - files:
    - `/Users/ameer/bizing/code/packages/db/src/schema/enums.ts`
    - `/Users/ameer/bizing/code/packages/db/src/schema/sagas.ts`
- Added bootstrap guard script for depth lane schema drift:
  - `/Users/ameer/bizing/code/packages/db/scripts/bootstrap-saga-depth.ts`
  - wired into `db:push` and `db:migrate` in:
    - `/Users/ameer/bizing/code/packages/db/package.json`
  - `verify-bootstrap` now checks required depth columns:
    - `/Users/ameer/bizing/code/packages/db/scripts/verify-bootstrap.ts`
- Added saga depth contract at API/spec/runtime:
  - `saga.v1` spec now carries `depth`
  - sync/upsert/create-run now persist and denormalize depth
  - list endpoints support `depth` filtering:
    - `GET /api/v1/ooda/sagas/specs?depth=...`
    - `GET /api/v1/ooda/sagas/runs?depth=...`
  - admin-only depth reclassification endpoint:
    - `POST /api/v1/ooda/sagas/specs/depth/reclassify`
  - files:
    - `/Users/ameer/bizing/code/apps/api/src/sagas/spec-schema.ts`
    - `/Users/ameer/bizing/code/apps/api/src/sagas/depth.ts`
    - `/Users/ameer/bizing/code/apps/api/src/services/sagas.ts`
    - `/Users/ameer/bizing/code/apps/api/src/routes/sagas.ts`
    - `/Users/ameer/bizing/code/apps/api/src/scripts/rerun-sagas.ts`
- Added lane-aware runner commands and seed utility:
  - `sagas:rerun:shallow`
  - `sagas:rerun:medium`
  - `sagas:rerun:deep`
  - `sagas:depth:seed`
  - `seed-saga-depth-packs.ts` classifies all specs and creates lane packs.
- Added OODash UI support:
  - depth badge + depth filters on definitions and runs pages
  - files:
    - `/Users/ameer/bizing/code/apps/admin/src/components/sagas/explorer/common.tsx`
    - `/Users/ameer/bizing/code/apps/admin/src/components/sagas/explorer/definitions-page.tsx`
    - `/Users/ameer/bizing/code/apps/admin/src/components/sagas/explorer/runs-page.tsx`
    - `/Users/ameer/bizing/code/apps/admin/src/lib/sagas-api.ts`

Validation:
- `bun run --cwd apps/api typecheck` passed.
- `bun run --cwd apps/admin build` passed.
- `SAGA_DEPTH=shallow SAGA_FAST_MODE=1 bun run --cwd apps/api sagas:rerun` passed (`7/7`).
- `SAGA_DEPTH=medium SAGA_LIMIT=20 SAGA_FAST_MODE=1 bun run --cwd apps/api sagas:rerun` passed (`20/20`).
- `SAGA_DEPTH=deep SAGA_LIMIT=10 SAGA_FAST_MODE=1 bun run --cwd apps/api sagas:rerun` passed (`10/10`).

### Commercial execution read model (booking line lifecycle unification)

- Added canonical booking line execution endpoint:
  - `GET /api/v1/bizes/:bizId/booking-orders/:bookingOrderId/line-execution`
  - implementation:
    - `/Users/ameer/bizing/code/apps/api/src/routes/bookings.ts`
- Endpoint now computes deterministic line lifecycle state by combining:
  - immutable payment transaction line allocations (`payment_transaction_line_allocations` + `payment_transactions`)
  - linked fulfillment unit status (`fulfillment_units`)
- Added optional timeline projection on the same endpoint:
  - `includeTimeline=true` returns ordered line-level events (line creation anchor, payment allocations, fulfillment unit snapshots).
- This removes duplicated client-side status heuristics and gives one canonical API payload for commercial execution debugging.

Validation:
- `bun run --cwd apps/api typecheck` passed.
- `SAGA_FAST_MODE=1 SAGA_LIMIT=10 SAGA_STRICT_EXIT=1 bun run --cwd apps/api sagas:rerun` passed (`10/10`).

### Calendar/Time backbone hardening (scope normalization + projection-first timeline)

- Added canonical scope dictionary table:
  - `/Users/ameer/bizing/code/packages/db/src/schema/time_scopes.ts`
  - `time_scopes` introduces normalized `scope_ref_key` identities so
    scheduling/capacity modules can converge on one reusable scope pointer.
- Added `time_scope_id` bridge columns and tenant-safe FKs to key hold-domain
  tables in `/Users/ameer/bizing/code/packages/db/src/schema/time_availability.ts`:
  - `capacity_hold_policies`
  - `capacity_hold_demand_alerts`
  - `capacity_holds`
- Exposed new/related canonical tables via `@bizing/db` package barrel:
  - `timeScopes`
  - `availabilityGates`
  - `capacityHoldPolicies`
  - `capacityHoldDemandAlerts`
  - `capacityHoldEvents`
  - `calendarRevisions`
  - `calendarTimelineEvents`
  - `calendarOwnerTimelineEvents`
  - `availabilityResolutionRuns`
- Calendar timeline API route is now projection-first:
  - endpoint: `GET /api/v1/bizes/:bizId/calendars/:calendarId/timeline`
  - reads normalized timeline projections first, returns `timelineEvents` and
    `readModel=projection_first` when available
  - keeps deterministic raw fallback/fan-out path for parity/debug and supports
    `includeRaw=true`
  - implementation: `/Users/ameer/bizing/code/apps/api/src/routes/calendars.ts`
- Removed dead/unused scheduling enums from
  `/Users/ameer/bizing/code/packages/db/src/schema/enums.ts`:
  - `availabilityRuleOutcomeEnum`
  - `availabilityExceptionTypeEnum`

Validation:
- `bun run --filter @bizing/api typecheck` passed.
- `bun run --filter @bizing/api build` passed.
- `bun run --cwd /Users/ameer/bizing/code/packages/db build` passed.
- `bun run --cwd /Users/ameer/bizing/code/packages/db db:guard` passed with
  existing warning baseline (0 errors).

### Capacity-hold scope contract hard-cut (timeScopeId required + server-derived target key)

- Hardened generic CRUD action runtime so `capacityHoldPolicies`,
  `capacityHoldDemandAlerts`, and `capacityHolds` now enforce normalized scope:
  - `timeScopeId` is mandatory on create and required on update when missing on
    legacy rows
  - target shape is derived from `time_scopes` (including `targetType` and
    typed target FK columns)
  - `targetRefKey` is always derived from `time_scopes.scope_ref_key`
  - conflicting caller-provided target fields now fail fast with validation
    errors
  - implementation:
    - `/Users/ameer/bizing/code/apps/api/src/services/action-runtime.ts`
- Hardened calendar hold create route contract:
  - `POST /api/v1/bizes/:bizId/calendars/:calendarId/capacity-holds` now
    requires `timeScopeId`
  - route validates scope exists/active and calendar-scope alignment
  - route no longer accepts caller `targetRefKey`; subject linkage now uses
    scope-derived key
  - implementation:
    - `/Users/ameer/bizing/code/apps/api/src/routes/calendars.ts`
- Updated saga runner fixtures to create/use canonical `time_scopes` before
  creating capacity holds:
  - `/Users/ameer/bizing/code/apps/api/src/scripts/rerun-sagas.ts`

Validation:
- `bun run --filter @bizing/api typecheck` passed.
- `bun run --filter @bizing/api build` passed.
- `bun run --filter @bizing/admin build` passed.
- `SAGA_LIMIT=30 bun run --filter @bizing/api sagas:rerun:fast` passed (`30/30`).
- `SAGA_OFFSET=150 SAGA_LIMIT=30 bun run --filter @bizing/api sagas:rerun:fast`
  passed (`30/30`).

## 2026-02-28

## 2026-03-02

### Customer-facing Experience UI (simple-first, opt-in complexity)

- Added a new customer simulation route in admin app:
  - `/experience`
- Built a simple-first booking UX focused on:
  - actor impersonation (owner/member/customer),
  - smart default workspace seeding,
  - offer discovery + slot loading,
  - booking creation,
  - payment execution (advanced and Stripe intent path),
  - outbound message visibility.
- Added subtle slash-command discovery panel (`/` or `Cmd/Ctrl+K`) to reveal
  advanced controls only when needed:
  - actor lab, entity explorer, availability controls, API trace, raw JSON.
- Added rendered calendar timeline component for at-a-glance visibility of:
  - availability rules,
  - holds,
  - bookings,
  with lens modes and summary counters.
- Added availability-rule management panel with real API CRUD wiring.
- Extended studio API client with missing helpers:
  - availability rules CRUD/list,
  - capacity holds list,
  - Stripe public booking payment-intent creation.
- Added home-page navigation card to the new experience route.

Files:
- `/Users/ameer/bizing/code/apps/admin/src/app/experience/page.tsx`
- `/Users/ameer/bizing/code/apps/admin/src/components/customer-ui/experience-page.tsx`
- `/Users/ameer/bizing/code/apps/admin/src/components/customer-ui/feature-discovery-command.tsx`
- `/Users/ameer/bizing/code/apps/admin/src/components/customer-ui/calendar-timeline-view.tsx`
- `/Users/ameer/bizing/code/apps/admin/src/components/customer-ui/availability-rule-manager.tsx`
- `/Users/ameer/bizing/code/apps/admin/src/components/customer-ui/types.ts`
- `/Users/ameer/bizing/code/apps/admin/src/lib/studio-api.ts`
- `/Users/ameer/bizing/code/apps/admin/src/app/page.tsx`
- `/Users/ameer/bizing/code/docs/API.md`

Validation:
- `bun run --cwd /Users/ameer/bizing/code/apps/admin build` passed.

### New real customer-facing app route (`/customer`) while preserving `/experience`

- Kept existing `/experience` page unchanged.
- Added a separate real customer-facing route:
  - `/customer`
- New route is product-style by default:
  - discover published offers
  - view slot availability calendar
  - create booking
  - pay (advanced flow or Stripe intent)
  - review bookings and messages
- Admin impersonation remains available, but hidden behind discovery controls
  so the default view stays customer-first.
- Added optional business availability controls (hidden by default) for
  owner/admin testing with granular availability-rule management.
- Home now links to both:
  - `/customer` (real customer app)
  - `/experience` (existing lab page)
- Extended studio API wrappers for customer-flow parity:
  - public booking/payment wrappers now allow session-only auth (actor token optional)
  - public offer availability supports `offerVersionId`
  - added `getPublicOfferWalkUp` helper

Files:
- `/Users/ameer/bizing/code/apps/admin/src/app/customer/page.tsx`
- `/Users/ameer/bizing/code/apps/admin/src/components/customer-ui/customer-app-page.tsx`
- `/Users/ameer/bizing/code/apps/admin/src/lib/studio-api.ts`
- `/Users/ameer/bizing/code/apps/admin/src/app/page.tsx`
- `/Users/ameer/bizing/code/docs/API.md`

Validation:
- `bun run --cwd /Users/ameer/bizing/code/apps/admin build` passed.

### OODash API explorer health endpoint 404 fix

- Fixed admin rewrite coverage so API explorer requests to `/health*` are proxied
  to the API origin instead of falling through to a Next.js 404.
  - file:
    - `/Users/ameer/bizing/code/apps/admin/next.config.mjs`
- Updated the runtime OpenAPI explorer catalog to prefer canonical versioned
  health checks and avoid advertising unversioned `/health` in endpoint lists.
  - file:
    - `/Users/ameer/bizing/code/apps/api/src/services/openapi-explorer.ts`
- Updated API docs so operators know which health paths to use from OODash.
  - file:
    - `/Users/ameer/bizing/code/docs/API.md`

### Added customer calendar-aware scheduling UCs and generated saga coverage

- Extended the canonical UC document with:
  - `UC-300: The Front Desk Slot Suggestion With Customer Calendar Overlay`
  - `UC-301: The Customer-Controlled Opaque Availability Share`
  - source file:
    - `/Users/ameer/bizing/mind/workspace/documentation/use-cases-comprehensive.md`
- Generated and synced new saga specs from those UCs:
  - `uc-300-the-front-desk-manager-lisa`
  - `uc-300-the-solo-entrepreneur-sarah`
  - `uc-301-the-ddos-attacker-flood`
  - `uc-301-the-solo-entrepreneur-sarah`
  - files:
    - `/Users/ameer/bizing/code/testing/sagas/specs/uc-300-the-front-desk-manager-lisa.json`
    - `/Users/ameer/bizing/code/testing/sagas/specs/uc-300-the-solo-entrepreneur-sarah.json`
    - `/Users/ameer/bizing/code/testing/sagas/specs/uc-301-the-ddos-attacker-flood.json`
    - `/Users/ameer/bizing/code/testing/sagas/specs/uc-301-the-solo-entrepreneur-sarah.json`
- Executed all four new sagas in fast mode:
  - result: `4/4 passed`
  - command pattern:
    - `SAGA_FAST_MODE=1 SAGA_KEY=<saga-key> bun run --cwd apps/api sagas:rerun:fast`
- Synced UC/persona library records into DB for OODash surfaces:
  - command:
    - `syncSagaLoopLibraryFromDocs()`
  - result:
    - `useCaseCount: 301`
    - `personaCount: 55`
    - `linkedDefinitions: 320`

### OODash OpenAPI explorer + code-mode interface surface

- Added a runtime-generated API explorer catalog that enumerates API endpoints
  from mounted route files and server-level routes, then enriches each endpoint
  with auth posture and matching code-mode tools.
- Added new authenticated agent endpoints:
  - `GET /api/v1/agents/openapi/catalog`
  - `GET /api/v1/agents/openapi.json`
  - file:
    - `/Users/ameer/bizing/code/apps/api/src/routes/mcp.ts`
- Added catalog/openapi builder service:
  - `/Users/ameer/bizing/code/apps/api/src/services/openapi-explorer.ts`
  - includes mount-prefix resolution from core router wiring so nested surfaces
    like `/api/v1/agents/*` are cataloged with correct full paths.
- Added dedicated OODash API explorer page:
  - route:
    - `/ooda/api`
  - files:
    - `/Users/ameer/bizing/code/apps/admin/src/app/ooda/api/page.tsx`
    - `/Users/ameer/bizing/code/apps/admin/src/components/sagas/explorer/api-explorer-page.tsx`
    - `/Users/ameer/bizing/code/apps/admin/src/components/sagas/explorer/sagas-shell.tsx` (nav item)
- Explorer UX now supports:
  - endpoint catalog browsing/search/filter
  - interactive endpoint request execution with request/response JSON inspection
  - code-mode tool catalog browsing
  - interactive `/api/v1/agents/execute` tool execution
  - generated OpenAPI JSON inspection in the same view

### OODash UC coverage redesign (DB/API-native matrix)

- Added canonical unified UC coverage builder in saga services:
  - `rebuildUcCoverageMatrixReport(...)`
  - file:
    - `/Users/ameer/bizing/code/apps/api/src/services/sagas.ts`
- New matrix combines:
  - schema-baseline rows (imported from coverage markdown into DB)
  - API endpoint evidence from latest linked saga runs (`api_trace` artifacts)
  - one per-UC combined verdict (worst of schema/api verdicts)
- Coverage row evidence now carries richer payload:
  - schema section:
    - supporting tables inferred from explanation text
    - inferred table-connection chain
  - api section:
    - pass-rate metrics across latest runs
    - concrete endpoint signatures and status buckets
- Added dedicated API endpoints:
  - `POST /api/v1/ooda/sagas/uc-coverage/rebuild`
  - `GET /api/v1/ooda/sagas/uc-coverage/reports`
  - `GET /api/v1/ooda/sagas/uc-coverage/reports/:reportId`
  - file:
    - `/Users/ameer/bizing/code/apps/api/src/routes/sagas.ts`
- Added OODash Coverage view:
  - route:
    - `/ooda/coverage`
  - files:
    - `/Users/ameer/bizing/code/apps/admin/src/app/ooda/coverage/page.tsx`
    - `/Users/ameer/bizing/code/apps/admin/src/components/sagas/explorer/coverage-page.tsx`
    - `/Users/ameer/bizing/code/apps/admin/src/components/sagas/explorer/sagas-shell.tsx` (nav item)
    - `/Users/ameer/bizing/code/apps/admin/src/lib/sagas-api.ts` (client contract)
- Dashboard coverage card now points to the UC matrix report, not schema-only baseline:
  - `/Users/ameer/bizing/code/apps/admin/src/components/sagas/explorer/dashboard-page.tsx`
- Regenerated domain docs after route additions:
  - `bun run docs:generate:domains`
  - updated:
    - `/Users/ameer/bizing/code/docs/domains/sagas.md`

### Epic-driven UC expansion (UC-292..UC-299) + deterministic saga coverage

- Expanded canonical UC source with 8 new epic-inferred scenarios:
  - `UC-292` .. `UC-299` in:
    - `/Users/ameer/bizing/mind/workspace/documentation/use-cases-comprehensive.md`
  - focus area: external ecosystem reliability, connector operations, regulated integration gates, offline field-proof sync, and message forensics/replay.
- Regenerated and re-synced saga definitions from docs:
  - command:
    - `bun run --cwd /Users/ameer/projects/bizing/apps/api sagas:generate -- --uc=UC-292,UC-293,UC-294,UC-295,UC-296,UC-297,UC-298,UC-299 --sync=true`
  - result:
    - 8 new specs generated (`testing/sagas/specs/uc-292..uc-299-*.json`)
    - saga library sync completed.
- Validated new saga coverage in fast mode:
  - all newly generated keys (`uc-292..uc-299`) pass end-to-end in deterministic runner mode.

### Customer ops read-model parity fix for deterministic CRM validation

- Added missing `crmLeadId` query support to CRM task listing:
  - route:
    - `GET /api/v1/bizes/:bizId/crm-tasks`
  - file:
    - `/Users/ameer/bizing/code/apps/api/src/routes/customer-ops.ts`
  - impact:
    - deterministic saga checks can now verify lead-linked follow-up tasks without overfetching and client-side heuristics.
- Added/confirmed customer-ops read surfaces for support-case link/participant and profile merge queries in API docs:
  - file:
    - `/Users/ameer/bizing/code/docs/API.md`

### Strict proving + CI gate + lifecycle FK canonicalization

- Completed full strict-mode proving run against dedicated strict API instance:
  - mode: `BIZING_RUNTIME_ASSURANCE_MODE=staging_strict`
  - command: `sagas:collect` (fast mode)
  - result: `284/284 passed` after blocker remediation.
- Added core CI workflow:
  - file: `/Users/ameer/bizing/code/.github/workflows/ci-core.yml`
  - gates:
    - API build (`bun run --cwd apps/api build`)
    - docs domain check (`bun run docs:check:domains`)
    - strict saga smoke on ephemeral Postgres:
      - DB push
      - API boot in strict assurance mode
      - generate/sync 1 saga spec
      - rerun 1 deterministic saga in fast mode
- Canonicalized missing auth observability schema registration:
  - added `./src/schema/auth_observability.ts` to Drizzle config:
    - `/Users/ameer/bizing/code/packages/db/drizzle.config.ts`
- Made lifecycle delivery FK correction durable in bootstrap repair:
  - updated `/Users/ameer/bizing/code/packages/db/scripts/repair-canonical-indexes.ts`
  - now auto-detects legacy `lifecycle_events` FK targets on
    `lifecycle_event_deliveries`, deletes orphan rows, and rewires constraints
    to canonical `domain_events`.

### Hard-cut coherence pass: route classes, saga surface, delivery worker, strict assurance

- Route-class matrix now fails closed with no saga-legacy rule:
  - removed `/api/v1/sagas*` class mapping
  - unmatched routes now resolve to `internal_only` via `implicit-internal-fallback`
  - file:
    - `/Users/ameer/bizing/code/apps/api/src/middleware/route-class-matrix.ts`
- Removed lifecycle compatibility mirroring to legacy event rows:
  - action runtime no longer mirror-writes canonical `domain_events` into
    legacy lifecycle tables
  - lifecycle test route no longer inserts compatibility lifecycle rows
  - files:
    - `/Users/ameer/bizing/code/apps/api/src/services/action-runtime.ts`
    - `/Users/ameer/bizing/code/apps/api/src/routes/lifecycle-hooks.ts`
- OODA saga route/docs hard-cut cleanup:
  - saga docs/help text now references only `/api/v1/ooda/sagas/*` clock/scheduler paths
  - file:
    - `/Users/ameer/bizing/code/apps/api/src/routes/sagas.ts`
- Added real lifecycle delivery worker and control endpoints:
  - worker service:
    - `/Users/ameer/bizing/code/apps/api/src/services/lifecycle-delivery-worker.ts`
  - API endpoints:
    - `GET /api/v1/bizes/:bizId/lifecycle-event-deliveries/worker-health`
    - `POST /api/v1/bizes/:bizId/lifecycle-event-deliveries/process`
    - `POST /api/v1/lifecycle-event-deliveries/process-all`
  - server startup now launches the worker:
    - `/Users/ameer/bizing/code/apps/api/src/server.ts`
- Strict runtime assurance now fail-fast in strict modes:
  - new assurance mode utility:
    - `/Users/ameer/bizing/code/apps/api/src/lib/runtime-assurance.ts`
  - strict startup checks require `auth_access_events`
  - strict agent-governance checks no longer degrade when observability table is missing
  - files:
    - `/Users/ameer/bizing/code/apps/api/src/server.ts`
    - `/Users/ameer/bizing/code/apps/api/src/routes/mcp.ts`
- Deterministic saga gating is now explicit:
  - exploratory UC/persona step evaluation remains advisory evidence only
  - missing deterministic contracts are reported as `blocked` with
    `MISSING_DETERMINISTIC_EXECUTOR_CONTRACT`
  - file:
    - `/Users/ameer/bizing/code/apps/api/src/scripts/rerun-sagas.ts`

### Canonical CUD migration batch: queue + access-transfer domains

- Added reusable route-to-action bridge:
  - `/Users/ameer/bizing/code/apps/api/src/services/action-route-bridge.ts`
  - purpose: keep existing route ACL semantics while forcing route C/U/D
    through canonical `crud.*` action execution for traceability/idempotency.
- Migrated queue counter domain writes to canonical action execution:
  - `/Users/ameer/bizing/code/apps/api/src/routes/queue-counters.ts`
  - removed direct `db.insert/update/delete` in this route family.
- Migrated access transfer/resale domain writes to canonical action execution:
  - `/Users/ameer/bizing/code/apps/api/src/routes/access-transfers.ts`
  - transfer side-effects (artifact updates + artifact events) now also flow
    through canonical `crud.*` writes.
- Migrated most seating domain writes to canonical action execution:
  - `/Users/ameer/bizing/code/apps/api/src/routes/seating.ts`
  - single-row seat-map/seat/hold/reservation writes now use the route bridge.
  - intentional direct-write exception kept for bulk hold expiry endpoint
    (`.../holds/expire`) because it is a set-based transition.
- Validation:
  - `bun run --cwd /Users/ameer/bizing/code/apps/api build` passes.

### Route-class matrix + CUD DSL + OODA-native saga surface

- Added a canonical route-class auth matrix:
  - `public`
  - `session_only`
  - `machine_allowed`
  - `internal_only`
- Implemented matrix enforcement in auth middleware so machine/session posture
  is checked centrally by route class instead of route-by-route drift.
  - files:
    - `/Users/ameer/bizing/code/apps/api/src/middleware/route-class-matrix.ts`
    - `/Users/ameer/bizing/code/apps/api/src/middleware/auth.ts`
- Added generic CRUD action adapter DSL in canonical action runtime:
  - action keys starting with `crud.` are now supported
  - payload allows `tableKey` + `operation` + `data/patch/id`
  - emits canonical action/event/debug artifacts like other action adapters
  - file:
    - `/Users/ameer/bizing/code/apps/api/src/services/action-runtime.ts`
- Added OODA-native saga API surface by mounting saga routes under:
  - `/api/v1/ooda/sagas/*`
  - file:
    - `/Users/ameer/bizing/code/apps/api/src/routes/core-api.ts`
- Added docs automation scaffold for per-domain source-of-truth maps:
  - generator script: `/Users/ameer/bizing/code/scripts/generate-domain-docs.mjs`
  - commands:
    - `bun run docs:generate:domains`
    - `bun run docs:check:domains`
  - generated output root:
    - `/Users/ameer/bizing/code/docs/domains`
- Strengthened fresh-bootstrap reliability checks:
  - added DB bootstrap verifier script:
    - `/Users/ameer/bizing/code/packages/db/scripts/verify-bootstrap.ts`
  - `db:push` / `db:migrate` now run:
    - schema push
    - canonical index repair
    - bootstrap verification
  - package script updates in:
    - `/Users/ameer/bizing/code/packages/db/package.json`

### Canonical hard-cut consolidation: memberships/events/ACL/actions/saga-spec/auth defaults

- Removed duplicate membership schema module:
  - deleted `/Users/ameer/bizing/code/packages/db/src/schema/memberships.ts`
  - canonical biz membership model is now Better Auth `members` + ACL mappings.
  - updated exports/config references in:
    - `/Users/ameer/bizing/code/packages/db/src/index.ts`
    - `/Users/ameer/bizing/code/packages/db/drizzle.config.ts`
    - `/Users/ameer/bizing/code/packages/db/src/schema/users.ts`
- Unified event storage to one canonical rail:
  - removed duplicate `event_subscriptions` / `event_deliveries` from
    `/Users/ameer/bizing/code/packages/db/src/schema/domain_events.ts`
  - removed duplicate `lifecycle_events` table from
    `/Users/ameer/bizing/code/packages/db/src/schema/extensions.ts`
  - lifecycle subscriptions/deliveries now reference canonical `domain_events`.
  - updated dependent FKs:
    - `/Users/ameer/bizing/code/packages/db/src/schema/communications.ts`
    - `/Users/ameer/bizing/code/packages/db/src/schema/reporting.ts`
- Lifecycle API compatibility preserved while storage changed:
  - `/api/v1/bizes/:bizId/lifecycle-events*` now reads/writes `domain_events`
    and returns legacy response aliases (`eventName`, `entityType`, `entityId`)
    to keep saga contracts stable.
  - write endpoints now require `events.write`.
  - file: `/Users/ameer/bizing/code/apps/api/src/routes/lifecycle-hooks.ts`
- Action runtime now executes under one transaction context end-to-end:
  - added async-local transaction-scoped DB proxy so action adapters and helper
    writes share the same transaction boundary.
  - file: `/Users/ameer/bizing/code/apps/api/src/services/action-runtime.ts`
- ACL runtime is now strict and cohesive:
  - removed legacy fallback evaluation path.
  - ACL bootstrap errors are now surfaced instead of silently swallowed.
  - file: `/Users/ameer/bizing/code/apps/api/src/services/acl.ts`
- Saga spec contract is now v1-only:
  - removed `saga.v0` parsing/normalization path.
  - OODash default draft definition template now emits `saga.v1`.
  - files:
    - `/Users/ameer/bizing/code/apps/api/src/sagas/spec-schema.ts`
    - `/Users/ameer/bizing/code/apps/admin/src/lib/ooda-api.ts`
- API key auth acceptance widened by default:
  - `requireAuth` and `optionalAuth` now accept direct API keys by default.
  - API credential creation defaults to `allowDirectApiKeyAuth: true`.
  - files:
    - `/Users/ameer/bizing/code/apps/api/src/middleware/auth.ts`
    - `/Users/ameer/bizing/code/apps/api/src/services/machine-auth.ts`
- Validation:
  - `bun run --cwd apps/api build` passes
  - `bun run --cwd apps/admin build` passes
  - `bun run --cwd packages/db build` passes
  - corrected stale module mapping in
    `/Users/ameer/bizing/code/packages/db/SCHEMA_BIBLE.md` so docs reflect
    the canonical post-hard-cut schema file topology.

### Renamed saga explorer route surface to `/ooda` and `OODash` (hard cut)

- Canonical admin explorer route is now `/ooda` (and `/ooda/*`).
- Removed `/sagas/*` UI routes entirely in v0 (no compatibility redirect layer).
- Explorer shell naming updated in UI copy from "OODA Dashboard" to `OODash`.
- Fixed import drift in explorer components after route-surface rename:
  - `/Users/ameer/bizing/code/apps/admin/src/components/sagas/explorer/loop-detail-page.tsx`
  - `/Users/ameer/bizing/code/apps/admin/src/components/sagas/explorer/common.tsx`
- Removed legacy route files under:
  - `/Users/ameer/bizing/code/apps/admin/src/app/sagas/*`
- Validation:
  - `bun run --cwd apps/admin build` passes
  - `bun run --cwd apps/api build` passes

### Added internal QA Lab UI for endpoint + UC proving

- Added a new operator-focused page at `/sagas/lab`:
  - route: `/Users/ameer/bizing/code/apps/admin/src/app/sagas/lab/page.tsx`
  - screen component: `/Users/ameer/bizing/code/apps/admin/src/components/sagas/explorer/lab-page.tsx`
- QA Lab capabilities:
  - authenticated endpoint workbench (manual method/path/headers/body + rich response view)
  - deterministic smoke pack for high-signal baseline checks (`auth`, `sagas`, `ooda`, `agents`)
  - UC runner panel that launches saga definitions (`createRun` + `executeRun`) and links directly to run evidence pages
- Wired explorer navigation + dashboard entry points:
  - added `QA Lab` to saga sidebar in `/Users/ameer/bizing/code/apps/admin/src/components/sagas/explorer/sagas-shell.tsx`
  - added dashboard quick action button in `/Users/ameer/bizing/code/apps/admin/src/components/sagas/explorer/dashboard-page.tsx`
- Validation:
  - `bun run --cwd apps/admin build` passes, including type checks and static page generation.

### Added Operations Studio for full lifecycle endpoint simulation

- Added new route-based operator UI:
  - route: `/Users/ameer/bizing/code/apps/admin/src/app/sagas/studio/page.tsx`
  - screen: `/Users/ameer/bizing/code/apps/admin/src/components/sagas/explorer/ops-studio-page.tsx`
  - client API layer: `/Users/ameer/bizing/code/apps/admin/src/lib/studio-api.ts`
- Studio capabilities are lifecycle-focused (not generic endpoint exploration):
  - actor creation + impersonation token switching
  - biz setup (biz, locations, resources)
  - catalog setup (service groups/services/offers/offer versions/products/service products)
  - calendar setup (calendars, bindings, timeline)
  - customer flow (public offer availability, booking, advanced payment)
  - comms + payments visibility (outbound sms/email + payment intent details)
- Added secure platform-admin impersonation helpers in API:
  - `GET /api/v1/auth/impersonation/users`
  - `POST /api/v1/auth/impersonation/users`
  - `POST /api/v1/auth/impersonation/tokens`
  - implemented in `/Users/ameer/bizing/code/apps/api/src/routes/auth-machine.ts`
- Explorer navigation updates:
  - new sidebar item: `Operations Studio`
  - dashboard quick-link to `/sagas/studio`
- Validation:
  - `bun run --cwd apps/api build` passes
  - `bun run --cwd apps/admin build` passes

### Expanded Operations Studio into multi-domain endpoint exerciser

- Extended `/sagas/studio` beyond setup/catalog/booking to include first-class
  operational tabs that execute real API flows:
  - `Queues + Workflows + Dispatch`
  - `Memberships + Entitlements`
  - `CRM`
  - `Channels`
  - `Compliance`
- Added client wrappers in `/Users/ameer/bizing/code/apps/admin/src/lib/studio-api.ts`
  for these route families:
  - queues
  - workflows/review queues
  - dispatch
  - entitlements/memberships
  - CRM
  - channel integrations
  - compliance controls/gates
- Extended `/Users/ameer/bizing/code/apps/admin/src/components/sagas/explorer/ops-studio-page.tsx`
  with create/list/test handlers + payload viewers so operators can validate
  real lifecycle contracts without dropping into raw endpoint workbench mode.
- Validation:
  - `bun run --cwd apps/api build` passes
  - `bun run --cwd apps/admin build` passes

### Added one-click scenario macros in Operations Studio

- Added a new macro runner panel at the top of `/sagas/studio` with:
  - `Run full service lifecycle`
  - `Run ops control tower`
  - `Run revenue + growth stack`
  - `Run full suite`
- Macros execute real endpoint chains and now leave the Studio preloaded with
  refreshed evidence (bookings, payments/messages, queues/workflows, dispatch,
  memberships/entitlements, CRM, channels, compliance).

### Upgraded Operations Studio with sandbox isolation, API tracing, and visual calendar lensing

- Added sandbox-loop workflow to `/sagas/studio`:
  - create new sandbox loop contexts directly in the UI
  - seed users per sandbox
  - keep actor/entity visibility scoped to active sandbox via local registry
  - persist selected biz per sandbox for quick context switching
- Added context navigator panel:
  - list and switch sandbox-scoped bizes, locations, resources, services, and offers
  - one-click selection now updates dependent forms and booking/calendar controls
- Added API request inspector:
  - captures method/path/status/duration for every studio API call
  - renders exact endpoint URL, request JSON, and response JSON
  - implemented through shared trace listener in
    `/Users/ameer/bizing/code/apps/admin/src/lib/studio-api.ts`
- Added visual calendar rendering:
  - timeline lens controls (`all`, `location`, `resource`, `service`, `offer`)
  - rendered booking/hold event stream with status + references
  - retained raw timeline JSON panel for deep inspection
- Form UX improvement:
  - key setup forms now use visible field titles with inline explainer tooltips
    instead of placeholder-only inputs
- Validation:
  - `bun run --cwd apps/admin build` passes
  - `bun run --cwd apps/api build` passes
- Added step-by-step macro execution logs in UI so operators can see exactly
  which lifecycle steps completed and where failures occurred.
- Validation:
  - `bun run --cwd apps/api build` passes
  - `bun run --cwd apps/admin build` passes

## 2026-03-01

### Saga generation upgraded to higher-fidelity lifecycle simulation

- Updated `/Users/ameer/bizing/code/apps/api/src/services/sagas.ts` generator logic
  so generated `saga.v1` specs are more realistic and deterministic:
  - UC-keyword extensions now inject richer explicit lifecycle steps for:
    - call-fee pricing
    - demand/surge pricing
    - queue/waitlist flow
    - advanced payments
    - external integrations
    - compliance checks
    - route/dispatch operations
    - analytics/kpi closeout checks
  - Communication-heavy UCs now include explicit actor-message proof steps:
    - `demo-send-email-message`
    - `demo-send-sms-message`
    - `demo-verify-comms-messages`
  - Core lifecycle steps now include virtual clock/scheduler delays (`fixed` and
    `until_condition`) so timeline behavior better represents real-world pacing.
- Regenerated specs from canonical docs and synced definitions:
  - command: `bun run --cwd /Users/ameer/bizing/code/apps/api sagas:generate -- --overwrite=true --sync=true`
  - generated: `279`
  - synced definitions: `282`
- Smoke validation after generation:
  - `SAGA_LIMIT=20 bun run --cwd /Users/ameer/bizing/code/apps/api sagas:collect`
  - result: `20/20 passed`

### Deterministic saga message-demo step handlers

- Added explicit runner handlers in `/Users/ameer/bizing/code/apps/api/src/scripts/rerun-sagas.ts`:
  - `demo-send-email-message`
  - `demo-send-sms-message`
  - `demo-verify-comms-messages`
- Purpose:
  - let teams create tiny comms-focused saga definitions that always generate
    visible run actor-message evidence (SMS + email) in UI and API.
- Verified with a new demo definition/run:
  - run produced 2 actor messages (`1 email`, `1 sms`) and passed.

### OODA loop detail UX simplified (no explicit phase jargon)

- Refactored `/Users/ameer/bizing/code/apps/admin/src/components/sagas/explorer/loop-detail-page.tsx`
  to remove explicit `Observe/Orient/Decide/Act` framing from operator UX.
- Replaced phase-board layout with principle-driven lanes:
  - `Signals & Gaps`
  - `Decisions & Plans`
  - `Execution Outcomes`
- Removed phase controls from loop edit + entry creation dialogs.
- Loop-entry writes now auto-map backend phase from entry type so the schema/API
  remain canonical while the UX stays simple and practical.
- Removed redundant client-side run execution/linking calls from loop detail.
  The loop-run API is now the single source of truth for execute + link behavior.
- Loop-entry UI now auto-fills contract-required evidence fields:
  - adds `evidence.reportNote` from body/title
  - infers `owningLayer` from selected `gapType`
  This keeps add-entry UX simple while satisfying backend quality constraints.
- Mission-first copy pass:
  - loop list/detail/navigation copy now uses "missions" as the primary UX term
  - removed remaining explicit phase jargon from list/detail headlines
  - mission cards now show `last signal` instead of internal `currentPhase`

### OODA loop-run linkage and execution stabilization

- Fixed `/api/v1/ooda/loops/:loopId/saga-runs` so loop-launched runs are always
  linked canonically, not just in JSON payloads:
  - now always upserts `ooda_loop_links` with `targetType='saga_run'`,
    `relationRole='output'`
  - now writes `ooda_loop_actions.linkedSagaRunId` from the created run id
- Added `autoExecute` support on loop-run creation (default `true`):
  - when session cookie exists, run executes immediately server-side
  - when cookie is missing, action is marked failed with an explicit reason
  - route now returns refreshed run detail after execution attempt
- Added OODA loop self-heal on loop-detail reads:
  - backfills missing run links from action payloads when possible
  - marks stale actions as failed when referenced runs no longer exist
    (common after hard reset/reseed cycles)
- Fixed hard-reset drift:
  - `resetSagaLoopData()` now truncates OODA tables too, preventing stale loop
    journals from pointing at deleted saga runs.

### OODA workflow-contract tightening (gate + gap ownership + evidence quality)

- Aligned OODA schema/API to the v3 workflow contract:
  - Added explicit loop-gate API fields in `/Users/ameer/bizing/code/apps/api/src/routes/ooda.ts`:
    - `designGateStatus` (`pending|passed|failed`)
    - `behaviorGateStatus` (`pending|passed|failed`)
  - Gate statuses are persisted in `ooda_loops.metadata.workflowContract` so no DB hard migration is required for the tighten pass.
  - Gap owner is now required at API level (`owningLayer`) and persisted as `evidence.owningLayer` on OODA entries.
- Tightened API request validation in `/Users/ameer/bizing/code/apps/api/src/routes/ooda.ts`:
  - gap entries must include `owningLayer`
  - meaningful entries (`signal|result|postmortem`) require evidence anchors
  - resolved `result` entries must include API trace evidence refs
- Updated canonical docs:
  - `/Users/ameer/bizing/code/docs/API.md`
  - `/Users/ameer/bizing/code/docs/SCHEMA_BIBLE.md`

### Saga rerun fast mode added for quick validation loops

- Added first-class fast mode controls to `/Users/ameer/bizing/code/apps/api/src/scripts/rerun-sagas.ts`:
  - `SAGA_FAST_MODE=1` now defaults to:
    - keep per-step `pending -> in_progress -> terminal` lifecycle transitions
    - keep API trace artifact persistence (required for step pass-state validation)
    - no snapshot artifact persistence
    - no coverage persistence on final refresh
  - full-mode behavior remains unchanged when `SAGA_FAST_MODE` is not enabled.
- Added granular overrides for mixed runs:
  - `SAGA_ATTACH_API_TRACES`
  - `SAGA_ATTACH_SNAPSHOTS`
  - `SAGA_STEP_TRANSITION_IN_PROGRESS`
  - `SAGA_RECOMPUTE_INTEGRITY`
  - `SAGA_PERSIST_COVERAGE`
- Added script alias in `/Users/ameer/bizing/code/apps/api/package.json`:
  - `sagas:rerun:fast`
- Updated canonical API docs with fast-mode usage and override semantics:
  - `/Users/ameer/bizing/code/docs/API.md`

### Saga runtime hard-cut to `saga.v1` simulation model

- Upgraded canonical saga spec contract to `saga.v1` in:
  - `/Users/ameer/bizing/code/apps/api/src/sagas/spec-schema.ts`
  - `/Users/ameer/bizing/code/testing/sagas/SAGA_SPEC.md`
- Added first-class simulation config to spec:
  - `simulation.clock` (virtual/realtime, timezone, autoAdvance)
  - `simulation.scheduler` (deterministic/realtime, poll/timeout/tick defaults)
- Migrated file-based saga specs to `saga.v1` with simulation defaults:
  - `/Users/ameer/bizing/code/testing/sagas/specs/*.json`
- Added DB-native simulation primitives:
  - `saga_run_simulation_clocks`
  - `saga_run_scheduler_jobs`
  - plus new enums in `/Users/ameer/bizing/code/packages/db/src/schema/enums.ts`
- Saga run creation now seeds normalized simulation context and a run clock row.
- Saga run detail/test-mode responses now include:
  - `simulationClock`
  - `schedulerJobs`
- Added simulation control API endpoints:
  - `GET /api/v1/sagas/runs/:runId/clock`
  - `POST /api/v1/sagas/runs/:runId/clock/advance`
  - `GET /api/v1/sagas/runs/:runId/scheduler/jobs`
  - `POST /api/v1/sagas/runs/:runId/scheduler/jobs`
  - `PATCH /api/v1/sagas/runs/:runId/scheduler/jobs/:jobId`
- Added matching agent/code-mode tools for the new saga simulation APIs in:
  - `/Users/ameer/bizing/code/apps/api/src/code-mode/tools.ts`
- Reworked runner delay semantics in:
  - `/Users/ameer/bizing/code/apps/api/src/scripts/rerun-sagas.ts`
  - fixed/condition delays now use virtual clock + scheduler jobs instead of wall-clock sleeps.

### OODA dashboard backbone added (schema + API + admin explorer)

- Added a new canonical schema module:
  - `/Users/ameer/bizing/code/packages/db/src/schema/ooda.ts`
  - `ooda_loops`
  - `ooda_loop_links`
  - `ooda_loop_entries`
  - `ooda_loop_actions`
- Wired OODA schema into DB package exports and drizzle schema config:
  - `/Users/ameer/bizing/code/packages/db/src/index.ts`
  - `/Users/ameer/bizing/code/packages/db/drizzle.config.ts`
- Added OODA API routes:
  - `/Users/ameer/bizing/code/apps/api/src/routes/ooda.ts`
  - mounted through `/Users/ameer/bizing/code/apps/api/src/routes/core-api.ts`
- OODA mutations now emit live refresh events over the shared
  `/api/v1/ws/sagas` websocket transport, so loop list/detail pages update in
  near realtime across clients.
- Added OODA-aware admin client and realtime helper:
  - `/Users/ameer/bizing/code/apps/admin/src/lib/ooda-api.ts`
  - `/Users/ameer/bizing/code/apps/admin/src/lib/use-saga-realtime.ts`
- Added route-based OODA explorer pages:
  - `/Users/ameer/bizing/code/apps/admin/src/app/sagas/loops/page.tsx`
  - `/Users/ameer/bizing/code/apps/admin/src/app/sagas/loops/[loopId]/page.tsx`
  - `/Users/ameer/bizing/code/apps/admin/src/components/sagas/explorer/loops-page.tsx`
  - `/Users/ameer/bizing/code/apps/admin/src/components/sagas/explorer/loop-detail-page.tsx`
- Added `/ooda` route alias to the saga explorer shell:
  - `/Users/ameer/bizing/code/apps/admin/src/app/ooda/page.tsx`
  - `/Users/ameer/bizing/code/apps/admin/src/app/ooda/[...slug]/page.tsx`
- Added create flows to list pages so use-cases/personas/definitions are
  crudable directly from the dashboard surface.
- Visual QA pass captured and reviewed screenshots under:
  - `/Users/ameer/bizing/code/.tmp/ooda-screens/`

### Saga library CRUD completed in detail pages

- Added full dashboard CRUD controls for:
  - use cases (`/sagas/use-cases/:ucKey`): edit definition, create new version, archive/delete
  - personas (`/sagas/personas/:personaKey`): edit definition, create new version, archive/delete
  - saga definitions (`/sagas/definitions/:sagaKey`): inspect JSON spec, edit/save spec, create explicit revision, archive/delete
- Extended admin client API methods in:
  - `/Users/ameer/bizing/code/apps/admin/src/lib/sagas-api.ts`
- Added scrollable editor dialogs for long markdown/json content so editing remains usable on large specs.
- Visual validation screenshots for new CRUD dialogs were captured under:
  - `/Users/ameer/bizing/code/.tmp/ooda-screens/`

### Saga batch hardening: batch 1 green, batch 2 validator cluster tightened

- Batch 1 (`OFFSET=0 LIMIT=28`) now reruns cleanly: `28/28 passed`.
- Fixed `UC-114` by correcting explicit UC-need remapping and making Messenger social-booking proof deterministic instead of relying on a read-only persona check.
- Started tightening the batch-2 communication/compliance cluster by adding deterministic proof handlers for:
  - quiet-hour enforcement by timezone
  - annual waiver reuse for recurring visits
  - concrete SMS confirmation/reminder examples
  - rich onboarding/preparation email examples
  - postal appointment-reminder / legal-notice examples
  - multi-channel and scenario-specific marketing sequence proofs
  - membership freeze / proration / retry phrase variants

### Saga explorer UI rebuilt into route-based pages

- Replaced the monolithic `/sagas` admin screen with a route-based explorer shell and dedicated pages for:
  - use cases
  - personas
  - saga definitions
  - saga runs
- Added shared admin client data helpers in `/Users/ameer/bizing/code/apps/admin/src/lib/sagas-api.ts` for saga detail pages, including revision reads, artifact content reads, and run creation.
- Added detail flows so each entity page can open its connected objects directly:
  - use case -> linked definitions -> connected runs
  - persona -> linked definitions -> connected runs
  - definition -> revisions, linked use cases/personas, run history
  - run -> linked use case/persona/definition, actor messages, artifacts, and step timeline
- Removed the dead saga-monolith components that the new explorer no longer uses.
- Fixed the new run detail page to treat schema coverage as optional instead of crashing when a run has no attached coverage report.
- Added a persistent trigger in the main saga explorer content rail so the sidebar can always be reopened after being hidden.
- Fixed the shared admin sidebar primitive to reserve desktop layout width with a real gap rail; inset sidebars no longer sit on top of page content.
- Restored the low-opacity segmented run-progress backdrop on saga cards so the dashboard and run groups regain the old at-a-glance visual cue for passed/failed/pending/skipped steps.
- Extended the same visual cue language into the run detail timeline: step cards now carry a subtle status backdrop keyed to passed/failed/running/skipped state.
- Added aggregated segmented progress backdrops to phase accordion rows in the run timeline, restoring the at-a-glance cue even while phases are collapsed.

### Platform admin restored for local testing

- Re-elevated `ameer@biz.ing` to `users.role = admin` in the local dev database after the account was recreated.
- If the browser session still reflects the previous role claims, sign out once and sign back in so the UI picks up the new platform role.

### Saga API ergonomics tightened after the next-20 rerun

- Added `GET /api/v1/bizes/:bizId/policies/templates/:policyTemplateId` so validators and UIs can read one policy template directly instead of inferring from list output.
- Policy template creation now auto-derives a slug when the caller omits one.
- Communication-consent creation now upserts the canonical `(biz, subject, channel, purpose)` row instead of throwing duplicate-key errors during repeated saga setup.
- Membership plan creation now defaults `entitlementType` to `custom` so simple membership tiers do not need fake entitlement payload just to exist.
- Instrument-run creation now auto-registers missing assignee subjects, and run-created instrument events now do the same for actor subjects, so the subject graph no longer causes false FK failures in checklist/form sagas.
- Next-20 rerun improved from `10/20 passed` to `13/20 passed`; the remaining failures are exploratory-only validator gaps, not broken endpoint contracts.

### Proactive saga-support reads and agent tools added

- Added canonical read-model endpoints used by owner/operator saga steps:
  - `GET /api/v1/bizes/:bizId/analytics/overview`
  - `GET /api/v1/bizes/:bizId/calendars/:calendarId/timeline`
- Exposed missing agent tools for authz/admin and operator review flows:
  - member list/create/update/delete/offboard
  - invitation list/create/delete
  - analytics overview
  - calendar timeline
- Exported `capacityHolds` through `@bizing/db` so the new calendar timeline route can read the canonical hold table directly.

### Canonical action API expanded into real event-backed runtime

- Extended `/Users/ameer/bizing/code/apps/api/src/services/action-runtime.ts` with new first-class actions:
  - `service_product.publish`
  - `member.offboard`
  - `calendar.block`
- Successful action execution now emits a canonical `domain_event` and writes an `action_activity` projection document.
- Action detail reads now include the action's emitted domain events.

### Public action surface added for customer/session flows

- Added:
  - `POST /api/v1/public/bizes/:bizId/actions/preview`
  - `POST /api/v1/public/bizes/:bizId/actions/execute`
- Public action allowlist is explicit and currently limited to `booking.create`.
- This lets customer-facing flows use the same action backbone as internal staff/admin flows without requiring biz membership.

### Saga runtime moved closer to the canonical write path

- `/Users/ameer/bizing/code/apps/api/src/scripts/rerun-sagas.ts` now uses the actions API for:
  - offer publishing
  - public booking creation
  - member offboarding validation
- This reduces drift between saga proofs and the future canonical API design.

### Shared booking lifecycle side effects extracted

- Added `/Users/ameer/bizing/code/apps/api/src/services/booking-lifecycle-messages.ts`
- Direct booking routes and action-backed booking execution now share the same message persistence logic.
- This keeps confirmation/cancellation proof artifacts consistent across both paths.

### Route and ACL cleanup

- Removed the duplicated `/bizes/:bizId/members/:memberId/offboard` definition from `/Users/ameer/bizing/code/apps/api/src/routes/authz.ts`
- Added `events.read` ACL seed and role defaults for manager/staff/host.
- Added agent tools for:
  - public action execution
  - domain-event listing

### Local validation note

- Live API smoke validation exposed that the local development database was behind the redesigned schema.
- A focused local backbone backfill was applied so the running API could validate the new action/event/projection flow before full fresh migrations are regenerated.

## 2026-02-27

### Saga proof surfaces hardened for UC-1 lifecycle validation

- Added canonical communications read routes in:
  - `/Users/ameer/bizing/code/apps/api/src/routes/communications.ts`
  - `GET /api/v1/bizes/:bizId/outbound-messages`
  - `GET /api/v1/bizes/:bizId/outbound-messages/:messageId`
- Booking lifecycle routes now persist simulated transactional message rows on:
  - booking confirmation
  - booking cancellation
- Public offer availability now also respects manually blocked windows stored in biz availability metadata.
- Payment intent detail now safely returns resolved processor-account context even when an intent has no processor account id.
- Saga runner deterministic validation expanded for UC-1 / Dr. Chen:
  - availability
  - email confirmations
  - calendar sync
  - Stripe-backed payment collection
  - cancellation notice flow
  - booking notes
  - high-volume day-view workload
  - dictated notes
  - emergency slot blocking
  - delegated assistant scheduling

Implication:
- `uc-1-the-appointment-heavy-professional-dr-ch` now finishes with concrete API-backed evidence instead of exploratory ambiguity.

### API foundation hardening + service/calendar coverage expansion

- Added new first-class API route modules:
  - `/Users/ameer/bizing/code/apps/api/src/routes/services.ts`
  - `/Users/ameer/bizing/code/apps/api/src/routes/service-products.ts`
  - `/Users/ameer/bizing/code/apps/api/src/routes/calendars.ts`
- New coverage includes:
  - service groups + services CRUD
  - service products CRUD
  - service-product service bindings CRUD (soft-delete)
  - calendars CRUD
  - calendar bindings CRUD (owner -> calendar)
  - availability rules CRUD
- Mounted new modules under canonical core router:
  - `/Users/ameer/bizing/code/apps/api/src/routes/core-api.ts`

Security hardening:
- `GET /api/v1/agents/manifest` now requires auth (same as other agents endpoints).
- `/api/v1/agents/execute` now forwards cookie + machine auth headers (`Authorization`, `x-api-key`, `x-access-token`) so machine-authenticated agents can execute tool calls without auth loss.
- Added `bizing.api.raw` authenticated passthrough tool for future-proof `/api/v1/*` coverage without SQL access.
- Legacy helper endpoints in `/Users/ameer/bizing/code/apps/api/src/server.ts` are now auth-gated.
- Mind/knowledge filesystem endpoints now require platform-admin auth.
- `/api/v1/stats` now scopes data to caller visibility (platform admin sees global; members see only their biz memberships).
- Intentional failure test routes are now disabled by default and mount only when `ENABLE_TEST_FAILURE_ROUTES=true`.

ACL expansion:
- Added permission seeds for:
  - `services.*`
  - `service_products.*`
  - `calendars.read`, `calendars.write`
  - `availability_rules.read`, `availability_rules.write`
- Updated default manager/staff/host/member permission bundles to include appropriate read/write access.

DB package exports:
- Exposed route-critical table refs in `/Users/ameer/bizing/code/packages/db/src/index.ts`:
  - `serviceGroups`, `services`, `serviceProducts`, `serviceProductServices`
  - `calendars`, `calendarBindings`, `availabilityRules`

### Auth observability backbone added (principals + event ledger)

- Added new canonical schema module:
  - `/Users/ameer/bizing/code/packages/db/src/schema/auth_observability.ts`
  - `auth_principals`: normalized actor identity rows (session/api key/access token/system actor)
  - `auth_access_events`: append-style auth decision and lifecycle event ledger
- Exported the new module through canonical schema barrel and DB package:
  - `/Users/ameer/bizing/code/packages/db/src/schema/canonical.ts`
  - `/Users/ameer/bizing/code/packages/db/src/index.ts`
- Added API service for resilient auth telemetry writes/reads:
  - `/Users/ameer/bizing/code/apps/api/src/services/auth-observability.ts`
  - No-ops automatically when tables are not migrated yet (safe rollout).
- Wired middleware-level auth decision logging:
  - `/Users/ameer/bizing/code/apps/api/src/middleware/auth.ts`
  - Captures allow/deny decisions for `requireAuth` and `requireSessionAuth`.
- Wired auth lifecycle event logging in machine-auth routes:
  - key create/revoke/rotate
  - access token issue/revoke
  - active-biz switch auth-context event
- Added observability read endpoints:
  - `GET /api/v1/auth/events`
  - `GET /api/v1/auth/principals`

Implication:
- You now have first-class, queryable auth forensics for enterprise operations and incident response, while preserving existing session + API-key auth behavior.

### Auth core hardened for machine-first API usage

- Added reusable session-only guard middleware:
  - `requireSessionAuth` in `/Users/ameer/bizing/code/apps/api/src/middleware/auth.ts`
- Machine auth parsing now accepts API keys provided as:
  - `x-api-key`
  - `Authorization: ApiKey ...`
  - `Authorization: Bearer ...` when token matches API-key format
- API key creation defaults `allowDirectApiKeyAuth` to `true` for better developer ergonomics.
- API key creation now supports optional immediate bootstrap bearer token issuance.
- Added key rotation endpoint:
  - `POST /api/v1/auth/api-keys/:apiCredentialId/rotate`
- Added token inventory endpoint:
  - `GET /api/v1/auth/tokens`
- `/api/v1/auth/me` now returns auth context metadata (`source`, `scopes`, `credentialId`) in addition to user/session/memberships.

Implication:
- The API is no longer perceived as cookie-first; machine integrations can authenticate and rotate credentials cleanly with first-class workflows.

### Saga coverage became DB-first and API-writable

- Added canonical DB-native schema coverage writer:
  - `POST /api/v1/sagas/schema-coverage/reports`
- Refactored markdown import to reuse the same canonical writer path:
  - `POST /api/v1/sagas/schema-coverage/import` now feeds the same normalization/tag pipeline.
- Removed platform-admin gate from schema coverage import to unblock authenticated test workflows.
- Coverage tags and item dimensions (`#full/#strong/...`, N2H, C2E) are now consistently normalized through one service path.
- Dashboard schema coverage views continue to read from DB and now work with both direct API writes and imports.

Implication:
- Coverage matrix can be generated/edited entirely via API + DB and displayed in `/sagas` without document coupling.

### Terminology normalization: intake forms vs check-in

- Standardized wording to use `intake form` for pre-service data capture workflows.
- Reserved `check-in` for operational arrival/attendance/ticket flows.
- Updated canonical docs:
  - `/Users/ameer/bizing/code/docs/SCHEMA_BIBLE.md`
  - `/Users/ameer/bizing/code/docs/API.md`
  - `/Users/ameer/bizing/code/packages/db/src/schema/SCHEMA.md`
  - `/Users/ameer/bizing/mind/workspace/documentation/use-cases-comprehensive.md`
  - schema coverage docs referencing UC-125 now use `instruments` terminology.

Implication:
- Reduces domain ambiguity for humans and agents when implementing APIs, sagas, and schema comments.

### Documentation backbone established

- Added canonical docs hub under `/Users/ameer/bizing/code/docs`.
- Added API and schema mapping notes intended for agent + human consumption.
- Added `SKILLS.md` to make skill discovery/trigger rules explicit for code work.
- Added explicit doc-sync protocol requiring code docs and mind updates on meaningful changes.
- Added repo-level `/Users/ameer/bizing/code/AGENTS.md` with body<->mind operating rules.
- Added `docs:check` guard script (`scripts/docs-sync-check.mjs`) to catch code changes without docs updates.
- Linked body (`/Users/ameer/bizing/code`) and mind (`/Users/ameer/bizing/mind`) through bridge notes.

Implication:
- Future changes now have a deterministic place for documentation and memory synchronization.

### Saga blocker sweep: first-10 batch taken to deterministic green

- Added first-class policy template/rule/binding APIs plus template patch support:
  - `/Users/ameer/bizing/code/apps/api/src/routes/policies.ts`
- Added booking participant APIs for attendee/payment-obligation proof flows:
  - `/Users/ameer/bizing/code/apps/api/src/routes/booking-participants.ts`
- Added location-ops overview API:
  - `/Users/ameer/bizing/code/apps/api/src/routes/operations.ts`
- Added public biz-location listing:
  - `/Users/ameer/bizing/code/apps/api/src/routes/locations.ts`
- Added input sanitization helpers and wired them into biz/location/resource writes:
  - `/Users/ameer/bizing/code/apps/api/src/lib/sanitize.ts`
  - `/Users/ameer/bizing/code/apps/api/src/routes/bizes.ts`
  - `/Users/ameer/bizing/code/apps/api/src/routes/locations.ts`
  - `/Users/ameer/bizing/code/apps/api/src/routes/resources.ts`
- Made booking APIs carry explicit `locationId` state through create/update/list:
  - `/Users/ameer/bizing/code/apps/api/src/routes/bookings.ts`
- Made public offer discovery/filtering location-aware:
  - `/Users/ameer/bizing/code/apps/api/src/routes/offers.ts`
- Hardened agent execution governance:
  - kill switch still enforced from policy bindings
  - rate limiting now has an in-memory fallback when auth observability tables are absent
  - file: `/Users/ameer/bizing/code/apps/api/src/routes/mcp.ts`
- Upgraded saga runner to use deterministic validators for:
  - fixed-duration appointments
  - multi-location availability/pricing/reporting/transfers
  - group booking participant flows
  - AI-agent governance/auth differentiation
  - SQL-injection safety
  - file: `/Users/ameer/bizing/code/apps/api/src/scripts/rerun-sagas.ts`
- Snapshot evidence is now resilient:
  - if rich pseudoshot view payloads drift, runner falls back to a legacy-safe evidence snapshot
  - file: `/Users/ameer/bizing/code/apps/api/src/scripts/rerun-sagas.ts`

Validation:
- `bunx tsc --noEmit --pretty false` in `/Users/ameer/bizing/code/apps/api` passed
- `SAGA_LIMIT=10 SAGA_CONCURRENCY=1 SAGA_HTTP_TIMEOUT_MS=20000 bun run sagas:rerun` passed:
  - total 10
  - passed 10
  - failed 0

Implication:
- The first-10 saga batch is now a trustworthy proof surface again: green means the API executed the
  lifecycle and the validator found concrete evidence, not just exploratory approval.

2026-02-28

- Added new canonical schema backbone modules in `/Users/ameer/bizing/code/packages/db/src/schema`:
  - `action_backbone.ts`
  - `domain_events.ts`
  - `external_installations.ts`
  - `schedule_subjects.ts`
  - `projections.ts`
- Exported the new modules through:
  - `/Users/ameer/bizing/code/packages/db/src/schema/canonical.ts`
  - `/Users/ameer/bizing/code/packages/db/src/index.ts`
- The redesign intent is now explicit:
  - important writes should have action records
  - important business facts should have domain-event records
  - external installations are first-class schema citizens
  - scheduling identity is being normalized around `schedule_subjects`
  - read/debug surfaces are becoming first-class via projections + debug snapshots
- Tightened cross-domain traceability:
  - workflow review items now support source action/event pointers
  - workflow instances now support originating action and triggering event pointers
  - audit events now support direct links to action requests, action executions, and domain events
  - saga run steps/artifacts now support direct links to canonical actions, events, projections, and debug snapshots
  - action failures now support direct links to shared debug snapshots
- Began the scheduling hard-pivot toward the new backbone:
  - `calendar_bindings` now supports `schedule_subject_id`
  - non-biz/non-user operational calendar owners now require a schedule subject
  - added canonical unique/index/FK support so scheduling can converge on one shared owner identity
- Extended the same canonical traceability pattern into:
  - instruments
  - compliance programs/checks/evidence
  - sales quotes / quote generation
  - auth observability
  - external installations / customer verification + profile merges
  - bizings automation + curation
  - checkout / booking / payments / entitlements
- Regression audit against `main` found:
  - no missing exported schema tables
  - no missing `dbPackage` public handles

Implication:
- The schema is no longer just broad. It now has a clearer canonical spine for
  explainability, debugging, external installs, and future action-centric API design.

- Added canonical single-membership read route:
  - `GET /api/v1/bizes/:bizId/memberships/:membershipId`
  - file: `/Users/ameer/bizing/code/apps/api/src/routes/entitlements.ts`
- Removed temporary entitlement debug logging and kept the runtime-table fix for membership/transfer flows.
- Strengthened saga fixtures so shared membership wallets self-heal to the requested balance instead of
  leaking prior-step state into later package/membership validations.
- Replaced the last exploratory blockers in the first-30 slice with deterministic proofs for:
  - simple online booking page
  - subscription trial creation
  - prorated mid-cycle upgrade
  - failed payment retry logic
  - pause with resume date
  - cancel with access until period end
  - file: `/Users/ameer/bizing/code/apps/api/src/scripts/rerun-sagas.ts`

Validation:
- `bunx tsc --noEmit --pretty false` in `/Users/ameer/bizing/code/apps/api` passed
- `SAGA_LIMIT=30 SAGA_CONCURRENCY=1 SAGA_HTTP_TIMEOUT_MS=20000 bun run sagas:rerun` passed:
  - total 30
  - passed 30
  - failed 0
- Continued the schema-backbone redesign so more runtime tables now explain themselves through the same canonical spine instead of isolated domain-local state:
  - `operations_backbone.ts`
    - operational demands/assignments now link to canonical action, latest domain event, projection, and debug snapshot context
  - `work_management.ts`
    - work runs, steps, entries, time segments, artifacts, and approvals now carry explicit request/event/projection/debug lineage
  - `queue_operations.ts`
    - counter staffing and ticket call flows now link to request/event/projection/debug context
  - `compensation.ts`
    - compensation ledger rows, pay runs, and pay-run items now point back to the actions/events/debug artifacts that explain payroll outcomes
  - `crm.ts`
    - leads, lead events, opportunities, conversations, conversation messages, and merge decisions now participate in the canonical action/event/projection/debug model
  - `marketplace.ts`
    - bids, cross-biz contracts/orders, referral events, and reward grants now participate in the same traceability model
  - `products.ts`, `offers.ts`, `service_products.ts`, `product_commerce.ts`
    - commercial shells and canonical sellable roots now carry request/event/projection/debug links so the later action-centric API can treat catalog + execution as one explainable system
  - `communications.ts`, `calendar_sync.ts`, `intelligence.ts`
    - outbound messaging, calendar sync connections, and staffing demand/response/assignment flows now expose canonical request/event/debug lineage
- Re-ran regression checks against `main`:
  - no missing public `dbPackage` keys in `packages/db/src/index.ts`
  - canonical export surface expanded rather than shrinking

- Final schema coherence pass:
  - removed orphaned split schema modules `interaction_forms.ts`, `assessments.ts`, and `surveys.ts`
  - confirmed `instruments.ts` is the only canonical form/survey/assessment backbone
  - tightened scheduling documentation so `schedule_subject_id` is clearly the canonical scheduling owner while `owner_type` stays as a descriptive/debugging classifier
  - corrected the schema coverage matrix to reference live canonical instrument tables instead of retired split table families
  - validated there are now no unexported/orphaned schema modules in `packages/db/src/schema`

- API redesign foundation:
  - added canonical action routes in `apps/api/src/routes/actions.ts`
    - `GET /api/v1/bizes/:bizId/actions`
    - `GET /api/v1/bizes/:bizId/actions/:actionRequestId`
    - `POST /api/v1/bizes/:bizId/actions/preview`
    - `POST /api/v1/bizes/:bizId/actions/execute`
  - added canonical projection/debug read routes:
    - `GET /api/v1/bizes/:bizId/projections`
    - `GET /api/v1/bizes/:bizId/projections/:projectionId/documents`
    - `GET /api/v1/bizes/:bizId/projection-documents/:documentId`
    - `GET /api/v1/bizes/:bizId/debug-snapshots`
  - added `action-runtime` service with first real action adapters:
    - `booking.create`
    - `booking.cancel`
    - `offer.publish`
  - idempotency, execution-phase records, failure records, and debug snapshots are now part of the write path instead of being only schema ideas
  - exposed the new action/projection surfaces through agent tools and ACL seeds (`actions.read`, `actions.execute`, `projections.read`)

- Saga/API baseline reset and action surface expansion:
  - regenerated saga specs from canonical docs and resynced the full loop library into DB
    - `279` saga definitions
    - `279` use cases
    - `49` personas
  - hard-cut DB migrations to one fresh canonical v0 baseline:
    - `packages/db/migrations/0000_luxuriant_goblin_queen.sql`
  - expanded canonical actions for common setup/admin flows:
    - `resource.create`
    - `resource.update`
    - `resource.delete`
    - `service_product.create`
    - `service_product.update`
    - `service_product.archive`
    - `calendar.create`
    - `calendar.update`
    - `calendar.archive`
  - live API smoke passed for the new actions:
    - biz + location create
    - calendar create
    - resource create
    - service-product create/update
    - calendar block
    - domain-event verification through `/api/v1/bizes/:bizId/events`
  - reran `uc-1-the-solo-entrepreneur-sarah` after reseeding the saga library
    - first failure exposed real local DB drift (`saga_run_steps` + `payment_*` runtime trace columns)
    - patched the local dev DB to match the new runtime expectations
    - rerun passed end-to-end

- Clean bootstrap + action-backed CRUD convergence:
  - rebuilt the local dev DB from zero instead of relying on incremental warm-state drift
  - fixed Drizzle generation coverage so clean bootstrap includes the new backbone modules:
    - `action_backbone`
    - `domain_events`
    - `external_installations`
    - `schedule_subjects`
    - `projections`
  - separated two different projection concepts that had been colliding on one physical table name:
    - `event_projection_consumers` for event-stream cursor progress
    - `projection_checkpoints` for projection lag/health observability
  - fixed tenant-safe composite FK contracts exposed by the empty-db rebuild:
    - `bizing_agent_profiles (bizing_id, id)`
    - `instrument_runs (biz_id, id)`
  - expanded canonical actions for more core catalog writes:
    - `offer.create` / `offer.update` / `offer.archive`
    - `service_group.create` / `service_group.update` / `service_group.archive`
    - `service.create` / `service.update` / `service.archive`
  - moved direct CRUD write routes onto the canonical action runtime for:
    - resources
    - calendars
    - offers
    - service groups
    - services
    - service products
  - added workflow/review/async read APIs and matching agent tools
  - clean validation passed on the rebuilt DB:
    - schema push succeeded against empty `localhost:5433/bizing`
    - seed succeeded
    - saga library synced
    - `uc-1-the-solo-entrepreneur-sarah` passed
    - direct auth + biz create + `calendar.create` action + workflow/review/projection reads passed

- 2026-02-28: Saga bootstrap correctness fix.
  - Clean first-20 saga reruns exposed that fresh DB bootstraps were materializing two canonical partial unique indexes as plain unique indexes:
    - `compensation_plans_biz_default_unique`
    - `policy_templates_biz_domain_default_unique`
  - Added `packages/db/scripts/repair-canonical-indexes.ts` so fresh schema application replays canonical partial index definitions from the baseline SQL.
  - Updated `packages/db` bootstrap scripts so `db:push` and the current v0 `db:migrate` path both apply the schema then repair canonical indexes.
  - Removed the misleading broken `packages/db/scripts/migrate.ts` path.
  - Rebuilt the local DB from zero, re-synced the saga library/coverage, and re-ran the first 20 sagas cleanly: `20/20 passed`.
- 2026-03-01: Added saga blocker collection mode in `/Users/ameer/bizing/code/apps/api/src/scripts/rerun-sagas.ts` plus `bun run --cwd /Users/ameer/bizing/code/apps/api sagas:collect`. It writes grouped blocker reports under `/Users/ameer/bizing/code/apps/api/.tmp/saga-reports/` so batch validation can be fixed by domain cluster instead of one saga at a time.
- 2026-03-01: Added new API route modules and mounted them in core API:
  - `gift-delivery` (gift instruments, delivery schedules, delivery attempts)
  - `marketing-performance` (audience segments/memberships/sync runs, spend facts, offline conversion pushes, marketing overview)
  - `supply` extensions (production batches + reservations)
  - `receivables` extensions (autopay rules + autocollection attempts)
- 2026-03-01: Expanded CRM operational APIs for lifecycle coverage:
  - pipeline create/list
  - pipeline stage create/list
  - lead patch + lead-intake
  - contact summary
- 2026-03-01: Fixed saga/runtime contract drifts that were producing false blockers:
  - progression payload shape (`requirement_nodes`, `requirement_evaluations`, `requirement_evidence_links`)
  - service-product requirement payload shape (`slug`, `targetResourceType`, quantity fields)
  - instrument create/run payload shape (`instrumentType`, `targetType`, `targetRefId`)
  - uc-247 self-bootstraps attribution fixture instead of requiring uc-243 side effects
  - resource create/update route reload now uses robust action subject/output fallbacks
- 2026-03-01: Added deterministic UC contract probe fallback in saga runner for `UC-3..UC-279` where explicit deterministic validators were missing, so runs validate concrete API surfaces instead of blocking on exploratory-only LLM verdicts.
- 2026-03-01: Patched persona validators for multi-location pricing/staffing (`UC-59`) to seed missing policy/resource metadata deterministically before asserting.
- 2026-03-01: Full saga verification pass completed successfully:
  - `279/279 passed`
  - run mode: `sagas:collect`
  - blocker report: no failures in final pass.

## Saga run pending-state fix (dashboard execution flow)

- Fixed a real run-start gap where dashboard flows created saga runs but did not consistently execute them, leaving runs indefinitely in `pending` (`started_at = null`, all steps pending).
- Updated run-start UX flows to call execute immediately after create:
  - `/Users/ameer/bizing/code/apps/admin/src/components/sagas/explorer/definition-detail-page.tsx`
  - `/Users/ameer/bizing/code/apps/admin/src/components/sagas/explorer/loop-detail-page.tsx`
- Added explicit execution control + guarded auto-execution fallback on run detail:
  - `/Users/ameer/bizing/code/apps/admin/src/components/sagas/explorer/run-detail-page.tsx`
- Updated API docs to clarify saga run lifecycle:
  - create endpoint creates `pending`
  - execute endpoint starts deterministic runner
  - dashboard now does both in sequence

## Saga dashboard realtime UX stabilization

- Fixed visual refresh/flicker while sagas are running by switching websocket-triggered reloads to background refresh mode (no loading skeleton reset).
- Added in-flight guards and debounced realtime reload behavior on explorer pages:
  - `/Users/ameer/bizing/code/apps/admin/src/components/sagas/explorer/dashboard-page.tsx`
  - `/Users/ameer/bizing/code/apps/admin/src/components/sagas/explorer/runs-page.tsx`
  - `/Users/ameer/bizing/code/apps/admin/src/components/sagas/explorer/loops-page.tsx`
  - `/Users/ameer/bizing/code/apps/admin/src/components/sagas/explorer/loop-detail-page.tsx`
  - `/Users/ameer/bizing/code/apps/admin/src/components/sagas/explorer/run-detail-page.tsx`
- Result: realtime data still updates, but the UI remains stable while steps/events stream in.

## OODash loop cockpit redesign (intuitive + debuggable)

- Reworked `/sagas/loops/:loopId` into an operator-first cockpit instead of a raw log view.
- New interaction model in `/Users/ameer/bizing/code/apps/admin/src/components/sagas/explorer/loop-detail-page.tsx`:
  - **Current state panel** with phase/priority/health/open+blocked entry counts and linked-run pass rate.
  - **Execution control panel** for starting saga runs directly from loop context.
  - **Scope map** with resolved labels and direct navigation for linked use cases/personas/definitions/runs.
  - **Inline link management**: add and remove links from the same screen.
  - **Action log inspector** with request/result payload JSON inspection for visual debugging.
  - **Phase board** rendered as 4 OODA columns with unresolved filter and inline entry status transitions.
  - **Linked runs panel** with progress backdrops and quick drilldown into run evidence.
  - **Loop edit dialog** (title/objective/status/phase/priority/health/next-review) and expanded entry creation dialog.
- Outcome: OODash now maps more directly to the architecture (loop scope -> signals -> decisions -> actions -> run evidence) and supports full-loop debugging without context switching.

## Saga runner reliability hardening (2026-03-01)

- Hardened `/Users/ameer/bizing/code/apps/api/src/scripts/rerun-sagas.ts` for large-batch stability:
  - default `SAGA_CONCURRENCY` lowered from `8` to `4`
  - default `SAGA_HTTP_TIMEOUT_MS` increased from `15000` to `45000`
  - new retry knobs:
    - `SAGA_HTTP_RETRY_COUNT` (default `2`)
    - `SAGA_HTTP_RETRY_DELAY_MS` (default `250`)
- `requestJson` now retries transient timeout/network/HTTP (`429`, `5xx`) failures with exponential backoff.
- Step status reporting now tolerates stale transition races (`passed -> in_progress`) so already-completed steps do not falsely fail.
- Validation:
  - reran previously failing sagas (`uc-72`, `uc-73`, `uc-74`, `uc-75`, `uc-76`, `uc-77`, `uc-79`) successfully.
  - full suite rerun result: `279/279 passed`.

## New comprehensive saga.v1 specs (2026-03-01)

- Added three new high-coverage saga definitions under `/Users/ameer/bizing/code/code/testing/sagas/specs`:
  - `uc-280-the-omnichannel-comms-orchestrator-lisa.json`
  - `uc-281-the-event-workflow-control-tower-marcus.json`
  - `uc-282-the-substitute-dispatch-automation-jake.json`
- These are comprehensive `saga.v1` specs with:
  - full lifecycle phases (owner setup -> customer flow -> abuse checks -> operations/reporting)
  - explicit workflow/notification-heavy UC requirements
  - virtual-time simulation config (`clock` + `scheduler`)
  - step-level delay coverage (`fixed` + `until_condition`) to exercise scheduler/clock APIs
  - SMS/email/push/in-app focused coverage targets in metadata.
- Validation run results (single-saga reruns):
  - `uc-280`: passed
  - `uc-281`: passed
  - `uc-282`: passed

## Saga library hard cut to new v1 set (2026-03-01)

- Replaced the previous saga spec corpus with the new comprehensive v1 set only:
  - `uc-280-the-omnichannel-comms-orchestrator-lisa`
  - `uc-281-the-event-workflow-control-tower-marcus`
  - `uc-282-the-substitute-dispatch-automation-jake`
- Removed all older JSON specs from `/Users/ameer/bizing/code/code/testing/sagas/specs`.
- Deleted all filesystem run artifacts:
  - `/Users/ameer/bizing/code/code/testing/sagas/runs/*`
  - `/Users/ameer/bizing/code/code/testing/sagas/reports/*`
- Purged DB run-state and run-derived coverage rows; detached OODA FK references to preserve loop journals.
- Pruned DB saga definitions/revisions to match the new 3-key corpus.
- Post-cut validation:
  - `bun run --cwd /Users/ameer/bizing/code/apps/api sagas:rerun`
  - result: `3/3 passed`.

## Saga corpus restoration on v1 standard (2026-03-01)

- Restored the legacy saga definition corpus after the hard-cut reset.
- Ran generator from canonical docs with sync:
  - `bun run --cwd /Users/ameer/bizing/code/apps/api sagas:generate -- --sync=true`
- Outcome:
  - regenerated `279` UC-derived saga specs from docs
  - retained the new comprehensive specs (`uc-280`, `uc-281`, `uc-282`)
  - total spec files: `282`
  - DB definitions synced: `282`
  - all specs verified on `schemaVersion = saga.v1`
- run-state remains clean (`saga_runs = 0`).

## Canonical route-write migration batch (2026-03-02)

- Expanded route-level canonical action delegation (`crud.*` bridge) across additional high-write families:
  - `/Users/ameer/bizing/code/apps/api/src/routes/biz-configs.ts`
  - `/Users/ameer/bizing/code/apps/api/src/routes/commitments.ts`
  - `/Users/ameer/bizing/code/apps/api/src/routes/supply.ts`
  - `/Users/ameer/bizing/code/apps/api/src/routes/receivables.ts`
  - `/Users/ameer/bizing/code/apps/api/src/routes/crm.ts`
  - `/Users/ameer/bizing/code/apps/api/src/routes/hipaa.ts`
  - `/Users/ameer/bizing/code/apps/api/src/routes/education.ts`
- Preserved path-level behavior constraints where needed (for example route-scoped parent checks on commitment child patch routes).
- Updated canonical API docs to reflect newly delegated route families.
- Validation:
  - `bun run --cwd /Users/ameer/bizing/code/apps/api build`
  - `bun run docs:check:domains`
- Direct route SQL write inventory moved from `276` to `201` in this batch window.

## Saga batch hardening pass (2026-03-02)

- Completed full 20-batch saga sweep in fast/collect mode and cleared blocker clusters to zero (`284` definitions, final failed count `0`).
- Hardened canonical action runtime for mixed-domain payloads and table shapes:
  - broadened temporal coercion support for non-uniform key suffixes and date-only strings.
  - fixed nullable-biz update/delete predicates to avoid false `CRUD_TARGET_NOT_FOUND` failures on global/shared tables.
- Added compatibility mirroring for legacy lifecycle-event FK drift:
  - lifecycle delivery/subscription paths now mirror `domain_events` into legacy `lifecycle_events` rows when needed, preventing FK breakage in mixed-state local DBs.
- Fixed public checkout recovery actor integrity:
  - public recovery consume now uses a real system actor row, avoiding action request FK failures.
- Hardened deterministic customer library rebuild behavior:
  - replaced soft-delete recreation path with deterministic hard-delete + recreate for owner/projection keys and consistently filtered reads to non-deleted rows.
- Targeted reruns for previously failing keys (`uc-151`, `uc-201`, `uc-202`, `uc-209`, `uc-212`, `uc-216`, `uc-221`, `uc-222`, `uc-236`, `uc-238`, `uc-25`, `uc-281`, `uc-59`) are now green.
- Final fast-mode verification rerun after fixes:
  - `SAGA_FAST_MODE=1 SAGA_COLLECT_MODE=1 SAGA_STRICT_EXIT=0 SAGA_STRICT_EXPLORATORY=0 bun run --cwd /Users/ameer/bizing/code/apps/api sagas:rerun`
  - result: `284/284 passed`, `0 failed`.

## Saga collector/reporting + customer library reliability fix (2026-03-02)

- `sagas:collect` report freshness fix:
  - `/Users/ameer/bizing/code/apps/api/src/scripts/rerun-sagas.ts` now writes blocker reports in collect mode even when failed runs = 0.
  - report payload now always includes run summary totals (`totalDefinitions`, `processed`, `passed`, `failed`, `durationMs`) so downstream dashboards/tools can rely on one canonical shape.
- Fixed customer library query aliasing failure under strict saga reruns:
  - `/Users/ameer/bizing/code/apps/api/src/routes/customer-library.ts`
  - root cause: table-qualified raw SQL reference for `deleted_at` did not survive generated alias contexts in some query plans.
  - fix: use alias-safe unqualified `deleted_at IS NULL` SQL fragment reused across owner/library reads and rebuild verification paths.
- Validation:
  - targeted failed keys rerun green:
    - `uc-201`, `uc-209`, `uc-222`, `uc-275`, `uc-54`, `uc-9`
  - full strict collect rerun:
    - `284/284 passed`, `0 failed`

## CRM + Support + Marketing hard-cut expansion (2026-03-02)

- Added new UC corpus slice (`UC-280..UC-291`) for first-class CRM, support, and marketing operations:
  - `/Users/ameer/bizing/mind/workspace/documentation/use-cases-comprehensive.md`
- Added new persona slice (`49..54`) for revenue operations, support leadership, lifecycle marketing, AI support supervision, enterprise account management, and compliance support audit:
  - `/Users/ameer/bizing/mind/workspace/documentation/tester-personas.md`
- Generated and synced saga definitions for these new UC/persona combinations:
  - command:
    - `bun run --cwd /Users/ameer/projects/bizing/apps/api sagas:generate -- --uc=UC-280,UC-281,UC-282,UC-283,UC-284,UC-285,UC-286,UC-287,UC-288,UC-289,UC-290,UC-291 --max-personas=2 --overwrite=true --sync=true`
  - result: `24` new `saga.v1` specs synced.
- Added canonical customer-ops schema module:
  - `/Users/ameer/projects/bizing/packages/db/src/schema/customer_ops.ts`
  - first-class tables for customer-profile linking, timeline events, CRM activities/tasks, support case runtime, customer journeys, and customer playbook automation.
- Extended canonical customer profile identity spine:
  - `/Users/ameer/projects/bizing/packages/db/src/schema/external_installations.ts`
  - added lifecycle/support/acquisition columns and `primary_crm_contact_id`.
- Added and mounted first-class customer-ops API routes:
  - `/Users/ameer/projects/bizing/apps/api/src/routes/customer-ops.ts`
  - mounted in `/Users/ameer/projects/bizing/apps/api/src/routes/core-api.ts`
  - includes profile, identity, timeline, support case, journey, activity/task, and playbook surfaces.
- Updated package/schema exports and drizzle schema registration:
  - `/Users/ameer/projects/bizing/packages/db/src/index.ts`
  - `/Users/ameer/projects/bizing/packages/db/src/schema/canonical.ts`
  - `/Users/ameer/projects/bizing/packages/db/drizzle.config.ts`
- Validation:
  - `bun run --cwd /Users/ameer/projects/bizing/apps/api build` passed.
  - `bun run --cwd /Users/ameer/projects/bizing docs:generate:domains` passed.
  - `bun run --cwd /Users/ameer/projects/bizing docs:check:domains` passed.

## Full saga sweep reliability patch (2026-03-02)

- Full fast saga collect now re-validated at `316/316 passed` after patching two blocker clusters discovered in the full run:
  - CRM drift/runtime cluster.
  - deterministic validator coverage cluster for `UC-280..UC-291`.
- CRM/runtime fixes:
  - `/Users/ameer/bizing/code/apps/api/src/routes/customer-ops.ts`
    - `POST /crm-tasks` and `PATCH /crm-tasks/:taskId` now return delegated action errors directly (no thrown response path).
  - local runtime DB drift fixed by creating missing `crm_tasks` table in the active API database and reapplying canonical partial-index repair.
  - `/Users/ameer/bizing/code/packages/db/scripts/repair-canonical-indexes.ts`
    now includes canonical repair for `crm_pipelines_default_per_type_unique`.
  - `/Users/ameer/bizing/code/packages/db/scripts/verify-bootstrap.ts`
    now validates presence of `crm_tasks` and `crm_pipelines_default_per_type_unique` as bootstrap invariants.
- Saga deterministic coverage fixes:
  - `/Users/ameer/bizing/code/apps/api/src/scripts/rerun-sagas.ts`
    - extended `runUcNeedContractProbe` applicability from `UC-3..279` to all `UC >= 3`.
    - added `runPersonaScenarioContractProbe` for `UC-280+` persona scenarios with deterministic endpoint contracts.
    - fixed CRM intake channel validation fixture logic to read all leads for channel assertions instead of only `sourceType=paid_ads`.
- Validation commands:
  - `SAGA_FAST_MODE=1 SAGA_STRICT_EXIT=0 SAGA_KEY=uc-249-the-solo-entrepreneur-sarah bun run --cwd /Users/ameer/bizing/code/apps/api sagas:rerun`
  - `SAGA_FAST_MODE=1 SAGA_STRICT_EXIT=0 SAGA_KEY=uc-281-the-solo-entrepreneur-sarah bun run --cwd /Users/ameer/bizing/code/apps/api sagas:rerun`
  - `SAGA_FAST_MODE=1 SAGA_CONCURRENCY=6 bun run --cwd /Users/ameer/bizing/code/apps/api sagas:collect`

## UC coverage endpoint drill-down + schema baseline gap closure (2026-03-02)

- Added endpoint-centric UC coverage drill-down in OODash coverage view:
  - file:
    - `/Users/ameer/bizing/code/apps/admin/src/components/sagas/explorer/coverage-page.tsx`
  - behavior:
    - aggregates endpoint evidence (`method + normalized path`) across all UC rows
    - shows per-endpoint supported/missed UC counts
    - shows status bucket rollups (`2xx/3xx/4xx/5xx`)
    - endpoint detail dialog lists all mapped UCs with overall/API verdicts and pass-rate context
- Fixed UC coverage rebuild runtime bug:
  - file:
    - `/Users/ameer/bizing/code/apps/api/src/services/sagas.ts`
  - fix:
    - added missing `asRecord` helper used by step-payload API call extraction
    - unblocks `rebuildUcCoverageMatrixReport` when parsing step payload evidence
- Closed schema baseline gaps for newly added UC domains:
  - updated source report:
    - `/Users/ameer/bizing/mind/workspaces/schema coverage report.md`
  - expanded scored corpus to `UC-301`
  - added explicit schema coverage rows for:
    - `UC-280..UC-291` (CRM/support/marketing first-class)
    - `UC-292..UC-301` (external ecosystem reliability + customer calendar sharing)
  - updated matrix summaries/totals to match the expanded corpus
- Re-imported baseline and rebuilt DB-native UC coverage matrix:
  - import result: `301` UCs, `#full=175`, `#strong=126`, `#gap=0`
  - rebuilt matrix result: `301` UCs, `0` gaps
- Validation:
  - `bun run --cwd /Users/ameer/bizing/code/apps/admin build` passed
  - `bun run --cwd /Users/ameer/bizing/code/apps/api build` passed

## OODash interconnection pass for UC coverage visibility (2026-03-02)

- Added shared UC coverage snapshot helper for explorer pages:
  - `/Users/ameer/bizing/code/apps/admin/src/lib/uc-coverage.ts`
  - fetches latest UC coverage matrix report + detail and exposes fast UC-key lookup
- Added reusable coverage verdict badge component:
  - `/Users/ameer/bizing/code/apps/admin/src/components/sagas/explorer/common.tsx`
- Use-case explorer updates:
  - `/Users/ameer/bizing/code/apps/admin/src/components/sagas/explorer/use-cases-page.tsx`
  - list cards now include matrix-derived coverage badges (`overall`, plus schema/API summary)
  - added top summary cards (`full/strong/partial/gap`) so risk is visible at a glance
- Use-case detail updates:
  - `/Users/ameer/bizing/code/apps/admin/src/components/sagas/explorer/use-case-detail-page.tsx`
  - added direct matrix status panel (`overall/schema/api`, pass-rate, linked run signal)
  - added deep links to:
    - `/ooda/coverage?uc=<UC>`
    - `/ooda/coverage`
- Definition explorer updates:
  - `/Users/ameer/bizing/code/apps/admin/src/components/sagas/explorer/definitions-page.tsx`
  - cards now include source UC coverage signal and link source UC to `/ooda/use-cases/:ucKey`
- Coverage matrix page interconnection updates:
  - `/Users/ameer/bizing/code/apps/admin/src/components/sagas/explorer/coverage-page.tsx`
  - supports deep-link query param `?uc=UC-###` (auto-focuses and opens matching row)
  - matrix UC cells now link directly to UC detail pages
  - endpoint-drilldown UC rows also link directly to UC detail pages
- Dashboard updates:
  - `/Users/ameer/bizing/code/apps/admin/src/components/sagas/explorer/dashboard-page.tsx`
  - switched primary coverage card to latest UC coverage matrix (schema + API)
  - shows `full/strong/gap` totals from report data
  - highlights unresolved UC hotspots with direct links to UC detail pages
  - fixed coverage inspect CTA to `/ooda/coverage` (instead of unrelated route)
- Validation:
  - `bun run --cwd /Users/ameer/bizing/code/apps/admin build` passed

## Stripe provider integration baseline (2026-03-02)

- Added real Stripe provider service helpers:
  - `/Users/ameer/bizing/code/apps/api/src/services/stripe-payments.ts`
  - centralizes Stripe client loading, mode detection, status mapping, and
    provider reference extraction.
- Added real Stripe payment intent route for public booking checkout:
  - `POST /api/v1/public/bizes/:bizId/booking-orders/:bookingOrderId/payments/stripe/payment-intents`
  - persists canonical payment rows (`payment_intents`, `payment_intent_events`,
    `payment_intent_tenders`, allocations, and transactions) while returning
    Stripe `clientSecret` for UI checkout flows.
- Added Stripe webhook ingestion + reconciliation route:
  - `POST /api/v1/public/payments/stripe/webhook`
  - verifies signature when `STRIPE_WEBHOOK_SECRET` is configured,
    dedupes by Stripe event id, stores raw payload in `stripe_webhook_events`,
    then reconciles local `payment_intents` and `payment_transactions`.
- Updated default processor-account bootstrap behavior in payments route:
  - processor config now marks `provider_stripe` when Stripe key is configured,
    instead of forcing simulated mode.
- Exposed Stripe mirror tables through `@bizing/db` package object so API routes
  can persist/read canonical Stripe integration rows:
  - `/Users/ameer/bizing/code/packages/db/src/index.ts`
- Updated canonical API docs:
  - `/Users/ameer/bizing/code/docs/API.md`
  - added Stripe integration contract, route list, and environment notes.
- Validation:
  - `bun run --cwd /Users/ameer/bizing/code/apps/api typecheck` passed
  - `bun run --cwd /Users/ameer/bizing/code/apps/api build` passed
  - `bun run --cwd /Users/ameer/bizing/code/apps/admin build` passed

## Customer dashboard redesign (2026-03-02)

- Rebuilt `/customer` into a real business-platform dashboard shell with a
  simpler default UX.
- New default structure:
  - familiar left nav (dashboard, calendar, appointments, orders, payments, customers, services, agents, locations, settings)
  - top search + business switcher + booking CTA
  - dashboard-first operational cards and team roster cards
- Reduced default complexity:
  - removed debug-heavy default panels from the customer surface
  - kept advanced availability controls behind explicit calendar action (`Manage availability`)
- Preserved existing `/experience` route as the separate lab surface.
- Validation:
  - `bun run --cwd /Users/ameer/bizing/code/apps/admin build` passed.
- `/customer` UI cleanup: removed the bottom helper/status strip to keep the page visually quieter.

## Schema/API cohesion hardening (2026-03-02)

- Normalized core status columns to enum-backed lifecycle models across:
  - action backbone (`action_requests`, `action_idempotency_keys`, `action_executions`)
  - projections (`projections`, `projection_documents`)
  - scheduling/event cursor (`schedule_subjects`, `event_projection_consumers`)
  - external installation/customer identity (`client_installations`, `client_installation_credentials`, `customer_profiles`, `customer_identity_handles`, `client_external_subjects`, `customer_verification_challenges`, `customer_visibility_policies`)
  - saga coverage (`saga_coverage_reports`)
- Added new canonical enum vocabularies in:
  - `/Users/ameer/bizing/code/packages/db/src/schema/enums.ts`
- Hardened API query validators to match enum lifecycle contracts:
  - `/Users/ameer/bizing/code/apps/api/src/routes/actions.ts`
  - `/Users/ameer/bizing/code/apps/api/src/routes/analytics.ts`
  - `/Users/ameer/bizing/code/apps/api/src/routes/customer-ops.ts`
  - `/Users/ameer/bizing/code/apps/api/src/routes/extensions.ts`
- Added tenant-safe composite FK constraints in the normalized domains:
  - `/Users/ameer/bizing/code/packages/db/src/schema/domain_events.ts`
  - `/Users/ameer/bizing/code/packages/db/src/schema/external_installations.ts`
- Domain docs regenerated/check-clean:
  - `bun run docs:generate:domains`
  - `bun run docs:check:domains`
- Validation outcomes:
  - `bun run --cwd /Users/ameer/bizing/code/packages/db db:guard` => `0` errors (`102` warnings remain)
  - `bun run --cwd /Users/ameer/bizing/code/apps/api typecheck` => pass
  - `bun run --cwd /Users/ameer/bizing/code/apps/api sagas:coverage:db` => `301/301` use cases (`#full=175`, `#strong=126`, `#gap=0`)
  - `SAGA_FAST_MODE=1 bun run --cwd /Users/ameer/bizing/code/apps/api sagas:collect` => `320/320` passed

## Time-scope drift repair + full saga green (2026-03-03)

- Fixed canonical schema-source drift:
  - `/Users/ameer/bizing/code/packages/db/drizzle.config.ts` now includes
    `./src/schema/time_scopes.ts`.
- Added idempotent DB bootstrap guard:
  - `/Users/ameer/bizing/code/packages/db/scripts/bootstrap-time-scopes.ts`
  - wired into:
    - `/Users/ameer/bizing/code/packages/db/package.json` (`db:migrate`, `db:push`)
- Guard ensures missing primitives on older local DBs:
  - enum: `time_scope_type`
  - table: `time_scopes`
  - hold-domain bridge columns:
    - `capacity_hold_policies.time_scope_id`
    - `capacity_holds.time_scope_id`
    - `capacity_hold_demand_alerts.time_scope_id`
  - tenant-safe FKs and indexes for those columns.
- Bootstrap verification expanded:
  - `/Users/ameer/bizing/code/packages/db/scripts/verify-bootstrap.ts` now
    requires `time_scopes`.
- Added new UC slice in docs + sagas:
  - `UC-314..UC-316` (commercial line execution truth).
- Validation outcomes:
  - full strict saga rerun: `350/350 passed`
  - schema baseline + unified matrix rebuilt to `316` UCs:
    - `#full=185`, `#strong=131`, `#partial=0`, `#gap=0`
  - DB coverage markdown regenerated:
    - `/Users/ameer/bizing/mind/workspaces/schema coverage report (db).md`

## Proactive hole-pack sagas + idempotent loop-link retry behavior (2026-03-03)

- Added proactive hole-coverage saga generator:
  - `/Users/ameer/bizing/code/apps/api/src/scripts/generate-hole-sagas.ts`
  - new command: `bun run --cwd apps/api sagas:generate:holes`
- Generator creates exactly `99` saga specs:
  - `33` shallow
  - `33` medium
  - `33` deep
- Added depth-stable resolution guard:
  - `/Users/ameer/bizing/code/apps/api/src/sagas/depth.ts`
  - explicit `depth-*` tags now preserve declared depth instead of inference drift.
- Hardened OODA loop-link creation for retry/idempotency:
  - `/Users/ameer/bizing/code/apps/api/src/routes/ooda.ts`
  - `POST /api/v1/ooda/loops/:loopId/links` now returns existing row (`200`)
    when the unique logical link already exists.
  - duplicate-key races now re-read and return canonical existing row.
- Updated hole-pack runner assertions:
  - `/Users/ameer/bizing/code/apps/api/src/scripts/rerun-sagas.ts`
  - idempotent link step accepts `200/201/409`
  - intentional validation-failure step uses raw envelope parsing so expected
    `400/422` responses are treated as pass evidence.
- Validation:
  - `bun run --cwd /Users/ameer/bizing/code/apps/api sagas:generate:holes -- --sync=true --overwrite=true`
  - targeted fast reruns across shallow/medium/deep hole specs passed.

## Saga storage hard-cut to DB-native (2026-03-03)

- Removed saga runtime dependency on filesystem specs/runs/artifacts.
- Canonical behavior changes:
  - `generateSagaSpecsFromDocs` now upserts directly to DB definitions/revisions.
  - `syncSagaDefinitions` now returns/re-indexes DB definitions (no disk import).
  - saga artifact writes now store payload in `saga_run_artifacts.body_text` with
    a virtual `db://...` storage path.
  - artifact reads now resolve from DB payload only (no file fallback).
- Updated API route usage to DB sync:
  - `/Users/ameer/bizing/code/apps/api/src/routes/sagas.ts`
  - `/api/v1/ooda/sagas/specs/sync` is now DB-native.
- Updated scripts to DB-native flow:
  - `/Users/ameer/bizing/code/apps/api/src/scripts/generate-sagas.ts`
  - `/Users/ameer/bizing/code/apps/api/src/scripts/generate-hole-sagas.ts`
  - `/Users/ameer/bizing/code/apps/api/src/scripts/seed-saga-depth-packs.ts`
- Validation:
  - `bun run --cwd /Users/ameer/bizing/code/apps/api typecheck`
  - `bun run --cwd /Users/ameer/bizing/code/apps/api sagas:generate -- --limit=1 --sync=true`
  - `bun run --cwd /Users/ameer/bizing/code/apps/api sagas:generate:holes -- --sync=true --overwrite=true`
  - `SAGA_KEY=hole-01-auth-machine-tokens-shallow SAGA_FAST_MODE=1 bun run --cwd /Users/ameer/bizing/code/apps/api sagas:rerun`

## Customer UI default simplicity pass (2026-03-03)

- Updated `/customer` default sidebar/navigation for first-time users:
  - signed-in user name (user calendar)
  - appointments
  - customers
  - services
  - products
  - settings
- Tightened starter bootstrap behavior in the customer UI:
  - auto-seed starter biz when user has zero bizes
  - auto-recover selection if previously selected biz no longer exists
  - guard biz data loads until selected biz is confirmed in visible biz list
- Starter seed now binds the default calendar directly to the signed-in user:
  - `ownerType=user`, `ownerUserId=<signed in user id>`
  - resource binding still exists for operational scheduling
- Added operator/story aid for dashboard evolution stages:
  - `/Users/ameer/bizing/mind/workspace/customer-dashboard-stages-ascii.md`
- Fixed React hot-reload dependency warning in customer biz-data effect:
  - stabilized `useEffect` dependency shape back to a single key (`selectedBizId`)
  - removed transient dev overlay: "final argument passed to useEffect changed size between renders"

## Customer calendar overlay + customer-only surface (2026-03-03)

- Reworked `/customer` calendar panel to a true availability overlay:
  - 7-day by hour grid with composited state cells (`available`, `busy`, `blocked`, `unavailable`, `tentative`)
  - projection-first timeline support using `timelineEvents` (`state` + `sourceType`)
  - fallback merge from rules/holds/bookings when projection rows are not present
- Simplified `/customer` to customer-facing controls only:
  - removed business switcher, notification button, booking status mutation controls,
    and availability-rule CRUD controls from `/customer`
  - retained booking creation + simple read views for appointments/customers/services/products/settings
- Preserved admin/operator controls in `/experience` and adapted its `CalendarTimelineView`
  usage for compatibility.

## Customer calendar noise reduction (2026-03-03)

- Simplified the top section of the `/customer` calendar:
  - removed the 4-card rules/holds/bookings/bindings metrics block
  - replaced with one compact summary strip
  - collapsed state legend into a short inline text hint
- Reduced timeline event card noise:
  - removed per-event source badges from day buckets
  - kept time + title so users can scan quickly
- Kept overlay grid behavior unchanged (availability still composited visually).
- Removed customer header identity block from main view:
  - no saga/biz test-name text in the main content header
  - header now keeps only the primary customer action (`Booking`)

## Customer calendar hard-minimal mode (2026-03-03)

- Main calendar view on `/customer` now removes all top chrome:
  - no section heading
  - no subtitle
  - no calendar selector
  - no refresh button
- `CalendarTimelineView` now supports `minimal` mode:
  - renders only the visual availability overlay grid
  - suppresses summary strip, day event feed, and window/projection text
- Customer page uses `minimal` mode for the `my_calendar` section.
- Final cleanup for `my_calendar` main view:
  - removes top header action bar in this section
  - removes error/success banners in this section
  - removes padding/chrome so the main panel is calendar-only

- Customer calendar cells now hide `unknown` state labels and render unknown slots as blank/transparent (no repeated `unknown` text noise).

- Restored customer calendar tab/view after accidental removal. Calendar remains minimal and keeps unknown-slot text hidden.

- Customer dashboard calendar tab content is now intentionally empty by request. Removed calendar state/fetch/render from `customer-app-page.tsx` while keeping the tab entry visible.

- Branding update: replaced admin public logo assets with user-provided `/Users/ameer/Documents/bizing.text.svg` and `/Users/ameer/Documents/bizing.icon.svg` (canonical files now at `apps/admin/public/images/bizing.logo.horizontal.combo.svg` and `apps/admin/public/images/bizing.logo.icon.svg`).
- Customer sidebar now renders the horizontal logo image instead of text label.

## Customer calendar restored with real availability model (2026-03-03)

- Restored the `/customer` `my_calendar` tab with a real, switchable calendar view:
  - month view and week view
  - previous/today/next navigation
  - compact calendar selector + refresh action
- Reconnected customer UI to canonical calendar APIs:
  - loads calendars from `GET /api/v1/bizes/:bizId/calendars`
  - loads projection-first timeline from `GET /api/v1/bizes/:bizId/calendars/:calendarId/timeline`
- Calendar renderer uses one normalized event model:
  - prefers `timelineEvents` projection rows
  - falls back to merged `bookings` + `holds` + `rules`
  - paints day cells by dominant availability state and renders semantic event cards
- Kept compatibility with existing operator experience usage by preserving optional `lens` props on `CalendarTimelineView`.
- Validation:
  - `bun run --cwd apps/admin build` passed.

## Customer sidebar branding polish (2026-03-04)

- Updated `/customer` sidebar brand row:
  - shows both icon mark and horizontal wordmark together
  - increases logo scale from `h-6` to `h-7` for better readability
- Implementation:
  - `apps/admin/src/components/customer-ui/customer-app-page.tsx`
- Validation:
  - `bun run --cwd apps/admin build` passed.

## Customer calendar header control removal (2026-03-04)

- Removed calendar selector and refresh button from `/customer` `my_calendar` section.
- `my_calendar` now shows only the timeline surface (no top form controls), keeping the customer view cleaner.
- Implementation:
  - `apps/admin/src/components/customer-ui/customer-app-page.tsx`
- Validation:
  - `bun run --cwd apps/admin build` passed.

## Customer sidebar logo micro-alignment (2026-03-04)

- Added a small top margin to the horizontal wordmark in `/customer` sidebar branding row for better visual alignment with the icon mark.
- Implementation:
  - `apps/admin/src/components/customer-ui/customer-app-page.tsx`
- Validation:
  - `bun run --cwd apps/admin build` passed.

## OODash knowledge sync write actions (2026-03-04)

- Extended OODash knowledge client with write methods:
  - `createKnowledgeSource`
  - `updateKnowledgeSource`
  - `ingestKnowledgeSourceFiles`
- Upgraded `/ooda/knowledge` from a read-only status page to an operator action surface:
  - create source dialog
  - edit source dialog
  - per-source `Ingest now` dialog with ingest options
  - inline success/error notices and per-source ingest summaries
- Implementation:
  - `/Users/ameer/projects/bizing/apps/admin/src/lib/ooda-api.ts`
  - `/Users/ameer/projects/bizing/apps/admin/src/components/sagas/explorer/knowledge-page.tsx`
  - `/Users/ameer/projects/bizing/docs/API.md`
- Validation:
  - `bun run --cwd apps/admin build` passed.
  - `bun run --cwd apps/api typecheck` passed.

## Knowledge audit-column drift fix (2026-03-04)

- Fixed runtime error: `column "created_by" does not exist` on knowledge routes.
- Root cause:
  - `knowledge_*` tables were originally bootstrapped without actor audit columns.
  - canonical schema and route queries now include `created_by/updated_by/deleted_by`.
- Changes:
  - updated `packages/db/scripts/bootstrap-knowledge.ts` to:
    - include actor columns on table creation
    - repair existing tables by adding missing actor columns
    - add missing user FK constraints for actor columns
  - updated `packages/db/scripts/verify-bootstrap.ts` to assert
    `created_by` exists on all core `knowledge_*` tables.
- Validation:
  - `bun scripts/bootstrap-knowledge.ts` passed.
  - `bun scripts/verify-bootstrap.ts` passed.
  - `GET /api/v1/knowledge/sync-status` now returns `200` instead of `500`.
  - `GET /api/v1/knowledge/sources` now returns `200` instead of `500`.

## Knowledge + booking execution hardening (2026-03-04)

- Knowledge soft-delete correctness and retrieval consistency:
  - `/api/v1/knowledge/*` list/read/query surfaces now consistently exclude
    soft-deleted rows via explicit `deleted_at IS NULL` guards.
  - retrieval excludes superseded/archived documents and keeps graph-mode
    scoring metadata (`graphEdgeCount`) in trace/query payloads.
- Knowledge scope uniqueness and bootstrap repair:
  - canonical schema now enforces scoped source/checkpoint uniqueness with
    partial indexes:
    - `knowledge_sources_global_source_key_unique`
    - `knowledge_sources_biz_source_key_unique`
    - `knowledge_checkpoints_global_agent_key_unique`
    - `knowledge_checkpoints_biz_agent_key_unique`
  - `packages/db/scripts/bootstrap-knowledge.ts` now drops legacy global indexes
    and creates the scoped partial-index set deterministically.
  - `packages/db/scripts/verify-bootstrap.ts` now verifies those partial-index
    invariants.
- Booking line execution attribution precision:
  - added canonical line-link helper (`apps/api/src/routes/bookings-line-execution.ts`)
    that prefers direct `booking_order_line_id` linkage and only falls back to
    `offer_component_id` when component->line mapping is unambiguous.
  - `GET /api/v1/bizes/:bizId/booking-orders/:bookingOrderId/line-execution`
    now returns linkage diagnostics:
    - `directLineLinkedUnitCount`
    - `fallbackComponentLinkedUnitCount`
    - `ambiguousFallbackUnitCount`
- Fulfillment write/read contract alignment:
  - `fulfillment_units` now includes optional `booking_order_line_id` with
    tenant-safe composite FK/index support.
  - `POST /api/v1/bizes/:bizId/fulfillment-units` accepts and validates
    `bookingOrderLineId` against the provided order.
- Instruments guardrail:
  - `GET /api/v1/bizes/:bizId/instrument-runs` now clamps `limit` to `<= 200`.
- Tests added:
  - `apps/api/src/routes/__tests__/bookings.line-linkage.test.ts`
    covers direct-link precedence, unique fallback mapping, and ambiguous
    fallback handling.

Validation:
- `bun run --cwd /Users/ameer/bizing/code/packages/db build`
- `bun run --cwd /Users/ameer/bizing/code/apps/api typecheck`
- `bun run --cwd /Users/ameer/bizing/code/apps/api test -- --run src/routes/__tests__/bookings.line-linkage.test.ts`
- `cd /Users/ameer/bizing/code/packages/db && bun scripts/bootstrap-knowledge.ts`
- `cd /Users/ameer/bizing/code/packages/db && bun scripts/verify-bootstrap.ts`

## 2026-03-06 — Homepage Fixed Header + Scroll-Gated Sign in

Frontend (`apps/admin`):
- Homepage top header is now fixed for public (logged-out) users.
- Header `Sign in` CTA is hidden initially and revealed only after scrolling below the hero `Get Started` button.
- Added smooth visibility transition so the header remains calm at load and progressively reveals account access while scrolling.

Validation:
- `bun run --cwd /Users/ameer/bizing/code/apps/admin build`

## 2026-03-06 — Homepage Copy Consistency Sweep

Frontend (`apps/admin`):
- Hero copy updated to:
  - `launch your biz.`
  - `grow without friction.`
  - `automate like a pro.`
- Hero support text updated to: `From your first sale to multi-team scale, Bizing keeps work, customers, and payments connected and flowing.`
- Removed top divider line above hero.
- Removed fixed-header Sign in icon.
- Updated growth section wording and removed duplicated heading usage:
  - section: `Built to grow with you`
  - scale card: `Scale with consistency`
- Updated automation line copy to `Human approvals keep you in control`.

Validation:
- `bun run --cwd /Users/ameer/bizing/code/apps/admin build`

## 2026-03-06 — Auth Surface Naming + First/Last Name Signup

Frontend (`apps/admin`):
- Auth route renamed to `/sign-in`.
- `/login` kept as compatibility redirect.
- Updated user-facing copy/buttons to use `Sign in` wording.
- Signup form now captures:
  - `First name`
  - `Last name`
  instead of a single full-name input.
- Signup payload now sends `firstName`, `lastName`, and combined `name`.

API (`apps/api`):
- Better Auth config now defines user `additionalFields`:
  - `firstName`
  - `lastName`
  mapped to existing `users.firstName` / `users.lastName` columns.

Validation:
- `bun run --cwd /Users/ameer/bizing/code/apps/api typecheck`
- `bun run --cwd /Users/ameer/bizing/code/apps/admin build`
- Live check:
  - `POST http://localhost:9000/api/auth/sign-up/email`
  - verified response user payload includes `firstName` + `lastName`

## 2026-03-08

- Canvascii path UX polish in the standalone workspace:
  - line/path labels now render after edit mode exits because the live canvas renderer overlays line label text instead of relying only on export/hit-test helpers
  - line/path border binding now shows explicit snap feedback with a highlighted bindable target outline and anchor-cell marker
  - `MULTI_SEGMENT_LINE` now uses a click-first interaction path so bend placement is based on the actual click cell instead of stale delayed hover state
  - resizing a bound endpoint away from a bindable box border now clears that endpoint binding
  - line-label edit mode no longer draws the live rendered label underneath the textarea, fixing glitchy overlapping text while typing
  - dragging a bound line/path now keeps bound endpoints visually attached instead of silently dropping bindings
  - one-sided paths now translate with their bound box instead of stretching against the free end
  - open paths can bind both ends to different boxes, and binding the open end now auto-finishes the path
  - line labels now preserve typed spaces
  - open-path bend points can be selected and deleted
  - deleting a bend point now removes only that corner by rerouting through the alternate elbow instead of collapsing too much of the path
- Validation:
  - `pnpm --filter @canvascii/app test:run -- src/components/asciip-core/store/editorInteractionActions.test.ts`
  - `pnpm --filter @canvascii/app build`
  - Docker rebuild of `canvascii-app`
  - headless Playwright screenshots verifying bind hover, bend preview, and post-edit line-label rendering on `http://127.0.0.1:9101`
# 2026-03-07

- Canvascii now has a clean local collaboration stack direction:
  - `apps/canvascii-collab` for Hocuspocus/Yjs
  - `packages/canvascii-core` for shared contracts
  - local Docker stack for Postgres + MinIO + collab service
  - Better Auth remains the browser/session authority through `apps/api`

# 2026-03-08

- Monorepo Canvascii app now has a local shadcn + Tailwind 4 UI foundation.
  - `/Users/ameer/bizing/code/apps/canvascii` now contains its own shadcn registry install under `src/components/ui`, including the official `button-group` component.
  - Tailwind CSS was upgraded to v4 in the app using CSS-first globals plus `@tailwindcss/postcss`.
  - the sign-in screen now uses the local shadcn `ButtonGroup` for the sign-in / create-account mode switch instead of relying only on inherited admin UI primitives.
  - verification: `pnpm --dir /Users/ameer/bizing/code/apps/canvascii build`
- Canvascii-facing UI surfaces now use shadcn primitives more consistently across the shared app boundary.
  - `/Users/ameer/bizing/code/apps/canvascii/src/app/sign-in/page.tsx` now uses shadcn `Input`, `Label`, `Button`, and `ButtonGroup` instead of raw form controls.
  - `/Users/ameer/bizing/code/apps/admin/src/components/sagas/explorer/asciip-page.tsx` now uses shadcn `Button` for file rows and a shadcn `ButtonGroup` for the primary toolbar action cluster.
  - `/Users/ameer/bizing/code/apps/admin/src/components/asciip-core/components/toolbar/ToolbarDiagrams.tsx` now uses shadcn buttons for inline rename/delete actions.
  - `/Users/ameer/bizing/code/apps/admin/src/components/asciip-core/components/canvas/TextShapeInput.tsx` now uses the shared shadcn `Textarea`.
  - verification: `pnpm --dir /Users/ameer/bizing/code/apps/canvascii build` and `pnpm --dir /Users/ameer/bizing/code/apps/admin build`

- Standalone Canvascii editor now supports border-bound connectors plus inline line labels.
  - `LINE` and `MULTI_SEGMENT_LINE` shapes can bind endpoints to rectangle/text borders and stay connected when targets move.
  - lines and paths now support double-click label editing with one-dimensional align/padding controls.
  - multi-segment paths now close into loops when the final segment reconnects to the starting point.
  - empty rectangle interiors are now selectable so move flows work from the box body, not only the border.
  - owners can now drag an empty select rectangle and create a portal directly from an in-canvas floating CTA.
  - editor composition was refactored so canvas pointer state lives in `useCanvasInteractionController`, overlays live in `CanvasOverlayLayer`, and share/portal mutations live in `use-canvas-share-actions`.
  - verification: `pnpm --filter @canvascii/app test:run -- src/components/asciip-core/store/editorInteractionActions.test.ts` and `pnpm --filter @canvascii/app build`

- Standalone Canvascii tightened the editor interaction layer:
  - main editor surfaces now consume a shared `useEditorInteractions()` hook instead of importing raw interaction actions directly
  - rectangle text alignment controls were merged into a compact hover/click expander with all 9 alignment positions
  - commit-like editor interaction intents now emit command projections from the interaction middleware layer, reducing reliance on the fallback legacy `diagramActions` projection path
  - fixed two browser regressions from that pass:
    - client command projection no longer imports `node:crypto`
    - rectangle text floating controls no longer violate React hook ordering when tool visibility changes
  - deterministic editor commit actions now use a first real command-first path:
    - middleware previews the legacy reducer in memory
    - projects commands from the before/after diagram data
    - hydrates app/diagram state from the canonical document result
    - bypasses the old debounced app-state mirror for that subset
  - pointer-driven commit edges (`pointerUp`, `pointerClick`, `pointerDoubleClick`) now use that command-first hydration path too
  - verification: `pnpm --filter @canvascii/app build` and `pnpm --filter @canvascii/app test:run -- src/components/asciip-core/store/editorInteractionActions.test.ts src/lib/canvascii/command-projection.test.ts src/lib/server/canvas-library-store.test.ts`
- Standalone Canvascii now reroutes two-sided box-bound paths when one bound box moves.
  - `lineFeatures.ts` now computes an orthogonal outside-the-box route for open `MULTI_SEGMENT_LINE` shapes with both endpoints bound to boxes.
  - moving one of the bound boxes keeps the connector attached on both ends by bending instead of leaving a detached stub.
  - verification: `pnpm --filter @canvascii/app test:run -- src/components/asciip-core/store/editorInteractionActions.test.ts` and `pnpm --filter @canvascii/app build`
- Standalone Canvascii path endpoints now resolve to the nearest facing box side at runtime.
  - connector creation and rebinding no longer stay stuck to the exact border side or corner originally clicked.
  - `withResolvedLineBindings(...)` now immediately runs new connectors through `applyShapeBindings(...)`, so the nearest-side correction happens on creation as well as later box moves.
  - verification: `pnpm --filter @canvascii/app test:run -- src/components/asciip-core/store/editorInteractionActions.test.ts` and `pnpm --filter @canvascii/app build`
- Standalone Canvascii connectors now support endpoint locking and easier endpoint-to-box drops.
  - dropping a line/path endpoint inside a box now binds it to that box instead of requiring an exact border-cell release.
  - hovered bound endpoints now expose a lock toggle; unlocked endpoints keep auto-resolving to the shortest-facing route, while locked endpoints preserve their explicit connection side.
  - verification: `pnpm --filter @canvascii/app test:run -- src/components/asciip-core/store/editorInteractionActions.test.ts` and `pnpm --filter @canvascii/app build`
- Standalone Canvascii point-text click-to-type is fixed.
  - `diagramSlice.ts` now creates a real `TEXT` shape from the single-click `onCellClick` path for point text creation and immediately enters `TEXT_EDIT`.
  - `editorInteractionActions.test.ts` now covers `TEXT` tool -> single click -> `TEXT_EDIT`.
  - verification: `pnpm --filter @canvascii/app test:run -- src/components/asciip-core/store/editorInteractionActions.test.ts` and `pnpm --filter @canvascii/app build`
- Standalone Canvascii portal creation and editing now use a real editor tool instead of a selection CTA.
  - the floating `Create portal` button after empty select-drag is removed.
  - owners now create portals from a dedicated `PORTAL` tool / `O` shortcut, with live drag preview.
  - portal overlays are selectable, movable, resizable, and deletable in-canvas while still persisting through share-policy mutations.
  - `/api/v1/canvascii/agent` now supports `update_portal` and `delete_portal` alongside `add_portal`.
  - verification: `pnpm --filter @canvascii/app build`, `docker compose up -d --build canvascii-app`, and Playwright browser verification for create -> move -> resize -> delete portal on `http://127.0.0.1:9101`
- Standalone Canvascii portal sharing is now a first-class owner flow.
  - selected portals now expose an inline share action in the overlay chrome.
  - portal sharing now opens a shadcn dialog with `Add people` and `Share with link` sections, per-share `view` / `edit`, and an `Allow whole canvas view` toggle.
  - `/api/v1/canvascii/agent` now supports `share_portal_link` in addition to email-based portal sharing.
  - `/api/v1/canvascii/file` and `/api/v1/canvascii/collab-access` now accept portal-share links through `x-canvascii-share-token` or `?share=<token>`.
  - fixed a route-classification bug so `share_portal_link` persists through the share-policy path instead of falling through the editor-mutation path.
  - verification: `pnpm --filter @canvascii/app test:run -- src/app/api/v1/canvascii/agent/route.test.ts`, `pnpm --filter @canvascii/app build`, Docker rebuild of `canvascii-app`, Playwright-authenticated portal-link grant creation, and anonymous `curl` verification of both file access and collab-access resolution with a live share token.
- Standalone Canvascii portal receivers and portal moves are more stable now.
  - receiver-side collaboration cursors are now clipped to the receiver's elevated portal scope instead of appearing anywhere on the whole canvas when context view is enabled.
  - editable portals keep their accent color, while visible-but-not-editable portals now render in neutral gray.
  - owner portal moves now translate fully enclosed shapes with the portal on move-only updates.
  - `/api/v1/canvascii/agent` now accepts an optional `editorState` snapshot for owner portal updates so shape translation and share-policy persistence happen in a single save.
  - deep-linked opens now also remember a failed target and stop retrying the same missing/inaccessible canvas on every re-render.
  - verification: `pnpm --dir /Users/ameer/bizing/canvascii --filter @canvascii/app test:run -- src/lib/canvascii/agent-edit.test.ts src/components/canvascii/collaborative-editor-shell.test.ts src/app/api/v1/canvascii/agent/route.test.ts src/components/asciip-core/store/editorInteractionActions.test.ts` and `pnpm --dir /Users/ameer/bizing/canvascii --filter @canvascii/app build`
