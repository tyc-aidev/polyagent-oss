import { NextResponse } from "next/server";
import { harvestMarketSnapshots } from "@/lib/alpha/harvest";
import { handleApiError } from "@/lib/api/errors";
import { isAuthorizedInternalRequest } from "@/lib/scheduler/auth";

export async function POST(request: Request) {
  if (!isAuthorizedInternalRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const harvest = await harvestMarketSnapshots();
    return NextResponse.json({ harvest });
  } catch (error) {
    return handleApiError(error);
  }
}
