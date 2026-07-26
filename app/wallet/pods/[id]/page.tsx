"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { apiPost } from "@/lib/api";
import { getChain } from "@/lib/chains/config";
import { chainKeyForBlockchain } from "@/lib/chains/lookup";
import {
  addEscrowPodContribution,
  canAccessEscrowPod,
  getEscrowPodWithStats,
  updateEscrowPodStatus,
  type EscrowPodStatus,
  type EscrowPodWithStats,
} from "@/lib/escrowPods";
import { useCircleSdk } from "@/lib/circle/sdkContext";
import { useWallet } from "@/lib/useWallet";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Input";

type ActionStatus = "idle" | "working" | "done" | "error";

export default function EscrowPodDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { primaryWallet, loading: walletLoading } = useWallet();
  const { executeChallenge } = useCircleSdk();
  const [pod, setPod] = useState<EscrowPodWithStats | null>(null);
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<ActionStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function refreshPod() {
    setPod(getEscrowPodWithStats(id));
  }

  useEffect(() => {
    queueMicrotask(refreshPod);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function copyInviteLink() {
    await navigator.clipboard.writeText(`${window.location.origin}/wallet/pods/${id}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function handleContribute() {
    if (!pod || !primaryWallet) return;
    setStatus("working");
    setMessage("Preparing contribution...");
    try {
      const numericAmount = Number(amount);
      if (!amount || Number.isNaN(numericAmount) || numericAmount <= 0) {
        throw new Error("Enter a valid contribution amount.");
      }
      const userToken = window.localStorage.getItem("unitpay.userToken");
      if (!userToken) throw new Error("Session expired — please reload.");

      const chain = getChain(chainKeyForBlockchain(pod.blockchain));
      const { challengeId } = await apiPost<{ challengeId: string }>("/api/wallet/transfer", {
        userToken,
        walletId: primaryWallet.id,
        destinationAddress: pod.treasuryAddress,
        amount,
        tokenAddress: chain.usdcIsNativeGas ? "" : chain.usdcAddress,
        blockchain: pod.blockchain,
      });
      if (!challengeId) throw new Error("No transfer challenge returned.");

      setMessage("Approve the pod contribution with your PIN...");
      await executeChallenge(challengeId);
      addEscrowPodContribution({
        podId: pod.id,
        contributorAddress: primaryWallet.address,
        amount,
      });
      setAmount("");
      setStatus("done");
      setMessage("Contribution recorded.");
      refreshPod();
    } catch (err) {
      setStatus("error");
      setMessage((err as Error).message ?? String(err));
    }
  }

  function handleStatusChange(nextStatus: EscrowPodStatus) {
    updateEscrowPodStatus(id, nextStatus);
    refreshPod();
  }

  if (!pod) {
    return (
      <main className="min-h-full flex items-center justify-center px-6">
        <p className="text-error text-sm text-center">Pod not found.</p>
      </main>
    );
  }

  const isCreator =
    primaryWallet?.address.toLowerCase() === pod.creatorAddress.toLowerCase();
  const canAccess = canAccessEscrowPod(pod, primaryWallet?.address);
  const isClosed = pod.status === "Closed";

  return (
    <main className="px-4 sm:px-6 py-6 sm:py-8 max-w-md md:max-w-2xl mx-auto w-full space-y-6">
      <PageHeader title={pod.title} backHref="/wallet/pods" />

      {!canAccess ? (
        <Card className="space-y-3 text-center py-5">
          <p className="text-sm text-muted">
            This private pod is restricted to whitelisted wallet addresses.
          </p>
          {!primaryWallet && (
            <Link href={`/onboarding/login?next=${encodeURIComponent(`/wallet/pods/${id}`)}`}>
              <Button size="lg" fullWidth>
                Log in to check access
              </Button>
            </Link>
          )}
        </Card>
      ) : (
        <>
          <Card className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-muted">{pod.visibility === "public" ? "Public" : "Private"}</span>
              <span className="text-sm font-medium">{pod.status}</span>
            </div>
            <p className="text-sm text-muted whitespace-pre-wrap">{pod.description}</p>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-muted">Raised</p>
                <p className="font-medium">{pod.totalContributed.toFixed(2)} USDC</p>
              </div>
              <div>
                <p className="text-xs text-muted">Target</p>
                <p className="font-medium">{pod.targetAmount ?? "Flexible"} USDC</p>
              </div>
            </div>
            {pod.progress !== null && (
              <div className="h-2 rounded-full bg-surface overflow-hidden">
                <div className="h-full bg-primary" style={{ width: `${pod.progress}%` }} />
              </div>
            )}
            <div className="space-y-1.5">
              <p className="text-xs text-muted">Pod treasury</p>
              <code className="block text-xs break-all bg-background rounded-lg px-2.5 py-2">
                {pod.treasuryAddress}
              </code>
            </div>
          </Card>

          <Button onClick={copyInviteLink} variant="secondary" fullWidth>
            {copied ? "Copied!" : "Copy invite link"}
          </Button>

          {isCreator && (
            <Card>
              <Field label="Pod status">
                <Select
                  value={pod.status}
                  onChange={(e) => handleStatusChange(e.target.value as EscrowPodStatus)}
                >
                  <option value="Open">Open</option>
                  <option value="Completed">Completed</option>
                  <option value="Closed">Closed</option>
                </Select>
              </Field>
            </Card>
          )}

          <Card className="space-y-3">
            <Field label="Contribution amount (USDC)">
              <Input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                inputMode="decimal"
              />
            </Field>
            {walletLoading ? (
              <p className="text-sm text-muted">Checking session...</p>
            ) : !primaryWallet ? (
              <Link href={`/onboarding/wallet?next=${encodeURIComponent(`/wallet/pods/${id}`)}`}>
                <Button size="lg" fullWidth>
                  Create a wallet to contribute
                </Button>
              </Link>
            ) : (
              <Button
                onClick={handleContribute}
                disabled={status === "working" || isClosed || !amount}
                size="lg"
                fullWidth
              >
                {status === "working" ? "Working..." : "Contribute"}
              </Button>
            )}
            {isClosed && <p className="text-xs text-muted">This pod is closed to new contributions.</p>}
            {message && (
              <p className={`text-xs ${status === "error" ? "text-error" : "text-muted"}`}>
                {message}
              </p>
            )}
          </Card>

          <Card className="space-y-3">
            <p className="text-xs text-muted uppercase tracking-wide">Contribution history</p>
            {pod.contributions.length === 0 ? (
              <p className="text-sm text-muted">No contributions yet.</p>
            ) : (
              pod.contributions.map((contribution) => (
                <div key={contribution.id} className="flex justify-between gap-3 text-sm">
                  <span className="font-mono text-xs text-muted truncate">
                    {contribution.contributorAddress.slice(0, 8)}...
                    {contribution.contributorAddress.slice(-6)}
                  </span>
                  <span className="font-medium">{contribution.amount} USDC</span>
                </div>
              ))
            )}
          </Card>
        </>
      )}
    </main>
  );
}
