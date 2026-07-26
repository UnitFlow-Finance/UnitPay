import "server-only";
import { NextResponse } from "next/server";

/**
 * Circle SDK errors carry the original HTTP status + response body on
 * `error.response`. Pass that through as-is so the frontend can key off
 * Circle's documented error codes (e.g. 155106 "user already initialized").
 */
export function circleErrorResponse(error: unknown) {
  const err = error as { response?: { status?: number; data?: unknown }; message?: string };
  const status = err.response?.status ?? 500;
  const data = err.response?.data ?? { error: err.message ?? String(error) };
  return NextResponse.json(data, { status });
}
