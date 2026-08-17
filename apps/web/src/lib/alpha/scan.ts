import type {
  AgentAction,
  AlphaOpportunity,
  AlphaScanReport,
  MarketFeatures,
  MarketSnapshot,
  PriceBar,
  ScanAlphasInput,
} from "@polyagent/shared";
import { evaluateAlpha, getAlpha, listAlphas } from "./catalog";
import { computeMarketFeatures, DEFAULT_FEATURE_LOOKBACK } from "./features";
import { SCAN_LIMITATIONS } from "./playbook";
import { enrichMarketFeatures } from "./sources/registry";

export const DEFAULT_SCAN_LIMIT = 20;
export const DEFAULT_SCAN_UNIVERSE = 20;

export interface ScanMarketInput {
  market: MarketSnapshot;
  bars: PriceBar[];
}

export function opportunityRank(confidence: number, score: number): number {
  return confidence * Math.abs(score);
}

export function resolveScanAlphaIds(alphaIds?: string[]): string[] {
  if (!alphaIds?.length) {
    return listAlphas().map((alpha) => alpha.id);
  }
  for (const id of alphaIds) {
    if (!getAlpha(id)) {
      throw new Error(`Alpha not found: ${id}`);
    }
  }
  return alphaIds;
}

export function snapshotFromLastBar(bar: PriceBar): MarketSnapshot {
  return {
    id: bar.marketId,
    slug: bar.marketId,
    question: bar.marketId,
    yesPrice: bar.yesPrice,
    noPrice: bar.noPrice,
    volume24h: bar.volume24h,
    liquidity: 0,
    resolved: false,
  };
}

function compareOpportunities(a: AlphaOpportunity, b: AlphaOpportunity): number {
  const aActive = a.action === "HOLD" ? 0 : 1;
  const bActive = b.action === "HOLD" ? 0 : 1;
  if (aActive !== bActive) return bActive - aActive;
  if (a.rank !== b.rank) return b.rank - a.rank;
  return b.confidence - a.confidence;
}

export async function collectOpportunities(
  inputs: ScanMarketInput[],
  options: {
    alphaIds?: string[];
    minConfidence?: number;
    action?: AgentAction;
    lookback?: number;
    limit?: number;
    includeHolds?: boolean;
  } = {},
): Promise<AlphaScanReport> {
  const lookback = options.lookback ?? DEFAULT_FEATURE_LOOKBACK;
  const resultLimit = options.limit ?? DEFAULT_SCAN_LIMIT;
  const includeHolds = options.includeHolds ?? false;
  const minConfidence = options.minConfidence ?? 0;
  const alphaIds = resolveScanAlphaIds(options.alphaIds);

  const opportunities: AlphaOpportunity[] = [];
  let skipped = 0;

  for (const { market, bars } of inputs) {
    if (market.resolved) {
      skipped += 1;
      continue;
    }
    const computed = computeMarketFeatures(bars, lookback);
    if (!computed) {
      skipped += 1;
      continue;
    }
    const features = await enrichMarketFeatures(market, computed);
    opportunities.push(
      ...signalsForFeatures(market, features, alphaIds, {
        includeHolds,
        minConfidence,
        action: options.action,
      }),
    );
  }

  opportunities.sort(compareOpportunities);
  const trimmed = opportunities.slice(0, resultLimit);

  return {
    scanned: inputs.length,
    skipped,
    lookback,
    opportunities: trimmed,
    limitations: [...SCAN_LIMITATIONS],
  };
}

function signalsForFeatures(
  market: MarketSnapshot,
  features: MarketFeatures,
  alphaIds: string[],
  filters: {
    includeHolds: boolean;
    minConfidence: number;
    action?: AgentAction;
  },
): AlphaOpportunity[] {
  const out: AlphaOpportunity[] = [];
  for (const alphaId of alphaIds) {
    const signal = evaluateAlpha(alphaId, features);
    if (!filters.includeHolds && signal.action === "HOLD") continue;
    if (signal.confidence < filters.minConfidence) continue;
    if (filters.action && signal.action !== filters.action) continue;
    const definition = getAlpha(alphaId);
    out.push({
      marketId: market.id,
      question: market.question,
      slug: market.slug,
      yesPrice: market.yesPrice,
      noPrice: market.noPrice,
      volume24h: market.volume24h,
      alphaId,
      alphaName: definition?.name ?? alphaId,
      action: signal.action,
      score: signal.score,
      confidence: signal.confidence,
      reasoning: signal.reasoning,
      rank: opportunityRank(signal.confidence, signal.score),
      features,
    });
  }
  return out;
}

export function parseScanQuery(searchParams: URLSearchParams): ScanAlphasInput {
  const csv = (name: string): string[] | undefined => {
    const raw = searchParams.get(name);
    if (!raw) return undefined;
    const values = raw
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    return values.length > 0 ? values : undefined;
  };

  const numberParam = (name: string): number | undefined => {
    const raw = searchParams.get(name);
    if (raw === null || raw === "") return undefined;
    const value = Number(raw);
    return Number.isFinite(value) ? value : undefined;
  };

  const includeHoldsRaw = searchParams.get("includeHolds");
  const action = searchParams.get("action");
  const singleAlpha = searchParams.get("alphaId")?.trim();
  const alphaIds = csv("alphaIds") ?? (singleAlpha ? [singleAlpha] : undefined);

  return {
    marketIds: csv("marketIds"),
    alphaIds,
    minConfidence: numberParam("minConfidence"),
    action:
      action === "BUY_YES" || action === "BUY_NO" || action === "HOLD" || action === "SELL"
        ? action
        : undefined,
    lookback: numberParam("lookback"),
    limit: numberParam("limit"),
    universeLimit: numberParam("universeLimit"),
    includeHolds:
      includeHoldsRaw === null
        ? undefined
        : includeHoldsRaw === "1" || includeHoldsRaw.toLowerCase() === "true",
  };
}
