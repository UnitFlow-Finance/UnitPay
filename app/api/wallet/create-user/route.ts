import { NextResponse } from "next/server";
import { circleClient, circleConfigured } from "@/lib/circle/client";
import { circleErrorResponse } from "@/lib/circle/apiError";

/**
 * Creates a Circle user-controlled-wallets user for the given app-level
 * userId. If the user already exists this call is a no-op success from
 * Circle's side; the "already initialized" error (155106) surfaces later,
 * at the /initialize step, not here.
 */
export async function POST(request: Request) {
  if (!circleConfigured) {
    return NextResponse.json(
      { error: "Circle API key not configured on server" },
      { status: 500 },
    );
  }

  try {
    const { userId } = await request.json();
    if (!userId || typeof userId !== "string") {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    await circleClient.createUser({ userId });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return circleErrorResponse(error);
  }
}
