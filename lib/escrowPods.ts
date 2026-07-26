"use client";

const PODS_STORAGE_KEY = "unitpay.escrowPods";
const CONTRIBUTIONS_STORAGE_KEY = "unitpay.escrowPodContributions";

export type EscrowPodVisibility = "public" | "private";
export type EscrowPodStatus = "Open" | "Completed" | "Closed";

export interface EscrowPod {
  id: string;
  title: string;
  description: string;
  creatorAddress: string;
  creatorLabel?: string;
  treasuryAddress: string;
  blockchain: string;
  visibility: EscrowPodVisibility;
  whitelist: string[];
  targetAmount?: string;
  status: EscrowPodStatus;
  createdAt: string;
}

export interface EscrowPodContribution {
  id: string;
  podId: string;
  contributorAddress: string;
  amount: string;
  createdAt: string;
}

export interface EscrowPodWithStats extends EscrowPod {
  contributions: EscrowPodContribution[];
  totalContributed: number;
  progress: number | null;
}

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T): void {
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function normalizeAddress(address: string): string {
  return address.trim().toLowerCase();
}

export function createEscrowPod(
  pod: Omit<EscrowPod, "id" | "status" | "createdAt">,
): EscrowPod {
  const next: EscrowPod = {
    ...pod,
    id: crypto.randomUUID(),
    status: "Open",
    createdAt: new Date().toISOString(),
    whitelist: pod.whitelist.map(normalizeAddress).filter(Boolean),
  };
  writeJson(PODS_STORAGE_KEY, [next, ...listEscrowPods()]);
  return next;
}

export function listEscrowPods(): EscrowPod[] {
  return readJson<EscrowPod[]>(PODS_STORAGE_KEY, []);
}

export function listPublicEscrowPods(): EscrowPod[] {
  return listEscrowPods().filter((pod) => pod.visibility === "public");
}

export function getEscrowPod(id: string): EscrowPod | null {
  return listEscrowPods().find((pod) => pod.id === id) ?? null;
}

export function listEscrowPodContributions(podId: string): EscrowPodContribution[] {
  return readJson<EscrowPodContribution[]>(CONTRIBUTIONS_STORAGE_KEY, [])
    .filter((contribution) => contribution.podId === podId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function addEscrowPodContribution(
  contribution: Omit<EscrowPodContribution, "id" | "createdAt">,
): EscrowPodContribution {
  const next: EscrowPodContribution = {
    ...contribution,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  const all = readJson<EscrowPodContribution[]>(CONTRIBUTIONS_STORAGE_KEY, []);
  writeJson(CONTRIBUTIONS_STORAGE_KEY, [next, ...all]);

  const withStats = getEscrowPodWithStats(contribution.podId);
  if (
    withStats?.targetAmount &&
    withStats.totalContributed >= Number(withStats.targetAmount) &&
    withStats.status === "Open"
  ) {
    updateEscrowPodStatus(contribution.podId, "Completed");
  }

  return next;
}

export function updateEscrowPodStatus(id: string, status: EscrowPodStatus): void {
  writeJson(
    PODS_STORAGE_KEY,
    listEscrowPods().map((pod) => (pod.id === id ? { ...pod, status } : pod)),
  );
}

export function canAccessEscrowPod(pod: EscrowPod, walletAddress?: string | null): boolean {
  if (pod.visibility === "public") return true;
  if (pod.whitelist.length === 0) return true;
  if (!walletAddress) return false;
  return pod.whitelist.includes(normalizeAddress(walletAddress));
}

export function getEscrowPodWithStats(id: string): EscrowPodWithStats | null {
  const pod = getEscrowPod(id);
  if (!pod) return null;
  const contributions = listEscrowPodContributions(id);
  const totalContributed = contributions.reduce(
    (sum, contribution) => sum + (Number(contribution.amount) || 0),
    0,
  );
  const progress = pod.targetAmount
    ? Math.min(100, (totalContributed / Number(pod.targetAmount)) * 100)
    : null;
  return { ...pod, contributions, totalContributed, progress };
}
