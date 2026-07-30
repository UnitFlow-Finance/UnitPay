"use client";

import { QRCodeSVG } from "qrcode.react";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { chainLabelForBlockchain } from "@/lib/chains/lookup";
import {
  encodePaymentRequest,
  listRecentPaymentRequests,
  saveRecentPaymentRequest,
  type PaymentReceiver,
  type RecentPaymentRequest,
} from "@/lib/paymentRequest";
import { createPodRemote } from "@/lib/pods/client";
import type { PodCompletionMode } from "@/lib/pods/types";
import { useWallet } from "@/lib/useWallet";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Input";

type Mode = "single" | "split";

function emptyReceiver(): PaymentReceiver {
  return { address: "", amount: "", label: "" };
}

/**
 * "Request USDC" — v1.5 payment link/QR feature (see README for the
 * stateless-encoding caveat: no server-side request record exists yet,
 * the link itself carries the request payload).
 *
 * Split mode produces a v2 (multi-receiver) link: the payer makes one
 * payment that fans out to every listed receiver atomically via
 * UnitPayTransfer.batchTransfer — e.g. splitting a bill, or paying several
 * freelancers from one action. See lib/paymentRequest.ts.
 */
export default function RequestPaymentPage() {
  const { primaryWallet, loading } = useWallet();
  const [mode, setMode] = useState<Mode>("single");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [receivers, setReceivers] = useState<PaymentReceiver[]>([
    emptyReceiver(),
    emptyReceiver(),
  ]);
  const [link, setLink] = useState<string | null>(null);
  const [collaborativeFunding, setCollaborativeFunding] = useState(false);
  const [completionMode, setCompletionMode] = useState<PodCompletionMode>("automatic");
  const [collaborativePodLink, setCollaborativePodLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedPodLink, setCopiedPodLink] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  // This demo has no server-side request record (see lib/paymentRequest.ts)
  // — the list below is purely a per-browser cache so a requester can find
  // and re-copy a link they generated earlier without regenerating it.
  // Lazy-initialized (not an effect) since reading localStorage here is
  // synchronous and only ever needs to happen once, on mount.
  const [recent, setRecent] = useState<RecentPaymentRequest[]>(() => listRecentPaymentRequests());
  const [copiedRecentLink, setCopiedRecentLink] = useState<string | null>(null);

  async function copyRecentLink(recentLink: string) {
    await navigator.clipboard.writeText(recentLink);
    setCopiedRecentLink(recentLink);
    setTimeout(() => setCopiedRecentLink(null), 1500);
  }

  if (loading) {
    return (
      <main className="min-h-full flex items-center justify-center">
        <p className="text-muted">Loading...</p>
      </main>
    );
  }

  if (!primaryWallet) {
    return (
      <main className="min-h-full flex items-center justify-center px-6">
        <p className="text-muted text-sm">No wallet found.</p>
      </main>
    );
  }

  const total = receivers.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

  function updateReceiver(index: number, patch: Partial<PaymentReceiver>) {
    setReceivers((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function addReceiver() {
    setReceivers((prev) => [...prev, emptyReceiver()]);
  }

  function removeReceiver(index: number) {
    setReceivers((prev) => prev.filter((_, i) => i !== index));
  }

  function validateSplit(): string | null {
    if (receivers.length < 2) return "Add at least two receivers to split a payment.";
    for (const r of receivers) {
      if (!/^0x[a-fA-F0-9]{40}$/.test(r.address.trim())) {
        return "Every receiver needs a valid address.";
      }
      const amt = Number(r.amount);
      if (!r.amount || Number.isNaN(amt) || amt <= 0) {
        return "Every receiver needs a valid amount.";
      }
    }
    return null;
  }

  async function handleGenerate() {
    if (!primaryWallet) return;
    setFormError(null);
    setCollaborativePodLink(null);
    setGenerating(true);

    try {
      if (mode === "split") {
        if (collaborativeFunding) {
          throw new Error("Collaborative pods are currently supported for single receiver links.");
        }
        const validationError = validateSplit();
        if (validationError) {
          throw new Error(validationError);
        }
        const encoded = encodePaymentRequest({
          requesterAddress: primaryWallet.address,
          blockchain: primaryWallet.blockchain,
          memo: memo || undefined,
          createdAt: new Date().toISOString(),
          receivers: receivers.map((r) => ({
            address: r.address.trim(),
            amount: r.amount,
            label: r.label?.trim() || undefined,
          })),
        });
        const splitLink = `${window.location.origin}/pay/${encoded}`;
        setLink(splitLink);
        saveRecentPaymentRequest({
          link: splitLink,
          amount: total.toString(),
          memo: memo || undefined,
          receiverCount: receivers.length,
          createdAt: new Date().toISOString(),
        });
        setRecent(listRecentPaymentRequests());
        return;
      }

      const encoded = encodePaymentRequest({
        requesterAddress: primaryWallet.address,
        blockchain: primaryWallet.blockchain,
        amount,
        memo: memo || undefined,
        createdAt: new Date().toISOString(),
      });
      const singleLink = `${window.location.origin}/pay/${encoded}`;
      if (collaborativeFunding) {
        const pod = await createPodRemote({
          title: memo || `Payment request for ${amount} USDC`,
          description:
            memo ||
            "Collaborative funding pod attached to a UnitPay payment request.",
          creatorAddress: primaryWallet.address,
          treasuryAddress: primaryWallet.address,
          blockchain: primaryWallet.blockchain,
          visibility: "public",
          whitelist: [],
          targetAmount: amount,
          paymentLink: {
            encoded,
            urlPath: `/pay/${encoded}`,
            amount,
            memo: memo || undefined,
            recipientAddress: primaryWallet.address,
            blockchain: primaryWallet.blockchain,
            completionMode,
          },
        });
        setCollaborativePodLink(`${window.location.origin}/pods/${pod.id}`);
      }
      setLink(singleLink);
      saveRecentPaymentRequest({
        link: singleLink,
        amount,
        memo: memo || undefined,
        receiverCount: 1,
        createdAt: new Date().toISOString(),
      });
      setRecent(listRecentPaymentRequests());
    } catch (err) {
      setFormError((err as Error).message ?? String(err));
    } finally {
      setGenerating(false);
    }
  }

  async function copyLink() {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function copyPodLink() {
    if (!collaborativePodLink) return;
    await navigator.clipboard.writeText(collaborativePodLink);
    setCopiedPodLink(true);
    setTimeout(() => setCopiedPodLink(false), 1500);
  }

  function reset() {
    setLink(null);
    setCollaborativePodLink(null);
    setFormError(null);
  }

  return (
    <main className="px-4 sm:px-6 py-6 sm:py-8 max-w-md md:max-w-lg mx-auto w-full space-y-6">
      <PageHeader title="Request USDC" backHref="/wallet" />

      {!link && recent.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-muted uppercase tracking-wide">
            Recent requests
          </h2>
          <div className="space-y-2">
            {recent.map((r) => (
              <Card key={r.link} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                    {r.amount} USDC
                    {r.receiverCount > 1 ? ` split ${r.receiverCount} ways` : ""}
                  </p>
                  <p className="text-xs text-muted truncate">
                    {r.memo || "No memo"} ·{" "}
                    {new Date(r.createdAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => copyRecentLink(r.link)}
                  className="shrink-0 text-xs font-medium text-accent hover:text-primary transition-colors"
                >
                  {copiedRecentLink === r.link ? "Copied!" : "Copy link"}
                </button>
              </Card>
            ))}
          </div>
        </div>
      )}

      {!link && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setMode("single")}
              className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${
                mode === "single"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted hover:border-primary/40"
              }`}
            >
              Single receiver
            </button>
            <button
              type="button"
              onClick={() => setMode("split")}
              className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${
                mode === "split"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted hover:border-primary/40"
              }`}
            >
              Split payment
            </button>
          </div>

          {mode === "single" ? (
            <Field label="Amount (USDC)">
              <Input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                inputMode="decimal"
              />
            </Field>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-muted">
                The payer sends one payment that&apos;s split across these receivers in a
                single on-chain transaction.
              </p>
              {receivers.map((receiver, i) => (
                <Card key={i} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted">Receiver {i + 1}</span>
                    {receivers.length > 2 && (
                      <button
                        type="button"
                        onClick={() => removeReceiver(i)}
                        className="text-muted hover:text-error transition-colors"
                        aria-label="Remove receiver"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <Input
                    value={receiver.address}
                    onChange={(e) => updateReceiver(i, { address: e.target.value })}
                    placeholder="0x..."
                    className="font-mono text-xs"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      value={receiver.amount}
                      onChange={(e) => updateReceiver(i, { amount: e.target.value })}
                      placeholder="Amount"
                      inputMode="decimal"
                    />
                    <Input
                      value={receiver.label ?? ""}
                      onChange={(e) => updateReceiver(i, { label: e.target.value })}
                      placeholder="Label (optional)"
                    />
                  </div>
                </Card>
              ))}
              <button
                type="button"
                onClick={addReceiver}
                className="flex items-center justify-center gap-1.5 w-full text-xs text-accent hover:text-primary transition-colors py-2"
              >
                <Plus className="w-3.5 h-3.5" /> Add receiver
              </button>
              <div className="flex justify-between text-sm pt-1">
                <span className="text-muted">Total</span>
                <span className="font-medium">{total || 0} USDC</span>
              </div>
            </div>
          )}

          <Field label="Memo (optional)">
            <Input
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="What's this for?"
            />
          </Field>

          <Card className="space-y-3">
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={collaborativeFunding}
                onChange={(e) => setCollaborativeFunding(e.target.checked)}
                disabled={mode === "split"}
                className="mt-1"
              />
              <span className="space-y-1">
                <span className="block text-sm font-medium">
                  Enable collaborative funding
                </span>
                <span className="block text-xs text-muted">
                  Create a public Pod attached to this payment link so multiple
                  contributors can fund it together.
                </span>
              </span>
            </label>
            {collaborativeFunding && mode === "single" && (
              <Field label="Completion behavior">
                <Select
                  value={completionMode}
                  onChange={(e) => setCompletionMode(e.target.value as PodCompletionMode)}
                >
                  <option value="automatic">Complete when target is reached</option>
                  <option value="creator_approval">Require creator approval</option>
                </Select>
              </Field>
            )}
            {mode === "split" && (
              <p className="text-xs text-muted">
                Collaborative pods are available for single receiver links.
              </p>
            )}
          </Card>

          {formError && <p className="text-error text-sm">{formError}</p>}

          <Button
            onClick={handleGenerate}
            disabled={
              generating || (mode === "single" ? !amount || Number(amount) <= 0 : total <= 0)
            }
            size="lg"
            fullWidth
          >
            {generating ? "Generating..." : "Generate request link"}
          </Button>
        </div>
      )}

      {link && (
        <Card className="p-6 sm:p-8 flex flex-col items-center gap-4">
          <div className="bg-white p-4 rounded-xl">
            <QRCodeSVG value={link} size={200} />
          </div>
          {mode === "single" ? (
            <p className="text-sm text-center">
              Requesting <span className="font-medium">{amount} USDC</span> on{" "}
              {chainLabelForBlockchain(primaryWallet.blockchain)}
              {memo ? ` — "${memo}"` : ""}
            </p>
          ) : (
            <div className="text-sm text-center space-y-1">
              <p>
                Requesting <span className="font-medium">{total} USDC</span> split across{" "}
                {receivers.length} receivers on {chainLabelForBlockchain(primaryWallet.blockchain)}
                {memo ? ` — "${memo}"` : ""}
              </p>
            </div>
          )}
          <Button onClick={copyLink} fullWidth>
            {copied ? "Copied!" : "Copy link"}
          </Button>
          {collaborativePodLink && (
            <div className="w-full rounded-xl border border-border bg-surface px-3 py-3 space-y-2">
              <p className="text-xs text-muted">Collaborative Pod link</p>
              <p className="text-xs font-mono break-all">{collaborativePodLink}</p>
              <Button onClick={copyPodLink} variant="secondary" fullWidth>
                {copiedPodLink ? "Copied!" : "Copy Pod link"}
              </Button>
            </div>
          )}
          <Button onClick={reset} variant="secondary" fullWidth>
            Create another request
          </Button>
        </Card>
      )}
    </main>
  );
}
