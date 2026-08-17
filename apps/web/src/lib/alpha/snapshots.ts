import type { EventFeatureBag, PriceBar, PriceBarInput } from "@polyagent/shared";
import { getPrismaAsync } from "@/lib/db";

export interface HistoryQuery {
  from?: Date;
  to?: Date;
  limit?: number;
}

export function toPriceBar(input: PriceBarInput, fallbackMarketId: string): PriceBar {
  return {
    marketId: input.marketId ?? fallbackMarketId,
    capturedAt: input.capturedAt instanceof Date ? input.capturedAt : new Date(input.capturedAt),
    yesPrice: input.yesPrice,
    noPrice: input.noPrice,
    volume24h: input.volume24h,
    event: input.event,
  };
}

export async function listMarketHistory(marketId: string, query: HistoryQuery = {}): Promise<PriceBar[]> {
  const prisma = await getPrismaAsync();
  const limit = Math.min(Math.max(query.limit ?? 200, 1), 2_000);
  const rows = await prisma.marketPriceSnapshot.findMany({
    where: {
      marketId,
      capturedAt: {
        gte: query.from,
        lte: query.to,
      },
    },
    orderBy: { capturedAt: "asc" },
    take: limit,
  });

  return rows.map((row) => ({
    marketId: row.marketId,
    capturedAt: row.capturedAt,
    yesPrice: row.yesPrice,
    noPrice: row.noPrice,
    volume24h: row.volume24h,
    event: eventFromJson(row.event),
  }));
}

export async function listHistoryForMarkets(
  marketIds: string[],
  query: HistoryQuery = {},
): Promise<PriceBar[]> {
  if (marketIds.length === 0) return [];
  const prisma = await getPrismaAsync();
  const limit = Math.min(Math.max(query.limit ?? 2_000, 1), 5_000);
  const rows = await prisma.marketPriceSnapshot.findMany({
    where: {
      marketId: { in: marketIds },
      capturedAt: {
        gte: query.from,
        lte: query.to,
      },
    },
    orderBy: { capturedAt: "asc" },
    take: limit,
  });

  return rows.map((row) => ({
    marketId: row.marketId,
    capturedAt: row.capturedAt,
    yesPrice: row.yesPrice,
    noPrice: row.noPrice,
    volume24h: row.volume24h,
    event: eventFromJson(row.event),
  }));
}

export async function importMarketHistory(marketId: string, bars: PriceBar[]): Promise<number> {
  if (bars.length === 0) return 0;
  const prisma = await getPrismaAsync();
  const result = await prisma.marketPriceSnapshot.createMany({
    data: bars.map((bar) => ({
      marketId,
      yesPrice: bar.yesPrice,
      noPrice: bar.noPrice,
      volume24h: bar.volume24h,
      capturedAt: bar.capturedAt,
      event: bar.event ?? undefined,
    })),
  });
  return result.count;
}

function eventFromJson(value: unknown): EventFeatureBag | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return value as EventFeatureBag;
}
