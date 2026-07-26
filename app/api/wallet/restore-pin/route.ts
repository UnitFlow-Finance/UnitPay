import { NextResponse } from "next/server";
import { circleClient, circleConfigured } from "@/lib/circle/client";
import { circleErrorResponse } from "@/lib/circle/apiError";

/**
 * Creates a PIN-restore challenge for an existing user, keyed off their
 * recovery code (Circle `userId`). Returns a challengeId the frontend
 * executes with sdk.execute() — Circle's hosted UI walks the user through
 * their pre-set security questions and a new PIN, then their wallet
 * becomes usable on this browser/device.
 */
export async function POST(request: Request) {
  if (!circleConfigured) {
    return NextResponse.json(
      { error: "Circle API key not configured on server" },
      { status: 500 },
    );
  }

  try {
    const { userToken } = await request.json();
    if (!userToken || typeof userToken !== "string") {
      return NextResponse.json({ error: "Missing userToken" }, { status: 400 });
    }

    const response = await circleClient.restoreUserPin({ userToken });
    return NextResponse.json({ challengeId: response.data?.challengeId });
  } catch (error) {
    return circleErrorResponse(error);
  }
}
