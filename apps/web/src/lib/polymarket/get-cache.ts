import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { CacheStore } from "./cache";
import { KvCache } from "./kv-cache";
import { MemoryCache } from "./cache";

let memoryCache: MemoryCache | null = null;

export function getCacheStore(): CacheStore {
  if (process.env.SCHEDULER_MODE === "cloudflare") {
    try {
      const { env } = getCloudflareContext();
      if (env.MARKET_CACHE) {
        return new KvCache(env.MARKET_CACHE);
      }
    } catch {
      // Fall through to in-memory when not on Workers runtime.
    }
  }

  if (!memoryCache) {
    memoryCache = new MemoryCache();
  }
  return memoryCache;
}