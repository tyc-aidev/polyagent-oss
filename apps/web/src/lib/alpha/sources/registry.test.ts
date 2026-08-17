import { describe, expect, it } from "vitest";
import type { FeatureSource, FeatureSourceInput, MarketFeatures, MarketSnapshot } from "@polyagent/shared";
import { FixtureFeatureSource } from "./fixture";
import { isNearStartTime, scoreMarketNameMatch } from "./match";
import { FeatureRegistry } from "./registry";

function features(overrides: Partial<MarketFeatures> = {}): MarketFeatures {
  return {
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
    ...overrides,
  };
}

function market(overrides: Partial<MarketSnapshot> = {}): MarketSnapshot {
  return {
    id: "m1",
    slug: "m1",
    question: "Will Djokovic beat Alcaraz?",
    yesPrice: 0.4,
    noPrice: 0.6,
    volume24h: 1_000,
    liquidity: 500,
    resolved: false,
    ...overrides,
  };
}

describe("FeatureRegistry", () => {
  it("leaves price features unchanged when every source is disabled", async () => {
    const registry = new FeatureRegistry([new FixtureFeatureSource({ m1: { set: 1 } }, false)]);
    const base = features();
    const enriched = await registry.enrich(market(), base);
    expect(enriched.event).toBeUndefined();
    expect(enriched.yesPrice).toBe(0.4);
    expect(registry.list()).toEqual([{ id: "fixture", enabled: false }]);
  });

  it("namespaces extras under features.event[sourceId]", async () => {
    const registry = new FeatureRegistry([
      new FixtureFeatureSource({ m1: { favoriteDownBreak: true, set: 1 } }, true),
    ]);
    const enriched = await registry.enrich(market(), features());
    expect(enriched.event?.fixture).toEqual({ favoriteDownBreak: true, set: 1 });
    expect(enriched.yesPrice).toBe(0.4);
  });

  it("swallows source failures so ticks never throw", async () => {
    const exploding: FeatureSource = {
      id: "boom",
      enabled: () => true,
      enrich: async () => {
        throw new Error("upstream down");
      },
    };
    const registry = new FeatureRegistry([exploding, new FixtureFeatureSource({ m1: { ok: 1 } }, true)]);
    const enriched = await registry.enrich(market(), features());
    expect(enriched.event?.fixture).toEqual({ ok: 1 });
    expect(enriched.event?.boom).toBeUndefined();
  });

  it("skips enrich when no market snapshot is available", async () => {
    const registry = new FeatureRegistry([new FixtureFeatureSource({ m1: { set: 1 } }, true)]);
    const enriched = await registry.enrich(null, features());
    expect(enriched.event).toBeUndefined();
  });
});

describe("scoreMarketNameMatch", () => {
  it("counts player-name hits in the market question", () => {
    expect(scoreMarketNameMatch("Will Djokovic beat Alcaraz?", ["Djokovic", "Alcaraz"])).toBe(2);
    expect(scoreMarketNameMatch("Will Djokovic beat Alcaraz?", ["Nadal"])).toBe(0);
  });
});

describe("isNearStartTime", () => {
  it("accepts endDate within the window of event start", () => {
    const start = new Date("2026-06-01T14:00:00.000Z");
    expect(isNearStartTime("2026-06-01T16:00:00.000Z", start)).toBe(true);
    expect(isNearStartTime("2026-06-03T14:00:00.000Z", start)).toBe(false);
    expect(isNearStartTime(undefined, start)).toBe(false);
  });
});

describe("FixtureFeatureSource", () => {
  it("is disabled when FEATURE_SOURCE_FIXTURE is unset", () => {
    const source = new FixtureFeatureSource();
    expect(source.enabled()).toBe(false);
  });

  it("returns null for an unknown market id", async () => {
    const source = new FixtureFeatureSource({ other: { x: 1 } }, true);
    const extras = await source.enrich({
      market: { id: "m1", slug: "m1", question: "?" },
      features: features(),
    } satisfies FeatureSourceInput);
    expect(extras).toBeNull();
  });
});
