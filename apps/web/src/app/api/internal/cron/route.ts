import { NextResponse } from "next/server";
import { harvestMarketSnapshots, type HarvestResult } from "@/lib/alpha/harvest";
import { isAuthorizedInternalRequest } from "@/lib/scheduler/auth";
import { enqueueActiveBots } from "@/lib/scheduler/enqueue";

export async function POST(request: Request) {
  if (!isAuthorizedInternalRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let harvest: HarvestResult | { error: string };
  try {
    harvest = await harvestMarketSnapshots();
  } catch (error) {
    harvest = { error: error instanceof Error ? error.message : "harvest failed" };
  }

  const result = await enqueueActiveBots();
  return NextResponse.json({ ...result, harvest });
}