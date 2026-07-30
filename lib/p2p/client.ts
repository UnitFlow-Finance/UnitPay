"use client";

import type { P2POffer, P2PTrade } from "@/lib/p2p/types";

async function parseJson<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error ?? "Request failed");
  return body as T;
}

export async function listP2POffersRemote(filters: URLSearchParams): Promise<P2POffer[]> {
  const { offers } = await parseJson<{ offers: P2POffer[] }>(
    await fetch(`/api/p2p/offers?${filters.toString()}`, { cache: "no-store" }),
  );
  return offers;
}

export async function getP2POfferRemote(id: string): Promise<P2POffer | null> {
  const { offer } = await parseJson<{ offer: P2POffer | null }>(
    await fetch(`/api/p2p/offers/${id}`, { cache: "no-store" }),
  );
  return offer;
}

export async function createP2POfferRemote(input: Record<string, unknown>): Promise<P2POffer> {
  const { offer } = await parseJson<{ offer: P2POffer }>(
    await fetch("/api/p2p/offers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
  return offer;
}

export async function createP2PTradeRemote(input: Record<string, unknown>): Promise<P2PTrade> {
  const { trade } = await parseJson<{ trade: P2PTrade }>(
    await fetch("/api/p2p/trades", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
  return trade;
}
