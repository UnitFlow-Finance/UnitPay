"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogOut } from "lucide-react";
import { useCircleSdk } from "@/lib/circle/sdkContext";
import { useWallet } from "@/lib/useWallet";
import { chainLabelForBlockchain } from "@/lib/chains/lookup";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

/**
 * Account settings: surfaces the two identifiers that matter for a Circle
 * User-Controlled Wallet — the wallet ID (on-chain identity) and the
 * recovery code (this browser's login credential, i.e. the Circle userId
 * minted in /onboarding/wallet) — plus sign-out.
 *
 * The recovery code is already persisted in localStorage by
 * CircleSdkProvider and re-used automatically on every visit (see
 * app/page.tsx's redirect check), so "remember me" is always-on rather
 * than an opt-in toggle here.
 */
export default function SettingsPage() {
  const router = useRouter();
  const { userId, signOut } = useCircleSdk();
  const { loading, primaryWallet } = useWallet();
  const [copiedField, setCopiedField] = useState<"wallet" | "recovery" | null>(null);

  async function copy(field: "wallet" | "recovery", value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      // Clipboard API unavailable — user can still select + copy manually.
    }
  }

  function handleLogout() {
    signOut();
    router.push("/onboarding");
  }

  return (
    <main className="px-4 sm:px-6 py-6 sm:py-8 max-w-md md:max-w-lg mx-auto w-full space-y-6">
      <PageHeader title="Settings" backHref="/wallet" />

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-muted uppercase tracking-wide">Wallet</h2>
        <Card className="space-y-4">
          {loading ? (
            <p className="text-sm text-muted">Loading wallet...</p>
          ) : primaryWallet ? (
            <>
              <div className="space-y-1.5">
                <p className="text-xs text-muted">Chain</p>
                <p className="text-sm font-medium">
                  {chainLabelForBlockchain(primaryWallet.blockchain)}
                </p>
              </div>

              <div className="space-y-1.5">
                <p className="text-xs text-muted">Wallet ID</p>
                <code className="block text-xs break-all bg-background rounded-lg px-2.5 py-2">
                  {primaryWallet.id}
                </code>
                <button
                  onClick={() => copy("wallet", primaryWallet.id)}
                  className="text-xs text-accent hover:text-primary transition-colors"
                >
                  {copiedField === "wallet" ? "Copied!" : "Copy wallet ID"}
                </button>
              </div>

              <div className="space-y-1.5">
                <p className="text-xs text-muted">Address</p>
                <code className="block text-xs break-all bg-background rounded-lg px-2.5 py-2">
                  {primaryWallet.address}
                </code>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted">No wallet found.</p>
          )}
        </Card>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-muted uppercase tracking-wide">
          Recovery code
        </h2>
        <Card className="space-y-3">
          <p className="text-xs text-muted leading-relaxed">
            This is the only way to log back into this wallet from a different browser or
            device. This browser remembers it automatically — you only need it if you log in
            elsewhere.
          </p>
          {userId ? (
            <>
              <code className="block text-xs break-all bg-background rounded-lg px-2.5 py-2 font-mono">
                {userId}
              </code>
              <button
                onClick={() => copy("recovery", userId)}
                className="text-xs text-accent hover:text-primary transition-colors"
              >
                {copiedField === "recovery" ? "Copied!" : "Copy recovery code"}
              </button>
            </>
          ) : (
            <p className="text-sm text-muted">No recovery code found.</p>
          )}
        </Card>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-muted uppercase tracking-wide">Session</h2>
        <Card>
          <Button onClick={handleLogout} variant="secondary" fullWidth>
            <LogOut className="w-4 h-4" /> Log out
          </Button>
          <p className="text-xs text-subtle mt-3 leading-relaxed">
            Signs you out of this browser. Make sure you&apos;ve saved your recovery code
            above first — without it you cannot log back in.
          </p>
        </Card>
      </section>
    </main>
  );
}
