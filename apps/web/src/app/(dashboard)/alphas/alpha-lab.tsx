"use client";

import { useMemo, useState } from "react";
import type {
  AlphaDefinition,
  AlphaSignal,
  BacktestReport,
  MarketFeatures,
} from "@polyagent/shared";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate, formatUsd } from "@/lib/format";
import { cn } from "@/lib/utils";

interface AlphaLabProps {
  alphas: AlphaDefinition[];
}

interface SignalsResponse {
  features: MarketFeatures;
  signals: AlphaSignal[];
  live: boolean;
  historySize: number;
}

function parseMarketIds(value: string): string[] {
  return value
    .split(/[\s,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function AlphaLab({ alphas }: AlphaLabProps) {
  const [selectedId, setSelectedId] = useState(alphas[0]?.id ?? "");
  const selected = useMemo(
    () => alphas.find((alpha) => alpha.id === selectedId) ?? alphas[0],
    [alphas, selectedId],
  );
  const [paramValues, setParamValues] = useState<Record<string, string>>({});
  const [marketIds, setMarketIds] = useState("");
  const [startingBalance, setStartingBalance] = useState("10000");
  const [maxPositionSize, setMaxPositionSize] = useState("100");
  const [barsJson, setBarsJson] = useState("");
  const [signalMarketId, setSignalMarketId] = useState("");
  const [busy, setBusy] = useState<"backtest" | "signals" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<BacktestReport | null>(null);
  const [signals, setSignals] = useState<SignalsResponse | null>(null);

  function mergedParameters(): Record<string, number> | undefined {
    if (!selected) return undefined;
    const next: Record<string, number> = {};
    for (const spec of selected.parameters) {
      const raw = paramValues[spec.name];
      if (raw === undefined || raw === "") continue;
      const value = Number(raw);
      if (Number.isFinite(value)) next[spec.name] = value;
    }
    return Object.keys(next).length > 0 ? next : undefined;
  }

  async function runBacktest() {
    if (!selected) return;
    const ids = parseMarketIds(marketIds);
    if (ids.length === 0) {
      setError("Enter at least one market ID.");
      return;
    }

    setBusy("backtest");
    setError(null);
    try {
      let bars: unknown;
      if (barsJson.trim()) {
        bars = JSON.parse(barsJson);
        if (!Array.isArray(bars)) {
          throw new Error("Inline bars must be a JSON array");
        }
      }

      const response = await fetch("/api/backtests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          alphaId: selected.id,
          marketIds: ids,
          parameters: mergedParameters(),
          startingBalance: Number(startingBalance) || 10_000,
          maxPositionSize: Number(maxPositionSize) || 100,
          bars,
        }),
      });
      const body = (await response.json()) as BacktestReport & { error?: string };
      if (!response.ok) {
        throw new Error(body.error ?? `Backtest failed (${response.status})`);
      }
      setReport(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Backtest failed");
    } finally {
      setBusy(null);
    }
  }

  async function discoverSignals() {
    const marketId = signalMarketId.trim();
    if (!marketId) {
      setError("Enter a market ID to discover signals.");
      return;
    }
    setBusy("signals");
    setError(null);
    try {
      const response = await fetch(`/api/markets/${encodeURIComponent(marketId)}/signals`);
      const body = (await response.json()) as SignalsResponse & { error?: string };
      if (!response.ok) {
        throw new Error(body.error ?? `Signal discovery failed (${response.status})`);
      }
      setSignals(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signal discovery failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {alphas.map((alpha) => {
          const active = alpha.id === selected?.id;
          return (
            <button
              key={alpha.id}
              type="button"
              onClick={() => {
                setSelectedId(alpha.id);
                setParamValues({});
              }}
              className={cn(
                "rounded-lg border p-4 text-left transition-colors",
                active
                  ? "border-primary bg-primary-muted/40 ring-1 ring-primary/40"
                  : "border-border bg-card hover:border-primary/30",
              )}
            >
              <p className="text-sm font-semibold text-foreground">{alpha.name}</p>
              <p className="mt-1 font-mono text-xs text-muted-foreground">{alpha.id}</p>
              <p className="mt-2 text-sm text-muted-foreground">{alpha.hypothesis}</p>
              <p className="mt-2 text-xs uppercase tracking-wide text-muted-foreground">
                {alpha.tags.join(" · ")}
              </p>
            </button>
          );
        })}
      </div>

      {selected && (
        <Card>
          <CardTitle>{selected.name}</CardTitle>
          <CardDescription>{selected.description}</CardDescription>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {selected.parameters.map((spec) => (
              <div key={spec.name}>
                <Label htmlFor={`param-${spec.name}`}>
                  {spec.name}{" "}
                  <span className="font-normal text-muted-foreground">
                    (default {spec.defaultValue})
                  </span>
                </Label>
                <Input
                  id={`param-${spec.name}`}
                  type="number"
                  step="any"
                  min={spec.minimum}
                  max={spec.maximum}
                  placeholder={String(spec.defaultValue)}
                  value={paramValues[spec.name] ?? ""}
                  onChange={(event) =>
                    setParamValues((current) => ({ ...current, [spec.name]: event.target.value }))
                  }
                />
                <p className="mt-1 text-xs text-muted-foreground">{spec.description}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle>Discover signals</CardTitle>
          <CardDescription>
            Evaluate the full catalog against stored snapshots plus the live Gamma mid.
          </CardDescription>
          <div className="mt-4 space-y-3">
            <div>
              <Label htmlFor="signal-market">Market ID</Label>
              <Input
                id="signal-market"
                value={signalMarketId}
                onChange={(event) => setSignalMarketId(event.target.value)}
                placeholder="Polymarket market id"
              />
            </div>
            <Button type="button" onClick={() => void discoverSignals()} disabled={busy !== null}>
              {busy === "signals" ? "Evaluating…" : "Evaluate catalog"}
            </Button>
          </div>
        </Card>

        <Card>
          <CardTitle>Backtest alpha</CardTitle>
          <CardDescription>
            Replay stored snapshots or paste agent-supplied bars. No live Gamma calls during replay.
          </CardDescription>
          <div className="mt-4 space-y-3">
            <div>
              <Label htmlFor="market-ids">Market IDs</Label>
              <Input
                id="market-ids"
                value={marketIds}
                onChange={(event) => setMarketIds(event.target.value)}
                placeholder="id-1, id-2"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="starting-balance">Starting balance</Label>
                <Input
                  id="starting-balance"
                  type="number"
                  min={1}
                  value={startingBalance}
                  onChange={(event) => setStartingBalance(event.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="max-position">Max position</Label>
                <Input
                  id="max-position"
                  type="number"
                  min={1}
                  value={maxPositionSize}
                  onChange={(event) => setMaxPositionSize(event.target.value)}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="bars-json">Inline bars (optional JSON array)</Label>
              <textarea
                id="bars-json"
                value={barsJson}
                onChange={(event) => setBarsJson(event.target.value)}
                rows={5}
                placeholder='[{"marketId":"m1","capturedAt":"2026-01-01T00:00:00.000Z","yesPrice":0.4,"noPrice":0.6,"volume24h":1000}]'
                className="flex min-h-[8rem] w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs text-foreground shadow-sm placeholder:text-muted-foreground focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              />
            </div>
            <Button type="button" onClick={() => void runBacktest()} disabled={busy !== null}>
              {busy === "backtest" ? "Running…" : "Run backtest"}
            </Button>
          </div>
        </Card>
      </div>

      {error && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {signals && (
        <Card>
          <CardTitle>Catalog signals</CardTitle>
          <CardDescription>
            {signals.historySize} bar{signals.historySize === 1 ? "" : "s"}
            {signals.live ? " including live Gamma mid" : ""}. YES{" "}
            {signals.features.yesPrice.toFixed(3)} · residual{" "}
            {signals.features.meanReversionResidual?.toFixed(3) ?? "n/a"} · momentum{" "}
            {signals.features.momentum?.toFixed(4) ?? "n/a"}
          </CardDescription>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Alpha</TableHead>
                <TableHead>Action</TableHead>
                <TableHead className="text-right">Score</TableHead>
                <TableHead className="text-right">Confidence</TableHead>
                <TableHead>Reasoning</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {signals.signals.map((signal) => (
                <TableRow key={signal.alphaId}>
                  <TableCell className="font-mono text-xs">{signal.alphaId}</TableCell>
                  <TableCell>{signal.action}</TableCell>
                  <TableCell className="text-right tabular-nums">{signal.score.toFixed(3)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {signal.confidence.toFixed(3)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{signal.reasoning}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {report && (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <p className="text-xs text-muted-foreground">Total P&amp;L</p>
              <p className="mt-1 text-xl font-semibold">{formatUsd(report.metrics.totalPnl)}</p>
            </Card>
            <Card>
              <p className="text-xs text-muted-foreground">Ending equity</p>
              <p className="mt-1 text-xl font-semibold">
                ${report.metrics.endingEquity.toFixed(2)}
              </p>
            </Card>
            <Card>
              <p className="text-xs text-muted-foreground">Trades / hit rate</p>
              <p className="mt-1 text-xl font-semibold">
                {report.metrics.trades} · {(report.metrics.hitRate * 100).toFixed(0)}%
              </p>
            </Card>
            <Card>
              <p className="text-xs text-muted-foreground">Max DD / Sharpe</p>
              <p className="mt-1 text-xl font-semibold">
                {(report.metrics.maxDrawdown * 100).toFixed(1)}% ·{" "}
                {report.metrics.sharpe === null ? "n/a" : report.metrics.sharpe.toFixed(2)}
              </p>
            </Card>
          </div>

          <Card>
            <CardTitle>Equity curve</CardTitle>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead className="text-right">Equity</TableHead>
                  <TableHead className="text-right">Cash</TableHead>
                  <TableHead className="text-right">P&amp;L</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.equityCurve.map((point) => (
                  <TableRow key={String(point.timestamp)}>
                    <TableCell>{formatDate(point.timestamp)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      ${point.equity.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">${point.cash.toFixed(2)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatUsd(point.pnl)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          <Card>
            <CardTitle>Trade log</CardTitle>
            {report.trades.length === 0 ? (
              <p className="text-sm text-muted-foreground">No decisions recorded.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead className="text-right">Size</TableHead>
                    <TableHead>Filled</TableHead>
                    <TableHead>Reasoning</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.trades.map((trade, index) => (
                    <TableRow key={`${String(trade.timestamp)}-${index}`}>
                      <TableCell>{formatDate(trade.timestamp)}</TableCell>
                      <TableCell>{trade.action}</TableCell>
                      <TableCell className="text-right tabular-nums">{trade.size}</TableCell>
                      <TableCell>{trade.executed ? "yes" : trade.reason ?? "no"}</TableCell>
                      <TableCell className="text-muted-foreground">{trade.reasoning}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>

          <Card>
            <CardTitle>Data limitations</CardTitle>
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {report.limitations.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </Card>
        </div>
      )}
    </div>
  );
}
