import { NextResponse } from "next/server";
import { circleClient, circleConfigured } from "@/lib/circle/client";
import { circleErrorResponse } from "@/lib/circle/apiError";

/** Lists all wallets belonging to the user identified by `userToken`. */
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

    const response = await circleClient.listWallets({ userToken });
    return NextResponse.json({ wallets: response.data?.wallets ?? [] });
  } catch (error) {
    return circleErrorResponse(error);
  }
}
