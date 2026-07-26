"use client";

/** Thin wrapper around fetch for our own /api/wallet/* routes. */
export async function apiPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json?.message ?? json?.error ?? `Request to ${path} failed (${res.status})`);
  }
  return json as T;
}
