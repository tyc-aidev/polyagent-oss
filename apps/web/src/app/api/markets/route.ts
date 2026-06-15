import { NextResponse } from "next/server";
import { apiError, handleApiError } from "@/lib/api/errors";
import { listMarkets } from "@/lib/api/markets";
import { checkRateLimit } from "@/lib/api/request";

export async function GET(request: Request) {
  try {
    if (!checkRateLimit(request, "markets", 60, 60_000)) {
      return apiError("Too many requests", "rate_limited", 429);
    }

    const { searchParams } = new URL(request.url);
    const rawLimit = Number(searchParams.get("limit") ?? 20);
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 50) : 20;
    const q = searchParams.get("q") ?? undefined;
    const markets = await listMarkets(limit, q);
    return NextResponse.json({ markets });
  } catch (error) {
    return handleApiError(error);
  }
}