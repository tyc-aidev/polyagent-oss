import type { AlphaDefinition, AlphaSignal, MarketFeatures, MarketSnapshot } from "@polyagent/shared";
import { evaluateCatalog, getAlpha, listAlphas } from "@/lib/alpha/catalog";
import { computeMarketFeatures, DEFAULT_FEATURE_LOOKBACK } from "@/lib/alpha/features";
import { listMarketHistory } from "@/lib/alpha/snapshots";
import { getMarket } from "./markets";

export function listAlphaCatalog(): AlphaDefinition[] {
  return listAlphas();
}

export function getAlphaDefinition(id: string): AlphaDefinition {
  const alpha = getAlpha(id);
  if (!alpha) {
    throw new Error(`Alpha not found: ${id}`);
  }
  return alpha;
}

function liveBarFromSnapshot(market: MarketSnapshot, timestamp = new Date()) {
  return {
    marketId: market.id,
    capturedAt: timestamp,
    yesPrice: market.yesPrice,
    noPrice: market.noPrice,
    volume24h: market.volume24h,
  };
}

export async function getMarketFeatures(
  marketId: string,
  lookback = DEFAULT_FEATURE_LOOKBACK,
  includeLive = true,
): Promise<{ features: MarketFeatures; live: boolean; historySize: number }> {
  const history = await listMarketHistory(marketId, { limit: Math.max(lookback + 1, 50) });
  let live = false;

  if (includeLive) {
    const market = await getMarket(marketId);
    if (market) {
      history.push(liveBarFromSnapshot(market));
      live = true;
    }
  }

  const features = computeMarketFeatures(history, lookback);
  if (!features) {
    throw new Error(`No price history for market ${marketId}`);
  }

  return { features, live, historySize: history.length };
}

export async function getMarketSignals(
  marketId: string,
  lookback = DEFAULT_FEATURE_LOOKBACK,
): Promise<{ features: MarketFeatures; signals: AlphaSignal[]; live: boolean; historySize: number }> {
  const { features, live, historySize } = await getMarketFeatures(marketId, lookback, true);
  return {
    features,
    signals: evaluateCatalog(features),
    live,
    historySize,
  };
}
