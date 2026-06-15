import type { MarketSnapshot } from "@polyagent/shared";
import { MemoryCache } from "@/lib/polymarket/cache";
import { GammaClient } from "@/lib/polymarket/gamma";

let gammaClient: GammaClient | null = null;

function getGammaClient(): GammaClient {
  if (!gammaClient) {
    gammaClient = new GammaClient(new MemoryCache());
  }
  return gammaClient;
}

export async function listMarkets(limit = 20, query?: string): Promise<MarketSnapshot[]> {
  const markets = await getGammaClient().listMarkets(limit);
  if (!query) return markets;

  const normalized = query.toLowerCase();
  return markets.filter(
    (market) =>
      market.question.toLowerCase().includes(normalized) ||
      market.slug.toLowerCase().includes(normalized),
  );
}

export async function getMarket(id: string): Promise<MarketSnapshot | null> {
  return getGammaClient().getMarket(id);
}