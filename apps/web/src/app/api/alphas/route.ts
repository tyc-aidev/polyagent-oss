import { NextResponse } from "next/server";
import { listAlphaCatalog } from "@/lib/api/alphas";
import { apiError, handleApiError } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/api/request";

export async function GET(request: Request) {
  try {
    if (!(await checkRateLimit(request, "alphas", 60, 60_000))) {
      return apiError("Too many requests", "rate_limited", 429);
    }

    return NextResponse.json({ alphas: listAlphaCatalog() });
  } catch (error) {
    return handleApiError(error);
  }
}
