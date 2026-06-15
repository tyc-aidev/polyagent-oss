import { describe, expect, it, vi } from "vitest";
import { KvCache } from "./kv-cache";

describe("KvCache", () => {
  it("reads and writes via KV namespace", async () => {
    const store = new Map<string, string>();
    const kv = {
      get: vi.fn(async (key: string, type: string) => {
        const raw = store.get(key);
        if (!raw) return null;
        return type === "json" ? JSON.parse(raw) : raw;
      }),
      put: vi.fn(async (key: string, value: string) => {
        store.set(key, value);
      }),
    } as unknown as KVNamespace;

    const cache = new KvCache(kv);
    await cache.set("gamma:markets:20", [{ id: "1" }], 60);
    expect(await cache.get("gamma:markets:20")).toEqual([{ id: "1" }]);
  });
});