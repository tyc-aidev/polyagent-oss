import { NextResponse } from "next/server";
import { listMarketTapes } from "@/lib/alpha/tapes";
import { apiError, handleApiError } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/api/request";

export async function GET(request: Request) {
  try {
    if (!(await checkRateLimit(request, "alphas:tapes", 60, 60_000))) {
      return apiError("Too many requests", "rate_limited", 429);
    }

    const { searchParams } = new URL(request.url);
    const rawLimit = Number(searchParams.get("limit") ?? 50);
    const limit = Number.isFinite(rawLimit) ? rawLimit : 50;
    const hasEventRaw = searchParams.get("hasEvent");
    const hasEvent =
      hasEventRaw === null
        ? undefined
        : hasEventRaw === "1" || hasEventRaw.toLowerCase() === "true";

    const report = await listMarketTapes({ limit, hasEvent });
    return NextResponse.json(report);
  } catch (error) {
    return handleApiError(error);
  }
}
