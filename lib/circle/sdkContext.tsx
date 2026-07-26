"use client";

import { W3SSdk } from "@circle-fin/w3s-pw-web-sdk";
import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  ENCRYPTION_KEY_STORAGE_KEY,
  USER_ID_STORAGE_KEY,
  USER_TOKEN_EXP_STORAGE_KEY,
  USER_TOKEN_STORAGE_KEY,
  clearWalletSession,
} from "@/lib/session";

// Circle user tokens are valid for 60 minutes; refresh a little early.
const TOKEN_TTL_MS = 55 * 60 * 1000;

interface CircleSdkState {
  sdk: W3SSdk | null;
  userId: string | null;
  userToken: string | null;
  encryptionKey: string | null;
  isReady: boolean;
  error: string | null;
}

interface CircleSdkContextValue extends CircleSdkState {
  /** Creates (or reuses) a local userId and fetches a fresh userToken/encryptionKey. */
  ensureSession: () => Promise<{ userId: string; userToken: string; encryptionKey: string }>;
  /** Restores the current browser session if one exists; returns null for logged-out visitors. */
  getExistingSession: () => Promise<{
    userId: string;
    userToken: string;
    encryptionKey: string;
  } | null>;
  /**
   * Restores a session on THIS browser for a userId that already exists in
   * Circle (e.g. a wallet created on another device). Fetches a fresh
   * userToken/encryptionKey for that userId and persists it locally, same as
   * ensureSession, but never calls createUser — an unknown userId surfaces
   * as a normal error from /api/wallet/get-token instead of silently
   * minting a brand-new (empty) account.
   */
  loginWithRecoveryCode: (
    userId: string,
  ) => Promise<{ userId: string; userToken: string; encryptionKey: string }>;
  /** Wraps sdk.execute() in a Promise for simpler call sites. */
  executeChallenge: (challengeId: string) => Promise<{
    status: string;
    type?: string;
    data?: unknown;
  }>;
  signOut: () => void;
}

const CircleSdkContext = createContext<CircleSdkContextValue | null>(null);

function randomUserId(): string {
  // A demo-grade stable per-browser user id. Not an auth system — this is a
  // testnet demo, not a production identity provider.
  return `unitpay_${crypto.randomUUID()}`;
}

