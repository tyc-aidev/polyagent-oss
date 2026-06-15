import { describe, expect, it } from "vitest";
import { createPortfolio } from "@/lib/paper-trading/portfolio";
import { summarizePortfolio } from "./portfolio-summary";

describe("summarizePortfolio", () => {
  it("computes zero P&L for cash-only portfolio", () => {
    const portfolio = createPortfolio("bot-1", 10_000);
    expect(summarizePortfolio(portfolio)).toEqual({
      cashBalance: 10_000,
      startingBalance: 10_000,
      totalPnl: 0,
      openPositions: 0,
    });
  });

  it("includes open position value in total P&L", () => {
    const portfolio = createPortfolio("bot-1", 10_000);
    portfolio.cashBalance = 9900;
    portfolio.positions = [
      {
        id: "p1",
        botId: "bot-1",
        marketId: "m1",
        side: "YES",
        size: 250,
        avgPrice: 0.4,
        costBasis: 100,
        unrealizedPnl: 25,
        realizedPnl: 0,
        status: "open",
      },
    ];

    expect(summarizePortfolio(portfolio).totalPnl).toBe(25);
  });
});