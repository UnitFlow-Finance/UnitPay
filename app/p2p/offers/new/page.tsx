"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { apiPost } from "@/lib/api";
import { useCircleSdk } from "@/lib/circle/sdkContext";
import { createP2POfferRemote, listP2PPayoutDetailsRemote } from "@/lib/p2p/client";
import { p2pMetadataHash, waitForP2POfferIdByMetadataHash } from "@/lib/p2p/contract";
import { P2P_ASSETS, P2P_FIAT_CURRENCIES, P2P_PAYMENT_METHODS, merchantActionLabel, type P2PCustomerPayoutDetail, type P2POfferSide } from "@/lib/p2p/types";
import { useWallet } from "@/lib/useWallet";
import { walletForChainKey } from "@/lib/wallet/selectors";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button, LinkButton } from "@/components/ui/Button";
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
  const [savedPaymentDetails, setSavedPaymentDetails] = useState<P2PCustomerPayoutDetail[]>([]);
  const [selectedPaymentDetailId, setSelectedPaymentDetailId] = useState("");
  const [timeLimit, setTimeLimit] = useState("15");
  const [instructions, setInstructions] = useState("Send fiat payment using the selected method, then upload proof before the deadline.");
  const [kycRequired, setKycRequired] = useState(false);
  const [terms, setTerms] = useState("");
  const [status, setStatus] = useState<"idle" | "working">("idle");
  const [error, setError] = useState<string | null>(null);
  const arcWallet = walletForChainKey(wallets, "arcTestnet");
  const matchingPaymentDetails = savedPaymentDetails.filter((detail) => detail.method === paymentMethod);
  const defaultPaymentDetail = matchingPaymentDetails.find((detail) => detail.isDefault) ?? matchingPaymentDetails[0];
  const effectiveSelectedPaymentDetailId =
    selectedPaymentDetailId && matchingPaymentDetails.some((detail) => detail.id === selectedPaymentDetailId)
      ? selectedPaymentDetailId
      : defaultPaymentDetail?.id ?? "";

  useEffect(() => {
    if (!primaryWallet?.id) return;
    const timeout = window.setTimeout(async () => {
      const details = await listP2PPayoutDetailsRemote(primaryWallet.id);
      setSavedPaymentDetails(details);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [primaryWallet?.id]);

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
    if (Number(availableAmount) < Number(minAmount)) {
      setError(
        side === "buy"
          ? "Total buy capacity must be at least the minimum trade amount."
          : "Escrow liquidity must be at least the minimum trade amount.",
      );
      return;
    }
    if (asset !== "USDC") {
      setError("On-chain P2P escrow is currently live for USDC on Arc Testnet. Other assets need token deployments before they can custody real funds.");
      return;
    }
    setStatus("working");
    try {
      if (!arcWallet) throw new Error("Create an Arc Testnet wallet before creating an on-chain P2P offer.");
      const selectedPaymentDetail = matchingPaymentDetails.find((detail) => detail.id === effectiveSelectedPaymentDetailId);
      if (side === "sell" && !selectedPaymentDetail) {
        throw new Error(`Add a saved ${paymentMethod} detail before creating a customer buy offer.`);
      }
      const paymentDetails = selectedPaymentDetail
        ? [toOfferPaymentDetail(selectedPaymentDetail)]
        : [];
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
        paymentDetails,
        timeLimit,
        terms,
        instructions,
      });

      if (side === "sell") {
        setError("Approving P2P escrow to lock the USDC you are selling to customers...");
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
      } else {
        setError("Creating a merchant buy offer. No merchant escrow is required; customers lock their USDC when they sell to you.");
      }

      setError(`Creating on-chain P2P offer. Merchant action: ${merchantActionLabel(side).toLowerCase()} ${asset}...`);
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

      setError("Confirming on-chain offer. This can take up to a minute after wallet approval...");
      const onChainOfferId = await waitForP2POfferIdByMetadataHash({
        chainKey: "arcTestnet",
        merchant: arcWallet.address as `0x${string}`,
        metadataHash,
      });
      if (onChainOfferId === null) {
        throw new Error("Offer was submitted, but UnitPay could not find the on-chain offer event yet. Wait for the transaction to confirm, then refresh the merchant dashboard.");
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
        paymentDetails,
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
          <Field label="Merchant action">
            <Select value={side} onChange={(event) => setSide(event.target.value as P2POfferSide)}>
              <option value="buy">Buy crypto from customers</option>
              <option value="sell">Sell crypto to customers</option>
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
          <Field label={side === "buy" ? "Total buy capacity" : "Escrow liquidity"}>
            <Input value={availableAmount} onChange={(event) => setAvailableAmount(event.target.value)} inputMode="decimal" />
          </Field>
        </div>
        <p className="text-xs text-muted">
          This is a merchant offer. If you sell crypto, customers see it as a Buy offer. If
          you buy crypto, customers see it as a Sell offer.
        </p>
        {side === "buy" && (
          <p className="text-xs text-muted">
            Buy offers are fiat-first: total buy capacity is the maximum USDC you are
            willing to buy from customers. You do not escrow crypto now; the customer
            locks their USDC on-chain when they accept your offer.
          </p>
        )}
        <Field label="Payment method">
          <Select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}>
            {P2P_PAYMENT_METHODS.map((entry) => (
              <option key={entry}>{entry}</option>
            ))}
          </Select>
        </Field>
        <div className="space-y-3 rounded-xl border border-border p-3">
          <div>
            <p className="text-sm font-medium">Saved payment detail</p>
            <p className="text-xs text-muted mt-1">
              Customer buy offers attach one of your saved payout/payment details so buyers know where to pay after a trade starts.
            </p>
          </div>
          {side === "sell" ? (
            matchingPaymentDetails.length === 0 ? (
              <div className="space-y-3">
                <p className="text-sm text-muted">
                  No saved {paymentMethod} detail is available. Add one once and reuse it across merchant offers.
                </p>
                <LinkButton href="/p2p/payment-methods" variant="secondary" fullWidth>
                  Add saved payment detail
                </LinkButton>
              </div>
            ) : (
              <>
                <Field label="Attach saved detail">
                  <Select value={effectiveSelectedPaymentDetailId} onChange={(event) => setSelectedPaymentDetailId(event.target.value)}>
                    {matchingPaymentDetails.map((detail) => (
                      <option key={detail.id} value={detail.id}>
                        {detail.label} · {detail.accountIdentifier}{detail.isDefault ? " · Default" : ""}
                      </option>
                    ))}
                  </Select>
                </Field>
                {matchingPaymentDetails
                  .filter((detail) => detail.id === effectiveSelectedPaymentDetailId)
                  .map((detail) => (
                    <div key={detail.id} className="rounded-xl border border-border bg-background p-3 text-sm space-y-1">
                      <p className="font-medium">{detail.label}</p>
                      <p className="text-xs text-muted">{detail.method} · {detail.accountIdentifier}</p>
                      {detail.institutionName && <p className="text-xs text-muted">{detail.institutionName}</p>}
                    </div>
                  ))}
              </>
            )
          ) : (
            <p className="text-sm text-muted">
              Merchant buy offers do not attach your payment details. Customers attach their matching payout detail when they sell USDC to you.
            </p>
          )}
        </div>
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

function toOfferPaymentDetail(detail: P2PCustomerPayoutDetail) {
  return {
    id: detail.id,
    method: detail.method,
    label: detail.label,
    recipientName: detail.recipientName,
    accountIdentifier: detail.accountIdentifier,
    institutionName: detail.institutionName,
    referenceNote: detail.referenceNote,
    instructions: detail.instructions,
  };
}
