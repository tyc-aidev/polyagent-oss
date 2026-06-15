# PolyAgent OSS — Architectural Specification

**Version**: 0.2  
**Date**: June 9, 2026  
**Status**: Approved for implementation  
**Owner**: Lin Chen (@zenLinChen)

---

## 1. High-Level Architecture

PolyAgent OSS follows a **hybrid architecture** designed for rapid MVP delivery while enabling future high-capability agent expansion.

```
┌─────────────────────────────────────────────────────────────────┐
│                        User Layer                               │
│  • Web Dashboard (Next.js)                                      │
│  • Bot configuration, monitoring, paper trading UI              │
│  • Deployed on Cloudflare (OpenNext) or self-hosted via Docker  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Application Layer (MVP)                       │
│  • Next.js App Router + TypeScript                              │
│  • API routes for bots, markets, runs, scheduler                │
│  • Bot runner (Cron + Queue) behind IAgent interface            │
│  • Paper trading simulator (core MVP feature)                   │
│  • Data: Prisma → PostgreSQL (hosted or Docker)                 │
│  • Cache: optional KV (Cloudflare) or in-memory (Docker)        │
└─────────────────────────────────────────────────────────────────┘
                              │
                (Future - Optional) HTTP / Queue
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              Advanced Agent & Data Service (Phase 2+)           │
│  • Python (FastAPI + LangGraph)                                 │
│  • Multi-agent orchestration, advanced reasoning                │
│  • Backtesting engine, heavy RAG                                │
│  • Deployable independently (Fly.io, Railway, Modal, Docker)    │
│  • Communicates with web layer via clean API                    │
└─────────────────────────────────────────────────────────────────┘
```

**Design Principles**:
- **Decoupled agent layer** — The core platform does not depend on any specific agent implementation.
- **Paper trading first** — Simulation is a first-class, high-quality experience in MVP.
- **Single database everywhere** — Prisma + PostgreSQL for local, self-host, and Cloudflare deploy paths.
- **Self-host friendly** — Docker Compose runs the full stack (app + PostgreSQL).
- **Cloudflare optimized** — One-click deploy via OpenNext; database via Prisma Postgres + Accelerate.
- **Future-proof interfaces** — TypeScript interfaces defined early for agents, decisions, and market data.
- **Single-tenant MVP** — No multi-user auth complexity until post-MVP.

---

## 2. Technology Stack (MVP)

| Layer | Technology | Rationale |
|-------|------------|-----------|
| Frontend + API | Next.js 15 (App Router) + TypeScript | Best DX; strong Cloudflare support via OpenNext |
| UI Components | Tailwind + shadcn/ui | Fast, accessible dashboards |
| ORM | Prisma | Type-safe schema, migrations, single model across all deploy paths |
| Database | PostgreSQL | Prisma Postgres (hosted) for Cloudflare; Docker PostgreSQL for local/self-host |
| Edge DB Access | Prisma Accelerate | Connection pooling for Cloudflare Workers (serverless-safe) |
| Deployment (primary) | Cloudflare Workers (OpenNext) | Edge performance, generous free tier |
| Self-host | Docker Compose (app + PostgreSQL) | Complete local/VPS experience, no Cloudflare dependency |
| Market Data Cache | Cloudflare KV (CF deploy) / in-memory (Docker) | Gamma API response caching; not a source of truth |
| Market Data | Polymarket Gamma API (public, unauthenticated) | Official public market data |
| Agent Interface | Custom TypeScript interfaces (`packages/shared`) | Pluggable by design |
| Agent Implementation (MVP) | Rule-based threshold agent only | No LLM, no external news APIs in v0.1 |
| Bot Scheduler | Cloudflare Cron + Queues (CF) / node-cron in app (Docker) | Periodic bot ticks without persistent processes |
| Testing | Vitest (unit) + Playwright (e2e, post-alpha) | Simulator correctness is critical |
| Future Agents | Python + LangGraph | Best ecosystem for complex multi-agent systems |

**Explicitly excluded from MVP stack**:
- LangChain.js (bundle size risk on Workers; defer to v0.2)
- Cloudflare D1 (replaced by PostgreSQL for portability)
- Wallet connect / Clerk / Auth.js (single-tenant MVP; see §13)
- Polymarket CLOB API / private keys (execution deferred)

---

## 3. Repository Structure

