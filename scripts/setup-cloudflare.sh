#!/usr/bin/env bash
# First-time Cloudflare resource setup for PolyAgent OSS.
# Uses Prisma Accelerate (not Hyperdrive). Pattern: interactive-partners.
set -euo pipefail

cd "$(dirname "$0")/../apps/web"

echo "PolyAgent Cloudflare setup"
echo "=========================="
echo ""

if ! command -v wrangler >/dev/null 2>&1; then
  echo "wrangler CLI not found. Install: npm i -g wrangler"
  exit 1
fi

echo "→ Creating MARKET_CACHE KV namespace..."
KV_OUTPUT=$(npx wrangler kv namespace create MARKET_CACHE 2>&1) || true
echo "$KV_OUTPUT"

if echo "$KV_OUTPUT" | grep -q 'id = '; then
  KV_ID=$(echo "$KV_OUTPUT" | sed -n 's/.*id = "\([^"]*\)".*/\1/p' | head -1)
  echo ""
  echo "Add to wrangler.jsonc kv_namespaces:"
  echo '  { "binding": "MARKET_CACHE", "id": "'"$KV_ID"'", "preview_id": "'"$KV_ID"'" }'
fi

echo ""
echo "→ Worker secrets per environment (Prisma Accelerate — not Hyperdrive):"
echo "  wrangler secret put DATABASE_URL --env staging"
echo "  wrangler secret put DATABASE_URL --env production"
echo "  wrangler secret put CRON_SECRET --env staging"
echo "  wrangler secret put CRON_SECRET --env production"
echo "  wrangler secret put DASHBOARD_PASSWORD --env production"
echo "  wrangler secret put SESSION_SECRET --env production"
echo ""
echo "→ Local preview: copy .dev.vars.example → .dev.vars with Accelerate DATABASE_URL"
echo ""
echo "See docs/CLOUDFLARE.md and github.com/tyc-aidev/interactive-partners"