import { describe, expect, it } from "vitest";
import { BodyTooLargeError, readJsonBody } from "./request";

describe("readJsonBody", () => {
  it("parses valid JSON bodies", async () => {
    const request = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ name: "test" }),
    });
    expect(await readJsonBody<{ name: string }>(request)).toEqual({ name: "test" });
  });

  it("rejects oversized bodies", async () => {
    const request = new Request("http://localhost", {
      method: "POST",
      headers: { "content-length": String(128 * 1024) },
      body: "{}",
    });
    await expect(readJsonBody(request)).rejects.toBeInstanceOf(BodyTooLargeError);
  });
});