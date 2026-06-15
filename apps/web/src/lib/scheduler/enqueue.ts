import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getPrismaAsync } from "@/lib/db";
import { runActiveBotTicks } from "@/lib/runner/tick";

export interface EnqueueResult {
  enqueued: number;
  mode: "cloudflare-queue" | "direct";
  results?: Awaited<ReturnType<typeof runActiveBotTicks>>;
}

async function getTickQueue(): Promise<Queue<{ botId: string }> | null> {
  if (process.env.SCHEDULER_MODE !== "cloudflare") return null;
  try {
    const { env } = await getCloudflareContext({ async: true });
    return env.TICK_QUEUE ?? null;
  } catch {
    return null;
  }
}

export async function enqueueActiveBots(): Promise<EnqueueResult> {
  const prisma = await getPrismaAsync();
  const maxBots = Number(process.env.MAX_ACTIVE_BOTS ?? 10);
  const bots = await prisma.bot.findMany({
    where: { status: "active" },
    take: maxBots,
    select: { id: true },
  });

  const queue = await getTickQueue();
  if (queue) {
    await Promise.all(bots.map((bot) => queue.send({ botId: bot.id })));
    return { enqueued: bots.length, mode: "cloudflare-queue" };
  }

  const results = await runActiveBotTicks();
  return { enqueued: results.length, mode: "direct", results };
}