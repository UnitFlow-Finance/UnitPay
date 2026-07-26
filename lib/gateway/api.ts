import "server-only";
import { GATEWAY_TESTNET } from "@/lib/chains/config";

/**
 * Thin client for Circle Gateway's public REST API (balances + transfer).
 * This is a stateless HTTP API, separate from Circle Wallets — no API key
 * required for these endpoints as of Circle's current public docs.
 */

export interface SignedBurnIntent {
  burnIntent: unknown;
  signature: string;
}

export interface GatewayTransferResponse {
  attestation: `0x${string}`;
  signature: `0x${string}`;
}

/**
 * Submits one or more signed burn intents to Gateway's /transfer endpoint
 * and returns the attestation + signature needed to call gatewayMint() on
 * the destination chain.
 */
export async function submitBurnIntents(
  intents: SignedBurnIntent[],
): Promise<GatewayTransferResponse> {
  const res = await fetch(`${GATEWAY_TESTNET.apiBaseUrl}/transfer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(
      intents,
      (_key, value) => (typeof value === "bigint" ? value.toString() : value),
    ),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Gateway /transfer failed: ${res.status} ${await res.text()}`);
  }

  return (await res.json()) as GatewayTransferResponse;
}
