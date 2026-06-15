#!/usr/bin/env node
/**
 * Cloudflare deploy verification.
 * Requires SMOKE_BASE_URL (deployed worker URL) and CRON_SECRET.
 */
import { assert, logStep, request } from "./lib/http.mjs";

const BASE_URL = process.env.SMOKE_BASE_URL;
const CRON_SECRET = process.env.CRON_SECRET;
const PASSWORD = process.env.DASHBOARD_PASSWORD ?? "";

if (!BASE_URL) {
  console.error("SMOKE_BASE_URL is required (e.g. https://polyagent-web.<account>.workers.dev)");
  process.exit(1);
}

if (!CRON_SECRET) {
  console.error("CRON_SECRET is required for Cloudflare verification");
  process.exit(1);
}

let cookie = "";

async function api(path, options = {}) {
  const headers = { ...options.headers };
  if (cookie) headers.cookie = cookie;
  return request(BASE_URL, path, { ...options, headers });
}

async function loginIfNeeded() {
  if (!PASSWORD) return;
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ password: PASSWORD }),
  });
  cookie = loginRes.headers.getSetCookie?.()?.[0]?.split(";")[0] ?? "";
  assert(cookie, "Login failed — no session cookie");
}

async function main() {
  console.log(`\nPolyAgent Cloudflare verification → ${BASE_URL}\n`);

  await loginIfNeeded();

  logStep("Health + database");
  {
    const { status, body } = await api("/api/health");
    assert(status === 200, `Health returned ${status}`);
    assert(body?.database === "connected", `Database not connected: ${JSON.stringify(body)}`);
  }

  if (PASSWORD) {
    logStep("Dashboard auth enforced");
    {
      const { status } = await api("/api/bots");
      assert(status === 401, `Expected 401 for unauthenticated /api/bots, got ${status}`);
    }
  }

  logStep("Cron rejects missing secret");
  {
    const { status } = await api("/api/internal/cron", { method: "POST" });
    assert(status === 401, `Expected 401 without cron secret, got ${status}`);
  }

  logStep("Cron rejects invalid secret");
  {
    const { status } = await api("/api/internal/cron", {
      method: "POST",
      headers: { "x-cron-secret": "invalid-secret" },
    });
    assert(status === 401, `Expected 401 for invalid cron secret, got ${status}`);
  }

  logStep("Cron accepts valid secret");
  {
    const { status, body } = await api("/api/internal/cron", {
      method: "POST",
      headers: { "x-cron-secret": CRON_SECRET },
    });
    assert(status === 200, `Cron failed (${status}): ${JSON.stringify(body)}`);
    assert(
      body?.mode === "cloudflare-queue" || body?.mode === "direct",
      "Unexpected scheduler mode",
    );
  }

  logStep("Markets endpoint (KV cache path)");
  {
    const { status, body } = await api("/api/markets?limit=3");
    assert(status === 200, `Markets returned ${status}`);
    assert(Array.isArray(body?.markets), "Markets response malformed");
  }

  logStep("Security headers present");
  {
    const res = await fetch(`${BASE_URL}/`, { headers: cookie ? { cookie } : {} });
    assert(res.headers.get("x-frame-options") === "DENY", "Missing X-Frame-Options");
    assert(res.headers.get("x-content-type-options") === "nosniff", "Missing X-Content-Type-Options");
  }

  logStep("Demo bot exists");
  {
    const { status, body } = await api("/api/bots");
    assert(status === 200, `Bots returned ${status}`);
    const demo = body?.bots?.find((b) => b.name === "Demo Threshold Bot");
    assert(demo, 'Demo bot not found — run migrations + seed against production DB');
  }

  console.log("\n✓ Cloudflare verification passed\n");
}

main().catch((error) => {
  console.error(`\n✗ Cloudflare verification failed: ${error.message}\n`);
  process.exit(1);
});