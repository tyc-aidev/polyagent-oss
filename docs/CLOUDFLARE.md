# Cloudflare Deployment Guide

PolyAgent deploys to Cloudflare Workers via [OpenNext](https://opennext.js.org/cloudflare). PostgreSQL is accessed through [Cloudflare Hyperdrive](https://developers.cloudflare.com/hyperdrive/) (connection pooling for Workers). The origin database is [Prisma Postgres](https://www.prisma.io/postgres).

## Prerequisites

- Cloudflare account with Workers enabled
- [Prisma Postgres](https://www.prisma.io/postgres) database (provisioned via Prisma CLI or [Prisma Console](https://console.prisma.io))
- `wrangler` CLI authenticated (`wrangler login`)

## 1. Prisma Postgres + Hyperdrive

### Provision or link a database

For an **existing** project like PolyAgent, link `packages/db` to your Prisma Postgres database:

```bash
cd packages/db
npx prisma@7 postgres link
```

This opens the browser to authenticate on [Prisma Console](https://console.prisma.io), lets you pick a workspace/project/database, and writes a `DATABASE_URL` to `.env`.

For a **new** greenfield project:

```bash
npx prisma@7 init --db
```

Alternatively, create a database in [Prisma Console](https://console.prisma.io) and copy the **direct** `postgresql://...` connection string.

### Run migrations

Use the direct PostgreSQL URL (not a pooled or edge URL) for migrations:

```bash
DATABASE_URL=postgresql://... pnpm db:migrate:deploy
pnpm db:seed
```

### Create Hyperdrive

Hyperdrive provides connection pooling for the Worker runtime. Point it at the same direct PostgreSQL URL:

```bash
cd apps/web
wrangler hyperdrive create polyagent-db \
  --connection-string "$DATABASE_URL" \
  --binding HYPERDRIVE \
  --update-config
```

To update an existing Hyperdrive config after rotating credentials:

```bash
wrangler hyperdrive update <hyperdrive-id> --connection-string "$DATABASE_URL"
```

The Worker reads `env.HYPERDRIVE.connectionString` at runtime (see `apps/web/src/lib/db.ts`). You do **not** need a `DATABASE_URL` Worker secret for production queries.

### Local OpenNext builds

Set the direct connection string in `apps/web/.dev.vars` (gitignored):

```
CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE=postgresql://...
```

Local Docker dev uses a direct `postgresql://` URL without Hyperdrive.

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
npx wrangler secret put CRON_SECRET       # random 32+ char string
npx wrangler secret put DASHBOARD_PASSWORD  # if exposing publicly
npx wrangler secret put SESSION_SECRET    # separate from password (recommended)
```

`CRON_SECRET` protects `/api/internal/cron` and `/api/internal/queue`. The Cron trigger and Queue consumer call these routes via the `WORKER_SELF_REFERENCE` service binding.

## 4. Wrangler bindings

`apps/web/wrangler.jsonc` configures:

| Binding | Purpose |
|---------|---------|
| `HYPERDRIVE` | Pooled PostgreSQL connection for Prisma |
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

Run migrations before every production deploy. Store the **direct** Prisma Postgres `postgresql://` URL as a GitHub secret (`DATABASE_URL`).

```yaml
- name: Apply database migrations
  run: pnpm db:migrate:deploy
  env:
    DATABASE_URL: ${{ secrets.DATABASE_URL }}
```

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