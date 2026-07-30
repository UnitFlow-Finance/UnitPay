import { chainLabelForBlockchain } from "@/lib/chains/lookup";
import type { UnitPayTokenBalance, UnitPayWalletBalanceGroup } from "@/lib/types";

export function tokenAmount(balance: UnitPayTokenBalance): number {
  return Number(balance.amount) || 0;
}

export function tokenSymbol(balance: UnitPayTokenBalance): string {
  return balance.token.symbol || (balance.token.isNative ? "Native" : "TOKEN");
}

export function uniqueTokenKey(balance: UnitPayTokenBalance): string {
  return `${tokenSymbol(balance)}:${balance.token.tokenAddress || balance.token.id || "native"}`;
}

export function primaryUsdcBalance(balances: UnitPayTokenBalance[]): UnitPayTokenBalance | null {
  return displayTokenBalances(balances).find((entry) => tokenSymbol(entry) === "USDC" || entry.token.isNative) ?? null;
}

export function displayTokenBalances(balances: UnitPayTokenBalance[]): UnitPayTokenBalance[] {
  const result: UnitPayTokenBalance[] = [];
  for (const balance of balances) {
    const symbol = tokenSymbol(balance);
    const duplicateNativeUsdc = result.some(
      (entry) =>
        tokenSymbol(entry) === symbol &&
        symbol === "USDC" &&
        entry.amount === balance.amount &&
        (entry.token.isNative || balance.token.isNative),
    );
    if (!duplicateNativeUsdc) result.push(balance);
  }
  return result;
}

export function groupTotalBySymbol(
  walletBalances: UnitPayWalletBalanceGroup[],
): Record<string, number> {
  return walletBalances.reduce<Record<string, number>>((totals, group) => {
    for (const balance of displayTokenBalances(group.tokenBalances)) {
      const symbol = tokenSymbol(balance);
      totals[symbol] = (totals[symbol] ?? 0) + tokenAmount(balance);
    }
    return totals;
  }, {});
}

export function walletChainLabel(group: UnitPayWalletBalanceGroup): string {
  const label = chainLabelForBlockchain(group.wallet.blockchain);
  return group.wallet.blockchain === "EVM-TESTNET"
    ? `${label} (${group.wallet.blockchain})`
    : label;
}
