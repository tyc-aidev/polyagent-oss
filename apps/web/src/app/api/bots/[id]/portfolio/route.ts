import { NextResponse } from "next/server";
import { getBotPortfolio } from "@/lib/api/bots";
import { handleApiError } from "@/lib/api/errors";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const portfolio = await getBotPortfolio(id);
    return NextResponse.json(portfolio);
  } catch (error) {
    return handleApiError(error);
  }
}