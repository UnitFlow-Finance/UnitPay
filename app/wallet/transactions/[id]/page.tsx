"use client";

import { use, useEffect, useState } from "react";
import { apiPost } from "@/lib/api";
import { chainLabelForBlockchain } from "@/lib/chains/lookup";
import type { UnitPayTransaction } from "@/lib/types";
import { useWallet } from "@/lib/useWallet";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";

export default function TransactionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { transactions, userToken } = useWallet();
  const [fetchedTransaction, setFetchedTransaction] = useState<UnitPayTransaction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const transaction = transactions.find((entry) => entry.id === id) ?? fetchedTransaction;

  useEffect(() => {
    const existing = transactions.find((entry) => entry.id === id);
    if (existing) return;
    if (!userToken) return;
    const timeout = window.setTimeout(async () => {
      try {
        const { transaction: fetched } = await apiPost<{ transaction?: UnitPayTransaction }>(
          "/api/wallet/transaction",
          { userToken, id },
        );
        setFetchedTransaction(fetched ?? null);
      } catch (err) {
        setError((err as Error).message ?? String(err));
      }
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [id, transactions, userToken]);

  if (!transaction) {
    return (
      <main className="min-h-full flex items-center justify-center px-6">
        <p className="text-muted text-sm">{error ?? "Loading transaction..."}</p>
      </main>
    );
  }

  return (
    <main className="px-4 sm:px-6 py-6 sm:py-8 max-w-md md:max-w-3xl mx-auto w-full space-y-6">
      <PageHeader title="Transaction Details" backHref="/wallet" />

      <Card className="space-y-3">
        <Detail label="Status" value={transaction.state} />
        <Detail label="Type" value={transaction.transactionType ?? "Transfer"} />
        <Detail label="Network" value={chainLabelForBlockchain(transaction.blockchain)} />
        <Detail label="Amount" value={`${transaction.amounts?.join(", ") ?? "-"} token units`} />
        <Detail label="Transaction ID" value={transaction.id} mono />
        {transaction.txHash && <Detail label="Hash" value={transaction.txHash} mono />}
        {transaction.sourceAddress && <Detail label="From" value={transaction.sourceAddress} mono />}
        {transaction.destinationAddress && (
          <Detail label="To" value={transaction.destinationAddress} mono />
        )}
        {transaction.createDate && <Detail label="Created" value={new Date(transaction.createDate).toLocaleString()} />}
      </Card>

      <Card className="space-y-2">
        <p className="text-xs text-muted uppercase tracking-wide">Raw Circle payload</p>
        <pre className="overflow-auto rounded-xl bg-background p-3 text-xs">
          {JSON.stringify(transaction, null, 2)}
        </pre>
      </Card>
    </main>
  );
}

function Detail({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted">{label}</p>
      <p className={`${mono ? "font-mono break-all" : "font-medium"} text-sm`}>{value}</p>
    </div>
  );
}
