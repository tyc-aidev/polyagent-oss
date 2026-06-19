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
import { POST as loginPost } from "@/app/api/auth/login/route";

const DATABASE_URL = process.env.DATABASE_URL;
const describeIfDb = DATABASE_URL ? describe : describe.skip;

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
    const body = await response.json();
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
    const body = await response.json();
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
    const body = await response.json();
    expect(body.id).toBeTruthy();
    expect(body.status).toBe("paused");
    createdBotId = body.id;
  });

  it("GET /api/bots lists bots including created bot", async () => {
    const response = await botsGet();
    expect(response.status).toBe(200);
    const body = await response.json();
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
    const body = await response.json();
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
    const body = await response.json();
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
    const body = await response.json();
    expect(body.mode === "cloudflare-queue" || body.mode === "direct").toBe(true);
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
      const body = await response.json();
      expect(body.ok).toBe(true);
    } finally {
      process.env.DASHBOARD_PASSWORD = previous;
    }
  });
});