#!/bin/bash
# Session Start Workflow
# Runs automatically when a new session/context begins
# 
# Usage: source scripts/workflows/session-start.sh
#
# This script:
# 1. Reads RAM (active context)
# 2. Reads INDEX (entry point)
# 3. Reads feedback (learnings)
# 4. Shows current state

BIZING_ROOT="/Users/ameer/projects/bizing"
RAM_FILE="$BIZING_ROOT/mind/memory/RAM.md"
INDEX_FILE="$BIZING_ROOT/mind/INDEX.md"
FEEDBACK_FILE="$BIZING_ROOT/mind/symbiosis/feedback.md"

echo "🧠 Session Start Workflow"
echo "=========================="

# 1. Read RAM
if [ -f "$RAM_FILE" ]; then
    echo ""
    echo "📖 Reading RAM..."
    head -30 "$RAM_FILE"
else
    echo "⚠️ RAM not found"
fi

# 2. Read INDEX
if [ -f "$INDEX_FILE" ]; then
    echo ""
    echo "📖 Reading INDEX..."
    head -50 "$INDEX_FILE"
else
    echo "⚠️ INDEX not found"
fi

# 3. Read Feedback
if [ -f "$FEEDBACK_FILE" ]; then
    echo ""
    echo "📖 Reading Feedback..."
    head -30 "$FEEDBACK_FILE"
else
    echo "⚠️ Feedback not found"
fi

echo ""
echo "=========================="
echo "✅ Session context loaded"
echo ""
echo "Next: Do work, then update RAM if context changed"
