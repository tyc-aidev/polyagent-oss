import type { MarketSnapshot, PaperPosition } from "@polyagent/shared";
import { SETTLEMENT_FEE_RATE } from "./constants";
import type { PortfolioState } from "./portfolio";

export function positionMarketValue(position: PaperPosition, market: MarketSnapshot): number {
  const price = position.side === "YES" ? market.yesPrice : market.noPrice;
  return position.size * price;
}

export function markPosition(position: PaperPosition, market: MarketSnapshot): PaperPosition {
  const marketValue = positionMarketValue(position, market);
  return {
    ...position,
    unrealizedPnl: marketValue - position.costBasis,
  };
}

export function portfolioEquity(portfolio: PortfolioState, markets: Map<string, MarketSnapshot>): number {
  const positionsValue = portfolio.positions
    .filter((position) => position.status === "open")
    .reduce((sum, position) => {
      const market = markets.get(position.marketId);
      if (!market) return sum + position.costBasis;
      return sum + positionMarketValue(position, market);
    }, 0);

  return portfolio.cashBalance + positionsValue;
}

export function computeTotalPnl(
  portfolio: PortfolioState,
  markets: Map<string, MarketSnapshot>,
): number {
  return portfolioEquity(portfolio, markets) - portfolio.startingBalance;
}

export function applyTotalPnl(
  portfolio: PortfolioState,
  markets: Map<string, MarketSnapshot>,
): PortfolioState {
  return { ...portfolio, totalPnl: computeTotalPnl(portfolio, markets) };
}

export function settlementProceeds(
  position: PaperPosition,
  market: MarketSnapshot,
): { payout: number; fee: number; profit: number } {
  const won =
    (position.side === "YES" && market.outcome === "YES") ||
    (position.side === "NO" && market.outcome === "NO");

  const payout = won ? position.size : 0;
  const profit = payout - position.costBasis;
  const fee = profit > 0 ? profit * SETTLEMENT_FEE_RATE : 0;

  return { payout, fee, profit };
}