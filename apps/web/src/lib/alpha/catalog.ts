import type {
  AgentAction,
  AlphaDefinition,
  AlphaSignal,
  MarketFeatures,
} from "@polyagent/shared";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function hold(alphaId: string, features: MarketFeatures, reasoning: string): AlphaSignal {
  return {
    alphaId,
    marketId: features.marketId,
    timestamp: features.timestamp,
    action: "HOLD",
    score: 0,
    confidence: 0,
    reasoning,
  };
}

function trade(
  alphaId: string,
  features: MarketFeatures,
  action: Exclude<AgentAction, "HOLD">,
  score: number,
  confidence: number,
  reasoning: string,
): AlphaSignal {
  return {
    alphaId,
    marketId: features.marketId,
    timestamp: features.timestamp,
    action,
    score: clamp(score, -1, 1),
    confidence: clamp(confidence, 0, 1),
    reasoning,
  };
}

function readParam(
  definition: AlphaDefinition,
  params: Record<string, number> | undefined,
  name: string,
): number {
  const spec = definition.parameters.find((item) => item.name === name);
  const fallback = definition.defaultParameters[name] ?? spec?.defaultValue ?? 0;
  const raw = params?.[name];
  const value = typeof raw === "number" && Number.isFinite(raw) ? raw : fallback;
  if (!spec) return value;
  return clamp(value, spec.minimum, spec.maximum);
}

type Evaluator = (features: MarketFeatures, params: Record<string, number>) => AlphaSignal;

interface CatalogEntry {
  definition: AlphaDefinition;
  evaluate: Evaluator;
}

const thresholdYes: AlphaDefinition = {
  id: "threshold_yes",
  name: "Threshold YES",
  version: "1.0.0",
  hypothesis: "YES contracts below a fixed price are underpriced relative to a researcher's prior.",
  description: "Buy YES when the last mid is below buyYesBelow and 24h volume clears a floor.",
  tags: ["threshold", "value", "yes"],
  parameters: [
    {
      name: "buyYesBelow",
      description: "Buy YES when last yesPrice is strictly below this level.",
      minimum: 0,
      maximum: 1,
      defaultValue: 0.35,
    },
    {
      name: "minVolume24h",
      description: "Ignore markets thinner than this 24h volume.",
      minimum: 0,
      maximum: 10_000_000,
      defaultValue: 0,
    },
  ],
  defaultParameters: { buyYesBelow: 0.35, minVolume24h: 0 },
};

const thresholdNo: AlphaDefinition = {
  id: "threshold_no",
  name: "Threshold NO",
  version: "1.0.0",
  hypothesis: "NO contracts below a fixed price are underpriced relative to a researcher's prior.",
  description: "Buy NO when the last noPrice is below buyNoBelow and 24h volume clears a floor.",
  tags: ["threshold", "value", "no"],
  parameters: [
    {
      name: "buyNoBelow",
      description: "Buy NO when last noPrice is strictly below this level.",
      minimum: 0,
      maximum: 1,
      defaultValue: 0.35,
    },
    {
      name: "minVolume24h",
      description: "Ignore markets thinner than this 24h volume.",
      minimum: 0,
      maximum: 10_000_000,
      defaultValue: 0,
    },
  ],
  defaultParameters: { buyNoBelow: 0.35, minVolume24h: 0 },
};

const meanReversion: AlphaDefinition = {
  id: "mean_reversion",
  name: "Mean reversion",
  version: "1.0.0",
  hypothesis: "Short-horizon YES prices mean-revert toward their recent average.",
  description: "Fade YES when it is rich vs SMA; buy YES when it is cheap vs SMA.",
  tags: ["mean-reversion", "statistical"],
  parameters: [
    {
      name: "residualThreshold",
      description: "Absolute SMA residual required to fade or buy.",
      minimum: 0.001,
      maximum: 0.5,
      defaultValue: 0.05,
    },
  ],
  defaultParameters: { residualThreshold: 0.05 },
};

const momentum: AlphaDefinition = {
  id: "momentum",
  name: "Price momentum",
  version: "1.0.0",
  hypothesis: "Recent YES returns persist over the next few snapshots.",
  description: "Follow the sign of average one-step YES returns when |momentum| clears a threshold.",
  tags: ["momentum", "trend"],
  parameters: [
    {
      name: "momentumThreshold",
      description: "Minimum average one-step return required to follow the trend.",
      minimum: 0,
      maximum: 1,
      defaultValue: 0.02,
    },
  ],
  defaultParameters: { momentumThreshold: 0.02 },
};

