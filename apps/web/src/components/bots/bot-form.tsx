"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

interface BotFormValues {
  name: string;
  markets: string;
  buyYesBelow: string;
  maxPositionSize: string;
  confidenceThreshold: string;
  startingBalance: string;
}

interface BotFormProps {
  mode: "create" | "edit";
  botId?: string;
  initial?: Partial<BotFormValues> & { status?: string };
}

export function BotForm({ mode, botId, initial }: BotFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const markets = String(form.get("markets"))
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    const payload = {
      name: String(form.get("name")),
      config: {
        markets,
        risk: {
          maxPositionSize: Number(form.get("maxPositionSize")),
          confidenceThreshold: Number(form.get("confidenceThreshold")),
        },
        strategy: {
          type: "threshold" as const,
          parameters: {
            buyYesBelow: Number(form.get("buyYesBelow")),
          },
        },
        mode: "paper" as const,
        updateIntervalMinutes: 15,
        startingBalance: Number(form.get("startingBalance")),
      },
    };

    try {
      const url = mode === "create" ? "/api/bots" : `/api/bots/${botId}`;
      const method = mode === "create" ? "POST" : "PATCH";
      const body =
        mode === "create"
          ? payload
          : {
              ...payload,
              ...(form.get("status") ? { status: String(form.get("status")) } : {}),
            };

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = (await response.json()) as { id?: string; error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Request failed");
      }

      const nextStatus = mode === "edit" ? String(form.get("status")) : undefined;
      if (nextStatus === "archived") {
        router.push("/bots");
      } else {
        router.push(`/bots/${data.id ?? botId}`);
      }
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="max-w-lg space-y-4">
      <div>
        <Label>Bot name</Label>
        <Input name="name" required defaultValue={initial?.name} placeholder="My Threshold Bot" />
      </div>
      <div>
        <Label>Market IDs (comma-separated)</Label>
        <Input
          name="markets"
          required
          defaultValue={initial?.markets}
          placeholder="12345, 67890"
        />
      </div>
      <div>
        <Label>Buy YES below (0–1)</Label>
        <Input
          name="buyYesBelow"
          type="number"
          step="0.01"
          min="0"
          max="1"
          required
          defaultValue={initial?.buyYesBelow ?? "0.35"}
        />
      </div>
      <div>
        <Label>Max position size (USDC)</Label>
        <Input
          name="maxPositionSize"
          type="number"
          min="1"
          required
          defaultValue={initial?.maxPositionSize ?? "100"}
        />
      </div>
      <div>
        <Label>Confidence threshold (0–1)</Label>
        <Input
          name="confidenceThreshold"
          type="number"
          step="0.01"
          min="0"
          max="1"
          required
          defaultValue={initial?.confidenceThreshold ?? "0.5"}
        />
      </div>
      <div>
        <Label>Starting balance (USDC)</Label>
        <Input
          name="startingBalance"
          type="number"
          min="1"
          required
          defaultValue={initial?.startingBalance ?? "10000"}
          disabled={mode === "edit"}
        />
      </div>
      {mode === "edit" && (
        <div>
          <Label>Status</Label>
          <select
            name="status"
            defaultValue={initial?.status ?? "paused"}
            className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
          >
            <option value="paused">paused</option>
            <option value="active">active</option>
            <option value="archived">archived</option>
          </select>
        </div>
      )}
      {error && <p className="text-sm text-red-400">{error}</p>}
      <Button type="submit" disabled={loading}>
        {loading ? "Saving..." : mode === "create" ? "Create Bot" : "Save Changes"}
      </Button>
    </form>
  );
}