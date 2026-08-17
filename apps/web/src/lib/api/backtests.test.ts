import { describe, expect, it } from "vitest";
import { createBacktest, createSweep } from "./backtests";

describe("createBacktest", () => {
  it("runs against inline bars without touching stored snapshots", async () => {
    const report = await createBacktest({
      alphaId: "threshold_yes",
      marketIds: ["m1"],
      parameters: { buyYesBelow: 0.35 },
      startingBalance: 10_000,
      maxPositionSize: 50,
      bars: [
        {
          marketId: "m1",
          capturedAt: new Date("2026-01-01T00:00:00.000Z"),
          yesPrice: 0.2,
          noPrice: 0.8,
          volume24h: 1_000,
        },
        {
          marketId: "m1",
          capturedAt: new Date("2026-01-01T00:05:00.000Z"),
          yesPrice: 0.45,
          noPrice: 0.55,
          volume24h: 1_000,
        },
      ],
    });

    expect(report.alphaId).toBe("threshold_yes");
    expect(report.metrics.trades).toBeGreaterThan(0);
    expect(report.equityCurve.length).toBe(2);
  });

  it("rejects unknown alphas before loading history", async () => {
    await expect(
      createBacktest({
        alphaId: "not-an-alpha",
        marketIds: ["m1"],
      }),
    ).rejects.toThrow(/not found/i);
  });

  it("sweeps an explicit grid on inline bars", async () => {
    const report = await createSweep({
      alphaId: "threshold_yes",
      marketIds: ["m1"],
      grid: { buyYesBelow: [0.15, 0.35] },
      startingBalance: 10_000,
      maxPositionSize: 50,
      bars: [
        {
          marketId: "m1",
          capturedAt: new Date("2026-01-01T00:00:00.000Z"),
          yesPrice: 0.2,
          noPrice: 0.8,
          volume24h: 1_000,
        },
        {
          marketId: "m1",
          capturedAt: new Date("2026-01-01T00:05:00.000Z"),
          yesPrice: 0.5,
          noPrice: 0.5,
          volume24h: 1_000,
        },
      ],
    });

    expect(report.combinations).toBe(2);
    expect(report.winner?.parameters.buyYesBelow).toBe(0.35);
    expect(report.results[0]?.metrics.trades).toBeGreaterThan(0);
  });

  it("attaches holdout in/out-of-sample metrics", async () => {
    const prices = [0.2, 0.2, 0.2, 0.2, 0.5, 0.55, 0.55, 0.55];
    const report = await createBacktest({
      alphaId: "threshold_yes",
      marketIds: ["m1"],
      parameters: { buyYesBelow: 0.35 },
      startingBalance: 10_000,
      maxPositionSize: 50,
      split: { mode: "holdout", trainFraction: 0.6 },
      bars: prices.map((yesPrice, index) => ({
        marketId: "m1",
        capturedAt: new Date(Date.UTC(2026, 0, 1, 0, index * 5)),
        yesPrice,
        noPrice: 1 - yesPrice,
        volume24h: 1_000,
      })),
    });

    expect(report.metrics.ticks).toBe(8);
    expect(report.split?.mode).toBe("holdout");
    expect(report.split?.inSample.ticks).toBeGreaterThan(0);
    expect(report.split?.outOfSample.ticks).toBeGreaterThan(0);
    expect(report.limitations.some((line) => /out-of-sample/i.test(line))).toBe(true);
  });
});
