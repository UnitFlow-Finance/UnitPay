import type { UnitPayTransaction } from "@/lib/types";
import { chainLabelForBlockchain } from "@/lib/chains/lookup";

const STATE_STYLES: Record<string, string> = {
  COMPLETE: "text-success",
  CONFIRMED: "text-success",
  PENDING: "text-warning",
  INITIATED: "text-warning",
  FAILED: "text-error",
  DENIED: "text-error",
};

export function TransactionHistory({ transactions }: { transactions: UnitPayTransaction[] }) {
  if (transactions.length === 0) {
    return <p className="text-sm text-muted">No transactions yet.</p>;
  }

  return (
    <ul className="divide-y divide-border">
      {transactions.map((tx) => (
        <li
          key={tx.id}
          className="py-3 flex items-center justify-between gap-3 text-sm"
        >
          <div className="min-w-0">
            <p className="font-medium truncate">
              {tx.transactionType ?? "Transfer"} · {chainLabelForBlockchain(tx.blockchain)}
            </p>
            <p className="text-muted text-xs truncate">
              {tx.destinationAddress
                ? `To ${tx.destinationAddress.slice(0, 6)}…${tx.destinationAddress.slice(-4)}`
                : tx.sourceAddress
                  ? `From ${tx.sourceAddress.slice(0, 6)}…${tx.sourceAddress.slice(-4)}`
                  : ""}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="font-medium">{tx.amounts?.[0] ?? "-"} USDC</p>
            <p className={`text-xs ${STATE_STYLES[tx.state] ?? "text-muted"}`}>{tx.state}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
