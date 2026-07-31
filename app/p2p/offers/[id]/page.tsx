"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { apiPost } from "@/lib/api";
import { useCircleSdk } from "@/lib/circle/sdkContext";
import { createP2PTradeRemote, getP2POfferRemote } from "@/lib/p2p/client";
import { waitForP2PTradeId } from "@/lib/p2p/contract";
import { customerActionLabel, merchantActionLabel, type P2POffer, type P2PTrade } from "@/lib/p2p/types";
import { encodeUnitPayQr } from "@/lib/platform/qr";
import { usdcToBaseUnits } from "@/lib/units";
import { useWallet } from "@/lib/useWallet";
import { walletForChainKey } from "@/lib/wallet/selectors";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Input";

export default function P2POfferDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { wallets, primaryWallet } = useWallet();
  const { executeChallenge } = useCircleSdk();
  const [offer, setOffer] = useState<P2POffer | null>(null);
  const [amount, setAmount] = useState("");
  const [escrowMode, setEscrowMode] = useState<P2PTrade["escrowMode"]>("automatic");
  const [message, setMessage] = useState<string | null>(null);
  const arcWallet = walletForChainKey(wallets, "arcTestnet");

  useEffect(() => {
    const timeout = window.setTimeout(async () => {
      setOffer(await getP2POfferRemote(id));
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [id]);

  async function startTrade() {
    if (!primaryWallet || !offer) return;
    try {
      const numericAmount = Number(amount);
      if (!amount || Number.isNaN(numericAmount) || numericAmount <= 0) {
        throw new Error("Enter a valid trade amount.");
      }
      if (numericAmount < Number(offer.minAmount) || numericAmount > Number(offer.maxAmount)) {
        throw new Error(`Amount must be between ${offer.minAmount} and ${offer.maxAmount} ${offer.asset}.`);
      }
      if (numericAmount > Number(offer.availableAmount)) {
        throw new Error(`Only ${offer.availableAmount} ${offer.asset} is currently available for this offer.`);
      }
      if (offer.status !== "Active") {
        throw new Error("This offer is not active.");
      }
      if (!arcWallet) throw new Error("Create an Arc Testnet wallet before starting this trade.");
      if (!offer.onChainOfferId) throw new Error("This offer is missing its on-chain offer id.");
      const userToken = window.localStorage.getItem("unitpay.userToken");
      if (!userToken) throw new Error("Session expired — please reload.");
      const takerLocksFunds = offer.side === "buy";
      if (takerLocksFunds) {
        setMessage("Approving P2P escrow to lock your USDC for sale...");
        const { challengeId: approveChallengeId } = await apiPost<{ challengeId: string }>(
          "/api/p2p/onchain",
          {
            action: "approve",
            userToken,
            walletId: arcWallet.id,
            chainKey: offer.chainKey ?? "arcTestnet",
            amount,
          },
        );
        await executeChallenge(approveChallengeId);
      }

      setMessage("Starting on-chain P2P trade...");
      const { challengeId: startChallengeId } = await apiPost<{ challengeId: string }>(
        "/api/p2p/onchain",
        {
          action: "start-trade",
          userToken,
          walletId: arcWallet.id,
          chainKey: offer.chainKey ?? "arcTestnet",
          onChainOfferId: offer.onChainOfferId,
          amount,
          takerLocksFunds,
        },
      );
      await executeChallenge(startChallengeId);

      setMessage("Confirming on-chain trade. This can take up to a minute after wallet approval...");
      const buyer = offer.side === "sell" ? arcWallet.address : offer.creatorWalletId;
      const seller = offer.side === "sell" ? offer.creatorWalletId : arcWallet.address;
      const onChainTradeId = await waitForP2PTradeId({
        chainKey: offer.chainKey ?? "arcTestnet",
        offerId: BigInt(offer.onChainOfferId),
        buyer: buyer as `0x${string}`,
        seller: seller as `0x${string}`,
        amountBaseUnits: usdcToBaseUnits(amount),
      });
      if (onChainTradeId === null) {
        throw new Error("Trade was submitted, but UnitPay could not find the on-chain trade event yet. Wait for the transaction to confirm, then refresh and try opening this offer again.");
      }

      const trade = await createP2PTradeRemote({
        offerId: offer.id,
        takerCircleWalletId: primaryWallet.id,
        amount,
        onChainTradeId: onChainTradeId.toString(),
        escrowMode,
        paymentMethod: offer.paymentMethods[0],
      });
      router.push(`/p2p/trades/${trade.id}`);
    } catch (err) {
      setMessage((err as Error).message ?? String(err));
    }
  }

  if (!offer) {
    return (
      <main className="min-h-full flex items-center justify-center px-6">
        <p className="text-muted text-sm">Loading offer...</p>
      </main>
    );
  }

  const qrValue = encodeUnitPayQr({
    kind: "p2p-offer",
    value: offer.id,
    route: `/p2p/offers/${offer.id}`,
    objectType: "p2p-offer",
    objectId: offer.id,
  });

  return (
    <main className="px-4 sm:px-6 py-6 sm:py-8 max-w-md md:max-w-2xl mx-auto w-full space-y-6">
      <PageHeader title={`${customerActionLabel(offer.side)} ${offer.asset}`} backHref="/p2p" />
      <Card className="space-y-4">
        <div className="flex justify-between gap-3">
          <div>
            <p className="text-xs text-muted">Price</p>
            <p className="text-2xl font-semibold">{offer.price} {offer.fiatCurrency}</p>
          </div>
          <div className="bg-white p-2 rounded-xl">
            <QRCodeSVG value={qrValue} size={96} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <Info label="Available" value={`${offer.availableAmount} ${offer.asset}`} />
          <Info label="Limit" value={`${offer.minAmount}-${offer.maxAmount} ${offer.asset}`} />
          <Info label="Merchant is" value={`${merchantActionLabel(offer.side)} ${offer.asset}`} />
          <Info label="Payment" value={offer.paymentMethods.join(", ")} />
          <Info label="Status" value={offer.status} />
          <Info label="Deadline" value={`${offer.paymentTimeLimitMinutes ?? 15} min`} />
          <Info label="KYC" value={offer.kycRequired ? "Required" : "Not required"} />
        </div>
        {offer.merchantId && (
          <Link href={`/p2p/merchants/${offer.merchantId}`} className="text-sm text-accent hover:text-primary">
            View merchant profile
          </Link>
        )}
        {(offer.paymentDetails ?? []).length > 0 && (
          <div className="rounded-xl border border-border p-3 space-y-2">
            <p className="text-sm font-semibold">Merchant payment details</p>
            {(offer.paymentDetails ?? []).map((detail) => (
              <div key={detail.id} className="text-sm space-y-1">
                <p className="font-medium">{detail.label || detail.method}</p>
                <div className="grid sm:grid-cols-2 gap-2">
                  {detail.recipientName && <Info label="Recipient" value={detail.recipientName} />}
                  {detail.accountIdentifier && <Info label="Account/ID" value={detail.accountIdentifier} />}
                  {detail.institutionName && <Info label="Institution" value={detail.institutionName} />}
                  {detail.referenceNote && <Info label="Reference" value={detail.referenceNote} />}
                </div>
                {detail.instructions && <p className="text-xs text-muted whitespace-pre-wrap">{detail.instructions}</p>}
              </div>
            ))}
          </div>
        )}
        <p className="text-sm text-muted whitespace-pre-wrap">{offer.terms}</p>
        <p className="text-xs text-subtle whitespace-pre-wrap">{offer.instructions}</p>
      </Card>
      <Card className="space-y-3">
        <Field label={`Amount (${offer.asset})`}>
          <Input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" />
        </Field>
        <Field label="Escrow mode">
          <Select value={escrowMode} onChange={(event) => setEscrowMode(event.target.value as P2PTrade["escrowMode"])}>
            <option value="automatic">Automatic release</option>
            <option value="ai_arbitrated">AI arbitration</option>
            <option value="manual">Manual dispute resolution</option>
          </Select>
        </Field>
        <Button onClick={startTrade} disabled={!primaryWallet || !amount} fullWidth>
          {customerActionLabel(offer.side)} {offer.asset}
        </Button>
        {message && <p className="text-xs text-muted">{message}</p>}
      </Card>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}
