import { NextResponse } from "next/server";
import { circleClient, circleConfigured } from "@/lib/circle/client";
import { circleErrorResponse } from "@/lib/circle/apiError";
import { getChain } from "@/lib/chains/config";
import { chainKeyForBlockchain } from "@/lib/chains/lookup";
import { requireUsdcSpendableBalance, requireWalletForBlockchain } from "@/lib/circle/transactionGuards";

const MAX_UNCONFIRMED_USDC_WARNING_THRESHOLD = 100;

/**
 * Creates a same-chain outbound transfer challenge. This is the P2P
 * same-chain send path (Section 1: "Send / Receive USDC" -> P2P same-chain).
 *
 * Per skill security rules: always require explicit confirmation of
 * destination/amount/network on the frontend before calling this; this
 * route does not itself execute anything — it only returns a challengeId
 * that the frontend must run through sdk.execute() with user PIN approval.
 */
export async function POST(request: Request) {
  if (!circleConfigured) {
    return NextResponse.json(
      { error: "Circle API key not configured on server" },
      { status: 500 },
    );
  }

  try {
    const { userToken, walletId, destinationAddress, amount, tokenAddress, blockchain } =
      await request.json();

    if (!userToken || !walletId || !destinationAddress || !amount || !blockchain) {
      return NextResponse.json(
        {
          error:
            "Missing required field(s): userToken, walletId, destinationAddress, amount, blockchain",
        },
        { status: 400 },
      );
    }

    if (Number(amount) > MAX_UNCONFIRMED_USDC_WARNING_THRESHOLD) {
      // Server-side belt-and-suspenders on top of the frontend confirmation
      // flow — large transfers still proceed (this is a demo, not a limit
      // enforcement system) but are flagged for visibility.
      console.warn(
        `[transfer] Large transfer requested: ${amount} on ${blockchain} to ${destinationAddress}`,
      );
    }

    const chainKey = chainKeyForBlockchain(String(blockchain));
    await requireWalletForBlockchain({
      circleClient,
      userToken,
      walletId,
      blockchain: String(blockchain),
    });
    const isUsdcTransfer =
      !tokenAddress ||
      String(tokenAddress).toLowerCase() === getChain(chainKey).usdcAddress.toLowerCase();
    await requireUsdcSpendableBalance({
      circleClient,
      userToken,
      walletId,
      chainKey,
      amount: isUsdcTransfer ? String(amount) : undefined,
      requireTransferAmount: isUsdcTransfer,
    });

    const response = await circleClient.createTransaction({
      userToken,
      walletId,
      destinationAddress,
      amounts: [String(amount)],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      blockchain: blockchain as any,
      tokenAddress: tokenAddress ?? "",
      fee: { type: "level", config: { feeLevel: "MEDIUM" } },
    });

    return NextResponse.json({ challengeId: response.data?.challengeId });
  } catch (error) {
    return circleErrorResponse(error);
  }
}
