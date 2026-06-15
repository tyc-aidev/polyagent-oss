export type BotStatus = "active" | "paused" | "archived";

export interface BotConfig {
  markets: string[];
  risk: {
    maxPositionSize: number;
    confidenceThreshold: number;
    maxDailyLoss?: number;
  };
  strategy: {
    type: "threshold";
    parameters: {
      buyYesBelow?: number;
      buyNoBelow?: number;
      minVolume24h?: number;
    };
  };
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