import { describe, expect, it } from "vitest";
import { getAlphaDefinition, getAlphaResearchPlaybook, listAlphaCatalog } from "./alphas";

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

  it("publishes a five-step research playbook for agents", () => {
    const playbook = getAlphaResearchPlaybook();
    expect(playbook.map((step) => step.path)).toEqual([
      "/api/alphas",
      "/api/alphas/scan",
      "/api/markets/:id/features",
      "/api/backtests",
      "/api/bots",
    ]);
  });
});
