import { describe, expect, it } from "vitest";
import type { MarketFeatures } from "@polyagent/shared";
import { evaluateAlpha, evaluateCatalog, getAlpha, listAlphas } from "./catalog";

function features(overrides: Partial<MarketFeatures> = {}): MarketFeatures {
  return {
    marketId: "m1",
    timestamp: new Date("2026-01-01T00:00:00.000Z"),
    yesPrice: 0.4,
    noPrice: 0.6,
    volume24h: 1_000,
    complementaryGap: 0,
    lookbackReturn: 0.05,
    momentum: 0.03,
    volatility: 0.01,
    volumeZScore: 0.2,
    distanceFromFair: -0.1,
    meanReversionResidual: 0,
    sampleSize: 6,
    ...overrides,
  };
}

describe("alpha catalog", () => {
  it("lists the built-in research alphas", () => {
    const ids = listAlphas().map((alpha) => alpha.id);
    expect(ids).toEqual([
      "threshold_yes",
      "threshold_no",
      "mean_reversion",
      "momentum",
      "volume_spike",
      "extreme_mispricing",
      "event_threshold",
    ]);
  });

  it("returns null for an unknown alpha", () => {
    expect(getAlpha("does_not_exist")).toBeNull();
  });

  it("buys YES when price is below the threshold", () => {
    const signal = evaluateAlpha("threshold_yes", features({ yesPrice: 0.2 }), { buyYesBelow: 0.35 });
    expect(signal.action).toBe("BUY_YES");
    expect(signal.confidence).toBeGreaterThan(0);
  });

  it("holds when volume is below the floor", () => {
    const signal = evaluateAlpha("threshold_yes", features({ volume24h: 10 }), {
      buyYesBelow: 0.9,
      minVolume24h: 100,
    });
    expect(signal.action).toBe("HOLD");
  });

  it("fades a rich YES residual", () => {
    const signal = evaluateAlpha("mean_reversion", features({ meanReversionResidual: 0.12 }), {
      residualThreshold: 0.05,
    });
    expect(signal.action).toBe("BUY_NO");
    expect(signal.score).toBeLessThan(0);
  });

  it("follows positive momentum", () => {
    const signal = evaluateAlpha("momentum", features({ momentum: 0.08 }), { momentumThreshold: 0.02 });
    expect(signal.action).toBe("BUY_YES");
  });

  it("follows a volume spike in the lookback direction", () => {
    const signal = evaluateAlpha(
      "volume_spike",
      features({ volumeZScore: 2.4, lookbackReturn: 0.1 }),
      { volumeZ: 1.5, followThrough: 1 },
    );
    expect(signal.action).toBe("BUY_YES");
  });

  it("buys YES in the extreme-low band", () => {
    const signal = evaluateAlpha("extreme_mispricing", features({ yesPrice: 0.08 }), {
      low: 0.15,
      high: 0.85,
    });
    expect(signal.action).toBe("BUY_YES");
  });

  it("ranks active catalog signals ahead of HOLDs", () => {
    const ranked = evaluateCatalog(
      features({
        yesPrice: 0.1,
        noPrice: 0.9,
        lookbackReturn: 0.2,
        momentum: 0.1,
        volumeZScore: 3,
        meanReversionResidual: -0.2,
      }),
    );
    expect(ranked[0]?.action).not.toBe("HOLD");
    const holdIndex = ranked.findIndex((signal) => signal.action === "HOLD");
    const lastActive = ranked.findLastIndex((signal) => signal.action !== "HOLD");
    if (holdIndex !== -1 && lastActive !== -1) {
      expect(lastActive).toBeLessThan(holdIndex);
    }
  });

  it("holds event_threshold when features.event is empty", () => {
    const signal = evaluateAlpha("event_threshold", features());
    expect(signal.action).toBe("HOLD");
    expect(signal.reasoning).toMatch(/no numeric/i);
  });

  it("buys YES when a fixture extra clears the threshold", () => {
    const signal = evaluateAlpha(
      "event_threshold",
      features({
        event: { fixture: { favoriteDownBreak: true, set: 1 } },
      }),
      { threshold: 1, side: 1, compare: 1 },
    );
    expect(signal.action).toBe("BUY_YES");
    expect(signal.reasoning).toMatch(/fixture\./);
    expect(signal.confidence).toBeGreaterThan(0);
  });

  it("buys NO when side is negative and the extra is at or below threshold", () => {
    const signal = evaluateAlpha(
      "event_threshold",
      features({
        event: { tennis: { gamesBehind: 0 } },
      }),
      { threshold: 0, side: -1, compare: -1 },
    );
    expect(signal.action).toBe("BUY_NO");
  });
});
