#!/bin/bash
# Bizing OpenClaw - Setup and Management
#
# Usage:
#   source scripts/bizing-openclaw.sh setup    - Create Bizing's instance
#   source scripts/bizing-openclaw.sh start    - Start Bizing's daemon
#   source scripts/bizing-openclaw.sh stop     - Stop Bizing's daemon
#   source scripts/bizing-openclaw.sh status   - Check Bizing's status
#   source scripts/bizing-openclaw.sh restart  - Restart Bizing's daemon

set -euo pipefail

BIZING_OPENCLAW="${BIZING_OPENCLAW:-${OPENCLAW_HOME:-$HOME/.openclaw}}"
BIZING_OPENCLAW_WS="${BIZING_OPENCLAW_WS:-$BIZING_OPENCLAW/workspace}"
BIZING_OPENCLAW_CONFIG="$BIZING_OPENCLAW/openclaw.json"

openclaw_home() {
    env -u OPENCLAW_GATEWAY_URL \
        -u OPENCLAW_GATEWAY_TOKEN \
        OPENCLAW_HOME="$BIZING_OPENCLAW" \
        openclaw "$@"
}

gateway_port() {
    if [ -f "$BIZING_OPENCLAW_CONFIG" ]; then
        node -e "const fs=require('fs');const p=process.argv[1];const j=JSON.parse(fs.readFileSync(p,'utf8'));process.stdout.write(String(j?.gateway?.port ?? 'unknown'))" "$BIZING_OPENCLAW_CONFIG"
    else
        printf "unknown"
    fi
}

case "$1" in
    setup)
        echo "🧠 Setting up Bizing OpenClaw Instance..."
        echo ""
        echo "Instance already configured at: $BIZING_OPENCLAW"
        echo ""
        echo "📁 Location: $BIZING_OPENCLAW"
        echo "🌐 Gateway Port: $(gateway_port)"
        echo "🤖 Telegram: @bizing_bot"
        ;;
        
    start)
        echo "🚀 Starting Bizing's OpenClaw Gateway..."
        cd "$BIZING_OPENCLAW"
        openclaw_home gateway start
        ;;
        
    stop)
        echo "🛑 Stopping Bizing's OpenClaw Gateway..."
        cd "$BIZING_OPENCLAW"
        openclaw_home gateway stop
        ;;
        
    status)
        echo "📊 Bizing's OpenClaw Status:"
        cd "$BIZING_OPENCLAW"
        openclaw_home gateway status
        ;;
        
    restart)
        echo "🔄 Restarting Bizing's OpenClaw Gateway..."
        cd "$BIZING_OPENCLAW"
        openclaw_home gateway restart
        ;;
        
    *)
        echo "🧠 Bizing OpenClaw Management"
        echo ""
        echo "Usage: source scripts/bizing-openclaw.sh <command>"
        echo ""
        echo "Commands:"
        echo "  setup   - Create Bizing's OpenClaw instance"
        echo "  start   - Start Bizing's daemon"
        echo "  stop    - Stop Bizing's daemon"
        echo "  status  - Check Bizing's status"
        echo "  restart - Restart Bizing's daemon"
        echo ""
        echo "Current Setup:"
        echo "  📁 $BIZING_OPENCLAW"
        echo "  🌐 Port: $(gateway_port)"
        echo "  🤖 Telegram: @bizing_bot"
        echo "  📁 Workspace: $BIZING_OPENCLAW_WS"
        ;;
esac
