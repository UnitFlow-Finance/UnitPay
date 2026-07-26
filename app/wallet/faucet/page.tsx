"use client";

import Link from "next/link";
import { useState } from "react";
import { DEFAULT_SELECTOR_CHAINS, getChain } from "@/lib/chains/config";
import { useWallet } from "@/lib/useWallet";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, DashedCard } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/Button";
import { Field, Select } from "@/components/ui/Input";

/**
 * "Acquire USDC" flow — replaces the removed fiat on/off-ramp centerpiece.
 * Circle does not currently expose a public faucet-dispensing API for
 * arbitrary third-party apps; https://faucet.circle.com is a hosted UI that
 * requires the user to interact with it directly (captcha-gated). We link
 * out to it with the wallet address pre-filled where the URL scheme allows,
 * and walk the user through the manual steps otherwise.
 */
export default function FaucetPage() {
  const { primaryWallet, loading } = useWallet();
  const [selectedChainKey, setSelectedChainKey] = useState<string>(DEFAULT_SELECTOR_CHAINS[0]);

  const chain = getChain(selectedChainKey);

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
    <main className="px-4 sm:px-6 py-6 sm:py-8 max-w-md md:max-w-lg mx-auto w-full space-y-6">
      <PageHeader title="Get testnet USDC" backHref="/wallet" />

      <p className="text-sm text-muted">
        UnitPay is a testnet-only demo. There is no real-money on-ramp. Fund your wallet using
        Circle&apos;s public testnet faucet.
      </p>

      <Field label="Chain to receive faucet USDC on">
        <Select value={selectedChainKey} onChange={(e) => setSelectedChainKey(e.target.value)}>
          {DEFAULT_SELECTOR_CHAINS.map((key) => (
            <option key={key} value={key}>
              {getChain(key).label}
            </option>
          ))}
        </Select>
      </Field>

      <Card className="space-y-3">
        <p className="text-sm font-medium">Steps</p>
        <ol className="text-sm text-muted space-y-2 list-decimal list-inside">
          <li>
            Copy your {chain.label} wallet address:
            <code className="block mt-1 text-xs break-all bg-background rounded-lg px-2 py-1.5">
              {primaryWallet.address}
            </code>
          </li>
          <li>
            Open the{" "}
            <a
              href={chain.faucetUrl}
              target="_blank"
              rel="noreferrer"
              className="text-accent underline"
            >
              {chain.label} faucet
            </a>{" "}
            in a new tab.
          </li>
          <li>Paste your address, select USDC (and native gas if offered), and submit.</li>
          <li>Return here and refresh your balance — funds typically arrive within seconds.</li>
        </ol>
      </Card>

      {chain.usdcIsNativeGas && (
        <p className="text-xs text-accent">
          {chain.label} has no separate native gas token — the USDC you receive from the faucet
          covers both your balance and your gas costs.
        </p>
      )}

      <DashedCard>
        Once you have testnet USDC on any supported chain, you can deposit it into your{" "}
        <Link href="/wallet/unified" className="text-accent underline">
          Gateway unified balance
        </Link>{" "}
        to spend it across chains.
      </DashedCard>

      <LinkButton href="/wallet" size="lg" fullWidth className="text-center">
        Back to wallet
      </LinkButton>
    </main>
  );
}
