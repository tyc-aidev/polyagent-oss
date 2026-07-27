# Cloudflare Deployment Guide

PolyAgent deploys to Cloudflare Workers via [OpenNext](https://opennext.js.org/cloudflare). Database access uses **Prisma Postgres** with either:

1. **Direct `postgresql://`** + `@prisma/adapter-pg` (supported on Workers with `nodejs_compat`), or  
2. **Prisma Accelerate** (`prisma://` / `prisma+postgres://`) via `@prisma/extension-accelerate`

Hyperdrive is **not** used. Pattern aligned with [interactive-partners](https://github.com/tyc-aidev/interactive-partners).

## Prerequisites

- Cloudflare account with Workers enabled
- [Prisma Postgres](https://www.prisma.io/postgres) (or any Postgres) with a connection string
- Optional: Accelerate enabled for connection pooling at the edge
- `wrangler` CLI authenticated (`wrangler login`)

## Deployment environments

| Environment | Worker | Local config | `DATABASE_URL` value |
|-------------|--------|--------------|---------------------|
| **local** | — | `apps/web/.env.local` | Direct Docker `postgresql://...` |
| **local-cf** | staging (wrangler dev) | `apps/web/.dev.vars` | Accelerate **or** direct `postgresql://` |
| **staging** | `polyagent-web-staging` | GitHub Environment `staging` | Worker secret: runtime URL; migrate var: direct URL |
| **production** | `polyagent-web` | GitHub Environment `production` | Worker secret: runtime URL; migrate var: direct URL |

All environments use the **same variable name** (`DATABASE_URL`). See [DEPLOY_SECRETS.md](./DEPLOY_SECRETS.md).

## Local environment files

| File | Purpose |
|------|---------|
| `apps/web/.env.local` | `next dev` — copy from `apps/web/env.example` via `./scripts/setup-env.sh` |
| `packages/db/.env` | Prisma CLI (`postgres link`, migrations) |
| `apps/web/.dev.vars` | Wrangler preview / `dev:cf` — copy from `.dev.vars.example` |

## 1. Database setup

### Link / migrate (direct URL)

```bash
cd packages/db
npx prisma postgres link   # optional Prisma Postgres
# or set DATABASE_URL=postgresql://... in packages/db/.env
cd ../..
DATABASE_URL=postgresql://... pnpm db:setup
```

### Worker runtime URL

```bash
cd apps/web
# Either Accelerate:
npx wrangler secret put DATABASE_URL --env production   # prisma+postgres://...
# Or direct (pg adapter on Workers):
npx wrangler secret put DATABASE_URL --env production   # postgresql://...

npx wrangler secret put CRON_SECRET --env production
npx wrangler secret put DASHBOARD_PASSWORD --env production
npx wrangler secret put SESSION_SECRET --env production
```

Runtime selection is automatic in `apps/web/src/lib/db-factory.ts`:

| URL | Client path |
|-----|-------------|
| `prisma://` / `prisma+postgres://` | Edge client + Accelerate extension |
| `postgresql://` on Workers | PrismaClient + `@prisma/adapter-pg` + `pg` |
| `postgresql://` on Node | Shared Node `PrismaClient` singleton |

## 2. OpenNext edge fixes

Deploy avoids Worker hangs / bundle failures with:

1. **Per-request Prisma client** on Workers (`getPrismaAsync()` — never reuse across requests)
2. **Full `prisma generate`** for the pg adapter path (use `pnpm db:generate:no-engine` only with Accelerate-only builds)
3. **Module shim** injected into `.open-next/worker.js` after build
4. **`pg-cloudflare` dist restore** during OpenNext esbuild (OpenNext may copy only `empty.js`)
5. Wrangler flag: `no_handle_cross_request_promise_resolution`

Local and CI use `apps/web/scripts/build-opennext.sh` (build → fix → shim).

## 3. KV namespace (market cache)

```bash
./scripts/setup-cloudflare.sh
# or: cd apps/web && npx wrangler kv namespace create MARKET_CACHE
```

Update `wrangler.jsonc` `kv_namespaces` IDs if you create a new namespace.

## 4. Queues

Staging and production use separate queues:

| Env | Queue name |
|-----|------------|
| production | `polyagent-ticks` |
| staging | `polyagent-ticks-staging` |

Create if missing:

```bash
cd apps/web
npx wrangler queues create polyagent-ticks
npx wrangler queues create polyagent-ticks-staging
```

## 5. Build and deploy (manual)

```bash
pnpm install
DATABASE_URL=postgresql://... pnpm db:setup
pnpm db:generate
cd apps/web
pnpm run deploy            # production
# pnpm run deploy:staging  # staging
```

## 6. CI/CD

See [DEPLOY_SECRETS.md](./DEPLOY_SECRETS.md) for GitHub Environments (`staging`, `production`).

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `ci.yml` | push/PR | lint, test, Gamma check, Docker smoke |
| `deploy.yml` | tag / manual | migrate → generate → OpenNext build → **sync secrets** → deploy → smoke |

Manual dispatch chooses `staging` or `production`; tags deploy to `production`.

## 7. Verify deployment

```bash
SMOKE_BASE_URL=https://<your-worker>.workers.dev \
CRON_SECRET=<secret> \
DASHBOARD_PASSWORD=<password> \
pnpm smoke:cloudflare
```

## 8. Local Cloudflare preview

```bash
cd apps/web
cp .dev.vars.example .dev.vars   # set DATABASE_URL + CRON_SECRET
pnpm run dev:cf
```

## 9. Scheduler

- Cron: `*/5 * * * *` → `POST /api/internal/cron` (enqueues active bot IDs)
- Queue consumer: `polyagent-ticks` → `POST /api/internal/queue` per bot
- Both require `CRON_SECRET` (`x-cron-secret` header)
