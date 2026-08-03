"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiPost } from "@/lib/api";
import { getChain } from "@/lib/chains/config";
import { chainKeyForBlockchain } from "@/lib/chains/lookup";
import {
  chainSupportsCirclePaymaster,
  circlePaymasterEnabled,
  hasNativeGasBalance,
  nativeGasBalance,
  type SendFeeMode,
  walletSupportsCirclePaymaster,
} from "@/lib/circle/paymaster";
import { useCircleSdk } from "@/lib/circle/sdkContext";
import { useWallet } from "@/lib/useWallet";
import {
  tokenAmount,
  displayTokenBalances,
  formatCompactBalance,
  tokenSymbol,
  uniqueTokenKey,
  walletChainLabel,
} from "@/lib/wallet/balances";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Input";
import { AddressQrScanner } from "@/components/AddressQrScanner";

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
  const { primaryWallet, wallets, walletBalances, refresh } = useWallet();
  const { executeChallenge } = useCircleSdk();

  const [selectedWalletId, setSelectedWalletId] = useState("");
  const [selectedTokenKey, setSelectedTokenKey] = useState("");
  const [destination, setDestination] = useState("");
  const [amount, setAmount] = useState("");
  const [feeMode, setFeeMode] = useState<SendFeeMode>("native");
  const [step, setStep] = useState<Step>("form");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const recipient = new URLSearchParams(window.location.search).get("recipient");
      if (recipient) setDestination(recipient);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (!selectedWalletId && walletBalances.length > 0) {
      const timeout = window.setTimeout(
        () => setSelectedWalletId(walletBalances[0].wallet.id),
        0,
      );
      return () => window.clearTimeout(timeout);
    }
  }, [selectedWalletId, walletBalances]);

  const selectedGroup =
    walletBalances.find((group) => group.wallet.id === selectedWalletId) ?? walletBalances[0];
  const selectedBalances = displayTokenBalances(
    selectedGroup?.tokenBalances ?? [],
    selectedGroup?.wallet.blockchain,
  );
  const selectedToken =
    selectedBalances.find((balance) => uniqueTokenKey(balance) === selectedTokenKey) ??
    selectedBalances.find((balance) => tokenSymbol(balance) === "USDC") ??
    selectedBalances[0];
  const wallet = selectedGroup?.wallet ?? primaryWallet;
  const chainKey = wallet ? chainKeyForBlockchain(wallet.blockchain) : "arcTestnet";
  const selectedChain = getChain(chainKey);
  const selectedSymbol = selectedToken ? tokenSymbol(selectedToken) : "TOKEN";
  const availableAmount = selectedToken ? tokenAmount(selectedToken) : 0;
  const nativeGas = nativeGasBalance(selectedGroup?.tokenBalances ?? []);
  const hasNativeGas = hasNativeGasBalance(selectedGroup?.tokenBalances ?? []);
  const paymasterAvailable =
    circlePaymasterEnabled() &&
    chainSupportsCirclePaymaster(chainKey) &&
    walletSupportsCirclePaymaster(wallet) &&
    selectedSymbol === "USDC";
  const paymasterHiddenReason =
    circlePaymasterEnabled() &&
    chainSupportsCirclePaymaster(chainKey) &&
    selectedSymbol === "USDC" &&
    !walletSupportsCirclePaymaster(wallet)
      ? "Circle Paymaster requires an SCA wallet. Google social-login wallets use SCA; this wallet uses normal native gas."
      : null;

  useEffect(() => {
    if (selectedToken && uniqueTokenKey(selectedToken) !== selectedTokenKey) {
      const timeout = window.setTimeout(
        () => setSelectedTokenKey(uniqueTokenKey(selectedToken)),
        0,
      );
      return () => window.clearTimeout(timeout);
    }
  }, [selectedToken, selectedTokenKey]);

  useEffect(() => {
    if (
      (feeMode === "paymaster" && !paymasterAvailable) ||
      (feeMode === "native" && paymasterAvailable)
    ) {
      const timeout = window.setTimeout(
        () => setFeeMode(paymasterAvailable ? "paymaster" : "native"),
        0,
      );
      return () => window.clearTimeout(timeout);
    }
  }, [feeMode, paymasterAvailable]);

  if (!primaryWallet) {
    return (
      <main className="min-h-full flex items-center justify-center px-6">
        <p className="text-muted text-sm">No wallet found.</p>
      </main>
    );
  }

  if (!selectedGroup) {
    return (
      <main className="min-h-full flex items-center justify-center px-6">
        <p className="text-muted text-sm">Loading chain balances...</p>
      </main>
    );
  }

  function validateForm(): string | null {
    if (!destination.trim()) return "Enter a destination.";
    if (
      !wallets.some((entry) => entry.id === destination.trim()) &&
      wallet.blockchain !== "SOL-DEVNET" &&
      !/^0x[a-fA-F0-9]{40}$/.test(destination.trim())
    ) {
      return "Enter a raw EVM address or a Circle Wallet ID known to this account.";
    }
    const amt = Number(amount);
    if (!amount || Number.isNaN(amt) || amt <= 0) return "Enter a valid amount.";
    if (!selectedToken) return "Select a token balance to send.";
    if (amt > availableAmount) return "Amount exceeds your available balance.";
    if (feeMode === "paymaster" && !paymasterAvailable) {
      return "Circle Paymaster is not available for this token and chain.";
    }
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
        walletId: wallet.id,
        destinationAddress:
          wallets.find((entry) => entry.id === destination.trim())?.address ?? destination.trim(),
        amount,
        tokenAddress: selectedToken?.token.isNative ? "" : selectedToken?.token.tokenAddress,
        blockchain: wallet.blockchain,
        feeMode,
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
      <PageHeader title="Send Tokens" backHref="/wallet" />

      {step === "form" && (
        <div className="space-y-4">
          <Card className="text-sm text-muted">
            Sending from{" "}
            <span className="text-foreground font-medium">{walletChainLabel(selectedGroup)}</span>.
            Available: {formatCompactBalance(availableAmount)} {selectedSymbol}.
          </Card>

          <Field label="Send from chain">
            <Select
              value={wallet.id}
              onChange={(e) => {
                setSelectedWalletId(e.target.value);
                setSelectedTokenKey("");
              }}
            >
              {walletBalances.map((group) => (
                <option key={group.wallet.id} value={group.wallet.id}>
                  {walletChainLabel(group)}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Token">
            <Select
              value={selectedToken ? uniqueTokenKey(selectedToken) : ""}
              onChange={(e) => setSelectedTokenKey(e.target.value)}
            >
              {selectedBalances.map((balance) => (
                <option key={uniqueTokenKey(balance)} value={uniqueTokenKey(balance)}>
                  {formatCompactBalance(balance.amount)} {tokenSymbol(balance)}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Destination">
            <Input
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="Circle Wallet ID or 0x..."
              className="font-mono"
            />
          </Field>
          <AddressQrScanner onValue={setDestination} />

          <Field label={`Amount (${selectedSymbol})`}>
            <Input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              inputMode="decimal"
            />
          </Field>

          <div className="space-y-2">
            <p className="text-xs text-muted uppercase tracking-wide">Network fee</p>
            <div className="grid gap-2">
              <button
                type="button"
                onClick={() => setFeeMode("native")}
                className={`rounded-xl border px-3 py-3 text-left text-sm transition-colors ${
                  feeMode === "native"
                    ? "border-primary bg-primary/5"
                    : "border-border bg-surface hover:border-primary/40"
                }`}
              >
                <span className="font-medium text-foreground">Normal native gas</span>
                <span className="block text-xs text-muted mt-1">
                  {selectedChain.usdcIsNativeGas
                    ? "Arc uses USDC as native gas."
                    : hasNativeGas
                      ? `Uses your ${formatCompactBalance(nativeGas?.amount ?? 0)} ${
                          nativeGas ? tokenSymbol(nativeGas) : "native"
                        } gas balance.`
                      : "Requires native gas on this chain before the transfer can settle."}
                </span>
              </button>

              {paymasterAvailable && (
                <button
                  type="button"
                  onClick={() => setFeeMode("paymaster")}
                  className={`rounded-xl border px-3 py-3 text-left text-sm transition-colors ${
                    feeMode === "paymaster"
                      ? "border-primary bg-primary/5"
                      : "border-border bg-surface hover:border-primary/40"
                  }`}
                >
                  <span className="font-medium text-foreground">Circle Paymaster</span>
                  <span className="block text-xs text-muted mt-1">
                    Default for Paymaster-ready wallets. Sponsors gas for this USDC send when
                    Circle sponsorship is available.
                  </span>
                </button>
              )}
            </div>
            {paymasterHiddenReason && (
              <p className="text-xs text-muted">{paymasterHiddenReason}</p>
            )}
          </div>

          {error && <p className="text-error text-sm">{error}</p>}

          <Button onClick={handleContinue} size="lg" fullWidth>
            Continue
          </Button>

          <p className="text-xs text-muted">
            Sending to a different destination chain through Gateway? Use{" "}
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
            <ConfirmRow label="Network" value={walletChainLabel(selectedGroup)} />
            <ConfirmRow label="Token" value={selectedSymbol} />
            <ConfirmRow
              label="Fee"
              value={feeMode === "paymaster" ? "Circle Paymaster" : "Normal native gas"}
            />
            <ConfirmRow
              label="To"
              value={`${destination.slice(0, 10)}…${destination.slice(-6)}`}
              mono
            />
            <ConfirmRow label="Amount" value={`${amount} ${selectedSymbol}`} />
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
          Approve this transfer in the secure Circle popup...
        </p>
      )}

      {step === "done" && (
        <div className="space-y-4 text-center py-6">
          <p className="text-success font-medium">Transfer submitted</p>
          <p className="text-muted text-sm">
            {amount} {selectedSymbol} sent to {destination.slice(0, 10)}…{destination.slice(-6)} on{" "}
            {walletChainLabel(selectedGroup)}.
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
