import type {
  AlphaDefinition,
  BacktestMetrics,
  BacktestSplitInput,
  PriceBar,
  SweepComboResult,
  SweepReport,
} from "@polyagent/shared";
import { runBacktest } from "./backtest";
import { getAlpha } from "./catalog";
import { sortBars } from "./features";
import { BACKTEST_LIMITATIONS } from "./limitations";
import { computeSplitReport, SPLIT_LIMITATIONS } from "./split";

export const MAX_SWEEP_COMBINATIONS = 50;
export const DEFAULT_SWEEP_STEPS = 5;

export const SWEEP_LIMITATIONS = [
  ...BACKTEST_LIMITATIONS,
  "Sweep ranks in-sample metrics on the same tape unless split is set, in which case ranking uses out-of-sample metrics.",
  `At most ${MAX_SWEEP_COMBINATIONS} combinations. Equity curves are omitted — re-run POST /api/backtests with winner.parameters for the full report.`,
] as const;

export interface SweepOptions {
  alphaId: string;
  bars: PriceBar[];
  grid?: Record<string, number[]>;
  steps?: Record<string, number>;
  startingBalance?: number;
  maxPositionSize?: number;
  confidenceThreshold?: number;
  lookback?: number;
  split?: BacktestSplitInput;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function linspace(min: number, max: number, steps: number): number[] {
  const n = Math.max(1, Math.trunc(steps));
  if (n === 1 || min === max) return [min];
  const values: number[] = [];
  for (let i = 0; i < n; i += 1) {
    values.push(min + ((max - min) * i) / (n - 1));
  }
  return values;
}

function uniqueClamped(values: number[], min: number, max: number): number[] {
  const seen = new Set<number>();
  const out: number[] = [];
  for (const value of values) {
    if (!Number.isFinite(value)) continue;
    const next = clamp(value, min, max);
    if (seen.has(next)) continue;
    seen.add(next);
    out.push(next);
  }
  return out;
}

function cartesian(axes: Array<{ name: string; values: number[] }>): Record<string, number>[] {
  return axes.reduce<Record<string, number>[]>((acc, axis) => {
    if (acc.length === 0) {
      return axis.values.map((value) => ({ [axis.name]: value }));
    }
    const next: Record<string, number>[] = [];
    for (const row of acc) {
      for (const value of axis.values) {
        next.push({ ...row, [axis.name]: value });
      }
    }
    return next;
  }, []);
}

function unknownParams(definition: AlphaDefinition, names: string[]): string[] {
  const known = new Set(definition.parameters.map((spec) => spec.name));
  return names.filter((name) => !known.has(name));
}

export function expandSweepGrid(
  definition: AlphaDefinition,
  grid?: Record<string, number[]>,
  steps?: Record<string, number>,
): Record<string, number>[] {
  const gridKeys = Object.keys(grid ?? {});
  const stepKeys = Object.keys(steps ?? {});
  const unknown = unknownParams(definition, [...gridKeys, ...stepKeys]);
  if (unknown.length > 0) {
    throw new Error(`Unknown sweep parameter(s): ${unknown.join(", ")}`);
  }

  const auto = gridKeys.length === 0 && stepKeys.length === 0;
  let perParamSteps = DEFAULT_SWEEP_STEPS;
  if (auto && definition.parameters.length > 0) {
    while (
      perParamSteps > 1 &&
      perParamSteps ** definition.parameters.length > MAX_SWEEP_COMBINATIONS
    ) {
      perParamSteps -= 1;
    }
  }

  const axes = definition.parameters.map((spec) => {
    const explicit = grid?.[spec.name];
    if (explicit) {
      const values = uniqueClamped(explicit, spec.minimum, spec.maximum);
      if (values.length === 0) {
        throw new Error(`Sweep grid for ${spec.name} has no finite values`);
      }
      return { name: spec.name, values };
    }
    const requestedSteps = steps?.[spec.name] ?? (auto ? perParamSteps : 1);
    const values =
      requestedSteps <= 1
        ? [clamp(spec.defaultValue, spec.minimum, spec.maximum)]
        : linspace(spec.minimum, spec.maximum, requestedSteps);
    return { name: spec.name, values };
  });

  const combinations = cartesian(axes);
  if (combinations.length === 0) {
    return [definition.defaultParameters];
  }
  if (combinations.length > MAX_SWEEP_COMBINATIONS) {
    throw new Error(
      `Sweep exceeds ${MAX_SWEEP_COMBINATIONS} combinations (got ${combinations.length}). Narrow grid or steps.`,
    );
  }
  return combinations;
}

export function sweepScore(metrics: BacktestMetrics): number {
  if (metrics.sharpe !== null) return metrics.sharpe;
  if (metrics.startingBalance > 0) return metrics.totalPnl / metrics.startingBalance;
  return metrics.totalPnl;
}

export function compareSweepResults(a: SweepComboResult, b: SweepComboResult): number {
  const aSharpe = a.metrics.sharpe;
  const bSharpe = b.metrics.sharpe;
  if (aSharpe !== null && bSharpe !== null && aSharpe !== bSharpe) return bSharpe - aSharpe;
  if (aSharpe !== null && bSharpe === null) return -1;
  if (aSharpe === null && bSharpe !== null) return 1;
  if (a.metrics.totalPnl !== b.metrics.totalPnl) return b.metrics.totalPnl - a.metrics.totalPnl;
  return a.metrics.maxDrawdown - b.metrics.maxDrawdown;
}

export function runSweep(options: SweepOptions): SweepReport {
  const definition = getAlpha(options.alphaId);
  if (!definition) {
    throw new Error(`Alpha not found: ${options.alphaId}`);
  }
  if (options.bars.length === 0) {
    throw new Error("Sweep requires at least one price bar");
  }

  const combinations = expandSweepGrid(definition, options.grid, options.steps);
  const results: SweepComboResult[] = combinations.map((parameters) => {
    const report = runBacktest({
      alphaId: options.alphaId,
      parameters,
      bars: options.bars,
      startingBalance: options.startingBalance,
      maxPositionSize: options.maxPositionSize,
      confidenceThreshold: options.confidenceThreshold,
      lookback: options.lookback,
    });

    if (!options.split) {
      return {
        parameters: report.parameters,
        metrics: report.metrics,
        score: sweepScore(report.metrics),
      };
    }

    const split = computeSplitReport(
      {
        alphaId: options.alphaId,
        parameters,
        bars: options.bars,
        startingBalance: options.startingBalance,
        maxPositionSize: options.maxPositionSize,
        confidenceThreshold: options.confidenceThreshold,
        lookback: options.lookback,
      },
      options.split,
    );
    return {
      parameters: report.parameters,
      metrics: split.outOfSample,
      score: sweepScore(split.outOfSample),
      inSample: split.inSample,
      outOfSample: split.outOfSample,
    };
  });

  results.sort(compareSweepResults);
  const sorted = sortBars(options.bars);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const headlineSplit = options.split
    ? computeSplitReport(
        {
          alphaId: options.alphaId,
          parameters: results[0]?.parameters,
          bars: options.bars,
          startingBalance: options.startingBalance,
          maxPositionSize: options.maxPositionSize,
          confidenceThreshold: options.confidenceThreshold,
          lookback: options.lookback,
        },
        options.split,
      )
    : undefined;

  return {
    alphaId: options.alphaId,
    marketIds: [...new Set(options.bars.map((bar) => bar.marketId))],
    from: first?.capturedAt ?? null,
    to: last?.capturedAt ?? null,
    combinations: results.length,
    winner: results[0] ?? null,
    results,
    limitations: options.split ? [...SWEEP_LIMITATIONS, ...SPLIT_LIMITATIONS] : [...SWEEP_LIMITATIONS],
    split: headlineSplit,
  };
}
