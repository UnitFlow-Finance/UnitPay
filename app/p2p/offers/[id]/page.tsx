"use client";

import { use, useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { createP2PTradeRemote, getP2POfferRemote } from "@/lib/p2p/client";
import type { P2POffer, P2PTrade } from "@/lib/p2p/types";
import { encodeUnitPayQr } from "@/lib/platform/qr";
import { useWallet } from "@/lib/useWallet";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Input";

export default function P2POfferDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { primaryWallet } = useWallet();
  const [offer, setOffer] = useState<P2POffer | null>(null);
  const [amount, setAmount] = useState("");
  const [escrowMode, setEscrowMode] = useState<P2PTrade["escrowMode"]>("automatic");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(async () => {
      setOffer(await getP2POfferRemote(id));
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [id]);

  async function startTrade() {
    if (!primaryWallet || !offer) return;
    try {
      const trade = await createP2PTradeRemote({
        offerId: offer.id,
        takerCircleWalletId: primaryWallet.id,
        amount,
        escrowMode,
        paymentMethod: offer.paymentMethods[0],
      });
      setMessage(`Trade ${trade.id.slice(0, 8)} locked. Follow payment instructions.`);
    } catch (err) {
      setMessage((err as Error).message ?? String(err));
    }
  }

  if (!offer) {
    return (
      <main className="min-h-full flex items-center justify-center px-6">
        <p className="text-muted text-sm">Loading offer...</p>
      </main>
    );
  }

  const qrValue = encodeUnitPayQr({
    kind: "p2p-offer",
    value: offer.id,
    route: `/p2p/offers/${offer.id}`,
    objectType: "p2p-offer",
    objectId: offer.id,
  });

  return (
    <main className="px-4 sm:px-6 py-6 sm:py-8 max-w-md md:max-w-2xl mx-auto w-full space-y-6">
      <PageHeader title={`${offer.side === "buy" ? "Buy" : "Sell"} ${offer.asset}`} backHref="/p2p" />
      <Card className="space-y-4">
        <div className="flex justify-between gap-3">
          <div>
            <p className="text-xs text-muted">Price</p>
            <p className="text-2xl font-semibold">{offer.price} {offer.fiatCurrency}</p>
          </div>
          <div className="bg-white p-2 rounded-xl">
            <QRCodeSVG value={qrValue} size={96} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <Info label="Available" value={`${offer.availableAmount} ${offer.asset}`} />
          <Info label="Limit" value={`${offer.minAmount}-${offer.maxAmount} ${offer.asset}`} />
          <Info label="Payment" value={offer.paymentMethods.join(", ")} />
          <Info label="Status" value={offer.status} />
        </div>
        <p className="text-sm text-muted whitespace-pre-wrap">{offer.terms}</p>
      </Card>
      <Card className="space-y-3">
        <Field label={`Amount (${offer.asset})`}>
          <Input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" />
        </Field>
        <Field label="Escrow mode">
          <Select value={escrowMode} onChange={(event) => setEscrowMode(event.target.value as P2PTrade["escrowMode"])}>
            <option value="automatic">Automatic release</option>
            <option value="ai_arbitrated">AI arbitration</option>
            <option value="manual">Manual dispute resolution</option>
          </Select>
        </Field>
        <Button onClick={startTrade} disabled={!primaryWallet || !amount} fullWidth>
          Lock trade
        </Button>
        {message && <p className="text-xs text-muted">{message}</p>}
      </Card>
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
