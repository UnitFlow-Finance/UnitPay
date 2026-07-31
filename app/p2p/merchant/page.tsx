"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PauseCircle, PlayCircle, Save, Star } from "lucide-react";
import { apiPost } from "@/lib/api";
import { useCircleSdk } from "@/lib/circle/sdkContext";
import {
  listP2POffersRemote,
  upsertP2PMerchantRemote,
  updateP2POfferRemote,
} from "@/lib/p2p/client";
import { p2pMetadataHash } from "@/lib/p2p/contract";
import { P2P_PAYMENT_METHODS, merchantActionLabel, type P2PMerchantProfile, type P2POffer } from "@/lib/p2p/types";
import { useWallet } from "@/lib/useWallet";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button, LinkButton } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Input";

export default function P2PMerchantDashboardPage() {
  const { primaryWallet } = useWallet();
  const { executeChallenge } = useCircleSdk();
  const [merchant, setMerchant] = useState<P2PMerchantProfile | null>(null);
  const [offers, setOffers] = useState<P2POffer[]>([]);
  const [displayName, setDisplayName] = useState("UnitPay Merchant");
  const [terms, setTerms] = useState("Fast release after fiat payment is confirmed.");
  const [message, setMessage] = useState<string | null>(null);
  const [liquidityAmounts, setLiquidityAmounts] = useState<Record<string, string>>({});

  async function refresh() {
    if (!primaryWallet) return;
    const params = new URLSearchParams({ merchantId: primaryWallet.id, status: "all" });
    setOffers(await listP2POffersRemote(params));
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [primaryWallet?.id]);

  async function saveProfile(paused = false) {
    if (!primaryWallet) return;
    const updated = await upsertP2PMerchantRemote({
      walletId: primaryWallet.address,
      circleWalletId: primaryWallet.id,
      displayName,
      terms,
      tradingPaused: paused,
      supportedPaymentMethods: [P2P_PAYMENT_METHODS[0], P2P_PAYMENT_METHODS[1]],
      kycStatus: "verified",
    });
    setMerchant(updated);
    setMessage(paused ? "Trading paused." : "Merchant profile saved.");
  }

  async function toggleOffer(offer: P2POffer) {
    const status = offer.status === "Paused" ? "Active" : "Paused";
    await updateOfferOnChain(offer, { status });
    const updated = await updateP2POfferRemote(offer.id, { status });
    setOffers((previous) => previous.map((entry) => (entry.id === offer.id ? updated : entry)));
  }

  async function updateOfferOnChain(
    offer: P2POffer,
    overrides: Partial<Pick<P2POffer, "availableAmount" | "maxAmount" | "status">> & {
      additionalAmount?: string;
    },
  ) {
    if (!primaryWallet || !offer.onChainOfferId) return;
    const userToken = window.localStorage.getItem("unitpay.userToken");
    if (!userToken) throw new Error("Session expired — please reload.");
    const nextAvailable = overrides.availableAmount ?? offer.availableAmount;
    const nextMax = overrides.maxAmount ?? offer.maxAmount;
    const metadataHash = p2pMetadataHash({
      offerId: offer.id,
      onChainOfferId: offer.onChainOfferId,
      creatorCircleWalletId: offer.creatorCircleWalletId,
      side: offer.side,
      asset: offer.asset,
      fiatCurrency: offer.fiatCurrency,
      price: offer.price,
      minAmount: offer.minAmount,
      maxAmount: nextMax,
      availableAmount: nextAvailable,
      paymentMethods: offer.paymentMethods,
      terms: offer.terms,
      instructions: offer.instructions,
      status: overrides.status ?? offer.status,
    });
    const additionalAmount = overrides.additionalAmount ?? "0";
    if (offer.side === "sell" && Number(additionalAmount) > 0) {
      setMessage("Approving additional escrow liquidity...");
      const { challengeId } = await apiPost<{ challengeId: string }>("/api/p2p/onchain", {
        action: "approve",
        userToken,
        walletId: primaryWallet.id,
        chainKey: offer.chainKey ?? "arcTestnet",
        amount: additionalAmount,
      });
      await executeChallenge(challengeId);
    }
    setMessage("Updating offer on-chain...");
    const { challengeId } = await apiPost<{ challengeId: string }>("/api/p2p/onchain", {
      action: "update-offer",
      userToken,
      walletId: primaryWallet.id,
      chainKey: offer.chainKey ?? "arcTestnet",
      onChainOfferId: offer.onChainOfferId,
      side: offer.side,
      price: offer.price,
      minAmount: offer.minAmount,
      maxAmount: nextMax,
      availableAmount: nextAvailable,
      additionalAmount,
      status: overrides.status ?? offer.status,
      metadataHash,
    });
    await executeChallenge(challengeId);
  }

  async function addLiquidity(offer: P2POffer) {
    const amount = liquidityAmounts[offer.id] || "";
    const numeric = Number(amount);
    if (!amount || Number.isNaN(numeric) || numeric <= 0) {
      setMessage("Enter a valid liquidity amount.");
      return;
    }
    if (offer.side !== "sell") {
      setMessage("Only merchant sell offers escrow merchant liquidity. Buy offers lock customer funds when a customer starts a sell trade.");
      return;
    }
    try {
      const nextAvailable = (Number(offer.availableAmount) + numeric).toString();
      const nextMax = Math.max(Number(offer.maxAmount), Number(nextAvailable)).toString();
      await updateOfferOnChain(offer, {
        availableAmount: nextAvailable,
        maxAmount: nextMax,
        status: "Active",
        additionalAmount: amount,
      });
      const updated = await updateP2POfferRemote(offer.id, {
        availableAmount: nextAvailable,
        maxAmount: nextMax,
        totalLiquidity: (Number(offer.totalLiquidity ?? offer.availableAmount) + numeric).toString(),
        status: "Active",
      });
      setOffers((previous) => previous.map((entry) => (entry.id === offer.id ? updated : entry)));
      setLiquidityAmounts((previous) => ({ ...previous, [offer.id]: "" }));
      setMessage("Escrow liquidity added and offer enabled.");
    } catch (error) {
      setMessage((error as Error).message ?? String(error));
    }
  }

  async function closeOffer(offer: P2POffer) {
    if (!primaryWallet) return;
    const userToken = window.localStorage.getItem("unitpay.userToken");
    if (!userToken) {
      setMessage("Session expired — please reload.");
      return;
    }
    if (offer.onChainOfferId) {
      const { challengeId } = await apiPost<{ challengeId: string }>("/api/p2p/onchain", {
        action: "cancel-offer",
        userToken,
        walletId: primaryWallet.id,
        chainKey: offer.chainKey ?? "arcTestnet",
        onChainOfferId: offer.onChainOfferId,
      });
      await executeChallenge(challengeId);
    }
    const updated = await updateP2POfferRemote(offer.id, { status: "Cancelled", availableAmount: "0" });
    setOffers((previous) => previous.map((entry) => (entry.id === offer.id ? updated : entry)));
    setMessage("Offer closed and unused on-chain liquidity returned.");
  }

  return (
    <main className="px-4 sm:px-6 py-6 sm:py-8 max-w-md md:max-w-5xl mx-auto w-full space-y-6">
      <PageHeader title="Merchant Dashboard" backHref="/p2p" />
      <div className="grid md:grid-cols-5 gap-5">
        <Card className="md:col-span-2 space-y-3 h-fit">
          <Field label="Display name">
            <Input value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
          </Field>
          <Field label="Trading terms">
            <Textarea value={terms} onChange={(event) => setTerms(event.target.value)} rows={4} />
          </Field>
          <Button fullWidth disabled={!primaryWallet} onClick={() => saveProfile(false)}>
            <Save className="w-4 h-4" /> Save profile
          </Button>
          <Button fullWidth variant="secondary" disabled={!primaryWallet} onClick={() => saveProfile(true)}>
            Pause trading
          </Button>
          <LinkButton href="/p2p/offers/new" fullWidth>
            Create buy/sell offer
          </LinkButton>
          {message && <p className="text-xs text-muted">{message}</p>}
        </Card>
        <section className="md:col-span-3 space-y-4">
          <Card className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <Info label="Rating" value={`${merchant?.rating ?? 5}/5`} />
            <Info label="Completion" value={`${merchant?.completionRate ?? 100}%`} />
            <Info label="Completed" value={`${merchant?.completedTrades ?? 0}`} />
            <Info label="Volume" value={`${merchant?.totalVolume ?? "0"} USDC`} />
          </Card>
          {offers.length === 0 ? (
            <Card className="text-sm text-muted">No active offers yet.</Card>
          ) : (
            offers.map((offer) => (
              <Card key={offer.id} className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <Link href={`/p2p/offers/${offer.id}`} className="font-medium">
                    {merchantActionLabel(offer.side)} {offer.asset}
                  </Link>
                  <span className="text-xs text-muted">{offer.status}</span>
                </div>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <Info label="Price" value={`${offer.price} ${offer.fiatCurrency}`} />
                  <Info label="Available" value={offer.availableAmount} />
                  <Info label="Limit" value={`${offer.minAmount}-${offer.maxAmount}`} />
                </div>
                {offer.side === "sell" ? (
                  <div className="grid sm:grid-cols-[1fr_auto] gap-2">
                    <Input
                      value={liquidityAmounts[offer.id] ?? ""}
                      onChange={(event) =>
                        setLiquidityAmounts((previous) => ({
                          ...previous,
                          [offer.id]: event.target.value,
                        }))
                      }
                      inputMode="decimal"
                      placeholder={`Add ${offer.asset} escrow liquidity`}
                    />
                    <Button variant="secondary" onClick={() => addLiquidity(offer)}>
                      Add funds
                    </Button>
                  </div>
                ) : (
                  <p className="text-xs text-muted">
                    Customer sell offers lock the customer&apos;s tokens when the trade starts, so no merchant escrow is required.
                  </p>
                )}
                <Button variant="secondary" fullWidth onClick={() => toggleOffer(offer)}>
                  {offer.status === "Paused" ? <PlayCircle className="w-4 h-4" /> : <PauseCircle className="w-4 h-4" />}
                  {offer.status === "Paused" ? "Enable offer" : "Disable offer"}
                </Button>
                <Button variant="ghost" fullWidth onClick={() => closeOffer(offer)}>
                  Close and return liquidity
                </Button>
              </Card>
            ))
          )}
          <Card className="text-sm text-muted flex items-center gap-2">
            <Star className="w-4 h-4 text-primary" /> Merchant ranking uses completion rate, release speed, rating, liquidity, and online status.
          </Card>
        </section>
      </div>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted">{label}</p>
      <p className="font-medium break-words">{value}</p>
    </div>
  );
}
