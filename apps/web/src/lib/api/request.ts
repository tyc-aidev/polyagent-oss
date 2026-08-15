import { getCloudflareContext } from "@opennextjs/cloudflare";
import { kvRateLimit, rateLimit } from "./rate-limit";

export const MAX_BODY_BYTES = 64 * 1024;

export class BodyTooLargeError extends Error {
  constructor() {
    super("Request body too large");
    this.name = "BodyTooLargeError";
  }
}

export function getClientIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
}

export async function checkRateLimit(
  request: Request,
  scope: string,
  limit: number,
  windowMs: number,
): Promise<boolean> {
  const key = `${scope}:${getClientIp(request)}`;

  if (process.env.SCHEDULER_MODE === "cloudflare") {
    try {
      const { env } = await getCloudflareContext({ async: true });
      if (env.MARKET_CACHE) {
        return kvRateLimit(env.MARKET_CACHE, key, limit, windowMs);
      }
    } catch {
      // Not on Workers — fall through to in-memory.
    }
  }

  return rateLimit(key, limit, windowMs);
}

export async function readJsonBody<T>(request: Request): Promise<T> {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    throw new BodyTooLargeError();
  }

  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) {
    throw new BodyTooLargeError();
  }

  return JSON.parse(text) as T;
}