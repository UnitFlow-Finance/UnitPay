"use client";

import {
  CHAINS,
  SOLANA_GATEWAY_SUPPORTED_WALLETS,
  SOLANA_GATEWAY_WALLET_COMPAT_WARNING,
} from "@/lib/chains/config";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";

/**
 * Solana Devnet Gateway path — deliberately built defensively per the
 * product spec's explicit caveat: only Solflare currently supports the
 * arbitrary-message signing Gateway needs for burn intents. Phantom and
 * most other Solana wallets will reject that signing request outright.
 *
 * This build does not implement a live Solana wallet-adapter connection
 * (out of scope for the core Circle Wallets + Gateway EVM flows this demo
 * focuses on) — it exists to make the compatibility constraint visible in
 * the product rather than have Solana users hit a silent, confusing
 * failure deep in a signing flow.
 */
export default function SolanaGatewayPage() {
  const solana = CHAINS.solanaDevnet;

  return (
    <main className="px-4 sm:px-6 py-6 sm:py-8 max-w-md md:max-w-lg mx-auto w-full space-y-6">
      <PageHeader title="Solana Devnet (Gateway)" backHref="/wallet/unified" />

      <div className="rounded-2xl bg-warning/10 border border-warning/40 p-4 space-y-2">
        <p className="text-sm font-medium text-warning">Wallet compatibility warning</p>
        <p className="text-sm text-muted">{SOLANA_GATEWAY_WALLET_COMPAT_WARNING}</p>
        <p className="text-xs text-muted">
          Supported wallets today: {SOLANA_GATEWAY_SUPPORTED_WALLETS.join(", ")}
        </p>
      </div>

      <Card className="text-sm text-muted space-y-2">
        <p>
          Gateway&apos;s Solana Devnet support ({solana.label}) is not wired into this build&apos;s
          Circle User-Controlled Wallets flow — Circle Wallets currently issues EVM-style wallets
          for this app&apos;s account type, and a native Solana burn-intent signing flow needs a
          Solflare-connected wallet adapter, not a PIN-challenge signature.
        </p>
        <p>
          This screen intentionally stops here rather than presenting a broken send flow. If you
          need to prototype the Solana path, connect Solflare directly against Gateway&apos;s
          Solana quickstart outside of UnitPay&apos;s Circle-Wallets flow.
        </p>
      </Card>

      <p className="text-xs text-muted">Faucet: {solana.faucetUrl}</p>
    </main>
  );
}
