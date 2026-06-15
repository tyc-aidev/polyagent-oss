import { prisma, type Prisma } from "@polyagent/db";
import type { AgentDecision, MarketSnapshot } from "@polyagent/shared";
import { createAgent } from "@/lib/agents/registry";
import { getCacheStore } from "@/lib/polymarket/get-cache";
import { GammaClient } from "@/lib/polymarket/gamma";
import { runSimulatorTick } from "@/lib/paper-trading/simulator";
import {
  getCashBalance,
  getDayStartPnl,
  parseBotConfig,
  withRuntimeState,
} from "./bot-config";
import { portfolioFromDb } from "./portfolio-db";

export interface TickResult {
  tickId: string;
  botId: string;
  decisionsCount: number;
  shouldPause: boolean;
  totalPnl: number;
}

export async function runBotTick(botId: string): Promise<TickResult> {
  const bot = await prisma.bot.findUnique({ where: { id: botId } });
  if (!bot) throw new Error(`Bot not found: ${botId}`);
  if (bot.status !== "active") throw new Error(`Bot ${botId} is not active`);

  const config = parseBotConfig(bot.config);
  if (config.markets.length === 0) {
    throw new Error(`Bot ${botId} has no markets configured`);
  }

  const tick = await prisma.$transaction(async (tx) => {
    const running = await tx.botTick.findFirst({
      where: { botId, status: "running" },
    });
    if (running) {
      throw new Error(`Bot ${botId} already has a running tick`);
    }
    return tx.botTick.create({ data: { botId, status: "running" } });
  });

  try {
    const positions = await prisma.paperPosition.findMany({ where: { botId } });
    let portfolio = portfolioFromDb(botId, config, positions);

    const gamma = new GammaClient(getCacheStore());
    const markets = new Map<string, MarketSnapshot>();
    const decisions: AgentDecision[] = [];
    const snapshots: Array<{
      marketId: string;
      yesPrice: number;
      noPrice: number;
      volume24h: number;
    }> = [];

    const agent = createAgent(config);
    const timestamp = new Date();

    for (const marketId of config.markets) {
      const market = await gamma.getMarket(marketId);
      if (!market) continue;

      markets.set(market.id, market);
      snapshots.push({
        marketId: market.id,
        yesPrice: market.yesPrice,
        noPrice: market.noPrice,
        volume24h: market.volume24h,
      });

      const recentDecisions = await prisma.agentDecision.findMany({
        where: { botId, marketId: market.id },
        orderBy: { createdAt: "desc" },
        take: 10,
      });

      const agentDecisions = await agent.analyze({
        market,
        portfolio,
        recentDecisions: recentDecisions.map((row) => ({
          id: row.id,
          botId: row.botId,
          marketId: row.marketId,
          timestamp: row.createdAt,
          action: row.action as AgentDecision["action"],
          size: row.size,
          price: row.price,
          confidence: row.confidence,
          reasoning: row.reasoning,
        })),
        config,
        timestamp,
      });

      decisions.push(...agentDecisions);
    }

    const dayStartPnl = getDayStartPnl(config);
    const simResult = runSimulatorTick(
      portfolio,
      decisions,
      markets,
      config,
      dayStartPnl,
    );

    portfolio = simResult.portfolio;

    await prisma.$transaction([
      prisma.agentDecision.createMany({
        data: decisions.map((decision) => ({
          id: decision.id,
          botId,
          marketId: decision.marketId,
          action: decision.action,
          size: decision.size,
          price: decision.price,
          confidence: decision.confidence,
          reasoning: decision.reasoning,
          metadata: decision.metadata as Prisma.InputJsonValue | undefined,
        })),
      }),
      prisma.paperPosition.deleteMany({ where: { botId } }),
      prisma.paperPosition.createMany({
        data: portfolio.positions.map((position) => ({
          id: position.id,
          botId,
          marketId: position.marketId,
          side: position.side,
          size: position.size,
          avgPrice: position.avgPrice,
          costBasis: position.costBasis,
          unrealizedPnl: position.unrealizedPnl,
          realizedPnl: position.realizedPnl,
          status: position.status,
        })),
      }),
      prisma.marketPriceSnapshot.createMany({
        data: snapshots.map((snapshot) => ({
          marketId: snapshot.marketId,
          yesPrice: snapshot.yesPrice,
          noPrice: snapshot.noPrice,
          volume24h: snapshot.volume24h,
          tickId: tick.id,
        })),
      }),
      prisma.bot.update({
        where: { id: botId },
        data: {
          config: withRuntimeState(
            config,
            portfolio.cashBalance,
            portfolio.totalPnl,
          ) as unknown as Prisma.InputJsonValue,
          status: simResult.shouldPause ? "paused" : bot.status,
        },
      }),
      prisma.botTick.update({
        where: { id: tick.id },
        data: {
          status: "completed",
          decisionsCount: decisions.length,
          completedAt: new Date(),
        },
      }),
    ]);

    return {
      tickId: tick.id,
      botId,
      decisionsCount: decisions.length,
      shouldPause: simResult.shouldPause,
      totalPnl: portfolio.totalPnl,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown tick error";
    await prisma.botTick.update({
      where: { id: tick.id },
      data: { status: "failed", error: message, completedAt: new Date() },
    });
    throw error;
  }
}

export async function runActiveBotTicks(): Promise<TickResult[]> {
  const maxBots = Number(process.env.MAX_ACTIVE_BOTS ?? 10);
  const bots = await prisma.bot.findMany({
    where: { status: "active" },
    take: maxBots,
  });

  const results: TickResult[] = [];
  for (const bot of bots) {
    try {
      results.push(await runBotTick(bot.id));
    } catch (error) {
      console.error(`Tick failed for bot ${bot.id}:`, error);
    }
  }
  return results;
}