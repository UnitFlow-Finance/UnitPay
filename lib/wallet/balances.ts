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

function betterArcUsdcDisplayBalance(
  current: UnitPayTokenBalance,
  next: UnitPayTokenBalance,
): UnitPayTokenBalance {
  const currentAmount = tokenAmount(current);
  const nextAmount = tokenAmount(next);
  if (nextAmount > currentAmount) return next;
  if (currentAmount > nextAmount) return current;

  const nextIsExplicitUsdc = tokenSymbol(next) === "USDC" && !next.token.isNative;
  const currentIsNative = Boolean(current.token.isNative);
  return nextIsExplicitUsdc && currentIsNative ? next : current;
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
    const arcUsdcIndex =
      blockchain === ARC_TESTNET_BLOCKCHAIN && isUsdcLike(balance)
        ? result.findIndex((entry) => isUsdcLike(entry))
        : -1;

    if (arcUsdcIndex !== -1) {
      result[arcUsdcIndex] = betterArcUsdcDisplayBalance(result[arcUsdcIndex], balance);
    } else if (!duplicateNativeUsdc) {
      result.push(balance);
    }
  }
  return result;
}

export function formatCompactBalance(value: number | string): string {
  const amount = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(amount)) return "0.00";

  const sign = amount < 0 ? "-" : "";
  const absolute = Math.abs(amount);
  const units = [
    { value: 1_000_000_000, suffix: "b" },
    { value: 1_000_000, suffix: "m" },
    { value: 1_000, suffix: "k" },
  ];
  const unit = units.find((entry) => absolute >= entry.value);
  const scaled = unit ? absolute / unit.value : absolute;
  const formatted = scaled.toLocaleString("en-US", {
    minimumFractionDigits: unit ? 0 : 2,
    maximumFractionDigits: 2,
  });

  return `${sign}${formatted}${unit?.suffix ?? ""}`;
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
