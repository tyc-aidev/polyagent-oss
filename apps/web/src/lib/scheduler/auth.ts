import { timingSafeEqual } from "@/lib/auth/timing-safe";

export function isAuthorizedInternalRequest(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // Fail closed for public deploys and Cloudflare scheduler mode.
    if (process.env.DASHBOARD_PASSWORD || process.env.SCHEDULER_MODE === "cloudflare") {
      return false;
    }
    const env = process.env.NODE_ENV;
    return env === "development" || env === "test";
  }

  const header = request.headers.get("x-cron-secret");
  if (!header) return false;
  return timingSafeEqual(header, secret);
}