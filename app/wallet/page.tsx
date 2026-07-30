"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Send,
  QrCode,
  Droplets,
  FileText,
  Store,
  RefreshCw,
  Settings,
  ShieldCheck,
  Gift,
  Users,
  HandCoins,
  CreditCard,
  Coins,
  Bot,
  Globe2,
} from "lucide-react";
import { TransactionHistory } from "@/components/TransactionHistory";
import { Card, DashedCard } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Select } from "@/components/ui/Input";
import { apiPost } from "@/lib/api";
import { DEFAULT_SELECTOR_CHAINS, getChain } from "@/lib/chains/config";
import { useCircleSdk } from "@/lib/circle/sdkContext";
import { useGatewayBalance } from "@/lib/useGatewayBalance";
import { useWallet } from "@/lib/useWallet";
import {
  groupTotalBySymbol,
  primaryUsdcBalance,
  displayTokenBalances,
  tokenSymbol,
  walletChainLabel,
} from "@/lib/wallet/balances";

export default function WalletDashboardPage() {
  const router = useRouter();
  const { executeChallenge } = useCircleSdk();
  const { loading, error, wallets, primaryWallet, walletBalances, transactions, userToken, refresh } =
    useWallet();
  const gateway = useGatewayBalance(wallets);
  const [chainToCreate, setChainToCreate] = useState<string>(DEFAULT_SELECTOR_CHAINS[1]);
  const [createStatus, setCreateStatus] = useState<"idle" | "working" | "done" | "error">("idle");
  const [createMessage, setCreateMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && wallets.length === 0 && !error) {
      router.replace("/onboarding/wallet");
    }
  }, [loading, wallets, error, router]);

  if (loading) {
    return (
      <main className="min-h-full flex items-center justify-center">
        <p className="text-muted">Loading wallet...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-full flex flex-col items-center justify-center gap-4 px-6">
        <p className="text-error text-sm text-center">{error}</p>
        <button
          onClick={() => refresh()}
          className="rounded-xl bg-primary hover:bg-primary-dark text-white text-sm font-medium px-4 py-2"
        >
          Retry
        </button>
      </main>
    );
  }

  if (!primaryWallet) {
    return null; // redirecting to /onboarding/wallet
  }

  const actionTiles: {
    href: string;
    label: string;
    icon: typeof Send;
    primary?: boolean;
  }[] = [
    { href: "/wallet/send", label: "Send", icon: Send, primary: true },
    { href: "/wallet/receive", label: "Receive", icon: QrCode },
    { href: "/wallet/faucet", label: "Get USDC", icon: Droplets },
    { href: "/wallet/request", label: "Request", icon: FileText },
    { href: "/merchant", label: "Merchant", icon: Store },
    { href: "/wallet/escrow", label: "Escrow", icon: ShieldCheck },
    { href: "/wallet/packet", label: "Unit Packet", icon: Gift },
    { href: "/wallet/pods", label: "Pods", icon: Users },
    { href: "/p2p", label: "P2P", icon: HandCoins },
    { href: "/wallet/cards", label: "Cards", icon: CreditCard },
    { href: "/wallet/tokens", label: "Tokens", icon: Coins },
    { href: "/wallet/arbitrators", label: "AI Rules", icon: Bot },
    { href: "/qr", label: "QR", icon: QrCode },
  ];
  const totalsBySymbol = groupTotalBySymbol(walletBalances);
  const personalUsdcTotal = totalsBySymbol.USDC ?? 0;
  const existingBlockchains = new Set(wallets.map((wallet) => wallet.blockchain));
  const createChain = getChain(chainToCreate);

  async function handleCreateChainWallet() {
    if (!userToken) return;
    setCreateStatus("working");
    setCreateMessage(`Creating ${createChain.label} wallet...`);
    try {
      const { challengeId } = await apiPost<{ challengeId: string }>("/api/wallet/create", {
        userToken,
        blockchain: createChain.circleBlockchain,
      });
      if (!challengeId) throw new Error("No wallet creation challenge returned.");
      await executeChallenge(challengeId);
      await refresh();
      setCreateStatus("done");
      setCreateMessage(`${createChain.label} wallet created.`);
    } catch (err) {
      setCreateStatus("error");
      setCreateMessage((err as Error).message ?? String(err));
    }
  }

  return (
    <main className="px-3 min-[380px]:px-4 sm:px-6 lg:px-8 py-4 sm:py-8 max-w-none md:max-w-3xl lg:max-w-5xl mx-auto w-full space-y-4 sm:space-y-8">
      <header className="hidden md:flex items-center justify-between">
        <h1 className="text-xl font-semibold">Wallet</h1>
        <Link
          href="/settings"
          className="flex items-center gap-1.5 text-muted hover:text-foreground text-sm transition-colors"
        >
          <Settings className="w-4 h-4" /> Settings
        </Link>
      </header>

      <div className="grid md:grid-cols-5 gap-4 sm:gap-8">
        <div className="md:col-span-3 space-y-4 sm:space-y-8 min-w-0">
          <Link href="/wallet/unified">
            <Card className="space-y-3 hover:border-primary/40 transition-colors p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs text-muted uppercase tracking-wide">Gateway balance</p>
                  <p className="text-[1.75rem] leading-tight sm:text-2xl font-semibold break-words">
                    {gateway.loading ? "..." : gateway.total} USDC
                  </p>
                </div>
                <Globe2 className="w-6 h-6 text-primary shrink-0" />
              </div>
              <div className="grid grid-cols-1 min-[380px]:grid-cols-2 gap-3 text-sm">
                <div className="min-w-0">
                  <p className="text-xs text-muted">Unified Gateway</p>
                  <p className="font-medium">Cross-chain USDC</p>
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted">Personal wallet</p>
                  <p className="font-medium">{personalUsdcTotal.toFixed(2)} USDC</p>
                </div>
              </div>
            </Card>
          </Link>

          <Card className="space-y-4 p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-muted uppercase tracking-wide">Wallet balances</p>
                <h2 className="text-base sm:text-lg font-semibold">All chains and tokens</h2>
              </div>
              <button
                onClick={() => refresh()}
                className="shrink-0 flex items-center gap-1 text-xs text-accent hover:text-primary transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Refresh
              </button>
            </div>

            {Object.keys(totalsBySymbol).length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                {Object.entries(totalsBySymbol).map(([symbol, total]) => (
                  <div key={symbol} className="min-w-0 rounded-xl border border-border bg-background px-3 py-2">
                    <p className="text-xs text-muted">{symbol}</p>
                    <p className="font-medium truncate">{total.toFixed(6).replace(/\.?0+$/, "")}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-2">
              {walletBalances.map((group) => {
                const displayBalances = displayTokenBalances(group.tokenBalances);
                const usdc = primaryUsdcBalance(group.tokenBalances);
                return (
                  <Link key={group.wallet.id} href={`/wallet/chains/${group.wallet.id}`}>
                    <div className="rounded-xl border border-border px-3 py-3 hover:border-primary/40 transition-colors min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium">{walletChainLabel(group)}</p>
                          <p className="text-xs text-muted font-mono truncate">
                            {group.wallet.id}
                          </p>
                        </div>
                        <span className="text-sm font-semibold shrink-0 max-w-[42%] truncate text-right">
                          {usdc?.amount ?? "0"} USDC
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {displayBalances.slice(0, 5).map((balance) => (
                          <span
                            key={`${group.wallet.id}-${balance.token.id ?? balance.token.tokenAddress ?? tokenSymbol(balance)}`}
                            className="rounded-lg bg-surface px-2 py-1 text-[11px] text-muted"
                          >
                            {balance.amount} {tokenSymbol(balance)}
                          </span>
                        ))}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </Card>

          <div className="grid grid-cols-2 min-[420px]:grid-cols-3 sm:grid-cols-4 gap-2.5 sm:gap-3">
            {actionTiles.map(({ href, label, icon: Icon, primary }) => (
              <Link
                key={href}
                href={href}
                className={`min-h-[74px] flex flex-col items-center justify-center gap-1.5 rounded-2xl px-2 py-3 sm:py-4 text-xs sm:text-sm font-medium text-center transition-colors ${
                  primary
                    ? "bg-primary hover:bg-primary-dark text-white"
                    : "bg-surface border border-border hover:border-primary/40 text-foreground"
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="leading-tight">{label}</span>
              </Link>
            ))}
          </div>

          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-muted uppercase tracking-wide">
                Recent activity
              </h2>
              <button
                onClick={() => refresh()}
                className="flex items-center gap-1 text-xs text-accent hover:text-primary transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Refresh
              </button>
            </div>
            <Card padded={false} className="divide-y divide-border px-3 sm:px-5 overflow-hidden">
              <TransactionHistory transactions={transactions} />
            </Card>
          </section>
        </div>

        <div className="md:col-span-2 space-y-4 min-w-0">
          <Card className="space-y-3">
            <p className="font-medium">Add another chain</p>
            <p className="text-xs text-muted">
              Create a Circle wallet on another supported testnet so balances and transactions
              appear on the dashboard.
            </p>
            <Field label="Chain">
              <Select value={chainToCreate} onChange={(event) => setChainToCreate(event.target.value)}>
                {DEFAULT_SELECTOR_CHAINS.map((key) => {
                  const chain = getChain(key);
                  const exists = existingBlockchains.has(chain.circleBlockchain);
                  return (
                    <option key={key} value={key}>
                      {chain.label}{exists ? " (enabled)" : ""}
                    </option>
                  );
                })}
              </Select>
            </Field>
            <Button
              onClick={handleCreateChainWallet}
              disabled={
                createStatus === "working" || existingBlockchains.has(createChain.circleBlockchain)
              }
              fullWidth
            >
              {createStatus === "working" ? "Creating..." : "Enable chain wallet"}
            </Button>
            {createMessage && (
              <p className={`text-xs ${createStatus === "error" ? "text-error" : "text-muted"}`}>
                {createMessage}
              </p>
            )}
          </Card>

          <DashedCard>
            <p className="font-medium text-foreground mb-1">Unified balance (Gateway)</p>
            <p>
              Cross-chain unified balance aggregation is wired up in{" "}
              <Link href="/wallet/unified" className="text-accent underline">
                the Gateway tab
              </Link>{" "}
              — deposit USDC from any supported testnet chain to see it here.
            </p>
          </DashedCard>

          <DashedCard>
            <p className="font-medium text-foreground mb-1">Escrow Pods</p>
            <p>
              Pool funds for group purchases, donations, and shared expenses in{" "}
              <Link href="/wallet/pods" className="text-accent underline">
                Pods
              </Link>
              .
            </p>
          </DashedCard>

          <DashedCard>
            <p className="font-medium text-foreground mb-1">P2P, Cards, and QR</p>
            <p>
              Trade through{" "}
              <Link href="/p2p" className="text-accent underline">
                P2P escrow
              </Link>
              , manage{" "}
              <Link href="/wallet/cards" className="text-accent underline">
                virtual cards
              </Link>
              , or open the{" "}
              <Link href="/qr" className="text-accent underline">
                universal QR scanner
              </Link>
              .
            </p>
          </DashedCard>
        </div>
      </div>
    </main>
  );
}
