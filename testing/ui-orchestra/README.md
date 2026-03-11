# UI Orchestra

`UI Orchestra` is the handoff layer between narrative design and implementation.

The split is deliberate:

- Codex writes the experience story.
- Kimi turns that story into concrete UI front matter.
- Browser sagas verify the implemented experience in the real product.

This keeps the product work anchored in lived user experience instead of drifting
into a checklist of screens or API tasks.

## Roles

`Codex`

- Owns narrative direction.
- Defines audience boundaries.
- Describes emotion, timing, sequence, copy intent, and hidden complexity.
- Decides what should be invisible to the customer, business owner, and admin.

`Kimi`

- Converts the story into presentable UI front matter.
- Expands scenes into layout, visual hierarchy, component structure, empty states,
  microcopy, transitions, and interaction tone.
- Does not invent product behavior that conflicts with the story or the API.
- Runs through a supported coding-agent surface when the key is restricted to
  Kimi Coding.

`Browser sagas`

- Validate the implemented experience in the browser.
- Confirm that story, UI, and backend behavior still align.

## Workflow

1. Write or refine the story in `testing/ui-orchestra/stories/*.story.md`.
2. Run the orchestra script to generate Kimi UI front matter.
3. Review the generated front matter before implementation.
4. Implement UI changes in the app.
5. Re-run browser sagas and iterate on the story if the experience feels off.

## Files

- `stories/`: narrative source of truth per UC.
- `prompts/`: Kimi system prompts used to translate stories into UI front matter.
- `generated/`: saved Kimi outputs and request metadata.

## Command

From repo root:

```bash
KIMI_API_KEY=... bun run --cwd apps/api ux:orchestra
```

Optional environment variables:

- `STORY_FILE`
- `KIMI_MODEL`
- `KIMI_BASE_URL`
- `KIMI_OUTPUT_DIR`
- `KIMI_TRANSPORT=claude|raw`
- `KIMI_DRY_RUN=1`

Defaults:

- `STORY_FILE=testing/ui-orchestra/stories/uc-1-sarah-first-sale.story.md`
- `KIMI_TRANSPORT=claude`
- `KIMI_BASE_URL=https://api.kimi.com/coding/`

## Guardrails

- Never store API keys in the repository.
- Kimi Coding keys may reject raw HTTP clients and require an approved coding
  agent bridge such as Claude Code.
- Stories are narrative documents, not manifests.
- Generated front matter must preserve audience separation:
  - customer view for customers
  - owner dashboard for business owners
  - dev/admin surfaces only in admin-only tooling
- If the API cannot support a scene cleanly, fix the product contract before
  papering over it with UI.
