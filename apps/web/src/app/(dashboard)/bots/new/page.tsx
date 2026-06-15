import { BotForm } from "@/components/bots/bot-form";
import { Card, CardTitle } from "@/components/ui/card";

export default function NewBotPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Create Bot</h1>
        <p className="text-zinc-400 text-sm mt-1">
          Configure a threshold strategy for paper trading.
        </p>
      </div>
      <Card>
        <CardTitle>Bot Configuration</CardTitle>
        <BotForm mode="create" />
      </Card>
    </div>
  );
}