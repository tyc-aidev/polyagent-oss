"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function RunTickButton({ botId }: { botId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function runTick() {
    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/bots/${botId}/tick`, { method: "POST" });
      const data = (await response.json()) as {
        error?: string;
        decisionsCount?: number;
        totalPnl?: number;
      };
      if (!response.ok) throw new Error(data.error ?? "Tick failed");

      setMessage(
        `Tick complete: ${data.decisionsCount ?? 0} decisions, P&L ${(data.totalPnl ?? 0) >= 0 ? "+" : ""}$${(data.totalPnl ?? 0).toFixed(2)}`,
      );
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Tick failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button onClick={runTick} disabled={loading}>
        {loading ? "Running..." : "Run Tick"}
      </Button>
      {message && <p className="text-sm text-zinc-400">{message}</p>}
    </div>
  );
}