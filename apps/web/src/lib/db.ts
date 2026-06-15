import { cache } from "react";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createPrismaClient, prisma as nodePrisma } from "@polyagent/db";
import type { PrismaClient } from "@polyagent/db";

function createClient(): PrismaClient {
  try {
    const { env } = getCloudflareContext();
    if (env.HYPERDRIVE?.connectionString) {
      return createPrismaClient(env.HYPERDRIVE.connectionString);
    }
  } catch {
    // Not in a Cloudflare request context (local Node dev).
  }
  return nodePrisma;
}

/** Cached per-request client for Server Components. */
export const getPrisma = cache(createClient);

/** Use in API routes and non-React server code. */
export async function getPrismaAsync(): Promise<PrismaClient> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    if (env.HYPERDRIVE?.connectionString) {
      return createPrismaClient(env.HYPERDRIVE.connectionString);
    }
  } catch {
    // Fall through to Node singleton.
  }
  return nodePrisma;
}