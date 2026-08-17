import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FeatureSourceInput, MarketFeatures } from "@polyagent/shared";
import { FeatureRegistry } from "./registry";
import {
  TENNIS_API_KEY_ENV,
  TENNIS_CACHE_TTL_ENV,
  TENNIS_MATCH_MAP_ENV,
  TennisFeatureSource,
  type TennisMatch,
  type TennisScore,
  deriveTennisExtras,
  favoritePlayer,
  isBreakPoint,
  matchForMarket,
  parseMatchMap,
} from "./tennis";

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

function input(overrides: Partial<FeatureSourceInput["market"]> = {}): FeatureSourceInput {
  return {
    market: { id: "m1", slug: "m1", question: "Will Djokovic beat Alcaraz?", ...overrides },
    features: features(),
  };
}

function score(overrides: Partial<TennisScore> = {}): TennisScore {
  return {
    sets: [0, 0],
    games: [[3], [4]],
    points: ["30", "40"],
    server: 1,
    is_tiebreak: false,
    ...overrides,
  };
}

function match(overrides: Partial<TennisMatch> = {}): TennisMatch {
  return {
    id: 101,
    status: "live",
    scheduled_time: "2026-06-01T14:00:00.000Z",
    players: {
      p1: { id: 1, name: "Novak Djokovic", ranking: 1 },
      p2: { id: 2, name: "Carlos Alcaraz", ranking: 2 },
    },
    score: score(),
    ...overrides,
  };
}

