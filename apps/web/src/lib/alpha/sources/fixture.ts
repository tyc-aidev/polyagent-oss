import type {
  EventFeatureValue,
  FeatureSource,
  FeatureSourceInput,
} from "@polyagent/shared";

export const FIXTURE_SOURCE_ID = "fixture";
export const FIXTURE_SOURCE_ENV = "FEATURE_SOURCE_FIXTURE";
export const FIXTURE_SOURCE_JSON_ENV = "FEATURE_SOURCE_FIXTURE_JSON";

function envEnabled(name: string): boolean {
  const flag = process.env[name];
  if (!flag) return false;
  return flag === "1" || flag.toLowerCase() === "true";
}

function parseFixtureJson(raw: string | undefined): Record<string, Record<string, EventFeatureValue>> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: Record<string, Record<string, EventFeatureValue>> = {};
    for (const [marketId, extras] of Object.entries(parsed as Record<string, unknown>)) {
      if (!extras || typeof extras !== "object" || Array.isArray(extras)) continue;
      const bag: Record<string, EventFeatureValue> = {};
      for (const [key, value] of Object.entries(extras as Record<string, unknown>)) {
        if (value === null || typeof value === "number" || typeof value === "string" || typeof value === "boolean") {
          bag[key] = value;
        }
      }
      if (Object.keys(bag).length > 0) out[marketId] = bag;
    }
    return out;
  } catch {
    return {};
  }
}

/**
 * In-process fixture source for tests and local demos.
 * Disabled unless FEATURE_SOURCE_FIXTURE=1 (or a map is injected).
 */
export class FixtureFeatureSource implements FeatureSource {
  readonly id = FIXTURE_SOURCE_ID;

  constructor(
    private readonly extrasByMarketId: Record<string, Record<string, EventFeatureValue>> = parseFixtureJson(
      process.env[FIXTURE_SOURCE_JSON_ENV],
    ),
    private readonly forceEnabled?: boolean,
  ) {}

  enabled(): boolean {
    if (this.forceEnabled !== undefined) return this.forceEnabled;
    return envEnabled(FIXTURE_SOURCE_ENV);
  }

  async enrich(input: FeatureSourceInput): Promise<Record<string, EventFeatureValue> | null> {
    return this.extrasByMarketId[input.market.id] ?? null;
  }
}
