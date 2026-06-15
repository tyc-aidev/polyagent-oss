import type { MarketSnapshot } from "@polyagent/shared";
import type { CacheStore } from "./cache";

const DEFAULT_BASE_URL = "https://gamma-api.polymarket.com";

type GammaMarket = {
  id?: string | number;
  slug?: string;
  question?: string;
  outcomePrices?: string | string[];
  volume?: number | string;
  volume24hr?: number | string;
  liquidity?: number | string;
  liquidityNum?: number | string;
  endDate?: string;
  closed?: boolean;
  resolved?: boolean;
  outcome?: string;
};

export function parseOutcomePrices(raw: GammaMarket["outcomePrices"]): { yes: number; no: number } {
  let prices: string[] = [];
  if (typeof raw === "string") {
    try {
      prices = JSON.parse(raw);
    } catch {
      prices = raw.split(",").map((value) => value.trim());
    }
  } else if (Array.isArray(raw)) {
    prices = raw.map(String);
  }

  const yes = Number(prices[0]);
  const safeYes = Number.isFinite(yes) ? yes : 0.5;
  return { yes: safeYes, no: 1 - safeYes };
}

export function toMarketSnapshot(market: GammaMarket): MarketSnapshot | null {
  if (!market.id || !market.question) return null;

  const { yes, no } = parseOutcomePrices(market.outcomePrices);
  const volume24h = Number(market.volume24hr ?? market.volume ?? 0);
  const liquidity = Number(market.liquidityNum ?? market.liquidity ?? 0);
  const resolved = Boolean(market.resolved ?? market.closed);

  return {
    id: String(market.id),
    slug: market.slug ?? String(market.id),
    question: market.question,
    yesPrice: yes,
    noPrice: no,
    volume24h: Number.isFinite(volume24h) ? volume24h : 0,
    liquidity: Number.isFinite(liquidity) ? liquidity : 0,
    endDate: market.endDate,
    resolved,
    outcome: market.outcome === "Yes" ? "YES" : market.outcome === "No" ? "NO" : undefined,
  };
}

export class GammaClient {
  constructor(
    private cache: CacheStore,
    private baseUrl = process.env.GAMMA_API_BASE ?? DEFAULT_BASE_URL,
    private fetchFn: typeof fetch = fetch,
  ) {}

  async listMarkets(limit = 20): Promise<MarketSnapshot[]> {
    const cacheKey = `gamma:markets:${limit}`;
    const cached = await this.cache.get<MarketSnapshot[]>(cacheKey);
    if (cached) return cached;

    const url = new URL("/markets", this.baseUrl);
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("active", "true");
    url.searchParams.set("closed", "false");

    const response = await this.fetchFn(url.toString());
    if (!response.ok) {
      throw new Error(`Gamma API error: ${response.status}`);
    }

    const data = (await response.json()) as GammaMarket[];
    const markets = data
      .map(toMarketSnapshot)
      .filter((market): market is MarketSnapshot => market !== null);

    const ttl = Number(process.env.MARKET_CACHE_TTL_SECONDS ?? 60);
    await this.cache.set(cacheKey, markets, ttl);
    return markets;
  }

  async getMarket(id: string): Promise<MarketSnapshot | null> {
    const cacheKey = `gamma:market:${id}`;
    const cached = await this.cache.get<MarketSnapshot>(cacheKey);
    if (cached) return cached;

    const response = await this.fetchFn(`${this.baseUrl}/markets/${id}`);
    if (response.status === 404) return null;
    if (!response.ok) {
      throw new Error(`Gamma API error: ${response.status}`);
    }

    const market = toMarketSnapshot((await response.json()) as GammaMarket);
    if (!market) return null;

    const ttl = Number(process.env.MARKET_CACHE_TTL_SECONDS ?? 60);
    await this.cache.set(cacheKey, market, ttl);
    return market;
  }
}