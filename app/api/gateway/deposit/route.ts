import { NextResponse } from "next/server";
import { circleClient, circleConfigured } from "@/lib/circle/client";
import { circleErrorResponse } from "@/lib/circle/apiError";
import { GATEWAY_TESTNET, getChain } from "@/lib/chains/config";
import { requireUsdcSpendableBalance, requireWalletForBlockchain } from "@/lib/circle/transactionGuards";
import { usdcToBaseUnits } from "@/lib/units";

/**
 * Step 1 of depositing into Gateway's unified balance: approve the Gateway
 * Wallet contract to spend USDC on behalf of the user's wallet.
 *
 * Per Circle's own warning: never send USDC directly to the Gateway Wallet
 * contract via a plain ERC-20 transfer — funds will not be credited to the
 * unified balance. Must go through approve() + deposit(address,uint256).
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
    if (chain.family !== "evm") {
      return NextResponse.json({ error: "Gateway deposits from this route require an EVM chain." }, { status: 400 });
    }
    await requireWalletForBlockchain({
      circleClient,
      userToken,
      walletId,
      blockchain: chain.circleBlockchain,
    });
    await requireUsdcSpendableBalance({ circleClient, userToken, walletId, chainKey, amount });
    const amountBaseUnits = usdcToBaseUnits(amount).toString();

    const response = await circleClient.createUserTransactionContractExecutionChallenge({
      userToken,
      walletId,
      contractAddress: chain.usdcAddress,
      abiFunctionSignature: "approve(address,uint256)",
      abiParameters: [GATEWAY_TESTNET.walletAddress, amountBaseUnits],
      fee: { type: "level", config: { feeLevel: "MEDIUM" } },
    });

    return NextResponse.json({ challengeId: response.data?.challengeId });
  } catch (error) {
    return circleErrorResponse(error);
  }
}
