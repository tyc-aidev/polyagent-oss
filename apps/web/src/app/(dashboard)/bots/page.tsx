export const dynamic = "force-dynamic";

import Link from "next/link";
import { listBots } from "@/lib/api/bots";
import { BotStatusBadge } from "@/components/bots/bot-status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { formatUsd } from "@/lib/format";

export default async function BotsPage() {
  const bots = await listBots();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Bots</h1>
          <p className="text-muted-foreground text-sm mt-1">Paper trading bots and simulated P&L</p>
        </div>
        <Link href="/bots/new">
          <Button>New Bot</Button>
        </Link>
      </div>

      <Card>
        <CardTitle>Your Bots ({bots.length})</CardTitle>
        {bots.length === 0 ? (
          <div className="space-y-3">
            <p className="text-muted-foreground text-sm">No bots yet.</p>
            <Link href="/demo">
              <Button variant="secondary">Try the Demo</Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {bots.map((bot) => (
              <Link
                key={bot.id}
                href={`/bots/${bot.id}`}
                className="flex items-center justify-between rounded-md border border-border px-4 py-3 hover:border-border transition-colors"
              >
                <div>
                  <p className="font-medium">{bot.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">ID: {bot.id}</p>
                </div>
                <div className="flex items-center gap-4">
                  <span
                    className={
                      bot.portfolio.totalPnl >= 0 ? "text-success" : "text-destructive"
                    }
                  >
                    {formatUsd(bot.portfolio.totalPnl)}
                  </span>
                  <BotStatusBadge status={bot.status} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}