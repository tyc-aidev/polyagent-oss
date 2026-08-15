export const dynamic = "force-dynamic";

import Link from "next/link";
import { Card, CardTitle } from "@/components/ui/card";
import { listMarkets } from "@/lib/api/markets";
import { MarketSearch } from "./market-search";
import { MarketsTable } from "./markets-table";

export default async function MarketsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const markets = await listMarkets(30, q);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Market Explorer</h1>
          <p className="mt-1 text-sm text-muted-foreground">Live Polymarket data via Gamma API</p>
        </div>
        <MarketSearch initialQuery={q} />
      </div>

      <Card>
        <CardTitle>Active Markets ({markets.length})</CardTitle>
        <MarketsTable markets={markets} />
      </Card>

      <p className="text-xs text-muted-foreground">
        Copy a market ID when{" "}
        <Link href="/bots/new" className="text-primary hover:underline">
          creating a bot
        </Link>{" "}
        or paste it into the{" "}
        <Link href="/alphas" className="text-primary hover:underline">
          Alpha Lab
        </Link>{" "}
        to score catalog signals.
      </p>
    </div>
  );
}
