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
          <p className="text-zinc-400 text-sm mt-1">Paper trading bots and simulated P&L</p>
        </div>
        <Link href="/bots/new">
          <Button>New Bot</Button>
        </Link>
      </div>

      <Card>
        <CardTitle>Your Bots ({bots.length})</CardTitle>
        {bots.length === 0 ? (
          <div className="space-y-3">
            <p className="text-zinc-400 text-sm">No bots yet.</p>
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
                className="flex items-center justify-between rounded-md border border-zinc-800 px-4 py-3 hover:border-zinc-600 transition-colors"
              >
                <div>
                  <p className="font-medium">{bot.name}</p>
                  <p className="text-xs text-zinc-500 mt-1">ID: {bot.id}</p>
                </div>
                <div className="flex items-center gap-4">
                  <span
                    className={
                      bot.portfolio.totalPnl >= 0 ? "text-green-400" : "text-red-400"
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