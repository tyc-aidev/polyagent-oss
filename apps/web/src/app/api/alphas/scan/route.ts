import { scanAlphasSchema } from "@polyagent/shared";
import { NextResponse } from "next/server";
import { parseScanQuery } from "@/lib/alpha/scan";
import { scanAlphaOpportunities } from "@/lib/api/alphas";
import { apiError, handleApiError } from "@/lib/api/errors";
import { checkRateLimit, readJsonBody } from "@/lib/api/request";

export async function GET(request: Request) {
  try {
    if (!(await checkRateLimit(request, "alphas:scan", 30, 60_000))) {
      return apiError("Too many requests", "rate_limited", 429);
    }

    const { searchParams } = new URL(request.url);
    const input = scanAlphasSchema.parse(parseScanQuery(searchParams));
    const report = await scanAlphaOpportunities(input);
    return NextResponse.json(report);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    if (!(await checkRateLimit(request, "alphas:scan:post", 20, 60_000))) {
      return apiError("Too many requests", "rate_limited", 429);
    }

    const input = scanAlphasSchema.parse(await readJsonBody(request));
    const report = await scanAlphaOpportunities(input);
    return NextResponse.json(report);
  } catch (error) {
    return handleApiError(error);
  }
}
