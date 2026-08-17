# PolyAgent OSS

[![CI](https://github.com/tyc-aidev/polyagent-oss/actions/workflows/ci.yml/badge.svg)](https://github.com/tyc-aidev/polyagent-oss/actions/workflows/ci.yml)

Open-source, self-hostable platform for **paper trading** prediction market bots.

**Repository:** https://github.com/tyc-aidev/polyagent-oss  
**Live demo (Cloudflare):** https://polyagent-web.steven-tchen-dev.workers.dev PolyAgent connects to the public [Polymarket Gamma API](https://gamma-api.polymarket.com) for market data and simulates trades locally — no wallets, no live execution.

## Features

- Rule-based **ThresholdAgent** and catalog **AlphaAgent** for demo and experimentation
- Paper trading simulator with portfolio, P&L, and risk limits
- **Alpha lab**: catalog discovery, market features, and historical replay backtests
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

Open [http://localhost:3000/demo](http://localhost:3000/demo) for the onboarding walkthrough, or [http://localhost:3000/alphas](http://localhost:3000/alphas) to discover catalog alphas and run paper backtests.

### Full stack via Docker Compose

```bash
docker compose up --build
```

The web service runs at [http://localhost:3000](http://localhost:3000) with an in-process scheduler (ticks every 5 minutes).

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | — | Postgres URL (direct or Prisma Accelerate on Workers) |
| `GAMMA_API_BASE` | `https://gamma-api.polymarket.com` | Polymarket Gamma API base URL |
| `MARKET_CACHE_TTL_SECONDS` | `60` | Gamma response cache TTL |
| `SCHEDULER_MODE` | `docker` | `docker` (in-process) or `cloudflare` (Cron + Queue) |
| `MAX_ACTIVE_BOTS` | `10` | Max concurrently active bots |
| `SNAPSHOT_HARVEST_ENABLED` | `true` | Sample Gamma markets on the 5‑minute scheduler |
| `SNAPSHOT_HARVEST_TOP_N` | `20` | Top active Gamma markets to snapshot (0–50) |
| `SNAPSHOT_HARVEST_MARKET_IDS` | — | Extra market IDs to always sample (comma-separated) |
| `SNAPSHOT_HARVEST_MIN_INTERVAL_SECONDS` | `240` | Skip a market if a snapshot is newer than this |
| `SNAPSHOT_RETENTION_DAYS` | `30` | Delete snapshots older than this (0 disables prune) |
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
| `pnpm db:seed` | Seed demo bot (idempotent) |
| `pnpm db:setup` | Migrate + seed (idempotent, for CI/deploy) |
| `pnpm verify:gamma` | Live Polymarket Gamma API check |

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

See [docs/CLOUDFLARE.md](docs/CLOUDFLARE.md) for Prisma Postgres + Accelerate setup (pattern from [interactive-partners](https://github.com/tyc-aidev/interactive-partners)).

Local dev: `cd apps/web && ./scripts/setup-env.sh` → creates `.env.local` from `env.example`.

## Alpha discovery APIs

Agents can list research alphas, inspect market features, import snapshot history, and backtest without live Gamma calls during replay:

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/alphas` | Catalog of versioned, parameterized alphas + research playbook |
| `GET` | `/api/alphas/:id` | Single alpha definition |
| `GET`/`POST` | `/api/alphas/scan` | Rank catalog signals across the live (or specified) universe |
| `GET` | `/api/markets/:id/history` | Stored `MarketPriceSnapshot` bars |
| `POST` | `/api/markets/:id/history` | Import agent-supplied bars |
| `GET` | `/api/markets/:id/features` | Momentum, residual, volume z-score, … |
| `GET` | `/api/markets/:id/signals` | Ranked catalog evaluation on a market |
| `POST` | `/api/backtests` | Replay paper simulator on stored or inline bars |
| `POST` | `/api/backtests/sweep` | Grid-search a catalog alpha's parameters (≤50 combos) |
| `POST` | `/api/internal/harvest` | Sample Gamma mids into `MarketPriceSnapshot` (`CRON_SECRET`) |

Agent loop: `GET /api/alphas` (hypotheses + playbook) → `GET /api/alphas/scan` (where the catalog is firing) → `POST /api/backtests` (replay a candidate) → `POST /api/backtests/sweep` (search published parameter space) → `POST /api/bots` with `strategy.type=alpha`.

`GET /api/alphas/scan` ranks `confidence × |score|` on top-N live Gamma markets (or `marketIds`). Filters: `alphaId`/`alphaIds`, `minConfidence`, `action`, `lookback`, `includeHolds`. `POST` accepts the same body as JSON.

`POST /api/backtests` accepts optional `bars` so an agent can evaluate an alpha on a tape it already holds. If `bars` is omitted, the engine reads snapshots captured during bot ticks (or imported history). Mid-price fills, no book, no slippage — the report always includes data-sourcing limitations.

`POST /api/backtests/sweep` searches `grid` (explicit values) or `steps` (linspace min→max). Omit both to auto-step each published parameter (capped at 50 combinations). Results are ranked by Sharpe, then P&L, then drawdown. Winning params are **in-sample** — re-run `POST /api/backtests` with `winner.parameters` for the full equity curve.

Create a live paper bot with the same evaluator:

```json
{
  "strategy": { "type": "alpha", "alphaId": "momentum", "parameters": { "momentumThreshold": 0.03 } }
}
```

Threshold configs (`strategy.type = "threshold"`) are unchanged.

The 5-minute scheduler also harvests top-N Gamma markets plus any markets on non-archived bots. Cadence defaults to one row per market per ~4 minutes; rows older than 30 days are pruned. At defaults that is about `20 markets × 12/hour × 24 × 30 ≈ 170k` rows/month (~tens of MB). Disable with `SNAPSHOT_HARVEST_ENABLED=false` or seed a tape via `POST /api/markets/:id/history`.

## Security

For production deployments, see [docs/SECURITY.md](docs/SECURITY.md).

## Legal

Paper trading only. Not financial advice. See [docs/LEGAL.md](docs/LEGAL.md).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

Apache 2.0 (see LICENSE when published).