import { describe, expect, it, vi } from "vitest";
import { kvRateLimit, rateLimit } from "./rate-limit";

describe("rateLimit", () => {
  it("allows requests within the limit", () => {
    expect(rateLimit("test-key", 3, 60_000)).toBe(true);
    expect(rateLimit("test-key", 3, 60_000)).toBe(true);
    expect(rateLimit("test-key", 3, 60_000)).toBe(true);
  });

  it("blocks requests over the limit", () => {
    expect(rateLimit("blocked-key", 2, 60_000)).toBe(true);
    expect(rateLimit("blocked-key", 2, 60_000)).toBe(true);
    expect(rateLimit("blocked-key", 2, 60_000)).toBe(false);
  });
});

describe("kvRateLimit", () => {
  it("stores counters in KV and blocks over the limit", async () => {
    const store = new Map<string, string>();
    const kv = {
      get: vi.fn(async (key: string) => {
        const raw = store.get(key);
        return raw ? (JSON.parse(raw) as { count: number; resetAt: number }) : null;
      }),
      put: vi.fn(async (key: string, value: string) => {
        store.set(key, value);
      }),
    } as unknown as KVNamespace;

    expect(await kvRateLimit(kv, "login:1.1.1.1", 2, 60_000)).toBe(true);
    expect(await kvRateLimit(kv, "login:1.1.1.1", 2, 60_000)).toBe(true);
    expect(await kvRateLimit(kv, "login:1.1.1.1", 2, 60_000)).toBe(false);
    expect(kv.put).toHaveBeenCalled();
  });
});