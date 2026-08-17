import { describe, expect, it } from "vitest";
import {
  getAlphaDefinition,
  getAlphaResearchPlaybook,
  listAlphaCatalog,
  listAlphaFeatureSources,
} from "./alphas";

describe("alpha catalog API helpers", () => {
  it("lists versioned catalog entries with hypotheses", () => {
    const alphas = listAlphaCatalog();
    expect(alphas.length).toBeGreaterThanOrEqual(6);
    for (const alpha of alphas) {
      expect(alpha.id).toBeTruthy();
      expect(alpha.hypothesis.length).toBeGreaterThan(10);
      expect(alpha.parameters.length).toBeGreaterThan(0);
    }
  });

  it("loads a single catalog alpha", () => {
    const alpha = getAlphaDefinition("momentum");
    expect(alpha.name).toMatch(/momentum/i);
    expect(alpha.defaultParameters.momentumThreshold).toBeTypeOf("number");
  });

  it("throws not found for an unknown id", () => {
    expect(() => getAlphaDefinition("missing")).toThrow(/not found/i);
  });

  it("publishes a research playbook for agents", () => {
    const playbook = getAlphaResearchPlaybook();
    expect(playbook.map((step) => step.path)).toEqual([
      "/api/alphas",
      "/api/alphas/research",
      "/api/alphas/scan",
      "/api/markets/:id/features",
      "/api/backtests",
      "/api/backtests/sweep",
      "/api/bots",
    ]);
  });

  it("lists registered feature sources (fixture disabled by default)", () => {
    const sources = listAlphaFeatureSources();
    expect(sources.some((source) => source.id === "fixture" && source.enabled === false)).toBe(true);
  });
});
