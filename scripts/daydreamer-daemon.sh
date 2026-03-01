#!/bin/bash
# Start Bizing's Daydreamer daemon

set -euo pipefail

DAYDREAMER_PID_FILE="/tmp/bizing-daydreamer.pid"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
OPENCLAW_HOME_RESOLVED="${OPENCLAW_HOME:-$HOME/.openclaw}"
OPENCLAW_CONFIG="$OPENCLAW_HOME_RESOLVED/openclaw.json"

load_openclaw_gateway_env() {
  # By default, prefer canonical OpenClaw config over inherited shell values.
  # Set DAYDREAMER_RESPECT_GATEWAY_ENV=1 to keep caller-provided overrides.
  if [ "${DAYDREAMER_RESPECT_GATEWAY_ENV:-0}" = "1" ] && \
    [ -n "${OPENCLAW_GATEWAY_URL:-}" ] && [ -n "${OPENCLAW_GATEWAY_TOKEN:-}" ]; then
    return 0
  fi

  if [ ! -f "$OPENCLAW_CONFIG" ]; then
    return 0
  fi

  local parsed
  parsed="$(node -e "const fs=require('fs');const p=process.argv[1];const j=JSON.parse(fs.readFileSync(p,'utf8'));const port=j?.gateway?.port||18789;const token=j?.gateway?.auth?.token||'';process.stdout.write(JSON.stringify({url:\`http://127.0.0.1:\${port}\`,token}));" "$OPENCLAW_CONFIG")"

  OPENCLAW_GATEWAY_URL="$(printf "%s" "$parsed" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>process.stdout.write(JSON.parse(s).url))")"
  OPENCLAW_GATEWAY_TOKEN="$(printf "%s" "$parsed" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>process.stdout.write(JSON.parse(s).token||''))")"
  export OPENCLAW_GATEWAY_URL
  export OPENCLAW_GATEWAY_TOKEN
}

check_running() {
  if [ -f "$DAYDREAMER_PID_FILE" ]; then
    PID=$(cat "$DAYDREAMER_PID_FILE")
    if ps -p "$PID" > /dev/null 2>&1; then
      echo "🌀 Daydreamer already running (PID: $PID)"
      return 0
    fi
  fi
  return 1
}

start() {
  if check_running; then
    exit 0
  fi
  
  echo "🌀 Starting Bizing's Daydreamer..."
  
  cd "$REPO_ROOT" || exit 1
  
  # Source environment variables from shell profile if available
  if [ -f "$HOME/.zshrc" ]; then
    source "$HOME/.zshrc" 2>/dev/null || true
  fi
  if [ -f "$HOME/.bashrc" ]; then
    source "$HOME/.bashrc" 2>/dev/null || true
  fi
  
  # Check if required env vars are set
  if [ -z "${PERPLEXITY_API_KEY:-}" ]; then
    echo "⚠️  Warning: PERPLEXITY_API_KEY not set. Research and Kimi tasks will not work."
    echo "    Add to ~/.zshrc: export PERPLEXITY_API_KEY='your-key'"
  fi

  load_openclaw_gateway_env
  echo "Using OpenClaw gateway: ${OPENCLAW_GATEWAY_URL:-unset}"
  
  # Run in background with nohup, passing environment
  env PERPLEXITY_API_KEY="${PERPLEXITY_API_KEY:-}" \
      OPENCLAW_GATEWAY_URL="${OPENCLAW_GATEWAY_URL:-http://127.0.0.1:18789}" \
      OPENCLAW_GATEWAY_TOKEN="${OPENCLAW_GATEWAY_TOKEN:-}" \
      nohup node scripts/daydreamer.mjs > /tmp/bizing-daydreamer.log 2>&1 &
  
  PID=$!
  echo $PID > "$DAYDREAMER_PID_FILE"
  
  sleep 2
  
  if ps -p "$PID" > /dev/null 2>&1; then
    echo "✓ Daydreamer started (PID: $PID)"
    echo "  Log: /tmp/bizing-daydreamer.log"
  else
    echo "✗ Failed to start"
    rm -f "$DAYDREAMER_PID_FILE"
    exit 1
  fi
}

stop() {
  if [ -f "$DAYDREAMER_PID_FILE" ]; then
    PID=$(cat "$DAYDREAMER_PID_FILE")
    if ps -p "$PID" > /dev/null 2>&1; then
      echo "🌙 Stopping Daydreamer (PID: $PID)..."
      kill "$PID"
      sleep 2
      
      # Force kill if still running
      if ps -p "$PID" > /dev/null 2>&1; then
        kill -9 "$PID" 2>/dev/null
      fi
    fi
    rm -f "$DAYDREAMER_PID_FILE"
    echo "✓ Stopped"
  else
    echo "Daydreamer not running"
  fi
}

status() {
  if check_running; then
    PID=$(cat "$DAYDREAMER_PID_FILE")
    echo "Status: Running (PID: $PID)"
    
    # Show recent activity
    if [ -f "/tmp/bizing-daydreamer.log" ]; then
      echo ""
      echo "Recent activity:"
      tail -10 /tmp/bizing-daydreamer.log
    fi
  else
    echo "Status: Not running"
  fi
}

restart() {
  stop
  sleep 1
  start
}

case "${1:-start}" in
  start)
    start
    ;;
  stop)
    stop
    ;;
  restart)
    restart
    ;;
  status)
    status
    ;;
  *)
    echo "Usage: $0 {start|stop|restart|status}"
    exit 1
    ;;
esac
