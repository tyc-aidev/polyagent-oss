import { describe, expect, it } from "vitest";
import type { PriceBar } from "@polyagent/shared";
import { computeMarketFeatures } from "./features";

function bar(overrides: Partial<PriceBar> & Pick<PriceBar, "yesPrice">): PriceBar {
  return {
    marketId: overrides.marketId ?? "m1",
    capturedAt: overrides.capturedAt ?? new Date("2026-01-01T00:00:00.000Z"),
    yesPrice: overrides.yesPrice,
    noPrice: overrides.noPrice ?? 1 - overrides.yesPrice,
    volume24h: overrides.volume24h ?? 1000,
    event: overrides.event,
  };
}

describe("computeMarketFeatures", () => {
  it("returns null for an empty series", () => {
    expect(computeMarketFeatures([])).toBeNull();
  });

  it("computes distance from fair on a single bar and leaves path stats null", () => {
    const features = computeMarketFeatures([bar({ yesPrice: 0.4 })]);
    expect(features).not.toBeNull();
    expect(features?.distanceFromFair).toBeCloseTo(-0.1);
    expect(features?.complementaryGap).toBeCloseTo(0);
    expect(features?.lookbackReturn).toBeNull();
    expect(features?.momentum).toBeNull();
    expect(features?.volatility).toBeNull();
    expect(features?.meanReversionResidual).toBeNull();
    expect(features?.sampleSize).toBe(1);
  });

  it("computes positive momentum and lookback return on a rising series", () => {
    const features = computeMarketFeatures([
      bar({ yesPrice: 0.4, capturedAt: new Date("2026-01-01T00:00:00.000Z") }),
      bar({ yesPrice: 0.44, capturedAt: new Date("2026-01-01T00:05:00.000Z") }),
      bar({ yesPrice: 0.5, capturedAt: new Date("2026-01-01T00:10:00.000Z") }),
    ]);
    expect(features?.lookbackReturn).toBeCloseTo(0.5 / 0.4 - 1);
    expect(features?.momentum).toBeGreaterThan(0);
    expect(features?.meanReversionResidual).not.toBeNull();
    expect(features?.meanReversionResidual ?? 0).toBeGreaterThan(0);
  });

  it("flags a volume spike on the last bar", () => {
    const baseline = [100, 110, 90, 105, 95, 100];
    const features = computeMarketFeatures([
      ...baseline.map((volume24h, index) =>
        bar({
          yesPrice: 0.5,
          volume24h,
          capturedAt: new Date(Date.UTC(2026, 0, 1, 0, index * 5)),
        }),
      ),
      bar({
        yesPrice: 0.5,
        volume24h: 800,
        capturedAt: new Date(Date.UTC(2026, 0, 1, 0, baseline.length * 5)),
      }),
    ]);
    expect(features?.volumeZScore).not.toBeNull();
    expect(features?.volumeZScore ?? 0).toBeGreaterThan(1.5);
  });

  it("does not use bars after the last included sample", () => {
    const early = computeMarketFeatures([
      bar({ yesPrice: 0.4, capturedAt: new Date("2026-01-01T00:00:00.000Z") }),
      bar({ yesPrice: 0.41, capturedAt: new Date("2026-01-01T00:05:00.000Z") }),
    ]);
    const withLater = computeMarketFeatures([
      bar({ yesPrice: 0.4, capturedAt: new Date("2026-01-01T00:00:00.000Z") }),
      bar({ yesPrice: 0.41, capturedAt: new Date("2026-01-01T00:05:00.000Z") }),
      bar({ yesPrice: 0.9, capturedAt: new Date("2026-01-01T00:10:00.000Z") }),
    ]);
    expect(early?.yesPrice).toBeCloseTo(0.41);
    expect(withLater?.yesPrice).toBeCloseTo(0.9);
    expect(early?.lookbackReturn).not.toBeCloseTo(withLater?.lookbackReturn ?? 0);
  });

  it("copies the last bar's event extras onto features", () => {
    const features = computeMarketFeatures([
      bar({ yesPrice: 0.4, capturedAt: new Date("2026-01-01T00:00:00.000Z") }),
      bar({
        yesPrice: 0.41,
        capturedAt: new Date("2026-01-01T00:05:00.000Z"),
        event: { fixture: { favoriteDownBreak: true } },
      }),
    ]);
    expect(features?.event?.fixture?.favoriteDownBreak).toBe(true);
  });

  it("carries a harvested event onto a live mid that has none", () => {
    const features = computeMarketFeatures([
      bar({
        yesPrice: 0.4,
        capturedAt: new Date("2026-01-01T00:00:00.000Z"),
        event: { fixture: { favoriteDownBreak: true } },
      }),
      bar({
        yesPrice: 0.41,
        capturedAt: new Date("2026-01-01T00:05:00.000Z"),
      }),
    ]);
    expect(features?.yesPrice).toBeCloseTo(0.41);
    expect(features?.event?.fixture?.favoriteDownBreak).toBe(true);
  });
});
