import { NextResponse } from "next/server";
import { circleClient, circleConfigured } from "@/lib/circle/client";
import { circleErrorResponse } from "@/lib/circle/apiError";

/** Lists transactions for one or more wallets — backs the history view. */
export async function POST(request: Request) {
  if (!circleConfigured) {
    return NextResponse.json(
      { error: "Circle API key not configured on server" },
      { status: 500 },
    );
  }

  try {
    const { userToken, walletIds } = await request.json();
    if (!userToken || !Array.isArray(walletIds) || walletIds.length === 0) {
      return NextResponse.json(
        { error: "Missing userToken or walletIds" },
        { status: 400 },
      );
    }

    const response = await circleClient.listTransactions({ userToken, walletIds });
    return NextResponse.json({ transactions: response.data?.transactions ?? [] });
  } catch (error) {
    return circleErrorResponse(error);
  }
}
