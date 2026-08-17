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

export type EventFeatureValue = number | string | boolean | null;

/** Namespaced extras from optional FeatureSources, keyed by source id. */
export type EventFeatureBag = Record<string, Record<string, EventFeatureValue>>;

export interface PriceBar {
  marketId: string;
  capturedAt: Date;
  yesPrice: number;
  noPrice: number;
  volume24h: number;
  /** Optional event-state extras as of this bar (inline tape or imported). */
  event?: EventFeatureBag;
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
  event?: EventFeatureBag;
}

export interface FeatureSourceStatus {
  id: string;
  enabled: boolean;
}

export interface FeatureSourceInput {
  market: {
    id: string;
    slug: string;
    question: string;
    endDate?: string;
  };
  features: MarketFeatures;
}

/**
 * Optional event-state plug-in. Sources must no-op when their env key is unset
 * and must never throw into harvest, ticks, or catalog evaluation.
 */
export interface FeatureSource {
  readonly id: string;
  enabled(): boolean;
  enrich(input: FeatureSourceInput): Promise<Record<string, EventFeatureValue> | null>;
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
  split?: BacktestSplitReport;
}

export type BacktestSplitMode = "holdout" | "walk_forward";

export interface BacktestSplitInput {
  mode: BacktestSplitMode;
  trainFraction?: number;
  folds?: number;
}

export interface WalkForwardFold {
  fold: number;
  trainFrom: Date | null;
  trainTo: Date | null;
  testFrom: Date | null;
  testTo: Date | null;
  inSample: BacktestMetrics;
  outOfSample: BacktestMetrics;
}

export interface BacktestSplitReport {
  mode: BacktestSplitMode;
  trainFraction: number;
  folds?: number;
  inSample: BacktestMetrics;
  outOfSample: BacktestMetrics;
  foldReports?: WalkForwardFold[];
}

export interface AlphaPlaybookStep {
  step: number;
  method: "GET" | "POST";
  path: string;
  purpose: string;
}

export interface AlphaOpportunity {
  marketId: string;
  question: string;
  slug: string;
  yesPrice: number;
  noPrice: number;
  volume24h: number;
  alphaId: string;
  alphaName: string;
  action: AgentAction;
  score: number;
  confidence: number;
  reasoning: string;
  rank: number;
  features: MarketFeatures;
}

export interface AlphaScanReport {
  scanned: number;
  skipped: number;
  lookback: number;
  opportunities: AlphaOpportunity[];
  limitations: string[];
}

export interface SweepComboResult {
  parameters: Record<string, number>;
  metrics: BacktestMetrics;
  score: number;
  inSample?: BacktestMetrics;
  outOfSample?: BacktestMetrics;
}

export interface SweepReport {
  alphaId: string;
  marketIds: string[];
  from: Date | null;
  to: Date | null;
  combinations: number;
  winner: SweepComboResult | null;
  results: SweepComboResult[];
  limitations: string[];
  split?: BacktestSplitReport;
}

export interface AlphaPromoteStrategy {
  type: "alpha";
  alphaId: string;
  parameters: Record<string, number>;
}

export interface AlphaResearchCandidate {
  marketId: string;
  question: string;
  alphaId: string;
  alphaName: string;
  liveSignal: AlphaOpportunity;
  sweep: SweepReport | null;
  skippedReason?: string;
  promote: { strategy: AlphaPromoteStrategy };
}

export interface AlphaResearchReport {
  scan: AlphaScanReport;
  candidates: AlphaResearchCandidate[];
  limitations: string[];
}
