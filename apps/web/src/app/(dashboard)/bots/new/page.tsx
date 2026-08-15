import { BotForm } from "@/components/bots/bot-form";
import { Card, CardTitle } from "@/components/ui/card";
import { listAlphaCatalog } from "@/lib/api/alphas";

export default function NewBotPage() {
  const alphas = listAlphaCatalog();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Create Bot</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Configure a threshold rule or a catalog alpha for paper trading.
        </p>
      </div>
      <Card>
        <CardTitle>Bot Configuration</CardTitle>
        <BotForm mode="create" alphas={alphas} />
      </Card>
    </div>
  );
}