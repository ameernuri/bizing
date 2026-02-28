#!/bin/bash
# Bizing Gateway Manager
#
# Canonical behavior:
# - Delegate lifecycle to the `openclaw` CLI only.
# - Never hardcode gateway port/token in this wrapper.
# - Resolve values from OPENCLAW_HOME/openclaw.json (or ~/.openclaw by default).

set -euo pipefail

BIZING_OPENCLAW_HOME="${BIZING_OPENCLAW_HOME:-${OPENCLAW_HOME:-$HOME/.openclaw}}"
BIZING_OPENCLAW_CONFIG="$BIZING_OPENCLAW_HOME/openclaw.json"

openclaw_home() {
  env -u OPENCLAW_GATEWAY_URL \
    -u OPENCLAW_GATEWAY_TOKEN \
    OPENCLAW_HOME="$BIZING_OPENCLAW_HOME" \
    openclaw "$@"
}

gateway_port() {
  if [ -f "$BIZING_OPENCLAW_CONFIG" ]; then
    node -e "const fs=require('fs');const p=process.argv[1];const j=JSON.parse(fs.readFileSync(p,'utf8'));process.stdout.write(String(j?.gateway?.port ?? 'unknown'))" "$BIZING_OPENCLAW_CONFIG"
  else
    printf "unknown"
  fi
}

start() {
  echo "Starting OpenClaw gateway (home: $BIZING_OPENCLAW_HOME)..."
  openclaw_home gateway start
  echo "✓ Started (port: $(gateway_port))"
}

stop() {
  echo "Stopping OpenClaw gateway (home: $BIZING_OPENCLAW_HOME)..."
  openclaw_home gateway stop
  echo "✓ Stopped"
}

status() {
  echo "OpenClaw home: $BIZING_OPENCLAW_HOME"
  echo "Config: $BIZING_OPENCLAW_CONFIG"
  echo "Port: $(gateway_port)"
  echo ""
  openclaw_home gateway status || true
  echo ""
  openclaw_home gateway probe || true
}

restart() {
  openclaw_home gateway restart
  echo "✓ Restarted (port: $(gateway_port))"
}

log() {
  # Uses OpenClaw's native logger to avoid stale, custom nohup log paths.
  openclaw_home logs --tail 80
}

stop_all() {
  # Emergency cleanup only for local dev. This intentionally does not kill -9
  # unknown processes; it asks OpenClaw to stop cleanly for this OPENCLAW_HOME.
  stop
}

case "${1:-start}" in
start) start ;;
stop) stop ;;
restart) restart ;;
status) status ;;
log) log ;;
stop-all) stop_all ;;
*)
  echo "Usage: $0 {start|stop|restart|status|log|stop-all}"
  exit 1
  ;;
esac
