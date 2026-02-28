#!/usr/bin/env bash
set -euo pipefail
OUT="/Users/ameer/projects/bizing/.tmp/first-10-sagas-inspection.md"
: > "$OUT"
keys=(
'uc-1-the-appointment-heavy-professional-dr-ch'
'uc-1-the-group-event-organizer-gathering-gwen'
'uc-1-the-solo-entrepreneur-sarah'
'uc-10-the-ai-agent-builder-agent-avery'
'uc-10-the-confused-multi-biz-user-sam'
'uc-10-the-multi-location-owner-marcus'
'uc-100-the-appointment-heavy-professional-dr-ch'
'uc-100-the-black-hat-hacker-spectre'
'uc-100-the-solo-entrepreneur-sarah'
'uc-101-the-ai-agent-builder-agent-avery'
)
for key in "${keys[@]}"; do
  echo "## $key" | tee -a "$OUT"
  perl -e 'alarm shift @ARGV; exec @ARGV' 180 env SAGA_KEY="$key" SAGA_CONCURRENCY=1 bun run --cwd apps/api sagas:rerun >/tmp/bizing-saga-run.log 2>&1 || true
  bun --cwd apps/api -e '
    import { db, sagaRuns, sagaRunSteps, sagaDefinitions } from "@bizing/db";
    import { desc, eq, asc } from "drizzle-orm";
    const sagaKey = process.argv[2];
    const runs = await db.select({ runId: sagaRuns.id, status: sagaRuns.status, createdAt: sagaRuns.createdAt, updatedAt: sagaRuns.updatedAt }).from(sagaRuns).innerJoin(sagaDefinitions, eq(sagaRuns.sagaDefinitionId, sagaDefinitions.id)).where(eq(sagaDefinitions.sagaKey, sagaKey)).orderBy(desc(sagaRuns.createdAt)).limit(1);
    if (!runs[0]) { console.log(JSON.stringify({ sagaKey, error: "NO_RUN_FOUND" }, null, 2)); process.exit(0); }
    const steps = await db.select({ stepKey: sagaRunSteps.stepKey, status: sagaRunSteps.status, failureMessage: sagaRunSteps.failureMessage }).from(sagaRunSteps).where(eq(sagaRunSteps.sagaRunId, runs[0].runId)).orderBy(asc(sagaRunSteps.phaseOrder), asc(sagaRunSteps.stepOrder));
    const nonPassed = steps.filter((step) => step.status !== "passed");
    console.log(JSON.stringify({ sagaKey, run: runs[0], nonPassedCount: nonPassed.length, firstIssues: nonPassed.slice(0, 8) }, null, 2));
    process.exit(0);
  ' -- "$key" | tee -a "$OUT"
  echo | tee -a "$OUT"
  echo | tee -a "$OUT"
done
