export const dynamic = "force-dynamic";

import Link from "next/link";
import { Card, CardTitle } from "@/components/ui/card";
import { formatPrice } from "@/lib/format";
import { listMarkets } from "@/lib/api/markets";
import { MarketSearch } from "./market-search";

export default async function MarketsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const markets = await listMarkets(30, q);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Market Explorer</h1>
          <p className="text-zinc-400 text-sm mt-1">Live Polymarket data via Gamma API</p>
        </div>
        <MarketSearch initialQuery={q} />
      </div>

      <Card>
        <CardTitle>Active Markets ({markets.length})</CardTitle>
        {markets.length === 0 ? (
          <p className="text-zinc-400 text-sm">No markets found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-zinc-500 border-b border-zinc-800">
                  <th className="pb-2 pr-4">Market</th>
                  <th className="pb-2 pr-4">YES</th>
                  <th className="pb-2 pr-4">NO</th>
                  <th className="pb-2 pr-4">Volume 24h</th>
                  <th className="pb-2">ID</th>
                </tr>
              </thead>
              <tbody>
                {markets.map((market) => (
                  <tr key={market.id} className="border-b border-zinc-800/50">
                    <td className="py-3 pr-4 max-w-md">
                      <p className="font-medium">{market.question}</p>
                      <p className="text-zinc-500 text-xs">{market.slug}</p>
                    </td>
                    <td className="py-3 pr-4 text-green-400">{formatPrice(market.yesPrice)}</td>
                    <td className="py-3 pr-4 text-red-400">{formatPrice(market.noPrice)}</td>
                    <td className="py-3 pr-4">${market.volume24h.toLocaleString()}</td>
                    <td className="py-3 text-zinc-500 font-mono text-xs">{market.id}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <p className="text-xs text-zinc-500">
        Copy a market ID when{" "}
        <Link href="/bots/new" className="text-teal-400 hover:underline">
          creating a bot
        </Link>
        .
      </p>
    </div>
  );
}