import type {
  AlphaOpportunity,
  AlphaResearchCandidate,
  AlphaResearchReport,
  BacktestSplitInput,
  PriceBar,
  ResearchAlphasInput,
} from "@polyagent/shared";
import { getAlpha, listAlphas } from "./catalog";
import { uniqueTimestamps } from "./split";
import { runSweep } from "./sweep";

export const DEFAULT_RESEARCH_TOP = 3;
export const DEFAULT_RESEARCH_UNIVERSE = 10;
export const MIN_SWEEP_BARS = 2;
export const MIN_HOLDOUT_TIMESTAMPS = 4;

export const RESEARCH_LIMITATIONS = [
  "Research composes scan → sweep on stored/imported bars. A live signal is not a backtest.",
  "Sweep is skipped when the tape is thinner than 2 bars (holdout needs 4 unique timestamps).",
  "Winning parameters are in-sample unless split is set. Even OOS on a harvested tape is not live trading.",
  "Paper trading only. Not financial advice and not a live execution path.",
] as const;

export function promotePayload(
  alphaId: string,
  parameters: Record<string, number> = {},
): AlphaResearchCandidate["promote"] {
  return { strategy: { type: "alpha", alphaId, parameters } };
}

function canSweep(bars: PriceBar[], split?: BacktestSplitInput): string | null {
  if (bars.length < MIN_SWEEP_BARS) {
    return "Not enough stored bars to sweep. Import history or wait for harvest.";
  }
  if (split?.mode === "holdout" && uniqueTimestamps(bars).length < MIN_HOLDOUT_TIMESTAMPS) {
    return "Holdout split needs at least 4 unique timestamps.";
  }
  if (split?.mode === "walk_forward") {
    const folds = split.folds ?? 3;
    const need = (folds + 1) * 2;
    if (uniqueTimestamps(bars).length < need) {
      return `Walk-forward with ${folds} folds needs at least ${need} unique timestamps.`;
    }
  }
  return null;
}

export function researchCandidatesFromTape(
  opportunities: AlphaOpportunity[],
  barsByMarket: Map<string, PriceBar[]>,
  options: {
    startingBalance?: number;
    maxPositionSize?: number;
    lookback?: number;
    steps?: number;
    split?: BacktestSplitInput;
  } = {},
): AlphaResearchCandidate[] {
  const candidates: AlphaResearchCandidate[] = [];

  for (const opportunity of opportunities) {
    const bars = barsByMarket.get(opportunity.marketId) ?? [];
    const blocked = canSweep(bars, options.split);
    if (blocked) {
      candidates.push({
        marketId: opportunity.marketId,
        question: opportunity.question,
        alphaId: opportunity.alphaId,
        alphaName: opportunity.alphaName,
        liveSignal: opportunity,
        sweep: null,
        skippedReason: blocked,
        promote: promotePayload(opportunity.alphaId),
      });
      continue;
    }

    try {
      const definition = getAlpha(opportunity.alphaId);
      const steps =
        options.steps && definition
          ? Object.fromEntries(definition.parameters.map((spec) => [spec.name, options.steps as number]))
          : undefined;
      const sweep = runSweep({
        alphaId: opportunity.alphaId,
        bars,
        steps,
        startingBalance: options.startingBalance,
        maxPositionSize: options.maxPositionSize,
        lookback: options.lookback,
        split: options.split,
      });
      candidates.push({
        marketId: opportunity.marketId,
        question: opportunity.question,
        alphaId: opportunity.alphaId,
        alphaName: opportunity.alphaName,
        liveSignal: opportunity,
        sweep,
        promote: promotePayload(opportunity.alphaId, sweep.winner?.parameters ?? {}),
      });
    } catch (error) {
      candidates.push({
        marketId: opportunity.marketId,
        question: opportunity.question,
        alphaId: opportunity.alphaId,
        alphaName: opportunity.alphaName,
        liveSignal: opportunity,
        sweep: null,
        skippedReason: error instanceof Error ? error.message : "Sweep failed",
        promote: promotePayload(opportunity.alphaId),
      });
    }
  }

  candidates.sort((a, b) => (b.sweep?.winner?.score ?? Number.NEGATIVE_INFINITY) - (a.sweep?.winner?.score ?? Number.NEGATIVE_INFINITY));
  return candidates;
}

export function assembleResearchReport(
  scan: AlphaResearchReport["scan"],
  candidates: AlphaResearchCandidate[],
): AlphaResearchReport {
  return {
    scan,
    candidates,
    limitations: [...RESEARCH_LIMITATIONS],
  };
}

export function researchTop(input: ResearchAlphasInput): number {
  return input.top ?? DEFAULT_RESEARCH_TOP;
}

/** When the catalog is not firing, still research explicit market × alpha pairs. */
export function fallbackOpportunities(
  marketIds: string[],
  alphaIds: string[] | undefined,
  limit: number,
): AlphaOpportunity[] {
  const alphas = (alphaIds?.length ? alphaIds : listAlphas().map((alpha) => alpha.id)).slice(0, limit);
  const out: AlphaOpportunity[] = [];
  for (const marketId of marketIds.slice(0, limit)) {
    for (const alphaId of alphas) {
      if (out.length >= limit) return out;
      const definition = getAlpha(alphaId);
      out.push({
        marketId,
        question: marketId,
        slug: marketId,
        yesPrice: 0,
        noPrice: 0,
        volume24h: 0,
        alphaId,
        alphaName: definition?.name ?? alphaId,
        action: "HOLD",
        score: 0,
        confidence: 0,
        reasoning: "No live catalog signal; researching stored tape anyway",
        rank: 0,
        features: {
          marketId,
          timestamp: new Date(0),
          yesPrice: 0,
          noPrice: 0,
          volume24h: 0,
          complementaryGap: 0,
          lookbackReturn: null,
          momentum: null,
          volatility: null,
          volumeZScore: null,
          distanceFromFair: -0.5,
          meanReversionResidual: null,
          sampleSize: 0,
        },
      });
    }
  }
  return out;
}
