import { describe, expect, it, vi } from "vitest";
import { GammaClient, parseOutcomePrices, toMarketSnapshot } from "./gamma";
import { MemoryCache } from "./cache";

describe("parseOutcomePrices", () => {
  it("parses JSON string prices", () => {
    expect(parseOutcomePrices('["0.35","0.65"]')).toEqual({ yes: 0.35, no: 0.65 });
  });

  it("falls back when prices are missing", () => {
    expect(parseOutcomePrices(undefined)).toEqual({ yes: 0.5, no: 0.5 });
  });
});

describe("toMarketSnapshot", () => {
  it("maps gamma fields into a market snapshot", () => {
    const snapshot = toMarketSnapshot({
      id: "123",
      slug: "will-it-rain",
      question: "Will it rain?",
      outcomePrices: '["0.40","0.60"]',
      volume24hr: 5000,
      liquidityNum: 1200,
    });

    expect(snapshot).toMatchObject({
      id: "123",
      slug: "will-it-rain",
      yesPrice: 0.4,
      noPrice: 0.6,
      volume24h: 5000,
      liquidity: 1200,
      resolved: false,
    });
  });

  it("returns null when required fields are missing", () => {
    expect(toMarketSnapshot({ slug: "incomplete" })).toBeNull();
  });
});

describe("GammaClient", () => {
  it("fetches and caches market lists", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        {
          id: "1",
          question: "Test market?",
          outcomePrices: '["0.25","0.75"]',
          volume24hr: 100,
        },
      ],
    });

    const cache = new MemoryCache();
    const client = new GammaClient(cache, "https://gamma.test", fetchMock);

    const first = await client.listMarkets(5);
    const second = await client.listMarkets(5);

    expect(first).toHaveLength(1);
    expect(first[0]?.yesPrice).toBe(0.25);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(second[0]?.id).toBe("1");
  });

  it("throws on gamma API errors", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500 });
    const client = new GammaClient(new MemoryCache(), "https://gamma.test", fetchMock);

    await expect(client.listMarkets()).rejects.toThrow("Gamma API error: 500");
  });
});