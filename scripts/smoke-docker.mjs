#!/usr/bin/env node
/**
 * Docker-path end-to-end smoke test.
 * Requires a running app at SMOKE_BASE_URL (default http://localhost:3000)
 * with migrated + seeded database.
 */
import { assert, logStep, request } from "./lib/http.mjs";

const BASE_URL = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";
const PASSWORD = process.env.DASHBOARD_PASSWORD ?? "";
const CRON_SECRET = process.env.CRON_SECRET ?? "";

let cookie = "";

async function api(path, options = {}) {
  const headers = { ...options.headers };
  if (cookie) headers.cookie = cookie;
  return request(BASE_URL, path, { ...options, headers });
}

async function loginIfNeeded() {
  if (!PASSWORD) return;
  logStep("Login with dashboard password");
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ password: PASSWORD }),
  });
  assert(loginRes.status === 200, `Login failed (${loginRes.status})`);
  cookie = loginRes.headers.getSetCookie?.()?.[0]?.split(";")[0] ?? "";
  assert(cookie, "Expected session cookie after login");
}

async function main() {
  console.log(`\nPolyAgent Docker smoke test → ${BASE_URL}\n`);

  await loginIfNeeded();

  logStep("Health check");
  {
    const { status, body } = await api("/api/health");
    assert(status === 200, `Health returned ${status}`);
    assert(body?.status === "ok", "Health status not ok");
    assert(body?.database === "connected", "Database not connected");
  }

  logStep("Disclaimer banner on /demo");
  {
    const res = await fetch(`${BASE_URL}/demo`, { headers: cookie ? { cookie } : {} });
    const html = await res.text();
    assert(res.status === 200, `/demo returned ${res.status}`);
    assert(
      html.includes("Paper trading only"),
      "Disclaimer banner text missing from /demo",
    );
  }

  logStep("List markets from Gamma");
  let marketId = null;
  {
    const { status, body } = await api("/api/markets?limit=5");
    assert(status === 200, `Markets returned ${status}`);
    assert(Array.isArray(body?.markets) && body.markets.length > 0, "No markets returned");
    marketId = body.markets[0].id;
  }

  logStep("Demo bot visible");
  let demoBotId = null;
  {
    const { status, body } = await api("/api/bots");
    assert(status === 200, `Bots list returned ${status}`);
    const demo = body?.bots?.find((b) => b.name === "Demo Threshold Bot");
    assert(demo, 'Demo Threshold Bot not found — run "pnpm db:seed"');
    demoBotId = demo.id;
  }

  logStep("Create smoke-test bot");
  let smokeBotId = null;
  {
    const { status, body } = await api("/api/bots", {
      method: "POST",
      body: JSON.stringify({
        name: `Smoke Test Bot ${Date.now()}`,
        config: {
          markets: [marketId],
          risk: { maxPositionSize: 50, confidenceThreshold: 0.3 },
          strategy: { type: "threshold", parameters: { buyYesBelow: 0.99 } },
          mode: "paper",
          updateIntervalMinutes: 5,
          startingBalance: 10_000,
        },
      }),
    });
    assert(status === 201, `Create bot failed (${status}): ${JSON.stringify(body)}`);
    smokeBotId = body.id;
    assert(smokeBotId, "Created bot missing id");
  }

  logStep("Activate smoke-test bot");
  {
    const { status, body } = await api(`/api/bots/${smokeBotId}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "active" }),
    });
    assert(status === 200, `Activate bot failed (${status}): ${JSON.stringify(body)}`);
    assert(body?.status === "active", "Bot not active after patch");
  }

  logStep("Manual tick");
  {
    const { status, body } = await api(`/api/bots/${smokeBotId}/tick`, { method: "POST" });
    assert(status === 200, `Tick failed (${status}): ${JSON.stringify(body)}`);
    assert(body?.tickId, "Tick result missing tickId");
    assert(typeof body.decisionsCount === "number", "Tick result missing decisionsCount");
  }

  logStep("Decisions include reasoning");
  {
    const { status, body } = await api(`/api/bots/${smokeBotId}/decisions?limit=10`);
    assert(status === 200, `Decisions returned ${status}`);
    assert(body?.items?.length > 0, "No decisions recorded after tick");
    const withReasoning = body.items.every(
      (d) => typeof d.reasoning === "string" && d.reasoning.length > 0,
    );
    assert(withReasoning, "Some decisions missing reasoning text");
  }

  logStep("Portfolio has valid cash balance");
  {
    const { status, body } = await api(`/api/bots/${smokeBotId}/portfolio`);
    assert(status === 200, `Portfolio returned ${status}`);
    assert(typeof body?.cashBalance === "number", "Portfolio missing cashBalance");
    assert(body.cashBalance >= 0, "Cash balance negative");
    assert(typeof body?.totalPnl === "number", "Portfolio missing totalPnl");
  }

  logStep("Tick history recorded");
  {
    const { status, body } = await api(`/api/bots/${smokeBotId}/ticks?limit=5`);
    assert(status === 200, `Ticks returned ${status}`);
    assert(body?.items?.length > 0, "No tick history");
    assert(body.items[0].status === "completed", "Latest tick not completed");
  }

  logStep("Scheduler cron endpoint");
  {
    const headers = CRON_SECRET ? { "x-cron-secret": CRON_SECRET } : {};
    const { status, body } = await api("/api/internal/cron", { method: "POST", headers });
    if (status === 401 && !CRON_SECRET) {
      console.log("    (skipped — set CRON_SECRET for production cron auth)");
    } else {
      assert(status === 200, `Cron returned ${status}: ${JSON.stringify(body)}`);
      assert(typeof body?.enqueued === "number", "Cron response missing enqueued count");
    }
  }

  logStep("Demo bot manual tick");
  {
    const { status, body } = await api(`/api/bots/${demoBotId}/tick`, { method: "POST" });
    assert(status === 200, `Demo tick failed (${status}): ${JSON.stringify(body)}`);
  }

  logStep("Cleanup smoke-test bot");
  {
    const { status } = await api(`/api/bots/${smokeBotId}`, {
      method: "DELETE",
    });
    assert(status === 200, `Archive bot failed (${status})`);
  }

  console.log("\n✓ All smoke checks passed\n");
}

main().catch((error) => {
  console.error(`\n✗ Smoke test failed: ${error.message}\n`);
  process.exit(1);
});