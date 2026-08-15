import type { AgentDecision, AlphaSignal, MarketSnapshot, PriceBar } from "@polyagent/shared";

export function barFromSnapshot(market: MarketSnapshot, timestamp: Date): PriceBar {
  return {
    marketId: market.id,
    capturedAt: timestamp,
    yesPrice: market.yesPrice,
    noPrice: market.noPrice,
    volume24h: market.volume24h,
  };
}

export function withCurrentBar(history: PriceBar[], current: PriceBar): PriceBar[] {
  const last = history[history.length - 1];
  if (
    last &&
    last.marketId === current.marketId &&
    last.capturedAt.getTime() === current.capturedAt.getTime()
  ) {
    return [...history.slice(0, -1), current];
  }
  return [...history, current];
}

export function signalToDecision(
  signal: AlphaSignal,
  botId: string,
  size: number,
  yesPrice: number,
): AgentDecision {
  const price = signal.action === "BUY_NO" ? 1 - yesPrice : yesPrice;
  return {
    id: crypto.randomUUID(),
    botId,
    marketId: signal.marketId,
    timestamp: signal.timestamp,
    action: signal.action,
    size: signal.action === "HOLD" ? 0 : size,
    price,
    confidence: signal.confidence,
    reasoning: signal.reasoning,
    metadata: { alphaId: signal.alphaId, score: signal.score },
  };
}
