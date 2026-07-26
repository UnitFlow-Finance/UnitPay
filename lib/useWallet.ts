"use client";

import { useCallback, useEffect, useState } from "react";
import { apiPost } from "@/lib/api";
import { useCircleSdk } from "@/lib/circle/sdkContext";
import type { UnitPayTokenBalance, UnitPayTransaction, UnitPayWallet } from "@/lib/types";

interface UseWalletResult {
  loading: boolean;
  error: string | null;
  wallets: UnitPayWallet[];
  primaryWallet: UnitPayWallet | null;
  balances: UnitPayTokenBalance[];
  transactions: UnitPayTransaction[];
  userToken: string | null;
  refresh: () => Promise<void>;
}

/**
 * Loads the current user's Circle wallets + balances + recent transactions.
 * Does not itself trigger onboarding — callers should redirect to
 * /onboarding/wallet if `wallets` comes back empty after loading.
 */
export function useWallet(): UseWalletResult {
  const { getExistingSession, userToken: cachedToken } = useCircleSdk();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [wallets, setWallets] = useState<UnitPayWallet[]>([]);
  const [balances, setBalances] = useState<UnitPayTokenBalance[]>([]);
  const [transactions, setTransactions] = useState<UnitPayTransaction[]>([]);
  const [userToken, setUserToken] = useState<string | null>(cachedToken);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const session = await getExistingSession();
      if (!session) {
        setUserToken(null);
        setWallets([]);
        setBalances([]);
        setTransactions([]);
        return;
      }

      const { userToken: token } = session;
      setUserToken(token);

      const { wallets: fetchedWallets } = await apiPost<{ wallets: UnitPayWallet[] }>(
        "/api/wallet/list",
        { userToken: token },
      );
      setWallets(fetchedWallets);

      if (fetchedWallets.length === 0) {
        setBalances([]);
        setTransactions([]);
        return;
      }

      const primary = fetchedWallets[0];
      const [{ tokenBalances }, { transactions: txs }] = await Promise.all([
        apiPost<{ tokenBalances: UnitPayTokenBalance[] }>("/api/wallet/balances", {
          userToken: token,
          walletId: primary.id,
        }),
        apiPost<{ transactions: UnitPayTransaction[] }>("/api/wallet/transactions", {
          userToken: token,
          walletIds: fetchedWallets.map((w) => w.id),
        }),
      ]);

      setBalances(tokenBalances);
      setTransactions(txs);
    } catch (err) {
      setError((err as Error).message ?? String(err));
    } finally {
      setLoading(false);
    }
  }, [getExistingSession]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await load();
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    loading,
    error,
    wallets,
    primaryWallet: wallets[0] ?? null,
    balances,
    transactions,
    userToken,
    refresh: load,
  };
}
