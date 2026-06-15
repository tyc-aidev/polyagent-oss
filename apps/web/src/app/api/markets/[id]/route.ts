import { NextResponse } from "next/server";
import { apiError, handleApiError } from "@/lib/api/errors";
import { getMarket } from "@/lib/api/markets";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const market = await getMarket(id);
    if (!market) {
      return apiError(`Market not found: ${id}`, "not_found", 404);
    }
    return NextResponse.json(market);
  } catch (error) {
    return handleApiError(error);
  }
}