function liveResponse(matches: TennisMatch[]): Response {
  return new Response(JSON.stringify({ data: matches, meta: { count: matches.length } }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

const originalEnv = {
  key: process.env[TENNIS_API_KEY_ENV],
  map: process.env[TENNIS_MATCH_MAP_ENV],
  ttl: process.env[TENNIS_CACHE_TTL_ENV],
};

beforeEach(() => {
  delete process.env[TENNIS_API_KEY_ENV];
  delete process.env[TENNIS_MATCH_MAP_ENV];
  delete process.env[TENNIS_CACHE_TTL_ENV];
});

afterEach(() => {
  if (originalEnv.key === undefined) delete process.env[TENNIS_API_KEY_ENV];
  else process.env[TENNIS_API_KEY_ENV] = originalEnv.key;
  if (originalEnv.map === undefined) delete process.env[TENNIS_MATCH_MAP_ENV];
  else process.env[TENNIS_MATCH_MAP_ENV] = originalEnv.map;
  if (originalEnv.ttl === undefined) delete process.env[TENNIS_CACHE_TTL_ENV];
  else process.env[TENNIS_CACHE_TTL_ENV] = originalEnv.ttl;
});

describe("TennisFeatureSource enablement", () => {
  it("is disabled when LIVETENNIS_API_KEY is unset and never calls the API", async () => {
    const fetchFn = vi.fn();
    const source = new TennisFeatureSource(fetchFn);
    expect(source.enabled()).toBe(false);
    expect(await source.enrich(input())).toBeNull();
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("leaves registry features unchanged when the key is unset", async () => {
    const registry = new FeatureRegistry([new TennisFeatureSource(vi.fn())]);
    const enriched = await registry.enrich(
      { id: "m1", slug: "m1", question: "Will Djokovic beat Alcaraz?" },
      features(),
    );
    expect(enriched.event).toBeUndefined();
    expect(registry.list()).toEqual([{ id: "tennis", enabled: false }]);
  });

  it("is enabled when LIVETENNIS_API_KEY is set", () => {
    process.env[TENNIS_API_KEY_ENV] = "test-key";
    expect(new TennisFeatureSource(vi.fn()).enabled()).toBe(true);
  });
});

describe("TennisFeatureSource enrich", () => {
  it("matches by explicit marketId binding before any heuristic", async () => {
    process.env[TENNIS_API_KEY_ENV] = "test-key";
    process.env[TENNIS_MATCH_MAP_ENV] = JSON.stringify({ m1: 202 });
    const decoy = match(); // heuristic would pick this one (names in the question)
    const bound = match({
      id: 202,
      players: {
        p1: { id: 3, name: "Iga Swiatek", ranking: 1 },
        p2: { id: 4, name: "Aryna Sabalenka", ranking: 2 },
      },
      score: score({ sets: [1, 0], games: [[6, 2], [4, 1]], points: ["15", "0"], server: 1 }),
    });
    const fetchFn = vi.fn().mockResolvedValue(liveResponse([decoy, bound]));
    const extras = await new TennisFeatureSource(fetchFn).enrich(input());
    expect(extras?.favoriteSetsLead).toBe(1);
    expect(extras?.favoriteGamesLead).toBe(1);
  });

  it("falls back to the name heuristic and namespaces extras under event.tennis", async () => {
    process.env[TENNIS_API_KEY_ENV] = "test-key";
    const other = match({
      id: 303,
      players: {
        p1: { id: 5, name: "Jannik Sinner", ranking: 3 },
        p2: { id: 6, name: "Alexander Zverev", ranking: 4 },
      },
    });
    const fetchFn = vi.fn().mockResolvedValue(liveResponse([other, match()]));
    const registry = new FeatureRegistry([new TennisFeatureSource(fetchFn)]);
    const enriched = await registry.enrich(
      { id: "m1", slug: "m1", question: "Will Djokovic beat Alcaraz?" },
      features(),
    );
    // Djokovic (ranking 1) serves at 30-40, trailing 3-4: facing a break point, still on serve.
    expect(enriched.event?.tennis).toEqual({
      favoriteDownBreak: false,
      breakPoint: true,
      inTiebreak: false,
      favoriteServing: true,
      favoriteSetsLead: 0,
      favoriteGamesLead: -1,
    });
  });

  it("returns null instead of guessing when two live matches fit the question", async () => {
    process.env[TENNIS_API_KEY_ENV] = "test-key";
    const rematch = match({ id: 404, scheduled_time: "2026-06-08T14:00:00.000Z" });
    const fetchFn = vi.fn().mockResolvedValue(liveResponse([match(), rematch]));
    const extras = await new TennisFeatureSource(fetchFn).enrich(input());
    expect(extras).toBeNull();
  });

  it("uses market endDate near the scheduled start to break a name tie", async () => {
    process.env[TENNIS_API_KEY_ENV] = "test-key";
    const rematch = match({ id: 404, scheduled_time: "2026-06-08T14:00:00.000Z" });
    const fetchFn = vi.fn().mockResolvedValue(liveResponse([match(), rematch]));
    const extras = await new TennisFeatureSource(fetchFn).enrich(
      input({ endDate: "2026-06-08T16:00:00.000Z" }),
    );
    expect(extras).not.toBeNull();
  });

  it("returns null when no live match involves the market's players", async () => {
    process.env[TENNIS_API_KEY_ENV] = "test-key";
    const fetchFn = vi.fn().mockResolvedValue(liveResponse([match()]));
    const extras = await new TennisFeatureSource(fetchFn).enrich(
      input({ question: "Will Nadal beat Federer?" }),
    );
    expect(extras).toBeNull();
  });

  it("serves every market in a tick from one cached live-matches call", async () => {
    process.env[TENNIS_API_KEY_ENV] = "test-key";
    const fetchFn = vi.fn().mockResolvedValue(liveResponse([match()]));
    const source = new TennisFeatureSource(fetchFn, () => 0);
    await source.enrich(input());
    await source.enrich(input({ id: "m2", slug: "m2" }));
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("refetches after the cache TTL elapses", async () => {
    process.env[TENNIS_API_KEY_ENV] = "test-key";
    process.env[TENNIS_CACHE_TTL_ENV] = "60";
    let now = 0;
    const fetchFn = vi.fn().mockResolvedValue(liveResponse([match()]));
    const source = new TennisFeatureSource(fetchFn, () => now);
    await source.enrich(input());
    now = 61_000;
    await source.enrich(input());
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });
});

describe("TennisFeatureSource fail-soft", () => {
  it("returns null when the API is unreachable and never throws", async () => {
    process.env[TENNIS_API_KEY_ENV] = "test-key";
    const fetchFn = vi.fn().mockRejectedValue(new Error("upstream down"));
    await expect(new TennisFeatureSource(fetchFn).enrich(input())).resolves.toBeNull();
  });

  it("returns null on a non-OK response (401/429) and never throws", async () => {
    process.env[TENNIS_API_KEY_ENV] = "test-key";
    const fetchFn = vi.fn().mockResolvedValue(new Response("{}", { status: 429 }));
    await expect(new TennisFeatureSource(fetchFn).enrich(input())).resolves.toBeNull();
  });

  it("returns null on a malformed body and never throws", async () => {
    process.env[TENNIS_API_KEY_ENV] = "test-key";
    const fetchFn = vi.fn().mockResolvedValue(new Response("not json", { status: 200 }));
    await expect(new TennisFeatureSource(fetchFn).enrich(input())).resolves.toBeNull();
  });

  it("negative-caches a failure so an outage is not hammered within the TTL", async () => {
    process.env[TENNIS_API_KEY_ENV] = "test-key";
    const fetchFn = vi.fn().mockRejectedValue(new Error("upstream down"));
    const source = new TennisFeatureSource(fetchFn, () => 0);
    await source.enrich(input());
    await source.enrich(input());
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("keeps other sources working through a tennis failure via the registry", async () => {
    process.env[TENNIS_API_KEY_ENV] = "test-key";
    const fetchFn = vi.fn().mockRejectedValue(new Error("upstream down"));
    const registry = new FeatureRegistry([new TennisFeatureSource(fetchFn)]);
    const enriched = await registry.enrich(
      { id: "m1", slug: "m1", question: "Will Djokovic beat Alcaraz?" },
      features(),
    );
    expect(enriched.event).toBeUndefined();
    expect(enriched.yesPrice).toBe(0.4);
  });
});

describe("isBreakPoint", () => {
  it("fires when the receiver is at AD", () => {
    expect(isBreakPoint(score({ points: ["40", "AD"], server: 1 }))).toBe(true);
  });

  it("fires when the receiver is at 40 against 0/15/30", () => {
    expect(isBreakPoint(score({ points: ["0", "40"], server: 1 }))).toBe(true);
    expect(isBreakPoint(score({ points: ["15", "40"], server: 1 }))).toBe(true);
    expect(isBreakPoint(score({ points: ["40", "30"], server: 2 }))).toBe(true);
  });

  it("does not fire at deuce or when the server is at AD", () => {
    expect(isBreakPoint(score({ points: ["40", "40"], server: 1 }))).toBe(false);
    expect(isBreakPoint(score({ points: ["AD", "40"], server: 1 }))).toBe(false);
  });

  it("never fires in a tiebreak", () => {
    expect(isBreakPoint(score({ points: ["6", "5"], server: 2, is_tiebreak: true }))).toBe(false);
  });

  it("is false on a null server or null points, as observed on completed matches", () => {
    expect(isBreakPoint(score({ server: null }))).toBe(false);
    expect(isBreakPoint(score({ points: [null, "40"], server: 1 }))).toBe(false);
    expect(isBreakPoint(score({ points: ["30", null], server: 1 }))).toBe(false);
    expect(isBreakPoint(null)).toBe(false);
  });
});

describe("deriveTennisExtras", () => {
  it("marks the favorite down a break when trailing by two games", () => {
    const extras = deriveTennisExtras(match({ score: score({ games: [[2], [4]], points: ["0", "0"] }) }));
    expect(extras?.favoriteDownBreak).toBe(true);
  });

  it("marks a one-game deficit as a break only when the favorite is receiving", () => {
    const receiving = deriveTennisExtras(match({ score: score({ games: [[3], [4]], server: 2 }) }));
    expect(receiving?.favoriteDownBreak).toBe(true);
    const serving = deriveTennisExtras(match({ score: score({ games: [[3], [4]], server: 1 }) }));
    expect(serving?.favoriteDownBreak).toBe(false);
  });

  it("reads the current set from multi-set games arrays", () => {
    const extras = deriveTennisExtras(
      match({ score: score({ sets: [1, 0], games: [[6, 1], [4, 3]], server: 1 }) }),
    );
    expect(extras?.favoriteSetsLead).toBe(1);
    expect(extras?.favoriteGamesLead).toBe(-2);
    expect(extras?.favoriteDownBreak).toBe(true);
  });

  it("omits favorite extras when a ranking is missing, keeping neutral ones", () => {
    const unranked = match({
      players: {
        p1: { id: 1, name: "Novak Djokovic", ranking: null },
        p2: { id: 2, name: "Carlos Alcaraz", ranking: 2 },
      },
    });
    const extras = deriveTennisExtras(unranked);
    expect(extras).toEqual({ breakPoint: true, inTiebreak: false });
  });

  it("reports the tiebreak and no break state at 6-6", () => {
    const extras = deriveTennisExtras(
      match({ score: score({ games: [[6], [6]], points: ["3", "2"], is_tiebreak: true, server: 2 }) }),
    );
    expect(extras?.inTiebreak).toBe(true);
    expect(extras?.breakPoint).toBe(false);
    expect(extras?.favoriteDownBreak).toBe(false);
  });

  it("returns null when the match has no score yet", () => {
    expect(deriveTennisExtras(match({ score: null }))).toBeNull();
  });
});

describe("favoritePlayer", () => {
  it("prefers the better (lower) ranking and refuses ties", () => {
    expect(favoritePlayer(match())).toBe(1);
    expect(
      favoritePlayer(
        match({
          players: {
            p1: { id: 1, name: "A", ranking: 30 },
            p2: { id: 2, name: "B", ranking: 5 },
          },
        }),
      ),
    ).toBe(2);
    expect(
      favoritePlayer(
        match({ players: { p1: { id: 1, name: "A", ranking: 5 }, p2: { id: 2, name: "B", ranking: 5 } } }),
      ),
    ).toBeNull();
  });
});

describe("parseMatchMap", () => {
  it("parses marketId → matchId bindings and drops non-numeric ids", () => {
    expect(parseMatchMap('{"m1": 202, "m2": "303", "m3": "nope"}')).toEqual({ m1: 202, m2: 303 });
  });

  it("returns an empty map on malformed JSON", () => {
    expect(parseMatchMap("not json")).toEqual({});
    expect(parseMatchMap(undefined)).toEqual({});
  });
});

describe("matchForMarket", () => {
  it("returns null when an explicit binding points at a match that is not live", () => {
    expect(matchForMarket(input().market, [match()], { m1: 999 })).toBeNull();
  });

  it("matches surnames in the question against full API names", () => {
    expect(matchForMarket(input().market, [match()], {})).toEqual(match());
  });
});
