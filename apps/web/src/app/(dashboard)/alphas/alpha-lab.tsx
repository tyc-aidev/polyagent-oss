"use client";

import { useMemo, useState } from "react";
import type {
  AlphaDefinition,
  AlphaOpportunity,
  AlphaResearchReport,
  AlphaScanReport,
  AlphaSignal,
  BacktestReport,
  MarketFeatures,
  SweepReport,
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
  const [busy, setBusy] = useState<"backtest" | "signals" | "scan" | "sweep" | "research" | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<BacktestReport | null>(null);
  const [signals, setSignals] = useState<SignalsResponse | null>(null);
  const [scan, setScan] = useState<AlphaScanReport | null>(null);
  const [research, setResearch] = useState<AlphaResearchReport | null>(null);
  const [sweep, setSweep] = useState<SweepReport | null>(null);
  const [splitMode, setSplitMode] = useState<"" | "holdout" | "walk_forward">("");

  function splitPayload(): { mode: "holdout" | "walk_forward" } | undefined {
    return splitMode === "" ? undefined : { mode: splitMode };
  }

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

  function parseInlineBars(): unknown {
    if (!barsJson.trim()) return undefined;
    const bars = JSON.parse(barsJson) as unknown;
    if (!Array.isArray(bars)) {
      throw new Error("Inline bars must be a JSON array");
    }
    return bars;
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
      const response = await fetch("/api/backtests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          alphaId: selected.id,
          marketIds: ids,
          parameters: mergedParameters(),
          startingBalance: Number(startingBalance) || 10_000,
          maxPositionSize: Number(maxPositionSize) || 100,
          bars: parseInlineBars(),
          split: splitPayload(),
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

  async function runSweep() {
    if (!selected) return;
    const ids = parseMarketIds(marketIds);
    if (ids.length === 0) {
      setError("Enter at least one market ID.");
      return;
    }

    setBusy("sweep");
    setError(null);
    try {
      const response = await fetch("/api/backtests/sweep", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          alphaId: selected.id,
          marketIds: ids,
          startingBalance: Number(startingBalance) || 10_000,
          maxPositionSize: Number(maxPositionSize) || 100,
          bars: parseInlineBars(),
          split: splitPayload(),
        }),
      });
      const body = (await response.json()) as SweepReport & { error?: string };
      if (!response.ok) {
        throw new Error(body.error ?? `Sweep failed (${response.status})`);
      }
      setSweep(body);
      if (body.winner) {
        const next: Record<string, string> = {};
        for (const [name, value] of Object.entries(body.winner.parameters)) {
          next[name] = String(value);
        }
        setParamValues(next);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sweep failed");
    } finally {
      setBusy(null);
    }
  }

  function adoptOpportunity(item: AlphaOpportunity) {
    setSelectedId(item.alphaId);
    setSignalMarketId(item.marketId);
    setMarketIds(item.marketId);
  }

  async function runResearch() {
    setBusy("research");
    setError(null);
    try {
      const ids = parseMarketIds(marketIds);
      const response = await fetch("/api/alphas/research", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          marketIds: ids.length > 0 ? ids : undefined,
          alphaIds: selectedId ? [selectedId] : undefined,
          top: 3,
          steps: 3,
          split: splitPayload(),
        }),
      });
      const body = (await response.json()) as AlphaResearchReport & { error?: string };
      if (!response.ok) {
        throw new Error(body.error ?? `Research failed (${response.status})`);
      }
      setResearch(body);
      setScan(body.scan);
      const winner = body.candidates.find((item) => item.sweep?.winner);
      if (winner) {
        adoptOpportunity(winner.liveSignal);
        if (winner.promote.strategy.parameters) {
          const next: Record<string, string> = {};
          for (const [name, value] of Object.entries(winner.promote.strategy.parameters)) {
            next[name] = String(value);
          }
          setParamValues(next);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Research failed");
    } finally {
      setBusy(null);
    }
  }

  async function scanUniverse() {
    setBusy("scan");
    setError(null);
    try {
      const params = new URLSearchParams();
      if (selectedId) params.set("alphaId", selectedId);
      const response = await fetch(`/api/alphas/scan?${params.toString()}`);
      const body = (await response.json()) as AlphaScanReport & { error?: string };
      if (!response.ok) {
        throw new Error(body.error ?? `Universe scan failed (${response.status})`);
      }
      setScan(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Universe scan failed");
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
      <Card>
        <CardTitle>Agent playbook</CardTitle>
        <CardDescription>
          Catalog → research (scan+sweep) → inspect → paper bot.
        </CardDescription>
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
          <li>
            <span className="font-mono text-xs">GET /api/alphas</span> — list hypotheses
          </li>
          <li>
            <span className="font-mono text-xs">POST /api/alphas/research</span> — scan + sweep in
            one call
          </li>
          <li>
            <span className="font-mono text-xs">GET /api/alphas/scan</span> — rank live catalog
            signals
          </li>
          <li>
            <span className="font-mono text-xs">POST /api/backtests</span> — replay a candidate
          </li>
          <li>
            <span className="font-mono text-xs">POST /api/backtests/sweep</span> — search parameter
            space
          </li>
          <li>
            <span className="font-mono text-xs">POST /api/bots</span> — promote{" "}
            <span className="font-mono text-xs">strategy.type=alpha</span>
          </li>
        </ol>
      </Card>

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
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={() => void discoverSignals()} disabled={busy !== null}>
                {busy === "signals" ? "Evaluating…" : "Evaluate catalog"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => void scanUniverse()}
                disabled={busy !== null}
              >
                {busy === "scan" ? "Scanning…" : "Scan universe"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => void runResearch()}
                disabled={busy !== null}
              >
                {busy === "research" ? "Researching…" : "Run research loop"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Scan ranks the selected alpha on top live Gamma markets. Click a row to backtest it.
            </p>
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
            <div>
              <Label htmlFor="split-mode">Validation split</Label>
              <select
                id="split-mode"
                value={splitMode}
                onChange={(event) =>
                  setSplitMode(event.target.value as "" | "holdout" | "walk_forward")
                }
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              >
                <option value="">None (full tape, in-sample)</option>
                <option value="holdout">Holdout (70/30)</option>
                <option value="walk_forward">Walk-forward (3 folds)</option>
              </select>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={() => void runBacktest()} disabled={busy !== null}>
                {busy === "backtest" ? "Running…" : "Run backtest"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => void runSweep()}
                disabled={busy !== null}
              >
                {busy === "sweep" ? "Sweeping…" : "Sweep parameters"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Sweep searches the selected alpha&apos;s published min/max (≤50 combos) and fills the
              winning parameters.
            </p>
          </div>
        </Card>
      </div>

      {error && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {sweep && (
        <Card>
          <CardTitle>Parameter sweep</CardTitle>
          <CardDescription>
            {sweep.combinations} combination{sweep.combinations === 1 ? "" : "s"} · ranked by Sharpe,
            then P&amp;L. In-sample only.
            {sweep.winner
              ? ` Winner score ${sweep.winner.score.toFixed(3)}.`
              : ""}
          </CardDescription>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Parameters</TableHead>
                <TableHead className="text-right">P&amp;L</TableHead>
                <TableHead className="text-right">Trades</TableHead>
                <TableHead className="text-right">Hit rate</TableHead>
                <TableHead className="text-right">Sharpe</TableHead>
                <TableHead className="text-right">Max DD</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sweep.results.map((row, index) => (
                <TableRow key={JSON.stringify(row.parameters)}>
                  <TableCell>
                    <button
                      type="button"
                      className="text-left font-mono text-xs hover:underline"
                      onClick={() => {
                        const next: Record<string, string> = {};
                        for (const [name, value] of Object.entries(row.parameters)) {
                          next[name] = String(value);
                        }
                        setParamValues(next);
                      }}
                    >
                      {index === 0 ? "★ " : ""}
                      {Object.entries(row.parameters)
                        .map(([name, value]) => `${name}=${Number(value.toFixed(4))}`)
                        .join(" · ")}
                    </button>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatUsd(row.metrics.totalPnl)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{row.metrics.trades}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {(row.metrics.hitRate * 100).toFixed(0)}%
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.metrics.sharpe === null ? "n/a" : row.metrics.sharpe.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {(row.metrics.maxDrawdown * 100).toFixed(1)}%
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {research && (
        <Card>
          <CardTitle>Research loop</CardTitle>
          <CardDescription>
            {research.candidates.length} candidate{research.candidates.length === 1 ? "" : "s"} from{" "}
            {research.scan.scanned} scanned market{research.scan.scanned === 1 ? "" : "s"}.
          </CardDescription>
          {research.candidates.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              No live catalog signals to research. Harvest a tape or pick another alpha.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Market / alpha</TableHead>
                  <TableHead>Live</TableHead>
                  <TableHead className="text-right">Sweep P&amp;L</TableHead>
                  <TableHead>Promote params</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {research.candidates.map((item) => (
                  <TableRow key={`${item.marketId}-${item.alphaId}`}>
                    <TableCell>
                      <button
                        type="button"
                        className="text-left hover:underline"
                        onClick={() => adoptOpportunity(item.liveSignal)}
                      >
                        <span className="block text-sm">{item.question || item.marketId}</span>
                        <span className="font-mono text-xs text-muted-foreground">
                          {item.alphaId}
                        </span>
                      </button>
                    </TableCell>
                    <TableCell>
                      {item.liveSignal.action} · {item.liveSignal.confidence.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {item.sweep?.winner
                        ? formatUsd(item.sweep.winner.metrics.totalPnl)
                        : (item.skippedReason ?? "n/a")}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {Object.entries(item.promote.strategy.parameters)
                        .map(([name, value]) => `${name}=${Number(value.toFixed(4))}`)
                        .join(" · ") || "defaults"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      )}

      {scan && (
        <Card>
          <CardTitle>Universe scan</CardTitle>
          <CardDescription>
            {scan.scanned} market{scan.scanned === 1 ? "" : "s"} scanned
            {scan.skipped > 0 ? ` · ${scan.skipped} skipped` : ""}. Rank is confidence × |score|.
          </CardDescription>
          {scan.opportunities.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              No active catalog signals in this universe. Try another alpha or wait for harvest.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Market</TableHead>
                  <TableHead>Alpha</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead className="text-right">Rank</TableHead>
                  <TableHead className="text-right">YES</TableHead>
                  <TableHead>Reasoning</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scan.opportunities.map((item) => (
                  <TableRow key={`${item.marketId}-${item.alphaId}`}>
                    <TableCell>
                      <button
                        type="button"
                        className="text-left hover:underline"
                        onClick={() => adoptOpportunity(item)}
                      >
                        <span className="block text-sm text-foreground">
                          {item.question || item.marketId}
                        </span>
                        <span className="font-mono text-xs text-muted-foreground">{item.marketId}</span>
                      </button>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{item.alphaId}</TableCell>
                    <TableCell>{item.action}</TableCell>
                    <TableCell className="text-right tabular-nums">{item.rank.toFixed(3)}</TableCell>
                    <TableCell className="text-right tabular-nums">{item.yesPrice.toFixed(3)}</TableCell>
                    <TableCell className="text-muted-foreground">{item.reasoning}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
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

          {report.split && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Card>
                <p className="text-xs text-muted-foreground">
                  In-sample P&amp;L ({report.split.mode})
                </p>
                <p className="mt-1 text-xl font-semibold">
                  {formatUsd(report.split.inSample.totalPnl)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {report.split.inSample.trades} trades · hit{" "}
                  {(report.split.inSample.hitRate * 100).toFixed(0)}%
                </p>
              </Card>
              <Card>
                <p className="text-xs text-muted-foreground">Out-of-sample P&amp;L</p>
                <p className="mt-1 text-xl font-semibold">
                  {formatUsd(report.split.outOfSample.totalPnl)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {report.split.outOfSample.trades} trades · hit{" "}
                  {(report.split.outOfSample.hitRate * 100).toFixed(0)}%
                  {report.split.foldReports
                    ? ` · ${report.split.foldReports.length} folds`
                    : ""}
                </p>
              </Card>
            </div>
          )}

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
