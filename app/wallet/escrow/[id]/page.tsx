"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiPost } from "@/lib/api";
import { useCircleSdk } from "@/lib/circle/sdkContext";
import { useWallet } from "@/lib/useWallet";
import { usdcFromBaseUnits } from "@/lib/units";
import { readEscrow, type EscrowRecord } from "@/lib/escrow/contract";
import {
  decryptEscrowTerms,
  escrowFragmentStorageKey,
  hashEscrowTerms,
  parseEscrowShareFragment,
  type EscrowTerms,
} from "@/lib/escrow/terms";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

type ActionStep = "idle" | "working" | "error";

/**
 * Escrow detail page. Anyone with this URL (including the URL fragment
 * carrying the terms-decryption key) can view it — no wallet or login
 * required. Acting on it (release/refund/dispute) needs a UnitPay wallet
 * matching the payer/payee/arbiter address recorded on-chain, so logged-
 * out visitors get a "register or log in" CTA carrying this exact URL via
 * `?next=` — see /onboarding/wallet and /onboarding/login. Note the `next`
 * URL intentionally omits the `#fragment`: URL fragments aren't sent to
 * any server or preserved through router.push, so a visitor who lands
 * here without the fragment (e.g. via /wallet/escrow's list rather than
 * the original share link) simply won't see the decrypted terms — same
 * as any other browser session that never had that specific link.
 */
const STATUS_STYLES: Record<EscrowRecord["status"], string> = {
  Funded: "text-warning",
  Released: "text-success",
  Refunded: "text-muted",
  Disputed: "text-error",
};

