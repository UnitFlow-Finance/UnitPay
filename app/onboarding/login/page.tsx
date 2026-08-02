"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { apiPost } from "@/lib/api";
import { useCircleSdk } from "@/lib/circle/sdkContext";
import { hasStoredUserSession } from "@/lib/session";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";

/**
 * "Log in to an existing wallet" — the counterpart to /onboarding/wallet's
 * "Create my wallet". Circle User-Controlled Wallets has no email/password
 * of its own, so the recovery code IS the Circle `userId` we mint at
 * signup (see /onboarding/wallet). Pasting it here on any browser/device
 * fetches a fresh session for that userId, then walks the user through
 * Circle's PIN-restore challenge (security questions + new PIN), which
 * Circle's hosted UI collected automatically during original wallet setup.
 *
 * Supports an optional `?next=` query param — see /onboarding/wallet for
 * the full rationale (used by public-link claim flows).
 */
export default function OnboardingLoginPage() {
  return (
    <Suspense fallback={null}>
      <OnboardingLoginPageInner />
    </Suspense>
  );
}

function OnboardingLoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const {
    loginWithRecoveryCode,
    loginWithGoogle,
    executeChallenge,
    isReady,
    userId,
    error: sdkError,
  } = useCircleSdk();
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<"idle" | "working" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (hasStoredUserSession()) {
      router.replace(next || "/wallet");
    }
  }, [next, router, userId]);

  async function handleLogin() {
    setStatus("working");
    setMessage("Verifying recovery code...");
    try {
      const { userToken } = await loginWithRecoveryCode(code);

      setMessage("Requesting account recovery...");
      const { challengeId } = await apiPost<{ challengeId: string }>(
        "/api/wallet/restore-pin",
        { userToken },
      );

      if (!challengeId) {
        throw new Error("No recovery challenge returned.");
      }

      setMessage("Answer your security questions and set a new PIN...");
      await executeChallenge(challengeId);

      setMessage("Wallet restored. Redirecting...");
      router.push(next || "/wallet");
    } catch (err) {
      const msg = (err as Error).message ?? String(err);
      setStatus("error");
      setMessage(msg);
    }
  }

  async function handleGoogleLogin() {
    setStatus("working");
    setMessage("Opening Google sign in...");
    try {
      await loginWithGoogle();
    } catch (err) {
      setStatus("error");
      setMessage((err as Error).message ?? String(err));
    }
  }

  return (
    <main className="min-h-full flex flex-col items-center justify-center px-6 py-12 sm:py-16">
      <div className="w-full max-w-sm sm:max-w-md space-y-7 sm:space-y-8 text-center">
        <div className="flex flex-col items-center gap-4">
          <Logo size={56} withWordmark={false} />
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
              Log in to your wallet
            </h1>
            <p className="text-muted text-sm sm:text-base leading-relaxed">
              Enter the recovery code you saved when you created your wallet. If this browser
              already has an active session, UnitPay will continue without asking again.
            </p>
          </div>
        </div>

        <div className="space-y-4 text-left">
          <Button
            onClick={handleGoogleLogin}
            disabled={!isReady || status === "working"}
            size="lg"
            variant="secondary"
            fullWidth
          >
            Continue with Google
          </Button>

          <div className="flex items-center gap-3">
            <span className="h-px flex-1 bg-border" />
            <span className="text-[11px] uppercase tracking-wide text-subtle">or</span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <Field label="Recovery code">
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="unitpay_xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
            />
          </Field>

          <Button
            onClick={handleLogin}
            disabled={!isReady || !code.trim() || status === "working"}
            size="lg"
            fullWidth
          >
            {status === "working" ? "Working..." : "Log in"}
          </Button>
        </div>

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
          Google login uses the Circle social-login configuration for this app. Recovery code
          login remains available for older UnitPay wallets and trusted-device sessions.
        </p>

        <div className="flex items-center justify-center gap-4 text-xs">
          <Link
            href={next ? `/onboarding/wallet?next=${encodeURIComponent(next)}` : "/onboarding/wallet"}
            className="text-muted hover:text-foreground transition-colors"
          >
            Create a new wallet instead
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
