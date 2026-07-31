"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ShieldCheck, Star } from "lucide-react";
import type { P2PMerchantProfile, P2POffer } from "@/lib/p2p/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";

export default function P2PMerchantProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [merchant, setMerchant] = useState<P2PMerchantProfile | null>(null);
  const [offers, setOffers] = useState<P2POffer[]>([]);

  useEffect(() => {
    const timeout = window.setTimeout(async () => {
      const response = await fetch(`/api/p2p/merchants/${id}`, { cache: "no-store" });
      const body = await response.json();
      setMerchant(body.merchant ?? null);
      setOffers(body.offers ?? []);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [id]);

  if (!merchant) {
    return (
      <main className="min-h-full flex items-center justify-center px-6">
        <p className="text-muted text-sm">Loading merchant...</p>
      </main>
    );
  }

  return (
    <main className="px-4 sm:px-6 py-6 sm:py-8 max-w-md md:max-w-4xl mx-auto w-full space-y-6">
      <PageHeader title={merchant.displayName} backHref="/p2p" />
      <Card className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold">{merchant.displayName}</h1>
              {merchant.kycStatus === "verified" && <ShieldCheck className="w-5 h-5 text-primary" />}
            </div>
            <p className="text-sm text-muted">{merchant.bio || merchant.terms}</p>
          </div>
          <div className="text-right">
            <p className="font-semibold">{merchant.rating}/5</p>
            <p className="text-xs text-muted">{merchant.reviewCount} reviews</p>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <Info label="Completed" value={`${merchant.completedTrades ?? 0}`} />
          <Info label="Completion" value={`${merchant.completionRate}%`} />
          <Info label="Release time" value={`${Math.round((merchant.releaseTimeSeconds ?? 0) / 60)} min`} />
          <Info label="Volume" value={`${merchant.totalVolume ?? "0"} USDC`} />
        </div>
        <p className="text-xs text-muted">Payment methods: {(merchant.supportedPaymentMethods ?? []).join(", ")}</p>
      </Card>
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted uppercase">Active offers</h2>
        {offers.length === 0 ? (
          <Card className="text-sm text-muted">No active offers for this merchant.</Card>
        ) : (
          offers.map((offer) => (
            <Link key={offer.id} href={`/p2p/offers/${offer.id}`}>
              <Card className="hover:border-primary/40 transition-colors">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium">{offer.side === "buy" ? "Buying" : "Selling"} {offer.asset}</p>
                  <p className="font-semibold">{offer.price} {offer.fiatCurrency}</p>
                </div>
              </Card>
            </Link>
          ))
        )}
      </section>
      <Card className="text-sm text-muted flex items-center gap-2">
        <Star className="w-4 h-4 text-primary" /> Reviews and ratings are updated after completed on-chain escrow trades.
      </Card>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted">{label}</p>
      <p className="font-medium break-words">{value}</p>
    </div>
  );
}
