# Cloudflare Deployment Guide

PolyAgent deploys to Cloudflare Workers via [OpenNext](https://opennext.js.org/cloudflare). PostgreSQL is accessed through [Cloudflare Hyperdrive](https://developers.cloudflare.com/hyperdrive/) (connection pooling for Workers). Prisma Postgres or any hosted PostgreSQL works as the origin database.

## Prerequisites

- Cloudflare account with Workers enabled
- Prisma Postgres database (or any PostgreSQL with Accelerate enabled)
- `wrangler` CLI authenticated (`wrangler login`)

## 1. PostgreSQL + Hyperdrive

1. Provision a PostgreSQL database (e.g. [Prisma Postgres](https://prisma.io/postgres) via `npx create-db create --json`, Neon, or RDS).
2. Run migrations: `DATABASE_URL=postgresql://... pnpm db:migrate:deploy && pnpm db:seed`
3. Create Hyperdrive:

```bash
cd apps/web
wrangler hyperdrive create polyagent-db \
  --connection-string "$DATABASE_URL" \
  --binding HYPERDRIVE \
  --update-config
```

4. For local OpenNext builds, set `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE` in `apps/web/.dev.vars` (gitignored).

Local Docker paths use a direct `postgresql://` URL without Hyperdrive.

## 2. KV namespace (market cache)

```bash
cd apps/web
npx wrangler kv namespace create MARKET_CACHE
```

Copy the returned namespace ID into `wrangler.jsonc`:

```jsonc
"kv_namespaces": [
  { "binding": "MARKET_CACHE", "id": "<your-id>", "preview_id": "<your-id>" }
]
```

## 3. Secrets

```bash
cd apps/web
npx wrangler secret put DATABASE_URL      # prisma://accelerate...
npx wrangler secret put CRON_SECRET       # random 32+ char string
npx wrangler secret put DASHBOARD_PASSWORD  # if exposing publicly
npx wrangler secret put SESSION_SECRET    # separate from password (recommended)
```

`CRON_SECRET` protects `/api/internal/cron` and `/api/internal/queue`. The Cron trigger and Queue consumer call these routes via the `WORKER_SELF_REFERENCE` service binding.

## 4. Wrangler bindings

`apps/web/wrangler.jsonc` configures:

| Binding | Purpose |
|---------|---------|
| `MARKET_CACHE` (KV) | Gamma API response cache |
| `TICK_QUEUE` (Queue) | Per-bot tick jobs |
| Cron `*/5 * * * *` | Enqueue active bots every 5 minutes |
| `SCHEDULER_MODE=cloudflare` | Use queue-based scheduling |

Queues are created automatically on first deploy.

## 5. Build and deploy

```bash
pnpm install
pnpm db:migrate:deploy   # against production DB
cd apps/web
pnpm run deploy          # opennextjs-cloudflare build && deploy
```

## 6. CI migration workflow

Run migrations before every production deploy. Example GitHub Actions step:

```yaml
- name: Apply database migrations
  run: pnpm db:migrate:deploy
  env:
    DATABASE_URL: ${{ secrets.DATABASE_URL }}
```

Use the **direct** PostgreSQL URL for migrations (not the Accelerate URL) if your CI runner has network access to the database. Alternatively, Prisma's migration tooling works with the Accelerate URL for `migrate deploy` in most setups.

Recommended deploy order:

1. `pnpm db:migrate:deploy`
2. `cd apps/web && pnpm run deploy`

## 7. Verify deployment

Run the automated verification script:

```bash
SMOKE_BASE_URL=https://<your-worker>.workers.dev \
CRON_SECRET=<your-secret> \
DASHBOARD_PASSWORD=<if-set> \
pnpm smoke:cloudflare
```

This checks health, cron auth, markets (KV cache), security headers, and the seeded demo bot.

For live scheduler activity:

```bash
npx wrangler tail
```

Wait for a Cron trigger (every 5 minutes). You should see enqueue activity and tick results in the bot detail UI.

## 8. Local Cloudflare preview

```bash
cd apps/web
pnpm run preview
```

Uses local simulation for KV and Queues. Set `SCHEDULER_MODE=cloudflare` in `.dev.vars` to test the enqueue path.