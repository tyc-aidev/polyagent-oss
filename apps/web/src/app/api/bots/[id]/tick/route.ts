import { NextResponse } from "next/server";
import { apiError, handleApiError } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/api/request";
import { runBotTick } from "@/lib/runner/tick";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    if (!checkRateLimit(request, "bots:tick", 10, 60_000)) {
      return apiError("Too many requests", "rate_limited", 429);
    }

    const { id } = await params;
    const result = await runBotTick(id);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}