import { describe, expect, it } from "vitest";
import {
  isPrismaAccelerateDatabaseUrl,
  shouldUseEdgePrismaClient,
} from "./database-runtime";

describe("isPrismaAccelerateDatabaseUrl", () => {
  it("accepts prisma:// and prisma+postgres:// URLs", () => {
    expect(isPrismaAccelerateDatabaseUrl("prisma://accelerate.prisma-data.net/?api_key=x")).toBe(
      true,
    );
    expect(
      isPrismaAccelerateDatabaseUrl("prisma+postgres://accelerate.prisma-data.net/?api_key=x"),
    ).toBe(true);
  });

  it("rejects direct Postgres URLs", () => {
    expect(isPrismaAccelerateDatabaseUrl("postgresql://user:pass@localhost:5432/db")).toBe(false);
    expect(isPrismaAccelerateDatabaseUrl("postgres://user:pass@localhost:5432/db")).toBe(false);
  });
});

describe("shouldUseEdgePrismaClient", () => {
  it("uses edge path for Accelerate URLs outside Workers", () => {
    expect(shouldUseEdgePrismaClient("prisma+postgres://accelerate.example/?api_key=x")).toBe(true);
  });

  it("uses node path for direct URLs outside Workers", () => {
    // Vitest runs in Node — not a Worker isolate.
    expect(shouldUseEdgePrismaClient("postgresql://localhost:5432/polyagent")).toBe(false);
  });
});
