#!/usr/bin/env bash
# OpenNext Cloudflare build with pg-cloudflare dist fix (race during package copy).
set -euo pipefail
cd "$(dirname "$0")/.."

chmod +x scripts/fix-pg-cloudflare.sh scripts/inject-module-shim.sh

# Watch for incomplete pg-cloudflare copies while OpenNext bundles.
(
  for _ in $(seq 1 180); do
    ./scripts/fix-pg-cloudflare.sh >/dev/null 2>&1 || true
    sleep 0.4
  done
) &
WATCH_PID=$!

cleanup() {
  kill "$WATCH_PID" 2>/dev/null || true
  wait "$WATCH_PID" 2>/dev/null || true
}
trap cleanup EXIT

export WRANGLER_BUILD_PLATFORM="${WRANGLER_BUILD_PLATFORM:-node}"
export WRANGLER_BUILD_CONDITIONS="${WRANGLER_BUILD_CONDITIONS:-}"

pnpm exec opennextjs-cloudflare build
cleanup
trap - EXIT

./scripts/fix-pg-cloudflare.sh
./scripts/inject-module-shim.sh .open-next/worker.js
echo "OpenNext build ready: .open-next/worker.js"
