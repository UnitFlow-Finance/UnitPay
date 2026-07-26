import { NextResponse } from "next/server";
import { circleClient, circleConfigured } from "@/lib/circle/client";
import { circleErrorResponse } from "@/lib/circle/apiError";

/**
 * Returns token balances for a wallet. Amounts come back HUMAN-READABLE
 * (e.g. "20" for 20 USDC) — do not run these through toBaseUnits again.
 *
 * On Arc Testnet specifically: the native ("") balance entry and the USDC
 * ERC-20 balance entry represent the SAME underlying pool of funds (USDC is
 * the native gas asset there). The frontend must not sum or double-count
 * them as two separate assets.
 */
export async function POST(request: Request) {
  if (!circleConfigured) {
    return NextResponse.json(
      { error: "Circle API key not configured on server" },
      { status: 500 },
    );
  }

  try {
    const { userToken, walletId } = await request.json();
    if (!userToken || !walletId) {
      return NextResponse.json(
        { error: "Missing userToken or walletId" },
        { status: 400 },
      );
    }

    const response = await circleClient.getWalletTokenBalance({ userToken, walletId });
    return NextResponse.json({ tokenBalances: response.data?.tokenBalances ?? [] });
  } catch (error) {
    return circleErrorResponse(error);
  }
}
