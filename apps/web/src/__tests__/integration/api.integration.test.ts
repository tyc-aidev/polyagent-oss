/**
 * HTTP-level API integration tests against a real Postgres database.
 * Skipped when DATABASE_URL is unset (unit test runs remain fast locally).
 *
 * Run in CI after `pnpm db:setup` with the Postgres service URL.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GET as healthGet } from "@/app/api/health/route";
import { GET as botsGet, POST as botsPost } from "@/app/api/bots/route";
import { GET as botGet, PATCH as botPatch, DELETE as botDelete } from "@/app/api/bots/[id]/route";
import { POST as cronPost } from "@/app/api/internal/cron/route";
import { POST as harvestPost } from "@/app/api/internal/harvest/route";
import { POST as loginPost } from "@/app/api/auth/login/route";
import { GET as alphasGet } from "@/app/api/alphas/route";
import { GET as tapesGet } from "@/app/api/alphas/tapes/route";
import { POST as alphasScanPost } from "@/app/api/alphas/scan/route";
import { POST as researchPost } from "@/app/api/alphas/research/route";
import { POST as historyPost } from "@/app/api/markets/[id]/history/route";
import { POST as backtestsPost } from "@/app/api/backtests/route";
import { POST as sweepPost } from "@/app/api/backtests/sweep/route";

const DATABASE_URL = process.env.DATABASE_URL;
const describeIfDb = DATABASE_URL ? describe : describe.skip;

async function readJson<T>(response: Response): Promise<T> {
  return response.json() as Promise<T>;
}

function jsonRequest(url: string, init: RequestInit = {}): Request {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  return new Request(url, { ...init, headers });
}

const validConfig = {
  markets: ["integration-test-market"],
  risk: { maxPositionSize: 100, confidenceThreshold: 0.5 },
  strategy: { type: "threshold" as const, parameters: { buyYesBelow: 0.35 } },
  mode: "paper" as const,
  updateIntervalMinutes: 15,
  startingBalance: 10_000,
};

describeIfDb("API integration (real database)", () => {
  let createdBotId: string | undefined;

  beforeAll(() => {
    process.env.SCHEDULER_MODE ??= "docker";
  });

  afterAll(async () => {
    if (createdBotId) {
      await botDelete(new Request("http://test"), { params: Promise.resolve({ id: createdBotId }) });
    }
  });

  it("GET /api/health returns connected database", async () => {
    const response = await healthGet();
    const body = await readJson<{ database: string }>(response);
    expect(response.status).toBe(200);
    expect(body.database).toBe("connected");
  });

  it("POST /api/bots rejects invalid config with 400", async () => {
    const response = await botsPost(
      jsonRequest("http://test/api/bots", {
        method: "POST",
        body: JSON.stringify({ name: "Bad Bot", config: { ...validConfig, markets: [] } }),
      }),
    );
    expect(response.status).toBe(400);
    const body = await readJson<{ code: string }>(response);
    expect(body.code).toBe("validation_error");
  });

  it("POST /api/bots creates a paused bot", async () => {
    const response = await botsPost(
      jsonRequest("http://test/api/bots", {
        method: "POST",
        body: JSON.stringify({
          name: `Integration Bot ${Date.now()}`,
          config: validConfig,
        }),
      }),
    );
    expect(response.status).toBe(201);
    const body = await readJson<{ id: string; status: string }>(response);
    expect(body.id).toBeTruthy();
    expect(body.status).toBe("paused");
    createdBotId = body.id;
  });

  it("GET /api/bots lists bots including created bot", async () => {
    const response = await botsGet();
    expect(response.status).toBe(200);
    const body = await readJson<{ bots: Array<{ id: string }> }>(response);
    expect(Array.isArray(body.bots)).toBe(true);
    if (createdBotId) {
      expect(body.bots.some((b: { id: string }) => b.id === createdBotId)).toBe(true);
    }
  });

  it("GET /api/bots/:id returns bot detail", async () => {
    if (!createdBotId) return;
    const response = await botGet(new Request("http://test"), {
      params: Promise.resolve({ id: createdBotId }),
    });
    expect(response.status).toBe(200);
    const body = await readJson<{ id: string; portfolio: unknown }>(response);
    expect(body.id).toBe(createdBotId);
    expect(body.portfolio).toBeDefined();
  });

  it("PATCH /api/bots/:id activates bot", async () => {
    if (!createdBotId) return;
    const response = await botPatch(
      jsonRequest(`http://test/api/bots/${createdBotId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "active" }),
      }),
      { params: Promise.resolve({ id: createdBotId }) },
    );
    expect(response.status).toBe(200);
    const body = await readJson<{ status: string }>(response);
    expect(body.status).toBe("active");
  });

  it("POST /api/internal/cron rejects missing secret when CRON_SECRET is set", async () => {
    const previous = process.env.CRON_SECRET;
    process.env.CRON_SECRET = "integration-test-cron-secret";
    try {
      const response = await cronPost(new Request("http://test/api/internal/cron", { method: "POST" }));
      expect(response.status).toBe(401);
    } finally {
      process.env.CRON_SECRET = previous;
    }
  });

  it("POST /api/internal/cron accepts valid secret", async () => {
    const secret = "integration-test-cron-secret";
    process.env.CRON_SECRET = secret;
    const response = await cronPost(
      new Request("http://test/api/internal/cron", {
        method: "POST",
        headers: { "x-cron-secret": secret },
      }),
    );
    expect(response.status).toBe(200);
    const body = await readJson<{ mode: string; harvest?: { considered: number } }>(response);
    expect(body.mode === "cloudflare-queue" || body.mode === "direct").toBe(true);
    expect(body.harvest).toBeDefined();
  });

  it("POST /api/internal/harvest accepts valid secret", async () => {
    const secret = "integration-test-cron-secret";
    process.env.CRON_SECRET = secret;
    const response = await harvestPost(
      new Request("http://test/api/internal/harvest", {
        method: "POST",
        headers: { "x-cron-secret": secret },
      }),
    );
    expect(response.status).toBe(200);
    const body = await readJson<{ harvest: { considered: number; written: number; withEvent: number } }>(
      response,
    );
    expect(typeof body.harvest.considered).toBe("number");
    expect(typeof body.harvest.written).toBe("number");
    expect(typeof body.harvest.withEvent).toBe("number");
  });

  it("POST /api/auth/login returns ok when DASHBOARD_PASSWORD is unset", async () => {
    const previous = process.env.DASHBOARD_PASSWORD;
    delete process.env.DASHBOARD_PASSWORD;
    try {
      const response = await loginPost(
        jsonRequest("http://test/api/auth/login", {
          method: "POST",
          body: JSON.stringify({ password: "anything" }),
        }),
      );
      expect(response.status).toBe(200);
      const body = await readJson<{ ok: boolean }>(response);
      expect(body.ok).toBe(true);
    } finally {
      process.env.DASHBOARD_PASSWORD = previous;
    }
  });

  it("GET /api/alphas returns the research catalog", async () => {
    const response = await alphasGet(new Request("http://test/api/alphas"));
    expect(response.status).toBe(200);
    const body = await readJson<{
      alphas: Array<{ id: string; hypothesis: string }>;
      playbook: Array<{ path: string }>;
      sources: Array<{ id: string; enabled: boolean }>;
    }>(response);
    expect(body.alphas.length).toBeGreaterThanOrEqual(6);
    expect(body.alphas.every((alpha) => alpha.hypothesis.length > 0)).toBe(true);
    expect(body.playbook.some((step) => step.path === "/api/alphas/scan")).toBe(true);
    expect(body.sources.some((source) => source.id === "fixture" && source.enabled === false)).toBe(
      true,
    );
    expect(body.playbook.some((step) => step.path === "/api/alphas/tapes")).toBe(true);
  });

  it("GET /api/alphas/tapes lists imported history and event sources", async () => {
    const marketId = `tape-test-${Date.now()}`;
    const imported = await historyPost(
      jsonRequest(`http://test/api/markets/${marketId}/history`, {
        method: "POST",
        body: JSON.stringify({
          bars: [
            {
              capturedAt: "2026-01-01T00:00:00.000Z",
              yesPrice: 0.4,
              noPrice: 0.6,
              volume24h: 1_000,
              event: { fixture: { favoriteDownBreak: true } },
            },
          ],
        }),
      }),
      { params: Promise.resolve({ id: marketId }) },
    );
    expect(imported.status).toBe(201);

    const response = await tapesGet(new Request("http://test/api/alphas/tapes?hasEvent=1&limit=100"));
    expect(response.status).toBe(200);
    const body = await readJson<{
      tapes: Array<{ marketId: string; hasEvent: boolean; eventSources: string[]; bars: number }>;
    }>(response);
    const tape = body.tapes.find((item) => item.marketId === marketId);
    expect(tape?.hasEvent).toBe(true);
    expect(tape?.eventSources).toContain("fixture");
    expect(tape?.bars).toBeGreaterThan(0);
  });

  it("POST /api/alphas/scan ranks imported history without live Gamma", async () => {
    const marketId = `scan-test-${Date.now()}`;
    const imported = await historyPost(
      jsonRequest(`http://test/api/markets/${marketId}/history`, {
        method: "POST",
        body: JSON.stringify({
          bars: [
            {
              capturedAt: "2026-01-01T00:00:00.000Z",
              yesPrice: 0.18,
              noPrice: 0.82,
              volume24h: 2_500,
            },
          ],
        }),
      }),
      { params: Promise.resolve({ id: marketId }) },
    );
    expect(imported.status).toBe(201);

    const response = await alphasScanPost(
      jsonRequest("http://test/api/alphas/scan", {
        method: "POST",
        body: JSON.stringify({
          marketIds: [marketId],
          alphaIds: ["threshold_yes"],
        }),
      }),
    );
    expect(response.status).toBe(200);
    const body = await readJson<{
      scanned: number;
      opportunities: Array<{ marketId: string; action: string; alphaId: string }>;
    }>(response);
    expect(body.scanned).toBe(1);
    expect(body.opportunities[0]?.marketId).toBe(marketId);
    expect(body.opportunities[0]?.alphaId).toBe("threshold_yes");
    expect(body.opportunities[0]?.action).toBe("BUY_YES");
  });

  it("POST /api/alphas/research composes scan + sweep on imported history", async () => {
    const marketId = `research-test-${Date.now()}`;
    const imported = await historyPost(
      jsonRequest(`http://test/api/markets/${marketId}/history`, {
        method: "POST",
        body: JSON.stringify({
          bars: [0.18, 0.2, 0.55].map((yesPrice, index) => ({
            capturedAt: new Date(Date.UTC(2026, 0, 1, 0, index * 5)).toISOString(),
            yesPrice,
            noPrice: Number((1 - yesPrice).toFixed(4)),
            volume24h: 2_500,
          })),
        }),
      }),
      { params: Promise.resolve({ id: marketId }) },
    );
    expect(imported.status).toBe(201);

    const response = await researchPost(
      jsonRequest("http://test/api/alphas/research", {
        method: "POST",
        body: JSON.stringify({
          marketIds: [marketId],
          alphaIds: ["threshold_yes"],
          top: 1,
          steps: 2,
        }),
      }),
    );
    expect(response.status).toBe(201);
    const body = await readJson<{
      candidates: Array<{
        marketId: string;
        sweep: { winner: { parameters: Record<string, number> } } | null;
        promote: { strategy: { type: string; alphaId: string } };
      }>;
    }>(response);
    expect(body.candidates[0]?.marketId).toBe(marketId);
    expect(body.candidates[0]?.promote.strategy.type).toBe("alpha");
    expect(body.candidates[0]?.promote.strategy.alphaId).toBe("threshold_yes");
    expect(body.candidates[0]?.sweep?.winner).toBeTruthy();
  });

  it("POST /api/bots accepts a catalog alpha strategy", async () => {
    const response = await botsPost(
      jsonRequest("http://test/api/bots", {
        method: "POST",
        body: JSON.stringify({
          name: `Alpha Bot ${Date.now()}`,
          config: {
            ...validConfig,
            strategy: { type: "alpha", alphaId: "mean_reversion", parameters: { residualThreshold: 0.05 } },
          },
        }),
      }),
    );
    expect(response.status).toBe(201);
    const body = await readJson<{ id: string; config: { strategy: { type: string; alphaId?: string } } }>(
      response,
    );
    expect(body.config.strategy.type).toBe("alpha");
    expect(body.config.strategy.alphaId).toBe("mean_reversion");
    if (body.id) {
      await botDelete(new Request("http://test"), { params: Promise.resolve({ id: body.id }) });
    }
  });

  it("POST /api/backtests replays inline bars", async () => {
    const response = await backtestsPost(
      jsonRequest("http://test/api/backtests", {
        method: "POST",
        body: JSON.stringify({
          alphaId: "threshold_yes",
          marketIds: ["integration-test-market"],
          parameters: { buyYesBelow: 0.35 },
          startingBalance: 10_000,
          maxPositionSize: 50,
          bars: [
            {
              marketId: "integration-test-market",
              capturedAt: "2026-01-01T00:00:00.000Z",
              yesPrice: 0.2,
              noPrice: 0.8,
              volume24h: 1_000,
            },
            {
              marketId: "integration-test-market",
              capturedAt: "2026-01-01T00:05:00.000Z",
              yesPrice: 0.5,
              noPrice: 0.5,
              volume24h: 1_000,
            },
          ],
        }),
      }),
    );
    expect(response.status).toBe(201);
    const body = await readJson<{ metrics: { trades: number; ticks: number }; limitations: string[] }>(
      response,
    );
    expect(body.metrics.ticks).toBe(2);
    expect(body.metrics.trades).toBeGreaterThan(0);
    expect(body.limitations.length).toBeGreaterThan(0);
  });

  it("POST /api/backtests/sweep ranks an explicit grid", async () => {
    const response = await sweepPost(
      jsonRequest("http://test/api/backtests/sweep", {
        method: "POST",
        body: JSON.stringify({
          alphaId: "threshold_yes",
          marketIds: ["integration-test-market"],
          grid: { buyYesBelow: [0.15, 0.35] },
          startingBalance: 10_000,
          maxPositionSize: 50,
          bars: [
            {
              marketId: "integration-test-market",
              capturedAt: "2026-01-01T00:00:00.000Z",
              yesPrice: 0.2,
              noPrice: 0.8,
              volume24h: 1_000,
            },
            {
              marketId: "integration-test-market",
              capturedAt: "2026-01-01T00:05:00.000Z",
              yesPrice: 0.5,
              noPrice: 0.5,
              volume24h: 1_000,
            },
          ],
        }),
      }),
    );
    expect(response.status).toBe(201);
    const body = await readJson<{
      combinations: number;
      winner: { parameters: { buyYesBelow: number } };
      results: Array<{ metrics: { trades: number } }>;
    }>(response);
    expect(body.combinations).toBe(2);
    expect(body.winner.parameters.buyYesBelow).toBe(0.35);
    expect(body.results[0]?.metrics.trades).toBeGreaterThan(0);
  });

  it("POST /api/backtests with holdout split returns in/out-of-sample metrics", async () => {
    const prices = [0.2, 0.2, 0.2, 0.2, 0.5, 0.55, 0.55, 0.55];
    const response = await backtestsPost(
      jsonRequest("http://test/api/backtests", {
        method: "POST",
        body: JSON.stringify({
          alphaId: "threshold_yes",
          marketIds: ["integration-test-market"],
          parameters: { buyYesBelow: 0.35 },
          startingBalance: 10_000,
          maxPositionSize: 50,
          split: { mode: "holdout", trainFraction: 0.6 },
          bars: prices.map((yesPrice, index) => ({
            marketId: "integration-test-market",
            capturedAt: new Date(Date.UTC(2026, 0, 1, 0, index * 5)).toISOString(),
            yesPrice,
            noPrice: Number((1 - yesPrice).toFixed(4)),
            volume24h: 1_000,
          })),
        }),
      }),
    );
    expect(response.status).toBe(201);
    const body = await readJson<{
      metrics: { ticks: number };
      split: { mode: string; inSample: { ticks: number }; outOfSample: { ticks: number } };
    }>(response);
    expect(body.metrics.ticks).toBe(8);
    expect(body.split.mode).toBe("holdout");
    expect(body.split.inSample.ticks).toBeGreaterThan(0);
    expect(body.split.outOfSample.ticks).toBeGreaterThan(0);
  });
});