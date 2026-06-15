import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MarketSnapshot } from "@polyagent/shared";

const listMarketsMock = vi.fn();
const getMarketMock = vi.fn();

vi.mock("@/lib/polymarket/gamma", () => ({
  GammaClient: vi.fn().mockImplementation(() => ({
    listMarkets: listMarketsMock,
    getMarket: getMarketMock,
  })),
}));

vi.mock("@/lib/polymarket/cache", () => ({
  MemoryCache: vi.fn(),
}));

const { listMarkets, getMarket } = await import("./markets");

const sampleMarkets: MarketSnapshot[] = [
  {
    id: "1",
    slug: "btc-100k",
    question: "Will Bitcoin hit 100k?",
    yesPrice: 0.6,
    noPrice: 0.4,
    volume24h: 1000,
    liquidity: 500,
    resolved: false,
  },
  {
    id: "2",
    slug: "eth-merge",
    question: "Ethereum upgrade in 2026?",
    yesPrice: 0.3,
    noPrice: 0.7,
    volume24h: 800,
    liquidity: 400,
    resolved: false,
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  listMarketsMock.mockResolvedValue(sampleMarkets);
});

describe("listMarkets", () => {
  it("returns all markets without a query", async () => {
    const markets = await listMarkets(20);
    expect(markets).toHaveLength(2);
  });

  it("filters markets by query string", async () => {
    const markets = await listMarkets(20, "bitcoin");
    expect(markets).toHaveLength(1);
    expect(markets[0]?.slug).toBe("btc-100k");
  });
});

describe("getMarket", () => {
  it("delegates to gamma client", async () => {
    getMarketMock.mockResolvedValue(sampleMarkets[0]);
    const market = await getMarket("1");
    expect(market?.id).toBe("1");
  });
});