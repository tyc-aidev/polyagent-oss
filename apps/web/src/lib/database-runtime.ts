const PRISMA_PROTOCOL_PREFIX = "prisma";

/** True for `prisma://` and `prisma+postgres://` Accelerate URLs. */
export function isPrismaAccelerateDatabaseUrl(databaseUrl: string): boolean {
  if (databaseUrl.startsWith(`${PRISMA_PROTOCOL_PREFIX}://`)) {
    return true;
  }

  const prismaDataSourcePrefix = `${PRISMA_PROTOCOL_PREFIX}+`;
  if (!databaseUrl.startsWith(prismaDataSourcePrefix)) {
    return false;
  }

  return databaseUrl.includes("://", prismaDataSourcePrefix.length);
}

/** Detect Cloudflare Workers isolate (no DOM). */
export function isCloudflareWorkerRuntime(): boolean {
  return (
    typeof globalThis.caches !== "undefined" &&
    typeof (globalThis as typeof globalThis & { HTMLElement?: unknown }).HTMLElement ===
      "undefined"
  );
}

export function shouldUseEdgePrismaClient(databaseUrl: string): boolean {
  return isCloudflareWorkerRuntime() || isPrismaAccelerateDatabaseUrl(databaseUrl);
}