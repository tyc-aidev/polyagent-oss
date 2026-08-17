import { describe, expect, it } from "vitest";
import type { MarketFeatures } from "@polyagent/shared";
import { coerceEventNumber, numericEventExtras } from "./events";

const base: MarketFeatures = {
  marketId: "m1",
  timestamp: new Date("2026-01-01T00:00:00.000Z"),
  yesPrice: 0.4,
  noPrice: 0.6,
  volume24h: 1_000,
  complementaryGap: 0,
  lookbackReturn: null,
  momentum: null,
  volatility: null,
  volumeZScore: null,
  distanceFromFair: -0.1,
  meanReversionResidual: null,
  sampleSize: 1,
};

describe("coerceEventNumber", () => {
  it("keeps finite numbers and maps booleans", () => {
    expect(coerceEventNumber(2.5)).toBe(2.5);
    expect(coerceEventNumber(true)).toBe(1);
    expect(coerceEventNumber(false)).toBe(0);
    expect(coerceEventNumber("break")).toBeNull();
    expect(coerceEventNumber(null)).toBeNull();
  });
});

describe("numericEventExtras", () => {
  it("returns nothing without an event bag", () => {
    expect(numericEventExtras(base)).toEqual([]);
  });

  it("flattens namespaced extras", () => {
    const extras = numericEventExtras({
      ...base,
      event: { fixture: { favoriteDownBreak: true }, tennis: { set: 2, label: "final" } },
    });
    expect(extras).toEqual([
      { source: "fixture", key: "favoriteDownBreak", value: 1 },
      { source: "tennis", key: "set", value: 2 },
    ]);
  });
});