const volumeSpike: AlphaDefinition = {
  id: "volume_spike",
  name: "Volume-spike follow-through",
  version: "1.0.0",
  hypothesis: "Elevated volume confirms the last lookback return rather than noise.",
  description:
    "When volume z-score is high, follow (or fade) the lookback YES return. followThrough > 0 follows.",
  tags: ["volume", "confirmation"],
  parameters: [
    {
      name: "volumeZ",
      description: "Minimum volume z-score to trade.",
      minimum: 0,
      maximum: 10,
      defaultValue: 1.5,
    },
    {
      name: "followThrough",
      description: "Positive follows the lookback return; negative fades it.",
      minimum: -1,
      maximum: 1,
      defaultValue: 1,
    },
  ],
  defaultParameters: { volumeZ: 1.5, followThrough: 1 },
};

const extremeMispricing: AlphaDefinition = {
  id: "extreme_mispricing",
  name: "Extreme mispricing",
  version: "1.0.0",
  hypothesis: "Prices near 0 or 1 often overstate certainty on short-lived prediction markets.",
  description: "Buy YES below `low`; buy NO above `high`.",
  tags: ["extreme", "value"],
  parameters: [
    {
      name: "low",
      description: "Buy YES when yesPrice is strictly below this level.",
      minimum: 0,
      maximum: 0.5,
      defaultValue: 0.15,
    },
    {
      name: "high",
      description: "Buy NO when yesPrice is strictly above this level.",
      minimum: 0.5,
      maximum: 1,
      defaultValue: 0.85,
    },
  ],
  defaultParameters: { low: 0.15, high: 0.85 },
};

const catalog: CatalogEntry[] = [
  {
    definition: thresholdYes,
    evaluate: (features, params) => {
      const buyYesBelow = readParam(thresholdYes, params, "buyYesBelow");
      const minVolume24h = readParam(thresholdYes, params, "minVolume24h");
      if (features.volume24h < minVolume24h) {
        return hold(thresholdYes.id, features, `Volume ${features.volume24h} below ${minVolume24h}`);
      }
      if (features.yesPrice < buyYesBelow) {
        const confidence = buyYesBelow > 0 ? 1 - features.yesPrice / buyYesBelow : 0;
        return trade(
          thresholdYes.id,
          features,
          "BUY_YES",
          1 - features.yesPrice / Math.max(buyYesBelow, 1e-9),
          confidence,
          `YES ${features.yesPrice.toFixed(3)} below threshold ${buyYesBelow}`,
        );
      }
      return hold(thresholdYes.id, features, "YES price is not below buyYesBelow");
    },
  },
  {
    definition: thresholdNo,
    evaluate: (features, params) => {
      const buyNoBelow = readParam(thresholdNo, params, "buyNoBelow");
      const minVolume24h = readParam(thresholdNo, params, "minVolume24h");
      if (features.volume24h < minVolume24h) {
        return hold(thresholdNo.id, features, `Volume ${features.volume24h} below ${minVolume24h}`);
      }
      if (features.noPrice < buyNoBelow) {
        const confidence = buyNoBelow > 0 ? 1 - features.noPrice / buyNoBelow : 0;
        return trade(
          thresholdNo.id,
          features,
          "BUY_NO",
          -(1 - features.noPrice / Math.max(buyNoBelow, 1e-9)),
          confidence,
          `NO ${features.noPrice.toFixed(3)} below threshold ${buyNoBelow}`,
        );
      }
      return hold(thresholdNo.id, features, "NO price is not below buyNoBelow");
    },
  },
  {
    definition: meanReversion,
    evaluate: (features, params) => {
      const threshold = readParam(meanReversion, params, "residualThreshold");
      if (features.meanReversionResidual === null) {
        return hold(meanReversion.id, features, "Need at least two bars for SMA residual");
      }
      const residual = features.meanReversionResidual;
      if (residual > threshold) {
        return trade(
          meanReversion.id,
          features,
          "BUY_NO",
          -clamp(residual / (2 * threshold), 0, 1),
          clamp(Math.abs(residual) / (2 * threshold), 0, 1),
          `YES residual ${residual.toFixed(3)} above SMA — fade`,
        );
      }
      if (residual < -threshold) {
        return trade(
          meanReversion.id,
          features,
          "BUY_YES",
          clamp(-residual / (2 * threshold), 0, 1),
          clamp(Math.abs(residual) / (2 * threshold), 0, 1),
          `YES residual ${residual.toFixed(3)} below SMA — buy`,
        );
      }
      return hold(meanReversion.id, features, "Residual inside fade band");
    },
  },
  {
    definition: momentum,
    evaluate: (features, params) => {
      const threshold = readParam(momentum, params, "momentumThreshold");
      if (features.momentum === null) {
        return hold(momentum.id, features, "Need at least two bars for momentum");
      }
      if (features.momentum > threshold) {
        return trade(
          momentum.id,
          features,
          "BUY_YES",
          clamp(features.momentum / (2 * threshold), 0, 1),
          clamp(features.momentum / (2 * threshold), 0, 1),
          `Momentum ${features.momentum.toFixed(4)} above ${threshold}`,
        );
      }
      if (features.momentum < -threshold) {
        return trade(
          momentum.id,
          features,
          "BUY_NO",
          -clamp(-features.momentum / (2 * threshold), 0, 1),
          clamp(-features.momentum / (2 * threshold), 0, 1),
          `Momentum ${features.momentum.toFixed(4)} below -${threshold}`,
        );
      }
      return hold(momentum.id, features, "Momentum inside dead band");
    },
  },
  {
    definition: volumeSpike,
    evaluate: (features, params) => {
      const volumeZ = readParam(volumeSpike, params, "volumeZ");
      const followThrough = readParam(volumeSpike, params, "followThrough");
      if (features.volumeZScore === null) {
        return hold(volumeSpike.id, features, "Need more volume samples for z-score");
      }
      if (features.volumeZScore < volumeZ) {
        return hold(
          volumeSpike.id,
          features,
          `Volume z ${features.volumeZScore.toFixed(2)} below ${volumeZ}`,
        );
      }
      if (features.lookbackReturn === null || features.lookbackReturn === 0) {
        return hold(volumeSpike.id, features, "No lookback return to confirm");
      }
      const follow = followThrough >= 0;
      const up = features.lookbackReturn > 0;
      const action: Exclude<AgentAction, "HOLD"> = follow === up ? "BUY_YES" : "BUY_NO";
      const score = (up ? 1 : -1) * (follow ? 1 : -1) * clamp(features.volumeZScore / (2 * volumeZ), 0, 1);
      return trade(
        volumeSpike.id,
        features,
        action,
        score,
        clamp(features.volumeZScore / (2 * volumeZ), 0, 1),
        `Volume z ${features.volumeZScore.toFixed(2)}; lookback return ${features.lookbackReturn.toFixed(4)}; ${follow ? "follow" : "fade"}`,
      );
    },
  },
  {
    definition: extremeMispricing,
    evaluate: (features, params) => {
      const low = readParam(extremeMispricing, params, "low");
      const high = readParam(extremeMispricing, params, "high");
      if (features.yesPrice < low) {
        return trade(
          extremeMispricing.id,
          features,
          "BUY_YES",
          1 - features.yesPrice / Math.max(low, 1e-9),
          clamp((low - features.yesPrice) / Math.max(low, 1e-9), 0, 1),
          `YES ${features.yesPrice.toFixed(3)} below extreme low ${low}`,
        );
      }
      if (features.yesPrice > high) {
        return trade(
          extremeMispricing.id,
          features,
          "BUY_NO",
          -(features.yesPrice - high) / Math.max(1 - high, 1e-9),
          clamp((features.yesPrice - high) / Math.max(1 - high, 1e-9), 0, 1),
          `YES ${features.yesPrice.toFixed(3)} above extreme high ${high}`,
        );
      }
      return hold(extremeMispricing.id, features, "Price is not in an extreme band");
    },
  },
];

