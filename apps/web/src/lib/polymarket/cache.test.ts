import { describe, expect, it, vi } from "vitest";
import { MemoryCache } from "./cache";

describe("MemoryCache", () => {
  it("returns null for missing keys", async () => {
    const cache = new MemoryCache();
    expect(await cache.get("missing")).toBeNull();
  });

  it("stores and retrieves values before TTL expires", async () => {
    const cache = new MemoryCache();
    await cache.set("market:1", { price: 0.42 }, 60);
    expect(await cache.get("market:1")).toEqual({ price: 0.42 });
  });

  it("expires values after TTL", async () => {
    vi.useFakeTimers();
    const cache = new MemoryCache();
    await cache.set("market:1", { price: 0.42 }, 1);
    vi.advanceTimersByTime(1500);
    expect(await cache.get("market:1")).toBeNull();
    vi.useRealTimers();
  });
});