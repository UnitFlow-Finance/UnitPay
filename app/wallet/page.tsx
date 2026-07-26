"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
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
} from "lucide-react";
import { BalanceCard } from "@/components/BalanceCard";
import { TransactionHistory } from "@/components/TransactionHistory";
import { Card, DashedCard } from "@/components/ui/Card";
import { chainLabelForBlockchain, isUsdcNativeGas } from "@/lib/chains/lookup";
import { useWallet } from "@/lib/useWallet";

export default function WalletDashboardPage() {
  const router = useRouter();
  const { loading, error, wallets, primaryWallet, balances, transactions, refresh } =
    useWallet();

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
  ];

  return (
    <main className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8 max-w-md md:max-w-3xl lg:max-w-5xl mx-auto w-full space-y-6 sm:space-y-8">
      <header className="hidden md:flex items-center justify-between">
        <h1 className="text-xl font-semibold">Wallet</h1>
        <Link
          href="/settings"
          className="flex items-center gap-1.5 text-muted hover:text-foreground text-sm transition-colors"
        >
          <Settings className="w-4 h-4" /> Settings
        </Link>
      </header>

      <div className="grid md:grid-cols-5 gap-6 sm:gap-8">
        <div className="md:col-span-3 space-y-6 sm:space-y-8">
          <BalanceCard
            chainLabel={chainLabelForBlockchain(primaryWallet.blockchain)}
            balances={balances}
            usdcIsNativeGas={isUsdcNativeGas(primaryWallet.blockchain)}
          />

          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {actionTiles.map(({ href, label, icon: Icon, primary }) => (
              <Link
                key={href}
                href={href}
                className={`flex flex-col items-center justify-center gap-1.5 rounded-2xl py-3.5 sm:py-4 text-xs sm:text-sm font-medium text-center transition-colors ${
                  primary
                    ? "bg-primary hover:bg-primary-dark text-white"
                    : "bg-surface border border-border hover:border-primary/40 text-foreground"
                }`}
              >
                <Icon className="w-5 h-5" />
                {label}
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
            <Card padded={false} className="divide-y divide-border px-4 sm:px-5">
              <TransactionHistory transactions={transactions} />
            </Card>
          </section>
        </div>

        <div className="md:col-span-2 space-y-4">
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
        </div>
      </div>
    </main>
  );
}
