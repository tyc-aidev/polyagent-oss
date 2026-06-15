import { afterEach, describe, expect, it, vi } from "vitest";
import { createSessionToken, verifySessionToken } from "./session";

describe("session tokens", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("creates and verifies a valid token", async () => {
    vi.stubEnv("SESSION_SECRET", "test-secret-key");
    const token = await createSessionToken();
    expect(await verifySessionToken(token)).toBe(true);
  });

  it("rejects tampered tokens", async () => {
    vi.stubEnv("SESSION_SECRET", "test-secret-key");
    const token = await createSessionToken();
    expect(await verifySessionToken(`${token}x`)).toBe(false);
  });

  it("rejects expired tokens", async () => {
    vi.stubEnv("SESSION_SECRET", "test-secret-key");
    vi.useFakeTimers();
    const token = await createSessionToken();
    vi.advanceTimersByTime(8 * 24 * 60 * 60 * 1000);
    expect(await verifySessionToken(token)).toBe(false);
    vi.useRealTimers();
  });
});