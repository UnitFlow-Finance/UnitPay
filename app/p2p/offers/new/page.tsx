"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { apiPost } from "@/lib/api";
import { useCircleSdk } from "@/lib/circle/sdkContext";
import { createP2POfferRemote } from "@/lib/p2p/client";
import { findP2POfferIdByMetadataHash, p2pMetadataHash } from "@/lib/p2p/contract";
import { P2P_ASSETS, P2P_FIAT_CURRENCIES, P2P_PAYMENT_METHODS, type P2POfferSide } from "@/lib/p2p/types";
import { useWallet } from "@/lib/useWallet";
import { walletForChainKey } from "@/lib/wallet/selectors";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Input";

export default function NewP2POfferPage() {
  const router = useRouter();
  const { wallets, primaryWallet, loading } = useWallet();
  const { executeChallenge } = useCircleSdk();
  const [side, setSide] = useState<P2POfferSide>("sell");
  const [asset, setAsset] = useState("USDC");
  const [fiatCurrency, setFiatCurrency] = useState("USD");
  const [price, setPrice] = useState("1");
  const [minAmount, setMinAmount] = useState("10");
  const [maxAmount, setMaxAmount] = useState("500");
  const [availableAmount, setAvailableAmount] = useState("500");
  const [paymentMethod, setPaymentMethod] = useState("Bank Transfer");
  const [timeLimit, setTimeLimit] = useState("15");
  const [instructions, setInstructions] = useState("Send fiat payment using the selected method, then upload proof before the deadline.");
  const [kycRequired, setKycRequired] = useState(false);
  const [terms, setTerms] = useState("");
  const [status, setStatus] = useState<"idle" | "working">("idle");
  const [error, setError] = useState<string | null>(null);
  const arcWallet = walletForChainKey(wallets, "arcTestnet");

  async function handleCreate() {
    if (!primaryWallet) return;
    setError(null);
    const numericFields = [
      ["price", price],
      ["minimum amount", minAmount],
      ["maximum amount", maxAmount],
      ["available amount", availableAmount],
    ] as const;
    for (const [label, value] of numericFields) {
      const numeric = Number(value);
      if (!value || Number.isNaN(numeric) || numeric <= 0) {
        setError(`Enter a valid ${label}.`);
        return;
      }
    }
    if (Number(minAmount) > Number(maxAmount)) {
      setError("Minimum amount cannot exceed maximum amount.");
      return;
    }
    if (asset !== "USDC") {
      setError("On-chain P2P escrow is currently live for USDC on Arc Testnet. Other assets need token deployments before they can custody real funds.");
      return;
    }
    setStatus("working");
    try {
      if (!arcWallet) throw new Error("Create an Arc Testnet wallet before creating an on-chain P2P offer.");
      const userToken = window.localStorage.getItem("unitpay.userToken");
      if (!userToken) throw new Error("Session expired — please reload.");
      const metadataHash = p2pMetadataHash({
        creatorCircleWalletId: primaryWallet.id,
        side,
        asset,
        fiatCurrency,
        price,
        minAmount,
        maxAmount,
        availableAmount,
        paymentMethod,
        timeLimit,
        terms,
        instructions,
      });

      if (side === "sell") {
        setError("Approving P2P escrow to lock merchant liquidity...");
        const { challengeId: approveChallengeId } = await apiPost<{ challengeId: string }>(
          "/api/p2p/onchain",
          {
            action: "approve",
            userToken,
            walletId: arcWallet.id,
            chainKey: "arcTestnet",
            amount: availableAmount,
          },
        );
        await executeChallenge(approveChallengeId);
      }

      setError("Creating on-chain P2P offer...");
      const { challengeId: createChallengeId } = await apiPost<{ challengeId: string }>(
        "/api/p2p/onchain",
        {
          action: "create-offer",
          userToken,
          walletId: arcWallet.id,
          chainKey: "arcTestnet",
          side,
          price,
          minAmount,
          maxAmount,
          availableAmount,
          paymentWindowSeconds: Number(timeLimit) * 60,
          metadataHash,
        },
      );
      await executeChallenge(createChallengeId);

      setError("Confirming on-chain offer...");
      const onChainOfferId = await findP2POfferIdByMetadataHash({
        chainKey: "arcTestnet",
        merchant: arcWallet.address as `0x${string}`,
        metadataHash,
      });
      if (onChainOfferId === null) {
        throw new Error("Offer was submitted, but UnitPay could not find the on-chain offer event yet. Refresh and try again.");
      }

      const offer = await createP2POfferRemote({
        creatorWalletId: arcWallet.address,
        creatorCircleWalletId: primaryWallet.id,
        chainKey: "arcTestnet",
        onChainOfferId: onChainOfferId.toString(),
        side,
        asset,
        fiatCurrency,
        price,
        minAmount,
        maxAmount,
        availableAmount,
        paymentMethods: [paymentMethod],
        paymentTimeLimitMinutes: Number(timeLimit),
        instructions,
        kycRequired,
        terms,
      });
      router.push(`/p2p/offers/${offer.id}`);
    } catch (err) {
      setError((err as Error).message ?? String(err));
      setStatus("idle");
    }
  }

  if (loading) {
    return (
      <main className="min-h-full flex items-center justify-center px-6">
        <p className="text-muted text-sm">Loading wallet...</p>
      </main>
    );
  }

  if (!primaryWallet) {
    return (
      <main className="min-h-full flex items-center justify-center px-6">
        <div className="text-center space-y-3">
          <p className="text-muted text-sm">Create or log into a wallet before creating P2P offers.</p>
          <Link href="/onboarding/wallet" className="text-accent text-sm underline">
            Set up wallet
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="px-4 sm:px-6 py-6 sm:py-8 max-w-md md:max-w-2xl mx-auto w-full space-y-6">
      <PageHeader title="Create P2P Offer" backHref="/p2p" />
      <Card className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Side">
            <Select value={side} onChange={(event) => setSide(event.target.value as P2POfferSide)}>
              <option value="buy">Buy</option>
              <option value="sell">Sell</option>
            </Select>
          </Field>
          <Field label="Asset">
            <Select value={asset} onChange={(event) => setAsset(event.target.value)}>
              {P2P_ASSETS.map((entry) => (
                <option key={entry}>{entry}</option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Fiat">
            <Select value={fiatCurrency} onChange={(event) => setFiatCurrency(event.target.value)}>
              {P2P_FIAT_CURRENCIES.map((entry) => (
                <option key={entry}>{entry}</option>
              ))}
            </Select>
          </Field>
          <Field label="Price">
            <Input value={price} onChange={(event) => setPrice(event.target.value)} inputMode="decimal" />
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Min">
            <Input value={minAmount} onChange={(event) => setMinAmount(event.target.value)} inputMode="decimal" />
          </Field>
          <Field label="Max">
            <Input value={maxAmount} onChange={(event) => setMaxAmount(event.target.value)} inputMode="decimal" />
          </Field>
          <Field label="Available">
            <Input value={availableAmount} onChange={(event) => setAvailableAmount(event.target.value)} inputMode="decimal" />
          </Field>
        </div>
        <Field label="Payment method">
          <Select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}>
            {P2P_PAYMENT_METHODS.map((entry) => (
              <option key={entry}>{entry}</option>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Payment deadline (minutes)">
            <Input value={timeLimit} onChange={(event) => setTimeLimit(event.target.value)} inputMode="numeric" />
          </Field>
          <label className="flex items-end gap-2 text-sm text-muted pb-2">
            <input type="checkbox" checked={kycRequired} onChange={(event) => setKycRequired(event.target.checked)} />
            KYC required
          </label>
        </div>
        <Field label="Automatic instructions">
          <Textarea value={instructions} onChange={(event) => setInstructions(event.target.value)} rows={3} />
        </Field>
        <Field label="Terms">
          <Textarea value={terms} onChange={(event) => setTerms(event.target.value)} rows={4} />
        </Field>
        {error && <p className="text-error text-sm">{error}</p>}
        <Button onClick={handleCreate} size="lg" fullWidth disabled={status === "working"}>
          {status === "working" ? "Creating..." : "Create offer"}
        </Button>
      </Card>
    </main>
  );
}
