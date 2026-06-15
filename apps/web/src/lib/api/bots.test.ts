import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = {
  bot: {
    findMany: vi.fn(),
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  paperPosition: { findMany: vi.fn() },
  agentDecision: { findMany: vi.fn(), count: vi.fn() },
  botTick: { findMany: vi.fn(), count: vi.fn() },
};

vi.mock("@polyagent/db", () => ({
  prisma: mockPrisma,
  Prisma: {},
}));

const { archiveBot, createBot, getBot, listBots } = await import("./bots");

const validConfig = {
  markets: ["market-1"],
  risk: { maxPositionSize: 100, confidenceThreshold: 0.5 },
  strategy: { type: "threshold" as const, parameters: { buyYesBelow: 0.35 } },
  mode: "paper" as const,
  updateIntervalMinutes: 15,
  startingBalance: 10_000,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createBot", () => {
  it("creates a paused bot with initial cash balance", async () => {
    mockPrisma.bot.create.mockResolvedValue({
      id: "bot-1",
      name: "Test Bot",
      status: "paused",
      config: { ...validConfig, cashBalance: 10_000 },
    });

    const bot = await createBot({ name: "Test Bot", config: validConfig });

    expect(mockPrisma.bot.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: "Test Bot",
          status: "paused",
        }),
      }),
    );
    expect(bot.status).toBe("paused");
  });

  it("rejects invalid config", async () => {
    await expect(
      createBot({
        name: "Bad Bot",
        config: { ...validConfig, mode: "live" } as unknown as typeof validConfig,
      }),
    ).rejects.toThrow();
  });
});

describe("listBots", () => {
  it("returns non-archived bots with portfolio summary", async () => {
    mockPrisma.bot.findMany.mockResolvedValue([
      {
        id: "bot-1",
        name: "Demo",
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
        config: { ...validConfig, cashBalance: 10_000 },
        positions: [],
      },
    ]);

    const bots = await listBots();
    expect(bots).toHaveLength(1);
    expect(bots[0]?.portfolio.totalPnl).toBe(0);
  });
});

describe("getBot", () => {
  it("throws when bot is archived", async () => {
    mockPrisma.bot.findUnique.mockResolvedValue({
      id: "bot-1",
      name: "Old",
      status: "archived",
      config: validConfig,
      positions: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(getBot("bot-1")).rejects.toThrow("Bot not found");
  });
});

describe("archiveBot", () => {
  it("soft-deletes by setting archived status", async () => {
    mockPrisma.bot.findUnique.mockResolvedValue({
      id: "bot-1",
      status: "paused",
    });
    mockPrisma.bot.update.mockResolvedValue({ id: "bot-1", status: "archived" });

    const bot = await archiveBot("bot-1");
    expect(mockPrisma.bot.update).toHaveBeenCalledWith({
      where: { id: "bot-1" },
      data: { status: "archived" },
    });
    expect(bot.status).toBe("archived");
  });
});