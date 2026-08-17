import { describe, expect, it } from "vitest";
import {
  importHistorySchema,
  researchAlphasSchema,
  runBacktestSchema,
  scanAlphasSchema,
  sweepBacktestSchema,
} from "./alpha";

describe("importHistorySchema", () => {
  it("accepts a valid bar series", () => {
    const result = importHistorySchema.safeParse({
      bars: [
        {
          capturedAt: "2026-01-01T00:00:00.000Z",
          yesPrice: 0.42,
          noPrice: 0.58,
          volume24h: 1200,
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("accepts optional event extras on a bar", () => {
    const result = importHistorySchema.safeParse({
      bars: [
        {
          capturedAt: "2026-01-01T00:00:00.000Z",
          yesPrice: 0.42,
          noPrice: 0.58,
          volume24h: 1200,
          event: { fixture: { favoriteDownBreak: true, set: 1 } },
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects prices outside [0, 1]", () => {
    const result = importHistorySchema.safeParse({
      bars: [
        {
          capturedAt: "2026-01-01T00:00:00.000Z",
          yesPrice: 1.2,
          noPrice: 0.1,
          volume24h: 10,
        },
      ],
    });
    expect(result.success).toBe(false);
  });
});

describe("runBacktestSchema", () => {
  it("accepts an inline-bar backtest request", () => {
    const result = runBacktestSchema.safeParse({
      alphaId: "threshold_yes",
      marketIds: ["m1"],
      startingBalance: 10_000,
      bars: [
        {
          marketId: "m1",
          capturedAt: "2026-01-01T00:00:00.000Z",
          yesPrice: 0.3,
          noPrice: 0.7,
          volume24h: 500,
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects inverted time ranges", () => {
    const result = runBacktestSchema.safeParse({
      alphaId: "momentum",
      marketIds: ["m1"],
      from: "2026-02-01T00:00:00.000Z",
      to: "2026-01-01T00:00:00.000Z",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a holdout split", () => {
    const result = runBacktestSchema.safeParse({
      alphaId: "momentum",
      marketIds: ["m1"],
      split: { mode: "holdout", trainFraction: 0.7 },
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid split mode", () => {
    const result = runBacktestSchema.safeParse({
      alphaId: "momentum",
      marketIds: ["m1"],
      split: { mode: "random" },
    });
    expect(result.success).toBe(false);
  });
});

describe("scanAlphasSchema", () => {
  it("accepts an empty body (live universe scan)", () => {
    const result = scanAlphasSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts a filtered scan", () => {
    const result = scanAlphasSchema.safeParse({
      marketIds: ["m1", "m2"],
      alphaIds: ["momentum"],
      minConfidence: 0.2,
      action: "BUY_YES",
      lookback: 8,
      limit: 10,
      includeHolds: false,
      hasEvent: true,
    });
    expect(result.success).toBe(true);
  });

  it("rejects more than 50 market ids", () => {
    const result = scanAlphasSchema.safeParse({
      marketIds: Array.from({ length: 51 }, (_, i) => `m${i}`),
    });
    expect(result.success).toBe(false);
  });
});

describe("sweepBacktestSchema", () => {
  it("accepts an auto-grid sweep", () => {
    const result = sweepBacktestSchema.safeParse({
      alphaId: "threshold_yes",
      marketIds: ["m1"],
    });
    expect(result.success).toBe(true);
  });

  it("accepts an explicit grid and steps", () => {
    const result = sweepBacktestSchema.safeParse({
      alphaId: "momentum",
      marketIds: ["m1"],
      grid: { momentumThreshold: [0.01, 0.02, 0.04] },
      steps: { unused: 3 },
    });
    expect(result.success).toBe(true);
  });

  it("rejects more than 50 values on one axis", () => {
    const result = sweepBacktestSchema.safeParse({
      alphaId: "momentum",
      marketIds: ["m1"],
      grid: { momentumThreshold: Array.from({ length: 51 }, (_, i) => i / 100) },
    });
    expect(result.success).toBe(false);
  });
});

describe("researchAlphasSchema", () => {
  it("accepts an empty body (live universe compose)", () => {
    expect(researchAlphasSchema.safeParse({}).success).toBe(true);
  });

  it("accepts a capped compose request", () => {
    const result = researchAlphasSchema.safeParse({
      marketIds: ["m1"],
      alphaIds: ["threshold_yes"],
      top: 3,
      steps: 2,
      split: { mode: "holdout" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects top above 5", () => {
    expect(researchAlphasSchema.safeParse({ top: 6 }).success).toBe(false);
  });
});
