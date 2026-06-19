# GitHub Actions Secrets & Environment Variables

Reference for CI/CD and production deploy pipelines.

## Workflows overview

| Workflow | Secrets required | Notes |
|----------|------------------|-------|
| `ci.yml` | **None** | Uses ephemeral Postgres service; inline `DATABASE_URL` |
| `deploy.yml` | **6 secrets** | Production migrate → deploy → verify |

## `deploy.yml` — required GitHub secrets

Configure at **Settings → Secrets and variables → Actions → Repository secrets**.

| Secret | Required | Used in | How to obtain |
|--------|----------|---------|---------------|
| `DATABASE_URL` | Yes | migrate job, deploy build | Prisma Postgres direct `postgresql://` URL from [Prisma Console](https://console.prisma.io) → Connect |
| `CLOUDFLARE_API_TOKEN` | Yes | deploy job | [Cloudflare dashboard](https://dash.cloudflare.com/profile/api-tokens) → Create Token → **Edit Cloudflare Workers** template |
| `CLOUDFLARE_ACCOUNT_ID` | Yes | deploy job | `wrangler whoami` → Account ID |
| `SMOKE_BASE_URL` | Yes | verify job | Production Worker URL, e.g. `https://polyagent-web.<account>.workers.dev` |
| `CRON_SECRET` | Yes | verify job | Same value as `wrangler secret put CRON_SECRET` (32+ random chars) |
| `DASHBOARD_PASSWORD` | Yes* | verify job | Same value as `wrangler secret put DASHBOARD_PASSWORD` |

\*Required when dashboard auth is enabled on the Worker (recommended for public deploys).

### Deploy job environment variable (derived from secret)

| Variable | Source | Purpose |
|----------|--------|---------|
| `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE` | `${{ secrets.DATABASE_URL }}` | OpenNext build needs a Postgres URL to compile with Hyperdrive binding |

## Cloudflare Worker secrets (not GitHub)

Set via `wrangler secret put` — **not** stored in the repo:

| Secret | Required | Purpose |
|--------|----------|---------|
| `CRON_SECRET` | Yes (production) | Protects `/api/internal/cron` and `/api/internal/queue` |
| `DASHBOARD_PASSWORD` | Recommended | Password gate for public dashboard |
| `SESSION_SECRET` | Recommended | HMAC signing for session cookies (separate from password) |

Database access uses the **Hyperdrive binding** (`HYPERDRIVE` in `wrangler.jsonc`), not a `DATABASE_URL` Worker secret.

## `ci.yml` — inline environment variables

No GitHub secrets needed. Jobs use:

| Variable | Value | Job |
|----------|-------|-----|
| `DATABASE_URL` | `postgresql://polyagent:polyagent@localhost:5432/polyagent` | smoke |
| `SCHEDULER_MODE` | `docker` | smoke |
| `SMOKE_BASE_URL` | `http://localhost:3000` | smoke |
| `CRON_SECRET` | `ci-smoke-test-secret` | smoke |

## Local / fork self-host

Forks and local deploys only need:

- `DATABASE_URL` for migrations and Docker Compose
- Cloudflare secrets only if deploying to Workers

See [CLOUDFLARE.md](./CLOUDFLARE.md) and [`.env.example`](../.env.example).