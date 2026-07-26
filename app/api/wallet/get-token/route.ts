import { NextResponse } from "next/server";
import { circleClient, circleConfigured } from "@/lib/circle/client";
import { circleErrorResponse } from "@/lib/circle/apiError";

/**
 * Returns a short-lived (60 min) `userToken` + `encryptionKey` pair for the
 * given userId. These are the only Circle credentials the browser ever sees.
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

    const response = await circleClient.createUserToken({ userId });
    return NextResponse.json({
      userToken: response.data?.userToken,
      encryptionKey: response.data?.encryptionKey,
    });
  } catch (error) {
    return circleErrorResponse(error);
  }
}
