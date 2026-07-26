"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { listPublicEscrowPods, type EscrowPod } from "@/lib/escrowPods";
import { Logo } from "@/components/Logo";
import { Card } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/Button";

export default function PublicPodsPage() {
  const [pods, setPods] = useState<EscrowPod[]>([]);

  useEffect(() => {
    queueMicrotask(() => setPods(listPublicEscrowPods()));
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

      {pods.length === 0 ? (
        <Card className="text-sm text-muted text-center py-8">
          No public pods have been created in this browser yet.
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
                  {pod.targetAmount ? `Target ${pod.targetAmount} USDC` : "Flexible target"}
                </p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
