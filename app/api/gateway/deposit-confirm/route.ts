import { NextResponse } from "next/server";
import { circleClient, circleConfigured } from "@/lib/circle/client";
import { circleErrorResponse } from "@/lib/circle/apiError";
import { GATEWAY_TESTNET, getChain } from "@/lib/chains/config";
import { usdcToBaseUnits } from "@/lib/units";

/**
 * Step 2 of depositing into Gateway: after the `approve()` transaction from
 * /api/gateway/deposit has confirmed, call this to create the actual
 * `deposit(address,uint256)` challenge against the Gateway Wallet contract.
 */
export async function POST(request: Request) {
  if (!circleConfigured) {
    return NextResponse.json(
      { error: "Circle API key not configured on server" },
      { status: 500 },
    );
  }

  try {
    const { userToken, walletId, chainKey, amount } = await request.json();
    if (!userToken || !walletId || !chainKey || !amount) {
      return NextResponse.json(
        { error: "Missing userToken, walletId, chainKey, or amount" },
        { status: 400 },
      );
    }

    const chain = getChain(chainKey);
    const amountBaseUnits = usdcToBaseUnits(amount).toString();

    const response = await circleClient.createUserTransactionContractExecutionChallenge({
      userToken,
      walletId,
      contractAddress: GATEWAY_TESTNET.walletAddress,
      abiFunctionSignature: "deposit(address,uint256)",
      abiParameters: [chain.usdcAddress, amountBaseUnits],
      fee: { type: "level", config: { feeLevel: "MEDIUM" } },
    });

    return NextResponse.json({ challengeId: response.data?.challengeId });
  } catch (error) {
    return circleErrorResponse(error);
  }
}
