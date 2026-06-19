#!/usr/bin/env bash
# First-time Cloudflare resource setup for PolyAgent OSS.
# Creates KV namespace and prints wrangler.jsonc snippets.
#
# Prerequisites: wrangler authenticated (`wrangler login`)
#
# Usage:
#   ./scripts/setup-cloudflare.sh
set -euo pipefail

cd "$(dirname "$0")/../apps/web"

echo "PolyAgent Cloudflare setup"
echo "=========================="
echo ""

if ! command -v wrangler >/dev/null 2>&1; then
  echo "wrangler CLI not found. Install: npm i -g wrangler"
  exit 1
fi

echo "→ Creating MARKET_CACHE KV namespace (skip if already exists)..."
KV_OUTPUT=$(npx wrangler kv namespace create MARKET_CACHE 2>&1) || true
echo "$KV_OUTPUT"

if echo "$KV_OUTPUT" | grep -q 'id = '; then
  KV_ID=$(echo "$KV_OUTPUT" | sed -n 's/.*id = "\([^"]*\)".*/\1/p' | head -1)
  echo ""
  echo "Add to wrangler.jsonc kv_namespaces:"
  echo '  { "binding": "MARKET_CACHE", "id": "'"$KV_ID"'", "preview_id": "'"$KV_ID"'" }'
else
  echo "(Namespace may already exist — check wrangler.jsonc for MARKET_CACHE id)"
fi

echo ""
echo "→ Hyperdrive (requires DATABASE_URL)..."
if [[ -n "${DATABASE_URL:-}" ]]; then
  npx wrangler hyperdrive create polyagent-db \
    --connection-string "$DATABASE_URL" \
    --binding HYPERDRIVE \
    --update-config
else
  echo "Set DATABASE_URL and run:"
  echo "  wrangler hyperdrive create polyagent-db \\"
  echo "    --connection-string \"\$DATABASE_URL\" \\"
  echo "    --binding HYPERDRIVE \\"
  echo "    --update-config"
fi

echo ""
echo "→ Worker secrets (run manually):"
echo "  wrangler secret put CRON_SECRET"
echo "  wrangler secret put DASHBOARD_PASSWORD"
echo "  wrangler secret put SESSION_SECRET"
echo ""
echo "See docs/CLOUDFLARE.md for full deploy guide."