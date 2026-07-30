"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { getPodRemote } from "@/lib/pods/client";
import type { EscrowPodWithStats } from "@/lib/pods/types";
import { Logo } from "@/components/Logo";
import { Card } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/Button";

export default function PublicPodDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [pod, setPod] = useState<EscrowPodWithStats | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState("");

  useEffect(() => {
    queueMicrotask(() => setShareUrl(window.location.href));
    const timeout = window.setTimeout(() => {
      void (async () => {
        try {
          setLoadError(null);
          const nextPod = await getPodRemote(id);
          if (!nextPod) {
            setLoadError("Pod not found.");
            return;
          }
          setPod(nextPod);
        } catch (err) {
          setLoadError((err as Error).message ?? String(err));
        }
      })();
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [id]);

  if (!pod) {
    return (
      <main className="min-h-full flex items-center justify-center px-6">
        <p className="text-error text-sm text-center">{loadError ?? "Loading pod..."}</p>
      </main>
    );
  }

  const isPrivate = pod.visibility === "private";

  return (
    <main className="min-h-full px-4 sm:px-6 py-6 sm:py-8 max-w-md md:max-w-2xl mx-auto w-full space-y-6">
      <div className="flex items-center justify-between gap-4">
        <Logo size={32} />
        <LinkButton href="/pods" variant="secondary">
          Discovery
        </LinkButton>
      </div>

      <Card className="space-y-5">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-muted">
              {isPrivate ? "Invite-only pod" : "Public pod"}
            </span>
            <span className="text-xs font-medium">{pod.status}</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{pod.title}</h1>
          <p className="text-sm text-muted whitespace-pre-wrap">{pod.description}</p>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-muted">Raised</p>
            <p className="font-medium">{pod.totalContributed.toFixed(2)} USDC</p>
          </div>
          <div>
            <p className="text-xs text-muted">Target</p>
            <p className="font-medium">{pod.targetAmount ?? "Flexible"} USDC</p>
          </div>
        </div>

        {pod.progress !== null && (
          <div className="space-y-2">
            <div className="h-2 rounded-full bg-surface overflow-hidden">
              <div className="h-full bg-primary" style={{ width: `${pod.progress}%` }} />
            </div>
            <div className="flex justify-between text-xs text-muted">
              <span>{pod.progress.toFixed(0)}% funded</span>
              {pod.remainingAmount !== null && <span>{pod.remainingAmount.toFixed(2)} USDC left</span>}
            </div>
          </div>
        )}

        {pod.paymentLink && (
          <div className="rounded-xl border border-border bg-surface px-3 py-3 space-y-1">
            <p className="text-xs text-muted">Collaborative payment link</p>
            <Link href={pod.paymentLink.urlPath} className="text-sm text-accent underline">
              Open original payment request
            </Link>
          </div>
        )}

        {shareUrl && (
          <div className="flex justify-center">
            <div className="bg-white p-3 rounded-xl">
              <QRCodeSVG value={shareUrl} size={152} />
            </div>
          </div>
        )}

        <LinkButton href={`/wallet/pods/${pod.id}`} size="lg" fullWidth>
          Contribute from UnitPay
        </LinkButton>
      </Card>

      <Card className="space-y-3">
        <p className="text-xs text-muted uppercase tracking-wide">Contributors</p>
        {pod.contributions.length === 0 ? (
          <p className="text-sm text-muted">No contributions yet.</p>
        ) : (
          pod.contributions.map((contribution) => (
            <div key={contribution.id} className="flex justify-between gap-3 text-sm">
              <span className="font-mono text-xs text-muted truncate">
                {contribution.contributorAddress.slice(0, 8)}...
                {contribution.contributorAddress.slice(-6)}
              </span>
              <span className="font-medium">{contribution.amount} USDC</span>
            </div>
          ))
        )}
      </Card>

      {pod.activity.length > 0 && (
        <Card className="space-y-3">
          <p className="text-xs text-muted uppercase tracking-wide">Activity</p>
          {pod.activity.map((event) => (
            <div key={event.id} className="text-sm">
              <p>{event.message}</p>
              <p className="text-xs text-muted">{new Date(event.createdAt).toLocaleString()}</p>
            </div>
          ))}
        </Card>
      )}
    </main>
  );
}
