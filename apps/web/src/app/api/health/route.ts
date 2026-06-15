import { NextResponse } from "next/server";
import { getPrismaAsync } from "@/lib/db";

export async function GET() {
  try {
    const prisma = await getPrismaAsync();
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok", database: "connected" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown database error";
    return NextResponse.json({ status: "error", database: "disconnected", message }, { status: 503 });
  }
}