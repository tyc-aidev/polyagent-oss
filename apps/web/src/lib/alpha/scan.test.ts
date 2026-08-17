import { describe, expect, it } from "vitest";
import type { MarketSnapshot, PriceBar } from "@polyagent/shared";
import {
  collectOpportunities,
  opportunityRank,
  parseScanQuery,
  resolveScanAlphaIds,
  snapshotFromLastBar,
} from "./scan";

function market(id: string, overrides: Partial<MarketSnapshot> = {}): MarketSnapshot {
  return {
    id,
    slug: id,
    question: `${id}?`,
    yesPrice: 0.2,
    noPrice: 0.8,
    volume24h: 2_000,
    liquidity: 500,
    resolved: false,
    ...overrides,
  };
}

function bar(marketId: string, yesPrice: number, capturedAt: string, volume24h = 2_000): PriceBar {
  return {
    marketId,
    capturedAt: new Date(capturedAt),
    yesPrice,
    noPrice: 1 - yesPrice,
    volume24h,
  };
}

describe("resolveScanAlphaIds", () => {
  it("defaults to the full catalog", () => {
    expect(resolveScanAlphaIds()).toContain("threshold_yes");
    expect(resolveScanAlphaIds()?.length).toBeGreaterThanOrEqual(6);
  });

  it("throws for an unknown alpha", () => {
    expect(() => resolveScanAlphaIds(["missing"])).toThrow(/not found/i);
  });
});

describe("collectOpportunities", () => {
  it("ranks cheap YES markets onto threshold_yes", async () => {
    const report = await collectOpportunities(
      [
        {
          market: market("cheap"),
          bars: [bar("cheap", 0.18, "2026-01-01T00:00:00.000Z")],
        },
        {
          market: market("fair", { yesPrice: 0.5, noPrice: 0.5 }),
          bars: [bar("fair", 0.5, "2026-01-01T00:00:00.000Z")],
        },
      ],
      { alphaIds: ["threshold_yes"], minConfidence: 0 },
    );

    expect(report.scanned).toBe(2);
    expect(report.opportunities.length).toBeGreaterThan(0);
    expect(report.opportunities[0]?.marketId).toBe("cheap");
    expect(report.opportunities[0]?.alphaId).toBe("threshold_yes");
    expect(report.opportunities[0]?.action).toBe("BUY_YES");
    expect(report.opportunities.every((item) => item.action !== "HOLD")).toBe(true);
    expect(report.limitations.length).toBeGreaterThan(0);
  });

  it("skips resolved markets and can include HOLDs", async () => {
    const report = await collectOpportunities(
      [
        {
          market: market("done", { resolved: true }),
          bars: [bar("done", 0.1, "2026-01-01T00:00:00.000Z")],
        },
        {
          market: market("mid", { yesPrice: 0.5, noPrice: 0.5 }),
          bars: [bar("mid", 0.5, "2026-01-01T00:00:00.000Z")],
        },
      ],
      { alphaIds: ["threshold_yes"], includeHolds: true },
    );

    expect(report.skipped).toBe(1);
    expect(report.opportunities).toHaveLength(1);
    expect(report.opportunities[0]?.action).toBe("HOLD");
  });

  it("filters by action and respects limit", async () => {
    const report = await collectOpportunities(
      [
        {
          market: market("a"),
          bars: [bar("a", 0.1, "2026-01-01T00:00:00.000Z")],
        },
        {
          market: market("b", { yesPrice: 0.12, noPrice: 0.88 }),
          bars: [bar("b", 0.12, "2026-01-01T00:00:00.000Z")],
        },
      ],
      { alphaIds: ["threshold_yes", "extreme_mispricing"], action: "BUY_YES", limit: 1 },
    );

    expect(report.opportunities).toHaveLength(1);
    expect(report.opportunities[0]?.action).toBe("BUY_YES");
  });
});

describe("opportunityRank", () => {
  it("uses confidence times absolute score", () => {
    expect(opportunityRank(0.5, -0.8)).toBeCloseTo(0.4);
  });
});

describe("parseScanQuery", () => {
  it("parses comma-separated filters", () => {
    const parsed = parseScanQuery(
      new URLSearchParams(
        "marketIds=m1,m2&alphaId=momentum&minConfidence=0.25&action=BUY_NO&includeHolds=1&limit=5",
      ),
    );
    expect(parsed.marketIds).toEqual(["m1", "m2"]);
    expect(parsed.alphaIds).toEqual(["momentum"]);
    expect(parsed.minConfidence).toBe(0.25);
    expect(parsed.action).toBe("BUY_NO");
    expect(parsed.includeHolds).toBe(true);
    expect(parsed.limit).toBe(5);
  });
});

describe("snapshotFromLastBar", () => {
  it("builds a stub market when Gamma is unavailable", () => {
    const snap = snapshotFromLastBar(bar("hist-1", 0.33, "2026-01-01T00:00:00.000Z"));
    expect(snap.id).toBe("hist-1");
    expect(snap.yesPrice).toBe(0.33);
    expect(snap.resolved).toBe(false);
  });
});
