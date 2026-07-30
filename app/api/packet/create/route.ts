import { NextResponse } from "next/server";
import { circleClient, circleConfigured } from "@/lib/circle/client";
import { circleErrorResponse } from "@/lib/circle/apiError";
import { PACKET_ARC_TESTNET, getChain } from "@/lib/chains/config";
import { requireUsdcSpendableBalance, requireWalletForBlockchain } from "@/lib/circle/transactionGuards";
import { usdcToBaseUnits } from "@/lib/units";

/**
 * Step 2 of creating a Unit Packet: after the approve() from
 * /api/packet/approve has confirmed, call createPacket() to lock the
 * funds. `splitMode` is 0 for Equal, 1 for Random (see SplitMode enum in
 * UnitPayPacket.sol).
 */
export async function POST(request: Request) {
  if (!circleConfigured) {
    return NextResponse.json(
      { error: "Circle API key not configured on server" },
      { status: 500 },
    );
  }

  try {
    const { userToken, walletId, amount, maxClaims, splitMode, expiresInSeconds } =
      await request.json();
    if (!userToken || !walletId || !amount || !maxClaims || splitMode === undefined) {
      return NextResponse.json(
        { error: "Missing userToken, walletId, amount, maxClaims, or splitMode" },
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
    const expiresIn = String(expiresInSeconds ?? 86400);

    const response = await circleClient.createUserTransactionContractExecutionChallenge({
      userToken,
      walletId,
      contractAddress: PACKET_ARC_TESTNET.address,
      abiFunctionSignature: "createPacket(uint32,uint256,uint8,uint64)",
      abiParameters: [String(maxClaims), amountBaseUnits, String(splitMode), expiresIn],
      fee: { type: "level", config: { feeLevel: "MEDIUM" } },
    });

    return NextResponse.json({ challengeId: response.data?.challengeId });
  } catch (error) {
    return circleErrorResponse(error);
  }
}
