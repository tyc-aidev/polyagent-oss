import type { AgentDecision, AnalysisContext, BotConfig, IAgent } from "@polyagent/shared";
import { evaluateAlpha, getAlpha } from "@/lib/alpha/catalog";
import { barFromSnapshot, signalToDecision, withCurrentBar } from "@/lib/alpha/decisions";
import { computeMarketFeatures, DEFAULT_FEATURE_LOOKBACK } from "@/lib/alpha/features";

export class AlphaAgent implements IAgent {
  readonly id = "alpha";
  readonly name = "Catalog Alpha Agent";
  readonly version = "1.0.0";

  constructor(private readonly botConfig: BotConfig) {
    if (botConfig.strategy.type !== "alpha") {
      throw new Error("AlphaAgent requires strategy.type = alpha");
    }
    if (!getAlpha(botConfig.strategy.alphaId)) {
      throw new Error(`Alpha not found: ${botConfig.strategy.alphaId}`);
    }
  }

  async analyze(context: AnalysisContext): Promise<AgentDecision[]> {
    const strategy = context.config.strategy;
    if (strategy.type !== "alpha") {
      return [this.hold(context, "AlphaAgent requires strategy.type = alpha")];
    }

    const lookback = strategy.lookback ?? DEFAULT_FEATURE_LOOKBACK;
    const current = barFromSnapshot(context.market, context.timestamp);
    const bars = withCurrentBar(context.recentBars ?? [], current);
    const features = computeMarketFeatures(bars, lookback);
    if (!features) {
      return [this.hold(context, "No market features available")];
    }

    const signal = evaluateAlpha(strategy.alphaId, features, strategy.parameters);
    return [
      signalToDecision(signal, context.portfolio.botId, context.config.risk.maxPositionSize, features.yesPrice),
    ];
  }

  private hold(context: AnalysisContext, reasoning: string): AgentDecision {
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
}

export function createAlphaAgent(config: BotConfig): IAgent {
  return new AlphaAgent(config);
}
