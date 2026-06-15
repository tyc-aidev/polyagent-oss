import { NextResponse } from "next/server";
import { createSessionToken, SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from "@/lib/auth/session";
import { timingSafeEqual } from "@/lib/auth/timing-safe";
import { apiError } from "@/lib/api/errors";
import { checkRateLimit, readJsonBody } from "@/lib/api/request";

export async function POST(request: Request) {
  const password = process.env.DASHBOARD_PASSWORD;
  if (!password) {
    return NextResponse.json({ ok: true });
  }

  if (!checkRateLimit(request, "auth:login", 10, 60_000)) {
    return apiError("Too many login attempts", "rate_limited", 429);
  }

  const body = await readJsonBody<{ password?: string }>(request);
  if (!body.password || !timingSafeEqual(body.password, password)) {
    return apiError("Invalid password", "unauthorized", 401);
  }

  const token = await createSessionToken();
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV !== "development",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return response;
}