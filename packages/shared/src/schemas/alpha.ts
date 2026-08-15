import { z } from "zod";

export const priceBarInputSchema = z.object({
  marketId: z.string().min(1).optional(),
  capturedAt: z.coerce.date(),
  yesPrice: z.number().min(0).max(1),
  noPrice: z.number().min(0).max(1),
  volume24h: z.number().min(0),
});

export const importHistorySchema = z.object({
  bars: z.array(priceBarInputSchema).min(1).max(2_000),
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
  })
  .refine((value) => !value.from || !value.to || value.from <= value.to, {
    message: "from must be before or equal to to",
  });

export type PriceBarInput = z.infer<typeof priceBarInputSchema>;
export type ImportHistoryInput = z.infer<typeof importHistorySchema>;
export type RunBacktestInput = z.infer<typeof runBacktestSchema>;
