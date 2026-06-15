import type { MarketSnapshot, PaperPosition } from "@polyagent/shared";
import { settlementProceeds } from "./pnl";
import type { PortfolioState } from "./portfolio";
import { replacePosition, withCash } from "./portfolio";

export function settlePosition(
  portfolio: PortfolioState,
  position: PaperPosition,
  market: MarketSnapshot,
): PortfolioState {
  const { payout, fee, profit } = settlementProceeds(position, market);

  const settled: PaperPosition = {
    ...position,
    status: "settled",
    unrealizedPnl: 0,
    realizedPnl: position.realizedPnl + profit - fee,
  };

  return withCash(
    replacePosition(portfolio, position.id, settled),
    portfolio.cashBalance + payout - fee,
  );
}

export function settleResolvedMarkets(
  portfolio: PortfolioState,
  markets: Map<string, MarketSnapshot>,
): PortfolioState {
  let next = portfolio;

  for (const position of portfolio.positions) {
    if (position.status !== "open") continue;
    const market = markets.get(position.marketId);
    if (!market?.resolved || !market.outcome) continue;
    next = settlePosition(next, position, market);
  }

  return next;
}