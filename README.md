# PolyAgent OSS

[![CI](https://github.com/tyc-aidev/polyagent-oss/actions/workflows/ci.yml/badge.svg)](https://github.com/tyc-aidev/polyagent-oss/actions/workflows/ci.yml)

Open-source, self-hostable platform for **paper trading** prediction market bots.

**Repository:** https://github.com/tyc-aidev/polyagent-oss  
**Live demo (Cloudflare):** https://polyagent-web.steven-tchen-dev.workers.dev PolyAgent connects to the public [Polymarket Gamma API](https://gamma-api.polymarket.com) for market data and simulates trades locally — no wallets, no live execution.

## Features

- Rule-based **ThresholdAgent** for demo and experimentation
- Paper trading simulator with portfolio, P&L, and risk limits
- Web dashboard: market explorer, bot CRUD, tick history, manual runs
- Deploy on **Docker** (self-host) or **Cloudflare Workers** (OpenNext)

## Quick start (Docker)

**Requirements:** Node.js 20+, pnpm 9+, Docker

```bash
git clone <repo-url> polyagent-oss
cd polyagent-oss
cp .env.example .env

# Start PostgreSQL
docker compose up postgres -d

# Install dependencies and migrate
pnpm install
pnpm db:migrate:deploy
pnpm db:seed

# Run the dev server
pnpm dev
```

Open [http://localhost:3000/demo](http://localhost:3000/demo) for the onboarding walkthrough.

### Full stack via Docker Compose

```bash
docker compose up --build
```

The web service runs at [http://localhost:3000](http://localhost:3000) with an in-process scheduler (ticks every 5 minutes).

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | — | PostgreSQL connection string |
| `GAMMA_API_BASE` | `https://gamma-api.polymarket.com` | Polymarket Gamma API base URL |
| `MARKET_CACHE_TTL_SECONDS` | `60` | Gamma response cache TTL |
| `SCHEDULER_MODE` | `docker` | `docker` (in-process) or `cloudflare` (Cron + Queue) |
| `MAX_ACTIVE_BOTS` | `10` | Max concurrently active bots |
| `DASHBOARD_PASSWORD` | — | Optional password gate for public deploys |
| `SESSION_SECRET` | — | HMAC secret for signed session cookies (falls back to `DASHBOARD_PASSWORD`) |
| `CRON_SECRET` | — | Required in production for `/api/internal/*` scheduler routes |

See [`.env.example`](.env.example) for a full template.

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start Next.js dev server |
| `pnpm test` | Run unit tests |
| `pnpm smoke` | End-to-end API smoke test (requires running app) |
| `pnpm smoke:cloudflare` | Verify a Cloudflare deployment |
| `pnpm typecheck` | TypeScript check |
| `pnpm lint` | ESLint |
| `pnpm db:migrate` | Create/apply migrations (dev) |
| `pnpm db:migrate:deploy` | Apply migrations (prod/CI) |
| `pnpm db:seed` | Seed demo bot |

### Smoke test (alpha verification)

With Postgres running, migrations applied, seed complete, and the dev server up:

```bash
pnpm dev          # terminal 1
pnpm smoke        # terminal 2
```

Set `DASHBOARD_PASSWORD` in the environment if auth is enabled. When using `pnpm start` (production mode), the server and smoke client both need the same `CRON_SECRET`.

For Cloudflare:

```bash
SMOKE_BASE_URL=https://your-worker.workers.dev CRON_SECRET=... pnpm smoke:cloudflare
```

## Cloudflare deploy

See [docs/CLOUDFLARE.md](docs/CLOUDFLARE.md) for Prisma Postgres + Hyperdrive setup, KV namespace creation, and CI migration workflow.

## Security

For production deployments, see [docs/SECURITY.md](docs/SECURITY.md).

## Legal

Paper trading only. Not financial advice. See [docs/LEGAL.md](docs/LEGAL.md).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

Apache 2.0 (see LICENSE when published).