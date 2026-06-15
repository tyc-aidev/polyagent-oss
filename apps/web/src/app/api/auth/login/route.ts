import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const password = process.env.DASHBOARD_PASSWORD;
  if (!password) {
    return NextResponse.json({ ok: true });
  }

  const body = (await request.json()) as { password?: string };
  if (body.password !== password) {
    return NextResponse.json({ error: "Invalid password", code: "unauthorized" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set("polyagent_session", password, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}