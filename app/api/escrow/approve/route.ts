import { NextResponse } from "next/server";
import { circleClient, circleConfigured } from "@/lib/circle/client";
import { circleErrorResponse } from "@/lib/circle/apiError";
import { ESCROW_ARC_TESTNET, getChain } from "@/lib/chains/config";
import { requireUsdcSpendableBalance, requireWalletForBlockchain } from "@/lib/circle/transactionGuards";
import { usdcToBaseUnits } from "@/lib/units";

/**
 * Step 1 of creating an escrow: approve UnitPayEscrow to spend USDC on the
 * payer's behalf (createEscrow calls safeTransferFrom). Same approve-then-
 * act pattern as /api/gateway/deposit.
 */
export async function POST(request: Request) {
  if (!circleConfigured) {
    return NextResponse.json(
      { error: "Circle API key not configured on server" },
      { status: 500 },
    );
  }

  try {
    const { userToken, walletId, amount } = await request.json();
    if (!userToken || !walletId || !amount) {
      return NextResponse.json(
        { error: "Missing userToken, walletId, or amount" },
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
    await requireUsdcSpendableBalance({ circleClient, userToken, walletId, chainKey: chain.key, amount });
    const amountBaseUnits = usdcToBaseUnits(amount).toString();

    const response = await circleClient.createUserTransactionContractExecutionChallenge({
      userToken,
      walletId,
      contractAddress: chain.usdcAddress,
      abiFunctionSignature: "approve(address,uint256)",
      abiParameters: [ESCROW_ARC_TESTNET.address, amountBaseUnits],
      fee: { type: "level", config: { feeLevel: "MEDIUM" } },
    });

    return NextResponse.json({ challengeId: response.data?.challengeId });
  } catch (error) {
    return circleErrorResponse(error);
  }
}
