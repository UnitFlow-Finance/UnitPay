"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/Button";
import { useWallet } from "@/lib/useWallet";
import { usdcFromBaseUnits } from "@/lib/units";
import {
  listEscrowsForAddress,
  type EscrowRecord,
} from "@/lib/escrow/contract";

/**
 * "My escrows" — read directly from Arc Testnet chain state (no database),
 * paginated backwards over block ranges. See lib/escrow/contract.ts.
 */
export default function EscrowListPage() {
  const { primaryWallet, loading: walletLoading } = useWallet();
  const [escrows, setEscrows] = useState<EscrowRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [beforeBlock, setBeforeBlock] = useState<bigint | undefined>(undefined);
  const [hasMore, setHasMore] = useState(true);

  const address = primaryWallet?.address;

  const loadPage = useCallback(
    async (before?: bigint, append = false) => {
      if (!address) return;
      setLoading(true);
      setError(null);
      try {
        const page = await listEscrowsForAddress(address as `0x${string}`, {
          pageSize: 10,
          beforeBlock: before,
        });
        setEscrows((prev) => (append ? [...prev, ...page.escrows] : page.escrows));
        setBeforeBlock(page.nextBeforeBlock);
        setHasMore(page.nextBeforeBlock !== undefined);
      } catch (err) {
        setError((err as Error).message ?? String(err));
      } finally {
        setLoading(false);
      }
    },
    [address],
  );

  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    (async () => {
      await loadPage();
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
  }, [address, loadPage]);

  return (
    <main className="px-4 sm:px-6 py-6 sm:py-8 max-w-md md:max-w-2xl mx-auto w-full space-y-6">
      <PageHeader title="Escrow" backHref="/wallet" />

      <div className="flex gap-3">
        <LinkButton href="/wallet/escrow/new" fullWidth size="lg">
          New escrow
        </LinkButton>
      </div>

      {walletLoading || (loading && escrows.length === 0) ? (
        <p className="text-muted text-sm text-center py-8">Loading escrows...</p>
      ) : error ? (
        <p className="text-error text-sm">{error}</p>
      ) : escrows.length === 0 ? (
        <Card className="text-sm text-muted text-center py-8">
          No escrows yet. Create one to lock funds for a freelancer or bounty.
        </Card>
      ) : (
        <div className="space-y-3">
          {escrows.map((escrow) => (
            <EscrowRow key={escrow.id.toString()} escrow={escrow} myAddress={address ?? ""} />
          ))}
        </div>
      )}

      {hasMore && escrows.length > 0 && (
        <button
          onClick={() => loadPage(beforeBlock, true)}
          disabled={loading}
          className="flex items-center justify-center gap-1.5 w-full text-xs text-accent hover:text-primary transition-colors py-2"
        >
          <RefreshCw className="w-3.5 h-3.5" /> {loading ? "Loading..." : "Load more"}
        </button>
      )}
    </main>
  );
}

const STATUS_STYLES: Record<EscrowRecord["status"], string> = {
  Funded: "text-warning",
  Released: "text-success",
  Refunded: "text-muted",
  Disputed: "text-error",
};

function EscrowRow({ escrow, myAddress }: { escrow: EscrowRecord; myAddress: string }) {
  const role =
    escrow.payer.toLowerCase() === myAddress.toLowerCase()
      ? "Payer"
      : escrow.payee.toLowerCase() === myAddress.toLowerCase()
        ? "Payee"
        : null;

  return (
    <Link href={`/wallet/escrow/${escrow.id.toString()}`}>
      <Card className="flex items-center justify-between hover:border-primary/40 transition-colors">
        <div>
          <p className="text-sm font-medium">
            Escrow #{escrow.id.toString()} {role && <span className="text-muted">· {role}</span>}
          </p>
          <p className="text-xs text-muted">
            {usdcFromBaseUnits(escrow.amount)} USDC
          </p>
        </div>
        <span className={`text-xs font-medium ${STATUS_STYLES[escrow.status]}`}>
          {escrow.status}
        </span>
      </Card>
    </Link>
  );
}
