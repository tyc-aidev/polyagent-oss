import type {
  BacktestMetrics,
  BacktestSplitInput,
  BacktestSplitReport,
  PriceBar,
  WalkForwardFold,
} from "@polyagent/shared";
import { runBacktest, type BacktestOptions } from "./backtest";
import { sortBars } from "./features";

export const DEFAULT_TRAIN_FRACTION = 0.7;
export const DEFAULT_WALKS_FORWARD_FOLDS = 3;

export const SPLIT_LIMITATIONS = [
  "Even out-of-sample metrics on a harvested tape are not live trading.",
  "Holdout / walk-forward test windows use earlier bars only as feature warmup (evaluateFrom). The paper book restarts at each test window — no position carry.",
] as const;

export interface TimeWindow {
  fold: number;
  trainFrom: number;
  trainTo: number;
  testFrom: number;
  testTo: number;
}

export function uniqueTimestamps(bars: PriceBar[]): number[] {
  return [...new Set(bars.map((bar) => bar.capturedAt.getTime()))].sort((a, b) => a - b);
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function resolveSplit(split: BacktestSplitInput): Required<BacktestSplitInput> {
  return {
    mode: split.mode,
    trainFraction: split.trainFraction ?? DEFAULT_TRAIN_FRACTION,
    folds: split.folds ?? DEFAULT_WALKS_FORWARD_FOLDS,
  };
}

export function holdoutWindow(timestamps: number[], trainFraction: number): TimeWindow {
  if (timestamps.length < 4) {
    throw new Error("Holdout split needs at least 4 unique timestamps (2 train + 2 test)");
  }
  const cut = Math.max(2, Math.min(timestamps.length - 2, Math.floor(timestamps.length * trainFraction)));
  const trainFrom = timestamps[0];
  const trainTo = timestamps[cut - 1];
  const testFrom = timestamps[cut];
  const testTo = timestamps[timestamps.length - 1];
  if (trainFrom === undefined || trainTo === undefined || testFrom === undefined || testTo === undefined) {
    throw new Error("Holdout split could not allocate train/test windows");
  }
  return { fold: 1, trainFrom, trainTo, testFrom, testTo };
}

export function walkForwardWindows(timestamps: number[], folds: number): TimeWindow[] {
  const segments = folds + 1;
  if (timestamps.length < segments * 2) {
    throw new Error(
      `Walk-forward with ${folds} folds needs at least ${segments * 2} unique timestamps`,
    );
  }

  const windows: TimeWindow[] = [];
  for (let fold = 1; fold <= folds; fold += 1) {
    const trainEndIdx = Math.floor((timestamps.length * fold) / segments) - 1;
    const testEndIdx = Math.floor((timestamps.length * (fold + 1)) / segments) - 1;
    const testStartIdx = trainEndIdx + 1;
    const trainFrom = timestamps[0];
    const trainTo = timestamps[trainEndIdx];
    const testFrom = timestamps[testStartIdx];
    const testTo = timestamps[Math.max(testStartIdx, testEndIdx)];
    if (
      trainFrom === undefined ||
      trainTo === undefined ||
      testFrom === undefined ||
      testTo === undefined ||
      trainEndIdx < 1 ||
      testStartIdx >= timestamps.length
    ) {
      continue;
    }
    windows.push({ fold, trainFrom, trainTo, testFrom, testTo });
  }

  if (windows.length === 0) {
    throw new Error("Walk-forward split produced no valid folds");
  }
  return windows;
}

export function aggregateMetrics(parts: BacktestMetrics[], startingBalance: number): BacktestMetrics {
  if (parts.length === 0) {
    return {
      ticks: 0,
      trades: 0,
      positiveTicks: 0,
      hitRate: 0,
      startingBalance,
      endingEquity: startingBalance,
      totalPnl: 0,
      maxDrawdown: 0,
      sharpe: null,
    };
  }

  const ticks = parts.reduce((sum, part) => sum + part.ticks, 0);
  const trades = parts.reduce((sum, part) => sum + part.trades, 0);
  const positiveTicks = parts.reduce((sum, part) => sum + part.positiveTicks, 0);
  const totalPnl = parts.reduce((sum, part) => sum + part.totalPnl, 0);
  const sharpes = parts
    .map((part) => part.sharpe)
    .filter((value): value is number => value !== null);
  const hitRates = parts.map((part) => part.hitRate);

  return {
    ticks,
    trades,
    positiveTicks,
    hitRate: hitRates.length > 0 ? mean(hitRates) : 0,
    startingBalance,
    endingEquity: startingBalance + totalPnl,
    totalPnl,
    maxDrawdown: Math.max(...parts.map((part) => part.maxDrawdown), 0),
    sharpe: sharpes.length === parts.length && sharpes.length > 0 ? mean(sharpes) : null,
  };
}

function sliceBars(bars: PriceBar[], from: number, to: number): PriceBar[] {
  return bars.filter((bar) => {
    const ts = bar.capturedAt.getTime();
    return ts >= from && ts <= to;
  });
}

function runWindow(
  options: Omit<BacktestOptions, "bars" | "evaluateFrom">,
  bars: PriceBar[],
  window: TimeWindow,
  phase: "train" | "test",
) {
  if (phase === "train") {
    return runBacktest({
      ...options,
      bars: sliceBars(bars, window.trainFrom, window.trainTo),
    });
  }
  return runBacktest({
    ...options,
    bars: sliceBars(bars, window.trainFrom, window.testTo),
    evaluateFrom: new Date(window.testFrom),
  });
}

export function computeSplitReport(
  options: Omit<BacktestOptions, "evaluateFrom">,
  split: BacktestSplitInput,
): BacktestSplitReport {
  const resolved = resolveSplit(split);
  const bars = sortBars(options.bars);
  const timestamps = uniqueTimestamps(bars);
  const startingBalance = options.startingBalance ?? 10_000;

  if (resolved.mode === "holdout") {
    const window = holdoutWindow(timestamps, resolved.trainFraction);
    const inSample = runWindow(options, bars, window, "train").metrics;
    const outOfSample = runWindow(options, bars, window, "test").metrics;
    return {
      mode: "holdout",
      trainFraction: resolved.trainFraction,
      inSample,
      outOfSample,
    };
  }

  const windows = walkForwardWindows(timestamps, resolved.folds);
  const foldReports: WalkForwardFold[] = windows.map((window) => ({
    fold: window.fold,
    trainFrom: new Date(window.trainFrom),
    trainTo: new Date(window.trainTo),
    testFrom: new Date(window.testFrom),
    testTo: new Date(window.testTo),
    inSample: runWindow(options, bars, window, "train").metrics,
    outOfSample: runWindow(options, bars, window, "test").metrics,
  }));

  const lastTrain = foldReports[foldReports.length - 1];
  return {
    mode: "walk_forward",
    trainFraction: resolved.trainFraction,
    folds: resolved.folds,
    inSample: lastTrain?.inSample ?? aggregateMetrics([], startingBalance),
    outOfSample: aggregateMetrics(
      foldReports.map((fold) => fold.outOfSample),
      startingBalance,
    ),
    foldReports,
  };
}
