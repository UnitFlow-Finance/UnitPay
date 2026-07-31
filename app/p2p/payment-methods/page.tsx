"use client";

import { P2P_PAYMENT_METHODS } from "@/lib/p2p/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";

export default function P2PPaymentMethodsPage() {
  return (
    <main className="px-4 sm:px-6 py-6 sm:py-8 max-w-md md:max-w-3xl mx-auto w-full space-y-6">
      <PageHeader title="Payment Methods" backHref="/p2p" />
      <Card className="space-y-3">
        <p className="text-sm text-muted">Supported fiat settlement rails for P2P offers.</p>
        <div className="grid sm:grid-cols-2 gap-2">
          {P2P_PAYMENT_METHODS.map((method) => (
            <div key={method} className="rounded-xl border border-border bg-background px-3 py-2 text-sm">
              {method}
            </div>
          ))}
        </div>
      </Card>
    </main>
  );
}
