import type { MarketFeatures, PriceBar } from "@polyagent/shared";

export const DEFAULT_FEATURE_LOOKBACK = 5;

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function sampleStdev(values: number[]): number | null {
  if (values.length < 2) return null;
  const avg = mean(values);
  const variance = values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function oneStepReturns(prices: number[]): number[] {
  const returns: number[] = [];
  for (let i = 1; i < prices.length; i += 1) {
    const previous = prices[i - 1];
    const current = prices[i];
    if (previous === undefined || current === undefined || previous <= 0) continue;
    returns.push(current / previous - 1);
  }
  return returns;
}

export function sortBars(bars: PriceBar[]): PriceBar[] {
  return [...bars].sort((a, b) => a.capturedAt.getTime() - b.capturedAt.getTime());
}

export function computeMarketFeatures(
  bars: PriceBar[],
  lookback = DEFAULT_FEATURE_LOOKBACK,
): MarketFeatures | null {
  const sorted = sortBars(bars);
  const last = sorted[sorted.length - 1];
  if (!last) return null;

  const window = sorted.slice(-(lookback + 1));
  const yesPrices = window.map((bar) => bar.yesPrice);
  const volumes = window.map((bar) => bar.volume24h);
  const returns = oneStepReturns(yesPrices);
  const oldest = window[0];
  const lookbackReturn =
    oldest && oldest !== last && oldest.yesPrice > 0 ? last.yesPrice / oldest.yesPrice - 1 : null;

  const volumeStdev = sampleStdev(volumes);
  const volumeMean = mean(volumes);
  const volumeZScore =
    volumeStdev && volumeStdev > 0 ? (last.volume24h - volumeMean) / volumeStdev : null;

  const sma = mean(yesPrices);

  return {
    marketId: last.marketId,
    timestamp: last.capturedAt,
    yesPrice: last.yesPrice,
    noPrice: last.noPrice,
    volume24h: last.volume24h,
    complementaryGap: Math.abs(1 - last.yesPrice - last.noPrice),
    lookbackReturn,
    momentum: returns.length > 0 ? mean(returns) : null,
    volatility: sampleStdev(returns),
    volumeZScore,
    distanceFromFair: last.yesPrice - 0.5,
    meanReversionResidual: yesPrices.length >= 2 ? last.yesPrice - sma : null,
    sampleSize: sorted.length,
    event: last.event,
  };
}
