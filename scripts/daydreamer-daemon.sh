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
  
  # Run in background with nohup
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
