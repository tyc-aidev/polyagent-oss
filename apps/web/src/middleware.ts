import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySessionToken } from "@/lib/auth/session";
import { withSecurityHeaders } from "@/lib/security/headers";

const PUBLIC_PATHS = [
  "/",
  "/login",
  "/api/health",
  "/api/auth/login",
  "/api/internal",
];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

export async function middleware(request: NextRequest) {
  const password = process.env.DASHBOARD_PASSWORD;
  const { pathname } = request.nextUrl;

  if (!password || isPublic(pathname)) {
    return withSecurityHeaders(NextResponse.next());
  }

  const session = request.cookies.get("polyagent_session")?.value;
  if (session && (await verifySessionToken(session))) {
    return withSecurityHeaders(NextResponse.next());
  }

  if (pathname.startsWith("/api/")) {
    return withSecurityHeaders(
      NextResponse.json({ error: "Unauthorized", code: "unauthorized" }, { status: 401 }),
    );
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", pathname);
  return withSecurityHeaders(NextResponse.redirect(loginUrl));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.svg|.*\\.svg$).*)"],
};