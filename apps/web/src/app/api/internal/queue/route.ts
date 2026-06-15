import { NextResponse } from "next/server";
import { readJsonBody } from "@/lib/api/request";
import { runBotTick } from "@/lib/runner/tick";
import { isAuthorizedInternalRequest } from "@/lib/scheduler/auth";

export async function POST(request: Request) {
  if (!isAuthorizedInternalRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { botId?: string };
  try {
    body = await readJsonBody<{ botId?: string }>(request);
  } catch {
    body = {};
  }
  if (!body.botId) {
    return NextResponse.json({ error: "botId required" }, { status: 400 });
  }

  try {
    const result = await runBotTick(body.botId);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Tick failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}