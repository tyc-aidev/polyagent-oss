import { describe, expect, it } from "vitest";
import type { AlphaOpportunity, PriceBar } from "@polyagent/shared";
import { fallbackOpportunities, researchCandidatesFromTape } from "./research";

function opportunity(overrides: Partial<AlphaOpportunity> = {}): AlphaOpportunity {
  return {
    marketId: "m1",
    question: "m1?",
    slug: "m1",
    yesPrice: 0.2,
    noPrice: 0.8,
    volume24h: 2_000,
    alphaId: "threshold_yes",
    alphaName: "Threshold YES",
    action: "BUY_YES",
    score: 0.5,
    confidence: 0.4,
    reasoning: "cheap YES",
    rank: 0.2,
    features: {
      marketId: "m1",
      timestamp: new Date("2026-01-01T00:00:00.000Z"),
      yesPrice: 0.2,
      noPrice: 0.8,
      volume24h: 2_000,
      complementaryGap: 0,
      lookbackReturn: null,
      momentum: null,
      volatility: null,
      volumeZScore: null,
      distanceFromFair: -0.3,
      meanReversionResidual: null,
      sampleSize: 1,
    },
    ...overrides,
  };
}

function bars(prices: number[], marketId = "m1"): PriceBar[] {
  return prices.map((yesPrice, index) => ({
    marketId,
    capturedAt: new Date(Date.UTC(2026, 0, 1, 0, index * 5)),
    yesPrice,
    noPrice: 1 - yesPrice,
    volume24h: 2_000,
  }));
}

describe("researchCandidatesFromTape", () => {
  it("skips sweep when the tape is empty", () => {
    const [candidate] = researchCandidatesFromTape([opportunity()], new Map());
    expect(candidate?.sweep).toBeNull();
    expect(candidate?.skippedReason).toMatch(/not enough stored bars/i);
    expect(candidate?.promote.strategy.type).toBe("alpha");
  });

  it("sweeps a cheap-YES tape and fills promote parameters", () => {
    const tape = bars([0.2, 0.2, 0.55]);
    const [candidate] = researchCandidatesFromTape(
      [opportunity()],
      new Map([["m1", tape]]),
      { steps: 2, startingBalance: 10_000, maxPositionSize: 50 },
    );
    expect(candidate?.sweep).not.toBeNull();
    expect(candidate?.sweep?.winner).not.toBeNull();
    expect(candidate?.promote.strategy.alphaId).toBe("threshold_yes");
    expect(candidate?.promote.strategy.parameters.buyYesBelow).toBeTypeOf("number");
    expect(candidate?.skippedReason).toBeUndefined();
  });

  it("refuses holdout when there are fewer than 4 timestamps", () => {
    const [candidate] = researchCandidatesFromTape(
      [opportunity()],
      new Map([["m1", bars([0.2, 0.55])]]),
      { split: { mode: "holdout" } },
    );
    expect(candidate?.sweep).toBeNull();
    expect(candidate?.skippedReason).toMatch(/4 unique timestamps/i);
  });

  it("ranks candidates with a sweep score ahead of skipped ones", () => {
    const ranked = researchCandidatesFromTape(
      [opportunity({ marketId: "thin", question: "thin?" }), opportunity()],
      new Map([
        ["thin", []],
        ["m1", bars([0.2, 0.2, 0.55])],
      ]),
      { steps: 2 },
    );
    expect(ranked[0]?.marketId).toBe("m1");
    expect(ranked[1]?.marketId).toBe("thin");
  });
});

describe("fallbackOpportunities", () => {
  it("builds HOLD placeholders so explicit pairs still sweep", () => {
    const [item] = fallbackOpportunities(["m1"], ["threshold_yes"], 1);
    expect(item?.action).toBe("HOLD");
    expect(item?.alphaId).toBe("threshold_yes");
    expect(item?.marketId).toBe("m1");
  });
});
