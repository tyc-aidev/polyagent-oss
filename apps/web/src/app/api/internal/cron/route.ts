import { NextResponse } from "next/server";
import { runActiveBotTicks } from "@/lib/runner/tick";
import { isAuthorizedInternalRequest } from "@/lib/scheduler/auth";

export async function POST(request: Request) {
  if (!isAuthorizedInternalRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results = await runActiveBotTicks();
  return NextResponse.json({ enqueued: results.length, results });
}