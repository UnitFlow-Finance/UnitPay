import { NextResponse } from "next/server";
import { circleClient, circleConfigured } from "@/lib/circle/client";
import { circleErrorResponse } from "@/lib/circle/apiError";
import { PACKET_ARC_TESTNET } from "@/lib/chains/config";

/**
 * Claims a share of a Unit Packet. The share amount is computed entirely
 * on-chain by UnitPayPacket.claim (equal split or pseudo-random split) —
 * this route only triggers the call, it never computes or sees the share.
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
      abiFunctionSignature: "claim(uint256)",
      abiParameters: [String(packetId)],
      fee: { type: "level", config: { feeLevel: "MEDIUM" } },
    });

    return NextResponse.json({ challengeId: response.data?.challengeId });
  } catch (error) {
    return circleErrorResponse(error);
  }
}