```
polyagent-oss/
├── apps/
│   └── web/                          # Next.js + OpenNext (MVP lives here)
│       ├── app/                      # App Router pages + API routes
│       │   ├── (dashboard)/          # Dashboard layout group
│       │   ├── markets/              # Market explorer
│       │   ├── bots/                 # Bot list, create, detail
│       │   └── api/                  # REST API routes
│       ├── components/               # shadcn + custom UI
│       ├── lib/
│       │   ├── agents/               # Agent registry + ThresholdAgent
│       │   ├── paper-trading/        # Simulator engine
│       │   ├── polymarket/           # Gamma API client
│       │   ├── runner/               # Bot tick orchestration
│       │   └── scheduler/            # Cron/Queue adapters
│       └── wrangler.jsonc            # Cloudflare config
├── packages/
│   ├── shared/                       # Types, IAgent interface, constants
│   └── db/                           # Prisma schema, client, migrations
├── services/
│   └── agent-service/                # Phase 2: Python FastAPI + LangGraph (stub only in MVP)
├── docker-compose.yml                # app + postgres for local/self-host
├── docs/                             # Setup, legal, agent dev guide
└── package.json                      # pnpm workspace root
```

---

## 4. Core Domain Models

TypeScript interfaces in `packages/shared`. Prisma models in `packages/db` mirror these shapes.

```ts
// --- Bot ---

interface Bot {
  id: string;
  name: string;
  config: BotConfig;
  status: 'active' | 'paused' | 'archived';
  createdAt: Date;
  updatedAt: Date;
}

interface BotConfig {
  markets: string[];              // Gamma market IDs or slugs
  risk: {
    maxPositionSize: number;      // max USDC per position
    confidenceThreshold: number;  // 0–1; decisions below this are skipped
    maxDailyLoss?: number;        // USDC; bot auto-pauses if breached
  };
  strategy: {
    type: 'threshold';            // MVP: only 'threshold' supported
    parameters: {
      buyYesBelow?: number;       // e.g. 0.35 — buy YES if price below
      buyNoBelow?: number;        // e.g. 0.35 — buy NO if (1 - yesPrice) below
      minVolume24h?: number;      // optional liquidity filter
    };
  };
  mode: 'paper';                  // MVP: paper only; 'live' reserved for future
  updateIntervalMinutes: number;  // min 5, max 1440
  startingBalance: number;        // virtual USDC for paper trading (default 10_000)
}

// --- Agent Decision ---

interface AgentDecision {
  id: string;
  botId: string;
  marketId: string;
  timestamp: Date;
  action: 'BUY_YES' | 'BUY_NO' | 'HOLD' | 'SELL';
  size: number;                   // USDC notional
  price: number;                  // execution price used by simulator
  confidence: number;             // 0–1
  reasoning: string;
  metadata?: Record<string, unknown>;
}

// --- Paper Trading ---

interface PaperPosition {
  id: string;
  botId: string;
  marketId: string;
  side: 'YES' | 'NO';
  size: number;                   // shares
  avgPrice: number;
  costBasis: number;              // USDC spent
  unrealizedPnl: number;
  realizedPnl: number;
  status: 'open' | 'closed' | 'settled';
}

interface PaperPortfolio {
  botId: string;
  cashBalance: number;            // remaining virtual USDC
  positions: PaperPosition[];
  totalPnl: number;               // realized + unrealized
}

interface BotTick {
  id: string;
  botId: string;
  startedAt: Date;
  completedAt?: Date;
  status: 'pending' | 'running' | 'completed' | 'failed';
  decisionsCount: number;
  error?: string;
}
```

**Note**: No `ownerId` in MVP. Single-tenant instance; multi-user ownership added in Phase 3 with proper auth.

---

## 5. Database Schema (Prisma)

