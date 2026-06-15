import { describe, expect, it } from "vitest";
import { botConfigSchema, createBotSchema } from "./bot";

const validConfig = {
  markets: ["market-1"],
  risk: {
    maxPositionSize: 100,
    confidenceThreshold: 0.5,
  },
  strategy: {
    type: "threshold" as const,
    parameters: { buyYesBelow: 0.35 },
  },
  mode: "paper" as const,
  updateIntervalMinutes: 15,
  startingBalance: 10_000,
};

describe("botConfigSchema", () => {
  it("accepts a valid paper trading config", () => {
    const result = botConfigSchema.safeParse(validConfig);
    expect(result.success).toBe(true);
  });

  it("rejects live mode", () => {
    const result = botConfigSchema.safeParse({ ...validConfig, mode: "live" });
    expect(result.success).toBe(false);
  });

  it("rejects non-threshold strategies", () => {
    const result = botConfigSchema.safeParse({
      ...validConfig,
      strategy: { type: "llm", parameters: {} },
    });
    expect(result.success).toBe(false);
  });

  it("requires at least one threshold parameter", () => {
    const result = botConfigSchema.safeParse({
      ...validConfig,
      strategy: { type: "threshold", parameters: {} },
    });
    expect(result.success).toBe(false);
  });

  it("enforces minimum update interval of 5 minutes", () => {
    const result = botConfigSchema.safeParse({
      ...validConfig,
      updateIntervalMinutes: 1,
    });
    expect(result.success).toBe(false);
  });
});

describe("createBotSchema", () => {
  it("requires a non-empty bot name", () => {
    const result = createBotSchema.safeParse({ name: "  ", config: validConfig });
    expect(result.success).toBe(false);
  });
});