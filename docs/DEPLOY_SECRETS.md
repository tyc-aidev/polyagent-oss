# GitHub Actions Secrets & Deployment Environments

Database access on Cloudflare Workers supports **Prisma Accelerate** *or* **direct Postgres** via the pg driver adapter. Hyperdrive is not used.

All runtimes read a single variable name: **`DATABASE_URL`**. The **value** depends on deployment environment (see table below).

## Deployment environments

| Environment | Worker name | Trigger | Local config file |
|-------------|-------------|---------|-------------------|
| **local** | — | `pnpm dev` | `apps/web/.env.local` |
| **local-cf** | `polyagent-web-staging` (wrangler dev) | `pnpm dev:cf` | `apps/web/.dev.vars` |
| **staging** | `polyagent-web-staging` | `deploy.yml` → `staging` | — |
| **production** | `polyagent-web` | `deploy.yml` → `production` or tag `v*` | — |

### `DATABASE_URL` values by environment

| Environment | `DATABASE_URL` value | Where set |
|-------------|---------------------|-----------|
| **local** | `postgresql://polyagent:polyagent@localhost:5432/polyagent` | `apps/web/.env.local` |
| **local-cf** | Accelerate `prisma+postgres://...` **or** direct `postgresql://...` | `apps/web/.dev.vars` |
| **staging** (migrate) | Direct `postgresql://...` | GitHub Environment `staging` → **Variables** → `DATABASE_URL` |
| **staging** (Worker) | Accelerate **or** direct `postgresql://...` | GitHub Environment `staging` → **Secrets** → `DATABASE_URL` |
| **production** (migrate) | Direct `postgresql://...` | GitHub Environment `production` → **Variables** → `DATABASE_URL` |
| **production** (Worker) | Accelerate **or** direct `postgresql://...` | GitHub Environment `production` → **Secrets** → `DATABASE_URL` |

Migrations (`pnpm db:setup`) **always** require a direct `postgresql://` URL.  
Worker runtime accepts Accelerate or direct Postgres (adapter path).  
CI uses the same name (`DATABASE_URL`) in both cases — migrate reads `vars.DATABASE_URL`, deploy reads `secrets.DATABASE_URL`.

## Workflows

| Workflow | Secrets required |
|----------|------------------|
| `ci.yml` | None (ephemeral Postgres) |
| `deploy.yml` | Per-environment secrets + variables (see below) |

## `deploy.yml` — GitHub Environments

Create two environments under **Settings → Environments**: `staging` and `production`.

Each environment needs:

### Secrets (Settings → Environments → *env* → Environment secrets)

| Secret | Required | Used for |
|--------|----------|----------|
| `DATABASE_URL` | Yes | OpenNext build + `wrangler secret put DATABASE_URL` (runtime URL) |
| `CLOUDFLARE_API_TOKEN` | Yes | `wrangler deploy` |
| `CLOUDFLARE_ACCOUNT_ID` | Yes | `wrangler deploy` |
| `SMOKE_BASE_URL` | Yes | Post-deploy smoke (`https://polyagent-web-staging.*` or `https://polyagent-web.*`) |
| `CRON_SECRET` | Yes | Smoke + Worker secret sync |
| `DASHBOARD_PASSWORD` | Yes* | Smoke auth + Worker secret |
| `SESSION_SECRET` | Yes | Worker secret sync |

\*Required when dashboard auth is enabled.

### Variables (Settings → Environments → *env* → Environment variables)

| Variable | Required | Used for |
|----------|----------|----------|
| `DATABASE_URL` | Yes | `pnpm db:setup` migrate job (direct `postgresql://`) |

## CI/CD: Worker secret sync

`deploy.yml` pipes GitHub Environment secrets into Cloudflare Worker secrets before each deploy:

```yaml
echo "${{ secrets.DATABASE_URL }}" | wrangler secret put DATABASE_URL --env <staging|production>
echo "${{ secrets.CRON_SECRET }}" | wrangler secret put CRON_SECRET --env <staging|production>
# ... DASHBOARD_PASSWORD, SESSION_SECRET
```

Build step runs `apps/web/scripts/build-opennext.sh` (OpenNext + `pg-cloudflare` fix + module shim).

## Cloudflare Worker secrets (manual / first-time)

```bash
cd apps/web
npx wrangler secret put DATABASE_URL --env staging
npx wrangler secret put CRON_SECRET --env staging
npx wrangler secret put DATABASE_URL --env production
npx wrangler secret put CRON_SECRET --env production
npx wrangler secret put DASHBOARD_PASSWORD --env production
npx wrangler secret put SESSION_SECRET --env production
```

No Hyperdrive binding. No `DATABASE_URL` in `wrangler.jsonc` vars (secret only).

## Local files (not GitHub)

| File | Purpose |
|------|---------|
| `apps/web/.env.local` | `next dev` — direct Docker Postgres |
| `apps/web/.dev.vars` | Wrangler preview / `dev:cf` |
| `packages/db/.env` | Prisma CLI (`postgres link`, local migrations) |

Setup: `cd apps/web && ./scripts/setup-env.sh`

## `ci.yml` — inline only

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | `postgresql://polyagent:polyagent@localhost:5432/polyagent` |
| `CRON_SECRET` | `ci-smoke-test-secret` |
