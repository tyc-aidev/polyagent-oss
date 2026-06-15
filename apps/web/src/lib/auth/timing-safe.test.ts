import { describe, expect, it } from "vitest";
import { timingSafeEqual } from "./timing-safe";

describe("timingSafeEqual", () => {
  it("returns true for equal strings", () => {
    expect(timingSafeEqual("secret", "secret")).toBe(true);
  });

  it("returns false for different strings", () => {
    expect(timingSafeEqual("secret", "secretx")).toBe(false);
  });
});