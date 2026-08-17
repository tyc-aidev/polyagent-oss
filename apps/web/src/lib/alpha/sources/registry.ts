import type {
  EventFeatureBag,
  FeatureSource,
  FeatureSourceStatus,
  MarketFeatures,
  MarketSnapshot,
} from "@polyagent/shared";
import { FixtureFeatureSource } from "./fixture";
import { TennisFeatureSource } from "./tennis";

export class FeatureRegistry {
  constructor(private readonly sources: FeatureSource[] = []) {}

  register(source: FeatureSource): void {
    this.sources.push(source);
  }

  list(): FeatureSourceStatus[] {
    return this.sources.map((source) => ({ id: source.id, enabled: source.enabled() }));
  }

  async enrich(market: Pick<MarketSnapshot, "id" | "slug" | "question" | "endDate"> | null, features: MarketFeatures): Promise<MarketFeatures> {
    if (!market) return features;

    let event: EventFeatureBag | undefined = features.event ? { ...features.event } : undefined;

    for (const source of this.sources) {
      if (!source.enabled()) continue;
      try {
        const extras = await source.enrich({ market, features });
        if (!extras || Object.keys(extras).length === 0) continue;
        event = event ?? {};
        event[source.id] = { ...event[source.id], ...extras };
      } catch {
        // Feature sources must never block harvest, ticks, or catalog evaluation.
      }
    }

    return event ? { ...features, event } : features;
  }
}

const defaultRegistry = new FeatureRegistry([new FixtureFeatureSource(), new TennisFeatureSource()]);

export function getFeatureRegistry(): FeatureRegistry {
  return defaultRegistry;
}

export function listFeatureSources(): FeatureSourceStatus[] {
  return defaultRegistry.list();
}

export async function enrichMarketFeatures(
  market: Pick<MarketSnapshot, "id" | "slug" | "question" | "endDate"> | null,
  features: MarketFeatures,
): Promise<MarketFeatures> {
  return defaultRegistry.enrich(market, features);
}
