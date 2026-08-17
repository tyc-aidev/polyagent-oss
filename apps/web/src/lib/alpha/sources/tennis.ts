import type { EventFeatureValue, FeatureSource, FeatureSourceInput } from "@polyagent/shared";
import { isNearStartTime, scoreMarketNameMatch } from "./match";

/**
 * Live Tennis API FeatureSource (https://livetennisapi.com).
 *
 * Disclosure: the Live Tennis API is operated by this source's contributor
 * (bensynapse). REST-only; the free tier (30 req/min, 100 req/day) is enough
 * to develop and test this source, not to poll continuously — see README.
 *
 * Disabled unless LIVETENNIS_API_KEY is set; when disabled nothing else
 * changes. Never throws into harvest, ticks, or catalog evaluation: every
 * failure path returns null extras.
 */
export const TENNIS_SOURCE_ID = "tennis";
export const TENNIS_API_KEY_ENV = "LIVETENNIS_API_KEY";
export const TENNIS_API_BASE_ENV = "LIVETENNIS_API_BASE";
export const TENNIS_MATCH_MAP_ENV = "LIVETENNIS_MATCH_MAP";
export const TENNIS_CACHE_TTL_ENV = "LIVETENNIS_CACHE_TTL_SECONDS";

const DEFAULT_BASE_URL = "https://api.livetennisapi.com/api/public/v1";
const DEFAULT_CACHE_TTL_SECONDS = 60;
const REQUEST_TIMEOUT_MS = 5_000;

export interface TennisScore {
  sets?: number[] | null;
  games?: number[][] | null;
  points?: (string | null)[] | null;
  server?: 1 | 2 | null;
  is_tiebreak?: boolean | null;
}

export interface TennisPlayer {
  id?: number;
  name?: string | null;
  ranking?: number | null;
}

export interface TennisMatch {
  id?: number;
  status?: string | null;
  scheduled_time?: string | null;
  players?: { p1?: TennisPlayer | null; p2?: TennisPlayer | null } | null;
  score?: TennisScore | null;
}

/** Explicit Gamma marketId → Live Tennis matchId bindings (preferred over heuristics). */
export function parseMatchMap(raw: string | undefined): Record<string, number> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: Record<string, number> = {};
    for (const [marketId, matchId] of Object.entries(parsed as Record<string, unknown>)) {
      const id = Number(matchId);
      if (Number.isFinite(id)) out[marketId] = id;
    }
    return out;
  } catch {
    return {};
  }
}

const BREAKABLE_SERVER_POINTS = new Set(["0", "15", "30"]);

/**
 * True when the current server is facing a break point: receiver at "AD", or
 * receiver at "40" while the server is at "0"/"15"/"30". Never true in a
 * tiebreak, and false whenever the server or either point value is unknown.
 */
export function isBreakPoint(score: TennisScore | null | undefined): boolean {
  if (!score || score.is_tiebreak) return false;
  const server = score.server;
  if (server !== 1 && server !== 2) return false;
  const points = score.points;
  if (!Array.isArray(points) || points.length < 2) return false;
  const serverPoints = points[server - 1];
  const receiverPoints = points[server === 1 ? 1 : 0];
  if (serverPoints == null || receiverPoints == null) return false;
  if (receiverPoints === "AD") return true;
  return receiverPoints === "40" && BREAKABLE_SERVER_POINTS.has(serverPoints);
}

function currentSetGames(score: TennisScore): { p1: number; p2: number } | null {
  const games = score.games;
  if (!Array.isArray(games) || games.length < 2) return null;
  const [p1Sets, p2Sets] = games;
  if (!Array.isArray(p1Sets) || !Array.isArray(p2Sets) || p1Sets.length === 0) return null;
  const index = Math.min(p1Sets.length, p2Sets.length) - 1;
  if (index < 0) return null;
  const p1 = p1Sets[index];
  const p2 = p2Sets[index];
  if (typeof p1 !== "number" || typeof p2 !== "number") return null;
  return { p1, p2 };
}

/** The better-ranked player (1|2), or null when either ranking is missing or they tie. */
export function favoritePlayer(match: TennisMatch): 1 | 2 | null {
  const r1 = match.players?.p1?.ranking;
  const r2 = match.players?.p2?.ranking;
  if (typeof r1 !== "number" || typeof r2 !== "number" || r1 === r2) return null;
  return r1 < r2 ? 1 : 2;
}

/**
 * Numeric-coercible extras for `features.event.tennis` (booleans coerce to
 * 0/1 in the `event_threshold` catalog alpha). Every value is derived from
 * the free-tier score snapshot; extras that cannot be derived are omitted,
 * never guessed. Returns null when the match has no score at all.
 *
 * - `breakPoint` — current server faces a break point (see isBreakPoint)
 * - `inTiebreak` — current game is a tiebreak
 * - `favoriteDownBreak` — better-ranked player is net down a break in the
 *   current set: down ≥2 games (impossible on serve alone), or down exactly 1
 *   while receiving (a 1-game deficit with the trailer serving is on-serve)
 * - `favoriteServing` — better-ranked player is serving
 * - `favoriteSetsLead` — favorite's sets won minus opponent's
 * - `favoriteGamesLead` — favorite's games minus opponent's in the current set
 *
 * The `favorite*` extras require both rankings and are omitted otherwise.
 */
