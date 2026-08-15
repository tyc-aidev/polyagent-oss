import { NextResponse } from "next/server";
import { getAlphaDefinition } from "@/lib/api/alphas";
import { apiError, handleApiError } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/api/request";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    if (!(await checkRateLimit(request, "alphas:id", 60, 60_000))) {
      return apiError("Too many requests", "rate_limited", 429);
    }

    const { id } = await params;
    return NextResponse.json(getAlphaDefinition(id));
  } catch (error) {
    return handleApiError(error);
  }
}
