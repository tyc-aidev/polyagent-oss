import type { BotConfig, IAgent } from "@polyagent/shared";
import { createAlphaAgent } from "./alpha";
import { createThresholdAgent } from "./threshold";

export function createAgent(config: BotConfig): IAgent {
  if (config.strategy.type === "threshold") {
    return createThresholdAgent(config);
  }
  if (config.strategy.type === "alpha") {
    return createAlphaAgent(config);
  }
  throw new Error(`Unsupported strategy type: ${(config.strategy as { type: string }).type}`);
}