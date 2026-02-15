#!/bin/bash
# Pre-Commit Workflow
# Must run BEFORE any commit
#
# Usage: source scripts/workflows/pre-commit.sh
#
# This script:
# 1. Runs tests
# 2. Shows results
# 3. Asks for approval
# 4. Only commits if approved

BIZING_ROOT="/Users/ameer/projects/bizing"
cd "$BIZING_ROOT"

echo "🔒 Pre-Commit Workflow"
echo "====================="
echo ""

# Step 1: Run tests
echo "1️⃣ Running tests..."
echo ""

API_TEST=$(cd apps/api && npx vitest run 2>&1 | tail -10)
ADMIN_TEST=$(cd apps/admin && npx vitest run 2>&1 | tail -10)

echo "API Tests:"
echo "$API_TEST"
echo ""
echo "Admin Tests:"
echo "$ADMIN_TEST"
echo ""

# Step 2: Check for failures
API_PASS=$(echo "$API_TEST" | grep -c "Test Files.*passed")
ADMIN_PASS=$(echo "$ADMIN_TEST" | grep -c "Test Files.*passed")

if [ "$API_PASS" -eq 0 ] || [ "$ADMIN_PASS" -eq 0 ]; then
    echo "❌ TESTS FAILED"
    echo "Do not commit. Fix issues first."
    return 1 2>/dev/null || exit 1
fi

echo "✅ All tests passed"
echo ""

# Step 3: Ask for approval
echo "3️⃣ About to commit changes."
echo ""
echo "Git status:"
git status --short | head -10
echo ""

read -p "Approve commit and do a PR? (yes/no): " APPROVE

if [ "$APPROVE" != "yes" ]; then
    echo "❌ Commit cancelled"
    return 1 2>/dev/null || exit 1
fi

echo ""
echo "✅ Commit approved"
echo ""
echo "Next: Run 'git add -A && git commit -m \"...\" && git push'"
