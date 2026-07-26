"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/Button";
import { useWallet } from "@/lib/useWallet";
import { usdcFromBaseUnits } from "@/lib/units";
import { listPacketsForCreator, type PacketRecord } from "@/lib/packet/contract";

/**
 * "My Unit Packets" — read directly from Arc Testnet chain state (no
 * database), paginated backwards over block ranges. See lib/packet/contract.ts.
 */
export default function PacketListPage() {
  const { primaryWallet, loading: walletLoading } = useWallet();
  const [packets, setPackets] = useState<PacketRecord[]>([]);
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
        const page = await listPacketsForCreator(address as `0x${string}`, {
          pageSize: 10,
          beforeBlock: before,
        });
        setPackets((prev) => (append ? [...prev, ...page.packets] : page.packets));
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
      <PageHeader title="Unit Packet" backHref="/wallet" />

      <div className="flex gap-3">
        <LinkButton href="/wallet/packet/new" fullWidth size="lg">
          New packet
        </LinkButton>
      </div>

      {walletLoading || (loading && packets.length === 0) ? (
        <p className="text-muted text-sm text-center py-8">Loading packets...</p>
      ) : error ? (
        <p className="text-error text-sm">{error}</p>
      ) : packets.length === 0 ? (
        <Card className="text-sm text-muted text-center py-8">
          No packets yet. Create one to split USDC among friends or a group — equally or
          randomly, WeChat red-envelope style.
        </Card>
      ) : (
        <div className="space-y-3">
          {packets.map((packet) => (
            <PacketRow key={packet.id.toString()} packet={packet} />
          ))}
        </div>
      )}

      {hasMore && packets.length > 0 && (
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

function packetStatus(packet: PacketRecord): { label: string; className: string } {
  if (packet.reclaimed) return { label: "Reclaimed", className: "text-muted" };
  if (packet.claimsMade >= packet.maxClaims) return { label: "Fully claimed", className: "text-success" };
  return { label: "Open", className: "text-warning" };
}

function PacketRow({ packet }: { packet: PacketRecord }) {
  const status = packetStatus(packet);

  return (
    <Link href={`/wallet/packet/${packet.id.toString()}`}>
      <Card className="flex items-center justify-between hover:border-primary/40 transition-colors">
        <div>
          <p className="text-sm font-medium">
            Packet #{packet.id.toString()}{" "}
            <span className="text-muted">· {packet.splitMode} split</span>
          </p>
          <p className="text-xs text-muted">
            {usdcFromBaseUnits(packet.remainingAmount)} / {usdcFromBaseUnits(packet.totalAmount)}{" "}
            USDC left · {packet.claimsMade}/{packet.maxClaims} claimed
          </p>
        </div>
        <span className={`text-xs font-medium ${status.className}`}>{status.label}</span>
      </Card>
    </Link>
  );
}
