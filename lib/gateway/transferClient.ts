"use client";

import { apiPost } from "@/lib/api";

type ExecuteChallenge = (challengeId: string) => Promise<{
  status: string;
  type?: string;
  data?: unknown;
}>;

export interface GatewayTransferLegInput {
  userToken: string;
  walletId: string;
  sourceChainKey: string;
  destinationChainKey: string;
  sourceAddress: string;
  recipientAddress: string;
  amount: string;
  executeChallenge: ExecuteChallenge;
}

function readSignature(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (typeof record.signature === "string") return record.signature;
  if (record.data && typeof record.data === "object") {
    const data = record.data as Record<string, unknown>;
    if (typeof data.signature === "string") return data.signature;
  }
  if (record.result && typeof record.result === "object") {
    return readSignature(record.result);
  }
  return null;
}

export async function sendGatewayUsdcLeg({
  userToken,
  walletId,
  sourceChainKey,
  destinationChainKey,
  sourceAddress,
  recipientAddress,
  amount,
  executeChallenge,
}: GatewayTransferLegInput): Promise<void> {
  const { challengeId, burnIntent } = await apiPost<{
    challengeId: string;
    burnIntent: unknown;
  }>("/api/gateway/transfer/build-burn-intent", {
    userToken,
    walletId,
    sourceChainKey,
    destinationChainKey,
    sourceAddress,
    recipientAddress,
    amount,
  });

  if (!challengeId) throw new Error("No signing challenge returned from server.");

  const signatureResult = await executeChallenge(challengeId);
  const signature = readSignature(signatureResult.data) ?? readSignature(signatureResult);
  if (!signature) throw new Error("No signature returned from PIN challenge.");

  const { attestation, signature: mintSignature } = await apiPost<{
    attestation: string;
    signature: string;
  }>("/api/gateway/transfer/submit", { burnIntent, signature });

  const { challengeId: mintChallengeId } = await apiPost<{ challengeId: string }>(
    "/api/gateway/transfer/mint",
    { userToken, walletId, attestation, signature: mintSignature },
  );
  if (!mintChallengeId) throw new Error("No mint challenge returned from server.");
  await executeChallenge(mintChallengeId);
}
