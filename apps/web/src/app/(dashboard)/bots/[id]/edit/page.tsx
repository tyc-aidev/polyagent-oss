export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { getBot } from "@/lib/api/bots";
import { listAlphaCatalog } from "@/lib/api/alphas";
import { BotForm } from "@/components/bots/bot-form";
import { Card, CardTitle } from "@/components/ui/card";

export default async function EditBotPage({
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

  const strategy = bot.config.strategy;
  const alphas = listAlphaCatalog();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Edit Bot</h1>
        <p className="text-muted-foreground text-sm mt-1">{bot.name}</p>
      </div>
      <Card>
        <CardTitle>Configuration</CardTitle>
        <BotForm
          mode="edit"
          botId={id}
          alphas={alphas}
          initial={{
            name: bot.name,
            markets: bot.config.markets.join(", "),
            strategyType: strategy.type,
            buyYesBelow:
              strategy.type === "threshold"
                ? String(strategy.parameters.buyYesBelow ?? 0.35)
                : "0.35",
            alphaId: strategy.type === "alpha" ? strategy.alphaId : alphas[0]?.id,
            alphaParameters:
              strategy.type === "alpha"
                ? Object.fromEntries(
                    Object.entries(strategy.parameters ?? {}).map(([key, value]) => [key, String(value)]),
                  )
                : {},
            lookback: strategy.type === "alpha" ? String(strategy.lookback ?? 5) : "5",
            maxPositionSize: String(bot.config.risk.maxPositionSize),
            confidenceThreshold: String(bot.config.risk.confidenceThreshold),
            startingBalance: String(bot.config.startingBalance),
            status: bot.status,
          }}
        />
      </Card>
    </div>
  );
}