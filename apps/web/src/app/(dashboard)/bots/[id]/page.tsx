export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getBot,
  getBotDecisions,
  getBotPositions,
  getBotTicks,
} from "@/lib/api/bots";
import { BotStatusBadge } from "@/components/bots/bot-status-badge";
import { RunTickButton } from "@/components/bots/run-tick-button";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { formatDate, formatPrice, formatUsd } from "@/lib/format";

export default async function BotDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let bot;
  try {
    bot = await getBot(id);
  } catch {
    notFound();
  }

  const [decisions, positions, ticks] = await Promise.all([
    getBotDecisions(id, { limit: 10, offset: 0 }),
    getBotPositions(id),
    getBotTicks(id, { limit: 10, offset: 0 }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">{bot.name}</h1>
            <BotStatusBadge status={bot.status} />
          </div>
          <p className="text-zinc-500 text-sm mt-1 font-mono">{bot.id}</p>
        </div>
        <div className="flex gap-2">
          <Link href={`/bots/${id}/edit`}>
            <Button variant="secondary">Edit</Button>
          </Link>
          {bot.status === "active" && <RunTickButton botId={id} />}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <p className="text-xs text-zinc-500">Cash Balance</p>
          <p className="text-xl font-semibold mt-1">
            ${bot.portfolio.cashBalance.toLocaleString()}
          </p>
        </Card>
        <Card>
          <p className="text-xs text-zinc-500">Total P&L</p>
          <p
            className={`text-xl font-semibold mt-1 ${bot.portfolio.totalPnl >= 0 ? "text-green-400" : "text-red-400"}`}
          >
            {formatUsd(bot.portfolio.totalPnl)}
          </p>
        </Card>
        <Card>
          <p className="text-xs text-zinc-500">Open Positions</p>
          <p className="text-xl font-semibold mt-1">{bot.portfolio.openPositions}</p>
        </Card>
        <Card>
          <p className="text-xs text-zinc-500">Markets</p>
          <p className="text-xl font-semibold mt-1">{bot.config.markets.length}</p>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle>Open Positions</CardTitle>
          {positions.length === 0 ? (
            <p className="text-sm text-zinc-400">No open positions.</p>
          ) : (
            <div className="space-y-2">
              {positions.map((position) => (
                <div
                  key={position.id}
                  className="rounded border border-zinc-800 px-3 py-2 text-sm"
                >
                  <p className="font-medium">
                    {position.side} · {position.marketId}
                  </p>
                  <p className="text-zinc-400">
                    {position.size.toFixed(2)} shares @ {formatPrice(position.avgPrice)} ·{" "}
                    {formatUsd(position.unrealizedPnl)} unrealized
                  </p>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <CardTitle>Recent Ticks</CardTitle>
          {ticks.items.length === 0 ? (
            <p className="text-sm text-zinc-400">No ticks yet. Run a tick to start.</p>
          ) : (
            <div className="space-y-2">
              {ticks.items.map((tick) => (
                <div
                  key={tick.id}
                  className="flex items-center justify-between rounded border border-zinc-800 px-3 py-2 text-sm"
                >
                  <span>{formatDate(tick.startedAt)}</span>
                  <span className="text-xs capitalize text-zinc-400">{tick.status}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card>
        <CardTitle>Decision Log</CardTitle>
        {decisions.items.length === 0 ? (
          <p className="text-sm text-zinc-400">No decisions yet.</p>
        ) : (
          <div className="space-y-3">
            {decisions.items.map((decision) => (
              <div key={decision.id} className="rounded border border-zinc-800 px-3 py-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{decision.action}</span>
                  <span className="text-zinc-500">{formatDate(decision.createdAt)}</span>
                </div>
                <p className="text-zinc-400 mt-1">{decision.reasoning}</p>
                <p className="text-zinc-500 text-xs mt-1">
                  Market {decision.marketId} · confidence {(decision.confidence * 100).toFixed(0)}%
                </p>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}