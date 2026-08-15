import { importHistorySchema } from "@polyagent/shared";
import { NextResponse } from "next/server";
import { listMarketHistory, importMarketHistory, toPriceBar } from "@/lib/alpha/snapshots";
import { apiError, handleApiError } from "@/lib/api/errors";
import { parsePagination } from "@/lib/api/pagination";
import { checkRateLimit, readJsonBody } from "@/lib/api/request";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    if (!(await checkRateLimit(request, "markets:history", 60, 60_000))) {
      return apiError("Too many requests", "rate_limited", 429);
    }

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const { limit } = parsePagination(searchParams);
    const from = searchParams.get("from") ? new Date(searchParams.get("from")!) : undefined;
    const to = searchParams.get("to") ? new Date(searchParams.get("to")!) : undefined;

    if (from && Number.isNaN(from.getTime())) {
      return apiError("Invalid from timestamp", "validation_error", 400);
    }
    if (to && Number.isNaN(to.getTime())) {
      return apiError("Invalid to timestamp", "validation_error", 400);
    }

    const bars = await listMarketHistory(id, { from, to, limit });
    return NextResponse.json({ marketId: id, bars });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    if (!(await checkRateLimit(request, "markets:history:import", 20, 60_000))) {
      return apiError("Too many requests", "rate_limited", 429);
    }

    const { id } = await params;
    const body = importHistorySchema.parse(await readJsonBody(request));
    const bars = body.bars.map((bar) => toPriceBar(bar, id));
    const imported = await importMarketHistory(id, bars);
    return NextResponse.json({ marketId: id, imported }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