export function deriveTennisExtras(match: TennisMatch): Record<string, EventFeatureValue> | null {
  const score = match.score;
  if (!score) return null;

  const extras: Record<string, EventFeatureValue> = {};
  const favorite = favoritePlayer(match);
  const server = score.server === 1 || score.server === 2 ? score.server : null;
  const games = currentSetGames(score);

  if (favorite !== null && games !== null) {
    const deficit = favorite === 1 ? games.p2 - games.p1 : games.p1 - games.p2;
    extras.favoriteDownBreak = deficit >= 2 || (deficit === 1 && server !== null && server !== favorite);
  }
  extras.breakPoint = isBreakPoint(score);
  extras.inTiebreak = score.is_tiebreak === true;
  if (favorite !== null && server !== null) {
    extras.favoriteServing = server === favorite;
  }
  if (favorite !== null && Array.isArray(score.sets) && score.sets.length >= 2) {
    const [p1Sets, p2Sets] = score.sets;
    if (typeof p1Sets === "number" && typeof p2Sets === "number") {
      extras.favoriteSetsLead = favorite === 1 ? p1Sets - p2Sets : p2Sets - p1Sets;
    }
  }
  if (favorite !== null && games !== null) {
    extras.favoriteGamesLead = favorite === 1 ? games.p1 - games.p2 : games.p2 - games.p1;
  }
  return extras;
}

/** Market questions usually carry surnames, the API carries full names — accept either. */
function playerNamed(question: string, name: string | null | undefined): boolean {
  if (typeof name !== "string" || name.trim().length === 0) return false;
  const tokens = name.trim().split(/\s+/);
  const surname = tokens[tokens.length - 1];
  return scoreMarketNameMatch(question, surname === name ? [name] : [name, surname]) > 0;
}

/**
 * Pick the live match for a Gamma market. An explicit marketId → matchId
 * binding always wins; the name/time heuristic (both player surnames in the
 * market question, start time as a tiebreaker) is a fallback and returns null
 * on any ambiguity rather than enriching the wrong match.
 */
export function matchForMarket(
  market: FeatureSourceInput["market"],
  matches: TennisMatch[],
  matchMap: Record<string, number>,
): TennisMatch | null {
  const explicitId = matchMap[market.id];
  if (explicitId !== undefined) {
    return matches.find((match) => match.id === explicitId) ?? null;
  }

  const candidates = matches.filter((match) => {
    const p1 = match.players?.p1?.name;
    const p2 = match.players?.p2?.name;
    return playerNamed(market.question, p1) && playerNamed(market.question, p2);
  });
  if (candidates.length === 1) return candidates[0];
  if (candidates.length === 0) return null;

  const nearStart = candidates.filter((match) => {
    const start = match.scheduled_time ? new Date(match.scheduled_time) : null;
    return start !== null && !Number.isNaN(start.getTime()) && isNearStartTime(market.endDate, start);
  });
  return nearStart.length === 1 ? nearStart[0] : null;
}

interface LiveMatchCache {
  expiresAt: number;
  matches: TennisMatch[];
}

/**
 * REST-only, free-tier Live Tennis API source. One cached GET
 * /matches?status=live per TTL serves every market in a tick; failures are
 * negative-cached for the same TTL so an outage or 429 is never hammered.
 */
export class TennisFeatureSource implements FeatureSource {
  readonly id = TENNIS_SOURCE_ID;

  private cache: LiveMatchCache | null = null;

  constructor(
    private readonly fetchFn: typeof fetch = fetch,
    private readonly now: () => number = Date.now,
  ) {}

  enabled(): boolean {
    return Boolean(process.env[TENNIS_API_KEY_ENV]);
  }

  async enrich(input: FeatureSourceInput): Promise<Record<string, EventFeatureValue> | null> {
    if (!this.enabled()) return null;
    const matches = await this.liveMatches();
    const matchMap = parseMatchMap(process.env[TENNIS_MATCH_MAP_ENV]);
    const match = matchForMarket(input.market, matches, matchMap);
    if (!match) return null;
    return deriveTennisExtras(match);
  }

  private ttlMs(): number {
    const ttl = Number(process.env[TENNIS_CACHE_TTL_ENV] ?? DEFAULT_CACHE_TTL_SECONDS);
    return (Number.isFinite(ttl) && ttl > 0 ? ttl : DEFAULT_CACHE_TTL_SECONDS) * 1_000;
  }

  private async liveMatches(): Promise<TennisMatch[]> {
    if (this.cache && this.cache.expiresAt > this.now()) return this.cache.matches;

    let matches: TennisMatch[] = [];
    try {
      const baseUrl = process.env[TENNIS_API_BASE_ENV] ?? DEFAULT_BASE_URL;
      const response = await this.fetchFn(`${baseUrl}/matches?status=live`, {
        headers: { Authorization: `Bearer ${process.env[TENNIS_API_KEY_ENV]}` },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (response.ok) {
        const body = (await response.json()) as { data?: unknown };
        if (Array.isArray(body.data)) matches = body.data as TennisMatch[];
      }
    } catch {
      // Fail soft: an unreachable or rate-limited API yields no extras.
    }

    this.cache = { expiresAt: this.now() + this.ttlMs(), matches };
    return matches;
  }
}
