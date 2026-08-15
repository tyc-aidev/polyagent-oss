"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { AlphaDefinition } from "@polyagent/shared";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

type StrategyType = "threshold" | "alpha";

interface BotFormValues {
  name: string;
  markets: string;
  strategyType: StrategyType;
  buyYesBelow: string;
  alphaId: string;
  alphaParameters: Record<string, string>;
  lookback: string;
  maxPositionSize: string;
  confidenceThreshold: string;
  startingBalance: string;
}

interface BotFormProps {
  mode: "create" | "edit";
  botId?: string;
  alphas: AlphaDefinition[];
  initial?: Partial<BotFormValues> & { status?: string };
}

export function BotForm({ mode, botId, alphas, initial }: BotFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [strategyType, setStrategyType] = useState<StrategyType>(initial?.strategyType ?? "threshold");
  const [alphaId, setAlphaId] = useState(initial?.alphaId ?? alphas[0]?.id ?? "threshold_yes");
  const [alphaParameters, setAlphaParameters] = useState<Record<string, string>>(
    initial?.alphaParameters ?? {},
  );

  const selectedAlpha = useMemo(
    () => alphas.find((alpha) => alpha.id === alphaId) ?? alphas[0],
    [alphas, alphaId],
  );

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const markets = String(form.get("markets"))
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    const parameters: Record<string, number> = {};
    if (selectedAlpha) {
      for (const spec of selectedAlpha.parameters) {
        const raw = alphaParameters[spec.name];
        if (raw === undefined || raw === "") continue;
        const value = Number(raw);
        if (Number.isFinite(value)) parameters[spec.name] = value;
      }
    }

    const lookbackRaw = String(form.get("lookback") ?? "");
    const lookback = Number(lookbackRaw);

    const payload = {
      name: String(form.get("name")),
      config: {
        markets,
        risk: {
          maxPositionSize: Number(form.get("maxPositionSize")),
          confidenceThreshold: Number(form.get("confidenceThreshold")),
        },
        strategy:
          strategyType === "alpha"
            ? {
                type: "alpha" as const,
                alphaId,
                parameters: Object.keys(parameters).length > 0 ? parameters : undefined,
                lookback: Number.isFinite(lookback) && lookback > 0 ? lookback : undefined,
              }
            : {
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
        <Label htmlFor="name">Bot name</Label>
        <Input
          id="name"
          name="name"
          required
          defaultValue={initial?.name}
          placeholder="My Threshold Bot"
        />
      </div>
      <div>
        <Label htmlFor="markets">Market IDs (comma-separated)</Label>
        <Input
          id="markets"
          name="markets"
          required
          defaultValue={initial?.markets}
          placeholder="12345, 67890"
        />
      </div>
      <div>
        <Label htmlFor="strategyType">Strategy</Label>
        <select
          id="strategyType"
          name="strategyType"
          value={strategyType}
          onChange={(event) => setStrategyType(event.target.value as StrategyType)}
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
        >
          <option value="threshold">Threshold (price rule)</option>
          <option value="alpha">Catalog alpha</option>
        </select>
      </div>
      {strategyType === "threshold" ? (
        <div>
          <Label htmlFor="buyYesBelow">Buy YES below (0–1)</Label>
          <Input
            id="buyYesBelow"
            name="buyYesBelow"
            type="number"
            step="0.01"
            min="0"
            max="1"
            required
            defaultValue={initial?.buyYesBelow ?? "0.35"}
          />
        </div>
      ) : (
        <>
          <div>
            <Label htmlFor="alphaId">Catalog alpha</Label>
            <select
              id="alphaId"
              name="alphaId"
              value={alphaId}
              onChange={(event) => {
                setAlphaId(event.target.value);
                setAlphaParameters({});
              }}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
            >
              {alphas.map((alpha) => (
                <option key={alpha.id} value={alpha.id}>
                  {alpha.name}
                </option>
              ))}
            </select>
            {selectedAlpha && (
              <p className="mt-1 text-xs text-muted-foreground">{selectedAlpha.hypothesis}</p>
            )}
          </div>
          <div>
            <Label htmlFor="lookback">Feature lookback (bars)</Label>
            <Input
              id="lookback"
              name="lookback"
              type="number"
              min="1"
              max="100"
              defaultValue={initial?.lookback ?? "5"}
            />
          </div>
          {selectedAlpha?.parameters.map((spec) => (
            <div key={spec.name}>
              <Label htmlFor={`alpha-${spec.name}`}>
                {spec.name}{" "}
                <span className="font-normal text-muted-foreground">(default {spec.defaultValue})</span>
              </Label>
              <Input
                id={`alpha-${spec.name}`}
                type="number"
                step="any"
                min={spec.minimum}
                max={spec.maximum}
                placeholder={String(spec.defaultValue)}
                value={alphaParameters[spec.name] ?? ""}
                onChange={(event) =>
                  setAlphaParameters((current) => ({ ...current, [spec.name]: event.target.value }))
                }
              />
              <p className="mt-1 text-xs text-muted-foreground">{spec.description}</p>
            </div>
          ))}
        </>
      )}
      <div>
        <Label htmlFor="maxPositionSize">Max position size (USDC)</Label>
        <Input
          id="maxPositionSize"
          name="maxPositionSize"
          type="number"
          min="1"
          required
          defaultValue={initial?.maxPositionSize ?? "100"}
        />
      </div>
      <div>
        <Label htmlFor="confidenceThreshold">Confidence threshold (0–1)</Label>
        <Input
          id="confidenceThreshold"
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
        <Label htmlFor="startingBalance">Starting balance (USDC)</Label>
        <Input
          id="startingBalance"
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
          <Label htmlFor="status">Status</Label>
          <select
            id="status"
            name="status"
            defaultValue={initial?.status ?? "paused"}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
          >
            <option value="paused">paused</option>
            <option value="active">active</option>
            <option value="archived">archived</option>
          </select>
        </div>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={loading}>
        {loading ? "Saving..." : mode === "create" ? "Create Bot" : "Save Changes"}
      </Button>
    </form>
  );
}
