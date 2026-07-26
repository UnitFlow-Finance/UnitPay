"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiPost } from "@/lib/api";
import { getChain } from "@/lib/chains/config";
import { chainKeyForBlockchain } from "@/lib/chains/lookup";
import { useCircleSdk } from "@/lib/circle/sdkContext";
import { useWallet } from "@/lib/useWallet";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";

type Step = "form" | "confirm" | "working" | "done" | "error";

/**
 * Same-chain P2P send (Section 1: "P2P transfer between UnitPay users on
 * the same chain"). External-address sends use the same Circle transaction
 * flow — Circle Wallets doesn't distinguish "UnitPay user" vs "any address"
 * at the transfer-execution layer; that distinction only matters for
 * cross-chain routing (see /wallet/unified for the Gateway path).
 */
export default function SendPage() {
  const router = useRouter();
  const { primaryWallet, balances, refresh } = useWallet();
  const { executeChallenge } = useCircleSdk();

  const [destination, setDestination] = useState("");
  const [amount, setAmount] = useState("");
  const [step, setStep] = useState<Step>("form");
  const [error, setError] = useState<string | null>(null);

  if (!primaryWallet) {
    return (
      <main className="min-h-full flex items-center justify-center px-6">
        <p className="text-muted text-sm">No wallet found.</p>
      </main>
    );
  }

  const chainKey = chainKeyForBlockchain(primaryWallet.blockchain);
  const chain = getChain(chainKey);
  const usdcBalance =
    balances.find((b) => b.token.symbol === "USDC" || b.token.isNative === chain.usdcIsNativeGas)
      ?.amount ?? "0";

  function validateForm(): string | null {
    if (!destination.trim()) return "Enter a destination address.";
    if (chain.family === "evm" && !/^0x[a-fA-F0-9]{40}$/.test(destination.trim())) {
      return "That doesn't look like a valid EVM address.";
    }
    const amt = Number(amount);
    if (!amount || Number.isNaN(amt) || amt <= 0) return "Enter a valid amount.";
    if (amt > Number(usdcBalance)) return "Amount exceeds your available balance.";
    return null;
  }

  function handleContinue() {
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setStep("confirm");
  }

  async function handleConfirmSend() {
    setStep("working");
    setError(null);
    try {
      const userToken = window.localStorage.getItem("unitpay.userToken");
      if (!userToken) throw new Error("Session expired — please reload.");

      const { challengeId } = await apiPost<{ challengeId: string }>("/api/wallet/transfer", {
        userToken,
        walletId: primaryWallet!.id,
        destinationAddress: destination.trim(),
        amount,
        tokenAddress: chain.usdcIsNativeGas ? "" : chain.usdcAddress,
        blockchain: primaryWallet!.blockchain,
      });

      if (!challengeId) throw new Error("No challenge returned from server.");

      await executeChallenge(challengeId);
      setStep("done");
      refresh();
    } catch (err) {
      setError((err as Error).message ?? String(err));
      setStep("error");
    }
  }

  return (
    <main className="px-4 sm:px-6 py-6 sm:py-8 max-w-md md:max-w-lg mx-auto w-full space-y-6">
      <PageHeader title="Send USDC" backHref="/wallet" />

      {step === "form" && (
        <div className="space-y-4">
          <Card className="text-sm text-muted">
            Sending on <span className="text-foreground font-medium">{chain.label}</span>.
            Available: {usdcBalance} USDC.
          </Card>

          <Field label="Destination address">
            <Input
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="0x..."
              className="font-mono"
            />
          </Field>

          <Field label="Amount (USDC)">
            <Input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              inputMode="decimal"
            />
          </Field>

          {error && <p className="text-error text-sm">{error}</p>}

          <Button onClick={handleContinue} size="lg" fullWidth>
            Continue
          </Button>

          <p className="text-xs text-muted">
            Sending to a different chain, or to an address that isn&apos;t on{" "}
            {chain.label}? Use{" "}
            <Link href="/wallet/unified" className="text-accent underline">
              cross-chain send
            </Link>{" "}
            instead.
          </p>
        </div>
      )}

      {step === "confirm" && (
        <div className="space-y-4">
          <Card className="space-y-3">
            <ConfirmRow label="Network" value={chain.label} />
            <ConfirmRow
              label="To"
              value={`${destination.slice(0, 10)}…${destination.slice(-6)}`}
              mono
            />
            <ConfirmRow label="Amount" value={`${amount} USDC`} />
          </Card>
          <p className="text-xs text-warning">
            Double-check the destination address and network — on-chain transfers cannot be
            reversed.
          </p>
          <div className="flex gap-3">
            <Button onClick={() => setStep("form")} variant="secondary" size="lg" fullWidth>
              Edit
            </Button>
            <Button onClick={handleConfirmSend} size="lg" fullWidth>
              Confirm &amp; send
            </Button>
          </div>
        </div>
      )}

      {step === "working" && (
        <p className="text-muted text-sm text-center py-8">
          Approve this transfer with your PIN in the popup...
        </p>
      )}

      {step === "done" && (
        <div className="space-y-4 text-center py-6">
          <p className="text-success font-medium">Transfer submitted</p>
          <p className="text-muted text-sm">
            {amount} USDC sent to {destination.slice(0, 10)}…{destination.slice(-6)} on{" "}
            {chain.label}.
          </p>
          <Button onClick={() => router.push("/wallet")} size="lg" fullWidth>
            Back to wallet
          </Button>
        </div>
      )}

      {step === "error" && (
        <div className="space-y-4 text-center py-6">
          <p className="text-error font-medium">Transfer failed</p>
          <p className="text-muted text-sm">{error}</p>
          <Button onClick={() => setStep("form")} variant="secondary" size="lg" fullWidth>
            Try again
          </Button>
        </div>
      )}
    </main>
  );
}

function ConfirmRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted">{label}</span>
      <span className={mono ? "font-mono" : "font-medium"}>{value}</span>
    </div>
  );
}
