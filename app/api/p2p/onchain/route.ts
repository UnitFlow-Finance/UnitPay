import { NextResponse } from "next/server";
import { circleClient, circleConfigured } from "@/lib/circle/client";
import { circleErrorResponse } from "@/lib/circle/apiError";
import { getChain, getP2PMarketplaceForChain } from "@/lib/chains/config";
import { requireUsdcSpendableBalance, requireWalletForBlockchain } from "@/lib/circle/transactionGuards";
import { p2pEvidenceHash, P2P_OFFER_SIDE_ONCHAIN } from "@/lib/p2p/contract";
import { usdcToBaseUnits } from "@/lib/units";

export async function POST(request: Request) {
  if (!circleConfigured) {
    return NextResponse.json(
      { error: "Circle API key not configured on server" },
      { status: 500 },
    );
  }

  try {
    const body = await request.json();
    const action = String(body.action || "");
    const chainKey = String(body.chainKey || "arcTestnet");
    const chain = getChain(chainKey);
    const marketplace = getP2PMarketplaceForChain(chainKey);
    const userToken = String(body.userToken || "");
    const walletId = String(body.walletId || "");

    if (!userToken || !walletId) {
      return NextResponse.json({ error: "Missing userToken or walletId" }, { status: 400 });
    }
    if (chain.family !== "evm") {
      return NextResponse.json({ error: "P2P on-chain escrow currently supports EVM chains only." }, { status: 400 });
    }

    await requireWalletForBlockchain({
      circleClient,
      userToken,
      walletId,
      blockchain: chain.circleBlockchain,
    });

    const execution = async (abiFunctionSignature: string, abiParameters: string[]) => {
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
        contractAddress: marketplace.address,
        abiFunctionSignature,
        abiParameters,
        fee: { type: "level", config: { feeLevel: "MEDIUM" } },
      });
      return NextResponse.json({ challengeId: response.data?.challengeId });
    };

    if (action === "approve") {
      const amount = String(body.amount || "");
      await requireUsdcSpendableBalance({ circleClient, userToken, walletId, chainKey: chain.key, amount });
      const amountBaseUnits = usdcToBaseUnits(amount).toString();
      const response = await circleClient.createUserTransactionContractExecutionChallenge({
        userToken,
        walletId,
        contractAddress: chain.usdcAddress,
        abiFunctionSignature: "approve(address,uint256)",
        abiParameters: [marketplace.address, amountBaseUnits],
        fee: { type: "level", config: { feeLevel: "MEDIUM" } },
      });
      return NextResponse.json({ challengeId: response.data?.challengeId });
    }

    if (action === "create-offer") {
      const side = body.side === "buy" ? "buy" : "sell";
      const amount = String(body.availableAmount || "");
      if (side === "sell") {
        await requireUsdcSpendableBalance({ circleClient, userToken, walletId, chainKey: chain.key, amount });
      } else {
        await requireUsdcSpendableBalance({
          circleClient,
          userToken,
          walletId,
          chainKey: chain.key,
          requireTransferAmount: false,
        });
      }
      return execution("createOffer(address,uint8,uint256,uint256,uint256,uint256,uint64,bytes32)", [
        chain.usdcAddress,
        String(P2P_OFFER_SIDE_ONCHAIN[side]),
        String(body.priceBaseUnits || usdcToBaseUnits(String(body.price || "0")).toString()),
        usdcToBaseUnits(String(body.minAmount || "")).toString(),
        usdcToBaseUnits(String(body.maxAmount || "")).toString(),
        usdcToBaseUnits(amount).toString(),
        String(Number(body.paymentWindowSeconds || 900)),
        String(body.metadataHash || ""),
      ]);
    }

    if (action === "start-trade") {
      const amount = String(body.amount || "");
      if (body.takerLocksFunds) {
        await requireUsdcSpendableBalance({ circleClient, userToken, walletId, chainKey: chain.key, amount });
      }
      return execution("startTrade(uint256,uint256)", [
        String(body.onChainOfferId),
        usdcToBaseUnits(amount).toString(),
      ]);
    }

    if (action === "cancel-offer") {
      return execution("cancelOffer(uint256)", [String(body.onChainOfferId)]);
    }

    if (action === "mark-paid") {
      return execution("markPaid(uint256,bytes32)", [
        String(body.onChainTradeId),
        p2pEvidenceHash(String(body.evidence || "")),
      ]);
    }

    if (action === "release") {
      return execution("release(uint256)", [String(body.onChainTradeId)]);
    }

    if (action === "cancel-expired") {
      return execution("cancelExpired(uint256)", [String(body.onChainTradeId)]);
    }

    if (action === "dispute") {
      return execution("openDispute(uint256,bytes32)", [
        String(body.onChainTradeId),
        p2pEvidenceHash(String(body.evidence || body.reason || "")),
      ]);
    }

    if (action === "resolve") {
      return execution("resolveDispute(uint256,bool)", [
        String(body.onChainTradeId),
        body.outcome === "refund" ? "false" : "true",
      ]);
    }

    return NextResponse.json({ error: "Unsupported P2P on-chain action" }, { status: 400 });
  } catch (error) {
    return circleErrorResponse(error);
  }
}
