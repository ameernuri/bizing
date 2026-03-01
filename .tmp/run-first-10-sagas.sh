#!/usr/bin/env bash
set -euo pipefail
LOG_FILE="/Users/ameer/projects/bizing/.tmp/first-10-sagas.log"
: > "$LOG_FILE"
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
  echo "===== $key =====" | tee -a "$LOG_FILE"
  if SAGA_KEY="$key" SAGA_CONCURRENCY=1 bun run --cwd apps/api sagas:rerun >> "$LOG_FILE" 2>&1; then
    echo "exit=0" | tee -a "$LOG_FILE"
  else
    code=$?
    echo "exit=$code" | tee -a "$LOG_FILE"
  fi
  echo | tee -a "$LOG_FILE"
  echo | tee -a "$LOG_FILE"
done
