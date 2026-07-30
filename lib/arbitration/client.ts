"use client";

import type { ArbitratorRule } from "@/lib/arbitration/types";

async function parseJson<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error ?? "Request failed");
  return body as T;
}

export async function listArbitratorRulesRemote(owner?: string): Promise<ArbitratorRule[]> {
  const query = owner ? `?owner=${encodeURIComponent(owner)}` : "";
  const { rules } = await parseJson<{ rules: ArbitratorRule[] }>(
    await fetch(`/api/arbitrators${query}`, { cache: "no-store" }),
  );
  return rules;
}

export async function createArbitratorRuleRemote(
  input: Record<string, unknown>,
): Promise<ArbitratorRule> {
  const { rule } = await parseJson<{ rule: ArbitratorRule }>(
    await fetch("/api/arbitrators", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
  return rule;
}
