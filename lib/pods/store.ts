import "server-only";

import { readJsonFile, updateJsonFile } from "@/lib/platform/store";
import {
  normalizeAddress,
  podStats,
  type EscrowPod,
  type EscrowPodActivity,
  type EscrowPodContribution,
  type EscrowPodStatus,
  type EscrowPodWithStats,
} from "@/lib/pods/types";

interface PodDatabase {
  pods: EscrowPod[];
  contributions: EscrowPodContribution[];
  activity: EscrowPodActivity[];
}

type NewPodInput = Omit<EscrowPod, "id" | "status" | "createdAt" | "updatedAt"> & {
  status?: EscrowPodStatus;
};

const PODS_FILE = "pods.json";
const emptyDb: PodDatabase = { pods: [], contributions: [], activity: [] };

async function readDb(): Promise<PodDatabase> {
  const parsed = await readJsonFile<Partial<PodDatabase>>(PODS_FILE, emptyDb);
  return {
    pods: Array.isArray(parsed.pods) ? parsed.pods : [],
    contributions: Array.isArray(parsed.contributions) ? parsed.contributions : [],
    activity: Array.isArray(parsed.activity) ? parsed.activity : [],
  };
}

async function updateDb<T>(fn: (db: PodDatabase) => T | Promise<T>): Promise<T> {
  return updateJsonFile(PODS_FILE, emptyDb, async (db) => fn(db));
}

function byNewest<T extends { createdAt: string }>(a: T, b: T): number {
  return b.createdAt.localeCompare(a.createdAt);
}

function toStats(db: PodDatabase, pod: EscrowPod): EscrowPodWithStats {
  return podStats(
    pod,
    db.contributions.filter((contribution) => contribution.podId === pod.id).sort(byNewest),
    db.activity.filter((event) => event.podId === pod.id).sort(byNewest),
  );
}

export async function listPods(visibility?: "public"): Promise<EscrowPodWithStats[]> {
  const db = await readDb();
  return db.pods
    .filter((pod) => (visibility === "public" ? pod.visibility === "public" : true))
    .sort(byNewest)
    .map((pod) => toStats(db, pod));
}

export async function getPod(id: string): Promise<EscrowPodWithStats | null> {
  const db = await readDb();
  const pod = db.pods.find((entry) => entry.id === id);
  return pod ? toStats(db, pod) : null;
}

export async function createPod(input: NewPodInput): Promise<EscrowPodWithStats> {
  return updateDb((db) => {
    const now = new Date().toISOString();
    const pod: EscrowPod = {
      ...input,
      id: crypto.randomUUID(),
      status: input.status ?? "Open",
      createdAt: now,
      updatedAt: now,
      whitelist: input.whitelist.map(normalizeAddress).filter(Boolean),
    };
    db.pods.unshift(pod);
    db.activity.unshift({
      id: crypto.randomUUID(),
      podId: pod.id,
      type: "created",
      message: pod.paymentLink
        ? "Collaborative payment pod created."
        : "Pod created and indexed for discovery.",
      createdAt: now,
    });
    return toStats(db, pod);
  });
}

export async function importPods(input: {
  pods: Array<Partial<EscrowPod>>;
  contributions?: Array<Partial<EscrowPodContribution>>;
}): Promise<EscrowPodWithStats[]> {
  return updateDb((db) => {
    const now = new Date().toISOString();
    const imported: EscrowPodWithStats[] = [];

    for (const entry of input.pods) {
      if (
        !entry.id ||
        !entry.title ||
        !entry.description ||
        !entry.creatorAddress ||
        !entry.treasuryAddress ||
        !entry.blockchain
      ) {
        continue;
      }

      let pod = db.pods.find((existing) => existing.id === entry.id);
      if (!pod) {
        pod = {
          id: entry.id,
          title: entry.title,
          description: entry.description,
          creatorAddress: entry.creatorAddress,
          creatorLabel: entry.creatorLabel,
          treasuryAddress: entry.treasuryAddress,
          blockchain: entry.blockchain,
          visibility: entry.visibility === "private" ? "private" : "public",
          whitelist: Array.isArray(entry.whitelist)
            ? entry.whitelist.map(normalizeAddress).filter(Boolean)
            : [],
          targetAmount: entry.targetAmount,
          status:
            entry.status === "Completed" ||
            entry.status === "Closed" ||
            entry.status === "Pending approval"
              ? entry.status
              : "Open",
          createdAt: entry.createdAt ?? now,
          updatedAt: entry.updatedAt ?? entry.createdAt ?? now,
          paymentLink: entry.paymentLink,
        };
        db.pods.unshift(pod);
        db.activity.unshift({
          id: crypto.randomUUID(),
          podId: pod.id,
          type: "created",
          message: "Legacy pod imported into discovery.",
          createdAt: now,
        });
      }

      imported.push(toStats(db, pod));
    }

    for (const entry of input.contributions ?? []) {
      if (!entry.podId || !entry.contributorAddress || !entry.amount) continue;
      const exists = entry.id && db.contributions.some((existing) => existing.id === entry.id);
      if (exists) continue;
      db.contributions.unshift({
        id: entry.id ?? crypto.randomUUID(),
        podId: entry.podId,
        contributorAddress: entry.contributorAddress,
        amount: entry.amount,
        txHash: entry.txHash,
        createdAt: entry.createdAt ?? now,
      });
    }

    return imported.map((pod) => toStats(db, pod));
  });
}

export async function addContribution(input: {
  podId: string;
  contributorAddress: string;
  amount: string;
  txHash?: string;
}): Promise<EscrowPodWithStats | null> {
  return updateDb((db) => {
    const pod = db.pods.find((entry) => entry.id === input.podId);
    if (!pod) return null;

    const now = new Date().toISOString();
    db.contributions.unshift({
      id: crypto.randomUUID(),
      podId: pod.id,
      contributorAddress: input.contributorAddress,
      amount: input.amount,
      txHash: input.txHash,
      createdAt: now,
    });
    db.activity.unshift({
      id: crypto.randomUUID(),
      podId: pod.id,
      type: "contributed",
      message: `${input.amount} USDC contributed.`,
      createdAt: now,
    });

    const withStats = toStats(db, pod);
    if (
      withStats.targetAmount &&
      withStats.totalContributed >= Number(withStats.targetAmount) &&
      pod.status === "Open"
    ) {
      pod.status =
        pod.paymentLink?.completionMode === "creator_approval" ? "Pending approval" : "Completed";
      pod.updatedAt = now;
      if (pod.paymentLink && pod.status === "Completed") {
        pod.paymentLink.completedAt = now;
      }
      db.activity.unshift({
        id: crypto.randomUUID(),
        podId: pod.id,
        type: "completed",
        message:
          pod.status === "Completed"
            ? "Funding target reached and payment marked complete."
            : "Funding target reached and is waiting for creator approval.",
        createdAt: now,
      });
    }

    return toStats(db, pod);
  });
}

export async function updatePodStatus(
  id: string,
  status: EscrowPodStatus,
): Promise<EscrowPodWithStats | null> {
  return updateDb((db) => {
    const pod = db.pods.find((entry) => entry.id === id);
    if (!pod) return null;
    const now = new Date().toISOString();
    pod.status = status;
    pod.updatedAt = now;
    if (pod.paymentLink && status === "Completed") {
      pod.paymentLink.completedAt = now;
    }
    db.activity.unshift({
      id: crypto.randomUUID(),
      podId: pod.id,
      type: status === "Closed" ? "closed" : "status_changed",
      message: `Pod status changed to ${status}.`,
      createdAt: now,
    });
    return toStats(db, pod);
  });
}
