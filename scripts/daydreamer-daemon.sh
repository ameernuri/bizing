#!/bin/bash
# Start Bizing's Daydreamer daemon

DAYDREAMER_PID_FILE="/tmp/bizing-daydreamer.pid"

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
  
  cd ~/projects/bizing || exit 1
  
  # Source environment variables from shell profile if available
  if [ -f "$HOME/.zshrc" ]; then
    source "$HOME/.zshrc" 2>/dev/null || true
  fi
  if [ -f "$HOME/.bashrc" ]; then
    source "$HOME/.bashrc" 2>/dev/null || true
  fi
  
  # Check if required env vars are set
  if [ -z "$PERPLEXITY_API_KEY" ]; then
    echo "⚠️  Warning: PERPLEXITY_API_KEY not set. Research and Kimi tasks will not work."
    echo "    Add to ~/.zshrc: export PERPLEXITY_API_KEY='your-key'"
  fi
  
  # Run in background with nohup, passing environment
  env PERPLEXITY_API_KEY="$PERPLEXITY_API_KEY" \
      OPENCLAW_GATEWAY_URL="${OPENCLAW_GATEWAY_URL:-http://127.0.0.1:6130}" \
      OPENCLAW_GATEWAY_TOKEN="$OPENCLAW_GATEWAY_TOKEN" \
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
