"use client";

import { useEffect, useState } from "react";
import { DEFAULT_SELECTOR_CHAINS, getChain } from "@/lib/chains/config";
import type { SupportedToken } from "@/lib/platform/tokens";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Input";

export default function TokenRegistryPage() {
  const [tokens, setTokens] = useState<SupportedToken[]>([]);
  const [chainKey, setChainKey] = useState<string>(DEFAULT_SELECTOR_CHAINS[0]);
  const [contractAddress, setContractAddress] = useState("");
  const [symbol, setSymbol] = useState("");
  const [name, setName] = useState("");
  const [decimals, setDecimals] = useState("18");
  const [message, setMessage] = useState<string | null>(null);

  async function refresh() {
    const response = await fetch("/api/tokens", { cache: "no-store" });
    const body = (await response.json()) as { tokens: SupportedToken[] };
    setTokens(body.tokens);
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timeout);
  }, []);

  async function addToken() {
    setMessage(null);
    const response = await fetch("/api/tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chainKey, contractAddress, symbol, name, decimals: Number(decimals) }),
    });
    const body = await response.json();
    if (!response.ok) {
      setMessage(body.error ?? "Token could not be added.");
      return;
    }
    setContractAddress("");
    setSymbol("");
    setName("");
    setMessage("Token added.");
    await refresh();
  }

  return (
    <main className="px-4 sm:px-6 py-6 sm:py-8 max-w-md md:max-w-4xl mx-auto w-full space-y-6">
      <PageHeader title="Token Registry" backHref="/wallet" />
      <Card className="space-y-4">
        <p className="text-sm text-muted">
          USDC, EURC, and CIRBTC are enabled across every supported Gateway testnet. Add custom
          ERC-20 assets for administrator-defined networks or app-specific tokens.
        </p>
        <div className="grid md:grid-cols-2 gap-3">
          <Field label="Chain">
            <Select value={chainKey} onChange={(event) => setChainKey(event.target.value)}>
              {DEFAULT_SELECTOR_CHAINS.map((key) => (
                <option key={key} value={key}>{getChain(key).label}</option>
              ))}
            </Select>
          </Field>
          <Field label="Contract address">
            <Input value={contractAddress} onChange={(event) => setContractAddress(event.target.value)} className="font-mono" />
          </Field>
          <Field label="Symbol">
            <Input value={symbol} onChange={(event) => setSymbol(event.target.value)} />
          </Field>
          <Field label="Name">
            <Input value={name} onChange={(event) => setName(event.target.value)} />
          </Field>
          <Field label="Decimals">
            <Input value={decimals} onChange={(event) => setDecimals(event.target.value)} inputMode="numeric" />
          </Field>
        </div>
        <Button onClick={addToken} disabled={!contractAddress} fullWidth>Add token</Button>
        {message && <p className="text-xs text-muted">{message}</p>}
      </Card>
      <div className="grid md:grid-cols-2 gap-3">
        {tokens.map((token) => (
          <Card key={token.id} className="space-y-1">
            <div className="flex justify-between gap-3">
              <p className="font-medium">{token.symbol}</p>
              <span className="text-xs text-muted">{token.defaultAsset ? "Default" : "Custom"}</span>
            </div>
            <p className="text-xs text-muted">{token.name} · {token.chainLabel}</p>
            <p className="text-xs font-mono text-subtle break-all">
              {token.contractAddress || "Circle Gateway native asset"}
            </p>
          </Card>
        ))}
      </div>
    </main>
  );
}
