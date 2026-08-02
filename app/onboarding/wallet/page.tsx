"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { apiPost } from "@/lib/api";
import { PRIMARY_CHAIN } from "@/lib/chains/config";
import { useCircleSdk } from "@/lib/circle/sdkContext";
import {
  getStoredAuthMethod,
  getStoredUserId,
  isWalletBackupComplete,
  markWalletBackupComplete,
} from "@/lib/session";
import type { UnitPayWallet } from "@/lib/types";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";

/**
 * Wallet setup flow: create a Circle User-Controlled Wallet, PIN-gated, with
 * no seed phrase shown by default. Uses Circle's hosted PIN UI (iframe) via
 * the Web SDK's execute() challenge flow — UnitPay never sees the PIN.
 *
 * This is the destination for every "Create Your Wallet" CTA on the
 * `/onboarding` marketing page — kept as its own route so that page can be a
 * pure landing experience without a wallet-creation side effect on load.
 *
 * Supports an optional `?next=` query param so flows that require a wallet
 * (e.g. claiming a Unit Packet or fulfilling a payment request from a
 * public link) can send a visitor here and land them back on the exact
 * page they came from once their wallet is ready — see
 * app/wallet/packet/[id]/page.tsx and app/pay/[encoded]/page.tsx.
 */
export default function OnboardingWalletPage() {
  return (
    <Suspense fallback={null}>
      <OnboardingWalletPageInner />
    </Suspense>
  );
}

function OnboardingWalletPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const { ensureSession, loginWithGoogle, executeChallenge, isReady, error: sdkError, userId } =
    useCircleSdk();
  const [status, setStatus] = useState<"idle" | "working" | "error" | "created">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null);
  const [recoveryConfirm, setRecoveryConfirm] = useState("");
  const [copied, setCopied] = useState(false);
  const autoCreateAttemptedRef = useRef(false);

  useEffect(() => {
    const storedUserId = getStoredUserId();
    if (!storedUserId) return;
    if (isWalletBackupComplete()) {
      router.replace(next || "/wallet");
      return;
    }
    if (getStoredAuthMethod() === "google") return;
    queueMicrotask(() => {
      setRecoveryCode(storedUserId);
      setStatus("created");
    });
  }, [next, router]);

  useEffect(() => {
    if (!userId || status !== "idle" || autoCreateAttemptedRef.current) return;
    if (getStoredAuthMethod() !== "google" || isWalletBackupComplete()) return;
    autoCreateAttemptedRef.current = true;
    void handleCreateWallet();
    // handleCreateWallet intentionally remains an event-style function; this
    // effect only resumes a returned Google OAuth session once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, userId]);

  async function handleCreateWallet() {
    setStatus("working");
    setMessage("Setting up your session...");
    try {
      const { userId, userToken } = await ensureSession();

      setMessage("Creating your Arc Testnet wallet...");
      const { challengeId } = await apiPost<{ challengeId: string }>(
        "/api/wallet/initialize",
        {
          userToken,
          blockchains: [PRIMARY_CHAIN.circleBlockchain],
          accountType: getStoredAuthMethod() === "google" ? "SCA" : "EOA",
        },
      );

      if (!challengeId) {
        throw new Error("No challenge returned — user may already be initialized.");
      }

      setMessage("Set your PIN to secure your wallet...");
      await executeChallenge(challengeId);

      const { wallets } = await apiPost<{ wallets: UnitPayWallet[] }>(
        "/api/wallet/list",
        { userToken },
      );

      if (!wallets || wallets.length === 0) {
        throw new Error("Wallet creation did not return any wallets.");
      }

      if (getStoredAuthMethod() === "google") {
        markWalletBackupComplete();
        router.push(next || "/wallet");
        return;
      }

      // Show the recovery code once, right after successful creation, so
      // the user can save it before continuing into the app. This is the
      // ONLY way to log back in on a different browser/device — Circle
      // User-Controlled Wallets has no email/password of its own.
      setRecoveryCode(userId);
      setStatus("created");
      setMessage(null);
    } catch (err) {
      const msg = (err as Error).message ?? String(err);

      // Circle error 155106 = user already initialized. Treat as success path.
      if (msg.includes("155106") || msg.toLowerCase().includes("already")) {
        const storedUserId = getStoredUserId();
        if (storedUserId && !isWalletBackupComplete()) {
          if (getStoredAuthMethod() === "google") {
            markWalletBackupComplete();
            router.push(next || "/wallet");
            return;
          }
          setRecoveryCode(storedUserId);
          setStatus("created");
          setMessage(null);
          return;
        }
        router.push(next || "/wallet");
        return;
      }

      setStatus("error");
      setMessage(msg);
    }
  }

  async function handleGoogleCreate() {
    setStatus("working");
    setMessage("Opening Google sign in...");
    try {
      await loginWithGoogle();
    } catch (err) {
      setStatus("error");
      setMessage((err as Error).message ?? String(err));
    }
  }

  async function handleCopyCode() {
    if (!recoveryCode) return;
    try {
      await navigator.clipboard.writeText(recoveryCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable — user can still select + copy manually.
    }
  }

  if (status === "created" && recoveryCode) {
    const backupVerified = recoveryConfirm.trim() === recoveryCode;

    return (
      <main className="min-h-full flex flex-col items-center justify-center px-6 py-12 sm:py-16">
        <div className="w-full max-w-sm sm:max-w-md space-y-7 sm:space-y-8 text-center">
          <div className="flex flex-col items-center gap-4">
            <Logo size={56} withWordmark={false} />
            <div className="space-y-2">
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
                Save your recovery code
              </h1>
              <p className="text-muted text-sm sm:text-base leading-relaxed">
                This code is the only way to log back into this wallet from a different browser
                or device. Store it somewhere safe — UnitPay cannot recover it for you.
              </p>
            </div>
          </div>

          <div className="space-y-3 text-left">
            <div className="rounded-xl bg-surface border border-border px-3.5 py-3 font-mono text-xs sm:text-sm break-all">
              {recoveryCode}
            </div>
            <Button onClick={handleCopyCode} variant="secondary" size="lg" fullWidth>
              {copied ? "Copied!" : "Copy recovery code"}
            </Button>
            <Field label="Confirm recovery code">
              <Input
                value={recoveryConfirm}
                onChange={(e) => setRecoveryConfirm(e.target.value)}
                placeholder="Paste the recovery code here"
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
              />
            </Field>
          </div>

          <Button
            onClick={() => {
              markWalletBackupComplete();
              router.push(next || "/wallet");
            }}
            disabled={!backupVerified}
            size="lg"
            fullWidth
          >
            Verify backup &amp; continue
          </Button>

          <p className="text-xs text-subtle leading-relaxed">
            This browser stays signed in until you log out. Use Settings to log out before
            switching to a different UnitPay account.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-full flex flex-col items-center justify-center px-6 py-12 sm:py-16">
      <div className="w-full max-w-sm sm:max-w-md space-y-7 sm:space-y-8 text-center">
        <div className="flex flex-col items-center gap-4">
          <Logo size={56} withWordmark={false} />
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
              Set up your wallet
            </h1>
            <p className="text-muted text-sm sm:text-base leading-relaxed">
              Hold, send, and receive USDC across chains — demoed end-to-end on{" "}
              <span className="text-foreground font-medium">{PRIMARY_CHAIN.label}</span>, powered
              by Circle.
            </p>
          </div>
        </div>

        <Button
          onClick={handleCreateWallet}
          disabled={!isReady || status === "working"}
          size="lg"
          fullWidth
        >
          {status === "working" ? "Working..." : "Create my wallet"}
        </Button>

        <Button
          onClick={handleGoogleCreate}
          disabled={!isReady || status === "working"}
          size="lg"
          variant="secondary"
          fullWidth
        >
          Continue with Google
        </Button>

        {message && (
          <p
            className={`text-sm ${status === "error" ? "text-error" : "text-muted"}`}
            role="status"
          >
            {message}
          </p>
        )}

        {sdkError && <p className="text-error text-xs">SDK error: {sdkError}</p>}

        <p className="text-xs text-subtle leading-relaxed">
          No seed phrase shown. Your wallet is secured by a PIN and Circle&apos;s MPC key
          infrastructure. Backup is required before onboarding is complete.
        </p>

        <div className="flex items-center justify-center gap-4 text-xs">
          <Link
            href={next ? `/onboarding/login?next=${encodeURIComponent(next)}` : "/onboarding/login"}
            className="text-muted hover:text-foreground transition-colors"
          >
            Already have a wallet? Log in
          </Link>
          <span className="text-subtle">·</span>
          <Link href="/onboarding" className="text-muted hover:text-foreground transition-colors">
            ← Back to overview
          </Link>
        </div>
      </div>
    </main>
  );
}
