"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { listP2POffersRemote } from "@/lib/p2p/client";
import {
  P2P_ASSETS,
  P2P_FIAT_CURRENCIES,
  P2P_PAYMENT_METHODS,
  type P2POffer,
  type P2POfferSide,
} from "@/lib/p2p/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/Button";
import { Field, Select } from "@/components/ui/Input";

export default function P2PMarketplacePage() {
  const [side, setSide] = useState<P2POfferSide | "all">("all");
  const [asset, setAsset] = useState("USDC");
  const [fiatCurrency, setFiatCurrency] = useState("USD");
  const [offers, setOffers] = useState<P2POffer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const filters = useMemo(() => {
    const params = new URLSearchParams();
    if (side !== "all") params.set("side", side);
    params.set("asset", asset);
    params.set("fiatCurrency", fiatCurrency);
    return params;
  }, [asset, fiatCurrency, side]);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      setOffers(await listP2POffersRemote(filters));
    } catch (err) {
      setError((err as Error).message ?? String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  return (
    <main className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8 max-w-md md:max-w-5xl mx-auto w-full space-y-6">
      <PageHeader title="P2P Marketplace" backHref="/wallet" />

      <div className="grid md:grid-cols-4 gap-4">
        <Card className="md:col-span-1 space-y-3 h-fit">
          <Field label="I want to">
            <Select value={side} onChange={(event) => setSide(event.target.value as P2POfferSide | "all")}>
              <option value="all">All offers</option>
              <option value="buy">Buy crypto</option>
              <option value="sell">Sell crypto</option>
            </Select>
          </Field>
          <Field label="Asset">
            <Select value={asset} onChange={(event) => setAsset(event.target.value)}>
              {P2P_ASSETS.map((entry) => (
                <option key={entry}>{entry}</option>
              ))}
            </Select>
          </Field>
          <Field label="Fiat">
            <Select value={fiatCurrency} onChange={(event) => setFiatCurrency(event.target.value)}>
              {P2P_FIAT_CURRENCIES.map((entry) => (
                <option key={entry}>{entry}</option>
              ))}
            </Select>
          </Field>
          <LinkButton href="/p2p/offers/new" fullWidth>
            Create offer
          </LinkButton>
          <p className="text-xs text-muted">
            Settlement uses a dedicated P2P balance model: deposit, lock for trade, release or
            refund, then withdraw.
          </p>
        </Card>

        <section className="md:col-span-3 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-medium text-muted uppercase tracking-wide">Offers</h2>
            <button
              type="button"
              onClick={refresh}
              className="flex items-center gap-1 text-xs text-accent hover:text-primary transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" /> {loading ? "Refreshing" : "Refresh"}
            </button>
          </div>
          {error && <p className="text-error text-sm">{error}</p>}
          {offers.length === 0 ? (
            <Card className="text-sm text-muted">No matching offers yet.</Card>
          ) : (
            offers.map((offer) => (
              <Link key={offer.id} href={`/p2p/offers/${offer.id}`}>
                <Card className="space-y-2 hover:border-primary/40 transition-colors">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium">
                      {offer.side === "buy" ? "Buying" : "Selling"} {offer.asset}
                    </p>
                    <span className="text-sm font-semibold">
                      {offer.price} {offer.fiatCurrency}
                    </span>
                  </div>
                  <p className="text-xs text-muted">
                    Limit {offer.minAmount}-{offer.maxAmount} {offer.asset} · Available{" "}
                    {offer.availableAmount} {offer.asset}
                  </p>
                  <p className="text-xs text-subtle">
                    {offer.paymentMethods.join(", ") || P2P_PAYMENT_METHODS[0]}
                  </p>
                </Card>
              </Link>
            ))
          )}
        </section>
      </div>
    </main>
  );
}
