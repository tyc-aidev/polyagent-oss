import { NextResponse } from "next/server";
import { getBotTicks, parsePagination } from "@/lib/api/bots";
import { handleApiError } from "@/lib/api/errors";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const pagination = parsePagination(new URL(request.url).searchParams);
    const result = await getBotTicks(id, pagination);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}