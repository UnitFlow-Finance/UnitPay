"use client";

import { useEffect, useState } from "react";
import { CreditCard, Snowflake } from "lucide-react";
import { createVirtualCardRemote, listVirtualCardsRemote, updateVirtualCardStatusRemote } from "@/lib/cards/client";
import type { VirtualCard, VirtualCardType } from "@/lib/cards/types";
import { useWallet } from "@/lib/useWallet";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Input";

export default function VirtualCardsPage() {
  const { primaryWallet } = useWallet();
  const [cards, setCards] = useState<VirtualCard[]>([]);
  const [label, setLabel] = useState("Everyday Gateway Card");
  const [cardType, setCardType] = useState<VirtualCardType>("Reusable");
  const [monthlyLimit, setMonthlyLimit] = useState("1000");
  const [perTransactionLimit, setPerTransactionLimit] = useState("100");
  const [merchantRestrictions, setMerchantRestrictions] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  async function refresh() {
    if (!primaryWallet) return;
    setCards(await listVirtualCardsRemote(primaryWallet.id));
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [primaryWallet?.id]);

  async function createCard() {
    if (!primaryWallet) return;
    const card = await createVirtualCardRemote({
      ownerCircleWalletId: primaryWallet.id,
      label,
      cardType,
      monthlyLimit,
      perTransactionLimit,
      merchantRestrictions: merchantRestrictions.split(",").map((entry) => entry.trim()).filter(Boolean),
    });
    setCards((previous) => [card, ...previous]);
    setMessage("Virtual Mastercard created.");
  }

  async function toggleCard(card: VirtualCard) {
    const nextStatus = card.status === "Frozen" ? "Active" : "Frozen";
    const updated = await updateVirtualCardStatusRemote(card.id, nextStatus);
    setCards((previous) => previous.map((entry) => (entry.id === card.id ? updated : entry)));
  }

  return (
    <main className="px-4 sm:px-6 py-6 sm:py-8 max-w-md md:max-w-5xl mx-auto w-full space-y-6">
      <PageHeader title="Virtual Mastercard" backHref="/wallet" />
      <div className="grid md:grid-cols-5 gap-5">
        <Card className="md:col-span-2 space-y-3 h-fit">
          <p className="text-sm text-muted">
            Cards spend from Gateway balance through a provider abstraction so Visa or other
            issuers can be added later.
          </p>
          <Field label="Card label">
            <Input value={label} onChange={(event) => setLabel(event.target.value)} />
          </Field>
          <Field label="Type">
            <Select value={cardType} onChange={(event) => setCardType(event.target.value as VirtualCardType)}>
              <option>Reusable</option>
              <option>Single-use</option>
              <option>Subscription</option>
            </Select>
          </Field>
          <Field label="Monthly limit">
            <Input value={monthlyLimit} onChange={(event) => setMonthlyLimit(event.target.value)} inputMode="decimal" />
          </Field>
          <Field label="Per transaction">
            <Input value={perTransactionLimit} onChange={(event) => setPerTransactionLimit(event.target.value)} inputMode="decimal" />
          </Field>
          <Field label="Merchant restrictions">
            <Input value={merchantRestrictions} onChange={(event) => setMerchantRestrictions(event.target.value)} placeholder="AWS, Apple, Uber" />
          </Field>
          <Button onClick={createCard} disabled={!primaryWallet || !label} fullWidth>Create card</Button>
          {message && <p className="text-xs text-muted">{message}</p>}
        </Card>
        <section className="md:col-span-3 space-y-3">
          {cards.length === 0 ? (
            <Card className="text-sm text-muted">No virtual cards yet.</Card>
          ) : (
            cards.map((card) => (
              <Card key={card.id} className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <CreditCard className="w-5 h-5 text-primary" />
                    <div>
                      <p className="font-medium">{card.label}</p>
                      <p className="text-xs text-muted">Mastercard · **** {card.last4} · {card.cardType}</p>
                    </div>
                  </div>
                  <span className="text-xs font-medium">{card.status}</span>
                </div>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <Info label="Monthly" value={`${card.spentThisMonth}/${card.monthlyLimit}`} />
                  <Info label="Per tx" value={card.perTransactionLimit} />
                  <Info label="Asset" value={card.spendAsset} />
                </div>
                <Button onClick={() => toggleCard(card)} variant="secondary" fullWidth>
                  <Snowflake className="w-4 h-4" /> {card.status === "Frozen" ? "Unfreeze" : "Freeze"}
                </Button>
              </Card>
            ))
          )}
        </section>
      </div>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}
