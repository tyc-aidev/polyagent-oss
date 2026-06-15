import type { BotConfig, IAgent } from "@polyagent/shared";
import { createThresholdAgent } from "./threshold";

export function createAgent(config: BotConfig): IAgent {
  if (config.strategy.type === "threshold") {
    return createThresholdAgent(config);
  }
  throw new Error(`Unsupported strategy type: ${config.strategy.type}`);
}