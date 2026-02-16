#!/bin/bash
# Bizing Gateway Manager

BIZING_PID_FILE="/tmp/bizing-gateway.pid"
BIZING_CONFIG="/Users/ameer/projects/bizing/.openclaw/openclaw.json"
BIZING_HOME="/Users/ameer/projects/bizing"
BIZING_REPO="/Users/ameer/projects/bizing/openclaw"

check_running() {
  if [ -f "$BIZING_PID_FILE" ]; then
    PID=$(cat "$BIZING_PID_FILE")
    if ps -p "$PID" > /dev/null 2>&1; then
      return 0
    fi
  fi
  return 1
}

stop_all() {
  echo "Stopping all gateways..."
  pkill -9 -f "openclaw-gateway" 2>/dev/null
  rm -f /tmp/openclaw/gateway.lock
  rm -f "$BIZING_PID_FILE"
  sleep 2
  echo "✓ Stopped"
}

start() {
  if check_running; then
    PID=$(cat "$BIZING_PID_FILE")
    echo "Bizing gateway already running (PID: $PID)"
    return 0
  fi
  
  # First stop any conflicting gateways
  pkill -9 -f "openclaw-gateway" 2>/dev/null
  sleep 2
  rm -f /tmp/openclaw/gateway.lock
  sleep 1
  
  echo "🌀 Starting Bizing Gateway (@bizing_ai_bot)..."
  
  cd "$BIZING_REPO" || exit 1
  
  # Run with explicit environment
  (
    export OPENCLAW_HOME="$BIZING_HOME"
    nohup node openclaw.mjs gateway --port 6130 > /tmp/bizing-gateway.log 2>&1 &
    echo $! > "$BIZING_PID_FILE"
  )
  
  sleep 5
  
  if check_running; then
    PID=$(cat "$BIZING_PID_FILE")
    echo "✓ Bizing gateway started (PID: $PID)"
    echo "  Port: 6130"
    echo "  Bot: @bizing_ai_bot"
  else
    echo "✗ Failed to start"
    return 1
  fi
}

stop() {
  if check_running; then
    PID=$(cat "$BIZING_PID_FILE")
    echo "Stopping Bizing gateway (PID: $PID)..."
    kill "$PID" 2>/dev/null
    sleep 2
    if ps -p "$PID" > /dev/null 2>&1; then
      kill -9 "$PID" 2>/dev/null
    fi
  fi
  rm -f "$BIZING_PID_FILE"
  echo "✓ Stopped"
}

status() {
  if check_running; then
    PID=$(cat "$BIZING_PID_FILE")
    echo "Bizing Gateway: Running (PID: $PID)"
    echo "  Port: 6130"
    echo "  Config: $BIZING_CONFIG"
    echo ""
    echo "Recent log:"
    tail -5 /tmp/bizing-gateway.log 2>/dev/null || echo "  (no log yet)"
  else
    echo "Bizing Gateway: Not running"
  fi
}

restart() {
  stop
  sleep 2
  start
}

log() {
  echo "=== Bizing Gateway Log ==="
  tail -50 /tmp/bizing-gateway.log 2>/dev/null || echo "No log file"
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
  log)
    log
    ;;
  stop-all)
    stop_all
    ;;
  *)
    echo "Usage: $0 {start|stop|restart|status|log|stop-all}"
    exit 1
    ;;
esac
