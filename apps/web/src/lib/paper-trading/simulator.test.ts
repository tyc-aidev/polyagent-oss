import type { AgentDecision, BotConfig, MarketSnapshot } from "@polyagent/shared";
import { describe, expect, it } from "vitest";
import { createPortfolio } from "./portfolio";
import {
  assertInvariants,
  markPortfolioToMarket,
  runSimulatorTick,
} from "./simulator";

const BOT_ID = "bot-1";

const baseConfig: BotConfig = {
  markets: ["m1"],
  risk: { maxPositionSize: 100, confidenceThreshold: 0.5, maxDailyLoss: 50 },
  strategy: { type: "threshold", parameters: { buyYesBelow: 0.35 } },
  mode: "paper",
  updateIntervalMinutes: 15,
  startingBalance: 10_000,
};

function market(
  id: string,
  yesPrice: number,
  options: Partial<MarketSnapshot> = {},
): MarketSnapshot {
  return {
    id,
    slug: id,
    question: "Test market?",
    yesPrice,
    noPrice: 1 - yesPrice,
    volume24h: 5000,
    liquidity: 1000,
    resolved: false,
    ...options,
  };
}

function decision(overrides: Partial<AgentDecision> & Pick<AgentDecision, "action">): AgentDecision {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    botId: BOT_ID,
    marketId: overrides.marketId ?? "m1",
    timestamp: overrides.timestamp ?? new Date(),
    size: overrides.size ?? 100,
    price: overrides.price ?? 0.4,
    confidence: overrides.confidence ?? 0.8,
    reasoning: overrides.reasoning ?? "test",
    ...overrides,
  };
}

function marketsMap(...items: MarketSnapshot[]): Map<string, MarketSnapshot> {
  return new Map(items.map((item) => [item.id, item]));
}

