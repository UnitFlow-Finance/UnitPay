"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createP2POfferRemote } from "@/lib/p2p/client";
import { P2P_ASSETS, P2P_FIAT_CURRENCIES, P2P_PAYMENT_METHODS, type P2POfferSide } from "@/lib/p2p/types";
import { useWallet } from "@/lib/useWallet";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Input";

export default function NewP2POfferPage() {
  const router = useRouter();
  const { primaryWallet } = useWallet();
  const [side, setSide] = useState<P2POfferSide>("sell");
  const [asset, setAsset] = useState("USDC");
  const [fiatCurrency, setFiatCurrency] = useState("USD");
  const [price, setPrice] = useState("1");
  const [minAmount, setMinAmount] = useState("10");
  const [maxAmount, setMaxAmount] = useState("500");
  const [availableAmount, setAvailableAmount] = useState("500");
  const [paymentMethod, setPaymentMethod] = useState("Bank Transfer");
  const [terms, setTerms] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    if (!primaryWallet) return;
    setError(null);
    try {
      const offer = await createP2POfferRemote({
        creatorWalletId: primaryWallet.address,
        creatorCircleWalletId: primaryWallet.id,
        side,
        asset,
        fiatCurrency,
        price,
        minAmount,
        maxAmount,
        availableAmount,
        paymentMethods: [paymentMethod],
        terms,
      });
      router.push(`/p2p/offers/${offer.id}`);
    } catch (err) {
      setError((err as Error).message ?? String(err));
    }
  }

  return (
    <main className="px-4 sm:px-6 py-6 sm:py-8 max-w-md md:max-w-2xl mx-auto w-full space-y-6">
      <PageHeader title="Create P2P Offer" backHref="/p2p" />
      <Card className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Side">
            <Select value={side} onChange={(event) => setSide(event.target.value as P2POfferSide)}>
              <option value="buy">Buy</option>
              <option value="sell">Sell</option>
            </Select>
          </Field>
          <Field label="Asset">
            <Select value={asset} onChange={(event) => setAsset(event.target.value)}>
              {P2P_ASSETS.map((entry) => (
                <option key={entry}>{entry}</option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Fiat">
            <Select value={fiatCurrency} onChange={(event) => setFiatCurrency(event.target.value)}>
              {P2P_FIAT_CURRENCIES.map((entry) => (
                <option key={entry}>{entry}</option>
              ))}
            </Select>
          </Field>
          <Field label="Price">
            <Input value={price} onChange={(event) => setPrice(event.target.value)} inputMode="decimal" />
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Min">
            <Input value={minAmount} onChange={(event) => setMinAmount(event.target.value)} inputMode="decimal" />
          </Field>
          <Field label="Max">
            <Input value={maxAmount} onChange={(event) => setMaxAmount(event.target.value)} inputMode="decimal" />
          </Field>
          <Field label="Available">
            <Input value={availableAmount} onChange={(event) => setAvailableAmount(event.target.value)} inputMode="decimal" />
          </Field>
        </div>
        <Field label="Payment method">
          <Select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}>
            {P2P_PAYMENT_METHODS.map((entry) => (
              <option key={entry}>{entry}</option>
            ))}
          </Select>
        </Field>
        <Field label="Terms">
          <Textarea value={terms} onChange={(event) => setTerms(event.target.value)} rows={4} />
        </Field>
        {error && <p className="text-error text-sm">{error}</p>}
        <Button onClick={handleCreate} size="lg" fullWidth disabled={!primaryWallet}>
          Create offer
        </Button>
      </Card>
    </main>
  );
}
