import type {
  BacktestReport,
  PriceBar,
  RunBacktestInput,
  SweepBacktestInput,
  SweepReport,
} from "@polyagent/shared";
import { runBacktest } from "@/lib/alpha/backtest";
import { getAlpha } from "@/lib/alpha/catalog";
import { computeSplitReport, SPLIT_LIMITATIONS } from "@/lib/alpha/split";
import { runSweep } from "@/lib/alpha/sweep";
import { listHistoryForMarkets, toPriceBar } from "@/lib/alpha/snapshots";

export async function loadBacktestBars(
  input: Pick<RunBacktestInput, "marketIds" | "from" | "to" | "bars">,
): Promise<PriceBar[]> {
  const inline = (input.bars ?? [])
    .map((bar) => toPriceBar(bar, bar.marketId ?? input.marketIds[0] ?? "unknown"))
    .filter((bar) => input.marketIds.includes(bar.marketId));

  const bars =
    inline.length > 0
      ? inline
      : await listHistoryForMarkets(input.marketIds, {
          from: input.from,
          to: input.to,
          limit: 5_000,
        });

  if (bars.length === 0) {
    throw new Error(
      "No price bars available. Import history via POST /api/markets/:id/history, supply bars in the request, or run bot ticks first.",
    );
  }

  return bars;
}

export async function createBacktest(input: RunBacktestInput): Promise<BacktestReport> {
  if (!getAlpha(input.alphaId)) {
    throw new Error(`Alpha not found: ${input.alphaId}`);
  }

  const bars = await loadBacktestBars(input);
  const report = runBacktest({
    alphaId: input.alphaId,
    parameters: input.parameters,
    bars,
    startingBalance: input.startingBalance,
    maxPositionSize: input.maxPositionSize,
    confidenceThreshold: input.confidenceThreshold,
    lookback: input.lookback,
  });

  if (!input.split) return report;

  const split = computeSplitReport(
    {
      alphaId: input.alphaId,
      parameters: input.parameters,
      bars,
      startingBalance: input.startingBalance,
      maxPositionSize: input.maxPositionSize,
      confidenceThreshold: input.confidenceThreshold,
      lookback: input.lookback,
    },
    input.split,
  );

  return {
    ...report,
    split,
    limitations: [...report.limitations, ...SPLIT_LIMITATIONS],
  };
}

export async function createSweep(input: SweepBacktestInput): Promise<SweepReport> {
  if (!getAlpha(input.alphaId)) {
    throw new Error(`Alpha not found: ${input.alphaId}`);
  }

  const bars = await loadBacktestBars(input);
  return runSweep({
    alphaId: input.alphaId,
    bars,
    grid: input.grid,
    steps: input.steps,
    startingBalance: input.startingBalance,
    maxPositionSize: input.maxPositionSize,
    confidenceThreshold: input.confidenceThreshold,
    lookback: input.lookback,
    split: input.split,
  });
}
