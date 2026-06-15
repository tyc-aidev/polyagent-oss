import type {
  AgentDecision,
  AnalysisContext,
  BotConfig,
  IAgent,
} from "@polyagent/shared";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function confidence(price: number, threshold: number): number {
  if (threshold <= 0) return 0;
  return clamp(1 - Math.abs(price - threshold) / threshold, 0, 1);
}

function holdDecision(context: AnalysisContext, reasoning: string): AgentDecision {
  return {
    id: crypto.randomUUID(),
    botId: context.portfolio.botId,
    marketId: context.market.id,
    timestamp: context.timestamp,
    action: "HOLD",
    size: 0,
    price: context.market.yesPrice,
    confidence: 0,
    reasoning,
  };
}

export class ThresholdAgent implements IAgent {
  readonly id = "threshold";
  readonly name = "Threshold Agent";
  readonly version = "0.1.0";

  async analyze(context: AnalysisContext): Promise<AgentDecision[]> {
    const { market, config } = context;
    const params = config.strategy.parameters;

    if (params.minVolume24h && market.volume24h < params.minVolume24h) {
      return [
        holdDecision(
          context,
          `Volume ${market.volume24h} below minimum ${params.minVolume24h}`,
        ),
      ];
    }

    if (params.buyYesBelow !== undefined && market.yesPrice < params.buyYesBelow) {
      const conf = confidence(market.yesPrice, params.buyYesBelow);
      return [
        {
          id: crypto.randomUUID(),
          botId: context.portfolio.botId,
          marketId: market.id,
          timestamp: context.timestamp,
          action: "BUY_YES",
          size: config.risk.maxPositionSize,
          price: market.yesPrice,
          confidence: conf,
          reasoning: `YES price ${market.yesPrice.toFixed(3)} below threshold ${params.buyYesBelow}`,
        },
      ];
    }

    if (params.buyNoBelow !== undefined && market.noPrice < params.buyNoBelow) {
      const conf = confidence(market.noPrice, params.buyNoBelow);
      return [
        {
          id: crypto.randomUUID(),
          botId: context.portfolio.botId,
          marketId: market.id,
          timestamp: context.timestamp,
          action: "BUY_NO",
          size: config.risk.maxPositionSize,
          price: market.noPrice,
          confidence: conf,
          reasoning: `NO price ${market.noPrice.toFixed(3)} below threshold ${params.buyNoBelow}`,
        },
      ];
    }

    return [holdDecision(context, "No threshold conditions matched")];
  }
}

export function createThresholdAgent(_config: BotConfig): IAgent {
  return new ThresholdAgent();
}