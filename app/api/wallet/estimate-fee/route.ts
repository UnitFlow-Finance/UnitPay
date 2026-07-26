import { NextResponse } from "next/server";
import { circleClient, circleConfigured } from "@/lib/circle/client";
import { circleErrorResponse } from "@/lib/circle/apiError";

/**
 * Estimates transfer fees before executing — used to show the user gas
 * costs upfront, per skill best practice.
 */
export async function POST(request: Request) {
  if (!circleConfigured) {
    return NextResponse.json(
      { error: "Circle API key not configured on server" },
      { status: 500 },
    );
  }

  try {
    const { userToken, walletId, tokenAddress, destinationAddress, amount } =
      await request.json();
    if (!userToken || !walletId || !destinationAddress || !amount) {
      return NextResponse.json(
        { error: "Missing userToken, walletId, destinationAddress, or amount" },
        { status: 400 },
      );
    }

    const response = await circleClient.estimateTransferFee({
      userToken,
      walletId,
      tokenAddress: tokenAddress ?? "",
      destinationAddress,
      amount: [String(amount)],
    });

    return NextResponse.json(response.data);
  } catch (error) {
    return circleErrorResponse(error);
  }
}
