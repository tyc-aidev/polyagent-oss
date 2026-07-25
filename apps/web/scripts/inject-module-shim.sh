#!/usr/bin/env bash
# Injects a module/exports shim at the start of the OpenNext worker bundle.
# Fixes "ReferenceError: module is not defined" on Cloudflare Workers.
# Pattern from interactive-partners/webapp/scripts/inject-module-shim.sh
set -euo pipefail
WORKER_FILE="${1:-.open-next/worker.js}"
if [ ! -f "$WORKER_FILE" ]; then
  echo "Error: Worker file not found: $WORKER_FILE"
  exit 1
fi
SHIM='(function(){if(typeof globalThis.module==="undefined"){globalThis.module={exports:{}};globalThis.exports=globalThis.module.exports;}})();
'
echo "Injecting module/exports shim into $WORKER_FILE"
printf '%s' "$SHIM" | cat - "$WORKER_FILE" > "${WORKER_FILE}.tmp" && mv "${WORKER_FILE}.tmp" "$WORKER_FILE"