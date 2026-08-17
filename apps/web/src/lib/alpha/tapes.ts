import type { EventFeatureBag, MarketTapeReport, MarketTapeSummary } from "@polyagent/shared";
import { Prisma } from "@prisma/client";
import { getPrismaAsync } from "@/lib/db";
import { hasEventExtras } from "./events";

export const DEFAULT_TAPE_LIMIT = 50;
export const MAX_TAPE_LIMIT = 100;

export const TAPE_LIMITATIONS = [
  "Tapes are stored MarketPriceSnapshot rows (harvest, import, or bot ticks) — not a complete Polymarket book.",
  "hasEvent is true when any snapshot for that market has a non-empty event bag.",
  "eventSources are the FeatureSource ids seen on those extras (fixture, tennis, …).",
  "Paper trading only. Not financial advice and not a live execution path.",
] as const;

export interface TapeGroup {
  marketId: string;
  bars: number;
  from: Date | null;
  to: Date | null;
}

export interface TapeEventRow {
  marketId: string;
  event: EventFeatureBag | null;
}

export function eventSourcesFromBag(event: EventFeatureBag | null | undefined): string[] {
  if (!hasEventExtras(event ?? undefined)) return [];
  return Object.keys(event ?? {}).filter((source) => {
    const bag = event?.[source];
    return Boolean(bag && Object.keys(bag).length > 0);
  });
}

export function summarizeTapes(groups: TapeGroup[], eventRows: TapeEventRow[]): MarketTapeSummary[] {
  const sourcesByMarket = new Map<string, Set<string>>();
  for (const row of eventRows) {
    const sources = eventSourcesFromBag(row.event);
    if (sources.length === 0) continue;
    const existing = sourcesByMarket.get(row.marketId) ?? new Set<string>();
    for (const source of sources) existing.add(source);
    sourcesByMarket.set(row.marketId, existing);
  }

  return groups.map((group) => {
    const sources = [...(sourcesByMarket.get(group.marketId) ?? [])].sort();
    return {
      marketId: group.marketId,
      bars: group.bars,
      from: group.from,
      to: group.to,
      hasEvent: sources.length > 0,
      eventSources: sources,
    };
  });
}

export async function listMarketTapes(
  options: { limit?: number; hasEvent?: boolean } = {},
): Promise<MarketTapeReport> {
  const limit = Math.min(Math.max(options.limit ?? DEFAULT_TAPE_LIMIT, 1), MAX_TAPE_LIMIT);
  const prisma = await getPrismaAsync();

  const groups = await prisma.marketPriceSnapshot.groupBy({
    by: ["marketId"],
    _count: { _all: true },
    _min: { capturedAt: true },
    _max: { capturedAt: true },
    orderBy: { _max: { capturedAt: "desc" } },
    take: options.hasEvent ? Math.min(limit * 10, 500) : limit,
  });

  const marketIds = groups.map((group) => group.marketId);
  const eventRows =
    marketIds.length === 0
      ? []
      : await prisma.marketPriceSnapshot.findMany({
          where: {
            marketId: { in: marketIds },
            NOT: { event: { equals: Prisma.DbNull } },
          },
          select: { marketId: true, event: true },
        });

  const summarized = summarizeTapes(
    groups.map((group) => ({
      marketId: group.marketId,
      bars: group._count._all,
      from: group._min.capturedAt,
      to: group._max.capturedAt,
    })),
    eventRows.map((row) => ({
      marketId: row.marketId,
      event: row.event && typeof row.event === "object" && !Array.isArray(row.event)
        ? (row.event as EventFeatureBag)
        : null,
    })),
  );

  const tapes = options.hasEvent ? summarized.filter((tape) => tape.hasEvent).slice(0, limit) : summarized.slice(0, limit);

  return {
    tapes,
    limitations: [...TAPE_LIMITATIONS],
  };
}
