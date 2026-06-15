import { afterEach, describe, expect, it, vi } from "vitest";
import { isAuthorizedInternalRequest } from "./auth";

function requestWithSecret(secret?: string): Request {
  const headers = secret ? { "x-cron-secret": secret } : {};
  return new Request("https://example.com/api/internal/cron", {
    method: "POST",
    headers,
  });
}

describe("isAuthorizedInternalRequest", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects requests without a secret when CRON_SECRET is configured", () => {
    vi.stubEnv("CRON_SECRET", "cron-secret");
    expect(isAuthorizedInternalRequest(requestWithSecret())).toBe(false);
  });

  it("accepts requests with the correct secret", () => {
    vi.stubEnv("CRON_SECRET", "cron-secret");
    expect(isAuthorizedInternalRequest(requestWithSecret("cron-secret"))).toBe(true);
  });

  it("rejects requests with the wrong secret", () => {
    vi.stubEnv("CRON_SECRET", "cron-secret");
    expect(isAuthorizedInternalRequest(requestWithSecret("wrong"))).toBe(false);
  });

  it("fails closed for public deploys without CRON_SECRET", () => {
    vi.stubEnv("CRON_SECRET", undefined);
    vi.stubEnv("DASHBOARD_PASSWORD", "dashboard-secret");
    expect(isAuthorizedInternalRequest(requestWithSecret())).toBe(false);
  });

  it("fails closed for cloudflare scheduler mode without CRON_SECRET", () => {
    vi.stubEnv("CRON_SECRET", undefined);
    vi.stubEnv("SCHEDULER_MODE", "cloudflare");
    expect(isAuthorizedInternalRequest(requestWithSecret())).toBe(false);
  });

  it("allows local dev/test without secrets", () => {
    vi.stubEnv("CRON_SECRET", undefined);
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("DASHBOARD_PASSWORD", undefined);
    vi.stubEnv("SCHEDULER_MODE", "docker");
    expect(isAuthorizedInternalRequest(requestWithSecret())).toBe(true);
  });
});