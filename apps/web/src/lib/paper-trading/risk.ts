import type { AgentDecision, BotConfig } from "@polyagent/shared";
import { MIN_ORDER_USDC } from "./constants";
import type { PortfolioState } from "./portfolio";

export type RiskRejectReason =
  | "below_confidence"
  | "below_min_order"
  | "insufficient_cash"
  | "no_open_position";

export function passesConfidence(decision: AgentDecision, config: BotConfig): boolean {
  return decision.confidence >= config.risk.confidenceThreshold;
}

export function clampBuySize(
  decision: AgentDecision,
  portfolio: PortfolioState,
  config: BotConfig,
): number {
  return Math.min(decision.size, config.risk.maxPositionSize, portfolio.cashBalance);
}

export function validateBuySize(size: number): RiskRejectReason | null {
  if (size < MIN_ORDER_USDC) return "below_min_order";
  return null;
}

export function shouldPauseForDailyLoss(
  totalPnl: number,
  dayStartPnl: number,
  config: BotConfig,
): boolean {
  const maxDailyLoss = config.risk.maxDailyLoss;
  if (!maxDailyLoss) return false;
  return totalPnl - dayStartPnl <= -maxDailyLoss;
}