import { describe, expect, it } from "vitest";
import { rateLimit } from "./rate-limit";

describe("rateLimit", () => {
  it("allows requests within the limit", () => {
    expect(rateLimit("test-key", 3, 60_000)).toBe(true);
    expect(rateLimit("test-key", 3, 60_000)).toBe(true);
    expect(rateLimit("test-key", 3, 60_000)).toBe(true);
  });

  it("blocks requests over the limit", () => {
    expect(rateLimit("blocked-key", 2, 60_000)).toBe(true);
    expect(rateLimit("blocked-key", 2, 60_000)).toBe(true);
    expect(rateLimit("blocked-key", 2, 60_000)).toBe(false);
  });
});