```prisma
// packages/db/prisma/schema.prisma

model Bot {
  id        String   @id @default(cuid())
  name      String
  config    Json     // BotConfig (validated at API layer with Zod)
  status    String   @default("paused") // active | paused | archived
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  positions PaperPosition[]
  decisions AgentDecision[]
  ticks     BotTick[]
}

model PaperPosition {
  id             String   @id @default(cuid())
  botId          String
  bot            Bot      @relation(fields: [botId], references: [id], onDelete: Cascade)
  marketId       String
  side           String   // YES | NO
  size           Float
  avgPrice       Float
  costBasis      Float
  unrealizedPnl  Float    @default(0)
  realizedPnl    Float    @default(0)
  status         String   @default("open") // open | closed | settled
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
}

model AgentDecision {
  id         String   @id @default(cuid())
  botId      String
  bot        Bot      @relation(fields: [botId], references: [id], onDelete: Cascade)
  marketId   String
  action     String   // BUY_YES | BUY_NO | HOLD | SELL
  size       Float
  price      Float
  confidence Float
  reasoning  String
  metadata   Json?
  createdAt  DateTime @default(now())
}

model BotTick {
  id             String    @id @default(cuid())
  botId          String
  bot            Bot       @relation(fields: [botId], references: [id], onDelete: Cascade)
  status         String    @default("pending")
  decisionsCount Int       @default(0)
  error          String?
  startedAt      DateTime  @default(now())
  completedAt    DateTime?

  priceSnapshots MarketPriceSnapshot[]
}

model MarketPriceSnapshot {
  id         String   @id @default(cuid())
  marketId   String
  yesPrice   Float
  noPrice    Float
  volume24h  Float
  capturedAt DateTime @default(now())
  tickId     String?
  tick       BotTick? @relation(fields: [tickId], references: [id], onDelete: SetNull)

  @@index([marketId, capturedAt])
}
```

Recorded automatically during each tick for every market analyzed. Powers Phase 1.5 historical replay without schema changes.

Migrations run via `pnpm db:migrate`. Seed script creates one **active** demo bot (pre-configured threshold strategy, 2–3 markets) for onboarding.

---

## 6. Agent Interface Design

Defined in `packages/shared/src/agents/`. All runner, simulator, and UI code depends on the interface — never on a concrete agent.

```ts
// packages/shared/src/agents/IAgent.ts

export interface MarketSnapshot {
  id: string;
  slug: string;
  question: string;
  yesPrice: number;       // 0–1
  noPrice: number;        // 0–1 (derived: 1 - yesPrice for binary markets)
  volume24h: number;
  liquidity: number;
  endDate?: string;
  resolved: boolean;
  outcome?: 'YES' | 'NO';
}

export interface AnalysisContext {
  market: MarketSnapshot;
  portfolio: PaperPortfolio;
  recentDecisions: AgentDecision[];
  config: BotConfig;
  timestamp: Date;
}

export interface IAgent {
  readonly id: string;
  readonly name: string;
  readonly version: string;

  analyze(context: AnalysisContext): Promise<AgentDecision[]>;

  initialize?(): Promise<void>;
  shutdown?(): Promise<void>;
}

// Agent registry — maps strategy.type → factory
export type AgentFactory = (config: BotConfig) => IAgent;
```

**MVP implementation** (`ThresholdAgent`):
- Pure rule-based; no LLM, no external APIs.
- Reads `config.strategy.parameters` (buyYesBelow, buyNoBelow, minVolume24h).
- Returns `HOLD` when no rule matches or confidence is below `config.risk.confidenceThreshold`.
- Confidence is deterministic: `1 - abs(price - threshold) / threshold`, clamped 0–1.

**Future implementations** (same interface):
- `LLMAgent` (v0.2, LangChain.js or remote call)
- `RemotePythonAgent` (Phase 2, HTTP proxy to Python service)
- Community agents registered via `AgentFactory`

---

## 7. Paper Trading Simulator

Core MVP component. Lives in `apps/web/lib/paper-trading/`.

### 7.1 Responsibilities

- Maintain virtual portfolio per bot (cash + positions).
- Execute simulated trades from `AgentDecision` output.
- Mark-to-market open positions on each tick using live Gamma prices.
- Settle positions when markets resolve.
- Enforce risk limits before executing.
- Log every decision with full reasoning.

### 7.2 Simulation Rules (MVP)

These rules are fixed for v0.1. Documented here so behavior is predictable and testable.

| Rule | MVP Behavior |
|------|--------------|
| **Price source** | Gamma API `outcomePrices` mid-price for YES; NO = `1 - yesPrice` |
| **Order type** | Market order — instant fill at current mid-price |
| **Slippage** | None in MVP |
| **Fees** | 2% on net winnings at settlement (Polymarket taker fee approximation) |
| **Position sizing** | `min(decision.size, maxPositionSize, cashBalance)` |
| **Min order** | 1 USDC; orders below this are rejected |
| **SELL** | Closes entire open position on that market/side at current mid-price |
| **HOLD** | No portfolio change; decision logged only |
| **Mark-to-market** | Recalculated on every bot tick for all open positions |
| **Settlement** | When `market.resolved === true`, position pays $1/share if correct, $0 if wrong; fee applied to profit; position status → `settled` |
| **Daily loss limit** | If realized + unrealized P&L for the day drops below `-maxDailyLoss`, bot auto-pauses |
| **Starting balance** | `config.startingBalance` (default 10,000 USDC); set once at bot creation |

