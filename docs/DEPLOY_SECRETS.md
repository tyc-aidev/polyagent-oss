# GitHub Actions Secrets & Deployment Environments

Database access on Cloudflare Workers supports **Prisma Accelerate** *or* **direct Postgres** via the pg driver adapter. Hyperdrive is not used.

The Worker runtime always reads **`DATABASE_URL`**. Migrations use a **separate** GitHub secret, **`DATABASE_URL_POSTGRES`**, mapped to `DATABASE_URL` only in the migrate job.

## Deployment environments

| Environment | Worker name | Trigger | Local config file |
|-------------|-------------|---------|-------------------|
| **local** | — | `pnpm dev` | `apps/web/.env.local` |
| **local-cf** | `polyagent-web-staging` (wrangler dev) | `pnpm dev:cf` | `apps/web/.dev.vars` |
| **staging** | `polyagent-web-staging` | `deploy.yml` → `staging` | — |
| **production** | `polyagent-web` | `deploy.yml` → `production` or tag `v*` | — |

### Database URLs

| Job | GitHub name | Runtime env | Value |
|-----|-------------|-------------|-------|
| migrate (`pnpm db:setup`) | **Secret** `DATABASE_URL_POSTGRES` | `DATABASE_URL` | Direct `postgresql://…` |
| Worker build + `wrangler secret put` | **Secret** `DATABASE_URL` | `DATABASE_URL` | Accelerate `prisma+…` **or** direct `postgresql://…` |

## Where to store what

Jobs use `environment: staging|production`. GitHub merges **repo-level** secrets with **environment** secrets (environment wins on name clash).

### Repository secrets (shared)

| Secret | Used for |
|--------|----------|
| `CLOUDFLARE_API_TOKEN` | Wrangler deploy + secret sync |
| `CLOUDFLARE_ACCOUNT_ID` | Wrangler account |

### Environment secrets (`production` / `staging`)

| Secret | Used for |
|--------|----------|
| `DATABASE_URL` | OpenNext build + Worker secret `DATABASE_URL` |
| `DATABASE_URL_POSTGRES` | Migrate/seed only (direct Postgres) |
| `CRON_SECRET` | Worker secret + smoke |
| `DASHBOARD_PASSWORD` | Worker secret + smoke |
| `SESSION_SECRET` | Worker secret |

### Environment variables

| Variable | Used for |
|----------|----------|
| `SMOKE_BASE_URL` | Post-deploy smoke (`https://polyagent-web.<account>.workers.dev`) |

`CLOUDFLARE_*` may live at repo level; app secrets should stay on the Environment.

## CI/CD: Worker secret sync

Every `deploy.yml` run pipes GitHub secrets into Cloudflare Worker secrets for the target env, then deploys:

```text
DATABASE_URL, CRON_SECRET, DASHBOARD_PASSWORD, SESSION_SECRET
  → wrangler secret put … --env <staging|production>
  → wrangler deploy --env <staging|production>
```

`DATABASE_URL_POSTGRES` is **not** synced to the Worker.

## Manual first-time Worker secrets

```bash
cd apps/web
npx wrangler secret put DATABASE_URL --env production
npx wrangler secret put CRON_SECRET --env production
npx wrangler secret put DASHBOARD_PASSWORD --env production
npx wrangler secret put SESSION_SECRET --env production
```

## Local files (not GitHub)

| File | Purpose |
|------|---------|
| `apps/web/.env.local` | `next dev` — direct Docker Postgres |
| `apps/web/.dev.vars` | Wrangler preview / `dev:cf` |
| `packages/db/.env` | Prisma CLI |

## `ci.yml` — inline only (no GitHub secrets)

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | `postgresql://polyagent:polyagent@localhost:5432/polyagent` |
| `CRON_SECRET` | `ci-smoke-test-secret` |
