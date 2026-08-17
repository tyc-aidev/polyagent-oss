import { describe, expect, it } from "vitest";
import { importHistorySchema, runBacktestSchema, scanAlphasSchema } from "./alpha";

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
