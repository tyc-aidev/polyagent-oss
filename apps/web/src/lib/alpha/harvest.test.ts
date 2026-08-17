import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MarketSnapshot } from "@polyagent/shared";

const mockPrisma = {
  bot: { findMany: vi.fn() },
  marketPriceSnapshot: {
    findMany: vi.fn(),
    createMany: vi.fn(),
    deleteMany: vi.fn(),
  },
};

const listMarkets = vi.fn();
const getMarket = vi.fn();
const enrichMarketFeatures = vi.fn(async (_market: unknown, features: unknown) => features);

vi.mock("@/lib/db", () => ({
  getPrismaAsync: vi.fn(async () => mockPrisma),
}));

vi.mock("@/lib/polymarket/get-cache", () => ({
  getCacheStore: vi.fn(),
}));

vi.mock("@/lib/polymarket/gamma", () => ({
  GammaClient: vi.fn().mockImplementation(() => ({
    listMarkets,
    getMarket,
  })),
}));

vi.mock("@/lib/alpha/sources/registry", () => ({
  enrichMarketFeatures: (market: unknown, features: unknown) => enrichMarketFeatures(market, features),
}));

const { collectHarvestMarketIds, harvestMarketSnapshots } = await import("./harvest");

function market(id: string, overrides: Partial<MarketSnapshot> = {}): MarketSnapshot {
  return {
    id,
    slug: id,
    question: `${id}?`,
    yesPrice: 0.4,
    noPrice: 0.6,
    volume24h: 1_000,
    liquidity: 500,
    resolved: false,
    ...overrides,
  };
}

describe("collectHarvestMarketIds", () => {
  it("unions listed, extra, and bot markets with an extra cap", async () => {
    const ids = await collectHarvestMarketIds(
      [market("a"), market("b")],
      ["c", "d", "e"],
      ["b", "f"],
      2,
    );
    expect(ids).toEqual(["a", "b", "c", "d"]);
  });
});

describe("harvestMarketSnapshots", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.stubEnv("SNAPSHOT_HARVEST_ENABLED", "true");
    vi.stubEnv("SNAPSHOT_HARVEST_TOP_N", "2");
    vi.stubEnv("SNAPSHOT_HARVEST_MIN_INTERVAL_SECONDS", "240");
    vi.stubEnv("SNAPSHOT_RETENTION_DAYS", "30");
    mockPrisma.bot.findMany.mockResolvedValue([]);
    mockPrisma.marketPriceSnapshot.findMany.mockResolvedValue([]);
    mockPrisma.marketPriceSnapshot.createMany.mockResolvedValue({ count: 2 });
    mockPrisma.marketPriceSnapshot.deleteMany.mockResolvedValue({ count: 0 });
    listMarkets.mockResolvedValue([market("m1"), market("m2")]);
    enrichMarketFeatures.mockImplementation(async (_market: unknown, features: unknown) => features);
  });

  it("writes snapshots for listed markets when none are fresh", async () => {
    const result = await harvestMarketSnapshots();
    expect(result.considered).toBe(2);
    expect(result.written).toBe(2);
    expect(result.skippedFresh).toBe(0);
    expect(mockPrisma.marketPriceSnapshot.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ marketId: "m1", yesPrice: 0.4 }),
        expect.objectContaining({ marketId: "m2" }),
      ]),
    });
  });

  it("skips markets harvested inside the min interval", async () => {
    mockPrisma.marketPriceSnapshot.findMany.mockResolvedValue([{ marketId: "m1" }]);
    mockPrisma.marketPriceSnapshot.createMany.mockResolvedValue({ count: 1 });

    const result = await harvestMarketSnapshots();
    expect(result.skippedFresh).toBe(1);
    expect(result.written).toBe(1);
    const written = mockPrisma.marketPriceSnapshot.createMany.mock.calls[0]?.[0]?.data as Array<{
      marketId: string;
    }>;
    expect(written.map((row) => row.marketId)).toEqual(["m2"]);
  });

  it("includes configured extra ids and bot markets via getMarket", async () => {
    vi.stubEnv("SNAPSHOT_HARVEST_MARKET_IDS", "extra-1");
    mockPrisma.bot.findMany.mockResolvedValue([{ config: { markets: ["bot-m"] } }]);
    getMarket.mockImplementation(async (id: string) => market(id, { yesPrice: 0.2, noPrice: 0.8 }));
    mockPrisma.marketPriceSnapshot.createMany.mockResolvedValue({ count: 4 });

    const result = await harvestMarketSnapshots();
    expect(result.considered).toBe(4);
    expect(getMarket).toHaveBeenCalledWith("extra-1");
    expect(getMarket).toHaveBeenCalledWith("bot-m");
  });

  it("skips resolved markets and counts Gamma failures", async () => {
    listMarkets.mockResolvedValue([market("live"), market("done", { resolved: true })]);
    vi.stubEnv("SNAPSHOT_HARVEST_MARKET_IDS", "missing");
    getMarket.mockResolvedValue(null);
    mockPrisma.marketPriceSnapshot.createMany.mockResolvedValue({ count: 1 });

    const result = await harvestMarketSnapshots();
    expect(result.skippedResolved).toBe(1);
    expect(result.errors).toBe(1);
    expect(result.written).toBe(1);
  });

  it("prunes rows older than the retention window", async () => {
    mockPrisma.marketPriceSnapshot.deleteMany.mockResolvedValue({ count: 9 });
    const result = await harvestMarketSnapshots();
    expect(result.pruned).toBe(9);
    expect(mockPrisma.marketPriceSnapshot.deleteMany).toHaveBeenCalled();
  });

  it("persists FeatureSource extras on the snapshot when a source is enabled", async () => {
    enrichMarketFeatures.mockImplementation(async (snap: unknown, features: unknown) => ({
      ...(features as object),
      event:
        snap && typeof snap === "object" && "id" in snap && snap.id === "m1"
          ? { fixture: { favoriteDownBreak: true } }
          : undefined,
    }));

    const result = await harvestMarketSnapshots();
    expect(result.withEvent).toBe(1);
    const written = mockPrisma.marketPriceSnapshot.createMany.mock.calls[0]?.[0]?.data as Array<{
      marketId: string;
      event?: unknown;
    }>;
    expect(written.find((row) => row.marketId === "m1")?.event).toEqual({
      fixture: { favoriteDownBreak: true },
    });
    expect(written.find((row) => row.marketId === "m2")?.event).toBeUndefined();
  });

  it("still writes the price row when enrich throws", async () => {
    enrichMarketFeatures.mockRejectedValue(new Error("source down"));
    const result = await harvestMarketSnapshots();
    expect(result.written).toBe(2);
    expect(result.withEvent).toBe(0);
    expect(result.errors).toBe(0);
  });

  it("no-ops when harvest is disabled", async () => {
    vi.stubEnv("SNAPSHOT_HARVEST_ENABLED", "false");
    const result = await harvestMarketSnapshots();
    expect(result.considered).toBe(0);
    expect(listMarkets).not.toHaveBeenCalled();
    expect(mockPrisma.marketPriceSnapshot.createMany).not.toHaveBeenCalled();
  });
});
