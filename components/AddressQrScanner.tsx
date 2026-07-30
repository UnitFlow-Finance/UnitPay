"use client";

import { useId, useRef, useState } from "react";
import { Camera, X } from "lucide-react";
import { parseUnitPayQr } from "@/lib/platform/qr";
import { Button } from "@/components/ui/Button";

export function AddressQrScanner({ onValue }: { onValue: (value: string) => void }) {
  const scannerRef = useRef<HTMLDivElement | null>(null);
  const scannerInstance = useRef<{ stop: () => Promise<void>; clear: () => void } | null>(null);
  const scannerId = useId();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function stopScanner() {
    await scannerInstance.current?.stop().catch(() => undefined);
    scannerInstance.current?.clear();
    scannerInstance.current = null;
    setOpen(false);
  }

  async function startScanner() {
    setOpen(true);
    setError(null);
    window.setTimeout(async () => {
      if (!scannerRef.current) return;
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        const scanner = new Html5Qrcode(scannerRef.current.id);
        scannerInstance.current = scanner;
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (decodedText) => {
            const parsed = parseUnitPayQr(decodedText);
            onValue(parsed.value || decodedText);
            void stopScanner();
          },
          undefined,
        );
      } catch (err) {
        setError((err as Error).message ?? String(err));
      }
    }, 0);
  }

  return (
    <div className="space-y-2">
      <Button type="button" onClick={open ? stopScanner : startScanner} variant="secondary" fullWidth>
        {open ? <X className="w-4 h-4" /> : <Camera className="w-4 h-4" />}
        {open ? "Close scanner" : "Scan QR"}
      </Button>
      {open && (
        <div
          id={scannerId}
          ref={scannerRef}
          className="overflow-hidden rounded-xl border border-border bg-surface min-h-48"
        />
      )}
      {error && <p className="text-error text-xs">{error}</p>}
    </div>
  );
}
