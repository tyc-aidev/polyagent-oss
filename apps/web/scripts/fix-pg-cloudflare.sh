#!/usr/bin/env bash
# OpenNext copies only pg-cloudflare's default export (dist/empty.js).
# Workers need dist/index.js for pg TCP sockets — restore full package dist.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$(ls -d "$ROOT"/../../node_modules/.pnpm/pg-cloudflare@*/node_modules/pg-cloudflare 2>/dev/null | head -1)"
if [ -z "${SRC:-}" ] && [ -d "$ROOT/node_modules/pg-cloudflare" ]; then
  SRC="$ROOT/node_modules/pg-cloudflare"
fi
if [ -z "${SRC:-}" ] || [ ! -d "$SRC/dist" ]; then
  echo "fix-pg-cloudflare: source package not found; skipping"
  exit 0
fi

fixed=0
while IFS= read -r -d '' dest; do
  if [ ! -f "$dest/dist/index.js" ]; then
    mkdir -p "$dest/dist"
    cp -R "$SRC/dist/." "$dest/dist/"
    if [ -d "$SRC/esm" ]; then
      mkdir -p "$dest/esm"
      cp -R "$SRC/esm/." "$dest/esm/"
    fi
    echo "fix-pg-cloudflare: restored dist into $dest"
    fixed=$((fixed + 1))
  fi
done < <(find "$ROOT/.open-next" -type d -name 'pg-cloudflare' -print0 2>/dev/null || true)

echo "fix-pg-cloudflare: fixed $fixed package copies"
