import type { AgentAction } from "./agent";

export interface AlphaParameterSpec {
  name: string;
  description: string;
  minimum: number;
  maximum: number;
  defaultValue: number;
}

export interface AlphaDefinition {
  id: string;
  name: string;
  version: string;
  hypothesis: string;
  description: string;
  tags: string[];
  parameters: AlphaParameterSpec[];
  defaultParameters: Record<string, number>;
}

export interface PriceBar {
  marketId: string;
  capturedAt: Date;
  yesPrice: number;
  noPrice: number;
  volume24h: number;
}

export interface MarketFeatures {
  marketId: string;
  timestamp: Date;
  yesPrice: number;
  noPrice: number;
  volume24h: number;
  complementaryGap: number;
  lookbackReturn: number | null;
  momentum: number | null;
  volatility: number | null;
  volumeZScore: number | null;
  distanceFromFair: number;
  meanReversionResidual: number | null;
  sampleSize: number;
}

export interface AlphaSignal {
  alphaId: string;
  marketId: string;
  timestamp: Date;
  action: AgentAction;
  score: number;
  confidence: number;
  reasoning: string;
}

export interface BacktestMetrics {
  ticks: number;
  trades: number;
  positiveTicks: number;
  hitRate: number;
  startingBalance: number;
  endingEquity: number;
  totalPnl: number;
  maxDrawdown: number;
  sharpe: number | null;
}

export interface BacktestEquityPoint {
  timestamp: Date;
  equity: number;
  cash: number;
  pnl: number;
}

export interface BacktestTrade {
  timestamp: Date;
  marketId: string;
  action: AgentAction;
  size: number;
  price: number;
  executed: boolean;
  reason?: string;
  reasoning: string;
}

export interface BacktestReport {
  alphaId: string;
  parameters: Record<string, number>;
  marketIds: string[];
  from: Date | null;
  to: Date | null;
  metrics: BacktestMetrics;
  equityCurve: BacktestEquityPoint[];
  trades: BacktestTrade[];
  limitations: string[];
}
