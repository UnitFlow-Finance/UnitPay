/**
 * Shared Circle `@circle-fin/unified-balance-kit` context.
 *
 * This is Circle's Arc App Kit "Unified Balance" SDK — the one referenced
 * in Circle's own docs (docs.arc.io/app-kit/unified-balance). We use its
 * default context (default Gateway v1 provider, no custom fee policy) for
 * every balance read on /wallet/unified. It requires no API key and does
 * no signing — safe to construct once and reuse across the client bundle.
 */
import { createUnifiedBalanceKitContext, type UnifiedBalanceKitContext } from "@circle-fin/unified-balance-kit";

let cached: UnifiedBalanceKitContext | undefined;

export function getUnifiedBalanceKitContext(): UnifiedBalanceKitContext {
  if (!cached) {
    cached = createUnifiedBalanceKitContext();
  }
  return cached;
}
