import { NextResponse } from "next/server";
import { getMarketFeatures } from "@/lib/api/alphas";
import { apiError, handleApiError } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/api/request";
import { DEFAULT_FEATURE_LOOKBACK } from "@/lib/alpha/features";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    if (!(await checkRateLimit(request, "markets:features", 60, 60_000))) {
      return apiError("Too many requests", "rate_limited", 429);
    }

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const rawLookback = Number(searchParams.get("lookback") ?? DEFAULT_FEATURE_LOOKBACK);
    const lookback = Number.isFinite(rawLookback)
      ? Math.min(Math.max(Math.trunc(rawLookback), 1), 100)
      : DEFAULT_FEATURE_LOOKBACK;

    const result = await getMarketFeatures(id, lookback, true);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
