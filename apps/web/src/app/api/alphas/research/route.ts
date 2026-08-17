import { researchAlphasSchema } from "@polyagent/shared";
import { NextResponse } from "next/server";
import { runAlphaResearch } from "@/lib/api/alphas";
import { apiError, handleApiError } from "@/lib/api/errors";
import { checkRateLimit, readJsonBody } from "@/lib/api/request";

export async function POST(request: Request) {
  try {
    if (!(await checkRateLimit(request, "alphas:research", 8, 60_000))) {
      return apiError("Too many requests", "rate_limited", 429);
    }

    const input = researchAlphasSchema.parse(await readJsonBody(request));
    const report = await runAlphaResearch(input);
    return NextResponse.json(report, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
