# Changelog

All notable changes to PolyAgent OSS are documented here.

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

[0.1.0]: https://github.com/polyagent-oss/polyagent/releases/tag/v0.1.0