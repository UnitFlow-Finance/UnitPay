"use client";

const PODS_STORAGE_KEY = "unitpay.escrowPods";
const CONTRIBUTIONS_STORAGE_KEY = "unitpay.escrowPodContributions";
const MIGRATED_STORAGE_KEY = "unitpay.escrowPods.serverMigrated";

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export async function migrateLegacyPods(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (window.localStorage.getItem(MIGRATED_STORAGE_KEY) === "1") return false;
  const pods = readJson<unknown[]>(PODS_STORAGE_KEY, []);
  if (pods.length === 0) {
    window.localStorage.setItem(MIGRATED_STORAGE_KEY, "1");
    return false;
  }
  const contributions = readJson<unknown[]>(CONTRIBUTIONS_STORAGE_KEY, []);
  const response = await fetch("/api/pods/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pods, contributions }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? "Could not import legacy pods.");
  }
  window.localStorage.setItem(MIGRATED_STORAGE_KEY, "1");
  return true;
}
