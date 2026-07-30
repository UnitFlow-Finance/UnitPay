"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiPost } from "@/lib/api";
import { useCircleSdk } from "@/lib/circle/sdkContext";
import { useWallet } from "@/lib/useWallet";
import { walletForChainKey } from "@/lib/wallet/selectors";
import { findPacketIdForCreator } from "@/lib/packet/contract";
import { usdcToBaseUnits } from "@/lib/units";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";

type Step = "form" | "working" | "done" | "error";

const EXPIRY_OPTIONS: { label: string; seconds: number }[] = [
  { label: "1 hour", seconds: 60 * 60 },
  { label: "24 hours", seconds: 24 * 60 * 60 },
  { label: "7 days", seconds: 7 * 24 * 60 * 60 },
  { label: "30 days", seconds: 30 * 24 * 60 * 60 },
];

/**
 * Creates a Unit Packet: approve() + createPacket() (see /api/packet/*),
 * then produces a single shareable claim link (`/wallet/packet/{id}`).
 * The equal/random split math runs entirely on-chain (see
 * UnitPayPacket.sol) — this page never computes shares itself.
 */
export default function NewPacketPage() {
  const router = useRouter();
  const { wallets } = useWallet();
  const { executeChallenge } = useCircleSdk();

  const [amount, setAmount] = useState("");
  const [maxClaims, setMaxClaims] = useState("");
  const [splitMode, setSplitMode] = useState<0 | 1>(0);
  const [expiresInSeconds, setExpiresInSeconds] = useState(EXPIRY_OPTIONS[1].seconds);

  const [step, setStep] = useState<Step>("form");
  const [message, setMessage] = useState<string | null>(null);
  const [packetId, setPacketId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const arcWallet = walletForChainKey(wallets, "arcTestnet");

  if (!arcWallet) {
    return (
      <main className="min-h-full flex items-center justify-center px-6">
        <p className="text-muted text-sm">No wallet found.</p>
      </main>
    );
  }

  function validate(): string | null {
    const amt = Number(amount);
    if (!amount || Number.isNaN(amt) || amt <= 0) return "Enter a valid amount.";
    const claims = Number(maxClaims);
    if (!maxClaims || !Number.isInteger(claims) || claims <= 0) {
      return "Enter a valid number of claims.";
    }
    if (claims > 200) return "Max claims per packet is 200.";
    return null;
  }

  async function handleCreate() {
    const validationError = validate();
    if (validationError) {
      setMessage(validationError);
      return;
    }

    setStep("working");
    setMessage("Approving UnitPayPacket to lock your USDC...");
    try {
      if (!arcWallet) throw new Error("Create an Arc Testnet wallet before creating a packet.");
      const userToken = window.localStorage.getItem("unitpay.userToken");
      if (!userToken) throw new Error("Session expired — please reload.");

      const { challengeId: approveChallengeId } = await apiPost<{ challengeId: string }>(
        "/api/packet/approve",
        { userToken, walletId: arcWallet.id, amount },
      );
      await executeChallenge(approveChallengeId);

      setMessage("Creating packet and locking funds...");
      const claims = Number(maxClaims);
      const { challengeId: createChallengeId } = await apiPost<{ challengeId: string }>(
        "/api/packet/create",
        {
          userToken,
          walletId: arcWallet.id,
          amount,
          maxClaims: claims,
          splitMode,
          expiresInSeconds,
        },
      );
      await executeChallenge(createChallengeId);

      // createPacket's returned packetId isn't surfaced by the PIN
      // challenge result, so it's looked up from the PacketCreated event
      // matching this creator + totalAmount + maxClaims.
      setMessage("Confirming on-chain...");
      const foundId = await findPacketIdForCreator(arcWallet.address as `0x${string}`, {
        totalAmount: usdcToBaseUnits(amount),
        maxClaims: claims,
      });
      setPacketId(foundId !== null ? foundId.toString() : null);
      setStep("done");
    } catch (err) {
      setMessage((err as Error).message ?? String(err));
      setStep("error");
    }
  }

  async function copyLink() {
    if (!packetId) return;
    const url = `${window.location.origin}/wallet/packet/${packetId}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const packetLink =
    typeof window !== "undefined" && packetId
      ? `${window.location.origin}/wallet/packet/${packetId}`
      : null;

  return (
    <main className="px-4 sm:px-6 py-6 sm:py-8 max-w-md md:max-w-lg mx-auto w-full space-y-6">
      <PageHeader title="New Unit Packet" backHref="/wallet/packet" />

      {step === "form" && (
        <div className="space-y-4">
          <Card className="space-y-4">
            <Field label="Total amount (USDC)">
              <Input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                inputMode="decimal"
              />
            </Field>
            <Field label="Number of claims">
              <Input
                value={maxClaims}
                onChange={(e) => setMaxClaims(e.target.value)}
                placeholder="e.g. 10"
                inputMode="numeric"
              />
            </Field>
            <Field label="Split">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSplitMode(0)}
                  className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${
                    splitMode === 0
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted hover:border-primary/40"
                  }`}
                >
                  Equal
                </button>
                <button
                  type="button"
                  onClick={() => setSplitMode(1)}
                  className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${
                    splitMode === 1
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted hover:border-primary/40"
                  }`}
                >
                  Random
                </button>
              </div>
              <p className="text-xs text-muted pt-1">
                {splitMode === 0
                  ? "Every claim gets the same amount."
                  : "Each claim gets a random share (on-chain pseudo-randomness) — like a red envelope. Later claimers see what's left."}
              </p>
            </Field>
            <Field label="Expires in">
              <div className="grid grid-cols-4 gap-2">
                {EXPIRY_OPTIONS.map((opt) => (
                  <button
                    key={opt.seconds}
                    type="button"
                    onClick={() => setExpiresInSeconds(opt.seconds)}
                    className={`rounded-xl border px-2 py-2 text-xs font-medium transition-colors ${
                      expiresInSeconds === opt.seconds
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted hover:border-primary/40"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted pt-1">
                Any unclaimed balance can be reclaimed by you after this time.
              </p>
            </Field>
          </Card>

          {message && <p className="text-error text-sm">{message}</p>}

          <Button onClick={handleCreate} size="lg" fullWidth>
            Lock funds &amp; create packet
          </Button>
        </div>
      )}

      {step === "working" && (
        <p className="text-muted text-sm text-center py-8">{message}</p>
      )}

      {step === "done" && (
        <div className="space-y-4">
          <Card className="text-center py-6 space-y-2">
            <p className="text-success font-medium">Packet created</p>
            <p className="text-muted text-sm">
              {amount} USDC is locked across {maxClaims} claims. Share the link below —
              anyone with an UnitPay account can claim a share until they&apos;re all gone.
            </p>
            {packetLink ? (
              <div className="text-left pt-2 space-y-1.5">
                <p className="text-xs text-muted">Generated UnitPacket link</p>
                <code className="block text-xs break-all bg-background rounded-lg px-2.5 py-2">
                  {packetLink}
                </code>
              </div>
            ) : (
              <p className="text-error text-xs">
                Packet was created, but the on-chain id could not be found yet. Open your packet
                list and copy the link from the packet detail page.
              </p>
            )}
          </Card>
          <Button onClick={copyLink} size="lg" fullWidth disabled={!packetId}>
            {copied ? "Copied!" : "Copy claim link"}
          </Button>
          <Button
            onClick={() => router.push(packetId ? `/wallet/packet/${packetId}` : "/wallet/packet")}
            variant="secondary"
            size="lg"
            fullWidth
          >
            {packetId ? "View packet" : "View my packets"}
          </Button>
        </div>
      )}

      {step === "error" && (
        <div className="space-y-4 text-center py-6">
          <p className="text-error font-medium">Could not create packet</p>
          <p className="text-muted text-sm">{message}</p>
          <Button onClick={() => setStep("form")} variant="secondary" size="lg" fullWidth>
            Try again
          </Button>
        </div>
      )}
    </main>
  );
}
