"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiPost } from "@/lib/api";
import { useCircleSdk } from "@/lib/circle/sdkContext";
import { useWallet } from "@/lib/useWallet";
import { escrowFragmentStorageKey, prepareEscrowTerms } from "@/lib/escrow/terms";
import { findEscrowIdByTermsHash } from "@/lib/escrow/contract";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Input";

type Step = "form" | "working" | "done" | "error";

const EXPIRY_OPTIONS: { label: string; seconds: number }[] = [
  { label: "Never", seconds: 0 },
  { label: "7 days", seconds: 7 * 24 * 60 * 60 },
  { label: "30 days", seconds: 30 * 24 * 60 * 60 },
  { label: "90 days", seconds: 90 * 24 * 60 * 60 },
];

/**
 * Creates an escrow: approve() + createEscrow() (see /api/escrow/*),
 * client-side-encrypts the task terms, and produces a single shareable
 * link (`/wallet/escrow/{id}#fragment`) that both funds the work and lets
 * the payee decrypt the terms — see lib/escrow/terms.ts for why the key
 * lives only in the URL fragment, never on a server.
 */
export default function NewEscrowPage() {
  const router = useRouter();
  const { primaryWallet } = useWallet();
  const { executeChallenge } = useCircleSdk();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [deliverables, setDeliverables] = useState("");
  const [deadline, setDeadline] = useState("");
  const [payee, setPayee] = useState("");
  const [arbiter, setArbiter] = useState("");
  const [amount, setAmount] = useState("");
  const [expiresInSeconds, setExpiresInSeconds] = useState(0);

  const [step, setStep] = useState<Step>("form");
  const [message, setMessage] = useState<string | null>(null);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [escrowId, setEscrowId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (!primaryWallet) {
    return (
      <main className="min-h-full flex items-center justify-center px-6">
        <p className="text-muted text-sm">No wallet found.</p>
      </main>
    );
  }

  function validate(): string | null {
    if (!title.trim() || !description.trim()) return "Enter a title and description.";
    if (!/^0x[a-fA-F0-9]{40}$/.test(payee.trim())) return "Enter a valid payee address.";
    if (arbiter.trim() && !/^0x[a-fA-F0-9]{40}$/.test(arbiter.trim())) {
      return "Enter a valid arbiter address, or leave it blank.";
    }
    const amt = Number(amount);
    if (!amount || Number.isNaN(amt) || amt <= 0) return "Enter a valid amount.";
    return null;
  }

  async function handleCreate() {
    const validationError = validate();
    if (validationError) {
      setMessage(validationError);
      return;
    }

    setStep("working");
    setMessage("Encrypting task terms...");
    try {
      const userToken = window.localStorage.getItem("unitpay.userToken");
      if (!userToken) throw new Error("Session expired — please reload.");

      const { termsHash, shareFragment } = await prepareEscrowTerms({
        title: title.trim(),
        description: description.trim(),
        deliverables: deliverables.trim() || undefined,
        deadline: deadline || undefined,
      });

      setMessage("Approving UnitPayEscrow to lock your USDC...");
      const { challengeId: approveChallengeId } = await apiPost<{ challengeId: string }>(
        "/api/escrow/approve",
        { userToken, walletId: primaryWallet!.id, amount },
      );
      await executeChallenge(approveChallengeId);

      setMessage("Creating escrow and locking funds...");
      const { challengeId: createChallengeId } = await apiPost<{ challengeId: string }>(
        "/api/escrow/create",
        {
          userToken,
          walletId: primaryWallet!.id,
          payee: payee.trim(),
          arbiter: arbiter.trim() || undefined,
          amount,
          termsHash,
          expiresInSeconds,
        },
      );
      await executeChallenge(createChallengeId);

      // createEscrow's returned escrowId isn't surfaced by the PIN
      // challenge result, so it's looked up from the EscrowCreated event
      // matching this exact termsHash (collision-proof in practice) —
      // more precise than assuming "highest id so far", which would race
      // against any other concurrent createEscrow call.
      setMessage("Confirming on-chain...");
      const foundId = await findEscrowIdByTermsHash(
        primaryWallet!.address as `0x${string}`,
        termsHash,
      );
      setEscrowId(foundId !== null ? foundId.toString() : null);
      setShareLink(shareFragment);

      // Cache the fragment locally (this browser only) so the creator can
      // come back to /wallet/escrow/{id} later and still copy the full
      // link — the fragment is otherwise never sent anywhere and would
      // be lost the moment this "done" screen is left.
      if (foundId !== null) {
        window.localStorage.setItem(escrowFragmentStorageKey(foundId.toString()), shareFragment);
      }
      setStep("done");
    } catch (err) {
      setMessage((err as Error).message ?? String(err));
      setStep("error");
    }
  }

  async function copyLink() {
    if (!shareLink) return;
    const path = escrowId ? `/wallet/escrow/${escrowId}` : "/wallet/escrow";
    const url = `${window.location.origin}${path}#${shareLink}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <main className="px-4 sm:px-6 py-6 sm:py-8 max-w-md md:max-w-lg mx-auto w-full space-y-6">
      <PageHeader title="New escrow" backHref="/wallet/escrow" />

      {step === "form" && (
        <div className="space-y-4">
          <Card className="space-y-4">
            <Field label="Title">
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Landing page redesign"
              />
            </Field>
            <Field label="Description">
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Scope of work, acceptance criteria..."
                rows={4}
              />
            </Field>
            <Field label="Deliverables (optional)">
              <Input
                value={deliverables}
                onChange={(e) => setDeliverables(e.target.value)}
                placeholder="Figma file + deployed page"
              />
            </Field>
            <Field label="Deadline (optional)">
              <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
            </Field>
          </Card>

          <Card className="space-y-4">
            <Field label="Payee address">
              <Input
                value={payee}
                onChange={(e) => setPayee(e.target.value)}
                placeholder="0x..."
                className="font-mono"
              />
            </Field>
            <Field label="Arbiter address (optional — enables dispute resolution)">
              <Input
                value={arbiter}
                onChange={(e) => setArbiter(e.target.value)}
                placeholder="0x..."
                className="font-mono"
              />
            </Field>
            <Field label="Amount (USDC)">
              <Input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                inputMode="decimal"
              />
            </Field>
            <Field label="Auto-refund payer after">
              <div className="grid grid-cols-4 gap-2">
                {EXPIRY_OPTIONS.map((opt) => (
                  <button
                    key={opt.seconds}
                    type="button"
                    onClick={() => setExpiresInSeconds(opt.seconds)}
                    className={`rounded-xl border px-2 py-2 text-xs font-medium transition-colors ${
                      expiresInSeconds === opt.seconds
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted hover:border-primary/40"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </Field>
          </Card>

          {message && <p className="text-error text-sm">{message}</p>}

          <Button onClick={handleCreate} size="lg" fullWidth>
            Lock funds &amp; create escrow
          </Button>
        </div>
      )}

      {step === "working" && (
        <p className="text-muted text-sm text-center py-8">{message}</p>
      )}

      {step === "done" && (
        <div className="space-y-4">
          <Card className="text-center py-6 space-y-2">
            <p className="text-success font-medium">Escrow created</p>
            <p className="text-muted text-sm">
              {amount} USDC is locked. Share the link below with the payee — it contains the
              encrypted task terms, decryptable only by whoever has the link.
            </p>
          </Card>
          <Button onClick={copyLink} size="lg" fullWidth>
            {copied ? "Copied!" : "Copy escrow link"}
          </Button>
          <Button
            onClick={() =>
              router.push(escrowId ? `/wallet/escrow/${escrowId}` : "/wallet/escrow")
            }
            variant="secondary"
            size="lg"
            fullWidth
          >
            {escrowId ? "View escrow" : "View my escrows"}
          </Button>
        </div>
      )}

      {step === "error" && (
        <div className="space-y-4 text-center py-6">
          <p className="text-error font-medium">Could not create escrow</p>
          <p className="text-muted text-sm">{message}</p>
          <Button onClick={() => setStep("form")} variant="secondary" size="lg" fullWidth>
            Try again
          </Button>
        </div>
      )}
    </main>
  );
}
