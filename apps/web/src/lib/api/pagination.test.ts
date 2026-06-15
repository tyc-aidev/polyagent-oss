import { describe, expect, it } from "vitest";
import { parsePagination } from "./pagination";

describe("parsePagination", () => {
  it("uses defaults", () => {
    expect(parsePagination(new URLSearchParams())).toEqual({ limit: 20, offset: 0 });
  });

  it("caps limit at 100", () => {
    expect(parsePagination(new URLSearchParams("limit=500"))).toEqual({
      limit: 100,
      offset: 0,
    });
  });

  it("parses offset", () => {
    expect(parsePagination(new URLSearchParams("limit=10&offset=30"))).toEqual({
      limit: 10,
      offset: 30,
    });
  });
});