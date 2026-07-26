import { NextResponse } from "next/server";
import { circleClient, circleConfigured } from "@/lib/circle/client";
import { circleErrorResponse } from "@/lib/circle/apiError";
import { PRIMARY_CHAIN } from "@/lib/chains/config";

/**
 * Initializes a user (sets PIN via Circle's hosted UI) and creates their
 * first wallet(s). Returns a challengeId the frontend executes with
 * sdk.execute(). Defaults to Arc Testnet (this app's primary chain) using
 * an EOA account — no separate native gas token exists on Arc, so SCA's
 * lazy-deployment gas cost has no benefit there.
 *
 * If the user is already initialized, Circle returns error code 155106 —
 * the frontend should treat that as "fetch existing wallets" rather than
 * an error (per the use-user-controlled-wallets skill).
 */
export async function POST(request: Request) {
  if (!circleConfigured) {
    return NextResponse.json(
      { error: "Circle API key not configured on server" },
      { status: 500 },
    );
  }

  try {
    const { userToken, blockchains } = await request.json();
    if (!userToken || typeof userToken !== "string") {
      return NextResponse.json({ error: "Missing userToken" }, { status: 400 });
    }

    const targetBlockchains: string[] =
      Array.isArray(blockchains) && blockchains.length > 0
        ? blockchains
        : [PRIMARY_CHAIN.circleBlockchain];

    const response = await circleClient.createUserPinWithWallets({
      userToken,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      blockchains: targetBlockchains as any,
      accountType: "EOA",
    });

    return NextResponse.json({ challengeId: response.data?.challengeId });
  } catch (error) {
    return circleErrorResponse(error);
  }
}
