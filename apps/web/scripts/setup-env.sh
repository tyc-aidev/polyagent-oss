#!/usr/bin/env bash
# Copy env template to .env.local for local development.
# Pattern from interactive-partners/webapp/scripts/setup-env.sh
set -euo pipefail
cd "$(dirname "$0")/.."
if [ -f .env.local ]; then
  echo ".env.local already exists — not overwriting."
  exit 0
fi
cp env.example .env.local
echo "Created apps/web/.env.local from env.example"
echo "Local env: DATABASE_URL = direct Docker Postgres (see env.example)"
echo "CF preview: copy .dev.vars.example → .dev.vars with Accelerate DATABASE_URL"