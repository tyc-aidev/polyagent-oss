import type { UpdateBotInput } from "@polyagent/shared";
import { NextResponse } from "next/server";
import { archiveBot, getBot, updateBot } from "@/lib/api/bots";
import { handleApiError } from "@/lib/api/errors";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const bot = await getBot(id);
    return NextResponse.json(bot);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = (await request.json()) as UpdateBotInput;
    const bot = await updateBot(id, body);
    return NextResponse.json(bot);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const bot = await archiveBot(id);
    return NextResponse.json(bot);
  } catch (error) {
    return handleApiError(error);
  }
}