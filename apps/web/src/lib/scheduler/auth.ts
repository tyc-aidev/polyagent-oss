import { timingSafeEqual } from "@/lib/auth/timing-safe";

export function isAuthorizedInternalRequest(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return process.env.NODE_ENV !== "production";
  }

  const header = request.headers.get("x-cron-secret");
  if (!header) return false;
  return timingSafeEqual(header, secret);
}