import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { BodyTooLargeError } from "./request";

export function apiError(message: string, code: string, status: number) {
  return NextResponse.json({ error: message, code }, { status });
}

export function handleApiError(error: unknown) {
  if (error instanceof BodyTooLargeError) {
    return apiError("Request body too large", "payload_too_large", 413);
  }
  if (error instanceof ZodError) {
    return apiError(error.errors[0]?.message ?? "Validation failed", "validation_error", 400);
  }
  if (error instanceof Error) {
    if (error.message.includes("not found")) {
      return apiError(error.message, "not_found", 404);
    }
    return apiError(error.message, "bad_request", 400);
  }
  return apiError("Internal server error", "internal_error", 500);
}