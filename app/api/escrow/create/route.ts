import { NextResponse } from "next/server";
import { circleClient, circleConfigured } from "@/lib/circle/client";
import { circleErrorResponse } from "@/lib/circle/apiError";
import { ESCROW_ARC_TESTNET, getChain } from "@/lib/chains/config";
import { requireUsdcSpendableBalance, requireWalletForBlockchain } from "@/lib/circle/transactionGuards";
import { usdcToBaseUnits } from "@/lib/units";

/**
 * Step 2 of creating an escrow: after the approve() from
 * /api/escrow/approve has confirmed, call createEscrow() to lock the
 * funds. `termsHash` is a keccak256 commitment computed client-side over
 * the plaintext terms (see lib/escrow/terms.ts) — this route never sees
 * the actual terms text.
 */
export async function POST(request: Request) {
  if (!circleConfigured) {
    return NextResponse.json(
      { error: "Circle API key not configured on server" },
      { status: 500 },
    );
  }

  try {
    const { userToken, walletId, payee, arbiter, amount, termsHash, expiresInSeconds } =
      await request.json();
    if (!userToken || !walletId || !payee || !amount || !termsHash) {
      return NextResponse.json(
        { error: "Missing userToken, walletId, payee, amount, or termsHash" },
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
    const arbiterAddress = arbiter || "0x0000000000000000000000000000000000000000";
    const expiresIn = String(expiresInSeconds ?? 0);

    const response = await circleClient.createUserTransactionContractExecutionChallenge({
      userToken,
      walletId,
      contractAddress: ESCROW_ARC_TESTNET.address,
      abiFunctionSignature: "createEscrow(address,address,uint256,bytes32,uint64)",
      abiParameters: [payee, arbiterAddress, amountBaseUnits, termsHash, expiresIn],
      fee: { type: "level", config: { feeLevel: "MEDIUM" } },
    });

    return NextResponse.json({ challengeId: response.data?.challengeId });
  } catch (error) {
    return circleErrorResponse(error);
  }
}
