import type { BotConfig } from "./bot";
import type { MarketSnapshot } from "./market";

export type AgentAction = "BUY_YES" | "BUY_NO" | "HOLD" | "SELL";

export interface AgentDecision {
  id: string;
  botId: string;
  marketId: string;
  timestamp: Date;
  action: AgentAction;
  size: number;
  price: number;
  confidence: number;
  reasoning: string;
  metadata?: Record<string, unknown>;
}

export type PositionSide = "YES" | "NO";
export type PositionStatus = "open" | "closed" | "settled";

export interface PaperPosition {
  id: string;
  botId: string;
  marketId: string;
  side: PositionSide;
  size: number;
  avgPrice: number;
  costBasis: number;
  unrealizedPnl: number;
  realizedPnl: number;
  status: PositionStatus;
}

export interface PaperPortfolio {
  botId: string;
  cashBalance: number;
  positions: PaperPosition[];
  totalPnl: number;
}

export interface AnalysisContext {
  market: MarketSnapshot;
  portfolio: PaperPortfolio;
  recentDecisions: AgentDecision[];
  config: BotConfig;
  timestamp: Date;
}

export interface IAgent {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  analyze(context: AnalysisContext): Promise<AgentDecision[]>;
  initialize?(): Promise<void>;
  shutdown?(): Promise<void>;
}

export type AgentFactory = (config: BotConfig) => IAgent;