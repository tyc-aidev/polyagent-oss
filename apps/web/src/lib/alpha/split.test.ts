import { describe, expect, it } from "vitest";
import type { PriceBar } from "@polyagent/shared";
import { runBacktest } from "./backtest";
import {
  aggregateMetrics,
  computeSplitReport,
  holdoutWindow,
  uniqueTimestamps,
  walkForwardWindows,
} from "./split";

function bars(count: number, marketId = "m1"): PriceBar[] {
  return Array.from({ length: count }, (_, index) => ({
    marketId,
    capturedAt: new Date(Date.UTC(2026, 0, 1, 0, index * 5)),
    yesPrice: index < count / 2 ? 0.2 : 0.55,
    noPrice: index < count / 2 ? 0.8 : 0.45,
    volume24h: 2_000,
  }));
}

describe("holdoutWindow", () => {
  it("cuts 70% train / 30% test on 10 timestamps", () => {
    const ts = uniqueTimestamps(bars(10));
    const window = holdoutWindow(ts, 0.7);
    expect(ts.indexOf(window.trainTo)).toBe(6);
    expect(ts.indexOf(window.testFrom)).toBe(7);
    expect(window.testTo).toBe(ts[9]);
  });

  it("rejects a tape that is too short", () => {
    expect(() => holdoutWindow(uniqueTimestamps(bars(3)), 0.7)).toThrow(/at least 4/i);
  });
});

describe("walkForwardWindows", () => {
  it("emits expanding train / next-segment test folds", () => {
    const ts = uniqueTimestamps(bars(12));
    const windows = walkForwardWindows(ts, 3);
    expect(windows).toHaveLength(3);
    expect(windows[0]?.trainFrom).toBe(ts[0]);
    expect(windows[0]?.testFrom).toBeGreaterThan(windows[0]?.trainTo ?? 0);
    expect(windows[1]?.trainTo).toBeGreaterThan(windows[0]?.trainTo ?? 0);
    expect(windows[2]?.testTo).toBe(ts[ts.length - 1]);
  });

  it("rejects too few timestamps for the requested folds", () => {
    expect(() => walkForwardWindows(uniqueTimestamps(bars(6)), 3)).toThrow(/at least 8/i);
  });
});

describe("computeSplitReport", () => {
  it("attaches holdout in/out-of-sample metrics", () => {
    const series = bars(10);
    const split = computeSplitReport(
      {
        alphaId: "threshold_yes",
        parameters: { buyYesBelow: 0.35 },
        bars: series,
        startingBalance: 10_000,
        maxPositionSize: 100,
      },
      { mode: "holdout", trainFraction: 0.6 },
    );

    expect(split.mode).toBe("holdout");
    expect(split.inSample.ticks).toBeGreaterThan(0);
    expect(split.outOfSample.ticks).toBeGreaterThan(0);
    expect(split.inSample.ticks + split.outOfSample.ticks).toBeLessThanOrEqual(
      runBacktest({
        alphaId: "threshold_yes",
        parameters: { buyYesBelow: 0.35 },
        bars: series,
      }).metrics.ticks,
    );
  });

  it("walk-forward reports per-fold OOS and an aggregate", () => {
    const split = computeSplitReport(
      {
        alphaId: "threshold_yes",
        parameters: { buyYesBelow: 0.35 },
        bars: bars(16),
        startingBalance: 10_000,
        maxPositionSize: 50,
      },
      { mode: "walk_forward", folds: 3 },
    );

    expect(split.mode).toBe("walk_forward");
    expect(split.foldReports).toHaveLength(3);
    expect(split.outOfSample.ticks).toBe(
      split.foldReports?.reduce((sum, fold) => sum + fold.outOfSample.ticks, 0),
    );
  });
});

describe("aggregateMetrics", () => {
  it("sums P&L and averages hit rate", () => {
    const a = {
      ticks: 4,
      trades: 1,
      positiveTicks: 2,
      hitRate: 0.5,
      startingBalance: 10_000,
      endingEquity: 10_100,
      totalPnl: 100,
      maxDrawdown: 0.1,
      sharpe: 1,
    };
    const b = { ...a, totalPnl: 50, hitRate: 0.25, maxDrawdown: 0.2, sharpe: 0.5 };
    const agg = aggregateMetrics([a, b], 10_000);
    expect(agg.totalPnl).toBe(150);
    expect(agg.hitRate).toBeCloseTo(0.375);
    expect(agg.maxDrawdown).toBe(0.2);
    expect(agg.sharpe).toBeCloseTo(0.75);
  });
});
