"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { listPodsRemote } from "@/lib/pods/client";
import type { EscrowPodWithStats } from "@/lib/pods/types";
import { Logo } from "@/components/Logo";
import { Card } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/Button";

export default function PublicPodsPage() {
  const [pods, setPods] = useState<EscrowPodWithStats[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    async function refresh() {
      try {
        setPods(await listPodsRemote("public"));
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

  return (
    <main className="min-h-full px-4 sm:px-6 py-6 sm:py-8 max-w-md md:max-w-2xl mx-auto w-full space-y-6">
      <div className="flex items-center justify-between gap-4">
        <Logo size={32} />
        <LinkButton href="/wallet/pods/new" size="md">
          Create Pod
        </LinkButton>
      </div>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Public Escrow Pods</h1>
        <p className="text-sm text-muted mt-1">
          Discover collaborative funding pods and contribute from a UnitPay wallet.
        </p>
      </div>

      {loadError && <p className="text-error text-sm">{loadError}</p>}

      {pods.length === 0 ? (
        <Card className="text-sm text-muted text-center py-8">
          No public pods have been created in this browser yet.
        </Card>
      ) : (
        <div className="space-y-3">
          {pods.map((pod) => (
            <Link key={pod.id} href={`/pods/${pod.id}`}>
              <Card className="space-y-1 hover:border-primary/40 transition-colors">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium truncate">{pod.title}</p>
                  <span className="text-xs text-muted">{pod.status}</span>
                </div>
                <p className="text-xs text-muted line-clamp-2">{pod.description}</p>
                <p className="text-xs text-subtle">
                  {pod.targetAmount ? `Target ${pod.targetAmount} USDC` : "Flexible target"}
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
