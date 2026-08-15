export const dynamic = "force-dynamic";

import Link from "next/link";
import { getPrismaAsync } from "@/lib/db";
import { BotStatusBadge } from "@/components/bots/bot-status-badge";
import { RunTickButton } from "@/components/bots/run-tick-button";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { formatUsd } from "@/lib/format";
import { parseBotConfig, getCashBalance } from "@/lib/runner/bot-config";
import { summarizeFromPositions } from "@/lib/api/portfolio-summary";

export default async function DemoPage() {
  const prisma = await getPrismaAsync();
  const demoBot = await prisma.bot.findFirst({
    where: { name: "Demo Threshold Bot", status: { not: "archived" } },
    include: { positions: true },
  });

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold">Demo Walkthrough</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Try paper trading in under 5 minutes.
        </p>
      </div>

      <Card>
        <CardTitle>How it works</CardTitle>
        <ol className="list-decimal list-inside space-y-2 text-sm text-foreground/80">
          <li>Browse live markets on the Market Explorer</li>
          <li>Review the pre-seeded demo bot (or create your own)</li>
          <li>Run a tick to analyze markets and simulate trades</li>
          <li>Check decisions, positions, and P&L on the bot detail page</li>
          <li>
            Open the{" "}
            <Link href="/alphas" className="text-primary hover:underline">
              Alpha Lab
            </Link>{" "}
            to discover catalog signals and backtest against snapshots
          </li>
        </ol>
      </Card>

      {!demoBot ? (
        <Card>
          <p className="text-sm text-muted-foreground">
            Demo bot not found. Run{" "}
            <code className="text-primary">pnpm db:seed</code> after starting Postgres.
          </p>
          <Link href="/bots/new" className="inline-block mt-4">
            <Button variant="secondary">Create a Bot Instead</Button>
          </Link>
        </Card>
      ) : (
        <Card className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-lg">{demoBot.name}</p>
              <p className="text-xs text-muted-foreground font-mono mt-1">{demoBot.id}</p>
            </div>
            <BotStatusBadge status={demoBot.status} />
          </div>

          {(() => {
            const config = parseBotConfig(demoBot.config);
            const summary = summarizeFromPositions(
              getCashBalance(config),
              config.startingBalance,
              demoBot.positions.map((row) => ({
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
            );
            return (
              <p className="text-sm">
                P&L:{" "}
                <span className={summary.totalPnl >= 0 ? "text-success" : "text-destructive"}>
                  {formatUsd(summary.totalPnl)}
                </span>
                {" · "}
                {config.markets.length} markets configured
              </p>
            );
          })()}

          <div className="flex gap-3">
            <Link href={`/bots/${demoBot.id}`}>
              <Button variant="secondary">View Details</Button>
            </Link>
            {demoBot.status === "active" && <RunTickButton botId={demoBot.id} />}
          </div>
        </Card>
      )}

      <Link href="/markets">
        <Button variant="secondary">Browse Markets</Button>
      </Link>
    </div>
  );
}