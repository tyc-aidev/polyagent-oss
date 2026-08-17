import type { MarketSnapshot } from "@polyagent/shared";
import { getPrismaAsync } from "@/lib/db";
import { getCacheStore } from "@/lib/polymarket/get-cache";
import { GammaClient } from "@/lib/polymarket/gamma";

export const DEFAULT_HARVEST_TOP_N = 20;
export const DEFAULT_HARVEST_MIN_INTERVAL_SECONDS = 240;
export const DEFAULT_SNAPSHOT_RETENTION_DAYS = 30;

export interface HarvestResult {
  considered: number;
  written: number;
  skippedFresh: number;
  skippedResolved: number;
  pruned: number;
  errors: number;
}

function envInt(name: string, fallback: number, min: number, max: number): number {
  const raw = Number(process.env[name]);
  if (!Number.isFinite(raw)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(raw)));
}

function envCsv(name: string): string[] {
  return (process.env[name] ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

export function isHarvestEnabled(): boolean {
  const flag = process.env.SNAPSHOT_HARVEST_ENABLED;
  if (flag === undefined || flag === "") return true;
  return flag !== "0" && flag.toLowerCase() !== "false";
}

function marketsFromConfig(raw: unknown): string[] {
  if (!raw || typeof raw !== "object") return [];
  const markets = (raw as { markets?: unknown }).markets;
  if (!Array.isArray(markets)) return [];
  return markets.filter((id): id is string => typeof id === "string" && id.length > 0);
}

export async function collectHarvestMarketIds(
  listed: MarketSnapshot[],
  extraIds: string[],
  botMarketIds: string[],
  extraLimit = 20,
): Promise<string[]> {
  const ids = new Set<string>(listed.map((market) => market.id));
  for (const id of [...extraIds, ...botMarketIds]) {
    if (ids.size >= listed.length + extraLimit) break;
    ids.add(id);
  }
  return [...ids];
}

export async function loadBotMarketIds(): Promise<string[]> {
  const prisma = await getPrismaAsync();
  const bots = await prisma.bot.findMany({
    where: { status: { not: "archived" } },
    select: { config: true },
  });
  const ids = new Set<string>();
  for (const bot of bots) {
    for (const id of marketsFromConfig(bot.config)) {
      ids.add(id);
    }
  }
  return [...ids];
}

export async function harvestMarketSnapshots(
  gamma: GammaClient = new GammaClient(getCacheStore()),
): Promise<HarvestResult> {
  const result: HarvestResult = {
    considered: 0,
    written: 0,
    skippedFresh: 0,
    skippedResolved: 0,
    pruned: 0,
    errors: 0,
  };

  if (!isHarvestEnabled()) {
    return result;
  }

  const topN = envInt("SNAPSHOT_HARVEST_TOP_N", DEFAULT_HARVEST_TOP_N, 0, 50);
  const minIntervalMs =
    envInt(
      "SNAPSHOT_HARVEST_MIN_INTERVAL_SECONDS",
      DEFAULT_HARVEST_MIN_INTERVAL_SECONDS,
      30,
      86_400,
    ) * 1000;
  const retentionDays = envInt("SNAPSHOT_RETENTION_DAYS", DEFAULT_SNAPSHOT_RETENTION_DAYS, 0, 365);

  const listed = topN > 0 ? await gamma.listMarkets(topN) : [];
  const extraIds = envCsv("SNAPSHOT_HARVEST_MARKET_IDS");
  const botMarketIds = await loadBotMarketIds();
  const marketIds = await collectHarvestMarketIds(listed, extraIds, botMarketIds);
  result.considered = marketIds.length;

  const prisma = await getPrismaAsync();
  const cutoff = new Date(Date.now() - minIntervalMs);
  const recent =
    marketIds.length === 0
      ? []
      : await prisma.marketPriceSnapshot.findMany({
          where: {
            marketId: { in: marketIds },
            capturedAt: { gte: cutoff },
          },
          select: { marketId: true },
          distinct: ["marketId"],
        });
  const fresh = new Set(recent.map((row) => row.marketId));

  const listedById = new Map(listed.map((market) => [market.id, market]));
  const now = new Date();
  const toWrite: Array<{
    marketId: string;
    yesPrice: number;
    noPrice: number;
    volume24h: number;
    capturedAt: Date;
  }> = [];

  for (const marketId of marketIds) {
    if (fresh.has(marketId)) {
      result.skippedFresh += 1;
      continue;
    }

    try {
      const market = listedById.get(marketId) ?? (await gamma.getMarket(marketId));
      if (!market) {
        result.errors += 1;
        continue;
      }
      if (market.resolved) {
        result.skippedResolved += 1;
        continue;
      }
      toWrite.push({
        marketId: market.id,
        yesPrice: market.yesPrice,
        noPrice: market.noPrice,
        volume24h: market.volume24h,
        capturedAt: now,
      });
    } catch {
      result.errors += 1;
    }
  }

  if (toWrite.length > 0) {
    const created = await prisma.marketPriceSnapshot.createMany({ data: toWrite });
    result.written = created.count;
  }

  if (retentionDays > 0) {
    const pruneBefore = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    const pruned = await prisma.marketPriceSnapshot.deleteMany({
      where: { capturedAt: { lt: pruneBefore } },
    });
    result.pruned = pruned.count;
  }

  return result;
}
