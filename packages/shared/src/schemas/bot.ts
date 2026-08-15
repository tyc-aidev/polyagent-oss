import { z } from "zod";

const thresholdParametersSchema = z.object({
  buyYesBelow: z.number().min(0).max(1).optional(),
  buyNoBelow: z.number().min(0).max(1).optional(),
  minVolume24h: z.number().min(0).optional(),
});

const thresholdStrategySchema = z.object({
  type: z.literal("threshold"),
  parameters: thresholdParametersSchema,
});

const alphaStrategySchema = z.object({
  type: z.literal("alpha"),
  alphaId: z.string().trim().min(1).max(64),
  parameters: z.record(z.number().finite()).optional(),
  lookback: z.number().int().min(1).max(100).optional(),
});

export const botConfigSchema = z
  .object({
    markets: z.array(z.string().min(1)).min(1).max(20),
    risk: z.object({
      maxPositionSize: z.number().positive().max(1_000_000),
      confidenceThreshold: z.number().min(0).max(1),
      maxDailyLoss: z.number().positive().optional(),
    }),
    strategy: z.union([thresholdStrategySchema, alphaStrategySchema]),
    mode: z.literal("paper"),
    updateIntervalMinutes: z.number().int().min(5).max(1440),
    startingBalance: z.number().positive().max(10_000_000).default(10_000),
  })
  .superRefine((config, ctx) => {
    if (config.strategy.type !== "threshold") return;
    const { buyYesBelow, buyNoBelow } = config.strategy.parameters;
    if (buyYesBelow === undefined && buyNoBelow === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "At least one of buyYesBelow or buyNoBelow is required",
        path: ["strategy", "parameters"],
      });
    }
  });

export const createBotSchema = z.object({
  name: z.string().trim().min(1).max(100),
  config: botConfigSchema,
});

export const updateBotSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  config: botConfigSchema.optional(),
  status: z.enum(["active", "paused", "archived"]).optional(),
});

export type BotConfigInput = z.infer<typeof botConfigSchema>;
export type CreateBotInput = z.infer<typeof createBotSchema>;
export type UpdateBotInput = z.infer<typeof updateBotSchema>;
