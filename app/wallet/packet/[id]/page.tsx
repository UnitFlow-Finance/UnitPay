"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiPost } from "@/lib/api";
import { useCircleSdk } from "@/lib/circle/sdkContext";
import { useWallet } from "@/lib/useWallet";
import { usdcFromBaseUnits } from "@/lib/units";
import {
  readPacket,
  readHasClaimed,
  readPacketClaims,
  type PacketRecord,
  type PacketClaimRecord,
} from "@/lib/packet/contract";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

type ActionStep = "idle" | "working" | "error";

/**
 * Packet claim page. Anyone with this URL can view it — no wallet or login
 * required to see the packet's status. Claiming itself needs a UnitPay
 * wallet (an on-chain USDC transfer needs a destination address the
 * visitor controls), so logged-out visitors are shown a "register or log
 * in" CTA that carries this exact URL via `?next=` and returns them here
 * once their wallet is ready — see /onboarding/wallet and
 * /onboarding/login.
 */
export default function PacketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { primaryWallet, loading: walletLoading } = useWallet();
  const { executeChallenge } = useCircleSdk();

  const [packet, setPacket] = useState<PacketRecord | null>(null);
  const [hasClaimed, setHasClaimed] = useState(false);
  const [claims, setClaims] = useState<PacketClaimRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [actionStep, setActionStep] = useState<ActionStep>("idle");
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  // Captured once at mount rather than read via Date.now() during render.
  const [nowSeconds] = useState(() => BigInt(Math.floor(Date.now() / 1000)));

  const myAddress = primaryWallet?.address;

  const loadPacket = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [record, claimHistory] = await Promise.all([
        readPacket(BigInt(id)),
        readPacketClaims(BigInt(id)),
      ]);
      setPacket(record);
      setClaims(claimHistory);
      if (myAddress) {
        setHasClaimed(await readHasClaimed(BigInt(id), myAddress as `0x${string}`));
      }
    } catch (err) {
      setLoadError((err as Error).message ?? String(err));
    } finally {
      setLoading(false);
    }
  }, [id, myAddress]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await loadPacket();
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
  }, [loadPacket]);

  async function handleClaim() {
    if (!primaryWallet) return;
    setActionStep("working");
    setActionMessage("Claiming your share...");
    try {
      const userToken = window.localStorage.getItem("unitpay.userToken");
      if (!userToken) throw new Error("Session expired — please reload.");

      const { challengeId } = await apiPost<{ challengeId: string }>("/api/packet/claim", {
        userToken,
        walletId: primaryWallet.id,
        packetId: id,
      });
      await executeChallenge(challengeId);

      setActionStep("idle");
      setActionMessage(null);
      await loadPacket();
    } catch (err) {
      setActionStep("error");
      setActionMessage((err as Error).message ?? String(err));
    }
  }

  async function copyLink() {
    const url = `${window.location.origin}/wallet/packet/${id}`;
    await navigator.clipboard.writeText(url);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 1500);
  }

  async function handleReclaim() {
    if (!primaryWallet) return;
    setActionStep("working");
    setActionMessage("Reclaiming unclaimed funds...");
    try {
      const userToken = window.localStorage.getItem("unitpay.userToken");
      if (!userToken) throw new Error("Session expired — please reload.");

      const { challengeId } = await apiPost<{ challengeId: string }>("/api/packet/reclaim", {
        userToken,
        walletId: primaryWallet.id,
        packetId: id,
      });
      await executeChallenge(challengeId);

      setActionStep("idle");
      setActionMessage(null);
      await loadPacket();
    } catch (err) {
      setActionStep("error");
      setActionMessage((err as Error).message ?? String(err));
    }
  }

  if (loading) {
    return (
      <main className="min-h-full flex items-center justify-center">
        <p className="text-muted text-sm">Loading packet...</p>
      </main>
    );
  }

  if (loadError || !packet) {
    return (
      <main className="min-h-full flex items-center justify-center px-6">
        <p className="text-error text-sm text-center">{loadError ?? "Packet not found."}</p>
      </main>
    );
  }

  const isCreator = myAddress?.toLowerCase() === packet.creator.toLowerCase();
  const isExpired = nowSeconds > packet.expiresAt;
  const isFullyClaimed = packet.claimsMade >= packet.maxClaims;

  const canClaim = !isFullyClaimed && !isExpired && !hasClaimed && !!primaryWallet;
  const canReclaim =
    isCreator && isExpired && !packet.reclaimed && packet.remainingAmount > 0n;

  return (
    <main className="px-4 sm:px-6 py-6 sm:py-8 max-w-md md:max-w-lg mx-auto w-full space-y-6">
      <PageHeader title={`Packet #${packet.id.toString()}`} backHref="/wallet/packet" />

      <Button onClick={copyLink} variant="secondary" fullWidth>
        {linkCopied ? "Copied!" : "Copy claim link"}
      </Button>

      <Card className="space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-muted">Split</span>
          <span className="font-medium">{packet.splitMode}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted">Remaining</span>
          <span className="font-medium">
            {usdcFromBaseUnits(packet.remainingAmount)} / {usdcFromBaseUnits(packet.totalAmount)}{" "}
            USDC
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted">Claimed</span>
          <span className="font-medium">
            {packet.claimsMade} / {packet.maxClaims}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted">Creator</span>
          <span className="font-mono text-xs">
            {packet.creator.slice(0, 8)}…{packet.creator.slice(-6)}
            {isCreator && " (you)"}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted">Expires</span>
          <span>{new Date(Number(packet.expiresAt) * 1000).toLocaleString()}</span>
        </div>
      </Card>

      {!walletLoading && !primaryWallet ? (
        <Card className="space-y-3 text-center py-5">
          {isFullyClaimed ? (
            <p className="text-sm text-muted">All shares have been claimed.</p>
          ) : isExpired ? (
            <p className="text-sm text-muted">This packet has expired and can no longer be claimed.</p>
          ) : (
            <>
              <p className="text-sm text-muted">
                You need a UnitPay wallet to claim your share of this packet.
              </p>
              <Link
                href={`/onboarding/wallet?next=${encodeURIComponent(`/wallet/packet/${id}`)}`}
              >
                <Button size="lg" fullWidth>
                  Create a wallet to claim
                </Button>
              </Link>
              <Link
                href={`/onboarding/login?next=${encodeURIComponent(`/wallet/packet/${id}`)}`}
                className="block text-xs text-muted hover:text-foreground transition-colors"
              >
                Already have a wallet? Log in
              </Link>
            </>
          )}
        </Card>
      ) : !primaryWallet ? null : (
        <div className="space-y-3">
          {hasClaimed && (
            <Card className="text-sm text-success text-center py-4">
              You already claimed your share from this packet.
            </Card>
          )}
          {canClaim && (
            <Button
              onClick={handleClaim}
              disabled={actionStep === "working"}
              size="lg"
              fullWidth
            >
              Claim my share
            </Button>
          )}
          {!canClaim && !hasClaimed && isFullyClaimed && (
            <Card className="text-sm text-muted text-center py-4">
              All shares have been claimed.
            </Card>
          )}
          {!canClaim && !hasClaimed && isExpired && !isFullyClaimed && (
            <Card className="text-sm text-muted text-center py-4">
              This packet has expired and can no longer be claimed.
            </Card>
          )}
          {canReclaim && (
            <Button
              onClick={handleReclaim}
              disabled={actionStep === "working"}
              variant="secondary"
              size="lg"
              fullWidth
            >
              Reclaim unclaimed funds
            </Button>
          )}
          {actionMessage && (
            <p className={`text-xs ${actionStep === "error" ? "text-error" : "text-muted"}`}>
              {actionMessage}
            </p>
          )}
        </div>
      )}

      {claims.length > 0 && (
        <Card className="space-y-2">
          <p className="text-xs text-muted uppercase tracking-wide">Claim history</p>
          <div className="space-y-2">
            {claims.map((claim, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="font-mono text-xs text-muted">
                  {claim.claimer.slice(0, 8)}…{claim.claimer.slice(-6)}
                </span>
                <span className="font-medium">{usdcFromBaseUnits(claim.amount)} USDC</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </main>
  );
}
