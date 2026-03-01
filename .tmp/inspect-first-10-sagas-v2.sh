#!/usr/bin/env bash
set -euo pipefail
OUT="/Users/ameer/projects/bizing/.tmp/first-10-sagas-inspection-v2.md"
RUN_LOG_DIR="/Users/ameer/projects/bizing/.tmp/first-10-run-logs"
mkdir -p "$RUN_LOG_DIR"
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
  safe_key="${key//[^a-zA-Z0-9_-]/_}"
  log="$RUN_LOG_DIR/$safe_key.log"
  : > "$log"
  timed_out=0
  (
    cd /Users/ameer/projects/bizing
    env SAGA_KEY="$key" SAGA_CONCURRENCY=1 bun run --cwd apps/api sagas:rerun > "$log" 2>&1
  ) &
  pid=$!
  (
    sleep 60
    if kill -0 "$pid" 2>/dev/null; then
      kill -9 "$pid" 2>/dev/null || true
      echo timeout > "$log.timeout"
    fi
  ) &
  watchdog=$!
  wait "$pid" || true
  kill "$watchdog" 2>/dev/null || true
  wait "$watchdog" 2>/dev/null || true
  if [[ -f "$log.timeout" ]]; then
    timed_out=1
    rm -f "$log.timeout"
  fi
  TARGET_SAGA_KEY="$key" TIMED_OUT="$timed_out" LOG_PATH="$log" bun --cwd apps/api -e '
    import { db, sagaRuns, sagaRunSteps, sagaDefinitions } from "@bizing/db";
    import { desc, eq, asc } from "drizzle-orm";
    const sagaKey = process.env.TARGET_SAGA_KEY;
    const timedOut = process.env.TIMED_OUT === "1";
    const logPath = process.env.LOG_PATH;
    const runs = await db.select({ runId: sagaRuns.id, status: sagaRuns.status, createdAt: sagaRuns.createdAt }).from(sagaRuns).innerJoin(sagaDefinitions, eq(sagaRuns.sagaDefinitionId, sagaDefinitions.id)).where(eq(sagaDefinitions.sagaKey, sagaKey)).orderBy(desc(sagaRuns.createdAt)).limit(1);
    if (!runs[0]) {
      console.log(JSON.stringify({ sagaKey, timedOut, issueType: "no-run", firstIssues: [], logPath }, null, 2));
      process.exit(0);
    }
    const steps = await db.select({ stepKey: sagaRunSteps.stepKey, status: sagaRunSteps.status, failureMessage: sagaRunSteps.failureMessage }).from(sagaRunSteps).where(eq(sagaRunSteps.sagaRunId, runs[0].runId)).orderBy(asc(sagaRunSteps.phaseOrder), asc(sagaRunSteps.stepOrder));
    const firstIssues = steps.filter((step) => step.status !== "passed").slice(0, 8);
    const firstPending = steps.find((step) => step.status === "pending") ?? null;
    const issueType = timedOut ? "hang" : runs[0].status;
    console.log(JSON.stringify({ sagaKey, timedOut, issueType, run: runs[0], counts: { passed: steps.filter((s) => s.status === "passed").length, failed: steps.filter((s) => s.status === "failed").length, blocked: steps.filter((s) => s.status === "blocked").length, pending: steps.filter((s) => s.status === "pending").length }, firstPending, firstIssues, logPath }, null, 2));
    process.exit(0);
  ' | tee -a "$OUT"
  echo | tee -a "$OUT"
  echo | tee -a "$OUT"
done
