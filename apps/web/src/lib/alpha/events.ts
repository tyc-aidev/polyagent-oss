import type { EventFeatureBag, EventFeatureValue, MarketFeatures, PriceBar } from "@polyagent/shared";

export interface NumericEventExtra {
  source: string;
  key: string;
  value: number;
}

export function coerceEventNumber(value: EventFeatureValue): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value === true) return 1;
  if (value === false) return 0;
  return null;
}

/** Flatten `features.event[source][key]` into numeric extras (booleans → 0/1). */
export function numericEventExtras(features: MarketFeatures): NumericEventExtra[] {
  const event = features.event;
  if (!event) return [];
  const extras: NumericEventExtra[] = [];
  for (const [source, bag] of Object.entries(event)) {
    for (const [key, raw] of Object.entries(bag)) {
      const value = coerceEventNumber(raw);
      if (value === null) continue;
      extras.push({ source, key, value });
    }
  }
  return extras;
}

export function hasEventExtras(event: EventFeatureBag | undefined): boolean {
  if (!event) return false;
  return Object.values(event).some((bag) => bag && Object.keys(bag).length > 0);
}

/** Most recent non-empty event bag on the tape (walks backward). */
export function latestEvent(bars: PriceBar[]): EventFeatureBag | undefined {
  for (let i = bars.length - 1; i >= 0; i -= 1) {
    const event = bars[i]?.event;
    if (hasEventExtras(event)) return event;
  }
  return undefined;
}
