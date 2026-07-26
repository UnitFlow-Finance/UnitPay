import { CHAINS, getChain } from "@/lib/chains/config";

/**
 * Wallets come back from Circle keyed by their `Blockchain` enum value
 * (e.g. "ARC-TESTNET"); these helpers map that back to our internal chain
 * config, which is otherwise keyed by our own internal `key` string.
 */
export function chainKeyForBlockchain(circleBlockchain: string): string {
  const entry = Object.entries(CHAINS).find(([, c]) => c.circleBlockchain === circleBlockchain);
  return entry?.[0] ?? "arcTestnet";
}

export function chainLabelForBlockchain(circleBlockchain: string): string {
  return getChain(chainKeyForBlockchain(circleBlockchain)).label;
}

export function isUsdcNativeGas(circleBlockchain: string): boolean {
  return getChain(chainKeyForBlockchain(circleBlockchain)).usdcIsNativeGas;
}
