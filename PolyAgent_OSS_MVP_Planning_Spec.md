# PolyAgent OSS — MVP Planning Specification

**Version**: 0.2  
**Date**: June 9, 2026  
**Status**: Approved for implementation  
**Owner**: Lin Chen (@zenLinChen)

**Companion document**: [PolyAgent_OSS_Architecture_Spec.md](./PolyAgent_OSS_Architecture_Spec.md) (authoritative for technical decisions)

---

## 1. Project Overview

**PolyAgent OSS** is an open-source, self-hostable platform that enables users to create, configure, run, monitor, and iterate on AI-powered bots for analyzing prediction markets such as Polymarket.

**Core Philosophy**:
- Education-first and research-oriented.
- **Paper trading first** — simulation is the core MVP experience, not a placeholder for live trading.
- Pluggable agent architecture from day one (interface defined; implementation minimal in MVP).
- Hybrid stack: fast MVP on Next.js + Cloudflare; Python agent layer in Phase 2.
- Single database (Prisma + PostgreSQL) across all deploy paths.
- Fully self-hostable via Docker Compose.

**Primary Goal of MVP**:
Deliver a demo-ready platform where a user can, within 10 minutes:
1. Browse live Polymarket data
2. Create a bot with risk parameters and a threshold strategy
3. Run it in paper trading mode (manual or scheduled tick)
4. See agent decisions, reasoning, positions, and simulated P&L
5. Self-host locally with `docker compose up` or deploy to Cloudflare

---

## 2. MVP Scope

### In Scope

**Core Features**
- Modern web dashboard (Next.js 15 + shadcn/ui)
- Market explorer (Polymarket Gamma API, cached)
- Bot creation and configuration UI
  - Target markets, risk params, threshold strategy parameters
  - Starting virtual balance (default 10,000 USDC)
- **Paper trading simulator** (core differentiator)
  - Virtual portfolio and position tracking
  - Instant-fill market orders at Gamma mid-price
  - Mark-to-market P&L on each tick
  - Market settlement with 2% fee on winnings
  - Decision logging with full reasoning
- **ThresholdAgent** — rule-based, deterministic, no LLM
- Bot runner with scheduled ticks (every 5 min) + manual trigger
- Monitoring views: decision log, positions, P&L, tick history
- Pre-seeded demo bot (`/demo` onboarding path)
- Self-host via Docker Compose (app + PostgreSQL)
- Cloudflare deploy via OpenNext (Prisma Postgres + Accelerate)
- Legal disclaimers in UI and documentation

**Non-Functional**
- TypeScript throughout
- Prisma schema with migrations and seed script
- `IAgent` interface in `packages/shared` (implemented by ThresholdAgent only)
- Vitest unit tests for simulator and agent (mandatory before alpha)
- Zod validation on all API inputs

### Out of Scope (MVP / v0.1)

| Feature | Target Phase |
|---------|--------------|
| Real-money order execution | Phase 2+ (requires auth, legal review) |
| LLM-based agents | v0.2 |
| LangChain.js | v0.2 |
| Historical replay / backtesting | Phase 1.5 |
| Python service (LangGraph) | Phase 2 |
| Multi-agent orchestration | Phase 2 |
| Wallet connect / user auth | Phase 3 |
| Multi-user / team features | Phase 3 |
| Agent template marketplace | Phase 2 |
| Alerts (Telegram/Discord) | Phase 1.5 |
| On-chain / RWA features | Phase 3+ |
| Production-grade scheduling (>10 bots) | Phase 2 |

---

## 3. Key Priorities (Ordered)

1. **Paper trading simulator** — correct, tested, trustworthy. This is the product.
2. **End-to-end flow** — create bot → tick runs → decisions appear → P&L updates.
3. **Clean interfaces** — `IAgent`, Prisma schema, API contracts stable before UI polish.
4. **Self-host path** — `docker compose up` works on a fresh machine with no Cloudflare account.
5. **Cloudflare deploy path** — documented, one-command, with Prisma Accelerate setup guide.
6. **Demo experience** — pre-seeded bot + `/demo` page so evaluators see value in <5 minutes.

---

## 4. Phased Roadmap

### Phase 1: MVP / v0.1 (Target: 6–8 weeks)

| Week | Milestone |
|------|-----------|
| 1 | Monorepo scaffold, Prisma schema, shared types, Docker Compose, Gamma client |
| 2 | Paper trading simulator + unit tests |
| 3 | ThresholdAgent + bot runner (tick lifecycle) |
| 4 | API routes + bot CRUD |
| 5 | Dashboard UI (markets, bots, bot detail) |
| 6 | Cloudflare deploy, seed script, demo page, docs + disclaimers |
| 7–8 | Alpha testing, bug fixes, public GitHub release |

