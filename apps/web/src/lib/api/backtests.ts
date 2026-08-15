import type { BacktestReport, RunBacktestInput } from "@polyagent/shared";
import { runBacktest } from "@/lib/alpha/backtest";
import { getAlpha } from "@/lib/alpha/catalog";
import { listHistoryForMarkets, toPriceBar } from "@/lib/alpha/snapshots";

export async function createBacktest(input: RunBacktestInput): Promise<BacktestReport> {
  if (!getAlpha(input.alphaId)) {
    throw new Error(`Alpha not found: ${input.alphaId}`);
  }

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

  return runBacktest({
    alphaId: input.alphaId,
    parameters: input.parameters,
    bars,
    startingBalance: input.startingBalance,
    maxPositionSize: input.maxPositionSize,
    confidenceThreshold: input.confidenceThreshold,
    lookback: input.lookback,
  });
}
