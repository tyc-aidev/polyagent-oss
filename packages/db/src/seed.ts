import { prisma } from "./index";

async function main() {
  const existing = await prisma.bot.findFirst({ where: { name: "Demo Threshold Bot" } });
  if (existing) {
    console.log("Demo bot already exists:", existing.id);
    return;
  }

  const bot = await prisma.bot.create({
    data: {
      name: "Demo Threshold Bot",
      status: "active",
      config: {
        markets: [],
        risk: { maxPositionSize: 100, confidenceThreshold: 0.5 },
        strategy: { type: "threshold", parameters: { buyYesBelow: 0.35 } },
        mode: "paper",
        updateIntervalMinutes: 15,
        startingBalance: 10_000,
      },
    },
  });

  console.log("Seeded demo bot:", bot.id);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());