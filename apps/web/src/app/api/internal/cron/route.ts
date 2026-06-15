import { NextResponse } from "next/server";
import { isAuthorizedInternalRequest } from "@/lib/scheduler/auth";
import { enqueueActiveBots } from "@/lib/scheduler/enqueue";

export async function POST(request: Request) {
  if (!isAuthorizedInternalRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await enqueueActiveBots();
  return NextResponse.json(result);
}