export default function EscrowDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { primaryWallet } = useWallet();
  const { executeChallenge } = useCircleSdk();

  const [escrow, setEscrow] = useState<EscrowRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [terms, setTerms] = useState<EscrowTerms | null>(null);
  const [termsError, setTermsError] = useState<string | null>(null);

  const [actionStep, setActionStep] = useState<ActionStep>("idle");
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const [shareFragment, setShareFragment] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  // Captured once at mount rather than read via Date.now() during render
  // (which the react-hooks/purity rule flags as an impure render call).
  const [nowSeconds] = useState(() => BigInt(Math.floor(Date.now() / 1000)));

  const loadEscrow = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const record = await readEscrow(BigInt(id));
      setEscrow(record);
    } catch (err) {
      setLoadError((err as Error).message ?? String(err));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await loadEscrow();
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
  }, [loadEscrow]);

  // The AES key + ciphertext live only in the URL fragment (never sent to
  // any server) — see lib/escrow/terms.ts. Decrypt client-side on load.
  // If there's no fragment in the URL (e.g. the creator navigated here
  // from /wallet/escrow's list rather than their original share link),
  // fall back to this browser's local cache of the fragment from when
  // the escrow was created — see app/wallet/escrow/new/page.tsx.
  useEffect(() => {
    let fragment = window.location.hash;
    if (!fragment || fragment.length <= 1) {
      const cached = window.localStorage.getItem(escrowFragmentStorageKey(id));
      if (!cached) return;
      fragment = `#${cached}`;
    }

    (async () => {
      setShareFragment(fragment.slice(1));
      try {
        const { encrypted, rawKey } = parseEscrowShareFragment(fragment);
        const decrypted = await decryptEscrowTerms(encrypted, rawKey);
        setTerms(decrypted);
      } catch (err) {
        setTermsError((err as Error).message ?? "Could not decrypt terms from this link.");
      }
    })();
  }, [id]);

  async function copyLink() {
    if (!shareFragment) return;
    const url = `${window.location.origin}/wallet/escrow/${id}#${shareFragment}`;
    await navigator.clipboard.writeText(url);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 1500);
  }

  // Once both the terms (from the link) and the escrow record (from
  // chain) are available, verify the decrypted terms actually match the
  // on-chain commitment hash — proves the terms haven't been swapped.
  // Derived directly from state (no effect needed) since it's a pure
  // function of `terms` and `escrow`.
  const termsVerified = terms && escrow ? hashEscrowTerms(terms) === escrow.termsHash : null;

  async function runAction(
    path:
      | "/api/escrow/release"
      | "/api/escrow/refund"
      | "/api/escrow/dispute"
      | "/api/escrow/resolve-timeout",
    workingMessage: string,
  ) {
    if (!primaryWallet || !escrow) return;
    setActionStep("working");
    setActionMessage(workingMessage);
    try {
      const userToken = window.localStorage.getItem("unitpay.userToken");
      if (!userToken) throw new Error("Session expired — please reload.");

      const { challengeId } = await apiPost<{ challengeId: string }>(path, {
        userToken,
        walletId: primaryWallet.id,
        escrowId: escrow.id.toString(),
      });
      await executeChallenge(challengeId);

      setActionStep("idle");
      setActionMessage(null);
      await loadEscrow();
    } catch (err) {
      setActionStep("error");
      setActionMessage((err as Error).message ?? String(err));
    }
  }

  if (loading) {
    return (
      <main className="min-h-full flex items-center justify-center">
        <p className="text-muted text-sm">Loading escrow...</p>
      </main>
    );
  }

  if (loadError || !escrow) {
    return (
      <main className="min-h-full flex items-center justify-center px-6">
        <p className="text-error text-sm text-center">
          {loadError ?? "Escrow not found."}
        </p>
      </main>
    );
  }

  const myAddress = primaryWallet?.address.toLowerCase();
  const isPayer = myAddress === escrow.payer.toLowerCase();
  const isPayee = myAddress === escrow.payee.toLowerCase();
  const isArbiter =
    escrow.arbiter !== "0x0000000000000000000000000000000000000000" &&
    myAddress === escrow.arbiter.toLowerCase();
  const hasArbiter = escrow.arbiter !== "0x0000000000000000000000000000000000000000";
  const isExpired = escrow.expiresAt !== 0n && nowSeconds > escrow.expiresAt;

  const canRelease =
    (escrow.status === "Funded" && isPayer) || (escrow.status === "Disputed" && isArbiter);
  const canRefund =
    (escrow.status === "Funded" && (isPayee || (isPayer && isExpired))) ||
    (escrow.status === "Disputed" && isArbiter);
  const canDispute = escrow.status === "Funded" && (isPayer || isPayee) && hasArbiter;
  // DISPUTE_TIMEOUT is a fixed on-chain constant (30 days) — hardcoded
  // here to avoid an extra RPC round-trip; kept in sync with the
  // contract's `DISPUTE_TIMEOUT` (see lib/escrow/contract.ts's
  // readDisputeTimeout for the on-chain source of truth if this ever
  // needs to be read dynamically instead).
  const DISPUTE_TIMEOUT_SECONDS = 30n * 24n * 60n * 60n;
  const disputeTimedOut =
    escrow.status === "Disputed" &&
    escrow.disputedAt !== 0n &&
    nowSeconds > escrow.disputedAt + DISPUTE_TIMEOUT_SECONDS;

  return (
    <main className="px-4 sm:px-6 py-6 sm:py-8 max-w-md md:max-w-lg mx-auto w-full space-y-6">
      <PageHeader title={`Escrow #${escrow.id.toString()}`} backHref="/wallet/escrow" />

      {shareFragment && (
        <Button onClick={copyLink} variant="secondary" fullWidth>
          {linkCopied ? "Copied!" : "Copy escrow link"}
        </Button>
      )}

      <Card className="space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted">Status</span>
          <span className={`text-sm font-medium ${STATUS_STYLES[escrow.status]}`}>
            {escrow.status}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted">Amount</span>
          <span className="font-medium">{usdcFromBaseUnits(escrow.amount)} USDC</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted">Payer</span>
          <span className="font-mono text-xs">
            {escrow.payer.slice(0, 8)}…{escrow.payer.slice(-6)}
            {isPayer && " (you)"}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted">Payee</span>
          <span className="font-mono text-xs">
            {escrow.payee.slice(0, 8)}…{escrow.payee.slice(-6)}
            {isPayee && " (you)"}
          </span>
        </div>
        {hasArbiter && (
          <div className="flex justify-between text-sm">
            <span className="text-muted">Arbiter</span>
            <span className="font-mono text-xs">
              {escrow.arbiter.slice(0, 8)}…{escrow.arbiter.slice(-6)}
              {isArbiter && " (you)"}
            </span>
          </div>
        )}
        {escrow.expiresAt !== 0n && (
          <div className="flex justify-between text-sm">
            <span className="text-muted">Auto-refund after</span>
            <span>{new Date(Number(escrow.expiresAt) * 1000).toLocaleDateString()}</span>
          </div>
        )}
      </Card>

      <Card className="space-y-2">
        <p className="text-xs text-muted uppercase tracking-wide">Task terms</p>
        {terms ? (
          <div className="space-y-2 text-sm">
            {termsVerified === false && (
              <p className="text-error text-xs">
                ⚠️ These terms don&apos;t match the on-chain commitment hash — do not trust this
                link.
              </p>
            )}
            <p className="font-medium">{terms.title}</p>
            <p className="text-muted whitespace-pre-wrap">{terms.description}</p>
            {terms.deliverables && (
              <p>
                <span className="text-muted">Deliverables: </span>
                {terms.deliverables}
              </p>
            )}
            {terms.deadline && (
              <p>
                <span className="text-muted">Deadline: </span>
                {terms.deadline}
              </p>
            )}
          </div>
        ) : termsError ? (
          <p className="text-error text-xs">{termsError}</p>
        ) : (
          <p className="text-muted text-sm">
            Terms are end-to-end encrypted and only readable from the original share link (the
            decryption key lives in the URL, not on any server).
          </p>
        )}
      </Card>

      {!primaryWallet ? (
        <Card className="space-y-3 text-center py-5">
          <p className="text-sm text-muted">
            You need a UnitPay wallet to act on this escrow as the payer, payee, or arbiter.
          </p>
          <Link href={`/onboarding/wallet?next=${encodeURIComponent(`/wallet/escrow/${id}`)}`}>
            <Button size="lg" fullWidth>
              Create a wallet
            </Button>
          </Link>
          <Link
            href={`/onboarding/login?next=${encodeURIComponent(`/wallet/escrow/${id}`)}`}
            className="block text-xs text-muted hover:text-foreground transition-colors"
          >
            Already have a wallet? Log in
          </Link>
        </Card>
      ) : (
        <div className="space-y-3">
          {canRelease && (
            <Button
              onClick={() =>
                runAction(
                  "/api/escrow/release",
                  isArbiter
                    ? "Resolving dispute in favor of the payee..."
                    : "Releasing funds to the payee...",
                )
              }
              disabled={actionStep === "working"}
              size="lg"
              fullWidth
            >
              {isArbiter ? "Resolve: pay payee" : "Release funds to payee"}
            </Button>
          )}
          {canRefund && (
            <Button
              onClick={() =>
                runAction(
                  "/api/escrow/refund",
                  isArbiter
                    ? "Resolving dispute in favor of the payer..."
                    : "Refunding funds to the payer...",
                )
              }
              disabled={actionStep === "working"}
              variant="secondary"
              size="lg"
              fullWidth
            >
              {isArbiter ? "Resolve: refund payer" : "Refund payer"}
            </Button>
          )}
          {canDispute && (
            <Button
              onClick={() => runAction("/api/escrow/dispute", "Flagging escrow as disputed...")}
              disabled={actionStep === "working"}
              variant="secondary"
              size="lg"
              fullWidth
            >
              Raise dispute
            </Button>
          )}
          {disputeTimedOut && (
            <div className="space-y-2">
              <p className="text-xs text-muted">
                This dispute has been unresolved for over 30 days. Anyone can now refund the
                payer, so an unresponsive arbiter can never lock these funds permanently.
              </p>
              <Button
                onClick={() =>
                  runAction(
                    "/api/escrow/resolve-timeout",
                    "Refunding payer (dispute timed out)...",
                  )
                }
                disabled={actionStep === "working"}
                variant="secondary"
                size="lg"
                fullWidth
              >
                Resolve timed-out dispute (refund payer)
              </Button>
            </div>
          )}
          {actionMessage && (
            <p className={`text-xs ${actionStep === "error" ? "text-error" : "text-muted"}`}>
              {actionMessage}
            </p>
          )}
        </div>
      )}
    </main>
  );
}
