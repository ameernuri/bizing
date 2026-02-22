#!/bin/bash
# Bizing OpenClaw - Setup and Management
#
# Usage:
#   source scripts/bizing-openclaw.sh setup    - Create Bizing's instance
#   source scripts/bizing-openclaw.sh start    - Start Bizing's daemon
#   source scripts/bizing-openclaw.sh stop     - Stop Bizing's daemon
#   source scripts/bizing-openclaw.sh status   - Check Bizing's status
#   source scripts/bizing-openclaw.sh restart  - Restart Bizing's daemon

BIZING_OPENCLAW="$HOME/projects/bizing/.openclaw"
BIZING_OPENCLAW_WS="$BIZING_OPENCLAW/workspace"

case "$1" in
    setup)
        echo "🧠 Setting up Bizing OpenClaw Instance..."
        echo ""
        echo "Instance already configured at: $BIZING_OPENCLAW"
        echo ""
        echo "📁 Location: $BIZING_OPENCLAW"
        echo "🌐 Gateway Port: 6130"
        echo "🤖 Telegram: @bizing_bot"
        ;;
        
    start)
        echo "🚀 Starting Bizing's OpenClaw Gateway..."
        cd "$BIZING_OPENCLAW"
        OPENCLAW_HOME="$BIZING_OPENCLAW" openclaw gateway start
        ;;
        
    stop)
        echo "🛑 Stopping Bizing's OpenClaw Gateway..."
        cd "$BIZING_OPENCLAW"
        OPENCLAW_HOME="$BIZING_OPENCLAW" openclaw gateway stop
        ;;
        
    status)
        echo "📊 Bizing's OpenClaw Status:"
        cd "$BIZING_OPENCLAW"
        OPENCLAW_HOME="$BIZING_OPENCLAW" openclaw gateway status
        ;;
        
    restart)
        echo "🔄 Restarting Bizing's OpenClaw Gateway..."
        cd "$BIZING_OPENCLAW"
        OPENCLAW_HOME="$BIZING_OPENCLAW" openclaw gateway restart
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
        echo "  🌐 Port: 6130"
        echo "  🤖 Telegram: @bizing_bot"
        echo "  📁 Workspace: → ~/projects/bizing/mind"
        ;;
esac
