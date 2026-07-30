import { getChain } from "@/lib/chains/config";
import type { UnitPayWallet } from "@/lib/types";

export function walletForBlockchain(
  wallets: UnitPayWallet[],
  blockchain: string,
): UnitPayWallet | null {
  return wallets.find((wallet) => wallet.blockchain === blockchain) ?? null;
}

export function walletForChainKey(wallets: UnitPayWallet[], chainKey: string): UnitPayWallet | null {
  return walletForBlockchain(wallets, getChain(chainKey).circleBlockchain);
}

export function preferredPrimaryWallet(wallets: UnitPayWallet[]): UnitPayWallet | null {
  return walletForChainKey(wallets, "arcTestnet") ?? wallets[0] ?? null;
}
