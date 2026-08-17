import { describe, expect, it } from "vitest";
import type { PriceBar } from "@polyagent/shared";
import { runBacktest } from "./backtest";

function bars(prices: number[], marketId = "m1"): PriceBar[] {
  return prices.map((yesPrice, index) => ({
    marketId,
    capturedAt: new Date(Date.UTC(2026, 0, 1, 0, index * 5)),
    yesPrice,
    noPrice: 1 - yesPrice,
    volume24h: 2_000,
  }));
}

describe("runBacktest", () => {
  it("rejects an unknown alpha", () => {
    expect(() => runBacktest({ alphaId: "nope", bars: bars([0.4]) })).toThrow(/not found/i);
  });

  it("rejects an empty series", () => {
    expect(() => runBacktest({ alphaId: "threshold_yes", bars: [] })).toThrow(/at least one/i);
  });

  it("buys cheap YES and marks the book as price recovers", () => {
    const report = runBacktest({
      alphaId: "threshold_yes",
      parameters: { buyYesBelow: 0.35 },
      bars: bars([0.2, 0.2, 0.5]),
      startingBalance: 10_000,
      maxPositionSize: 100,
      confidenceThreshold: 0,
    });

    expect(report.metrics.ticks).toBe(3);
    expect(report.metrics.trades).toBeGreaterThan(0);
    expect(report.metrics.endingEquity).toBeGreaterThan(report.metrics.startingBalance);
    expect(report.metrics.totalPnl).toBeGreaterThan(0);
    expect(report.equityCurve).toHaveLength(3);
    expect(report.limitations.length).toBeGreaterThan(0);
    expect(report.trades.some((trade) => trade.action === "BUY_YES" && trade.executed)).toBe(true);
  });

  it("does not look ahead — a later spike cannot change an earlier signal", () => {
    const early = runBacktest({
      alphaId: "mean_reversion",
      parameters: { residualThreshold: 0.05 },
      bars: bars([0.4, 0.41]),
    });
    const withSpike = runBacktest({
      alphaId: "mean_reversion",
      parameters: { residualThreshold: 0.05 },
      bars: bars([0.4, 0.41, 0.95]),
    });

    expect(early.trades[0]?.action).toBe(withSpike.trades[0]?.action);
    expect(early.trades[1]?.action).toBe(withSpike.trades[1]?.action);
    expect(withSpike.trades[2]?.action).toBe("BUY_NO");
  });

  it("evaluateFrom warms features but only books ticks at/after the cut", () => {
    const series = bars([0.2, 0.2, 0.2, 0.55]);
    const full = runBacktest({
      alphaId: "threshold_yes",
      parameters: { buyYesBelow: 0.35 },
      bars: series,
    });
    const oos = runBacktest({
      alphaId: "threshold_yes",
      parameters: { buyYesBelow: 0.35 },
      bars: series,
      evaluateFrom: series[2]?.capturedAt,
    });

    expect(oos.metrics.ticks).toBeLessThan(full.metrics.ticks);
    expect(oos.metrics.ticks).toBe(2);
    expect(oos.equityCurve[0]?.timestamp.getTime()).toBe(series[2]?.capturedAt.getTime());
  });

  it("uses only the requested market ids from a mixed tape", () => {
    const report = runBacktest({
      alphaId: "threshold_yes",
      parameters: { buyYesBelow: 0.99 },
      bars: [...bars([0.3, 0.3], "keep"), ...bars([0.3, 0.3], "drop")].filter(
        (bar) => bar.marketId === "keep",
      ),
    });
    expect(report.marketIds).toEqual(["keep"]);
  });
});
