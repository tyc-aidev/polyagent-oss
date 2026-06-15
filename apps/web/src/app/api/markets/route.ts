import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api/errors";
import { listMarkets } from "@/lib/api/markets";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Number(searchParams.get("limit") ?? 20);
    const q = searchParams.get("q") ?? undefined;
    const markets = await listMarkets(limit, q);
    return NextResponse.json({ markets });
  } catch (error) {
    return handleApiError(error);
  }
}