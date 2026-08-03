import { NextResponse } from "next/server";
import { circleClient, circleConfigured } from "@/lib/circle/client";
import { circleErrorResponse } from "@/lib/circle/apiError";
import { GATEWAY_TESTNET, getChain } from "@/lib/chains/config";
import { requireWalletForBlockchain } from "@/lib/circle/transactionGuards";
import {
  MAX_UINT256,
  addressToBytes32,
  buildBurnIntentTypedDataString,
  randomHex32,
} from "@/lib/gateway/burnIntent";
import { usdcToBaseUnits } from "@/lib/units";

/**
 * Builds a Gateway burn-intent EIP-712 payload for a cross-chain unified
 * balance transfer, and requests a signTypedData challenge for it from
 * Circle Wallets. The frontend executes the returned challengeId with the
 * user's configured Circle authentication method, then POSTs the resulting signature to
 * /api/gateway/transfer/submit to complete the transfer.
 *
 * Default maxFee mirrors Circle's own canonical example (2.01 USDC) — safe
 * upper bound for a testnet demo; real integrations should call Gateway's
 * fee-estimation endpoint if/when one is available for the target route.
 */
const DEFAULT_MAX_FEE_BASE_UNITS = "2010000";

export async function POST(request: Request) {
  if (!circleConfigured) {
    return NextResponse.json(
      { error: "Circle API key not configured on server" },
      { status: 500 },
    );
  }

  try {
    const {
      userToken,
      walletId,
      sourceChainKey,
      destinationChainKey,
      sourceAddress,
      recipientAddress,
      amount,
    } = await request.json();

    if (
      !userToken ||
      !walletId ||
      !sourceChainKey ||
      !destinationChainKey ||
      !sourceAddress ||
      !recipientAddress ||
      !amount
    ) {
      return NextResponse.json({ error: "Missing required field(s)" }, { status: 400 });
    }

    const sourceChain = getChain(sourceChainKey);
    const destinationChain = getChain(destinationChainKey);

    if (sourceChain.family !== "evm" || destinationChain.family !== "evm") {
      return NextResponse.json(
        { error: "This route only supports EVM-to-EVM Gateway transfers. See /api/gateway/solana for Solana paths." },
        { status: 400 },
      );
    }

    await requireWalletForBlockchain({
      circleClient,
      userToken,
      walletId,
      blockchain: sourceChain.circleBlockchain,
    });

    const burnIntent = {
      maxBlockHeight: MAX_UINT256,
      maxFee: DEFAULT_MAX_FEE_BASE_UNITS,
      spec: {
        version: 1,
        sourceDomain: sourceChain.domain,
        destinationDomain: destinationChain.domain,
        sourceContract: addressToBytes32(GATEWAY_TESTNET.walletAddress),
        destinationContract: addressToBytes32(GATEWAY_TESTNET.minterAddress),
        sourceToken: addressToBytes32(sourceChain.usdcAddress),
        destinationToken: addressToBytes32(destinationChain.usdcAddress),
        sourceDepositor: addressToBytes32(sourceAddress),
        destinationRecipient: addressToBytes32(recipientAddress),
        sourceSigner: addressToBytes32(sourceAddress),
        destinationCaller: addressToBytes32("0x0000000000000000000000000000000000000000"),
        value: usdcToBaseUnits(amount).toString(),
        salt: randomHex32(),
        hookData: "0x",
      },
    };

    const typedDataString = buildBurnIntentTypedDataString(burnIntent);

    const response = await circleClient.signTypedData({
      userToken,
      walletId,
      data: typedDataString,
      memo: `Gateway cross-chain transfer: ${amount} USDC from ${sourceChain.label} to ${destinationChain.label}`,
    });

    return NextResponse.json({
      challengeId: response.data?.challengeId,
      burnIntent,
    });
  } catch (error) {
    return circleErrorResponse(error);
  }
}
