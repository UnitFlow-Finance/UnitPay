"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, CreditCard, Snowflake, Trash2, WalletCards } from "lucide-react";
import {
  deleteVirtualCardRemote,
  fundVirtualCardRemote,
  getVirtualCardRemote,
  updateVirtualCardStatusRemote,
  withdrawVirtualCardRemote,
} from "@/lib/cards/client";
import type { VirtualCard, VirtualCardTransaction } from "@/lib/cards/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";

export default function VirtualCardDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [card, setCard] = useState<VirtualCard | null>(null);
  const [transactions, setTransactions] = useState<VirtualCardTransaction[]>([]);
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  async function refresh() {
    const result = await getVirtualCardRemote(id);
    if (!result) {
      setCard(null);
      return;
    }
    setCard(result.card);
    setTransactions(result.transactions);
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const maskedDetails = useMemo(() => {
    if (!card) return "";
    return `${card.network} virtual card (masked)\nNickname: ${card.label}\nCard number: **** **** **** ${card.last4}\nCVV: ***\nExpiry: ${card.expiryMonth}/${card.expiryYear}\nCurrency: ${card.currency}\nNote: Full PAN and CVV require secure card-detail authentication and are not stored in this masked view.`;
  }, [card]);

  async function runAction(action: () => Promise<void>, done: string) {
    setWorking(true);
    setMessage(null);
    try {
      await action();
      await refresh();
      setMessage(done);
    } catch (error) {
      setMessage((error as Error).message ?? String(error));
    } finally {
      setWorking(false);
    }
  }

  async function copyValue(value: string, done: string) {
    try {
      await navigator.clipboard.writeText(value);
      setMessage(done);
    } catch {
      setMessage("Clipboard is unavailable in this browser.");
    }
  }

  if (!card) {
    return (
      <main className="min-h-full flex items-center justify-center px-6">
        <p className="text-muted text-sm">Loading card...</p>
      </main>
    );
  }

  return (
    <main className="px-4 sm:px-6 py-6 sm:py-8 max-w-md md:max-w-5xl mx-auto w-full space-y-6">
      <PageHeader title={card.label} backHref="/wallet/cards" />
      <div className="grid md:grid-cols-5 gap-5">
        <section className="md:col-span-2 space-y-4">
          <Card className="relative overflow-hidden bg-[linear-gradient(135deg,#111827,#0f766e)] text-white min-h-56 flex flex-col justify-between">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-white/75">{card.network}</p>
                <p className="text-lg font-semibold">{card.label}</p>
              </div>
              <CreditCard className="w-6 h-6 text-white/80" />
            </div>
            <div className="space-y-4">
              <p className="text-2xl tracking-[0.2em]">**** **** **** {card.last4}</p>
              <div className="flex items-end justify-between gap-4 text-sm">
                <div>
                  <p className="text-white/60">Balance</p>
                  <p className="font-semibold">{card.balance} {card.currency}</p>
                </div>
                <div>
                  <p className="text-white/60">Expires</p>
                  <p className="font-semibold">{card.expiryMonth}/{card.expiryYear}</p>
                </div>
                <div>
                  <p className="text-white/60">CVV</p>
                  <p className="font-semibold">***</p>
                </div>
              </div>
            </div>
          </Card>
          <Card className="space-y-2 text-sm">
            <p className="font-semibold">AI-agent ready</p>
            <p className="text-muted">
              This virtual card can be permissioned for AI agents through UnitPay spending policies, limits, and merchant restrictions.
            </p>
            <p className="text-xs text-muted">
              Card number and CVV are intentionally masked in this view; copy actions copy the same masked values shown on screen.
            </p>
          </Card>
          <Card className="space-y-3">
            <Field label="Fund or withdraw amount">
              <Input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" placeholder="25" />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Button disabled={working || !amount || card.status !== "Active"} onClick={() => runAction(async () => {
                const result = await fundVirtualCardRemote(card.id, amount);
                setCard(result.card);
              }, "Card funded from Gateway balance.")}>
                Fund card
              </Button>
              <Button variant="secondary" disabled={working || !amount} onClick={() => runAction(async () => {
                const result = await withdrawVirtualCardRemote(card.id, amount);
                setCard(result.card);
              }, "Remaining balance withdrawn.")}>
                Withdraw
              </Button>
            </div>
            <Button variant="secondary" disabled={working || card.status === "Closed"} fullWidth onClick={() => runAction(async () => {
              const updated = await updateVirtualCardStatusRemote(card.id, card.status === "Frozen" ? "Active" : "Frozen");
              setCard(updated);
            }, card.status === "Frozen" ? "Card unfrozen." : "Card frozen.")}>
              <Snowflake className="w-4 h-4" /> {card.status === "Frozen" ? "Unfreeze" : "Freeze"}
            </Button>
            <Button variant="ghost" disabled={working} fullWidth onClick={() => runAction(async () => {
              await navigator.clipboard.writeText(maskedDetails);
            }, "Masked card details copied.")}>
              <Copy className="w-4 h-4" /> Copy masked details
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="ghost"
                disabled={working}
                onClick={() => copyValue(`**** **** **** ${card.last4}`, "Masked card number copied.")}
              >
                <Copy className="w-4 h-4" /> Number
              </Button>
              <Button
                variant="ghost"
                disabled={working}
                onClick={() => copyValue("***", "Masked CVV copied.")}
              >
                <Copy className="w-4 h-4" /> CVV
              </Button>
            </div>
            <Button variant="ghost" disabled={working} fullWidth onClick={() => runAction(async () => {
              await deleteVirtualCardRemote(card.id);
              router.push("/wallet/cards");
            }, "Card deleted.")}>
              <Trash2 className="w-4 h-4" /> Delete card
            </Button>
            {message && <p className="text-xs text-muted">{message}</p>}
          </Card>
        </section>

        <section className="md:col-span-3 space-y-4">
          <Card className="space-y-3">
            <h2 className="font-semibold">Card details</h2>
            <div className="grid sm:grid-cols-2 gap-3 text-sm">
              <Info label="Status" value={card.status} />
              <Info label="Type" value={card.cardType} />
              <Info label="Spend source" value={card.spendAsset} />
              <Info label="Currency" value={card.currency} />
              <Info label="Monthly limit" value={`${card.spentThisMonth}/${card.monthlyLimit}`} />
              <Info label="Per transaction" value={card.perTransactionLimit} />
              <Info label="Created" value={new Date(card.createdAt).toLocaleString()} />
              <Info label="Updated" value={new Date(card.updatedAt).toLocaleString()} />
            </div>
            <Info label="Billing address" value={card.billingAddress || "Not set"} />
            <Info label="Merchant restrictions" value={card.merchantRestrictions.join(", ") || "None"} />
          </Card>
          <Card className="space-y-3">
            <div className="flex items-center gap-2">
              <WalletCards className="w-4 h-4 text-primary" />
              <h2 className="font-semibold">Transaction history</h2>
            </div>
            {transactions.length === 0 ? (
              <p className="text-sm text-muted">No card transactions yet.</p>
            ) : (
              <div className="divide-y divide-border">
                {transactions.map((transaction) => (
                  <div key={transaction.id} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3 text-sm">
                    <div>
                      <p className="font-medium">{transaction.type} · {transaction.merchant}</p>
                      <p className="text-xs text-muted">{new Date(transaction.createdAt).toLocaleString()} · {transaction.status}</p>
                    </div>
                    <p className="font-semibold">{transaction.type === "Withdrawal" ? "-" : "+"}{transaction.amount} {transaction.asset}</p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </section>
      </div>
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
