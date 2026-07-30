export type EscrowPodVisibility = "public" | "private";
export type EscrowPodStatus = "Open" | "Completed" | "Closed" | "Pending approval";
export type PodCompletionMode = "automatic" | "creator_approval";

export interface PaymentLinkAttachment {
  encoded: string;
  urlPath: string;
  amount: string;
  memo?: string;
  recipientAddress: string;
  blockchain: string;
  completionMode: PodCompletionMode;
  completedAt?: string;
}

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
  updatedAt: string;
  paymentLink?: PaymentLinkAttachment;
}

export interface EscrowPodContribution {
  id: string;
  podId: string;
  contributorAddress: string;
  amount: string;
  createdAt: string;
  txHash?: string;
}

export interface EscrowPodActivity {
  id: string;
  podId: string;
  type: "created" | "contributed" | "completed" | "closed" | "status_changed";
  message: string;
  createdAt: string;
}

export interface EscrowPodWithStats extends EscrowPod {
  contributions: EscrowPodContribution[];
  activity: EscrowPodActivity[];
  totalContributed: number;
  remainingAmount: number | null;
  progress: number | null;
}

export function normalizeAddress(address: string): string {
  return address.trim().toLowerCase();
}

export function podStats(
  pod: EscrowPod,
  contributions: EscrowPodContribution[],
  activity: EscrowPodActivity[],
): EscrowPodWithStats {
  const totalContributed = contributions.reduce(
    (sum, contribution) => sum + (Number(contribution.amount) || 0),
    0,
  );
  const target = pod.targetAmount ? Number(pod.targetAmount) : null;
  const remainingAmount = target === null ? null : Math.max(0, target - totalContributed);
  const progress = target === null ? null : Math.min(100, (totalContributed / target) * 100);
  return { ...pod, contributions, activity, totalContributed, remainingAmount, progress };
}
