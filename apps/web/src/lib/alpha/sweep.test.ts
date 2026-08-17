import { describe, expect, it } from "vitest";
import type { AlphaDefinition, PriceBar } from "@polyagent/shared";
import { getAlpha } from "./catalog";
import {
  compareSweepResults,
  expandSweepGrid,
  linspace,
  MAX_SWEEP_COMBINATIONS,
  runSweep,
  sweepScore,
} from "./sweep";

function bars(prices: number[], marketId = "m1"): PriceBar[] {
  return prices.map((yesPrice, index) => ({
    marketId,
    capturedAt: new Date(Date.UTC(2026, 0, 1, 0, index * 5)),
    yesPrice,
    noPrice: 1 - yesPrice,
    volume24h: 2_000,
  }));
}

describe("linspace", () => {
  it("includes endpoints", () => {
    expect(linspace(0, 1, 5)).toEqual([0, 0.25, 0.5, 0.75, 1]);
  });

  it("returns a single point when steps is 1", () => {
    expect(linspace(0.2, 0.8, 1)).toEqual([0.2]);
  });
});

describe("expandSweepGrid", () => {
  const definition = getAlpha("threshold_yes") as AlphaDefinition;

  it("uses an explicit grid and defaults unspecified params", () => {
    const combos = expandSweepGrid(definition, { buyYesBelow: [0.2, 0.4] });
    expect(combos).toHaveLength(2);
    expect(combos[0]?.buyYesBelow).toBe(0.2);
    expect(combos[0]?.minVolume24h).toBe(definition.defaultParameters.minVolume24h);
    expect(combos[1]?.buyYesBelow).toBe(0.4);
  });

  it("clamps grid values to the spec range", () => {
    const combos = expandSweepGrid(definition, { buyYesBelow: [-1, 0.3, 2] });
    expect(combos.map((row) => row.buyYesBelow)).toEqual([0, 0.3, 1]);
  });

  it("rejects unknown parameter names", () => {
    expect(() => expandSweepGrid(definition, { nope: [1] })).toThrow(/unknown/i);
  });

  it("rejects a cartesian product over the combination cap", () => {
    const tooMany = Array.from({ length: 8 }, (_, i) => i / 10);
    expect(() =>
      expandSweepGrid(definition, {
        buyYesBelow: tooMany,
        minVolume24h: tooMany,
      }),
    ).toThrow(new RegExp(String(MAX_SWEEP_COMBINATIONS)));
  });

  it("auto-steps stay within the combination cap", () => {
    const combos = expandSweepGrid(definition);
    expect(combos.length).toBeGreaterThan(1);
    expect(combos.length).toBeLessThanOrEqual(MAX_SWEEP_COMBINATIONS);
  });
});

describe("compareSweepResults", () => {
  it("prefers higher Sharpe, then P&L, then lower drawdown", () => {
    const lowSharpe = {
      parameters: { a: 1 },
      metrics: {
        ticks: 2,
        trades: 1,
        positiveTicks: 1,
        hitRate: 0.5,
        startingBalance: 10_000,
        endingEquity: 10_100,
        totalPnl: 100,
        maxDrawdown: 0.1,
        sharpe: 0.2,
      },
      score: 0.2,
    };
    const highSharpe = { ...lowSharpe, parameters: { a: 2 }, score: 1.5, metrics: { ...lowSharpe.metrics, sharpe: 1.5 } };
    expect(compareSweepResults(highSharpe, lowSharpe)).toBeLessThan(0);
    expect(sweepScore(highSharpe.metrics)).toBe(1.5);
  });
});

describe("runSweep", () => {
  it("ranks a cheap-YES tape so a lower buyYesBelow is not the only combo", () => {
    const report = runSweep({
      alphaId: "threshold_yes",
      bars: bars([0.2, 0.2, 0.55]),
      grid: { buyYesBelow: [0.15, 0.35] },
      startingBalance: 10_000,
      maxPositionSize: 100,
    });

    expect(report.combinations).toBe(2);
    expect(report.winner).not.toBeNull();
    expect(report.results).toHaveLength(2);
    const winnerTrades = report.results.find(
      (row) => row.parameters.buyYesBelow === 0.35,
    )?.metrics.trades;
    const loserTrades = report.results.find(
      (row) => row.parameters.buyYesBelow === 0.15,
    )?.metrics.trades;
    expect(winnerTrades).toBeGreaterThan(0);
    expect(loserTrades).toBe(0);
    expect(report.winner?.parameters.buyYesBelow).toBe(0.35);
    expect(report.limitations.some((line) => /in-sample/i.test(line))).toBe(true);
  });

  it("rejects an unknown alpha", () => {
    expect(() => runSweep({ alphaId: "missing", bars: bars([0.4]) })).toThrow(/not found/i);
  });

  it("ranks a holdout sweep on out-of-sample metrics", () => {
    const tape = bars([0.2, 0.2, 0.2, 0.2, 0.2, 0.55, 0.55, 0.55]);
    const report = runSweep({
      alphaId: "threshold_yes",
      bars: tape,
      grid: { buyYesBelow: [0.15, 0.35] },
      split: { mode: "holdout", trainFraction: 0.6 },
      startingBalance: 10_000,
      maxPositionSize: 50,
    });

    expect(report.split?.mode).toBe("holdout");
    expect(report.winner?.outOfSample).toBeDefined();
    expect(report.winner?.metrics).toEqual(report.winner?.outOfSample);
    expect(report.limitations.some((line) => /out-of-sample/i.test(line))).toBe(true);
  });
});
