"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { listPodsRemote } from "@/lib/pods/client";
import { migrateLegacyPods } from "@/lib/pods/migrateLegacy";
import type { EscrowPodWithStats } from "@/lib/pods/types";
import { useWallet } from "@/lib/useWallet";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/Button";

export default function EscrowPodsPage() {
  const { primaryWallet, loading } = useWallet();
  const [pods, setPods] = useState<EscrowPodWithStats[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    async function refresh() {
      try {
        await migrateLegacyPods();
        setPods(await listPodsRemote());
      } catch (err) {
        setLoadError((err as Error).message ?? String(err));
      }
    }
    const timeout = window.setTimeout(() => void refresh(), 0);
    const interval = window.setInterval(() => void refresh(), 5000);
    return () => {
      window.clearTimeout(timeout);
      window.clearInterval(interval);
    };
  }, []);

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
        <p className="text-muted text-sm">No wallet found.</p>
      </main>
    );
  }

  return (
    <main className="px-4 sm:px-6 py-6 sm:py-8 max-w-md md:max-w-2xl mx-auto w-full space-y-6">
      <PageHeader title="Escrow Pods" backHref="/wallet" />

      {loadError && <p className="text-error text-sm">{loadError}</p>}

      <div className="grid grid-cols-2 gap-3">
        <LinkButton href="/wallet/pods/new" size="lg" fullWidth>
          Create Pod
        </LinkButton>
        <LinkButton href="/pods" variant="secondary" size="lg" fullWidth>
          Discover
        </LinkButton>
      </div>

      {pods.length === 0 ? (
        <Card className="text-sm text-muted text-center py-8">
          No pods yet. Create a public pod for discovery or a private pod to share by invite link.
        </Card>
      ) : (
        <div className="space-y-3">
          {pods.map((pod) => (
            <Link key={pod.id} href={`/wallet/pods/${pod.id}`}>
              <Card className="space-y-1 hover:border-primary/40 transition-colors">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium truncate">{pod.title}</p>
                  <span className="text-xs text-muted">{pod.status}</span>
                </div>
                <p className="text-xs text-muted line-clamp-2">{pod.description}</p>
                <p className="text-xs text-subtle">
                  {pod.visibility === "public" ? "Public" : "Private"}
                  {pod.targetAmount ? ` · Target ${pod.targetAmount} USDC` : " · No target"}
                  {pod.paymentLink ? " · Payment link" : ""}
                </p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