**Deferred to Phase 1.5**: Historical replay / backtesting (replaying past Gamma prices over a date range).

### 7.3 Key Files

```
apps/web/lib/paper-trading/
├── simulator.ts      # Orchestrates: receive decisions → validate → execute → persist
├── portfolio.ts      # Cash/position state management
├── pnl.ts            # Mark-to-market, realized/unrealized P&L, fees
├── risk.ts           # Pre-trade risk checks (size, daily loss, confidence)
└── settlement.ts     # Resolution handling
```

### 7.4 Simulator Invariants (must pass unit tests)

1. Cash balance never goes negative.
2. Position size never exceeds `maxPositionSize`.
3. Every non-HOLD decision produces a persisted `AgentDecision` row.
4. Settled positions have `status: 'settled'` and correct payout.
5. Total P&L = cash + sum(position market value) - startingBalance.

---

## 8. Bot Runner & Scheduling

Bots do not run as persistent processes. The runner executes discrete **ticks** on a schedule.

### 8.1 Tick Lifecycle

```
Scheduler fires → enqueue BotTick → Runner picks up tick
  → For each market in bot.config.markets:
      → Fetch MarketSnapshot (Gamma API, cached)
      → Load PaperPortfolio
      → agent.analyze(context) → AgentDecision[]
      → simulator.execute(decisions)
  → Mark tick completed
```

### 8.2 Scheduler by Deploy Path

| Deploy Path | Scheduler | Tick Execution |
|-------------|-----------|----------------|
| **Cloudflare** | Cron Trigger every 5 min → enqueue active bot IDs to Cloudflare Queue | Queue consumer runs tick per bot |
| **Docker / self-host** | `node-cron` inside Next.js process (or separate worker container) | Direct tick execution |

**MVP limits**:
- Max 10 active bots per instance (configurable via env `MAX_ACTIVE_BOTS`).
- `updateIntervalMinutes` enforced as minimum 5 minutes.
- Concurrent ticks for the same bot are prevented via DB row lock (tick status `running`).

**Error handling**:
- If Gamma API is unreachable during a tick, the tick is marked `failed` with the error message stored on `BotTick.error`. No partial decisions are committed (tick is atomic).
- If the agent throws, same behavior: tick `failed`, bot remains `active` (does not auto-pause unless daily loss limit breached).
- Failed ticks are visible in tick history on the bot detail page.

### 8.3 Key Files

```
apps/web/lib/runner/
├── tick.ts            # Single bot tick orchestration
├── enqueue.ts         # Queue adapter (CF Queue / in-process)
└── scheduler/
    ├── cloudflare.ts  # Cron + Queue consumer
    └── docker.ts      # node-cron adapter
```

### 8.4 Manual Trigger

`POST /api/bots/:id/tick` — runs an immediate tick for testing/demos. Available in MVP.

---

