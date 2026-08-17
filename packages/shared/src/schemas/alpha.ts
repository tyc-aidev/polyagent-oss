import { z } from "zod";

export const eventFeatureValueSchema = z.union([
  z.number().finite(),
  z.string().max(128),
  z.boolean(),
  z.null(),
]);

export const eventFeatureBagSchema = z
  .record(z.record(eventFeatureValueSchema))
  .refine((bag) => Object.keys(bag).length <= 8, {
    message: "event bag allows at most 8 sources",
  });

export const priceBarInputSchema = z.object({
  marketId: z.string().min(1).optional(),
  capturedAt: z.coerce.date(),
  yesPrice: z.number().min(0).max(1),
  noPrice: z.number().min(0).max(1),
  volume24h: z.number().min(0),
  event: eventFeatureBagSchema.optional(),
});

export const importHistorySchema = z.object({
  bars: z.array(priceBarInputSchema).min(1).max(2_000),
});

export const backtestSplitSchema = z.object({
  mode: z.enum(["holdout", "walk_forward"]),
  trainFraction: z.number().min(0.5).max(0.9).optional(),
  folds: z.number().int().min(2).max(8).optional(),
});

export const runBacktestSchema = z
  .object({
    alphaId: z.string().trim().min(1).max(64),
    parameters: z.record(z.number().finite()).optional(),
    marketIds: z.array(z.string().min(1)).min(1).max(20),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
    bars: z.array(priceBarInputSchema).max(5_000).optional(),
    startingBalance: z.number().positive().max(10_000_000).optional(),
    maxPositionSize: z.number().positive().max(1_000_000).optional(),
    confidenceThreshold: z.number().min(0).max(1).optional(),
    lookback: z.number().int().min(1).max(100).optional(),
    split: backtestSplitSchema.optional(),
  })
  .refine((value) => !value.from || !value.to || value.from <= value.to, {
    message: "from must be before or equal to to",
  });

export const scanAlphasSchema = z.object({
  marketIds: z.array(z.string().min(1)).max(50).optional(),
  alphaIds: z.array(z.string().trim().min(1).max(64)).max(20).optional(),
  minConfidence: z.number().min(0).max(1).optional(),
  action: z.enum(["BUY_YES", "BUY_NO", "HOLD", "SELL"]).optional(),
  lookback: z.number().int().min(1).max(100).optional(),
  limit: z.number().int().min(1).max(100).optional(),
  universeLimit: z.number().int().min(1).max(50).optional(),
  includeHolds: z.boolean().optional(),
});

export const sweepBacktestSchema = z
  .object({
    alphaId: z.string().trim().min(1).max(64),
    marketIds: z.array(z.string().min(1)).min(1).max(20),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
    bars: z.array(priceBarInputSchema).max(5_000).optional(),
    startingBalance: z.number().positive().max(10_000_000).optional(),
    maxPositionSize: z.number().positive().max(1_000_000).optional(),
    confidenceThreshold: z.number().min(0).max(1).optional(),
    lookback: z.number().int().min(1).max(100).optional(),
    grid: z.record(z.array(z.number().finite()).min(1).max(50)).optional(),
    steps: z.record(z.number().int().min(1).max(50)).optional(),
    split: backtestSplitSchema.optional(),
  })
  .refine((value) => !value.from || !value.to || value.from <= value.to, {
    message: "from must be before or equal to to",
  });

export const researchAlphasSchema = z.object({
  marketIds: z.array(z.string().min(1)).max(20).optional(),
  alphaIds: z.array(z.string().trim().min(1).max(64)).max(20).optional(),
  minConfidence: z.number().min(0).max(1).optional(),
  action: z.enum(["BUY_YES", "BUY_NO", "HOLD", "SELL"]).optional(),
  lookback: z.number().int().min(1).max(100).optional(),
  universeLimit: z.number().int().min(1).max(20).optional(),
  top: z.number().int().min(1).max(5).optional(),
  startingBalance: z.number().positive().max(10_000_000).optional(),
  maxPositionSize: z.number().positive().max(1_000_000).optional(),
  steps: z.number().int().min(1).max(5).optional(),
  split: backtestSplitSchema.optional(),
});

export type PriceBarInput = z.infer<typeof priceBarInputSchema>;
export type ImportHistoryInput = z.infer<typeof importHistorySchema>;
export type RunBacktestInput = z.infer<typeof runBacktestSchema>;
export type ScanAlphasInput = z.infer<typeof scanAlphasSchema>;
export type SweepBacktestInput = z.infer<typeof sweepBacktestSchema>;
export type ResearchAlphasInput = z.infer<typeof researchAlphasSchema>;
