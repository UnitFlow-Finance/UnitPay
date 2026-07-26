import { NextResponse } from "next/server";
import { circleClient, circleConfigured } from "@/lib/circle/client";
import { circleErrorResponse } from "@/lib/circle/apiError";
import { TRANSFER_ARC_TESTNET } from "@/lib/chains/config";
import { usdcToBaseUnits } from "@/lib/units";

/**
 * Step 2 of fulfilling a multi-receiver payment link: after the approve()
 * from /api/wallet/batch-approve has confirmed, call
 * UnitPayTransfer.batchTransfer to fan the payment out to every receiver
 * in a single transaction. Same approve-then-act pattern as escrow/packet.
 */
export async function POST(request: Request) {
  if (!circleConfigured) {
    return NextResponse.json(
      { error: "Circle API key not configured on server" },
      { status: 500 },
    );
  }

  try {
    const { userToken, walletId, receivers } = await request.json();
    if (!userToken || !walletId || !Array.isArray(receivers) || receivers.length === 0) {
      return NextResponse.json(
        { error: "Missing userToken, walletId, or receivers" },
        { status: 400 },
      );
    }

    const addresses: string[] = [];
    const amountsBaseUnits: string[] = [];
    for (const r of receivers) {
      if (!r?.address || !r?.amount) {
        return NextResponse.json(
          { error: "Each receiver needs an address and amount" },
          { status: 400 },
        );
      }
      addresses.push(r.address);
      amountsBaseUnits.push(usdcToBaseUnits(r.amount).toString());
    }

    const response = await circleClient.createUserTransactionContractExecutionChallenge({
      userToken,
      walletId,
      contractAddress: TRANSFER_ARC_TESTNET.address,
      abiFunctionSignature: "batchTransfer(address[],uint256[])",
      abiParameters: [addresses, amountsBaseUnits],
      fee: { type: "level", config: { feeLevel: "MEDIUM" } },
    });

    return NextResponse.json({ challengeId: response.data?.challengeId });
  } catch (error) {
    return circleErrorResponse(error);
  }
}
