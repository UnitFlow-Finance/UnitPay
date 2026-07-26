/**
 * Source-chain allocation for "seamless send" — the piece that lets a user
 * send USDC from their Gateway unified balance without picking which of
 * their own chains it comes from.
 *
 * Mirrors the strategy Circle's own App Kit unified-balance docs describe
 * for automatic source selection (docs.arc.io/app-kit/tutorials/unified-balance/select-source-blockchains):
 * prefer the destination chain first (no cross-chain hop needed at all),
 * then draw from the remaining chains ordered by highest balance, splitting
 * across as many legs as required to cover the requested amount.
 */
import { usdcFromBaseUnits, usdcToBaseUnits } from "../units";

export interface AllocationCandidate {
  chainKey: string;
  /** Human-readable USDC balance available on this chain, e.g. "12.5". */
  balance: string;
}

export interface AllocationLeg {
  chainKey: string;
  /** Human-readable USDC amount to draw from this chain. */
  amount: string;
}

/**
 * Picks which chains to burn from (and how much from each) to cover
 * `amount`, given the user's per-chain unified balance and the chosen
 * destination chain.
 *
 * Throws if the total available balance is insufficient.
 */
export function allocateSourceChains(
  candidates: AllocationCandidate[],
  amount: string,
  destinationChainKey: string,
): AllocationLeg[] {
  const targetBaseUnits = usdcToBaseUnits(amount);
  if (targetBaseUnits <= 0n) {
    throw new Error("Amount must be greater than zero.");
  }

  const pool = candidates
    .map((c) => ({ chainKey: c.chainKey, remaining: usdcToBaseUnits(c.balance || "0") }))
    .filter((c) => c.remaining > 0n);

  // Destination-first: if the recipient's chain already holds balance,
  // draw from it before touching any other chain — this avoids an
  // unnecessary cross-chain hop entirely when funds are already local.
  pool.sort((a, b) => {
    if (a.chainKey === destinationChainKey && b.chainKey !== destinationChainKey) return -1;
    if (b.chainKey === destinationChainKey && a.chainKey !== destinationChainKey) return 1;
    return b.remaining - a.remaining > 0n ? 1 : b.remaining - a.remaining < 0n ? -1 : 0;
  });

  const legs: AllocationLeg[] = [];
  let remainingTarget = targetBaseUnits;

  for (const chain of pool) {
    if (remainingTarget <= 0n) break;
    const draw = chain.remaining < remainingTarget ? chain.remaining : remainingTarget;
    if (draw <= 0n) continue;
    legs.push({ chainKey: chain.chainKey, amount: usdcFromBaseUnits(draw) });
    remainingTarget -= draw;
  }

  if (remainingTarget > 0n) {
    throw new Error(
      "Insufficient unified balance to cover this amount across all chains.",
    );
  }

  return legs;
}
