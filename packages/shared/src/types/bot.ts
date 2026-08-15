export type BotStatus = "active" | "paused" | "archived";

export interface ThresholdStrategy {
  type: "threshold";
  parameters: {
    buyYesBelow?: number;
    buyNoBelow?: number;
    minVolume24h?: number;
  };
}

export interface AlphaStrategy {
  type: "alpha";
  alphaId: string;
  parameters?: Record<string, number>;
  lookback?: number;
}

export type BotStrategy = ThresholdStrategy | AlphaStrategy;

export interface BotConfig {
  markets: string[];
  risk: {
    maxPositionSize: number;
    confidenceThreshold: number;
    maxDailyLoss?: number;
  };
  strategy: BotStrategy;
  mode: "paper";
  updateIntervalMinutes: number;
  startingBalance: number;
}

export interface Bot {
  id: string;
  name: string;
  config: BotConfig;
  status: BotStatus;
  createdAt: Date;
  updatedAt: Date;
}