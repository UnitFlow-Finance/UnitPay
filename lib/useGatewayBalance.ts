"use client";

import { useCallback, useEffect, useState } from "react";
import { getBalances, type UnifiedBalanceChainIdentifier } from "@circle-fin/unified-balance-kit";
import { getUnifiedBalanceKitContext } from "@/lib/gateway/unifiedBalanceKit";
import { listEvmChains } from "@/lib/chains/config";
import { usdcFromBaseUnits, usdcToBaseUnits } from "@/lib/units";
import type { UnitPayWallet } from "@/lib/types";

export interface GatewayBalanceEntry {
  /** Internal chain key (e.g. "arcTestnet"). */
  chainKey: string;
  chainLabel: string;
  /** Human-readable USDC amount, e.g. "20.5". */
  balance: string;
}

/**
 * Queries Circle's Unified Balance Kit (the "Arc App Kit unified balance"
 * read API) for the user's Gateway balance across every EVM testnet chain
 * this app knows about, keyed by the user's single Circle Wallets address
 * (User-Controlled Wallets issue one EVM address reused across all EVM
 * chains for a given user/account type).
 *
 * This is a pure balance READ — no signer/adapter required, so it talks to
 * the kit directly from the browser (same as any other public Gateway
 * REST read) rather than round-tripping through our own API routes.
 */
export function useGatewayBalance(wallet: UnitPayWallet | null) {
  const [total, setTotal] = useState("0");
  const [perChain, setPerChain] = useState<GatewayBalanceEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!wallet) return;
    setLoading(true);
    setError(null);
    try {
      const evmChains = listEvmChains();
      const context = getUnifiedBalanceKitContext();

      const result = await getBalances(context, {
        token: "USDC",
        networkType: "testnet",
        sources: {
          address: wallet.address,
          chains: evmChains.map((c) => c.unifiedBalanceChain) as UnifiedBalanceChainIdentifier[],
        },
      });

      const chainBreakdowns = result.breakdown[0]?.breakdown ?? [];
      const entries: GatewayBalanceEntry[] = evmChains.map((chain) => {
        const match = chainBreakdowns.find((b) => b.chain === chain.unifiedBalanceChain);
        return {
          chainKey: chain.key,
          chainLabel: chain.label,
          balance: match?.confirmedBalance ?? "0",
        };
      });

      setPerChain(entries);
      const totalBaseUnits = entries.reduce(
        (sum, e) => sum + usdcToBaseUnits(e.balance || "0"),
        0n,
      );
      setTotal(usdcFromBaseUnits(totalBaseUnits));
    } catch (err) {
      setError((err as Error).message ?? String(err));
    } finally {
      setLoading(false);
    }
  }, [wallet]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await refresh();
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  return { total, perChain, loading, error, refresh };
}
