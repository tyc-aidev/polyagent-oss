import { cache } from "react";
import { getDatabaseClientAsync } from "./db-factory";
import type { PrismaClientLike } from "./db-factory";

/**
 * Cached per-request Prisma client for Server Components.
 * Always await — Workers require async factory (Accelerate / pg adapter).
 */
export const getPrisma = cache(async (): Promise<PrismaClientLike> => {
  return getDatabaseClientAsync();
});

/** Use in API routes and non-React server code. */
export async function getPrismaAsync(): Promise<PrismaClientLike> {
  return getDatabaseClientAsync();
}

export type PrismaClient = PrismaClientLike;