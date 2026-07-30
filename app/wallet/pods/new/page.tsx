"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createPodRemote } from "@/lib/pods/client";
import type { EscrowPodVisibility } from "@/lib/pods/types";
import { useWallet } from "@/lib/useWallet";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Input";

export default function NewEscrowPodPage() {
  const router = useRouter();
  const { primaryWallet, loading } = useWallet();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [visibility, setVisibility] = useState<EscrowPodVisibility>("public");
  const [whitelist, setWhitelist] = useState("");
  const [error, setError] = useState<string | null>(null);

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

  async function handleCreate() {
    if (!primaryWallet) return;

    setError(null);
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    if (!description.trim()) {
      setError("Description is required.");
      return;
    }
    if (targetAmount && Number(targetAmount) <= 0) {
      setError("Target amount must be greater than zero.");
      return;
    }

    try {
      const pod = await createPodRemote({
        title: title.trim(),
        description: description.trim(),
        targetAmount: targetAmount.trim() || undefined,
        creatorAddress: primaryWallet.address,
        treasuryAddress: primaryWallet.address,
        blockchain: primaryWallet.blockchain,
        visibility,
        whitelist: whitelist
          .split(/[\s,]+/)
          .map((entry) => entry.trim())
          .filter(Boolean),
      });
      router.push(`/wallet/pods/${pod.id}`);
    } catch (err) {
      setError((err as Error).message ?? String(err));
    }
  }

  return (
    <main className="px-4 sm:px-6 py-6 sm:py-8 max-w-md md:max-w-lg mx-auto w-full space-y-6">
      <PageHeader title="Create Pod" backHref="/wallet/pods" />

      <Card className="space-y-4">
        <Field label="Pod title">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Community grant" />
        </Field>
        <Field label="Description">
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What is this pod funding?"
            rows={4}
          />
        </Field>
        <Field label="Target amount (optional, USDC)">
          <Input
            value={targetAmount}
            onChange={(e) => setTargetAmount(e.target.value)}
            placeholder="0.00"
            inputMode="decimal"
          />
        </Field>
        <Field label="Visibility">
          <Select value={visibility} onChange={(e) => setVisibility(e.target.value as EscrowPodVisibility)}>
            <option value="public">Public discovery</option>
            <option value="private">Private invite link</option>
          </Select>
        </Field>
        {visibility === "private" && (
          <Field label="Whitelist addresses (optional)">
            <Textarea
              value={whitelist}
              onChange={(e) => setWhitelist(e.target.value)}
              placeholder="0xabc..., 0xdef..."
              rows={3}
              className="font-mono text-xs"
            />
          </Field>
        )}
      </Card>

      {error && <p className="text-error text-sm">{error}</p>}

      <Button onClick={handleCreate} size="lg" fullWidth>
        Create Pod
      </Button>
    </main>
  );
}
