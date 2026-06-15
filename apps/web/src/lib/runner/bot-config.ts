import { botConfigSchema, type BotConfig } from "@polyagent/shared";

export interface StoredBotConfig extends BotConfig {
  cashBalance?: number;
  dayStartPnl?: number;
  dayStartDate?: string;
}

export function parseBotConfig(raw: unknown): StoredBotConfig {
  const base = botConfigSchema.parse(raw);
  const stored = raw as StoredBotConfig;
  return {
    ...base,
    cashBalance: stored.cashBalance,
    dayStartPnl: stored.dayStartPnl,
    dayStartDate: stored.dayStartDate,
  };
}

export function getCashBalance(config: StoredBotConfig): number {
  return config.cashBalance ?? config.startingBalance;
}

export function getDayStartPnl(config: StoredBotConfig): number {
  return config.dayStartPnl ?? 0;
}

export function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export function withRuntimeState(
  config: StoredBotConfig,
  cashBalance: number,
  totalPnl: number,
): StoredBotConfig {
  const dayStartDate = config.dayStartDate ?? todayKey();
  const isNewDay = dayStartDate !== todayKey();

  return {
    ...config,
    cashBalance,
    dayStartDate: isNewDay ? todayKey() : dayStartDate,
    dayStartPnl: isNewDay ? totalPnl : (config.dayStartPnl ?? 0),
  };
}