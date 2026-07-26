"use client";

import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { chainLabelForBlockchain } from "@/lib/chains/lookup";
import { useWallet } from "@/lib/useWallet";
import { Card } from "@/components/ui/Card";

/**
 * Basic merchant dashboard (v1.5, reduced depth per product scope). Shows
 * incoming payments to the user's own wallet(s), grouped per chain — reuses
 * the same Circle Wallets transaction data as the personal wallet history,
 * filtered to inbound transfers, rather than a separate merchant backend.
 *
 * There is no separate merchant registration/onboarding flow in this build
 * — any UnitPay wallet can act as a "merchant" by generating request links
 * (see /wallet/request) and viewing settlement here.
 */
export default function MerchantDashboardPage() {
  const { loading, error, wallets, transactions, primaryWallet, refresh } = useWallet();

  if (loading) {
    return (
      <main className="min-h-full flex items-center justify-center">
        <p className="text-muted">Loading...</p>
      </main>
    );
  }

  if (error || !primaryWallet) {
    return (
      <main className="min-h-full flex items-center justify-center px-6">
        <p className="text-muted text-sm">{error ?? "No wallet found."}</p>
      </main>
    );
  }

  const incoming = transactions.filter(
    (tx) =>
      tx.destinationAddress &&
      wallets.some((w) => w.address.toLowerCase() === tx.destinationAddress!.toLowerCase()),
  );

  const totalsByChain = incoming.reduce<Record<string, number>>((acc, tx) => {
    const label = chainLabelForBlockchain(tx.blockchain);
    const amount = Number(tx.amounts?.[0] ?? 0);
    acc[label] = (acc[label] ?? 0) + (Number.isNaN(amount) ? 0 : amount);
    return acc;
  }, {});

  return (
    <main className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8 max-w-md md:max-w-4xl mx-auto w-full space-y-6 sm:space-y-8">
      <header className="flex items-center justify-between">
        <h1 className="text-lg sm:text-xl font-semibold">Merchant dashboard</h1>
        <Link
          href="/wallet/request"
          className="text-accent hover:text-primary text-sm font-medium transition-colors"
        >
          New request
        </Link>
      </header>

      <div className="grid md:grid-cols-5 gap-6 sm:gap-8">
        <Card className="md:col-span-2 space-y-3 h-fit">
          <p className="text-xs text-muted uppercase tracking-wide">
            Settlement by chain (incoming only)
          </p>
          {Object.keys(totalsByChain).length === 0 ? (
            <p className="text-sm text-muted">No incoming payments yet.</p>
          ) : (
            <ul className="space-y-2">
              {Object.entries(totalsByChain).map(([label, total]) => (
                <li key={label} className="flex justify-between text-sm">
                  <span>{label}</span>
                  <span className="font-medium">{total.toFixed(2)} USDC</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <section className="md:col-span-3 space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-muted uppercase tracking-wide">
              Incoming payments
            </h2>
            <button
              onClick={() => refresh()}
              className="flex items-center gap-1 text-xs text-accent hover:text-primary transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
          </div>
          {incoming.length === 0 ? (
            <Card>
              <p className="text-sm text-muted">Nothing here yet.</p>
            </Card>
          ) : (
            <Card padded={false} className="divide-y divide-border px-4 sm:px-5">
              {incoming.map((tx) => (
                <div key={tx.id} className="py-3 flex items-center justify-between text-sm">
                  <div className="min-w-0">
                    <p className="font-medium">{chainLabelForBlockchain(tx.blockchain)}</p>
                    <p className="text-muted text-xs truncate">
                      From {tx.sourceAddress?.slice(0, 6)}…{tx.sourceAddress?.slice(-4)}
                    </p>
                  </div>
                  <span className="font-medium shrink-0">{tx.amounts?.[0] ?? "-"} USDC</span>
                </div>
              ))}
            </Card>
          )}
        </section>
      </div>
    </main>
  );
}
