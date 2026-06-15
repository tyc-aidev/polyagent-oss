import { prisma } from "./index";

async function fetchDemoMarketIds(): Promise<string[]> {
  try {
    const url = new URL("https://gamma-api.polymarket.com/markets");
    url.searchParams.set("limit", "5");
    url.searchParams.set("active", "true");
    url.searchParams.set("closed", "false");

    const response = await fetch(url.toString());
    if (!response.ok) return [];

    const markets = (await response.json()) as Array<{ id?: string | number }>;
    return markets
      .map((market) => (market.id ? String(market.id) : null))
      .filter((id): id is string => Boolean(id))
      .slice(0, 3);
  } catch {
    return [];
  }
}

async function main() {
  const existing = await prisma.bot.findFirst({ where: { name: "Demo Threshold Bot" } });
  if (existing) {
    console.log("Demo bot already exists:", existing.id);
    return;
  }

  const marketIds = await fetchDemoMarketIds();
  if (marketIds.length === 0) {
    console.warn("No live markets fetched; seeding bot with placeholder market id");
    marketIds.push("demo-market");
  }

  const bot = await prisma.bot.create({
    data: {
      name: "Demo Threshold Bot",
      status: "active",
      config: {
        markets: marketIds,
        risk: { maxPositionSize: 100, confidenceThreshold: 0.5, maxDailyLoss: 200 },
        strategy: { type: "threshold", parameters: { buyYesBelow: 0.35, minVolume24h: 0 } },
        mode: "paper",
        updateIntervalMinutes: 15,
        startingBalance: 10_000,
        cashBalance: 10_000,
      },
    },
  });

  console.log("Seeded demo bot:", bot.id, "markets:", marketIds.join(", "));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());