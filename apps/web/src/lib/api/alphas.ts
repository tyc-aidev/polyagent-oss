import type {
  AlphaDefinition,
  AlphaPlaybookStep,
  AlphaResearchReport,
  AlphaScanReport,
  AlphaSignal,
  FeatureSourceStatus,
  MarketFeatures,
  MarketSnapshot,
  PriceBar,
  ResearchAlphasInput,
  ScanAlphasInput,
} from "@polyagent/shared";
import { evaluateCatalog, getAlpha, listAlphas } from "@/lib/alpha/catalog";
import { computeMarketFeatures, DEFAULT_FEATURE_LOOKBACK } from "@/lib/alpha/features";
import { ALPHA_RESEARCH_PLAYBOOK } from "@/lib/alpha/playbook";
import {
  assembleResearchReport,
  DEFAULT_RESEARCH_UNIVERSE,
  fallbackOpportunities,
  researchCandidatesFromTape,
  researchTop,
} from "@/lib/alpha/research";
import { enrichMarketFeatures, listFeatureSources } from "@/lib/alpha/sources/registry";
import {
  collectOpportunities,
  DEFAULT_SCAN_UNIVERSE,
  resolveScanAlphaIds,
  snapshotFromLastBar,
} from "@/lib/alpha/scan";
import { listHistoryForMarkets, listMarketHistory } from "@/lib/alpha/snapshots";
import { getMarket, listMarkets } from "./markets";

export function listAlphaCatalog(): AlphaDefinition[] {
  return listAlphas();
}

export function getAlphaResearchPlaybook(): AlphaPlaybookStep[] {
  return ALPHA_RESEARCH_PLAYBOOK;
}

export function listAlphaFeatureSources(): FeatureSourceStatus[] {
  return listFeatureSources();
}

export function getAlphaDefinition(id: string): AlphaDefinition {
  const alpha = getAlpha(id);
  if (!alpha) {
    throw new Error(`Alpha not found: ${id}`);
  }
  return alpha;
}

function liveBarFromSnapshot(market: MarketSnapshot, timestamp = new Date()) {
  return {
    marketId: market.id,
    capturedAt: timestamp,
    yesPrice: market.yesPrice,
    noPrice: market.noPrice,
    volume24h: market.volume24h,
  };
}

export async function getMarketFeatures(
  marketId: string,
  lookback = DEFAULT_FEATURE_LOOKBACK,
  includeLive = true,
): Promise<{
  features: MarketFeatures;
  live: boolean;
  historySize: number;
  sources: FeatureSourceStatus[];
}> {
  const history = await listMarketHistory(marketId, { limit: Math.max(lookback + 1, 50) });
  let live = false;
  let market: MarketSnapshot | null = null;

  if (includeLive) {
    market = await getMarket(marketId);
    if (market) {
      history.push(liveBarFromSnapshot(market));
      live = true;
    }
  }

  const features = computeMarketFeatures(history, lookback);
  if (!features) {
    throw new Error(`No price history for market ${marketId}`);
  }

  const snapshot =
    market ??
    (history[history.length - 1]
      ? {
          id: marketId,
          slug: marketId,
          question: marketId,
          endDate: undefined,
        }
      : null);

  return {
    features: await enrichMarketFeatures(snapshot, features),
    live,
    historySize: history.length,
    sources: listFeatureSources(),
  };
}

export async function getMarketSignals(
  marketId: string,
  lookback = DEFAULT_FEATURE_LOOKBACK,
): Promise<{
  features: MarketFeatures;
  signals: AlphaSignal[];
  live: boolean;
  historySize: number;
  sources: FeatureSourceStatus[];
}> {
  const { features, live, historySize, sources } = await getMarketFeatures(marketId, lookback, true);
  return {
    features,
    signals: evaluateCatalog(features),
    live,
    historySize,
    sources,
  };
}

async function loadScanUniverse(input: ScanAlphasInput): Promise<MarketSnapshot[]> {
  const universeLimit = input.universeLimit ?? DEFAULT_SCAN_UNIVERSE;
  if (input.marketIds && input.marketIds.length > 0) {
    const markets: MarketSnapshot[] = [];
    for (const id of input.marketIds) {
      try {
        const live = await getMarket(id);
        if (live) markets.push(live);
      } catch {
        // History fallback below.
      }
    }
    return markets;
  }
  return listMarkets(universeLimit);
}

function groupBars(bars: PriceBar[]): Map<string, PriceBar[]> {
  const grouped = new Map<string, PriceBar[]>();
  for (const bar of bars) {
    const existing = grouped.get(bar.marketId) ?? [];
    existing.push(bar);
    grouped.set(bar.marketId, existing);
  }
  return grouped;
}

export async function scanAlphaOpportunities(input: ScanAlphasInput): Promise<AlphaScanReport> {
  resolveScanAlphaIds(input.alphaIds);

  const liveMarkets = await loadScanUniverse(input);
  const liveById = new Map(liveMarkets.map((market) => [market.id, market]));
  const requestedIds =
    input.marketIds && input.marketIds.length > 0
      ? input.marketIds
      : liveMarkets.map((market) => market.id);

  const history = await listHistoryForMarkets(requestedIds, {
    limit: Math.min(requestedIds.length * Math.max((input.lookback ?? DEFAULT_FEATURE_LOOKBACK) + 1, 20), 5_000),
  });
  const historyByMarket = groupBars(history);

  const inputs = requestedIds.flatMap((id) => {
    const historyBars = historyByMarket.get(id) ?? [];
    const lastBar = historyBars[historyBars.length - 1];
    const market = liveById.get(id) ?? (lastBar ? snapshotFromLastBar(lastBar) : null);
    if (!market) return [];
    const bars = market.resolved
      ? historyBars
      : [...historyBars, liveBarFromSnapshot(market)];
    return [{ market, bars }];
  });

  return collectOpportunities(inputs, {
    alphaIds: input.alphaIds,
    minConfidence: input.minConfidence,
    action: input.action,
    lookback: input.lookback,
    limit: input.limit,
    includeHolds: input.includeHolds,
    hasEvent: input.hasEvent,
  });
}

export async function runAlphaResearch(input: ResearchAlphasInput): Promise<AlphaResearchReport> {
  const top = researchTop(input);
  const scan = await scanAlphaOpportunities({
    marketIds: input.marketIds,
    alphaIds: input.alphaIds,
    minConfidence: input.minConfidence,
    action: input.action,
    lookback: input.lookback,
    universeLimit: input.universeLimit ?? DEFAULT_RESEARCH_UNIVERSE,
    limit: Math.max(top, 10),
    includeHolds: false,
    hasEvent: input.hasEvent,
  });

  const liveHits = scan.opportunities.slice(0, top);
  const picked =
    liveHits.length > 0
      ? liveHits
      : fallbackOpportunities(input.marketIds ?? [], input.alphaIds, top);
  const marketIds = [...new Set(picked.map((item) => item.marketId))];
  const history = await listHistoryForMarkets(marketIds, { limit: 2_000 });
  const barsByMarket = groupBars(history);
  const candidates = researchCandidatesFromTape(picked, barsByMarket, {
    startingBalance: input.startingBalance,
    maxPositionSize: input.maxPositionSize,
    lookback: input.lookback,
    steps: input.steps,
    split: input.split,
  });

  return assembleResearchReport(scan, candidates);
}
