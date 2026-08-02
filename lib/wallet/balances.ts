import { chainLabelForBlockchain } from "@/lib/chains/lookup";
import type { UnitPayTokenBalance, UnitPayWalletBalanceGroup } from "@/lib/types";

const ARC_TESTNET_BLOCKCHAIN = "ARC-TESTNET";

export function tokenAmount(balance: UnitPayTokenBalance): number {
  return Number(balance.amount) || 0;
}

export function tokenSymbol(balance: UnitPayTokenBalance): string {
  return balance.token.symbol || (balance.token.isNative ? "Native" : "TOKEN");
}

export function uniqueTokenKey(balance: UnitPayTokenBalance): string {
  return `${tokenSymbol(balance)}:${balance.token.tokenAddress || balance.token.id || "native"}`;
}

export function primaryUsdcBalance(
  balances: UnitPayTokenBalance[],
  blockchain?: string,
): UnitPayTokenBalance | null {
  return (
    displayTokenBalances(balances, blockchain).find(
      (entry) => tokenSymbol(entry) === "USDC" || entry.token.isNative,
    ) ?? null
  );
}

function amountsEqual(a: UnitPayTokenBalance, b: UnitPayTokenBalance): boolean {
  return tokenAmount(a) === tokenAmount(b);
}

function isUsdcLike(balance: UnitPayTokenBalance): boolean {
  return tokenSymbol(balance) === "USDC" || Boolean(balance.token.isNative);
}

function isArcNativeUsdcDuplicate(
  balance: UnitPayTokenBalance,
  result: UnitPayTokenBalance[],
  blockchain?: string,
): { duplicate: boolean; replaceIndex?: number } {
  if (blockchain !== ARC_TESTNET_BLOCKCHAIN || !isUsdcLike(balance)) {
    return { duplicate: false };
  }

  const duplicateIndex = result.findIndex((entry) => {
    const oneIsNative = Boolean(entry.token.isNative || balance.token.isNative);
    return oneIsNative && isUsdcLike(entry) && amountsEqual(entry, balance);
  });

  if (duplicateIndex === -1) return { duplicate: false };

  const existing = result[duplicateIndex];
  const currentIsExplicitUsdc = tokenSymbol(balance) === "USDC" && !balance.token.isNative;
  const existingIsNative = Boolean(existing.token.isNative);
  return {
    duplicate: true,
    replaceIndex: currentIsExplicitUsdc && existingIsNative ? duplicateIndex : undefined,
  };
}

export function displayTokenBalances(
  balances: UnitPayTokenBalance[],
  blockchain?: string,
): UnitPayTokenBalance[] {
  const result: UnitPayTokenBalance[] = [];
  for (const balance of balances) {
    const symbol = tokenSymbol(balance);
    const duplicateNativeUsdc = result.some(
      (entry) =>
        tokenSymbol(entry) === symbol &&
        symbol === "USDC" &&
        amountsEqual(entry, balance) &&
        (entry.token.isNative || balance.token.isNative),
    );
    const arcDuplicate = isArcNativeUsdcDuplicate(balance, result, blockchain);
    if (arcDuplicate.replaceIndex !== undefined) {
      result[arcDuplicate.replaceIndex] = balance;
    } else if (!duplicateNativeUsdc && !arcDuplicate.duplicate) {
      result.push(balance);
    }
  }
  return result;
}

export function groupTotalBySymbol(
  walletBalances: UnitPayWalletBalanceGroup[],
): Record<string, number> {
  return walletBalances.reduce<Record<string, number>>((totals, group) => {
    for (const balance of displayTokenBalances(group.tokenBalances, group.wallet.blockchain)) {
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
