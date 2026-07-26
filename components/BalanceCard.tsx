import { formatHumanAmount } from "@/lib/units";
import type { UnitPayTokenBalance } from "@/lib/types";

export function BalanceCard({
  chainLabel,
  balances,
  usdcIsNativeGas,
}: {
  chainLabel: string;
  balances: UnitPayTokenBalance[];
  usdcIsNativeGas: boolean;
}) {
  // On Arc, the native entry and the USDC entry are the SAME pool of funds —
  // show only one figure to avoid implying the user has two separate assets.
  const usdcBalance = balances.find(
    (b) => b.token.symbol === "USDC" || b.token.isNative === usdcIsNativeGas,
  );
  const displayAmount = usdcBalance ? formatHumanAmount(usdcBalance.amount) : "0.00";

  return (
    <div className="rounded-2xl bg-gradient-to-br from-surface to-surface-elevated border border-border p-5 sm:p-6 space-y-1.5">
      <p className="text-xs text-muted uppercase tracking-wide">{chainLabel}</p>
      <p className="text-3xl sm:text-4xl font-semibold tracking-tight">
        {displayAmount} <span className="text-lg sm:text-xl text-muted font-medium">USDC</span>
      </p>
      {usdcIsNativeGas && (
        <p className="text-xs text-accent">Gas on this chain is paid in USDC itself.</p>
      )}
    </div>
  );
}
