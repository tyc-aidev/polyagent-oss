import { prisma, type Prisma } from "@polyagent/db";
import {
  createBotSchema,
  updateBotSchema,
  type CreateBotInput,
  type UpdateBotInput,
} from "@polyagent/shared";
import { parseBotConfig, getCashBalance } from "@/lib/runner/bot-config";
import { portfolioFromDb } from "@/lib/runner/portfolio-db";
import { parsePagination, type PaginationParams } from "./pagination";
import { summarizeFromPositions, summarizePortfolio, type PortfolioSummary } from "./portfolio-summary";

export interface BotSummary {
  id: string;
  name: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  portfolio: PortfolioSummary;
}

export async function listBots(): Promise<BotSummary[]> {
  const bots = await prisma.bot.findMany({
    where: { status: { not: "archived" } },
    orderBy: { createdAt: "desc" },
    include: { positions: true },
  });

  return bots.map((bot) => {
    const config = parseBotConfig(bot.config);
    return {
      id: bot.id,
      name: bot.name,
      status: bot.status,
      createdAt: bot.createdAt,
      updatedAt: bot.updatedAt,
      portfolio: summarizeFromPositions(
        getCashBalance(config),
        config.startingBalance,
        bot.positions.map((row) => ({
          id: row.id,
          botId: row.botId,
          marketId: row.marketId,
          side: row.side as "YES" | "NO",
          size: row.size,
          avgPrice: row.avgPrice,
          costBasis: row.costBasis,
          unrealizedPnl: row.unrealizedPnl,
          realizedPnl: row.realizedPnl,
          status: row.status as "open" | "closed" | "settled",
        })),
      ),
    };
  });
}

export async function createBot(input: CreateBotInput) {
  const data = createBotSchema.parse(input);
  const config = {
    ...data.config,
    cashBalance: data.config.startingBalance,
  };

  return prisma.bot.create({
    data: {
      name: data.name,
      status: "paused",
      config: config as unknown as Prisma.InputJsonValue,
    },
  });
}

export async function getBot(id: string) {
  const bot = await prisma.bot.findUnique({
    where: { id },
    include: { positions: true },
  });
  if (!bot || bot.status === "archived") {
    throw new Error(`Bot not found: ${id}`);
  }

  const config = parseBotConfig(bot.config);
  const portfolio = portfolioFromDb(bot.id, config, bot.positions);

  return {
    id: bot.id,
    name: bot.name,
    status: bot.status,
    config,
    createdAt: bot.createdAt,
    updatedAt: bot.updatedAt,
    portfolio: summarizePortfolio(portfolio),
  };
}

export async function updateBot(id: string, input: UpdateBotInput) {
  const data = updateBotSchema.parse(input);
  const existing = await prisma.bot.findUnique({ where: { id } });
  if (!existing || existing.status === "archived") {
    throw new Error(`Bot not found: ${id}`);
  }

  if (data.status === "active") {
    const configToCheck = data.config ?? parseBotConfig(existing.config);
    if (configToCheck.markets.length === 0) {
      throw new Error("Cannot activate bot with no markets configured");
    }
  }

  const currentConfig = parseBotConfig(existing.config);
  const nextConfig = data.config
    ? {
        ...data.config,
        cashBalance: currentConfig.cashBalance ?? data.config.startingBalance,
        dayStartPnl: currentConfig.dayStartPnl,
        dayStartDate: currentConfig.dayStartDate,
      }
    : currentConfig;

  return prisma.bot.update({
    where: { id },
    data: {
      name: data.name,
      status: data.status,
      config: data.config ? (nextConfig as unknown as Prisma.InputJsonValue) : undefined,
    },
  });
}

export async function archiveBot(id: string) {
  const existing = await prisma.bot.findUnique({ where: { id } });
  if (!existing || existing.status === "archived") {
    throw new Error(`Bot not found: ${id}`);
  }

  return prisma.bot.update({
    where: { id },
    data: { status: "archived" },
  });
}

export async function getBotPortfolio(id: string) {
  const bot = await getBot(id);
  return bot.portfolio;
}

export async function getBotPositions(id: string) {
  await assertBotExists(id);
  const positions = await prisma.paperPosition.findMany({
    where: { botId: id, status: "open" },
    orderBy: { updatedAt: "desc" },
  });
  return positions;
}

export async function getBotDecisions(id: string, pagination: PaginationParams) {
  await assertBotExists(id);
  const [items, total] = await Promise.all([
    prisma.agentDecision.findMany({
      where: { botId: id },
      orderBy: { createdAt: "desc" },
      take: pagination.limit,
      skip: pagination.offset,
    }),
    prisma.agentDecision.count({ where: { botId: id } }),
  ]);
  return { items, total, ...pagination };
}

export async function getBotTicks(id: string, pagination: PaginationParams) {
  await assertBotExists(id);
  const [items, total] = await Promise.all([
    prisma.botTick.findMany({
      where: { botId: id },
      orderBy: { startedAt: "desc" },
      take: pagination.limit,
      skip: pagination.offset,
    }),
    prisma.botTick.count({ where: { botId: id } }),
  ]);
  return { items, total, ...pagination };
}

async function assertBotExists(id: string) {
  const bot = await prisma.bot.findUnique({ where: { id } });
  if (!bot || bot.status === "archived") {
    throw new Error(`Bot not found: ${id}`);
  }
}

export { parsePagination };