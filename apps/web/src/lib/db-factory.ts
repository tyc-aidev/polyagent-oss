/**
 * Prisma client factory — mirrors interactive-partners/webapp/src/lib/db-factory.ts
 * Uses Prisma Accelerate on Cloudflare Workers (no Hyperdrive).
 *
 * @see https://github.com/tyc-aidev/interactive-partners
 */
import type { PrismaClient } from "@polyagent/db";
import { withAccelerate } from "@prisma/extension-accelerate";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { prisma as nodePrisma } from "@polyagent/db";
import {
  isCloudflareWorkerRuntime,
  isPrismaAccelerateDatabaseUrl,
  shouldUseEdgePrismaClient,
} from "./database-runtime";

export type PrismaClientLike = PrismaClient;

type PoolWithEnd = { end: () => Promise<void> };
const workerPoolByClient = new WeakMap<PrismaClientLike, PoolWithEnd>();

function resolveDatabaseUrl(): string {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  try {
    const { env } = getCloudflareContext();
    const fromBinding = (env as { DATABASE_URL?: string }).DATABASE_URL;
    if (fromBinding) return fromBinding;
  } catch {
    // Not in a Cloudflare request context.
  }

  throw new Error("DATABASE_URL environment variable is required");
}

async function createAcceleratePrismaClient(
  databaseUrl: string,
): Promise<PrismaClientLike> {
  const { PrismaClient: PrismaClientEdge } = await import("@prisma/client/edge");
  const baseClient = new PrismaClientEdge({ datasourceUrl: databaseUrl });
  return baseClient.$extends(withAccelerate()) as unknown as PrismaClientLike;
}

async function createPgEdgePrismaClient(
  connectionString: string,
): Promise<PrismaClientLike> {
  // Driver adapters require the standard PrismaClient import — not `/edge`
  // (Prisma 6.19+: adapter + /edge throws at runtime).
  const [{ PrismaClient: PrismaClientNode }, { PrismaPg }, { Pool }] = await Promise.all([
    import("@prisma/client"),
    import("@prisma/adapter-pg"),
    import("pg"),
  ]);

  const pool = new Pool({ connectionString, max: 1 });
  const adapter = new PrismaPg(pool);
  const client = new PrismaClientNode({ adapter }) as unknown as PrismaClientLike;
  workerPoolByClient.set(client, pool);
  return client;
}

async function createEdgePrismaClient(databaseUrl: string): Promise<PrismaClientLike> {
  if (isPrismaAccelerateDatabaseUrl(databaseUrl)) {
    return createAcceleratePrismaClient(databaseUrl);
  }

  if (isCloudflareWorkerRuntime()) {
    return createPgEdgePrismaClient(databaseUrl);
  }

  throw new Error(
    "Edge Prisma client requires Prisma Accelerate or Cloudflare Workers runtime",
  );
}

async function createPrismaClient(): Promise<PrismaClientLike> {
  const databaseUrl = resolveDatabaseUrl();

  if (shouldUseEdgePrismaClient(databaseUrl)) {
    return createEdgePrismaClient(databaseUrl);
  }

  return nodePrisma;
}

const globalForPrisma: { prisma: PrismaClientLike | undefined } = { prisma: undefined };

/** Use in API routes and server code. New client per request on Workers. */
export async function getDatabaseClientAsync(): Promise<PrismaClientLike> {
  if (isCloudflareWorkerRuntime()) {
    return createPrismaClient();
  }

  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = await createPrismaClient();
  }
  return globalForPrisma.prisma;
}