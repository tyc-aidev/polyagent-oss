# Changelog

All notable changes to PolyAgent OSS are documented here.

## [Unreleased]

### Added

- Alpha catalog (threshold, mean-reversion, momentum, volume-spike, extreme-mispricing) with versioned hypotheses and parameters
- Market feature extraction from stored or imported `MarketPriceSnapshot` bars
- Agent-facing APIs: `/api/alphas`, `/api/markets/:id/{history,features,signals}`, `POST /api/backtests`
- Historical replay backtest engine (paper simulator, no live Gamma calls)
- Alpha Lab dashboard (`/alphas`) for catalog discovery, signal scoring, P&L curve, and trade log
- History import so agents can seed a tape without waiting for bot ticks
- Live `strategy.type = "alpha"` bots: AlphaAgent evaluates the catalog on each tick using stored snapshots plus the live mid (threshold bots unchanged)
- Independent snapshot harvester: 5-minute cron samples top-N / bot / configured markets, dedupes by min interval, and prunes by retention (`POST /api/internal/harvest`)
- Universe scan API (`GET`/`POST /api/alphas/scan`) ranks catalog signals across live or specified markets; `GET /api/alphas` now includes the research playbook
- Parameter sweep (`POST /api/backtests/sweep`) grid-searches a catalog alpha (≤50 combos) and ranks in-sample Sharpe / P&L
- Optional holdout / walk-forward split on `POST /api/backtests` and `/api/backtests/sweep` (`split.mode`) so agents can discard in-sample-only fits
- Pluggable `FeatureSource` interface: env-gated extras on `features.event[sourceId]`; fixture source disabled by default; catalog lists `sources`
- One-shot research compose (`POST /api/alphas/research`): scan the universe, sweep top-N candidates, return paper-bot promote payloads
- `event_threshold` catalog alpha: trade when a numeric `features.event[source][key]` extra clears a threshold (HOLD if the source is off)
- Optional `event` extras on price bars (inline backtests and imported snapshots) so `event_threshold` can be replayed

## [0.1.0] — 2026-06-15

First public alpha release. Paper trading only — no live execution.

### Added

- Next.js dashboard: market explorer, bot CRUD, portfolio, decisions, tick history
- ThresholdAgent (rule-based, no LLM)
- Paper trading simulator with risk limits and P&L tracking
- Bot tick runner with price snapshots and atomic tick transactions
- REST API for bots, markets, portfolio, and scheduler internals
- Docker Compose self-host path with in-process scheduler
- Cloudflare Workers deploy via OpenNext (Cron, Queue, KV cache)
- Prisma + PostgreSQL with seed script and demo bot
- Optional `DASHBOARD_PASSWORD` gate with signed session cookies
- Rate limits, security headers, and request body size caps
- Smoke test (`pnpm smoke`) and Cloudflare verification (`pnpm smoke:cloudflare`)
- CI pipeline (lint, typecheck, test)

### Security

- HMAC-signed session tokens (`SESSION_SECRET`)
- Timing-safe comparison for secrets
- `CRON_SECRET` protection on internal scheduler routes

[0.1.0]: https://github.com/tyc-aidev/polyagent-oss/releases/tag/v0.1.0