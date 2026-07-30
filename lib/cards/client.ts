"use client";

import type { VirtualCard, VirtualCardStatus } from "@/lib/cards/types";

async function parseJson<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error ?? "Request failed");
  return body as T;
}

export async function listVirtualCardsRemote(ownerCircleWalletId?: string): Promise<VirtualCard[]> {
  const params = ownerCircleWalletId
    ? `?owner=${encodeURIComponent(ownerCircleWalletId)}`
    : "";
  const { cards } = await parseJson<{ cards: VirtualCard[] }>(
    await fetch(`/api/cards${params}`, { cache: "no-store" }),
  );
  return cards;
}

export async function createVirtualCardRemote(input: Record<string, unknown>): Promise<VirtualCard> {
  const { card } = await parseJson<{ card: VirtualCard }>(
    await fetch("/api/cards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
  return card;
}

export async function updateVirtualCardStatusRemote(
  id: string,
  status: VirtualCardStatus,
): Promise<VirtualCard> {
  const { card } = await parseJson<{ card: VirtualCard }>(
    await fetch(`/api/cards/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    }),
  );
  return card;
}