**Exit criteria**:
- `docker compose up` → migrate → seed → create bot → manual tick → see P&L (documented, reproducible)
- Simulator unit tests pass with 100% coverage on invariants (Architecture Spec §7.4)
- Disclaimer visible on all dashboard pages

### Phase 1.5: Paper Trading+ (Target: 2–3 weeks post-MVP)

- Historical replay using `MarketPriceSnapshot` data captured during MVP ticks
- Simple backtesting UI on bot detail page
- LLMAgent behind `IAgent` (optional OpenAI/Anthropic key)
- Alerts (webhook or in-app)

### Phase 2: Agent Expansion (Target: 4–6 weeks)

- Python service (`services/agent-service/`) with FastAPI + LangGraph
- `RemotePythonAgent` implementing `IAgent`
- Advanced multi-agent workflows
- Agent template gallery

### Phase 3: Growth & Auth

- Wallet connect auth
- Multi-user support with `ownerId` on Bot
- Additional prediction markets
- Community contributions, educational content

---

## 5. Success Metrics

| Metric | Target |
|--------|--------|
| Time to first paper trade (with demo bot) | < 5 minutes |
| Time to create custom bot and see P&L | < 10 minutes |
| Simulator unit test coverage (invariants) | 100% |
| `docker compose up` success rate (fresh clone) | Documented and verified in CI |
| Cloudflare deploy | One-command with setup guide |
| Legal framing | Zero ambiguity: paper-only, educational, disclaimers on every page |
| Community signal (post-release) | ≥1 fork or contribution within 30 days |

---

## 6. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Scope creep on agents | High | High | MVP ships ThresholdAgent only; LLM deferred to v0.2 |
| Cloudflare Worker limits (CPU, bundle size) | Medium | Medium | No LangChain.js in MVP; tick work is lightweight; Queue offloads |
| Prisma + Workers connection issues | Medium | High | Prisma Accelerate required for CF path; documented in setup guide |
| User confusion (paper vs real) | Medium | High | Persistent UI banner; `mode` locked to `paper` in API; no execution code |
| Legal exposure | Low–Medium | High | Education framing; no keys stored; no live execution; lawyer review before Phase 2 |
| Gamma API rate limits / downtime | Medium | Medium | 60s price cache; graceful degradation in UI; retry with backoff |
| Low adoption | Medium | Medium | Demo bot + `/demo` page; excellent self-host README |
| PostgreSQL ops burden for self-hosters | Low | Low | Single `docker compose` command; Postgres is only extra container |

---

## 7. Technology Choices (MVP)

| Concern | Choice |
|---------|--------|
| Frontend + API | Next.js 15 (App Router) + TypeScript + Tailwind + shadcn/ui |
| ORM | Prisma |
| Database | PostgreSQL — Prisma Postgres (Cloudflare) / Docker PostgreSQL (local/self-host) |
| Edge DB access | Prisma Accelerate (Cloudflare deploy only) |
| Deployment (primary) | Cloudflare Workers via OpenNext |
| Self-host | Docker Compose (web + postgres) |
| Market data | Polymarket Gamma API (public, unauthenticated) |
| Market cache | Cloudflare KV (CF) / in-memory (Docker) |
| Agent (MVP) | ThresholdAgent (rule-based) behind `IAgent` |
| Scheduler | Cloudflare Cron + Queues (CF) / node-cron (Docker) |
| Validation | Zod |
| Testing | Vitest (unit + integration) |
| Monorepo | pnpm workspaces |

---

## 8. Implementation Task Breakdown

Tasks are ordered by dependency. Each is sized for a single PR.

### Sprint 0: Foundation (Week 1)

- [ ] **T-001** Initialize pnpm monorepo (`apps/web`, `packages/shared`, `packages/db`)
- [ ] **T-002** Scaffold Next.js 15 with OpenNext + Cloudflare template
- [ ] **T-003** Add shadcn/ui + base dashboard layout with disclaimer banner
- [ ] **T-004** Prisma schema (Bot, PaperPosition, AgentDecision, BotTick, MarketPriceSnapshot) + initial migration
- [ ] **T-005** Docker Compose (postgres + web) + health checks
- [ ] **T-006** Shared types and `IAgent` interface in `packages/shared`
- [ ] **T-007** Gamma API client with cache adapter (KV / in-memory)
- [ ] **T-008** Zod schemas for `BotConfig` and API request validation

