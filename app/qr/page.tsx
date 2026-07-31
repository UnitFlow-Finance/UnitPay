"use client";

import { useMemo, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Camera, ScanLine, Upload } from "lucide-react";
import { encodeUnitPayQr, parseUnitPayQr } from "@/lib/platform/qr";
import { useWallet } from "@/lib/useWallet";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button, LinkButton } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Input";

type GenerateKind = "receive" | "payment" | "merchant" | "profile";

export default function UniversalQrPage() {
  const { primaryWallet } = useWallet();
  const scannerRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const scannerInstance = useRef<{ stop: () => Promise<void>; clear: () => void } | null>(null);
  const [rawValue, setRawValue] = useState("");
  const [generateKind, setGenerateKind] = useState<GenerateKind>("receive");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [scanError, setScanError] = useState<string | null>(null);

  const generatedValue = encodeUnitPayQr({
    kind: generateKind === "receive" || generateKind === "profile" ? "circle-wallet-id" : "merchant",
    value: primaryWallet?.id || "",
    route: generateKind === "receive" ? `/wallet/send?recipient=${primaryWallet?.id || ""}` : "/merchant",
    objectType:
      generateKind === "profile" || generateKind === "receive" ? "user" : "merchant",
    objectId: primaryWallet?.id,
  });
  const parsed = useMemo(() => (rawValue ? parseUnitPayQr(rawValue) : null), [rawValue]);

  async function startScanner() {
    if (!scannerRef.current) return;
    setScanError(null);
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode(scannerRef.current.id);
      scannerInstance.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          setRawValue(decodedText);
          void scanner.stop();
        },
        undefined,
      );
    } catch (err) {
      setScanError((err as Error).message ?? String(err));
    }
  }

  async function stopScanner() {
    await scannerInstance.current?.stop().catch(() => undefined);
    scannerInstance.current?.clear();
    scannerInstance.current = null;
  }

  async function decodeUploadedQr(file: File | null) {
    if (!file || !scannerRef.current) return;
    setScanError(null);
    await stopScanner();
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode(scannerRef.current.id);
      scannerInstance.current = scanner;
      const decodedText = await scanner.scanFile(file, true);
      setRawValue(decodedText);
      scanner.clear();
      scannerInstance.current = null;
    } catch (err) {
      setScanError((err as Error).message ?? String(err));
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <main className="px-4 sm:px-6 py-6 sm:py-8 max-w-md md:max-w-4xl mx-auto w-full space-y-6">
      <PageHeader title="Universal QR" backHref="/wallet" />
      <div className="grid md:grid-cols-2 gap-5">
        <Card className="space-y-4">
          <div className="flex items-center gap-2">
            <ScanLine className="w-5 h-5 text-primary" />
            <h2 className="font-medium">Scan or paste</h2>
          </div>
          <div id="unitpay-qr-scanner" ref={scannerRef} className="overflow-hidden rounded-xl bg-surface min-h-40" />
          <div className="grid grid-cols-3 gap-3">
            <Button onClick={startScanner} variant="secondary"><Camera className="w-4 h-4" /> Scan</Button>
            <Button onClick={() => fileInputRef.current?.click()} variant="secondary"><Upload className="w-4 h-4" /> Upload</Button>
            <Button onClick={stopScanner} variant="secondary">Stop</Button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => void decodeUploadedQr(event.target.files?.[0] ?? null)}
          />
          <Field label="QR payload">
            <Input value={rawValue} onChange={(event) => setRawValue(event.target.value)} />
          </Field>
          {scanError && <p className="text-error text-xs">{scanError}</p>}
          {parsed && (
            <div className="rounded-xl border border-border bg-surface px-3 py-3 space-y-1">
              <p className="text-xs text-muted">Recognized</p>
              <p className="text-sm font-medium">{parsed.kind.replaceAll("-", " ")}</p>
              <p className="text-xs font-mono break-all text-muted">{parsed.value}</p>
              {parsed.route && <LinkButton href={parsed.route} fullWidth>Open</LinkButton>}
            </div>
          )}
        </Card>
        <Card className="space-y-4">
          <h2 className="font-medium">Generate</h2>
          <Field label="QR type">
            <Select value={generateKind} onChange={(event) => setGenerateKind(event.target.value as GenerateKind)}>
              <option value="receive">Receive money</option>
              <option value="payment">Payment request</option>
              <option value="merchant">Merchant payment</option>
              <option value="profile">User profile</option>
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Amount">
              <Input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" />
            </Field>
            <Field label="Note">
              <Input value={note} onChange={(event) => setNote(event.target.value)} />
            </Field>
          </div>
          <div className="flex justify-center">
            <div className="bg-white p-4 rounded-xl">
              <QRCodeSVG value={generatedValue} size={200} />
            </div>
          </div>
          <p className="text-xs text-muted">
            QR codes encode the Circle Wallet ID when possible and route deep links directly to
            the right UnitPay screen.
          </p>
        </Card>
      </div>
    </main>
  );
}
