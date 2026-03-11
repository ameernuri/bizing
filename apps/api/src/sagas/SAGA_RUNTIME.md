# Saga Runtime Notes

## Why saga runs used to feel "hung"

The runner used to do a **full run integrity recompute on every step status write**.

That meant each step transition did all of this again:

- load the full run row
- load every run step
- load every artifact
- load actor profiles/messages
- read the saga spec again
- compare evidence against the spec
- upsert coverage/report rows

That is correct work, but it is the wrong place to do it.
As the run grows, each step gets slower than the previous one. The effect looks
like random hangs around later saga steps such as calendar review or UC
validation, even when the business endpoints themselves are fine.

## Canonical design

The runtime now has two modes:

1. **Cheap step refresh**
   - used during normal step execution
   - updates step state, run counters, heartbeat, and live status only
   - does **not** recompute full evidence integrity
   - does **not** rewrite coverage rows

2. **Final integrity refresh**
   - called once the runner has finished attaching traces/snapshots/reports
   - recomputes full evidence integrity
   - updates final run status if required evidence is missing
   - persists coverage/reporting rollups

## Rule of thumb

- If you are inside a hot per-step write path, keep it cheap.
- If you need a truthful final verdict, use the explicit run refresh/finalize
  path after evidence has been attached.

## Runner safety

The saga runner now also uses bounded HTTP timeouts for internal API calls, so a
bad endpoint becomes a deterministic failure instead of an indefinitely running
saga.

## Depth lanes

Saga definitions and runs now carry an explicit depth lane:

- shallow: quick smoke validation for fast OODA loops.
- medium: balanced daily/regular regression validation.
- deep: broad stress validation for risky merges and major refactors.

Runner controls:

- `SAGA_DEPTH=shallow|medium|deep|all`
- `bun run --cwd /Users/ameer/bizing/code/apps/api sagas:rerun:shallow`
- `bun run --cwd /Users/ameer/bizing/code/apps/api sagas:rerun:medium`
- `bun run --cwd /Users/ameer/bizing/code/apps/api sagas:rerun:deep`
