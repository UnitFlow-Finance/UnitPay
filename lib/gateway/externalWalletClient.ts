"use client";

import { createViemAdapterFromProvider } from "@circle-fin/adapter-viem-v2";
import {
  createUnifiedBalanceKitContext,
  depositFor,
  spend,
  type DepositResult,
  type SpendResult,
  type UnifiedBalanceChainIdentifier,
} from "@circle-fin/unified-balance-kit";
import type { EIP1193Provider } from "viem";
import { getUnifiedBalanceKitContext } from "@/lib/gateway/unifiedBalanceKit";
import { getChain } from "@/lib/chains/config";

declare global {
  interface Window {
    ethereum?: EIP1193Provider;
  }
}

export interface ConnectedExternalWallet {
  adapter: Awaited<ReturnType<typeof createViemAdapterFromProvider>>;
  address: string;
}

type KitAdapter = Parameters<typeof depositFor>[1]["from"]["adapter"];

function asKitAdapter(wallet: ConnectedExternalWallet): KitAdapter {
  return wallet.adapter as unknown as KitAdapter;
}

export async function connectExternalEvmWallet(): Promise<ConnectedExternalWallet> {
  const provider = window.ethereum;
  if (!provider) {
    throw new Error("No browser wallet found. Install or open MetaMask-compatible wallet.");
  }

  await provider.request({ method: "eth_requestAccounts" });
  const adapter = await createViemAdapterFromProvider({ provider });
  const accounts = (await provider.request({ method: "eth_accounts" })) as string[];
  const address = accounts[0];
  if (!address) throw new Error("No wallet account connected.");
  return { adapter, address };
}

export async function depositForGatewayAccount({
  wallet,
  sourceChainKey,
  depositAccount,
  amount,
}: {
  wallet: ConnectedExternalWallet;
  sourceChainKey: string;
  depositAccount: string;
  amount: string;
}): Promise<DepositResult> {
  const sourceChain = getChain(sourceChainKey);
  if (sourceChain.family !== "evm") {
    throw new Error("External wallet Gateway deposits currently support EVM chains only.");
  }

  const context = getUnifiedBalanceKitContext();
  return depositFor(context, {
    from: {
      adapter: asKitAdapter(wallet),
      chain: sourceChain.unifiedBalanceChain as UnifiedBalanceChainIdentifier,
    },
    amount,
    depositAccount,
  });
}

export async function spendExternalGatewayBalance({
  wallet,
  destinationChainKey,
  recipientAddress,
  amount,
  sourceChainKey,
}: {
  wallet: ConnectedExternalWallet;
  destinationChainKey: string;
  recipientAddress: string;
  amount: string;
  sourceChainKey?: string;
}): Promise<SpendResult> {
  const destinationChain = getChain(destinationChainKey);
  if (destinationChain.family !== "evm") {
    throw new Error("External wallet Gateway spends currently support EVM chains only.");
  }

  const context = createUnifiedBalanceKitContext();
  const allocation = sourceChainKey
    ? {
        amount,
        chain: getChain(sourceChainKey).unifiedBalanceChain as UnifiedBalanceChainIdentifier,
      }
    : undefined;

  return spend(context, {
    amount,
    from: {
      adapter: asKitAdapter(wallet),
      ...(allocation ? { allocations: allocation } : {}),
    },
    to: {
      adapter: asKitAdapter(wallet),
      chain: destinationChain.unifiedBalanceChain as UnifiedBalanceChainIdentifier,
      recipientAddress,
    },
  });
}
