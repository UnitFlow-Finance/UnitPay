"use client";

import { use } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/Button";
import { TransactionHistory } from "@/components/TransactionHistory";
import { useWallet } from "@/lib/useWallet";
import { displayTokenBalances, tokenSymbol, walletChainLabel } from "@/lib/wallet/balances";

export default function WalletChainDetailPage({
  params,
}: {
  params: Promise<{ walletId: string }>;
}) {
  const { walletId } = use(params);
  const { walletBalances, transactions } = useWallet();
  const group = walletBalances.find((entry) => entry.wallet.id === walletId);
  const displayBalances = displayTokenBalances(
    group?.tokenBalances ?? [],
    group?.wallet.blockchain,
  );
  const chainTransactions = transactions.filter(
    (tx) => tx.blockchain === group?.wallet.blockchain,
  );

  if (!group) {
    return (
      <main className="min-h-full flex items-center justify-center px-6">
        <p className="text-muted text-sm">Loading chain wallet...</p>
      </main>
    );
  }

  return (
    <main className="px-4 sm:px-6 py-6 sm:py-8 max-w-md md:max-w-3xl mx-auto w-full space-y-6">
      <PageHeader title={walletChainLabel(group)} backHref="/wallet" />

      <Card className="space-y-3">
        <p className="text-xs text-muted uppercase tracking-wide">Circle Wallet ID</p>
        <code className="block text-xs break-all bg-background rounded-lg px-2.5 py-2">
          {group.wallet.id}
        </code>
        <p className="text-xs text-muted uppercase tracking-wide">Address</p>
        <code className="block text-xs break-all bg-background rounded-lg px-2.5 py-2">
          {group.wallet.address}
        </code>
      </Card>

      <Card className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-medium text-muted uppercase tracking-wide">Token balances</h2>
          <LinkButton href={`/wallet/send`} variant="secondary">
            Send
          </LinkButton>
        </div>
        {displayBalances.length === 0 ? (
          <p className="text-sm text-muted">No token balances on this chain yet.</p>
        ) : (
          displayBalances.map((balance) => (
            <div key={balance.token.id ?? balance.token.tokenAddress ?? tokenSymbol(balance)} className="flex justify-between gap-3 text-sm">
              <span>{balance.token.name || tokenSymbol(balance)}</span>
              <span className="font-medium">
                {balance.amount} {tokenSymbol(balance)}
              </span>
            </div>
          ))
        )}
      </Card>

      <Card padded={false} className="divide-y divide-border px-4 sm:px-5">
        <TransactionHistory transactions={chainTransactions} />
      </Card>
    </main>
  );
}
