import { sweepBacktestSchema } from "@polyagent/shared";
import { NextResponse } from "next/server";
import { createSweep } from "@/lib/api/backtests";
import { apiError, handleApiError } from "@/lib/api/errors";
import { checkRateLimit, readJsonBody } from "@/lib/api/request";

export async function POST(request: Request) {
  try {
    if (!(await checkRateLimit(request, "backtests:sweep", 10, 60_000))) {
      return apiError("Too many requests", "rate_limited", 429);
    }

    const body = sweepBacktestSchema.parse(await readJsonBody(request));
    const report = await createSweep(body);
    return NextResponse.json(report, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
