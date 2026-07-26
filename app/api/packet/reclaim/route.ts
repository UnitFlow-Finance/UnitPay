import { NextResponse } from "next/server";
import { circleClient, circleConfigured } from "@/lib/circle/client";
import { circleErrorResponse } from "@/lib/circle/apiError";
import { PACKET_ARC_TESTNET } from "@/lib/chains/config";

/**
 * Reclaims the unclaimed remainder of an expired Unit Packet back to its
 * creator. Callable by anyone once expired — enforced on-chain by
 * UnitPayPacket.reclaim, not here.
 */
export async function POST(request: Request) {
  if (!circleConfigured) {
    return NextResponse.json(
      { error: "Circle API key not configured on server" },
      { status: 500 },
    );
  }

  try {
    const { userToken, walletId, packetId } = await request.json();
    if (!userToken || !walletId || packetId === undefined || packetId === null) {
      return NextResponse.json(
        { error: "Missing userToken, walletId, or packetId" },
        { status: 400 },
      );
    }

    const response = await circleClient.createUserTransactionContractExecutionChallenge({
      userToken,
      walletId,
      contractAddress: PACKET_ARC_TESTNET.address,
      abiFunctionSignature: "reclaim(uint256)",
      abiParameters: [String(packetId)],
      fee: { type: "level", config: { feeLevel: "MEDIUM" } },
    });

    return NextResponse.json({ challengeId: response.data?.challengeId });
  } catch (error) {
    return circleErrorResponse(error);
  }
}
