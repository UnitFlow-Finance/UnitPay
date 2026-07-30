"use client";

import type {
  EscrowPodStatus,
  EscrowPodWithStats,
  PaymentLinkAttachment,
} from "@/lib/pods/types";

async function parseJson<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error ?? body.message ?? "Request failed");
  }
  return body as T;
}

export async function listPodsRemote(visibility?: "public"): Promise<EscrowPodWithStats[]> {
  const query = visibility ? `?visibility=${visibility}` : "";
  const { pods } = await parseJson<{ pods: EscrowPodWithStats[] }>(
    await fetch(`/api/pods${query}`, { cache: "no-store" }),
  );
  return pods;
}

export async function getPodRemote(id: string): Promise<EscrowPodWithStats | null> {
  const { pod } = await parseJson<{ pod: EscrowPodWithStats | null }>(
    await fetch(`/api/pods/${id}`, { cache: "no-store" }),
  );
  return pod;
}

export async function createPodRemote(input: {
  title: string;
  description: string;
  creatorAddress: string;
  creatorLabel?: string;
  treasuryAddress: string;
  blockchain: string;
  visibility: "public" | "private";
  whitelist: string[];
  targetAmount?: string;
  paymentLink?: PaymentLinkAttachment;
}): Promise<EscrowPodWithStats> {
  const { pod } = await parseJson<{ pod: EscrowPodWithStats }>(
    await fetch("/api/pods", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
  return pod;
}

export async function addContributionRemote(input: {
  podId: string;
  contributorAddress: string;
  amount: string;
  txHash?: string;
}): Promise<EscrowPodWithStats> {
  const { pod } = await parseJson<{ pod: EscrowPodWithStats }>(
    await fetch(`/api/pods/${input.podId}/contributions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
  return pod;
}

export async function updatePodStatusRemote(
  id: string,
  status: EscrowPodStatus,
): Promise<EscrowPodWithStats> {
  const { pod } = await parseJson<{ pod: EscrowPodWithStats }>(
    await fetch(`/api/pods/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    }),
  );
  return pod;
}