export function CircleSdkProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CircleSdkState>({
    sdk: null,
    userId: null,
    userToken: null,
    encryptionKey: null,
    isReady: false,
    error: null,
  });

  const sdkRef = useRef<W3SSdk | null>(null);

  useEffect(() => {
    const appId = process.env.NEXT_PUBLIC_CIRCLE_APP_ID;
    const sdk = new W3SSdk(appId ? { appSettings: { appId } } : undefined);
    sdkRef.current = sdk;

    // Required: establishes the SDK's iframe session with Circle. Without
    // this call sdk.execute() silently fails (per Circle's own docs).
    sdk
      .getDeviceId()
      .catch((err) => {
        setState((prev) => ({ ...prev, error: String(err) }));
      })
      .finally(() => {
        const storedUserId = window.localStorage.getItem(USER_ID_STORAGE_KEY);
        setState((prev) => ({ ...prev, sdk, userId: storedUserId, isReady: true }));
      });
  }, []);

  const fetchFreshToken = useCallback(async (userId: string) => {
    const res = await fetch("/api/wallet/get-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.message ?? body.error ?? "Failed to fetch Circle user token");
    }
    const { userToken, encryptionKey } = await res.json();
    return { userToken, encryptionKey } as { userToken: string; encryptionKey: string };
  }, []);

  const ensureSession = useCallback(async () => {
    let userId = window.localStorage.getItem(USER_ID_STORAGE_KEY);
    if (!userId) {
      userId = randomUserId();
      window.localStorage.setItem(USER_ID_STORAGE_KEY, userId);

      const createRes = await fetch("/api/wallet/create-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (!createRes.ok) {
        const body = await createRes.json().catch(() => ({}));
        throw new Error(body.message ?? body.error ?? "Failed to create Circle user");
      }
    }

    const cachedToken = window.localStorage.getItem(USER_TOKEN_STORAGE_KEY);
    const cachedExp = Number(window.localStorage.getItem(USER_TOKEN_EXP_STORAGE_KEY) ?? 0);
    const cachedEncryptionKey = window.localStorage.getItem(ENCRYPTION_KEY_STORAGE_KEY);

    let userToken = cachedToken;
    let encryptionKey = cachedEncryptionKey;

    if (!userToken || !encryptionKey || Date.now() > cachedExp) {
      const fresh = await fetchFreshToken(userId);
      userToken = fresh.userToken;
      encryptionKey = fresh.encryptionKey;
      window.localStorage.setItem(USER_TOKEN_STORAGE_KEY, userToken);
      window.localStorage.setItem(ENCRYPTION_KEY_STORAGE_KEY, encryptionKey);
      window.localStorage.setItem(
        USER_TOKEN_EXP_STORAGE_KEY,
        String(Date.now() + TOKEN_TTL_MS),
      );
    }

    const sdk = sdkRef.current;
    if (!sdk) throw new Error("Circle SDK not initialized yet");

    sdk.setAuthentication({ userToken, encryptionKey });

    setState((prev) => ({
      ...prev,
      userId,
      userToken,
      encryptionKey,
      error: null,
    }));

    return { userId, userToken, encryptionKey };
  }, [fetchFreshToken]);

  const getExistingSession = useCallback(async () => {
    const userId = window.localStorage.getItem(USER_ID_STORAGE_KEY);
    if (!userId) return null;

    const cachedToken = window.localStorage.getItem(USER_TOKEN_STORAGE_KEY);
    const cachedExp = Number(window.localStorage.getItem(USER_TOKEN_EXP_STORAGE_KEY) ?? 0);
    const cachedEncryptionKey = window.localStorage.getItem(ENCRYPTION_KEY_STORAGE_KEY);

    let userToken = cachedToken;
    let encryptionKey = cachedEncryptionKey;

    if (!userToken || !encryptionKey || Date.now() > cachedExp) {
      const fresh = await fetchFreshToken(userId);
      userToken = fresh.userToken;
      encryptionKey = fresh.encryptionKey;
      window.localStorage.setItem(USER_TOKEN_STORAGE_KEY, userToken);
      window.localStorage.setItem(ENCRYPTION_KEY_STORAGE_KEY, encryptionKey);
      window.localStorage.setItem(
        USER_TOKEN_EXP_STORAGE_KEY,
        String(Date.now() + TOKEN_TTL_MS),
      );
    }

    const sdk = sdkRef.current;
    if (!sdk) throw new Error("Circle SDK not initialized yet");
    sdk.setAuthentication({ userToken, encryptionKey });

    setState((prev) => ({
      ...prev,
      userId,
      userToken,
      encryptionKey,
      error: null,
    }));

    return { userId, userToken, encryptionKey };
  }, [fetchFreshToken]);

  const loginWithRecoveryCode = useCallback(
    async (userId: string) => {
      const trimmed = userId.trim();
      if (!trimmed) {
        throw new Error("Recovery code is required");
      }

      const activeUserId = window.localStorage.getItem(USER_ID_STORAGE_KEY);
      if (activeUserId && activeUserId !== trimmed) {
        throw new Error(
          "Another UnitPay account is already active in this browser. Log out before signing in with a different account.",
        );
      }

      const fresh = await fetchFreshToken(trimmed);
      const { userToken, encryptionKey } = fresh;

      window.localStorage.setItem(USER_ID_STORAGE_KEY, trimmed);
      window.localStorage.setItem(USER_TOKEN_STORAGE_KEY, userToken);
      window.localStorage.setItem(ENCRYPTION_KEY_STORAGE_KEY, encryptionKey);
      window.localStorage.setItem(
        USER_TOKEN_EXP_STORAGE_KEY,
        String(Date.now() + TOKEN_TTL_MS),
      );

      const sdk = sdkRef.current;
      if (!sdk) throw new Error("Circle SDK not initialized yet");
      sdk.setAuthentication({ userToken, encryptionKey });

      setState((prev) => ({
        ...prev,
        userId: trimmed,
        userToken,
        encryptionKey,
        error: null,
      }));

      return { userId: trimmed, userToken, encryptionKey };
    },
    [fetchFreshToken],
  );

  const executeChallenge = useCallback(
    (challengeId: string) =>
      new Promise<{ status: string; type?: string; data?: unknown }>((resolve, reject) => {
        const sdk = sdkRef.current;
        if (!sdk) {
          reject(new Error("Circle SDK not initialized yet"));
          return;
        }
        sdk.execute(challengeId, (error, result) => {
          if (error) {
            reject(new Error(error.message ?? "Challenge failed"));
            return;
          }
          resolve({ status: result?.status ?? "UNKNOWN", type: result?.type, data: result });
        });
      }),
    [],
  );

  const signOut = useCallback(() => {
    clearWalletSession();
    setState((prev) => ({
      ...prev,
      userId: null,
      userToken: null,
      encryptionKey: null,
    }));
  }, []);

  return (
    <CircleSdkContext.Provider
      value={{
        ...state,
        ensureSession,
        getExistingSession,
        loginWithRecoveryCode,
        executeChallenge,
        signOut,
      }}
    >
      {children}
    </CircleSdkContext.Provider>
  );
}

export function useCircleSdk() {
  const ctx = useContext(CircleSdkContext);
  if (!ctx) {
    throw new Error("useCircleSdk must be used within a CircleSdkProvider");
  }
  return ctx;
}
