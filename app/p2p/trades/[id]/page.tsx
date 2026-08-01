"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Clock, LockKeyhole, MessageCircle, Send, ShieldCheck } from "lucide-react";
import { apiPost } from "@/lib/api";
import { useCircleSdk } from "@/lib/circle/sdkContext";
import { decryptP2PChatMessage, encryptP2PChatMessage } from "@/lib/p2p/chatCrypto";
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
  const [chatText, setChatText] = useState("");
  const [decryptedMessages, setDecryptedMessages] = useState<Record<string, string>>({});
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

  useEffect(() => {
    if (!trade) return;
    const currentTrade = trade;
    let cancelled = false;
    async function decryptMessages() {
      const entries = await Promise.all(
        (currentTrade.chatMessages ?? []).map(async (chatMessage) => {
          try {
            return [chatMessage.id, await decryptP2PChatMessage(currentTrade, chatMessage)] as const;
          } catch {
            return [chatMessage.id, "Unable to decrypt this message in the current session."] as const;
          }
        }),
      );
      if (!cancelled) setDecryptedMessages(Object.fromEntries(entries));
    }
    void decryptMessages();
    return () => {
      cancelled = true;
    };
  }, [trade]);

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

  async function sendChatMessage() {
    if (!trade || !actorCircleWalletId || !chatText.trim()) return;
    setWorking(true);
    setMessage(null);
    try {
      const encrypted = await encryptP2PChatMessage(trade, chatText.trim());
      const updated = await updateP2PTradeRemote(id, {
        action: "message",
        actorCircleWalletId,
        ...encrypted,
      });
      setTrade(updated);
      setChatText("");
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

          {trade.paymentDetails && (
            <Card className="space-y-3">
              <h2 className="font-semibold">
                {trade.paymentDetailsProvidedBy === "customer" ? "Customer payout details" : "Merchant payment details"}
              </h2>
              <p className="text-xs text-muted">
                {trade.paymentDetailsProvidedBy === "customer"
                  ? "The merchant should use these customer-provided details to pay for the USDC being sold."
                  : "The fiat payer should use these merchant-provided details, then upload proof before the deadline."}
              </p>
              <div className="grid sm:grid-cols-2 gap-3 text-sm">
                <Info label="Label" value={trade.paymentDetails.label || trade.paymentDetails.method} />
                <Info label="Method" value={trade.paymentDetails.method} />
                {trade.paymentDetails.recipientName && <Info label="Recipient" value={trade.paymentDetails.recipientName} />}
                {trade.paymentDetails.accountIdentifier && <Info label="Account/ID" value={trade.paymentDetails.accountIdentifier} />}
                {trade.paymentDetails.institutionName && <Info label="Institution" value={trade.paymentDetails.institutionName} />}
                {trade.paymentDetails.referenceNote && <Info label="Reference" value={trade.paymentDetails.referenceNote} />}
              </div>
              {trade.paymentDetails.instructions && (
                <p className="text-xs text-muted whitespace-pre-wrap">{trade.paymentDetails.instructions}</p>
              )}
            </Card>
          )}

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
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-semibold flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-primary" /> Encrypted chat
              </h2>
              <span className="text-[11px] text-muted inline-flex items-center gap-1">
                <LockKeyhole className="w-3 h-3" /> AES-GCM
              </span>
            </div>
            {(trade.chatMessages ?? []).length === 0 ? (
              <p className="text-sm text-muted">No messages yet.</p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {(trade.chatMessages ?? []).map((chatMessage) => {
                  const mine = chatMessage.senderCircleWalletId === actorCircleWalletId;
                  return (
                    <div key={chatMessage.id} className={`rounded-xl border border-border p-3 text-sm ${mine ? "bg-primary-light/50" : "bg-surface"}`}>
                      <p className="text-xs text-muted mb-1">{mine ? "You" : chatMessage.senderCircleWalletId}</p>
                      <p className="whitespace-pre-wrap">{decryptedMessages[chatMessage.id] ?? "Decrypting..."}</p>
                      <p className="text-[11px] text-subtle mt-1">{new Date(chatMessage.createdAt).toLocaleString()}</p>
                    </div>
                  );
                })}
              </div>
            )}
            <Field label="Message">
              <Textarea value={chatText} onChange={(event) => setChatText(event.target.value)} rows={3} placeholder="Encrypted before it is saved to the trade" />
            </Field>
            <Button fullWidth disabled={working || role === "viewer" || !chatText.trim()} onClick={sendChatMessage}>
              <Send className="w-4 h-4" /> Send encrypted message
            </Button>
          </Card>

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

          {/* Dispute resolution UI is intentionally disabled for now.
          <Card className="space-y-3">
            <h2 className="font-semibold">Dispute</h2>
            ...
          </Card>
          */}

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
