"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Clock, FileText, ShieldCheck } from "lucide-react";
import { apiPost } from "@/lib/api";
import { useCircleSdk } from "@/lib/circle/sdkContext";
import { getP2PTradeRemote, updateP2PTradeRemote } from "@/lib/p2p/client";
import type { P2PTrade } from "@/lib/p2p/types";
import { useWallet } from "@/lib/useWallet";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Input";

export default function P2PTradeWindowPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { primaryWallet } = useWallet();
  const { executeChallenge } = useCircleSdk();
  const [trade, setTrade] = useState<P2PTrade | null>(null);
  const [proof, setProof] = useState("");
  const [evidence, setEvidence] = useState("");
  const [disputeReason, setDisputeReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  async function refresh() {
    setTrade(await getP2PTradeRemote(id));
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const actorCircleWalletId = primaryWallet?.id ?? "";
  const role = useMemo(() => {
    if (!trade || !actorCircleWalletId) return "viewer";
    if (trade.buyerCircleWalletId === actorCircleWalletId) return "buyer";
    if (trade.sellerCircleWalletId === actorCircleWalletId) return "seller";
    return "viewer";
  }, [actorCircleWalletId, trade]);

  async function run(action: string, payload: Record<string, unknown>, done: string) {
    if (!actorCircleWalletId) {
      setMessage("Connect a wallet before updating a trade.");
      return;
    }
    if (!trade) return;
    setWorking(true);
    setMessage(null);
    try {
      if (trade.onChainTradeId && ["mark-paid", "release", "cancel", "dispute", "resolve"].includes(action)) {
        const userToken = window.localStorage.getItem("unitpay.userToken");
        if (!userToken) throw new Error("Session expired — please reload.");
        const onChainAction = action === "cancel" ? "cancel-expired" : action;
        setMessage("Submitting on-chain P2P action...");
        const { challengeId } = await apiPost<{ challengeId: string }>("/api/p2p/onchain", {
          action: onChainAction,
          userToken,
          walletId: primaryWallet?.id,
          chainKey: trade.chainKey ?? "arcTestnet",
          onChainTradeId: trade.onChainTradeId,
          evidence: payload.proofOfPayment ?? payload.urlOrReference ?? payload.reason ?? payload.note ?? "",
          reason: payload.reason,
          outcome: payload.outcome,
        });
        await executeChallenge(challengeId);
      }
      const updated = await updateP2PTradeRemote(id, { action, actorCircleWalletId, ...payload });
      setTrade(updated);
      setMessage(done);
    } catch (error) {
      setMessage((error as Error).message ?? String(error));
    } finally {
      setWorking(false);
    }
  }

  if (!trade) {
    return (
      <main className="min-h-full flex items-center justify-center px-6">
        <p className="text-muted text-sm">Loading trade...</p>
      </main>
    );
  }

  return (
    <main className="px-4 sm:px-6 py-6 sm:py-8 max-w-md md:max-w-5xl mx-auto w-full space-y-6">
      <PageHeader title={`Trade ${trade.id.slice(0, 8)}`} backHref="/p2p" />
      <div className="grid md:grid-cols-5 gap-5">
        <section className="md:col-span-3 space-y-4">
          <Card className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs text-muted">Status</p>
                <p className="text-2xl font-semibold">{trade.status}</p>
              </div>
              <ShieldCheck className="w-8 h-8 text-primary" />
            </div>
            <div className="grid sm:grid-cols-2 gap-3 text-sm">
              <Info label="Crypto" value={`${trade.cryptoAmount} ${trade.asset}`} />
              <Info label="Fiat payable" value={`${trade.fiatAmount} ${trade.fiatCurrency}`} />
              <Info label="Payment method" value={trade.paymentMethod} />
              <Info label="Escrow" value={trade.escrowMode.replace("_", " ")} />
              <Info label="Buyer" value={trade.buyerCircleWalletId} />
              <Info label="Seller" value={trade.sellerCircleWalletId} />
            </div>
            <div className="rounded-xl border border-border p-3 flex items-center gap-3 text-sm">
              <Clock className="w-4 h-4 text-accent" />
              <span>Payment deadline: {new Date(trade.paymentDeadlineAt).toLocaleString()}</span>
            </div>
          </Card>

          <Card className="space-y-3">
            <h2 className="font-semibold">Activity</h2>
            {(trade.activity ?? []).length === 0 ? (
              <p className="text-sm text-muted">No activity yet.</p>
            ) : (
              <div className="divide-y divide-border">
                {(trade.activity ?? []).map((entry) => (
                  <div key={entry.id} className="py-3 first:pt-0 last:pb-0 text-sm">
                    <p className="font-medium">{entry.action}</p>
                    <p className="text-xs text-muted">{entry.note || entry.actorCircleWalletId} · {new Date(entry.createdAt).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </section>

        <section className="md:col-span-2 space-y-4">
          <Card className="space-y-3">
            <h2 className="font-semibold">Trade actions</h2>
            <Field label="Proof of payment">
              <Input value={proof} onChange={(event) => setProof(event.target.value)} placeholder="Bank reference or receipt URL" />
            </Field>
            <Button fullWidth disabled={working || role !== "buyer"} onClick={() => run("mark-paid", { proofOfPayment: proof }, "Payment marked as sent.")}>
              <CheckCircle2 className="w-4 h-4" /> Mark payment sent
            </Button>
            <Button fullWidth variant="secondary" disabled={working || role !== "seller"} onClick={() => run("release", {}, "Escrow released.")}>
              Release escrow
            </Button>
            <Button fullWidth variant="ghost" disabled={working || trade.status !== "Locked"} onClick={() => run("cancel", {}, "Expired trade cancelled.")}>
              Cancel expired trade
            </Button>
          </Card>

          <Card className="space-y-3">
            <h2 className="font-semibold">Dispute</h2>
            <Field label="Reason">
              <Textarea value={disputeReason} onChange={(event) => setDisputeReason(event.target.value)} rows={3} />
            </Field>
            <Field label="Evidence reference">
              <Input value={evidence} onChange={(event) => setEvidence(event.target.value)} placeholder="Receipt, chat, or transaction reference" />
            </Field>
            <Button fullWidth variant="secondary" disabled={working || !evidence} onClick={() => run("evidence", { label: "Submitted evidence", urlOrReference: evidence }, "Evidence submitted.")}>
              <FileText className="w-4 h-4" /> Submit evidence
            </Button>
            <Button fullWidth variant="secondary" disabled={working || !disputeReason} onClick={() => run("dispute", { reason: disputeReason }, "Dispute opened.")}>
              <AlertTriangle className="w-4 h-4" /> Open dispute
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="ghost" disabled={working || trade.status !== "Disputed"} onClick={() => run("resolve", { outcome: "release", note: "Resolved to seller" }, "Resolved to seller.")}>Release</Button>
              <Button variant="ghost" disabled={working || trade.status !== "Disputed"} onClick={() => run("resolve", { outcome: "refund", note: "Resolved to buyer" }, "Refunded.")}>Refund</Button>
            </div>
          </Card>

          {message && <Card className="text-sm text-muted">{message}</Card>}
          <Link href={`/p2p/offers/${trade.offerId}`} className="block text-center text-sm text-accent hover:text-primary">
            View original offer
          </Link>
        </section>
      </div>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted">{label}</p>
      <p className="font-medium break-words">{value}</p>
    </div>
  );
}
