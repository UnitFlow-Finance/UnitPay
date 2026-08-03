"use client";

import Link from "next/link";
import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { apiPost } from "@/lib/api";
import { DEFAULT_SELECTOR_CHAINS, getChain } from "@/lib/chains/config";
import { useCircleSdk } from "@/lib/circle/sdkContext";
import { useGatewayBalance } from "@/lib/useGatewayBalance";
import { useWallet } from "@/lib/useWallet";
import { allocateSourceChains, type AllocationLeg } from "@/lib/gateway/allocate";
import { sendGatewayUsdcLeg } from "@/lib/gateway/transferClient";
import { walletForChainKey } from "@/lib/wallet/selectors";
import { formatCompactBalance } from "@/lib/wallet/balances";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Input";
import { AddressQrScanner } from "@/components/AddressQrScanner";

type PanelMode = "overview" | "deposit" | "send";

/**
 * Gateway "unified balance" screen — Arc App Kit style.
 *
 * Per the product brief: the user should never have to pick a "from chain"
 * when sending. They see ONE balance (aggregated across every testnet
 * chain their wallet holds USDC on) and one "Send" action. Behind the
 * scenes we auto-allocate which of the user's own chains to burn from
 * (see lib/gateway/allocate.ts), preferring the recipient's chain first so
 * same-chain sends never pay a cross-chain hop, then falling back to
 * highest-balance-first — splitting across multiple chains transparently
 * if no single chain covers the full amount.
 *
 * Deposit still needs a source chain, since that's genuinely "which of my
 * external wallets/chains am I adding funds from" — not a bridge step.
 */
export default function UnifiedBalancePage() {
  const { primaryWallet, wallets, loading: walletLoading } = useWallet();
  const gateway = useGatewayBalance(wallets);
  const [mode, setMode] = useState<PanelMode>("overview");

  if (walletLoading) {
    return (
      <main className="min-h-full flex items-center justify-center">
        <p className="text-muted">Loading...</p>
      </main>
    );
  }

  if (!primaryWallet) {
    return (
      <main className="min-h-full flex items-center justify-center px-6">
        <p className="text-muted text-sm">No wallet found.</p>
      </main>
    );
  }

  return (
    <main className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8 max-w-md md:max-w-3xl mx-auto w-full space-y-6">
      <PageHeader title="Unified balance" backHref="/wallet" />

      <div className="grid md:grid-cols-5 gap-6">
        <div className="md:col-span-2 space-y-6">
          <Card className="space-y-1.5">
            <p className="text-xs text-muted uppercase tracking-wide">
              One balance, every testnet chain
            </p>
            <p className="text-3xl sm:text-4xl font-semibold tracking-tight">
              {gateway.loading ? "…" : formatCompactBalance(gateway.total)}{" "}
              <span className="text-lg text-muted font-medium">USDC</span>
            </p>
            <button
              onClick={() => gateway.refresh()}
              className="flex items-center gap-1 text-xs text-accent hover:text-primary transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
          </Card>

          {gateway.error && <p className="text-error text-sm">{gateway.error}</p>}

          {gateway.perChain.length > 0 && (
            <Card padded={false} className="divide-y divide-border">
              {gateway.perChain
                .filter((b) => Number(b.balance) > 0)
                .map((b) => (
                  <div
                    key={b.chainKey}
                    className="flex justify-between items-center px-4 sm:px-5 py-3 text-sm"
                  >
                    <span>{b.chainLabel}</span>
                    <span className="font-medium">{formatCompactBalance(b.balance)} USDC</span>
                  </div>
                ))}
            </Card>
          )}

          <Link
            href="/wallet/unified/solana"
            className="block text-center text-xs text-muted underline hover:text-foreground transition-colors"
          >
            Looking for Solana Devnet? Read the compatibility notes first →
          </Link>
        </div>

        <div className="md:col-span-3 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Button
              onClick={() => setMode("deposit")}
              variant={mode === "deposit" ? "primary" : "secondary"}
              size="lg"
            >
              Deposit
            </Button>
            <Button
              onClick={() => setMode("send")}
              variant={mode === "send" ? "primary" : "secondary"}
              size="lg"
            >
              Send
            </Button>
          </div>

          {mode === "deposit" && (
            <DepositPanel wallets={wallets} onDone={() => gateway.refresh()} />
          )}
          {mode === "send" && (
            <SendPanel
              wallets={wallets}
              sourceAddress={primaryWallet.address}
              perChain={gateway.perChain}
              onDone={() => gateway.refresh()}
            />
          )}
        </div>
      </div>
    </main>
  );
}