describe("paper trading simulator", () => {
  it("buys YES shares and reduces cash", () => {
    const portfolio = createPortfolio(BOT_ID, 10_000);
    const result = runSimulatorTick(
      portfolio,
      [decision({ action: "BUY_YES", size: 100, price: 0.4 })],
      marketsMap(market("m1", 0.4)),
      baseConfig,
      0,
    );

    expect(result.records[0]?.executed).toBe(true);
    expect(result.portfolio.cashBalance).toBe(9900);
    expect(result.portfolio.positions).toHaveLength(1);
    expect(result.portfolio.positions[0]?.size).toBe(250);
    expect(result.portfolio.positions[0]?.costBasis).toBe(100);
    assertInvariants(result.portfolio, marketsMap(market("m1", 0.4)), baseConfig);
  });

  it("rejects orders below minimum size", () => {
    const portfolio = createPortfolio(BOT_ID, 10_000);
    const result = runSimulatorTick(
      portfolio,
      [decision({ action: "BUY_YES", size: 0.5 })],
      marketsMap(market("m1", 0.4)),
      baseConfig,
      0,
    );

    expect(result.records[0]?.executed).toBe(false);
    expect(result.records[0]?.reason).toBe("below_min_order");
    expect(result.portfolio.cashBalance).toBe(10_000);
  });

  it("rejects trades below confidence threshold", () => {
    const portfolio = createPortfolio(BOT_ID, 10_000);
    const result = runSimulatorTick(
      portfolio,
      [decision({ action: "BUY_YES", confidence: 0.2 })],
      marketsMap(market("m1", 0.4)),
      baseConfig,
      0,
    );

    expect(result.records[0]?.executed).toBe(false);
    expect(result.records[0]?.reason).toBe("below_confidence");
  });

  it("never allows cash to go negative", () => {
    const portfolio = createPortfolio(BOT_ID, 50);
    const result = runSimulatorTick(
      portfolio,
      [decision({ action: "BUY_YES", size: 100 })],
      marketsMap(market("m1", 0.4)),
      baseConfig,
      0,
    );

    expect(result.portfolio.cashBalance).toBeGreaterThanOrEqual(0);
    expect(result.records[0]?.executed).toBe(true);
    expect(result.portfolio.positions[0]?.costBasis).toBeLessThanOrEqual(50);
  });

  it("caps position size at maxPositionSize", () => {
    const portfolio = createPortfolio(BOT_ID, 10_000);
    const result = runSimulatorTick(
      portfolio,
      [decision({ action: "BUY_YES", size: 500 })],
      marketsMap(market("m1", 0.4)),
      baseConfig,
      0,
    );

    expect(result.portfolio.positions[0]?.costBasis).toBe(100);
    assertInvariants(result.portfolio, marketsMap(market("m1", 0.4)), baseConfig);
  });

  it("sells an open position and realizes P&L", () => {
    let portfolio = createPortfolio(BOT_ID, 10_000);
    const markets = marketsMap(market("m1", 0.4));

    portfolio = runSimulatorTick(
      portfolio,
      [decision({ action: "BUY_YES", size: 100 })],
      markets,
      baseConfig,
      0,
    ).portfolio;

    const result = runSimulatorTick(
      portfolio,
      [decision({ action: "SELL", size: 0, price: 0.6 })],
      marketsMap(market("m1", 0.6)),
      baseConfig,
      0,
    );

    expect(result.records[0]?.executed).toBe(true);
    expect(result.portfolio.positions[0]?.status).toBe("closed");
    expect(result.portfolio.positions[0]?.realizedPnl).toBe(50);
    expect(result.portfolio.cashBalance).toBe(10_050);
  });

  it("leaves portfolio unchanged on HOLD", () => {
    const portfolio = createPortfolio(BOT_ID, 10_000);
    const result = runSimulatorTick(
      portfolio,
      [decision({ action: "HOLD" })],
      marketsMap(market("m1", 0.4)),
      baseConfig,
      0,
    );

    expect(result.portfolio.cashBalance).toBe(10_000);
    expect(result.portfolio.positions).toHaveLength(0);
    expect(result.records[0]?.executed).toBe(false);
  });

  it("records every non-HOLD decision", () => {
    const portfolio = createPortfolio(BOT_ID, 10_000);
    const decisions = [
      decision({ action: "BUY_YES", id: "d1" }),
      decision({ action: "SELL", id: "d2", size: 0 }),
      decision({ action: "BUY_NO", id: "d3", marketId: "m2", size: 10 }),
    ];

    const result = runSimulatorTick(portfolio, decisions, marketsMap(market("m1", 0.4)), baseConfig, 0);

    expect(result.records).toHaveLength(3);
    expect(result.records.map((record) => record.decision.id)).toEqual(["d1", "d2", "d3"]);
  });

  it("marks open positions to market", () => {
    let portfolio = createPortfolio(BOT_ID, 10_000);
    portfolio = runSimulatorTick(
      portfolio,
      [decision({ action: "BUY_YES", size: 100 })],
      marketsMap(market("m1", 0.4)),
      baseConfig,
      0,
    ).portfolio;

    const marked = markPortfolioToMarket(portfolio, marketsMap(market("m1", 0.5)));
    expect(marked.positions[0]?.unrealizedPnl).toBe(25);
    expect(marked.totalPnl).toBe(25);
  });

  it("settles winning YES positions with 2% fee on profit", () => {
    let portfolio = createPortfolio(BOT_ID, 10_000);
    portfolio = runSimulatorTick(
      portfolio,
      [decision({ action: "BUY_YES", size: 100 })],
      marketsMap(market("m1", 0.4)),
      baseConfig,
      0,
    ).portfolio;

    const resolved = market("m1", 1, { resolved: true, outcome: "YES" });
    const result = runSimulatorTick(portfolio, [], marketsMap(resolved), baseConfig, 0);

    const position = result.portfolio.positions[0];
    expect(position?.status).toBe("settled");
    expect(position?.realizedPnl).toBe(147);
    expect(result.portfolio.cashBalance).toBe(10_147);
  });

  it("settles losing positions at zero payout", () => {
    let portfolio = createPortfolio(BOT_ID, 10_000);
    portfolio = runSimulatorTick(
      portfolio,
      [decision({ action: "BUY_YES", size: 100 })],
      marketsMap(market("m1", 0.4)),
      baseConfig,
      0,
    ).portfolio;

    const resolved = market("m1", 0, { resolved: true, outcome: "NO" });
    const result = runSimulatorTick(portfolio, [], marketsMap(resolved), baseConfig, 0);

    expect(result.portfolio.positions[0]?.status).toBe("settled");
    expect(result.portfolio.positions[0]?.realizedPnl).toBe(-100);
    expect(result.portfolio.cashBalance).toBe(9900);
  });

  it("maintains total P&L invariant after price moves", () => {
    let portfolio = createPortfolio(BOT_ID, 10_000);

    portfolio = runSimulatorTick(
      portfolio,
      [decision({ action: "BUY_YES", size: 80 })],
      marketsMap(market("m1", 0.4)),
      baseConfig,
      0,
    ).portfolio;

    const moved = marketsMap(market("m1", 0.5));
    portfolio = markPortfolioToMarket(portfolio, moved);

    assertInvariants(portfolio, moved, baseConfig);
    expect(portfolio.totalPnl).toBe(20);
  });

  it("signals pause when daily loss limit is breached", () => {
    let portfolio = createPortfolio(BOT_ID, 10_000);
    const losing = market("m1", 0.1);

    portfolio = runSimulatorTick(
      portfolio,
      [decision({ action: "BUY_YES", size: 100 })],
      marketsMap(market("m1", 0.4)),
      baseConfig,
      0,
    ).portfolio;

    const result = runSimulatorTick(portfolio, [], marketsMap(losing), baseConfig, 0);

    expect(result.shouldPause).toBe(true);
  });
});