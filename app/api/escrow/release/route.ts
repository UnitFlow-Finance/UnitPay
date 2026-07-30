import { NextResponse } from "next/server";
import { circleClient, circleConfigured } from "@/lib/circle/client";
import { circleErrorResponse } from "@/lib/circle/apiError";
import { ESCROW_ARC_TESTNET, getChain } from "@/lib/chains/config";
import { requireUsdcSpendableBalance, requireWalletForBlockchain } from "@/lib/circle/transactionGuards";

/**
 * Releases an escrow's funds to the payee. Callable by the payer (task
 * accepted) or, once disputed, by the arbiter — enforced on-chain by
 * UnitPayEscrow.release, not here.
 */
export async function POST(request: Request) {
  if (!circleConfigured) {
    return NextResponse.json(
      { error: "Circle API key not configured on server" },
      { status: 500 },
    );
  }

  try {
    const { userToken, walletId, escrowId } = await request.json();
    if (!userToken || !walletId || escrowId === undefined || escrowId === null) {
      return NextResponse.json(
        { error: "Missing userToken, walletId, or escrowId" },
        { status: 400 },
      );
    }

    const chain = getChain("arcTestnet");
    await requireWalletForBlockchain({
      circleClient,
      userToken,
      walletId,
      blockchain: chain.circleBlockchain,
    });
    await requireUsdcSpendableBalance({
      circleClient,
      userToken,
      walletId,
      chainKey: chain.key,
      requireTransferAmount: false,
    });

    const response = await circleClient.createUserTransactionContractExecutionChallenge({
      userToken,
      walletId,
      contractAddress: ESCROW_ARC_TESTNET.address,
      abiFunctionSignature: "release(uint256)",
      abiParameters: [String(escrowId)],
      fee: { type: "level", config: { feeLevel: "MEDIUM" } },
    });

    return NextResponse.json({ challengeId: response.data?.challengeId });
  } catch (error) {
    return circleErrorResponse(error);
  }
}
