#!/usr/bin/env bash
set -euo pipefail

echo "Launching browsermcp MCP server via npx..."
npx @browsermcp/mcp@latest "$@"
