import type { PaperPosition } from "@polyagent/shared";
import type { PortfolioState } from "@/lib/paper-trading/portfolio";

export interface PortfolioSummary {
  cashBalance: number;
  startingBalance: number;
  totalPnl: number;
  openPositions: number;
}

export function summarizePortfolio(portfolio: PortfolioState): PortfolioSummary {
  const openValue = portfolio.positions
    .filter((position) => position.status === "open")
    .reduce((sum, position) => sum + position.costBasis + position.unrealizedPnl, 0);

  return {
    cashBalance: portfolio.cashBalance,
    startingBalance: portfolio.startingBalance,
    totalPnl: portfolio.cashBalance + openValue - portfolio.startingBalance,
    openPositions: portfolio.positions.filter((position) => position.status === "open").length,
  };
}

export function summarizeFromPositions(
  cashBalance: number,
  startingBalance: number,
  positions: PaperPosition[],
): PortfolioSummary {
  const open = positions.filter((position) => position.status === "open");
  const openValue = open.reduce(
    (sum, position) => sum + position.costBasis + position.unrealizedPnl,
    0,
  );

  return {
    cashBalance,
    startingBalance,
    totalPnl: cashBalance + openValue - startingBalance,
    openPositions: open.length,
  };
}