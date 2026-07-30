import { NextResponse } from "next/server";
import { circleClient, circleConfigured } from "@/lib/circle/client";
import { circleErrorResponse } from "@/lib/circle/apiError";
import { GATEWAY_TESTNET, getChain } from "@/lib/chains/config";
import { requireUsdcSpendableBalance, requireWalletForBlockchain } from "@/lib/circle/transactionGuards";

/**
 * Final step of a Gateway cross-chain transfer: call gatewayMint() on the
 * destination chain wallet, using the attestation + signature returned by
 * Gateway's /transfer API (see /api/gateway/transfer/submit).
 */
export async function POST(request: Request) {
  if (!circleConfigured) {
    return NextResponse.json(
      { error: "Circle API key not configured on server" },
      { status: 500 },
    );
  }

  try {
    const { userToken, walletId, destinationChainKey, attestation, signature } = await request.json();
    if (!userToken || !walletId || !destinationChainKey || !attestation || !signature) {
      return NextResponse.json(
        { error: "Missing userToken, walletId, destinationChainKey, attestation, or signature" },
        { status: 400 },
      );
    }

    const chain = getChain(destinationChainKey);
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
      contractAddress: GATEWAY_TESTNET.minterAddress,
      abiFunctionSignature: "gatewayMint(bytes,bytes)",
      abiParameters: [attestation, signature],
      fee: { type: "level", config: { feeLevel: "MEDIUM" } },
    });

    return NextResponse.json({ challengeId: response.data?.challengeId });
  } catch (error) {
    return circleErrorResponse(error);
  }
}
