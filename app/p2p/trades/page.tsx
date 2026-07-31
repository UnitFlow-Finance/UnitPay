"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listP2PTradesRemote } from "@/lib/p2p/client";
import type { P2PTrade } from "@/lib/p2p/types";
import { useWallet } from "@/lib/useWallet";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";

export default function P2PTradesPage() {
  const { primaryWallet } = useWallet();
  const [trades, setTrades] = useState<P2PTrade[]>([]);

  useEffect(() => {
    const timeout = window.setTimeout(async () => {
      setTrades(await listP2PTradesRemote(primaryWallet?.id));
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [primaryWallet?.id]);

  return (
    <main className="px-4 sm:px-6 py-6 sm:py-8 max-w-md md:max-w-4xl mx-auto w-full space-y-6">
      <PageHeader title="Trade History" backHref="/p2p" />
      {trades.length === 0 ? (
        <Card className="text-sm text-muted">No P2P trades yet.</Card>
      ) : (
        trades.map((trade) => (
          <Link key={trade.id} href={`/p2p/trades/${trade.id}`}>
            <Card className="hover:border-primary/40 transition-colors">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium">{trade.cryptoAmount} {trade.asset}</p>
                  <p className="text-xs text-muted">{trade.fiatAmount} {trade.fiatCurrency} · {trade.paymentMethod}</p>
                </div>
                <span className="text-sm font-semibold">{trade.status}</span>
              </div>
            </Card>
          </Link>
        ))
      )}
    </main>
  );
}