### Sprint 1: Simulator (Week 2)

- [ ] **T-009** Portfolio manager (`cash`, positions, cost basis)
- [ ] **T-010** Trade executor (BUY_YES, BUY_NO, SELL, HOLD) per rules §7.2
- [ ] **T-011** P&L calculator (mark-to-market, realized, fees)
- [ ] **T-012** Settlement handler (resolved markets)
- [ ] **T-013** Risk enforcer (maxPositionSize, daily loss, confidence threshold)
- [ ] **T-014** Simulator unit tests (all §7.4 invariants)

### Sprint 2: Agent + Runner (Week 3)

- [ ] **T-015** ThresholdAgent implementation
- [ ] **T-016** ThresholdAgent unit tests
- [ ] **T-017** Bot tick orchestrator (`lib/runner/tick.ts`) + price snapshot capture per market
- [ ] **T-018** Docker scheduler (node-cron adapter)
- [ ] **T-019** Cloudflare scheduler (Cron + Queue adapter)
- [ ] **T-020** Manual tick API (`POST /api/bots/:id/tick`)

### Sprint 3: API (Week 4)

- [ ] **T-021** Bot CRUD routes (`GET/POST/PATCH/DELETE /api/bots`)
- [ ] **T-022** Market routes (`GET /api/markets`, `GET /api/markets/:id`)
- [ ] **T-023** Bot detail routes (decisions, positions, portfolio, ticks)
- [ ] **T-024** Health check route
- [ ] **T-025** API integration tests
- [ ] **T-026** Seed script (demo bot with threshold strategy)

### Sprint 4: UI (Week 5)

- [ ] **T-027** Market explorer page
- [ ] **T-028** Bot list page (status, P&L summary)
- [ ] **T-029** Bot create/edit form
- [ ] **T-030** Bot detail page (portfolio, positions, decision log, tick history)
- [ ] **T-031** Manual "Run Tick" button on bot detail
- [ ] **T-032** `/demo` onboarding page

### Sprint 5: Deploy + Docs (Week 6)

- [ ] **T-033** Wrangler config (Cron, Queue, KV bindings)
- [ ] **T-034** Prisma Accelerate setup guide + migration workflow for Cloudflare CI
- [ ] **T-035** Self-host README (Docker Compose walkthrough)
- [ ] **T-036** Legal disclaimers doc + CONTRIBUTING.md
- [ ] **T-037** Optional `DASHBOARD_PASSWORD` middleware
- [ ] **T-038** CI pipeline (lint, test, typecheck)

### Sprint 6: Alpha + Release (Week 7–8)

- [ ] **T-039** End-to-end smoke test (Docker path)
- [ ] **T-040** Cloudflare deploy verification
- [ ] **T-041** Bug fixes from alpha testing
- [ ] **T-042** Public GitHub release (v0.1.0)

---

## 9. Definition of Done (MVP / v0.1)

MVP is complete when all of the following are true:

1. Fresh clone → `docker compose up` → `pnpm db:migrate` → `pnpm db:seed` → app at `localhost:3000` with demo bot visible.
2. User can create a new bot, select markets, set threshold params, and activate it.
3. Manual tick produces decisions in the UI with reasoning text.
4. Paper portfolio shows correct cash balance, positions, and P&L after ticks.
5. Scheduled ticks run automatically (visible in tick history).
6. Simulator unit tests pass in CI.
7. Disclaimer banner present on all dashboard pages.
8. README covers Docker self-host and Cloudflare deploy.
9. No code path exists for live order execution or private key handling.
10. Archived on GitHub as `v0.1.0`.

---

## 10. Resolved Decisions (formerly open questions)

| Question | Decision |
|----------|----------|
| Database | Prisma + PostgreSQL (not D1) |
| Local database | Docker PostgreSQL via Compose |
| Cloudflare database | Prisma Postgres + Accelerate |
| Auth | Single-tenant; optional `DASHBOARD_PASSWORD` for public deploys |
| MVP agent | ThresholdAgent only (rule-based, no LLM) |
| Historical replay | Phase 1.5 (not MVP) |
| `ownerId` on Bot | Removed until Phase 3 auth |
| LangChain.js | Excluded from MVP (v0.2) |
| Max active bots | 10 per instance |

---

**Document Status**: Approved for implementation. Begin with Sprint 0 (T-001).  
All scope questions resolved — refer to Architecture Spec for technical details.