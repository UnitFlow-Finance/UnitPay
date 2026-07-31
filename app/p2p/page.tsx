"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Bell, BriefcaseBusiness, CircleUserRound, History, RefreshCw, ShieldCheck } from "lucide-react";
import { listP2PMerchantsRemote, listP2POffersRemote, listP2PTradesRemote } from "@/lib/p2p/client";
import {
  P2P_ASSETS,
  P2P_FIAT_CURRENCIES,
  P2P_PAYMENT_METHODS,
  customerActionLabel,
  offerSideForCustomerAction,
  type P2PMerchantProfile,
  type P2POffer,
  type P2POfferSide,
  type P2PTrade,
} from "@/lib/p2p/types";
import { useWallet } from "@/lib/useWallet";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Input";

export default function P2PMarketplacePage() {
  const { primaryWallet } = useWallet();
  const [side, setSide] = useState<P2POfferSide | "all">("all");
  const [asset, setAsset] = useState("USDC");
  const [fiatCurrency, setFiatCurrency] = useState("USD");
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("all");
  const [sort, setSort] = useState("best");
  const [offers, setOffers] = useState<P2POffer[]>([]);
  const [merchants, setMerchants] = useState<P2PMerchantProfile[]>([]);
  const [trades, setTrades] = useState<P2PTrade[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const filters = useMemo(() => {
    const params = new URLSearchParams();
    if (side !== "all") params.set("side", offerSideForCustomerAction(side));
    params.set("asset", asset);
    params.set("fiatCurrency", fiatCurrency);
    return params;
  }, [asset, fiatCurrency, side]);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      setOffers(await listP2POffersRemote(filters));
      setMerchants(await listP2PMerchantsRemote());
      if (primaryWallet?.id) {
        setTrades(await listP2PTradesRemote(primaryWallet.id));
      }
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
  }, [filters, primaryWallet?.id]);

  const merchantById = useMemo(() => {
    return new Map(merchants.map((merchant) => [merchant.id, merchant]));
  }, [merchants]);

  const tradesNeedingAttention = useMemo(
    () => trades.filter((trade) => ["Open", "Locked", "Paid", "Disputed"].includes(trade.status)),
    [trades],
  );

  const visibleOffers = useMemo(() => {
    const requestedAmount = Number(amount);
    const hasAmount = amount.trim() !== "" && !Number.isNaN(requestedAmount) && requestedAmount > 0;
    const filtered = offers
      .filter((offer) => paymentMethod === "all" || offer.paymentMethods.includes(paymentMethod))
      .filter((offer) =>
        hasAmount
          ? requestedAmount >= Number(offer.minAmount) &&
            requestedAmount <= Number(offer.maxAmount) &&
            requestedAmount <= Number(offer.availableAmount)
          : true,
      );
    return [...filtered].sort((a, b) => {
      const merchantA = a.merchantId ? merchantById.get(a.merchantId) : undefined;
      const merchantB = b.merchantId ? merchantById.get(b.merchantId) : undefined;
      if (sort === "price-low") return Number(a.price) - Number(b.price);
      if (sort === "price-high") return Number(b.price) - Number(a.price);
      if (sort === "available") return Number(b.availableAmount) - Number(a.availableAmount);
      if (sort === "rating") return (merchantB?.rating ?? 0) - (merchantA?.rating ?? 0);
      const score = (offer: P2POffer, merchant?: P2PMerchantProfile) =>
        (merchant?.online ? 20 : 0) +
        (merchant?.completionRate ?? 0) * 0.4 +
        (merchant?.rating ?? 0) * 8 +
        Number(offer.availableAmount) * 0.01;
      return score(b, merchantB) - score(a, merchantA);
    });
  }, [amount, merchantById, offers, paymentMethod, sort]);

  return (
    <main className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8 max-w-md md:max-w-5xl mx-auto w-full space-y-6">
      <PageHeader title="P2P Marketplace" backHref="/wallet" />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <LinkButton href="/p2p/merchant" variant="secondary" fullWidth>
          <BriefcaseBusiness className="w-4 h-4" /> Merchant dashboard
        </LinkButton>
        <LinkButton href="/p2p/trades" variant="secondary" fullWidth>
          <History className="w-4 h-4" /> Trade history
        </LinkButton>
        <LinkButton href="/p2p/payment-methods" variant="secondary" fullWidth>
          <ShieldCheck className="w-4 h-4" /> Payment methods
        </LinkButton>
      </div>

      {tradesNeedingAttention.length > 0 && (
        <Link href="/p2p/trades" className="block">
          <Card className="border-primary/40 bg-primary-light/40 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <span className="relative shrink-0">
                <Bell className="w-5 h-5 text-primary" />
                <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-error ring-2 ring-primary-light" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold">P2P trades need attention</p>
                <p className="text-xs text-muted">
                  {tradesNeedingAttention.length} locked, paid, open, or disputed trade{tradesNeedingAttention.length === 1 ? "" : "s"}
                </p>
              </div>
            </div>
            <span className="text-xs font-semibold text-primary">Review</span>
          </Card>
        </Link>
      )}

      <div className="grid md:grid-cols-4 gap-4">
        <Card className="md:col-span-1 space-y-3 h-fit">
          <Field label="I want to">
            <Select value={side} onChange={(event) => setSide(event.target.value as P2POfferSide | "all")}>
              <option value="all">All offers</option>
              <option value="buy">Buy crypto from merchants</option>
              <option value="sell">Sell crypto to merchants</option>
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
          <Field label="Amount">
            <Input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" placeholder="Trade amount" />
          </Field>
          <Field label="Payment">
            <Select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}>
              <option value="all">All methods</option>
              {P2P_PAYMENT_METHODS.map((method) => (
                <option key={method}>{method}</option>
              ))}
            </Select>
          </Field>
          <Field label="Sort">
            <Select value={sort} onChange={(event) => setSort(event.target.value)}>
              <option value="best">Best match</option>
              <option value="price-low">Lowest price</option>
              <option value="price-high">Highest price</option>
              <option value="available">Most available</option>
              <option value="rating">Highest rated</option>
            </Select>
          </Field>
          <LinkButton href="/p2p/offers/new" fullWidth>
            Create offer
          </LinkButton>
          <p className="text-xs text-muted">
            Customer buys use merchant escrowed liquidity. Customer sells lock the customer&apos;s
            tokens into on-chain escrow before the trade starts.
          </p>
          {trades.length > 0 && (
            <div className="pt-2 border-t border-border space-y-2">
              <p className="text-xs font-medium text-muted uppercase">Active trades</p>
              {trades.slice(0, 3).map((trade) => (
                <Link key={trade.id} href={`/p2p/trades/${trade.id}`} className="block text-xs text-accent hover:text-primary">
                  {trade.status} · {trade.cryptoAmount} {trade.asset}
                </Link>
              ))}
            </div>
          )}
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
          {visibleOffers.length === 0 ? (
            <Card className="text-sm text-muted">No matching offers yet.</Card>
          ) : (
            visibleOffers.map((offer) => {
              const merchant = offer.merchantId ? merchantById.get(offer.merchantId) : undefined;
              return (
                <Link key={offer.id} href={`/p2p/offers/${offer.id}`}>
                  <Card className="space-y-3 hover:border-primary/40 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <CircleUserRound className="w-5 h-5 text-primary shrink-0" />
                          <p className="font-medium truncate">{merchant?.displayName ?? "UnitPay Merchant"}</p>
                          <span className={`w-2 h-2 rounded-full ${merchant?.online !== false ? "bg-success" : "bg-muted"}`} />
                          <span className="text-xs text-muted">{merchant?.online !== false ? "Online" : "Offline"}</span>
                        </div>
                        <p className="text-xs text-muted mt-1">
                          {merchant?.completionRate ?? 100}% completion · {merchant?.rating ?? 5}/5 rating
                        </p>
                      </div>
                      <span className="text-sm font-semibold text-right">
                        {offer.price} {offer.fiatCurrency}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium">{customerActionLabel(offer.side)} {offer.asset}</p>
                      <p className="text-xs text-muted">{offer.paymentTimeLimitMinutes} min</p>
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
              );
            })
          )}
        </section>
      </div>
    </main>
  );
}
