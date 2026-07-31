"use client";

import type { P2PCustomerPayoutDetail, P2PMerchantProfile, P2POffer, P2PTrade } from "@/lib/p2p/types";

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

export async function updateP2POfferRemote(id: string, input: Record<string, unknown>): Promise<P2POffer> {
  const { offer } = await parseJson<{ offer: P2POffer }>(
    await fetch(`/api/p2p/offers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
  return offer;
}

export async function deleteP2POfferRemote(id: string): Promise<void> {
  await parseJson<{ ok: boolean }>(await fetch(`/api/p2p/offers/${id}`, { method: "DELETE" }));
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

export async function listP2PTradesRemote(walletId?: string): Promise<P2PTrade[]> {
  const params = walletId ? `?walletId=${encodeURIComponent(walletId)}` : "";
  const { trades } = await parseJson<{ trades: P2PTrade[] }>(
    await fetch(`/api/p2p/trades${params}`, { cache: "no-store" }),
  );
  return trades;
}

export async function getP2PTradeRemote(id: string): Promise<P2PTrade | null> {
  const { trade } = await parseJson<{ trade: P2PTrade | null }>(
    await fetch(`/api/p2p/trades/${id}`, { cache: "no-store" }),
  );
  return trade;
}

export async function updateP2PTradeRemote(id: string, input: Record<string, unknown>): Promise<P2PTrade> {
  const { trade } = await parseJson<{ trade: P2PTrade }>(
    await fetch(`/api/p2p/trades/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
  return trade;
}

export async function listP2PMerchantsRemote(): Promise<P2PMerchantProfile[]> {
  const { merchants } = await parseJson<{ merchants: P2PMerchantProfile[] }>(
    await fetch("/api/p2p/merchants", { cache: "no-store" }),
  );
  return merchants;
}

export async function getP2PMerchantRemote(id: string): Promise<P2PMerchantProfile | null> {
  const { merchant } = await parseJson<{ merchant: P2PMerchantProfile | null }>(
    await fetch(`/api/p2p/merchants/${id}`, { cache: "no-store" }),
  );
  return merchant;
}

export async function upsertP2PMerchantRemote(input: Record<string, unknown>): Promise<P2PMerchantProfile> {
  const { merchant } = await parseJson<{ merchant: P2PMerchantProfile }>(
    await fetch("/api/p2p/merchants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
  return merchant;
}

export async function listP2PPayoutDetailsRemote(
  ownerCircleWalletId: string,
  method?: string,
): Promise<P2PCustomerPayoutDetail[]> {
  const params = new URLSearchParams({ ownerCircleWalletId });
  if (method) params.set("method", method);
  const { details } = await parseJson<{ details: P2PCustomerPayoutDetail[] }>(
    await fetch(`/api/p2p/payout-details?${params.toString()}`, { cache: "no-store" }),
  );
  return details;
}

export async function createP2PPayoutDetailRemote(
  input: Record<string, unknown>,
): Promise<P2PCustomerPayoutDetail> {
  const { detail } = await parseJson<{ detail: P2PCustomerPayoutDetail }>(
    await fetch("/api/p2p/payout-details", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
  return detail;
}

export async function updateP2PPayoutDetailRemote(
  id: string,
  input: Record<string, unknown>,
): Promise<P2PCustomerPayoutDetail> {
  const { detail } = await parseJson<{ detail: P2PCustomerPayoutDetail }>(
    await fetch(`/api/p2p/payout-details/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
  return detail;
}

export async function deleteP2PPayoutDetailRemote(
  id: string,
  ownerCircleWalletId: string,
): Promise<void> {
  await parseJson<{ ok: boolean }>(
    await fetch(`/api/p2p/payout-details/${id}?ownerCircleWalletId=${encodeURIComponent(ownerCircleWalletId)}`, {
      method: "DELETE",
    }),
  );
}
