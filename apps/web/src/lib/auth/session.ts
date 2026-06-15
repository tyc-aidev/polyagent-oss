import { timingSafeEqual } from "./timing-safe";

export const SESSION_COOKIE = "polyagent_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

interface SessionPayload {
  iat: number;
  exp: number;
}

function getSessionSecret(): string | undefined {
  return process.env.SESSION_SECRET || process.env.DASHBOARD_PASSWORD;
}

function toBase64Url(bytes: Uint8Array): string {
  const bin = String.fromCharCode(...bytes);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): string {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  return atob(padded + pad);
}

async function sign(data: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return toBase64Url(new Uint8Array(signature));
}

export async function createSessionToken(): Promise<string> {
  const secret = getSessionSecret();
  if (!secret) {
    throw new Error("SESSION_SECRET or DASHBOARD_PASSWORD is required");
  }

  const now = Date.now();
  const payload: SessionPayload = {
    iat: now,
    exp: now + SESSION_MAX_AGE_SECONDS * 1000,
  };
  const payloadB64 = toBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const signature = await sign(payloadB64, secret);
  return `${payloadB64}.${signature}`;
}

export async function verifySessionToken(token: string): Promise<boolean> {
  const secret = getSessionSecret();
  if (!secret) return false;

  const [payloadB64, signature] = token.split(".");
  if (!payloadB64 || !signature) return false;

  const expected = await sign(payloadB64, secret);
  if (!timingSafeEqual(signature, expected)) return false;

  try {
    const payload = JSON.parse(fromBase64Url(payloadB64)) as SessionPayload;
    return typeof payload.exp === "number" && payload.exp > Date.now();
  } catch {
    return false;
  }
}