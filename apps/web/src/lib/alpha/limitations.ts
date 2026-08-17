export const BACKTEST_LIMITATIONS = [
  "Snapshots are whatever bot ticks or imports recorded — not a complete Polymarket tape or CLOB book.",
  "Fills are at the Gamma mid (YES = outcomePrices[0], NO = 1 − YES). No bid/ask, no slippage, no partials.",
  "No trading fees on open/close; a 2% fee is applied only to positive settlement profit.",
  "Features at time T use only bars with capturedAt ≤ T (no lookahead).",
  "Sampling is irregular (tick cadence or imported timestamps). Sharpe is annualized from mean inter-bar Δt when possible.",
  "Event extras on a bar (inline `event` or imported snapshot JSON) feed event_threshold. Harvested rows are price-only unless extras were imported.",
  "Paper trading only. Not financial advice and not a live execution path.",
] as const;
