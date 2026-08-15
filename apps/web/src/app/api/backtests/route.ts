import { runBacktestSchema } from "@polyagent/shared";
import { NextResponse } from "next/server";
import { createBacktest } from "@/lib/api/backtests";
import { apiError, handleApiError } from "@/lib/api/errors";
import { checkRateLimit, readJsonBody } from "@/lib/api/request";

export async function POST(request: Request) {
  try {
    if (!(await checkRateLimit(request, "backtests", 20, 60_000))) {
      return apiError("Too many requests", "rate_limited", 429);
    }

    const body = runBacktestSchema.parse(await readJsonBody(request));
    const report = await createBacktest(body);
    return NextResponse.json(report, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
