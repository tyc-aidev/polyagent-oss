import type { PaperPortfolio, PaperPosition, PositionSide } from "@polyagent/shared";

export interface PortfolioState extends PaperPortfolio {
  startingBalance: number;
}

export function createPortfolio(botId: string, startingBalance: number): PortfolioState {
  return {
    botId,
    cashBalance: startingBalance,
    startingBalance,
    positions: [],
    totalPnl: 0,
  };
}

export function findOpenPosition(
  portfolio: PortfolioState,
  marketId: string,
  side: PositionSide,
): PaperPosition | undefined {
  return portfolio.positions.find(
    (position) =>
      position.marketId === marketId && position.side === side && position.status === "open",
  );
}

export function upsertPosition(
  portfolio: PortfolioState,
  position: PaperPosition,
): PortfolioState {
  const index = portfolio.positions.findIndex((item) => item.id === position.id);
  const positions =
    index === -1
      ? [...portfolio.positions, position]
      : portfolio.positions.map((item, i) => (i === index ? position : item));

  return { ...portfolio, positions };
}

export function replacePosition(
  portfolio: PortfolioState,
  positionId: string,
  next: PaperPosition,
): PortfolioState {
  return {
    ...portfolio,
    positions: portfolio.positions.map((position) =>
      position.id === positionId ? next : position,
    ),
  };
}

export function withCash(portfolio: PortfolioState, cashBalance: number): PortfolioState {
  return { ...portfolio, cashBalance };
}