import { NextResponse } from "next/server";
import { circleClient, circleConfigured } from "@/lib/circle/client";
import { circleErrorResponse } from "@/lib/circle/apiError";
import { normalizeWalletAccountType } from "@/lib/circle/paymaster";

export async function POST(request: Request) {
  if (!circleConfigured) {
    return NextResponse.json(
      { error: "Circle API key not configured on server" },
      { status: 500 },
    );
  }

  try {
    const { userToken, blockchain, accountType } = await request.json();
    if (!userToken || !blockchain) {
      return NextResponse.json(
        { error: "Missing required field(s): userToken, blockchain" },
        { status: 400 },
      );
    }

    const walletAccountType = normalizeWalletAccountType(accountType, String(blockchain));

    const response = await circleClient.createWallet({
      userToken,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      blockchains: [String(blockchain)] as any,
      accountType: walletAccountType,
    });

    return NextResponse.json({ challengeId: response.data?.challengeId });
  } catch (error) {
    return circleErrorResponse(error);
  }
}
