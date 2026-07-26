import { NextResponse } from "next/server";
import { circleClient, circleConfigured } from "@/lib/circle/client";
import { circleErrorResponse } from "@/lib/circle/apiError";
import { GATEWAY_TESTNET } from "@/lib/chains/config";

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
    const { userToken, walletId, attestation, signature } = await request.json();
    if (!userToken || !walletId || !attestation || !signature) {
      return NextResponse.json(
        { error: "Missing userToken, walletId, attestation, or signature" },
        { status: 400 },
      );
    }

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
