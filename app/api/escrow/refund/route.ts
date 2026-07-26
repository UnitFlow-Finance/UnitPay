import { NextResponse } from "next/server";
import { circleClient, circleConfigured } from "@/lib/circle/client";
import { circleErrorResponse } from "@/lib/circle/apiError";
import { ESCROW_ARC_TESTNET } from "@/lib/chains/config";

/**
 * Refunds an escrow's funds back to the payer. Callable by the payee (task
 * withdrawn) at any time, by the payer after expiry, or by the arbiter
 * once disputed — enforced on-chain by UnitPayEscrow.refund, not here.
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

    const response = await circleClient.createUserTransactionContractExecutionChallenge({
      userToken,
      walletId,
      contractAddress: ESCROW_ARC_TESTNET.address,
      abiFunctionSignature: "refund(uint256)",
      abiParameters: [String(escrowId)],
      fee: { type: "level", config: { feeLevel: "MEDIUM" } },
    });

    return NextResponse.json({ challengeId: response.data?.challengeId });
  } catch (error) {
    return circleErrorResponse(error);
  }
}
