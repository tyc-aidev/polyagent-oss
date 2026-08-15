import type {
  AgentDecision,
  BacktestEquityPoint,
  BacktestReport,
  BacktestTrade,
  BotConfig,
  MarketSnapshot,
  PriceBar,
} from "@polyagent/shared";
import { portfolioEquity } from "@/lib/paper-trading/pnl";
import { createPortfolio } from "@/lib/paper-trading/portfolio";
import { runSimulatorTick } from "@/lib/paper-trading/simulator";
import { evaluateAlpha, getAlpha, resolveAlphaParameters } from "./catalog";
import { signalToDecision } from "./decisions";
import { computeMarketFeatures, DEFAULT_FEATURE_LOOKBACK, sortBars } from "./features";
import { BACKTEST_LIMITATIONS } from "./limitations";

export interface BacktestOptions {
  alphaId: string;
  parameters?: Record<string, number>;
  bars: PriceBar[];
  startingBalance?: number;
  maxPositionSize?: number;
  confidenceThreshold?: number;
  lookback?: number;
}

function snapshotFromBar(bar: PriceBar): MarketSnapshot {
  return {
    id: bar.marketId,
    slug: bar.marketId,
    question: bar.marketId,
    yesPrice: bar.yesPrice,
    noPrice: bar.noPrice,
    volume24h: bar.volume24h,
    liquidity: 0,
    resolved: false,
  };
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function sampleStdev(values: number[]): number | null {
  if (values.length < 2) return null;
  const avg = mean(values);
  const variance = values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function maxDrawdown(equities: number[]): number {
  let peak = equities[0] ?? 0;
  let worst = 0;
  for (const equity of equities) {
    if (equity > peak) peak = equity;
    if (peak > 0) {
      const drawdown = (peak - equity) / peak;
      if (drawdown > worst) worst = drawdown;
    }
  }
  return worst;
}

function annualizedSharpe(curve: BacktestEquityPoint[], startingBalance: number): number | null {
  if (curve.length < 3 || startingBalance <= 0) return null;
  const returns: number[] = [];
  const deltas: number[] = [];
  for (let i = 1; i < curve.length; i += 1) {
    const previous = curve[i - 1];
    const current = curve[i];
    if (!previous || !current) continue;
    const dt = current.timestamp.getTime() - previous.timestamp.getTime();
    if (dt <= 0) continue;
    returns.push((current.equity - previous.equity) / startingBalance);
    deltas.push(dt);
  }
  const stdev = sampleStdev(returns);
  if (!stdev || stdev === 0 || deltas.length === 0) return null;
  const avgDtMs = mean(deltas);
  const periodsPerYear = (365.25 * 24 * 60 * 60 * 1000) / avgDtMs;
  return (mean(returns) / stdev) * Math.sqrt(periodsPerYear);
}

export function runBacktest(options: BacktestOptions): BacktestReport {
  const definition = getAlpha(options.alphaId);
  if (!definition) {
    throw new Error(`Alpha not found: ${options.alphaId}`);
  }

  const bars = sortBars(options.bars);
  if (bars.length === 0) {
    throw new Error("Backtest requires at least one price bar");
  }

  const parameters = resolveAlphaParameters(options.alphaId, options.parameters);
  const startingBalance = options.startingBalance ?? 10_000;
  const maxPositionSize = options.maxPositionSize ?? 100;
  const confidenceThreshold = options.confidenceThreshold ?? 0;
  const lookback = options.lookback ?? DEFAULT_FEATURE_LOOKBACK;
  const marketIds = [...new Set(bars.map((bar) => bar.marketId))];
  const botId = "backtest";

  const config: BotConfig = {
    markets: marketIds,
    risk: { maxPositionSize, confidenceThreshold },
    strategy: { type: "threshold", parameters: { buyYesBelow: 1 } },
    mode: "paper",
    updateIntervalMinutes: 5,
    startingBalance,
  };

  const byMarket = new Map<string, PriceBar[]>();
  const timestamps = new Set<number>();
  for (const bar of bars) {
    const series = byMarket.get(bar.marketId) ?? [];
    series.push(bar);
    byMarket.set(bar.marketId, series);
    timestamps.add(bar.capturedAt.getTime());
  }

  let portfolio = createPortfolio(botId, startingBalance);
  const latest = new Map<string, MarketSnapshot>();
  const equityCurve: BacktestEquityPoint[] = [];
  const trades: BacktestTrade[] = [];
  let dayStartPnl = 0;
  let currentDay: string | null = null;

  for (const ts of [...timestamps].sort((a, b) => a - b)) {
    const timestamp = new Date(ts);
    const dayKey = timestamp.toISOString().slice(0, 10);
    if (dayKey !== currentDay) {
      currentDay = dayKey;
      dayStartPnl = portfolio.totalPnl;
    }

    const decisions: AgentDecision[] = [];

    for (const [marketId, series] of byMarket) {
      const history = series.filter((bar) => bar.capturedAt.getTime() <= ts);
      const last = history[history.length - 1];
      if (!last) continue;
      latest.set(marketId, snapshotFromBar(last));
      if (last.capturedAt.getTime() !== ts) continue;

      const features = computeMarketFeatures(history, lookback);
      if (!features) continue;
      const signal = evaluateAlpha(options.alphaId, features, parameters);
      decisions.push(signalToDecision(signal, botId, maxPositionSize, features.yesPrice));
    }

    const result = runSimulatorTick(portfolio, decisions, latest, config, dayStartPnl);
    portfolio = result.portfolio;

    for (const record of result.records) {
      trades.push({
        timestamp,
        marketId: record.decision.marketId,
        action: record.decision.action,
        size: record.decision.size,
        price: record.decision.price,
        executed: record.executed,
        reason: record.reason,
        reasoning: record.decision.reasoning,
      });
    }

    const equity = portfolioEquity(portfolio, latest);
    equityCurve.push({
      timestamp,
      equity,
      cash: portfolio.cashBalance,
      pnl: portfolio.totalPnl,
    });
  }

  const lastPoint = equityCurve[equityCurve.length - 1];
  const equities = equityCurve.map((point) => point.equity);
  const executed = trades.filter((trade) => trade.executed);
  let positiveTicks = 0;
  for (let i = 1; i < equityCurve.length; i += 1) {
    const previous = equityCurve[i - 1];
    const current = equityCurve[i];
    if (previous && current && current.equity > previous.equity) positiveTicks += 1;
  }

  return {
    alphaId: options.alphaId,
    parameters,
    marketIds,
    from: bars[0]?.capturedAt ?? null,
    to: bars[bars.length - 1]?.capturedAt ?? null,
    metrics: {
      ticks: equityCurve.length,
      trades: executed.length,
      positiveTicks,
      hitRate: equityCurve.length > 1 ? positiveTicks / (equityCurve.length - 1) : 0,
      startingBalance,
      endingEquity: lastPoint?.equity ?? startingBalance,
      totalPnl: lastPoint?.pnl ?? 0,
      maxDrawdown: maxDrawdown(equities),
      sharpe: annualizedSharpe(equityCurve, startingBalance),
    },
    equityCurve,
    trades,
    limitations: [...BACKTEST_LIMITATIONS],
  };
}
