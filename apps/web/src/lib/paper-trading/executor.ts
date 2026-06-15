import type { AgentDecision, BotConfig, MarketSnapshot, PaperPosition, PositionSide } from "@polyagent/shared";
import {
  clampBuySize,
  passesConfidence,
  validateBuySize,
  type RiskRejectReason,
} from "./risk";
import {
  createPortfolio,
  findOpenPosition,
  type PortfolioState,
  upsertPosition,
  withCash,
} from "./portfolio";

export type ExecutionRejectReason = RiskRejectReason | "unknown_action" | "market_not_found";

export interface ExecutionRecord {
  decision: AgentDecision;
  executed: boolean;
  reason?: ExecutionRejectReason;
}

function nextPositionId(): string {
  return `pos_${crypto.randomUUID()}`;
}

function buySide(action: AgentDecision["action"]): PositionSide | null {
  if (action === "BUY_YES") return "YES";
  if (action === "BUY_NO") return "NO";
  return null;
}

function addShares(
  portfolio: PortfolioState,
  botId: string,
  marketId: string,
  side: PositionSide,
  usdc: number,
  price: number,
): PortfolioState {
  const shares = usdc / price;
  const existing = findOpenPosition(portfolio, marketId, side);

  if (existing) {
    const size = existing.size + shares;
    const costBasis = existing.costBasis + usdc;
    const updated: PaperPosition = {
      ...existing,
      size,
      avgPrice: costBasis / size,
      costBasis,
    };
    return withCash(upsertPosition(portfolio, updated), portfolio.cashBalance - usdc);
  }

  const created: PaperPosition = {
    id: nextPositionId(),
    botId,
    marketId,
    side,
    size: shares,
    avgPrice: price,
    costBasis: usdc,
    unrealizedPnl: 0,
    realizedPnl: 0,
    status: "open",
  };

  return withCash(upsertPosition(portfolio, created), portfolio.cashBalance - usdc);
}

function sellPosition(
  portfolio: PortfolioState,
  position: PaperPosition,
  price: number,
): PortfolioState {
  const proceeds = position.size * price;
  const closed: PaperPosition = {
    ...position,
    status: "closed",
    unrealizedPnl: 0,
    realizedPnl: position.realizedPnl + (proceeds - position.costBasis),
  };

  return withCash(upsertPosition(portfolio, closed), portfolio.cashBalance + proceeds);
}

export function executeDecision(
  portfolio: PortfolioState,
  decision: AgentDecision,
  market: MarketSnapshot,
  config: BotConfig,
): { portfolio: PortfolioState; record: ExecutionRecord } {
  if (decision.action === "HOLD") {
    return { portfolio, record: { decision, executed: false } };
  }

  if (!passesConfidence(decision, config)) {
    return {
      portfolio,
      record: { decision, executed: false, reason: "below_confidence" },
    };
  }

  const side = buySide(decision.action);
  if (side) {
    const usdc = clampBuySize(decision, portfolio, config);
    const sizeError = validateBuySize(usdc);
    if (sizeError) {
      return { portfolio, record: { decision, executed: false, reason: sizeError } };
    }

    const price = side === "YES" ? market.yesPrice : market.noPrice;
    const next = addShares(portfolio, portfolio.botId, decision.marketId, side, usdc, price);
    return { portfolio: next, record: { decision, executed: true } };
  }

  if (decision.action === "SELL") {
    const yesPosition = findOpenPosition(portfolio, decision.marketId, "YES");
    const noPosition = findOpenPosition(portfolio, decision.marketId, "NO");
    const position = yesPosition ?? noPosition;

    if (!position) {
      return {
        portfolio,
        record: { decision, executed: false, reason: "no_open_position" },
      };
    }

    const price = position.side === "YES" ? market.yesPrice : market.noPrice;
    const next = sellPosition(portfolio, position, price);
    return { portfolio: next, record: { decision, executed: true } };
  }

  return {
    portfolio,
    record: { decision, executed: false, reason: "unknown_action" },
  };
}

export { createPortfolio };