import type { CreateBotInput } from "@polyagent/shared";
import { NextResponse } from "next/server";
import { createBot, listBots } from "@/lib/api/bots";
import { handleApiError } from "@/lib/api/errors";

export async function GET() {
  try {
    const bots = await listBots();
    return NextResponse.json({ bots });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CreateBotInput;
    const bot = await createBot(body);
    return NextResponse.json(bot, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}