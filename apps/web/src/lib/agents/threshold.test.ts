import type { AnalysisContext, BotConfig, MarketSnapshot } from "@polyagent/shared";
import { describe, expect, it } from "vitest";
import { createPortfolio } from "@/lib/paper-trading/portfolio";
import { ThresholdAgent } from "./threshold";

const config: BotConfig = {
  markets: ["m1"],
  risk: { maxPositionSize: 100, confidenceThreshold: 0.5 },
  strategy: {
    type: "threshold",
    parameters: { buyYesBelow: 0.35, buyNoBelow: 0.35, minVolume24h: 1000 },
  },
  mode: "paper",
  updateIntervalMinutes: 15,
  startingBalance: 10_000,
};

function context(market: Partial<MarketSnapshot> & Pick<MarketSnapshot, "id">): AnalysisContext {
  const snapshot: MarketSnapshot = {
    slug: market.id,
    question: "Test?",
    yesPrice: 0.5,
    noPrice: 0.5,
    volume24h: 5000,
    liquidity: 1000,
    resolved: false,
    ...market,
  };

  return {
    market: snapshot,
    portfolio: createPortfolio("bot-1", 10_000),
    recentDecisions: [],
    config,
    timestamp: new Date("2026-06-10T12:00:00Z"),
  };
}

describe("ThresholdAgent", () => {
  const agent = new ThresholdAgent();

  it("buys YES when price is below buyYesBelow", async () => {
    const decisions = await agent.analyze(context({ id: "m1", yesPrice: 0.3, noPrice: 0.7 }));
    expect(decisions[0]?.action).toBe("BUY_YES");
    expect(decisions[0]?.size).toBe(100);
    expect(decisions[0]?.confidence).toBeGreaterThan(0);
  });

  it("buys NO when no price is below buyNoBelow", async () => {
    const decisions = await agent.analyze(context({ id: "m1", yesPrice: 0.8, noPrice: 0.2 }));
    expect(decisions[0]?.action).toBe("BUY_NO");
  });

  it("holds when volume is too low", async () => {
    const decisions = await agent.analyze(
      context({ id: "m1", yesPrice: 0.2, volume24h: 100 }),
    );
    expect(decisions[0]?.action).toBe("HOLD");
    expect(decisions[0]?.reasoning).toContain("Volume");
  });

  it("holds when no threshold matches", async () => {
    const decisions = await agent.analyze(context({ id: "m1", yesPrice: 0.5, noPrice: 0.5 }));
    expect(decisions[0]?.action).toBe("HOLD");
  });
});