import type { PaperPosition as DbPosition } from "@polyagent/db";
import type { PaperPosition, PositionSide, PositionStatus } from "@polyagent/shared";
import { createPortfolio, type PortfolioState } from "@/lib/paper-trading/portfolio";
import type { StoredBotConfig } from "./bot-config";
import { getCashBalance } from "./bot-config";

function toPosition(row: DbPosition): PaperPosition {
  return {
    id: row.id,
    botId: row.botId,
    marketId: row.marketId,
    side: row.side as PositionSide,
    size: row.size,
    avgPrice: row.avgPrice,
    costBasis: row.costBasis,
    unrealizedPnl: row.unrealizedPnl,
    realizedPnl: row.realizedPnl,
    status: row.status as PositionStatus,
  };
}

export function portfolioFromDb(
  botId: string,
  config: StoredBotConfig,
  rows: DbPosition[],
): PortfolioState {
  const portfolio = createPortfolio(botId, config.startingBalance);
  portfolio.cashBalance = getCashBalance(config);
  portfolio.positions = rows.map(toPosition);
  return portfolio;
}