## 9. API Routes

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/markets` | List markets from Gamma (cached, paginated, filterable) |
| GET | `/api/markets/:id` | Single market detail + current prices |
| GET | `/api/bots` | List all bots |
| POST | `/api/bots` | Create bot (validates config with Zod) |
| GET | `/api/bots/:id` | Bot detail + portfolio summary |
| PATCH | `/api/bots/:id` | Update config or status (active/paused/archived) |
| DELETE | `/api/bots/:id` | Archive bot (soft delete) |
| POST | `/api/bots/:id/tick` | Manual tick trigger |
| GET | `/api/bots/:id/decisions` | Paginated decision history |
| GET | `/api/bots/:id/positions` | Current open positions |
| GET | `/api/bots/:id/portfolio` | Cash balance, P&L summary |
| GET | `/api/bots/:id/ticks` | Tick run history |
| GET | `/api/health` | Health check (app + DB connectivity) |
| POST | `/api/internal/cron` | Cloudflare Cron entry: enqueue active bot IDs (protected by `CRON_SECRET`) |
| POST | `/api/internal/queue` | Cloudflare Queue consumer: execute tick for one bot ID |

All routes return JSON. Errors use `{ error: string, code: string }` shape.

Request bodies validated with Zod schemas in `packages/shared`. The API rejects `mode: 'live'` and any `strategy.type` other than `'threshold'` in MVP.

---

## 10. UI Pages

| Route | Purpose |
|-------|---------|
| `/` | Landing + disclaimer + link to dashboard |
| `/markets` | Market explorer (search, filter, price display) |
| `/bots` | Bot list with status badges and P&L summary |
| `/bots/new` | Bot creation form (markets, risk, strategy params) |
| `/bots/:id` | Bot detail: portfolio, positions, decision log, tick history |
| `/bots/:id/edit` | Edit bot config |
| `/demo` | Pre-seeded demo bot walkthrough (onboarding shortcut) |

Persistent disclaimer banner on all dashboard pages: *"Paper trading only. Educational purposes. Not financial advice."*

---

## 11. Data & Storage Strategy

### 11.1 PostgreSQL via Prisma (single source of truth)

All persistent data — bots, positions, decisions, ticks — lives in PostgreSQL accessed through Prisma.

| Environment | Database | Connection |
|-------------|----------|------------|
| **Local dev** | Docker PostgreSQL (`docker compose up postgres`) | `DATABASE_URL=postgresql://polyagent:polyagent@localhost:5432/polyagent` |
| **Cloudflare deploy** | Prisma Postgres (hosted) | `DATABASE_URL` via Prisma Accelerate connection string |
| **Self-host (VPS)** | PostgreSQL in Docker Compose | `DATABASE_URL=postgresql://polyagent:polyagent@postgres:5432/polyagent` |

### 11.2 Prisma Accelerate (Cloudflare only)

Cloudflare Workers cannot hold persistent TCP connections to PostgreSQL. Prisma Accelerate provides:
- Connection pooling (required for serverless)
- Global query caching (optional, useful for read-heavy market data joins)

