import { NextResponse } from "next/server";
import { getBotPositions } from "@/lib/api/bots";
import { handleApiError } from "@/lib/api/errors";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const positions = await getBotPositions(id);
    return NextResponse.json({ positions });
  } catch (error) {
    return handleApiError(error);
  }
}