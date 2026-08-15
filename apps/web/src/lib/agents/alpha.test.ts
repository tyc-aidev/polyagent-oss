import type { AnalysisContext, BotConfig, MarketSnapshot, PriceBar } from "@polyagent/shared";
import { describe, expect, it } from "vitest";
import { createPortfolio } from "@/lib/paper-trading/portfolio";
import { AlphaAgent, createAlphaAgent } from "./alpha";

const config: BotConfig = {
  markets: ["m1"],
  risk: { maxPositionSize: 100, confidenceThreshold: 0.5 },
  strategy: {
    type: "alpha",
    alphaId: "threshold_yes",
    parameters: { buyYesBelow: 0.35 },
  },
  mode: "paper",
  updateIntervalMinutes: 15,
  startingBalance: 10_000,
};

function market(overrides: Partial<MarketSnapshot> = {}): MarketSnapshot {
  return {
    id: "m1",
    slug: "m1",
    question: "Test?",
    yesPrice: 0.2,
    noPrice: 0.8,
    volume24h: 2_000,
    liquidity: 1_000,
    resolved: false,
    ...overrides,
  };
}

function context(
  snapshot: MarketSnapshot,
  recentBars?: PriceBar[],
  strategy: BotConfig["strategy"] = config.strategy,
): AnalysisContext {
  return {
    market: snapshot,
    portfolio: createPortfolio("bot-1", 10_000),
    recentDecisions: [],
    config: { ...config, strategy },
    timestamp: new Date("2026-01-01T00:10:00.000Z"),
    recentBars,
  };
}

describe("AlphaAgent", () => {
  it("rejects construction without an alpha strategy", () => {
    expect(
      () =>
        new AlphaAgent({
          ...config,
          strategy: { type: "threshold", parameters: { buyYesBelow: 0.35 } },
        }),
    ).toThrow(/strategy.type = alpha/);
  });

  it("rejects unknown catalog ids", () => {
    expect(() =>
      createAlphaAgent({
        ...config,
        strategy: { type: "alpha", alphaId: "does-not-exist" },
      }),
    ).toThrow(/not found/i);
  });

  it("emits the same BUY_YES the catalog/backtest path would", async () => {
    const agent = new AlphaAgent(config);
    const decisions = await agent.analyze(context(market({ yesPrice: 0.2, noPrice: 0.8 })));
    expect(decisions[0]?.action).toBe("BUY_YES");
    expect(decisions[0]?.size).toBe(100);
    expect(decisions[0]?.metadata).toMatchObject({ alphaId: "threshold_yes" });
  });

  it("uses recent bars so momentum matches the backtest evaluator", async () => {
    const agent = new AlphaAgent({
      ...config,
      strategy: { type: "alpha", alphaId: "momentum", parameters: { momentumThreshold: 0.02 } },
    });
    const bars: PriceBar[] = [
      {
        marketId: "m1",
        capturedAt: new Date("2026-01-01T00:00:00.000Z"),
        yesPrice: 0.4,
        noPrice: 0.6,
        volume24h: 1_000,
      },
      {
        marketId: "m1",
        capturedAt: new Date("2026-01-01T00:05:00.000Z"),
        yesPrice: 0.45,
        noPrice: 0.55,
        volume24h: 1_000,
      },
    ];
    const decisions = await agent.analyze(
      context(market({ yesPrice: 0.55, noPrice: 0.45 }), bars, {
        type: "alpha",
        alphaId: "momentum",
        parameters: { momentumThreshold: 0.02 },
      }),
    );
    expect(decisions[0]?.action).toBe("BUY_YES");
  });

  it("holds when the catalog signal is HOLD", async () => {
    const agent = new AlphaAgent(config);
    const decisions = await agent.analyze(context(market({ yesPrice: 0.6, noPrice: 0.4 })));
    expect(decisions[0]?.action).toBe("HOLD");
  });
});
