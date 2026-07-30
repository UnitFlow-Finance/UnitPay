"use client";

import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { useState } from "react";
import { chainLabelForBlockchain } from "@/lib/chains/lookup";
import { encodeUnitPayQr } from "@/lib/platform/qr";
import { useWallet } from "@/lib/useWallet";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, DashedCard } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export default function ReceivePage() {
  const { primaryWallet, loading } = useWallet();
  const [copied, setCopied] = useState(false);
  const [copiedWalletId, setCopiedWalletId] = useState(false);

  if (loading) {
    return (
      <main className="min-h-full flex items-center justify-center">
        <p className="text-muted">Loading...</p>
      </main>
    );
  }

  if (!primaryWallet) {
    return (
      <main className="min-h-full flex items-center justify-center px-6">
        <p className="text-muted text-sm">No wallet found. Go back and create one first.</p>
      </main>
    );
  }

  async function copyAddress() {
    if (!primaryWallet) return;
    await navigator.clipboard.writeText(primaryWallet.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function copyWalletId() {
    if (!primaryWallet) return;
    await navigator.clipboard.writeText(primaryWallet.id);
    setCopiedWalletId(true);
    setTimeout(() => setCopiedWalletId(false), 1500);
  }

  const walletIdQr = encodeUnitPayQr({
    kind: "circle-wallet-id",
    value: primaryWallet.id,
    route: `/wallet/send?recipient=${encodeURIComponent(primaryWallet.id)}`,
    objectType: "user",
    objectId: primaryWallet.id,
  });

  return (
    <main className="px-4 sm:px-6 py-6 sm:py-8 max-w-md md:max-w-lg mx-auto w-full space-y-6">
      <PageHeader title="Receive USDC" backHref="/wallet" />

      <Card className="p-6 sm:p-8 flex flex-col items-center gap-4">
        <div className="bg-white p-4 rounded-xl">
          <QRCodeSVG value={walletIdQr} size={200} />
        </div>
        <p className="text-xs text-muted text-center">
          Scan this QR code to send to your Circle Wallet ID.
        </p>
        <Button onClick={copyWalletId} fullWidth>
          {copiedWalletId ? "Copied!" : "Copy Circle Wallet ID"}
        </Button>
        <code className="text-xs text-muted break-all text-center">{primaryWallet.id}</code>
      </Card>

      <Card className="space-y-3">
        <p className="text-sm font-medium">Advanced address details</p>
        <p className="text-xs text-muted">
          Use this only when a sender needs a raw address on{" "}
          {chainLabelForBlockchain(primaryWallet.blockchain)}.
        </p>
        <div className="mx-auto bg-white p-3 rounded-xl w-fit">
          <QRCodeSVG value={primaryWallet.address} size={160} />
        </div>
        <Button onClick={copyAddress} fullWidth>
          {copied ? "Copied!" : "Copy address"}
        </Button>
        <code className="text-xs text-muted break-all text-center">{primaryWallet.address}</code>
      </Card>

      <DashedCard>
        <p className="font-medium text-foreground mb-1">Receiving from another chain?</p>
        <p>
          If the sender is on a different testnet chain, use{" "}
          <Link href="/wallet/unified" className="text-accent underline">
            Gateway
          </Link>{" "}
          instead of sharing this address directly — this address only receives funds on{" "}
          {chainLabelForBlockchain(primaryWallet.blockchain)}.
        </p>
      </DashedCard>
    </main>
  );
}
