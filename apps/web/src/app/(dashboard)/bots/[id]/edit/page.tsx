export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { getBot } from "@/lib/api/bots";
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Edit Bot</h1>
        <p className="text-zinc-400 text-sm mt-1">{bot.name}</p>
      </div>
      <Card>
        <CardTitle>Configuration</CardTitle>
        <BotForm
          mode="edit"
          botId={id}
          initial={{
            name: bot.name,
            markets: bot.config.markets.join(", "),
            buyYesBelow: String(bot.config.strategy.parameters.buyYesBelow ?? 0.35),
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