import { describe, expect, it } from "vitest";
import { eventSourcesFromBag, summarizeTapes } from "./tapes";

describe("eventSourcesFromBag", () => {
  it("returns sorted source ids with extras", () => {
    expect(eventSourcesFromBag({ fixture: { set: 1 }, tennis: {}, empty: {} })).toEqual(["fixture"]);
  });
});

describe("summarizeTapes", () => {
  it("marks hasEvent and unions source ids per market", () => {
    const tapes = summarizeTapes(
      [
        {
          marketId: "m1",
          bars: 12,
          from: new Date("2026-01-01T00:00:00.000Z"),
          to: new Date("2026-01-01T01:00:00.000Z"),
        },
        {
          marketId: "m2",
          bars: 3,
          from: new Date("2026-01-01T00:00:00.000Z"),
          to: new Date("2026-01-01T00:10:00.000Z"),
        },
      ],
      [
        { marketId: "m1", event: { fixture: { favoriteDownBreak: true } } },
        { marketId: "m1", event: { tennis: { set: 2 } } },
      ],
    );

    expect(tapes[0]).toMatchObject({
      marketId: "m1",
      bars: 12,
      hasEvent: true,
      eventSources: ["fixture", "tennis"],
    });
    expect(tapes[1]?.hasEvent).toBe(false);
    expect(tapes[1]?.eventSources).toEqual([]);
  });
});