const catalogById = new Map(catalog.map((entry) => [entry.definition.id, entry]));

export function listAlphas(): AlphaDefinition[] {
  return catalog.map((entry) => entry.definition);
}

export function getAlpha(id: string): AlphaDefinition | null {
  return catalogById.get(id)?.definition ?? null;
}

export function evaluateAlpha(
  id: string,
  features: MarketFeatures,
  params?: Record<string, number>,
): AlphaSignal {
  const entry = catalogById.get(id);
  if (!entry) {
    throw new Error(`Alpha not found: ${id}`);
  }
  const merged = { ...entry.definition.defaultParameters, ...params };
  return entry.evaluate(features, merged);
}

export function evaluateCatalog(
  features: MarketFeatures,
  paramsByAlpha?: Record<string, Record<string, number>>,
): AlphaSignal[] {
  return catalog
    .map((entry) => entry.evaluate(features, paramsByAlpha?.[entry.definition.id] ?? {}))
    .sort((a, b) => {
      const aActive = a.action === "HOLD" ? 0 : 1;
      const bActive = b.action === "HOLD" ? 0 : 1;
      if (aActive !== bActive) return bActive - aActive;
      return b.confidence - a.confidence;
    });
}

export function resolveAlphaParameters(
  id: string,
  params?: Record<string, number>,
): Record<string, number> {
  const definition = getAlpha(id);
  if (!definition) {
    throw new Error(`Alpha not found: ${id}`);
  }
  const resolved: Record<string, number> = { ...definition.defaultParameters };
  for (const spec of definition.parameters) {
    resolved[spec.name] = readParam(definition, params, spec.name);
  }
  return resolved;
}
