import type { AlphaPlaybookStep } from "@polyagent/shared";

/** Agent-facing research loop: catalog → scan → inspect → backtest → paper bot. */
export const ALPHA_RESEARCH_PLAYBOOK: AlphaPlaybookStep[] = [
  {
    step: 1,
    method: "GET",
    path: "/api/alphas",
    purpose: "List versioned hypotheses, tags, and parameter specs",
  },
  {
    step: 2,
    method: "GET",
    path: "/api/alphas/scan",
    purpose: "Rank live catalog signals across the market universe",
  },
  {
    step: 3,
    method: "GET",
    path: "/api/markets/:id/features",
    purpose: "Inspect the features that produced a signal",
  },
  {
    step: 4,
    method: "POST",
    path: "/api/backtests",
    purpose: "Replay a candidate; optional split={mode:holdout|walk_forward} for OOS metrics",
  },
  {
    step: 5,
    method: "POST",
    path: "/api/backtests/sweep",
    purpose: "Search parameter space (≤50 combos); pass split to rank on OOS metrics",
  },
  {
    step: 6,
    method: "POST",
    path: "/api/bots",
    purpose: "Promote a surviving alpha to a paper bot (strategy.type=alpha)",
  },
];

export const SCAN_LIMITATIONS = [
  "Scan ranks the current catalog on the latest mid (live Gamma when available, else last stored bar).",
  "Features use harvested or imported snapshots plus that last mid. Thin tapes make momentum/volume-z null.",
  "HOLD signals are omitted unless includeHolds=true. Rank is confidence × |score|.",
  "A live signal is not a backtest. Confirm with POST /api/backtests before promoting to a bot.",
  "Paper trading only. Not financial advice and not a live execution path.",
] as const;
