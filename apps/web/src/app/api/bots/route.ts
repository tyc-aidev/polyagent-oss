import type { CreateBotInput } from "@polyagent/shared";
import { NextResponse } from "next/server";
import { createBot, listBots } from "@/lib/api/bots";
import { apiError, handleApiError } from "@/lib/api/errors";
import { checkRateLimit, readJsonBody } from "@/lib/api/request";

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
    if (!checkRateLimit(request, "bots:create", 20, 60_000)) {
      return apiError("Too many requests", "rate_limited", 429);
    }

    const body = await readJsonBody<CreateBotInput>(request);
    const bot = await createBot(body);
    return NextResponse.json(bot, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}