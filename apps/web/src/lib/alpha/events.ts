import type { EventFeatureValue, MarketFeatures } from "@polyagent/shared";

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
