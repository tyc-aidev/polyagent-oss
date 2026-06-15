import type { AgentDecision, BotConfig, MarketSnapshot } from "@polyagent/shared";
import { executeDecision, type ExecutionRecord } from "./executor";
import { applyTotalPnl, computeTotalPnl, markPosition } from "./pnl";
import type { PortfolioState } from "./portfolio";
import { shouldPauseForDailyLoss } from "./risk";
import { settleResolvedMarkets } from "./settlement";

export interface SimulatorResult {
  portfolio: PortfolioState;
  records: ExecutionRecord[];
  shouldPause: boolean;
}

export function markPortfolioToMarket(
  portfolio: PortfolioState,
  markets: Map<string, MarketSnapshot>,
): PortfolioState {
  const positions = portfolio.positions.map((position) => {
    if (position.status !== "open") return position;
    const market = markets.get(position.marketId);
    return market ? markPosition(position, market) : position;
  });

  return applyTotalPnl({ ...portfolio, positions }, markets);
}

export function runSimulatorTick(
  portfolio: PortfolioState,
  decisions: AgentDecision[],
  markets: Map<string, MarketSnapshot>,
  config: BotConfig,
  dayStartPnl: number,
): SimulatorResult {
  let next = settleResolvedMarkets(portfolio, markets);
  const records: ExecutionRecord[] = [];

  for (const decision of decisions) {
    const market = markets.get(decision.marketId);
    if (!market) {
      records.push({ decision, executed: false, reason: "market_not_found" });
      continue;
    }

    const result = executeDecision(next, decision, market, config);
    next = result.portfolio;
    records.push(result.record);
  }

  next = markPortfolioToMarket(next, markets);
  const shouldPause = shouldPauseForDailyLoss(next.totalPnl, dayStartPnl, config);

  return { portfolio: next, records, shouldPause };
}

export function assertInvariants(
  portfolio: PortfolioState,
  markets: Map<string, MarketSnapshot>,
  config: BotConfig,
): void {
  if (portfolio.cashBalance < 0) {
    throw new Error("Invariant failed: cash balance is negative");
  }

  for (const position of portfolio.positions.filter((item) => item.status === "open")) {
    if (position.costBasis > config.risk.maxPositionSize + 0.0001) {
      throw new Error("Invariant failed: position exceeds maxPositionSize");
    }
  }

  const expectedPnl = computeTotalPnl(portfolio, markets);
  if (Math.abs(portfolio.totalPnl - expectedPnl) > 0.0001) {
    throw new Error("Invariant failed: total P&L mismatch");
  }

  for (const position of portfolio.positions.filter((item) => item.status === "settled")) {
    const market = markets.get(position.marketId);
    if (!market?.resolved) continue;
    const won =
      (position.side === "YES" && market.outcome === "YES") ||
      (position.side === "NO" && market.outcome === "NO");
    const expectedValue = won ? position.size : 0;
    if (position.realizedPnl < -position.costBasis - 0.0001) {
      throw new Error("Invariant failed: settled position payout incorrect");
    }
    if (won && position.realizedPnl + position.costBasis < expectedValue * 0.98 - 0.0001) {
      throw new Error("Invariant failed: settlement fee not applied correctly");
    }
  }
}