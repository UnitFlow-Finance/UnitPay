import { NextResponse } from "next/server";
import { circleClient, circleConfigured } from "@/lib/circle/client";
import { circleErrorResponse } from "@/lib/circle/apiError";
import { TRANSFER_ARC_TESTNET, getChain } from "@/lib/chains/config";
import { requireUsdcSpendableBalance, requireWalletForBlockchain } from "@/lib/circle/transactionGuards";
import { usdcToBaseUnits } from "@/lib/units";

/**
 * Step 1 of fulfilling a multi-receiver payment link: approve
 * UnitPayTransfer to spend the total USDC amount on the payer's behalf
 * (batchTransfer calls safeTransferFrom once per receiver, drawing from
 * the same allowance). Same approve-then-act pattern as
 * /api/escrow/approve and /api/packet/approve.
 */
export async function POST(request: Request) {
  if (!circleConfigured) {
    return NextResponse.json(
      { error: "Circle API key not configured on server" },
      { status: 500 },
    );
  }

  try {
    const { userToken, walletId, totalAmount } = await request.json();
    if (!userToken || !walletId || !totalAmount) {
      return NextResponse.json(
        { error: "Missing userToken, walletId, or totalAmount" },
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
      amount: totalAmount,
    });
    const amountBaseUnits = usdcToBaseUnits(totalAmount).toString();

    const response = await circleClient.createUserTransactionContractExecutionChallenge({
      userToken,
      walletId,
      contractAddress: chain.usdcAddress,
      abiFunctionSignature: "approve(address,uint256)",
      abiParameters: [TRANSFER_ARC_TESTNET.address, amountBaseUnits],
      fee: { type: "level", config: { feeLevel: "MEDIUM" } },
    });

    return NextResponse.json({ challengeId: response.data?.challengeId });
  } catch (error) {
    return circleErrorResponse(error);
  }
}