function DepositPanel({
  wallets,
  onDone,
}: {
  wallets: { id: string; address: string; blockchain: string }[];
  onDone: () => void;
}) {
  const { executeChallenge } = useCircleSdk();
  const [chainKey, setChainKey] = useState<string>(DEFAULT_SELECTOR_CHAINS[0]);
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<"idle" | "approving" | "depositing" | "done" | "error">(
    "idle",
  );
  const [message, setMessage] = useState<string | null>(null);

  async function handleDeposit() {
    setStatus("approving");
    setMessage("Approving Gateway to spend your USDC...");
    try {
      const userToken = window.localStorage.getItem("unitpay.userToken");
      if (!userToken) throw new Error("Session expired — please reload.");
      const sourceWallet = walletForChainKey(wallets, chainKey);
      if (!sourceWallet) {
        throw new Error(`Create a ${getChain(chainKey).label} wallet before depositing from that chain.`);
      }

      const { challengeId: approveChallengeId } = await apiPost<{ challengeId: string }>(
        "/api/gateway/deposit",
        { userToken, walletId: sourceWallet.id, chainKey, amount },
      );
      await executeChallenge(approveChallengeId);

      setStatus("depositing");
      setMessage("Depositing into your unified balance...");
      const { challengeId: depositChallengeId } = await apiPost<{ challengeId: string }>(
        "/api/gateway/deposit-confirm",
        { userToken, walletId: sourceWallet.id, chainKey, amount },
      );
      await executeChallenge(depositChallengeId);

      setStatus("done");
      setMessage("Deposit submitted. It may take a few seconds to reflect above.");
      onDone();
    } catch (err) {
      setStatus("error");
      setMessage((err as Error).message ?? String(err));
    }
  }

  return (
    <Card className="space-y-3">
      <Field label="Deposit from">
        <Select value={chainKey} onChange={(e) => setChainKey(e.target.value)}>
          {DEFAULT_SELECTOR_CHAINS.filter((k) => getChain(k).family === "evm").map((key) => (
            <option key={key} value={key}>
              {getChain(key).label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Amount (USDC)">
        <Input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
          inputMode="decimal"
        />
      </Field>
      <Button
        onClick={handleDeposit}
        disabled={status === "approving" || status === "depositing" || !amount}
        fullWidth
      >
        {status === "approving" || status === "depositing" ? "Working..." : "Deposit"}
      </Button>
      {message && (
        <p className={`text-xs ${status === "error" ? "text-error" : "text-muted"}`}>{message}</p>
      )}
    </Card>
  );
}

interface PerChainBalance {
  chainKey: string;
  chainLabel: string;
  balance: string;
}

function SendPanel({
  wallets,
  sourceAddress,
  perChain,
  onDone,
}: {
  wallets: { id: string; address: string; blockchain: string }[];
  sourceAddress: string;
  perChain: PerChainBalance[];
  onDone: () => void;
}) {
  const { executeChallenge } = useCircleSdk();
  const [destinationChainKey, setDestinationChainKey] = useState<string>(
    DEFAULT_SELECTOR_CHAINS[0],
  );
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [sourceMode, setSourceMode] = useState<"unified" | "chain">("unified");
  const [sourceChainKey, setSourceChainKey] = useState<string>(DEFAULT_SELECTOR_CHAINS[0]);
  const [status, setStatus] = useState<
    "idle" | "allocating" | "sending" | "done" | "error"
  >("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [legProgress, setLegProgress] = useState<{ done: number; total: number } | null>(null);

  const evmChainKeys = DEFAULT_SELECTOR_CHAINS.filter((k) => getChain(k).family === "evm");

  function walletForChain(chainKey: string) {
    const chain = getChain(chainKey);
    const exact = wallets.find((wallet) => wallet.blockchain === chain.circleBlockchain);
    if (exact) return exact;
    if (chain.circleBlockchain === "EVM-TESTNET") {
      return wallets.find((wallet) => wallet.blockchain === "EVM-TESTNET") ?? null;
    }
    return null;
  }

  async function sendOneLeg(userToken: string, leg: AllocationLeg) {
    const recipientAddress = recipient.trim() || sourceAddress;
    const sourceWallet = walletForChain(leg.chainKey);
    const destinationWallet = walletForChain(destinationChainKey);
    if (!sourceWallet || !destinationWallet) {
      throw new Error(
        "Enable wallets for the source and destination chains before sending from Gateway.",
      );
    }
    await sendGatewayUsdcLeg({
      userToken,
      sourceWalletId: sourceWallet.id,
      destinationWalletId: destinationWallet.id,
      sourceChainKey: leg.chainKey,
      destinationChainKey,
      sourceAddress: sourceWallet.address,
      recipientAddress,
      amount: leg.amount,
      executeChallenge,
    });
  }

  async function handleSend() {
    setStatus("allocating");
    setMessage("Finding the best chain(s) to send from...");
    setLegProgress(null);
    try {
      const userToken = window.localStorage.getItem("unitpay.userToken");
      if (!userToken) throw new Error("Session expired — please reload.");

      const balances = perChain.map((b) => ({ chainKey: b.chainKey, balance: b.balance }));
      const legs =
        sourceMode === "unified"
          ? allocateSourceChains(balances, amount, destinationChainKey)
          : allocateSourceChains(
              balances.filter((b) => b.chainKey === sourceChainKey),
              amount,
              sourceChainKey,
            );

      setStatus("sending");
      setLegProgress({ done: 0, total: legs.length });

      for (let i = 0; i < legs.length; i++) {
        const leg = legs[i];
        setMessage(
          legs.length > 1
            ? `Sending ${leg.amount} USDC from ${getChain(leg.chainKey).label} (${i + 1}/${legs.length})...`
            : `Authorize the send from ${getChain(leg.chainKey).label} in the secure Circle popup...`,
        );
        await sendOneLeg(userToken, leg);
        setLegProgress({ done: i + 1, total: legs.length });
      }

      setStatus("done");
      setMessage("Send complete.");
      onDone();
    } catch (err) {
      setStatus("error");
      setMessage((err as Error).message ?? String(err));
    }
  }

  const isWorking = status === "allocating" || status === "sending";

  return (
    <Card className="space-y-3">
      <p className="text-xs text-muted">
        Send from Gateway. Use unified balance to draw automatically across chains, or choose
        a specific source chain when you want exact control.
      </p>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setSourceMode("unified")}
          className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${
            sourceMode === "unified"
              ? "border-primary bg-primary/10 text-primary"
              : "border-border text-muted hover:border-primary/40"
          }`}
        >
          Unified balance
        </button>
        <button
          type="button"
          onClick={() => setSourceMode("chain")}
          className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${
            sourceMode === "chain"
              ? "border-primary bg-primary/10 text-primary"
              : "border-border text-muted hover:border-primary/40"
          }`}
        >
          Specific chain
        </button>
      </div>

      {sourceMode === "chain" && (
        <Field label="Send from">
          <Select value={sourceChainKey} onChange={(e) => setSourceChainKey(e.target.value)}>
            {evmChainKeys.map((key) => (
              <option key={key} value={key}>
                {getChain(key).label}
              </option>
            ))}
          </Select>
        </Field>
      )}

      <Field label="Recipient address (defaults to your own wallet)">
        <Input
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          placeholder={sourceAddress}
          className="font-mono"
        />
      </Field>
      <AddressQrScanner onValue={setRecipient} />

      <Field label="Deliver on">
        <Select
          value={destinationChainKey}
          onChange={(e) => setDestinationChainKey(e.target.value)}
        >
          {evmChainKeys.map((key) => (
            <option key={key} value={key}>
              {getChain(key).label}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Amount (USDC)">
        <Input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
          inputMode="decimal"
        />
      </Field>

      <Button onClick={handleSend} disabled={isWorking || !amount} fullWidth>
        {isWorking
          ? legProgress && legProgress.total > 1
            ? `Sending (${legProgress.done}/${legProgress.total})...`
            : "Working..."
          : "Send"}
      </Button>

      {message && (
        <p className={`text-xs ${status === "error" ? "text-error" : "text-muted"}`}>{message}</p>
      )}
    </Card>
  );
}
