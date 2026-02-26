#!/bin/bash
set -euo pipefail

CONFIG_FILE="${UTCP_CONFIG_FILE:-/Users/ameer/projects/bizing/.utcp_config.bizing-testing.json}"

if [ ! -f "$CONFIG_FILE" ]; then
  echo "UTCP config file not found: $CONFIG_FILE"
  exit 1
fi

echo "Starting Code Mode MCP bridge..."
echo "UTCP_CONFIG_FILE=$CONFIG_FILE"
echo ""
echo "Use this MCP server from your agent client to call:"
echo " - bizing_agent_testing.listAgentTestPacks"
echo " - bizing_agent_testing.runAgentFitnessLoop"
echo " - bizing_agent_testing.runLifecyclePack"
echo " - bizing_agent_testing.runScenarioPack"
echo ""

UTCP_CONFIG_FILE="$CONFIG_FILE" npx @utcp/code-mode-mcp