Setup:
1. Create database on [Prisma Postgres](https://prisma.io/postgres).
2. Enable Accelerate; copy `prisma://accelerate.prisma-data.net/...` connection string.
3. Set as `DATABASE_URL` in Cloudflare Worker secrets.
4. Local and Docker paths use direct `postgresql://` URL (no Accelerate).

### 11.3 Migration Workflow

| Environment | Command | When |
|-------------|---------|------|
| Local dev | `pnpm db:migrate` (alias for `prisma migrate dev`) | After schema changes |
| Docker / VPS | `pnpm db:migrate:deploy` | On container start or in deploy script |
| Cloudflare | `pnpm db:migrate:deploy` | Run from CI/CD before `wrangler deploy` |

Prisma migrations live in `packages/db/prisma/migrations/` and are the single source of schema truth. Never use `db push` in production.

### 11.4 Market Data Cache (ephemeral only)

| Deploy Path | Cache | TTL |
|-------------|-------|-----|
| Cloudflare | KV namespace `MARKET_CACHE` | 60 seconds for prices, 5 min for market metadata |
| Docker | In-memory `Map` with TTL (or optional Redis later) | Same TTLs |

Cache is never written back to PostgreSQL. Gamma API is always the authoritative external source.

### 11.5 Data Flow

```
Web UI ↔ Next.js API routes ↔ Prisma ↔ PostgreSQL
                              ↔ KV / in-memory cache ↔ Gamma API
(Phase 2) ↔ Python Agent Service via HTTP (advanced analyze requests)
```

---

## 12. Deployment & Self-Hosting

### 12.1 Cloudflare Path

```bash
# One-time setup
npm create cloudflare@latest polyagent-web -- --framework=next
# Configure wrangler.jsonc: Cron trigger, Queue, KV binding
# Set secrets: DATABASE_URL (Accelerate), optional KV

# Deploy
pnpm deploy:cloudflare
```

Cron trigger: `*/5 * * * *` (every 5 minutes). Queue consumer bound to same Worker.

### 12.2 Docker Self-Host Path

Docker runs the Next.js app as a **Node.js server** (not Workers runtime). This means:
- Direct `postgresql://` connection to the Compose PostgreSQL container (no Accelerate).
- `node-cron` scheduler runs in-process.
- No Cloudflare KV; in-memory cache adapter used instead.

```yaml
# docker-compose.yml (simplified)
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: polyagent
      POSTGRES_PASSWORD: polyagent
      POSTGRES_DB: polyagent
    volumes:
      - pgdata:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  web:
    build: ./apps/web
    environment:
      DATABASE_URL: postgresql://polyagent:polyagent@postgres:5432/polyagent
      SCHEDULER_MODE: docker
    ports:
      - "3000:3000"
    depends_on:
      postgres:
        condition: service_healthy

volumes:
  pgdata:
```

```bash
docker compose up -d
pnpm db:migrate
pnpm db:seed    # creates demo bot
```

### 12.3 Environment Variables

```env
# Required
DATABASE_URL=postgresql://polyagent:polyagent@localhost:5432/polyagent

# Scheduler
SCHEDULER_MODE=docker          # "docker" | "cloudflare"
MAX_ACTIVE_BOTS=10

# Optional
GAMMA_API_BASE=https://gamma-api.polymarket.com
MARKET_CACHE_TTL_SECONDS=60
DASHBOARD_PASSWORD=            # recommended for public Cloudflare deploys
CRON_SECRET=                   # required for Cloudflare Cron → /api/internal/cron
```

**Not required for MVP**:
- `POLYMARKET_API_KEY` — Gamma API is public; CLOB keys only needed for live execution (deferred).
- `OPENAI_API_KEY` — no LLM agents in MVP.

---

## 13. Authentication (MVP)

**Decision: single-tenant, no user auth in MVP.**

| Deploy Path | Access Control |
|-------------|----------------|
| Docker (local/VPS) | Open access on localhost; document recommendation to put behind reverse proxy for production |
| Cloudflare (demo) | Optional `DASHBOARD_PASSWORD` env var; simple middleware check on all `/bots` and `/api` routes |

**Deferred to Phase 3**:
- Wallet connect (needed when live execution matters)
- Clerk / Auth.js (multi-user)
- Team / org features

---

## 14. Security & Compliance

- Strong, visible disclaimers: educational and research purposes only.
- All bots default to `mode: 'paper'`; no live execution path in MVP code.
- No storage of private keys or CLOB credentials.
- Rate limiting on `/api/markets` (protect Gamma API quota).
- All agent decisions and tick errors logged for auditability.
- `DASHBOARD_PASSWORD` recommended for any public Cloudflare deployment.

---

## 15. Testing Strategy

| Layer | Tool | What to Test |
|-------|------|--------------|
| Paper trading simulator | Vitest unit tests | Fill logic, P&L, settlement, risk limits, invariants (§7.4) |
| ThresholdAgent | Vitest unit tests | Rule matching, confidence calculation, HOLD cases |
| API routes | Vitest integration tests | CRUD bots, manual tick, validation errors |
| Gamma client | Vitest with mocked fetch | Parsing, cache TTL, error handling |
| E2E | Playwright (post-alpha) | Create bot → trigger tick → see decision in UI |

CI runs unit + integration tests on every PR. E2E added before public release.

---

## 16. Integration Points for Future Python Layer

When the Python service is introduced (Phase 2):

- `RemotePythonAgent` implements `IAgent` by calling `POST /analyze` on the Python service.
- Python service owns its own Postgres + pgvector for RAG and heavy backtesting data.
- Paper trading simulator stays in the Next.js app; Python returns decisions only.
- **Phase 1.5** (pre-Python): lightweight historical replay in Next.js — replays price snapshots stored during live ticks. No separate service needed.
- **Phase 2** (Python): advanced backtesting engine with multi-agent analysis and RAG; results displayed in existing UI.
- Deployment is independent; users enable Python service only when needed.

```
apps/web/lib/agents/RemotePythonAgent.ts  →  services/agent-service/
```

---

## 17. Resolved Decisions

| Question | Decision | Rationale |
|----------|----------|-----------|
| Database | Prisma + PostgreSQL everywhere | Portability across Cloudflare, Docker, and VPS; no D1 lock-in |
| Cloudflare DB access | Prisma Accelerate | Serverless-safe connection pooling |
| Auth | Single-tenant, no auth (MVP) | Removes scope; self-host trust boundary is sufficient |
| MVP agent | ThresholdAgent only (rule-based) | No LLM cost/complexity; deterministic and testable |
| Historical replay | Deferred to Phase 1.5 | Live paper trading is sufficient for demo/MVP |
| LangChain.js in MVP | Excluded | Worker bundle size; add in v0.2 behind IAgent |
| Multi-user | Deferred to Phase 3 | No `ownerId` in schema until auth exists |
| Max bots | 10 active per instance | Prevents runaway Cron/Queue costs on Cloudflare |

---

**This document, together with the Planning Spec, is the authoritative foundation for building PolyAgent OSS MVP.**